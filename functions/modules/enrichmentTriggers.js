/**
 * enrichmentTriggers.js — Factories para triggers de enriquecimento
 * Extraídos do monolito index.js
 */



function createEnrichJuditOnCaseHandler(deps) {
    const {
        db,
        FieldValue,
        acquirePhaseRun,
        loadJuditConfig,
        runJuditEnrichmentPhase,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
    } = deps;

    return async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        // Guard: bigdatacorpEnrichmentStatus must have CHANGED to a terminal state
        const bdcBefore = before.bigdatacorpEnrichmentStatus;
        const bdcAfter = after.bigdatacorpEnrichmentStatus;
        if (bdcBefore === bdcAfter) return;
        const bdcTerminal = ['DONE', 'BLOCKED', 'FAILED', 'SKIPPED'];
        if (!bdcTerminal.includes(bdcAfter)) return;

        // Guard: Judit must not have already started
        const juditStatus = after.juditEnrichmentStatus;
        if (juditStatus && juditStatus !== 'PENDING') return;

        // Guard: case must still be actionable
        if (after.status === 'DONE' || after.status === 'CORRECTION_NEEDED') return;

        const caseData = after;
        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);

        const tenantId = caseData.tenantId;
        if (!tenantId) {
            console.log(`Case ${caseId}: no tenantId, skipping enrichment.`);
            return;
        }

        try {
            const runLock = await acquirePhaseRun(caseRef, 'juditEnrichmentStatus');
            if (!runLock.acquired) {
                console.log(`Case ${caseId} [Judit]: skipped because status is already ${runLock.caseData?.juditEnrichmentStatus || 'set'}.`);
                return;
            }
            const runCaseData = runLock.caseData || caseData;
            const juditConfig = await loadJuditConfig(tenantId);
            if (!juditConfig.enabled) {
                console.log(`Case ${caseId} [Judit]: disabled for tenant ${tenantId}. Skipping.`);
                await caseRef.update({
                    juditEnrichmentStatus: 'SKIPPED',
                    juditError: null,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                return;
            }

            await runJuditEnrichmentPhase(caseRef, caseId, runCaseData, juditConfig);

            // Audit: log automatic enrichment trigger
            try {
                const refreshed = (await caseRef.get()).data() || {};
                await writeAuditEvent({
                    action: 'ENRICHMENT_AUTO_TRIGGERED',
                    tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM },
                    entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                    related: { caseId },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: { phase: 'judit', status: refreshed.juditEnrichmentStatus, trigger: 'bigdatacorp_settled' },
                    templateVars: { candidateName: caseData.candidateName || caseId, phase: 'judit', status: refreshed.juditEnrichmentStatus || 'UNKNOWN' },
                });
            } catch { /* audit failure must not block pipeline */ }
        } catch (err) {
            console.error(`Case ${caseId} [Judit]: error:`, err.message);
            await caseRef.update({
                juditEnrichmentStatus: 'FAILED',
                juditError: err.message,
                juditPendingAsyncPhases: FieldValue.delete(),
                juditPendingAsyncCount: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
    };
}

function createEnrichBigDataCorpOnCaseHandler(deps) {
    const {
        db,
        FieldValue,
        acquirePhaseRun,
        loadBigDataCorpConfig,
        runBigDataCorpEnrichmentPhase,
        maybeRunAutoClassifyAndAi,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
    } = deps;

    return async (event) => {
        const snap = event.data;
        if (!snap) return;

        const caseData = snap.data();
        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);

        const tenantId = caseData.tenantId;
        if (!tenantId) {
            console.log(`Case ${caseId} [BigDataCorp]: no tenantId, skipping.`);
            return;
        }

        try {
            const runLock = await acquirePhaseRun(caseRef, 'bigdatacorpEnrichmentStatus');
            if (!runLock.acquired) {
                console.log(`Case ${caseId} [BigDataCorp]: skipped because status is already ${runLock.caseData?.bigdatacorpEnrichmentStatus || 'set'}.`);
                return;
            }
            const runCaseData = runLock.caseData || caseData;

            const bdcConfig = await loadBigDataCorpConfig(tenantId);
            if (!bdcConfig.enabled) {
                console.log(`Case ${caseId} [BigDataCorp]: disabled for tenant ${tenantId}, writing SKIPPED.`);
                await caseRef.update({
                    bigdatacorpEnrichmentStatus: 'SKIPPED',
                    bigdatacorpError: 'Provider desabilitado para este tenant.',
                    updatedAt: FieldValue.serverTimestamp(),
                });
                await maybeRunAutoClassifyAndAi(caseRef, caseId, 'BigDataCorp disabled');
                return;
            }

            await runBigDataCorpEnrichmentPhase(caseRef, caseId, runCaseData, bdcConfig);

            // Audit: log automatic enrichment trigger
            try {
                const refreshed = (await caseRef.get()).data() || {};
                await writeAuditEvent({
                    action: 'ENRICHMENT_AUTO_TRIGGERED',
                    tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM },
                    entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                    related: { caseId },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: { phase: 'bigdatacorp', status: refreshed.bigdatacorpEnrichmentStatus, trigger: 'case_created' },
                    templateVars: { candidateName: caseData.candidateName || caseId, phase: 'bigdatacorp', status: refreshed.bigdatacorpEnrichmentStatus || 'UNKNOWN' },
                });
            } catch { /* audit failure must not block pipeline */ }
        } catch (err) {
            console.error(`Case ${caseId} [BigDataCorp]: error:`, err.message);
            // Do NOT rethrow — BigDataCorp failure should not block the pipeline
        }
    };
}

