/**
 * Cloud Functions: BigDataCorp-First Enrichment Pipeline
 * @version 2026-05-20 — P-NS-01 homonym strict lock
 *
 * Flow (BigDataCorp-first — async DISABLED by default):
 * 1. GATE: BigDataCorp Basic Data (R$ 0,03) — validate CPF active + name similarity + death record
 *    Fallback: FonteData receita-federal-pf (R$ 0,54) if BDC gate fails
 * 2. If gate fails → BLOCKED
 * 3. LAWSUITS: BigDataCorp processes (R$ 0,07) + Judit sync datalake simples (R$ 0,50)
 * 4. PARALLEL: Warrants (R$ 1,00) + Penal Execution (R$ 0,50)
 * 5. NAME SUPPLEMENT: Judit sync datalake by name if CPF found 0 lawsuits
 * 6. CONDITIONAL: Escavador cross-validation (triggered by criminal/warrant/execution flags)
 * 7. DJEN: Comunicacoes judiciais (after Judit settles)
 * 8. Auto-classification + AI analysis
 *
 * IMPORTANTE: Triggers onDocumentUpdated NAO rodam retroativamente para documentos
 * ja em estado terminal (DONE, CORRECTION_NEEDED). Casos em estado terminal nao
 * serao reprocessados automaticamente — requerem acao manual (rerun ou correction).
 *
 * Persistence: request_id, request body, raw response metadata saved per phase.
 */

const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
let getAuth = require('firebase-admin/auth').getAuth;
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const {
    fetchResponses,
    checkRequestStatus,
} = require('./adapters/judit');
const {
    normalizeJuditLawsuits,
    normalizeJuditWarrants,
    normalizeJuditExecution,
} = require('./normalizers/judit');
const {
    buildHomonymAnalysisInput,
} = require('./helpers/aiHomonym');
const { REPORT_BUILD_VERSION } = require('./reportBuilder.cjs');
let { writeAuditEvent } = require('./audit/writeAuditEvent');
const { ACTOR_TYPE, SOURCE } = require('./audit/auditCatalog');
const tenantUserManagement = require('./modules/tenantUserManagement');
const { getClientIp } = tenantUserManagement;
const caseCommunication = require('./caseCommunication');
const publishAndSync = require('./modules/publishAndSync');
const {
    buildResetPublishedCaseFields,
    revokeCasePublicationArtifacts,
    buildClientCasePayload,
    clientPayloadChanged,
} = publishAndSync;
const {
    pickConcludePayload,
    pickDraftPayload,
    validateConcludeFinalFlags,
    syncPublicResultLatest,
} = require('./modules/concludeCaseAndSettings');
const reportEngine = require('./modules/reportEngine');
const {
    buildExpandedKeyFindings,
    resolveNarrativeField,
    buildSanitizedPublicResultSnapshot,
    computePublicSnapshotHash,
    hasPublicReportMinimumContent,
    resolvePublicReportStatus,
    buildSourceSummary,
    buildStatusSummary,
    buildNextSteps,
    buildReportSlug,
    buildTimelineEvents,
    calculateTurnaroundHours,
    buildKeyFindings,
    buildExecutiveSummaryFallback,
    hasMeaningfulValue,
    sanitizeNarrativesForFlags,
} = reportEngine;
const {
    CLIENT_CASE_FIELDS,
    ALLOWED_DRAFT_FIELDS,
} = require('./modules/_shared/fieldConstants');
const { calculateRisk: calculateRiskScore } = require('./shared/riskCalculator');
const { DEFAULT_ANALYSIS_CONFIG } = require('./modules/_shared/analysisConfig');
const { isJuditSettled, isSettledProviderStatus } = require('./helpers/enrichmentStatus');
const {
    normCnj,
    formatCnj, formatDateBR,
    classifyWarrantType, detectCartaDeGuia, findLinkedCivilProcess, extractSentenceDetails,
    formatProcessBlock, selectTopProcessos,
} = require('./helpers/reportHelpers');
const { asDate, sanitizeAuditMetadataValue } = require('./helpers/normalize');
const { formatDateKey, formatMonthKey } = require('./modules/utilityHelpers');
const {
    evaluateComplexityTriggers,
    buildDetCriminalNotes,
    buildDetLaborNotes,
    buildDetWarrantNotes,
    buildDetKeyFindings,
    buildDetExecutiveSummary,
    buildDetFinalJustification,
    buildDeterministicPrefill,
} = require('./modules/deterministicPrefill');
const enrichmentTriggers = require('./modules/enrichmentTriggers');
const {
    loadFonteDataConfig,
    loadEscavadorConfig,
    loadEscavador2Config,
    loadJuditConfig,
    loadBigDataCorpConfig,
    loadDjenConfig,
    getTenantSettingsData,
} = require('./modules/_shared/providerConfigs');

// Módulos extraídos (Phase C)
const caseQueriesAssignments = require('./modules/caseQueriesAssignments');
const {
    buildProviderRunIds,
    fetchTenantCaseDocuments,
    matchesClientCaseFilters,
    serializeClientCaseDocument,
} = caseQueriesAssignments;
const notificationService = require('./modules/notificationService');
const opsReviewHandlers = require('./modules/opsReviewHandlers');
const pdfGeneration = require('./modules/pdfGeneration');
const systemHealth = require('./modules/systemHealth');
const clientSolicitations = require('./modules/clientSolicitations');
const {
    buildClientVerdictPolicy,
    validateClientVerdictPolicy,
    shouldEnforceClientVerdictPolicy,
} = require('./modules/clientVerdictPolicy');
const {
    EXPORT_JOB_STATUS,
    MAX_PENDING_JOBS_PER_USER,
    validateExportJobPayload,
    buildCsvContent,
    buildExportFilename,
} = require('./helpers/exportManager');
const { withRateLimit } = require('./modules/rateLimitMiddleware');
const aiParsers = require('./modules/aiParsers');
const {
    sanitizeAiOutput,
    sanitizeStructuredList,
    parseAiClassificationReviewResponse,
    validateAiClassificationReviewSchema,
    sanitizeAiClassificationReviewStructured,
    sanitizeAiPrefillStructured,
} = aiParsers;
const {
    AI_MODEL,
    AI_PROMPT_VERSION,
    AI_HOMONYM_PROMPT_VERSION,
    AI_HOMONYM_CONTEXT_VERSION,
    AI_PREFILL_PROMPT_VERSION,
    AI_CLASSIFICATION_REVIEW_PROMPT_VERSION,
    isDoneOrPartial,
    computeSimpleHash,
    getAiProvidersIncluded,
    buildAiPrompt,
    buildAiHomonymPrompt,
    buildAiClassificationReviewPrompt,
    buildAiClassificationReviewContext,
    applyAiClassificationReviewGuardrails,
    buildAiUpdatePayload,
    buildAiHomonymResetPayload,
    buildAiHomonymUpdatePayload,
    buildAiPrefillUpdatePayload,
    buildAiClassificationReviewUpdatePayload,
    runAiAnalysis: runAiAnalysisWithDb,
    runAiHomonymAnalysis: runAiHomonymAnalysisWithDb,
    runAiPrefillAnalysis: runAiPrefillAnalysisWithDb,
    runAiClassificationReviewAnalysis: runAiClassificationReviewAnalysisWithDb,
    recordAiCostLedger,
} = require('./modules/aiOrchestrator');
const { isAiEnabledForTenant } = require('./modules/_shared/aiEnabledHelper');
const {
    canRunFinalClassification,
    computeAutoClassifySignature: computeAutoClassifySignatureBase,
    computeAutoClassification,
    createAutoClassificationHandlers,
} = require('./modules/autoClassification');
const computeAutoClassifySignature = (caseData = {}) =>
    computeAutoClassifySignatureBase(caseData, { computeSimpleHash });
const runAiAnalysis = (caseData, apiKey, options = {}) => runAiAnalysisWithDb(caseData, apiKey, options, db);
const runAiHomonymAnalysis = (caseData, homonymInput, apiKey, options = {}) => runAiHomonymAnalysisWithDb(caseData, homonymInput, apiKey, options, db);
const runAiPrefillAnalysis = (caseData, apiKey, options = {}) => runAiPrefillAnalysisWithDb(caseData, apiKey, options, db);
const runAiClassificationReviewAnalysis = (caseData, apiKey, options = {}) => runAiClassificationReviewAnalysisWithDb(caseData, apiKey, options, db);
const { createEnrichmentPhases, evaluateEscavadorNeed, evaluateNegativePartialSafetyNet } = require('./modules/enrichmentPhases');
const { markPendingJuditRequestsStale, createJuditWebhookHandler, createJuditAsyncFallbackHandler } = require('./modules/juditWebhookAndFallback');
const escavador2AsyncCallback = require('./modules/escavador2AsyncCallback');
const {
    buildCanonicalReportHtml: _buildCanonicalReportHtml,
    prepareCanonicalReport: _prepareCanonicalReport,
    getPublicReportViewInner: _getPublicReportViewInner,
    createAnalystPublicReportHandler,
    createClientPublicReportHandler,
    createListClientPublicReportsHandler,
    createRevokeClientPublicReportHandler,
    createRevokePublicReportHandler,
    createGetClientCaseReportHtmlHandler,
    createGetOpsCaseReportHtmlHandler,
    createGetOpsCaseReportPreviewHandler,
    createGetPublicReportViewHandler,
    createListOpsPublicReportsHandler,
    createExportJobHandler,
    createGetExportJobStatusHandler,
    createListExportJobsHandler,
    createCancelExportJobHandler,
    createProcessExportJobHandler,
} = require('./modules/exportJobsAndReports');

// Wrappers que fecham sobre as dependências de escopo do módulo (db, etc.)
const buildCanonicalReportHtml = (caseId, caseData, sanitizedPayload, isPreview) =>
    _buildCanonicalReportHtml(caseId, caseData, sanitizedPayload, isPreview, {
        db, REPORT_BUILD_VERSION, sanitizePublicReportHtml, buildSourceSummary,
    });

const prepareCanonicalReport = (caseId, caseData) =>
    _prepareCanonicalReport(caseId, caseData, {
        REPORT_BUILD_VERSION,
        syncPublicResultLatest: (caseId, _caseData, payload, options) =>
            syncPublicResultLatest(caseId, _caseData, payload, options, db),
        hasPublicReportMinimumContent,
        computePublicSnapshotHash,
        buildCanonicalReportHtml,
    });

