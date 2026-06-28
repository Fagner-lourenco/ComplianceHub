const { onRequest } = require('firebase-functions/v2/https');
const { normalizeEscavador2Response: defaultNormalizeEscavador2Response } = require('../normalizers/escavador2');
const { deduplicateEscavador2Findings: defaultDeduplicateEscavador2Findings } = require('../helpers/deduplicateEscavador2');

function escavador2RunDocId(caseId, enrichmentGeneration) {
    return encodeURIComponent(`${String(caseId || '').trim()}:${Number(enrichmentGeneration || 0)}`);
}

function taskDocId(taskId) {
    return encodeURIComponent(String(taskId || '').trim() || 'unknown-task');
}

function buildEscavador2CallbackUrl(env = process.env) {
    const value = String(env.ESCAVADOR2_CALLBACK_URL || '').trim();
    if (!value) {
        throw new Error('ESCAVADOR2_CALLBACK_URL nao configurado.');
    }
    return value;
}

function buildEscavador2CaseCallbackUrl({ baseUrl, caseId, enrichmentGeneration = 0 }) {
    if (!baseUrl) {
        throw new Error('ESCAVADOR2_CALLBACK_URL nao configurado.');
    }
    if (!caseId) {
        throw new Error('caseId obrigatorio para callback Escavador2.');
    }
    const url = new URL(baseUrl);
    url.searchParams.set('caseId', caseId);
    url.searchParams.set('generation', String(Number(enrichmentGeneration || 0)));
    return url.toString();
}