function createEnrichBigDataCorpOnCorrectionHandler(deps) {
    const {
        db,
        FieldValue,
        acquirePhaseRun,
        loadBigDataCorpConfig,
        runBigDataCorpEnrichmentPhase,
    } = deps;

    return async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        if (before.status !== 'CORRECTION_NEEDED' || after.status !== 'PENDING') return;
        if (after.bigdatacorpEnrichmentStatus !== 'PENDING') return;

        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);
        const tenantId = after.tenantId;
        if (!tenantId) return;

        try {
            const runLock = await acquirePhaseRun(caseRef, 'bigdatacorpEnrichmentStatus');
            if (!runLock.acquired) {
                console.log(`Case ${caseId} [BigDataCorp correction]: skipped because status is already ${runLock.caseData?.bigdatacorpEnrichmentStatus || 'set'}.`);
                return;
            }
            const runCaseData = runLock.caseData || after;
            const bdcConfig = await loadBigDataCorpConfig(tenantId);
            if (!bdcConfig.enabled) {
                console.log(`Case ${caseId} [BigDataCorp correction]: disabled for tenant ${tenantId}, writing SKIPPED.`);
                await caseRef.update({
                    bigdatacorpEnrichmentStatus: 'SKIPPED',
                    bigdatacorpError: 'Provider desabilitado para este tenant.',
                    updatedAt: FieldValue.serverTimestamp(),
                });
                return;
            }

            await runBigDataCorpEnrichmentPhase(caseRef, caseId, runCaseData, bdcConfig);
        } catch (err) {
            console.error(`Case ${caseId} [BigDataCorp correction]: error:`, err.message);
        }
    };
}

