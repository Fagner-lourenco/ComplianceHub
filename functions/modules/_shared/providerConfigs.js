const { getFirestore } = require('firebase-admin/firestore');

/** Lazy getter — avoids calling getFirestore() before initializeApp(). */
let _db;
let _testDb;
function _getDb() {
    if (_testDb) return _testDb;
    if (!_db) _db = getFirestore();
    return _db;
}

function _setDb(mockDb) {
    _testDb = mockDb;
}

async function getTenantSettingsData(tenantId) {
    if (!tenantId) return null;
    const tenantDoc = await _getDb().collection('tenantSettings').doc(tenantId).get();
    return tenantDoc.exists ? tenantDoc.data() : null;
}

/**
 * Default enrichment config when tenant has none configured.
 * Cenário D structure — all phases configurable.
 */
const DEFAULT_FONTE_DATA_CONFIG = {
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

const DEFAULT_ESCAVADOR2_CONFIG = {
    enabled: false,
    phases: {
        processos: true,
    },
    request: {
        detalhar: true,
        movimentacoes: 'risk_only',
        documentos: 'risk_only',
        limit_movimentacoes: 20,
        limit_documentos: 20,
    },
    async: {
        enabled: true,
        callbackUrlEnv: 'ESCAVADOR2_CALLBACK_URL',
    },
    dedupe: {
        dateToleranceDays: 90,
    },
    persistence: {
        saveRawPayloads: true,
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
        useAsync: false,         // WARNING: DEFAULT=false: sync simples (R.50). Async datalake (R.50/1k) ou on_demand (R.00/1k) apenas se forçado.
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
    enabled: false,           // Optional public source; enable per tenant when needed
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

async function loadFonteDataConfig(tenantId) {
    const tenantData = await getTenantSettingsData(tenantId);
    const rawConfig = tenantData?.enrichmentConfig;
    if (!rawConfig) return { ...DEFAULT_FONTE_DATA_CONFIG };

    return {
        ...DEFAULT_FONTE_DATA_CONFIG,
        ...rawConfig,
        phases: {
            ...DEFAULT_FONTE_DATA_CONFIG.phases,
            ...(rawConfig.phases || {}),
        },
        escalation: {
            ...DEFAULT_FONTE_DATA_CONFIG.escalation,
            ...(rawConfig.escalation || {}),
        },
        filters: {
            ...DEFAULT_FONTE_DATA_CONFIG.filters,
            ...(rawConfig.filters || {}),
        },
        gate: {
            ...DEFAULT_FONTE_DATA_CONFIG.gate,
            ...(rawConfig.gate || {}),
        },
        ai: {
            ...DEFAULT_FONTE_DATA_CONFIG.ai,
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

async function loadEscavador2Config(tenantId) {
    const tenantData = await getTenantSettingsData(tenantId);
    const rawConfig = tenantData?.enrichmentConfig?.escavador2;
    if (!rawConfig) return { ...DEFAULT_ESCAVADOR2_CONFIG };

    return {
        ...DEFAULT_ESCAVADOR2_CONFIG,
        ...rawConfig,
        phases: {
            ...DEFAULT_ESCAVADOR2_CONFIG.phases,
            ...(rawConfig.phases || {}),
        },
        request: {
            ...DEFAULT_ESCAVADOR2_CONFIG.request,
            ...(rawConfig.request || {}),
        },
        async: {
            ...DEFAULT_ESCAVADOR2_CONFIG.async,
            ...(rawConfig.async || {}),
        },
        dedupe: {
            ...DEFAULT_ESCAVADOR2_CONFIG.dedupe,
            ...(rawConfig.dedupe || {}),
        },
        persistence: {
            ...DEFAULT_ESCAVADOR2_CONFIG.persistence,
            ...(rawConfig.persistence || {}),
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

module.exports = {
    DEFAULT_FONTE_DATA_CONFIG,
    DEFAULT_ESCAVADOR_CONFIG,
    DEFAULT_ESCAVADOR2_CONFIG,
    DEFAULT_JUDIT_CONFIG,
    DEFAULT_BIGDATACORP_CONFIG,
    DEFAULT_DJEN_CONFIG,
    loadFonteDataConfig,
    loadEscavadorConfig,
    loadEscavador2Config,
    loadJuditConfig,
    loadBigDataCorpConfig,
    loadDjenConfig,
    getTenantSettingsData,
    _setDb,
};
