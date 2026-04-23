'use strict';

const crypto = require('crypto');

const V2_REPORT_SECTIONS_VERSION = 'v2-report-sections-2026-04-21';

const INTERNAL_MODULE_KEYS = new Set(['decision', 'report_secure']);

const CLIENT_VISIBLE_MODULES = new Set([
    'identity_pf', 'identity_pj', 'criminal', 'labor', 'warrants',
    'judicial', 'kyc', 'osint', 'social', 'digital', 'conflictInterest',
    'ongoing_monitoring',
]);

const EXECUTED_STATUSES = new Set([
    'completed_no_findings',
    'completed_with_findings',
    'skipped_reuse',
    'skipped_policy',
]);

const SECTION_ORDER = [
    'identity', 'executiveSummary', 'criminal', 'labor', 'warrants',
    'judicial', 'kyc', 'osint', 'social', 'digital', 'conflictInterest',
    'ongoing_monitoring', 'riskOverview', 'analystConclusion', 'nextSteps',
];

const MODULE_SECTION_LABELS = {
    identity_pf: 'Identificacao',
    identity_pj: 'Identificacao PJ',
    criminal: 'Analise criminal',
    labor: 'Analise trabalhista',
    warrants: 'Mandados e alertas',
    judicial: 'Analise judicial',
    kyc: 'KYC, PEP e sancoes',
    osint: 'Risco reputacional',
    social: 'Redes sociais',
    digital: 'Perfil digital',
    conflictInterest: 'Conflito de interesse',
    ongoing_monitoring: 'Monitoramento continuo',
    decision: 'Decisao de risco',
    report_secure: 'Relatorio seguro',
};

function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function stableHash(obj) {
    const str = JSON.stringify(obj, Object.keys(obj || {}).sort());
    return crypto.createHash('sha256').update(str).digest('hex');
}

// V2-authoritative: modules executed with status in EXECUTED_STATUSES
function getExecutedModuleKeys(moduleRuns = []) {
    return asArray(moduleRuns)
        .filter((run) => EXECUTED_STATUSES.has(run.status))
        .map((run) => run.moduleKey)
        .filter(Boolean);
}

// Modules that have at least one evidenceItem or riskSignal
function getModulesWithEvidence(evidenceItems = [], riskSignals = []) {
    const keys = new Set();
    for (const item of asArray(evidenceItems)) {
        if (item.moduleKey) keys.add(item.moduleKey);
    }
    for (const signal of asArray(riskSignals)) {
        if (signal.moduleKey) keys.add(signal.moduleKey);
    }
    return keys;
}

// Determine reportModuleKeys from V2 sources — explicit semantics
function resolveReportModuleKeys({ moduleRuns = [], evidenceItems = [], riskSignals = [] } = {}) {
    const executedKeys = new Set(getExecutedModuleKeys(moduleRuns));
    const withEvidenceKeys = getModulesWithEvidence(evidenceItems, riskSignals);

    // Internal capabilities that appear in moduleRuns are always included
    const internalKeys = asArray(moduleRuns)
        .filter((run) => INTERNAL_MODULE_KEYS.has(run.moduleKey))
        .map((run) => run.moduleKey);

    // Client-visible: executed AND has evidence/signals
    const contributingKeys = [...executedKeys].filter(
        (key) => CLIENT_VISIBLE_MODULES.has(key) && withEvidenceKeys.has(key),
    );

    // Executed but no evidence — record but don't include in report
    const executedNoEvidenceKeys = [...executedKeys].filter(
        (key) => CLIENT_VISIBLE_MODULES.has(key) && !withEvidenceKeys.has(key),
    );

    // Requested (any status) but not executed
    const requestedButNotExecutedKeys = asArray(moduleRuns)
        .filter((run) => run.requested && !EXECUTED_STATUSES.has(run.status))
        .map((run) => run.moduleKey)
        .filter(Boolean);

    const reportModuleKeys = [...new Set([...contributingKeys, ...internalKeys])];

    return { reportModuleKeys, executedNoEvidenceKeys, requestedButNotExecutedKeys };
}

