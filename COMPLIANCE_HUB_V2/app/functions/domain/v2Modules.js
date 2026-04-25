const V2_MODULES_VERSION = 'v2-modules-2026-04-21';

const MODULE_RUN_STATUSES = {
    NOT_ENTITLED: 'not_entitled',
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED_NO_FINDINGS: 'completed_no_findings',
    COMPLETED_WITH_FINDINGS: 'completed_with_findings',
    SKIPPED_REUSE: 'skipped_reuse',
    SKIPPED_POLICY: 'skipped_policy',
    FAILED_RETRYABLE: 'failed_retryable',
    FAILED_FINAL: 'failed_final',
    BLOCKED: 'blocked',
};

const MODULE_REGISTRY = {
    identity_pf: {
        moduleKey: 'identity_pf',
        internalName: 'identity_pf',
        commercialName: 'Identificacao PF',
        type: 'data',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: false,
        blocksDecision: true,
        blocksPublication: true,
        reviewPolicy: 'operational_review',
        freshnessPolicy: 'medium',
        clientVisible: true,
    },
    identity_pj: {
        moduleKey: 'identity_pj',
        internalName: 'identity_pj',
        commercialName: 'Identificacao PJ',
        type: 'data',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: false,
        blocksDecision: true,
        blocksPublication: true,
        reviewPolicy: 'operational_review',
        freshnessPolicy: 'medium',
        clientVisible: true,
    },
    judicial: {
        moduleKey: 'judicial',
        internalName: 'judicial',
        commercialName: 'Analise judicial',
        type: 'data_analytical',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review',
        freshnessPolicy: 'short_medium',
        clientVisible: true,
    },
    criminal: {
        moduleKey: 'criminal',
        internalName: 'criminal',
        commercialName: 'Analise criminal',
        type: 'analytical',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review',
        freshnessPolicy: 'short_medium',
        clientVisible: true,
    },
    labor: {
        moduleKey: 'labor',
        internalName: 'labor',
        commercialName: 'Analise trabalhista',
        type: 'analytical',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review',
        freshnessPolicy: 'short_medium',
        clientVisible: true,
    },
    warrants: {
        moduleKey: 'warrants',
        internalName: 'warrants',
        commercialName: 'Mandados e alertas criticos',
        type: 'critical_risk',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: true,
        blocksPublication: true,
        reviewPolicy: 'senior_approval_on_positive',
        freshnessPolicy: 'short',
        clientVisible: true,
    },
    kyc: {
        moduleKey: 'kyc',
        internalName: 'kyc',
        commercialName: 'KYC, PEP e sancoes',
        type: 'screening',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review_on_positive',
        freshnessPolicy: 'short_medium',
        clientVisible: true,
    },
    report_secure: {
        moduleKey: 'report_secure',
        internalName: 'report_secure',
        commercialName: 'Relatorio seguro',
        type: 'output',
        usesProvider: false,
        generatesEvidence: false,
        generatesRisk: false,
        blocksDecision: false,
        blocksPublication: true,
        reviewPolicy: 'derived_from_decision',
        freshnessPolicy: 'immutable',
        clientVisible: true,
        internalCapability: true,
    },
    decision: {
        moduleKey: 'decision',
        internalName: 'decision',
        commercialName: 'Decisao de risco',
        type: 'workflow',
        usesProvider: false,
        generatesEvidence: false,
        generatesRisk: false,
        blocksDecision: true,
        blocksPublication: true,
        reviewPolicy: 'human_review_required',
        freshnessPolicy: 'decision_revision',
        clientVisible: false,
        internalCapability: true,
    },
    osint: {
        moduleKey: 'osint',
        internalName: 'osint',
        commercialName: 'Risco reputacional',
        type: 'analytical',
        usesProvider: false,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review',
        freshnessPolicy: 'short_medium',
        clientVisible: true,
        legacyCompat: true,
    },
    social: {
        moduleKey: 'social',
        internalName: 'social',
        commercialName: 'Redes sociais',
        type: 'analytical',
        usesProvider: false,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review',
        freshnessPolicy: 'short_medium',
        clientVisible: true,
        legacyCompat: true,
    },
    digital: {
        moduleKey: 'digital',
        internalName: 'digital',
        commercialName: 'Perfil digital',
        type: 'analytical',
        usesProvider: false,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review',
        freshnessPolicy: 'short_medium',
        clientVisible: true,
        legacyCompat: true,
    },
    conflictInterest: {
        moduleKey: 'conflictInterest',
        internalName: 'conflictInterest',
        commercialName: 'Conflito de interesse',
        type: 'analytical',
        usesProvider: false,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review',
        freshnessPolicy: 'medium',
        clientVisible: true,
        legacyCompat: true,
    },
    ongoing_monitoring: {
        moduleKey: 'ongoing_monitoring',
        internalName: 'ongoing_monitoring',
        commercialName: 'Monitoramento Contínuo',
        type: 'workflow',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review',
        freshnessPolicy: 'continuous',
        clientVisible: true,
    },
    contact_pf: {
        moduleKey: 'contact_pf',
        internalName: 'contact_pf',
        commercialName: 'Contato PF',
        type: 'data',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: false,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'operational_review',
        freshnessPolicy: 'medium',
        clientVisible: true,
    },
    contact_pj: {
        moduleKey: 'contact_pj',
        internalName: 'contact_pj',
        commercialName: 'Contato PJ',
        type: 'data',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: false,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'operational_review',
        freshnessPolicy: 'medium',
        clientVisible: true,
    },
    financial_pf: {
        moduleKey: 'financial_pf',
        internalName: 'financial_pf',
        commercialName: 'Financeiro PF',
        type: 'data_analytical',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review',
        freshnessPolicy: 'medium',
        clientVisible: true,
    },
    financial_pj: {
        moduleKey: 'financial_pj',
        internalName: 'financial_pj',
        commercialName: 'Financeiro PJ',
        type: 'data_analytical',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review',
        freshnessPolicy: 'medium',
        clientVisible: true,
    },
    online_presence: {
        moduleKey: 'online_presence',
        internalName: 'online_presence',
        commercialName: 'Perfil Digital',
        type: 'data_analytical',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: false,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review',
        freshnessPolicy: 'medium',
        clientVisible: true,
    },
    relationship: {
        moduleKey: 'relationship',
        internalName: 'relationship',
        commercialName: 'QSA / Relacionamentos',
        type: 'data',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: false,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'operational_review',
        freshnessPolicy: 'medium',
        clientVisible: true,
    },
    owners_kyc: {
        moduleKey: 'owners_kyc',
        internalName: 'owners_kyc',
        commercialName: 'KYC dos Socios',
        type: 'screening',
        usesProvider: true,
        generatesEvidence: true,
        generatesRisk: true,
        blocksDecision: false,
        blocksPublication: false,
        reviewPolicy: 'analytical_review_on_positive',
        freshnessPolicy: 'short_medium',
        clientVisible: true,
    },
};

