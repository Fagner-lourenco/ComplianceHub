const { getFirestore, FieldValue } = require('firebase-admin/firestore');

let _overrideDb = null;

function getDb() {
    return _overrideDb || getFirestore();
}

function _setDb(db) {
    _overrideDb = db;
}

const DEFAULT_ENRICHMENT_CONFIG = {
    enabled: false,
    phases: {
        identity: true,       // cadastro-pf-basica (R$ 0,24)
        criminal: true,       // processos-agrupada criminal detection (R$ 1,65)
        warrant: true,        // cnj-mandados-prisao (R$ 1,08)
        labor: true,          // trt-consulta (R$ 0,54/region)
    },
    escalation: {
        enabled: true,        // processos-completa on triggers
        triggers: ['criminal', 'warrant', 'highProcessCount'],
        processCountThreshold: 5,
    },
    filters: { uf: '' },
    gate: { minNameSimilarity: 0.7 },
    ai: { enabled: false },
};

const DEFAULT_ESCAVADOR_CONFIG = {
    enabled: false,
    phases: {
        processos: true,  // RESERVED: not consulted at runtime — Escavador always queries processos. Kept for future phase-gating.
    },
    filters: {
        incluirHomonimos: true,  // ALWAYS include homonyms — critical for non-indexed CPFs
        autoTribunais: false,    // NO tribunal filter by default — causes missed processes
        tribunais: [],           // manual override
        status: null,            // 'ATIVO' | null
    },
};

const DEFAULT_JUDIT_CONFIG = {
    enabled: true,
    phases: {
        entity: false,           // R$0.12 — gate (Dados Cadastrais Data Lake) — OFF by default, BDC is primary
        lawsuits: true,          // R$0.50 simples | R$1.50/1k datalake | R$6.00/1k on_demand
        warrant: true,           // R$1.00 — mandado de prisao
        execution: false,        // R$0.50 — execucao criminal (default OFF, toggleable per tenant)
    },
    escalation: {
        triggerEscavador: ['criminal', 'warrant', 'execution', 'highProcessCount'],
        processCountThreshold: 5,
    },
    filters: {
        autoTribunals: false,    // NO tribunal filter by default — causes missed processes
        tribunals: [],           // manual override
        useAsync: false,         // ⚠️  DEFAULT=false: sync simples (R$0.50). Async datalake (R$1.50/1k) ou on_demand (R$6.00/1k) apenas se forçado.
        useWebhook: true,        // warrant/execution are async by contract — use callback instead of blocking polling
        cacheTtlDays: 7,        // reuse Judit cache if extracted within X days (0 = no cache)
    },
    realTime: {
        // RESERVED: realTime config is NOT read at runtime in the current flow.
        // Kept for future on_demand async capability (R$6.00/1k).
        enabled: true,           // async/on_demand CAPABILITY is available...
        default: false,          // ...but DISABLED by default. Only used for explicit triggers.
        triggers: [              // conditions that justify async on_demand (R$6.00/1k):
            'caso_sensivel_alto_risco',
            'conflito_relevante_entre_fontes',
            'processo_critico_sem_detalhe',
            'necessidade_explicita_usuario',
            'revisao_manual_duvida_relevante',
        ],
    },
    gate: { minNameSimilarity: 0.7 },
    nameSearchSupplement: {
        enabled: true,           // enable name-based search when CPF yields 0 lawsuits
        maxCpfsComNome: 3,       // only search if name has ≤ N CPFs (avoid homonym pollution)
        preferSync: true,        // use sync datalake by name (cheaper) instead of async
    },
    persistence: {
        saveRawPayloads: true,   // persist request_id, request body, raw response for audit
    },
};

