/**
 * publishAndSync.js — Sincronização entre cases e clientCases, e publicação de resultados
 * Extraído do monolito index.js durante refatoração Phase C
 */

const { FieldValue } = require('firebase-admin/firestore');
const { asDate, sanitizePublicStructuredValue, stripUndefined, sanitizeStructuredText, sanitizeStructuredList, hasMeaningfulValue } = require('../helpers/normalize');
const { formatDateKey, formatMonthKey } = require('./utilityHelpers');
const { RESULT_ONLY_FIELDS, ALLOWED_DRAFT_FIELDS, REVIEW_DRAFT_ARRAY_FIELDS } = require('./_shared/fieldConstants');
const { DEFAULT_ANALYSIS_CONFIG } = require('./_shared/analysisConfig');

const IDENTITY_FIELDS = [
    'candidateName',
    'candidateId',
    'tenantId',
    'tenantName',
    'status',
    'priority',
    'createdAt',
    'updatedAt',
    'concludedAt',
    'correctedAt',
    'analystAssigned',
    'analystName',
    'cpf',
    'cpfMasked',
    'birthDate',
    'motherName',
    'bigdatacorpAge',
    'bigdatacorpGender',
    'bigdatacorpMotherName',
    'bigdatacorpHasDeathRecord',
    'requestedBy',
    'requestedByName',
    'requestedByEmail',
];

const CLIENT_SAFE_PUBLICATION_FIELDS = [
    'statusSummary',
    'sourceSummary',
    'nextSteps',
    'timelineEvents',
    'socialProfiles',
    'reportReady',
    'reportSlug',
    'concludedAt',
    'turnaroundHours',
];

const PUBLIC_RESULT_FIELDS = [...IDENTITY_FIELDS, ...RESULT_ONLY_FIELDS, ...CLIENT_SAFE_PUBLICATION_FIELDS];

const CLIENT_CASE_PRIVATE_FIELDS = [
    'cpf',
];

const CLIENT_CASE_FIELDS = [
    ...PUBLIC_RESULT_FIELDS,
    ...CLIENT_CASE_PRIVATE_FIELDS,
    'candidateId',
    'tenantName',
    'status',
    'priority',
    'createdDateKey',
    'createdMonthKey',
    'concludedAt',
    'updatedAt',
    'correctedAt',
    'statusSummary',
    'sourceSummary',
    'nextSteps',
    'clientNotes',
    'hasNotes',
    'hasEvidence',
];

function sanitizeCpf(cpf) {
    return String(cpf || '').replace(/\D/g, '').slice(0, 11);
}

function buildClientCasePayload(caseId, caseData) {
    const payload = { caseId };

    const isConcluded = caseData.status === 'DONE';
    const fieldsToSync = isConcluded ? CLIENT_CASE_FIELDS : CLIENT_CASE_FIELDS.filter((f) => !RESULT_ONLY_FIELDS.includes(f));

    for (const field of fieldsToSync) {
        const value = caseData[field];
        if (value !== undefined && value !== null) {
            payload[field] = field === 'cpf'
                ? sanitizeCpf(value)
                : sanitizePublicStructuredValue(value);
        }
    }

    const createdAtDate = asDate(caseData.createdAt);
    if (!payload.createdDateKey && createdAtDate) payload.createdDateKey = formatDateKey(createdAtDate);
    if (!payload.createdMonthKey && createdAtDate) payload.createdMonthKey = formatMonthKey(createdAtDate);
    if (payload.reportReady === undefined) payload.reportReady = caseData.status === 'DONE' && caseData.reportReady !== false;
    if (payload.hasNotes === undefined) payload.hasNotes = Boolean(caseData.analystComment || caseData.executiveSummary || caseData.clientNotes);
    if (payload.hasEvidence === undefined) {
        payload.hasEvidence = Boolean(
            (Array.isArray(caseData.keyFindings) && caseData.keyFindings.length > 0)
            || (Array.isArray(caseData.timelineEvents) && caseData.timelineEvents.some((event) => event.status === 'risk'))
        );
    }

    if (caseData.communicationStatus !== undefined) payload.communicationStatus = caseData.communicationStatus;
    if (caseData.lastMessageAt !== undefined) payload.lastMessageAt = caseData.lastMessageAt;
    if (caseData.lastMessagePreview !== undefined) payload.lastMessagePreview = caseData.lastMessagePreview;
    if (caseData.lastMessageByPortal !== undefined) payload.lastMessageByPortal = caseData.lastMessageByPortal;
    if (caseData.clientUnreadMessages !== undefined) payload.clientUnreadMessages = caseData.clientUnreadMessages;

    return payload;
}