const MODULE_ALIASES = {
    identity: 'identity_pf',
    basicData: 'identity_pf',
    basic_data: 'identity_pf',
    processos: 'judicial',
    processes: 'judicial',
    lawsuits: 'judicial',
    warrant: 'warrants',
    mandados: 'warrants',
    sanction: 'kyc',
    sanctions: 'kyc',
    pep: 'kyc',
    conflict: 'conflictInterest',
    conflict_interest: 'conflictInterest',
    report: 'report_secure',
    public_report: 'report_secure',
    contact: 'contact_pf',
    financial: 'financial_pf',
    qsa: 'relationship',
    relationships: 'relationship',
    ownerskyc: 'owners_kyc',
    owners_kyc: 'owners_kyc',
    onlinepresence: 'online_presence',
    online_presence: 'online_presence',
};

const PRODUCT_REGISTRY = {
    dossier_pf_basic: {
        productKey: 'dossier_pf_basic',
        requiredModules: ['identity_pf', 'decision', 'report_secure'],
        optionalModules: ['criminal', 'labor', 'warrants', 'kyc'],
    },
    dossier_pf_full: {
        productKey: 'dossier_pf_full',
        requiredModules: ['identity_pf', 'decision', 'report_secure'],
        optionalModules: ['criminal', 'labor', 'warrants', 'kyc', 'osint', 'social', 'digital', 'contact_pf', 'financial_pf', 'online_presence'],
    },
    dossier_pj: {
        productKey: 'dossier_pj',
        requiredModules: ['identity_pj', 'decision', 'report_secure'],
        optionalModules: ['criminal', 'judicial', 'kyc', 'relationship', 'owners_kyc', 'financial_pj', 'contact_pj', 'online_presence'],
    },
    kyc_individual: {
        productKey: 'kyc_individual',
        requiredModules: ['identity_pf', 'kyc', 'decision', 'report_secure'],
        optionalModules: ['criminal', 'warrants'],
    },
    kyb_business: {
        productKey: 'kyb_business',
        requiredModules: ['identity_pj', 'kyc', 'decision', 'report_secure'],
        optionalModules: ['relationship', 'osint', 'judicial'],
    },
    kye_employee: {
        productKey: 'kye_employee',
        requiredModules: ['identity_pf', 'kyc', 'decision', 'report_secure'],
        optionalModules: ['criminal', 'labor', 'warrants'],
    },
    kys_supplier: {
        productKey: 'kys_supplier',
        requiredModules: ['identity_pj', 'identity_pf', 'kyc', 'decision', 'report_secure'],
        optionalModules: ['criminal', 'relationship'],
    },
    tpr_third_party: {
        productKey: 'tpr_third_party',
        requiredModules: ['identity_pf', 'identity_pj', 'kyc', 'decision', 'report_secure'],
        optionalModules: ['criminal', 'labor', 'relationship'],
    },
    reputational_risk: {
        productKey: 'reputational_risk',
        requiredModules: ['identity_pf', 'osint', 'social', 'digital', 'decision', 'report_secure'],
        optionalModules: [],
    },
    ongoing_monitoring: {
        productKey: 'ongoing_monitoring',
        requiredModules: ['ongoing_monitoring', 'decision', 'report_secure'],
        optionalModules: [],
    },
    report_secure: {
        productKey: 'report_secure',
        requiredModules: ['decision', 'report_secure'],
        optionalModules: [],
    },
};