const DEFAULT_BIGDATACORP_CONFIG = {
    enabled: true,            // PRIMARY provider — gate + processes + KYC
    phases: {
        basicData: true,      // R$0.03 — identity validation + gate
        processes: true,      // R$0.07 — lawsuits with CPF in Parties.Doc
        kyc: true,            // R$0.05 — PEP + sanctions (Interpol, FBI, OFAC, etc.)
        occupation: true,     // R$0.05 — employment/profession history (included in combined call)
    },
    gate: { minNameSimilarity: 0.7 },
    processLimit: 100,        // Max processes to return per query
};

const DEFAULT_DJEN_CONFIG = {
    enabled: true,            // FREE API — no cost, always run
    phases: {
        comunicacoes: true,   // GET /comunicacao
    },
    searchStrategy: 'hybrid', // 'hybrid' = byProcess + byName; 'byProcess'; 'byName'
    maxPages: 3,              // Max pages per name search (100 items/page)
    filters: {
        siglaTribunal: null,  // Filter by tribunal sigla
    },
    nameMatchThreshold: 0.85, // Min word-similarity for name filter (byName phase)
};

const DEFAULT_ANALYSIS_CONFIG = {
    criminal: { enabled: true },
    labor: { enabled: true },
    warrant: { enabled: true },
    osint: { enabled: true },
    social: { enabled: true },
    digital: { enabled: true },
    conflictInterest: { enabled: true },
};

/* =========================================================
   NAME SIMILARITY HELPERS (gate)
   ========================================================= */

/* =========================================================
   AI ANALYSIS — Structured JSON output with anti-hallucination
   Runs AFTER all providers complete (FonteData + Escavador + Judit)
   ========================================================= */






















async function getTenantSettingsData(tenantId) {
    if (!tenantId) return null;
    const tenantDoc = await getDb().collection('tenantSettings').doc(tenantId).get();
    return tenantDoc.exists ? tenantDoc.data() : null;
}

async function getTenantEntitlementsData(tenantId) {
    if (!tenantId) return null;
    const entitlementDoc = await getDb().collection('tenantEntitlements').doc(tenantId).get();
    return entitlementDoc.exists ? { tenantId, ...entitlementDoc.data() } : null;
}

async function loadFonteDataConfig(tenantId) {
    const tenantData = await getTenantSettingsData(tenantId);
    const rawConfig = tenantData?.enrichmentConfig;
    if (!rawConfig) return { ...DEFAULT_ENRICHMENT_CONFIG };

    return {
        ...DEFAULT_ENRICHMENT_CONFIG,
        ...rawConfig,
        phases: {
            ...DEFAULT_ENRICHMENT_CONFIG.phases,
            ...(rawConfig.phases || {}),
        },
        escalation: {
            ...DEFAULT_ENRICHMENT_CONFIG.escalation,
            ...(rawConfig.escalation || {}),
        },
        filters: {
            ...DEFAULT_ENRICHMENT_CONFIG.filters,
            ...(rawConfig.filters || {}),
        },
        gate: {
            ...DEFAULT_ENRICHMENT_CONFIG.gate,
            ...(rawConfig.gate || {}),
        },
        ai: {
            ...DEFAULT_ENRICHMENT_CONFIG.ai,
            ...(rawConfig.ai || {}),
        },
    };
}

async function loadEscavadorConfig(tenantId) {
    const tenantData = await getTenantSettingsData(tenantId);
    const rawConfig = tenantData?.enrichmentConfig?.escavador;
    if (!rawConfig) return { ...DEFAULT_ESCAVADOR_CONFIG };

    return {
        ...DEFAULT_ESCAVADOR_CONFIG,
        ...rawConfig,
        phases: {
            ...DEFAULT_ESCAVADOR_CONFIG.phases,
            ...(rawConfig.phases || {}),
        },
        filters: {
            ...DEFAULT_ESCAVADOR_CONFIG.filters,
            ...(rawConfig.filters || {}),
        },
    };
}