const getPublicReportViewInner = (tokenInput) =>
    _getPublicReportViewInner(tokenInput, { db, REPORT_BUILD_VERSION, asDate });

const OPS_ROLES = new Set(['analyst', 'supervisor', 'admin', 'owner']);
const CLIENT_REQUESTER_ROLES = new Set(['CLIENT', 'client_operator', 'client_manager']);
const CLIENT_VIEW_ROLES = new Set(['CLIENT', 'client_viewer', 'client_operator', 'client_manager']);

initializeApp();
let db = getFirestore();

const authDeps = {
    get db() { return db; },
    HttpsError,
    OPS_ROLES,
    CLIENT_REQUESTER_ROLES,
    CLIENT_VIEW_ROLES,
};
const { getOpsUserProfile, getClientUserProfile, assertOpsCanAccessCase, assertClientManager, assertCanAssignCase, canAssignCases } = require('./modules/_shared/auth')(authDeps);
const {
    sanitizeCpf,
    fixLatinMojibake,
    normalizeUnicodeToAscii,
    sanitizePublicReportHtml,
} = require('./modules/_shared/sanitizers');

const caseComm = {
    NOTIFICATION_TYPES: caseCommunication.NOTIFICATION_TYPES,
    createNotification: (notificationInput) =>
        caseCommunication.createNotification({ db, notificationInput }),
    findClientNotificationRecipientsForCase: (caseData) =>
        caseCommunication.findClientNotificationRecipientsForCase({ db, caseData }),
    findOpsNotificationRecipientsForTenant: (tenantId) =>
        caseCommunication.findOpsNotificationRecipientsForTenant({ db, tenantId }),
};

const PUBLIC_REPORT_TTL_DAYS = 14;
const PUBLIC_REPORT_TTL_MS = PUBLIC_REPORT_TTL_DAYS * 24 * 60 * 60 * 1000;
const CORS_ORIGINS = [/\.vercel\.app$/, /localhost/];

const fontedataApiKey = defineSecret('FONTEDATA_API_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');
const escavadorApiToken = defineSecret('ESCAVADOR_API_TOKEN');
const escavador2ApiKey = defineSecret('ESCAVADOR2_API_KEY');
const juditApiKey = defineSecret('JUDIT_API_KEY');
const bigdatacorpAccessToken = defineSecret('BIGDATACORP_ACCESS_TOKEN');
const bigdatacorpTokenId = defineSecret('BIGDATACORP_TOKEN_ID');

function returnCaseForIdentityGateBlock({ caseRef, caseId, provider, providerLabel, gateReason, updateFields }) {
    const updatePayload = {
        status: 'CORRECTION_NEEDED',
        correctionReason: 'identity_gate_blocked',
        correctionNotes: gateReason || 'Gate de identidade bloqueado',
        correctionRequestedBy: 'system_gate',
        correctionRequestedAt: new Date().toISOString(),
        ...(updateFields || {}),
    };
    return caseRef.update(updatePayload).then(() => ({
        status: 'BLOCKED',
        error: gateReason || 'Gate de identidade bloqueado',
        caseId,
        provider: provider || providerLabel,
    }));
}

function isIdentityGateBlocked(caseData) {
    if (!caseData) return false;
    if (caseData.bigdatacorpGateResult?.passed === false) return true;
    if (caseData.juditGateResult?.passed === false) return true;
    if (caseData.enrichmentGateResult?.passed === false) return true;
    if (caseData.bigdatacorpEnrichmentStatus === 'BLOCKED') return true;
    if (caseData.juditEnrichmentStatus === 'BLOCKED') return true;
    if (caseData.enrichmentStatus === 'BLOCKED') return true;
    return false;
}

function canBypassIdentityGate(profile) {
    if (!profile || !profile.role) return false;
    return ['supervisor', 'admin', 'owner'].includes(profile.role);
}

function buildIdentityGateCorrectionMessage(provider, reason) {
    const safeProvider = String(provider || 'Provedor');
    const safeReason = reason ? String(reason) : 'Gate de identidade bloqueado';
    return `[${safeProvider}] ${safeReason}`;
}

const {
    maybeRunAutoClassifyAndAi,
    runAutoClassifyAndAi,
    acquireAutoClassifyRun,
    releaseAutoClassifyRun,
} = createAutoClassificationHandlers({
    db,
    FieldValue,
    canRunFinalClassification,
    computeAutoClassifySignature,
    computeAutoClassification,
    asDate,
    getTenantSettingsData,
    isAiEnabledForTenant,
    loadEscavadorConfig,
    evaluateNegativePartialSafetyNet,
    buildHomonymAnalysisInput,
    buildAiHomonymResetPayload,
    runAiHomonymAnalysis,
    buildAiHomonymUpdatePayload,
    runAiClassificationReviewAnalysis,
    buildAiClassificationReviewUpdatePayload,
    getAiProvidersIncluded,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    AI_MODEL,
    AI_PROMPT_VERSION,
    AI_HOMONYM_CONTEXT_VERSION,
    AI_HOMONYM_PROMPT_VERSION,
    AI_CLASSIFICATION_REVIEW_PROMPT_VERSION,
    AI_PREFILL_PROMPT_VERSION,
    openaiApiKey,
    buildDeterministicPrefill,
    sanitizeAiPrefillStructured,
    sanitizeNarrativesForFlags,
    recordAiCostLedger,
});

const {
    buildEscavador2CallbackUrl,
    registerEscavador2Task,
    handleEscavador2CallbackLogic,
    createEscavador2CallbackHandler,
    buildEscavador2CaseCallbackUrl,
} = escavador2AsyncCallback;

const {
    runFonteDataEnrichmentPhase,
    runEscavadorEnrichmentPhase,
    runBigDataCorpEnrichmentPhase,
    runJuditEnrichmentPhase,
    runDjenEnrichmentPhase,
    runEscavador2EnrichmentPhase,
} = createEnrichmentPhases({
    db,
    FieldValue,
    fontedataApiKey,
    escavadorApiToken,
    escavador2ApiKey,
    juditApiKey,
    bigdatacorpAccessToken,
    bigdatacorpTokenId,
    maybeRunAutoClassifyAndAi,
    returnCaseForIdentityGateBlock,
    helpers: {
        buildEscavador2CallbackUrl,
        buildEscavador2CaseCallbackUrl,
        registerEscavador2Task,
    },
});

/* =========================================================
   AI ANALYSIS — Structured JSON output with anti-hallucination
   Runs AFTER all providers complete (FonteData + Escavador + Judit)
   ========================================================= */
async function acquirePhaseRun(caseRef, statusField, allowedStatuses = [undefined, null, 'PENDING']) {
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(caseRef);
        if (!snap.exists) return { acquired: false, caseData: null };
        const caseData = snap.data() || {};
        const currentStatus = caseData[statusField];
        if (!allowedStatuses.includes(currentStatus)) {
            return { acquired: false, caseData };
        }
        tx.update(caseRef, {
            [statusField]: 'RUNNING',
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { acquired: true, caseData: { ...caseData, [statusField]: 'RUNNING' } };
    });
}

/* =========================================================
   FONTEDATA — Kept as helper for manual rerun only.
   No longer triggered automatically on case creation.
   ========================================================= */
// exports.enrichFonteDataOnCase removed — FonteData is now fallback only.
// The runFonteDataEnrichmentPhase function is still available via rerunEnrichmentPhase.

/* =========================================================
   ENRICHMENT TRIGGERS — Wiring modular
   ========================================================= */

const enrichmentTriggerDeps = {
    db,
    FieldValue,
    acquirePhaseRun,
    loadJuditConfig,
    loadBigDataCorpConfig,
    loadEscavadorConfig,
    loadEscavador2Config,
    loadDjenConfig,
    runJuditEnrichmentPhase,
    runBigDataCorpEnrichmentPhase,
    runEscavadorEnrichmentPhase,
    runEscavador2EnrichmentPhase,
    runDjenEnrichmentPhase,
    isJuditSettled,
    isSettledProviderStatus,
    maybeRunAutoClassifyAndAi,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
};

exports.enrichJuditOnCase = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 540, memory: '512MiB', secrets: [juditApiKey, fontedataApiKey, openaiApiKey] },
    enrichmentTriggers.createEnrichJuditOnCaseHandler(enrichmentTriggerDeps),
);

exports.enrichBigDataCorpOnCase = onDocumentCreated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 300, memory: '256MiB', secrets: [bigdatacorpAccessToken, bigdatacorpTokenId, openaiApiKey] },
    enrichmentTriggers.createEnrichBigDataCorpOnCaseHandler(enrichmentTriggerDeps),
);

exports.enrichBigDataCorpOnCorrection = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 300, memory: '256MiB', secrets: [bigdatacorpAccessToken, bigdatacorpTokenId, openaiApiKey] },
    enrichmentTriggers.createEnrichBigDataCorpOnCorrectionHandler(enrichmentTriggerDeps),
);

exports.enrichJuditOnCorrection = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 540, memory: '512MiB', secrets: [juditApiKey, fontedataApiKey, openaiApiKey] },
    enrichmentTriggers.createEnrichJuditOnCorrectionHandler(enrichmentTriggerDeps),
);

exports.enrichEscavadorOnCase = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 300, memory: '256MiB', secrets: [escavadorApiToken, openaiApiKey] },
    enrichmentTriggers.createEnrichEscavadorOnCaseHandler(enrichmentTriggerDeps),
);

exports.enrichDjenOnCase = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 300, memory: '256MiB', secrets: [openaiApiKey] },
    enrichmentTriggers.createEnrichDjenOnCaseHandler(enrichmentTriggerDeps),
);

exports.enrichEscavador2OnCase = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 540, memory: '512MiB', secrets: [escavador2ApiKey, openaiApiKey] },
    enrichmentTriggers.createEnrichEscavador2OnCaseHandler(enrichmentTriggerDeps),
);

/* =========================================================
   JUDIT onDocumentUpdated — REMOVED (now onDocumentCreated primary).
   Backward compat: old cases with enrichmentStatus DONE/PARTIAL
   will NOT auto-trigger Judit. Use manual rerun instead.
   ========================================================= */