// Build per-module contribution map: moduleKey → { evidenceIds, signalIds }
function buildSectionContributions(evidenceItems = [], riskSignals = [], reportModuleKeys = []) {
    const reportModuleSet = new Set(reportModuleKeys);
    const contributions = {};

    for (const item of asArray(evidenceItems)) {
        if (!item.moduleKey || !reportModuleSet.has(item.moduleKey)) continue;
        if (!contributions[item.moduleKey]) contributions[item.moduleKey] = { evidenceIds: [], signalIds: [] };
        if (item.id) contributions[item.moduleKey].evidenceIds.push(item.id);
    }

    for (const signal of asArray(riskSignals)) {
        if (!signal.moduleKey || !reportModuleSet.has(signal.moduleKey)) continue;
        if (!contributions[signal.moduleKey]) contributions[signal.moduleKey] = { evidenceIds: [], signalIds: [] };
        if (signal.id) contributions[signal.moduleKey].signalIds.push(signal.id);
    }

    return contributions;
}

// Build sections from V2 collections, not form flags
function buildSectionsFromV2({
    moduleRuns = [],
    evidenceItems = [],
    riskSignals = [],
    subject = null,
    decision = null,
    reportModuleKeys = [],
} = {}) {
    const reportModuleSet = new Set(reportModuleKeys);
    const evidenceByModule = {};
    const signalsByModule = {};

    for (const item of asArray(evidenceItems)) {
        if (!item.moduleKey) continue;
        if (!evidenceByModule[item.moduleKey]) evidenceByModule[item.moduleKey] = [];
        evidenceByModule[item.moduleKey].push(item);
    }
    for (const signal of asArray(riskSignals)) {
        if (!signal.moduleKey) continue;
        if (!signalsByModule[signal.moduleKey]) signalsByModule[signal.moduleKey] = [];
        signalsByModule[signal.moduleKey].push(signal);
    }

    const sections = [];

    // Identity section
    const identityKey = reportModuleSet.has('identity_pf') ? 'identity_pf'
        : reportModuleSet.has('identity_pj') ? 'identity_pj' : null;
    if (identityKey) {
        const identityContent = [];
        if (subject?.declaredName) identityContent.push({ field: 'name', value: subject.declaredName });
        if (subject?.primaryDocument) identityContent.push({ field: 'document', value: subject.primaryDocument });
        const identityEvidence = evidenceByModule[identityKey] || [];
        sections.push({
            sectionKey: 'identity',
            title: MODULE_SECTION_LABELS[identityKey],
            moduleKey: identityKey,
            content: identityContent.length > 0 ? identityContent : null,
            evidenceCount: identityEvidence.length,
            evidenceIds: identityEvidence.map((e) => e.id).filter(Boolean),
            signalCount: 0,
            signalIds: [],
        });
    }

    // Executive summary from decision
    if (decision?.summary) {
        sections.push({
            sectionKey: 'executiveSummary',
            title: 'Resumo executivo',
            moduleKey: 'decision',
            content: decision.summary,
            evidenceCount: 0,
            evidenceIds: [],
            signalCount: 0,
            signalIds: [],
        });
    }

    // Analytical per-module sections
    const analyticalModules = [
        'criminal', 'labor', 'warrants', 'judicial', 'kyc',
        'osint', 'social', 'digital', 'conflictInterest', 'ongoing_monitoring',
    ];
    for (const moduleKey of analyticalModules) {
        if (!reportModuleSet.has(moduleKey)) continue;
        const evidence = evidenceByModule[moduleKey] || [];
        const signals = signalsByModule[moduleKey] || [];
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const highestSeverity = signals.reduce((acc, s) => {
            return (severityOrder[s.severity] ?? 4) < (severityOrder[acc] ?? 4) ? s.severity : acc;
        }, null);

        sections.push({
            sectionKey: moduleKey,
            title: MODULE_SECTION_LABELS[moduleKey] || moduleKey,
            moduleKey,
            content: {
                evidenceCount: evidence.length,
                signalCount: signals.length,
                highestSeverity,
                signalReasons: signals.map((s) => s.reason).filter(Boolean),
            },
            evidenceCount: evidence.length,
            evidenceIds: evidence.map((e) => e.id).filter(Boolean),
            signalCount: signals.length,
            signalIds: signals.map((s) => s.id).filter(Boolean),
        });
    }

    // Risk overview — aggregated cross-module signals
    const reportSignals = asArray(riskSignals).filter((s) => reportModuleSet.has(s.moduleKey));
    if (reportSignals.length > 0) {
        sections.push({
            sectionKey: 'riskOverview',
            title: 'Sinais de risco agregados',
            moduleKey: 'decision',
            content: reportSignals.map((s) => ({
                kind: s.kind,
                severity: s.severity,
                scoreImpact: s.scoreImpact,
                reason: s.reason,
            })),
            evidenceCount: 0,
            evidenceIds: [],
            signalCount: reportSignals.length,
            signalIds: reportSignals.map((s) => s.id).filter(Boolean),
        });
    }

    // Analyst conclusion from decision reasons
    if (decision?.reasons?.length > 0) {
        sections.push({
            sectionKey: 'analystConclusion',
            title: 'Conclusao e fundamentacao',
            moduleKey: 'decision',
            content: decision.reasons,
            evidenceCount: 0,
            evidenceIds: [],
            signalCount: 0,
            signalIds: [],
        });
    }

    // Sort by canonical section order
    sections.sort((a, b) => {
        const ai = SECTION_ORDER.indexOf(a.sectionKey);
        const bi = SECTION_ORDER.indexOf(b.sectionKey);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });

    return sections;
}