const LEGACY_ANALYSIS_DEFAULTS = [
    'criminal',
    'labor',
    'warrants',
    'osint',
    'social',
    'digital',
    'conflictInterest',
];

const EXECUTED_STATUSES = new Set([
    MODULE_RUN_STATUSES.COMPLETED_NO_FINDINGS,
    MODULE_RUN_STATUSES.COMPLETED_WITH_FINDINGS,
    MODULE_RUN_STATUSES.SKIPPED_REUSE,
    MODULE_RUN_STATUSES.SKIPPED_POLICY,
]);

const BLOCKING_STATUSES = new Set([
    MODULE_RUN_STATUSES.NOT_ENTITLED,
    MODULE_RUN_STATUSES.BLOCKED,
    MODULE_RUN_STATUSES.FAILED_FINAL,
]);

function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function normalizeModuleKey(moduleKey) {
    const raw = String(moduleKey || '').trim();
    if (!raw) return null;
    return MODULE_ALIASES[raw] || raw;
}

function normalizeModuleKeys(moduleKeys) {
    return unique(asArray(moduleKeys).map(normalizeModuleKey));
}

function getModuleContract(moduleKey) {
    return MODULE_REGISTRY[normalizeModuleKey(moduleKey)] || null;
}

function listModuleContracts() {
    return Object.values(MODULE_REGISTRY);
}

function inferProductKey(caseData = {}) {
    return caseData.productKey || caseData.requestedProductKey || 'dossier_pf_basic';
}

function getProductContract(productKey) {
    return PRODUCT_REGISTRY[productKey] || PRODUCT_REGISTRY.dossier_pf_basic;
}

function inferRequestedModuleKeys(caseData = {}) {
    const explicit = normalizeModuleKeys([
        ...asArray(caseData.requestedModuleKeys),
        ...asArray(caseData.moduleKeys),
    ]);
    if (explicit.length > 0) return explicit;

    const legacyPhases = normalizeModuleKeys(caseData.enabledPhases);
    if (legacyPhases.length > 0) return legacyPhases;

    return [...LEGACY_ANALYSIS_DEFAULTS];
}

