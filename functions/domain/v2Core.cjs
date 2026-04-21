const crypto = require('crypto');

const V2_CORE_VERSION = 'v2-core-2026-04-21';

const MODULE_LABELS = {
    identity_pf: 'Identificacao',
    identity_pj: 'Identificacao PJ',
    criminal: 'Analise criminal',
    labor: 'Analise trabalhista',
    warrants: 'Mandados/alertas',
    warrant: 'Mandados/alertas',
    osint: 'Risco reputacional',
    social: 'Redes sociais',
    digital: 'Perfil digital',
    conflictInterest: 'Conflito de interesse',
    report_secure: 'Relatorio seguro',
    decision: 'Decisao de risco',
};

const PRODUCT_LABELS = {
    dossier_pf_basic: 'Dossie PF Essencial',
    dossier_pf_full: 'Dossie PF Completo',
    dossier_pj: 'Dossie PJ',
    report_secure: 'Relatorio seguro',
};

function stripUndefined(value) {
    if (Array.isArray(value)) {
        return value.map(stripUndefined).filter((item) => item !== undefined);
    }

    if (value && typeof value === 'object' && !(value instanceof Date)) {
        return Object.fromEntries(
            Object.entries(value)
                .map(([key, item]) => [key, stripUndefined(item)])
                .filter(([, item]) => item !== undefined),
        );
    }

    return value === undefined ? undefined : value;
}

