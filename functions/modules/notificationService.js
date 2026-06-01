/**
 * notificationService.js — Handlers de notificações e comunicação
 * Extraído do monolito index.js e caseCommunication.js
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { checkRateLimit } = require('../helpers/rateLimiter');
const {
  assertCanAccessCaseCommunication,
  sanitizeCaseMessageBody,
  createNotification,
  findClientNotificationRecipientsForCase,
  findOpsNotificationRecipientsForTenant,
  NOTIFICATION_TYPES,
} = require('../caseCommunication');

/* =========================================================
   NOTIFICATIONS — markNotificationAsRead
   ========================================================= */

function createMarkNotificationAsReadHandler({ db }) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 30, cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const { notificationId } = request.data || {};
      if (!notificationId) throw new HttpsError('invalid-argument', 'notificationId obrigatorio.');

      const notificationRef = db.collection('notifications').doc(notificationId);
      const notificationDoc = await notificationRef.get();
      if (!notificationDoc.exists) throw new HttpsError('not-found', 'Notificacao nao encontrada.');

      const notificationData = notificationDoc.data();
      if (notificationData.recipientUid !== uid) {
        throw new HttpsError('permission-denied', 'Sem permissao para alterar esta notificacao.');
      }

      await notificationRef.update({
        read: true,
        readAt: FieldValue.serverTimestamp(),
      });

      return { success: true };
    },
  );
}

/* =========================================================
   NOTIFICATIONS — markAllNotificationsAsRead
   ========================================================= */

function createMarkAllNotificationsAsReadHandler({ db }) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 30, cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const snapshot = await db.collection('notifications')
        .where('recipientUid', '==', uid)
        .where('read', '==', false)
        .limit(100)
        .get();

      if (snapshot.empty) return { updated: 0 };

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          read: true,
          readAt: FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      return { updated: snapshot.docs.length };
    },
  );
}

/* =========================================================
   GEOIP HELPERS
   ========================================================= */

function isPrivateOrLocalIp(ip) {
  const value = String(ip || '').trim();
  return (
    value === '127.0.0.1' ||
    value === '::1' ||
    value.startsWith('10.') ||
    value.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value)
  );
}

function normalizeIp(ip) {
  if (!ip) return null;
  let value = String(ip).trim();
  if (value.includes(',')) {
    const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const cleaned = part.startsWith('::ffff:') ? part.slice(7) : part;
      if (!isPrivateOrLocalIp(cleaned)) {
        return cleaned;
      }
    }
    value = parts[0];
  }
  if (value.startsWith('::ffff:')) value = value.slice(7);
  return value || null;
}

function getRequestIp(req) {
  const candidates = [
    req.headers['x-forwarded-for'],
    req.headers['x-real-ip'],
    req.headers['cf-connecting-ip'],
    req.headers['fastly-client-ip'],
    req.ip,
    req.socket?.remoteAddress,
  ];
  for (const candidate of candidates) {
    const ip = normalizeIp(candidate);
    if (ip) return ip;
  }
  return null;
}

function sanitizeGeoText(value, maxLength = 80) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

