/**
 * Case Communication Module
 * Sistema de comunicacao entre cliente e operacional vinculado a cada caso.
 */

const { FieldValue } = require('firebase-admin/firestore');

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
};