function isEnabledConfigValue(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        if (['enabled', 'active', 'true', 'yes'].includes(normalized)) return true;
        if (['disabled', 'inactive', 'false', 'no'].includes(normalized)) return false;
    }
    if (typeof value === 'object') {
        if ('enabled' in value) return value.enabled === true || value.enabled === 'enabled';
        if ('status' in value) return isEnabledConfigValue(value.status);
    }
    return Boolean(value);
}

function getConfigValue(configMap, key) {
    if (!configMap || typeof configMap !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(configMap, key)) return configMap[key];
    for (const [candidate, normalized] of Object.entries(MODULE_ALIASES)) {
        if (normalized === key && Object.prototype.hasOwnProperty.call(configMap, candidate)) {
            return configMap[candidate];
        }
    }
    return undefined;
}

function getEnabledMap(entitlements = {}, primaryKey, secondaryKey) {
    const primary = entitlements?.[primaryKey];
    if (primary && typeof primary === 'object') return primary;
    const secondary = entitlements?.[secondaryKey];
    if (secondary && typeof secondary === 'object') return secondary;
    return {};
}

function hasEntries(value) {
    return value && typeof value === 'object' && Object.keys(value).length > 0;
}

function getLegacyEnabledModules(tenantSettings = null) {
    const analysisConfig = tenantSettings?.analysisConfig;
    if (!analysisConfig || typeof analysisConfig !== 'object') {
        return new Set(LEGACY_ANALYSIS_DEFAULTS);
    }

    const enabled = Object.entries(analysisConfig)
        .filter(([, value]) => isEnabledConfigValue(value) !== false)
        .map(([key]) => normalizeModuleKey(key))
        .filter(Boolean);

    return new Set(enabled.length > 0 ? enabled : LEGACY_ANALYSIS_DEFAULTS);
}

function resolveCaseEntitlements({
    caseData = {},
    tenantEntitlements = null,
    tenantSettings = null,
} = {}) {
    const productKey = inferProductKey(caseData);
    const productContract = getProductContract(productKey);
    const requestedModuleKeys = inferRequestedModuleKeys(caseData);
    const requiredModuleKeys = normalizeModuleKeys(productContract.requiredModules);
    const candidateModuleKeys = unique([...requestedModuleKeys, ...requiredModuleKeys]);

    const productMap = getEnabledMap(tenantEntitlements, 'enabledProducts', 'products');
    const moduleMap = getEnabledMap(tenantEntitlements, 'enabledModules', 'modules');
    const hasProductMap = hasEntries(productMap);
    const hasModuleMap = hasEntries(moduleMap);
    const productValue = productMap[productKey];
    const productEnabled = hasProductMap ? isEnabledConfigValue(productValue) === true : true;
    const legacyEnabledModules = getLegacyEnabledModules(tenantSettings);
    const entitlementId = tenantEntitlements?.entitlementId
        || tenantEntitlements?.contractId
        || (tenantEntitlements?.tenantId ? `tenantEntitlements/${tenantEntitlements.tenantId}` : null);

    const moduleDecisions = {};
    candidateModuleKeys.forEach((moduleKey) => {
        const contract = getModuleContract(moduleKey);
        const requested = requestedModuleKeys.includes(moduleKey);
        const requiredByProduct = requiredModuleKeys.includes(moduleKey);
        const internalCapability = contract?.internalCapability === true;
        let entitled = false;
        let reasonCode = 'not_entitled';

        if (!contract) {
            entitled = false;
            reasonCode = 'unknown_module';
        } else if (!productEnabled) {
            entitled = false;
            reasonCode = 'product_not_entitled';
        } else if (internalCapability || requiredByProduct) {
            entitled = true;
            reasonCode = 'product_required';
        } else if (hasModuleMap) {
            entitled = isEnabledConfigValue(getConfigValue(moduleMap, moduleKey)) === true;
            reasonCode = entitled ? 'tenant_entitlement' : 'module_not_entitled';
        } else if (hasProductMap) {
            entitled = true;
            reasonCode = 'product_entitlement_without_module_map';
        } else {
            entitled = legacyEnabledModules.has(moduleKey);
            reasonCode = entitled ? 'legacy_tenant_settings_fallback' : 'legacy_module_disabled';
        }

        moduleDecisions[moduleKey] = {
            moduleKey,
            requested,
            requiredByProduct,
            entitled,
            effective: entitled && Boolean(contract),
            reasonCode,
            entitlementId,
            contract,
        };
    });

    return {
        productKey,
        productEntitled: productEnabled,
        entitlementId,
        requestedModuleKeys,
        effectiveModuleKeys: candidateModuleKeys.filter((moduleKey) => moduleDecisions[moduleKey]?.effective),
        blockedModuleKeys: candidateModuleKeys.filter((moduleKey) => !moduleDecisions[moduleKey]?.effective),
        moduleDecisions,
    };
}

function hasMeaningfulValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

function hasPositiveLike(value) {
    return [
        'POSITIVE',
        'INCONCLUSIVE',
        'INCONCLUSIVE_HOMONYM',
        'INCONCLUSIVE_LOW_COVERAGE',
        'NEGATIVE_PARTIAL',
        'CONCERN',
        'CONTRAINDICATED',
        'ALERT',
        'CRITICAL',
        'YES',
        'MEDIUM',
        'HIGH',
    ].includes(String(value || '').toUpperCase());
}

function hasModuleFindings(moduleKey, caseData = {}) {
    switch (moduleKey) {
    case 'judicial':
        return Number(caseData.juditProcessCount || caseData.bigdatacorpProcessTotal || caseData.escavadorProcessCount || 0) > 0
            || (Array.isArray(caseData.processHighlights) && caseData.processHighlights.length > 0);
    case 'criminal':
        return hasPositiveLike(caseData.criminalFlag)
            || Number(caseData.juditCriminalCount || caseData.bigdatacorpCriminalProcessCount || 0) > 0;
    case 'labor':
        return hasPositiveLike(caseData.laborFlag)
            || Number(caseData.juditLaborCount || caseData.bigdatacorpLaborProcessCount || 0) > 0;
    case 'warrants':
        return hasPositiveLike(caseData.warrantFlag)
            || Number(caseData.juditActiveWarrantCount || caseData.bigdatacorpActiveWarrantCount || 0) > 0
            || caseData.bigdatacorpHasArrestWarrant === true;
    case 'kyc':
        return caseData.bigdatacorpIsPep === true
            || caseData.bigdatacorpIsSanctioned === true
            || caseData.bigdatacorpHasArrestWarrant === true;
    case 'osint':
        return hasPositiveLike(caseData.osintLevel);
    case 'social':
        return hasPositiveLike(caseData.socialStatus);
    case 'digital':
        return hasPositiveLike(caseData.digitalFlag);
    case 'conflictInterest':
        return hasPositiveLike(caseData.conflictInterest);
    default:
        return false;
    }
}

function resolveProviderStatus(moduleKey, caseData = {}) {
    const statusCandidates = {
        identity_pf: [
            caseData.bigdatacorpEnrichmentStatus,
            caseData.juditEnrichmentStatus,
            caseData.enrichmentStatus,
        ],
        identity_pj: [caseData.enrichmentStatus],
        judicial: [
            caseData.juditEnrichmentStatus,
            caseData.escavadorEnrichmentStatus,
            caseData.bigdatacorpEnrichmentStatus,
            caseData.djenEnrichmentStatus,
            caseData.enrichmentStatus,
        ],
        criminal: [
            caseData.juditEnrichmentStatus,
            caseData.bigdatacorpEnrichmentStatus,
            caseData.enrichmentStatus,
        ],
        labor: [
            caseData.juditEnrichmentStatus,
            caseData.bigdatacorpEnrichmentStatus,
            caseData.enrichmentStatus,
        ],
        warrants: [
            caseData.juditEnrichmentStatus,
            caseData.bigdatacorpEnrichmentStatus,
            caseData.enrichmentStatus,
        ],
        kyc: [caseData.bigdatacorpEnrichmentStatus, caseData.enrichmentStatus],
    }[moduleKey] || [caseData.enrichmentStatus];

    return statusCandidates.find(hasMeaningfulValue) || null;
}