function clientPayloadChanged(payload, existing) {
    const ignoreKeys = new Set([
        'updatedAt', 'createdAt', 'concludedAt', 'correctedAt',
        'djenEnrichedAt', 'autoClassifiedAt', 'enrichedAt',
    ]);

    const allKeys = new Set([
        ...Object.keys(payload),
        ...Object.keys(existing),
    ]);
    const keysToCompare = [...allKeys].filter((k) => !ignoreKeys.has(k));

    for (const key of keysToCompare) {
        const a = payload[key];
        const b = existing[key];

        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return true;
            for (let i = 0; i < a.length; i++) {
                if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return true;
            }
            continue;
        }

        if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
            if (JSON.stringify(a) !== JSON.stringify(b)) return true;
            continue;
        }

        if (a !== b) return true;
    }

    return false;
}

async function writeClientCaseMirror({ db, caseId, caseData }) {
    const payload = buildClientCasePayload(caseId, caseData);
    const existingRef = db.collection('clientCases').doc(caseId);
    const existingSnap = await existingRef.get();
    if (existingSnap.exists) {
        const existing = existingSnap.data() || {};
        if (!clientPayloadChanged(payload, existing)) {
            console.log(`[clientCases] case ${caseId}: no visible change, skipping mirror write.`);
            return;
        }
    }
    await db.collection('clientCases').doc(caseId).set(payload);
}

const AUTO_CLASSIFY_FIELDS = new Set([
    'autoClassifySignature', 'autoClassifiedAt', 'autoClassifyLock',
    'autoClassifyRerunRequested', 'criminalFlag', 'warrantFlag', 'laborFlag',
    'riskScore', 'riskLevel', 'suggestedVerdict', 'finalVerdict',
    'negativePartialSafetyNetEligible', 'negativePartialSafetyNetReasons',
    'negativePartialSafetyNetAction', 'negativePartialSafetyNetTriggered',
    'prefillNarratives', 'deterministicPrefill', 'aiHomonymTriggered',
    'aiHomonymDecision', 'aiHomonymConfidence', 'aiHomonymRisk',
    'aiHomonymRecommendedAction', 'aiClassificationReview',
    'aiClassificationReviewOk', 'aiProvidersIncluded', 'aiStatus', 'aiError',
    'aiCostUsd', 'aiHomonymCostUsd', 'aiClassificationReviewCostUsd',
    'executiveSummary', 'keyFindings', 'clientNotes',
]);

function isAutoClassifyOnlyChange(before, after) {
    const beforeKeys = Object.keys(before);
    const afterKeys = Object.keys(after);
    const allKeys = new Set([...beforeKeys, ...afterKeys]);

    for (const key of allKeys) {
        if (before[key] !== after[key]) {
            if (!AUTO_CLASSIFY_FIELDS.has(key)) {
                return false;
            }
        }
    }

    return true;
}

function shouldSkipClientCaseMirrorSync(before, after) {
    return after?.status !== 'DONE' && isAutoClassifyOnlyChange(before, after);
}

async function syncClientCaseOnCreateLogic({ db, caseId, caseData }) {
    await writeClientCaseMirror({ db, caseId, caseData });
}

async function syncClientCaseOnUpdateLogic({ db, caseId, before, after }) {
    if (shouldSkipClientCaseMirrorSync(before, after)) return;
    await writeClientCaseMirror({ db, caseId, caseData: after });
}

async function syncClientCaseOnDeleteLogic({ db, caseId }) {
    await db.collection('clientCases').doc(caseId).delete().catch(() => {});
}

async function publishResultOnCaseDoneLogic({
    db,
    caseId,
    before,
    after,
    hasPublicReportMinimumContent,
    syncPublicResultLatest,
    revokeCasePublicationArtifacts,
}) {
    if (!before || !after) return;

    if (after.status === 'DONE') {
        if (!hasPublicReportMinimumContent(after)) {
            console.warn(`Case ${caseId}: status DONE but minimum content not met, skipping publicResult.`);
            return;
        }
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
        });
        console.log(`Case ${caseId}: publicResult/latest published with ${Object.keys(publicData).length} fields.`);
        return;
    }

    if (before.status === 'DONE') {
        await revokeCasePublicationArtifacts(caseId, before, db);
        console.log(`Case ${caseId}: public publication artifacts revoked after leaving DONE.`);
    }
}