/* =========================================================
   PUBLISH RESULT ON CASE DONE — Subcollection for client access
   Creates cases/{caseId}/publicResult/latest with sanitized fields.
   Only fires when analyst concludes (status transitions to DONE).
   ========================================================= */


const writeClientCaseMirror = (caseId, caseData) => publishAndSync.writeClientCaseMirror({ db, caseId, caseData });

exports.syncClientCaseOnCreate = onDocumentCreated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const caseData = event.data?.data();
        if (!caseData) return;
        const caseId = event.params.caseId;
        await writeClientCaseMirror(caseId, caseData);
    },
);

const { isAutoClassifyOnlyChange, shouldSkipClientCaseMirrorSync } = publishAndSync;

exports.syncClientCaseOnUpdate = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const before = event.data?.before?.data() || {};
        const after = event.data?.after?.data();
        if (!after) return;

        // GUARD: antes de DONE, campos de auto-classificacao ainda nao sao visiveis ao cliente.
        // Depois de DONE, qualquer mudanca nesses campos precisa atualizar clientCases.
        if (shouldSkipClientCaseMirrorSync(before, after)) return;

        const caseId = event.params.caseId;
        await writeClientCaseMirror(caseId, after);
    },
);

exports.syncClientCaseOnDelete = onDocumentDeleted(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const caseId = event.params.caseId;
        await db.collection('clientCases').doc(caseId).delete().catch(() => {});
    },
);

exports.publishResultOnCaseDone = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        const caseId = event.params.caseId;

        if (after.status === 'DONE') {
            // P2-014: Validate minimum content before publishing
            if (!hasPublicReportMinimumContent(after)) {
                console.warn(`Case ${caseId}: status DONE but minimum content not met, skipping publicResult.`);
                return;
            }
            // P06: Guard — skip if concludeCaseByAnalyst already wrote publicResult/latest synchronously
            const existingPublic = await db.collection('cases').doc(caseId).collection('publicResult').doc('latest').get();
            if (existingPublic.exists) {
                const existingConcludedAt = existingPublic.data()?.concludedAt;
                const afterConcludedAt = after.concludedAt;
                if (existingConcludedAt && afterConcludedAt && existingConcludedAt.toMillis?.() >= afterConcludedAt.toMillis?.()) {
                    console.log(`Case ${caseId}: publicResult/latest already up-to-date (sync write), skipping trigger.`);
                    return;
                }
            }
            const publicData = await syncPublicResultLatest(caseId, after, {}, {
                concludedAtOverride: after.concludedAt || after.updatedAt || new Date(),
            }, db);
            console.log(`Case ${caseId}: publicResult/latest published with ${Object.keys(publicData).length} fields.`);
            return;
        }

        if (before.status === 'DONE') {
            await revokeCasePublicationArtifacts(caseId, before, db);
            console.log(`Case ${caseId}: public publication artifacts revoked after leaving DONE.`);
        }
    },
);

/* =========================================================
   CLIENT / ADMIN CALLABLES
   ========================================================= */

const solicitationDeps = {
    db,
    FieldValue,
    Timestamp,
    getClientUserProfile,
    getTenantSettingsData,
    assertClientManager,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    notificationService,
    sanitizeCpf,
    CLIENT_CASE_FIELDS,
    enforceTenantSubmissionLimits,
    compensateTenantSubmissionLimit,
    buildClientCasePayload,
    clientPayloadChanged,
    writeClientCaseMirror,
    isAutoClassifyOnlyChange,
    shouldSkipClientCaseMirrorSync,
    getClientIp,
    getOpsUserProfile,
    caseComm,
};

exports.createClientSolicitation = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120, cors: [/\.vercel\.app$/, /localhost/] },
    withRateLimit({ maxRequests: 10, windowMs: 60000, key: 'createSolicitation' })(clientSolicitations.createClientSolicitationHandler(solicitationDeps))
);

exports.submitClientCorrection = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120, cors: CORS_ORIGINS },
    withRateLimit({ maxRequests: 10, windowMs: 60000, key: 'submitCorrection' })(clientSolicitations.submitClientCorrectionHandler(solicitationDeps))
);

exports.registerClientExport = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 , cors: CORS_ORIGINS },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid);
        assertClientManager(profile);
        const { type, scope, scopeCode = 'ALL', records = 0, artifactMode = 'download', filters = {}, containsPending = false } = request.data || {};
        if (!type || !scope) {
            throw new HttpsError('invalid-argument', 'Tipo e escopo da exportacao sao obrigatorios.');
        }
        const allowedTypes = new Set(['CSV', 'PRINT', 'REPORT']);
        const allowedScopes = new Set(['ALL', 'DONE', 'PENDING', 'RED']);
        const allowedArtifactModes = new Set(['download', 'printable_html', 'html_blob']);
        const normalizedType = String(type).toUpperCase();
        const normalizedScopeCode = String(scopeCode || 'ALL').toUpperCase();
        const normalizedArtifactMode = String(artifactMode || 'download');
        const normalizedRecords = Number(records) || 0;
        if (!allowedTypes.has(normalizedType)) {
            throw new HttpsError('invalid-argument', 'Formato de exportacao invalido.');
        }
        if (!allowedScopes.has(normalizedScopeCode)) {
            throw new HttpsError('invalid-argument', 'Escopo de exportacao invalido.');
        }
        if (!allowedArtifactModes.has(normalizedArtifactMode)) {
            throw new HttpsError('invalid-argument', 'Modo de artefato invalido.');
        }
        if (!Number.isFinite(normalizedRecords) || normalizedRecords < 1) {
            throw new HttpsError('invalid-argument', 'Quantidade de registros invalida para exportacao.');
        }

        const exportRef = db.collection('exports').doc();
        const batch = db.batch();
        batch.set(exportRef, {
            tenantId: profile.tenantId,
            type: normalizedType,
            scopeCode: normalizedScopeCode,
            scope: String(scope),
            records: normalizedRecords,
            artifactMode: normalizedArtifactMode,
            storageStatus: 'LOCAL_ONLY',
            filters: {
                status: String(filters?.status || normalizedScopeCode),
                dateFrom: filters?.dateFrom || null,
                dateTo: filters?.dateTo || null,
            },
            containsPending: Boolean(containsPending),
            status: 'READY',
            createdByUid: uid,
            createdByEmail: profile.email || uid,
            createdByName: profile.displayName || profile.email || uid,
            createdAt: FieldValue.serverTimestamp(),
        });

        await batch.commit();

        await writeAuditEvent({
            action: 'EXPORT_CREATED',
            tenantId: profile.tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid, displayName: profile.displayName || null },
            entity: { type: 'EXPORT', id: exportRef.id, label: `${normalizedType}:${scope}` },
            related: { exportId: exportRef.id },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `Exportacao client-side local gerada com ${normalizedRecords} registros carregados`,
            clientDetail: `Exportacao registrada com ${normalizedRecords} registros carregados. Artefato gerado localmente e nao armazenado.`,
            clientMetadata: {
                type: normalizedType,
                scopeCode: normalizedScopeCode,
                records: normalizedRecords,
                artifactMode: normalizedArtifactMode,
                storageStatus: 'LOCAL_ONLY',
            },
        });

        return { exportId: exportRef.id };
    },
);

async function backfillClientCasesMirrorInner(request) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
    const profile = await getOpsUserProfile(uid);

    // BUG-R5-004: Only admins/owners can trigger backfill.
    if (profile.role !== 'admin' && profile.role !== 'owner') {
        throw new HttpsError('permission-denied', 'Apenas administradores podem executar backfill.');
    }

    const targetTenant = request.data?.tenantId || profile.tenantId;
    if (!targetTenant) {
        throw new HttpsError('invalid-argument', 'tenantId e obrigatorio.');
    }
    if (profile.role !== 'owner' && profile.tenantId && targetTenant !== profile.tenantId) {
        throw new HttpsError('permission-denied', 'Administradores de tenant so podem executar backfill do proprio tenant.');
    }

    // BUG-R5-004: Distributed lock to prevent concurrent backfill for the same tenant.
    const lockRef = db.collection('systemLocks').doc(`backfill-${targetTenant}`);
    try {
        if (typeof lockRef.create === 'function') {
            await lockRef.create({ startedAt: FieldValue.serverTimestamp() });
        } else {
            const lockSnap = await lockRef.get();
            if (lockSnap.exists) {
                throw new HttpsError('resource-exhausted', 'Backfill ja em execucao para este tenant.');
            }
            await lockRef.set({ startedAt: FieldValue.serverTimestamp() });
        }
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        if (error?.code === 6 || error?.code === 'already-exists') {
            throw new HttpsError('resource-exhausted', 'Backfill ja em execucao para este tenant.');
        }
        throw error;
    }

    try {
        // BUG-R5-004: Paginate backfill to avoid loading all cases into memory.
        let lastDoc = null;
        let count = 0;
        const pageSize = 400;

        while (true) {
            let q = db.collection('cases')
                .where('tenantId', '==', targetTenant)
                .limit(pageSize);
            if (lastDoc) q = q.startAfter(lastDoc);
            const snapshot = await q.get();
            const docs = snapshot.docs || [];
            if (docs.length === 0) break;

            const batch = db.batch();
            docs.forEach((docSnap) => {
                batch.set(
                    db.collection('clientCases').doc(docSnap.id),
                    buildClientCasePayload(docSnap.id, docSnap.data() || {}),
                );
                count += 1;
            });
            await batch.commit();

            lastDoc = docs[docs.length - 1];
            if (docs.length < pageSize) break;
        }
        return { synced: count };
    } finally {
        // Always release the lock, even on error.
        await lockRef.delete().catch(() => {});
    }
}

exports.backfillClientCasesMirror = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 540 , cors: CORS_ORIGINS },
    backfillClientCasesMirrorInner,
);

const dynamicDb = new Proxy({}, {
    get(_target, prop) {
        const value = db[prop];
        return typeof value === 'function' ? value.bind(db) : value;
    },
});

const publicReportHandlerDeps = {
    db: dynamicDb,
    getOpsUserProfile,
    getClientUserProfile,
    assertOpsCanAccessCase,
    assertClientManager,
    syncPublicResultLatest: (caseId, caseData, payload, options) =>
        syncPublicResultLatest(caseId, caseData, payload, options, db),
    hasPublicReportMinimumContent,
    computePublicSnapshotHash,
    buildCanonicalReportHtml,
    prepareCanonicalReport,
    sanitizePublicReportHtml,
    writeAuditEvent: (...args) => writeAuditEvent(...args),
    ACTOR_TYPE,
    SOURCE,
    getClientIp,
    REPORT_BUILD_VERSION,
    FieldValue,
    PUBLIC_REPORT_TTL_MS,
    asDate,
    buildSanitizedPublicResultSnapshot,
    ALLOWED_DRAFT_FIELDS,
    hasMeaningfulValue,
};

