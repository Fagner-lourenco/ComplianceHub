/**
 * enrichmentWatchdog.js — Watchdog de provedores assíncronos travados.
 *
 * Problema que resolve: o Escavador2 roda via Cloud Tasks + callback. Quando o
 * worker morre sem chamar o callback (ex.: proxy BrightData recusando a rota com
 * HTTP 402/policy, ou o Cloud Tasks esgotando as tentativas), o caso fica em
 * escavador2EnrichmentStatus: 'RUNNING' para sempre. Como RUNNING nao e terminal,
 * canRunFinalClassification bloqueia a conclusao e o analista fica sem saida.
 *
 * A cada 15 minutos, casos presos em RUNNING ha mais de STUCK_AFTER_MINUTES sao
 * marcados como FAILED (estado terminal), liberando a conclusao com os demais
 * provedores. A auto-classificacao e redisparada para incorporar o desfecho.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { FieldValue } = require('firebase-admin/firestore');
const { asDate } = require('../helpers/normalize');
const { ACTOR_TYPE, SOURCE } = require('../audit/auditCatalog');
const { recordFailure: defaultRecordFailure } = require('../helpers/circuitBreaker');

/** Janela sem progresso a partir da qual consideramos o provedor travado. */
const STUCK_AFTER_MINUTES = 45;
const WATCHDOG_BATCH_LIMIT = 200;

/** Estados do caso em que ainda faz sentido destravar. */
const ACTIONABLE_CASE_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING_INFO'];

function parseWhen(caseData) {
    const raw = caseData.updatedAt || caseData.createdAt || null;
    if (!raw) return null;
    return asDate(raw);
}

/**
 * Lógica pura: seleciona casos com escavador2 preso em RUNNING alem da janela.
 */
function selectStuckEnrichmentCases(cases = [], { now = new Date(), stuckAfterMinutes = STUCK_AFTER_MINUTES } = {}) {
    return cases.filter((caseData) => {
        if (caseData.escavador2EnrichmentStatus !== 'RUNNING') return false;
        if (!ACTIONABLE_CASE_STATUSES.includes(caseData.status)) return false;
        const since = parseWhen(caseData);
        if (!since) return false;
        const elapsedMinutes = (now.getTime() - since.getTime()) / 60000;
        return elapsedMinutes >= stuckAfterMinutes;
    });
}

function buildStuckUpdatePayload(fieldValue, stuckMinutes) {
    return {
        escavador2EnrichmentStatus: 'FAILED',
        escavador2CallbackStatus: 'FAILED',
        escavador2Error: `Watchdog: consulta sem retorno ha ${Math.round(stuckMinutes)} min. Marcado como falho para liberar a conclusao do caso.`,
        escavador2EnrichedAt: fieldValue.serverTimestamp(),
        updatedAt: fieldValue.serverTimestamp(),
    };
}

/**
 * Varredura em si — separada do wrapper onSchedule para ser testavel
 * (mesmo padrao de runAutoExpireCorrections em correctionExpiry.js).
 */
async function runEnrichmentWatchdogSweep(deps, now = new Date()) {
    const {
        db,
        maybeRunAutoClassifyAndAi,
        writeAuditEvent,
        recordFailure = defaultRecordFailure,
        stuckAfterMinutes = STUCK_AFTER_MINUTES,
    } = deps;

    const snapshot = await db.collection('cases')
        .where('escavador2EnrichmentStatus', '==', 'RUNNING')
        .limit(WATCHDOG_BATCH_LIMIT)
        .get();

    if (snapshot.size === WATCHDOG_BATCH_LIMIT) {
        console.warn(`[enrichmentWatchdog] Lote cheio (${WATCHDOG_BATCH_LIMIT}); pode haver mais casos travados alem deste lote.`);
    }

    const cases = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
    const stuck = selectStuckEnrichmentCases(cases, { now, stuckAfterMinutes });

    if (stuck.length === 0) {
        console.log('[enrichmentWatchdog] Nenhum caso travado no escavador2.');
        return { swept: cases.length, stuck: 0 };
    }

    console.warn(`[enrichmentWatchdog] ${stuck.length} caso(s) travado(s) no escavador2 ha mais de ${stuckAfterMinutes} min.`);

    let closed = 0;
    for (const caseData of stuck) {
        const caseRef = db.collection('cases').doc(caseData.id);
        const since = parseWhen(caseData);
        const stuckMinutes = since ? (now.getTime() - since.getTime()) / 60000 : stuckAfterMinutes;
        try {
            await caseRef.update(buildStuckUpdatePayload(FieldValue, stuckMinutes));
            closed += 1;

            // Alimenta o circuit breaker: um timeout do watchdog e um desfecho
            // de falha do provedor tanto quanto um callback FAILED.
            if (recordFailure) {
                try {
                    await recordFailure('escavador2', `Watchdog encerrou consulta sem retorno apos ${Math.round(stuckMinutes)} min.`);
                } catch (circuitErr) {
                    console.warn(`[enrichmentWatchdog] Falha ao atualizar circuit breaker: ${circuitErr.message}`);
                }
            }

            try {
                await writeAuditEvent({
                    action: 'ENRICHMENT_WATCHDOG_TIMEOUT',
                    tenantId: caseData.tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM },
                    entity: { type: 'CASE', id: caseData.id, label: caseData.candidateName || caseData.id },
                    related: { caseId: caseData.id },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: { phase: 'escavador2', stuckMinutes: Math.round(stuckMinutes) },
                    templateVars: { candidateName: caseData.candidateName || caseData.id, phase: 'escavador2' },
                });
            } catch { /* auditoria nao pode travar o watchdog */ }

            await maybeRunAutoClassifyAndAi(caseRef, caseData.id, 'Escavador2 watchdog timeout');
        } catch (err) {
            console.error(`[enrichmentWatchdog] Falha ao destravar ${caseData.id}:`, err.message);
        }
    }

    return { swept: cases.length, stuck: stuck.length, closed };
}

function createEnrichmentWatchdogScheduler(deps) {
    return onSchedule(
        { schedule: 'every 15 minutes', region: 'southamerica-east1', timeoutSeconds: 300, memory: '256MiB' },
        async () => { await runEnrichmentWatchdogSweep(deps); },
    );
}

module.exports = {
    createEnrichmentWatchdogScheduler,
    runEnrichmentWatchdogSweep,
    selectStuckEnrichmentCases,
    buildStuckUpdatePayload,
    STUCK_AFTER_MINUTES,
};