async function lookupIpLocation(ip) {
  if (!ip || isPrivateOrLocalIp(ip)) {
    return {
      ip,
      city: null,
      region: null,
      regionCode: null,
      countryName: null,
      countryCode: null,
      lookupOk: false,
      reason: 'private_or_local_ip',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ComplianceHub-SecurityContext/1.0',
      },
    });

    if (!response.ok) {
      return {
        ip,
        lookupOk: false,
        reason: `http_${response.status}`,
      };
    }

    const data = await response.json();

    return {
      ip,
      city: sanitizeGeoText(data.city) || null,
      region: sanitizeGeoText(data.region) || null,
      regionCode: sanitizeGeoText(data.region_code || data.regionCode, 12) || null,
      countryName: sanitizeGeoText(data.country_name || data.countryName) || null,
      countryCode: sanitizeGeoText(data.country_code || data.countryCode, 12) || null,
      lookupOk: true,
      provider: 'ipapi.co',
    };
  } catch (err) {
    return {
      ip,
      city: null,
      region: null,
      regionCode: null,
      countryName: null,
      countryCode: null,
      lookupOk: false,
      reason: err?.name === 'AbortError' ? 'timeout' : 'lookup_failed',
      provider: 'ipapi.co',
    };
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
   GEOIP — getClientGeoIp
   ========================================================= */

function createGetClientGeoIpHandler() {
  return onCall(
    {
      region: 'southamerica-east1',
      memory: '256MiB',
      timeoutSeconds: 10,
      cors: true,
    },
    async (request) => {
      const clientIp = getRequestIp(request.rawRequest) || normalizeIp(request.data?.clientIp);

      if (!clientIp) {
        return {
          monitored: true,
          ip: null,
          city: null,
          region: null,
          regionCode: null,
          countryName: null,
          countryCode: null,
          lookupOk: false,
          reason: 'ip_not_detected',
        };
      }

      const lookup = await lookupIpLocation(clientIp);

      return {
        monitored: true,
        ip: lookup.ip || clientIp,
        city: lookup.city || null,
        region: lookup.region || null,
        regionCode: lookup.regionCode || null,
        countryName: lookup.countryName || null,
        countryCode: lookup.countryCode || null,
        lookupOk: lookup.lookupOk === true,
        reason: lookup.reason || null,
        provider: lookup.provider || null,
      };
    },
  );
}

/* =========================================================
   CASE COMMUNICATION — sendCaseMessage
   ========================================================= */

function createSendCaseMessageHandler({ db, writeAuditEvent = null, ACTOR_TYPE = {}, SOURCE = {}, getClientIp = null, rateLimiter = checkRateLimit }) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 30 },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
      await rateLimiter(uid, { maxRequests: 20, windowMs: 60000, key: 'sendCaseMessage' });

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

      if (typeof writeAuditEvent === 'function') {
        await writeAuditEvent({
          action: 'CASE_MESSAGE_SENT',
          tenantId: caseData.tenantId,
          actor: {
            type: portal === 'client' ? ACTOR_TYPE.CLIENT_USER : ACTOR_TYPE.OPS_USER,
            id: uid,
            email: profile.email || uid,
            displayName: profile.displayName || profile.name || null,
          },
          entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
          related: { caseId, messageId },
          source: portal === 'client' ? SOURCE.PORTAL_CLIENT : SOURCE.PORTAL_OPS,
          ip: typeof getClientIp === 'function' ? getClientIp(request) : null,
          detail: `Mensagem enviada no caso ${caseId}.`,
          clientDetail: 'Mensagem registrada no caso.',
          metadata: {
            senderPortal: portal,
            bodyLength: sanitizedBody.length,
            bodyPreviewLength: bodyPreview.length,
          },
        });
      }

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

      try {
        if (portal === 'client') {
          const opsRecipients = await findOpsNotificationRecipientsForTenant({ db, tenantId: caseData.tenantId });
          console.log(`[notifications] sendCaseMessage case=${caseId}: ${opsRecipients.length} OPS recipients for message notification`);
          for (const recipient of opsRecipients) {
            if (recipient.uid === uid) continue;
            await createNotification({
              db,
              notificationInput: {
                tenantId: caseData.tenantId,
                recipientUid: recipient.uid,
                type: NOTIFICATION_TYPES.CASE_MESSAGE_FROM_CLIENT,
                title: 'Nova resposta do cliente',
                message: 'O cliente enviou uma mensagem sobre a analise de ' + candidateName + '.',
                targetUrl: '/ops/caso/' + caseId,
                caseId,
                candidateName,
                messageId,
              },
            });
          }
        } else {
          const clientRecipients = await findClientNotificationRecipientsForCase({ db, caseData });
          console.log(`[notifications] sendCaseMessage case=${caseId}: ${clientRecipients.length} CLIENT recipients for message notification`);
          for (const recipient of clientRecipients) {
            if (recipient.uid === uid) continue;
            await createNotification({
              db,
              notificationInput: {
                tenantId: caseData.tenantId,
                recipientUid: recipient.uid,
                type: NOTIFICATION_TYPES.CASE_MESSAGE_FROM_OPS,
                title: 'Nova mensagem da equipe',
                message: 'A equipe enviou uma mensagem sobre a analise de ' + candidateName + '.',
                targetUrl: '/client/solicitacoes',
                caseId,
                candidateName,
                messageId,
              },
            });
          }
        }
      } catch (err) {
        console.warn('[communication] failed to create notifications', err);
      }

      return { ok: true, messageId };
    },
  );
}

/* =========================================================
   CASE COMMUNICATION — markCaseCommunicationRead
   ========================================================= */

