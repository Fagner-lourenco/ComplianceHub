'use strict';

const V2_SENIOR_REVIEW_QUEUE_VERSION = 'v2-senior-review-queue-2026-04-22';

const ACTIVE_SENIOR_REVIEW_STATUSES = new Set(['pending']);
const FINAL_SENIOR_REVIEW_STATUSES = new Set(['approved', 'rejected', 'cancelled']);

function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function uniq(values = []) {
    return [...new Set(values.filter(Boolean))];
}

function buildSeniorReviewRequestId(caseId) {
    if (!caseId) return null;
    return `senior_${caseId}`;
}

function normalizeReason(reason) {
    if (!reason) return null;
    if (typeof reason === 'string') return reason;
    if (reason.reason) return String(reason.reason);
    if (reason.moduleKey) return `${reason.moduleKey}: ${reason.reviewLevel || reason.policy || 'senior_review'}`;
    return null;
}

function buildSeniorReviewRequest({
    caseId,
    caseData = {},
    policyResult = {},
    riskSignals = [],
    moduleRuns = [],
    actor = {},
    requestedAt = new Date().toISOString(),
} = {}) {
    const requestId = buildSeniorReviewRequestId(caseId);
    if (!requestId) return null;

    const reasons = uniq([
        ...(asArray(policyResult.reasons).map(normalizeReason)),
        ...(asArray(policyResult.moduleReasons).map(normalizeReason)),
        ...(asArray(riskSignals)
            .filter((signal) => ['critical', 'high'].includes(signal?.severity))
            .map((signal) => signal.reason || signal.signalKey || signal.moduleKey)),
    ]).filter(Boolean);

    return {
        id: requestId,
        tenantId: caseData.tenantId || null,
        caseId,
        subjectId: caseData.subjectId || null,
        candidateName: caseData.candidateName || caseData.fullName || null,
        productKey: caseData.productKey || null,
        reviewLevel: policyResult.reviewLevel || 'senior_approval',
        requiresSenior: true,
        reasons,
        riskSignalIds: uniq(asArray(riskSignals).map((signal) => signal.id || signal.signalId)),
        moduleKeys: uniq(asArray(moduleRuns).map((run) => run.moduleKey)),
        status: 'pending',
        requestedBy: actor.uid || actor.id || null,
        requestedByEmail: actor.email || null,
        requestedAt,
        updatedAt: requestedAt,
        version: V2_SENIOR_REVIEW_QUEUE_VERSION,
    };
}

function isSeniorReviewApproved(requestDoc) {
    return requestDoc?.status === 'approved';
}

function isSeniorReviewActive(requestDoc) {
    return ACTIVE_SENIOR_REVIEW_STATUSES.has(requestDoc?.status);
}

function resolveSeniorReviewDecision(requestDoc) {
    if (!requestDoc) {
        return { status: 'missing', approved: false, active: false, final: false };
    }
    return {
        status: requestDoc.status || 'unknown',
        approved: isSeniorReviewApproved(requestDoc),
        active: isSeniorReviewActive(requestDoc),
        final: FINAL_SENIOR_REVIEW_STATUSES.has(requestDoc.status),
        resolvedBy: requestDoc.resolvedBy || null,
        resolvedAt: requestDoc.resolvedAt || null,
        resolution: requestDoc.resolution || null,
    };
}

function summarizeSeniorReviewQueue(requests = []) {
    const items = asArray(requests);
    const byStatus = items.reduce((acc, item) => {
        const status = item?.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    return {
        total: items.length,
        pending: byStatus.pending || 0,
        approved: byStatus.approved || 0,
        rejected: byStatus.rejected || 0,
        byStatus,
    };
}

module.exports = {
    V2_SENIOR_REVIEW_QUEUE_VERSION,
    buildSeniorReviewRequestId,
    buildSeniorReviewRequest,
    isSeniorReviewApproved,
    isSeniorReviewActive,
    resolveSeniorReviewDecision,
    summarizeSeniorReviewQueue,
};
