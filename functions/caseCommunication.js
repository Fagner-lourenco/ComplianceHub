/**
 * Case Communication Module
 * Sistema de comunicacao entre cliente e operacional vinculado a cada caso.
 */

const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { onCall } = require('firebase-functions/v2/https');

// Roles
const CLIENT_ROLES = new Set(['client_viewer', 'client_operator', 'client_manager', 'CLIENT']);
const OPS_ROLES = new Set(['analyst', 'supervisor', 'admin', 'owner']);
const CLIENT_VIEW_ROLES = new Set(['client_viewer', 'client_operator', 'client_manager', 'CLIENT']);

function resolveUserPortal(profile) {
    if (CLIENT_ROLES.has(profile.role)) return 'client';
    if (OPS_ROLES.has(profile.role)) return 'ops';
    return 'system';
}

async function assertCanAccessCaseCommunication({ profile, caseId, db }) {
    const caseRef = db.collection('cases').doc(caseId);
    const caseDoc = await caseRef.get();
    
    if (!caseDoc.exists) {
        const { HttpsError } = require('firebase-functions/v2/https');
        throw new HttpsError('not-found', 'Caso nao encontrado.');
    }
    
    const caseData = caseDoc.data() || {};
    
    if (!caseData.tenantId) {
        const { HttpsError } = require('firebase-functions/v2/https');
        throw new HttpsError('failed-precondition', 'Caso sem tenantId.');
    }
    
    const portal = resolveUserPortal(profile);
    
    if (portal === 'client') {
        if (caseData.tenantId !== profile.tenantId) {
            const { HttpsError } = require('firebase-functions/v2/https');
            throw new HttpsError('permission-denied', 'Caso fora do seu tenant.');
        }
    } else if (portal === 'ops') {
        if (!profile.tenantId && (profile.role === 'admin' || profile.role === 'owner')) {
            // admin/owner global pode acessar
        } else if (caseData.tenantId !== profile.tenantId) {
            const { HttpsError } = require('firebase-functions/v2/https');
            throw new HttpsError('permission-denied', 'Sem permissao para operar neste caso.');
        }
    } else {
        const { HttpsError } = require('firebase-functions/v2/https');
        throw new HttpsError('permission-denied', 'Perfil nao autorizado.');
    }
    
    return { caseData, portal };
}

function sanitizeCaseMessageBody(input) {
    const str = String(input || '').trim();
    if (!str) {
        const { HttpsError } = require('firebase-functions/v2/https');
        throw new HttpsError('invalid-argument', 'Mensagem nao pode estar vazia.');
    }
    
    const cleaned = str
        .replace(/[^\S\n\r]/g, ' ')
        .slice(0, 1500);
    
    if (!cleaned.trim()) {
        const { HttpsError } = require('firebase-functions/v2/https');
        throw new HttpsError('invalid-argument', 'Mensagem nao pode estar vazia.');
    }
    
    const bodyPreview = cleaned
        .replace(/\n+/g, ' ')
        .slice(0, 120)
        .trim();
    
    return { body: cleaned, bodyPreview };
}

async function createSystemCaseMessage({
    caseId,
    tenantId,
    systemType,
    body,
    db,
}) {
    const messageRef = db.collection('caseMessages').doc();
    const messageId = messageRef.id;
    
    const payload = {
        tenantId,
        caseId,
        senderUid: 'system',
        senderName: 'Sistema',
        senderEmail: null,
        senderRole: 'system',
        senderPortal: 'system',
        body,
        bodyPreview: body.replace(/\n+/g, ' ').slice(0, 120).trim(),
        createdAt: FieldValue.serverTimestamp(),
        deleted: false,
        systemMessage: true,
        systemType: systemType || null,
    };
    
    await messageRef.set(payload);
    
    // Atualizar resumo no caso
    const caseUpdate = {
        lastMessageAt: FieldValue.serverTimestamp(),
        lastMessagePreview: payload.bodyPreview,
        lastMessageByPortal: 'system',
    };
    
    if (systemType === 'CORRECTION_REQUESTED') {
        caseUpdate.communicationStatus = 'WAITING_CLIENT';
        caseUpdate.clientUnreadMessages = FieldValue.increment(1);
    } else if (systemType === 'CORRECTION_SUBMITTED') {
        caseUpdate.communicationStatus = 'WAITING_OPS';
        caseUpdate.opsUnreadMessages = FieldValue.increment(1);
    }
    
    await db.collection('cases').doc(caseId).update(caseUpdate);
    
    return messageId;
}

const NOTIFICATION_TYPES = {
    CASE_COMPLETED: 'CASE_COMPLETED',
    NEW_CLIENT_SOLICITATION: 'NEW_CLIENT_SOLICITATION',
    CASE_MESSAGE_FROM_CLIENT: 'CASE_MESSAGE_FROM_CLIENT',
    CASE_MESSAGE_FROM_OPS: 'CASE_MESSAGE_FROM_OPS',
    CASE_RETURNED: 'CASE_RETURNED',
};