function mapProviderStatus(providerStatus, moduleKey, caseData) {
    const normalized = String(providerStatus || '').toUpperCase();
    if (['RUNNING', 'PENDING_CALLBACK', 'PROCESSING'].includes(normalized)) return MODULE_RUN_STATUSES.RUNNING;
    if (['PENDING', 'QUEUED'].includes(normalized)) return MODULE_RUN_STATUSES.PENDING;
    if (['FAILED'].includes(normalized)) return MODULE_RUN_STATUSES.FAILED_RETRYABLE;
    if (['BLOCKED'].includes(normalized)) return MODULE_RUN_STATUSES.BLOCKED;
    if (['SKIPPED'].includes(normalized)) return MODULE_RUN_STATUSES.SKIPPED_POLICY;
    if (['DONE', 'PARTIAL', 'COMPLETED'].includes(normalized)) {
        return hasModuleFindings(moduleKey, caseData)
            ? MODULE_RUN_STATUSES.COMPLETED_WITH_FINDINGS
            : MODULE_RUN_STATUSES.COMPLETED_NO_FINDINGS;
    }
    return null;
}

function inferOperationalStatus(moduleKey, caseData = {}) {
    if (moduleKey === 'decision') {
        if (caseData.currentDecisionId || (caseData.finalVerdict && caseData.finalVerdict !== 'PENDING')) {
            return MODULE_RUN_STATUSES.COMPLETED_NO_FINDINGS;
        }
        return caseData.status === 'DONE' ? MODULE_RUN_STATUSES.COMPLETED_NO_FINDINGS : MODULE_RUN_STATUSES.PENDING;
    }

    if (moduleKey === 'report_secure') {
        if (caseData.currentReportSnapshotId || caseData.publicReportToken || caseData.reportReady === true) {
            return MODULE_RUN_STATUSES.COMPLETED_NO_FINDINGS;
        }
        return caseData.status === 'DONE' ? MODULE_RUN_STATUSES.PENDING : MODULE_RUN_STATUSES.PENDING;
    }

    if (moduleKey === 'identity_pf' && (
        caseData.enrichmentIdentity ||
        caseData.bigdatacorpName ||
        caseData.juditIdentity
    )) {
        return MODULE_RUN_STATUSES.COMPLETED_NO_FINDINGS;
    }

    const providerStatus = resolveProviderStatus(moduleKey, caseData);
    const mappedProviderStatus = mapProviderStatus(providerStatus, moduleKey, caseData);
    if (mappedProviderStatus) return mappedProviderStatus;

    if (caseData.status === 'DONE') {
        return hasModuleFindings(moduleKey, caseData)
            ? MODULE_RUN_STATUSES.COMPLETED_WITH_FINDINGS
            : MODULE_RUN_STATUSES.COMPLETED_NO_FINDINGS;
    }

    if (caseData.status === 'IN_PROGRESS') return MODULE_RUN_STATUSES.RUNNING;
    return MODULE_RUN_STATUSES.PENDING;
}

function collectRequestIds(value) {
    if (!value) return [];
    if (typeof value === 'string') return value ? [value] : [];
    if (Array.isArray(value)) return unique(value.flatMap(collectRequestIds));
    if (typeof value !== 'object') return [];

    const direct = value.requestId || value.request_id || value.id;
    return unique([
        direct,
        ...Object.values(value).flatMap(collectRequestIds),
    ]);
}

function collectProviderRequestIds(moduleKey, caseData = {}) {
    const sourceCandidates = {
        identity_pf: [
            caseData.bigdatacorpSources?.basicData,
            caseData.juditSources?.entity,
            caseData.enrichmentSources?.identity,
            caseData.enrichmentSources?.receitaFederal,
        ],
        judicial: [
            caseData.juditSources?.lawsuits,
            caseData.escavadorSources,
            caseData.djenSources,
            caseData.bigdatacorpSources?.processes,
            caseData.juditRequestIds?.lawsuits,
        ],
        criminal: [
            caseData.juditSources?.lawsuits,
            caseData.juditSources?.execution,
            caseData.bigdatacorpSources?.processes,
            caseData.juditRequestIds?.lawsuits,
            caseData.juditRequestIds?.execution,
        ],
        labor: [
            caseData.juditSources?.lawsuits,
            caseData.bigdatacorpSources?.processes,
            caseData.juditRequestIds?.lawsuits,
        ],
        warrants: [
            caseData.juditSources?.warrant,
            caseData.bigdatacorpSources?.kyc,
            caseData.enrichmentSources?.warrant,
            caseData.juditRequestIds?.warrant,
        ],
        kyc: [
            caseData.bigdatacorpSources?.kyc,
        ],
    }[moduleKey] || [];

    return unique(sourceCandidates.flatMap(collectRequestIds));
}