async function loadJuditConfig(tenantId) {
    const tenantData = await getTenantSettingsData(tenantId);
    const rawConfig = tenantData?.enrichmentConfig?.judit;
    if (!rawConfig) return { ...DEFAULT_JUDIT_CONFIG };

    return {
        ...DEFAULT_JUDIT_CONFIG,
        ...rawConfig,
        phases: {
            ...DEFAULT_JUDIT_CONFIG.phases,
            ...(rawConfig.phases || {}),
        },
        escalation: {
            ...DEFAULT_JUDIT_CONFIG.escalation,
            ...(rawConfig.escalation || {}),
        },
        filters: {
            ...DEFAULT_JUDIT_CONFIG.filters,
            ...(rawConfig.filters || {}),
        },
        realTime: {
            ...DEFAULT_JUDIT_CONFIG.realTime,
            ...(rawConfig.realTime || {}),
        },
        gate: {
            ...DEFAULT_JUDIT_CONFIG.gate,
            ...(tenantData?.enrichmentConfig?.gate || {}),
            ...(rawConfig.gate || {}),
        },
        nameSearchSupplement: {
            ...DEFAULT_JUDIT_CONFIG.nameSearchSupplement,
            ...(rawConfig.nameSearchSupplement || {}),
        },
        persistence: {
            ...DEFAULT_JUDIT_CONFIG.persistence,
            ...(rawConfig.persistence || {}),
        },
    };
}

async function loadBigDataCorpConfig(tenantId) {
    const tenantData = await getTenantSettingsData(tenantId);
    const rawConfig = tenantData?.enrichmentConfig?.bigdatacorp;
    if (!rawConfig) return { ...DEFAULT_BIGDATACORP_CONFIG };

    return {
        ...DEFAULT_BIGDATACORP_CONFIG,
        ...rawConfig,
        phases: {
            ...DEFAULT_BIGDATACORP_CONFIG.phases,
            ...(rawConfig.phases || {}),
        },
        gate: {
            ...DEFAULT_BIGDATACORP_CONFIG.gate,
            ...(tenantData?.enrichmentConfig?.gate || {}),
            ...(rawConfig.gate || {}),
        },
    };
}

async function loadDjenConfig(tenantId) {
    const tenantData = await getTenantSettingsData(tenantId);
    const rawConfig = tenantData?.enrichmentConfig?.djen;
    if (!rawConfig) return { ...DEFAULT_DJEN_CONFIG };

    return {
        ...DEFAULT_DJEN_CONFIG,
        ...rawConfig,
        phases: {
            ...DEFAULT_DJEN_CONFIG.phases,
            ...(rawConfig.phases || {}),
        },
        filters: {
            ...DEFAULT_DJEN_CONFIG.filters,
            ...(rawConfig.filters || {}),
        },
    };
}

function buildJuditCallbackUrl() {
    // Prefer explicit env var, then fall back to the direct Cloud Run URL (v2).
    // The cloudfunctions.net proxy may 302-redirect which some webhook callers don't follow.
    if (process.env.JUDIT_WEBHOOK_URL) return process.env.JUDIT_WEBHOOK_URL;
    return 'https://juditwebhook-dowqa75f4a-rj.a.run.app';
}

async function registerJuditWebhookRequest(requestId, caseId, phaseType, payload = {}) {
    if (!requestId || !caseId || !phaseType) return;

    await getDb().collection('juditWebhookRequests').doc(requestId).set({
        caseId,
        phaseType,
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

module.exports = {
    DEFAULT_ENRICHMENT_CONFIG,
    DEFAULT_ESCAVADOR_CONFIG,
    DEFAULT_JUDIT_CONFIG,
    DEFAULT_BIGDATACORP_CONFIG,
    DEFAULT_DJEN_CONFIG,
    DEFAULT_ANALYSIS_CONFIG,
    getTenantSettingsData,
    getTenantEntitlementsData,
    loadFonteDataConfig,
    loadEscavadorConfig,
    loadJuditConfig,
    loadBigDataCorpConfig,
    loadDjenConfig,
    buildJuditCallbackUrl,
    registerJuditWebhookRequest,
    _setDb,
};