// Central resolver — BLOCO J entry point
function resolveReportSections({
    caseId,
    productKey = 'dossier_pf_basic',
    moduleRuns = [],
    evidenceItems = [],
    riskSignals = [],
    subject = null,
    decision = null,
} = {}) {
    if (!caseId) throw new Error('v2ReportSections: caseId is required');

    const { reportModuleKeys, executedNoEvidenceKeys, requestedButNotExecutedKeys } = resolveReportModuleKeys({
        moduleRuns,
        evidenceItems,
        riskSignals,
    });

    const sections = buildSectionsFromV2({
        moduleRuns,
        evidenceItems,
        riskSignals,
        subject,
        decision,
        reportModuleKeys,
    });

    const sectionContributions = buildSectionContributions(evidenceItems, riskSignals, reportModuleKeys);

    const allEvidenceIds = [...new Set(asArray(evidenceItems).map((e) => e.id).filter(Boolean))];
    const allSignalIds = [...new Set(asArray(riskSignals).map((s) => s.id).filter(Boolean))];

    const evidenceSetHash = stableHash({
        reportModuleKeys: [...reportModuleKeys].sort(),
        evidenceIds: allEvidenceIds.sort(),
        signalIds: allSignalIds.sort(),
    });

    const contentHash = stableHash({
        caseId,
        productKey,
        reportModuleKeys: [...reportModuleKeys].sort(),
        sectionCount: sections.length,
        evidenceSetHash,
    });

    return {
        reportModuleKeys,
        executedNoEvidenceKeys,
        requestedButNotExecutedKeys,
        sections,
        sectionContributions,
        evidenceSetHash,
        contentHash,
        version: V2_REPORT_SECTIONS_VERSION,
    };
}

// Produces a ReportSnapshot-compatible payload from V2 sources
// Use instead of v2Core.buildReportSnapshotContract when V2 data is available
function buildReportSnapshotFromV2({
    caseId,
    tenantId = null,
    subjectId = null,
    productKey = 'dossier_pf_basic',
    moduleRuns = [],
    evidenceItems = [],
    riskSignals = [],
    subject = null,
    decision = null,
    html = '',
    builderVersion = '',
    createdBy = null,
} = {}) {
    if (!caseId) throw new Error('v2ReportSections: caseId is required');
    const resolved = resolveReportSections({
        caseId, productKey, moduleRuns, evidenceItems, riskSignals, subject, decision,
    });

    return {
        tenantId,
        caseId,
        subjectId,
        decisionId: decision?.id || decision?.decisionId || null,
        productKey,
        moduleKeys: resolved.reportModuleKeys,
        reportModuleKeys: resolved.reportModuleKeys,
        sections: resolved.sections,
        sectionContributions: resolved.sectionContributions,
        contentHash: resolved.contentHash,
        evidenceSetHash: resolved.evidenceSetHash,
        builderVersion,
        status: resolved.sections.length > 0 && (html || '').trim() ? 'ready' : 'failed',
        createdBy,
        version: V2_REPORT_SECTIONS_VERSION,
    };
}

module.exports = {
    V2_REPORT_SECTIONS_VERSION,
    resolveReportModuleKeys,
    buildSectionsFromV2,
    buildSectionContributions,
    resolveReportSections,
    buildReportSnapshotFromV2,
};
