'use strict';

const SEVERITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };

function severityRank(sev) {
    return SEVERITY_ORDER[sev] ?? -1;
}

function signalKey(signal) {
    if (!signal) return null;
    const moduleKey = signal.moduleKey || 'unknown';
    const kind = signal.kind || 'generic';
    return `${moduleKey}::${kind}`;
}

function indexSignalsByKey(signals = []) {
    const index = new Map();
    for (const sig of signals) {
        const key = signalKey(sig);
        if (!key) continue;
        const existing = index.get(key);
        if (!existing || severityRank(sig.severity) > severityRank(existing.severity)) {
            index.set(key, sig);
        }
    }
    return index;
}

/**
 * Compare two riskSignal arrays (previous vs current) and return alert payloads
 * describing new or escalated findings.
 *
 * @param {Object} args
 * @param {Array} args.previousSignals
 * @param {Array} args.currentSignals
 * @param {Object} args.context - { tenantId, subjectId, caseId, watchlistId }
 * @returns {Array} alerts to persist
 */
function diffRiskSignals({ previousSignals = [], currentSignals = [], context = {} } = {}) {
    const { tenantId = null, subjectId = null, caseId = null, watchlistId = null } = context;
    const previousIndex = indexSignalsByKey(previousSignals);
    const currentIndex = indexSignalsByKey(currentSignals);
    const alerts = [];

    for (const [key, current] of currentIndex.entries()) {
        const previous = previousIndex.get(key);
        const currentRank = severityRank(current.severity);
        const previousRank = previous ? severityRank(previous.severity) : -1;

        let kind = null;
        if (!previous) {
            kind = 'watchlist_finding';
        } else if (currentRank > previousRank) {
            kind = 'watchlist_escalation';
        }

        if (!kind) continue;

        alerts.push({
            tenantId,
            subjectId,
            caseId,
            watchlistId,
            kind,
            severity: current.severity || 'medium',
            moduleKey: current.moduleKey || null,
            signalKind: current.kind || null,
            previousSeverity: previous ? previous.severity : null,
            message: buildAlertMessage({ kind, signal: current, previous }),
            state: 'unread',
            signalId: current.id || null,
            scoreImpact: current.scoreImpact ?? null,
        });
    }

    return alerts;
}

function buildAlertMessage({ kind, signal, previous }) {
    const reason = signal.reason || signal.kind || 'Sinal de risco identificado.';
    if (kind === 'watchlist_escalation' && previous) {
        return `Severidade elevada de ${previous.severity} para ${signal.severity}: ${reason}`;
    }
    return `Novo achado (${signal.severity}): ${reason}`;
}

module.exports = {
    diffRiskSignals,
    indexSignalsByKey,
    severityRank,
    signalKey,
};
