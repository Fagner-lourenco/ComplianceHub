'use strict';

const V2_TIMELINE_VERSION = 'v2-timeline-2026-04-21';

const EXECUTED_STATUSES = new Set([
    'completed_no_findings', 'completed_with_findings', 'skipped_reuse', 'skipped_policy',
]);

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function safeId(value, max = 80) {
    return String(value || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, max);
}

function buildModuleRunEvent({ caseId, tenantId, moduleRun }) {
    if (!moduleRun?.moduleKey || !EXECUTED_STATUSES.has(moduleRun.status)) return null;
    return {
        id: `tl_mr_${safeId(caseId)}_${safeId(moduleRun.moduleKey)}`,
        caseId,
        tenantId,
        eventType: 'module_run_completed',
        moduleKey: moduleRun.moduleKey,
        severity: null,
        summary: `Modulo ${moduleRun.moduleKey}: ${moduleRun.status}`,
        status: moduleRun.status,
        linkedIds: {
            evidenceIds: asArray(moduleRun.evidenceIds),
            riskSignalIds: asArray(moduleRun.riskSignalIds),
        },
        version: V2_TIMELINE_VERSION,
    };
}

function buildEvidenceBatchEvent({ caseId, tenantId, moduleKey, evidenceItems }) {
    const items = asArray(evidenceItems);
    if (!items.length) return null;
    const ids = items.map((e) => e.id).filter(Boolean);
    return {
        id: `tl_ev_${safeId(caseId)}_${safeId(moduleKey)}`,
        caseId,
        tenantId,
        eventType: 'evidence_created',
        moduleKey,
        severity: null,
        summary: `${ids.length} evidencia(s) registrada(s) em ${moduleKey}`,
        linkedIds: { evidenceIds: ids },
        version: V2_TIMELINE_VERSION,
    };
}

function buildRiskSignalEvent({ caseId, tenantId, riskSignal }) {
    if (!riskSignal?.id) return null;
    // Only create timeline events for high/critical signals
    if (!['critical', 'high'].includes(riskSignal.severity)) return null;
    return {
        id: `tl_rs_${safeId(caseId)}_${safeId(riskSignal.id, 48)}`,
        caseId,
        tenantId,
        eventType: 'risk_signal_raised',
        moduleKey: riskSignal.moduleKey || null,
        severity: riskSignal.severity,
        summary: riskSignal.reason || `Sinal de risco: ${riskSignal.kind}`,
        linkedIds: {
            riskSignalId: riskSignal.id,
            evidenceIds: asArray(riskSignal.supportingEvidenceIds),
        },
        version: V2_TIMELINE_VERSION,
    };
}

function buildDecisionEvent({ caseId, tenantId, decision }) {
    if (!decision?.id) return null;
    return {
        id: `tl_dec_${safeId(caseId)}`,
        caseId,
        tenantId,
        eventType: 'decision_made',
        moduleKey: 'decision',
        severity: null,
        summary: `Decisao: ${decision.verdict || 'PENDING'}`,
        linkedIds: { decisionId: decision.id },
        version: V2_TIMELINE_VERSION,
    };
}

function buildReportEvent({ caseId, tenantId, reportSnapshot }) {
    if (!reportSnapshot?.id) return null;
    return {
        id: `tl_rep_${safeId(caseId)}`,
        caseId,
        tenantId,
        eventType: 'report_generated',
        moduleKey: 'report_secure',
        severity: null,
        summary: `Relatorio gerado (${reportSnapshot.status || 'unknown'})`,
        linkedIds: { reportSnapshotId: reportSnapshot.id },
        version: V2_TIMELINE_VERSION,
    };
}

