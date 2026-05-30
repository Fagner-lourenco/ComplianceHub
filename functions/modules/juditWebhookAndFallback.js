/**
 * juditWebhookAndFallback.js — Módulo de webhook e fallback async Judit
 * Extraído do monolito index.js
 */

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');

/* =========================================================
   HELPERS PURAMENTE TESTÁVEIS
   ========================================================= */

function buildJuditCallbackUrl() {
    if (process.env.JUDIT_WEBHOOK_URL) return process.env.JUDIT_WEBHOOK_URL;
    return 'https://juditwebhook-dowqa75f4a-rj.a.run.app';
}

async function registerJuditWebhookRequest({ db, FieldValue, requestId, caseId, phaseType, payload = {} }) {
    if (!requestId || !caseId || !phaseType) return;

    let enrichmentGeneration = null;
    try {
        const caseDoc = await db.collection('cases').doc(caseId).get();
        if (caseDoc.exists) {
            enrichmentGeneration = caseDoc.data()?.enrichmentGeneration || 0;
        }
    } catch (err) {
        console.warn(`[registerJuditWebhookRequest]: could not read enrichmentGeneration for case ${caseId}:`, err.message);
    }

    await db.collection('juditWebhookRequests').doc(requestId).set({
        caseId,
        phaseType,
        enrichmentGeneration,
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/* =========================================================
   LÓGICA PURA: JUDIT WEBHOOK
   ========================================================= */

async function handleJuditWebhookLogic({
    req,
    db,
    FieldValue,
    juditApiKey,
    fetchResponses,
    normalizeJuditWarrants,
    normalizeJuditExecution,
    normalizeJuditLawsuits,
    loadJuditConfig,
    evaluateEscavadorNeed,
    maybeRunAutoClassifyAndAi,
}) {
    const payload = req.body;
    const requestId = payload?.reference_id || payload?.payload?.request_id;
    if (!requestId) {
        return { status: 400, body: { ok: false, error: 'Missing request_id' } };
    }

    const eventType = payload.event_type;
    const innerPayload = payload.payload || {};

    const isCompleted = innerPayload.response_type === 'application_info'
        && innerPayload.response_data?.code === 600;
    const isError = innerPayload.response_type === 'application_error';
    const isIncremental = !isCompleted && !isError;

    const mappingDoc = await db.collection('juditWebhookRequests').doc(requestId).get();
    if (!mappingDoc.exists) {
        console.log(`[Judit Webhook]: request_id ${requestId} not linked to any case. Ignoring.`);
        return { status: 200, body: { ok: true, ignored: true } };
    }

    const { caseId, phaseType, enrichmentGeneration: mappingGeneration } = mappingDoc.data();
    const caseRef = db.collection('cases').doc(caseId);
    const caseDoc = await caseRef.get();
    if (!caseDoc.exists) {
        console.log(`[Judit Webhook]: case ${caseId} not found. Cleaning up.`);
        await mappingDoc.ref.set({
            status: 'FAILED',
            processedBy: 'webhook',
            failReason: 'case_not_found',
            processedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { status: 200, body: { ok: true, ignored: true } };
    }

    const currentCaseData = caseDoc.data() || {};
    const currentGeneration = currentCaseData.enrichmentGeneration || 0;
    if (mappingGeneration != null && mappingGeneration !== currentGeneration) {
        console.log(`[Judit Webhook]: stale callback for case ${caseId} (mappingGen=${mappingGeneration}, currentGen=${currentGeneration}). Ignoring.`);
        await mappingDoc.ref.set({
            status: 'STALE',
            staleReason: `generation_mismatch:${mappingGeneration}->${currentGeneration}`,
            staleAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { status: 200, body: { ok: true, ignored: true, reason: 'stale_generation' } };
    }

    console.log(`[Judit Webhook]: event=${eventType || 'unknown'} type=${innerPayload.response_type || 'unknown'} for case=${caseId}, phase=${phaseType}, request=${requestId}`);

    if (isIncremental) {
        await mappingDoc.ref.set({
            lastIncrementalEventAt: FieldValue.serverTimestamp(),
            lastResponseType: innerPayload.response_type || null,
            lastResponseCode: innerPayload.response_data?.code ?? null,
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { status: 200, body: { ok: true, ignored: true, reason: 'incremental' } };
    }

    let lockResult;
    try {
        lockResult = await db.runTransaction(async (tx) => {
            const fresh = await tx.get(mappingDoc.ref);
            if (!fresh.exists) return { acquired: false, reason: 'mapping_missing' };
            const data = fresh.data() || {};
            if (['DONE', 'FAILED', 'STALE'].includes(data.status) || data.processedBy) {
                return { acquired: false, reason: 'already_terminal' };
            }
            tx.update(mappingDoc.ref, {
                status: isCompleted ? 'PROCESSING_COMPLETION' : 'PROCESSING_ERROR',
                processingStartedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            return { acquired: true, mapping: data };
        });
    } catch (lockErr) {
        console.warn(`[Judit Webhook]: lock contention for request ${requestId}: ${lockErr.message}`);
        lockResult = { acquired: false, reason: 'lock_error' };
    }

    if (!lockResult || !lockResult.acquired) {
        console.log(`[Judit Webhook]: request ${requestId} already terminal or locked (${lockResult?.reason || 'unknown'}). Skipping.`);
        return { status: 200, body: { ok: true, case_id: caseId, event: eventType, ignored: true, reason: lockResult?.reason || 'already_processed' } };
    }

    if (isCompleted) {
        try {
            const apiKey = juditApiKey.value();
            const items = await fetchResponses(requestId, apiKey);
            const freshCaseDoc = await caseRef.get();
            const freshCaseData = freshCaseDoc.data() || {};
            const cpf = (freshCaseData.cpf || '').replace(/\D/g, '');

            let normalized;
            if (phaseType === 'warrant') {
                normalized = normalizeJuditWarrants(items);
            } else if (phaseType === 'execution') {
                normalized = normalizeJuditExecution(items);
            } else {
                normalized = normalizeJuditLawsuits({ responseData: items, hasLawsuits: items.length > 0 }, cpf);
            }

            const { _source, ...fields } = normalized;
            const updateFields = {};
            for (const [key, value] of Object.entries(fields)) {
                if (value !== undefined && value !== null) {
                    updateFields[key] = value;
                }
            }

            const currentPendingPhases = Array.isArray(freshCaseData.juditPendingAsyncPhases)
                ? freshCaseData.juditPendingAsyncPhases
                : [];
            const remainingPendingPhases = currentPendingPhases.filter((phase) => phase !== phaseType);

            updateFields[`juditSources.${phaseType}`] = _source;
            updateFields[`juditRawPayloads.${phaseType}.responseCount`] = items.length;
            updateFields[`juditRawPayloads.${phaseType}.webhookCompletedAt`] = new Date().toISOString();
            updateFields.juditPendingAsyncPhases = remainingPendingPhases.length > 0
                ? remainingPendingPhases
                : FieldValue.delete();
            updateFields.juditPendingAsyncCount = remainingPendingPhases.length > 0
                ? remainingPendingPhases.length
                : FieldValue.delete();
            updateFields.updatedAt = FieldValue.serverTimestamp();

            if (remainingPendingPhases.length === 0) {
                const juditConfig = await loadJuditConfig(freshCaseData.tenantId);
                const mergedCaseData = { ...freshCaseData, ...fields, juditPendingAsyncPhases: [] };
                updateFields.juditNeedsEscavador = evaluateEscavadorNeed(mergedCaseData, juditConfig);
                updateFields.juditEnrichmentStatus = freshCaseData.juditError ? 'PARTIAL' : 'DONE';
                updateFields.juditEnrichedAt = FieldValue.serverTimestamp();
            }

            await caseRef.update(updateFields);

            await mappingDoc.ref.set({
                status: 'DONE',
                processedBy: 'webhook',
                processedAt: FieldValue.serverTimestamp(),
                responseCount: items.length,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });

            console.log(`[Judit Webhook]: case ${caseId} updated with ${items.length} ${phaseType} result(s).`);

            if (remainingPendingPhases.length === 0 && freshCaseData.status !== 'DONE' && freshCaseData.status !== 'CORRECTION_NEEDED') {
                try {
                    await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Judit webhook');
                } catch (classifyErr) {
                    console.error(`[Judit Webhook]: auto-classify error for case ${caseId}:`, classifyErr.message);
                }
            }

            return { status: 200, body: { ok: true, case_id: caseId, event: eventType } };
        } catch (err) {
            console.error(`[Judit Webhook]: error processing completed for case ${caseId}:`, err.message);
            return { status: 500, body: { ok: false, error: err.message } };
        }
    }

    if (isError) {
        try {
            const errorCode = innerPayload.response_data?.code;
            const errorMessage = innerPayload.response_data?.message || 'Unknown error';
            console.error(`[Judit Webhook]: application_error for case=${caseId}, phase=${phaseType}: code=${errorCode}, msg=${errorMessage}`);

            const freshCaseDoc = await caseRef.get();
            const freshCaseData = freshCaseDoc.data() || {};
            const currentPendingPhases = Array.isArray(freshCaseData.juditPendingAsyncPhases)
                ? freshCaseData.juditPendingAsyncPhases
                : [];
            const remainingPendingPhases = currentPendingPhases.filter((phase) => phase !== phaseType);

            const updateFields = {
                juditError: `${phaseType}: ${errorMessage} (code ${errorCode})`,
                juditPendingAsyncPhases: remainingPendingPhases.length > 0
                    ? remainingPendingPhases
                    : FieldValue.delete(),
                juditPendingAsyncCount: remainingPendingPhases.length > 0
                    ? remainingPendingPhases.length
                    : FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            if (remainingPendingPhases.length === 0) {
                updateFields.juditEnrichmentStatus = 'PARTIAL';
                updateFields.juditEnrichedAt = FieldValue.serverTimestamp();
            }

            await caseRef.update(updateFields);

            await mappingDoc.ref.set({
                status: 'FAILED',
                processedBy: 'webhook',
                processedAt: FieldValue.serverTimestamp(),
                failReason: `application_error:${errorCode}`,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });

            console.log(`[Judit Webhook]: case ${caseId} marked error for phase ${phaseType}.`);

            if (remainingPendingPhases.length === 0 && freshCaseData.status !== 'DONE' && freshCaseData.status !== 'CORRECTION_NEEDED') {
                try {
                    await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Judit webhook');
                } catch (classifyErr) {
                    console.error(`[Judit Webhook]: auto-classify error for case ${caseId}:`, classifyErr.message);
                }
            }

            return { status: 200, body: { ok: true, case_id: caseId, event: eventType } };
        } catch (err) {
            console.error(`[Judit Webhook]: error handling application_error for case ${caseId}:`, err.message);
            return { status: 500, body: { ok: false, error: err.message } };
        }
    }

    return { status: 200, body: { ok: true, case_id: caseId, ignored: true } };
}

/* =========================================================
   FACTORY: JUDIT WEBHOOK HANDLER
   ========================================================= */

function createJuditWebhookHandler(deps) {
    const { juditApiKey, openaiApiKey } = deps;
    return onRequest(
        { region: 'southamerica-east1', cors: false, secrets: [juditApiKey, openaiApiKey] },
        async (req, res) => {
            if (req.method !== 'POST') {
                res.status(405).send('Method Not Allowed');
                return;
            }

            const result = await handleJuditWebhookLogic({ req, ...deps });
            res.status(result.status);
            if (typeof result.body === 'string') {
                res.send(result.body);
            } else {
                res.json(result.body);
            }
        },
    );
}

/* =========================================================
   LÓGICA PURA: JUDIT ASYNC FALLBACK
   ========================================================= */

const JUDIT_WEBHOOK_STALE_MS = 10 * 60 * 1000; // 10 minutes

async function runJuditAsyncFallbackLogic({
    db,
    FieldValue,
    juditApiKey,
    fetchResponses,
    checkRequestStatus,
    normalizeJuditWarrants,
    normalizeJuditExecution,
    normalizeJuditLawsuits,
    loadJuditConfig,
    evaluateEscavadorNeed,
    maybeRunAutoClassifyAndAi,
}) {
    const staleBefore = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS);
    const snapshot = await db.collection('juditWebhookRequests')
        .where('createdAt', '<=', staleBefore)
        .limit(20)
        .get();

    if (snapshot.empty) {
        console.log('[Judit Fallback]: no stale webhook requests.');
        return { processed: 0 };
    }

    const apiKey = juditApiKey.value();
    if (!apiKey) {
        console.error('[Judit Fallback]: JUDIT_API_KEY not configured.');
        return { processed: 0, error: 'missing_api_key' };
    }

    console.log(`[Judit Fallback]: found ${snapshot.size} stale webhook request(s). Processing...`);

    const PHASE_PRIORITY = { warrant: 0, execution: 1, lawsuits: 2 };
    const sortedDocs = snapshot.docs.slice().sort((a, b) => {
        const pa = PHASE_PRIORITY[a.data().phaseType] ?? 99;
        const pb = PHASE_PRIORITY[b.data().phaseType] ?? 99;
        return pa - pb;
    });

    let processedCount = 0;

    for (const mappingDoc of sortedDocs) {
        const { caseId, phaseType, tenantId } = mappingDoc.data();
        const requestId = mappingDoc.id;

        const owner = `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        let lockResult = { acquired: false };
        try {
            lockResult = await db.runTransaction(async (tx) => {
                const freshMapping = await tx.get(mappingDoc.ref);
                if (!freshMapping.exists) return { acquired: false, reason: 'missing' };
                const data = freshMapping.data() || {};
                if (['DONE', 'FAILED', 'STALE'].includes(data.status)) {
                    return { acquired: false, reason: 'terminal' };
                }
                const claimExpiresAt = data.claimExpiresAt?.toDate?.() || null;
                if (claimExpiresAt && claimExpiresAt.getTime() > Date.now()) {
                    return { acquired: false, reason: 'claimed' };
                }
                tx.update(mappingDoc.ref, {
                    status: 'CHECKING',
                    claimedBy: owner,
                    claimExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                return { acquired: true, mapping: data };
            });
        } catch (lockErr) {
            console.warn(`[Judit Fallback]: lock contention for request ${requestId}: ${lockErr.message}`);
            continue;
        }

        if (!lockResult.acquired) {
            console.log(`[Judit Fallback]: request ${requestId} not acquired (${lockResult.reason}). Skipping.`);
            continue;
        }

        try {
            const caseRef = db.collection('cases').doc(caseId);
            const caseDoc = await caseRef.get();
            if (!caseDoc.exists) {
                console.log(`[Judit Fallback]: case ${caseId} not found. Cleaning mapping.`);
                await mappingDoc.ref.delete();
                continue;
            }

            const currentCaseData = caseDoc.data() || {};
            const currentGeneration = currentCaseData.enrichmentGeneration || 0;
            const mappingGeneration = lockResult.mapping?.enrichmentGeneration;
            if (mappingGeneration != null && mappingGeneration !== currentGeneration) {
                console.log(`[Judit Fallback]: stale mapping for case ${caseId} (mappingGen=${mappingGeneration}, currentGen=${currentGeneration}).`);
                await mappingDoc.ref.set({
                    status: 'STALE',
                    staleReason: `generation_mismatch:${mappingGeneration}->${currentGeneration}`,
                    staleAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
                continue;
            }

            const pendingPhases = Array.isArray(currentCaseData.juditPendingAsyncPhases)
                ? currentCaseData.juditPendingAsyncPhases
                : [];

            if (!pendingPhases.includes(phaseType)) {
                console.log(`[Judit Fallback]: phase ${phaseType} for case ${caseId} already resolved. Cleaning mapping.`);
                await mappingDoc.ref.delete();
                continue;
            }

            let requestStatus;
            try {
                requestStatus = await checkRequestStatus(requestId, apiKey);
            } catch (statusErr) {
                console.warn(`[Judit Fallback]: could not check request status for ${requestId}: ${statusErr.message}`);
                requestStatus = 'unknown';
            }

            const createdAt = mappingDoc.data().createdAt?.toDate?.() || new Date(0);
            const ageMs = Date.now() - createdAt.getTime();

            if (requestStatus === 'pending' || requestStatus === 'unknown') {
                if (ageMs > 30 * 60 * 1000) {
                    const failUpdate = {};
                    const remaining = pendingPhases.filter((p) => p !== phaseType);
                    failUpdate[`juditSources.${phaseType}.error`] = 'Timeout: request Judit ainda pendente apos 30min.';
                    failUpdate[`juditSources.${phaseType}.status`] = 'TIMEOUT';
                    failUpdate.juditPendingAsyncPhases = remaining.length > 0 ? remaining : FieldValue.delete();
                    failUpdate.juditPendingAsyncCount = remaining.length > 0 ? remaining.length : FieldValue.delete();
                    if (remaining.length === 0) {
                        failUpdate.juditEnrichmentStatus = 'PARTIAL';
                        failUpdate.juditError = `Timeout na fase ${phaseType}: request Judit nao completou.`;
                    }
                    failUpdate.updatedAt = FieldValue.serverTimestamp();
                    await caseRef.update(failUpdate);
                    await mappingDoc.ref.delete();
                    console.log(`[Judit Fallback]: marked phase ${phaseType} as TIMEOUT for case ${caseId} (request still ${requestStatus} after ${Math.round(ageMs / 60000)}min).`);

                    if (remaining.length === 0 && currentCaseData.status !== 'DONE' && currentCaseData.status !== 'CORRECTION_NEEDED') {
                        try {
                            await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Judit fallback timeout');
                        } catch (classifyErr) {
                            console.error(`[Judit Fallback]: auto-classify error for case ${caseId}:`, classifyErr.message);
                        }
                    }
                    processedCount++;
                    continue;
                }
                console.log(`[Judit Fallback]: request ${requestId} still ${requestStatus} for case ${caseId} phase ${phaseType} (${Math.round(ageMs / 60000)}min old). Will retry.`);
                continue;
            }

            if (requestStatus === 'cancelled') {
                const failUpdate = {};
                const remaining = pendingPhases.filter((p) => p !== phaseType);
                failUpdate[`juditSources.${phaseType}.error`] = 'Request Judit cancelado pelo provedor.';
                failUpdate[`juditSources.${phaseType}.status`] = 'CANCELLED';
                failUpdate.juditPendingAsyncPhases = remaining.length > 0 ? remaining : FieldValue.delete();
                failUpdate.juditPendingAsyncCount = remaining.length > 0 ? remaining.length : FieldValue.delete();
                if (remaining.length === 0) {
                    failUpdate.juditEnrichmentStatus = 'PARTIAL';
                    failUpdate.juditError = `Fase ${phaseType} cancelada pelo provedor Judit.`;
                }
                failUpdate.updatedAt = FieldValue.serverTimestamp();
                await caseRef.update(failUpdate);
                await mappingDoc.ref.set({
                    status: 'FAILED',
                    processedBy: 'fallback',
                    processedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
                console.log(`[Judit Fallback]: marked phase ${phaseType} as CANCELLED for case ${caseId} (request status: ${requestStatus}).`);

                if (remaining.length === 0 && currentCaseData.status !== 'DONE' && currentCaseData.status !== 'CORRECTION_NEEDED') {
                    try {
                        await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Judit fallback cancelled');
                    } catch (classifyErr) {
                        console.error(`[Judit Fallback]: auto-classify error for case ${caseId}:`, classifyErr.message);
                    }
                }
                processedCount++;
                continue;
            }

            if (requestStatus === 'failed' || requestStatus === 'error') {
                const failUpdate = {};
                const remaining = pendingPhases.filter((p) => p !== phaseType);
                failUpdate[`juditSources.${phaseType}.error`] = `Request Judit falhou com status: ${requestStatus}.`;
                failUpdate[`juditSources.${phaseType}.status`] = 'FAILED';
                failUpdate.juditPendingAsyncPhases = remaining.length > 0 ? remaining : FieldValue.delete();
                failUpdate.juditPendingAsyncCount = remaining.length > 0 ? remaining.length : FieldValue.delete();
                if (remaining.length === 0) {
                    failUpdate.juditEnrichmentStatus = 'PARTIAL';
                    failUpdate.juditError = `Falha na fase ${phaseType}: request Judit retornou ${requestStatus}.`;
                }
                failUpdate.updatedAt = FieldValue.serverTimestamp();
                await caseRef.update(failUpdate);
                await mappingDoc.ref.set({
                    status: 'FAILED',
                    processedBy: 'fallback',
                    processedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
                console.log(`[Judit Fallback]: marked phase ${phaseType} as FAILED for case ${caseId} (request status: ${requestStatus}).`);

                if (remaining.length === 0 && currentCaseData.status !== 'DONE' && currentCaseData.status !== 'CORRECTION_NEEDED') {
                    try {
                        await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Judit fallback failed');
                    } catch (classifyErr) {
                        console.error(`[Judit Fallback]: auto-classify error for case ${caseId}:`, classifyErr.message);
                    }
                }
                processedCount++;
                continue;
            }

            let items;
            try {
                items = await fetchResponses(requestId, apiKey);
            } catch (fetchErr) {
                console.warn(`[Judit Fallback]: fetchResponses failed for ${requestId} (case ${caseId}, phase ${phaseType}): ${fetchErr.message}`);
                const failUpdate = {};
                const remaining = pendingPhases.filter((p) => p !== phaseType);
                failUpdate[`juditSources.${phaseType}.error`] = `Erro ao buscar respostas: ${fetchErr.message}`;
                failUpdate[`juditSources.${phaseType}.status`] = 'ERROR';
                failUpdate.juditPendingAsyncPhases = remaining.length > 0 ? remaining : FieldValue.delete();
                failUpdate.juditPendingAsyncCount = remaining.length > 0 ? remaining.length : FieldValue.delete();
                if (remaining.length === 0) {
                    failUpdate.juditEnrichmentStatus = 'PARTIAL';
                    failUpdate.juditError = `Erro ao recuperar respostas da fase ${phaseType}.`;
                }
                failUpdate.updatedAt = FieldValue.serverTimestamp();
                await caseRef.update(failUpdate);
                await mappingDoc.ref.set({
                    status: 'FAILED',
                    processedBy: 'fallback',
                    processedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
                console.log(`[Judit Fallback]: marked phase ${phaseType} as ERROR for case ${caseId}.`);
                processedCount++;
                continue;
            }

            const bdcActiveWarrants = Array.isArray(currentCaseData.bigdatacorpActiveWarrants)
                ? currentCaseData.bigdatacorpActiveWarrants.filter((w) => w?.isActive !== false).length
                : 0;
            if (phaseType === 'warrant' && bdcActiveWarrants > 0) {
                console.log(`[Judit Fallback]: case ${caseId} has ${bdcActiveWarrants} active warrant(s) from BigDataCorp. Warrant fallback will supplement, not override.`);
            }

            const cpf = (currentCaseData.cpf || '').replace(/\D/g, '');
            let normalized;
            if (phaseType === 'warrant') {
                normalized = normalizeJuditWarrants(items);
            } else if (phaseType === 'execution') {
                normalized = normalizeJuditExecution(items);
            } else {
                normalized = normalizeJuditLawsuits({ responseData: items, hasLawsuits: items.length > 0 }, cpf);
            }

            const { _source, ...fields } = normalized;
            const updateFields = {};
            for (const [key, value] of Object.entries(fields)) {
                if (value !== undefined && value !== null) {
                    updateFields[key] = value;
                }
            }

            const remainingPendingPhases = pendingPhases.filter((phase) => phase !== phaseType);
            updateFields[`juditSources.${phaseType}`] = _source;
            updateFields[`juditRawPayloads.${phaseType}.responseCount`] = items.length;
            updateFields[`juditRawPayloads.${phaseType}.fallbackCompletedAt`] = new Date().toISOString();
            updateFields.juditPendingAsyncPhases = remainingPendingPhases.length > 0
                ? remainingPendingPhases
                : FieldValue.delete();
            updateFields.juditPendingAsyncCount = remainingPendingPhases.length > 0
                ? remainingPendingPhases.length
                : FieldValue.delete();
            updateFields.updatedAt = FieldValue.serverTimestamp();

            if (remainingPendingPhases.length === 0) {
                const juditConfig = await loadJuditConfig(tenantId || currentCaseData.tenantId);
                const mergedCaseData = { ...currentCaseData, ...fields, juditPendingAsyncPhases: [] };
                updateFields.juditNeedsEscavador = evaluateEscavadorNeed(mergedCaseData, juditConfig);
                updateFields.juditEnrichmentStatus = currentCaseData.juditError ? 'PARTIAL' : 'DONE';
                updateFields.juditEnrichedAt = FieldValue.serverTimestamp();
            }

            await caseRef.update(updateFields);
            await mappingDoc.ref.set({
                status: 'DONE',
                processedBy: 'fallback',
                processedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            console.log(`[Judit Fallback]: case ${caseId} updated with ${items.length} ${phaseType} result(s) via fallback.`);

            if (remainingPendingPhases.length === 0 && currentCaseData.status !== 'DONE' && currentCaseData.status !== 'CORRECTION_NEEDED') {
                try {
                    await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Judit fallback completed');
                } catch (classifyErr) {
                    console.error(`[Judit Fallback]: auto-classify error for case ${caseId}:`, classifyErr.message);
                }
            }
            processedCount++;
        } catch (err) {
            console.error(`[Judit Fallback]: error processing request ${requestId} for case ${caseId}:`, err.message);
        }
    }

    return { processed: processedCount };
}

/* =========================================================
   FACTORY: JUDIT ASYNC FALLBACK HANDLER
   ========================================================= */

function createJuditAsyncFallbackHandler(deps) {
    const { juditApiKey, openaiApiKey } = deps;
    return onSchedule(
        { schedule: 'every 10 minutes', region: 'southamerica-east1', timeoutSeconds: 300, secrets: [juditApiKey, openaiApiKey] },
        async () => {
            await runJuditAsyncFallbackLogic(deps);
        },
    );
}

async function markPendingJuditRequestsStale(db, caseId, reason) {
    const snapshot = await db.collection('juditWebhookRequests')
        .where('caseId', '==', caseId)
        .where('status', 'in', ['PENDING', 'CHECKING', 'PROCESSING_COMPLETION', 'PROCESSING_ERROR'])
        .get();

    let count = 0;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
            status: 'STALE',
            staleReason: reason || 'manual_rerun',
            staleAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        count += 1;
    });

    if (count > 0) {
        await batch.commit();
    }

    return count;
}

module.exports = {
    buildJuditCallbackUrl,
    registerJuditWebhookRequest,
    handleJuditWebhookLogic,
    createJuditWebhookHandler,
    runJuditAsyncFallbackLogic,
    createJuditAsyncFallbackHandler,
    markPendingJuditRequestsStale,
    JUDIT_WEBHOOK_STALE_MS,
};