function sanitizeNotificationIdPart(value) {
    if (!value) return 'x';
    return String(value)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 64);
}

function buildNotificationId(type, caseId, recipientUid, messageId = null) {
    const suffix = messageId || Date.now();
    return sanitizeNotificationIdPart(type) + '_' +
           sanitizeNotificationIdPart(caseId) + '_' +
           sanitizeNotificationIdPart(recipientUid) + '_' +
           sanitizeNotificationIdPart(suffix);
}

async function createNotification({ db, notificationInput }) {
    const {
        tenantId,
        recipientUid,
        type,
        title,
        message,
        targetUrl,
        caseId = null,
        candidateName = null,
        source = null,
        messageId = null,
    } = notificationInput;

    if (!tenantId || !recipientUid || !type || !title || !message || !targetUrl) {
        throw new Error('Missing required notification fields');
    }

    const notificationId = buildNotificationId(type, caseId || 'none', recipientUid, messageId);
    const notificationRef = db.collection('notifications').doc(notificationId);

    const payload = {
        tenantId,
        recipientUid,
        type,
        title,
        message,
        caseId: caseId || null,
        candidateName: candidateName || null,
        targetUrl,
        read: false,
        played: false,
        createdAt: FieldValue.serverTimestamp(),
        readAt: null,
        playedAt: null,
        createdBySystem: true,
        source: source || { kind: 'system', caseId: caseId || null, event: type },
    };

    await notificationRef.set(payload);
    return notificationId;
}

async function findClientNotificationRecipientsForCase({ db, caseData }) {
    const tenantId = caseData?.tenantId;
    if (!tenantId) return [];

    const snapshot = await db.collection('userProfiles')
        .where('tenantId', '==', tenantId)
        .where('role', 'in', Array.from(CLIENT_VIEW_ROLES))
        .get();

    const recipients = [];
    snapshot.docs.forEach((doc) => {
        const profile = doc.data();
        if (profile.status === 'inactive') return;
        recipients.push({ uid: doc.id, ...profile });
    });

    return recipients;
}

async function findOpsNotificationRecipientsForTenant({ db, tenantId }) {
    if (!tenantId) {
        console.warn('[notifications] findOpsNotificationRecipientsForTenant called without tenantId');
        return [];
    }

    const recipients = [];
    const seenUids = new Set();

    // 1. Busca usuarios OPS do tenant especifico
    const tenantSnapshot = await db.collection('userProfiles')
        .where('tenantId', '==', tenantId)
        .where('role', 'in', Array.from(OPS_ROLES))
        .get();

    tenantSnapshot.docs.forEach((doc) => {
        const profile = doc.data();
        if (profile.status === 'inactive') return;
        recipients.push({ uid: doc.id, ...profile });
        seenUids.add(doc.id);
    });

    // 2. Busca admins/owners globais (sem tenantId vinculado)
    const globalSnapshot = await db.collection('userProfiles')
        .where('role', 'in', ['admin', 'owner'])
        .get();

    globalSnapshot.docs.forEach((doc) => {
        const profile = doc.data();
        if (profile.status === 'inactive') return;
        if (profile.tenantId) return; // Skip se tem tenant especifico
        if (seenUids.has(doc.id)) return; // Deduplicacao
        recipients.push({ uid: doc.id, ...profile });
        seenUids.add(doc.id);
    });

    console.log(`[notifications] findOpsNotificationRecipientsForTenant(${tenantId}): found ${recipients.length} recipients (${tenantSnapshot.size} tenant-specific, ${globalSnapshot.size} global admins)`);

    return recipients;
}