function buildTimelineEventsForCase({
    caseId,
    tenantId = null,
    moduleRuns = [],
    evidenceItems = [],
    riskSignals = [],
    decision = null,
    reportSnapshot = null,
} = {}) {
    if (!caseId) return [];

    const events = [];

    // Module run completion events
    for (const moduleRun of asArray(moduleRuns)) {
        const event = buildModuleRunEvent({ caseId, tenantId, moduleRun });
        if (event) events.push(event);
    }

    // Evidence batch events grouped per module
    const evidenceByModule = {};
    for (const item of asArray(evidenceItems)) {
        if (!item.moduleKey) continue;
        if (!evidenceByModule[item.moduleKey]) evidenceByModule[item.moduleKey] = [];
        evidenceByModule[item.moduleKey].push(item);
    }
    for (const [moduleKey, items] of Object.entries(evidenceByModule)) {
        const event = buildEvidenceBatchEvent({ caseId, tenantId, moduleKey, evidenceItems: items });
        if (event) events.push(event);
    }

    // High/critical risk signal events (sorted by severity first)
    const sortedSignals = [...asArray(riskSignals)].sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4),
    );
    for (const signal of sortedSignals) {
        const event = buildRiskSignalEvent({ caseId, tenantId, riskSignal: signal });
        if (event) events.push(event);
    }

    // Decision event
    if (decision) {
        const event = buildDecisionEvent({ caseId, tenantId, decision });
        if (event) events.push(event);
    }

    // Report event
    if (reportSnapshot) {
        const event = buildReportEvent({ caseId, tenantId, reportSnapshot });
        if (event) events.push(event);
    }

    // Deduplicate by stable id (idempotent)
    const seen = new Set();
    return events.filter((e) => {
        if (!e.id || seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
    });
}

// Detect provider divergences from evidence/signals
function buildProviderDivergencesForCase({
    caseId,
    tenantId = null,
    evidenceItems = [],
    riskSignals = [],
} = {}) {
    if (!caseId) return [];

    const divergences = [];
    const seen = new Set();

    // Materialise divergences from riskSignals with kind=provider_divergence
    const divergenceSignals = asArray(riskSignals).filter(
        (s) => s.kind === 'provider_divergence'
            || (s.reason && s.reason.toLowerCase().includes('divergen')),
    );

    for (const signal of divergenceSignals) {
        const divId = `div_rs_${safeId(caseId)}_${safeId(signal.id || signal.kind, 48)}`;
        if (seen.has(divId)) continue;
        seen.add(divId);
        divergences.push({
            id: divId,
            caseId,
            tenantId,
            moduleKey: signal.moduleKey || null,
            severity: signal.severity || 'medium',
            status: 'open',
            reason: signal.reason || 'Divergencia detectada entre fontes',
            conflictingEvidenceIds: asArray(signal.supportingEvidenceIds),
            riskSignalId: signal.id || null,
            blocksPublication: signal.severity === 'critical',
            version: V2_TIMELINE_VERSION,
        });
    }

    // Detect evidence-level divergences: same module, multiple providers, different counts
    const evidenceByModule = {};
    for (const item of asArray(evidenceItems)) {
        if (!item.moduleKey || !item.provider) continue;
        if (!evidenceByModule[item.moduleKey]) evidenceByModule[item.moduleKey] = {};
        if (!evidenceByModule[item.moduleKey][item.provider]) evidenceByModule[item.moduleKey][item.provider] = [];
        evidenceByModule[item.moduleKey][item.provider].push(item);
    }

    for (const [moduleKey, providerMap] of Object.entries(evidenceByModule)) {
        const providers = Object.keys(providerMap);
        if (providers.length < 2) continue;

        const counts = providers.map((p) => providerMap[p].length);
        const maxCount = Math.max(...counts);
        const minCount = Math.min(...counts);
        if (maxCount === 0 || maxCount === minCount) continue;

        const divId = `div_ev_${safeId(caseId)}_${safeId(moduleKey)}`;
        if (seen.has(divId)) continue;
        seen.add(divId);

        const allEvidenceIds = providers.flatMap((p) => providerMap[p].map((i) => i.id).filter(Boolean));
        divergences.push({
            id: divId,
            caseId,
            tenantId,
            moduleKey,
            severity: 'medium',
            status: 'open',
            reason: `Contagem divergente entre ${providers.join(' e ')} para ${moduleKey}`,
            conflictingEvidenceIds: allEvidenceIds,
            riskSignalId: null,
            blocksPublication: false,
            version: V2_TIMELINE_VERSION,
        });
    }

    return divergences;
}

module.exports = {
    V2_TIMELINE_VERSION,
    buildTimelineEventsForCase,
    buildProviderDivergencesForCase,
};