exports.createAnalystPublicReport = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 , cors: CORS_ORIGINS },
    withRateLimit({ maxRequests: 20, windowMs: 60000, key: 'createPublicReport' })(createAnalystPublicReportHandler(publicReportHandlerDeps)),
);

exports.createClientPublicReport = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 , cors: CORS_ORIGINS },
    createClientPublicReportHandler(publicReportHandlerDeps),
);

exports.listClientPublicReports = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 , cors: CORS_ORIGINS },
    createListClientPublicReportsHandler(publicReportHandlerDeps),
);

exports.revokeClientPublicReport = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 , cors: CORS_ORIGINS },
    createRevokeClientPublicReportHandler(publicReportHandlerDeps),
);

// AUD-011: Server-side revocation with audit log
exports.revokePublicReport = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 , cors: CORS_ORIGINS },
    createRevokePublicReportHandler(publicReportHandlerDeps),
);

// ─── Report View Callables ───────────────────────────────────────────────────

exports.getClientCaseReportHtml = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: CORS_ORIGINS },
    createGetClientCaseReportHtmlHandler(publicReportHandlerDeps),
);
exports.getOpsCaseReportHtml = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: CORS_ORIGINS },
    createGetOpsCaseReportHtmlHandler(publicReportHandlerDeps),
);

exports.getOpsCaseReportPreview = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: CORS_ORIGINS },
    createGetOpsCaseReportPreviewHandler(publicReportHandlerDeps),
);

exports.getPublicReportView = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 30, cors: CORS_ORIGINS },
    createGetPublicReportViewHandler(publicReportHandlerDeps),
);

exports.listOpsPublicReports = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: CORS_ORIGINS },
    createListOpsPublicReportsHandler(publicReportHandlerDeps),
);



exports.assignCaseToCurrentAnalyst = caseQueriesAssignments.createAssignCaseToCurrentAnalystHandler({
    db,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    writeAuditEvent,
    getClientIp,
    ACTOR_TYPE,
    SOURCE,
});

exports.assignCaseToAnalyst = caseQueriesAssignments.createAssignCaseToAnalystHandler({
    db,
    getOpsUserProfile,
    assertCanAssignCase,
    assertOpsCanAccessCase,
    writeAuditEvent,
    getClientIp,
    ACTOR_TYPE,
    SOURCE,
    OPS_ROLES,
});

exports.unassignCase = caseQueriesAssignments.createUnassignCaseHandler({
    db,
    getOpsUserProfile,
    assertCanAssignCase,
    assertOpsCanAccessCase,
    writeAuditEvent,
    getClientIp,
    ACTOR_TYPE,
    SOURCE,
});

exports.returnCaseToClient = caseQueriesAssignments.createReturnCaseToClientHandler({
    db,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    writeAuditEvent,
    getClientIp,
    ACTOR_TYPE,
    SOURCE,
    buildResetPublishedCaseFields,
    revokeCasePublicationArtifacts: (caseId, caseData) => revokeCasePublicationArtifacts(caseId, caseData, db),
    createSystemCaseMessage: caseCommunication.createSystemCaseMessage,
});

exports.concludeCaseByAnalyst = opsReviewHandlers.createConcludeCaseByAnalystHandler({
    db,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    canAssignCases,
    getTenantSettingsData,
    DEFAULT_ANALYSIS_CONFIG,
    pickConcludePayload,
    hasMeaningfulValue,
    validateConcludeFinalFlags,
    resolveNarrativeField,
    buildExecutiveSummaryFallback,
    buildExpandedKeyFindings,
    sanitizeNarrativesForFlags,
    calculateRiskScore,
    sanitizeStructuredList,
    buildSourceSummary,
    buildStatusSummary,
    buildNextSteps,
    buildTimelineEvents,
    buildReportSlug,
    calculateTurnaroundHours,
    buildSanitizedPublicResultSnapshot,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    getClientIp,
    notificationService,
    caseComm,
    canBypassIdentityGate,
    isIdentityGateBlocked,
    canRunFinalClassification,
});

exports.updateTenantSettingsByAnalyst = opsReviewHandlers.createUpdateTenantSettingsByAnalystHandler({
    db,
    getOpsUserProfile,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    getClientIp,
});

exports.saveCaseDraftByAnalyst = opsReviewHandlers.createSaveCaseDraftByAnalystHandler({
    db,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    pickDraftPayload,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    getClientIp,
});

exports.setAiDecisionByAnalyst = opsReviewHandlers.createSetAiDecisionByAnalystHandler({
    db,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    getClientIp,
});

/* =========================================================
   RE-RUN AI ANALYSIS — Callable function for analysts
   Rate limited: max 3 runs per case, min 1 min between runs.
   ========================================================= */

const CLIENT_MANAGEABLE_ROLES = new Set(['client_viewer', 'client_operator', 'client_manager']);
const OPS_MANAGEABLE_ROLES = new Set(['analyst', 'supervisor', 'admin']);


const tenantUserDeps = {
    db,
    getAuth,
    getClientUserProfile,
    getOpsUserProfile,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    DEFAULT_ANALYSIS_CONFIG,
};

/* =========================================================
   TENANT USER MANAGEMENT — Wiring modular
   ========================================================= */
exports.createOpsClientUser = tenantUserManagement.createOpsClientUserHandler(tenantUserDeps);
exports.listTenantUsers = tenantUserManagement.createListTenantUsersHandler(tenantUserDeps);
exports.createTenantUser = tenantUserManagement.createTenantUserHandler(tenantUserDeps);
exports.updateTenantUser = tenantUserManagement.createUpdateTenantUserHandler(tenantUserDeps);
exports.syncUserClaims = tenantUserManagement.createSyncUserClaimsHandler(tenantUserDeps);
exports.repairAllClaims = tenantUserManagement.createRepairAllClaimsHandler(tenantUserDeps);
exports.listOpsUsers = tenantUserManagement.createListOpsUsersHandler(tenantUserDeps);
exports.createOpsUser = tenantUserManagement.createOpsUserHandler(tenantUserDeps);
exports.updateOpsUser = tenantUserManagement.createUpdateOpsUserHandler(tenantUserDeps);
exports.updateOwnProfile = tenantUserManagement.createUpdateOwnProfileHandler(tenantUserDeps);

exports.getOpsCaseMetrics = caseQueriesAssignments.createGetOpsCaseMetricsHandler({
    db,
    getOpsUserProfile,
});

exports.getClientDashboardMetrics = caseQueriesAssignments.createGetClientDashboardMetricsHandler({
    db,
    getClientUserProfile,
});

exports.getClientCaseById = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 30, cors: CORS_ORIGINS },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
        const profile = await getClientUserProfile(uid);
        const caseId = String(request.data?.caseId || '').trim();
        if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');
        const snap = await db.collection('clientCases').doc(caseId).get();
        if (!snap.exists) throw new HttpsError('not-found', 'Solicitacao nao encontrada.');
        const data = snap.data() || {};
        if (data.tenantId !== profile.tenantId) throw new HttpsError('permission-denied', 'Sem acesso a esta solicitacao.');
        return { case: serializeClientCaseDocument(snap) };
    },
);

exports.listOpsCases = caseQueriesAssignments.createListOpsCasesHandler({
    db,
    getOpsUserProfile,
});

exports.listOpsCasesV2 = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120, memory: '1GiB', cors: CORS_ORIGINS },
    caseQueriesAssignments.createListOpsCasesV2Handler({
        db,
        getOpsUserProfile,
    }),
);

exports.listClientCases = caseQueriesAssignments.createListClientCasesHandler({
    db,
    getClientUserProfile,
});

exports.listClientCasesV2 = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120, memory: '1GiB', cors: CORS_ORIGINS },
    caseQueriesAssignments.createListClientCasesV2Handler({
        db,
        getClientUserProfile,
    }),
);

exports.getClientExportCases = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120, memory: '1GiB', cors: CORS_ORIGINS },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
        const profile = await getClientUserProfile(uid);
        assertClientManager(profile);
        const scopeCode = String(request.data?.scopeCode || 'ALL').toUpperCase();
        const dateFrom = String(request.data?.dateFrom || '');
        const dateTo = String(request.data?.dateTo || '');
        const allowedScopes = new Set(['ALL', 'DONE', 'PENDING', 'RED']);
        if (!allowedScopes.has(scopeCode)) throw new HttpsError('invalid-argument', 'Escopo de exportacao invalido.');

        const { docs, pageCount, scannedRecords, capped } = await fetchTenantCaseDocuments({
            db,
            collectionId: 'clientCases',
            tenantId: profile.tenantId,
        });
        const filters = {
            status: scopeCode === 'DONE' || scopeCode === 'PENDING' ? scopeCode : 'ALL',
            dateFrom,
            dateTo,
        };
        const cases = docs
            .map((docData) => serializeClientCaseDocument(docData))
            .filter((caseData) => matchesClientCaseFilters(caseData, filters))
            .filter((caseData) => (scopeCode === 'RED' ? caseData.riskLevel === 'RED' || caseData.riskLevel === 'HIGH' : true));
        const pendingCount = cases.filter((caseData) => caseData.status !== 'DONE').length;

        return {
            cases,
            total: cases.length,
            pendingCount,
            meta: {
                source: 'server',
                scannedRecords,
                pageCount,
                capped,
            },
        };
    },
);


const exportJobDeps = {
    db,
    getClientUserProfile,
    assertClientManager,
    validateExportJobPayload,
    EXPORT_JOB_STATUS,
    MAX_PENDING_JOBS_PER_USER,
    FieldValue,
    getStorage,
    buildCsvContent,
    buildExportFilename,
    serializeClientCaseDocument,
    matchesClientCaseFilters,
};

exports.createExportJob = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: CORS_ORIGINS },
    withRateLimit({ maxRequests: 5, windowMs: 60000, key: 'createExport' })(createExportJobHandler(exportJobDeps)),
);

