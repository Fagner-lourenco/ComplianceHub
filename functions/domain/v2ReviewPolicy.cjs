'use strict';

const V2_REVIEW_POLICY_VERSION = 'v2-review-policy-2026-04-21';

// Maps MODULE_REGISTRY reviewPolicy values to minimum required human-review level
const POLICY_LEVEL_ORDER = [
    'none',
    'operational_review',
    'analytical_review',
    'analytical_review_on_positive',
    'senior_approval_on_positive',
    'senior_approval_candidate',
    'senior_approval',
    'human_review_required',
];

const SEVERITY_TRIGGERS_SENIOR = new Set(['critical']);
const SEVERITY_TRIGGERS_ANALYTICAL = new Set(['high']);

// Positive-outcome statuses that escalate reviewPolicy to its max level
const POSITIVE_STATUSES = new Set(['completed_with_findings']);

const SENIOR_REQUIRED_REVIEW_POLICIES = new Set([
    'senior_approval',
    'senior_approval_candidate',
    'human_review_required',
]);

const SENIOR_ON_POSITIVE_POLICIES = new Set([
    'senior_approval_on_positive',
]);

function comparePolicyLevel(a, b) {
    const ai = POLICY_LEVEL_ORDER.indexOf(a);
    const bi = POLICY_LEVEL_ORDER.indexOf(b);
    return (bi === -1 ? 0 : bi) - (ai === -1 ? 0 : ai);
}

function maxPolicyLevel(levels) {
    return levels.reduce((acc, lvl) => {
        if (!lvl) return acc;
        return POLICY_LEVEL_ORDER.indexOf(lvl) > POLICY_LEVEL_ORDER.indexOf(acc) ? lvl : acc;
    }, 'none');
}

function resolveModuleReviewLevel(moduleRun, moduleContract = null) {
    if (!moduleRun) return 'none';
    const policy = moduleContract?.reviewPolicy || moduleRun.reviewPolicy || 'operational_review';
    const status = moduleRun.status || 'pending';
    const isPositive = POSITIVE_STATUSES.has(status);

    if (SENIOR_REQUIRED_REVIEW_POLICIES.has(policy)) return 'senior_approval';
    if (SENIOR_ON_POSITIVE_POLICIES.has(policy) && isPositive) return 'senior_approval';
    if (policy === 'analytical_review_on_positive' && isPositive) return 'analytical_review';
    if (['analytical_review', 'analytical_review_on_positive'].includes(policy)) return 'analytical_review';
    if (policy === 'operational_review') return 'operational_review';
    return 'none';
}

function resolveSignalReviewLevel(riskSignals = []) {
    for (const signal of riskSignals) {
        if (SEVERITY_TRIGGERS_SENIOR.has(signal.severity)) return 'senior_approval';
    }
    for (const signal of riskSignals) {
        if (SEVERITY_TRIGGERS_ANALYTICAL.has(signal.severity)) return 'analytical_review';
    }
    return 'none';
}

/**
 * Resolves the minimum required review level for a case.
 * Returns: { reviewLevel, requiresSenior, reasons, policyVersion }
 */
function resolveReviewPolicyForCase({ moduleRuns = [], riskSignals = [], caseData = {}, moduleRegistry = null } = {}) {
    const reasons = [];
    const levels = [];

    // Module-driven review requirements
    for (const moduleRun of moduleRuns) {
        const contract = moduleRegistry?.[moduleRun.moduleKey] || null;
        const level = resolveModuleReviewLevel(moduleRun, contract);
        if (level !== 'none') {
            levels.push(level);
            if (level === 'senior_approval') {
                reasons.push(`Modulo ${moduleRun.moduleKey} requer aprovacao senior (policy: ${contract?.reviewPolicy || moduleRun.reviewPolicy || 'unknown'}, status: ${moduleRun.status})`);
            }
        }
    }

    // Signal-driven review requirements
    const signalLevel = resolveSignalReviewLevel(riskSignals);
    if (signalLevel !== 'none') {
        levels.push(signalLevel);
        const criticals = riskSignals.filter((s) => s.severity === 'critical');
        const highs = riskSignals.filter((s) => s.severity === 'high');
        if (criticals.length > 0) {
            reasons.push(`${criticals.length} sinal(is) critico(s) requer(em) aprovacao senior`);
        } else if (highs.length > 0) {
            reasons.push(`${highs.length} sinal(is) de alta severidade requer(em) revisao analitica`);
        }
    }

    // Legacy verdict-based escalation
    const verdict = caseData.finalVerdict || caseData.verdict;
    if (['NOT_RECOMMENDED', 'REJECTED'].includes(verdict)) {
        levels.push('senior_approval');
        reasons.push(`Veredito negativo (${verdict}) requer aprovacao senior`);
    }

    const reviewLevel = maxPolicyLevel(levels.length > 0 ? levels : ['operational_review']);
    const requiresSenior = POLICY_LEVEL_ORDER.indexOf(reviewLevel) >= POLICY_LEVEL_ORDER.indexOf('senior_approval');

    return {
        reviewLevel,
        requiresSenior,
        reasons,
        policyVersion: V2_REVIEW_POLICY_VERSION,
    };
}

/**
 * Returns true if the case requires senior approval before publication.
 */
function requiresSeniorApproval({ moduleRuns = [], riskSignals = [], caseData = {}, moduleRegistry = null } = {}) {
    const { requiresSenior } = resolveReviewPolicyForCase({ moduleRuns, riskSignals, caseData, moduleRegistry });
    return requiresSenior;
}

module.exports = {
    V2_REVIEW_POLICY_VERSION,
    resolveReviewPolicyForCase,
    requiresSeniorApproval,
    resolveModuleReviewLevel,
    resolveSignalReviewLevel,
    maxPolicyLevel,
};