function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }

    return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
        .join(',')}}`;
}

function createHash(value) {
    return crypto
        .createHash('sha256')
        .update(stableStringify(stripUndefined(value)))
        .digest('hex');
}

function hasMeaningfulValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function normalizeModuleKey(moduleKey) {
    if (moduleKey === 'warrant') return 'warrants';
    if (moduleKey === 'conflict') return 'conflictInterest';
    return moduleKey;
}

function inferProductKey(caseData = {}) {
    return caseData.productKey || caseData.requestedProductKey || 'dossier_pf_basic';
}

function inferRequestedModuleKeys(caseData = {}) {
    const explicit = [
        ...asArray(caseData.requestedModuleKeys),
        ...asArray(caseData.effectiveModuleKeys),
        ...asArray(caseData.moduleKeys),
    ];
    const enabledPhases = asArray(caseData.enabledPhases);
    const fallback = enabledPhases.length > 0
        ? enabledPhases
        : ['identity_pf', 'criminal', 'labor', 'warrants'];

    return unique([...explicit, ...fallback].map(normalizeModuleKey));
}

function inferReportModuleKeys(caseData = {}, publicResult = {}) {
    const requested = inferRequestedModuleKeys(caseData);
    const withContent = [];

    if (hasMeaningfulValue(publicResult.criminalFlag) || hasMeaningfulValue(caseData.criminalFlag)) withContent.push('criminal');
    if (hasMeaningfulValue(publicResult.laborFlag) || hasMeaningfulValue(caseData.laborFlag)) withContent.push('labor');
    if (hasMeaningfulValue(publicResult.warrantFlag) || hasMeaningfulValue(caseData.warrantFlag)) withContent.push('warrants');
    if (hasMeaningfulValue(publicResult.osintLevel) || hasMeaningfulValue(caseData.osintLevel)) withContent.push('osint');
    if (hasMeaningfulValue(publicResult.socialStatus) || hasMeaningfulValue(caseData.socialStatus)) withContent.push('social');
    if (hasMeaningfulValue(publicResult.digitalFlag) || hasMeaningfulValue(caseData.digitalFlag)) withContent.push('digital');
    if (hasMeaningfulValue(publicResult.conflictInterest) || hasMeaningfulValue(caseData.conflictInterest)) withContent.push('conflictInterest');

    return unique([...requested, ...withContent, 'decision', 'report_secure']);
}

function inferClientCommercialModuleKeys(caseData = {}) {
    const explicitRequested = unique(asArray(caseData.requestedModuleKeys).map(normalizeModuleKey))
        .filter((moduleKey) => !['decision', 'report_secure'].includes(moduleKey));
    if (explicitRequested.length > 0) return explicitRequested;

    const legacyRequested = unique(asArray(caseData.enabledPhases).map(normalizeModuleKey))
        .filter((moduleKey) => !['decision', 'report_secure'].includes(moduleKey));
    if (legacyRequested.length > 0) return legacyRequested;

    return inferRequestedModuleKeys(caseData)
        .filter((moduleKey) => !['decision', 'report_secure'].includes(moduleKey));
}

function buildReasons(caseData = {}, publicResult = {}) {
    const keyFindings = asArray(publicResult.keyFindings || caseData.keyFindings)
        .map((item) => (typeof item === 'string' ? item : item?.summary || item?.title || ''))
        .filter(Boolean);
    const analystComment = publicResult.analystComment || caseData.analystComment;
    const reasons = [...keyFindings];
    if (hasMeaningfulValue(analystComment)) reasons.push(String(analystComment));
    return reasons.slice(0, 12);
}

function inferReviewLevel(caseData = {}, publicResult = {}) {
    const verdict = publicResult.finalVerdict || caseData.finalVerdict;
    const riskLevel = publicResult.riskLevel || caseData.riskLevel;
    const warrantFlag = publicResult.warrantFlag || caseData.warrantFlag;
    const highRisk = ['NOT_RECOMMENDED', 'REJECTED'].includes(verdict)
        || ['HIGH', 'CRITICAL', 'RED'].includes(riskLevel)
        || warrantFlag === 'POSITIVE';
    return highRisk ? 'senior_approval_candidate' : 'operational_review';
}

function buildDecisionContract({
    caseId,
    caseData = {},
    publicResult = {},
    reviewer = {},
    approvedAt = null,
} = {}) {
    const productKey = inferProductKey(caseData);
    const moduleKeys = inferReportModuleKeys(caseData, publicResult);
    const reasons = buildReasons(caseData, publicResult);
    const summary = publicResult.executiveSummary || caseData.executiveSummary || publicResult.analystComment || caseData.analystComment || '';
    const decisionBasis = {
        caseId,
        productKey,
        moduleKeys,
        verdict: publicResult.finalVerdict || caseData.finalVerdict || 'PENDING',
        riskScore: publicResult.riskScore ?? caseData.riskScore ?? null,
        riskLevel: publicResult.riskLevel || caseData.riskLevel || null,
        summary,
        reasons,
    };
    const evidenceSetHash = createHash(decisionBasis);

    return stripUndefined({
        tenantId: caseData.tenantId || null,
        caseId,
        subjectId: caseData.subjectId || null,
        productKey,
        moduleKeys,
        verdict: decisionBasis.verdict,
        riskScore: decisionBasis.riskScore,
        riskLevel: decisionBasis.riskLevel,
        summary,
        reasons,
        supportingEvidenceIds: asArray(caseData.supportingEvidenceIds),
        supportingSignalIds: asArray(caseData.supportingSignalIds),
        evidenceSetHash,
        reviewLevel: inferReviewLevel(caseData, publicResult),
        reviewedBy: reviewer.uid || null,
        approvedBy: reviewer.uid || null,
        status: 'approved',
        revision: caseData.decisionRevision || 1,
        policyVersion: V2_CORE_VERSION,
        approvedAt,
    });
}

function buildReportSections(caseData = {}, publicResult = {}) {
    const sections = [];
    const identitySummary = [publicResult.candidateName || caseData.candidateName, publicResult.cpfMasked || caseData.cpfMasked]
        .filter(Boolean)
        .join(' - ');

    if (identitySummary) {
        sections.push({
            sectionKey: 'identity',
            title: 'Identificacao',
            content: identitySummary,
            moduleKey: 'identity_pf',
        });
    }

    if (hasMeaningfulValue(publicResult.executiveSummary || caseData.executiveSummary)) {
        sections.push({
            sectionKey: 'executiveSummary',
            title: 'Resumo executivo',
            content: publicResult.executiveSummary || caseData.executiveSummary,
            moduleKey: 'decision',
        });
    }

    const riskSignals = [
        ['criminal', publicResult.criminalFlag || caseData.criminalFlag],
        ['labor', publicResult.laborFlag || caseData.laborFlag],
        ['warrants', publicResult.warrantFlag || caseData.warrantFlag],
        ['osint', publicResult.osintLevel || caseData.osintLevel],
        ['social', publicResult.socialStatus || caseData.socialStatus],
        ['digital', publicResult.digitalFlag || caseData.digitalFlag],
    ].filter(([, value]) => hasMeaningfulValue(value));

    if (riskSignals.length > 0) {
        sections.push({
            sectionKey: 'riskSignals',
            title: 'Sinais de risco',
            content: riskSignals.map(([moduleKey, value]) => ({ moduleKey, value })),
            moduleKey: 'decision',
        });
    }

    const keyFindings = asArray(publicResult.keyFindings || caseData.keyFindings);
    if (keyFindings.length > 0) {
        sections.push({
            sectionKey: 'keyFindings',
            title: 'Principais apontamentos',
            content: keyFindings,
            moduleKey: 'decision',
        });
    }

    if (hasMeaningfulValue(publicResult.analystComment || caseData.analystComment)) {
        sections.push({
            sectionKey: 'analystConclusion',
            title: 'Conclusao do analista',
            content: publicResult.analystComment || caseData.analystComment,
            moduleKey: 'decision',
        });
    }

    const nextSteps = asArray(publicResult.nextSteps || caseData.nextSteps);
    if (nextSteps.length > 0) {
        sections.push({
            sectionKey: 'nextSteps',
            title: 'Proximos passos',
            content: nextSteps,
            moduleKey: 'report_secure',
        });
    }

    return sections;
}

function buildReportSnapshotContract({
    caseId,
    caseData = {},
    publicResult = {},
    decision = {},
    html = '',
    builderVersion = '',
    createdBy = null,
} = {}) {
    const productKey = inferProductKey(caseData);
    const moduleKeys = inferReportModuleKeys(caseData, publicResult);
    const sections = buildReportSections(caseData, publicResult);
    const clientSafeData = stripUndefined({ ...publicResult });
    const contentHash = createHash({
        caseId,
        decisionId: decision.id || decision.decisionId || null,
        productKey,
        moduleKeys,
        sections,
        clientSafeData,
        html,
        builderVersion,
    });

    return stripUndefined({
        tenantId: caseData.tenantId || null,
        caseId,
        subjectId: caseData.subjectId || null,
        decisionId: decision.id || decision.decisionId || null,
        productKey,
        moduleKeys,
        reportModuleKeys: moduleKeys,
        sections,
        clientSafeData,
        builderVersion,
        contentHash,
        evidenceSetHash: decision.evidenceSetHash || null,
        entitlementId: caseData.entitlementId || null,
        status: sections.length > 0 && html.trim() ? 'ready' : 'failed',
        createdBy,
        version: V2_CORE_VERSION,
    });
}

function resolvePublicReportAvailability({
    decision = null,
    reportSnapshot = null,
    publicReport = null,
    now = new Date(),
} = {}) {
    if (!decision || decision.status !== 'approved') {
        return {
            status: 'unavailable',
            reasonCode: 'decision_not_approved',
            clientMessage: 'Resultado em revisao.',
            publicReportToken: null,
            reportSnapshotId: null,
            decisionId: decision?.id || null,
            isActionable: false,
        };
    }

    if (!reportSnapshot) {
        return {
            status: 'generating',
            reasonCode: 'snapshot_missing',
            clientMessage: 'Relatorio em geracao.',
            publicReportToken: null,
            reportSnapshotId: null,
            decisionId: decision.id || null,
            isActionable: false,
        };
    }

    if (reportSnapshot.status !== 'ready') {
        return {
            status: reportSnapshot.status === 'failed' ? 'failed' : 'generating',
            reasonCode: `snapshot_${reportSnapshot.status || 'not_ready'}`,
            clientMessage: reportSnapshot.status === 'failed'
                ? 'Nao foi possivel preparar o relatorio. Nossa equipe foi acionada.'
                : 'Relatorio em geracao.',
            publicReportToken: null,
            reportSnapshotId: reportSnapshot.id || null,
            decisionId: decision.id || null,
            isActionable: false,
        };
    }

    if (!publicReport) {
        return {
            status: 'generating',
            reasonCode: 'public_report_missing',
            clientMessage: 'Relatorio em publicacao.',
            publicReportToken: null,
            reportSnapshotId: reportSnapshot.id || null,
            decisionId: decision.id || null,
            isActionable: false,
        };
    }

    if (publicReport.active === false || publicReport.status === 'revoked') {
        return {
            status: 'revoked',
            reasonCode: 'public_report_revoked',
            clientMessage: 'Relatorio revogado. Solicite um novo link.',
            publicReportToken: null,
            reportSnapshotId: reportSnapshot.id || null,
            decisionId: decision.id || null,
            isActionable: false,
        };
    }

    const expiresAt = publicReport.expiresAt instanceof Date
        ? publicReport.expiresAt
        : publicReport.expiresAt?.toDate?.() || null;
    if (expiresAt && expiresAt < now) {
        return {
            status: 'revoked',
            reasonCode: 'public_report_expired',
            clientMessage: 'O link do relatorio expirou. Solicite um novo link.',
            publicReportToken: null,
            reportSnapshotId: reportSnapshot.id || null,
            decisionId: decision.id || null,
            isActionable: false,
        };
    }

    if (publicReport.reportSnapshotId && reportSnapshot.id && publicReport.reportSnapshotId !== reportSnapshot.id) {
        return {
            status: 'generating',
            reasonCode: 'snapshot_token_mismatch',
            clientMessage: 'Relatorio em atualizacao.',
            publicReportToken: null,
            reportSnapshotId: reportSnapshot.id,
            decisionId: decision.id || null,
            isActionable: false,
        };
    }

    return {
        status: 'ready',
        reasonCode: 'ready',
        clientMessage: 'Relatorio pronto para abertura e compartilhamento.',
        publicReportToken: publicReport.token || publicReport.id || null,
        reportSnapshotId: reportSnapshot.id || null,
        decisionId: decision.id || null,
        isActionable: true,
    };
}

function buildClientProjectionContract({
    caseId,
    caseData = {},
    publicResult = {},
    decision = {},
    reportSnapshot = {},
    availability = {},
} = {}) {
    const productKey = inferProductKey(caseData);
    const moduleKeys = inferClientCommercialModuleKeys(caseData);
    const commercialModules = moduleKeys.map((moduleKey) => ({
        moduleKey,
        label: MODULE_LABELS[moduleKey] || moduleKey,
    }));

    return stripUndefined({
        tenantId: caseData.tenantId || null,
        clientId: caseData.clientId || caseData.tenantId || null,
        caseId,
        subjectId: caseData.subjectId || null,
        subjectLabel: publicResult.candidateName || caseData.candidateName || '',
        candidateName: publicResult.candidateName || caseData.candidateName || '',
        cpfMasked: publicResult.cpfMasked || caseData.cpfMasked || '',
        productKey,
        productLabel: PRODUCT_LABELS[productKey] || productKey,
        enabledCommercialModules: commercialModules,
        commercialModules,
        moduleClientStatuses: commercialModules.map((module) => ({
            moduleKey: module.moduleKey,
            label: module.label,
            status: 'completed',
        })),
        status: caseData.status || 'PENDING',
        statusSummary: publicResult.statusSummary || caseData.statusSummary || '',
        sourceSummary: publicResult.sourceSummary || caseData.sourceSummary || '',
        pendingActions: [],
        riskSummary: {
            riskScore: decision.riskScore ?? publicResult.riskScore ?? caseData.riskScore ?? null,
            riskLevel: decision.riskLevel || publicResult.riskLevel || caseData.riskLevel || null,
        },
        verdict: decision.verdict || publicResult.finalVerdict || caseData.finalVerdict || null,
        finalVerdict: decision.verdict || publicResult.finalVerdict || caseData.finalVerdict || null,
        riskScore: decision.riskScore ?? publicResult.riskScore ?? caseData.riskScore ?? null,
        riskLevel: decision.riskLevel || publicResult.riskLevel || caseData.riskLevel || null,
        executiveSummary: publicResult.executiveSummary || caseData.executiveSummary || '',
        keyFindings: asArray(publicResult.keyFindings || caseData.keyFindings),
        processHighlights: asArray(publicResult.processHighlights || caseData.processHighlights),
        warrantFindings: asArray(publicResult.warrantFindings || caseData.warrantFindings),
        nextSteps: asArray(publicResult.nextSteps || caseData.nextSteps),
        timelineEvents: asArray(publicResult.timelineEvents || caseData.timelineEvents),
        reportAvailability: availability,
        publicReportToken: availability.publicReportToken || null,
        reportSnapshotId: reportSnapshot.id || availability.reportSnapshotId || null,
        decisionId: decision.id || availability.decisionId || null,
        reportReady: availability.status === 'ready',
        reportSlug: publicResult.reportSlug || caseData.reportSlug || null,
        createdAt: caseData.createdAt || null,
        updatedAt: caseData.updatedAt || null,
        version: V2_CORE_VERSION,
    });
}

function validatePublicationGates({ decision, reportSnapshot, html }) {
    if (!decision || decision.status !== 'approved') {
        return { ok: false, reasonCode: 'decision_not_approved' };
    }
    if (!reportSnapshot || reportSnapshot.status !== 'ready') {
        return { ok: false, reasonCode: 'report_snapshot_not_ready' };
    }
    if (!String(html || '').trim()) {
        return { ok: false, reasonCode: 'report_html_empty' };
    }
    return { ok: true, reasonCode: 'ready' };
}

module.exports = {
    V2_CORE_VERSION,
    buildClientProjectionContract,
    buildDecisionContract,
    buildReportSnapshotContract,
    createHash,
    inferProductKey,
    inferClientCommercialModuleKeys,
    inferReportModuleKeys,
    inferRequestedModuleKeys,
    resolvePublicReportAvailability,
    validatePublicationGates,
};