exports.getExportJobStatus = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: CORS_ORIGINS },
    createGetExportJobStatusHandler(exportJobDeps),
);

exports.listExportJobs = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: CORS_ORIGINS },
    createListExportJobsHandler(exportJobDeps),
);

exports.cancelExportJob = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: CORS_ORIGINS },
    createCancelExportJobHandler(exportJobDeps),
);

exports.processExportJob = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 540, memory: '1GiB', cors: CORS_ORIGINS },
    createProcessExportJobHandler(exportJobDeps),
);

async function enforceTenantSubmissionLimits(tenantId, settings, { actor, ip } = {}) {
    return caseQueriesAssignments.enforceTenantSubmissionLimits({
        db,
        FieldValue,
        formatDateKey,
        formatMonthKey,
        HttpsError,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
    }, tenantId, settings, { actor, ip });
}

async function compensateTenantSubmissionLimit(tenantId) {
    return caseQueriesAssignments.compensateTenantSubmissionLimit({ db, tenantId });
}

async function rerunAiForCase(caseRef, caseId, caseData, uid, profile, request = null) {
    const aiRunCount = caseData.aiRunCount || 0;
    if (aiRunCount >= 3) {
        throw new HttpsError('resource-exhausted', 'Limite de 3 execucoes de IA por caso atingido.');
    }

    const lastRun = caseData.aiExecutedAt?.toMillis?.() || 0;
    if (Date.now() - lastRun < 60000) {
        throw new HttpsError('resource-exhausted', 'Aguarde 1 minuto entre execucoes de IA.');
    }

    const hasUsableEnrichment = [
        caseData.juditEnrichmentStatus,
        caseData.enrichmentStatus,
        caseData.bigdatacorpEnrichmentStatus,
        caseData.escavadorEnrichmentStatus,
        caseData.djenEnrichmentStatus,
    ].some(isDoneOrPartial);
    if (!hasUsableEnrichment) {
        throw new HttpsError('failed-precondition', 'Nenhuma fonte de enriquecimento concluida ou parcial para reexecutar a IA.');
    }

    const aiCheck = await isAiEnabledForTenant(caseData.tenantId, db);
    if (!aiCheck.enabled) {
        throw new HttpsError('failed-precondition', aiCheck.reason || 'IA desabilitada para este tenant.');
    }

    const aiKey = openaiApiKey.value();
    if (!aiKey) throw new HttpsError('internal', 'Chave OpenAI nao configurada.');

    const caseDataForAi = { ...caseData, _caseId: caseId };
    const homonymInput = buildHomonymAnalysisInput(caseDataForAi);
    const updatePayload = homonymInput.needsAnalysis
        ? {
            aiHomonymTriggered: true,
            aiHomonymContextVersion: AI_HOMONYM_CONTEXT_VERSION,
            aiHomonymAmbiguityReasons: homonymInput.ambiguityReasons,
            aiHomonymHardFacts: homonymInput.hardFacts,
        }
        : buildAiHomonymResetPayload(homonymInput);

    let homonymResult = null;
    if (homonymInput.needsAnalysis) {
        homonymResult = await runAiHomonymAnalysis(caseDataForAi, homonymInput, aiKey, { skipCache: true });
        Object.assign(updatePayload, buildAiHomonymUpdatePayload(caseDataForAi, homonymInput, homonymResult));
        Object.assign(caseDataForAi, {
            aiHomonymTriggered: true,
            aiHomonymStructured: homonymResult.structured || null,
            aiHomonymStructuredOk: homonymResult.structuredOk || false,
            aiHomonymDecision: homonymResult.structured?.decision || null,
            aiHomonymConfidence: homonymResult.structured?.confidence || null,
            aiHomonymRisk: homonymResult.structured?.homonymRisk || null,
            aiHomonymRecommendedAction: homonymResult.structured?.recommendedAction || null,
        });
    }

    const reviewResult = await runAiClassificationReviewAnalysis(caseDataForAi, aiKey, { skipCache: true });
    Object.assign(updatePayload, buildAiClassificationReviewUpdatePayload(reviewResult, { aiRunCount: aiRunCount + 1 }));
    updatePayload.aiProvidersIncluded = getAiProvidersIncluded(caseDataForAi);
    Object.assign(caseDataForAi, {
        aiClassificationReview: reviewResult.structured || null,
        aiClassificationReviewOk: reviewResult.structuredOk || false,
    });

    // Deterministic prefill: generate rich content for all narrative fields (v5)
    try {
        const detPrefill = buildDeterministicPrefill(caseDataForAi);
        updatePayload.deterministicPrefill = detPrefill;
        console.log(`Case ${caseId} [DET_PREFILL rerun]: OK (complex=${detPrefill.metadata.isComplex}, triggers=${detPrefill.metadata.triggersActive.length}, keyFindings=${detPrefill.keyFindings.length})`);

        const currentPrefill = updatePayload.prefillNarratives || {};
        const aiOk = currentPrefill.metadata?.ok === true;
        const sanitized = sanitizeAiPrefillStructured({
            criminalNotes: detPrefill.criminalNotes,
            laborNotes: detPrefill.laborNotes,
            warrantNotes: detPrefill.warrantNotes,
            keyFindings: detPrefill.keyFindings,
            executiveSummary: detPrefill.executiveSummary,
            finalJustification: detPrefill.finalJustification,
        });
        const consistency = sanitizeNarrativesForFlags({ ...caseDataForAi, ...updatePayload }, sanitized);
        const mergedPrefill = {
            ...consistency.narratives,
            metadata: {
                ...(currentPrefill.metadata || {}),
                source: 'deterministic',
                deterministicVersion: detPrefill.metadata.version,
                mergedAt: new Date().toISOString(),
                narrativeWarnings: consistency.warnings,
            },
        };
        if (consistency.warnings.length > 0) updatePayload.narrativeConsistencyWarnings = consistency.warnings;
        updatePayload.prefillNarratives = mergedPrefill;
        console.log(`Case ${caseId} [PREFILL_MERGE rerun]: source=${mergedPrefill.metadata.source}, aiOk=${aiOk}`);
    } catch (detErr) {
        console.error(`Case ${caseId} [DET_PREFILL rerun]: error:`, detErr.message);
        updatePayload.deterministicPrefill = {
            metadata: {
                source: 'deterministic',
                version: 'v5-deterministic-prefill',
                generatedAt: new Date().toISOString(),
                error: detErr.message,
                triggersActive: [],
                isComplex: false,
            },
        };
    }

    await caseRef.update(updatePayload);
    await recordAiCostLedger(caseData.tenantId, updatePayload, db).catch((err) => {
        console.warn(`Case ${caseId} [AI Ledger rerun]: failed to record cost:`, err.message);
    });

    await writeAuditEvent({
        action: 'AI_RERUN',
        tenantId: caseData.tenantId,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
        related: { caseId },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        metadata: {
            model: sanitizeAuditMetadataValue(reviewResult.model),
            cost: sanitizeAuditMetadataValue(updatePayload.aiClassificationReviewCostUsd),
            structuredOk: sanitizeAuditMetadataValue(reviewResult.structuredOk),
            runNumber: aiRunCount + 1,
            error: sanitizeAuditMetadataValue(reviewResult.error || null),
            promptVersion: sanitizeAuditMetadataValue(AI_CLASSIFICATION_REVIEW_PROMPT_VERSION),
            homonymDecision: sanitizeAuditMetadataValue(updatePayload.aiHomonymDecision),
            homonymConfidence: sanitizeAuditMetadataValue(updatePayload.aiHomonymConfidence),
            homonymError: sanitizeAuditMetadataValue(updatePayload.aiHomonymError),
            deterministicVersion: sanitizeAuditMetadataValue(updatePayload.deterministicPrefill?.metadata?.version || null),
        },
        templateVars: { candidateName: caseData.candidateName || caseId },
    });

    return {
        success: !reviewResult.error,
        phase: 'ai',
        status: reviewResult.error ? 'FAILED' : 'DONE',
        aiClassificationReview: reviewResult.structured || null,
        aiClassificationReviewOk: reviewResult.structuredOk || false,
        homonymStructured: homonymResult?.structured || null,
        homonymStructuredOk: homonymResult?.structuredOk || false,
        error: reviewResult.error || null,
    };
}

exports.rerunAiAnalysis = caseQueriesAssignments.createRerunAiAnalysisHandler({
    db,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    rerunAiForCase,
    isAiEnabledForTenant,
    openaiApiKey,
});