function createEnrichJuditOnCorrectionHandler(deps) {
    const {
        db,
        FieldValue,
        acquirePhaseRun,
        loadJuditConfig,
        runJuditEnrichmentPhase,
        isSettledProviderStatus,
        ACTOR_TYPE,
        SOURCE,
    } = deps;

    return async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        // Guard: only trigger on CORRECTION_NEEDED → PENDING transition
        if (before.status !== 'CORRECTION_NEEDED' || after.status !== 'PENDING') return;

        // Guard: must have juditEnrichmentStatus reset to PENDING
        if (after.juditEnrichmentStatus !== 'PENDING') return;
        if (!isSettledProviderStatus(after.bigdatacorpEnrichmentStatus)) {
            console.log(`Case ${event.params.caseId} [Judit correction]: waiting for BigDataCorp correction gate (${after.bigdatacorpEnrichmentStatus || 'PENDING'}).`);
            return;
        }

        const caseData = after;
        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);

        const tenantId = caseData.tenantId;
        if (!tenantId) return;

        try {
            const runLock = await acquirePhaseRun(caseRef, 'juditEnrichmentStatus');
            if (!runLock.acquired) {
                console.log(`Case ${caseId} [Judit correction]: skipped because status is already ${runLock.caseData?.juditEnrichmentStatus || 'set'}.`);
                return;
            }
            const runCaseData = runLock.caseData || caseData;
            const juditConfig = await loadJuditConfig(tenantId);
            if (!juditConfig.enabled) {
                console.log(`Case ${caseId} [Judit correction]: disabled for tenant ${tenantId}. Skipping.`);
                await caseRef.update({
                    juditEnrichmentStatus: 'SKIPPED',
                    juditError: null,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                return;
            }

            console.log(`Case ${caseId} [Judit correction]: re-running enrichment after client correction.`);
            await runJuditEnrichmentPhase(caseRef, caseId, runCaseData, juditConfig);
        } catch (err) {
            console.error(`Case ${caseId} [Judit correction]: error:`, err.message);
            await caseRef.update({
                juditEnrichmentStatus: 'FAILED',
                juditError: err.message,
                juditPendingAsyncPhases: FieldValue.delete(),
                juditPendingAsyncCount: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
    };
}

function createEnrichEscavadorOnCaseHandler(deps) {
    const {
        db,
        FieldValue,
        acquirePhaseRun,
        loadEscavadorConfig,
        runEscavadorEnrichmentPhase,
        isJuditSettled,
        maybeRunAutoClassifyAndAi,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
    } = deps;

    return async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        // Guard: only trigger when Judit enrichment completes and is truly settled
        const statusBefore = before.juditEnrichmentStatus;
        const statusAfter = after.juditEnrichmentStatus;
        const needsEscavadorTurnedTrue = before.juditNeedsEscavador !== true && after.juditNeedsEscavador === true;
        if (statusBefore === statusAfter && !needsEscavadorTurnedTrue) return;
        if (!isJuditSettled(after)) return;

        // Guard: don't re-trigger if Escavador already ran, except when it was
        // previously skipped and Judit async completion now requires validation.
        const escavadorStatus = after.escavadorEnrichmentStatus;
        const canReviveSkippedEscavador = escavadorStatus === 'SKIPPED' && after.juditNeedsEscavador === true;
        if (escavadorStatus && escavadorStatus !== 'PENDING' && !canReviveSkippedEscavador) return;

        // Guard: don't enrich concluded or returned cases
        if (after.status === 'DONE' || after.status === 'CORRECTION_NEEDED') return;

        const caseData = after;
        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);

        const tenantId = caseData.tenantId;
        if (!tenantId) return;

        try {
            const escavadorConfig = await loadEscavadorConfig(tenantId);
            if (!escavadorConfig.enabled) {
                console.log(`Case ${caseId} [Escavador]: disabled for tenant ${tenantId}.`);
                // BUG-3 fix: When Escavador is disabled but Judit flagged it as needed,
                // we must still mark SKIPPED and run auto-classification. Otherwise the
                // pipeline gets permanently stuck waiting for Escavador to complete.
                await caseRef.update({
                    escavadorEnrichmentStatus: 'SKIPPED',
                    escavadorError: null,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                if (caseData.juditNeedsEscavador) {
                    await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador disabled');
                }
                return;
            }

            // Conditional: only run if Judit flagged the need OR config forces it
            const forceRun = escavadorConfig.alwaysRun === true;
            if (!caseData.juditNeedsEscavador && !forceRun) {
                console.log(`Case ${caseId} [Escavador]: skipped — Judit found no flags requiring cross-validation.`);
                await caseRef.update({
                    escavadorEnrichmentStatus: 'SKIPPED',
                    escavadorError: null,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                // Run auto-classify since Escavador will not run
                await maybeRunAutoClassifyAndAi(caseRef, caseId, 'Escavador skip');
                return;
            }

            console.log(`Case ${caseId} [Escavador]: running cross-validation (juditNeedsEscavador=${caseData.juditNeedsEscavador}, forceRun=${forceRun}).`);
            const runLock = await acquirePhaseRun(
                caseRef,
                'escavadorEnrichmentStatus',
                canReviveSkippedEscavador ? [undefined, null, 'PENDING', 'SKIPPED'] : [undefined, null, 'PENDING'],
            );
            if (!runLock.acquired) {
                console.log(`Case ${caseId} [Escavador]: skipped because status is already ${runLock.caseData?.escavadorEnrichmentStatus || 'set'}.`);
                return;
            }
            await runEscavadorEnrichmentPhase(caseRef, caseId, runLock.caseData || caseData, escavadorConfig);

            // Audit: log automatic enrichment trigger
            try {
                const refreshed = (await caseRef.get()).data() || {};
                await writeAuditEvent({
                    action: 'ENRICHMENT_AUTO_TRIGGERED',
                    tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM },
                    entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                    related: { caseId },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: { phase: 'escavador', status: refreshed.escavadorEnrichmentStatus, trigger: 'judit_settled' },
                    templateVars: { candidateName: caseData.candidateName || caseId, phase: 'escavador', status: refreshed.escavadorEnrichmentStatus || 'UNKNOWN' },
                });
            } catch { /* audit failure must not block pipeline */ }
        } catch (err) {
            console.error(`Case ${caseId} [Escavador]: error:`, err.message);
            await caseRef.update({
                escavadorEnrichmentStatus: 'FAILED',
                escavadorError: err.message,
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
    };
}

function createEnrichDjenOnCaseHandler(deps) {
    const {
        db,
        FieldValue,
        acquirePhaseRun,
        loadDjenConfig,
        runDjenEnrichmentPhase,
        isJuditSettled,
        isSettledProviderStatus,
        maybeRunAutoClassifyAndAi,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
    } = deps;

    return async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        // Guard: trigger when Judit settles, or when Escavador settles after DJEN waited for it.
        const statusBefore = before.juditEnrichmentStatus;
        const statusAfter = after.juditEnrichmentStatus;
        const juditJustSettled = statusBefore !== statusAfter && isJuditSettled(after);
        const escavadorJustSettled = before.escavadorEnrichmentStatus !== after.escavadorEnrichmentStatus
            && after.juditNeedsEscavador === true
            && isSettledProviderStatus(after.escavadorEnrichmentStatus)
            && isJuditSettled(after);
        if (!juditJustSettled && !escavadorJustSettled) return;
        if (!isJuditSettled(after)) return;

        // Guard: don't re-trigger if DJEN already ran
        const djenStatus = after.djenEnrichmentStatus;
        if (djenStatus && djenStatus !== 'PENDING') return;

        // P2-007: Guard — wait for Escavador when Judit flagged it as needed
        if (after.juditNeedsEscavador === true) {
            const escavadorStatus = after.escavadorEnrichmentStatus;
            if (!isSettledProviderStatus(escavadorStatus)) {
                console.log(`Case ${event.params.caseId} [DJEN]: waiting for Escavador to settle (status=${escavadorStatus || 'PENDING'}).`);
                return;
            }
        }

        // Guard: don't enrich concluded cases
        if (after.status === 'DONE' || after.status === 'CORRECTION_NEEDED') return;

        const caseData = after;
        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);

        const tenantId = caseData.tenantId;
        if (!tenantId) return;

        try {
            const djenConfig = await loadDjenConfig(tenantId);
            if (!djenConfig.enabled) {
                console.log(`Case ${caseId} [DJEN]: disabled for tenant ${tenantId}.`);
                await caseRef.update({
                    djenEnrichmentStatus: 'SKIPPED',
                    djenError: null,
                    djenSkippedReason: 'disabled_for_tenant',
                    updatedAt: FieldValue.serverTimestamp(),
                });
                await maybeRunAutoClassifyAndAi(caseRef, caseId, 'DJEN disabled');
                return;
            }

            console.log(`Case ${caseId} [DJEN]: running enrichment (strategy=${djenConfig.searchStrategy}).`);
            const runLock = await acquirePhaseRun(caseRef, 'djenEnrichmentStatus');
            if (!runLock.acquired) {
                console.log(`Case ${caseId} [DJEN]: skipped because status is already ${runLock.caseData?.djenEnrichmentStatus || 'set'}.`);
                return;
            }
            await runDjenEnrichmentPhase(caseRef, caseId, runLock.caseData || caseData, djenConfig);

            // Audit: log automatic enrichment trigger
            try {
                const refreshed = (await caseRef.get()).data() || {};
                await writeAuditEvent({
                    action: 'ENRICHMENT_AUTO_TRIGGERED',
                    tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM },
                    entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                    related: { caseId },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: { phase: 'djen', status: refreshed.djenEnrichmentStatus, trigger: 'judit_settled' },
                    templateVars: { candidateName: caseData.candidateName || caseId, phase: 'djen', status: refreshed.djenEnrichmentStatus || 'UNKNOWN' },
                });
            } catch { /* audit failure must not block pipeline */ }
        } catch (err) {
            console.error(`Case ${caseId} [DJEN]: error:`, err.message);
        }
    };
}

module.exports = {
    createEnrichJuditOnCaseHandler,
    createEnrichBigDataCorpOnCaseHandler,
    createEnrichBigDataCorpOnCorrectionHandler,
    createEnrichJuditOnCorrectionHandler,
    createEnrichEscavadorOnCaseHandler,
    createEnrichDjenOnCaseHandler,
};