/* =========================================================
   Publication Artifacts Helpers
   ========================================================= */

function normalizeKeyFindingsValue(value) {
    if (Array.isArray(value)) {
        return sanitizeStructuredList(value, 8, 220);
    }
    if (typeof value === 'string') {
        return sanitizeStructuredList(
            value.split(/\r?\n|;/).map((item) => item.trim()),
            8,
            220,
        );
    }
    return [];
}

function normalizeNarrativeValue(field, value) {
    if (value === undefined) return undefined;
    if (field === 'enabledPhases') {
        const allowed = new Set(Object.keys(DEFAULT_ANALYSIS_CONFIG));
        return Array.isArray(value) ? value.filter((item) => allowed.has(item)) : [];
    }
    if (field === 'keyFindings') return normalizeKeyFindingsValue(value);
    if (REVIEW_DRAFT_ARRAY_FIELDS.has(field)) return Array.isArray(value) ? value.filter(Boolean) : [];
    if (typeof value === 'string') {
        const maxLength = field === 'executiveSummary' ? 900 : field === 'analystComment' ? 900 : 1400;
        return sanitizeStructuredText(value, maxLength);
    }
    return value;
}

function buildReviewDraftSeed(caseData) {
    const reviewDraft = { ...(caseData.reviewDraft || {}) };
    for (const field of ALLOWED_DRAFT_FIELDS) {
        const value = caseData[field];
        if (!hasMeaningfulValue(value)) continue;
        reviewDraft[field] = normalizeNarrativeValue(field, value);
    }
    reviewDraft.__source = 'auto-seed';
    return stripUndefined(reviewDraft);
}

function buildResetPublishedCaseFields(caseData, options = {}) {
    const {
        preserveReviewDraft = false,
        resetReportReady = true,
    } = options;
    const resetFields = {
        publicReportToken: FieldValue.delete(),
        reportSlug: FieldValue.delete(),
        concludedAt: FieldValue.delete(),
        turnaroundHours: FieldValue.delete(),
        keyFindings: FieldValue.delete(),
        executiveSummary: FieldValue.delete(),
        analystComment: FieldValue.delete(),
        statusSummary: FieldValue.delete(),
        sourceSummary: FieldValue.delete(),
        nextSteps: FieldValue.delete(),
        hasNotes: FieldValue.delete(),
        hasEvidence: FieldValue.delete(),
    };

    if (resetReportReady) {
        resetFields.reportReady = false;
    }

    for (const field of RESULT_ONLY_FIELDS) {
        if (field === 'enabledPhases') continue;
        resetFields[field] = FieldValue.delete();
    }

    if (preserveReviewDraft) {
        const reviewDraft = buildReviewDraftSeed(caseData);
        if (Object.keys(reviewDraft).length > 0) {
            resetFields.reviewDraft = reviewDraft;
        }
    }

    return resetFields;
}

async function revokeCasePublicationArtifacts(caseId, caseData, db) {
    if (caseData?.publicReportToken) {
        const reportRef = db.collection('publicReports').doc(caseData.publicReportToken);
        const reportSnap = await reportRef.get();
        if (reportSnap.exists) {
            await reportRef.update({ active: false });
        }
        // P2-018: Clear publicReportToken from case to prevent stale references
        await db.collection('cases').doc(caseId).update({
            publicReportToken: FieldValue.delete(),
        });
    }

    const publicResultRef = db.collection('cases').doc(caseId).collection('publicResult').doc('latest');
    const publicResultSnap = await publicResultRef.get();
    if (publicResultSnap.exists) {
        await publicResultRef.delete();
    }
}

module.exports = {
    // Lógica pura (testável)
    buildClientCasePayload,
    clientPayloadChanged,
    writeClientCaseMirror,
    isAutoClassifyOnlyChange,
    shouldSkipClientCaseMirrorSync,
    syncClientCaseOnCreateLogic,
    syncClientCaseOnUpdateLogic,
    syncClientCaseOnDeleteLogic,
    publishResultOnCaseDoneLogic,
    // Publication Artifacts
    buildReviewDraftSeed,
    buildResetPublishedCaseFields,
    revokeCasePublicationArtifacts,
};