async function registerEscavador2Task({ db, FieldValue, taskId, caseId, enrichmentGeneration = 0, request = {} }) {
    if (!caseId) return;
    const payload = {
        taskId,
        caseId,
        enrichmentGeneration,
        status: 'QUEUED',
        request,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection('escavador2Tasks').doc(escavador2RunDocId(caseId, enrichmentGeneration)).set(payload, { merge: true });
    if (taskId) {
        await db.collection('escavador2Tasks').doc(taskDocId(taskId)).set({
            ...payload,
            aliasOf: escavador2RunDocId(caseId, enrichmentGeneration),
        }, { merge: true });
    }
}

function readInternalKey(req) {
    return req.headers?.['x-internal-api-key'] || req.headers?.['X-Internal-Api-Key'] || '';
}

function normalizeCallbackStatus(value) {
    const status = String(value || '').trim().toUpperCase();
    if (status === 'DONE' || status === 'PARTIAL' || status === 'FAILED') return status;
    return null;
}

function resolveCallbackIdentity(req, body = {}) {
    const query = req.query || {};
    const caseId = query.caseId || body.caseId || body.request?.caseId || null;
    const generationRaw = query.generation ?? body.generation ?? body.request?.generation ?? 0;
    const enrichmentGeneration = Number(generationRaw || 0);
    const taskId = body.task_id || body.taskId || body.request?.task_id || body.result?.consulta?.task_id || null;
    return { caseId, enrichmentGeneration, taskId };
}

async function markTask(taskRef, FieldValue, payload) {
    await taskRef.set({
        ...payload,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

async function handleEscavador2CallbackLogic({
    req,
    db,
    FieldValue,
    escavador2ApiKey,
    normalizeEscavador2Response = defaultNormalizeEscavador2Response,
    deduplicateEscavador2Findings = defaultDeduplicateEscavador2Findings,
    maybeRunAutoClassifyAndAi,
}) {
    if (req.method && req.method !== 'POST') {
        return { status: 405, body: { ok: false, error: 'method_not_allowed' } };
    }

    const expectedKey = escavador2ApiKey?.value ? escavador2ApiKey.value() : '';
    if (!expectedKey || readInternalKey(req) !== expectedKey) {
        return { status: 401, body: { ok: false, error: 'unauthorized' } };
    }

    const body = req.body || {};
    const status = normalizeCallbackStatus(body.status);
    const { caseId, enrichmentGeneration, taskId } = resolveCallbackIdentity(req, body);
    if (!caseId) {
        return { status: 400, body: { ok: false, error: 'missing_case_id' } };
    }
    if (!status) {
        return { status: 400, body: { ok: false, error: 'invalid_status' } };
    }

    const taskRef = db.collection('escavador2Tasks').doc(escavador2RunDocId(caseId, enrichmentGeneration));
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) {
        return { status: 200, body: { ok: true, ignored: true, reason: 'unknown_task' } };
    }

    const taskData = taskSnap.data() || {};
    if (['DONE', 'PARTIAL', 'FAILED', 'STALE'].includes(taskData.status) || taskData.processedAt) {
        return { status: 200, body: { ok: true, ignored: true, reason: 'already_processed' } };
    }

    const caseRef = db.collection('cases').doc(caseId);
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists) {
        await markTask(taskRef, FieldValue, { status: 'FAILED', failReason: 'case_not_found', processedAt: FieldValue.serverTimestamp() });
        return { status: 200, body: { ok: true, ignored: true, reason: 'case_not_found' } };
    }

    const caseData = caseSnap.data() || {};
    const currentGeneration = caseData.enrichmentGeneration || 0;
    const taskGeneration = taskData.enrichmentGeneration ?? enrichmentGeneration;
    if (taskGeneration !== currentGeneration) {
        await markTask(taskRef, FieldValue, {
            status: 'STALE',
            staleReason: `generation_mismatch:${taskGeneration}->${currentGeneration}`,
            staleAt: FieldValue.serverTimestamp(),
        });
        return { status: 200, body: { ok: true, ignored: true, reason: 'stale_generation' } };
    }

    if (status === 'FAILED') {
        const error = String(body.error || 'Falha final no Escavador2.').slice(0, 1000);
        await caseRef.update({
            escavador2EnrichmentStatus: 'FAILED',
            escavador2CallbackStatus: 'FAILED',
            escavador2Error: error,
            escavador2EnrichedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await markTask(taskRef, FieldValue, {
            status: 'FAILED',
            taskId: taskId || taskData.taskId || null,
            error,
            processedAt: FieldValue.serverTimestamp(),
        });
        if (maybeRunAutoClassifyAndAi && caseData.status !== 'DONE' && caseData.status !== 'CORRECTION_NEEDED') {
            await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador2 callback failed');
        }
        return { status: 200, body: { ok: true, caseId, status: 'FAILED' } };
    }

    const resultPayload = body.result || {};
    const normalized = normalizeEscavador2Response(resultPayload, { consultedAt: new Date().toISOString() });
    const deduped = deduplicateEscavador2Findings({ ...caseData, ...normalized }, { dateToleranceDays: caseData.escavador2DedupeDateToleranceDays || 90 });
    const finalStatus = status === 'PARTIAL' || normalized.escavador2ApiStatus === 'PARTIAL' ? 'PARTIAL' : 'DONE';

    await caseRef.update({
        ...normalized,
        ...deduped,
        escavador2EnrichmentStatus: finalStatus,
        escavador2CallbackStatus: finalStatus,
        escavador2Error: null,
        escavador2CostBRL: 0,
        escavador2EnrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    await markTask(taskRef, FieldValue, {
        status: finalStatus,
        taskId: taskId || taskData.taskId || null,
        processTotal: normalized.escavador2ProcessTotal || 0,
        processedAt: FieldValue.serverTimestamp(),
    });

    if (maybeRunAutoClassifyAndAi && caseData.status !== 'DONE' && caseData.status !== 'CORRECTION_NEEDED') {
        await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador2 callback completed');
    }

    return { status: 200, body: { ok: true, caseId, status: finalStatus } };
}

function createEscavador2CallbackHandler(deps) {
    const { escavador2ApiKey, openaiApiKey } = deps;
    return onRequest(
        { region: 'southamerica-east1', cors: false, secrets: [escavador2ApiKey, openaiApiKey] },
        async (req, res) => {
            const result = await handleEscavador2CallbackLogic({ req, ...deps });
            res.status(result.status).json(result.body);
        },
    );
}

module.exports = {
    escavador2RunDocId,
    taskDocId,
    buildEscavador2CallbackUrl,
    buildEscavador2CaseCallbackUrl,
    registerEscavador2Task,
    handleEscavador2CallbackLogic,
    createEscavador2CallbackHandler,
};
