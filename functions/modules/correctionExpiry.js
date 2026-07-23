/**
 * correctionExpiry.js — Auto-expiracao de casos presos em CORRECTION_NEEDED (Task 4)
 *
 * Escopo reduzido (decisao do controlador, 2026-07-23):
 * - Sem lembrete na metade da janela (selectCorrectionReminderCases nao implementado).
 * - Sem override por tenant (correctionAutoExpireHours). Janela fixa: DEFAULT_AUTO_EXPIRE_HOURS.
 *
 * A cada 60 minutos, casos que ficaram em CORRECTION_NEEDED por mais de
 * DEFAULT_AUTO_EXPIRE_HOURS sao encerrados automaticamente como DONE /
 * AUTO_EXPIRED_CORRECTION. Nao escreve finalVerdict nem publica relatorio —
 * o gate de conteudo minimo (hasPublicReportMinimumContent) garante que o
 * trigger publishResultOnCaseDone ignore esses casos.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { FieldValue } = require('firebase-admin/firestore');
const { asDate } = require('../helpers/normalize');
const { ACTOR_TYPE, SOURCE } = require('../audit/auditCatalog');

const DEFAULT_AUTO_EXPIRE_HOURS = 48;
const AUTO_EXPIRE_BATCH_LIMIT = 500;

/**
 * Resolve a data de referencia para contagem da janela de correcao:
 * correctionRequestedAt > updatedAt > createdAt (fallback para casos legados
 * que entraram em CORRECTION_NEEDED antes da Task 3 gravar correctionRequestedAt).
 * Firestore-Timestamp-safe via asDate (.toDate()).
 */
function parseWhen(caseData) {
    const raw = caseData.correctionRequestedAt || caseData.updatedAt || caseData.createdAt || null;
    if (!raw) return null;
    return asDate(raw);
}

/**
 * Lógica pura: seleciona casos CORRECTION_NEEDED cuja janela de
 * DEFAULT_AUTO_EXPIRE_HOURS já expirou.
 */
function selectExpiredCorrectionCases(cases = [], { now = new Date(), defaultHours = DEFAULT_AUTO_EXPIRE_HOURS } = {}) {
    return cases
        .filter((caseData) => {
            if (caseData.status !== 'CORRECTION_NEEDED') return false;
            const since = parseWhen(caseData);
            if (!since) return false;
            const elapsedMs = now.getTime() - since.getTime();
            return elapsedMs >= defaultHours * 3600000;
        })
        .map((caseData) => ({
            ...caseData,
            expiredSinceMs: now.getTime() - parseWhen(caseData).getTime(),
        }));
}

function buildExpiredUpdatePayload(caseData, now) {
    const concludedAt = now.toISOString();
    const createdAt = asDate(caseData.createdAt);
    const turnaroundHours = createdAt
        ? Math.round(((now.getTime() - createdAt.getTime()) / 3600000) * 10) / 10
        : null;

    return {
        status: 'DONE',
        conclusionType: 'AUTO_EXPIRED_CORRECTION',
        concludedAt,
        autoExpiredAt: concludedAt,
        turnaroundHours,
        updatedAt: FieldValue.serverTimestamp(),
    };
}

function buildExpiredSystemMessageBody(caseData) {
    const reason = caseData.correctionReason || 'não informado';
    return `A solicitação foi encerrada automaticamente após ${DEFAULT_AUTO_EXPIRE_HOURS} horas sem a correção solicitada. Motivo original: ${reason}.`;
}

/**
 * Expira um unico caso dentro de uma transaction, re-checando o status no
 * snapshot da transaction para nao competir com uma correcao do cliente que
 * chegue entre a query inicial e a execucao da transaction.
 * Retorna os dados pos-update do caso, ou null se nada foi alterado.
 */
async function expireCaseInTransaction({ db, caseId, now }) {
    const caseRef = db.collection('cases').doc(caseId);
    let expiredData = null;

    await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(caseRef);
        if (!snap.exists) return;
        const freshData = snap.data() || {};
        if (freshData.status !== 'CORRECTION_NEEDED') return;

        const payload = buildExpiredUpdatePayload(freshData, now);
        transaction.update(caseRef, payload);
        expiredData = { ...freshData, ...payload };
    });

    return expiredData;
}

/**
 * Handler principal: busca casos CORRECTION_NEEDED, filtra os expirados
 * (cap de AUTO_EXPIRE_BATCH_LIMIT por execucao) e encerra cada um.
 * Depois de cada expiracao bem-sucedida: mensagem de sistema no caso
 * (systemType CORRECTION_EXPIRED) + evento de auditoria. Falhas nessas
 * etapas pos-transaction sao logadas e nao interrompem o loop.
 */
async function runAutoExpireCorrections({ db, createSystemCaseMessage, writeAuditEvent }, now = new Date()) {
    const snapshot = await db.collection('cases').where('status', '==', 'CORRECTION_NEEDED').get();
    const cases = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const expiredCandidates = selectExpiredCorrectionCases(cases, { now }).slice(0, AUTO_EXPIRE_BATCH_LIMIT);

    let expiredCount = 0;

    for (const candidate of expiredCandidates) {
        const expiredData = await expireCaseInTransaction({ db, caseId: candidate.id, now });
        if (!expiredData) continue;
        expiredCount += 1;

        try {
            await createSystemCaseMessage({
                caseId: candidate.id,
                tenantId: expiredData.tenantId || null,
                systemType: 'CORRECTION_EXPIRED',
                body: buildExpiredSystemMessageBody(expiredData),
                db,
            });
        } catch (err) {
            console.warn(`[correctionExpiry] falha ao criar mensagem de sistema para ${candidate.id}:`, err.message);
        }

        try {
            await writeAuditEvent({
                action: 'CASE_AUTO_EXPIRED_CORRECTION',
                tenantId: expiredData.tenantId || null,
                actor: { type: ACTOR_TYPE.SYSTEM, id: 'system', email: 'cloud-function' },
                entity: { type: 'CASE', id: candidate.id, label: expiredData.candidateName || candidate.id },
                related: { caseId: candidate.id },
                source: SOURCE.CLOUD_FUNCTION,
                detail: `Caso encerrado automaticamente apos ${DEFAULT_AUTO_EXPIRE_HOURS}h sem correcao (motivo original: ${expiredData.correctionReason || 'nao informado'}).`,
                templateVars: { hours: DEFAULT_AUTO_EXPIRE_HOURS },
            });
        } catch (err) {
            console.warn(`[correctionExpiry] falha ao gravar evento de auditoria para ${candidate.id}:`, err.message);
        }
    }

    console.log(`[correctionExpiry] execucao concluida: ${expiredCount}/${expiredCandidates.length} caso(s) expirado(s).`);

    return { expiredCount, candidateCount: expiredCandidates.length };
}

function createAutoExpireCorrectionsScheduler(deps) {
    return onSchedule(
        {
            schedule: 'every 60 minutes',
            region: 'southamerica-east1',
            timeZone: 'America/Sao_Paulo',
        },
        () => runAutoExpireCorrections(deps, new Date()),
    );
}

module.exports = {
    DEFAULT_AUTO_EXPIRE_HOURS,
    AUTO_EXPIRE_BATCH_LIMIT,
    parseWhen,
    selectExpiredCorrectionCases,
    runAutoExpireCorrections,
    createAutoExpireCorrectionsScheduler,
};