exports.sendCaseMessage = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 30 },
    async (request) => {
        const db = getFirestore();
        const { HttpsError } = require('firebase-functions/v2/https');

        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const caseId = String(request.data?.caseId || '').trim();
        const body = String(request.data?.body || '').trim();

        if (!caseId || !body) {
            throw new HttpsError('invalid-argument', 'caseId e body sao obrigatorios.');
        }

        const profileDoc = await db.collection('userProfiles').doc(uid).get();
        if (!profileDoc.exists) {
            throw new HttpsError('permission-denied', 'Perfil nao encontrado.');
        }
        const profile = profileDoc.data();
        if (profile.status === 'inactive') {
            throw new HttpsError('permission-denied', 'Conta desativada.');
        }

        const { caseData, portal } = await assertCanAccessCaseCommunication({ profile, caseId, db });

        const { body: sanitizedBody, bodyPreview } = sanitizeCaseMessageBody(body);

        const messageRef = db.collection('caseMessages').doc();
        const messageId = messageRef.id;

        const messagePayload = {
            tenantId: caseData.tenantId,
            caseId,
            senderUid: uid,
            senderName: profile.name || profile.email || 'Usuario',
            senderEmail: profile.email || null,
            senderRole: profile.role,
            senderPortal: portal,
            body: sanitizedBody,
            bodyPreview,
            createdAt: FieldValue.serverTimestamp(),
            deleted: false,
            systemMessage: false,
            systemType: null,
        };

        await messageRef.set(messagePayload);

        const caseUpdate = {
            communicationStatus: portal === 'ops' ? 'WAITING_CLIENT' : 'WAITING_OPS',
            lastMessageAt: FieldValue.serverTimestamp(),
            lastMessagePreview: bodyPreview,
            lastMessageByPortal: portal,
        };

        if (portal === 'ops') {
            caseUpdate.clientUnreadMessages = FieldValue.increment(1);
            caseUpdate.opsUnreadMessages = 0;
        } else {
            caseUpdate.opsUnreadMessages = FieldValue.increment(1);
            caseUpdate.clientUnreadMessages = 0;
        }

        await db.collection('cases').doc(caseId).update(caseUpdate);

        try {
            const clientCaseUpdate = {
                communicationStatus: caseUpdate.communicationStatus,
                lastMessageAt: FieldValue.serverTimestamp(),
                lastMessagePreview: bodyPreview,
                lastMessageByPortal: portal,
            };
            if (portal === 'ops') {
                clientCaseUpdate.clientUnreadMessages = FieldValue.increment(1);
            }
            await db.collection('clientCases').doc(caseId).update(clientCaseUpdate);
        } catch (err) {
            console.warn('[communication] failed to update clientCase mirror', err);
        }

        const candidateName = caseData.candidateName || 'solicitacao';
        const tenantId = caseData.tenantId;

        try {
            if (portal === 'client') {
                const opsRecipients = await findOpsNotificationRecipientsForTenant({ db, tenantId });
                for (const recipient of opsRecipients) {
                    if (recipient.uid === uid) continue;
                    await createNotification({
                        db,
                        notificationInput: {
                            tenantId,
                            recipientUid: recipient.uid,
                            type: NOTIFICATION_TYPES.CASE_MESSAGE_FROM_CLIENT,
                            title: 'Nova resposta do cliente',
                            message: 'O cliente enviou uma mensagem sobre a analise de ' + candidateName + '.',
                            targetUrl: '/ops/caso/' + caseId,
                            caseId,
                            candidateName,
                        },
                    });
                }
            } else {
                const clientRecipients = await findClientNotificationRecipientsForCase({ db, caseData });
                for (const recipient of clientRecipients) {
                    if (recipient.uid === uid) continue;
                    await createNotification({
                        db,
                        notificationInput: {
                            tenantId,
                            recipientUid: recipient.uid,
                            type: NOTIFICATION_TYPES.CASE_MESSAGE_FROM_OPS,
                            title: 'Nova mensagem da equipe',
                            message: 'A equipe enviou uma mensagem sobre a analise de ' + candidateName + '.',
                            targetUrl: '/client/solicitacoes',
                            caseId,
                            candidateName,
                        },
                    });
                }
            }
        } catch (err) {
            console.warn('[communication] failed to create notifications', err);
        }

        return { ok: true, messageId };
    }
);

exports.markCaseCommunicationRead = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 30 },
    async (request) => {
        const db = getFirestore();
        const { HttpsError } = require('firebase-functions/v2/https');

        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const caseId = String(request.data?.caseId || '').trim();
        if (!caseId) {
            throw new HttpsError('invalid-argument', 'caseId obrigatorio.');
        }

        const profileDoc = await db.collection('userProfiles').doc(uid).get();
        if (!profileDoc.exists) {
            throw new HttpsError('permission-denied', 'Perfil nao encontrado.');
        }
        const profile = profileDoc.data();
        if (profile.status === 'inactive') {
            throw new HttpsError('permission-denied', 'Conta desativada.');
        }

        const { portal } = await assertCanAccessCaseCommunication({ profile, caseId, db });

        const caseUpdate = {};
        const clientCaseUpdate = {};

        if (portal === 'client') {
            caseUpdate.clientUnreadMessages = 0;
            clientCaseUpdate.clientUnreadMessages = 0;
        } else {
            caseUpdate.opsUnreadMessages = 0;
        }

        await db.collection('cases').doc(caseId).update(caseUpdate);

        if (portal === 'client') {
            try {
                await db.collection('clientCases').doc(caseId).update(clientCaseUpdate);
            } catch (err) {
                console.warn('[communication] failed to update clientCase mirror on read', err);
            }
        }

        return { ok: true };
    }
);

module.exports = {
    createSystemCaseMessage,
    assertCanAccessCaseCommunication,
    sanitizeCaseMessageBody,
    resolveUserPortal,
    NOTIFICATION_TYPES,
    buildNotificationId,
    sanitizeNotificationIdPart,
    createNotification,
    findClientNotificationRecipientsForCase,
    findOpsNotificationRecipientsForTenant,
    CLIENT_ROLES,
    OPS_ROLES,
    CLIENT_VIEW_ROLES,
    sendCaseMessage: exports.sendCaseMessage,
    markCaseCommunicationRead: exports.markCaseCommunicationRead,
};
