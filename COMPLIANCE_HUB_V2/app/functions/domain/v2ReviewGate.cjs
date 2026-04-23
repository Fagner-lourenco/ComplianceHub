'use strict';

const {
    resolveReviewPolicyForCase,
} = require('./v2ReviewPolicy.cjs');
const {
    PERMISSIONS,
    ROLES,
    hasPermission,
    isOpsRole,
} = require('./v2Rbac.cjs');

const SENIOR_REVIEW_ROLES = new Set([
    ROLES.SENIOR_ANALYST,
    ROLES.SUPERVISOR,
    ROLES.ADMIN,
]);

function isSeniorReviewerRole(role) {
    return SENIOR_REVIEW_ROLES.has(role);
}

function buildPolicySummary(policyResult = {}) {
    return {
        reviewLevel: policyResult.reviewLevel || 'operational_review',
        requiresSenior: policyResult.requiresSenior === true,
        reasons: Array.isArray(policyResult.reasons) ? policyResult.reasons : [],
        policyVersion: policyResult.policyVersion || null,
    };
}

function resolveReviewGate({
    moduleRuns = [],
    riskSignals = [],
    caseData = {},
    moduleRegistry = null,
    actorRole = null,
} = {}) {
    const policyResult = resolveReviewPolicyForCase({
        moduleRuns,
        riskSignals,
        caseData,
        moduleRegistry,
    });
    const policySummary = buildPolicySummary(policyResult);

    if (!isOpsRole(actorRole)) {
        return {
            allowed: false,
            denialReasonCode: 'actor_not_ops',
            denialMessage: 'Apenas usuarios operacionais podem aprovar decisoes.',
            policyResult: policySummary,
            actorRole,
        };
    }

    if (!hasPermission(actorRole, PERMISSIONS.DECISION_APPROVE)) {
        return {
            allowed: false,
            denialReasonCode: 'missing_decision_approve',
            denialMessage: 'Perfil sem permissao para aprovar decisao.',
            policyResult: policySummary,
            actorRole,
        };
    }

    if (policySummary.requiresSenior && !isSeniorReviewerRole(actorRole)) {
        return {
            allowed: false,
            denialReasonCode: 'senior_approval_required',
            denialMessage: 'Este caso exige aprovacao senior antes da publicacao.',
            policyResult: policySummary,
            actorRole,
        };
    }

    return {
        allowed: true,
        denialReasonCode: null,
        denialMessage: null,
        policyResult: policySummary,
        actorRole,
    };
}

module.exports = {
    SENIOR_REVIEW_ROLES,
    isSeniorReviewerRole,
    resolveReviewGate,
};