exports.rerunEnrichmentPhase = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 540, secrets: [fontedataApiKey, openaiApiKey, escavadorApiToken, escavador2ApiKey, juditApiKey, bigdatacorpAccessToken, bigdatacorpTokenId] , cors: CORS_ORIGINS },
    withRateLimit({ maxRequests: 5, windowMs: 60000, key: 'rerunEnrichment' })(async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const { caseId, phase, scope = 'cascade' } = request.data || {};
        if (!caseId || typeof caseId !== 'string') {
            throw new HttpsError('invalid-argument', 'caseId obrigatorio.');
        }
        if (!['fontedata', 'escavador', 'escavador2', 'judit', 'bigdatacorp', 'djen', 'ai', 'all'].includes(phase)) {
            throw new HttpsError('invalid-argument', 'Fase invalida para rerun.');
        }
        // BUG-R3-007: Validate scope parameter.
        if (!['single', 'cascade'].includes(scope)) {
            throw new HttpsError('invalid-argument', 'Escopo invalido. Use "single" ou "cascade".');
        }

        const profile = await getOpsUserProfile(uid);
        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');

        const caseData = caseDoc.data() || {};
        assertOpsCanAccessCase(profile, caseData, caseId);

        if (phase === 'ai') {
            return rerunAiForCase(caseRef, caseId, caseData, uid, profile, request);
        }

        if (caseData.status === 'DONE' || caseData.status === 'CORRECTION_NEEDED') {
            throw new HttpsError('failed-precondition', 'Nao e permitido reexecutar enriquecimento em casos concluidos ou devolvidos.');
        }

        // â”€â”€â”€ FULL RERUN (phase='all') â”€â”€â”€
        if (phase === 'all') {
            const force = request.data?.force === true;
            const reason = request.data?.reason || 'manual_full_rerun';

            // Block if any provider is running and force is not set
            const runningProviders = [
                caseData.bigdatacorpEnrichmentStatus === 'RUNNING' ? 'BigDataCorp' : null,
                caseData.juditEnrichmentStatus === 'RUNNING' ? 'Judit' : null,
                caseData.djenEnrichmentStatus === 'RUNNING' ? 'DJEN' : null,
                caseData.escavadorEnrichmentStatus === 'RUNNING' ? 'Escavador' : null,
                caseData.escavador2EnrichmentStatus === 'RUNNING' ? 'Escavador2' : null,
            ].filter(Boolean);

            if (runningProviders.length > 0 && !force) {
                throw new HttpsError(
                    'failed-precondition',
                    `Provider(s) em execucao: ${runningProviders.join(', ')}. Use force=true para forcar o rerun.`,
                );
            }

            // Mark pending Judit requests as stale
            const staleCount = await markPendingJuditRequestsStale(db, caseId, `${reason}_full_rerun`);

            // Generate new run IDs
            const runIds = buildProviderRunIds(caseId);

            // Build reset payload
            const resetPayload = {
                ...runIds,
                enrichmentGeneration: FieldValue.increment(1),
                bigdatacorpEnrichmentStatus: 'PENDING',
                juditEnrichmentStatus: 'PENDING',
                djenEnrichmentStatus: 'PENDING',
                escavadorEnrichmentStatus: 'PENDING',
                escavador2EnrichmentStatus: 'PENDING',
                enrichmentStatus: 'PENDING',
                bigdatacorpError: null,
                juditError: null,
                djenError: null,
                escavadorError: null,
                escavador2Error: null,
                enrichmentError: null,
                fullRerunRequestedAt: FieldValue.serverTimestamp(),
                fullRerunRequestedBy: uid,
                fullRerunReason: reason,
                fullRerunStatus: 'PENDING',
                updatedAt: FieldValue.serverTimestamp(),
            };

            // Delete derived fields
            const allDerivedFields = [
                'autoClassifiedAt', 'autoClassifySignature', 'autoClassifyLock', 'autoClassifyRerunRequested',
                'aiStatus', 'aiRawResponse', 'aiAnalysis', 'aiStructured', 'aiStructuredOk', 'aiError',
                'aiCostUsd', 'aiTokens', 'aiExecutedAt', 'aiProvidersIncluded', 'aiPromptVersion', 'aiFromCache',
                'aiHomonymStructured', 'aiHomonymStructuredOk', 'aiHomonymRawResponse', 'aiHomonymTriggered',
                'aiHomonymDecision', 'aiHomonymConfidence', 'aiHomonymRisk', 'aiHomonymRecommendedAction',
                'aiHomonymCostUsd', 'aiHomonymTokens', 'aiHomonymExecutedAt', 'aiHomonymError',
                'prefillNarratives', 'deterministicPrefill',
                'riskScore', 'riskLevel', 'finalVerdict', 'publicReportToken', 'reportSlug', 'reportReady',
                'sourceSummary', 'statusSummary', 'nextSteps',
                'criminalFlag', 'criminalSeverity', 'criminalEvidenceQuality', 'criminalNotes',
                'warrantFlag', 'warrantNotes', 'laborFlag', 'laborSeverity', 'laborNotes',
                'coverageLevel', 'coverageNotes', 'providerDivergence', 'ambiguityNotes', 'reviewRecommended',
                'negativePartialSafetyNetEligible', 'negativePartialSafetyNetReasons',
                'negativePartialSafetyNetAction', 'negativePartialSafetyNetTriggered',
                'juditIdentity', 'juditGateResult', 'juditPrimaryUf', 'juditAllUfs', 'juditHasLawsuits',
                'juditProcessTotal', 'juditRoleSummary', 'juditProcessos', 'juditCriminalFlag', 'juditCriminalCount',
                'juditWarrantFlag', 'juditWarrantNotes', 'juditWarrants', 'juditActiveWarrantCount',
                'juditExecutionFlag', 'juditExecutionCount', 'juditExecutions', 'juditExecutionNotes',
                'juditNameSearchFlag', 'juditNameSearchProcessTotal', 'juditNameSearchCriminalCount',
                'juditNameSearchCpfsComNome', 'juditNeedsEscavador', 'juditNeedsEscavadorReason',
                'juditPendingAsyncPhases', 'juditPendingAsyncCount', 'juditRequestIds', 'juditSources',
                'juditRawPayloads', 'juditCostBRL', 'juditEnrichedAt', 'juditPartialDataAvailable',
                'escavadorProcessTotal', 'escavadorProcessos', 'escavadorCriminalFlag', 'escavadorCriminalCount',
                'escavadorLaborFlag', 'escavadorLaborCount', 'escavadorNotes', 'escavadorCpfsComEsseNome',
                'escavadorSources', 'escavadorEnrichedAt',
                'djenComunicacoes', 'djenCriminalFlag', 'djenLaborFlag', 'djenNotes',
                'djenSources', 'djenCostBRL', 'djenElapsedMs', 'djenQueryDate', 'djenEnrichedAt',
                'bigdatacorpBasicData', 'bigdatacorpGateResult', 'bigdatacorpName', 'bigdatacorpCpfStatus',
                'bigdatacorpProcessTotal', 'bigdatacorpCriminalFlag', 'bigdatacorpCriminalCount',
                'bigdatacorpDirectCriminalCount', 'bigdatacorpPossibleHomonymCriminalCount',
                'bigdatacorpLaborFlag', 'bigdatacorpLaborCount', 'bigdatacorpDirectLaborCount',
                'bigdatacorpPossibleHomonymLaborCount', 'bigdatacorpCivilCount', 'bigdatacorpProcessos',
                'bigdatacorpProcessNotes', 'bigdatacorpKycNotes', 'bigdatacorpProfessionNotes',
                'bigdatacorpIsPep', 'bigdatacorpIsSanctioned', 'bigdatacorpWasSanctioned',
                'bigdatacorpSanctionDetails', 'bigdatacorpActiveWarrants', 'bigdatacorpHasArrestWarrant',
                'bigdatacorpSources', 'bigdatacorpRawPayloads', 'bigdatacorpCostBRL', 'bigdatacorpEnrichedAt',
                'enrichmentSources', 'enrichmentIdentity', 'enrichmentGateResult', 'enrichmentPrimaryUf',
                'enrichmentAllUfs', 'fontedataCriminalFlag', 'fontedataWarrantFlag', 'fontedataLaborFlag',
                'enrichedAt',
                'escavador2TaskId', 'escavador2CallbackStatus', 'escavador2DedupeDateToleranceDays',
                'escavador2ApiStatus', 'escavador2ProcessTotal', 'escavador2Processos',
                'escavador2CriminalFlag', 'escavador2CriminalCount', 'escavador2LaborFlag', 'escavador2LaborCount',
                'escavador2MaterialRiskCount', 'escavador2CnjMaskedCount', 'escavador2CnjExtractedCount',
                'escavador2DuplicateCount', 'escavador2NewFindingCount', 'escavador2HasNewMaterialRisk',
                'escavador2Notes', 'escavador2PartialErrors', 'escavador2Stats', 'escavador2Sources',
                'escavador2RawPayloads', 'escavador2CostBRL', 'escavador2EnrichedAt',
            ];
            for (const field of allDerivedFields) {
                resetPayload[field] = FieldValue.delete();
            }

            await caseRef.update(resetPayload);

            // Start BigDataCorp with lock
            const bdcConfig = await loadBigDataCorpConfig(caseData.tenantId);
            if (bdcConfig.enabled) {
                const runLock = await acquirePhaseRun(caseRef, 'bigdatacorpEnrichmentStatus');
                if (runLock.acquired) {
                    const freshData = (await caseRef.get()).data() || {};
                    await runBigDataCorpEnrichmentPhase(caseRef, caseId, freshData, bdcConfig);
                }
            } else {
                await caseRef.update({
                    bigdatacorpEnrichmentStatus: 'SKIPPED',
                    bigdatacorpError: 'Provider desabilitado para este tenant.',
                    updatedAt: FieldValue.serverTimestamp(),
                });
                await maybeRunAutoClassifyAndAi(caseRef, caseId, 'BigDataCorp disabled on full rerun');
            }

            await writeAuditEvent({
                action: 'ENRICHMENT_FULL_RERUN',
                tenantId: caseData.tenantId,
                actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
                entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                related: { caseId },
                source: SOURCE.PORTAL_OPS,
                ip: getClientIp(request),
                metadata: { reason, staleJuditRequests: staleCount, force },
                templateVars: { candidateName: caseData.candidateName || caseId },
            });

            return {
                success: true,
                phase: 'all',
                message: 'Rerun geral iniciado. BigDataCorp foi acionado; demais etapas seguirao pelos triggers.',
                staleJuditRequests: staleCount,
            };
        }

        const aiDerivedFields = [
            'autoClassifiedAt', 'autoClassifySignature', 'autoClassifyLock', 'autoClassifyRerunRequested',
            'aiStatus', 'aiRawResponse', 'aiAnalysis', 'aiStructured', 'aiStructuredOk', 'aiError',
            'aiCostUsd', 'aiTokens', 'aiExecutedAt', 'aiProvidersIncluded', 'aiPromptVersion', 'aiFromCache',
            'aiHomonymStructured', 'aiHomonymStructuredOk', 'aiHomonymRawResponse', 'aiHomonymTriggered',
            'aiHomonymDecision', 'aiHomonymConfidence', 'aiHomonymRisk', 'aiHomonymRecommendedAction',
            'aiHomonymCostUsd', 'aiHomonymTokens', 'aiHomonymExecutedAt', 'aiHomonymError',
            'prefillNarratives', 'deterministicPrefill',
            'riskScore', 'riskLevel', 'finalVerdict', 'publicReportToken', 'reportSlug', 'reportReady',
            'sourceSummary', 'statusSummary', 'nextSteps',
        ];
        const classificationDerivedFields = [
            'criminalFlag', 'criminalSeverity', 'criminalEvidenceQuality', 'criminalNotes',
            'warrantFlag', 'warrantNotes', 'laborFlag', 'laborSeverity', 'laborNotes',
            'coverageLevel', 'coverageNotes', 'providerDivergence', 'ambiguityNotes', 'reviewRecommended',
            'negativePartialSafetyNetEligible', 'negativePartialSafetyNetReasons',
            'negativePartialSafetyNetAction', 'negativePartialSafetyNetTriggered',
        ];
        const fullDerivedFields = [...classificationDerivedFields, ...aiDerivedFields];
        const juditDataFields = [
            'juditIdentity', 'juditGateResult', 'juditPrimaryUf', 'juditAllUfs', 'juditHasLawsuits',
            'juditProcessTotal', 'juditRoleSummary', 'juditProcessos', 'juditCriminalFlag', 'juditCriminalCount',
            'juditWarrantFlag', 'juditWarrantNotes', 'juditWarrants', 'juditActiveWarrantCount',
            'juditExecutionFlag', 'juditExecutionCount', 'juditExecutions', 'juditExecutionNotes',
            'juditNameSearchFlag', 'juditNameSearchProcessTotal', 'juditNameSearchCriminalCount',
            'juditNameSearchCpfsComNome', 'juditNeedsEscavador', 'juditNeedsEscavadorReason',
            'juditPendingAsyncPhases', 'juditPendingAsyncCount', 'juditRequestIds', 'juditSources',
            'juditRawPayloads', 'juditCostBRL', 'juditEnrichedAt',
        ];
        const escavadorDataFields = [
            'escavadorProcessTotal', 'escavadorProcessos', 'escavadorCriminalFlag', 'escavadorCriminalCount',
            'escavadorLaborFlag', 'escavadorLaborCount', 'escavadorNotes', 'escavadorCpfsComEsseNome',
            'escavadorSources', 'escavadorEnrichedAt',
        ];
        const djenDataFields = [
            'djenComunicacoes', 'djenCriminalFlag', 'djenLaborFlag', 'djenNotes',
            'djenSources', 'djenCostBRL', 'djenElapsedMs', 'djenQueryDate', 'djenEnrichedAt',
        ];
        const escavador2DataFields = [
            'escavador2TaskId', 'escavador2CallbackStatus', 'escavador2DedupeDateToleranceDays',
            'escavador2ApiStatus', 'escavador2ProcessTotal', 'escavador2Processos',
            'escavador2CriminalFlag', 'escavador2CriminalCount', 'escavador2LaborFlag', 'escavador2LaborCount',
            'escavador2MaterialRiskCount', 'escavador2CnjMaskedCount', 'escavador2CnjExtractedCount',
            'escavador2DuplicateCount', 'escavador2NewFindingCount', 'escavador2HasNewMaterialRisk',
            'escavador2Notes', 'escavador2PartialErrors', 'escavador2Stats', 'escavador2Sources',
            'escavador2RawPayloads', 'escavador2CostBRL', 'escavador2EnrichedAt',
        ];
        const applyDeleteFields = (target, fields) => {
            for (const field of fields) target[field] = FieldValue.delete();
        };
        const applyCascadeReset = (target, currentPhase) => {
            if (currentPhase === 'bigdatacorp') {
                target.juditEnrichmentStatus = 'PENDING';
                target.juditError = null;
                target.escavadorEnrichmentStatus = 'PENDING';
                target.escavadorError = null;
                target.djenEnrichmentStatus = 'PENDING';
                target.djenError = null;
                target.escavador2EnrichmentStatus = 'PENDING';
                target.escavador2Error = null;
                applyDeleteFields(target, juditDataFields);
                applyDeleteFields(target, escavadorDataFields);
                applyDeleteFields(target, djenDataFields);
                applyDeleteFields(target, escavador2DataFields);
            } else if (currentPhase === 'judit') {
                target.escavadorEnrichmentStatus = 'PENDING';
                target.escavadorError = null;
                target.djenEnrichmentStatus = 'PENDING';
                target.djenError = null;
                target.escavador2EnrichmentStatus = 'PENDING';
                target.escavador2Error = null;
                applyDeleteFields(target, escavadorDataFields);
                applyDeleteFields(target, djenDataFields);
                applyDeleteFields(target, escavador2DataFields);
            } else if (currentPhase === 'escavador') {
                target.escavador2EnrichmentStatus = 'PENDING';
                target.escavador2Error = null;
                applyDeleteFields(target, escavador2DataFields.filter((f) => f !== 'escavador2RawPayloads'));
            } else if (currentPhase === 'djen') {
                target.escavador2EnrichmentStatus = 'PENDING';
                target.escavador2Error = null;
                applyDeleteFields(target, escavador2DataFields);
            }
        };
        const phaseMeta = {
            fontedata: { statusField: 'enrichmentStatus', errorField: 'enrichmentError', label: 'FonteData', derived: fullDerivedFields },
            escavador: { statusField: 'escavadorEnrichmentStatus', errorField: 'escavadorError', label: 'Escavador', derived: aiDerivedFields },
            escavador2: { statusField: 'escavador2EnrichmentStatus', errorField: 'escavador2Error', label: 'Escavador2', derived: aiDerivedFields },
            judit: { statusField: 'juditEnrichmentStatus', errorField: 'juditError', label: 'Judit', derived: fullDerivedFields },
            bigdatacorp: { statusField: 'bigdatacorpEnrichmentStatus', errorField: 'bigdatacorpError', label: 'BigDataCorp', derived: fullDerivedFields },
            djen: { statusField: 'djenEnrichmentStatus', errorField: 'djenError', label: 'DJEN', derived: aiDerivedFields },
        };
        const meta = phaseMeta[phase];
        const beforeStatus = caseData[meta.statusField] || 'PENDING';

        if (beforeStatus === 'RUNNING') {
            throw new HttpsError('failed-precondition', `${meta.label} ja esta em execucao.`);
        }
        if (phase === 'fontedata' && beforeStatus === 'BLOCKED') {
            throw new HttpsError('failed-precondition', 'FonteData bloqueou o caso no gate de identidade. Corrija os dados antes de tentar novamente.');
        }
        if (!['FAILED', 'PARTIAL', 'DONE', 'SKIPPED', 'BLOCKED'].includes(beforeStatus)) {
            throw new HttpsError('failed-precondition', `${meta.label} so pode ser reexecutado quando estiver em estado terminal.`);
        }
        // Escavador requires Judit to be done
        if (phase === 'escavador' && !isDoneOrPartial(caseData.juditEnrichmentStatus)) {
            throw new HttpsError('failed-precondition', 'Judit precisa estar concluido antes do rerun do Escavador.');
        }
        if (phase === 'escavador2') {
            const terminalStatuses = ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED', 'BLOCKED'];
            const isTerminal = (status) => terminalStatuses.includes(status);
            const unsettledProviders = [
                !isTerminal(caseData.bigdatacorpEnrichmentStatus) ? 'BigDataCorp' : null,
                !isTerminal(caseData.juditEnrichmentStatus) ? 'Judit' : null,
                caseData.juditNeedsEscavador === true && !isTerminal(caseData.escavadorEnrichmentStatus) ? 'Escavador' : null,
                caseData.djenEnrichmentStatus && !isTerminal(caseData.djenEnrichmentStatus) ? 'DJEN' : null,
            ].filter(Boolean);
            if (unsettledProviders.length > 0) {
                throw new HttpsError('failed-precondition', `Judit precisa estar terminalizado antes do rerun do Escavador2. Provedores pendentes: ${unsettledProviders.join(', ')}.`);
            }
        }

        if (!caseData.tenantId) {
            throw new HttpsError('failed-precondition', 'Caso sem tenantId.');
        }
        const getFreshCaseData = async () => {
            const freshDoc = await caseRef.get();
            return freshDoc.data() || caseData;
        };

        if (phase === 'fontedata') {
            const enrichmentConfig = await loadFonteDataConfig(caseData.tenantId);
            if (!enrichmentConfig.enabled) {
                throw new HttpsError('failed-precondition', 'FonteData desabilitado para este tenant.');
            }
            // BUG-R3-006: Invalidate derived phases before rerun.
            // BUG-R3-007: Only invalidate when scope is 'cascade' (default).
            if (scope === 'cascade') {
                const invalidateFields = {};
                for (const field of phaseMeta.fontedata.derived) {
                    invalidateFields[field] = field === 'reportReady' ? false : FieldValue.delete();
                }
                invalidateFields.updatedAt = FieldValue.serverTimestamp();
                await caseRef.update(invalidateFields);
            }

            // P1-008: Acquire phase lock to prevent race conditions on manual rerun
            const lock = await acquirePhaseRun(caseRef, 'enrichmentStatus');
            if (!lock.acquired) {
                throw new HttpsError('failed-precondition', 'Enriquecimento ja em andamento. Aguarde a conclusao.');
            }
            await runFonteDataEnrichmentPhase(caseRef, caseId, await getFreshCaseData(), enrichmentConfig);

            // FonteData rerun does NOT cascade to Judit/Escavador anymore.
            // Run auto-classify to incorporate any new FonteData data.
            try {
                await maybeRunAutoClassifyAndAi(caseRef, caseId, 'FonteData rerun');
            } catch (classifyErr) {
                console.error(`Case ${caseId} [AutoClassify via FonteData rerun]: error:`, classifyErr.message);
            }
        }

        if (phase === 'escavador') {
            const escavadorConfig = await loadEscavadorConfig(caseData.tenantId);
            if (!escavadorConfig.enabled) {
                throw new HttpsError('failed-precondition', 'Escavador desabilitado para este tenant.');
            }
            // BUG-R3-006: Invalidate derived phases before rerun.
            // BUG-R3-007: Only invalidate when scope is 'cascade' (default).
            if (scope === 'cascade') {
                const invalidateFields = {};
                for (const field of phaseMeta.escavador.derived) {
                    invalidateFields[field] = field === 'reportReady' ? false : FieldValue.delete();
                }
                applyCascadeReset(invalidateFields, 'escavador');
                invalidateFields.updatedAt = FieldValue.serverTimestamp();
                await caseRef.update(invalidateFields);
            }
            await runEscavadorEnrichmentPhase(caseRef, caseId, await getFreshCaseData(), escavadorConfig);
        }

        if (phase === 'judit') {
            const juditConfig = await loadJuditConfig(caseData.tenantId);
            if (!juditConfig.enabled) {
                throw new HttpsError('failed-precondition', 'Judit desabilitado para este tenant.');
            }
            // BUG-R3-006: Invalidate derived phases before rerun.
            // BUG-R3-007: Only invalidate when scope is 'cascade' (default).
            if (scope === 'cascade') {
                const invalidateFields = {};
                for (const field of phaseMeta.judit.derived) {
                    invalidateFields[field] = field === 'reportReady' ? false : FieldValue.delete();
                }
                applyCascadeReset(invalidateFields, 'judit');
                invalidateFields.updatedAt = FieldValue.serverTimestamp();
                await caseRef.update(invalidateFields);
            }
            // On rerun, skip gate if it already passed
            const freshCaseData = await getFreshCaseData();
            const skipGate = freshCaseData.juditGateResult?.passed === true;
            await runJuditEnrichmentPhase(caseRef, caseId, freshCaseData, juditConfig, { skipGate });
        }

        if (phase === 'bigdatacorp') {
            const bdcConfig = await loadBigDataCorpConfig(caseData.tenantId);
            if (!bdcConfig.enabled) {
                throw new HttpsError('failed-precondition', 'BigDataCorp desabilitado para este tenant.');
            }
            // BUG-R3-006: Invalidate derived phases before rerun so stale data doesn't persist.
            // BUG-R3-007: Only invalidate when scope is 'cascade' (default).
            if (scope === 'cascade') {
                const invalidateFields = {};
                for (const field of phaseMeta.bigdatacorp.derived) {
                    invalidateFields[field] = field === 'reportReady' ? false : FieldValue.delete();
                }
                applyCascadeReset(invalidateFields, 'bigdatacorp');
                invalidateFields.updatedAt = FieldValue.serverTimestamp();
                await caseRef.update(invalidateFields);
            }
            await runBigDataCorpEnrichmentPhase(caseRef, caseId, await getFreshCaseData(), bdcConfig);
        }

        if (phase === 'djen') {
            const djenConfig = await loadDjenConfig(caseData.tenantId);
            if (!djenConfig.enabled) {
                throw new HttpsError('failed-precondition', 'DJEN desabilitado para este tenant.');
            }
            // BUG-R3-006: Invalidate derived phases before rerun.
            // BUG-R3-007: Only invalidate when scope is 'cascade' (default).
            if (scope === 'cascade') {
                const invalidateFields = {};
                for (const field of phaseMeta.djen.derived) {
                    invalidateFields[field] = field === 'reportReady' ? false : FieldValue.delete();
                }
                invalidateFields.updatedAt = FieldValue.serverTimestamp();
                await caseRef.update(invalidateFields);
            }
            await runDjenEnrichmentPhase(caseRef, caseId, await getFreshCaseData(), djenConfig);
        }

        if (phase === 'escavador2') {
            const escavador2Config = await loadEscavador2Config(caseData.tenantId);
            if (!escavador2Config.enabled) {
                throw new HttpsError('failed-precondition', 'Escavador2 desabilitado para este tenant.');
            }
            if (scope === 'cascade') {
                const invalidateFields = {};
                for (const field of phaseMeta.escavador2.derived) {
                    invalidateFields[field] = field === 'reportReady' ? false : FieldValue.delete();
                }
                invalidateFields.updatedAt = FieldValue.serverTimestamp();
                await caseRef.update(invalidateFields);
            }
            await runEscavador2EnrichmentPhase(caseRef, caseId, await getFreshCaseData(), escavador2Config);
        }

        const refreshedDoc = await caseRef.get();
        const refreshedData = refreshedDoc.data() || {};
        const afterStatus = refreshedData[meta.statusField] || beforeStatus;
        const afterError = refreshedData[meta.errorField] || null;

        await writeAuditEvent({
            action: 'ENRICHMENT_PHASE_RERUN',
            tenantId: refreshedData.tenantId,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
            related: { caseId },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            metadata: { phase, beforeStatus, afterStatus, error: afterError },
            templateVars: { candidateName: caseData.candidateName || caseId, phase },
        });

        return {
            success: afterStatus === 'DONE' || afterStatus === 'PARTIAL',
            phase,
            status: afterStatus,
            error: afterError,
        };
    },
));

