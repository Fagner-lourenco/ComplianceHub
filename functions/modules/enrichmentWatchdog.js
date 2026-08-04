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
const { escavador2RunDocId } = require('./escavador2AsyncCallback');

/** Janela sem progresso a partir da qual consideramos o provedor travado. */
const STUCK_AFTER_MINUTES = 45;
/**
 * Janela do fallback para documentos legados (sem escavador2StartedAt), medida a
 * partir de createdAt. Bem mais folgada porque createdAt e o inicio do caso, nao
 * o inicio da fase — 6h nao mata pipeline legitimo (escavador2 e a ultima fase)
 * e ainda destrava no mesmo dia.
 */
const LEGACY_STUCK_AFTER_MINUTES = 6 * 60;
const WATCHDOG_BATCH_LIMIT = 200;

/** Estados do caso em que ainda faz sentido destravar. */
const ACTIONABLE_CASE_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING_INFO'];

/**
 * Relogio do watchdog: mede a duracao DA FASE, nao a ociosidade do documento.
 *
 * `updatedAt` seria errado — ele e bumpado por qualquer write no caso (outras
 * fases de enriquecimento, IA, edicao do analista), entao num caso movimentado a
 * janela nunca fecharia e o caso ficaria travado para sempre.
 *
 * Duas faixas: `escavador2StartedAt` (gravado ao entrar em RUNNING) com a janela
 * normal; ausente (docs anteriores a esta versao) cai para `createdAt`, que e
 * imutavel — logo imune ao churn que causava o bug —, com janela folgada.
 */
function resolveStuckClock(caseData) {
    const started = caseData.escavador2StartedAt ? asDate(caseData.escavador2StartedAt) : null;
    if (started) return { since: started, windowMinutes: null };

    const created = caseData.createdAt ? asDate(caseData.createdAt) : null;
    if (created) return { since: created, windowMinutes: LEGACY_STUCK_AFTER_MINUTES };

    return { since: null, windowMinutes: null };
}

function parseWhen(caseData) {
    return resolveStuckClock(caseData).since;
}

/**
 * Lógica pura: seleciona casos com escavador2 preso em RUNNING alem da janela.
 */
function selectStuckEnrichmentCases(cases = [], { now = new Date(), stuckAfterMinutes = STUCK_AFTER_MINUTES } = {}) {
    return cases.filter((caseData) => {
        if (caseData.escavador2EnrichmentStatus !== 'RUNNING') return false;
        if (!ACTIONABLE_CASE_STATUSES.includes(caseData.status)) return false;
        const { since, windowMinutes } = resolveStuckClock(caseData);
        if (!since) return false;
        const elapsedMinutes = (now.getTime() - since.getTime()) / 60000;
        return elapsedMinutes >= (windowMinutes ?? stuckAfterMinutes);
    });
}

/** Status da task que indicam desfecho ja registrado. */
const TASK_TERMINAL_STATUSES = ['DONE', 'PARTIAL', 'FAILED', 'STALE', 'SKIPPED'];

/**
 * Decisao pura do watchdog, avaliada DENTRO da transacao com os dados frescos.
 * Fecha a corrida com o callback: entre a query e a escrita, um callback legitimo
 * pode ter concluido o caso — sobrescrever isso destruiria dado bom.
 */
function decideWatchdogAction({ caseData, taskData }) {
    if (!caseData) return { act: false, reason: 'case_not_found' };
    if (caseData.escavador2EnrichmentStatus !== 'RUNNING') return { act: false, reason: 'not_running' };
    if (taskData) {
        if (taskData.processedAt) return { act: false, reason: 'already_processed' };
        if (TASK_TERMINAL_STATUSES.includes(taskData.status)) return { act: false, reason: 'already_processed' };
    }
    // Task inexistente: a falha pode ter acontecido antes do registerEscavador2Task
    // (entre marcar RUNNING e enfileirar). Agir mesmo assim.
    return { act: true, reason: 'stuck' };
}

/**
 * Marca a task como STALE — nao FAILED: significa "desistimos desta execucao",
 * nao "o provedor falhou". Como STALE esta na lista de ja-processados do callback,
 * um retorno atrasado passa a ser ignorado em vez de reescrever o caso.
 */
function buildStuckTaskPayload(fieldValue) {
    return {
        status: 'STALE',
        staleReason: 'watchdog_timeout',
        staleAt: fieldValue.serverTimestamp(),
        processedAt: fieldValue.serverTimestamp(),
    };
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
    let skipped = 0;
    for (const caseData of stuck) {
        const caseRef = db.collection('cases').doc(caseData.id);
        const taskRef = db.collection('escavador2Tasks')
            .doc(escavador2RunDocId(caseData.id, caseData.enrichmentGeneration || 0));
        const since = parseWhen(caseData);
        const stuckMinutes = since ? (now.getTime() - since.getTime()) / 60000 : stuckAfterMinutes;
        try {
            // Transacional: reavalia com dados frescos e reconcilia a task, para
            // nao sobrescrever um callback que concluiu o caso nesse meio-tempo.
            const decision = await db.runTransaction(async (transaction) => {
                const caseSnap = await transaction.get(caseRef);
                const taskSnap = await transaction.get(taskRef);
                const fresh = caseSnap.exists ? caseSnap.data() : null;
                const taskData = taskSnap.exists ? taskSnap.data() : null;

                const verdict = decideWatchdogAction({ caseData: fresh, taskData });
                if (!verdict.act) return verdict;

                transaction.update(caseRef, buildStuckUpdatePayload(FieldValue, stuckMinutes));
                if (taskData) transaction.update(taskRef, buildStuckTaskPayload(FieldValue));
                return verdict;
            });

            if (!decision.act) {
                skipped += 1;
                console.log(`[enrichmentWatchdog] ${caseData.id} ignorado: ${decision.reason}.`);
                continue;
            }
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

    return { swept: cases.length, stuck: stuck.length, closed, skipped };
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
    buildStuckTaskPayload,
    decideWatchdogAction,
    resolveStuckClock,
    STUCK_AFTER_MINUTES,
    LEGACY_STUCK_AFTER_MINUTES,
};