function createMarkCaseCommunicationReadHandler({ db }) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 30 },
    async (request) => {
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

      const { portal } = await assertCanAccessCaseCommunication({ uid, profile, caseId, db });

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
    },
  );
}

/* =========================================================
   SYSTEM NOTIFICATIONS — createCaseCompletedNotifications
   ========================================================= */

async function createCaseCompletedNotifications(caseId, caseData, caseComm) {
  const recipients = await caseComm.findClientNotificationRecipientsForCase(caseData);
  console.log(`[notifications] createCaseCompletedNotifications case=${caseId}: ${recipients.length} client recipients found`);

  if (recipients.length === 0) {
    console.warn('[notifications] createCaseCompletedNotifications: no client recipients found, skipping');
    return [];
  }

  const candidateName = caseData?.candidateName || 'solicitação';
  const tenantId = caseData?.tenantId;

  const results = [];
  const failedRecipients = [];
  for (const recipient of recipients) {
    try {
      const nid = await caseComm.createNotification({
        tenantId,
        recipientUid: recipient.uid,
        type: caseComm.NOTIFICATION_TYPES.CASE_COMPLETED,
        title: 'Análise concluída',
        message: `A análise de ${candidateName} já está disponível.`,
        targetUrl: `/client/relatorio/${caseId}`,
        caseId,
        candidateName,
        source: { kind: 'system', caseId, event: 'case_completed' },
      });
      results.push(nid);
    } catch (err) {
      console.warn('[notifications] failed to create CASE_COMPLETED for', recipient.uid, err.message);
      failedRecipients.push(recipient.uid);
    }
  }
  console.log(`[notifications] createCaseCompletedNotifications case=${caseId}: ${results.length} sent, ${failedRecipients.length} failed`);
  return results;
}

/* =========================================================
   SYSTEM NOTIFICATIONS — createNewSolicitationNotifications
   ========================================================= */

async function createNewSolicitationNotifications(caseId, caseData, caseComm) {
  const tenantId = caseData?.tenantId;
  console.log(`[notifications] createNewSolicitationNotifications case=${caseId} tenant=${tenantId}: starting`);
  const recipients = await caseComm.findOpsNotificationRecipientsForTenant(tenantId);
  console.log(`[notifications] createNewSolicitationNotifications case=${caseId}: ${recipients.length} OPS recipients found`);

  if (recipients.length === 0) {
    console.warn('[notifications] createNewSolicitationNotifications: no OPS recipients found, skipping');
    return [];
  }

  const candidateName = String(caseData?.candidateName || 'solicitação').replace(/[<>&"']/g, '');
  const tenantName = String(caseData?.tenantName || 'Uma empresa').replace(/[<>&"']/g, '');

  const results = [];
  const failedRecipients = [];
  for (const recipient of recipients) {
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((r) => setTimeout(r, 200 * attempt));
        }
        const nid = await caseComm.createNotification({
          tenantId,
          recipientUid: recipient.uid,
          type: caseComm.NOTIFICATION_TYPES.NEW_CLIENT_SOLICITATION,
          title: 'Nova solicitação recebida',
          message: `${tenantName} enviou uma nova análise.`,
          targetUrl: `/ops/caso/${caseId}`,
          caseId,
          candidateName,
          source: { kind: 'system', caseId, event: 'new_client_solicitation' },
        });
        results.push(nid);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`[notifications] attempt ${attempt}/3 failed for NEW_CLIENT_SOLICITATION recipient=${recipient.uid}:`, err.message);
      }
    }
    if (lastErr) {
      console.error('[notifications] exhausted retries for NEW_CLIENT_SOLICITATION recipient=', recipient.uid);
      failedRecipients.push(recipient.uid);
    }
  }
  console.log(`[notifications] createNewSolicitationNotifications case=${caseId}: ${results.length} sent, ${failedRecipients.length} failed, recipients=[${recipients.map(r => r.uid).join(', ')}]`);
  return results;
}

module.exports = {
  createMarkNotificationAsReadHandler,
  createMarkAllNotificationsAsReadHandler,
  createGetClientGeoIpHandler,
  createSendCaseMessageHandler,
  createMarkCaseCommunicationReadHandler,
  createCaseCompletedNotifications,
  createNewSolicitationNotifications,
  // helpers expostos para testes
  isPrivateOrLocalIp,
  normalizeIp,
  getRequestIp,
  sanitizeGeoText,
  lookupIpLocation,
};