exports.juditWebhook = createJuditWebhookHandler({
    db,
    FieldValue,
    juditApiKey,
    openaiApiKey,
    fetchResponses,
    normalizeJuditWarrants,
    normalizeJuditExecution,
    normalizeJuditLawsuits,
    loadJuditConfig,
    evaluateEscavadorNeed,
    maybeRunAutoClassifyAndAi,
});

exports.juditAsyncFallback = createJuditAsyncFallbackHandler({
    db,
    FieldValue,
    juditApiKey,
    openaiApiKey,
    fetchResponses,
    checkRequestStatus,
    normalizeJuditWarrants,
    normalizeJuditExecution,
    normalizeJuditLawsuits,
    loadJuditConfig,
    evaluateEscavadorNeed,
    maybeRunAutoClassifyAndAi,
});

exports.escavador2Callback = createEscavador2CallbackHandler({
    db,
    FieldValue,
    escavador2ApiKey,
    openaiApiKey,
    maybeRunAutoClassifyAndAi,
});

const repairAllClaimsInner = (request) => tenantUserManagement.repairAllClaimsInner({ db, getAuth, request });
const getClientQuotaStatusInner = (uid) => systemHealth.getClientQuotaStatusInner({
    db,
    getClientUserProfile,
    getTenantSettingsData,
    uid,
});