function buildModuleRunsForCase({
    caseId,
    caseData = {},
    tenantEntitlements = null,
    tenantSettings = null,
    now = new Date(),
} = {}) {
    const resolution = resolveCaseEntitlements({ caseData, tenantEntitlements, tenantSettings });
    const moduleRuns = Object.values(resolution.moduleDecisions).map((decision) => {
        const contract = decision.contract || {};
        const effective = decision.effective === true;
        const status = effective
            ? inferOperationalStatus(decision.moduleKey, caseData)
            : MODULE_RUN_STATUSES.NOT_ENTITLED;
        const blockingStatus = BLOCKING_STATUSES.has(status);
        const blocksDecision = blockingStatus && (decision.requested || contract.blocksDecision === true);
        const blocksPublication = blockingStatus && (decision.requested || contract.blocksPublication === true);

        return {
            tenantId: caseData.tenantId || null,
            caseId,
            subjectId: caseData.subjectId || null,
            productKey: resolution.productKey,
            moduleKey: decision.moduleKey,
            requested: decision.requested,
            entitled: decision.entitled,
            effective,
            status,
            providerRequestIds: collectProviderRequestIds(decision.moduleKey, caseData),
            rawSnapshotIds: [],
            providerRecordIds: [],
            evidenceIds: [],
            riskSignalIds: [],
            usageMeterIds: [],
            blocksDecision,
            blocksPublication,
            reuseReason: null,
            failureReason: null,
            startedAt: null,
            finishedAt: null,
            entitlementId: decision.entitlementId,
            entitlementReasonCode: decision.reasonCode,
            moduleType: contract.type || null,
            usesProvider: contract.usesProvider === true,
            canGenerateEvidence: contract.generatesEvidence === true,
            canGenerateRisk: contract.generatesRisk === true,
            reviewPolicy: contract.reviewPolicy || null,
            freshnessPolicy: contract.freshnessPolicy || null,
            lastEvaluatedAt: now instanceof Date ? now.toISOString() : now,
            version: V2_MODULES_VERSION,
        };
    });

    return moduleRuns.sort((left, right) => left.moduleKey.localeCompare(right.moduleKey));
}

function summarizeModuleRuns(moduleRuns = []) {
    const requestedModuleKeys = unique(moduleRuns.filter((run) => run.requested).map((run) => run.moduleKey));
    const effectiveModuleKeys = unique(moduleRuns.filter((run) => run.effective).map((run) => run.moduleKey));
    const executedModuleKeys = unique(moduleRuns.filter((run) => EXECUTED_STATUSES.has(run.status)).map((run) => run.moduleKey));
    const blockedModuleKeys = unique(moduleRuns.filter((run) => run.blocksDecision || run.blocksPublication).map((run) => run.moduleKey));

    return {
        requestedModuleKeys,
        effectiveModuleKeys,
        executedModuleKeys,
        blockedModuleKeys,
        blocksDecision: moduleRuns.some((run) => run.blocksDecision),
        blocksPublication: moduleRuns.some((run) => run.blocksPublication),
        total: moduleRuns.length,
        requestedCount: requestedModuleKeys.length,
        effectiveCount: effectiveModuleKeys.length,
        executedCount: executedModuleKeys.length,
        blockedCount: blockedModuleKeys.length,
        statuses: Object.fromEntries(moduleRuns.map((run) => [run.moduleKey, run.status])),
    };
}

module.exports = {
    MODULE_REGISTRY,
    MODULE_RUN_STATUSES,
    PRODUCT_REGISTRY,
    V2_MODULES_VERSION,
    buildModuleRunsForCase,
    getModuleContract,
    getProductContract,
    inferRequestedModuleKeys,
    listModuleContracts,
    normalizeModuleKey,
    resolveCaseEntitlements,
    summarizeModuleRuns,
};