exports.__test = {
    computeAutoClassification,
    runAutoClassifyAndAi,
    acquireAutoClassifyRun,
    releaseAutoClassifyRun,
    buildAiPrompt,
    buildAiUpdatePayload,
    buildAiClassificationReviewPrompt,
    buildAiClassificationReviewContext,
    applyAiClassificationReviewGuardrails,
    buildAiHomonymPrompt,
    buildAiPrefillUpdatePayload,
    runAiAnalysis,
    runAiPrefillAnalysis,
    parseAiClassificationReviewResponse,
    validateAiClassificationReviewSchema,
    sanitizeAiClassificationReviewStructured,
    evaluateEscavadorNeed,
    evaluateNegativePartialSafetyNet,
    enforceTenantSubmissionLimits,
    formatDateKey,
    formatMonthKey,
    getClientQuotaStatusInner,
    getPublicReportViewInner,
    buildDeterministicPrefill,
    evaluateComplexityTriggers,
    buildDetCriminalNotes,
    buildDetLaborNotes,
    buildDetWarrantNotes,
    buildDetKeyFindings,
    buildDetExecutiveSummary,
    buildDetFinalJustification,
    buildKeyFindings,
    buildExpandedKeyFindings,
    selectTopProcessos,
    normCnj,
    formatCnj,
    formatDateBR,
    classifyWarrantType,
    detectCartaDeGuia,
    findLinkedCivilProcess,
    extractSentenceDetails,
    formatProcessBlock,
    sanitizeAiOutput,
    sanitizeAuditMetadataValue,
    sanitizeNarrativesForFlags,
    validateConcludeFinalFlags,
    buildClientVerdictPolicy,
    validateClientVerdictPolicy,
    shouldEnforceClientVerdictPolicy,
    normalizeUnicodeToAscii,
    fixLatinMojibake,
    backfillClientCasesMirrorInner,
    buildClientCasePayload,
    buildSanitizedPublicResultSnapshot,
    fetchTenantCaseDocuments,
    repairAllClaimsInner,
    clientPayloadChanged,
    isAutoClassifyOnlyChange,
    shouldSkipClientCaseMirrorSync,
    // Identity gate helpers
    isIdentityGateBlocked,
    canBypassIdentityGate,
    buildIdentityGateCorrectionMessage,
    returnCaseForIdentityGateBlock,
    // Escavador2 callback helpers
    handleEscavador2CallbackLogic,
    buildEscavador2CallbackUrl,
    // Handlers V2 para testes (usam db dinamicamente)
    listOpsCasesV2Handler: (request) => caseQueriesAssignments.createListOpsCasesV2Handler({ db, getOpsUserProfile })(request),
    listClientCasesV2Handler: (request) => caseQueriesAssignments.createListClientCasesV2Handler({ db, getClientUserProfile })(request),
    _setDb(mockDb) { db = mockDb; },
    _setGetAuth(mockFn) { getAuth = mockFn; },
    _setWriteAuditEvent(mockFn) { writeAuditEvent = mockFn; },
};

/* =========================================================
   SYSTEM HEALTH — Read-only endpoint for provider status
   ========================================================= */

exports.getSystemHealth = systemHealth.createGetSystemHealthHandler({
    db,
    getOpsUserProfile: (uid) => getOpsUserProfile(uid),
    circuitBreaker: require('./helpers/circuitBreaker'),
});

/* =========================================================
   CLIENT QUOTA STATUS — Read-only quota info for client portal
   ========================================================= */

exports.getClientQuotaStatus = systemHealth.createGetClientQuotaStatusHandler({
    db,
    getClientUserProfile,
    getTenantSettingsData,
});

/* =========================================================
   PDF Generation — Server-side rendering with Puppeteer
   ========================================================= */

const { renderHtmlToPdfBuffer } = require('./helpers/pdfRenderer');
const { injectPdfExportCss } = require('./helpers/pdfHtml');

exports.generateClientCasePdf = pdfGeneration.createGenerateClientCasePdfHandler({
    db,
    getClientUserProfile,
    assertClientManager,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    prepareCanonicalReport,
    renderHtmlToPdfBuffer,
    injectPdfExportCss,
    hasPublicReportMinimumContent,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    getClientIp,
});

exports.generatePublicReportPdf = pdfGeneration.createGeneratePublicReportPdfHandler({
    db,
    renderHtmlToPdfBuffer,
    injectPdfExportCss,
    resolvePublicReportStatus,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    getClientIp,
});

/* =========================================================
   NOTIFICATIONS — Callable functions for frontend
   ========================================================= */

exports.markNotificationAsRead = notificationService.createMarkNotificationAsReadHandler({ db });
exports.markAllNotificationsAsRead = notificationService.createMarkAllNotificationsAsReadHandler({ db });
exports.getClientGeoIp = notificationService.createGetClientGeoIpHandler();
exports.sendCaseMessage = notificationService.createSendCaseMessageHandler({
    db,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    getClientIp,
});
exports.markCaseCommunicationRead = notificationService.createMarkCaseCommunicationReadHandler({ db });

/* =========================================================
   BACKUP DIARIO — Firestore export + Auth users
   Agenda: 02:00 BRT, retencao 7 dias via lifecycle GCS
   ========================================================= */

const backupWorker = require('./modules/backupWorker');
exports.backupDaily = backupWorker.createBackupWorkerHandler();
