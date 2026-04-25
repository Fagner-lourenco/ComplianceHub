/**
 * Cloud Functions: Judit-First Enrichment Pipeline (Datalake-First Strategy)
 *
 * Flow (datalake-first â€” async DISABLED by default):
 * 1. GATE: Judit Entity Data Lake (R$ 0,12) â€” validate CPF active + name similarity
 *    Fallback: FonteData receita-federal-pf (R$ 0,54) if Judit gate fails
 * 2. If gate fails â†’ BLOCKED
 * 3. LAWSUITS: Sync datalake simples (R$ 0,50) â€” DEFAULT. Datalake detalhada (R$ 1,50/1k). On Demand (R$ 6,00/1k) only if forced.
 * 4. PARALLEL: Warrants (R$ 1,00) + Penal Execution (R$ 0,50)
 * 5. NAME SUPPLEMENT: Sync datalake by name if CPF found 0 lawsuits
 * 6. CONDITIONAL: Escavador cross-validation (triggered by criminal/warrant/execution flags)
 * 7. Auto-classification + AI analysis
 *
 * Persistence: request_id, request body, raw response metadata saved per phase.
 */

const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const {
    queryWarrant, queryLabor, queryIdentity,
    queryReceitaFederal, queryProcessosAgrupada, queryProcessosCompleta,
    FonteDataError,
} = require('./adapters/fontedata');
const {
    normalizeReceitaFederal, normalizeIdentity, normalizeProcessos,
    normalizeProcessosCompleta, normalizeWarrant, normalizeLabor,
} = require('./normalizers/phases');
const {
    queryProcessosByPerson,
    EscavadorError,
} = require('./adapters/escavador');
const {
    normalizeEscavadorProcessos,
} = require('./normalizers/escavador');
const {
    queryLawsuitsSync,
    queryLawsuitsSyncByName,
    queryLawsuitsAsync,
    queryWarrantAsync,
    queryExecutionAsync,
    queryEntityDataLake,
    queryLawsuitsByNameAsync,
    fetchResponses,
    checkRequestStatus,
    JuditError,
} = require('./adapters/judit');
const {
    normalizeJuditLawsuits,
    normalizeJuditWarrants,
    normalizeJuditExecution,
    normalizeJuditEntity,
} = require('./normalizers/judit');
const {
    getEscavadorTribunais,
    getJuditTribunais,
} = require('./helpers/tribunalMap');
const {
    buildHomonymAnalysisInput,
} = require('./helpers/aiHomonym');
const {
    queryCombined: queryBigDataCorpCombined,
    BigDataCorpError,
} = require('./adapters/bigdatacorp');
const {
    normalizeBigDataCorpBasicData,
    normalizeBigDataCorpProcesses,
    normalizeBigDataCorpKyc,
    normalizeBigDataCorpProfession,
} = require('./normalizers/bigdatacorp');
const {
    queryComunicacoesByName,
    queryComunicacoesByProcesso,
    DjenError,
} = require('./adapters/djen');
const {
    normalizeDjenComunicacoes,
} = require('./normalizers/djen');
const {
    checkCircuit,
    recordSuccess,
    recordFailure,
} = require('./helpers/circuitBreaker');
const { REPORT_BUILD_VERSION } = require('./reportBuilder.js');
const {
    V2_CORE_VERSION,
    buildClientProjectionContract,
    buildDecisionContract,
    inferProductKey,
    inferRequestedModuleKeys,
    resolvePublicReportAvailability,
    validatePublicationGates,
} = require('./domain/v2Core.js');
const {
    V2_MODULES_VERSION,
    buildModuleRunsForCase,
    summarizeModuleRuns,
    resolveCaseEntitlements,
} = require('./domain/v2Modules.js');
const {
    V2_OPERATIONAL_ARTIFACTS_VERSION,
    buildOperationalArtifactsForCase,
} = require('./domain/v2OperationalArtifacts.js');
const {
    persistRawSnapshotPayloads,
} = require('./domain/v2RawPayloadStorage.js');
const {
    V2_SUBJECTS_VERSION,
    buildSubjectFromCase,
} = require('./domain/v2Subjects.js');
const {
    buildReportSnapshotFromV2,
} = require('./domain/v2ReportSections.js');
const {
    buildUsageMetersForCase,
    groupMeterIdsByModule,
} = require('./domain/v2UsageMeters.js');
const {
    resolveReviewGate,
} = require('./domain/v2ReviewGate.js');
const {
    PERMISSIONS: V2_PERMISSIONS,
    hasPermission: hasV2Permission,
} = require('./domain/v2Rbac.js');
const {
    buildProviderDivergenceResolution,
} = require('./domain/v2ProviderDivergences.js');
const {
    PRODUCT_REGISTRY,
    MODULE_REGISTRY,
} = require('./domain/v2Modules.js');
const {
    resolveSubject,
} = require('./domain/v2SubjectManager.js');
const {
    isTenantFeatureEnabled,
    resolveTenantEntitlements,
} = require('./domain/v2EntitlementResolver.js');
const {
    syncClientCaseListProjection,
} = require('./domain/v2ClientProjectionBuilder.js');
const {
    processWatchlists,
    processSingleWatchlist,
    addToWatchlist,
    pauseWatchlist,
    resumeWatchlist,
    deleteWatchlist,
} = require('./domain/v2MonitoringEngine.js');
const {
    summarizeBillingOverview,
    summarizeUsageMeters,
} = require('./domain/v2BillingResolver.js');
const {
    buildBillingDrilldown,
    buildBillingDrilldownExport,
} = require('./domain/v2BillingDrilldown.js');
const {
    closeBillingPeriod,
} = require('./domain/v2BillingEngine.js');
const {
    buildSeniorReviewRequest,
    buildSeniorReviewRequestId,
    isSeniorReviewApproved,
    summarizeSeniorReviewQueue,
} = require('./domain/v2SeniorReviewQueue.js');
const {
    sanitizeTenantEntitlementPayload,
    buildTenantEntitlementAuditDiff,
} = require('./domain/v2TenantEntitlements.js');
const {
    buildTimelineEventsForCase,
    buildProviderDivergencesForCase,
} = require('./domain/v2Timeline.js');
const {
    buildRelationshipsForCase,
} = require('./domain/v2MiniRelationships.js');
let { writeAuditEvent } = require('./audit/writeAuditEvent');
const { ACTOR_TYPE, SOURCE } = require('./audit/auditCatalog');

initializeApp();
let db = getFirestore();
let storage = getStorage();

const fontedataApiKey = defineSecret('FONTEDATA_API_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');
const escavadorApiToken = defineSecret('ESCAVADOR_API_TOKEN');
const juditApiKey = defineSecret('JUDIT_API_KEY');
const bigdatacorpAccessToken = defineSecret('BIGDATACORP_ACCESS_TOKEN');
const bigdatacorpTokenId = defineSecret('BIGDATACORP_TOKEN_ID');

/**
 * Default enrichment config when tenant has none configured.
 * CenÃ¡rio D structure â€” all phases configurable.
 */
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
        processos: true,  // RESERVED: not consulted at runtime â€” Escavador always queries processos. Kept for future phase-gating.
    },
    filters: {
        incluirHomonimos: true,  // ALWAYS include homonyms â€” critical for non-indexed CPFs
        autoTribunais: false,    // NO tribunal filter by default â€” causes missed processes
        tribunais: [],           // manual override
        status: null,            // 'ATIVO' | null
    },
};

const DEFAULT_JUDIT_CONFIG = {
    enabled: true,
    phases: {
        entity: false,           // R$0.12 â€” gate (Dados Cadastrais Data Lake) â€” OFF by default, BDC is primary
        lawsuits: true,          // R$0.50 simples | R$1.50/1k datalake | R$6.00/1k on_demand
        warrant: true,           // R$1.00 â€” mandado de prisao
        execution: false,        // R$0.50 â€” execucao criminal (default OFF, toggleable per tenant)
    },
    escalation: {
        triggerEscavador: ['criminal', 'warrant', 'execution', 'highProcessCount'],
        processCountThreshold: 5,
    },
    filters: {
        autoTribunals: false,    // NO tribunal filter by default â€” causes missed processes
        tribunals: [],           // manual override
        useAsync: false,         // âš ï¸  DEFAULT=false: sync simples (R$0.50). Async datalake (R$1.50/1k) ou on_demand (R$6.00/1k) apenas se forÃ§ado.
        useWebhook: true,        // warrant/execution are async by contract â€” use callback instead of blocking polling
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
        maxCpfsComNome: 3,       // only search if name has â‰¤ N CPFs (avoid homonym pollution)
        preferSync: true,        // use sync datalake by name (cheaper) instead of async
    },
    persistence: {
        saveRawPayloads: true,   // persist request_id, request body, raw response for audit
    },
};

const DEFAULT_BIGDATACORP_CONFIG = {
    enabled: true,            // PRIMARY provider â€” gate + processes + KYC
    phases: {
        basicData: true,      // R$0.03 â€” identity validation + gate
        processes: true,      // R$0.07 â€” lawsuits with CPF in Parties.Doc
        kyc: true,            // R$0.05 â€” PEP + sanctions (Interpol, FBI, OFAC, etc.)
        occupation: true,     // R$0.05 â€” employment/profession history (included in combined call)
    },
    gate: { minNameSimilarity: 0.7 },
    processLimit: 100,        // Max processes to return per query
};

const DEFAULT_DJEN_CONFIG = {
    enabled: true,            // FREE API â€” no cost, always run
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

function normalizeNameForGate(name) {
    if (!name) return '';
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(de|da|dos|das|do|e)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function computeNameSimilarity(nameA, nameB) {
    const tokensA = new Set(normalizeNameForGate(nameA).split(' ').filter(Boolean));
    const tokensB = new Set(normalizeNameForGate(nameB).split(' ').filter(Boolean));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;
    let intersection = 0;
    for (const t of tokensA) {
        if (tokensB.has(t)) intersection++;
    }
    const union = new Set([...tokensA, ...tokensB]).size;
    return union === 0 ? 0 : intersection / union;
}

function formatDateKey(date, timeZone = 'America/Sao_Paulo') {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : null;
}

function formatMonthKey(date, timeZone = 'America/Sao_Paulo') {
    const dayKey = formatDateKey(date, timeZone);
    return dayKey ? dayKey.slice(0, 7) : null;
}

function previousMonthKey(date = new Date(), timeZone = 'America/Sao_Paulo') {
    const currentMonth = formatMonthKey(date, timeZone);
    if (!currentMonth) return null;
    const [year, month] = currentMonth.split('-').map(Number);
    const previous = new Date(Date.UTC(year, month - 2, 15, 12, 0, 0));
    return formatMonthKey(previous, timeZone);
}

function asDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'string') {
        // Handle DD/MM/YYYY or DD/MM/YYYY HH:mm (Brazilian format from FonteData/DJEN)
        const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (brMatch) {
            const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = brMatch;
            const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
            return Number.isNaN(d.getTime()) ? null : d;
        }
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/* =========================================================
   AI ANALYSIS â€” Structured JSON output with anti-hallucination
   Runs AFTER all providers complete (FonteData + Escavador + Judit)
   ========================================================= */

const AI_MODEL = 'gpt-5.4-nano';
const AI_MAX_TOKENS = 1200;
const AI_MAX_TOKENS_PREFILL = 2400;
const AI_PROMPT_VERSION = 'v3-evidence-based';
const AI_HOMONYM_PROMPT_VERSION = 'v1-homonym-dedicated';
const AI_HOMONYM_CONTEXT_VERSION = 'v1-derived-geo';
const AI_PREFILL_PROMPT_VERSION = 'v1-report-prefill';
const AI_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cost per 1M tokens (USD)
const AI_COST_INPUT = 0.20;
const AI_COST_OUTPUT = 1.25;

// Circuit breaker state (in-memory per instance)
let _aiCircuitFailures = 0;
let _aiCircuitOpenUntil = 0;
const AI_CIRCUIT_THRESHOLD = 3;
const AI_CIRCUIT_COOLDOWN_MS = 10 * 60 * 1000; // 10 min

function estimateAiCostUsd(inputTokens, outputTokens) {
    return (inputTokens / 1_000_000) * AI_COST_INPUT + (outputTokens / 1_000_000) * AI_COST_OUTPUT;
}

const AI_JSON_SCHEMA = {
    resumo: 'string (max 500 chars)',
    inconsistencias: ['string'],
    evidencias: ['string'],
    evidenciasAmbiguas: ['string'],
    incertezas: ['string'],
    cobertura: 'HIGH_COVERAGE|PARTIAL_COVERAGE|LOW_COVERAGE',
    riscoHomonimo: 'ALTO|MEDIO|BAIXO|NENHUM',
    confianca: 'ALTO|MEDIO|BAIXO',
    revisaoManualSugerida: 'boolean',
    sugestaoScore: '0-100',
    sugestaoVeredito: 'FIT|ATTENTION|NOT_RECOMMENDED',
    justificativa: 'string (max 300 chars)',
    alertas: ['string'],
};

const AI_HOMONYM_JSON_SCHEMA = {
    decision: 'LIKELY_MATCH|LIKELY_HOMONYM|UNCERTAIN',
    confidence: 'HIGH|MEDIUM|LOW',
    homonymRisk: 'HIGH|MEDIUM|LOW|NONE',
    justification: 'string (max 300 chars)',
    evidenceFor: ['string'],
    evidenceAgainst: ['string'],
    unknowns: ['string'],
    recommendedAction: 'KEEP|DISCARD|MANUAL_REVIEW',
    processAssessments: [{
        cnj: 'string',
        decision: 'LIKELY_MATCH|LIKELY_HOMONYM|UNCERTAIN',
        reason: 'string',
    }],
};

const AI_PREFILL_JSON_SCHEMA = {
    executiveSummary: 'string (max 900 chars)',
    criminalNotes: 'string (max 2500 chars)',
    laborNotes: 'string (max 1200 chars)',
    warrantNotes: 'string (max 1500 chars)',
    keyFindings: ['string (max 12 items, each max 300 chars)'],
    finalJustification: 'string (max 900 chars)',
};

const AI_SYSTEM_MESSAGE = `Voce e um analista de compliance especializado em due diligence de pessoas fisicas no Brasil.
Responda EXCLUSIVAMENTE em JSON valido conforme o schema abaixo. Nao inclua texto fora do JSON.
Baseie-se APENAS nos dados fornecidos. Nao invente informacoes.
Se dados insuficientes, indique confianca="BAIXO" e justifique.

Schema de resposta (JSON):
${JSON.stringify(AI_JSON_SCHEMA, null, 2)}

Regras:
- resumo: analise executiva em ate 500 caracteres
- inconsistencias: lista de divergencias entre dados fornecidos e consultados
- riscoHomonimo: avalie se ha indicios de homonimia comparando nomes
- confianca: grau de confiabilidade geral dos dados disponÃ­veis
- sugestaoScore: score de risco 0 (nenhum) a 100 (maximo)
- sugestaoVeredito: FIT=apto | ATTENTION=atencao | NOT_RECOMMENDED=nao recomendado
- justificativa: fundamentacao do veredito em ate 300 caracteres
- alertas: pontos criticos que exigem atencao imediata do analista`;

const AI_GENERAL_SYSTEM_MESSAGE = `Voce e um analista de compliance especializado em due diligence de pessoas fisicas no Brasil.
Responda EXCLUSIVAMENTE em JSON valido conforme o schema abaixo. Nao inclua texto fora do JSON.
Baseie-se APENAS nos dados fornecidos. Nao invente informacoes.
Se dados insuficientes, indique confianca="BAIXO", preencha incertezas e justifique.
Fatos duros prevalecem: CPF exato em parte, mandado ativo e execucao penal positiva nao podem ser ignorados.

Schema de resposta (JSON):
${JSON.stringify(AI_JSON_SCHEMA, null, 2)}

Regras:
- resumo: analise executiva em ate 500 caracteres
- inconsistencias: lista de divergencias entre dados fornecidos e consultados
- evidencias: fatos objetivos que sustentam a analise
- evidenciasAmbiguas: achados fracos, por nome ou com risco de homonimo
- incertezas: lacunas ou limites dos dados fornecidos
- cobertura: classifique a cobertura das fontes como HIGH_COVERAGE, PARTIAL_COVERAGE ou LOW_COVERAGE
- riscoHomonimo: avalie se ha indicios de homonimia comparando nomes
- confianca: grau de confiabilidade geral dos dados disponiveis
- revisaoManualSugerida: true quando a decisao depender de evidencia fraca, cobertura insuficiente ou divergencia relevante
- sugestaoScore: score de risco 0 (nenhum) a 100 (maximo)
- sugestaoVeredito: FIT=apto | ATTENTION=atencao | NOT_RECOMMENDED=nao recomendado
- justificativa: fundamentacao do veredito em ate 300 caracteres
- alertas: pontos criticos que exigem atencao imediata do analista
- nao cite informacoes que nao estejam nos dados
- diferencie claramente evidencia confirmada, evidencia ambigua e cobertura insuficiente
- se houver analise especializada de homonimos, use-a como insumo consultivo sobre os achados ambiguos e cite-a explicitamente
- O CPF do candidato aparece parcialmente mascarado (ex: 050.***.***-36) por privacidade. Os digitos visiveis (prefixo e sufixo) SAO confirmados e devem ser usados para cruzamento parcial com registros das fontes.
- Quando a auto-classificacao ou os dados indicarem match por CPF exato (hasExactCpfMatch, matchType='CPF confirmado', evidencia 'HARD_FACT'), isso significa que o sistema ja verificou a correspondencia completa do CPF â€” trate como fato duro confirmado, NAO como incerteza.
- NAO trate o mascaramento do CPF como ausencia de CPF. O CPF existe, foi verificado pelo sistema de enriquecimento, e os achados com CPF confirmado sao do candidato.`;

const AI_HOMONYM_SYSTEM_MESSAGE = `Voce e um analista especializado em desambiguacao de homonimos em due diligence.
Responda EXCLUSIVAMENTE em JSON valido conforme o schema abaixo. Nao inclua texto fora do JSON.
Baseie-se APENAS nos fatos estruturados fornecidos. Nao invente campos, cidades, CPFs ou vinculos.
Se faltar dado, registre isso em unknowns.
Fatos duros prevalecem: CPF exato em parte, mandado ativo e execucao penal positiva nao podem ser relativizados.

Sobre CPF e hardFacts:
- Quando hardFacts incluir JUDIT_EXACT_CPF_MATCH, ESCAVADOR_EXACT_CPF_MATCH ou BDC_EXACT_CPF_MATCH, o candidato TEM CPF confirmado naquela fonte. NAO conclua que o candidato nao possui CPF.
- candidateProfile.cpfConfirmedInProvider=true significa que pelo menos um provider confirmou o CPF por match exato.
- Os ambiguousCandidates sao processos adicionais encontrados por nome ou match fraco â€” eles NAO invalidam os fatos duros do referenceCandidates.
- O CPF do candidato aparece mascarado (ex: 050.***.***-36) por privacidade. O sistema ja verificou a correspondencia completa â€” trate como fato duro.

Schema de resposta (JSON):
${JSON.stringify(AI_HOMONYM_JSON_SCHEMA, null, 2)}

Regras:
- decision: LIKELY_MATCH quando os sinais apontam fortemente para o mesmo individuo
- decision: LIKELY_HOMONYM quando os sinais apontam fortemente para homonimo
- decision: UNCERTAIN quando os dados nao forem suficientes
- evidenceFor: fatos que sustentam ser o mesmo individuo
- evidenceAgainst: fatos que sustentam ser homonimo
- unknowns: dados faltantes ou insuficientes
- recommendedAction: KEEP | DISCARD | MANUAL_REVIEW
- processAssessments: avalie apenas os processos mais relevantes e cite o CNJ quando existir
- justification: curta, objetiva e fiel aos dados
- nunca descarte automaticamente um fato duro`;

const AI_PREFILL_SYSTEM_MESSAGE = `Voce e um analista de compliance redator de relatorios finais para due diligence de pessoas fisicas no Brasil.
Sua funcao e transformar os dados estruturados e as analises de IA em textos de pre-preenchimento para revisao do analista humano.
Responda EXCLUSIVAMENTE em JSON valido conforme o schema abaixo. Nao inclua texto fora do JSON.
Baseie-se APENAS nos dados fornecidos. Nao invente fatos, CPFs, tribunais, datas, processos ou conclusoes ausentes.

Schema de resposta (JSON):
${JSON.stringify(AI_PREFILL_JSON_SCHEMA, null, 2)}

Regras:
- executiveSummary: visao DESCRITIVA e consolidada do caso para o relatorio final (max 900 chars). Deve resumir os achados principais, a cobertura das fontes e os riscos identificados. NAO inclua recomendacao ou veredito aqui.
- criminalNotes: texto estruturado sobre processos criminais/penais seguindo este modelo:
  1. Quantidade total e fontes consultadas
  2. Processos confirmados por CPF vs achados apenas por nome (risco de homonimia)
  3. Para cada processo relevante: CNJ, area, status, papel do candidato (reu/testemunha/vitima), tribunal
  4. Decisoes judiciais quando disponiveis
  5. Divergencias entre providers sobre os mesmos processos
  6. Conclusao sobre a materialidade criminal
- laborNotes: texto estruturado sobre processos trabalhistas seguindo este modelo:
  1. Quantidade total e fontes consultadas
  2. Papel predominante (reclamante vs reclamado)
  3. Processos ativos vs encerrados
  4. Limites de cobertura quando relevantes
- warrantNotes: texto estruturado sobre mandados seguindo este modelo:
  1. Mandados ativos vs inativos, com status de cada um
  2. Tribunal emissor e processo vinculado
  3. Tipo de mandado e tipo de prisao
  4. Texto da decisao judicial quando disponivel
  5. Impacto operacional para contratacao
- keyFindings: lista de ate 12 bullets factuais e materiais para o relatorio. Cada bullet deve ser auto-contido e citar a fonte (ex: "Mandado ativo BNMP-123 no TJSP â€” prisao preventiva (Judit)")
- finalJustification: justificativa PRESCRITIVA do veredito (max 900 chars). Deve recomendar a decisao (apto/atencao/nao recomendado) e fundamentar com os achados mais relevantes. NAO repita o resumo executivo. Foque em: por que este veredito e adequado, quais riscos sao materiais e quais mitigacoes sao possiveis.
- diferencie fato confirmado, evidencia ambigua e lacuna de cobertura
- use a analise especializada de homonimos como insumo consultivo sempre que ela existir e for relevante
- se houver fato duro confirmado, nao o esconda
- nao use linguagem de debug, trace ou implementacao
- se nao houver achado relevante em uma fase, diga isso de forma objetiva sem inventar detalhes
- quando houver dados de profissao, PEP ou sancoes, inclua essas informacoes nos campos pertinentes
- O CPF do candidato aparece parcialmente mascarado por privacidade. Os digitos visiveis SAO confirmados. Quando os dados indicarem match por CPF exato (hasExactCpfMatch, matchType='CPF confirmado'), o sistema ja verificou a correspondencia completa â€” trate como fato duro. NAO trate o mascaramento como ausencia ou incerteza de CPF.`;

function isStringArray(value) {
    return !value || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}

function sanitizeStructuredList(value, maxItems = 8, maxLength = 220) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => sanitizeAiOutput(String(item || '')).replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, maxItems)
        .map((item) => (item.length > maxLength ? `${item.slice(0, maxLength - 3)}...` : item));
}

function sanitizeStructuredText(value, maxLength = 500) {
    if (typeof value !== 'string') return '';
    const normalized = sanitizeAiOutput(value)
        .replace(/[^\S\n]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (!normalized) return '';
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function sanitizeProcessAssessments(items) {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => ({
            cnj: sanitizeStructuredText(item?.cnj || 'N/A', 40) || 'N/A',
            decision: typeof item?.decision === 'string' ? item.decision.toUpperCase() : null,
            reason: sanitizeStructuredText(item?.reason || '', 180),
        }))
        .filter((item) => item.decision && item.reason)
        .slice(0, 8);
}

function stripUndefined(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(stripUndefined);
    if (Object.getPrototypeOf(obj) !== Object.prototype) return obj;
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) continue;
        clean[k] = (v && typeof v === 'object') ? stripUndefined(v) : v;
    }
    return clean;
}

function sanitizeAiStructured(structured) {
    if (!structured || typeof structured !== 'object') return structured;
    return {
        resumo: sanitizeStructuredText(structured.resumo, 500),
        inconsistencias: sanitizeStructuredList(structured.inconsistencias, 8, 220),
        evidencias: sanitizeStructuredList(structured.evidencias, 8, 220),
        evidenciasAmbiguas: sanitizeStructuredList(structured.evidenciasAmbiguas, 8, 220),
        incertezas: sanitizeStructuredList(structured.incertezas, 8, 220),
        cobertura: typeof structured.cobertura === 'string' ? structured.cobertura.toUpperCase() : (structured.cobertura ?? null),
        riscoHomonimo: typeof structured.riscoHomonimo === 'string' ? structured.riscoHomonimo.toUpperCase() : (structured.riscoHomonimo ?? null),
        confianca: typeof structured.confianca === 'string' ? structured.confianca.toUpperCase() : (structured.confianca ?? null),
        revisaoManualSugerida: typeof structured.revisaoManualSugerida === 'boolean' ? structured.revisaoManualSugerida : null,
        sugestaoScore: typeof structured.sugestaoScore === 'number' ? structured.sugestaoScore : null,
        sugestaoVeredito: typeof structured.sugestaoVeredito === 'string' ? structured.sugestaoVeredito.toUpperCase() : (structured.sugestaoVeredito ?? null),
        justificativa: sanitizeStructuredText(structured.justificativa, 300),
        alertas: sanitizeStructuredList(structured.alertas, 8, 220),
    };
}

function sanitizeAiHomonymStructured(structured) {
    if (!structured || typeof structured !== 'object') return structured;
    return {
        decision: typeof structured.decision === 'string' ? structured.decision.toUpperCase() : (structured.decision ?? null),
        confidence: typeof structured.confidence === 'string' ? structured.confidence.toUpperCase() : (structured.confidence ?? null),
        homonymRisk: typeof structured.homonymRisk === 'string' ? structured.homonymRisk.toUpperCase() : (structured.homonymRisk ?? null),
        justification: sanitizeStructuredText(structured.justification, 300),
        evidenceFor: sanitizeStructuredList(structured.evidenceFor, 8, 220),
        evidenceAgainst: sanitizeStructuredList(structured.evidenceAgainst, 8, 220),
        unknowns: sanitizeStructuredList(structured.unknowns, 8, 220),
        recommendedAction: typeof structured.recommendedAction === 'string' ? structured.recommendedAction.toUpperCase() : (structured.recommendedAction ?? null),
        processAssessments: sanitizeProcessAssessments(structured.processAssessments),
    };
}

function sanitizeAiPrefillStructured(structured) {
    if (!structured || typeof structured !== 'object') return structured;
    return {
        executiveSummary: sanitizeStructuredText(structured.executiveSummary, 1200),
        criminalNotes: sanitizeStructuredText(structured.criminalNotes, 4000),
        laborNotes: sanitizeStructuredText(structured.laborNotes, 2000),
        warrantNotes: sanitizeStructuredText(structured.warrantNotes, 2500),
        keyFindings: sanitizeStructuredList(structured.keyFindings, 7, 300),
        finalJustification: sanitizeStructuredText(structured.finalJustification, 1500),
    };
}

/**
 * Parse AI response with 4-layer fallback:
 * 1. Direct JSON.parse
 * 2. Extract JSON from markdown code block
 * 3. Regex field extraction from text
 * 4. Raw text fallback
 */
function parseJsonSchemaResponse(content, validator, fallbackExtractor, sanitizer = (value) => value) {
    if (!content || typeof content !== 'string') {
        return { structured: null, raw: content || '', ok: false };
    }

    try {
        const parsed = sanitizer(JSON.parse(content.trim()));
        if (validator(parsed)) return { structured: parsed, raw: content, ok: true };
        return { structured: parsed, raw: content, ok: false };
    } catch { /* continue */ }

    const mdMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (mdMatch) {
        try {
            const parsed = sanitizer(JSON.parse(mdMatch[1].trim()));
            if (validator(parsed)) return { structured: parsed, raw: content, ok: true };
            return { structured: parsed, raw: content, ok: false };
        } catch { /* continue */ }
    }

    try {
        const extracted = sanitizer(fallbackExtractor?.(content) || null);
        if (extracted && Object.keys(extracted).length > 0) {
            return { structured: extracted, raw: content, ok: validator(extracted) };
        }
    } catch { /* continue */ }

    return { structured: null, raw: content, ok: false };
}

function extractFallbackAiResponse(content) {
    const extracted = {};
    const scoreMatch = content.match(/sugestaoScore['":\s]*(\d{1,3})/i);
    if (scoreMatch) extracted.sugestaoScore = Math.min(100, parseInt(scoreMatch[1], 10));
    const veredictoMatch = content.match(/sugestaoVeredito['":\s]*(FIT|ATTENTION|NOT_RECOMMENDED)/i);
    if (veredictoMatch) extracted.sugestaoVeredito = veredictoMatch[1].toUpperCase();
    const confiancaMatch = content.match(/confianca['":\s]*(ALTO|MEDIO|BAIXO)/i);
    if (confiancaMatch) extracted.confianca = confiancaMatch[1].toUpperCase();
    const coberturaMatch = content.match(/cobertura['":\s]*(HIGH_COVERAGE|PARTIAL_COVERAGE|LOW_COVERAGE)/i);
    if (coberturaMatch) extracted.cobertura = coberturaMatch[1].toUpperCase();
    const riscoMatch = content.match(/riscoHomonimo['":\s]*(ALTO|MEDIO|BAIXO|NENHUM)/i);
    if (riscoMatch) extracted.riscoHomonimo = riscoMatch[1].toUpperCase();
    const reviewMatch = content.match(/revisaoManualSugerida['":\s]*(true|false)/i);
    if (reviewMatch) extracted.revisaoManualSugerida = reviewMatch[1].toLowerCase() === 'true';
    extracted.resumo = content.slice(0, 500);
    return Object.keys(extracted).length > 1 ? extracted : null;
}

function extractFallbackAiHomonymResponse(content) {
    const extracted = {};
    const decisionMatch = content.match(/decision['":\s]*(LIKELY_MATCH|LIKELY_HOMONYM|UNCERTAIN)/i);
    if (decisionMatch) extracted.decision = decisionMatch[1].toUpperCase();
    const confidenceMatch = content.match(/confidence['":\s]*(HIGH|MEDIUM|LOW)/i);
    if (confidenceMatch) extracted.confidence = confidenceMatch[1].toUpperCase();
    const riskMatch = content.match(/homonymRisk['":\s]*(HIGH|MEDIUM|LOW|NONE)/i);
    if (riskMatch) extracted.homonymRisk = riskMatch[1].toUpperCase();
    const actionMatch = content.match(/recommendedAction['":\s]*(KEEP|DISCARD|MANUAL_REVIEW)/i);
    if (actionMatch) extracted.recommendedAction = actionMatch[1].toUpperCase();
    if (Object.keys(extracted).length > 0) {
        extracted.justification = content.slice(0, 300);
    }
    return Object.keys(extracted).length > 1 ? extracted : null;
}

function extractFallbackAiPrefillResponse(content) {
    const extracted = {};
    const textKeys = [
        'executiveSummary',
        'criminalNotes',
        'laborNotes',
        'warrantNotes',
        'finalJustification',
    ];

    textKeys.forEach((key) => {
        const match = content.match(new RegExp(`${key}['":\\s]*([^\\n]+)`, 'i'));
        if (match?.[1]) extracted[key] = match[1].trim();
    });

    const findingsMatch = content.match(/keyFindings['":\s]*\[(.*?)\]/is);
    if (findingsMatch?.[1]) {
        extracted.keyFindings = findingsMatch[1]
            .split(',')
            .map((item) => item.replace(/^["'\s]+|["'\s]+$/g, '').trim())
            .filter(Boolean);
    }

    return Object.keys(extracted).length > 0 ? extracted : null;
}

function parseAiResponse(content) {
    return parseJsonSchemaResponse(content, validateAiSchema, extractFallbackAiResponse, sanitizeAiStructured);
}

function parseAiHomonymResponse(content) {
    return parseJsonSchemaResponse(content, validateAiHomonymSchema, extractFallbackAiHomonymResponse, sanitizeAiHomonymStructured);
}

function parseAiPrefillResponse(content) {
    return parseJsonSchemaResponse(content, validateAiPrefillSchema, extractFallbackAiPrefillResponse, sanitizeAiPrefillStructured);
}

function validateAiSchema(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const validVereditos = ['FIT', 'ATTENTION', 'NOT_RECOMMENDED'];
    const validConfianca = ['ALTO', 'MEDIO', 'BAIXO'];
    const validRisco = ['ALTO', 'MEDIO', 'BAIXO', 'NENHUM'];
    const validCobertura = ['HIGH_COVERAGE', 'PARTIAL_COVERAGE', 'LOW_COVERAGE'];
    if (typeof obj.resumo !== 'string') return false;
    if (typeof obj.justificativa !== 'string') return false;
    if (!isStringArray(obj.inconsistencias)) return false;
    if (!isStringArray(obj.evidencias)) return false;
    if (!isStringArray(obj.evidenciasAmbiguas)) return false;
    if (!isStringArray(obj.incertezas)) return false;
    if (!isStringArray(obj.alertas)) return false;
    if (obj.sugestaoVeredito && !validVereditos.includes(obj.sugestaoVeredito)) return false;
    if (obj.confianca && !validConfianca.includes(obj.confianca)) return false;
    if (obj.riscoHomonimo && !validRisco.includes(obj.riscoHomonimo)) return false;
    if (obj.cobertura && !validCobertura.includes(obj.cobertura)) return false;
    if (obj.revisaoManualSugerida !== undefined && obj.revisaoManualSugerida !== null && typeof obj.revisaoManualSugerida !== 'boolean') return false;
    if (obj.sugestaoScore !== undefined && obj.sugestaoScore !== null && (typeof obj.sugestaoScore !== 'number' || obj.sugestaoScore < 0 || obj.sugestaoScore > 100)) return false;
    return true;
}

function validateAiHomonymSchema(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const validDecision = ['LIKELY_MATCH', 'LIKELY_HOMONYM', 'UNCERTAIN'];
    const validConfidence = ['HIGH', 'MEDIUM', 'LOW'];
    const validRisk = ['HIGH', 'MEDIUM', 'LOW', 'NONE'];
    const validAction = ['KEEP', 'DISCARD', 'MANUAL_REVIEW'];
    if (!validDecision.includes(obj.decision)) return false;
    if (!validConfidence.includes(obj.confidence)) return false;
    if (!validRisk.includes(obj.homonymRisk)) return false;
    if (!validAction.includes(obj.recommendedAction)) return false;
    if (typeof obj.justification !== 'string') return false;
    if (!isStringArray(obj.evidenceFor)) return false;
    if (!isStringArray(obj.evidenceAgainst)) return false;
    if (!isStringArray(obj.unknowns)) return false;
    if (obj.processAssessments && !Array.isArray(obj.processAssessments)) return false;
    if (Array.isArray(obj.processAssessments)) {
        const validAssessments = obj.processAssessments.every((item) =>
            item &&
            typeof item === 'object' &&
            typeof item.reason === 'string' &&
            (!item.cnj || typeof item.cnj === 'string') &&
            validDecision.includes(item.decision));
        if (!validAssessments) return false;
    }
    return true;
}

function validateAiPrefillSchema(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (typeof obj.executiveSummary !== 'string') return false;
    if (typeof obj.criminalNotes !== 'string') return false;
    if (typeof obj.laborNotes !== 'string') return false;
    if (typeof obj.warrantNotes !== 'string') return false;
    if (typeof obj.finalJustification !== 'string') return false;
    if (!isStringArray(obj.keyFindings)) return false;
    return true;
}

/**
 * Sanitize AI response â€” remove any CPF/phone numbers the model may hallucinate.
 */
function sanitizeAiOutput(text) {
    if (!text) return text;
    return text
        .replace(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, '[CPF_REMOVIDO]')
        .replace(/(?<!\d)\(?\d{2}\)?\s?\d{4,5}-?\d{4}(?!\d)/g, '[TEL_REMOVIDO]');
}

function compactErrorMessage(message, maxLength = 180) {
    const normalized = String(message || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 3)}...`;
}

function extractApiErrorMessage(bodyText) {
    if (!bodyText) return '';
    try {
        const parsed = JSON.parse(bodyText);
        return compactErrorMessage(parsed?.error?.message || parsed?.message || bodyText);
    } catch {
        return compactErrorMessage(bodyText);
    }
}

function formatOpenAiError(status, bodyText) {
    const detail = extractApiErrorMessage(bodyText);

    if (status === 400) {
        if (/context length|maximum context length|max tokens|prompt is too long|too many tokens/i.test(detail)) {
            return `IA rejeitou a solicitacao por excesso de contexto (HTTP 400). ${detail}`;
        }
        return `IA rejeitou a solicitacao (HTTP 400). ${detail || 'Verifique o payload enviado ao provedor.'}`;
    }

    if (status === 401 || status === 403) {
        return `Falha de autenticacao com o provedor de IA (HTTP ${status}).`;
    }

    if (status === 429) {
        return 'IA indisponivel temporariamente por limite de taxa do provedor (HTTP 429).';
    }

    if (status >= 500) {
        return `IA indisponivel temporariamente no provedor (HTTP ${status}).`;
    }

    return `Falha na chamada da IA (HTTP ${status}). ${detail || 'Erro nao detalhado pelo provedor.'}`;
}

function formatAiRuntimeError(error) {
    if (error?.name === 'AbortError') {
        return 'IA excedeu o tempo limite de 30s e nao concluiu a resposta.';
    }
    if (error?.message === 'fetch failed') {
        return 'Falha de rede ao consultar a IA.';
    }
    return compactErrorMessage(error?.message || 'Falha inesperada na analise de IA.') || 'Falha inesperada na analise de IA.';
}

function isDoneOrPartial(status) {
    return status === 'DONE' || status === 'PARTIAL';
}

function isSettledProviderStatus(status) {
    return status === 'DONE' || status === 'PARTIAL' || status === 'FAILED' || status === 'SKIPPED' || status === 'BLOCKED';
}

function getAiProvidersIncluded(caseData) {
    return [
        isDoneOrPartial(caseData.enrichmentStatus) ? 'FonteData' : null,
        isDoneOrPartial(caseData.escavadorEnrichmentStatus) ? 'Escavador' : null,
        isDoneOrPartial(caseData.juditEnrichmentStatus) ? 'Judit' : null,
        isDoneOrPartial(caseData.bigdatacorpEnrichmentStatus) ? 'BigDataCorp' : null,
    ].filter(Boolean);
}

function buildAiUpdatePayload(caseData, aiResult, options = {}) {
    const payload = {
        aiModel: aiResult.model || AI_MODEL,
        aiPromptVersion: AI_PROMPT_VERSION,
        aiExecutedAt: FieldValue.serverTimestamp(),
        aiProvidersIncluded: getAiProvidersIncluded(caseData),
        aiFromCache: !!aiResult.fromCache,
        aiError: aiResult.error || null,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (options.aiRunCount !== undefined) {
        payload.aiRunCount = options.aiRunCount;
    }

    if (Object.prototype.hasOwnProperty.call(aiResult, 'analysis')) {
        payload.aiRawResponse = aiResult.analysis || null;
        payload.aiStructured = aiResult.structured || null;
        payload.aiStructuredOk = aiResult.structuredOk || false;
    }

    const costUsd = estimateAiCostUsd(aiResult.inputTokens || 0, aiResult.outputTokens || 0);
    payload.aiCostUsd = parseFloat(costUsd.toFixed(6));
    payload.aiTokens = { input: aiResult.inputTokens || 0, output: aiResult.outputTokens || 0 };
    return stripUndefined(payload);
}

function buildAiHomonymResetPayload(homonymInput = null) {
    return {
        aiHomonymTriggered: false,
        aiHomonymContextVersion: AI_HOMONYM_CONTEXT_VERSION,
        aiHomonymAmbiguityReasons: homonymInput?.ambiguityReasons || [],
        aiHomonymHardFacts: homonymInput?.hardFacts || [],
        aiHomonymStructured: FieldValue.delete(),
        aiHomonymStructuredOk: FieldValue.delete(),
        aiHomonymRawResponse: FieldValue.delete(),
        aiHomonymDecision: FieldValue.delete(),
        aiHomonymConfidence: FieldValue.delete(),
        aiHomonymRisk: FieldValue.delete(),
        aiHomonymRecommendedAction: FieldValue.delete(),
        aiHomonymCostUsd: FieldValue.delete(),
        aiHomonymTokens: FieldValue.delete(),
        aiHomonymExecutedAt: FieldValue.delete(),
        aiHomonymError: FieldValue.delete(),
        aiHomonymFromCache: FieldValue.delete(),
    };
}

function buildAiHomonymUpdatePayload(caseData, homonymInput, aiResult) {
    const payload = {
        aiHomonymTriggered: !!homonymInput?.needsAnalysis,
        aiHomonymContextVersion: AI_HOMONYM_CONTEXT_VERSION,
        aiHomonymAmbiguityReasons: homonymInput?.ambiguityReasons || [],
        aiHomonymHardFacts: homonymInput?.hardFacts || [],
        aiHomonymExecutedAt: FieldValue.serverTimestamp(),
        aiHomonymFromCache: !!aiResult?.fromCache,
        aiHomonymError: aiResult?.error || null,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (Object.prototype.hasOwnProperty.call(aiResult || {}, 'analysis')) {
        payload.aiHomonymRawResponse = aiResult.analysis || null;
        payload.aiHomonymStructured = aiResult.structured || null;
        payload.aiHomonymStructuredOk = aiResult.structuredOk || false;
    }

    if (aiResult?.structuredOk && aiResult?.structured) {
        payload.aiHomonymDecision = aiResult.structured.decision || null;
        payload.aiHomonymConfidence = aiResult.structured.confidence || null;
        payload.aiHomonymRisk = aiResult.structured.homonymRisk || null;
        payload.aiHomonymRecommendedAction = aiResult.structured.recommendedAction || null;
    } else {
        payload.aiHomonymDecision = 'UNCERTAIN';
        payload.aiHomonymConfidence = 'LOW';
        payload.aiHomonymRisk = homonymInput?.needsAnalysis ? 'MEDIUM' : null;
        payload.aiHomonymRecommendedAction = homonymInput?.needsAnalysis ? 'MANUAL_REVIEW' : null;
    }

    const costUsd = estimateAiCostUsd(aiResult?.inputTokens || 0, aiResult?.outputTokens || 0);
    payload.aiHomonymCostUsd = parseFloat(costUsd.toFixed(6));
    payload.aiHomonymTokens = { input: aiResult?.inputTokens || 0, output: aiResult?.outputTokens || 0 };
    return stripUndefined(payload);
}

function buildAiPrefillUpdatePayload(aiResult) {
    const metadata = {
        model: aiResult?.model || AI_MODEL,
        promptVersion: AI_PREFILL_PROMPT_VERSION,
        executedAt: new Date().toISOString(),
        ok: Boolean(aiResult?.structuredOk && aiResult?.structured),
        fromCache: !!aiResult?.fromCache,
        error: aiResult?.error || null,
    };

    return stripUndefined({
        prefillNarratives: {
            ...(aiResult?.structured || {}),
            metadata,
        },
        updatedAt: FieldValue.serverTimestamp(),
    });
}

async function getTenantSettingsData(tenantId) {
    if (!tenantId) return null;
    const tenantDoc = await db.collection('tenantSettings').doc(tenantId).get();
    return tenantDoc.exists ? tenantDoc.data() : null;
}

async function getTenantEntitlementsData(tenantId) {
    if (!tenantId) return null;
    const entitlementDoc = await db.collection('tenantEntitlements').doc(tenantId).get();
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

    await db.collection('juditWebhookRequests').doc(requestId).set({
        caseId,
        phaseType,
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Generate a hash key for AI cache from case enrichment data.
 */
function computeSimpleHash(value) {
    const crypto = require('crypto');
    const input = String(value || '');
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function computeAiCacheKey(caseData, options = {}) {
    const { kind = 'general', context = null, prompt = null } = options;

    if (kind === 'homonym') {
        const serializedContext = JSON.stringify({
            version: AI_HOMONYM_CONTEXT_VERSION,
            context: context || null,
        });
        return `ai_homonym_${computeSimpleHash(serializedContext)}`;
    }

    const promptPayload = JSON.stringify({
        version: AI_PROMPT_VERSION,
        prompt: prompt || '',
    });
    return `ai_${computeSimpleHash(promptPayload)}`;
}

async function runStructuredAiAnalysis({
    caseData,
    apiKey,
    prompt,
    systemMessage,
    cacheDocId,
    cacheKey,
    parser,
    skipCache = false,
    maxTokens = AI_MAX_TOKENS,
}) {
    if (Date.now() < _aiCircuitOpenUntil) {
        console.warn('AI circuit breaker OPEN - skipping analysis.');
        return { error: 'Circuit breaker aberto. IA temporariamente desativada.', inputTokens: 0, outputTokens: 0 };
    }

    const inputEstimate = Math.ceil(prompt.length / 3.5);
    const caseRef = db.collection('cases').doc(caseData.id || caseData._caseId);

    if (!skipCache) {
        try {
            const cacheDoc = await caseRef.collection('aiCache').doc(cacheDocId).get();
            if (cacheDoc.exists) {
                const cached = cacheDoc.data();
                const cacheAge = Date.now() - (cached.cachedAt?.toMillis?.() || 0);
                if (cacheAge < AI_CACHE_TTL_MS && cached.cacheKey === cacheKey) {
                    console.log(`AI cache HIT (${cacheDocId}) for case ${caseData.id || caseData._caseId}`);
                    return {
                        analysis: cached.aiRawResponse,
                        structured: cached.aiStructured,
                        structuredOk: cached.aiStructuredOk,
                        inputTokens: cached.aiTokens?.input || 0,
                        outputTokens: cached.aiTokens?.output || 0,
                        model: cached.aiModel,
                        fromCache: true,
                    };
                }
            }
        } catch (cacheErr) {
            console.warn(`AI cache read failed (${cacheDocId}):`, cacheErr.message);
        }
    }

    let lastError = null;
    let shouldTripCircuit = false;
    for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30000);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    max_completion_tokens: maxTokens,
                    temperature: 0.1,
                    messages: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: prompt },
                    ],
                }),
                signal: controller.signal,
            });

            clearTimeout(timer);

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                lastError = formatOpenAiError(response.status, body);
                console.error(`AI analysis attempt ${attempt + 1} failed (${cacheDocId}): ${response.status} ${body}`);
                if (response.status === 429 || response.status >= 500) {
                    shouldTripCircuit = true;
                    continue;
                }
                return { error: lastError, inputTokens: inputEstimate, outputTokens: 0 };
            }

            _aiCircuitFailures = 0;

            const json = await response.json();
            const usage = json.usage || {};
            const rawContent = json.choices?.[0]?.message?.content || '';
            const sanitized = sanitizeAiOutput(rawContent);
            const parsed = parser(sanitized);

            const result = {
                analysis: sanitized,
                structured: parsed.structured,
                structuredOk: parsed.ok,
                inputTokens: usage.prompt_tokens || inputEstimate,
                outputTokens: usage.completion_tokens || Math.ceil(rawContent.length / 3.5),
                model: AI_MODEL,
                fromCache: false,
            };

            caseRef.collection('aiCache').doc(cacheDocId).set({
                aiRawResponse: result.analysis,
                aiStructured: result.structured || null,
                aiStructuredOk: result.structuredOk,
                aiModel: result.model,
                aiTokens: { input: result.inputTokens, output: result.outputTokens },
                cacheKey,
                cachedAt: FieldValue.serverTimestamp(),
            }).catch((err) => console.warn(`AI cache write failed (${cacheDocId}):`, err.message));

            return result;
        } catch (err) {
            lastError = formatAiRuntimeError(err);
            shouldTripCircuit = true;
            console.error(`AI analysis attempt ${attempt + 1} error (${cacheDocId}):`, err.message);
        }
    }

    if (shouldTripCircuit) {
        _aiCircuitFailures++;
        if (_aiCircuitFailures >= AI_CIRCUIT_THRESHOLD) {
            _aiCircuitOpenUntil = Date.now() + AI_CIRCUIT_COOLDOWN_MS;
            console.error('AI circuit breaker OPENED after consecutive failures.');
        }
    }
    return { error: lastError, inputTokens: inputEstimate, outputTokens: 0 };
}

async function runAiAnalysis(caseData, apiKey, options = {}) {
    const prompt = buildAiPrompt(caseData);
    return runStructuredAiAnalysis({
        caseData,
        apiKey,
        prompt,
        systemMessage: AI_GENERAL_SYSTEM_MESSAGE,
        cacheDocId: 'latest',
        cacheKey: computeAiCacheKey(caseData, { kind: 'general', prompt }),
        parser: parseAiResponse,
        skipCache: options.skipCache === true,
    });
}

/**
 * Normalize CNJ to digits-only for dedup across providers.
 * E.g. "0202743-72.2022.8.06.0167" and "02027437220228060167" â†’ same key.
 */
function normCnj(cnj) { return (cnj || '').replace(/\D/g, ''); }

/**
 * Format raw digits-only CNJ into standard NNNNNNN-DD.YYYY.J.TR.OOOO notation.
 */
function formatCnj(raw) {
    const d = normCnj(raw);
    if (d.length === 20) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16,20)}`;
    return raw || 'N/A';
}

/**
 * Format ISO date string to dd/mm/yyyy (Brazilian format).
 * Returns 'data nÃ£o informada' for null/undefined/invalid input.
 */
function formatDateBR(isoStr) {
    if (!isoStr) return 'data nÃ£o informada';
    const d = asDate(isoStr);
    if (!d || isNaN(d.getTime())) return 'data nÃ£o informada';
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/**
 * Classify a warrant as CIVIL or CRIMINAL based on structured data.
 * BDC `imprisonmentKind` is primary; Judit / decision text is fallback.
 */
function classifyWarrantType(warrant) {
    if (!warrant) return { type: 'CRIMINAL', label: 'PrisÃ£o criminal' };
    // Primary: BDC structured field
    if (/^civil$/i.test(warrant.imprisonmentKind || '')) {
        return { type: 'CIVIL', label: 'PrisÃ£o civil por dÃ­vida alimentar (art. 528, Â§3Âº, CPC)' };
    }
    // Fallback: check decision/judgement text for civil keywords
    const txt = (warrant.decision || warrant.judgementSummary || '').toLowerCase();
    if (/cust[oÃ³]dia\s+civil|art\.\s*528|obriga[Ã§c][aÃ£]o\s+alimentar|d[iÃ­]vida\s+alimentar|pris[aÃ£]o\s+civil/i.test(txt)) {
        return { type: 'CIVIL', label: 'PrisÃ£o civil por dÃ­vida alimentar (art. 528, Â§3Âº, CPC)' };
    }
    // Default
    return { type: 'CRIMINAL', label: 'PrisÃ£o criminal' };
}

/**
 * Detect Carta de Guia in juditRoleSummary for a specific CNJ.
 * Returns { found, tipo: 'DEFINITIVA'|'PROVISÃ“RIA'|null, lastStep }.
 */
function detectCartaDeGuia(juditRoleSummary, cnj) {
    if (!juditRoleSummary || !cnj) return { found: false, tipo: null, lastStep: null };
    const nk = normCnj(cnj);
    for (const entry of juditRoleSummary) {
        if (normCnj(entry.code) !== nk) continue;
        const ls = entry.lastStep || '';
        if (!/carta\s+de\s+guia/i.test(ls)) continue;
        let tipo = null;
        if (/definitiva/i.test(ls)) tipo = 'DEFINITIVA';
        else if (/provis[oÃ³]ria/i.test(ls)) tipo = 'PROVISÃ“RIA';
        return { found: true, tipo, lastStep: ls };
    }
    return { found: false, tipo: null, lastStep: null };
}

/**
 * Find a linked civil process (alimony) for a civil warrant.
 * Matches by same vara or subject containing ALIMENT.
 */
function findLinkedCivilProcess(caseData, warrant) {
    if (!warrant) return null;
    const procs = selectTopProcessos(caseData, 30);
    const varaW = (warrant.agency || warrant.court || '').toLowerCase().replace(/\s+/g, ' ');
    for (const p of procs) {
        if (p.isCriminal) continue;
        // Same CNJ as warrant = skip (that's the warrant itself)
        if (normCnj(p.cnj) === normCnj(warrant.processNumber || warrant.code || '')) continue;
        const assuntoMatch = /aliment/i.test(p.assunto || '') || /aliment/i.test(p.classe || '');
        const varaP = (p.vara || '').toLowerCase().replace(/\s+/g, ' ');
        const sameVara = varaW && varaP && (varaW.includes(varaP) || varaP.includes(varaW));
        if (assuntoMatch || sameVara) {
            return { cnj: formatCnj(p.cnj), assunto: p.assunto || p.classe || 'N/A', status: p.status || 'N/A' };
        }
    }
    return null;
}

/**
 * Extract sentence details (penalty, regime, articles, conviction flag) from BDC decisions array.
 * Uses regex on the semi-structured TJCE/BNMP format: "CHAVE: VALOR;"
 * Returns nullable fields â€” graceful degradation when decisions is null or pattern doesn't match.
 */
function extractSentenceDetails(decisions) {
    const result = { penalty: null, regime: null, situation: null, articles: [], isConviction: false };
    if (!decisions || !Array.isArray(decisions)) return result;
    for (const dec of decisions) {
        const txt = (dec.content || dec.text || '');
        if (!txt) continue;
        const upper = txt.toUpperCase();
        // Conviction detection
        if (/CONDENAR|SENTEN[CÃ‡]A\s+CONDENAT[OÃ“]RIA/i.test(upper)) {
            result.isConviction = true;
        }
        // Penalty: "DETENCAO: SETE MESES E VINTE E OITO DIAS;" or "RECLUSAO: ..."
        const penaltyMatch = upper.match(/(?:DETEN[CÃ‡][AÃƒ]O|RECLUS[AÃƒ]O):\s*(.+?);/);
        if (penaltyMatch && !result.penalty) {
            result.penalty = penaltyMatch[0].replace(/;$/, '').trim();
        }
        // Regime: "REGIME PARA DETENCAO: ABERTO;"
        const regimeMatch = upper.match(/REGIME\s+(?:PARA\s+)?(?:DETEN[CÃ‡][AÃƒ]O|RECLUS[AÃƒ]O):\s*(.+?);/);
        if (regimeMatch && !result.regime) {
            result.regime = regimeMatch[1].trim();
        }
        // Situation: "SITUACAO: REU PRIMARIO;"
        const sitMatch = upper.match(/SITUA[CÃ‡][AÃƒ]O:\s*(.+?);/);
        if (sitMatch && !result.situation) {
            result.situation = sitMatch[1].trim();
        }
        // Articles: "ART. 147 "CAPUT" DO(A) CP" or "ARTIGOS 147 DO CODIGO PENAL"
        const artMatches = txt.match(/ART(?:IGO)?S?\.\s*\d+[-A-Z]*/gi) || [];
        for (const a of artMatches) {
            const normalized = a.replace(/\s+/g, ' ').trim();
            if (!result.articles.includes(normalized)) result.articles.push(normalized);
        }
    }
    return result;
}

/**
 * Format a process as an indented block for narratives.
 * Uses 3-space indentation. Options: showPenalty, showCartaDeGuia, showLastStep.
 */
function formatProcessBlock(proc, options = {}) {
    const indent = '   ';
    const lines = [];
    lines.push(`${indent}Processo: ${formatCnj(proc.cnj)}`);
    if (proc.classe) lines.push(`${indent}Tipo: ${proc.classe}`);
    if (proc.assunto) lines.push(`${indent}Assunto: ${proc.assunto}`);
    const statusStr = proc.phase ? `${proc.status} (fase: ${proc.phase})` : proc.status;
    lines.push(`${indent}Status: ${statusStr || 'N/A'}`);
    if (options.penalty) lines.push(`${indent}Pena: ${options.penalty}`);
    if (options.regime) lines.push(`${indent}Regime: ${options.regime}`);
    if (options.situation) lines.push(`${indent}SituaÃ§Ã£o: ${options.situation}`);
    if (options.articles && options.articles.length > 0) lines.push(`${indent}Artigos: ${options.articles.join(', ')}`);
    if (proc.tribunal && proc.tribunal !== 'N/A') {
        const varaStr = proc.vara ? ` | Vara: ${proc.vara}` : '';
        lines.push(`${indent}Tribunal: ${proc.tribunal}${varaStr}`);
    }
    if (proc.comarca) lines.push(`${indent}Comarca: ${proc.comarca}`);
    const roleStr = proc.specificRole || proc.polo;
    if (roleStr && roleStr !== 'N/A') lines.push(`${indent}Papel: ${roleStr}`);
    const distDate = formatDateBR(proc.distributionDate || proc.data);
    const lastDate = proc.lastMovementDate ? formatDateBR(proc.lastMovementDate) : null;
    if (distDate !== 'data nÃ£o informada' || lastDate) {
        let dateStr = `${indent}DistribuiÃ§Ã£o: ${distDate}`;
        if (lastDate) dateStr += ` | Ãšltima mov.: ${lastDate}`;
        lines.push(dateStr);
    }
    if (options.cartaDeGuia) lines.push(`${indent}Obs.: ${options.cartaDeGuia}`);
    return lines.join('\n');
}

/**
 * Select top-N processos for AI prompt, prioritizing criminal + trabalhista.
 * Merges Judit, Escavador and BigDataCorp arrays, deduplicates by normalized CNJ, sorts by priority.
 */
function selectTopProcessos(caseData, limit = 10) {
    const escavadorProcessos = caseData.escavadorProcessos || [];
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const seen = new Set();
    const all = [];

    for (const p of juditRoleSummary) {
        const cnj = p.code || '';
        if (cnj) seen.add(normCnj(cnj));
        all.push({
            cnj: cnj || 'N/A',
            area: p.area || 'N/A',
            classe: (p.classifications || [])[0] || null,
            assunto: (p.subjects || []).slice(0, 2).join(', ') || null,
            status: p.status || 'N/A',
            polo: p.side || p.personType || 'N/A',
            tribunal: p.tribunalAcronym || 'N/A',
            vara: p.county || null,
            comarca: p.city || null,
            data: p.distributionDate || 'N/A',
            fonte: 'Judit',
            isCriminal: !!p.isCriminal,
            isTrabalhista: /trabalh/i.test(p.area || ''),
            isActive: /ativo|em andamento/i.test(p.status || '') && !/finaliz|arquiv|encerr/i.test(p.status || ''),
            matchType: p.hasExactCpfMatch ? 'CPF confirmado' : (p.isPossibleHomonym ? 'possivel homonimo' : 'match por nome'),
            specificRole: p.personType || p.specificRole || null,
            decisionSummary: p.decisions?.[0]?.content ? p.decisions[0].content.slice(0, 200) : null,
            // v5 enrichment
            lastStep: p.lastStep || null,
            distributionDate: p.distributionDate || null,
            phase: p.phase || null,
            instance: p.instance || null,
            lastMovementDate: null,
            lawsuitAgeDays: null,
            courtLevel: null,
            judgingBody: null,
            allDecisions: null,
        });
    }

    for (const p of escavadorProcessos) {
        const cnj = p.numeroCnj || '';
        const nk = cnj ? normCnj(cnj) : null;
        if (nk && seen.has(nk)) {
            // Merge complementary fields into existing entry
            const existing = all.find((e) => normCnj(e.cnj) === nk);
            if (existing) {
                if (!existing.classe && p.classe) existing.classe = p.classe;
                if (!existing.assunto && p.assuntoPrincipal) existing.assunto = p.assuntoPrincipal;
                if (!existing.decisionSummary && p.decisions?.[0]?.content) existing.decisionSummary = p.decisions[0].content.slice(0, 200);
                if (!existing.specificRole && (p.specificRole || p.tipoNormalizado)) existing.specificRole = p.specificRole || p.tipoNormalizado;
                if (!existing.comarca && p.processCity) existing.comarca = p.processCity;
                // v5 enrichment
                if (!existing.lastStep && p.lastStep) existing.lastStep = p.lastStep;
                existing.fonte = `${existing.fonte}+Escavador`;
            }
            continue;
        }
        if (nk) seen.add(nk);
        all.push({
            cnj: cnj || 'N/A',
            area: p.area || 'N/A',
            classe: p.classe || null,
            assunto: p.assuntoPrincipal || null,
            status: p.status || 'N/A',
            polo: p.polo || p.tipoNormalizado || 'N/A',
            tribunal: p.tribunalSigla || 'N/A',
            vara: null,
            comarca: p.processCity || null,
            data: p.dataInicio || 'N/A',
            fonte: 'Escavador',
            isCriminal: /penal|criminal|crime/i.test(p.area || ''),
            isTrabalhista: /trabalh/i.test(p.area || ''),
            isActive: /ativo|em andamento/i.test(p.status || '') && !/finaliz|arquiv|encerr|baixad/i.test(p.status || ''),
            matchType: p.hasExactCpfMatch || p.tipoMatch === 'CPF' ? 'CPF confirmado' : 'match por nome',
            specificRole: p.specificRole || p.tipoNormalizado || null,
            decisionSummary: p.decisions?.[0]?.content ? p.decisions[0].content.slice(0, 200) : null,
            // v5 enrichment
            lastStep: null,
            distributionDate: p.dataInicio || null,
            phase: null,
            instance: null,
            lastMovementDate: null,
            lawsuitAgeDays: null,
            courtLevel: null,
            judgingBody: null,
            allDecisions: p.decisions || null,
        });
    }

    // BigDataCorp processes (dedup by normalized CNJ, merge complementary fields)
    const bdcProcessos = caseData.bigdatacorpProcessos || [];
    for (const p of bdcProcessos) {
        const cnj = p.numero || '';
        const nk = cnj ? normCnj(cnj) : null;
        if (nk && seen.has(nk)) {
            const existing = all.find((e) => normCnj(e.cnj) === nk);
            if (existing) {
                if (!existing.classe && (p.cnjProcedure || p.tipo)) existing.classe = p.cnjProcedure || p.tipo;
                if (!existing.assunto && (p.assunto || p.cnjSubject)) existing.assunto = p.assunto || p.cnjSubject;
                if (!existing.decisionSummary && p.decisions?.[0]?.content) existing.decisionSummary = p.decisions[0].content.slice(0, 200);
                if (!existing.specificRole && p.specificRole) existing.specificRole = p.specificRole;
                if (!existing.comarca && p.courtDistrict) existing.comarca = p.courtDistrict;
                if (p.isDirectCpfMatch && existing.matchType !== 'CPF confirmado') existing.matchType = 'CPF confirmado';
                // v5 enrichment - merge BDC fields
                if (!existing.courtLevel && p.courtLevel) existing.courtLevel = p.courtLevel;
                if (!existing.judgingBody && p.judgingBody) existing.judgingBody = p.judgingBody;
                if (!existing.lastMovementDate && p.lastMovementDate) existing.lastMovementDate = p.lastMovementDate;
                if (!existing.lawsuitAgeDays && p.lawsuitAgeDays) existing.lawsuitAgeDays = p.lawsuitAgeDays;
                if (!existing.allDecisions && p.decisions) existing.allDecisions = p.decisions;
                existing.fonte = `${existing.fonte}+BigDataCorp`;
            }
            continue;
        }
        if (nk) seen.add(nk);
        all.push({
            cnj: cnj || 'N/A',
            area: p.courtType || p.cnjBroadSubject || 'N/A',
            classe: p.cnjProcedure || p.tipo || null,
            assunto: p.assunto || p.cnjSubject || null,
            status: p.status || 'N/A',
            polo: p.polo || p.partyType || 'N/A',
            tribunal: p.courtName || 'N/A',
            vara: null,
            comarca: p.courtDistrict || null,
            data: p.lastMovementDate || 'N/A',
            fonte: 'BigDataCorp',
            isCriminal: !!p.isCriminal,
            isTrabalhista: !!p.isLabor,
            isActive: /\bativ/i.test(p.status || '') && !/inat/i.test(p.status || ''),
            matchType: p.isDirectCpfMatch ? 'CPF confirmado' : 'match por nome',
            specificRole: p.specificRole || null,
            decisionSummary: p.decisions?.[0]?.content ? p.decisions[0].content.slice(0, 200) : null,
            // v5 enrichment
            lastStep: null,
            distributionDate: null,
            phase: null,
            instance: null,
            lastMovementDate: p.lastMovementDate || null,
            lawsuitAgeDays: p.lawsuitAgeDays || null,
            courtLevel: p.courtLevel || null,
            judgingBody: p.judgingBody || null,
            allDecisions: p.decisions || null,
        });
    }

    all.sort((a, b) => {
        // criminal first, then trabalhista, then active, then rest
        if (a.isCriminal !== b.isCriminal) return a.isCriminal ? -1 : 1;
        if (a.isTrabalhista !== b.isTrabalhista) return a.isTrabalhista ? -1 : 1;
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return 0;
    });

    return all.slice(0, limit);
}

/**
 * Build AI prompt â€” PII-minimized, all providers included.
 * Excludes: motherName, estimatedIncome, addresses, phone numbers.
 */
function buildAiPrompt(caseData) {
    const enrichmentIdentity = caseData.enrichmentIdentity;
    const parts = [
        '--- DADOS DO CANDIDATO ---',
        `Nome informado: ${caseData.candidateName || 'N/A'}`,
        `CPF: ${(caseData.cpf || '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4')}`,
        `Cargo pretendido: ${caseData.candidatePosition || 'N/A'}`,
        `UF contratacao: ${caseData.hiringUf || 'N/A'}`,
    ];

    if (enrichmentIdentity) {
        parts.push('', '--- RECEITA FEDERAL ---');
        parts.push(`Nome RF: ${enrichmentIdentity.name || 'N/A'}`);
        parts.push(`Situacao cadastral: ${enrichmentIdentity.cpfStatus || 'N/A'}`);
        parts.push(`Data nascimento: ${enrichmentIdentity.birthDate || 'N/A'}`);
        // PII removed: motherName, estimatedIncome
    }

    // Judit Identity (primary gate source)
    const juditIdentity = caseData.juditIdentity;
    if (juditIdentity) {
        parts.push('', '--- JUDIT IDENTIDADE (GATE) ---');
        parts.push(`Nome: ${juditIdentity.name || 'N/A'}`);
        parts.push(`CPF ativo: ${juditIdentity.cpfActive ? 'SIM' : 'NAO'}`);
        parts.push(`Data nascimento: ${juditIdentity.birthDate || 'N/A'}`);
        parts.push(`Genero: ${juditIdentity.gender || 'N/A'}`);
        parts.push(`Nacionalidade: ${juditIdentity.nationality || 'N/A'}`);
    }

    // FonteData phases
    const fdPhases = ['identity', 'criminal', 'warrant', 'labor'];
    for (const key of fdPhases) {
        const src = caseData.enrichmentSources?.[key];
        if (!src || src.error) continue;
        parts.push('', `--- FONTEDATA ${key.toUpperCase()} ---`);
        const prefix = `fontedata${key.charAt(0).toUpperCase() + key.slice(1)}`;
        for (const [field, value] of Object.entries(caseData)) {
            if (!field.startsWith(prefix) && !field.startsWith(`${key}Flag`) && !field.startsWith(`${key}Notes`)) continue;
            if (field.endsWith('_source') || value === undefined || value === null || value === '') continue;
            const display = typeof value === 'string' && value.length > 500 ? value.slice(0, 500) + '...' : value;
            parts.push(`${field}: ${typeof display === 'object' ? JSON.stringify(display) : display}`);
        }
    }

    // Escavador
    if (caseData.escavadorEnrichmentStatus === 'DONE' || caseData.escavadorEnrichmentStatus === 'PARTIAL') {
        parts.push('', '--- ESCAVADOR ---');
        parts.push(`Total processos: ${caseData.escavadorProcessTotal || 0}`);
        parts.push(`Criminal: ${caseData.escavadorCriminalFlag || 'NEGATIVE'} (${caseData.escavadorCriminalCount || 0})`);
        if (caseData.escavadorCpfsComEsseNome != null) parts.push(`CPFs com este nome: ${caseData.escavadorCpfsComEsseNome}`);
        if (caseData.escavadorNotes) parts.push(`Resumo: ${caseData.escavadorNotes.slice(0, 500)}`);
    }

    // Judit
    if (caseData.juditEnrichmentStatus === 'DONE' || caseData.juditEnrichmentStatus === 'PARTIAL') {
        parts.push('', '--- JUDIT ---');
        if (caseData.juditProcessTotal != null) parts.push(`Total processos: ${caseData.juditProcessTotal}`);
        parts.push(`Criminal: ${caseData.juditCriminalFlag || 'NEGATIVE'} (${caseData.juditCriminalCount || 0})`);
        parts.push(`Mandado: ${caseData.juditWarrantFlag || 'NEGATIVE'} (ativos: ${caseData.juditActiveWarrantCount || 0})`);
        if (caseData.juditExecutionFlag) parts.push(`Execucao penal: ${caseData.juditExecutionFlag} (${caseData.juditExecutionCount || 0})`);
        if (caseData.juditHomonymFlag) parts.push('ALERTA HOMONIMO: sim');
    }

    // BigDataCorp
    if (caseData.bigdatacorpEnrichmentStatus === 'DONE' || caseData.bigdatacorpEnrichmentStatus === 'PARTIAL') {
        parts.push('', '--- BIGDATACORP ---');
        parts.push(`Nome BDC: ${caseData.bigdatacorpName || 'N/A'}`);
        if (caseData.bigdatacorpNameUniqueness != null) parts.push(`Unicidade do nome: ${caseData.bigdatacorpNameUniqueness}`);
        if (caseData.bigdatacorpHasDeathRecord) parts.push('ALERTA: indicacao de obito na Receita Federal.');
        parts.push(`Total processos: ${caseData.bigdatacorpProcessTotal || 0}`);
        parts.push(`Criminal: ${caseData.bigdatacorpCriminalFlag || 'NEGATIVE'} (${caseData.bigdatacorpCriminalCount || 0})`);
        parts.push(`Trabalhista: ${caseData.bigdatacorpLaborFlag || 'NEGATIVE'} (${caseData.bigdatacorpLaborCount || 0})`);
        if (caseData.bigdatacorpIsPep) parts.push(`PEP: SIM (nivel: ${caseData.bigdatacorpPepLevel || 'N/A'})`);
        if (caseData.bigdatacorpIsSanctioned) parts.push(`SANCIONADO ATUALMENTE: ${caseData.bigdatacorpSanctionCount || 0} sancao(oes)`);
        else if (caseData.bigdatacorpWasSanctioned) parts.push(`Historico de sancao: ${caseData.bigdatacorpSanctionCount || 0} (nao ativa)`);
        if (caseData.bigdatacorpSanctionTypes?.length) parts.push(`Tipos de sancao: ${caseData.bigdatacorpSanctionTypes.join(', ')}`);
        const bdcWarrants = Array.isArray(caseData.bigdatacorpActiveWarrants) ? caseData.bigdatacorpActiveWarrants : [];
        if (bdcWarrants.length > 0) {
            parts.push(`MANDADOS BDC: ${bdcWarrants.length} mandado(s) ativo(s)`);
            bdcWarrants.slice(0, 3).forEach((w, i) => {
                const wParts = [w.processNumber, w.status, w.imprisonmentKind, w.magistrate, w.agency].filter(Boolean);
                parts.push(`  Mandado ${i + 1}: ${wParts.join(' | ')}`);
                if (w.decision) parts.push(`  Decisao: ${w.decision.slice(0, 300)}`);
            });
        }
        const bdcCrim = (caseData.bigdatacorpProcessos || []).filter(p => p.isCriminal);
        if (bdcCrim.length > 0) {
            parts.push(`Processos criminais BDC: ${bdcCrim.length}`);
            bdcCrim.slice(0, 3).forEach((p, i) => {
                const pParts = [p.numero, p.cnjSubject || p.assunto, p.specificRole, p.status].filter(Boolean);
                parts.push(`  Criminal ${i + 1}: ${pParts.join(' | ')}`);
                if (p.decisions?.length > 0) {
                    p.decisions.slice(0, 2).forEach(d => {
                        parts.push(`    Decisao (${d.date || 'N/A'}): ${d.content.slice(0, 200)}`);
                    });
                }
            });
        }
        if (caseData.bigdatacorpProcessNotes) parts.push(`Resumo processos: ${caseData.bigdatacorpProcessNotes.slice(0, 500)}`);
        if (caseData.bigdatacorpKycNotes) parts.push(`KYC: ${caseData.bigdatacorpKycNotes.slice(0, 300)}`);
    }

    // Top-10 processos detalhados (criminal+trabalhista prioritarios)
    const topProcessos = selectTopProcessos(caseData, 10);
    if (topProcessos.length > 0) {
        parts.push('', '--- TOP PROCESSOS DETALHADOS ---');
        for (const p of topProcessos) {
            const extras = [p.matchType, p.specificRole, p.decisionSummary ? `Decisao: ${p.decisionSummary}` : null].filter(Boolean);
            parts.push(`${p.cnj} | ${p.area} | ${p.status} | ${p.polo} | ${p.tribunal} | ${p.data} | Fonte: ${p.fonte}${extras.length ? ` | ${extras.join(' | ')}` : ''}`);
        }
    }

    // Mandados detalhados
    const warrants = caseData.juditWarrants || [];
    if (warrants.length > 0) {
        parts.push('', '--- MANDADOS DE PRISAO ---');
        for (const w of warrants.slice(0, 5)) {
            const wParts = [w.code, w.warrantType, w.arrestType, w.status, w.tribunalAcronym, w.issueDate].filter(Boolean);
            parts.push(wParts.join(' | '));
        }
    }

    // Execucoes penais detalhadas
    const executions = caseData.juditExecutions || [];
    if (executions.length > 0) {
        parts.push('', '--- EXECUCOES PENAIS ---');
        for (const e of executions.slice(0, 5)) {
            const eParts = [e.code, e.name, e.status, e.regime, e.tribunalAcronym].filter(Boolean);
            parts.push(eParts.join(' | '));
        }
    }

    // Auto-classification results
    if (caseData.criminalFlag) parts.push('', '--- AUTO-CLASSIFICACAO ---',
        `Criminal: ${caseData.criminalFlag}`,
        `Mandado: ${caseData.warrantFlag || 'N/A'}`,
        `Trabalhista: ${caseData.laborFlag || 'N/A'}`,
        `PEP: ${caseData.pepFlag || 'N/A'}`,
        `Sancoes: ${caseData.sanctionFlag || 'N/A'}`);
    if (caseData.coverageLevel) parts.push(`Cobertura das fontes: ${caseData.coverageLevel}`);
    if (caseData.providerDivergence) parts.push(`Divergencia entre providers: ${caseData.providerDivergence}`);
    if (caseData.criminalEvidenceQuality) parts.push(`Qualidade da evidencia criminal: ${caseData.criminalEvidenceQuality}`);
    if (Array.isArray(caseData.coverageNotes) && caseData.coverageNotes.length > 0) {
        parts.push(`Notas de cobertura: ${caseData.coverageNotes.join(' | ')}`);
    }
    if (Array.isArray(caseData.ambiguityNotes) && caseData.ambiguityNotes.length > 0) {
        parts.push(`Achados ambiguos: ${caseData.ambiguityNotes.join(' | ')}`);
    }
    if (caseData.criminalNotes) parts.push(`Notas criminal: ${caseData.criminalNotes.slice(0, 300)}`);
    if (caseData.warrantNotes) parts.push(`Notas mandado: ${caseData.warrantNotes.slice(0, 300)}`);
    if (caseData.laborNotes) parts.push(`Notas trabalhista: ${caseData.laborNotes.slice(0, 300)}`);

    if (caseData.aiHomonymStructuredOk && caseData.aiHomonymStructured) {
        parts.push('', '--- ANALISE ESPECIALIZADA DE HOMONIMOS (CONSULTIVA) ---');
        parts.push(`Decisao: ${caseData.aiHomonymStructured.decision || 'N/A'}`);
        parts.push(`Confianca: ${caseData.aiHomonymStructured.confidence || 'N/A'}`);
        parts.push(`Risco de homonimo: ${caseData.aiHomonymStructured.homonymRisk || 'N/A'}`);
        if (caseData.aiHomonymStructured.justification) parts.push(`Justificativa: ${caseData.aiHomonymStructured.justification}`);
        if (caseData.aiHomonymStructured.evidenceFor?.length) parts.push(`Evidencias a favor: ${caseData.aiHomonymStructured.evidenceFor.join(' | ')}`);
        if (caseData.aiHomonymStructured.evidenceAgainst?.length) parts.push(`Evidencias contra: ${caseData.aiHomonymStructured.evidenceAgainst.join(' | ')}`);
        if (caseData.aiHomonymStructured.unknowns?.length) parts.push(`Incertezas: ${caseData.aiHomonymStructured.unknowns.join(' | ')}`);
        if (caseData.aiHomonymStructured.recommendedAction) parts.push(`Acao recomendada: ${caseData.aiHomonymStructured.recommendedAction}`);
    }

    parts.push('', 'Analise todos os dados acima e responda EXCLUSIVAMENTE no JSON conforme o schema solicitado.');
    parts.push('Sempre justifique com fatos observaveis, registre evidencias e incertezas, e nao invente dados ausentes.');
    return parts.join('\n');
}

function buildAiPrefillPrompt(caseData) {
    const topProcessos = selectTopProcessos(caseData, 12).map((item) => ({
        cnj: item.cnj,
        area: item.area,
        status: item.status,
        polo: item.polo,
        tribunal: item.tribunal,
        data: item.data,
        fonte: item.fonte,
        isCriminal: item.isCriminal,
        isTrabalhista: item.isTrabalhista,
        isActive: item.isActive,
        specificRole: item.specificRole || null,
        decisionSummary: item.decisionSummary || null,
    }));
    const juditWarrants = (caseData.juditWarrants || []).slice(0, 6).map((item) => ({
        code: item.code || null,
        status: item.status || null,
        court: item.court || item.tribunalAcronym || null,
        processNumber: item.processNumber || null,
        issueDate: item.issueDate || null,
        warrantType: item.warrantType || null,
        arrestType: item.arrestType || null,
    }));
    const juditExecutions = (caseData.juditExecutions || []).slice(0, 4).map((item) => ({
        processNumber: item.processNumber || item.code || null,
        status: item.status || null,
        court: item.court || item.tribunalAcronym || null,
        phase: item.phase || null,
        source: item.source || 'Judit',
    }));
    const preliminaryProcessHighlights = buildProcessHighlights(caseData).slice(0, 8);
    const preliminaryWarrantFindings = buildWarrantFindings(caseData).slice(0, 6);
    const promptPayload = {
        candidate: {
            name: caseData.candidateName || null,
            cpfMasked: (caseData.cpf || '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4') || caseData.cpfMasked || null,
            position: caseData.candidatePosition || null,
            hiringUf: caseData.hiringUf || null,
        },
        caseContext: {
            status: caseData.status || null,
            tenantName: caseData.tenantName || null,
        },
        classification: {
            criminalFlag: caseData.criminalFlag || null,
            criminalSeverity: caseData.criminalSeverity || null,
            laborFlag: caseData.laborFlag || null,
            laborSeverity: caseData.laborSeverity || null,
            warrantFlag: caseData.warrantFlag || null,
            pepFlag: caseData.pepFlag || null,
            sanctionFlag: caseData.sanctionFlag || null,
            riskScore: caseData.riskScore ?? null,
            riskLevel: caseData.riskLevel || null,
            finalVerdict: caseData.finalVerdict || caseData.aiStructured?.sugestaoVeredito || null,
            reviewRecommended: caseData.reviewRecommended || false,
        },
        coverage: {
            coverageLevel: caseData.coverageLevel || null,
            coverageNotes: caseData.coverageNotes || [],
            providerDivergence: caseData.providerDivergence || null,
            ambiguityNotes: caseData.ambiguityNotes || [],
            criminalEvidenceQuality: caseData.criminalEvidenceQuality || null,
        },
        aiStructured: caseData.aiStructured || null,
        aiHomonymStructured: caseData.aiHomonymStructuredOk ? caseData.aiHomonymStructured : null,
        currentPhaseNotes: {
            criminalNotes: caseData.criminalNotes || null,
            laborNotes: caseData.laborNotes || null,
            warrantNotes: caseData.warrantNotes || null,
        },
        judit: {
            roleSummary: (caseData.juditRoleSummary || []).slice(0, 10),
            warrants: juditWarrants,
            executions: juditExecutions,
        },
        escavador: {
            totalProcessos: caseData.escavadorProcessTotal || 0,
            processos: (caseData.escavadorProcessos || []).slice(0, 10),
        },
        fontedata: {
            criminalFlag: caseData.fontedataCriminalFlag || null,
            criminalNotes: caseData.fontedataCriminalNotes || null,
            laborFlag: caseData.fontedataLaborFlag || null,
            laborNotes: caseData.fontedataLaborNotes || null,
            warrantFlag: caseData.fontedataWarrantFlag || null,
            warrantNotes: caseData.fontedataWarrantNotes || null,
        },
        bigdatacorp: {
            totalProcessos: caseData.bigdatacorpProcessTotal || 0,
            criminalFlag: caseData.bigdatacorpCriminalFlag || null,
            laborFlag: caseData.bigdatacorpLaborFlag || null,
            nameUniqueness: caseData.bigdatacorpNameUniqueness ?? null,
            hasDeathRecord: caseData.bigdatacorpHasDeathRecord || false,
            isPep: caseData.bigdatacorpIsPep || false,
            pepLevel: caseData.bigdatacorpPepLevel || null,
            pepDetails: (caseData.bigdatacorpPepDetails || []).slice(0, 3),
            isSanctioned: caseData.bigdatacorpIsSanctioned || false,
            sanctionCount: caseData.bigdatacorpSanctionCount || 0,
            sanctionTypes: caseData.bigdatacorpSanctionTypes || [],
            sanctionSources: caseData.bigdatacorpSanctionSources || [],
            sanctionDetails: (caseData.bigdatacorpSanctionDetails || []).slice(0, 5),
            activeWarrants: (caseData.bigdatacorpActiveWarrants || []).slice(0, 5),
            processos: (caseData.bigdatacorpProcessos || []).slice(0, 10),
            professionNotes: caseData.bigdatacorpProfessionNotes || null,
        },
        preliminaryHighlights: {
            processHighlights: preliminaryProcessHighlights,
            warrantFindings: preliminaryWarrantFindings,
            topProcessos,
        },
    };

    return [
        'Monte textos de pre-preenchimento para o formulario final do analista.',
        'Os textos devem aproveitar a analise de homonimos, cobertura, divergencia entre providers e os detalhes dos processos/mandados quando isso for material.',
        'Nao invente fatos. Nao use linguagem de debug.',
        'Quando houver ambiguidade, explicite a ambiguidade. Quando houver fato duro confirmado, explicite o fato duro.',
        '',
        JSON.stringify(promptPayload, null, 2),
    ].join('\n');
}

function buildAiHomonymPrompt(homonymInput) {
    const payload = {
        contextVersion: AI_HOMONYM_CONTEXT_VERSION,
        analysisTarget: homonymInput.analysisTarget,
        candidateProfile: homonymInput.candidateProfile,
        providerCoverage: homonymInput.providerCoverage,
        ambiguityReasons: homonymInput.ambiguityReasons,
        hardFacts: homonymInput.hardFacts,
        ambiguousCandidates: (homonymInput.ambiguousCandidates || []).slice(0, 12),
        referenceCandidates: (homonymInput.referenceCandidates || []).slice(0, 8),
        totalCandidatesAnalyzed: homonymInput.processCandidates?.length || 0,
    };

    return [
        'Avalie APENAS a evidencia ambigua abaixo.',
        'A tarefa nao e reavaliar o caso inteiro: voce deve decidir se os achados ambiguos por nome ou match fraco parecem do mesmo individuo ou de homonimos.',
        'Use APENAS o contexto estruturado abaixo.',
        'Se faltar dado para decidir, retorne UNCERTAIN e explique em unknowns.',
        'referenceCandidates e hardFacts sao contexto de apoio e NAO devem ser descartados.',
        'Nao relativize fatos duros como CPF exato em parte, mandado ativo ou execucao penal positiva.',
        '',
        JSON.stringify(payload, null, 2),
    ].join('\n');
}

async function runAiHomonymAnalysis(caseData, homonymInput, apiKey, options = {}) {
    const prompt = buildAiHomonymPrompt(homonymInput);
    const cacheKey = computeAiCacheKey(caseData, { kind: 'homonym', context: homonymInput });
    return runStructuredAiAnalysis({
        caseData,
        apiKey,
        prompt,
        systemMessage: AI_HOMONYM_SYSTEM_MESSAGE,
        cacheDocId: 'homonym',
        cacheKey,
        parser: parseAiHomonymResponse,
        skipCache: options.skipCache === true,
    });
}

async function runAiPrefillAnalysis(caseData, apiKey, options = {}) {
    const prompt = buildAiPrefillPrompt(caseData);
    return runStructuredAiAnalysis({
        caseData,
        apiKey,
        prompt,
        systemMessage: AI_PREFILL_SYSTEM_MESSAGE,
        cacheDocId: 'report_prefill',
        cacheKey: computeAiCacheKey(caseData, { kind: 'general', prompt: `${AI_PREFILL_PROMPT_VERSION}:${prompt}` }),
        parser: parseAiPrefillResponse,
        skipCache: options.skipCache === true,
        maxTokens: AI_MAX_TOKENS_PREFILL,
    });
}

async function runFonteDataEnrichmentPhase(caseRef, caseId, caseData, enrichmentConfig) {
    const cpf = (caseData.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) {
        const error = 'CPF invalido para consulta.';
        console.warn(`Case ${caseId}: invalid CPF length (${cpf.length}), skipping.`);
        await caseRef.update({
            enrichmentStatus: 'FAILED',
            enrichmentError: error,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'FAILED', error };
    }

    await caseRef.update({
        enrichmentStatus: 'RUNNING',
        enrichmentError: null,
        updatedAt: FieldValue.serverTimestamp(),
    });

    const apiKey = fontedataApiKey.value();
    const phases = enrichmentConfig.phases;

    let gateResult;
    try {
        gateResult = normalizeReceitaFederal(await queryReceitaFederal(cpf, apiKey));
    } catch (err) {
        const errMsg = err instanceof FonteDataError
            ? `${err.message} (${err.statusCode})`
            : (err.message || 'Erro desconhecido');
        const error = `Gate de identidade falhou: ${errMsg}`;
        console.error(`Case ${caseId}: identity gate query failed:`, errMsg);
        await caseRef.update({
            enrichmentStatus: 'FAILED',
            enrichmentError: error,
            enrichmentSources: { gate: { error: errMsg, consultedAt: new Date().toISOString() } },
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'FAILED', error };
    }

    const { enrichmentIdentity } = gateResult;
    const gateSource = gateResult._source;
    const cpfStatus = (enrichmentIdentity?.cpfStatus || '').toUpperCase();
    const nameFromAPI = enrichmentIdentity?.name || '';
    const nameProvided = caseData.candidateName || '';
    const minSim = enrichmentConfig.gate?.minNameSimilarity ?? 0.7;

    const cpfPasses = cpfStatus === 'REGULAR';
    const nameSim = computeNameSimilarity(nameFromAPI, nameProvided);
    const namePasses = minSim <= 0 || nameSim >= minSim;
    const gatePassed = cpfPasses && namePasses;
    const hasDeathRecord = enrichmentIdentity?.hasDeathRecord === true;
    const gatePassedFinal = gatePassed && !hasDeathRecord;

    let gateReason = null;
    if (!cpfPasses) gateReason = `CPF com situacao "${cpfStatus}" (esperado: REGULAR).`;
    else if (hasDeathRecord) gateReason = `CPF possui registro de obito (ano: ${enrichmentIdentity.deathYear || 'N/A'}).`;
    else if (!namePasses) gateReason = `Similaridade de nome ${(nameSim * 100).toFixed(0)}% abaixo do limiar ${(minSim * 100).toFixed(0)}%.`;

    const enrichmentGateResult = {
        passed: gatePassedFinal,
        cpfStatus,
        nameSimilarity: parseFloat(nameSim.toFixed(4)),
        nameProvided,
        nameFound: nameFromAPI,
        hasDeathRecord,
        reason: gateReason,
        consultedAt: new Date().toISOString(),
    };

    if (!gatePassedFinal) {
        console.log(`Case ${caseId}: identity gate BLOCKED. ${gateReason}`);
        await caseRef.update({
            enrichmentStatus: 'BLOCKED',
            enrichmentError: null,
            enrichmentIdentity,
            enrichmentGateResult,
            enrichmentSources: { gate: gateSource },
            updatedAt: FieldValue.serverTimestamp(),
        });
        await materializeModuleRunsFromCaseRef(caseRef, caseId, caseData);
        return { status: 'BLOCKED', error: gateReason || null };
    }

    console.log(`Case ${caseId}: identity gate PASSED (similarity: ${(nameSim * 100).toFixed(0)}%).`);

    const uf = enrichmentConfig.filters?.uf || caseData.hiringUf || null;
    const tasks = [];

    // â”€â”€ Circuit Breaker: check FonteData before queuing tasks â”€â”€
    const fontedataCircuit = await checkCircuit('fontedata');
    if (fontedataCircuit.open) {
        console.warn(`Case ${caseId}: FonteData circuit OPEN â€” skipping. ${fontedataCircuit.reason}`);
        await caseRef.update({
            enrichmentStatus: 'PARTIAL',
            enrichmentError: fontedataCircuit.reason,
            enrichmentSources: { gate: gateSource, fontedata: { circuitOpen: true } },
            updatedAt: FieldValue.serverTimestamp(),
        });
    }

    if (!fontedataCircuit.open && phases.identity !== false) {
        tasks.push({
            key: 'identity',
            promise: queryIdentity(cpf, apiKey).then(normalizeIdentity),
        });
    }

    if (!fontedataCircuit.open && phases.criminal !== false) {
        tasks.push({
            key: 'criminal',
            promise: queryProcessosAgrupada(cpf, apiKey).then(normalizeProcessos),
        });
    }

    if (!fontedataCircuit.open && phases.warrant !== false) {
        tasks.push({
            key: 'warrant',
            promise: queryWarrant(cpf, apiKey).then(normalizeWarrant),
        });
    }

    if (!fontedataCircuit.open && phases.labor !== false) {
        tasks.push({
            key: 'labor',
            promise: queryLabor(cpf, apiKey, uf).then(normalizeLabor),
        });
    }

    const results = tasks.length > 0
        ? await Promise.allSettled(tasks.map((task) => task.promise))
        : [];

    const updatePayload = {};
    const enrichmentSources = { gate: gateSource };
    const enrichmentOriginalValues = {};
    const phaseResults = {};
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (let i = 0; i < tasks.length; i++) {
        const { key } = tasks[i];
        const result = results[i];

        if (result.status === 'fulfilled') {
            successCount++;
            const normalized = result.value;
            const { _source, ...fields } = normalized;
            enrichmentSources[key] = _source;
            phaseResults[key] = normalized;

            for (const [field, value] of Object.entries(fields)) {
                if (value !== undefined && value !== null) {
                    updatePayload[field] = value;
                    enrichmentOriginalValues[field] = value;
                }
            }
        } else {
            failCount++;
            const err = result.reason;
            const errMsg = err instanceof FonteDataError
                ? `${err.message} (${err.statusCode})`
                : (err.message || 'Erro desconhecido');
            errors.push(`${key}: ${errMsg}`);
            enrichmentSources[key] = { error: errMsg, consultedAt: new Date().toISOString() };
            console.error(`Case ${caseId}: enrichment phase ${key} failed:`, errMsg);
        }
    }

    // â”€â”€ Circuit Breaker: record FonteData outcome â”€â”€
    if (tasks.length > 0 && !fontedataCircuit.open) {
        if (failCount === 0) {
            recordSuccess('fontedata').catch(() => {});
        } else if (failCount > 0 && successCount === 0) {
            recordFailure('fontedata', errors[0] || 'All phases failed').catch(() => {});
        }
    }

    const escalation = enrichmentConfig.escalation || {};
    if (escalation.enabled !== false) {
        const triggers = escalation.triggers || ['criminal', 'warrant', 'highProcessCount'];
        let shouldEscalate = false;
        const escalationReasons = [];

        if (triggers.includes('criminal') && phaseResults.criminal?.criminalFlag === 'POSITIVE') {
            shouldEscalate = true;
            escalationReasons.push('criminal_detected');
        }
        if (triggers.includes('warrant') && phaseResults.warrant?.warrantFlag === 'POSITIVE') {
            shouldEscalate = true;
            escalationReasons.push('warrant_detected');
        }
        if (triggers.includes('highProcessCount')) {
            const threshold = escalation.processCountThreshold || 5;
            const total = phaseResults.criminal?.processTotal || 0;
            if (total >= threshold) {
                shouldEscalate = true;
                escalationReasons.push(`process_count_${total}>=${threshold}`);
            }
        }

        if (shouldEscalate) {
            console.log(`Case ${caseId}: ESCALATING to processos-completa. Reasons: ${escalationReasons.join(', ')}`);
            try {
                const completaResult = normalizeProcessosCompleta(await queryProcessosCompleta(cpf, apiKey));
                const { _source, ...fields } = completaResult;
                enrichmentSources['processos-completa'] = _source;
                phaseResults['processos-completa'] = completaResult;
                for (const [field, value] of Object.entries(fields)) {
                    if (value !== undefined && value !== null) {
                        updatePayload[field] = value;
                        enrichmentOriginalValues[field] = value;
                    }
                }
                successCount++;
            } catch (err) {
                const errMsg = err instanceof FonteDataError
                    ? `${err.message} (${err.statusCode})`
                    : (err.message || 'Erro desconhecido');
                errors.push(`processos-completa: ${errMsg}`);
                enrichmentSources['processos-completa'] = { error: errMsg, consultedAt: new Date().toISOString() };
                console.error(`Case ${caseId}: escalation failed:`, errMsg);
            }
        }

        updatePayload.escalation = {
            triggered: shouldEscalate,
            reasons: escalationReasons,
        };
    }

    const totalPhases = tasks.length;
    let enrichmentStatus;
    if (totalPhases === 0) {
        enrichmentStatus = 'DONE';
    } else if (failCount === 0) {
        enrichmentStatus = 'DONE';
    } else if (successCount > 0) {
        enrichmentStatus = 'PARTIAL';
    } else {
        enrichmentStatus = 'FAILED';
    }

    const identityContact = phaseResults.identity?.enrichmentContact;
    const enrichmentPrimaryUf = identityContact?.primaryUf || uf || null;
    const enrichmentAllUfs = identityContact?.allUfs || (uf ? [uf] : []);
    const error = errors.length > 0 ? errors.join('; ') : null;

    await caseRef.update({
        ...updatePayload,
        enrichmentStatus,
        enrichmentIdentity,
        enrichmentGateResult,
        enrichmentSources,
        enrichmentOriginalValues,
        enrichmentPrimaryUf,
        enrichmentAllUfs,
        enrichmentError: error,
        enrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    await materializeModuleRunsFromCaseRef(caseRef, caseId, caseData);

    const totalCost = Object.values(enrichmentSources)
        .map((source) => parseFloat(source.cost) || 0)
        .reduce((sum, value) => sum + value, 0);

    console.log(
        `Case ${caseId}: enrichment ${enrichmentStatus}. ` +
        `Success: ${successCount + 1}/${totalPhases + 1}. ` +
        `Cost: R$ ${totalCost.toFixed(2)}.`,
    );

    return { status: enrichmentStatus, error, enrichmentPrimaryUf, enrichmentAllUfs };
}

async function runEscavadorEnrichmentPhase(caseRef, caseId, caseData, escavadorConfig, options = {}) {
    const cpf = (caseData.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) {
        const error = 'CPF invalido.';
        await caseRef.update({
            escavadorEnrichmentStatus: 'FAILED',
            escavadorError: error,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'FAILED', error };
    }

    await caseRef.update({
        escavadorEnrichmentStatus: 'RUNNING',
        escavadorError: null,
        updatedAt: FieldValue.serverTimestamp(),
    });

    const token = escavadorApiToken.value();
    if (!token) {
        const error = 'ESCAVADOR_API_TOKEN nao configurado.';
        await caseRef.update({
            escavadorEnrichmentStatus: 'FAILED',
            escavadorError: error,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'FAILED', error };
    }

    // â”€â”€ Circuit Breaker: check Escavador â”€â”€
    const escCircuit = await checkCircuit('escavador');
    if (escCircuit.open) {
        console.warn(`Case ${caseId} [Escavador]: circuit OPEN â€” skipping. ${escCircuit.reason}`);
        await caseRef.update({
            escavadorEnrichmentStatus: 'SKIPPED',
            escavadorError: escCircuit.reason,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'SKIPPED', error: escCircuit.reason };
    }

    try {
        const filters = escavadorConfig.filters || {};
        const ufs = caseData.juditAllUfs || caseData.enrichmentAllUfs || (caseData.juditPrimaryUf ? [caseData.juditPrimaryUf] : caseData.enrichmentPrimaryUf ? [caseData.enrichmentPrimaryUf] : (caseData.hiringUf ? [caseData.hiringUf] : []));
        let tribunais = filters.tribunais?.length > 0 ? filters.tribunais : [];
        if (tribunais.length === 0 && filters.autoTribunais === true && ufs.length > 0) {
            tribunais = getEscavadorTribunais(ufs);
        }

        const queryOptions = {
            limit: 100,
            incluirHomonimos: filters.incluirHomonimos !== false,
            tribunais: tribunais.length > 0 ? tribunais : undefined,
            status: filters.status || undefined,
        };

        console.log(`Case ${caseId} [Escavador]: querying CPF=${cpf}, UFs=${ufs.join(',')}, tribunais=${tribunais.join(',') || 'all'}`);

        const rawItems = await queryProcessosByPerson(cpf, token, queryOptions);
        const normalized = normalizeEscavadorProcessos(rawItems, cpf);
        const { _source, ...fields } = normalized;

        // Escavador V2 pricing: R$3.00 per "Processos do envolvido" (up to 200 items) + R$3.00 per additional 200
        const totalProcessos = fields.escavadorProcessTotal || rawItems.items?.length || 0;
        const escavadorCostBRL = Math.max(1, Math.ceil(totalProcessos / 200)) * 3.00;

        await caseRef.update({
            ...fields,
            escavadorEnrichmentStatus: 'DONE',
            escavadorError: null,
            escavadorSources: _source,
            escavadorCostBRL,
            escavadorEnrichedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await materializeModuleRunsFromCaseRef(caseRef, caseId, caseData);

        console.log(
            `Case ${caseId} [Escavador]: DONE. ` +
            `Processos: ${fields.escavadorProcessTotal || 0}, ` +
            `Criminal: ${fields.escavadorCriminalFlag || 'NEGATIVE'}, ` +
            `Tribunais filter: [${tribunais.join(',')}].`,
        );

        recordSuccess('escavador').catch(() => {});

        if (!options.skipAutoClassify) {
            const freshDoc = await caseRef.get();
            const freshData = freshDoc.data() || {};
            if (isSettledProviderStatus(freshData.juditEnrichmentStatus)) {
                try {
                    await runAutoClassifyAndAi(caseRef, caseId, freshData);
                } catch (classifyErr) {
                    console.error(`Case ${caseId} [AutoClassify via Escavador]: error:`, classifyErr.message);
                }
            }
        }

        return { status: 'DONE', error: null };
    } catch (err) {
        const errMsg = err instanceof EscavadorError
            ? `${err.message} (${err.statusCode})`
            : (err.message || 'Erro desconhecido');
        console.error(`Case ${caseId} [Escavador]: failed:`, errMsg);
        recordFailure('escavador', errMsg).catch(() => {});
        await caseRef.update({
            escavadorEnrichmentStatus: 'FAILED',
            escavadorError: errMsg,
            updatedAt: FieldValue.serverTimestamp(),
        });
        await materializeModuleRunsFromCaseRef(caseRef, caseId, caseData);

        // Run auto-classify even on failure â€” Escavador data is supplementary
        if (!options.skipAutoClassify) {
            try {
                const freshDoc = await caseRef.get();
                const freshData = freshDoc.data() || {};
                if (isSettledProviderStatus(freshData.juditEnrichmentStatus)) {
                    await runAutoClassifyAndAi(caseRef, caseId, freshData);
                }
            } catch (classifyErr) {
                console.error(`Case ${caseId} [AutoClassify via Escavador failure]: error:`, classifyErr.message);
            }
        }

        return { status: 'FAILED', error: errMsg };
    }
}

/* =========================================================
   BIGDATACORP â€” Enrichment Phase (4 datasets in 1 POST)
   Runs basic_data + processes + kyc + occupation_data combined.
   Disabled by default â€” requires explicit tenant enablement.
   ========================================================= */

async function runBigDataCorpEnrichmentPhase(caseRef, caseId, caseData, bdcConfig, options = {}) {
    const cpf = (caseData.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) {
        const error = 'CPF invalido.';
        await caseRef.update({
            bigdatacorpEnrichmentStatus: 'FAILED',
            bigdatacorpError: error,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'FAILED', error };
    }

    await caseRef.update({
        bigdatacorpEnrichmentStatus: 'RUNNING',
        bigdatacorpError: null,
        updatedAt: FieldValue.serverTimestamp(),
    });

    const accessToken = bigdatacorpAccessToken.value();
    const tokenId = bigdatacorpTokenId.value();
    if (!accessToken || !tokenId) {
        const error = 'BIGDATACORP_ACCESS_TOKEN ou BIGDATACORP_TOKEN_ID nao configurado.';
        await caseRef.update({
            bigdatacorpEnrichmentStatus: 'FAILED',
            bigdatacorpError: error,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'FAILED', error };
    }

    // Circuit Breaker: check BigDataCorp
    const bdcCircuit = await checkCircuit('bigdatacorp');
    if (bdcCircuit.open) {
        console.warn(`Case ${caseId} [BigDataCorp]: circuit OPEN â€” skipping. ${bdcCircuit.reason}`);
        await caseRef.update({
            bigdatacorpEnrichmentStatus: 'SKIPPED',
            bigdatacorpError: bdcCircuit.reason,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'SKIPPED', error: bdcCircuit.reason };
    }

    try {
        const credentials = { accessToken, tokenId };
        const processLimit = bdcConfig.processLimit || 100;

        console.log(`Case ${caseId} [BigDataCorp]: querying CPF=${cpf}, processLimit=${processLimit}`);

        const result = await queryBigDataCorpCombined(cpf, credentials, { processLimit });

        // Normalize each dataset
        const phases = bdcConfig.phases || {};
        const updatePayload = {};
        const sources = {};
        let costBRL = 0;

        if (phases.basicData !== false) {
            const basicNorm = normalizeBigDataCorpBasicData(result.basicData);
            const { _source: basicSource, ...basicFields } = basicNorm;
            Object.assign(updatePayload, basicFields);
            sources.basicData = basicSource;
            costBRL += 0.03;
        }

        // â”€â”€â”€ GATE: BDC Basic Data (cpfStatus + name similarity + death record) â”€â”€â”€
        if (!options.skipGate && updatePayload.bigdatacorpCpfStatus) {
            const nameFromBDC = updatePayload.bigdatacorpName || '';
            const nameProvided = caseData.candidateName || '';
            const minSim = bdcConfig.gate?.minNameSimilarity ?? 0.7;
            const cpfStatusBDC = (updatePayload.bigdatacorpCpfStatus || '').toUpperCase();
            const cpfPasses = cpfStatusBDC === 'REGULAR';
            const nameSim = computeNameSimilarity(nameFromBDC, nameProvided);
            const namePasses = minSim <= 0 || nameSim >= minSim;
            const hasDeathRecord = updatePayload.bigdatacorpHasDeathRecord === true;
            const gatePassed = cpfPasses && namePasses && !hasDeathRecord;

            const gateReason = !cpfPasses ? `CPF status ${cpfStatusBDC}`
                : !namePasses ? `Similaridade insuficiente: ${nameSim.toFixed(2)} < ${minSim}`
                : hasDeathRecord ? 'Indicacao de obito'
                : 'OK';

            const bigdatacorpGateResult = {
                passed: gatePassed,
                cpfStatus: cpfStatusBDC,
                nameSimilarity: nameSim,
                nameProvided,
                nameFound: nameFromBDC,
                hasDeathRecord,
                reason: gateReason,
                source: 'bigdatacorp-basicdata',
                consultedAt: new Date().toISOString(),
            };

            if (!gatePassed) {
                await caseRef.update({
                    ...updatePayload,
                    bigdatacorpGateResult,
                    bigdatacorpEnrichmentStatus: 'BLOCKED',
                    bigdatacorpError: `Gate bloqueado: ${gateReason}`,
                    bigdatacorpSources: sources,
                    bigdatacorpCostBRL: costBRL,
                    bigdatacorpElapsedMs: result.elapsedMs,
                    bigdatacorpQueryDate: new Date().toISOString(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                await materializeModuleRunsFromCaseRef(caseRef, caseId, caseData);
                console.log(`Case ${caseId} [BigDataCorp]: BLOCKED â€” ${gateReason}`);
                return { status: 'BLOCKED', error: gateReason };
            }

            updatePayload.bigdatacorpGateResult = bigdatacorpGateResult;
        }

        if (phases.processes !== false) {
            const processNorm = normalizeBigDataCorpProcesses(result.processes, cpf);
            const { _source: processSource, ...processFields } = processNorm;
            Object.assign(updatePayload, processFields);
            sources.processes = processSource;
            costBRL += 0.07;
        }

        if (phases.kyc !== false) {
            const kycNorm = normalizeBigDataCorpKyc(result.kycData);
            const { _source: kycSource, ...kycFields } = kycNorm;
            Object.assign(updatePayload, kycFields);
            sources.kyc = kycSource;
            costBRL += 0.05;
        }

        if (phases.occupation !== false) {
            const profNorm = normalizeBigDataCorpProfession(result.professionData);
            const { _source: profSource, ...profFields } = profNorm;
            Object.assign(updatePayload, profFields);
            sources.occupation = profSource;
            costBRL += 0.05;
        }

        await caseRef.update({
            ...updatePayload,
            bigdatacorpEnrichmentStatus: 'DONE',
            bigdatacorpError: null,
            bigdatacorpSources: sources,
            bigdatacorpCostBRL: costBRL,
            bigdatacorpElapsedMs: result.elapsedMs,
            bigdatacorpQueryDate: new Date().toISOString(),
            bigdatacorpEnrichedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        await materializeModuleRunsFromCaseRef(caseRef, caseId, caseData);

        console.log(
            `Case ${caseId} [BigDataCorp]: DONE in ${result.elapsedMs}ms. ` +
            `Processos: ${updatePayload.bigdatacorpProcessTotal || 0}, ` +
            `Criminal: ${updatePayload.bigdatacorpCriminalFlag || 'NEGATIVE'}, ` +
            `PEP: ${updatePayload.bigdatacorpIsPep || false}, ` +
            `Sanctioned: ${updatePayload.bigdatacorpIsSanctioned || false}.`,
        );

        recordSuccess('bigdatacorp').catch(() => {});

        // Re-run auto-classify if all other providers are settled
        if (!options.skipAutoClassify) {
            const freshDoc = await caseRef.get();
            const freshData = freshDoc.data() || {};
            if (isSettledProviderStatus(freshData.juditEnrichmentStatus)) {
                try {
                    await runAutoClassifyAndAi(caseRef, caseId, freshData);
                } catch (classifyErr) {
                    console.error(`Case ${caseId} [AutoClassify via BigDataCorp]: error:`, classifyErr.message);
                }
            }
        }

        return { status: 'DONE', error: null };
    } catch (err) {
        const errMsg = err instanceof BigDataCorpError
            ? `${err.message} (${err.statusCode})`
            : (err.message || 'Erro desconhecido');
        console.error(`Case ${caseId} [BigDataCorp]: failed:`, errMsg);
        recordFailure('bigdatacorp', errMsg).catch(() => {});
        await caseRef.update({
            bigdatacorpEnrichmentStatus: 'FAILED',
            bigdatacorpError: errMsg,
            updatedAt: FieldValue.serverTimestamp(),
        });
        await materializeModuleRunsFromCaseRef(caseRef, caseId, caseData);
        return { status: 'FAILED', error: errMsg };
    }
}

/* =========================================================
   ESCAVADOR NEED EVALUATION â€” Determines if Escavador
   should run as cross-validation after Judit completes.
   ========================================================= */

function evaluateEscavadorNeed(juditResults, juditConfig) {
    const triggers = juditConfig.escalation?.triggerEscavador || ['criminal', 'warrant', 'execution', 'highProcessCount'];
    const threshold = juditConfig.escalation?.processCountThreshold || 5;

    if (triggers.includes('criminal') && juditResults.juditCriminalFlag === 'POSITIVE') return true;
    if (triggers.includes('warrant') && juditResults.juditWarrantFlag === 'POSITIVE') return true;
    if (triggers.includes('execution') && juditResults.juditExecutionFlag === 'POSITIVE') return true;
    if (triggers.includes('highProcessCount') && (juditResults.juditProcessTotal || 0) >= threshold) return true;

    return false;
}

function evaluateNegativePartialSafetyNet(caseData, autoClassification = {}) {
    const escavadorStatus = caseData.escavadorEnrichmentStatus;
    const escavadorAlreadyHandled = ['RUNNING', 'DONE', 'PARTIAL', 'FAILED', 'SKIPPED'].includes(escavadorStatus);
    const criminalFlag = autoClassification.criminalFlag;
    const reasons = [];

    if (!['NEGATIVE_PARTIAL', 'INCONCLUSIVE_LOW_COVERAGE'].includes(criminalFlag)) {
        return { eligible: false, reasons: [], action: 'NONE' };
    }

    if (escavadorAlreadyHandled) {
        return { eligible: false, reasons: [], action: 'NONE' };
    }

    if (autoClassification.coverageLevel === 'LOW_COVERAGE') {
        reasons.push('LOW_COVERAGE');
    }
    if (autoClassification.providerDivergence === 'HIGH') {
        reasons.push('HIGH_PROVIDER_DIVERGENCE');
    }
    if ((caseData.juditProcessTotal || 0) === 0) {
        reasons.push('JUDIT_ZERO_PROCESS');
    }
    if (caseData.juditNameSearchFlag === 'SKIPPED_HOMONYMS') {
        reasons.push('NAME_SEARCH_SKIPPED_HOMONYMS');
    }
    if (caseData.juditNameSearchFlag === 'FOUND') {
        reasons.push('NAME_SEARCH_ONLY_RESULT');
    }
    if (autoClassification.reviewRecommended) {
        reasons.push('MANUAL_REVIEW_RECOMMENDED');
    }

    return {
        eligible: reasons.length > 0,
        reasons,
        action: reasons.length > 0 ? 'RUN_ESCAVADOR' : 'NONE',
    };
}

async function runJuditEnrichmentPhase(caseRef, caseId, caseData, juditConfig, options = {}) {
    const cpf = (caseData.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) {
        const error = 'CPF invalido.';
        await caseRef.update({
            juditEnrichmentStatus: 'FAILED',
            juditError: error,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'FAILED', error };
    }

    await caseRef.update({
        juditEnrichmentStatus: 'RUNNING',
        juditError: null,
        updatedAt: FieldValue.serverTimestamp(),
    });

    const apiKey = juditApiKey.value();
    if (!apiKey) {
        const error = 'JUDIT_API_KEY nao configurado.';
        await caseRef.update({
            juditEnrichmentStatus: 'FAILED',
            juditError: error,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'FAILED', error };
    }

    // â”€â”€ Circuit Breaker: check Judit â”€â”€
    const juditCircuit = await checkCircuit('judit');
    if (juditCircuit.open) {
        console.warn(`Case ${caseId} [Judit]: circuit OPEN â€” skipping. ${juditCircuit.reason}`);
        await caseRef.update({
            juditEnrichmentStatus: 'SKIPPED',
            juditError: juditCircuit.reason,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'SKIPPED', error: juditCircuit.reason };
    }

    const phases = juditConfig.phases;

    // â”€â”€â”€ GATE: BDC-primary â†’ Judit-fallback â†’ FonteData-fallback â”€â”€â”€
    // Priority: 1) BigDataCorp gate result  2) Judit Entity  3) FonteData Receita Federal
    let gateEntityData = null;
    let entityUfs = [];
    if (!options.skipGate && phases.entity !== false) {
        const existingGate = caseData.juditGateResult;
        if (existingGate?.passed === true) {
            console.log(`Case ${caseId} [Judit]: gate already passed (source: ${existingGate.source}), skipping gate.`);
            entityUfs = caseData.juditAllUfs || [];
        } else if (
            caseData.bigdatacorpEnrichmentStatus === 'DONE' &&
            caseData.bigdatacorpGateResult?.passed === true
        ) {
            // â”€â”€ BDC gate passed â†’ reuse BDC identity, skip Judit gate â”€â”€
            const bdcGate = caseData.bigdatacorpGateResult;
            console.log(`Case ${caseId} [Judit]: using BigDataCorp identity gate (similarity: ${((bdcGate.nameSimilarity || 0) * 100).toFixed(0)}%).`);

            const juditGateResult = {
                passed: true,
                cpfActive: true,
                cpfStatus: bdcGate.cpfStatus || 'REGULAR',
                nameSimilarity: bdcGate.nameSimilarity,
                nameProvided: bdcGate.nameProvided,
                nameFound: bdcGate.nameFound,
                hasDeathRecord: bdcGate.hasDeathRecord || false,
                reason: null,
                source: 'bigdatacorp-primary',
                consultedAt: new Date().toISOString(),
            };
            const fallbackIdentity = {
                name: caseData.bigdatacorpName || bdcGate.nameFound || '',
                cpfActive: true,
                cpfStatus: bdcGate.cpfStatus || 'REGULAR',
                birthDate: caseData.bigdatacorpBirthDate || null,
                hasDeathRecord: bdcGate.hasDeathRecord || false,
                consultedAt: new Date().toISOString(),
            };

            // Still query Judit Entity for UFs (needed for tribunal-directed searches)
            try {
                const entityRaw = await queryEntityDataLake(cpf, apiKey);
                gateEntityData = normalizeJuditEntity(entityRaw, cpf);
                entityUfs = gateEntityData.juditAllUfs || [];
                console.log(`Case ${caseId} [Judit]: Entity UFs fetched: [${entityUfs.join(', ')}].`);

                await caseRef.update({
                    juditIdentity: fallbackIdentity,
                    juditGateResult,
                    juditPrimaryUf: gateEntityData.juditPrimaryUf,
                    juditAllUfs: entityUfs,
                    juditHasLawsuits: gateEntityData.juditHasLawsuits,
                    updatedAt: FieldValue.serverTimestamp(),
                });
            } catch (entityErr) {
                // Entity query failed â€” use hiringUf as fallback for UFs
                const uf = caseData.hiringUf || null;
                entityUfs = uf ? [uf] : [];
                console.warn(`Case ${caseId} [Judit]: Entity UF query failed (${entityErr.message}), using hiringUf=[${entityUfs.join(', ')}].`);

                await caseRef.update({
                    juditIdentity: fallbackIdentity,
                    juditGateResult,
                    juditPrimaryUf: uf,
                    juditAllUfs: entityUfs,
                    updatedAt: FieldValue.serverTimestamp(),
                });
            }
        } else {
            // â”€â”€ BDC did not pass gate â†’ run Judit gate as fallback â”€â”€
            const bdcStatus = caseData.bigdatacorpEnrichmentStatus || 'N/A';
            console.log(`Case ${caseId} [Judit]: BDC status=${bdcStatus}, running Judit identity gate as fallback.`);
            try {
                const entityRaw = await queryEntityDataLake(cpf, apiKey);
                gateEntityData = normalizeJuditEntity(entityRaw, cpf);

                const { juditIdentity } = gateEntityData;
                const cpfActive = juditIdentity.cpfActive === true;
                const nameFromJudit = juditIdentity.name || '';
                const nameProvided = caseData.candidateName || '';
                const minSim = juditConfig.gate?.minNameSimilarity ?? 0.7;
                const nameSim = computeNameSimilarity(nameFromJudit, nameProvided);
                const namePasses = minSim <= 0 || nameSim >= minSim;
                const gatePassed = cpfActive && namePasses;

                let gateReason = null;
                if (!cpfActive) gateReason = 'CPF inativo na Receita Federal (Judit Entity).';
                else if (!namePasses) gateReason = `Similaridade de nome ${(nameSim * 100).toFixed(0)}% abaixo do limiar ${(minSim * 100).toFixed(0)}%.`;

                const juditGateResult = {
                    passed: gatePassed,
                    cpfActive,
                    nameSimilarity: parseFloat(nameSim.toFixed(4)),
                    nameProvided,
                    nameFound: nameFromJudit,
                    reason: gateReason,
                    source: 'judit-entity',
                    consultedAt: new Date().toISOString(),
                };

                if (!gatePassed) {
                    console.log(`Case ${caseId} [Judit]: gate BLOCKED. ${gateReason}`);
                    await caseRef.update({
                        juditEnrichmentStatus: 'BLOCKED',
                        juditError: null,
                        juditIdentity,
                        juditGateResult,
                        juditPrimaryUf: gateEntityData.juditPrimaryUf,
                        juditAllUfs: gateEntityData.juditAllUfs,
                        juditSources: { entity: gateEntityData._source },
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    return { status: 'BLOCKED', error: gateReason || null };
                }

                console.log(`Case ${caseId} [Judit]: gate PASSED (similarity: ${(nameSim * 100).toFixed(0)}%, CPF active).`);
                entityUfs = gateEntityData.juditAllUfs || [];

                // Write gate + identity data immediately (non-blocking for subsequent phases)
                await caseRef.update({
                    juditIdentity,
                    juditGateResult,
                    juditPrimaryUf: gateEntityData.juditPrimaryUf,
                    juditAllUfs: gateEntityData.juditAllUfs,
                    juditHasLawsuits: gateEntityData.juditHasLawsuits,
                    updatedAt: FieldValue.serverTimestamp(),
                });

            } catch (gateErr) {
                // Judit gate failed â€” try FonteData receita-federal as fallback
                const gateErrMsg = gateErr instanceof JuditError
                    ? `${gateErr.message} (${gateErr.statusCode})`
                    : (gateErr.message || 'Erro desconhecido');
                console.warn(`Case ${caseId} [Judit]: entity gate failed: ${gateErrMsg}. Trying FonteData fallback.`);

                try {
                    const fdApiKey = fontedataApiKey.value();
                    if (fdApiKey) {
                        const fdGate = normalizeReceitaFederal(await queryReceitaFederal(cpf, fdApiKey));
                        const { enrichmentIdentity } = fdGate;
                        const cpfStatus = (enrichmentIdentity?.cpfStatus || '').toUpperCase();
                        const cpfActive = cpfStatus === 'REGULAR';
                        const nameFromFD = enrichmentIdentity?.name || '';
                        const nameProvided = caseData.candidateName || '';
                        const minSim = juditConfig.gate?.minNameSimilarity ?? 0.7;
                        const nameSim = computeNameSimilarity(nameFromFD, nameProvided);
                        const namePasses = minSim <= 0 || nameSim >= minSim;
                        const hasDeathRecord = enrichmentIdentity?.hasDeathRecord === true;
                        const gatePassed = cpfActive && namePasses && !hasDeathRecord;

                        let gateReason = null;
                        if (!cpfActive) gateReason = `CPF com situacao "${cpfStatus}" (esperado: REGULAR).`;
                        else if (hasDeathRecord) gateReason = `CPF possui registro de obito (ano: ${enrichmentIdentity.deathYear || 'N/A'}).`;
                        else if (!namePasses) gateReason = `Similaridade de nome ${(nameSim * 100).toFixed(0)}% abaixo do limiar ${(minSim * 100).toFixed(0)}%.`;

                        const juditGateResult = {
                            passed: gatePassed,
                            cpfActive,
                            cpfStatus,
                            nameSimilarity: parseFloat(nameSim.toFixed(4)),
                            nameProvided,
                            nameFound: nameFromFD,
                            hasDeathRecord,
                            reason: gateReason,
                            source: 'fontedata-fallback',
                            consultedAt: new Date().toISOString(),
                        };

                        // Also store FonteData identity for backward compat
                        const fallbackIdentity = {
                            name: nameFromFD,
                            cpfActive: cpfActive,
                            cpfStatus,
                            birthDate: enrichmentIdentity?.birthDate || null,
                            hasDeathRecord,
                            consultedAt: new Date().toISOString(),
                        };

                        const uf = caseData.hiringUf || null;

                        if (!gatePassed) {
                            console.log(`Case ${caseId} [Judit]: FonteData fallback gate BLOCKED. ${gateReason}`);
                            await caseRef.update({
                                juditEnrichmentStatus: 'BLOCKED',
                                juditError: null,
                                juditIdentity: fallbackIdentity,
                                juditGateResult,
                                enrichmentIdentity,
                                enrichmentGateResult: juditGateResult,
                                juditPrimaryUf: uf,
                                juditAllUfs: uf ? [uf] : [],
                                juditSources: { entity: { error: gateErrMsg, fallback: 'fontedata', ...fdGate._source } },
                                updatedAt: FieldValue.serverTimestamp(),
                            });
                            return { status: 'BLOCKED', error: gateReason || null };
                        }

                        console.log(`Case ${caseId} [Judit]: FonteData fallback gate PASSED.`);
                        entityUfs = uf ? [uf] : [];
                        await caseRef.update({
                            juditIdentity: fallbackIdentity,
                            juditGateResult,
                            enrichmentIdentity,
                            enrichmentGateResult: juditGateResult,
                            juditPrimaryUf: uf,
                            juditAllUfs: entityUfs,
                            juditSources: { entity: { fallback: 'fontedata', ...fdGate._source } },
                            updatedAt: FieldValue.serverTimestamp(),
                        });
                    } else {
                        throw new Error('FONTEDATA_API_KEY nao configurado para fallback.');
                    }
                } catch (fbErr) {
                    const fbMsg = fbErr.message || 'Erro desconhecido';
                    const error = `Gate falhou (Judit: ${gateErrMsg}; FonteData fallback: ${fbMsg})`;
                    console.error(`Case ${caseId} [Judit]: both gates failed.`);
                    await caseRef.update({
                        juditEnrichmentStatus: 'FAILED',
                        juditError: error,
                        juditSources: { entity: { error: gateErrMsg, fallbackError: fbMsg, consultedAt: new Date().toISOString() } },
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    return { status: 'FAILED', error };
                }
            }
        }
    } else if (options.skipGate) {
        entityUfs = caseData.juditAllUfs || [];
    }

    // â”€â”€â”€ ENRICHMENT: datalake-first strategy â”€â”€â”€
    // Flow: 1) Sync datalake lawsuits (R$0.50) â†’ 2) Parallel warrants + execution â†’ 3) Name supplement â†’ 4) Async ONLY if triggered
    const juditFilters = juditConfig.filters || {};
    const ufs = entityUfs.length > 0 ? entityUfs : (caseData.hiringUf ? [caseData.hiringUf] : []);
    let tribunals = juditFilters.tribunals?.length > 0 ? juditFilters.tribunals : [];
    if (tribunals.length === 0 && juditFilters.autoTribunals === true && ufs.length > 0) {
        tribunals = getJuditTribunais(ufs);
    }

    // Dynamic cache_ttl: 0 for first run, configured value for reruns
    const isRerun = options.skipGate === true;
    const cacheTtlDays = isRerun ? (juditFilters.cacheTtlDays ?? 7) : 0;
    const savePersistence = juditConfig.persistence?.saveRawPayloads !== false;
    const useWebhook = juditFilters.useWebhook !== false;
    const callbackUrl = useWebhook ? buildJuditCallbackUrl() : null;

    console.log(`Case ${caseId} [Judit]: datalake-first strategy. CPF=${cpf}, UFs=${ufs.join(',')}, tribunals=${tribunals.join(',') || 'all'}, cacheTtl=${cacheTtlDays}d, async=${juditFilters.useAsync === true ? 'FORCED' : 'off'}, webhook=${useWebhook ? 'on' : 'off'}`);

    const errors = [];
    let successCount = 0;
    let failCount = 0;
    let pendingCount = 0;

    const updatePayload = {};
    // BUG-5 fix: Preserve entity source from gate fallback (FonteData).
    // When gate falls back, juditSources.entity is written to Firestore early.
    // gateEntityData is null in fallback scenario, so we must carry forward the
    // previously persisted entity source to avoid overwriting it in the final update.
    const juditSources = {};
    const juditRawPayloads = {};  // persist request bodies + raw responses for audit
    const juditRequestIds = { ...(caseData.juditRequestIds || {}) };
    const pendingAsyncPhases = [];
    const pendingWebhookRegistrations = [];
    if (gateEntityData) {
        juditSources.entity = gateEntityData._source;
    } else if (caseData.juditSources?.entity) {
        // Carry forward entity source from earlier gate write (e.g. FonteData fallback)
        juditSources.entity = caseData.juditSources.entity;
    }

    // â”€â”€â”€ STEP 1: Lawsuits (sync datalake by default, async only if explicitly forced) â”€â”€â”€
    if (phases.lawsuits !== false) {
        const useAsync = juditFilters.useAsync === true;  // DEFAULT=false â†’ sync datalake
        try {
            let lawsuitsRaw;
            if (useAsync) {
                console.log(`Case ${caseId} [Judit]: lawsuits via ASYNC (datalake R$1.50/1k ou on_demand R$6.00/1k) â€” explicitly forced.`);
                lawsuitsRaw = await queryLawsuitsAsync(cpf, apiKey, { tribunals, cacheTtlDays });
            } else {
                console.log(`Case ${caseId} [Judit]: lawsuits via SYNC datalake (R$0.50) â€” default path.`);
                lawsuitsRaw = await queryLawsuitsSync(cpf, apiKey);
            }

            const lawsuitsNormalized = normalizeJuditLawsuits(lawsuitsRaw, cpf);
            const { _source: lawSource, ...lawFields } = lawsuitsNormalized;
            juditSources.lawsuits = lawSource;
            if (lawsuitsRaw.requestId) juditRequestIds.lawsuits = lawsuitsRaw.requestId;
            for (const [field, value] of Object.entries(lawFields)) {
                if (value !== undefined && value !== null) updatePayload[field] = value;
            }

            if (savePersistence) {
                juditRawPayloads.lawsuits = {
                    requestId: lawsuitsRaw.requestId || null,
                    request: lawsuitsRaw._request || null,
                    method: useAsync ? 'async' : 'sync',
                    responseCount: (lawsuitsRaw.responseData || []).length,
                    consultedAt: new Date().toISOString(),
                };
            }
            successCount++;
        } catch (lawErr) {
            failCount++;
            const errMsg = lawErr instanceof JuditError
                ? `${lawErr.message} (${lawErr.statusCode})`
                : (lawErr.message || 'Erro desconhecido');
            errors.push(`lawsuits: ${errMsg}`);
            juditSources.lawsuits = { error: errMsg, consultedAt: new Date().toISOString() };
            console.error(`Case ${caseId} [Judit]: lawsuits failed:`, errMsg);
        }
    }

    // â”€â”€â”€ STEP 2: Warrants + Execution (parallel, always async â€” these endpoints have no sync alternative) â”€â”€â”€
    // Optimization: skip Judit warrant (R$1.00) if BigDataCorp already confirmed arrest warrants
    let warrantSkippedByBdc = false;
    if (phases.warrant !== false) {
        try {
            const midDoc = await caseRef.get();
            const midData = midDoc.data() || {};
            if (
                ['DONE', 'PARTIAL'].includes(midData.bigdatacorpEnrichmentStatus) &&
                midData.bigdatacorpHasArrestWarrant === true
            ) {
                warrantSkippedByBdc = true;
                phases.warrant = false;
                console.log(`Case ${caseId} [Judit]: Warrant search SKIPPED â€” BigDataCorp already confirmed arrest warrant(s). Saving R$1.00.`);
            }
        } catch (checkErr) {
            console.warn(`Case ${caseId} [Judit]: Could not check BDC status before warrant, proceeding normally:`, checkErr.message);
        }
    }

    const parallelTasks = [];
    if (phases.warrant !== false) {
        parallelTasks.push({
            key: 'warrant',
            promise: queryWarrantAsync(cpf, apiKey, { tribunals, cacheTtlDays, callbackUrl })
                .then((data) => ({ raw: data, normalized: normalizeJuditWarrants(data) })),
        });
    }
    if (phases.execution !== false) {
        parallelTasks.push({
            key: 'execution',
            promise: queryExecutionAsync(cpf, apiKey, { tribunals, cacheTtlDays, callbackUrl })
                .then((data) => ({ raw: data, normalized: normalizeJuditExecution(data) })),
        });
    }

    if (parallelTasks.length > 0) {
        const parallelResults = await Promise.allSettled(parallelTasks.map((t) => t.promise));
        for (let i = 0; i < parallelTasks.length; i++) {
            const { key } = parallelTasks[i];
            const result = parallelResults[i];

            if (result.status === 'fulfilled') {
                const { raw, normalized } = result.value;
                if (raw?.requestId) juditRequestIds[key] = raw.requestId;

                if (raw?.webhookPending) {
                    pendingCount++;
                    pendingAsyncPhases.push(key);
                    juditSources[key] = {
                        provider: 'judit',
                        endpoint: key,
                        requestId: raw.requestId || null,
                        status: 'PENDING_CALLBACK',
                        callbackUrl,
                        consultedAt: new Date().toISOString(),
                    };
                    if (key === 'warrant' && !updatePayload.juditWarrantNotes) {
                        updatePayload.juditWarrantNotes = 'Consulta de mandados enviada a Judit e aguardando callback assincrono.';
                    }
                    if (key === 'execution' && !updatePayload.juditExecutionNotes) {
                        updatePayload.juditExecutionNotes = 'Consulta de execucao penal enviada a Judit e aguardando callback assincrono.';
                    }
                    pendingWebhookRegistrations.push(
                        registerJuditWebhookRequest(raw.requestId, caseId, key, {
                            tenantId: caseData.tenantId || null,
                            callbackUrl,
                            request: raw._request || null,
                        }),
                    );
                } else {
                    successCount++;
                    const { _source, ...fields } = normalized;
                    juditSources[key] = _source;
                    for (const [field, value] of Object.entries(fields)) {
                        if (value !== undefined && value !== null) updatePayload[field] = value;
                    }
                }
                if (savePersistence) {
                    juditRawPayloads[key] = {
                        requestId: raw.requestId || null,
                        request: raw._request || null,
                        method: raw?.webhookPending ? 'async-callback' : 'async',
                        webhookPending: raw?.webhookPending === true,
                        callbackUrl: raw?.webhookPending ? callbackUrl : null,
                        responseCount: Array.isArray(raw.responseData) ? raw.responseData.length : (Array.isArray(raw) ? raw.length : 0),
                        consultedAt: new Date().toISOString(),
                    };
                }
            } else {
                failCount++;
                const err = result.reason;
                const errMsg = err instanceof JuditError
                    ? `${err.message} (${err.statusCode})`
                    : (err.message || 'Erro desconhecido');
                errors.push(`${key}: ${errMsg}`);
                juditSources[key] = { error: errMsg, consultedAt: new Date().toISOString() };
                console.error(`Case ${caseId} [Judit]: phase ${key} failed:`, errMsg);
            }
        }
    }

    if (pendingWebhookRegistrations.length > 0) {
        await Promise.all(pendingWebhookRegistrations);
    }

    // Record BDC-covered warrant skip in sources and notes
    if (warrantSkippedByBdc) {
        successCount++;
        juditSources.warrant = {
            provider: 'judit',
            endpoint: 'warrant',
            status: 'SKIPPED_BDC_COVERED',
            reason: 'BigDataCorp already confirmed arrest warrant(s)',
            consultedAt: new Date().toISOString(),
        };
        if (!updatePayload.juditWarrantNotes) {
            updatePayload.juditWarrantNotes = 'Busca de mandados Judit omitida â€” BigDataCorp ja confirmou mandado(s) de prisao ativo(s).';
        }
    }

    const totalPhases = (phases.lawsuits !== false ? 1 : 0) + parallelTasks.length + (warrantSkippedByBdc ? 1 : 0);

    // â”€â”€â”€ STEP 3: NAME SEARCH SUPPLEMENT â€” search by name when CPF found 0 lawsuits â”€â”€â”€
    const nameConfig = juditConfig.nameSearchSupplement || {};
    const cpfLawsuitCount = updatePayload.juditProcessTotal || 0;
    const candidateName = caseData.candidateName || '';
    if (
        nameConfig.enabled !== false &&
        cpfLawsuitCount === 0 &&
        candidateName.length > 5 &&
        phases.lawsuits !== false
    ) {
        const maxCpfs = nameConfig.maxCpfsComNome ?? 3;
        const entityHomonymCount = gateEntityData?.juditIdentity?.cpfsComNome ?? null;
        const shouldSearch = entityHomonymCount === null || entityHomonymCount <= maxCpfs;

        if (shouldSearch) {
            try {
                console.log(`Case ${caseId} [Judit]: CPF found 0 lawsuits. Supplementing with name search: "${candidateName}" (maxCpfs=${maxCpfs}).`);

                // Prefer sync datalake by name (cheaper) unless config says otherwise
                const preferSync = nameConfig.preferSync !== false;
                let nameData;
                if (preferSync) {
                    nameData = await queryLawsuitsSyncByName(candidateName, apiKey);
                } else {
                    nameData = await queryLawsuitsByNameAsync(candidateName, apiKey, { cacheTtlDays });
                }

                const nameNormalized = normalizeJuditLawsuits(nameData, cpf);
                const { _source: nameSource, ...nameFields } = nameNormalized;

                const nameProcessCount = nameFields.juditProcessTotal || 0;
                if (nameProcessCount > 0) {
                    updatePayload.juditNameSearchProcessTotal = nameProcessCount;
                    updatePayload.juditNameSearchCriminalCount = nameFields.juditCriminalCount || 0;
                    updatePayload.juditNameSearchFlag = 'FOUND';
                    updatePayload.juditNameSearchSource = 'name';
                    updatePayload.juditNameSearchMethod = preferSync ? 'sync' : 'async';
                    juditSources.lawsuits_by_name = nameSource;

                    // If CPF had 0, inherit the name results as primary
                    if (!updatePayload.juditProcessTotal) {
                        for (const [field, value] of Object.entries(nameFields)) {
                            if (value !== undefined && value !== null) {
                                updatePayload[field] = value;
                            }
                        }
                    }
                    successCount++;
                    console.log(`Case ${caseId} [Judit]: name search found ${nameProcessCount} lawsuit(s), ${nameFields.juditCriminalCount || 0} criminal.`);
                } else {
                    console.log(`Case ${caseId} [Judit]: name search also found 0 lawsuits.`);
                }

                if (savePersistence) {
                    juditRawPayloads.lawsuits_by_name = {
                        requestId: nameData.requestId || null,
                        request: nameData._request || null,
                        method: preferSync ? 'sync' : 'async',
                        responseCount: (nameData.responseData || []).length,
                        consultedAt: new Date().toISOString(),
                    };
                }
            } catch (nameErr) {
                const nameErrMsg = nameErr instanceof JuditError
                    ? `${nameErr.message} (${nameErr.statusCode})`
                    : (nameErr.message || 'Erro desconhecido');
                console.error(`Case ${caseId} [Judit]: name search supplement failed:`, nameErrMsg);
                juditSources.lawsuits_by_name = { error: nameErrMsg, consultedAt: new Date().toISOString() };
            }
        } else {
            console.log(`Case ${caseId} [Judit]: name search skipped â€” ${entityHomonymCount} CPFs with same name exceeds max ${maxCpfs}.`);
            updatePayload.juditNameSearchFlag = 'SKIPPED_HOMONYMS';
            updatePayload.juditNameSearchCpfsComNome = entityHomonymCount;
        }
    }

    let juditStatus;
    if (totalPhases === 0) {
        juditStatus = 'SKIPPED';
    } else if (pendingCount > 0) {
        juditStatus = successCount > 0 || failCount > 0 ? 'PARTIAL' : 'RUNNING';
    } else if (failCount === 0) {
        juditStatus = 'DONE';
    } else if (successCount > 0) {
        juditStatus = 'PARTIAL';
    } else {
        juditStatus = 'FAILED';
    }

    // â”€â”€â”€ EVALUATE: should Escavador run as cross-validation? â”€â”€â”€
    const needsEscavador = evaluateEscavadorNeed(updatePayload, juditConfig);

    // â”€â”€â”€ PERSIST â”€â”€â”€
    const error = errors.length > 0 ? errors.join('; ') : null;
    const persistencePayload = savePersistence ? { juditRawPayloads } : {};

    // Judit pricing: entity R$0.12, lawsuits_sync R$0.50, warrant R$1.00, execution R$0.50
    let juditCostBRL = 0;
    if (gateEntityData) juditCostBRL += 0.12;
    if (juditSources.lawsuits && !juditSources.lawsuits.error) {
        juditCostBRL += juditFilters.useAsync === true ? 1.50 : 0.50;
    }
    if (juditSources.warrant && !juditSources.warrant.error && juditSources.warrant.status !== 'SKIPPED_BDC_COVERED') juditCostBRL += 1.00;
    if (juditSources.execution && !juditSources.execution.error) juditCostBRL += 0.50;
    if (juditSources.lawsuits_by_name && !juditSources.lawsuits_by_name.error) juditCostBRL += 0.50;

    await caseRef.update({
        ...updatePayload,
        ...persistencePayload,
        juditEnrichmentStatus: juditStatus,
        juditEnrichmentStrategy: juditFilters.useAsync === true ? 'async' : 'datalake',
        juditPendingAsyncPhases: pendingAsyncPhases.length > 0 ? pendingAsyncPhases : FieldValue.delete(),
        juditPendingAsyncCount: pendingCount > 0 ? pendingCount : FieldValue.delete(),
        juditRequestIds: Object.keys(juditRequestIds).length > 0 ? juditRequestIds : FieldValue.delete(),
        juditSources,
        juditError: error,
        juditNeedsEscavador: needsEscavador,
        juditCostBRL,
        juditEnrichedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    await materializeModuleRunsFromCaseRef(caseRef, caseId, caseData);

    if (!options.skipAutoClassify && (juditStatus === 'DONE' || juditStatus === 'PARTIAL')) {
        try {
            const freshDoc = await caseRef.get();
            const freshData = freshDoc.data() || {};

            if (needsEscavador && (freshData.escavadorEnrichmentStatus === 'RUNNING' || freshData.escavadorEnrichmentStatus === 'PENDING' || !freshData.escavadorEnrichmentStatus)) {
                console.log(`Case ${caseId} [AutoClassify]: Skipped â€” Escavador needed and still ${freshData.escavadorEnrichmentStatus || 'PENDING'}. Will run when Escavador completes.`);
            } else {
                await runAutoClassifyAndAi(caseRef, caseId, freshData);
            }
        } catch (classifyErr) {
            console.error(`Case ${caseId} [AutoClassify]: error:`, classifyErr.message);
        }
    }

    console.log(
        `Case ${caseId} [Judit]: ${juditStatus} (strategy: ${juditFilters.useAsync === true ? 'async' : 'datalake'}). ` +
        `Phases: ${successCount}/${totalPhases}. ` +
        `Pending async: ${pendingCount}. ` +
        `Warrant: ${warrantSkippedByBdc ? 'SKIPPED_BDC' : (updatePayload.juditWarrantFlag || 'N/A')}, ` +
        `Processos: ${updatePayload.juditProcessTotal || 0}, ` +
        `NeedsEscavador: ${needsEscavador}, ` +
        `Tribunals filter: [${tribunals.join(',')}].`,
    );

    // â”€â”€ Circuit Breaker: record Judit outcome â”€â”€
    if (juditStatus === 'DONE' || juditStatus === 'PARTIAL') {
        recordSuccess('judit').catch(() => {});
    } else if (juditStatus === 'FAILED') {
        recordFailure('judit', error || 'All phases failed').catch(() => {});
    }

    return { status: juditStatus, error, needsEscavador };
}

/* =========================================================
   FONTEDATA â€” Kept as helper for manual rerun only.
   No longer triggered automatically on case creation.
   ========================================================= */
// exports.enrichFonteDataOnCase removed â€” FonteData is now fallback only.
// The runFonteDataEnrichmentPhase function is still available via rerunEnrichmentPhase.

/* =========================================================
   JUDIT â€” Cloud Function (triggered after BigDataCorp completes)
   BigDataCorp is the PRIMARY identity gate. Judit is the FALLBACK.
   Triggered when bigdatacorpEnrichmentStatus transitions to a
   terminal state (DONE, BLOCKED, FAILED, SKIPPED).
   ========================================================= */

exports.enrichJuditOnCase = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 540, memory: '512MiB', secrets: [juditApiKey, fontedataApiKey, openaiApiKey] },
    async () => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        // Guard: bigdatacorpEnrichmentStatus must have CHANGED to a terminal state
        const bdcBefore = before.bigdatacorpEnrichmentStatus;
        const bdcAfter = after.bigdatacorpEnrichmentStatus;
        if (bdcBefore === bdcAfter) return;
        const bdcTerminal = ['DONE', 'BLOCKED', 'FAILED', 'SKIPPED'];
        if (!bdcTerminal.includes(bdcAfter)) return;

        // Guard: Judit must not have already started
        const juditStatus = after.juditEnrichmentStatus;
        if (juditStatus && juditStatus !== 'PENDING') return;

        // Guard: case must still be actionable
        if (after.status === 'DONE' || after.status === 'CORRECTION_NEEDED') return;

        const caseData = after;
        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);

        const tenantId = caseData.tenantId;
        if (!tenantId) {
            console.log(`Case ${caseId}: no tenantId, skipping enrichment.`);
            return;
        }

        try {
            const juditConfig = await loadJuditConfig(tenantId);
            if (!juditConfig.enabled) {
                console.log(`Case ${caseId} [Judit]: disabled for tenant ${tenantId}.`);
                return;
            }

            await runJuditEnrichmentPhase(caseRef, caseId, caseData, juditConfig);

            // Audit: log automatic enrichment trigger
            try {
                const refreshed = (await caseRef.get()).data() || {};
                await writeAuditEvent({
                    action: 'ENRICHMENT_AUTO_TRIGGERED',
                    tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM },
                    entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                    related: { caseId },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: { phase: 'judit', status: refreshed.juditEnrichmentStatus, trigger: 'bigdatacorp_settled' },
                    templateVars: { candidateName: caseData.candidateName || caseId, phase: 'judit', status: refreshed.juditEnrichmentStatus || 'UNKNOWN' },
                });
            } catch { /* audit failure must not block pipeline */ }
        } catch (err) {
            console.error(`Case ${caseId} [Judit]: error:`, err.message);
            throw err;
        }
    },
);

/* =========================================================
   BIGDATACORP â€” Cloud Function (triggered on case creation)
   PRIMARY identity gate. Runs FIRST, then triggers Judit via
   onDocumentUpdated when it reaches a terminal state.
   Queries: basic_data + processes + kyc + occupation_data.
   ========================================================= */

exports.enrichBigDataCorpOnCase = onDocumentCreated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 300, memory: '256MiB', secrets: [bigdatacorpAccessToken, bigdatacorpTokenId, openaiApiKey] },
    async (event) => {
        const snap = event.data;
        if (!snap) return;

        const caseData = snap.data();
        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);

        const tenantId = caseData.tenantId;
        if (!tenantId) {
            console.log(`Case ${caseId} [BigDataCorp]: no tenantId, skipping.`);
            return;
        }

        try {
            const bdcConfig = await loadBigDataCorpConfig(tenantId);
            if (!bdcConfig.enabled) {
                console.log(`Case ${caseId} [BigDataCorp]: disabled for tenant ${tenantId}, writing SKIPPED.`);
                await caseRef.update({
                    bigdatacorpEnrichmentStatus: 'SKIPPED',
                    bigdatacorpError: 'Provider desabilitado para este tenant.',
                    updatedAt: FieldValue.serverTimestamp(),
                });
                return;
            }

            await runBigDataCorpEnrichmentPhase(caseRef, caseId, caseData, bdcConfig);

            // Audit: log automatic enrichment trigger
            try {
                const refreshed = (await caseRef.get()).data() || {};
                await writeAuditEvent({
                    action: 'ENRICHMENT_AUTO_TRIGGERED',
                    tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM },
                    entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                    related: { caseId },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: { phase: 'bigdatacorp', status: refreshed.bigdatacorpEnrichmentStatus, trigger: 'case_created' },
                    templateVars: { candidateName: caseData.candidateName || caseId, phase: 'bigdatacorp', status: refreshed.bigdatacorpEnrichmentStatus || 'UNKNOWN' },
                });
            } catch { /* audit failure must not block pipeline */ }
        } catch (err) {
            console.error(`Case ${caseId} [BigDataCorp]: error:`, err.message);
            // Do NOT rethrow â€” BigDataCorp failure should not block the pipeline
        }
    },
);

/* =========================================================
   JUDIT â€” Re-enrichment after client correction.
   Triggered when a case transitions from CORRECTION_NEEDED to
   PENDING with a fresh correctedAt. Since enrichJuditOnCase
   watches bigdatacorpEnrichmentStatus changes, this separate
   trigger handles re-runs directly on correction events.
   ========================================================= */

exports.enrichJuditOnCorrection = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 540, memory: '512MiB', secrets: [juditApiKey, fontedataApiKey, openaiApiKey] },
    async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        // Guard: only trigger on CORRECTION_NEEDED â†’ PENDING transition
        if (before.status !== 'CORRECTION_NEEDED' || after.status !== 'PENDING') return;

        // Guard: must have juditEnrichmentStatus reset to PENDING
        if (after.juditEnrichmentStatus !== 'PENDING') return;

        const caseData = after;
        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);

        const tenantId = caseData.tenantId;
        if (!tenantId) return;

        try {
            const juditConfig = await loadJuditConfig(tenantId);
            if (!juditConfig.enabled) {
                console.log(`Case ${caseId} [Judit correction]: disabled for tenant ${tenantId}.`);
                return;
            }

            console.log(`Case ${caseId} [Judit correction]: re-running enrichment after client correction.`);
            await runJuditEnrichmentPhase(caseRef, caseId, caseData, juditConfig);
        } catch (err) {
            console.error(`Case ${caseId} [Judit correction]: error:`, err.message);
            throw err;
        }
    },
);

/* =========================================================
   ESCAVADOR â€” Sequential Cloud Function (waits for FonteData)
   Triggered when enrichmentStatus changes to DONE/PARTIAL.
   Reads enrichmentPrimaryUf to apply tribunal filters.
   ========================================================= */

/* =========================================================
   ESCAVADOR â€” Conditional Cloud Function (waits for Judit)
   Triggered when juditEnrichmentStatus changes to DONE/PARTIAL.
   Only runs if juditNeedsEscavador is true OR config forces it.
   ========================================================= */

exports.enrichEscavadorOnCase = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', secrets: [escavadorApiToken, openaiApiKey] },
    async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        // Guard: only trigger when Judit enrichment completes
        const statusBefore = before.juditEnrichmentStatus;
        const statusAfter = after.juditEnrichmentStatus;
        const needsEscavadorTurnedTrue = before.juditNeedsEscavador !== true && after.juditNeedsEscavador === true;
        if (statusBefore === statusAfter && !needsEscavadorTurnedTrue) return;
        if (statusAfter !== 'DONE' && statusAfter !== 'PARTIAL') return;

        // Guard: don't re-trigger if Escavador already ran, except when it was
        // previously skipped and Judit async completion now requires validation.
        const escavadorStatus = after.escavadorEnrichmentStatus;
        const canReviveSkippedEscavador = escavadorStatus === 'SKIPPED' && after.juditNeedsEscavador === true;
        if (escavadorStatus && escavadorStatus !== 'PENDING' && !canReviveSkippedEscavador) return;

        // Guard: don't enrich concluded or returned cases
        if (after.status === 'DONE' || after.status === 'CORRECTION_NEEDED') return;

        const caseData = after;
        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);

        const tenantId = caseData.tenantId;
        if (!tenantId) return;

        try {
            const escavadorConfig = await loadEscavadorConfig(tenantId);
            if (!escavadorConfig.enabled) {
                console.log(`Case ${caseId} [Escavador]: disabled for tenant ${tenantId}.`);
                // BUG-3 fix: When Escavador is disabled but Judit flagged it as needed,
                // we must still mark SKIPPED and run auto-classification. Otherwise the
                // pipeline gets permanently stuck waiting for Escavador to complete.
                if (caseData.juditNeedsEscavador) {
                    await caseRef.update({
                        escavadorEnrichmentStatus: 'SKIPPED',
                        escavadorError: null,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    try {
                        const freshDoc = await caseRef.get();
                        const freshData = freshDoc.data() || {};
                        await runAutoClassifyAndAi(caseRef, caseId, freshData);
                    } catch (classifyErr) {
                        console.error(`Case ${caseId} [AutoClassify via Escavador disabled]: error:`, classifyErr.message);
                    }
                }
                return;
            }

            // Conditional: only run if Judit flagged the need OR config forces it
            const forceRun = escavadorConfig.alwaysRun === true;
            if (!caseData.juditNeedsEscavador && !forceRun) {
                console.log(`Case ${caseId} [Escavador]: skipped â€” Judit found no flags requiring cross-validation.`);
                await caseRef.update({
                    escavadorEnrichmentStatus: 'SKIPPED',
                    escavadorError: null,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                // Run auto-classify since Escavador will not run
                try {
                    const freshDoc = await caseRef.get();
                    const freshData = freshDoc.data() || {};
                    await runAutoClassifyAndAi(caseRef, caseId, freshData);
                } catch (classifyErr) {
                    console.error(`Case ${caseId} [AutoClassify via Escavador skip]: error:`, classifyErr.message);
                }
                return;
            }

            console.log(`Case ${caseId} [Escavador]: running cross-validation (juditNeedsEscavador=${caseData.juditNeedsEscavador}, forceRun=${forceRun}).`);
            await runEscavadorEnrichmentPhase(caseRef, caseId, caseData, escavadorConfig);

            // Audit: log automatic enrichment trigger
            try {
                const refreshed = (await caseRef.get()).data() || {};
                await writeAuditEvent({
                    action: 'ENRICHMENT_AUTO_TRIGGERED',
                    tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM },
                    entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                    related: { caseId },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: { phase: 'escavador', status: refreshed.escavadorEnrichmentStatus, trigger: 'judit_settled' },
                    templateVars: { candidateName: caseData.candidateName || caseId, phase: 'escavador', status: refreshed.escavadorEnrichmentStatus || 'UNKNOWN' },
                });
            } catch { /* audit failure must not block pipeline */ }
        } catch (err) {
            console.error(`Case ${caseId} [Escavador]: error:`, err.message);
            throw err;
        }
    },
);

/* =========================================================
   DJEN â€” Cloud Function (triggered on case update)
   Runs AFTER Judit completes. Searches comunicaÃ§Ãµes judiciais.
   DISABLED by default â€” requires tenant-level enablement.
   ========================================================= */

exports.enrichDjenOnCase = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', secrets: [openaiApiKey] },
    async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        // Guard: only trigger when Judit enrichment completes
        const statusBefore = before.juditEnrichmentStatus;
        const statusAfter = after.juditEnrichmentStatus;
        if (statusBefore === statusAfter) return;
        if (statusAfter !== 'DONE' && statusAfter !== 'PARTIAL') return;

        // Guard: don't re-trigger if DJEN already ran
        const djenStatus = after.djenEnrichmentStatus;
        if (djenStatus && djenStatus !== 'PENDING') return;

        // Guard: don't enrich concluded cases
        if (after.status === 'DONE' || after.status === 'CORRECTION_NEEDED') return;

        const caseData = after;
        const caseId = event.params.caseId;
        const caseRef = db.collection('cases').doc(caseId);

        const tenantId = caseData.tenantId;
        if (!tenantId) return;

        try {
            const djenConfig = await loadDjenConfig(tenantId);
            if (!djenConfig.enabled) {
                console.log(`Case ${caseId} [DJEN]: disabled for tenant ${tenantId}.`);
                return;
            }

            console.log(`Case ${caseId} [DJEN]: running enrichment (strategy=${djenConfig.searchStrategy}).`);
            await runDjenEnrichmentPhase(caseRef, caseId, caseData, djenConfig);

            // Audit: log automatic enrichment trigger
            try {
                const refreshed = (await caseRef.get()).data() || {};
                await writeAuditEvent({
                    action: 'ENRICHMENT_AUTO_TRIGGERED',
                    tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM },
                    entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                    related: { caseId },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: { phase: 'djen', status: refreshed.djenEnrichmentStatus, trigger: 'judit_settled' },
                    templateVars: { candidateName: caseData.candidateName || caseId, phase: 'djen', status: refreshed.djenEnrichmentStatus || 'UNKNOWN' },
                });
            } catch { /* audit failure must not block pipeline */ }
        } catch (err) {
            console.error(`Case ${caseId} [DJEN]: error:`, err.message);
        }
    },
);

/* =========================================================
   DJEN â€” Enrichment Phase (comunicaÃ§Ãµes judiciais)
   Hybrid strategy: byProcess (precise) + byName (discovery).
   Post-fetch filtering with CPF/process/name confirmation.
   FREE, no API key.
   ========================================================= */

async function runDjenEnrichmentPhase(caseRef, caseId, caseData, djenConfig, options = {}) {
    await caseRef.update({
        djenEnrichmentStatus: 'RUNNING',
        djenError: null,
        updatedAt: FieldValue.serverTimestamp(),
    });

    try {
        const candidateName = caseData.name || caseData.candidateName || '';
        const candidateCpf = (caseData.cpf || '').replace(/\D/g, '');
        const strategy = djenConfig.searchStrategy || 'hybrid';

        const knownProcesses = extractKnownProcessNumbers(caseData);
        const knownProcessSet = new Set(knownProcesses);

        const allItems = [];
        const seenIds = new Set();
        let totalApiCount = 0;

        // ------ Phase 1: byProcess (precise, no homonym risk) ------
        if (strategy === 'byProcess' || strategy === 'hybrid') {
            if (knownProcesses.length > 0) {
                console.log(`Case ${caseId} [DJEN]: phase 1 â€” querying ${knownProcesses.length} process(es) by number.`);

                for (const cnj of knownProcesses) {
                    const result = await queryComunicacoesByProcesso(cnj);
                    for (const item of result.items) {
                        const key = item.id || item.numero_processo;
                        if (!seenIds.has(key)) {
                            seenIds.add(key);
                            allItems.push(item);
                        }
                    }
                    totalApiCount += result.count;
                    // Delay between requests to respect rate limits
                    if (knownProcesses.indexOf(cnj) < knownProcesses.length - 1) {
                        await new Promise((resolve) => setTimeout(resolve, 500));
                    }
                }
            } else if (strategy === 'byProcess') {
                // byProcess only + no known processes â†’ SKIPPED
                console.log(`Case ${caseId} [DJEN]: no known processes to search, skipping.`);
                await caseRef.update({
                    djenEnrichmentStatus: 'SKIPPED',
                    djenError: null,
                    djenNotes: 'Nenhum processo conhecido para buscar no DJEN.',
                    updatedAt: FieldValue.serverTimestamp(),
                });
                return { status: 'SKIPPED', error: null };
            }
        }

        // ------ Phase 2: byName (discovery â€” finds NEW processes) ------
        if (strategy === 'byName' || strategy === 'hybrid') {
            if (!candidateName) {
                if (strategy === 'byName') {
                    await caseRef.update({
                        djenEnrichmentStatus: 'FAILED',
                        djenError: 'Nome do candidato nÃ£o disponÃ­vel.',
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    return { status: 'FAILED', error: 'Nome do candidato nÃ£o disponÃ­vel.' };
                }
                // hybrid: byProcess already ran, just skip name phase
                console.log(`Case ${caseId} [DJEN]: no candidate name, skipping byName phase.`);
            } else {
                console.log(`Case ${caseId} [DJEN]: phase 2 â€” querying by name "${candidateName}"`);
                const nameResult = await queryComunicacoesByName(candidateName, {
                    maxPages: djenConfig.maxPages || 3,
                    siglaTribunal: djenConfig.filters?.siglaTribunal || undefined,
                });
                totalApiCount += nameResult.count;

                for (const item of nameResult.items) {
                    const key = item.id || item.numero_processo;
                    if (!seenIds.has(key)) {
                        seenIds.add(key);
                        allItems.push(item);
                    }
                }
            }
        }

        // ------ Normalize with intelligent filtering ------
        const apiResult = {
            count: totalApiCount,
            items: allItems,
            _request: {
                endpoint: '/comunicacao',
                params: { strategy, processCount: knownProcesses.length, name: candidateName || null },
                duration: 0,
            },
        };

        const namesakeCount = caseData.bigdatacorpNamesakeCount || 0;
        const strictNameMatch = namesakeCount > 10;

        // Build candidate UFs for geo-tagging (cascading fallback)
        const candidateUfs = caseData.juditAllUfs
            || caseData.enrichmentAllUfs
            || (caseData.juditPrimaryUf ? [caseData.juditPrimaryUf]
                : caseData.enrichmentPrimaryUf ? [caseData.enrichmentPrimaryUf]
                    : (caseData.hiringUf ? [caseData.hiringUf] : []));

        const normalized = normalizeDjenComunicacoes(apiResult, candidateName, candidateCpf, knownProcessSet, { strictNameMatch, candidateUfs });
        const { _source, ...fields } = normalized;

        await caseRef.update({
            ...fields,
            djenEnrichmentStatus: 'DONE',
            djenError: null,
            djenSources: _source,
            djenEnrichedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await materializeModuleRunsFromCaseRef(caseRef, caseId, caseData);

        console.log(
            `Case ${caseId} [DJEN]: DONE (${strategy}). ` +
            `API total: ${apiResult.count}, Confirmed: ${fields.djenConfirmedTotal || 0}, ` +
            `Filtered out: ${fields.djenFilteredOutCount || 0}, ` +
            `Criminal: ${fields.djenCriminalFlag || 'NEGATIVE'}.`,
        );

        // Cascade auto-classify if main providers are settled
        if (!options.skipAutoClassify) {
            const freshDoc = await caseRef.get();
            const freshData = freshDoc.data() || {};
            const escavadorStatus = freshData.escavadorEnrichmentStatus;
            if (escavadorStatus !== 'RUNNING') {
                try {
                    await runAutoClassifyAndAi(caseRef, caseId, freshData);
                } catch (classifyErr) {
                    console.error(`Case ${caseId} [AutoClassify via DJEN]: error:`, classifyErr.message);
                }
            } else {
                console.log(`Case ${caseId} [AutoClassify via DJEN]: deferred â€” Escavador still RUNNING.`);
            }
        }

        return { status: 'DONE', error: null };
    } catch (err) {
        const errMsg = err instanceof DjenError
            ? `${err.message} (${err.statusCode})`
            : (err.message || 'Erro desconhecido');
        console.error(`Case ${caseId} [DJEN]: failed:`, errMsg);
        await caseRef.update({
            djenEnrichmentStatus: 'FAILED',
            djenError: errMsg,
            updatedAt: FieldValue.serverTimestamp(),
        });
        await materializeModuleRunsFromCaseRef(caseRef, caseId, caseData);

        // Run auto-classify even on DJEN failure â€” DJEN data is supplementary
        if (!options.skipAutoClassify) {
            try {
                const freshDoc = await caseRef.get();
                const freshData = freshDoc.data() || {};
                const escavadorStatus = freshData.escavadorEnrichmentStatus;
                if (escavadorStatus !== 'RUNNING') {
                    await runAutoClassifyAndAi(caseRef, caseId, freshData);
                }
            } catch (classifyErr) {
                console.error(`Case ${caseId} [AutoClassify via DJEN failure]: error:`, classifyErr.message);
            }
        }

        return { status: 'FAILED', error: errMsg };
    }
}

/**
 * Extract unique CNJ process numbers from all enrichment providers.
 * Used by DJEN byProcess strategy.
 */
function extractKnownProcessNumbers(caseData) {
    const numbers = new Set();

    // From Judit lawsuits
    const juditProcessos = caseData.juditProcessos || caseData.juditRoleSummary || [];
    for (const p of juditProcessos) {
        const cnj = p.cnj || p.numero || p.numeroCnj;
        if (cnj) numbers.add(cnj.replace(/\D/g, ''));
    }

    // From Escavador processos
    const escProcessos = caseData.escavadorProcessos || [];
    for (const p of escProcessos) {
        const cnj = p.numeroCnj || p.cnj;
        if (cnj) numbers.add(cnj.replace(/\D/g, ''));
    }

    // From BigDataCorp processes
    const bdcProcessos = caseData.bigdatacorpProcessos || [];
    for (const p of bdcProcessos) {
        const cnj = p.numeroCnj || p.Number;
        if (cnj) numbers.add(cnj.replace(/\D/g, ''));
    }

    return [...numbers].filter((n) => n.length >= 15);
}

/* =========================================================
   AUTO-CLASSIFICATION: Aggregate all enrichment data into
   form-ready flags for the analyst. Runs after all providers complete.
   ========================================================= */

/**
 * Run auto-classification + AI analysis after all providers finish.
 * Checks tenant AI budget before running AI.
 */
async function runAutoClassifyAndAi(caseRef, caseId, freshData) {
    const autoClassification = computeAutoClassification(freshData);
    const updatePayload = {};

    if (Object.keys(autoClassification).length > 0) {
        Object.assign(updatePayload, autoClassification);
        console.log(`Case ${caseId} [AutoClassify]: criminal=${autoClassification.criminalFlag}, warrant=${autoClassification.warrantFlag}, labor=${autoClassification.laborFlag}`);
    }

    const tenantId = freshData.tenantId;
    let aiEnabled = false;
    let tenantData = null;
    if (tenantId) {
        try {
            tenantData = await getTenantSettingsData(tenantId);
            if (tenantData) {
                aiEnabled = tenantData.enrichmentConfig?.ai?.enabled === true;

                if (aiEnabled && tenantData.enrichmentConfig?.ai?.monthlyBudgetUsd) {
                    const budget = tenantData.enrichmentConfig.ai.monthlyBudgetUsd;
                    const now = new Date();
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    const costSnapshot = await db.collection('cases')
                        .where('tenantId', '==', tenantId)
                        .where('aiExecutedAt', '>=', monthStart)
                        .select('aiCostUsd', 'aiHomonymCostUsd')
                        .get();
                    let totalCost = 0;
                    costSnapshot.forEach((docSnap) => {
                        totalCost += (docSnap.data().aiCostUsd || 0) + (docSnap.data().aiHomonymCostUsd || 0);
                    });
                    if (totalCost >= budget) {
                        console.warn(`Case ${caseId}: AI budget exceeded ($${totalCost.toFixed(4)} >= $${budget}). Skipping AI.`);
                        updatePayload.aiError = `Budget mensal excedido ($${totalCost.toFixed(4)}/$${budget})`;
                        aiEnabled = false;
                    }
                }
            }
        } catch (err) {
            console.warn(`Case ${caseId}: tenant AI config read failed:`, err.message);
        }
    }

    const safetyNet = evaluateNegativePartialSafetyNet(freshData, autoClassification);
    updatePayload.negativePartialSafetyNetEligible = safetyNet.eligible;
    updatePayload.negativePartialSafetyNetReasons = safetyNet.reasons;
    updatePayload.negativePartialSafetyNetAction = safetyNet.action;
    updatePayload.negativePartialSafetyNetTriggered = false;

    if (tenantId && safetyNet.eligible && !freshData.juditNeedsEscavador) {
        try {
            const escavadorConfig = await loadEscavadorConfig(tenantId);
            if (escavadorConfig.enabled) {
                updatePayload.negativePartialSafetyNetTriggered = true;
                updatePayload.juditNeedsEscavador = true;
                updatePayload.juditNeedsEscavadorReason = 'negative_partial_safety_net';
                updatePayload.aiError = null;

                await caseRef.update({
                    ...updatePayload,
                    autoClassifiedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                await materializeModuleRunsFromCaseRef(caseRef, caseId, freshData);

                console.log(`Case ${caseId} [SafetyNet]: Escavador triggered for ${autoClassification.criminalFlag}. Reasons: ${safetyNet.reasons.join(', ')}`);
                return;
            }
        } catch (err) {
            console.warn(`Case ${caseId} [SafetyNet]: failed to load Escavador config:`, err.message);
        }
    }

    const caseDataForAi = { ...freshData, ...autoClassification, _caseId: caseId };
    const homonymInput = buildHomonymAnalysisInput(caseDataForAi);

    if (homonymInput.needsAnalysis) {
        updatePayload.aiHomonymTriggered = true;
        updatePayload.aiHomonymContextVersion = AI_HOMONYM_CONTEXT_VERSION;
        updatePayload.aiHomonymAmbiguityReasons = homonymInput.ambiguityReasons;
        updatePayload.aiHomonymHardFacts = homonymInput.hardFacts;
        updatePayload.aiHomonymDecision = 'UNCERTAIN';
        updatePayload.aiHomonymConfidence = 'LOW';
        updatePayload.aiHomonymRisk = 'MEDIUM';
        updatePayload.aiHomonymRecommendedAction = 'MANUAL_REVIEW';
    } else {
        Object.assign(updatePayload, buildAiHomonymResetPayload(homonymInput));
    }

    if (aiEnabled) {
        try {
            const aiKey = openaiApiKey.value();
            if (aiKey) {
                if (homonymInput.needsAnalysis) {
                    const homonymResult = await runAiHomonymAnalysis(caseDataForAi, homonymInput, aiKey);
                    Object.assign(updatePayload, buildAiHomonymUpdatePayload(caseDataForAi, homonymInput, homonymResult));
                    Object.assign(caseDataForAi, {
                        aiHomonymTriggered: true,
                        aiHomonymStructured: homonymResult.structured || null,
                        aiHomonymStructuredOk: homonymResult.structuredOk || false,
                        aiHomonymDecision: homonymResult.structured?.decision || null,
                        aiHomonymConfidence: homonymResult.structured?.confidence || null,
                        aiHomonymRisk: homonymResult.structured?.homonymRisk || null,
                        aiHomonymRecommendedAction: homonymResult.structured?.recommendedAction || null,
                    });

                    console.log(`Case ${caseId} [AI_HOMONYM]: ${homonymResult.error ? 'ERROR' : 'OK'} (${homonymResult.fromCache ? 'cached' : 'fresh'}, $${(updatePayload.aiHomonymCostUsd || 0).toFixed(4)}, structured=${homonymResult.structuredOk})`);

                    writeAuditEvent({
                        action: 'AI_HOMONYM_ANALYSIS_RUN',
                        tenantId,
                        actor: { type: ACTOR_TYPE.SYSTEM, id: 'system', email: 'cloud-function' },
                        entity: { type: 'CASE', id: caseId, label: freshData.candidateName || caseId },
                        related: { caseId },
                        source: SOURCE.CLOUD_FUNCTION,
                        metadata: {
                            model: homonymResult.model,
                            tokens: updatePayload.aiHomonymTokens,
                            cost: updatePayload.aiHomonymCostUsd,
                            structuredOk: homonymResult.structuredOk,
                            promptVersion: AI_HOMONYM_PROMPT_VERSION,
                            contextVersion: AI_HOMONYM_CONTEXT_VERSION,
                            decision: homonymResult.structured?.decision || null,
                            confidence: homonymResult.structured?.confidence || null,
                            fromCache: !!homonymResult.fromCache,
                        },
                        templateVars: { candidateName: freshData.candidateName || caseId },
                    }).catch((auditErr) => console.warn('Audit log write failed:', auditErr.message));
                }

                const aiResult = await runAiAnalysis(caseDataForAi, aiKey);
                Object.assign(updatePayload, buildAiUpdatePayload({ ...freshData, ...autoClassification }, aiResult));
                Object.assign(caseDataForAi, {
                    aiStructured: aiResult.structured || null,
                    aiStructuredOk: aiResult.structuredOk || false,
                });
                console.log(`Case ${caseId} [AI]: ${aiResult.error ? 'ERROR' : 'OK'} (${aiResult.fromCache ? 'cached' : 'fresh'}, $${(updatePayload.aiCostUsd || 0).toFixed(4)}, structured=${aiResult.structuredOk})`);

                writeAuditEvent({
                    action: 'AI_ANALYSIS_RUN',
                    tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM, id: 'system', email: 'cloud-function' },
                    entity: { type: 'CASE', id: caseId, label: freshData.candidateName || caseId },
                    related: { caseId },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: {
                        model: aiResult.model,
                        tokens: updatePayload.aiTokens,
                        cost: updatePayload.aiCostUsd,
                        structuredOk: aiResult.structuredOk,
                        promptVersion: AI_PROMPT_VERSION,
                        fromCache: !!aiResult.fromCache,
                    },
                    templateVars: { candidateName: freshData.candidateName || caseId },
                }).catch((auditErr) => console.warn('Audit log write failed:', auditErr.message));

                // P08: Only run prefill if AI general analysis succeeded
                if (aiResult.structuredOk && !aiResult.error) {
                    const prefillResult = await runAiPrefillAnalysis(caseDataForAi, aiKey);
                    Object.assign(updatePayload, buildAiPrefillUpdatePayload(prefillResult));
                    console.log(`Case ${caseId} [AI_PREFILL]: ${prefillResult.error ? 'ERROR' : 'OK'} (${prefillResult.fromCache ? 'cached' : 'fresh'}, structured=${prefillResult.structuredOk})`);
                } else {
                    console.log(`Case ${caseId} [AI_PREFILL]: Skipped â€” AI general analysis failed or not structured.`);
                    updatePayload.prefillNarratives = {
                        metadata: {
                            model: AI_MODEL,
                            promptVersion: AI_PREFILL_PROMPT_VERSION,
                            executedAt: new Date().toISOString(),
                            ok: false,
                            fromCache: false,
                            error: 'Skipped: AI general analysis failed.',
                        },
                    };
                }
            } else if (homonymInput.needsAnalysis) {
                updatePayload.aiHomonymError = 'Chave OpenAI nao configurada.';
            }
        } catch (aiErr) {
            console.error(`Case ${caseId} [AI]: error:`, aiErr.message);
            updatePayload.aiError = aiErr.message;
            updatePayload.prefillNarratives = {
                metadata: {
                    model: AI_MODEL,
                    promptVersion: AI_PREFILL_PROMPT_VERSION,
                    executedAt: new Date().toISOString(),
                    ok: false,
                    fromCache: false,
                    error: aiErr.message,
                },
            };
            if (homonymInput.needsAnalysis && !updatePayload.aiHomonymError) {
                updatePayload.aiHomonymError = aiErr.message;
            }
        }
    } else {
        if (homonymInput.needsAnalysis && !updatePayload.aiHomonymError) {
            updatePayload.aiHomonymError = updatePayload.aiError || 'IA desabilitada para este tenant.';
        }
        updatePayload.prefillNarratives = {
            metadata: {
                model: AI_MODEL,
                promptVersion: AI_PREFILL_PROMPT_VERSION,
                executedAt: new Date().toISOString(),
                ok: false,
                fromCache: false,
                error: updatePayload.aiError || 'IA desabilitada para este tenant.',
            },
        };
    }

    // Deterministic prefill: generate rich content for all narrative fields
    try {
        const detPrefill = buildDeterministicPrefill(caseDataForAi);
        updatePayload.deterministicPrefill = detPrefill;
        console.log(`Case ${caseId} [DET_PREFILL]: OK (complex=${detPrefill.metadata.isComplex}, triggers=${detPrefill.metadata.triggersActive.length}, keyFindings=${detPrefill.keyFindings.length})`);

        // Merge deterministic into prefillNarratives:
        // v5: ALL 6 fields are deterministic (zero AI narratives)
        const currentPrefill = updatePayload.prefillNarratives || {};
        const aiOk = currentPrefill.metadata?.ok === true;
        const sanitized = sanitizeAiPrefillStructured({
            criminalNotes: detPrefill.criminalNotes,
            laborNotes: detPrefill.laborNotes,
            warrantNotes: detPrefill.warrantNotes,
            keyFindings: detPrefill.keyFindings,
            executiveSummary: detPrefill.executiveSummary,
            finalJustification: detPrefill.finalJustification,
        });
        const mergedPrefill = {
            ...sanitized,
            metadata: {
                ...(currentPrefill.metadata || {}),
                source: 'deterministic',
                deterministicVersion: detPrefill.metadata.version,
                mergedAt: new Date().toISOString(),
            },
        };
        updatePayload.prefillNarratives = mergedPrefill;
        console.log(`Case ${caseId} [PREFILL_MERGE]: source=${mergedPrefill.metadata.source}, aiOk=${aiOk}`);
    } catch (detErr) {
        console.error(`Case ${caseId} [DET_PREFILL]: error:`, detErr.message);
        updatePayload.deterministicPrefill = {
            metadata: {
                source: 'deterministic',
                version: 'v5-deterministic-prefill',
                generatedAt: new Date().toISOString(),
                error: detErr.message,
                triggersActive: [],
                isComplex: false,
            },
        };
    }

    if (Object.keys(updatePayload).length > 0) {
        await caseRef.update({
            ...updatePayload,
            autoClassifiedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await materializeModuleRunsFromCaseRef(caseRef, caseId, freshData);
    }
}

function computeAutoClassification(caseData) {
    const result = {};
    const enrichmentOriginalValues = caseData.enrichmentOriginalValues || {};
    const criminalNotes = [];
    const warrantNotes = [];
    const laborNotes = [];
    const escavadorFailed = caseData.escavadorEnrichmentStatus === 'FAILED';
    const juditFailed = caseData.juditEnrichmentStatus === 'FAILED';
    const fontedataFailed = caseData.enrichmentStatus === 'FAILED';
    const bigdatacorpDone = caseData.bigdatacorpEnrichmentStatus === 'DONE' || caseData.bigdatacorpEnrichmentStatus === 'PARTIAL';
    const fontedataCriminal = caseData.fontedataCriminalFlag === 'POSITIVE';
    const fontedataLabor = caseData.fontedataLaborFlag === 'POSITIVE';
    const fontedataWarrant = caseData.fontedataWarrantFlag === 'POSITIVE';
    const bigdatacorpCriminal = bigdatacorpDone && caseData.bigdatacorpCriminalFlag === 'POSITIVE';
    const bigdatacorpLabor = bigdatacorpDone && caseData.bigdatacorpLaborFlag === 'POSITIVE';
    const djenDone = caseData.djenEnrichmentStatus === 'DONE';
    const djenCriminal = djenDone && caseData.djenCriminalFlag === 'POSITIVE';
    const djenLabor = djenDone && caseData.djenLaborFlag === true;
    // DJEN searches by name only â€” unreliable as strong evidence for common names
    const namesakeCount = caseData.bigdatacorpNamesakeCount || 0;
    const djenReliableAsStrongEvidence = namesakeCount <= 10;
    const djenCriminalStrong = djenCriminal && djenReliableAsStrongEvidence;
    const djenCriminalWeak = djenCriminal && !djenReliableAsStrongEvidence;
    const bigdatacorpPep = bigdatacorpDone && caseData.bigdatacorpIsPep === true;
    const bigdatacorpSanctioned = bigdatacorpDone && caseData.bigdatacorpIsSanctioned === true;
    const bigdatacorpWasSanctioned = bigdatacorpDone && caseData.bigdatacorpWasSanctioned === true;
    const juditExecutionPositive = caseData.juditExecutionFlag === 'POSITIVE';
    const homonymInput = buildHomonymAnalysisInput(caseData);
    const coverage = homonymInput.providerCoverage || {};
    const overallCoverage = coverage.overall || {};
    const referenceCandidates = homonymInput.referenceCandidates || [];
    const ambiguousCandidates = homonymInput.ambiguousCandidates || [];
    const hardFacts = new Set(homonymInput.hardFacts || []);
    const coverageReasonLabels = {
        JUDIT_ZERO_ESCAVADOR_FOUND: 'Judit sem retorno processual enquanto Escavador encontrou registros.',
        ESCAVADOR_ZERO_JUDIT_FOUND: 'Escavador sem retorno enquanto Judit encontrou registros.',
        ESCAVADOR_ZERO_BDC_COMPENSATES: 'Escavador sem retorno, porem BigDataCorp confirmou processos â€” divergencia reduzida.',
        PROCESS_COUNT_DIVERGENCE: 'Quantidade de processos diverge entre os providers.',
        ONLY_WEAK_EVIDENCE: 'Ha apenas evidencias fracas por nome ou identidade parcial.',
        MIXED_STRONG_AND_WEAK_EVIDENCE: 'Ha mistura de evidencia forte com ruido por nome/homonimo.',
        PROVIDER_FAILURE_REDUCES_COVERAGE: 'Falha de provider reduziu a cobertura disponivel.',
        NO_PROCESS_EVIDENCE_RETURNED: 'Nenhum provider retornou processo aproveitavel.',
    };
    const ambiguityReasonLabels = {
        COMMON_NAME_HIGH_POLLUTION: 'Nome muito comum com alta poluicao de CPFs associados.',
        MULTIPLE_CPFS_SAME_NAME: 'Ha multiplos CPFs com o mesmo nome nas fontes consultadas.',
        NAME_BASED_MATCH_PRESENT: 'Parte dos achados veio apenas por nome.',
        DISTANT_GEOGRAPHY_WITHOUT_IDENTITY_LINK: 'Ha processos em geografia distante sem elo identitario forte.',
        CRIMINAL_WEAK_MATCH: 'Existem achados criminais sustentados apenas por match fraco.',
        JUDIT_NAME_SUPPLEMENT_USED: 'A Judit precisou usar suplemento por nome.',
        PROVIDER_DIVERGENCE_WITH_WEAK_MATCH: 'Providers divergem e os achados dependem de evidencia fraca.',
        LOW_PROVIDER_COVERAGE: 'A cobertura geral das fontes ficou reduzida.',
        LIMITED_GEO_PROFILE: 'O perfil geografico do candidato e insuficiente para validar os achados.',
    };
    const coverageNotes = [...new Set((overallCoverage.reasons || []).map((code) => coverageReasonLabels[code] || code))];
    const ambiguityNotes = [...new Set((homonymInput.ambiguityReasons || []).map((code) => ambiguityReasonLabels[code] || code))];

    const pushUnique = (list, message) => {
        if (message && !list.includes(message)) list.push(message);
    };
    const isLaborCandidate = (candidate) => {
        const area = candidate?.area || '';
        // courtType "Trabalh*" is definitive
        if (/trabalh/i.test(candidate?.courtType || '')) return true;
        // "Direito Processual Civil e do Trabalho" is procedural law, NOT a labor case
        if (/processual\s+civil/i.test(area)) return false;
        return /trabalh/i.test(area);
    };
    const protectedLowRiskCnjs = new Set(
        referenceCandidates
            .filter((candidate) => candidate.hasExactCpfMatch && candidate.lowRiskRole && candidate.cnj)
            .map((candidate) => candidate.cnj),
    );
    const isProtectedByLowRisk = (candidate) => Boolean(candidate?.cnj && protectedLowRiskCnjs.has(candidate.cnj));
    const normalizedReferenceCandidates = referenceCandidates.filter(
        (candidate) => !(candidate.hasExactCpfMatch && !candidate.lowRiskRole && isProtectedByLowRisk(candidate)),
    );

    // BUG-9 fix: Deduplicate cross-provider candidates by CNJ.
    // The same lawsuit may appear in both Judit and Escavador; without dedup,
    // strongCriminalCount double-counts it, potentially inflating severity.
    const EVIDENCE_STRENGTH_ORDER = ['HARD_FACT', 'EXACT_CPF_LOW_RISK_ROLE', 'PARTIAL_MATCH', 'WEAK_MATCH', 'DISCARDED_DIFFERENT_CPF'];
    const dedupByCnj = (candidates) => {
        const byCnj = new Map();
        for (const candidate of candidates) {
            const cnj = candidate.cnj;
            if (!cnj) { byCnj.set(`__no_cnj_${byCnj.size}`, candidate); continue; }
            const existing = byCnj.get(cnj);
            if (!existing) { byCnj.set(cnj, candidate); continue; }
            const existingRank = EVIDENCE_STRENGTH_ORDER.indexOf(existing.evidenceStrength);
            const newRank = EVIDENCE_STRENGTH_ORDER.indexOf(candidate.evidenceStrength);
            if (newRank >= 0 && (existingRank < 0 || newRank < existingRank)) {
                byCnj.set(cnj, candidate);
            }
        }
        return [...byCnj.values()];
    };
    const dedupedReferenceCandidates = dedupByCnj(normalizedReferenceCandidates);

    const relevantCriminalCandidates = dedupedReferenceCandidates.filter(
        (candidate) => candidate.isCriminal && !candidate.lowRiskRole,
    );
    const relevantLaborCandidates = dedupedReferenceCandidates.filter(
        (candidate) => isLaborCandidate(candidate) && !candidate.lowRiskRole,
    );
    const lowRiskReferenceCandidates = referenceCandidates.filter(
        (candidate) => candidate.hasExactCpfMatch && (candidate.lowRiskRole || isProtectedByLowRisk(candidate)),
    );
    const lowRiskLaborCandidates = referenceCandidates.filter(
        (candidate) => isLaborCandidate(candidate) && (candidate.lowRiskRole || isProtectedByLowRisk(candidate)),
    );
    const weakCriminalCandidates = ambiguousCandidates.filter((candidate) => candidate.isCriminal);
    const weakLaborCandidates = ambiguousCandidates.filter((candidate) => isLaborCandidate(candidate));
    const strongCriminalSources = [...new Set([
        ...(fontedataCriminal ? ['FonteData'] : []),
        ...(bigdatacorpCriminal ? ['BigDataCorp'] : []),
        ...(djenCriminalStrong ? ['DJEN'] : []),
        ...relevantCriminalCandidates.map((candidate) => candidate.source),
        ...(hardFacts.has('ACTIVE_WARRANT') ? ['Judit/Warrant'] : []),
        ...(hardFacts.has('PENAL_EXECUTION') ? ['Judit/Execution'] : []),
        ...(bigdatacorpSanctioned ? ['BigDataCorp/KYC'] : []),
    ])];
    const strongCriminalCount = relevantCriminalCandidates.length
        + (hardFacts.has('ACTIVE_WARRANT') ? 1 : 0)
        + (hardFacts.has('PENAL_EXECUTION') ? 1 : 0)
        + (fontedataCriminal ? 1 : 0)
        + (djenCriminalStrong ? 1 : 0);
    const hasStrongCriminalEvidence = strongCriminalCount > 0;
    const hasWeakCriminalEvidence = weakCriminalCandidates.length > 0 || djenCriminalWeak;
    const hasLowRiskOnly = lowRiskReferenceCandidates.length > 0
        && relevantCriminalCandidates.length === 0
        && !fontedataCriminal
        && !bigdatacorpCriminal
        && !hardFacts.has('ACTIVE_WARRANT')
        && !hardFacts.has('PENAL_EXECUTION');

    result.coverageLevel = overallCoverage.level || 'LOW_COVERAGE';
    result.coverageNotes = coverageNotes;
    result.providerDivergence = overallCoverage.providerDivergence || 'NONE';
    result.ambiguityNotes = ambiguityNotes;

    if (hasStrongCriminalEvidence) {
        result.criminalFlag = 'POSITIVE';
        result.criminalEvidenceQuality = hasWeakCriminalEvidence ? 'MIXED_STRONG_AND_WEAK' : 'HARD_FACT';
        pushUnique(
            criminalNotes,
            `Criminal POSITIVO: evidencia forte confirmada por ${strongCriminalSources.join(', ')}.`,
        );
        if (hardFacts.has('ACTIVE_WARRANT')) {
            const warrantParts = [];
            if ((caseData.juditActiveWarrantCount || 0) > 0) warrantParts.push(`${caseData.juditActiveWarrantCount} via Judit`);
            const bdcW = Array.isArray(caseData.bigdatacorpActiveWarrants) ? caseData.bigdatacorpActiveWarrants.length : 0;
            if (bdcW > 0) warrantParts.push(`${bdcW} via BigDataCorp`);
            if (caseData.bigdatacorpHasArrestWarrant && bdcW === 0) warrantParts.push('detectado via BigDataCorp');
            pushUnique(criminalNotes, `Mandado ativo confirmado (${warrantParts.join(', ') || 'fonte nao especificada'}).`);
        }
        if (hardFacts.has('PENAL_EXECUTION')) {
            pushUnique(criminalNotes, `Execucao penal positiva confirmada via Judit (${caseData.juditExecutionCount || 0}).`);
        }
        if (hasWeakCriminalEvidence) {
            pushUnique(criminalNotes, `Achados adicionais por nome/match fraco (${weakCriminalCandidates.length}) foram separados como evidencia ambigua e nao rebaixam o fato duro.`);
        }
        if (djenCriminalStrong) {
            pushUnique(criminalNotes, `DJEN: ${caseData.djenCriminalCount || 0} comunicacao(oes) criminal(is) confirmada(s) no Diario de Justica Eletronico.`);
        }
    } else if (hasWeakCriminalEvidence) {
        result.criminalFlag = 'INCONCLUSIVE_HOMONYM';
        result.criminalEvidenceQuality = 'WEAK_NAME_ONLY';
        pushUnique(criminalNotes, `Criminal INCONCLUSIVO por homonimia: ${weakCriminalCandidates.length} achado(s) dependem de nome, identidade fraca ou geografia inconsistente.`);
        if (djenCriminalWeak) {
            pushUnique(criminalNotes, `DJEN: ${caseData.djenCriminalCount || 0} comunicacao(oes) no Diario de Justica Eletronico desconsiderada(s) como evidencia forte â€” nome com ${namesakeCount} homonimos no Brasil.`);
        }
        ambiguityNotes.forEach((note) => pushUnique(criminalNotes, note));
    } else if (escavadorFailed && juditFailed && fontedataFailed) {
        result.criminalFlag = 'NOT_FOUND';
        result.criminalEvidenceQuality = 'NO_PROVIDER_RESPONSE';
        pushUnique(criminalNotes, 'Criminal NAO ENCONTRADO: todas as fontes falharam e nao houve resposta aproveitavel.');
    } else if (hasLowRiskOnly) {
        result.criminalFlag = 'NEGATIVE';
        result.criminalEvidenceQuality = 'LOW_RISK_ROLE_ONLY';
        pushUnique(criminalNotes, 'Nao ha evidencia criminal relevante; os matches exatos encontrados aparecem apenas em papel de baixo risco, como testemunha/informante.');
    } else if (
        result.coverageLevel === 'LOW_COVERAGE'
        && (result.providerDivergence === 'HIGH' || coverageNotes.length > 0)
    ) {
        result.criminalFlag = 'INCONCLUSIVE_LOW_COVERAGE';
        result.criminalEvidenceQuality = 'LOW_COVERAGE_ONLY';
        pushUnique(criminalNotes, 'Criminal INCONCLUSIVO por baixa cobertura: as fontes nao sustentam leitura negativa forte nem evidenciam fato penal confirmatorio.');
        coverageNotes.forEach((note) => pushUnique(criminalNotes, note));
    } else if (
        escavadorFailed
        || juditFailed
        || fontedataFailed
        || result.coverageLevel !== 'HIGH_COVERAGE'
        || result.providerDivergence !== 'NONE'
    ) {
        result.criminalFlag = 'NEGATIVE_PARTIAL';
        result.criminalEvidenceQuality = 'NEGATIVE_WITH_PARTIAL_COVERAGE';
        pushUnique(criminalNotes, 'Criminal NEGATIVO com cobertura parcial: nao houve indicio penal confirmado, mas a cobertura das fontes nao foi plena.');
        coverageNotes.forEach((note) => pushUnique(criminalNotes, note));
    } else {
        result.criminalFlag = 'NEGATIVE';
        result.criminalEvidenceQuality = 'CONFIRMED_NEGATIVE';
        pushUnique(criminalNotes, 'Nenhum processo criminal/penal relevante foi detectado nas fontes com cobertura satisfatoria.');
    }

    if (result.criminalFlag === 'POSITIVE') {
        if (hardFacts.has('ACTIVE_WARRANT') || hardFacts.has('PENAL_EXECUTION') || strongCriminalCount >= 3) {
            result.criminalSeverity = 'HIGH';
        } else if (strongCriminalCount >= 2 || hasWeakCriminalEvidence) {
            result.criminalSeverity = 'MEDIUM';
        } else {
            result.criminalSeverity = 'LOW';
        }
    }

    const juditWarrantPositive = caseData.juditWarrantFlag === 'POSITIVE';
    const juditWarrantInconclusive = caseData.juditWarrantFlag === 'INCONCLUSIVE';
    const juditActiveWarrants = caseData.juditActiveWarrantCount || 0;
    const juditTotalWarrants = caseData.juditWarrantCount || 0;
    const juditWarrantStatus = caseData.juditSources?.warrant?.status;
    const warrantSourceFailed = caseData.juditSources?.warrant?.error
        || juditWarrantStatus === 'TIMEOUT' || juditWarrantStatus === 'CANCELLED' || juditWarrantStatus === 'FAILED' || juditWarrantStatus === 'ERROR'
        || caseData.enrichmentSources?.warrant?.error;

    const bigdatacorpWarrants = Array.isArray(caseData.bigdatacorpActiveWarrants) ? caseData.bigdatacorpActiveWarrants : [];
    const bigdatacorpHasWarrant = bigdatacorpWarrants.length > 0 || caseData.bigdatacorpHasArrestWarrant === true;

    if (juditWarrantPositive || fontedataWarrant || bigdatacorpHasWarrant) {
        result.warrantFlag = 'POSITIVE';
        const parts = [];
        if (juditActiveWarrants > 0) parts.push(`${juditActiveWarrants} mandado(s) ativo(s) via Judit`);
        if (fontedataWarrant) parts.push('detectado via FonteData');
        if (bigdatacorpWarrants.length > 0) parts.push(`${bigdatacorpWarrants.length} mandado(s) via BigDataCorp`);
        pushUnique(warrantNotes, `Mandado POSITIVO: ${parts.join(', ')}.`);
        if (juditActiveWarrants > 0 && bigdatacorpWarrants.length > 0) {
            pushUnique(warrantNotes, 'Nota: mandados Judit e BigDataCorp podem ter sobreposicao (mesmo mandado em ambas as fontes).');
        }
        if (caseData.juditWarrantNotes && !/aguardando callback/i.test(caseData.juditWarrantNotes)) pushUnique(warrantNotes, caseData.juditWarrantNotes);
    } else if (juditWarrantInconclusive) {
        result.warrantFlag = 'INCONCLUSIVE';
        pushUnique(warrantNotes, `Mandado INCONCLUSIVO: ${juditTotalWarrants} mandado(s) encontrado(s), mas nenhum com status pendente.`);
        if (caseData.juditWarrantNotes && !/aguardando callback/i.test(caseData.juditWarrantNotes)) pushUnique(warrantNotes, caseData.juditWarrantNotes);
    } else if (warrantSourceFailed) {
        result.warrantFlag = 'NOT_FOUND';
        pushUnique(warrantNotes, 'Mandado NAO ENCONTRADO: consulta Judit falhou.');
    } else {
        result.warrantFlag = 'NEGATIVE';
        pushUnique(warrantNotes, 'Nenhum mandado de prisao encontrado.');
    }

    const laborSourceFailed = fontedataFailed && caseData.enrichmentSources?.labor?.error;

    if (fontedataLabor || bigdatacorpLabor || djenLabor || relevantLaborCandidates.length > 0) {
        result.laborFlag = 'POSITIVE';
        const sources = [];
        if (fontedataLabor) sources.push('FonteData TRT');
        if (bigdatacorpLabor) sources.push('BigDataCorp');
        if (djenLabor) sources.push('DJEN');
        if (relevantLaborCandidates.some((candidate) => candidate.source === 'Escavador')) sources.push('Escavador');
        if (relevantLaborCandidates.some((candidate) => candidate.source === 'Judit')) sources.push('Judit');
        if (relevantLaborCandidates.some((candidate) => candidate.source === 'BigDataCorp')) sources.push('BigDataCorp');
        pushUnique(laborNotes, `Trabalhista POSITIVO confirmado por: ${sources.join(', ') || 'processos identificados'}.`);
    } else if (lowRiskLaborCandidates.length > 0) {
        result.laborFlag = 'NEGATIVE';
        pushUnique(laborNotes, 'Processos trabalhistas encontrados apenas em papel de baixo risco, como testemunha; nao ha apontamento trabalhista relevante contra o candidato.');
    } else if (weakLaborCandidates.length > 0) {
        result.laborFlag = 'INCONCLUSIVE';
        pushUnique(laborNotes, 'Achados trabalhistas dependem de match fraco ou nome e permanecem inconclusivos.');
    } else if (laborSourceFailed && relevantLaborCandidates.length === 0) {
        result.laborFlag = 'NOT_FOUND';
        pushUnique(laborNotes, 'Trabalhista NAO ENCONTRADO: consulta FonteData TRT falhou.');
    } else {
        result.laborFlag = 'NEGATIVE';
        pushUnique(laborNotes, 'Nenhum processo trabalhista relevante detectado.');
    }

    result.reviewRecommended = [
        'INCONCLUSIVE_HOMONYM',
        'INCONCLUSIVE_LOW_COVERAGE',
    ].includes(result.criminalFlag) || hasWeakCriminalEvidence;

    // BigDataCorp KYC: PEP and Sanctions as NEW classification dimensions
    if (bigdatacorpPep) {
        result.pepFlag = 'POSITIVE';
        result.pepLevel = caseData.bigdatacorpPepLevel || null;
        result.pepNotes = caseData.bigdatacorpKycNotes || 'PEP detectado via BigDataCorp KYC.';
        result.reviewRecommended = true;
    } else if (bigdatacorpDone) {
        result.pepFlag = 'NEGATIVE';
    }

    if (bigdatacorpSanctioned) {
        result.sanctionFlag = 'POSITIVE';
        result.sanctionSources = caseData.bigdatacorpSanctionSources || [];
        result.sanctionTypes = caseData.bigdatacorpSanctionTypes || [];
        result.sanctionNotes = caseData.bigdatacorpKycNotes || 'Sancao ativa detectada via BigDataCorp KYC.';
        result.reviewRecommended = true;
        // Sanctions with terrorism/corruption/slavery are critical
        if (caseData.bigdatacorpHasTerrorism || caseData.bigdatacorpHasCorruption || caseData.bigdatacorpHasSlaveryCrime) {
            pushUnique(criminalNotes, 'ALERTA CRITICO BigDataCorp KYC: sancao ativa com vinculo a terrorismo, corrupcao ou trabalho escravo.');
        }
        pushUnique(criminalNotes, `Sancao ativa detectada via BigDataCorp KYC: fontes ${(caseData.bigdatacorpSanctionSources || []).join(', ')}.`);
    } else if (bigdatacorpWasSanctioned) {
        result.sanctionFlag = 'HISTORICAL';
        result.sanctionSources = caseData.bigdatacorpSanctionSources || [];
        result.sanctionNotes = 'Historico de sancao detectado (nao ativa) via BigDataCorp KYC.';
        pushUnique(criminalNotes, 'Historico de sancao (nao ativa) detectado via BigDataCorp KYC.');
    } else if (bigdatacorpDone) {
        result.sanctionFlag = 'NEGATIVE';
    }

    result.criminalNotes = criminalNotes.join('\n');
    result.warrantNotes = warrantNotes.join('\n');
    result.laborNotes = laborNotes.join('\n');

    result.enrichmentOriginalValues = {
        ...enrichmentOriginalValues,
        criminalFlag: result.criminalFlag,
        warrantFlag: result.warrantFlag,
        laborFlag: result.laborFlag,
        pepFlag: result.pepFlag || null,
        sanctionFlag: result.sanctionFlag || null,
        coverageLevel: result.coverageLevel,
        coverageNotes: result.coverageNotes,
        providerDivergence: result.providerDivergence,
        ambiguityNotes: result.ambiguityNotes,
        criminalEvidenceQuality: result.criminalEvidenceQuality,
        reviewRecommended: result.reviewRecommended,
        criminalNotes: result.criminalNotes,
        warrantNotes: result.warrantNotes,
        laborNotes: result.laborNotes,
    };
    if (result.criminalSeverity) {
        result.enrichmentOriginalValues.criminalSeverity = result.criminalSeverity;
    }

    if (juditExecutionPositive) {
        result.criminalNotes += `${result.criminalNotes ? '\n' : ''}Execucao penal detectada via Judit (${caseData.juditExecutionCount || 0}).`;
        if (caseData.juditExecutionNotes) result.criminalNotes += `\n${caseData.juditExecutionNotes}`;
        if (result.criminalFlag !== 'POSITIVE') result.criminalFlag = 'POSITIVE';
        if (!result.criminalSeverity) {
            result.criminalSeverity = 'MEDIUM';
        }
        result.enrichmentOriginalValues.criminalFlag = result.criminalFlag;
        result.enrichmentOriginalValues.criminalSeverity = result.criminalSeverity;
        result.enrichmentOriginalValues.criminalNotes = result.criminalNotes;
    }

    return result;
}

/* =========================================================
   JUDIT onDocumentUpdated â€” REMOVED (now onDocumentCreated primary).
   Backward compat: old cases with enrichmentStatus DONE/PARTIAL
   will NOT auto-trigger Judit. Use manual rerun instead.
   ========================================================= */

/* =========================================================
   PUBLISH RESULT ON CASE DONE â€” Subcollection for client access
   Creates cases/{caseId}/publicResult/latest with sanitized fields.
   Only fires when analyst concludes (status transitions to DONE).
   ========================================================= */

const IDENTITY_FIELDS = [
    'candidateName', 'cpfMasked', 'candidatePosition', 'hiringUf', 'tenantId', 'createdAt',
];

const RESULT_ONLY_FIELDS = [
    'criminalFlag', 'criminalSeverity', 'criminalNotes',
    'laborFlag', 'laborSeverity', 'laborNotes',
    'warrantFlag', 'warrantNotes',
    'osintLevel', 'osintVectors', 'osintNotes',
    'socialStatus', 'socialReasons', 'socialNotes',
    'digitalFlag', 'digitalVectors', 'digitalNotes',
    'conflictInterest', 'conflictNotes',
    'riskScore', 'riskLevel', 'finalVerdict', 'analystComment',
    'enabledPhases',
    'processHighlights',
    'warrantFindings',
    'keyFindings',
    'executiveSummary',
    'publicReportToken',
];

const CLIENT_SAFE_PUBLICATION_FIELDS = [
    'statusSummary',
    'sourceSummary',
    'nextSteps',
    'timelineEvents',
    'socialProfiles',
    'reportReady',
    'reportSlug',
    'concludedAt',
    'turnaroundHours',
];

const PUBLIC_RESULT_FIELDS = [...IDENTITY_FIELDS, ...RESULT_ONLY_FIELDS, ...CLIENT_SAFE_PUBLICATION_FIELDS];

const CLIENT_CASE_FIELDS = [
    ...PUBLIC_RESULT_FIELDS,
    'candidateId',
    'tenantName',
    'status',
    'priority',
    'createdDateKey',
    'createdMonthKey',
    'concludedAt',
    'updatedAt',
    'correctedAt',
    'correctionReason',
    'correctionNotes',
    'correctionRequestedAt',
    'correctionRequestedBy',
    // executiveSummary, keyFindings, processHighlights, warrantFindings already in PUBLIC_RESULT_FIELDS
    'statusSummary',
    'sourceSummary',
    'nextSteps',
    'clientNotes',
    'hasNotes',
    'hasEvidence',
];

function buildClientCasePayload(caseId, caseData) {
    const payload = { caseId };

    // BUG-1 fix: Only include result flags (criminalFlag, warrantFlag, etc.) when case is DONE.
    // Before DONE, the client mirror should NOT expose preliminary enrichment flags.
    const isConcluded = caseData.status === 'DONE';
    const fieldsToSync = isConcluded ? CLIENT_CASE_FIELDS : CLIENT_CASE_FIELDS.filter((f) => !RESULT_ONLY_FIELDS.includes(f));

    for (const field of fieldsToSync) {
        const value = caseData[field];
        if (value !== undefined && value !== null) {
            payload[field] = value;
        }
    }

    const createdAtDate = asDate(caseData.createdAt);
    if (!payload.createdDateKey && createdAtDate) payload.createdDateKey = formatDateKey(createdAtDate);
    if (!payload.createdMonthKey && createdAtDate) payload.createdMonthKey = formatMonthKey(createdAtDate);
    if (payload.reportReady === undefined) payload.reportReady = caseData.status === 'DONE' && caseData.reportReady !== false;
    if (payload.hasNotes === undefined) payload.hasNotes = Boolean(caseData.analystComment || caseData.executiveSummary || caseData.clientNotes);
    if (payload.hasEvidence === undefined) {
        payload.hasEvidence = Boolean(
            (Array.isArray(caseData.processHighlights) && caseData.processHighlights.length > 0)
            || (Array.isArray(caseData.warrantFindings) && caseData.warrantFindings.length > 0)
            || (Array.isArray(caseData.keyFindings) && caseData.keyFindings.length > 0)
            || (Array.isArray(caseData.timelineEvents) && caseData.timelineEvents.some((event) => event.status === 'risk'))
        );
    }

    return payload;
}

async function writeClientCaseMirror(caseId, caseData) {
    const payload = buildClientCasePayload(caseId, caseData);
    // clientCases is a fully controlled sanitized mirror, so replace the whole
    // document to prevent stale public fields from surviving across reopens.
    await db.collection('clientCases').doc(caseId).set(payload);
}

exports.syncClientCaseOnCreate = onDocumentCreated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async () => {
        const caseData = event.data?.data();
        if (!caseData) return;
        const caseId = event.params.caseId;
        await writeClientCaseMirror(caseId, caseData);
        await syncClientCaseListProjection(caseId, caseData);
    },
);

exports.syncClientCaseOnUpdate = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const after = event.data?.after?.data();
        if (!after) return;
        const caseId = event.params.caseId;
        await writeClientCaseMirror(caseId, after);
        await syncClientCaseListProjection(caseId, after);
    },
);

exports.syncClientCaseOnDelete = onDocumentDeleted(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const caseId = event.params.caseId;
        await db.collection('clientCases').doc(caseId).delete().catch(() => {});
        await db.collection('clientCaseList').doc(caseId).delete().catch(() => {});
    },
);

exports.publishResultOnCaseDone = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        const caseId = event.params.caseId;

        if (after.status === 'DONE') {
            // P06: Guard â€” skip if concludeCaseByAnalyst already wrote publicResult/latest synchronously
            const existingPublic = await db.collection('cases').doc(caseId).collection('publicResult').doc('latest').get();
            if (existingPublic.exists) {
                const existingConcludedAt = existingPublic.data()?.concludedAt;
                const afterConcludedAt = after.concludedAt;
                if (existingConcludedAt && afterConcludedAt && existingConcludedAt.toMillis?.() >= afterConcludedAt.toMillis?.()) {
                    console.log(`Case ${caseId}: publicResult/latest already up-to-date (sync write), skipping trigger.`);
                    return;
                }
            }
            const publicData = await syncPublicResultLatest(caseId, after, {}, {
                concludedAtOverride: after.concludedAt || after.updatedAt || new Date(),
            });
            console.log(`Case ${caseId}: publicResult/latest published with ${Object.keys(publicData).length} fields.`);
            return;
        }

        if (before.status === 'DONE') {
            await revokeCasePublicationArtifacts(caseId, before);
            console.log(`Case ${caseId}: public publication artifacts revoked after leaving DONE.`);
        }
    },
);

/* =========================================================
   CLIENT / ADMIN CALLABLES
   ========================================================= */

exports.createOpsClientUser = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const operatorProfile = await getOpsUserProfile(uid);
        const {
            email,
            password,
            displayName,
            tenantName,
            tenantId: requestedTenantId = null,
            role = 'client_manager',
        } = request.data || {};

        if (!CLIENT_VIEW_ROLES.has(role)) {
            throw new HttpsError('invalid-argument', 'Role invalida para usuario cliente.');
        }

        if (!email || !password || !displayName || !(requestedTenantId || tenantName)) {
            throw new HttpsError('invalid-argument', 'Dados obrigatorios ausentes para criar o cliente.');
        }

        const tenantId = requestedTenantId || normalizeTenantSlug(tenantName);
        if (!tenantId) {
            throw new HttpsError('invalid-argument', 'Nao foi possivel gerar tenantId valido.');
        }

        const authUser = await getAuth().createUser({
            email,
            password,
            displayName,
        });

        try {
            await db.collection('userProfiles').doc(authUser.uid).set({
                email,
                displayName,
                role,
                tenantId,
                tenantName: tenantName || requestedTenantId,
                status: 'active',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Sync custom claims for Firestore rules (avoids getUserProfile reads)
            await getAuth().setCustomUserClaims(authUser.uid, { role, tenantId });

            const tenantRef = db.collection('tenantSettings').doc(tenantId);
            const tenantDoc = await tenantRef.get();
            if (!tenantDoc.exists) {
                await tenantRef.set({
                    analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG },
                    updatedAt: FieldValue.serverTimestamp(),
                });
            }

            await writeAuditEvent({
                action: 'USER_CREATED',
                tenantId: null,
                actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: operatorProfile.email || uid },
                entity: { type: 'USER', id: authUser.uid, label: email },
                related: { userId: authUser.uid },
                source: SOURCE.PORTAL_OPS,
                ip: getClientIp(request),
                detail: `Cliente criado: ${tenantName || tenantId} (${email})`,
                templateVars: { tenantName: tenantName || tenantId },
            });

            return { uid: authUser.uid, tenantId };
        } catch (error) {
            await getAuth().deleteUser(authUser.uid).catch(() => {});
            throw error;
        }
    },
);

/* =========================================================
   TENANT USER MANAGEMENT â€” Client manager self-service
   ========================================================= */

exports.listTenantUsers = onCall(
    { region: 'southamerica-east1' },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Login necessario.');

        const callerProfile = await getClientUserProfile(uid);
        if (callerProfile.role !== 'client_manager') {
            throw new HttpsError('permission-denied', 'Apenas gestores podem listar usuarios da equipe.');
        }

        const snapshot = await db.collection('userProfiles')
            .where('tenantId', '==', callerProfile.tenantId)
            .get();

        const users = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (!CLIENT_VIEW_ROLES.has(data.role)) return;
            users.push({
                uid: doc.id,
                email: data.email || '',
                displayName: data.displayName || '',
                role: data.role,
                status: data.status || 'active',
                createdAt: data.createdAt || null,
            });
        });

        return { users };
    },
);

exports.createTenantUser = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Login necessario.');

        const callerProfile = await getClientUserProfile(uid);
        if (callerProfile.role !== 'client_manager') {
            throw new HttpsError('permission-denied', 'Apenas gestores podem criar usuarios.');
        }

        const { email, password, displayName, role = 'client_viewer' } = request.data || {};

        if (!CLIENT_MANAGEABLE_ROLES.has(role)) {
            throw new HttpsError('invalid-argument', 'Role invalida. Use client_viewer, client_operator ou client_manager.');
        }
        if (!email || !password || !displayName) {
            throw new HttpsError('invalid-argument', 'Email, senha e nome sao obrigatorios.');
        }

        const tenantId = callerProfile.tenantId;
        const tenantName = callerProfile.tenantName;

        const authUser = await getAuth().createUser({ email, password, displayName });

        try {
            await db.collection('userProfiles').doc(authUser.uid).set({
                email,
                displayName,
                role,
                tenantId,
                tenantName,
                status: 'active',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Sync custom claims for Firestore rules
            await getAuth().setCustomUserClaims(authUser.uid, { role, tenantId });

            await writeAuditEvent({
                action: 'TENANT_USER_CREATED',
                tenantId,
                actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: callerProfile.email || uid },
                entity: { type: 'USER', id: authUser.uid, label: email },
                related: { userId: authUser.uid },
                source: SOURCE.PORTAL_CLIENT,
                ip: getClientIp(request),
                detail: `Usuario ${email} criado pelo gestor ${callerProfile.email}.`,
                templateVars: { targetEmail: email },
            });

            return { uid: authUser.uid };
        } catch (error) {
            await getAuth().deleteUser(authUser.uid).catch(() => {});
            throw error;
        }
    },
);

exports.updateTenantUser = onCall(
    { region: 'southamerica-east1' },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Login necessario.');

        const callerProfile = await getClientUserProfile(uid);
        if (callerProfile.role !== 'client_manager') {
            throw new HttpsError('permission-denied', 'Apenas gestores podem modificar usuarios.');
        }

        const { targetUid, role, status, displayName } = request.data || {};
        if (!targetUid) {
            throw new HttpsError('invalid-argument', 'ID do usuario alvo e obrigatorio.');
        }

        const targetDoc = await db.collection('userProfiles').doc(targetUid).get();
        if (!targetDoc.exists) {
            throw new HttpsError('not-found', 'Usuario nao encontrado.');
        }
        const targetProfile = targetDoc.data();

        if (targetProfile.tenantId !== callerProfile.tenantId) {
            throw new HttpsError('permission-denied', 'Voce nao pode gerenciar usuarios de outra franquia.');
        }
        if (!CLIENT_VIEW_ROLES.has(targetProfile.role)) {
            throw new HttpsError('permission-denied', 'Este usuario nao pode ser gerenciado por aqui.');
        }
        if (targetUid === uid && role && role !== 'client_manager') {
            throw new HttpsError('invalid-argument', 'Voce nao pode remover seu proprio acesso de gestor.');
        }
        if (targetUid === uid && status === 'inactive') {
            throw new HttpsError('invalid-argument', 'Voce nao pode desativar a si mesmo.');
        }

        const updateData = { updatedAt: FieldValue.serverTimestamp() };

        if (role !== undefined) {
            if (!CLIENT_MANAGEABLE_ROLES.has(role)) {
                throw new HttpsError('invalid-argument', 'Role invalida. Use client_viewer, client_operator ou client_manager.');
            }
            updateData.role = role;
        }
        if (status !== undefined) {
            if (!['active', 'inactive'].includes(status)) {
                throw new HttpsError('invalid-argument', 'Status invalido. Use active ou inactive.');
            }
            updateData.status = status;
            if (status === 'inactive') {
                await getAuth().updateUser(targetUid, { disabled: true });
            } else {
                await getAuth().updateUser(targetUid, { disabled: false });
            }
        }
        if (displayName !== undefined) {
            if (typeof displayName !== 'string' || displayName.trim().length < 2) {
                throw new HttpsError('invalid-argument', 'Nome precisa ter pelo menos 2 caracteres.');
            }
            updateData.displayName = displayName.trim();
        }

        await db.collection('userProfiles').doc(targetUid).update(updateData);

        // Sync custom claims when role changes
        if (updateData.role) {
            const freshDoc = await db.collection('userProfiles').doc(targetUid).get();
            const freshData = freshDoc.data() || {};
            await getAuth().setCustomUserClaims(targetUid, {
                role: freshData.role,
                tenantId: freshData.tenantId,
            });
        }

        const changes = [];
        if (role) changes.push(`role=${role}`);
        if (status) changes.push(`status=${status}`);
        if (displayName) changes.push(`name=${displayName}`);

        await writeAuditEvent({
            action: 'TENANT_USER_UPDATED',
            tenantId: callerProfile.tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: callerProfile.email || uid },
            entity: { type: 'USER', id: targetUid, label: targetProfile.email },
            related: { userId: targetUid },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `${targetProfile.email}: ${changes.join(', ')}.`,
            templateVars: { targetEmail: targetProfile.email, changes: changes.join(', ') },
        });

        return { success: true };
    },
);

/* â”€â”€ updateOwnProfile â”€â”€ */
exports.updateOwnProfile = onCall(
    { region: 'southamerica-east1' },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profileDoc = await db.collection('userProfiles').doc(uid).get();
        if (!profileDoc.exists) {
            throw new HttpsError('not-found', 'Perfil nao encontrado.');
        }

        const { displayName } = request.data || {};
        if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
            throw new HttpsError('invalid-argument', 'Nome precisa ter pelo menos 2 caracteres.');
        }

        const trimmed = displayName.trim();
        await db.collection('userProfiles').doc(uid).update({
            displayName: trimmed,
            updatedAt: FieldValue.serverTimestamp(),
        });
        await getAuth().updateUser(uid, { displayName: trimmed });

        await writeAuditEvent({
            action: 'OWN_PROFILE_UPDATED',
            tenantId: profileDoc.data().tenantId || null,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profileDoc.data().email || uid, displayName: trimmed },
            entity: { type: 'PROFILE', id: uid, label: trimmed },
            related: { userId: uid },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `displayName: ${trimmed}`,
            templateVars: { actorName: trimmed },
        });

        return { success: true, displayName: trimmed };
    },
);

exports.createClientSolicitation = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid, { requireRequester: true });
        const {
            fullName,
            cpf,
            dateOfBirth = '',
            position = '',
            department = '',
            hiringUf = '',
            email = '',
            phone = '',
            priority = 'NORMAL',
            digitalProfileNotes = '',
            socialProfiles = {},
            otherSocialUrls = [],
        } = request.data || {};

        const candidateName = String(fullName || '').trim();
        const cpfDigits = sanitizeCpf(cpf);
        if (!candidateName || cpfDigits.length !== 11) {
            throw new HttpsError('invalid-argument', 'Nome completo e CPF valido sao obrigatorios.');
        }

        const tenantId = profile.tenantId;
        const tenantName = profile.tenantName || tenantId;
        const tenantData = await getTenantSettingsData(tenantId);
        const analysisConfig = tenantData?.analysisConfig || DEFAULT_ANALYSIS_CONFIG;
        const enabledPhases = Object.entries(analysisConfig)
            .filter(([, value]) => value?.enabled)
            .map(([key]) => key);

        await enforceTenantSubmissionLimits(tenantId, tenantData || {}, {
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid },
            ip: getClientIp(request),
        });

        const now = new Date();
        const createdDateKey = formatDateKey(now);
        const createdMonthKey = formatMonthKey(now);
        const candidateRef = db.collection('candidates').doc();
        const caseRef = db.collection('cases').doc();

        const batch = db.batch();

        batch.set(candidateRef, {
            tenantId,
            tenantName,
            candidateName,
            cpf: cpfDigits,
            cpfMasked: maskCpf(cpfDigits),
            candidatePosition: String(position || ''),
            department: String(department || ''),
            dateOfBirth: String(dateOfBirth || ''),
            email: String(email || ''),
            phone: String(phone || ''),
            instagram: String(socialProfiles.instagram || ''),
            facebook: String(socialProfiles.facebook || ''),
            linkedin: String(socialProfiles.linkedin || ''),
            tiktok: String(socialProfiles.tiktok || ''),
            twitter: String(socialProfiles.twitter || ''),
            youtube: String(socialProfiles.youtube || ''),
            otherSocialUrls: Array.isArray(otherSocialUrls) ? otherSocialUrls : [],
            digitalProfileNotes: String(digitalProfileNotes || ''),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const requestedModuleKeys = inferRequestedModuleKeys({
            enabledPhases: enabledPhases.length > 0 ? enabledPhases : Object.keys(DEFAULT_ANALYSIS_CONFIG),
        });
        const casePayload = {
            tenantId,
            tenantName,
            candidateId: candidateRef.id,
            candidateName,
            candidatePosition: String(position || ''),
            department: String(department || ''),
            cpf: cpfDigits,
            cpfMasked: maskCpf(cpfDigits),
            hiringUf: String(hiringUf || ''),
            productKey: 'dossier_pf_basic',
            requestedModuleKeys,
            priority: priority === 'HIGH' ? 'HIGH' : 'NORMAL',
            requestedBy: formatRequestedBy(profile, uid),
            requestedByName: profile.displayName || null,
            requestedByEmail: profile.email || null,
            enabledPhases: enabledPhases.length > 0 ? enabledPhases : Object.keys(DEFAULT_ANALYSIS_CONFIG),
            socialProfiles: {
                instagram: String(socialProfiles.instagram || ''),
                facebook: String(socialProfiles.facebook || ''),
                linkedin: String(socialProfiles.linkedin || ''),
                tiktok: String(socialProfiles.tiktok || ''),
                twitter: String(socialProfiles.twitter || ''),
                youtube: String(socialProfiles.youtube || ''),
            },
            otherSocialUrls: Array.isArray(otherSocialUrls) ? otherSocialUrls : [],
            dateOfBirth: String(dateOfBirth || ''),
            email: String(email || ''),
            phone: String(phone || ''),
            clientSubmissionNotes: String(digitalProfileNotes || ''),
            status: 'PENDING',
            assigneeId: null,
            criminalFlag: null,
            laborFlag: null,
            laborSeverity: null,
            laborNotes: '',
            warrantFlag: null,
            warrantNotes: '',
            osintLevel: null,
            socialStatus: null,
            digitalFlag: null,
            conflictInterest: null,
            finalVerdict: 'PENDING',
            riskLevel: null,
            riskScore: 0,
            hasNotes: false,
            hasEvidence: false,
            enrichmentStatus: 'PENDING',
            enrichmentSources: {},
            enrichmentIdentity: null,
            enrichmentGateResult: null,
            enrichedAt: null,
            enrichmentOriginalValues: {},
            aiAnalysis: null,
            aiCostUsd: null,
            aiModel: null,
            aiTokens: null,
            aiError: null,
            createdDateKey,
            createdMonthKey,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };
        batch.set(caseRef, casePayload);
        await batch.commit();

        // Phase 3: Subject Identity Resolution
        let subjectId = null;
        try {
            subjectId = await resolveSubject({
                tenantId,
                taxId: cpfDigits,
                name: candidateName,
                caseId: caseRef.id,
                caseData: casePayload,
            });
            await caseRef.update({ subjectId });
            console.log(`Case ${caseRef.id} linked to Subject ${subjectId}`);
        } catch (subErr) {
            console.warn(`Failed to resolve subject for case ${caseRef.id}:`, subErr.message);
        }

        const moduleRunState = await materializeModuleRunsForCase(caseRef.id, { ...casePayload, subjectId });

        await writeAuditEvent({
            action: 'SOLICITATION_CREATED',
            tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: caseRef.id, label: candidateName },
            related: { caseId: caseRef.id },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `Nova solicitacao criada para ${candidateName}`,
        });

        return {
            caseId: caseRef.id,
            candidateId: candidateRef.id,
            moduleRunSummary: moduleRunState.summary,
        };
    },
);

exports.submitClientCorrection = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid, { requireRequester: true });
        const { caseId, candidateName, cpf, linkedin = '', instagram = '' } = request.data || {};
        if (!caseId || !candidateName || !cpf) {
            throw new HttpsError('invalid-argument', 'Dados obrigatorios ausentes para reenviar o caso.');
        }

        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');

        const caseData = caseDoc.data() || {};
        if (caseData.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Caso fora do tenant do cliente.');
        }
        if (caseData.status !== 'CORRECTION_NEEDED') {
            throw new HttpsError('failed-precondition', 'Apenas casos com correcao solicitada podem ser reenviados.');
        }

        const cpfDigits = sanitizeCpf(cpf);
        if (cpfDigits.length !== 11) {
            throw new HttpsError('invalid-argument', 'CPF invalido para reenviar o caso.');
        }

        const corrections = Array.isArray(caseData.corrections) ? caseData.corrections : [];
        const batch = db.batch();

        // AUD-002: Revoke public report when case is corrected/resubmitted
        if (caseData.publicReportToken || caseData.status === 'DONE') {
            await revokeCasePublicationArtifacts(caseId, caseData);
        }

        batch.update(caseRef, {
            candidateName: String(candidateName).trim(),
            cpf: cpfDigits,
            cpfMasked: maskCpf(cpfDigits),
            socialProfiles: {
                ...(caseData.socialProfiles || {}),
                linkedin: String(linkedin || ''),
                instagram: String(instagram || ''),
            },
            status: 'PENDING',
            // BUG-2 fix: Reset enrichment statuses so the pipeline can re-run.
            juditEnrichmentStatus: 'PENDING',
            juditError: null,
            escavadorEnrichmentStatus: 'PENDING',
            escavadorError: null,
            enrichmentStatus: 'PENDING',
            enrichmentError: null,
            // Clear stale classification and AI data so they don't bleed into re-analysis
            autoClassifiedAt: FieldValue.delete(),
            criminalFlag: FieldValue.delete(),
            criminalSeverity: FieldValue.delete(),
            criminalEvidenceQuality: FieldValue.delete(),
            criminalNotes: FieldValue.delete(),
            warrantFlag: FieldValue.delete(),
            warrantNotes: FieldValue.delete(),
            laborFlag: FieldValue.delete(),
            laborNotes: FieldValue.delete(),
            coverageLevel: FieldValue.delete(),
            providerDivergence: FieldValue.delete(),
            reviewRecommended: FieldValue.delete(),
            aiRawResponse: FieldValue.delete(),
            aiStructured: FieldValue.delete(),
            aiStructuredOk: FieldValue.delete(),
            aiError: FieldValue.delete(),
            aiHomonymStructured: FieldValue.delete(),
            aiHomonymTriggered: FieldValue.delete(),
            aiHomonymError: FieldValue.delete(),
            riskScore: FieldValue.delete(),
            riskLevel: FieldValue.delete(),
            finalVerdict: FieldValue.delete(),
            ...buildResetPublishedCaseFields(caseData, {
                preserveReviewDraft: true,
            }),
            correctedAt: FieldValue.serverTimestamp(),
            correctedBy: {
                uid,
                email: profile.email || null,
                displayName: profile.displayName || null,
            },
            corrections: [
                ...corrections,
                {
                    submittedAt: new Date().toISOString(),
                    submittedBy: profile.email || uid,
                },
            ],
            updatedAt: FieldValue.serverTimestamp(),
        });

        // AUD-016: Sync corrected data to candidates/{candidateId}
        if (caseData.candidateId) {
            const candidateRef = db.collection('candidates').doc(caseData.candidateId);
            batch.update(candidateRef, {
                candidateName: String(candidateName).trim(),
                cpf: cpfDigits,
                cpfMasked: maskCpf(cpfDigits),
                linkedin: String(linkedin || ''),
                instagram: String(instagram || ''),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }

        await batch.commit();

        await writeAuditEvent({
            action: 'CASE_CORRECTED',
            tenantId: profile.tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: caseId, label: String(candidateName).trim() },
            related: { caseId },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `Caso corrigido e reenviado: ${String(candidateName).trim()}`,
        });

        return { success: true };
    },
);

exports.registerClientExport = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid);
        const { type, scope, records = 0, artifactMode = 'download' } = request.data || {};
        if (!type || !scope) {
            throw new HttpsError('invalid-argument', 'Tipo e escopo da exportacao sao obrigatorios.');
        }

        const exportRef = db.collection('exports').doc();
        const batch = db.batch();
        batch.set(exportRef, {
            tenantId: profile.tenantId,
            type: String(type),
            scope: String(scope),
            records: Number(records) || 0,
            artifactMode: String(artifactMode || 'download'),
            status: 'READY',
            createdAt: FieldValue.serverTimestamp(),
        });

        await batch.commit();

        await writeAuditEvent({
            action: 'EXPORT_CREATED',
            tenantId: profile.tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid },
            entity: { type: 'EXPORT', id: exportRef.id, label: `${type}:${scope}` },
            related: { exportId: exportRef.id },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `Exportacao gerada com ${Number(records) || 0} registros`,
        });

        return { exportId: exportRef.id };
    },
);

exports.backfillClientCasesMirror = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 540 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
        const profile = await getOpsUserProfile(uid);
        if (!hasV2Permission(profile.role, V2_PERMISSIONS.USERS_MANAGE)) {
            throw new HttpsError('permission-denied', 'Requer permissao de admin.');
        }

        const snapshot = await db.collection('cases').get();
        const docs = snapshot.docs || [];
        let count = 0;

        for (let start = 0; start < docs.length; start += 400) {
            const chunk = docs.slice(start, start + 400);
            const batch = db.batch();
            chunk.forEach((docSnap) => {
                batch.set(
                    db.collection('clientCases').doc(docSnap.id),
                    buildClientCasePayload(docSnap.id, docSnap.data() || {}),
                    { merge: true },
                );
                count += 1;
            });
            await batch.commit();
        }
        return { synced: count };
    },
);

exports.createAnalystPublicReport = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const meta = sanitizePublicReportMeta(request.data?.meta || {});
        const caseId = typeof request.data?.caseId === 'string' ? request.data.caseId.trim() : '';
        const TTL_DAYS = 365;
        const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
        const reportRef = db.collection('publicReports').doc();

        let reportTenantId = profile.tenantId || null;
        let caseSnap = null;
        let html = '';
        let publicSnapshot = null;
        let publicSnapshotHash = null;
        if (caseId) {
            const caseRef = db.collection('cases').doc(caseId);
            caseSnap = await caseRef.get();
            if (caseSnap.exists) {
                const caseData = caseSnap.data() || {};
                if (caseData.status !== 'DONE') {
                    throw new HttpsError('failed-precondition', 'Relatorio publico so pode ser gerado para casos concluidos.');
                }
                reportTenantId = caseData.tenantId || reportTenantId;
                const v2Artifacts = await materializeV2PublicationArtifacts(caseId, caseData, {
                    concludedAtOverride: caseData.concludedAt || caseData.updatedAt || new Date(),
                    reviewer: {
                        uid: caseData.assigneeId || caseData.analystId || caseData.updatedBy || uid,
                        email: profile.email || uid,
                    },
                    reportCreatedBy: uid,
                    source: SOURCE.PORTAL_OPS,
                });

                await writeAuditEvent({
                    action: 'PUBLIC_REPORT_CREATED',
                    tenantId: reportTenantId,
                    actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
                    entity: { type: 'REPORT_PUBLIC', id: v2Artifacts.publicReportToken, label: caseData.candidateName || meta.candidateName || v2Artifacts.publicReportToken },
                    related: {
                        caseId,
                        reportToken: v2Artifacts.publicReportToken,
                        decisionId: v2Artifacts.decisionId,
                        reportSnapshotId: v2Artifacts.reportSnapshotId,
                    },
                    source: SOURCE.PORTAL_OPS,
                    ip: getClientIp(request),
                    detail: `Relatorio publico V2 gerado${caseData.candidateName ? ` para ${caseData.candidateName}` : ''}`,
                });

                return {
                    token: v2Artifacts.publicReportToken,
                    expiresAt: v2Artifacts.expiresAt?.toISOString?.() || null,
                    reportSnapshotId: v2Artifacts.reportSnapshotId,
                    decisionId: v2Artifacts.decisionId,
                    reportAvailability: v2Artifacts.availability,
                    moduleRunSummary: v2Artifacts.moduleRunSummary,
                };
            }
        }

        if (!html) {
            const rawHtml = String(request.data?.html || '');
            if (!rawHtml.trim()) {
                throw new HttpsError('invalid-argument', 'HTML do relatorio ausente.');
            }
            html = sanitizePublicReportHtml(rawHtml);
            if (!html.trim()) {
                throw new HttpsError('invalid-argument', 'HTML do relatorio ficou vazio apos sanitizacao.');
            }
        }

        await reportRef.set({
            html,
            createdAt: FieldValue.serverTimestamp(),
            expiresAt,
            active: true,
            tenantId: reportTenantId,
            createdBy: uid,
            reportBuildVersion: REPORT_BUILD_VERSION,
            publicSnapshotHash,
            caseId: caseId || null,
            candidateName: String((caseSnap?.data?.()?.candidateName) || meta.candidateName || '').slice(0, 160),
            ...meta,
        });

        // Persist token on the case for reuse by client portal
        if (caseId && caseSnap && caseSnap.exists) {
            const caseRef = db.collection('cases').doc(caseId);
            await caseRef.update({
                publicReportToken: reportRef.id,
                reportReady: publicSnapshot?.reportReady !== false,
                reportSlug: publicSnapshot?.reportSlug || FieldValue.delete(),
            });
        }

        await writeAuditEvent({
            action: 'PUBLIC_REPORT_CREATED',
            tenantId: reportTenantId,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'REPORT_PUBLIC', id: reportRef.id, label: meta.candidateName || reportRef.id },
            related: { caseId, reportToken: reportRef.id },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Relatorio publico gerado${meta.candidateName ? ` para ${meta.candidateName}` : ''}`,
        });

        return {
            token: reportRef.id,
            expiresAt: expiresAt.toISOString(),
        };
    },
);

exports.createClientPublicReport = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid);
        const caseId = String(request.data?.caseId || '').trim();
        if (!caseId) {
            throw new HttpsError('invalid-argument', 'caseId ausente.');
        }

        // Validate case exists, is DONE, and belongs to the client's tenant
        const caseRef = db.collection('cases').doc(caseId);
        const caseSnap = await caseRef.get();
        if (!caseSnap.exists) {
            throw new HttpsError('not-found', 'Caso nao encontrado.');
        }
        const caseData = caseSnap.data();
        if (caseData.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Caso nao pertence ao seu tenant.');
        }
        if (caseData.status !== 'DONE') {
            throw new HttpsError('failed-precondition', 'Relatorio disponivel apenas para casos concluidos.');
        }

        const v2Artifacts = await materializeV2PublicationArtifacts(caseId, caseData, {
            concludedAtOverride: caseData.concludedAt || caseData.updatedAt || new Date(),
            reviewer: {
                uid: caseData.assigneeId || caseData.analystId || caseData.updatedBy || 'legacy_ops_review',
                email: caseData.assigneeEmail || null,
            },
            reportCreatedBy: uid,
            source: SOURCE.PORTAL_CLIENT,
        });

        await writeAuditEvent({
            action: 'CLIENT_PUBLIC_REPORT_CREATED',
            tenantId: profile.tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid },
            entity: { type: 'REPORT_PUBLIC', id: v2Artifacts.publicReportToken, label: caseData.candidateName || caseId },
            related: {
                caseId,
                reportToken: v2Artifacts.publicReportToken,
                decisionId: v2Artifacts.decisionId,
                reportSnapshotId: v2Artifacts.reportSnapshotId,
            },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `Relatorio publico V2 aberto pelo cliente para ${caseData.candidateName || caseId}`,
        });

        return {
            token: v2Artifacts.publicReportToken,
            expiresAt: v2Artifacts.expiresAt?.toISOString?.() || null,
            reportSnapshotId: v2Artifacts.reportSnapshotId,
            decisionId: v2Artifacts.decisionId,
            reportAvailability: v2Artifacts.availability,
            moduleRunSummary: v2Artifacts.moduleRunSummary,
        };
    },
);

function resolvePublicReportStatus(reportData, now = new Date()) {
    const expiresAt = asDate(reportData?.expiresAt);
    const active = reportData?.active !== false;

    if (!active || reportData?.status === 'revoked') return 'REVOKED';
    if (expiresAt && expiresAt < now) return 'EXPIRED';
    return 'ACTIVE';
}

function serializeManagedPublicReport(docSnap) {
    const reportData = docSnap.data() || {};
    const createdAt = asDate(reportData.createdAt);
    const expiresAt = asDate(reportData.expiresAt);

    return {
        id: docSnap.id,
        token: docSnap.id,
        caseId: reportData.caseId || null,
        tenantId: reportData.tenantId || null,
        candidateName: String(reportData.candidateName || '').slice(0, 160),
        active: reportData.active !== false,
        status: resolvePublicReportStatus(reportData),
        createdAt: createdAt ? createdAt.toISOString() : null,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
    };
}

exports.listClientPublicReports = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid);
        const snapshot = await db.collection('publicReports')
            .where('tenantId', '==', profile.tenantId)
            .orderBy('createdAt', 'desc')
            .limit(200)
            .get();

        return {
            reports: snapshot.docs.map(serializeManagedPublicReport),
        };
    },
);

exports.revokeClientPublicReport = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid);
        const token = String(request.data?.token || '').trim();
        if (!token) throw new HttpsError('invalid-argument', 'Token do relatorio ausente.');

        const reportRef = db.collection('publicReports').doc(token);
        const reportSnap = await reportRef.get();
        if (!reportSnap.exists) throw new HttpsError('not-found', 'Relatorio nao encontrado.');

        const reportData = reportSnap.data() || {};
        let caseRef = null;
        let caseData = null;

        if (reportData.caseId) {
            caseRef = db.collection('cases').doc(reportData.caseId);
            const caseSnap = await caseRef.get();
            if (caseSnap.exists) {
                caseData = caseSnap.data() || {};
            }
        }

        const effectiveTenantId = reportData.tenantId || caseData?.tenantId || null;
        if (!effectiveTenantId || effectiveTenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Relatorio nao pertence ao seu tenant.');
        }

        if (reportData.active === false) {
            return { success: true, alreadyRevoked: true };
        }

        await reportRef.update({ active: false });

        if (caseRef && caseData?.publicReportToken === token) {
            await caseRef.update({ publicReportToken: FieldValue.delete() });
        }

        await writeAuditEvent({
            action: 'CLIENT_PUBLIC_REPORT_REVOKED',
            tenantId: effectiveTenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid },
            entity: { type: 'REPORT_PUBLIC', id: token, label: reportData.candidateName || token },
            related: { reportToken: token },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `Relatorio publico revogado pelo cliente${reportData.candidateName ? ` (${reportData.candidateName})` : ''}`,
        });

        return { success: true };
    },
);

// AUD-011: Server-side revocation with audit log
exports.revokePublicReport = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const token = String(request.data?.token || '').trim();
        if (!token) throw new HttpsError('invalid-argument', 'Token do relatorio ausente.');

        const reportRef = db.collection('publicReports').doc(token);
        const reportSnap = await reportRef.get();
        if (!reportSnap.exists) throw new HttpsError('not-found', 'Relatorio nao encontrado.');

        const reportData = reportSnap.data();
        if (reportData.active === false) {
            return { success: true, alreadyRevoked: true };
        }

        await reportRef.update({ active: false });

        // Clear token from the associated case if present
        if (reportData.caseId) {
            const caseRef = db.collection('cases').doc(reportData.caseId);
            const caseSnap = await caseRef.get();
            if (caseSnap.exists && caseSnap.data()?.publicReportToken === token) {
                await caseRef.update({ publicReportToken: FieldValue.delete() });
            }
        }

        await writeAuditEvent({
            action: 'PUBLIC_REPORT_REVOKED',
            tenantId: reportData.tenantId || null,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'REPORT_PUBLIC', id: token, label: reportData.candidateName || token },
            related: { reportToken: token },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Relatorio publico revogado${reportData.candidateName ? ` (${reportData.candidateName})` : ''}`,
        });

        return { success: true };
    },
);

const ALLOWED_CONCLUDE_FIELDS = new Set([
    'assigneeId',
    'executiveSummary',
    'criminalFlag',
    'criminalSeverity',
    'criminalNotes',
    'laborFlag',
    'laborSeverity',
    'laborNotes',
    'warrantFlag',
    'warrantNotes',
    'osintLevel',
    'osintVectors',
    'osintNotes',
    'socialStatus',
    'socialReasons',
    'socialNotes',
    'digitalFlag',
    'digitalVectors',
    'digitalNotes',
    'conflictInterest',
    'conflictNotes',
    'finalVerdict',
    'keyFindings',
    'analystComment',
    'riskLevel',
    'riskScore',
    'enabledPhases',
    'hasNotes',
]);

const ALLOWED_DRAFT_FIELDS = new Set([
    'executiveSummary',
    'criminalFlag',
    'criminalSeverity',
    'criminalNotes',
    'laborFlag',
    'laborSeverity',
    'laborNotes',
    'warrantFlag',
    'warrantNotes',
    'osintLevel',
    'osintVectors',
    'osintNotes',
    'socialStatus',
    'socialReasons',
    'socialNotes',
    'digitalFlag',
    'digitalVectors',
    'digitalNotes',
    'conflictInterest',
    'conflictNotes',
    'finalVerdict',
    'keyFindings',
    'analystComment',
    'riskLevel',
    'riskScore',
]);

const REVIEW_DRAFT_ARRAY_FIELDS = new Set([
    'keyFindings',
    'osintVectors',
    'socialReasons',
    'digitalVectors',
]);

function hasMeaningfulValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== undefined && value !== null;
}

function normalizeKeyFindingsValue(value) {
    if (Array.isArray(value)) {
        return sanitizeStructuredList(value, 8, 220);
    }
    if (typeof value === 'string') {
        return sanitizeStructuredList(
            value.split(/\r?\n|;/).map((item) => item.trim()),
            8,
            220,
        );
    }
    return [];
}

function normalizeNarrativeValue(field, value) {
    if (value === undefined) return undefined;
    if (field === 'keyFindings') return normalizeKeyFindingsValue(value);
    if (REVIEW_DRAFT_ARRAY_FIELDS.has(field)) return Array.isArray(value) ? value.filter(Boolean) : [];
    if (typeof value === 'string') {
        const maxLength = field === 'executiveSummary' ? 900 : field === 'analystComment' ? 900 : 1400;
        return sanitizeStructuredText(value, maxLength);
    }
    return value;
}

function resolveNarrativeField(caseData, payload, field, options = {}) {
    const {
        prefillKey = field,
        fallbackValue = null,
        defaultValue = '',
    } = options;
    const isDoneCase = caseData?.status === 'DONE';
    const reviewDraft = caseData?.reviewDraft || {};
    const prefillNarratives = caseData?.prefillNarratives || {};

    const candidates = [
        payload?.[field],
        isDoneCase ? caseData?.[field] : undefined,
        reviewDraft?.[field],
        prefillNarratives?.[prefillKey],
        typeof fallbackValue === 'function' ? fallbackValue(caseData, payload) : fallbackValue,
        isDoneCase ? undefined : caseData?.[field],
    ];

    for (const candidate of candidates) {
        if (hasMeaningfulValue(candidate)) {
            return normalizeNarrativeValue(field, candidate);
        }
    }

    return field === 'keyFindings' ? [] : defaultValue;
}

function pickConcludePayload(payload = {}) {
    const result = {};
    for (const [key, value] of Object.entries(payload || {})) {
        if (ALLOWED_CONCLUDE_FIELDS.has(key)) {
            result[key] = normalizeNarrativeValue(key, value);
        }
    }
    result.status = 'DONE';
    result.concludedAt = FieldValue.serverTimestamp();
    result.correctionReason = FieldValue.delete();
    result.correctionNotes = FieldValue.delete();
    result.correctionRequestedAt = FieldValue.delete();
    result.correctionRequestedBy = FieldValue.delete();
    result.reviewDraft = FieldValue.delete();
    result.draftSavedAt = FieldValue.delete();
    result.updatedAt = FieldValue.serverTimestamp();
    return result;
}

function pickDraftPayload(payload = {}, existingReviewDraft = {}) {
    const reviewDraft = { ...(existingReviewDraft || {}) };
    for (const [key, value] of Object.entries(payload || {})) {
        if (ALLOWED_DRAFT_FIELDS.has(key)) {
            reviewDraft[key] = normalizeNarrativeValue(key, value);
        }
    }
    return {
        reviewDraft: stripUndefined(reviewDraft),
        draftSavedAt: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
    };
}

exports.assignCaseToCurrentAnalyst = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const caseId = String(request.data?.caseId || '').trim();
        if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');

        const caseData = caseDoc.data() || {};
        if (caseData.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Acesso negado ao caso.');
        }
        await caseRef.update({
            assigneeId: uid,
            status: 'IN_PROGRESS',
            updatedAt: FieldValue.serverTimestamp(),
        });
        await materializeModuleRunsForCase(caseId, {
            ...caseData,
            assigneeId: uid,
            status: 'IN_PROGRESS',
        });

        await writeAuditEvent({
            action: 'CASE_ASSIGNED',
            tenantId: caseData.tenantId || null,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
            related: { caseId },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Caso assumido: ${caseData.candidateName || caseId}`,
        });

        return { success: true };
    },
);

exports.returnCaseToClient = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const caseId = String(request.data?.caseId || '').trim();
        const reason = String(request.data?.reason || '').trim();
        const notes = String(request.data?.notes || '').trim();
        if (!caseId || !reason) {
            throw new HttpsError('invalid-argument', 'caseId e motivo sao obrigatorios.');
        }

        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
        const caseData = caseDoc.data() || {};

        if (caseData.tenantId && caseData.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Sem permissao para operar neste caso.');
        }

        const updateFields = {
            status: 'CORRECTION_NEEDED',
            correctionReason: reason,
            correctionNotes: notes,
            correctionRequestedAt: new Date().toISOString(),
            correctionRequestedBy: profile.email || uid,
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (caseData.status === 'DONE') {
            Object.assign(updateFields, buildResetPublishedCaseFields(caseData, {
                preserveReviewDraft: true,
            }));
        }

        // AUD-002: Revoke public report when case leaves DONE
        if (caseData.publicReportToken || caseData.status === 'DONE') {
            await revokeCasePublicationArtifacts(caseId, caseData);
        }

        await caseRef.update(updateFields);

        await writeAuditEvent({
            action: 'CASE_RETURNED',
            tenantId: caseData.tenantId || null,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
            related: { caseId },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Caso devolvido: ${reason}`,
            templateVars: { reason },
        });

        return { success: true };
    },
);

function buildProcessHighlights(caseData) {
    const juditItems = caseData.juditRoleSummary || [];
    const escItems = caseData.escavadorProcessos || [];
    const seenCnj = new Set();
    const relevant = [];

    for (const p of juditItems) {
        if ((p.secrecyLevel || 0) > 0) continue;
        if (!p.isCriminal && !p.hasExactCpfMatch && p.status !== 'ATIVO') continue;
        if (p.isPossibleHomonym && !p.hasExactCpfMatch) continue;
        if (p.code) seenCnj.add(p.code);
        relevant.push({
            processNumber: p.code,
            area: p.area,
            status: p.status,
            court: p.tribunalAcronym,
            classification: (p.classifications || [])[0] || null,
            stage: p.phase,
            source: 'Judit',
            isCriminal: p.isCriminal,
        });
    }
    for (const p of escItems) {
        const cnj = p.numeroCnj || '';
        // P04: When same CNJ exists in Judit, merge complementary data instead of discarding
        if (cnj && seenCnj.has(cnj)) {
            const existing = relevant.find((r) => r.processNumber === cnj);
            if (existing) {
                if (!existing.classification && p.assuntoPrincipal) existing.classification = p.assuntoPrincipal;
                if (!existing.stage && p.grauFormatado) existing.stage = p.grauFormatado;
                if (!existing.status && p.status) existing.status = p.status;
                if (existing.source === 'Judit') existing.source = 'Judit / Escavador';
            }
            continue;
        }
        // AUD-005: Filter segredoJustica in Escavador (parity with Judit secrecyLevel filter)
        if (p.segredoJustica) continue;
        const isCriminal = /penal|criminal/i.test(p.area || '');
        const isActive = /ativo/i.test(p.status || '');
        if (!isCriminal && !isActive) continue;
        relevant.push({
            processNumber: cnj || null,
            area: p.area,
            status: p.status,
            court: p.tribunalSigla,
            classification: p.assuntoPrincipal || null,
            stage: p.grauFormatado || null,
            source: 'Escavador',
            isCriminal,
        });
    }

    // BigDataCorp processes
    const bdcItems = caseData.bigdatacorpProcessos || [];
    for (const p of bdcItems) {
        const cnj = p.numeroCnj || '';
        if (cnj && seenCnj.has(cnj)) {
            const existing = relevant.find((r) => r.processNumber === cnj);
            if (existing) {
                if (!existing.classification && p.assunto) existing.classification = p.assunto;
                if (!existing.court && p.tribunal) existing.court = p.tribunal;
                if (existing.source && !existing.source.includes('BigDataCorp')) existing.source += ' / BigDataCorp';
            }
            continue;
        }
        if (cnj) seenCnj.add(cnj);
        const isCriminal = /penal|criminal/i.test(p.area || '');
        const isActive = /ativo|tramitando/i.test(p.status || '');
        if (!isCriminal && !isActive) continue;
        relevant.push({
            processNumber: cnj || null,
            area: p.area || null,
            status: p.status || null,
            court: p.tribunal || null,
            classification: p.assunto || null,
            stage: p.grau || null,
            source: 'BigDataCorp',
            isCriminal,
        });
    }

    const byArea = {};
    for (const p of relevant.slice(0, 30)) {
        const area = p.area || 'Outros';
        if (!byArea[area]) byArea[area] = [];
        byArea[area].push(p);
    }
    return Object.entries(byArea).map(([area, items]) => ({
        title: area,
        area,
        source: 'Judit / Escavador / BigDataCorp',
        total: items.length,
        summary: `${items.length} registro(s) identificado(s) na Ã¡rea ${area}.`,
        items: items.map((p) => ({
            processNumber: p.processNumber || 'NÂº nÃ£o disponÃ­vel',
            status: p.status,
            court: p.court,
            classification: p.classification,
            stage: p.stage,
        })),
    }));
}

function buildWarrantFindings(caseData) {
    const findings = (caseData.juditWarrants || []).map((w) => ({
        status: w.status || 'Status nÃ£o informado',
        court: w.court || w.tribunalAcronym || null,
        reference: w.code || null,
        source: 'Judit',
        summary: [
            w.warrantType,
            w.arrestType,
            w.issueDate ? `Emitido em ${w.issueDate}` : null,
            w.regime ? `Regime: ${w.regime}` : null,
        ].filter(Boolean).join('. '),
    }));
    // FonteData is a reserve provider â€” only include its warrant finding when Judit returned nothing
    if (findings.length === 0 && caseData.enrichmentSources?.warrant && !caseData.enrichmentSources.warrant.error) {
        const ws = caseData.enrichmentSources.warrant;
        if (ws.result === 'POSITIVE' || caseData.warrantFlag === 'POSITIVE') {
            findings.push({
                status: 'Mandado detectado',
                court: null,
                reference: null,
                source: 'FonteData (cnj-mandados-prisao)',
                summary: ws.detail || 'Mandado de prisao detectado via consulta CNJ-Mandados (FonteData).',
            });
        }
    }
    return findings;
}

/* =========================================================
   DETERMINISTIC PREFILL: parallel generation for comparison.
   These helpers produce fully deterministic narratives using
   only enrichment data + autoClassification â€” NO AI involved.
   ========================================================= */

function evaluateComplexityTriggers(caseData) {
    const triggers = [];
    if (caseData.reviewRecommended) triggers.push('REVIEW_RECOMMENDED');
    if ((caseData.ambiguityNotes || []).length > 0) triggers.push('HOMONYM_AMBIGUITY');
    const eq = caseData.criminalEvidenceQuality || '';
    if (['MIXED_STRONG_AND_WEAK', 'WEAK_NAME_ONLY'].includes(eq)) triggers.push('CRIMINAL_EVIDENCE_UNCERTAIN');
    if (caseData.providerDivergence === 'HIGH') triggers.push('HIGH_PROVIDER_DIVERGENCE');
    if (caseData.coverageLevel === 'LOW_COVERAGE') triggers.push('LOW_COVERAGE');
    if (['INCONCLUSIVE_HOMONYM', 'INCONCLUSIVE_LOW_COVERAGE'].includes(caseData.criminalFlag)) triggers.push('CRIMINAL_FLAG_INCONCLUSIVE');
    if (caseData.warrantFlag === 'INCONCLUSIVE') triggers.push('WARRANT_FLAG_INCONCLUSIVE');
    return { isComplex: triggers.length > 0, triggersActive: triggers };
}

function buildDetCriminalNotes(caseData) {
    const parts = [];
    const cf = caseData.criminalFlag || 'NEGATIVE';
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const namesakeCount = caseData.bigdatacorpNamesakeCount;

    // Separate by CPF confirmation
    const cpfConfirmed = criminalProcesses.filter((p) => p.matchType === 'CPF confirmado');
    const nameOnly = criminalProcesses.filter((p) => p.matchType !== 'CPF confirmado');

    // Header context (no redundant status â€” badge already in report)
    if (cf === 'POSITIVE') {
        const sev = (caseData.criminalSeverity || 'nÃ£o classificada').toUpperCase();
        parts.push(`Severidade ${sev}. SÃ­ntese dos registros em nome de ${caseData.candidateName || 'candidato(a)'}:`);
    } else if (cf === 'INCONCLUSIVE_HOMONYM') {
        parts.push('PossÃ­vel homonÃ­mia detectada â€” registros identificados podem nÃ£o pertencer ao candidato.');
    } else if (cf === 'INCONCLUSIVE_LOW_COVERAGE') {
        parts.push('Cobertura insuficiente das bases consultadas â€” resultado pode nÃ£o refletir a situaÃ§Ã£o real.');
    } else if (cf === 'NEGATIVE_PARTIAL') {
        parts.push('Consulta realizada com cobertura parcial das bases disponÃ­veis.');
    } else if (cf === 'NOT_FOUND') {
        parts.push('Candidato nÃ£o localizado nas bases criminais consultadas.');
    } else {
        parts.push('Nenhum processo criminal identificado nas bases consultadas.');
        return parts.join('\n');
    }

    // CPF-confirmed processes
    if (cpfConfirmed.length > 0) {
        parts.push('');
        parts.push(`PROCESSOS IDENTIFICADOS (${cpfConfirmed.length} com CPF confirmado):`);
        for (let i = 0; i < cpfConfirmed.length; i++) {
            const p = cpfConfirmed[i];
            // Extract sentence details from decisions
            const sentence = extractSentenceDetails(p.allDecisions);
            // Detect carta de guia
            const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
            const opts = {};
            if (sentence.penalty) opts.penalty = sentence.penalty.charAt(0) + sentence.penalty.slice(1).toLowerCase();
            if (sentence.regime) opts.regime = sentence.regime.charAt(0) + sentence.regime.slice(1).toLowerCase();
            if (sentence.situation) opts.situation = sentence.situation.charAt(0) + sentence.situation.slice(1).toLowerCase();
            if (sentence.articles.length > 0) opts.articles = sentence.articles;
            if (cg.found) {
                const cgLabel = cg.tipo ? `Carta de guia ${cg.tipo.toLowerCase()}` : 'Carta de guia';
                opts.cartaDeGuia = `${cgLabel} expedida â€” condenaÃ§Ã£o transitada em julgado`;
            }
            parts.push('');
            parts.push(`${i + 1}. ${formatCnj(p.cnj)}`);
            parts.push(formatProcessBlock(p, opts));
        }
    }

    // Name-only processes
    if (nameOnly.length > 0) {
        parts.push('');
        const label = nameOnly.length === 1 ? 'PROCESSO ADICIONAL (sem confirmaÃ§Ã£o de CPF):' : `PROCESSOS ADICIONAIS (${nameOnly.length}, sem confirmaÃ§Ã£o de CPF):`;
        parts.push(label);
        for (const p of nameOnly) {
            parts.push('');
            parts.push(formatProcessBlock(p, {}));
        }
        if (namesakeCount != null) {
            if (namesakeCount <= 1) {
                parts.push(`   Nota: Apenas ${namesakeCount || 1} pessoa no Brasil com o nome "${caseData.candidateName || 'N/A'}". Probabilidade alta de se referir ao mesmo indivÃ­duo, porÃ©m sem confirmaÃ§Ã£o documental.`);
            } else if (namesakeCount <= 5) {
                parts.push(`   Nota: ${namesakeCount} pessoas no Brasil com esse nome â€” probabilidade moderada de homonÃ­mia.`);
            } else {
                parts.push(`   Nota: ${namesakeCount} pessoas no Brasil com esse nome â€” probabilidade relevante de homonÃ­mia.`);
            }
        }
    }

    // Fallback body when header exists but no processes to list
    if (cpfConfirmed.length === 0 && nameOnly.length === 0 && cf !== 'NEGATIVE') {
        parts.push('');
        parts.push('Dados detalhados de processos indisponÃ­veis â€” classificaÃ§Ã£o baseada nos indicadores das fontes consultadas.');
    }

    // Observations
    const observations = [];
    // Carta de guia general note
    for (const p of cpfConfirmed) {
        const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
        if (cg.found) {
            const cgLabel = cg.tipo ? `Carta de Guia ${cg.tipo}` : 'Carta de Guia';
            observations.push(`${cgLabel} expedida no processo ${formatCnj(p.cnj)} â€” condenaÃ§Ã£o em fase de execuÃ§Ã£o penal`);
            break;
        }
    }
    // Penal execution
    if (caseData.juditExecutionFlag === 'POSITIVE') {
        observations.push(`ExecuÃ§Ã£o penal registrada: ${caseData.juditExecutionCount || 1} registro(s)`);
    }
    // PEP / Sanctions
    if (caseData.pepFlag === 'POSITIVE') {
        observations.push(`Pessoa politicamente exposta (PEP) detectada`);
    }
    if (caseData.sanctionFlag === 'POSITIVE') {
        observations.push(`SanÃ§Ã£o ativa detectada`);
    } else if (caseData.sanctionFlag === 'HISTORICAL') {
        observations.push(`HistÃ³rico de sanÃ§Ã£o (nÃ£o ativa) registrado`);
    }
    // Geographic concentration
    const comarcas = [...new Set(criminalProcesses.map((p) => p.comarca).filter(Boolean))];
    if (comarcas.length === 1) {
        observations.push(`Todos os processos concentrados na Comarca de ${comarcas[0]}`);
    }

    if (observations.length > 0) {
        parts.push('');
        parts.push('OBSERVAÃ‡Ã•ES:');
        for (const obs of observations) {
            parts.push(`â€¢ ${obs}`);
        }
    }

    return parts.join('\n');
}

function buildDetLaborNotes(caseData) {
    const parts = [];
    const lf = caseData.laborFlag || 'NEGATIVE';
    const topProcessos = selectTopProcessos(caseData, 20);
    const laborProcesses = topProcessos.filter((p) => p.isTrabalhista);

    // Header context (no redundant status â€” badge already in report)
    if (lf === 'POSITIVE') {
        parts.push('Processos trabalhistas identificados nas bases consultadas.');
    } else if (lf === 'INCONCLUSIVE') {
        parts.push('Resultado inconclusivo na anÃ¡lise trabalhista.');
    } else if (lf === 'NOT_FOUND') {
        parts.push('Candidato nÃ£o localizado nas bases trabalhistas consultadas.');
    } else {
        parts.push('NÃ£o possui, atÃ© a data da solicitaÃ§Ã£o, nenhum processo trabalhista jÃ¡ distribuÃ­do em seu nome.');
    }

    // Process listing (when POSITIVE)
    if (laborProcesses.length > 0) {
        parts.push('');
        parts.push(`PROCESSOS TRABALHISTAS (${laborProcesses.length}):`);
        for (let i = 0; i < Math.min(laborProcesses.length, 6); i++) {
            const p = laborProcesses[i];
            parts.push('');
            parts.push(`${i + 1}. ${formatCnj(p.cnj)}`);
            parts.push(formatProcessBlock(p, {}));
        }
        if (laborProcesses.length > 6) {
            parts.push(`... e mais ${laborProcesses.length - 6} processo(s) trabalhista(s).`);
        }
    }

    // Professional context â€” ALWAYS shown
    parts.push('');
    parts.push('CONTEXTO PROFISSIONAL:');
    const profHistory = caseData.bigdatacorpProfessionHistory;
    const employer = caseData.bigdatacorpEmployer;
    const employerCnpj = caseData.bigdatacorpEmployerCnpj;
    const sector = caseData.bigdatacorpSector;
    const isEmployed = caseData.bigdatacorpIsEmployed;

    if (employer || (profHistory && profHistory.length > 0)) {
        const prof = profHistory?.[0];
        const empName = employer || prof?.companyName || 'nÃ£o informado';
        const cnpj = employerCnpj || prof?.companyCnpj || null;
        const rawSector = sector || prof?.sector || null;
        // Clean sector: "PRIVATE - 6204000 - CONSULTORIA EM TI" â†’ "Consultoria em Tecnologia da InformaÃ§Ã£o (Privado)"
        let sectorLabel = null;
        if (rawSector) {
            const sectorParts = rawSector.split(' - ');
            const sectorType = /private/i.test(sectorParts[0] || '') ? 'Privado' : /public/i.test(sectorParts[0] || '') ? 'PÃºblico' : null;
            const sectorDesc = sectorParts.length >= 3 ? sectorParts.slice(2).join(' - ') : sectorParts[sectorParts.length - 1];
            sectorLabel = sectorDesc ? `${sectorDesc.charAt(0).toUpperCase()}${sectorDesc.slice(1).toLowerCase()}` : null;
            if (sectorType && sectorLabel) sectorLabel += ` (${sectorType})`;
        }

        parts.push(`   Ãšltimo empregador registrado: ${empName}`);
        if (cnpj) {
            const fmtCnpj = cnpj.length === 14 ? `${cnpj.slice(0,2)}.${cnpj.slice(2,5)}.${cnpj.slice(5,8)}/${cnpj.slice(8,12)}-${cnpj.slice(12,14)}` : cnpj;
            parts.push(`   CNPJ: ${fmtCnpj}`);
        }
        if (sectorLabel) parts.push(`   Setor: ${sectorLabel}`);
        // Employment status and start date
        const startDate = prof?.startDate;
        if (isEmployed || /active/i.test(prof?.status || '')) {
              parts.push(`   VÃ­nculo: Registrado${startDate ? ` desde ${formatDateBR(startDate)}` : ''} (Ãºltima atualizaÃ§Ã£o na base)`);
        } else if (startDate) {
            const endDate = prof?.endDate && !prof.endDate.startsWith('9999') ? formatDateBR(prof.endDate) : null;
            parts.push(`   VÃ­nculo: Encerrado${endDate ? ` em ${endDate}` : ''}`);
        }
        // Salary range
        const incomeRange = prof?.incomeRange;
        const income = prof?.income;
        if (incomeRange && income) {
            parts.push(`   Faixa salarial: R$ ${income.toLocaleString('pt-BR')} (${incomeRange})`);
        } else if (incomeRange) {
            parts.push(`   Faixa salarial: ${incomeRange}`);
        } else if (income) {
            parts.push(`   Faixa salarial: R$ ${income.toLocaleString('pt-BR')}`);
        }
        // Public servant check
        const isPublic = /public/i.test(rawSector || '') || /servidor|concurs/i.test(prof?.level || '');
        parts.push(`   Servidor pÃºblico: ${isPublic ? 'Sim' : 'NÃ£o'}`);
    } else {
        parts.push('   Dados profissionais nÃ£o disponÃ­veis nas bases consultadas.');
    }

    return parts.join('\n');
}

function buildDetWarrantNotes(caseData) {
    const parts = [];
    const wf = caseData.warrantFlag || 'NEGATIVE';
    const juditWarrants = caseData.juditWarrants || [];
    const bdcWarrants = caseData.bigdatacorpActiveWarrants || [];

    // Deduplicate warrants by normalized process number
    const seen = new Set();
    const unified = [];
    for (const w of juditWarrants) {
        const nk = normCnj(w.code);
        if (nk) seen.add(nk);
        unified.push({ ...w, processNumber: w.code, _source: 'judit' });
    }
    for (const w of bdcWarrants) {
        const nk = normCnj(w.processNumber);
        if (nk && seen.has(nk)) {
            // Merge BDC data into existing Judit entry
            const existing = unified.find((u) => normCnj(u.processNumber) === nk);
            if (existing) {
                if (!existing.imprisonmentKind && w.imprisonmentKind) existing.imprisonmentKind = w.imprisonmentKind;
                if (!existing.magistrate && w.magistrate) existing.magistrate = w.magistrate;
                if (!existing.penaltyTime && w.penaltyTime) existing.penaltyTime = w.penaltyTime;
                if (!existing.expirationDate && w.expirationDate) existing.expirationDate = w.expirationDate;
                if (!existing.agency && w.agency) existing.agency = w.agency;
                if (!existing.county && w.county) existing.county = w.county;
                if (!existing.decision && w.decision) existing.decision = w.decision;
                if (!existing.judgementSummary && w.decision) existing.judgementSummary = w.decision;
            }
            continue;
        }
        if (nk) seen.add(nk);
        unified.push({ ...w, _source: 'bdc' });
    }

    // Header context (no redundant status â€” badge already in report)
    if (wf === 'POSITIVE' && unified.length > 0) {
        // No header â€” go straight to warrant listing
    } else if (wf === 'POSITIVE' && unified.length === 0) {
        parts.push('Mandado de prisÃ£o registrado â€” dados detalhados indisponÃ­veis nas fontes. Verificar diretamente.');
    } else if (wf === 'INCONCLUSIVE') {
        parts.push('Resultado inconclusivo na consulta de mandados de prisÃ£o.');
    } else if (wf === 'NOT_FOUND') {
        parts.push('Candidato nÃ£o localizado nas bases de mandados consultadas.');
    } else {
        parts.push('Nenhum mandado de prisÃ£o identificado nas bases consultadas.');
        return parts.join('\n');
    }

    // Warrant listing
    if (unified.length > 0) {
        const label = unified.length === 1 ? 'MANDADO IDENTIFICADO:' : `MANDADOS IDENTIFICADOS (${unified.length}):`;
        parts.push('');
        parts.push(label);
        for (const w of unified) {
            const wType = classifyWarrantType(w);
            const indent = '   ';
            parts.push('');
            parts.push(`${indent}Processo: ${formatCnj(w.processNumber || w.code)}`);
            parts.push(`${indent}Tipo: ${wType.label}`);
            parts.push(`${indent}Status: ${w.status || 'nÃ£o informado'}`);
            const vara = w.agency || w.court || null;
            if (vara) parts.push(`${indent}Vara: ${vara}`);
            const comarca = w.county || null;
            if (comarca) parts.push(`${indent}Comarca: ${comarca}`);
            const issueDate = w.issueDate || null;
            const expDate = w.expirationDate || null;
            if (issueDate || expDate) {
                let dateStr = issueDate ? `Emitido: ${formatDateBR(issueDate)}` : '';
                if (expDate) dateStr += `${dateStr ? ' | ' : ''}VÃ¡lido atÃ©: ${formatDateBR(expDate)}`;
                parts.push(`${indent}${dateStr}`);
            }
            if (w.penaltyTime) {
                const cleanPenalty = w.penaltyTime.replace(/\s*\(.*/, '').trim();
                const suffix = /contados/i.test(w.penaltyTime) ? ' contados da data da prisÃ£o' : '';
                parts.push(`${indent}Pena: atÃ© ${cleanPenalty}${/dias/i.test(cleanPenalty) ? '' : ' dias'}${suffix}`);
            }
            if (w.magistrate) parts.push(`${indent}Magistrado: ${w.magistrate}`);

            // Check for linked civil process
            if (wType.type === 'CIVIL') {
                const linked = findLinkedCivilProcess(caseData, w);
                if (linked) {
                    w._linkedProcess = linked;
                }
            }
        }
    }

    // Context section
    const context = [];
    for (const w of unified) {
        const wType = classifyWarrantType(w);
        if (wType.type === 'CIVIL') {
            context.push(`Trata-se de prisÃ£o CIVIL por inadimplÃªncia alimentar â€” nÃ£o Ã© mandado de natureza criminal`);
            if (w._linkedProcess) {
                context.push(`Processo cÃ­vel de alimentos vinculado: ${w._linkedProcess.cnj} (${w._linkedProcess.assunto}, status: ${w._linkedProcess.status})`);
            }
        }
    }
    // Multiple warrants on same process (renewal detection)
    if (bdcWarrants.length > 1) {
        const processNums = bdcWarrants.map((w) => normCnj(w.processNumber)).filter(Boolean);
        const uniqueProcesses = [...new Set(processNums)];
        if (uniqueProcesses.length < bdcWarrants.length) {
            const magistrates = [...new Set(bdcWarrants.map((w) => w.magistrate).filter(Boolean))];
            if (magistrates.length > 1) {
                context.push(`Detectadas ${bdcWarrants.length} decisÃµes distintas â€” provÃ¡vel renovaÃ§Ã£o do mandado`);
            }
        }
    }

    if (context.length > 0) {
        parts.push('');
        parts.push('CONTEXTO:');
        for (const c of context) {
            parts.push(`â€¢ ${c}`);
        }
    }

    return parts.join('\n');
}

function buildDetKeyFindings(caseData) {
    const findings = [];
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const juditActiveWarrants = Number(caseData.juditActiveWarrantCount) || 0;
    const bdcWarrants = caseData.bigdatacorpActiveWarrants || [];

    // Priority 1: Criminal conviction with sentence details
    for (const p of criminalProcesses.filter((pr) => pr.matchType === 'CPF confirmado')) {
        const sentence = extractSentenceDetails(p.allDecisions);
        if (sentence.isConviction) {
            let txt = `CondenaÃ§Ã£o criminal definitiva`;
            if (p.assunto) txt += ` por ${p.assunto.toLowerCase()}`;
            if (sentence.penalty) txt += `, pena: ${sentence.penalty.charAt(0) + sentence.penalty.slice(1).toLowerCase()}`;
            findings.push(txt);
            break; // One conviction finding is enough
        }
    }

    // Priority 2: Carta de guia
    for (const p of criminalProcesses) {
        const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
        if (cg.found) {
            const cgLabel = cg.tipo ? `Carta de Guia ${cg.tipo}` : 'Carta de Guia';
            findings.push(`${cgLabel} expedida â€” condenaÃ§Ã£o transitada em julgado`);
            break;
        }
    }

    // Priority 3: Active warrants (deduplicated)
    const juditProcessNums = new Set((caseData.juditWarrants || []).map((w) => normCnj(w.code)).filter(Boolean));
    const uniqueBdcWarrants = bdcWarrants.filter((w) => !juditProcessNums.has(normCnj(w.processNumber)));
    const totalWarrants = juditActiveWarrants + uniqueBdcWarrants.filter((w) => /pendente/i.test(w.status || '')).length;
    if (totalWarrants > 0) {
        // Classify warrant type
        const allWarrants = [...(caseData.juditWarrants || []), ...bdcWarrants];
        const wType = allWarrants.length > 0 ? classifyWarrantType(allWarrants[0]) : null;
        let wTxt = `Mandado de prisÃ£o${wType?.type === 'CIVIL' ? ' civil' : ''} pendente de cumprimento`;
        if (wType?.type === 'CIVIL') wTxt += ', decorrente de inadimplÃªncia de obrigaÃ§Ã£o alimentar';
        findings.push(wTxt);
    }

    // Priority 4: Criminal processes count
    const cpfConfirmed = criminalProcesses.filter((p) => p.matchType === 'CPF confirmado');
    if (cpfConfirmed.length > 0 && findings.length < 5) {
        const comarcas = [...new Set(cpfConfirmed.map((p) => p.comarca).filter(Boolean))];
        let txt = `${cpfConfirmed.length} processo(s) criminal(is) com CPF confirmado`;
        if (comarcas.length === 1) txt += ` (${comarcas[0]})`;
        findings.push(txt);
    }

    // Priority 5: Active alimony/civil process
    const civilActive = topProcessos.filter((p) => !p.isCriminal && !p.isTrabalhista && p.isActive && /aliment/i.test(p.assunto || ''));
    if (civilActive.length > 0) {
        findings.push('Processo cÃ­vel de alimentos ativo â€” candidato figura como executado');
    }

    // Priority 6: PEP
    if (caseData.pepFlag === 'POSITIVE') {
        findings.push(`Pessoa politicamente exposta (PEP) detectada`);
    }

    // Priority 7: Sanctions
    if (caseData.sanctionFlag === 'POSITIVE') {
        findings.push(`SanÃ§Ã£o ativa detectada`);
    }

    // Priority 8: Consolidated negatives
    const negatives = [];
    const laborProcesses = topProcessos.filter((p) => p.isTrabalhista);
    if (laborProcesses.length === 0 && caseData.laborFlag !== 'POSITIVE') negatives.push('trabalhista');
    if (caseData.sanctionFlag !== 'POSITIVE' && caseData.sanctionFlag !== 'HISTORICAL') negatives.push('sanÃ§Ãµes');
    if (caseData.pepFlag !== 'POSITIVE') negatives.push('PEP');
    if (negatives.length >= 2) {
        findings.push(`Nenhum apontamento ${negatives.join(', ')} identificado`);
    }

    return [...new Set(findings)].slice(0, 7);
}

function buildDetExecutiveSummary(caseData) {
    const parts = [];
    const name = caseData.candidateName || 'Candidato';
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const juditRoleSummary = caseData.juditRoleSummary || [];

    // Paragraph 1: Bio data
    const bioItems = [name];
    if (caseData.bigdatacorpAge) bioItems.push(`${caseData.bigdatacorpAge} anos`);
    if (caseData.bigdatacorpGender) bioItems.push(`sexo ${caseData.bigdatacorpGender === 'M' ? 'masculino' : 'feminino'}`);
    const cpf = caseData.cpf || '';
    if (cpf) {
        const cpfDigits = cpf.replace(/\D/g, '');
        const masked = cpfDigits.replace(/(\d{3})\d{3}\d{3}(\d{2})/, '$1.***.***-$2');
        const cpfStatus = caseData.bigdatacorpCpfStatus || caseData.enrichmentIdentity?.cpfStatus;
        bioItems.push(`CPF ${masked}${cpfStatus ? ` (status: ${cpfStatus})` : ''}`);
    }
    let bioLine = bioItems.join(', ') + '.';
    if (caseData.bigdatacorpMotherName) {
        bioLine += ` FiliaÃ§Ã£o materna: ${caseData.bigdatacorpMotherName}.`;
    }
    parts.push(bioLine);

    // Paragraph 2: Professional context
    const employer = caseData.bigdatacorpEmployer;
    const profHistory = caseData.bigdatacorpProfessionHistory;
    if (employer || (profHistory && profHistory.length > 0)) {
        const prof = profHistory?.[0];
        const empName = employer || prof?.companyName || 'nÃ£o informado';
        const rawSector = caseData.bigdatacorpSector || prof?.sector || '';
        const sectorParts = rawSector.split(' - ');
        const sectorDesc = sectorParts.length >= 3 ? sectorParts.slice(2).join(' - ').toLowerCase() : '';
        const incomeRange = prof?.incomeRange;
        const isEmployed = caseData.bigdatacorpIsEmployed || /active/i.test(prof?.status || '');
        const startDate = prof?.startDate;
        let profLine = `Contexto profissional: Ãºltimo empregador registrado â€” ${empName}`;
        if (sectorDesc) profLine += `, setor de ${sectorDesc}`;
        if (incomeRange) profLine += `, faixa salarial ${incomeRange}`;
            if (isEmployed && startDate) profLine += `, registrado desde ${formatDateBR(startDate)}`;
        profLine += '.';
        parts.push('');
        parts.push(profLine);
    }

    // Paragraph 3: Findings summary
    const findingsSentences = [];
    const cf = caseData.criminalFlag;
    if (cf === 'POSITIVE') {
        // Look for conviction
        let convictionText = 'processo(s) criminal(is) identificado(s)';
        for (const p of criminalProcesses.filter((pr) => pr.matchType === 'CPF confirmado')) {
            const sentence = extractSentenceDetails(p.allDecisions);
            if (sentence.isConviction) {
                convictionText = `condenaÃ§Ã£o criminal definitiva`;
                if (p.assunto) convictionText += ` por ${p.assunto.toLowerCase()}`;
                if (sentence.penalty) convictionText += `, com pena de ${sentence.penalty.charAt(0) + sentence.penalty.slice(1).toLowerCase()}`;
                if (sentence.regime) convictionText += ` em regime ${sentence.regime.toLowerCase()}`;
                // Check carta de guia
                const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
                if (cg.found) {
                    convictionText += '. A carta de guia definitiva jÃ¡ foi expedida, confirmando trÃ¢nsito em julgado';
                }
                break;
            }
        }
        findingsSentences.push(convictionText);
    } else if (cf === 'INCONCLUSIVE_HOMONYM' || cf === 'INCONCLUSIVE_LOW_COVERAGE') {
        findingsSentences.push('apontamento criminal inconclusivo pendente de confirmaÃ§Ã£o');
    }

    const wf = caseData.warrantFlag;
    if (wf === 'POSITIVE') {
        const allWarrants = [...(caseData.juditWarrants || []), ...(caseData.bigdatacorpActiveWarrants || [])];
        const wType = allWarrants.length > 0 ? classifyWarrantType(allWarrants[0]) : null;
        let wText = 'mandado de prisÃ£o pendente de cumprimento';
        if (wType?.type === 'CIVIL') wText = 'mandado de prisÃ£o civil pendente de cumprimento, vinculado a inadimplÃªncia de obrigaÃ§Ã£o alimentar';
        findingsSentences.push(wText);
    }

    // Consolidated negatives
    const negatives = [];
    if (caseData.laborFlag !== 'POSITIVE') negatives.push('trabalhista');
    if (caseData.pepFlag !== 'POSITIVE') negatives.push('exposiÃ§Ã£o polÃ­tica (PEP)');
    if (caseData.sanctionFlag !== 'POSITIVE' && caseData.sanctionFlag !== 'HISTORICAL') negatives.push('sanÃ§Ã£o internacional');
    if (negatives.length > 0) {
        findingsSentences.push(`nenhum apontamento ${negatives.join(', ')} identificado`);
    }

    // PEP / Sanctions if positive
    if (caseData.pepFlag === 'POSITIVE') findingsSentences.push('pessoa politicamente exposta (PEP) detectada');
    if (caseData.sanctionFlag === 'POSITIVE') findingsSentences.push('sanÃ§Ã£o ativa detectada');

    if (findingsSentences.length > 0) {
        parts.push('');
        parts.push(`A anÃ¡lise identificou ${findingsSentences.join('. HÃ¡ ')}.`);
    }

    // Paragraph 4: Risk level
    const riskScores = { POSITIVE: 90, INCONCLUSIVE: 50, INCONCLUSIVE_HOMONYM: 50, INCONCLUSIVE_LOW_COVERAGE: 40, NEGATIVE_PARTIAL: 40, NOT_FOUND: 0, NEGATIVE: 0 };
    const pepRisk = caseData.pepFlag === 'POSITIVE' ? 60 : 0;
    const sanctionRisk = caseData.sanctionFlag === 'POSITIVE' ? 95 : caseData.sanctionFlag === 'HISTORICAL' ? 40 : 0;
    const maxRisk = Math.max(
        riskScores[caseData.criminalFlag] || 0,
        riskScores[caseData.laborFlag] || 0,
        riskScores[caseData.warrantFlag] || 0,
        pepRisk,
        sanctionRisk,
    );
    const _riskLabel = maxRisk >= 70 ? 'ALTO' : maxRisk >= 40 ? 'MÃ‰DIO' : 'BAIXO';
    // Risk level omitted from text â€” already shown as badge in report Risk Box

    return parts.join('\n');
}

function buildDetFinalJustification(caseData) {
    const parts = [];
    const name = caseData.candidateName || 'Candidato';
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const namesakeCount = caseData.bigdatacorpNamesakeCount;

    // Determine verdict â€” always derive from current flags (never use stale finalVerdict)
    let derivedVerdict;
    {
        const cf = caseData.criminalFlag;
        const wf = caseData.warrantFlag;
        const lf = caseData.laborFlag;
        const sanctioned = caseData.sanctionFlag === 'POSITIVE';
        if (cf === 'POSITIVE' || wf === 'POSITIVE' || sanctioned) {
            derivedVerdict = 'NOT_RECOMMENDED';
        } else if (lf === 'POSITIVE' || caseData.pepFlag === 'POSITIVE' || ['INCONCLUSIVE_HOMONYM', 'INCONCLUSIVE_LOW_COVERAGE', 'NEGATIVE_PARTIAL', 'NOT_FOUND'].includes(cf) || wf === 'INCONCLUSIVE') {
            derivedVerdict = 'ATTENTION';
        } else {
            derivedVerdict = 'FIT';
        }
    }

    // Verdict omitted from text â€” already shown as badge in report Risk Box

    // Paragraph 1: Criminal analysis
    const cf = caseData.criminalFlag;
    if (cf === 'POSITIVE') {
        const cpfConfirmed = criminalProcesses.filter((p) => p.matchType === 'CPF confirmado');
        let crimParagraph = '';
        // Look for conviction with details
        for (const p of cpfConfirmed) {
            const sentence = extractSentenceDetails(p.allDecisions);
            if (sentence.isConviction) {
                crimParagraph = `O candidato possui condenaÃ§Ã£o criminal definitiva`;
                if (p.assunto) crimParagraph += ` por ${p.assunto.toLowerCase()}`;
                if (sentence.articles.length > 0) crimParagraph += ` (${sentence.articles.join(', ')})`;
                if (sentence.penalty) crimParagraph += `, com pena de ${sentence.penalty.charAt(0) + sentence.penalty.slice(1).toLowerCase()}`;
                if (sentence.regime) crimParagraph += ` em regime ${sentence.regime.toLowerCase()}`;
                if (sentence.situation) crimParagraph += `, ${sentence.situation.toLowerCase()}`;
                // Carta de guia
                const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
                if (cg.found) {
                    crimParagraph += `. A condenaÃ§Ã£o transitou em julgado, conforme atesta a expediÃ§Ã£o da carta de guia ${cg.tipo ? cg.tipo.toLowerCase() : ''}`;
                }
                crimParagraph += '.';
                break;
            }
        }
        if (!crimParagraph) {
            if (criminalProcesses.length > 0) {
                const cpfCount = criminalProcesses.filter((p) => p.matchType === 'CPF confirmado').length;
                const nameOnlyCount = criminalProcesses.length - cpfCount;
                if (cpfCount > 0 && nameOnlyCount === 0) {
                    crimParagraph = `${cpfCount} processo(s) criminal(is) com CPF confirmado, sem condenaÃ§Ã£o definitiva identificada atÃ© o momento.`;
                } else if (cpfCount > 0) {
                    crimParagraph = `${cpfCount} processo(s) criminal(is) com CPF confirmado e ${nameOnlyCount} adicional(is) sem confirmaÃ§Ã£o documental. Recomenda-se validaÃ§Ã£o complementar.`;
                } else {
                    crimParagraph = `${criminalProcesses.length} processo(s) criminal(is) identificado(s) â€” sem confirmaÃ§Ã£o documental de CPF. Recomenda-se validaÃ§Ã£o complementar.`;
                }
            } else {
                crimParagraph = 'Indicadores criminais positivos nas fontes consultadas, porÃ©m sem processos detalhados disponÃ­veis.';
            }
        }
        parts.push('');
        parts.push(crimParagraph);
    } else if (cf === 'INCONCLUSIVE_HOMONYM' || cf === 'INCONCLUSIVE_LOW_COVERAGE') {
        parts.push('');
        parts.push('Foram identificados apontamentos criminais, porÃ©m sem confirmaÃ§Ã£o inequÃ­voca de identidade. Recomenda-se anÃ¡lise complementar.');
    }

    // Paragraph 2: Warrant context
    const wf = caseData.warrantFlag;
    if (wf === 'POSITIVE') {
        const allWarrants = [...(caseData.juditWarrants || []), ...(caseData.bigdatacorpActiveWarrants || [])];
        if (allWarrants.length > 0) {
            const w = allWarrants[0];
            const wType = classifyWarrantType(w);
            let wParagraph = 'Adicionalmente, hÃ¡ mandado de prisÃ£o';
            if (wType.type === 'CIVIL') {
                wParagraph += ' civil pendente de cumprimento por inadimplÃªncia de obrigaÃ§Ã£o alimentar';
            } else {
                wParagraph += ' pendente de cumprimento';
            }
            const processNum = w.processNumber || w.code;
            if (processNum) wParagraph += ` (processo ${formatCnj(processNum)})`;
            if (w.penaltyTime) {
                const days = w.penaltyTime.match(/\d+/)?.[0];
                if (days) wParagraph += `, com prazo de atÃ© ${days} dias`;
            }
            wParagraph += '.';
            // Linked civil process
            const linked = findLinkedCivilProcess(caseData, w);
            if (linked) {
                wParagraph += ` O candidato tambÃ©m Ã© parte em processo cÃ­vel ativo de ${linked.assunto.toLowerCase()} na mesma vara (${linked.cnj}).`;
            }
            parts.push('');
            parts.push(wParagraph);
        }
    }

    // Paragraph 3: Secondary findings (labor, PEP, sanctions)
    const secondaries = [];
    if (caseData.laborFlag !== 'POSITIVE') {
        secondaries.push('apontamentos trabalhistas');
    }
    if (caseData.sanctionFlag !== 'POSITIVE' && caseData.sanctionFlag !== 'HISTORICAL') {
        secondaries.push('sanÃ§Ãµes internacionais');
    }
    if (caseData.pepFlag !== 'POSITIVE') {
        secondaries.push('exposiÃ§Ã£o polÃ­tica');
    }
    if (secondaries.length > 0) {
        parts.push('');
        let secondaryLine = `NÃ£o foram identificados ${secondaries.join(', ')}.`;
        if (caseData.laborFlag === 'POSITIVE') secondaryLine += ' HÃ¡ processos trabalhistas registrados.';
        parts.push(secondaryLine);
    }
    if (caseData.pepFlag === 'POSITIVE') {
        parts.push(`${name} foi identificado como pessoa politicamente exposta.`);
    }
    if (caseData.sanctionFlag === 'POSITIVE') {
        parts.push('HÃ¡ sanÃ§Ã£o ativa detectada nas bases consultadas.');
    }

    // Paragraph 4: Conclusion
    parts.push('');
    if (derivedVerdict === 'NOT_RECOMMENDED') {
        parts.push('O conjunto de evidÃªncias configura risco elevado para continuidade do processo.');
    } else if (derivedVerdict === 'ATTENTION') {
        parts.push('Os apontamentos identificados exigem validaÃ§Ã£o manual antes de qualquer decisÃ£o final.');
    } else {
        parts.push('NÃ£o foram identificados impeditivos materiais, observados os limites das fontes consultadas.');
    }

    // Caveat: segredo de justiÃ§a + namesakeCount
    const secretProcesses = topProcessos.filter((p) => /segredo|sigilo|oculta/i.test(p.status || '') || /segredo|sigilo/i.test(p.assunto || ''));
    const nameOnlyProcesses = criminalProcesses.filter((p) => p.matchType !== 'CPF confirmado');
    if (secretProcesses.length > 0 || nameOnlyProcesses.length > 0 || namesakeCount != null) {
        const caveats = [];
        if (secretProcesses.length > 0) {
            const cnjs = secretProcesses.slice(0, 2).map((p) => formatCnj(p.cnj));
            caveats.push(`${secretProcesses.length} processo(s) sob segredo de justiÃ§a (${cnjs.join(', ')}) â€” sem confirmaÃ§Ã£o documental de CPF`);
        }
        if (namesakeCount != null) {
            if (namesakeCount <= 1) {
                caveats.push(`nome com ocorrÃªncia Ãºnica no Brasil, o que reduz significativamente a possibilidade de homonÃ­mia`);
            } else if (namesakeCount <= 5) {
                caveats.push(`${namesakeCount} pessoas no Brasil com esse nome â€” probabilidade moderada de homonÃ­mia`);
            } else {
                caveats.push(`${namesakeCount} pessoas no Brasil com esse nome â€” probabilidade relevante de homonÃ­mia`);
            }
        }
        if (caveats.length > 0) {
            parts.push('');
            parts.push(`Ressalva: ${caveats.join('. ')}.`);
        }
    }

    return parts.join('\n');
}

function buildDeterministicPrefill(caseData) {
    const complexity = evaluateComplexityTriggers(caseData);
    return {
        executiveSummary: buildDetExecutiveSummary(caseData),
        criminalNotes: buildDetCriminalNotes(caseData),
        laborNotes: buildDetLaborNotes(caseData),
        warrantNotes: buildDetWarrantNotes(caseData),
        keyFindings: buildDetKeyFindings(caseData),
        finalJustification: buildDetFinalJustification(caseData),
        metadata: {
            source: 'deterministic',
            version: 'v5-deterministic-prefill',
            generatedAt: new Date().toISOString(),
            triggersActive: complexity.triggersActive,
            isComplex: complexity.isComplex,
        },
    };
}

/* =========================================================
   END DETERMINISTIC PREFILL
   ========================================================= */

function buildKeyFindings(caseData, formPayload) {
    const findings = [];
    // P05: Include factual AI evidence always; only skip interpretive suggestions when IGNORED
    const aiEvidencias = (caseData.aiStructured?.evidencias || []).slice(0, 5);
    findings.push(...aiEvidencias.filter((e) => typeof e === 'string'));
    if ((caseData.juditActiveWarrantCount || 0) > 0)
        findings.push(`${caseData.juditActiveWarrantCount} mandado(s) de prisÃ£o pendente(s) de cumprimento.`);
    const criminalFlag = formPayload?.criminalFlag || caseData.criminalFlag;
    if (criminalFlag === 'POSITIVE' && (caseData.juditCriminalCount || 0) > 0)
        findings.push(`${caseData.juditCriminalCount} processo(s) criminal(is) confirmado(s).`);
    return [...new Set(findings)].slice(0, 7);
}

function buildExecutiveSummary(caseData) {
    // AUD-006: Do not use AI summary if aiDecision was IGNORED
    if (caseData.aiDecision === 'IGNORED') return null;
    return caseData.aiStructured?.resumo || null;
}

function buildExpandedKeyFindings(caseData, formPayload) {
    const findings = buildKeyFindings(caseData, formPayload);

    if (caseData.coverageLevel === 'LOW_COVERAGE') {
        findings.push('Parte da leitura depende de validacao manual por cobertura reduzida das fontes consultadas.');
    }
    if (caseData.providerDivergence === 'HIGH') {
        findings.push('Ha divergencia material entre as fontes consultadas e o caso exige leitura cautelosa.');
    }
    if ((caseData.juditHomonymCount || 0) > 0 || caseData.aiHomonymRecommendedAction === 'MANUAL_REVIEW') {
        findings.push('Existe indicacao de possivel homonimia em ao menos um apontamento e a vinculacao exige revisao manual.');
    }
    if ((caseData.escavadorCriminalCount || 0) > (caseData.juditCriminalCount || 0) && (formPayload?.criminalFlag || caseData.criminalFlag) === 'POSITIVE') {
        findings.push(`${caseData.escavadorCriminalCount} registro(s) criminal(is) identificado(s) em bases complementares.`);
    }

    return [...new Set(findings)].slice(0, 7);
}

function buildExecutiveSummaryFallback(caseData) {
    const aiSummary = buildExecutiveSummary(caseData);
    if (aiSummary) return aiSummary;

    const parts = [];
    const verdict = caseData.finalVerdict;
    if (verdict === 'NOT_RECOMMENDED') {
        parts.push('Analise concluida com indicacao de nao recomendacao diante dos apontamentos materiais identificados.');
    } else if (verdict === 'ATTENTION') {
        parts.push('Analise concluida com pontos de atencao que exigem validacoes complementares antes de qualquer decisao final.');
    } else if (verdict === 'FIT') {
        parts.push('Analise concluida sem impeditivos materiais para continuidade do fluxo interno, observados os limites das fontes consultadas.');
    }

    if ((caseData.juditActiveWarrantCount || 0) > 0 || caseData.warrantFlag === 'POSITIVE') {
        parts.push(`Foi identificado pelo menos ${caseData.juditActiveWarrantCount || 1} mandado relevante em bases judiciais.`);
    }
    if ((caseData.juditCriminalCount || 0) > 0 || caseData.criminalFlag === 'POSITIVE') {
        const processCount = caseData.juditCriminalCount || caseData.escavadorCriminalCount || 1;
        parts.push(`As consultas judiciais retornaram ${processCount} apontamento(s) criminal(is) ou penal(is) relevante(s).`);
    }
    if (caseData.laborFlag === 'POSITIVE') {
        parts.push('Tambem houve retorno positivo para processos trabalhistas relevantes.');
    }
    if (caseData.coverageLevel === 'LOW_COVERAGE') {
        parts.push('A cobertura das fontes foi parcial e parte da leitura ainda depende de verificacao manual.');
    }
    if (caseData.providerDivergence === 'HIGH') {
        parts.push('As fontes consultadas apresentaram divergencia relevante de escopo ou quantidade.');
    }

    return parts.join(' ') || null;
}

function buildSourceSummary(caseData) {
    const sources = [];
    const pushUnique = (value) => {
        const clean = sanitizeStructuredText(value, 120);
        if (clean && !sources.includes(clean)) sources.push(clean);
    };

    Object.entries(caseData.enrichmentSources || {}).forEach(([phase, sourceData]) => {
        if (sourceData?.source) pushUnique(`${phase}: ${sourceData.source}`);
    });

    const appendSourceBucket = (bucket) => {
        if (!bucket) return;
        if (typeof bucket === 'string') {
            pushUnique(bucket);
            return;
        }
        if (Array.isArray(bucket)) {
            bucket.forEach((item) => pushUnique(item));
            return;
        }
        if (typeof bucket === 'object') {
            Object.values(bucket).forEach((item) => pushUnique(String(item || '')));
        }
    };

    appendSourceBucket(caseData.juditSources);
    appendSourceBucket(caseData.escavadorSources);

    return sources.length > 0 ? sources.join(' | ') : 'Fontes automatizadas e revisao analitica.';
}

function buildStatusSummary(caseData) {
    if (caseData.status === 'CORRECTION_NEEDED') {
        return 'Analise pausada aguardando correcao de dados pelo cliente.';
    }
    if (caseData.status !== 'DONE') {
        return 'Analise em andamento com validacao automatica e revisao operacional.';
    }

    if (caseData.finalVerdict === 'NOT_RECOMMENDED') {
        return 'Analise concluida com indicacao de nao recomendacao diante dos apontamentos materiais identificados.';
    }
    if (caseData.finalVerdict === 'ATTENTION') {
        return 'Analise concluida com pontos de atencao que exigem validacoes complementares ou aprovacao condicionada.';
    }
    if (caseData.finalVerdict === 'FIT') {
        return 'Analise concluida sem impeditivos materiais para continuidade do fluxo interno.';
    }
    return 'Analise concluida e pronta para consulta e compartilhamento.';
}

function buildNextSteps(caseData) {
    if (Array.isArray(caseData.nextSteps) && caseData.nextSteps.length > 0) {
        return sanitizeStructuredList(caseData.nextSteps, 6, 220);
    }

    if (caseData.status === 'CORRECTION_NEEDED') {
        return [
            'Corrigir os dados sinalizados pela operacao antes de retomar a analise.',
            'Reenviar o caso para nova validacao assim que as informacoes forem atualizadas.',
        ];
    }

    if (caseData.finalVerdict === 'NOT_RECOMMENDED') {
        return [
            'Submeter o caso a alcada responsavel antes de qualquer continuidade.',
            'Registrar formalmente os apontamentos materiais no fluxo interno de risco.',
        ];
    }
    if (caseData.finalVerdict === 'ATTENTION') {
        return [
            'Prosseguir apenas com validacoes complementares aderentes aos apontamentos do relatorio.',
            'Registrar as condicoes de aprovacao e os pontos de monitoramento no processo interno.',
        ];
    }
    if (caseData.finalVerdict === 'FIT') {
        return [
            'Prosseguir com a proxima etapa do fluxo interno.',
            'Arquivar o relatorio no dossie do candidato para consulta controlada.',
        ];
    }
    return [];
}

function buildReportSlug(caseId, caseData) {
    const nameSlug = normalizeTenantSlug(caseData.candidateName || caseData.candidatePosition || caseId || 'caso');
    const suffix = String(caseId || 'caso').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(-8);
    return [nameSlug || 'caso', suffix].filter(Boolean).join('-').slice(0, 80);
}

function buildTimelineEvents(caseData, options = {}) {
    const existing = Array.isArray(caseData.timelineEvents)
        ? caseData.timelineEvents
            .filter(Boolean)
            .map((event) => stripUndefined({
                type: event.type || null,
                status: event.status || null,
                title: event.title || event.type || 'Evento',
                description: event.description || null,
                at: event.at || null,
            }))
        : [];

    const ensured = [...existing];
    const existingTypes = new Set(existing.map((event) => event.type).filter(Boolean));
    const pushIfMissing = (event) => {
        if (!event || !event.type || existingTypes.has(event.type)) return;
        ensured.push(event);
        existingTypes.add(event.type);
    };

    const concludedAt = options.concludedAtOverride || caseData.concludedAt || caseData.updatedAt || null;

    pushIfMissing(caseData.createdAt && {
        type: 'created',
        status: 'done',
        title: 'Solicitacao enviada',
        description: 'Caso criado para triagem e validacao operacional.',
        at: caseData.createdAt,
    });
    pushIfMissing(caseData.analysisStartedAt && {
        type: 'analysis_started',
        status: 'done',
        title: 'Processamento iniciado',
        description: 'Pipeline automatizado executado com coleta de evidencias e validacao inicial.',
        at: caseData.analysisStartedAt,
    });
    pushIfMissing(caseData.correctedAt && {
        type: 'corrected',
        status: 'done',
        title: 'Caso corrigido e reenviado',
        description: 'Dados atualizados pelo cliente para continuidade da analise.',
        at: caseData.correctedAt,
    });
    pushIfMissing(concludedAt && {
        type: 'concluded',
        status: 'done',
        title: 'Analise concluida',
        description: buildStatusSummary({ ...caseData, status: 'DONE' }),
        at: concludedAt,
    });

    return ensured
        .filter((event) => event.at)
        .sort((left, right) => {
            const leftTime = asDate(left.at)?.getTime() || 0;
            const rightTime = asDate(right.at)?.getTime() || 0;
            return leftTime - rightTime;
        });
}

function calculateTurnaroundHours(caseData, concludedAtOverride = null) {
    const createdAt = asDate(caseData.createdAt);
    const concludedAt = asDate(concludedAtOverride) || asDate(caseData.concludedAt) || asDate(caseData.updatedAt);
    if (!createdAt || !concludedAt) return null;
    const diffHours = (concludedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    if (!Number.isFinite(diffHours) || diffHours < 0) return null;
    return Number(diffHours.toFixed(2));
}

function buildSanitizedPublicResultSnapshot(caseId, caseData, payload = {}, options = {}) {
    const merged = { ...(caseData || {}), ...(payload || {}) };
    const snapshot = {};
    const concludedAtFallback = options.concludedAtOverride || merged.concludedAt || merged.updatedAt || null;

    if (!Array.isArray(merged.processHighlights) || merged.processHighlights.length === 0) {
        merged.processHighlights = buildProcessHighlights(merged);
    }
    if (!Array.isArray(merged.warrantFindings) || merged.warrantFindings.length === 0) {
        merged.warrantFindings = buildWarrantFindings(merged);
    }

    merged.executiveSummary = resolveNarrativeField(merged, payload, 'executiveSummary', {
        fallbackValue: () => buildExecutiveSummaryFallback(merged),
    });
    merged.keyFindings = resolveNarrativeField(merged, payload, 'keyFindings', {
        fallbackValue: () => buildExpandedKeyFindings(merged, merged),
        defaultValue: [],
    });
    merged.criminalNotes = resolveNarrativeField(merged, payload, 'criminalNotes');
    merged.laborNotes = resolveNarrativeField(merged, payload, 'laborNotes');
    merged.warrantNotes = resolveNarrativeField(merged, payload, 'warrantNotes');
    merged.osintNotes = resolveNarrativeField(merged, payload, 'osintNotes');
    merged.socialNotes = resolveNarrativeField(merged, payload, 'socialNotes');
    merged.digitalNotes = resolveNarrativeField(merged, payload, 'digitalNotes');
    merged.conflictNotes = resolveNarrativeField(merged, payload, 'conflictNotes');
    merged.analystComment = resolveNarrativeField(merged, payload, 'analystComment', {
        prefillKey: 'finalJustification',
    });

    if (!hasMeaningfulValue(merged.sourceSummary)) {
        merged.sourceSummary = buildSourceSummary(merged);
    }
    if (!hasMeaningfulValue(merged.statusSummary)) {
        merged.statusSummary = buildStatusSummary(merged);
    }
    if (!Array.isArray(merged.nextSteps) || merged.nextSteps.length === 0) {
        merged.nextSteps = buildNextSteps(merged);
    }
    merged.timelineEvents = buildTimelineEvents(merged, { concludedAtOverride: concludedAtFallback });
    if (!hasMeaningfulValue(merged.reportSlug)) {
        merged.reportSlug = buildReportSlug(caseId, merged);
    }
    if (!hasMeaningfulValue(merged.concludedAt) && concludedAtFallback) {
        merged.concludedAt = concludedAtFallback;
    }
    if (!hasMeaningfulValue(merged.turnaroundHours)) {
        const turnaroundHours = calculateTurnaroundHours(merged, concludedAtFallback);
        if (turnaroundHours != null) merged.turnaroundHours = turnaroundHours;
    }
    if (merged.reportReady === undefined) {
        merged.reportReady = hasMeaningfulValue(merged.finalVerdict) &&
            (
                hasMeaningfulValue(merged.executiveSummary)
                || (Array.isArray(merged.keyFindings) && merged.keyFindings.length > 0)
                || (Array.isArray(merged.processHighlights) && merged.processHighlights.length > 0)
                || (Array.isArray(merged.warrantFindings) && merged.warrantFindings.length > 0)
                || hasMeaningfulValue(merged.analystComment)
            );
    }

    for (const field of PUBLIC_RESULT_FIELDS) {
        const value = merged[field];
        if (value !== undefined && value !== null && value !== '') {
            snapshot[field] = value;
        }
    }

    return stripUndefined(snapshot);
}

async function syncPublicResultLatest(caseId, caseData, payload = {}, options = {}) {
    const publicData = buildSanitizedPublicResultSnapshot(caseId, caseData, payload, options);
    const writePayload = {
        ...publicData,
        publishedAt: FieldValue.serverTimestamp(),
    };
    if (!writePayload.concludedAt) {
        writePayload.concludedAt = options.concludedAtOverride || FieldValue.serverTimestamp();
    }
    await db.collection('cases').doc(caseId).collection('publicResult').doc('latest').set(writePayload);
    return publicData;
}

function buildReviewDraftSeed(caseData) {
    const reviewDraft = { ...(caseData.reviewDraft || {}) };
    for (const field of ALLOWED_DRAFT_FIELDS) {
        const value = caseData[field];
        if (!hasMeaningfulValue(value)) continue;
        reviewDraft[field] = normalizeNarrativeValue(field, value);
    }
    return stripUndefined(reviewDraft);
}

function buildResetPublishedCaseFields(caseData, options = {}) {
    const {
        preserveReviewDraft = false,
        resetReportReady = true,
    } = options;
    const resetFields = {
        publicReportToken: FieldValue.delete(),
        reportSlug: FieldValue.delete(),
        concludedAt: FieldValue.delete(),
        turnaroundHours: FieldValue.delete(),
        processHighlights: FieldValue.delete(),
        warrantFindings: FieldValue.delete(),
        keyFindings: FieldValue.delete(),
        executiveSummary: FieldValue.delete(),
        analystComment: FieldValue.delete(),
        statusSummary: FieldValue.delete(),
        sourceSummary: FieldValue.delete(),
        nextSteps: FieldValue.delete(),
        hasNotes: FieldValue.delete(),
        hasEvidence: FieldValue.delete(),
    };

    if (resetReportReady) {
        resetFields.reportReady = false;
    }

    for (const field of RESULT_ONLY_FIELDS) {
        if (field === 'enabledPhases') continue;
        resetFields[field] = FieldValue.delete();
    }

    if (preserveReviewDraft) {
        const reviewDraft = buildReviewDraftSeed(caseData);
        if (Object.keys(reviewDraft).length > 0) {
            resetFields.reviewDraft = reviewDraft;
        }
    }

    return resetFields;
}

async function revokeCasePublicationArtifacts(caseId, caseData) {
    if (caseData?.publicReportToken) {
        const reportRef = db.collection('publicReports').doc(caseData.publicReportToken);
        const reportSnap = await reportRef.get();
        if (reportSnap.exists) {
            await reportRef.update({ active: false, status: 'revoked', revokedAt: FieldValue.serverTimestamp() });
        }
    }

    const publicResultRef = db.collection('cases').doc(caseId).collection('publicResult').doc('latest');
    const publicResultSnap = await publicResultRef.get();
    if (publicResultSnap.exists) {
        await publicResultRef.delete();
    }

    await db.collection('clientProjections').doc(caseId).set({
        reportAvailability: {
            status: 'revoked',
            reasonCode: 'case_unpublished',
            clientMessage: 'Relatorio indisponivel porque o caso foi reaberto ou substituido.',
            publicReportToken: null,
            reportSnapshotId: caseData?.currentReportSnapshotId || null,
            decisionId: caseData?.currentDecisionId || null,
            isActionable: false,
        },
        reportReady: false,
        publicReportToken: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
}

function computePublicSnapshotHash(publicData) {
    return computeSimpleHash(JSON.stringify(publicData || {}));
}

function buildV2ArtifactId(caseId, hash) {
    const safeCaseId = String(caseId || 'case').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const safeHash = String(hash || computeSimpleHash(safeCaseId)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
    return `${safeCaseId}_${safeHash}`;
}

function isUsablePublicReport(reportData, { caseId, tenantId, reportSnapshotId, now = new Date() } = {}) {
    if (!reportData) return false;
    if (reportData.active === false || reportData.status === 'revoked') return false;
    if (reportData.caseId && reportData.caseId !== caseId) return false;
    if (reportData.tenantId && tenantId && reportData.tenantId !== tenantId) return false;
    if (reportData.reportSnapshotId && reportSnapshotId && reportData.reportSnapshotId !== reportSnapshotId) return false;
    if (reportData.reportBuildVersion && reportData.reportBuildVersion !== REPORT_BUILD_VERSION) return false;
    const expiresAt = asDate(reportData.expiresAt);
    if (expiresAt && expiresAt < now) return false;
    return true;
}

function buildModuleRunDocId(caseId, moduleKey) {
    return `${caseId}_${moduleKey}`.replace(/[^A-Za-z0-9_-]/g, '_');
}

async function materializeModuleRunsForCase(caseId, caseData = {}, options = {}) {
    const tenantId = caseData.tenantId || options.tenantId || null;
    if (!caseId || !tenantId) {
        const emptySummary = summarizeModuleRuns([]);
        return { moduleRuns: [], summary: emptySummary };
    }

    const resolvedState = await resolveModuleRunsForCase(caseId, caseData, options);
    const operationalArtifacts = buildOperationalArtifactsForCase({
        caseId,
        caseData,
        moduleRuns: resolvedState.moduleRuns,
    });
    operationalArtifacts.rawSnapshots = await persistRawSnapshotPayloads(
        operationalArtifacts.rawSnapshots,
        { bucket: storage.bucket(), logger: console },
    );

    const usageMeters = buildUsageMetersForCase({
        caseId,
        tenantId,
        subjectId: caseData.subjectId || null,
        productKey: caseData.productKey || inferProductKey(caseData),
        moduleRuns: resolvedState.moduleRuns,
        providerRequests: operationalArtifacts.providerRequests,
        meteredAt: caseData.createdAt || caseData.requestedAt || caseData.updatedAt || new Date(),
    });
    const meterIdsByModule = groupMeterIdsByModule(usageMeters);

    const mergeIds = (...lists) => [...new Set(lists.flat().filter(Boolean))];
    const moduleRuns = resolvedState.moduleRuns.map((moduleRun) => {
        const artifactIds = operationalArtifacts.artifactIdsByModule?.[moduleRun.moduleKey] || {};
        return {
            ...moduleRun,
            providerRequestIds: mergeIds(moduleRun.providerRequestIds || [], artifactIds.providerRequestIds || []),
            rawSnapshotIds: mergeIds(moduleRun.rawSnapshotIds || [], artifactIds.rawSnapshotIds || []),
            providerRecordIds: mergeIds(moduleRun.providerRecordIds || [], artifactIds.providerRecordIds || []),
            evidenceIds: mergeIds(moduleRun.evidenceIds || [], artifactIds.evidenceIds || []),
            riskSignalIds: mergeIds(moduleRun.riskSignalIds || [], artifactIds.riskSignalIds || []),
            usageMeterIds: mergeIds(moduleRun.usageMeterIds || [], meterIdsByModule[moduleRun.moduleKey] || []),
        };
    });
    const summary = summarizeModuleRuns(moduleRuns);
    const batch = db.batch();

    usageMeters.forEach((meter) => {
        const meterRef = db.collection('usageMeters').doc(meter.id);
        batch.set(meterRef, stripUndefined({
            ...meter,
            updatedAt: FieldValue.serverTimestamp(),
        }), { merge: true });
    });

    operationalArtifacts.providerRequests.forEach((providerRequest) => {
        const providerRequestRef = db.collection('providerRequests').doc(providerRequest.id);
        batch.set(providerRequestRef, stripUndefined({
            ...providerRequest,
            updatedAt: FieldValue.serverTimestamp(),
        }), { merge: true });
    });

    operationalArtifacts.rawSnapshots.forEach((snap) => {
        const snapRef = db.collection('rawSnapshots').doc(snap.id);
        batch.set(snapRef, stripUndefined({
            ...snap,
            updatedAt: FieldValue.serverTimestamp(),
        }), { merge: true });
    });

    operationalArtifacts.providerRecords.forEach((record) => {
        const recordRef = db.collection('providerRecords').doc(record.id);
        batch.set(recordRef, stripUndefined({
            ...record,
            updatedAt: FieldValue.serverTimestamp(),
        }), { merge: true });
    });


    operationalArtifacts.evidenceItems.forEach((evidenceItem) => {
        const evidenceRef = db.collection('evidenceItems').doc(evidenceItem.id);
        batch.set(evidenceRef, stripUndefined({
            ...evidenceItem,
            updatedAt: FieldValue.serverTimestamp(),
        }), { merge: true });
    });

    operationalArtifacts.riskSignals.forEach((riskSignal) => {
        const riskSignalRef = db.collection('riskSignals').doc(riskSignal.id);
        batch.set(riskSignalRef, stripUndefined({
            ...riskSignal,
            updatedAt: FieldValue.serverTimestamp(),
        }), { merge: true });
    });

    moduleRuns.forEach((moduleRun) => {
        const moduleRunRef = db.collection('moduleRuns').doc(buildModuleRunDocId(caseId, moduleRun.moduleKey));
        batch.set(moduleRunRef, stripUndefined({
            ...moduleRun,
            updatedAt: FieldValue.serverTimestamp(),
        }), { merge: true });
    });

    const casePointerPayload = stripUndefined({
        productKey: caseData.productKey || inferProductKey(caseData),
        requestedModuleKeys: summary.requestedModuleKeys,
        effectiveModuleKeys: summary.effectiveModuleKeys,
        executedModuleKeys: summary.executedModuleKeys,
        moduleRunSummary: {
            total: summary.total,
            requestedCount: summary.requestedCount,
            effectiveCount: summary.effectiveCount,
            executedCount: summary.executedCount,
            blockedCount: summary.blockedCount,
            blockedModuleKeys: summary.blockedModuleKeys,
            blocksDecision: summary.blocksDecision,
            blocksPublication: summary.blocksPublication,
            providerRequestCount: operationalArtifacts.summary.providerRequestCount,
            rawSnapshotCount: operationalArtifacts.summary.rawSnapshotCount,
            providerRecordCount: operationalArtifacts.summary.providerRecordCount,
            evidenceCount: operationalArtifacts.summary.evidenceCount,
            riskSignalCount: operationalArtifacts.summary.riskSignalCount,
            updatedAt: FieldValue.serverTimestamp(),
        },
        moduleRunsVersion: V2_MODULES_VERSION,
        operationalArtifactsVersion: V2_OPERATIONAL_ARTIFACTS_VERSION,
        updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection('cases').doc(caseId), casePointerPayload, { merge: true });

    // Materialise subject entity (decouples investigated person from case envelope)
    try {
        const { subject, subjectId } = buildSubjectFromCase({
            caseId,
            caseData,
            moduleRunSummary: casePointerPayload.moduleRunSummary,
        });
        const subjectRef = db.collection('subjects').doc(subjectId);
        batch.set(subjectRef, stripUndefined({
            ...subject,
            lastDossierSummary: { ...subject.lastDossierSummary, updatedAt: FieldValue.serverTimestamp() },
            lastCheckedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            version: V2_SUBJECTS_VERSION,
        }), { merge: true });
        // Back-link subjectId onto case
        batch.set(db.collection('cases').doc(caseId), { subjectId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch (subjectErr) {
        console.warn(`Case ${caseId}: subject materialization skipped:`, subjectErr.message);
    }

    await batch.commit();

    try {
        const timelineEvents = buildTimelineEventsForCase({
            caseId,
            tenantId,
            moduleRuns,
            evidenceItems: operationalArtifacts.evidenceItems,
            riskSignals: operationalArtifacts.riskSignals,
        });
        const providerDivergences = buildProviderDivergencesForCase({
            caseId,
            tenantId,
            evidenceItems: operationalArtifacts.evidenceItems,
            riskSignals: operationalArtifacts.riskSignals,
        });
        const relationships = buildRelationshipsForCase({
            tenantId,
            caseId,
            subjectId: caseData.subjectId || null,
            productKey: caseData.productKey || inferProductKey(caseData),
            evidenceItems: operationalArtifacts.evidenceItems,
            providerRecords: operationalArtifacts.providerRecords,
            createdAt: new Date().toISOString(),
        });

        const derivedBatch = db.batch();
        timelineEvents.forEach((event) => {
            derivedBatch.set(db.collection('timelineEvents').doc(event.id), stripUndefined({
                ...event,
                updatedAt: FieldValue.serverTimestamp(),
            }), { merge: true });
        });
        providerDivergences.forEach((divergence) => {
            derivedBatch.set(db.collection('providerDivergences').doc(divergence.id), stripUndefined({
                ...divergence,
                updatedAt: FieldValue.serverTimestamp(),
            }), { merge: true });
        });
        relationships.forEach((relationship) => {
            derivedBatch.set(db.collection('relationships').doc(relationship.id), stripUndefined({
                ...relationship,
                updatedAt: FieldValue.serverTimestamp(),
            }), { merge: true });
        });
        if (timelineEvents.length || providerDivergences.length || relationships.length) {
            await derivedBatch.commit();
        }
    } catch (derivedErr) {
        console.warn(`Case ${caseId}: V2 derived timeline/relationship materialization skipped:`, derivedErr.message);
    }

    return { moduleRuns, summary, operationalArtifacts };
}

async function materializeModuleRunsFromCaseRef(caseRef, caseId, fallbackCaseData = {}) {
    try {
        const freshDoc = await caseRef.get();
        const freshData = {
            ...fallbackCaseData,
            ...(freshDoc.data() || {}),
        };
        return await materializeModuleRunsForCase(caseId, freshData);
    } catch (err) {
        console.warn(`Case ${caseId}: V2 module/artifact materialization failed:`, err.message);
        return null;
    }
}

async function resolveModuleRunsForCase(caseId, caseData = {}, options = {}) {
    const tenantId = caseData.tenantId || options.tenantId || null;
    if (!caseId || !tenantId) {
        const emptySummary = summarizeModuleRuns([]);
        return { moduleRuns: [], summary: emptySummary };
    }

    const [tenantEntitlements, tenantSettings] = await Promise.all([
        getTenantEntitlementsData(tenantId),
        getTenantSettingsData(tenantId),
    ]);
    const moduleRuns = buildModuleRunsForCase({
        caseId,
        caseData,
        tenantEntitlements,
        tenantSettings,
        now: new Date(),
    });
    const summary = summarizeModuleRuns(moduleRuns);
    return { moduleRuns, summary };
}

async function materializeV2PublicationArtifacts(caseId, caseData, options = {}) {
    const {
        publicSnapshot: providedPublicSnapshot = null,
        concludedAtOverride = null,
        reviewer = {},
        reportCreatedBy = null,
        source = SOURCE.PORTAL_OPS,
        createPublicReport = true,
    } = options;

    const now = new Date();
    const finalizedCaseData = {
        ...caseData,
        status: caseData.status || 'DONE',
    };
    const moduleRunState = await materializeModuleRunsForCase(caseId, finalizedCaseData);
    if (moduleRunState.summary.blocksDecision || moduleRunState.summary.blocksPublication) {
        throw new HttpsError(
            'failed-precondition',
            `Publicacao bloqueada por modulo(s): ${moduleRunState.summary.blockedModuleKeys.join(', ')}.`,
        );
    }
    const modularCaseData = {
        ...finalizedCaseData,
        requestedModuleKeys: moduleRunState.summary.requestedModuleKeys,
        effectiveModuleKeys: moduleRunState.summary.effectiveModuleKeys,
        executedModuleKeys: moduleRunState.summary.executedModuleKeys,
        moduleRunSummary: {
            total: moduleRunState.summary.total,
            requestedCount: moduleRunState.summary.requestedCount,
            effectiveCount: moduleRunState.summary.effectiveCount,
            executedCount: moduleRunState.summary.executedCount,
            blockedCount: moduleRunState.summary.blockedCount,
            blockedModuleKeys: moduleRunState.summary.blockedModuleKeys,
            blocksDecision: moduleRunState.summary.blocksDecision,
            blocksPublication: moduleRunState.summary.blocksPublication,
        },
    };
    const publicSnapshot = providedPublicSnapshot || await syncPublicResultLatest(caseId, modularCaseData, {}, {
        concludedAtOverride: concludedAtOverride || modularCaseData.concludedAt || modularCaseData.updatedAt || now,
    });
    const publicSnapshotHash = computePublicSnapshotHash(publicSnapshot);

    const decisionDraft = buildDecisionContract({
        caseId,
        caseData: modularCaseData,
        publicResult: publicSnapshot,
        reviewer,
        approvedAt: concludedAtOverride || modularCaseData.concludedAt || now,
    });
    const decisionId = buildV2ArtifactId(caseId, decisionDraft.evidenceSetHash);
    const decisionRef = db.collection('decisions').doc(decisionId);
    const decisionSnap = await decisionRef.get();
    const decision = {
        ...decisionDraft,
        id: decisionId,
        decisionId,
        createdAt: decisionSnap.exists ? decisionSnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        approvedAt: decisionDraft.approvedAt || concludedAtOverride || finalizedCaseData.concludedAt || now,
        updatedAt: FieldValue.serverTimestamp(),
        version: V2_CORE_VERSION,
    };
    await decisionRef.set(decision, { merge: true });

    // Fetch V2 collections to build ReportSnapshot and ReportSections using buildReportSnapshotFromV2
    const evidenceSnap = await db.collection('evidenceItems').where('caseId', '==', caseId).get();
    const evidenceItems = evidenceSnap.docs.map(d => d.data());
    const signalsSnap = await db.collection('riskSignals').where('caseId', '==', caseId).get();
    const riskSignals = signalsSnap.docs.map(d => d.data());

    const html = await buildCanonicalReportHtml(caseId, modularCaseData, publicSnapshot);
    const reportSnapshotDraft = buildReportSnapshotFromV2({
        caseId,
        caseData: modularCaseData,
        publicResult: publicSnapshot,
        decision,
        moduleRuns: moduleRunState.moduleRuns,
        evidenceItems,
        riskSignals,
        html,
        builderVersion: REPORT_BUILD_VERSION,
        createdBy: reviewer.uid || reportCreatedBy || null,
    });
    const reportSnapshotId = buildV2ArtifactId(caseId, reportSnapshotDraft.contentHash);
    const reportSnapshotRef = db.collection('reportSnapshots').doc(reportSnapshotId);
    const reportSnapshotSnap = await reportSnapshotRef.get();
    const reportSnapshot = {
        ...reportSnapshotDraft,
        id: reportSnapshotId,
        reportSnapshotId,
        decisionId,
        createdAt: reportSnapshotSnap.exists ? reportSnapshotSnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };

    const gateResult = validatePublicationGates({ decision, reportSnapshot, html });
    if (!gateResult.ok) {
        await reportSnapshotRef.set({
            ...reportSnapshot,
            status: 'failed',
            failureReason: gateResult.reasonCode,
        }, { merge: true });
        throw new HttpsError('failed-precondition', `Publicacao bloqueada: ${gateResult.reasonCode}.`);
    }

    if (!reportSnapshotSnap.exists) {
        await reportSnapshotRef.set(reportSnapshot);
    }

    let publicReport = null;
    let publicReportToken = null;
    let expiresAt = null;

    if (createPublicReport) {
        const existingToken = finalizedCaseData.publicReportToken;
        if (existingToken) {
            const existingRef = db.collection('publicReports').doc(existingToken);
            const existingSnap = await existingRef.get();
            if (existingSnap.exists) {
                const existing = existingSnap.data() || {};
                if (isUsablePublicReport(existing, {
                    caseId,
                    tenantId: finalizedCaseData.tenantId,
                    reportSnapshotId,
                    now,
                })) {
                    publicReportToken = existingToken;
                    expiresAt = asDate(existing.expiresAt);
                    publicReport = {
                        ...existing,
                        id: existingToken,
                        token: existingToken,
                        expiresAt,
                    };
                }
            }
        }

        // 4. Create public report with deterministic ID to prevent race conditions
        if (!publicReport) {
            const TTL_DAYS = 365;
            expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

            // Generate a deterministic token based on snapshot hash to avoid orphans on race conditions
            const deterministicToken = buildV2ArtifactId(caseId, computeSimpleHash('pr_' + reportSnapshot.contentHash));
            const publicReportRef = db.collection('publicReports').doc(deterministicToken);
            publicReportToken = publicReportRef.id;
            publicReport = {
                html,
                createdAt: FieldValue.serverTimestamp(),
                expiresAt,
                active: true,
                status: 'ready',
                tenantId: modularCaseData.tenantId || null,
                createdBy: reportCreatedBy || reviewer.uid || null,
                createdBySource: source,
                caseId,
                candidateName: String(modularCaseData.candidateName || publicSnapshot.candidateName || '').slice(0, 160),
                reportBuildVersion: REPORT_BUILD_VERSION,
                publicSnapshotHash,
                reportSnapshotId,
                decisionId,
                contentHash: reportSnapshot.contentHash,
                version: V2_CORE_VERSION,
            };
            await publicReportRef.set(publicReport);
            publicReport = {
                ...publicReport,
                id: publicReportToken,
                token: publicReportToken,
            };
        }
    }

    const availability = resolvePublicReportAvailability({
        decision,
        reportSnapshot,
        publicReport,
        now,
    });
    const clientProjection = buildClientProjectionContract({
        caseId,
        caseData: modularCaseData,
        publicResult: publicSnapshot,
        decision,
        reportSnapshot,
        availability,
    });
    await db.collection('clientProjections').doc(caseId).set({
        ...clientProjection,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const casePointerPayload = {
        productKey: inferProductKey(modularCaseData),
        requestedModuleKeys: moduleRunState.summary.requestedModuleKeys,
        effectiveModuleKeys: moduleRunState.summary.effectiveModuleKeys,
        executedModuleKeys: moduleRunState.summary.executedModuleKeys,
        currentDecisionId: decisionId,
        currentReportSnapshotId: reportSnapshotId,
        currentClientProjectionId: caseId,
        currentPublicReportId: publicReportToken || FieldValue.delete(),
        reportReady: availability.status === 'ready',
        v2CoreVersion: V2_CORE_VERSION,
        updatedAt: FieldValue.serverTimestamp(),
    };
    if (publicReportToken) {
        casePointerPayload.publicReportToken = publicReportToken;
    }
    await db.collection('cases').doc(caseId).set(casePointerPayload, { merge: true });

    return {
        decisionId,
        reportSnapshotId,
        clientProjectionId: caseId,
        publicReportToken,
        expiresAt,
        availability,
        moduleRunSummary: moduleRunState.summary,
        publicSnapshot,
    };
}

exports.concludeCaseByAnalyst = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const caseId = String(request.data?.caseId || '').trim();
        const payload = request.data?.payload || {};
        if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

        const caseRef = db.collection('cases').doc(caseId);

        // --- PHASE 1: PRE-FETCH & VALIDATION (outside transaction to avoid heavy locks) ---
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
        const caseData = caseDoc.data() || {};

        if (caseData.status === 'DONE') {
            return { success: true, message: 'Caso ja concluido.' };
        }

        const isGlobalAdmin = profile.role === 'admin' && !profile.tenantId;
        if (caseData.tenantId && caseData.tenantId !== profile.tenantId && !isGlobalAdmin) {
            throw new HttpsError('permission-denied', 'Sem permissao para operar neste caso.');
        }

        const updatePayload = pickConcludePayload(payload);
        if (!updatePayload.assigneeId) {
            updatePayload.assigneeId = caseData.assigneeId || uid;
        }

        // Hard facts validation
        if (
            (caseData.juditActiveWarrantCount || 0) > 0 &&
            updatePayload.warrantFlag &&
            !['POSITIVE', 'INCONCLUSIVE'].includes(updatePayload.warrantFlag)
        ) {
            throw new HttpsError(
                'failed-precondition',
                `Caso possui ${caseData.juditActiveWarrantCount} mandado(s) ativo(s) na Judit. O campo Mandado de Prisao deve ser POSITIVO ou INCONCLUSIVO para concluir.`,
            );
        }

        const conclusionTimestamp = new Date();
        updatePayload.processHighlights = buildProcessHighlights(caseData);
        updatePayload.warrantFindings = buildWarrantFindings(caseData);
        updatePayload.executiveSummary = resolveNarrativeField(caseData, payload, 'executiveSummary', {
            fallbackValue: () => buildExecutiveSummaryFallback({ ...caseData, ...updatePayload }),
        });
        updatePayload.keyFindings = resolveNarrativeField(caseData, payload, 'keyFindings', {
            fallbackValue: () => buildExpandedKeyFindings({ ...caseData, ...updatePayload }, updatePayload),
            defaultValue: [],
        });
        updatePayload.criminalNotes = resolveNarrativeField(caseData, payload, 'criminalNotes');
        updatePayload.laborNotes = resolveNarrativeField(caseData, payload, 'laborNotes');
        updatePayload.warrantNotes = resolveNarrativeField(caseData, payload, 'warrantNotes');
        updatePayload.osintNotes = resolveNarrativeField(caseData, payload, 'osintNotes');
        updatePayload.socialNotes = resolveNarrativeField(caseData, payload, 'socialNotes');
        updatePayload.digitalNotes = resolveNarrativeField(caseData, payload, 'digitalNotes');
        updatePayload.conflictNotes = resolveNarrativeField(caseData, payload, 'conflictNotes');
        updatePayload.analystComment = resolveNarrativeField(caseData, payload, 'analystComment', {
            prefillKey: 'finalJustification',
        });

        updatePayload.sourceSummary = buildSourceSummary({ ...caseData, ...updatePayload });

        const reviewDraft = caseData?.reviewDraft || {};
        const flagFields = [
            'criminalFlag', 'criminalSeverity', 'laborFlag', 'laborSeverity',
            'warrantFlag', 'osintLevel', 'socialStatus', 'digitalFlag',
            'conflictInterest', 'finalVerdict', 'riskLevel', 'riskScore',
        ];
        for (const ff of flagFields) {
            if (!hasMeaningfulValue(updatePayload[ff]) && hasMeaningfulValue(reviewDraft[ff])) {
                updatePayload[ff] = reviewDraft[ff];
            }
        }

        const arrayFlagFields = ['osintVectors', 'socialReasons', 'digitalVectors'];
        for (const af of arrayFlagFields) {
            if (!hasMeaningfulValue(updatePayload[af]) && hasMeaningfulValue(reviewDraft[af])) {
                updatePayload[af] = reviewDraft[af];
            }
        }

        if (!hasMeaningfulValue(updatePayload.riskScore) || updatePayload.riskScore === 0) {
            const scores = { POSITIVE: 90, INCONCLUSIVE: 50, NEGATIVE_PARTIAL: 40, CONCERN: 60, ALERT: 70, ATTENTION: 55, UNKNOWN: 30, NOT_FOUND: 0, NOT_CHECKED: 0, NEGATIVE: 0, CLEAN: 0, FIT: 0 };
            const flagVals = [
                scores[updatePayload.criminalFlag] || 0,
                scores[updatePayload.laborFlag] || 0,
                scores[updatePayload.warrantFlag] || 0,
                scores[updatePayload.osintLevel] || 0,
                scores[updatePayload.socialStatus] || 0,
                scores[updatePayload.digitalFlag] || 0,
            ];
            const maxScore = Math.max(...flagVals, 0);
            if (maxScore > 0) updatePayload.riskScore = maxScore;
        }

        const derivedCaseForPublish = { ...caseData, ...updatePayload, status: 'DONE' };
        const moduleRunPreflight = await resolveModuleRunsForCase(caseId, derivedCaseForPublish);
        if (moduleRunPreflight.summary.blocksDecision || moduleRunPreflight.summary.blocksPublication) {
            throw new HttpsError(
                'failed-precondition',
                `Conclusao bloqueada por modulo(s): ${moduleRunPreflight.summary.blockedModuleKeys.join(', ')}.`,
            );
        }
        const blockingDivergencesSnap = await db.collection('providerDivergences')
            .where('caseId', '==', caseId)
            .where('blocksPublication', '==', true)
            .limit(1)
            .get();
        if (!blockingDivergencesSnap.empty) {
            const blockingDivergence = blockingDivergencesSnap.docs[0];
            throw new HttpsError(
                'failed-precondition',
                `Conclusao bloqueada por divergencia de provider aberta (${blockingDivergence.id}). Resolva a divergencia com justificativa antes da publicacao.`,
            );
        }

        // V2 Review Gate Enforced
        const signalsSnap = await db.collection('riskSignals').where('caseId', '==', caseId).get();
        const riskSignals = signalsSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
        const reviewGateResult = resolveReviewGate({
            moduleRuns: moduleRunPreflight.moduleRuns,
            riskSignals,
            caseData: derivedCaseForPublish,
            moduleRegistry: MODULE_REGISTRY,
            actorRole: profile.role,
        });
        if (!reviewGateResult.allowed) {
            if (reviewGateResult.denialReasonCode === 'senior_approval_required') {
                const seniorReviewRequestId = buildSeniorReviewRequestId(caseId);
                const seniorReviewRef = db.collection('seniorReviewRequests').doc(seniorReviewRequestId);
                const seniorReviewSnap = await seniorReviewRef.get();
                const seniorReviewData = seniorReviewSnap.exists ? { id: seniorReviewSnap.id, ...(seniorReviewSnap.data() || {}) } : null;

                if (isSeniorReviewApproved(seniorReviewData)) {
                    updatePayload.seniorReviewRequestId = seniorReviewRequestId;
                    updatePayload.seniorApprovalStatus = 'approved';
                    updatePayload.seniorApprovedBy = seniorReviewData.resolvedBy || null;
                    updatePayload.seniorApprovedAt = seniorReviewData.resolvedAt || null;
                    derivedCaseForPublish.seniorReviewRequestId = seniorReviewRequestId;
                    derivedCaseForPublish.seniorApprovalStatus = 'approved';
                    derivedCaseForPublish.seniorApprovedBy = seniorReviewData.resolvedBy || null;
                    derivedCaseForPublish.seniorApprovedAt = seniorReviewData.resolvedAt || null;
                } else {
                    const seniorReviewRequest = buildSeniorReviewRequest({
                        caseId,
                        caseData: derivedCaseForPublish,
                        policyResult: reviewGateResult.policyResult,
                        riskSignals,
                        moduleRuns: moduleRunPreflight.moduleRuns,
                        actor: { uid, email: profile.email || uid },
                    });

                    await seniorReviewRef.set({
                        ...seniorReviewRequest,
                        createdAt: seniorReviewSnap.exists ? (seniorReviewData.createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                    }, { merge: true });
                    await caseRef.set({
                        seniorReviewRequestId,
                        seniorApprovalStatus: 'pending',
                        status: 'senior_review_required',
                        updatedAt: FieldValue.serverTimestamp(),
                    }, { merge: true });
                    await writeAuditEvent({
                        action: 'SENIOR_REVIEW_REQUESTED',
                        tenantId: caseData.tenantId || null,
                        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
                        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                        related: { caseId, seniorReviewRequestId },
                        source: SOURCE.PORTAL_OPS,
                        ip: getClientIp(request),
                        detail: `Revisao senior solicitada para ${caseData.candidateName || caseId}`,
                        metadata: {
                            denialReasonCode: reviewGateResult.denialReasonCode,
                            policyResult: reviewGateResult.policyResult,
                        },
                    });
                    throw new HttpsError(
                        'failed-precondition',
                        `Conclusao bloqueada: ${reviewGateResult.denialMessage}. A pendencia senior foi registrada na fila operacional.`
                    );
                }
            } else {
            throw new HttpsError(
                'permission-denied',
                `Aprovacao negada (V2 Gate): ${reviewGateResult.denialMessage}`
            );
            }
        }

        updatePayload.statusSummary = hasMeaningfulValue(updatePayload.statusSummary)
            ? updatePayload.statusSummary
            : buildStatusSummary(derivedCaseForPublish);
        updatePayload.nextSteps = Array.isArray(updatePayload.nextSteps) && updatePayload.nextSteps.length > 0
            ? sanitizeStructuredList(updatePayload.nextSteps, 6, 220)
            : buildNextSteps(derivedCaseForPublish);
        updatePayload.timelineEvents = buildTimelineEvents(derivedCaseForPublish, {
            concludedAtOverride: conclusionTimestamp,
        });
        updatePayload.reportSlug = hasMeaningfulValue(caseData.reportSlug)
            ? caseData.reportSlug
            : buildReportSlug(caseId, derivedCaseForPublish);
        const turnaroundHours = calculateTurnaroundHours(caseData, conclusionTimestamp);
        if (turnaroundHours != null) {
            updatePayload.turnaroundHours = turnaroundHours;
        }

        const hasMinContent = hasMeaningfulValue(updatePayload.finalVerdict) &&
            (
                hasMeaningfulValue(updatePayload.executiveSummary)
                || (Array.isArray(updatePayload.keyFindings) && updatePayload.keyFindings.length > 0)
                || (Array.isArray(updatePayload.processHighlights) && updatePayload.processHighlights.length > 0)
                || (Array.isArray(updatePayload.warrantFindings) && updatePayload.warrantFindings.length > 0)
                || hasMeaningfulValue(updatePayload.analystComment)
            );
        updatePayload.reportReady = hasMinContent;
        updatePayload.status = 'DONE';
        updatePayload.concludedAt = conclusionTimestamp;
        updatePayload.updatedAt = FieldValue.serverTimestamp();

        // --- PHASE 2: GENERATE ARTIFACTS BEFORE COMMIT ---
        // V2 Artifacts materialized first. If another request is running, it will overwrite idempotently.
        // Sync write to publicResult/latest
        const publicSnapshot = await syncPublicResultLatest(caseId, derivedCaseForPublish, {}, {
            concludedAtOverride: conclusionTimestamp,
        });

        const v2Artifacts = await materializeV2PublicationArtifacts(caseId, derivedCaseForPublish, {
            publicSnapshot,
            concludedAtOverride: conclusionTimestamp,
            reviewer: { uid, email: profile.email || uid },
            reportCreatedBy: uid,
            source: SOURCE.PORTAL_OPS,
        });

        // --- PHASE 3: TRANSACTIONAL COMMIT ---
        // This ensures status is checked and updated atomically, preventing duplicate audit logs.
        // It also ensures that the case is not marked DONE if artifact generation fails.
        const result = await db.runTransaction(async (t) => {
            const freshSnap = await t.get(caseRef);
            const freshData = freshSnap.data() || {};
            if (freshData.status === 'DONE') {
                return { aborted: true, alreadyDone: true };
            }

            t.update(caseRef, updatePayload);
            return { aborted: false };
        });

        if (result.aborted) {
            return { success: true, message: 'Caso ja concluido por outro processo.' };
        }

        await writeAuditEvent({
            action: 'CASE_CONCLUDED',
            tenantId: caseData.tenantId || null,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
            related: {
                caseId,
                decisionId: v2Artifacts.decisionId,
                reportSnapshotId: v2Artifacts.reportSnapshotId,
                reportToken: v2Artifacts.publicReportToken,
            },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Caso concluido para ${caseData.candidateName || caseId}`,
        });

        return {
            success: true,
            decisionId: v2Artifacts.decisionId,
            reportSnapshotId: v2Artifacts.reportSnapshotId,
            clientProjectionId: v2Artifacts.clientProjectionId,
            publicReportToken: v2Artifacts.publicReportToken,
            reportAvailability: v2Artifacts.availability,
            moduleRunSummary: v2Artifacts.moduleRunSummary,
        };
    },
);

exports.resolveProviderDivergenceByAnalyst = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 30 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        if (!hasV2Permission(profile.role, V2_PERMISSIONS.PROVIDER_DIVERGENCE_RESOLVE)) {
            throw new HttpsError('permission-denied', 'Sem permissao para resolver divergencias de provider.');
        }

        const divergenceId = String(request.data?.divergenceId || '').trim();
        const caseId = String(request.data?.caseId || '').trim();
        if (!divergenceId || !caseId) {
            throw new HttpsError('invalid-argument', 'divergenceId e caseId sao obrigatorios.');
        }

        const divergenceRef = db.collection('providerDivergences').doc(divergenceId);
        const caseRef = db.collection('cases').doc(caseId);
        const resolvedAt = new Date().toISOString();
        let updatedDivergence = null;
        let caseData = null;

        await db.runTransaction(async (transaction) => {
            const [divergenceDoc, caseDoc] = await Promise.all([
                transaction.get(divergenceRef),
                transaction.get(caseRef),
            ]);
            if (!divergenceDoc.exists) throw new HttpsError('not-found', 'Divergencia nao encontrada.');
            if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');

            const divergence = { id: divergenceDoc.id, ...(divergenceDoc.data() || {}) };
            caseData = caseDoc.data() || {};
            if (divergence.caseId !== caseId) {
                throw new HttpsError('failed-precondition', 'Divergencia nao pertence ao caso informado.');
            }
            if (caseData.tenantId && caseData.tenantId !== profile.tenantId && profile.role !== 'admin') {
                throw new HttpsError('permission-denied', 'Sem permissao para operar este tenant.');
            }

            let resolution;
            try {
                resolution = buildProviderDivergenceResolution({
                    divergence,
                    payload: request.data || {},
                    actor: { uid, email: profile.email || uid },
                    resolvedAt,
                });
            } catch (error) {
                throw new HttpsError('invalid-argument', error.message || 'Resolucao invalida.');
            }

            updatedDivergence = { ...divergence, ...resolution };
            transaction.set(divergenceRef, stripUndefined({
                ...resolution,
                updatedAt: FieldValue.serverTimestamp(),
            }), { merge: true });
            transaction.set(caseRef, stripUndefined({
                providerDivergenceResolutionUpdatedAt: FieldValue.serverTimestamp(),
                lastResolvedProviderDivergenceId: divergenceId,
                updatedAt: FieldValue.serverTimestamp(),
            }), { merge: true });
        });

        const divergencesSnap = await db.collection('providerDivergences').where('caseId', '==', caseId).get();
        const divergences = divergencesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        const openStatuses = new Set(['open', 'in_review', 'needs_recheck']);
        const summary = {
            total: divergences.length,
            openCount: divergences.filter((divergence) => openStatuses.has(divergence.status || 'open')).length,
            resolvedCount: divergences.filter((divergence) => !openStatuses.has(divergence.status || 'open')).length,
            blockingCount: divergences.filter((divergence) => divergence.blocksPublication === true).length,
            updatedAt: FieldValue.serverTimestamp(),
        };
        await db.collection('cases').doc(caseId).set({ providerDivergenceSummary: summary }, { merge: true });

        await writeAuditEvent({
            action: 'PROVIDER_DIVERGENCE_RESOLVED',
            tenantId: caseData?.tenantId || updatedDivergence?.tenantId || null,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'PROVIDER_DIVERGENCE', id: divergenceId, label: divergenceId },
            related: { caseId, subjectId: caseData?.subjectId || null },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Divergencia ${divergenceId} resolvida com status ${updatedDivergence?.status}`,
            metadata: {
                caseId,
                status: updatedDivergence?.status || null,
                resolution: updatedDivergence?.resolution || null,
                resolutionAudit: updatedDivergence?.resolutionAudit || null,
                providerDivergenceSummary: {
                    total: summary.total,
                    openCount: summary.openCount,
                    resolvedCount: summary.resolvedCount,
                    blockingCount: summary.blockingCount,
                },
            },
            templateVars: { caseId, status: updatedDivergence?.status || null },
        });

        return {
            success: true,
            divergence: updatedDivergence,
            providerDivergenceSummary: {
                total: summary.total,
                openCount: summary.openCount,
                resolvedCount: summary.resolvedCount,
                blockingCount: summary.blockingCount,
            },
        };
    },
);

exports.updateTenantSettingsByAnalyst = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const tenantId = String(request.data?.tenantId || '').trim();
        const analysisConfig = request.data?.analysisConfig || {};
        const limits = request.data?.limits || {};
        const enrichmentConfig = request.data?.enrichmentConfig;

        if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId obrigatorio.');
        if (!canOperateTenant(profile, tenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para configurar este tenant.');
        }

        const payload = {
            analysisConfig,
            updatedAt: FieldValue.serverTimestamp(),
            dailyLimit: limits.dailyLimit ?? null,
            monthlyLimit: limits.monthlyLimit ?? null,
            allowDailyExceedance: limits.allowDailyExceedance !== false,
            allowMonthlyExceedance: limits.allowMonthlyExceedance === true,
        };
        if (enrichmentConfig !== undefined) {
            payload.enrichmentConfig = enrichmentConfig;
        }

        await db.collection('tenantSettings').doc(tenantId).set(payload, { merge: true });

        await writeAuditEvent({
            action: 'TENANT_CONFIG_UPDATED',
            tenantId,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'SETTINGS', id: tenantId, label: tenantId },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Configuracoes atualizadas para ${tenantId}`,
            templateVars: { tenantId },
        });

        return { success: true };
    },
);

exports.getTenantEntitlementsByAnalyst = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const tenantId = String(request.data?.tenantId || '').trim();
        if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId obrigatorio.');
        if (!canOperateTenant(profile, tenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para ler contrato deste tenant.');
        }

        // Get raw entitlements
        const entitlements = await getTenantEntitlementsData(tenantId);

        // Get legacy fallback if needed
        const tenantSettings = await getTenantSettingsData(tenantId);

        // Resolve what would be the effective entitlements
        const resolved = resolveCaseEntitlements({
            tenantId,
            tenantEntitlements: entitlements,
            tenantSettings,
        });

        return {
            tenantId,
            entitlements,
            resolvedEntitlements: resolved,
            source: entitlements ? 'tenantEntitlements' : (tenantSettings ? 'legacyTenantSettingsFallback' : 'defaults'),
        };
    }
);

exports.updateTenantEntitlementsByAnalyst = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        if (profile.role !== 'supervisor' && profile.role !== 'admin') {
            throw new HttpsError('permission-denied', 'Apenas supervisores podem alterar contratos.');
        }

        const tenantId = String(request.data?.tenantId || '').trim();
        const entitlements = request.data?.entitlements || {};
        if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId obrigatorio.');
        if (!canOperateTenant(profile, tenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para alterar contrato deste tenant.');
        }

        const beforeDoc = await db.collection('tenantEntitlements').doc(tenantId).get();
        const beforeData = beforeDoc.exists ? (beforeDoc.data() || {}) : {};
        const sanitized = sanitizeTenantEntitlementPayload(entitlements);
        const auditDiff = buildTenantEntitlementAuditDiff(beforeData, sanitized);

        const payload = {
            ...sanitized,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: uid,
            version: 'v2',
        };

        await db.collection('tenantEntitlements').doc(tenantId).set(payload, { merge: true });

        await writeAuditEvent({
            action: 'TENANT_ENTITLEMENTS_UPDATED',
            tenantId,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CONTRACT', id: tenantId, label: tenantId },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Entitlements V2 atualizados para ${tenantId}`,
            templateVars: { tenantId, tier: sanitized.tier, changedFields: auditDiff.changedFields.join(',') },
            metadata: { before: auditDiff.before, after: auditDiff.after, changedFields: auditDiff.changedFields },
        });

        return { success: true, changedFields: auditDiff.changedFields };
    }
);

exports.getTenantBillingOverview = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const tenantId = String(request.data?.tenantId || '').trim();
        const monthKey = String(request.data?.monthKey || formatMonthKey(new Date())).trim();
        if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId obrigatorio.');
        if (!/^\d{4}-\d{2}$/.test(monthKey)) {
            throw new HttpsError('invalid-argument', 'monthKey deve estar no formato YYYY-MM.');
        }
        if (!canOperateTenant(profile, tenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para ver consumo deste tenant.');
        }

        const [usageMetersSnap, billingEntriesSnap] = await Promise.all([
            db.collection('usageMeters')
                .where('tenantId', '==', tenantId)
                .where('monthKey', '==', monthKey)
                .limit(500)
                .get(),
            db.collection('billingEntries')
                .where('tenantId', '==', tenantId)
                .where('monthKey', '==', monthKey)
                .limit(500)
                .get()
                .catch(() => ({ docs: [] })),
        ]);

        const usageMeters = usageMetersSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        const billingEntries = billingEntriesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        const overview = summarizeBillingOverview({ usageMeters, billingEntries });

        return {
            tenantId,
            monthKey,
            overview,
            source: overview.source,
            fallbackUsed: overview.fallbackUsed === true,
            usageMeterCount: usageMeters.length,
            billingEntryCount: billingEntries.length,
            limitApplied: usageMeters.length >= 500 || billingEntries.length >= 500,
        };
    },
);

exports.closeTenantBillingPeriodByAnalyst = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        if (profile.role !== 'supervisor' && profile.role !== 'admin') {
            throw new HttpsError('permission-denied', 'Apenas supervisores podem fechar faturamento.');
        }

        const tenantId = String(request.data?.tenantId || '').trim();
        const monthKey = String(request.data?.monthKey || '').trim();
        if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId obrigatorio.');
        if (!/^\d{4}-\d{2}$/.test(monthKey)) {
            throw new HttpsError('invalid-argument', 'monthKey deve estar no formato YYYY-MM.');
        }
        if (!canOperateTenant(profile, tenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para fechar faturamento deste tenant.');
        }

        const result = await closeBillingPeriod(tenantId, monthKey, {
            actor: { uid, email: profile.email || uid },
        });

        await writeAuditEvent({
            action: 'TENANT_BILLING_PERIOD_CLOSED',
            tenantId,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'BILLING_SETTLEMENT', id: result.settlementId, label: `${tenantId}/${monthKey}` },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Fechamento de consumo V2 gerado para ${tenantId} em ${monthKey}`,
            templateVars: { tenantId, monthKey, settlementId: result.settlementId },
            metadata: { summary: result.summary },
        });

        return { success: true, ...result };
    },
);

exports.getTenantBillingSettlement = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const tenantId = String(request.data?.tenantId || '').trim();
        const monthKey = String(request.data?.monthKey || '').trim();
        if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId obrigatorio.');
        if (!/^\d{4}-\d{2}$/.test(monthKey)) {
            throw new HttpsError('invalid-argument', 'monthKey deve estar no formato YYYY-MM.');
        }
        if (!canOperateTenant(profile, tenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para ver fechamento deste tenant.');
        }

        const settlementId = `billing_${tenantId}_${monthKey}`;
        const doc = await db.collection('billingSettlements').doc(settlementId).get();
        return {
            tenantId,
            monthKey,
            settlementId,
            settlement: doc.exists ? { id: doc.id, ...(doc.data() || {}) } : null,
        };
    },
);

exports.getTenantBillingDrilldown = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const tenantId = String(request.data?.tenantId || '').trim();
        const monthKey = String(request.data?.monthKey || '').trim();
        if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId obrigatorio.');
        if (!/^\d{4}-\d{2}$/.test(monthKey)) {
            throw new HttpsError('invalid-argument', 'monthKey deve estar no formato YYYY-MM.');
        }
        if (!canOperateTenant(profile, tenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para ver consumo deste tenant.');
        }

        const includeInternalCost = hasV2Permission(profile.role, V2_PERMISSIONS.BILLING_VIEW_INTERNAL_COST);
        const [usageSnap, settlementDoc] = await Promise.all([
            db.collection('usageMeters')
                .where('tenantId', '==', tenantId)
                .where('monthKey', '==', monthKey)
                .limit(2000)
                .get(),
            db.collection('billingSettlements').doc(`billing_${tenantId}_${monthKey}`).get(),
        ]);
        const usageMeters = usageSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        const settlement = settlementDoc.exists ? { id: settlementDoc.id, ...(settlementDoc.data() || {}) } : null;
        const drilldown = buildBillingDrilldown({ usageMeters, settlement, includeInternalCost });

        return {
            tenantId,
            monthKey,
            drilldown,
            source: 'usageMeters',
            usageMeterCount: usageMeters.length,
            limitApplied: usageMeters.length >= 2000,
        };
    },
);

exports.exportTenantBillingDrilldown = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const tenantId = String(request.data?.tenantId || '').trim();
        const monthKey = String(request.data?.monthKey || '').trim();
        const format = String(request.data?.format || 'csv').trim().toLowerCase();
        if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId obrigatorio.');
        if (!/^\d{4}-\d{2}$/.test(monthKey)) {
            throw new HttpsError('invalid-argument', 'monthKey deve estar no formato YYYY-MM.');
        }
        if (!['csv', 'json'].includes(format)) {
            throw new HttpsError('invalid-argument', 'format deve ser csv ou json.');
        }
        if (!canOperateTenant(profile, tenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para exportar consumo deste tenant.');
        }

        const entitlements = await getTenantEntitlementsData(tenantId);
        const resolved = resolveTenantEntitlements(entitlements || {});
        if (!isTenantFeatureEnabled(resolved, 'BILLING_DASHBOARD')) {
            throw new HttpsError('failed-precondition', 'Dashboard de billing nao habilitado para este tenant.');
        }

        const includeInternalCost = hasV2Permission(profile.role, V2_PERMISSIONS.BILLING_VIEW_INTERNAL_COST);
        const [usageSnap, settlementDoc] = await Promise.all([
            db.collection('usageMeters')
                .where('tenantId', '==', tenantId)
                .where('monthKey', '==', monthKey)
                .limit(2000)
                .get(),
            db.collection('billingSettlements').doc(`billing_${tenantId}_${monthKey}`).get(),
        ]);
        const usageMeters = usageSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        const settlement = settlementDoc.exists ? { id: settlementDoc.id, ...(settlementDoc.data() || {}) } : null;
        const drilldown = buildBillingDrilldown({ usageMeters, settlement, includeInternalCost });
        const exported = buildBillingDrilldownExport({ drilldown, format });

        await writeAuditEvent({
            action: 'BILLING_DRILLDOWN_EXPORTED',
            tenantId,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'BILLING_SETTLEMENT', id: `billing_${tenantId}_${monthKey}`, label: `${tenantId}/${monthKey}` },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Drilldown de consumo V2 exportado para ${tenantId} em ${monthKey}`,
            templateVars: { tenantId, monthKey, format },
            metadata: { format, itemCount: drilldown.items.length, includeInternalCost },
        });

        return {
            success: true,
            tenantId,
            monthKey,
            format: exported.format,
            mimeType: exported.mimeType,
            content: exported.content,
            filename: `billing-drilldown-${tenantId}-${monthKey}.${exported.format}`,
            itemCount: drilldown.items.length,
        };
    },
);

exports.getSeniorReviewQueue = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const requestedTenantId = String(request.data?.tenantId || '').trim();
        const tenantId = profile.tenantId || requestedTenantId || null;
        if (requestedTenantId && !canOperateTenant(profile, requestedTenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para ver fila senior deste tenant.');
        }

        const status = String(request.data?.status || 'pending').trim();
        const queueQuery = tenantId
            ? db.collection('seniorReviewRequests').where('tenantId', '==', tenantId).where('status', '==', status).limit(100)
            : db.collection('seniorReviewRequests').where('status', '==', status).limit(100);
        const queueSnap = await queueQuery.get();
        const items = queueSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

        return {
            tenantId,
            status,
            items,
            summary: summarizeSeniorReviewQueue(items),
            limitApplied: items.length >= 100,
        };
    },
);

exports.resolveSeniorReviewRequest = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        if (!['senior_analyst', 'supervisor', 'admin'].includes(profile.role)) {
            throw new HttpsError('permission-denied', 'Apenas senior/supervisor/admin pode resolver revisao senior.');
        }

        const requestId = String(request.data?.requestId || '').trim();
        const status = String(request.data?.status || '').trim();
        const resolution = String(request.data?.resolution || '').trim();
        if (!requestId) throw new HttpsError('invalid-argument', 'requestId obrigatorio.');
        if (!['approved', 'rejected'].includes(status)) {
            throw new HttpsError('invalid-argument', 'status deve ser approved ou rejected.');
        }
        if (status === 'rejected' && resolution.length < 10) {
            throw new HttpsError('invalid-argument', 'Justificativa obrigatoria para rejeicao senior.');
        }

        const reviewRef = db.collection('seniorReviewRequests').doc(requestId);
        const reviewSnap = await reviewRef.get();
        if (!reviewSnap.exists) throw new HttpsError('not-found', 'Pendencia senior nao encontrada.');
        const reviewData = reviewSnap.data() || {};
        if (!canOperateTenant(profile, reviewData.tenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para resolver esta revisao senior.');
        }

        const resolvedAt = FieldValue.serverTimestamp();
        await reviewRef.set({
            status,
            resolution: resolution || (status === 'approved' ? 'Aprovado por senior.' : ''),
            resolvedBy: uid,
            resolvedByEmail: profile.email || uid,
            resolvedAt,
            updatedAt: resolvedAt,
        }, { merge: true });

        if (reviewData.caseId) {
            await db.collection('cases').doc(reviewData.caseId).set({
                seniorReviewRequestId: requestId,
                seniorApprovalStatus: status,
                seniorApprovedBy: status === 'approved' ? uid : null,
                seniorApprovedAt: status === 'approved' ? FieldValue.serverTimestamp() : null,
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
        }

        await writeAuditEvent({
            action: status === 'approved' ? 'SENIOR_REVIEW_APPROVED' : 'SENIOR_REVIEW_REJECTED',
            tenantId: reviewData.tenantId || null,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: reviewData.caseId || requestId, label: reviewData.candidateName || reviewData.caseId || requestId },
            related: { caseId: reviewData.caseId || null, seniorReviewRequestId: requestId },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: status === 'approved'
                ? `Revisao senior aprovada para ${reviewData.candidateName || reviewData.caseId || requestId}`
                : `Revisao senior rejeitada para ${reviewData.candidateName || reviewData.caseId || requestId}`,
            metadata: { resolution, status },
        });

        return { success: true, requestId, status };
    },
);

exports.getOpsV2Metrics = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const requestedTenantId = String(request.data?.tenantId || '').trim();
        const tenantId = profile.tenantId || requestedTenantId || null;
        const monthKey = String(request.data?.monthKey || formatMonthKey(new Date())).trim();
        if (!/^\d{4}-\d{2}$/.test(monthKey)) {
            throw new HttpsError('invalid-argument', 'monthKey deve estar no formato YYYY-MM.');
        }
        if (requestedTenantId && !canOperateTenant(profile, requestedTenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para ver metricas deste tenant.');
        }

        const usageQuery = tenantId
            ? db.collection('usageMeters').where('tenantId', '==', tenantId).where('monthKey', '==', monthKey).limit(500)
            : db.collection('usageMeters').where('monthKey', '==', monthKey).limit(500);
        const moduleRunQuery = tenantId
            ? db.collection('moduleRuns').where('tenantId', '==', tenantId).limit(500)
            : db.collection('moduleRuns').limit(500);
        const divergenceQuery = tenantId
            ? db.collection('providerDivergences').where('tenantId', '==', tenantId).limit(500)
            : db.collection('providerDivergences').limit(500);
        const decisionQuery = tenantId
            ? db.collection('decisions').where('tenantId', '==', tenantId).limit(500)
            : db.collection('decisions').limit(500);
        const seniorReviewQuery = tenantId
            ? db.collection('seniorReviewRequests').where('tenantId', '==', tenantId).where('status', '==', 'pending').limit(500)
            : db.collection('seniorReviewRequests').where('status', '==', 'pending').limit(500);

        const [usageSnap, moduleRunSnap, divergenceSnap, decisionSnap, seniorReviewSnap] = await Promise.all([
            usageQuery.get(),
            moduleRunQuery.get(),
            divergenceQuery.get(),
            decisionQuery.get(),
            seniorReviewQuery.get(),
        ]);

        const usageMeters = usageSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        const moduleRuns = moduleRunSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        const divergences = divergenceSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        const decisions = decisionSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
        const seniorReviewRequests = seniorReviewSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

        const moduleStatusCounts = moduleRuns.reduce((acc, run) => {
            const status = run.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        const openDivergences = divergences.filter((item) => item.status !== 'resolved');
        const seniorPending = seniorReviewRequests.length > 0
            ? seniorReviewRequests
            : decisions.filter((item) => item.reviewLevel === 'senior_approval' && item.requiresSenior === true);

        return {
            tenantId,
            monthKey,
            source: 'v2Collections',
            usage: summarizeUsageMeters(usageMeters),
            counts: {
                usageMeters: usageMeters.length,
                moduleRuns: moduleRuns.length,
                providerDivergences: divergences.length,
                openProviderDivergences: openDivergences.length,
                decisions: decisions.length,
                seniorPending: seniorPending.length,
                seniorReviewRequests: seniorReviewRequests.length,
            },
            moduleStatusCounts,
            seniorReviewSummary: summarizeSeniorReviewQueue(seniorPending),
            limitApplied: usageMeters.length >= 500 || moduleRuns.length >= 500 || divergences.length >= 500 || decisions.length >= 500 || seniorReviewRequests.length >= 500,
        };
    },
);

exports.saveCaseDraftByAnalyst = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const caseId = String(request.data?.caseId || '').trim();
        const payload = request.data?.payload || {};
        if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
        const caseData = caseDoc.data() || {};

        if (caseData.tenantId && caseData.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Sem permissao para operar neste caso.');
        }

        if (caseData.status === 'DONE') {
            throw new HttpsError('failed-precondition', 'Nao e possivel salvar rascunho em caso ja concluido.');
        }

        const updatePayload = pickDraftPayload(payload, caseData.reviewDraft || {});
        await caseRef.update(updatePayload);

        await writeAuditEvent({
            action: 'CASE_DRAFT_SAVED',
            tenantId: caseData.tenantId || null,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
            related: { caseId },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Rascunho salvo para ${caseData.candidateName || caseId}`,
        });

        return { success: true };
    },
);

exports.setAiDecisionByAnalyst = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getOpsUserProfile(uid);
        const caseId = String(request.data?.caseId || '').trim();
        const decision = String(request.data?.decision || '').trim();
        const allowedDecisions = new Set(['ACCEPTED', 'ADJUSTED', 'IGNORED']);

        if (!caseId || !allowedDecisions.has(decision)) {
            throw new HttpsError('invalid-argument', 'caseId e aiDecision validos sao obrigatorios.');
        }

        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
        const caseData = caseDoc.data() || {};
        if (caseData.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Acesso negado ao caso.');
        }

        await caseRef.update({
            aiDecision: decision,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await writeAuditEvent({
            action: 'AI_DECISION_SET',
            tenantId: caseData.tenantId || null,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
            related: { caseId },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Decisao IA atualizada para ${decision} em ${caseData.candidateName || caseId}`,
            templateVars: { decision },
        });

        return { success: true };
    },
);

/* =========================================================
   RE-RUN AI ANALYSIS â€” Callable function for analysts
   Rate limited: max 3 runs per case, min 1 min between runs.
   ========================================================= */

const OPS_ROLES = new Set(['analyst', 'senior_analyst', 'supervisor', 'admin']);
const CLIENT_REQUESTER_ROLES = new Set(['CLIENT', 'client_operator', 'client_manager']);
const CLIENT_VIEW_ROLES = new Set(['CLIENT', 'client_viewer', 'client_operator', 'client_manager']);
const CLIENT_MANAGEABLE_ROLES = new Set(['client_viewer', 'client_operator', 'client_manager']);

async function getOpsUserProfile(uid) {
    const profileDoc = await db.collection('userProfiles').doc(uid).get();
    if (!profileDoc.exists || !OPS_ROLES.has(profileDoc.data().role)) {
        throw new HttpsError('permission-denied', 'Apenas analistas podem re-executar fases do pipeline.');
    }
    return profileDoc.data();
}

function canOperateTenant(profile = {}, tenantId = null) {
    if (!tenantId) return false;
    return (profile.role === 'admin' && !profile.tenantId) || profile.tenantId === tenantId;
}

async function getClientUserProfile(uid, { requireRequester = false } = {}) {
    const profileDoc = await db.collection('userProfiles').doc(uid).get();
    if (!profileDoc.exists) {
        throw new HttpsError('permission-denied', 'Perfil do cliente nao encontrado.');
    }

    const profile = profileDoc.data() || {};
    const allowedRoles = requireRequester ? CLIENT_REQUESTER_ROLES : CLIENT_VIEW_ROLES;
    if (!allowedRoles.has(profile.role)) {
        throw new HttpsError('permission-denied', 'Perfil do cliente sem permissao para esta operacao.');
    }
    if (!profile.tenantId) {
        throw new HttpsError('failed-precondition', 'Cliente sem tenantId associado.');
    }
    if (profile.status === 'inactive') {
        throw new HttpsError('permission-denied', 'Conta desativada. Contate o gestor da franquia.');
    }
    return profile;
}

function sanitizeCpf(cpf) {
    return String(cpf || '').replace(/\D/g, '').slice(0, 11);
}

function maskCpf(cpf) {
    const digits = sanitizeCpf(cpf);
    if (digits.length !== 11) return '';
    return `***.***.***-${digits.slice(9)}`;
}

function normalizeTenantSlug(value = '') {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

function formatRequestedBy(profile, uid) {
    return profile.email || profile.displayName || uid;
}

function sanitizePublicReportHtml(html) {
    return String(html || '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
        .replace(/<button\s+class="print-btn"[^>]*>[\s\S]*?<\/button>/gi, '')
        .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\s(href|src)=("|')\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
}

function getClientIp(request) {
    const forwarded = request?.rawRequest?.headers?.['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
    return request?.rawRequest?.ip || null;
}

function sanitizePublicReportMeta(meta = {}) {
    return {
        type: ['single', 'batch'].includes(meta.type) ? meta.type : 'single',
        candidateName: String(meta.candidateName || '').trim().slice(0, 160),
    };
}

async function buildCanonicalReportHtml(caseId, caseData, sanitizedPayload = null) {
    // Use provided payload if available, otherwise read from Firestore
    let publicResultData;
    if (sanitizedPayload) {
        publicResultData = sanitizedPayload;
    } else {
        const prRef = db.collection('cases').doc(caseId).collection('publicResult').doc('latest');
        const prSnap = await prRef.get();
        publicResultData = prSnap.exists ? prSnap.data() : {};
    }

    // Enrich with candidate data (department, email, phone, socialProfiles)
    let candidateData = {};
    if (caseData.candidateId) {
        const candRef = db.collection('candidates').doc(caseData.candidateId);
        const candSnap = await candRef.get();
        if (candSnap.exists) candidateData = candSnap.data() || {};
    }

    // Build timeline events from case milestones
    let timelineEvents = caseData.timelineEvents;
    if (!Array.isArray(timelineEvents) || timelineEvents.length === 0) {
        timelineEvents = [
            caseData.createdAt && { type: 'created', status: 'done', title: 'Solicitacao enviada', at: typeof caseData.createdAt === 'string' ? caseData.createdAt : '' },
            caseData.analysisStartedAt && { type: 'analysis_started', status: 'done', title: 'Processamento iniciado', at: typeof caseData.analysisStartedAt === 'string' ? caseData.analysisStartedAt : '' },
            caseData.concludedAt && { type: 'concluded', status: 'done', title: 'Analise concluida', at: typeof caseData.concludedAt === 'string' ? caseData.concludedAt : '' },
        ].filter(Boolean);
    }

    // Compute sourceSummary from enrichment sources if not already set
    let sourceSummary = caseData.sourceSummary;
    if (!sourceSummary) {
        const sources = Object.entries(caseData.enrichmentSources || {})
            .map(([phase, sourceData]) => sourceData?.source ? `${phase}: ${sourceData.source}` : null)
            .filter(Boolean);
        sourceSummary = sources.length > 0 ? sources.join(' | ') : 'Fontes automatizadas e revisao analitica.';
    }

    const reportData = {
        ...candidateData,
        ...caseData,
        ...publicResultData,
        id: caseId,
        tenantName: caseData.tenantName || '',
        timelineEvents,
        sourceSummary,
        statusSummary: caseData.statusSummary || 'Analise concluida e pronta para consulta e compartilhamento.',
    };
    const { buildCaseReportHtml } = require('./reportBuilder.js');
    const rawHtml = buildCaseReportHtml(reportData);
    const html = sanitizePublicReportHtml(rawHtml);
    if (!html.trim()) {
        throw new HttpsError('internal', 'Falha ao gerar HTML do relatorio.');
    }
    return html;
}

async function enforceTenantSubmissionLimits(tenantId, settings, { actor, ip } = {}) {
    const now = new Date();
    const dayKey = formatDateKey(now);
    const monthKey = formatMonthKey(now);
    if (settings?.dailyLimit == null && settings?.monthlyLimit == null) return { dailyCount: 0, monthlyCount: 0, exceeded: false };

    const usageRef = db.collection('tenantUsage').doc(tenantId);

    const result = await db.runTransaction(async (tx) => {
        const usageSnap = await tx.get(usageRef);
        const usage = usageSnap.exists ? usageSnap.data() : {};

        // Lazy reset: if keys don't match current period, reset counters
        let dailyCount = (usage.dayKey === dayKey) ? (usage.dailyCount || 0) : 0;
        let monthlyCount = (usage.monthKey === monthKey) ? (usage.monthlyCount || 0) : 0;

        const dailyLimit = settings.dailyLimit ?? null;
        const monthlyLimit = settings.monthlyLimit ?? null;
        const allowDailyExceedance = settings.allowDailyExceedance !== false; // default true
        const allowMonthlyExceedance = settings.allowMonthlyExceedance === true; // default false

        let exceeded = false;
        let blockedReason = null;

        // Check daily limit
        if (dailyLimit && dailyCount >= dailyLimit) {
            if (!allowDailyExceedance) {
                blockedReason = 'daily';
            } else {
                exceeded = true;
            }
        }

        // Check monthly limit
        if (!blockedReason && monthlyLimit && monthlyCount >= monthlyLimit) {
            if (!allowMonthlyExceedance) {
                blockedReason = 'monthly';
            } else {
                exceeded = true;
            }
        }

        if (blockedReason) {
            return { blocked: true, blockedReason, dailyCount, monthlyCount, dailyLimit, monthlyLimit };
        }

        // Increment counters atomically
        dailyCount += 1;
        monthlyCount += 1;

        tx.set(usageRef, {
            tenantId,
            dayKey,
            monthKey,
            dailyCount,
            monthlyCount,
            lastSubmissionAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        }, { merge: false });

        return { blocked: false, exceeded, dailyCount, monthlyCount, dailyLimit, monthlyLimit };
    });

    // Emit audit events outside transaction
    if (result.blocked) {
        const action = result.blockedReason === 'daily' ? 'SUBMISSION_BLOCKED_DAILY' : 'SUBMISSION_BLOCKED_MONTHLY';
        const limit = result.blockedReason === 'daily' ? result.dailyLimit : result.monthlyLimit;
        if (actor) {
            await writeAuditEvent({
                action,
                tenantId,
                actor,
                entity: { type: 'TENANT', id: tenantId, label: tenantId },
                source: SOURCE.PORTAL_CLIENT,
                ip: ip || null,
                detail: result.blockedReason === 'daily'
                    ? `Submissao bloqueada â€” limite diario de ${limit} consultas atingido`
                    : `Submissao bloqueada â€” limite mensal de ${limit} consultas atingido`,
                templateVars: result.blockedReason === 'daily'
                    ? { dailyLimit: limit }
                    : { monthlyLimit: limit },
            });
        }
        const msg = result.blockedReason === 'daily'
            ? `Limite diario de ${limit} consultas atingido. Tente novamente amanha.`
            : `Limite mensal de ${limit} consultas atingido. Entre em contato com o administrador.`;
        throw new HttpsError('resource-exhausted', msg);
    }

    if (result.exceeded) {
        const isDailyExceeded = result.dailyLimit && result.dailyCount > result.dailyLimit;
        const isMonthlyExceeded = result.monthlyLimit && result.monthlyCount > result.monthlyLimit;
        if (isDailyExceeded && actor) {
            await writeAuditEvent({
                action: 'DAILY_LIMIT_EXCEEDED',
                tenantId,
                actor,
                entity: { type: 'TENANT', id: tenantId, label: tenantId },
                source: SOURCE.PORTAL_CLIENT,
                ip: ip || null,
                detail: `Limite diario excedido (${result.dailyCount}/${result.dailyLimit}) â€” consulta registrada como excedente do dia`,
                templateVars: { dailyCount: result.dailyCount, dailyLimit: result.dailyLimit },
            });
        }
        if (isMonthlyExceeded && actor) {
            await writeAuditEvent({
                action: 'MONTHLY_LIMIT_EXCEEDED',
                tenantId,
                actor,
                entity: { type: 'TENANT', id: tenantId, label: tenantId },
                source: SOURCE.PORTAL_CLIENT,
                ip: ip || null,
                detail: `Limite mensal excedido (${result.monthlyCount}/${result.monthlyLimit}) â€” consulta faturavel no proximo ciclo`,
                templateVars: { monthlyCount: result.monthlyCount, monthlyLimit: result.monthlyLimit },
            });
        }
    }

    return { dailyCount: result.dailyCount, monthlyCount: result.monthlyCount, exceeded: result.exceeded };
}

async function rerunAiForCase(caseRef, caseId, caseData, uid, profile, request = null) {
    const aiRunCount = caseData.aiRunCount || 0;
    if (aiRunCount >= 3) {
        throw new HttpsError('resource-exhausted', 'Limite de 3 execucoes de IA por caso atingido.');
    }

    const lastRun = caseData.aiExecutedAt?.toMillis?.() || 0;
    if (Date.now() - lastRun < 60000) {
        throw new HttpsError('resource-exhausted', 'Aguarde 1 minuto entre execucoes de IA.');
    }

    if (!isDoneOrPartial(caseData.juditEnrichmentStatus) && !isDoneOrPartial(caseData.enrichmentStatus)) {
        throw new HttpsError('failed-precondition', 'Enriquecimento (Judit ou FonteData) nao concluido.');
    }

    const aiKey = openaiApiKey.value();
    if (!aiKey) throw new HttpsError('internal', 'Chave OpenAI nao configurada.');

    const caseDataForAi = { ...caseData, _caseId: caseId };
    const homonymInput = buildHomonymAnalysisInput(caseDataForAi);
    const updatePayload = homonymInput.needsAnalysis
        ? {
            aiHomonymTriggered: true,
            aiHomonymContextVersion: AI_HOMONYM_CONTEXT_VERSION,
            aiHomonymAmbiguityReasons: homonymInput.ambiguityReasons,
            aiHomonymHardFacts: homonymInput.hardFacts,
        }
        : buildAiHomonymResetPayload(homonymInput);

    let homonymResult = null;
    if (homonymInput.needsAnalysis) {
        homonymResult = await runAiHomonymAnalysis(caseDataForAi, homonymInput, aiKey, { skipCache: true });
        Object.assign(updatePayload, buildAiHomonymUpdatePayload(caseDataForAi, homonymInput, homonymResult));
        Object.assign(caseDataForAi, {
            aiHomonymTriggered: true,
            aiHomonymStructured: homonymResult.structured || null,
            aiHomonymStructuredOk: homonymResult.structuredOk || false,
            aiHomonymDecision: homonymResult.structured?.decision || null,
            aiHomonymConfidence: homonymResult.structured?.confidence || null,
            aiHomonymRisk: homonymResult.structured?.homonymRisk || null,
            aiHomonymRecommendedAction: homonymResult.structured?.recommendedAction || null,
        });
    }

    const aiResult = await runAiAnalysis(caseDataForAi, aiKey, { skipCache: true });
    Object.assign(updatePayload, buildAiUpdatePayload(caseDataForAi, aiResult, { aiRunCount: aiRunCount + 1 }));
    Object.assign(caseDataForAi, {
        aiStructured: aiResult.structured || null,
        aiStructuredOk: aiResult.structuredOk || false,
    });
    // P08: Only run prefill if AI general analysis succeeded
    if (aiResult.structuredOk && !aiResult.error) {
        const prefillResult = await runAiPrefillAnalysis(caseDataForAi, aiKey, { skipCache: true });
        Object.assign(updatePayload, buildAiPrefillUpdatePayload(prefillResult));
    } else {
        console.log(`Case ${caseId} [AI_PREFILL rerun]: Skipped â€” AI general analysis failed.`);
        updatePayload.prefillNarratives = {
            metadata: {
                model: AI_MODEL,
                promptVersion: AI_PREFILL_PROMPT_VERSION,
                executedAt: new Date().toISOString(),
                ok: false,
                fromCache: false,
                error: 'Skipped: AI general analysis failed.',
            },
        };
    }

    let finalPrefillResult = null;

    // Deterministic prefill: generate rich content for all narrative fields (v5)
    try {
        const detPrefill = buildDeterministicPrefill(caseDataForAi);
        updatePayload.deterministicPrefill = detPrefill;
        console.log(`Case ${caseId} [DET_PREFILL rerun]: OK (complex=${detPrefill.metadata.isComplex}, triggers=${detPrefill.metadata.triggersActive.length}, keyFindings=${detPrefill.keyFindings.length})`);

        const currentPrefill = updatePayload.prefillNarratives || {};
        const aiOk = currentPrefill.metadata?.ok === true;
        const sanitized = sanitizeAiPrefillStructured({
            criminalNotes: detPrefill.criminalNotes,
            laborNotes: detPrefill.laborNotes,
            warrantNotes: detPrefill.warrantNotes,
            keyFindings: detPrefill.keyFindings,
            executiveSummary: detPrefill.executiveSummary,
            finalJustification: detPrefill.finalJustification,
        });
        const mergedPrefill = {
            ...sanitized,
            metadata: {
                ...(currentPrefill.metadata || {}),
                source: 'deterministic',
                deterministicVersion: detPrefill.metadata.version,
                mergedAt: new Date().toISOString(),
            },
        };
        updatePayload.prefillNarratives = mergedPrefill;
        finalPrefillResult = {
            structured: mergedPrefill,
            structuredOk: true,
            error: null,
        };
        console.log(`Case ${caseId} [PREFILL_MERGE rerun]: source=${mergedPrefill.metadata.source}, aiOk=${aiOk}`);
    } catch (detErr) {
        console.error(`Case ${caseId} [DET_PREFILL rerun]: error:`, detErr.message);
        updatePayload.deterministicPrefill = {
            metadata: {
                source: 'deterministic',
                version: 'v5-deterministic-prefill',
                generatedAt: new Date().toISOString(),
                error: detErr.message,
                triggersActive: [],
                isComplex: false,
            },
        };
        finalPrefillResult = {
            structured: updatePayload.prefillNarratives || null,
            structuredOk: false,
            error: detErr.message,
        };
    }

    await caseRef.update(updatePayload);

    // Rematerialize V2 artifacts so that evidenceItems, riskSignals, moduleRuns,
    // timelineEvents and providerDivergences reflect the latest AI output.
    try {
        const freshDoc = await caseRef.get();
        const freshData = freshDoc.data() || {};
        await materializeModuleRunsForCase(caseId, freshData);
        console.log(`Case ${caseId} [AI_RERUN]: V2 artifacts rematerialized.`);
    } catch (matErr) {
        console.error(`Case ${caseId} [AI_RERUN]: V2 artifact rematerialization failed:`, matErr.message);
    }

    await writeAuditEvent({
        action: 'AI_RERUN',
        tenantId: caseData.tenantId,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
        related: { caseId },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        metadata: {
            model: aiResult.model,
            cost: updatePayload.aiCostUsd,
            structuredOk: aiResult.structuredOk,
            runNumber: aiRunCount + 1,
            error: aiResult.error || null,
            prefillOk: finalPrefillResult?.structuredOk || false,
            prefillError: finalPrefillResult?.error || null,
            homonymDecision: updatePayload.aiHomonymDecision || null,
            homonymConfidence: updatePayload.aiHomonymConfidence || null,
            homonymError: updatePayload.aiHomonymError || null,
            deterministicVersion: updatePayload.deterministicPrefill?.metadata?.version || null,
        },
        templateVars: { candidateName: caseData.candidateName || caseId },
    });

    return {
        success: !aiResult.error,
        phase: 'ai',
        status: aiResult.error ? 'FAILED' : 'DONE',
        structured: aiResult.structured || null,
        structuredOk: aiResult.structuredOk || false,
        prefillNarratives: finalPrefillResult?.structured || null,
        prefillNarrativesOk: finalPrefillResult?.structuredOk || false,
        homonymStructured: homonymResult?.structured || null,
        homonymStructuredOk: homonymResult?.structuredOk || false,
        error: aiResult.error || null,
    };
}

exports.rerunAiAnalysis = onCall(
    { region: 'southamerica-east1', secrets: [openaiApiKey] },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const { caseId } = request.data || {};
        if (!caseId || typeof caseId !== 'string') {
            throw new HttpsError('invalid-argument', 'caseId obrigatorio.');
        }

        const profile = await getOpsUserProfile(uid);

        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');

        return rerunAiForCase(caseRef, caseId, caseDoc.data() || {}, uid, profile, request);
    },
);

exports.rerunEnrichmentPhase = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 540, secrets: [fontedataApiKey, openaiApiKey, escavadorApiToken, juditApiKey, bigdatacorpAccessToken, bigdatacorpTokenId] },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const { caseId, phase } = request.data || {};
        if (!caseId || typeof caseId !== 'string') {
            throw new HttpsError('invalid-argument', 'caseId obrigatorio.');
        }
        if (!['fontedata', 'escavador', 'judit', 'bigdatacorp', 'djen', 'ai'].includes(phase)) {
            throw new HttpsError('invalid-argument', 'Fase invalida para rerun.');
        }

        const profile = await getOpsUserProfile(uid);
        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');

        const caseData = caseDoc.data() || {};
        if (caseData.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Acesso negado ao caso.');
        }
        if (phase === 'ai') {
            return rerunAiForCase(caseRef, caseId, caseData, uid, profile, request);
        }

        if (caseData.status === 'DONE' || caseData.status === 'CORRECTION_NEEDED') {
            throw new HttpsError('failed-precondition', 'Nao e permitido reexecutar enriquecimento em casos concluidos ou devolvidos.');
        }

        const phaseMeta = {
            fontedata: { statusField: 'enrichmentStatus', errorField: 'enrichmentError', label: 'FonteData' },
            escavador: { statusField: 'escavadorEnrichmentStatus', errorField: 'escavadorError', label: 'Escavador' },
            judit: { statusField: 'juditEnrichmentStatus', errorField: 'juditError', label: 'Judit' },
            bigdatacorp: { statusField: 'bigdatacorpEnrichmentStatus', errorField: 'bigdatacorpError', label: 'BigDataCorp' },
            djen: { statusField: 'djenEnrichmentStatus', errorField: 'djenError', label: 'DJEN' },
        };
        const meta = phaseMeta[phase];
        const beforeStatus = caseData[meta.statusField] || 'PENDING';

        if (beforeStatus === 'RUNNING') {
            throw new HttpsError('failed-precondition', `${meta.label} ja esta em execucao.`);
        }
        if (phase === 'fontedata' && beforeStatus === 'BLOCKED') {
            throw new HttpsError('failed-precondition', 'FonteData bloqueou o caso no gate de identidade. Corrija os dados antes de tentar novamente.');
        }
        if (!['FAILED', 'PARTIAL'].includes(beforeStatus)) {
            throw new HttpsError('failed-precondition', `${meta.label} so pode ser reexecutado quando estiver em falha parcial ou total.`);
        }
        // Escavador requires Judit to be done
        if (phase === 'escavador' && !isDoneOrPartial(caseData.juditEnrichmentStatus)) {
            throw new HttpsError('failed-precondition', 'Judit precisa estar concluido antes do rerun do Escavador.');
        }

        if (!caseData.tenantId) {
            throw new HttpsError('failed-precondition', 'Caso sem tenantId.');
        }

        if (phase === 'fontedata') {
            const enrichmentConfig = await loadFonteDataConfig(caseData.tenantId);
            if (!enrichmentConfig.enabled) {
                throw new HttpsError('failed-precondition', 'FonteData desabilitado para este tenant.');
            }

            await runFonteDataEnrichmentPhase(caseRef, caseId, caseData, enrichmentConfig);

            // FonteData rerun does NOT cascade to Judit/Escavador anymore.
            // Run auto-classify to incorporate any new FonteData data.
            try {
                const freshData = (await caseRef.get()).data() || {};
                if (isDoneOrPartial(freshData.enrichmentStatus)) {
                    await runAutoClassifyAndAi(caseRef, caseId, freshData);
                }
            } catch (classifyErr) {
                console.error(`Case ${caseId} [AutoClassify via FonteData rerun]: error:`, classifyErr.message);
            }
        }

        if (phase === 'escavador') {
            const escavadorConfig = await loadEscavadorConfig(caseData.tenantId);
            if (!escavadorConfig.enabled) {
                throw new HttpsError('failed-precondition', 'Escavador desabilitado para este tenant.');
            }
            await runEscavadorEnrichmentPhase(caseRef, caseId, caseData, escavadorConfig);
        }

        if (phase === 'judit') {
            const juditConfig = await loadJuditConfig(caseData.tenantId);
            if (!juditConfig.enabled) {
                throw new HttpsError('failed-precondition', 'Judit desabilitado para este tenant.');
            }
            // On rerun, skip gate if it already passed
            const skipGate = caseData.juditGateResult?.passed === true;
            await runJuditEnrichmentPhase(caseRef, caseId, caseData, juditConfig, { skipGate });
        }

        if (phase === 'bigdatacorp') {
            const bdcConfig = await loadBigDataCorpConfig(caseData.tenantId);
            if (!bdcConfig.enabled) {
                throw new HttpsError('failed-precondition', 'BigDataCorp desabilitado para este tenant.');
            }
            await runBigDataCorpEnrichmentPhase(caseRef, caseId, caseData, bdcConfig);
        }

        if (phase === 'djen') {
            const djenConfig = await loadDjenConfig(caseData.tenantId);
            if (!djenConfig.enabled) {
                throw new HttpsError('failed-precondition', 'DJEN desabilitado para este tenant.');
            }
            await runDjenEnrichmentPhase(caseRef, caseId, caseData, djenConfig);
        }

        const refreshedDoc = await caseRef.get();
        const refreshedData = refreshedDoc.data() || {};
        const afterStatus = refreshedData[meta.statusField] || beforeStatus;
        const afterError = refreshedData[meta.errorField] || null;

        // Rematerialize V2 artifacts so that evidenceItems, providerRecords,
        // riskSignals, timelineEvents and providerDivergences reflect the latest enrichment.
        try {
            await materializeModuleRunsForCase(caseId, refreshedData);
            console.log(`Case ${caseId} [ENRICHMENT_PHASE_RERUN]: V2 artifacts rematerialized.`);
        } catch (matErr) {
            console.error(`Case ${caseId} [ENRICHMENT_PHASE_RERUN]: V2 artifact rematerialization failed:`, matErr.message);
        }

        await writeAuditEvent({
            action: 'ENRICHMENT_PHASE_RERUN',
            tenantId: refreshedData.tenantId,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
            related: { caseId },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            metadata: { phase, beforeStatus, afterStatus, error: afterError },
            templateVars: { candidateName: caseData.candidateName || caseId, phase },
        });

        return {
            success: afterStatus === 'DONE' || afterStatus === 'PARTIAL',
            phase,
            status: afterStatus,
            error: afterError,
        };
    },
);

/* =========================================================
   JUDIT WEBHOOK HANDLER â€” Receives async results from Judit
   Instead of polling, Judit sends results to this endpoint.
   Judit docs: event_type is always "response_created".
   Completion: payload.response_type === "application_info" + response_data.code === 600
   Error: payload.response_type === "application_error"

   To use webhooks:
   1. Configure the webhook URL in Judit dashboard pointing to this function.
   2. Set juditConfig.filters.useWebhook = true in tenant settings.
   3. Each async request will store a mapping in juditWebhookRequests/{requestId}.
   ========================================================= */

exports.juditWebhook = onRequest(
    { region: 'southamerica-east1', cors: false, secrets: [juditApiKey, openaiApiKey] },
    async (req, res) => {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        const payload = req.body;
        // Judit docs: top-level has reference_id; inner payload has request_id
        const requestId = payload?.reference_id || payload?.payload?.request_id;
        if (!requestId) {
            res.status(400).send('Missing request_id');
            return;
        }

        const eventType = payload.event_type;
        const innerPayload = payload.payload || {};

        // Look up the case linked to this Judit request_id via mapping collection
        const mappingDoc = await db.collection('juditWebhookRequests').doc(requestId).get();
        if (!mappingDoc.exists) {
            console.log(`[Judit Webhook]: request_id ${requestId} not linked to any case. Ignoring.`);
            res.status(200).json({ ok: true, ignored: true });
            return;
        }

        const { caseId, phaseType } = mappingDoc.data();
        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) {
            console.log(`[Judit Webhook]: case ${caseId} not found. Cleaning up.`);
            await mappingDoc.ref.delete();
            res.status(200).json({ ok: true, ignored: true });
            return;
        }

        console.log(`[Judit Webhook]: event=${eventType || 'unknown'} type=${innerPayload.response_type || 'unknown'} for case=${caseId}, phase=${phaseType}, request=${requestId}`);

        // Respond immediately to avoid Judit callback timeout
        res.status(200).json({ ok: true, case_id: caseId, event: eventType });

        // Acquire atomic lock via transaction to prevent race with juditAsyncFallback.
        // If the mapping doc was already claimed (processedBy set), skip processing.
        let lockAcquired = false;
        try {
            lockAcquired = await db.runTransaction(async (tx) => {
                const freshMapping = await tx.get(mappingDoc.ref);
                if (!freshMapping.exists || freshMapping.data().processedBy) {
                    return false; // Already processed or deleted by fallback
                }
                tx.update(mappingDoc.ref, { processedBy: 'webhook', processedAt: FieldValue.serverTimestamp() });
                return true;
            });
        } catch (lockErr) {
            console.warn(`[Judit Webhook]: lock contention for request ${requestId}: ${lockErr.message}`);
        }

        if (!lockAcquired) {
            console.log(`[Judit Webhook]: request ${requestId} already processed by fallback. Skipping.`);
            return;
        }

        // Judit docs: event_type is always "response_created".
        // Completion = payload.response_type "application_info" + response_data.code 600
        // Error = payload.response_type "application_error"
        const isCompleted = innerPayload.response_type === 'application_info'
            && innerPayload.response_data?.code === 600;
        const isError = innerPayload.response_type === 'application_error';

        if (isCompleted) {
            try {
                const apiKey = juditApiKey.value();
                const items = await fetchResponses(requestId, apiKey);
                const currentCaseData = caseDoc.data() || {};
                const cpf = (currentCaseData.cpf || '').replace(/\D/g, '');

                let normalized;
                if (phaseType === 'warrant') {
                    normalized = normalizeJuditWarrants(items);
                } else if (phaseType === 'execution') {
                    normalized = normalizeJuditExecution(items);
                } else {
                    normalized = normalizeJuditLawsuits({ responseData: items, hasLawsuits: items.length > 0 }, cpf);
                }

                const { _source, ...fields } = normalized;
                const updateFields = {};
                for (const [key, value] of Object.entries(fields)) {
                    if (value !== undefined && value !== null) {
                        updateFields[key] = value;
                    }
                }

                const currentPendingPhases = Array.isArray(currentCaseData.juditPendingAsyncPhases)
                    ? currentCaseData.juditPendingAsyncPhases
                    : [];
                const remainingPendingPhases = currentPendingPhases.filter((phase) => phase !== phaseType);

                updateFields[`juditSources.${phaseType}`] = _source;
                updateFields[`juditRawPayloads.${phaseType}.responseCount`] = items.length;
                updateFields[`juditRawPayloads.${phaseType}.webhookCompletedAt`] = new Date().toISOString();
                updateFields.juditPendingAsyncPhases = remainingPendingPhases.length > 0
                    ? remainingPendingPhases
                    : FieldValue.delete();
                updateFields.juditPendingAsyncCount = remainingPendingPhases.length > 0
                    ? remainingPendingPhases.length
                    : FieldValue.delete();
                updateFields.updatedAt = FieldValue.serverTimestamp();

                if (remainingPendingPhases.length === 0) {
                    const juditConfig = await loadJuditConfig(currentCaseData.tenantId);
                    const mergedCaseData = { ...currentCaseData, ...fields, juditPendingAsyncPhases: [] };
                    updateFields.juditNeedsEscavador = evaluateEscavadorNeed(mergedCaseData, juditConfig);
                    updateFields.juditEnrichmentStatus = currentCaseData.juditError ? 'PARTIAL' : 'DONE';
                    updateFields.juditEnrichedAt = FieldValue.serverTimestamp();
                }

                await caseRef.update(updateFields);

                // Clean up the mapping
                await mappingDoc.ref.delete();

                console.log(`[Judit Webhook]: case ${caseId} updated with ${items.length} ${phaseType} result(s).`);

                if (remainingPendingPhases.length === 0 && currentCaseData.status !== 'DONE' && currentCaseData.status !== 'CORRECTION_NEEDED') {
                    try {
                        const freshDoc = await caseRef.get();
                        const freshData = freshDoc.data() || {};

                        if (freshData.juditNeedsEscavador && (freshData.escavadorEnrichmentStatus === 'RUNNING' || freshData.escavadorEnrichmentStatus === 'PENDING' || freshData.escavadorEnrichmentStatus === 'SKIPPED' || !freshData.escavadorEnrichmentStatus)) {
                            console.log(`[Judit Webhook]: auto-classify skipped for case ${caseId} because Escavador is still pending.`);
                        } else {
                            await runAutoClassifyAndAi(caseRef, caseId, freshData);
                        }
                    } catch (classifyErr) {
                        console.error(`[Judit Webhook]: auto-classify error for case ${caseId}:`, classifyErr.message);
                    }
                }
            } catch (err) {
                console.error(`[Judit Webhook]: error processing completed for case ${caseId}:`, err.message);
            }
        } else if (isError) {
            try {
                const errorCode = innerPayload.response_data?.code;
                const errorMessage = innerPayload.response_data?.message || 'Unknown error';
                console.error(`[Judit Webhook]: application_error for case=${caseId}, phase=${phaseType}: code=${errorCode}, msg=${errorMessage}`);

                const currentCaseData = caseDoc.data() || {};
                const currentPendingPhases = Array.isArray(currentCaseData.juditPendingAsyncPhases)
                    ? currentCaseData.juditPendingAsyncPhases
                    : [];
                const remainingPendingPhases = currentPendingPhases.filter((phase) => phase !== phaseType);

                const updateFields = {
                    juditError: `${phaseType}: ${errorMessage} (code ${errorCode})`,
                    juditPendingAsyncPhases: remainingPendingPhases.length > 0
                        ? remainingPendingPhases
                        : FieldValue.delete(),
                    juditPendingAsyncCount: remainingPendingPhases.length > 0
                        ? remainingPendingPhases.length
                        : FieldValue.delete(),
                    updatedAt: FieldValue.serverTimestamp(),
                };

                if (remainingPendingPhases.length === 0) {
                    updateFields.juditEnrichmentStatus = 'PARTIAL';
                    updateFields.juditEnrichedAt = FieldValue.serverTimestamp();
                }

                await caseRef.update(updateFields);
                await mappingDoc.ref.delete();
                console.log(`[Judit Webhook]: case ${caseId} marked error for phase ${phaseType}.`);
            } catch (err) {
                console.error(`[Judit Webhook]: error handling application_error for case ${caseId}:`, err.message);
            }
        } else {
            console.log(`[Judit Webhook]: incremental event for case=${caseId}, response_type=${innerPayload.response_type || 'unknown'}. Waiting for completion.`);
        }
    },
);

/* =========================================================
   JUDIT ASYNC FALLBACK â€” Polls stale webhook-pending phases
   Runs every 10 minutes. If a case has been waiting for a webhook
   callback for more than 10 minutes, falls back to direct polling.
   ========================================================= */

const JUDIT_WEBHOOK_STALE_MS = 10 * 60 * 1000; // 10 minutes

exports.juditAsyncFallback = onSchedule(
    { schedule: 'every 10 minutes', region: 'southamerica-east1', timeoutSeconds: 300, secrets: [juditApiKey, openaiApiKey] },
    async () => {
        const staleBefore = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS);
        const snapshot = await db.collection('juditWebhookRequests')
            .where('createdAt', '<=', staleBefore)
            .limit(20)
            .get();

        if (snapshot.empty) {
            console.log('[Judit Fallback]: no stale webhook requests.');
            return;
        }

        const apiKey = juditApiKey.value();
        if (!apiKey) {
            console.error('[Judit Fallback]: JUDIT_API_KEY not configured.');
            return;
        }

        console.log(`[Judit Fallback]: found ${snapshot.size} stale webhook request(s). Processing...`);

        for (const mappingDoc of snapshot.docs) {
            const { caseId, phaseType, tenantId } = mappingDoc.data();
            const requestId = mappingDoc.id;

            // Skip if already processed by webhook (atomic lock check)
            if (mappingDoc.data().processedBy) {
                console.log(`[Judit Fallback]: request ${requestId} already processed by ${mappingDoc.data().processedBy}. Cleaning mapping.`);
                await mappingDoc.ref.delete();
                continue;
            }

            // Acquire atomic lock via transaction to prevent race with webhook handler
            let lockAcquired = false;
            try {
                lockAcquired = await db.runTransaction(async (tx) => {
                    const freshMapping = await tx.get(mappingDoc.ref);
                    if (!freshMapping.exists || freshMapping.data().processedBy) {
                        return false;
                    }
                    tx.update(mappingDoc.ref, { processedBy: 'fallback', processedAt: FieldValue.serverTimestamp() });
                    return true;
                });
            } catch (lockErr) {
                console.warn(`[Judit Fallback]: lock contention for request ${requestId}: ${lockErr.message}`);
                continue;
            }

            if (!lockAcquired) {
                console.log(`[Judit Fallback]: request ${requestId} already claimed. Skipping.`);
                continue;
            }

            try {
                const caseRef = db.collection('cases').doc(caseId);
                const caseDoc = await caseRef.get();
                if (!caseDoc.exists) {
                    console.log(`[Judit Fallback]: case ${caseId} not found. Cleaning mapping.`);
                    await mappingDoc.ref.delete();
                    continue;
                }

                const currentCaseData = caseDoc.data() || {};
                const pendingPhases = Array.isArray(currentCaseData.juditPendingAsyncPhases)
                    ? currentCaseData.juditPendingAsyncPhases
                    : [];

                if (!pendingPhases.includes(phaseType)) {
                    console.log(`[Judit Fallback]: phase ${phaseType} for case ${caseId} already resolved. Cleaning mapping.`);
                    await mappingDoc.ref.delete();
                    continue;
                }

                // Check if the Judit request has actually completed before fetching responses
                let requestStatus;
                try {
                    requestStatus = await checkRequestStatus(requestId, apiKey);
                } catch (statusErr) {
                    console.warn(`[Judit Fallback]: could not check request status for ${requestId}: ${statusErr.message}`);
                    requestStatus = 'unknown';
                }

                const createdAt = mappingDoc.data().createdAt?.toDate?.() || new Date(0);
                const ageMs = Date.now() - createdAt.getTime();

                if (requestStatus === 'pending' || requestStatus === 'unknown') {
                    if (ageMs > 30 * 60 * 1000) {
                        // Hard timeout â€” request never completed after 30 min
                        const failUpdate = {};
                        const remaining = pendingPhases.filter((p) => p !== phaseType);
                        failUpdate[`juditSources.${phaseType}.error`] = 'Timeout: request Judit ainda pendente apos 30min.';
                        failUpdate[`juditSources.${phaseType}.status`] = 'TIMEOUT';
                        failUpdate.juditPendingAsyncPhases = remaining.length > 0 ? remaining : FieldValue.delete();
                        failUpdate.juditPendingAsyncCount = remaining.length > 0 ? remaining.length : FieldValue.delete();
                        if (remaining.length === 0) {
                            failUpdate.juditEnrichmentStatus = 'PARTIAL';
                            failUpdate.juditError = `Timeout na fase ${phaseType}: request Judit nao completou.`;
                        }
                        failUpdate.updatedAt = FieldValue.serverTimestamp();
                        await caseRef.update(failUpdate);
                        await mappingDoc.ref.delete();
                        console.log(`[Judit Fallback]: marked phase ${phaseType} as TIMEOUT for case ${caseId} (request still ${requestStatus} after ${Math.round(ageMs / 60000)}min).`);

                        if (remaining.length === 0 && currentCaseData.status !== 'DONE' && currentCaseData.status !== 'CORRECTION_NEEDED') {
                            try {
                                const freshDoc = await caseRef.get();
                                await runAutoClassifyAndAi(caseRef, caseId, freshDoc.data() || {});
                            } catch (classifyErr) {
                                console.error(`[Judit Fallback]: auto-classify error for case ${caseId}:`, classifyErr.message);
                            }
                        }
                        continue;
                    }
                    // Request still pending and within acceptable window â€” skip, will retry next run
                    console.log(`[Judit Fallback]: request ${requestId} still ${requestStatus} for case ${caseId} phase ${phaseType} (${Math.round(ageMs / 60000)}min old). Will retry.`);
                    continue;
                }

                if (requestStatus === 'cancelled') {
                    const failUpdate = {};
                    const remaining = pendingPhases.filter((p) => p !== phaseType);
                    failUpdate[`juditSources.${phaseType}.error`] = 'Request Judit cancelado pelo provedor.';
                    failUpdate[`juditSources.${phaseType}.status`] = 'CANCELLED';
                    failUpdate.juditPendingAsyncPhases = remaining.length > 0 ? remaining : FieldValue.delete();
                    failUpdate.juditPendingAsyncCount = remaining.length > 0 ? remaining.length : FieldValue.delete();
                    if (remaining.length === 0) {
                        failUpdate.juditEnrichmentStatus = 'PARTIAL';
                        failUpdate.juditError = `Fase ${phaseType} cancelada pelo provedor Judit.`;
                    }
                    failUpdate.updatedAt = FieldValue.serverTimestamp();
                    await caseRef.update(failUpdate);
                    await mappingDoc.ref.delete();
                    console.log(`[Judit Fallback]: marked phase ${phaseType} as CANCELLED for case ${caseId} (request status: ${requestStatus}).`);

                    if (remaining.length === 0 && currentCaseData.status !== 'DONE' && currentCaseData.status !== 'CORRECTION_NEEDED') {
                        try {
                            const freshDoc = await caseRef.get();
                            await runAutoClassifyAndAi(caseRef, caseId, freshDoc.data() || {});
                        } catch (classifyErr) {
                            console.error(`[Judit Fallback]: auto-classify error for case ${caseId}:`, classifyErr.message);
                        }
                    }
                    continue;
                }

                if (requestStatus === 'failed' || requestStatus === 'error') {
                    const failUpdate = {};
                    const remaining = pendingPhases.filter((p) => p !== phaseType);
                    failUpdate[`juditSources.${phaseType}.error`] = `Request Judit falhou com status: ${requestStatus}.`;
                    failUpdate[`juditSources.${phaseType}.status`] = 'FAILED';
                    failUpdate.juditPendingAsyncPhases = remaining.length > 0 ? remaining : FieldValue.delete();
                    failUpdate.juditPendingAsyncCount = remaining.length > 0 ? remaining.length : FieldValue.delete();
                    if (remaining.length === 0) {
                        failUpdate.juditEnrichmentStatus = 'PARTIAL';
                        failUpdate.juditError = `Falha na fase ${phaseType}: request Judit retornou ${requestStatus}.`;
                    }
                    failUpdate.updatedAt = FieldValue.serverTimestamp();
                    await caseRef.update(failUpdate);
                    await mappingDoc.ref.delete();
                    console.log(`[Judit Fallback]: marked phase ${phaseType} as FAILED for case ${caseId} (request status: ${requestStatus}).`);

                    if (remaining.length === 0 && currentCaseData.status !== 'DONE' && currentCaseData.status !== 'CORRECTION_NEEDED') {
                        try {
                            const freshDoc = await caseRef.get();
                            await runAutoClassifyAndAi(caseRef, caseId, freshDoc.data() || {});
                        } catch (classifyErr) {
                            console.error(`[Judit Fallback]: auto-classify error for case ${caseId}:`, classifyErr.message);
                        }
                    }
                    continue;
                }

                // Request is completed â€” now safely fetch responses
                let items;
                try {
                    items = await fetchResponses(requestId, apiKey);
                } catch (fetchErr) {
                    console.warn(`[Judit Fallback]: fetchResponses failed for ${requestId} (case ${caseId}, phase ${phaseType}): ${fetchErr.message}`);
                    // If fetch fails for a completed request, mark as error
                    const failUpdate = {};
                    const remaining = pendingPhases.filter((p) => p !== phaseType);
                    failUpdate[`juditSources.${phaseType}.error`] = `Erro ao buscar respostas: ${fetchErr.message}`;
                    failUpdate[`juditSources.${phaseType}.status`] = 'ERROR';
                    failUpdate.juditPendingAsyncPhases = remaining.length > 0 ? remaining : FieldValue.delete();
                    failUpdate.juditPendingAsyncCount = remaining.length > 0 ? remaining.length : FieldValue.delete();
                    if (remaining.length === 0) {
                        failUpdate.juditEnrichmentStatus = 'PARTIAL';
                        failUpdate.juditError = `Erro ao recuperar respostas da fase ${phaseType}.`;
                    }
                    failUpdate.updatedAt = FieldValue.serverTimestamp();
                    await caseRef.update(failUpdate);
                    await mappingDoc.ref.delete();
                    console.log(`[Judit Fallback]: marked phase ${phaseType} as ERROR for case ${caseId}.`);
                    continue;
                }

                // Successfully fetched responses â€” process them like the webhook would
                const cpf = (currentCaseData.cpf || '').replace(/\D/g, '');
                let normalized;
                if (phaseType === 'warrant') {
                    normalized = normalizeJuditWarrants(items);
                } else if (phaseType === 'execution') {
                    normalized = normalizeJuditExecution(items);
                } else {
                    normalized = normalizeJuditLawsuits({ responseData: items, hasLawsuits: items.length > 0 }, cpf);
                }

                const { _source, ...fields } = normalized;
                const updateFields = {};
                for (const [key, value] of Object.entries(fields)) {
                    if (value !== undefined && value !== null) {
                        updateFields[key] = value;
                    }
                }

                const remainingPendingPhases = pendingPhases.filter((phase) => phase !== phaseType);
                updateFields[`juditSources.${phaseType}`] = _source;
                updateFields[`juditRawPayloads.${phaseType}.responseCount`] = items.length;
                updateFields[`juditRawPayloads.${phaseType}.fallbackCompletedAt`] = new Date().toISOString();
                updateFields.juditPendingAsyncPhases = remainingPendingPhases.length > 0
                    ? remainingPendingPhases
                    : FieldValue.delete();
                updateFields.juditPendingAsyncCount = remainingPendingPhases.length > 0
                    ? remainingPendingPhases.length
                    : FieldValue.delete();
                updateFields.updatedAt = FieldValue.serverTimestamp();

                if (remainingPendingPhases.length === 0) {
                    const juditConfig = await loadJuditConfig(tenantId || currentCaseData.tenantId);
                    const mergedCaseData = { ...currentCaseData, ...fields, juditPendingAsyncPhases: [] };
                    updateFields.juditNeedsEscavador = evaluateEscavadorNeed(mergedCaseData, juditConfig);
                    updateFields.juditEnrichmentStatus = currentCaseData.juditError ? 'PARTIAL' : 'DONE';
                    updateFields.juditEnrichedAt = FieldValue.serverTimestamp();
                }

                await caseRef.update(updateFields);
                await mappingDoc.ref.delete();
                console.log(`[Judit Fallback]: case ${caseId} updated with ${items.length} ${phaseType} result(s) via fallback.`);

                if (remainingPendingPhases.length === 0 && currentCaseData.status !== 'DONE' && currentCaseData.status !== 'CORRECTION_NEEDED') {
                    try {
                        const freshDoc = await caseRef.get();
                        const freshData = freshDoc.data() || {};
                        if (freshData.juditNeedsEscavador && (!freshData.escavadorEnrichmentStatus || freshData.escavadorEnrichmentStatus === 'PENDING' || freshData.escavadorEnrichmentStatus === 'SKIPPED')) {
                            console.log(`[Judit Fallback]: auto-classify skipped for case ${caseId} â€” Escavador still pending.`);
                        } else {
                            await runAutoClassifyAndAi(caseRef, caseId, freshData);
                        }
                    } catch (classifyErr) {
                        console.error(`[Judit Fallback]: auto-classify error for case ${caseId}:`, classifyErr.message);
                    }
                }
            } catch (err) {
                console.error(`[Judit Fallback]: error processing request ${requestId} for case ${caseId}:`, err.message);
            }
        }
    },
);

exports.__test = {
    computeAutoClassification,
    buildAiPrompt,
    buildAiHomonymPrompt,
    evaluateEscavadorNeed,
    evaluateNegativePartialSafetyNet,
    enforceTenantSubmissionLimits,
    formatDateKey,
    formatMonthKey,
    previousMonthKey,
    getClientQuotaStatusInner,
    buildDeterministicPrefill,
    evaluateComplexityTriggers,
    buildDetCriminalNotes,
    buildDetLaborNotes,
    buildDetWarrantNotes,
    buildDetKeyFindings,
    buildDetExecutiveSummary,
    buildDetFinalJustification,
    selectTopProcessos,
    normCnj,
    formatCnj,
    formatDateBR,
    classifyWarrantType,
    detectCartaDeGuia,
    findLinkedCivilProcess,
    extractSentenceDetails,
    formatProcessBlock,
    sanitizeAiOutput,
    _setDb(mockDb) { db = mockDb; },
    _setWriteAuditEvent(mockFn) { writeAuditEvent = mockFn; },
};

/* =========================================================
   SYSTEM HEALTH â€” Read-only endpoint for provider status
   ========================================================= */

exports.getSystemHealth = onCall(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario.');
        const profile = await getOpsUserProfile(request.auth.uid);
        if (!['analyst', 'supervisor', 'admin'].includes(profile?.role)) {
            throw new HttpsError('permission-denied', 'Apenas analistas podem acessar.');
        }

        const { COLLECTION: healthCollection } = require('./helpers/circuitBreaker');
        const snapshot = await db.collection(healthCollection).get();
        const providers = {};
        snapshot.forEach((doc) => {
            const data = doc.data();
            providers[doc.id] = {
                providerId: doc.id,
                failCount: data.failCount || 0,
                lastSuccess: data.lastSuccess || null,
                lastFailure: data.lastFailure || null,
                lastError: data.lastError || null,
                disabledUntil: data.disabledUntil || null,
                updatedAt: data.updatedAt || null,
            };
        });
        return { providers };
    },
);

/* =========================================================
   CLIENT QUOTA STATUS â€” Read-only quota info for client portal
   ========================================================= */

exports.getClientQuotaStatus = onCall(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario.');
        return getClientQuotaStatusInner(request.auth.uid);
    },
);

const { buildClientProductCatalog } = require('./domain/v2ProductCatalog.js');

exports.createQuoteRequest = onCall(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario.');
        const profile = await getClientUserProfile(request.auth.uid);
        const tenantId = profile?.tenantId;
        if (!tenantId) throw new HttpsError('failed-precondition', 'Tenant nao identificado.');

        const productKey = String(request.data?.productKey || '').trim();
        const notes = String(request.data?.notes || '').trim().slice(0, 1000);
        if (!productKey) throw new HttpsError('invalid-argument', 'productKey obrigatorio.');

        const quoteRef = db.collection('quoteRequests').doc();
        await quoteRef.set({
            id: quoteRef.id,
            tenantId,
            productKey,
            notes,
            status: 'pending',
            requestedBy: request.auth.uid,
            requestedByEmail: profile.email || null,
            requestedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        await writeAuditEvent({
            action: 'QUOTE_REQUESTED',
            tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: request.auth.uid, email: profile.email || request.auth.uid },
            entity: { type: 'QUOTE_REQUEST', id: quoteRef.id, label: productKey },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            metadata: { productKey, hasNotes: Boolean(notes) },
        }).catch((err) => console.warn('createQuoteRequest audit failed:', err.message));

        return { success: true, quoteId: quoteRef.id };
    },
);

exports.resolveQuoteRequest = onCall(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario.');
        const profile = await getOpsUserProfile(request.auth.uid);
        if (profile.role !== 'supervisor' && profile.role !== 'admin') {
            throw new HttpsError('permission-denied', 'Apenas supervisores podem resolver cotacoes.');
        }

        const quoteId = String(request.data?.quoteId || '').trim();
        const decision = String(request.data?.decision || '').trim();
        const responseNotes = String(request.data?.responseNotes || '').trim().slice(0, 1000);
        const addProduct = Boolean(request.data?.addProduct);
        if (!quoteId) throw new HttpsError('invalid-argument', 'quoteId obrigatorio.');
        if (!['approved', 'rejected'].includes(decision)) {
            throw new HttpsError('invalid-argument', 'decision deve ser approved ou rejected.');
        }

        const quoteRef = db.collection('quoteRequests').doc(quoteId);
        const quoteDoc = await quoteRef.get();
        if (!quoteDoc.exists) throw new HttpsError('not-found', 'Cotacao nao encontrada.');
        const quoteData = quoteDoc.data() || {};
        if (!canOperateTenant(profile, quoteData.tenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para este tenant.');
        }

        await quoteRef.update({
            status: decision,
            responseNotes: responseNotes || null,
            reviewedBy: request.auth.uid,
            reviewedByEmail: profile.email || null,
            reviewedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        let productAdded = false;
        if (decision === 'approved' && addProduct && quoteData.productKey) {
            const entDocRef = db.collection('tenantEntitlements').doc(quoteData.tenantId);
            const entDoc = await entDocRef.get();
            const before = entDoc.exists ? (entDoc.data() || {}) : {};
            const currentProducts = Array.isArray(before.enabledProducts)
                ? before.enabledProducts
                : Object.keys(before.enabledProducts || {}).filter((k) => before.enabledProducts[k] === true);
            if (!currentProducts.includes(quoteData.productKey)) {
                const nextProducts = [...currentProducts, quoteData.productKey];
                await entDocRef.set({ enabledProducts: nextProducts, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
                productAdded = true;
            }
        }

        await writeAuditEvent({
            action: decision === 'approved' ? 'QUOTE_APPROVED' : 'QUOTE_REJECTED',
            tenantId: quoteData.tenantId,
            actor: { type: ACTOR_TYPE.OPS_USER, id: request.auth.uid, email: profile.email || request.auth.uid },
            entity: { type: 'QUOTE_REQUEST', id: quoteId, label: quoteData.productKey || 'quote' },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            metadata: { productKey: quoteData.productKey, productAdded },
        }).catch((err) => console.warn('resolveQuoteRequest audit failed:', err.message));

        return { success: true, quoteId, decision, productAdded };
    },
);

exports.markAlertAs = onCall(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario.');
        const profile = await getClientUserProfile(request.auth.uid).catch(async () => {
            return await getOpsUserProfile(request.auth.uid);
        });
        const tenantId = profile?.tenantId;
        if (!tenantId) throw new HttpsError('failed-precondition', 'Tenant nao identificado.');

        const alertId = String(request.data?.alertId || '').trim();
        const state = String(request.data?.state || '').trim();
        const validStates = ['read', 'actioned', 'dismissed'];
        if (!alertId) throw new HttpsError('invalid-argument', 'alertId obrigatorio.');
        if (!validStates.includes(state)) {
            throw new HttpsError('invalid-argument', `state deve ser um de: ${validStates.join(', ')}.`);
        }

        const alertRef = db.collection('alerts').doc(alertId);
        const alertDoc = await alertRef.get();
        if (!alertDoc.exists) throw new HttpsError('not-found', 'Alerta nao encontrado.');
        const alertData = alertDoc.data() || {};
        if (alertData.tenantId !== tenantId) {
            throw new HttpsError('permission-denied', 'Sem permissao para este alerta.');
        }

        const updatePayload = {
            state,
            updatedAt: FieldValue.serverTimestamp(),
        };
        if (state === 'actioned' || state === 'dismissed') {
            updatePayload.actionedAt = FieldValue.serverTimestamp();
            updatePayload.actionedBy = request.auth.uid;
        }
        await alertRef.update(updatePayload);

        await writeAuditEvent({
            action: 'ALERT_STATE_CHANGED',
            tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: request.auth.uid, email: profile.email || request.auth.uid },
            entity: { type: 'ALERT', id: alertId, label: alertData.kind || 'alert' },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            metadata: { state, previousState: alertData.state || 'unread' },
        }).catch((err) => console.warn('markAlertAs audit failed:', err.message));

        return { success: true, alertId, state };
    },
);

exports.getClientProductCatalog = onCall(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario.');
        const profile = await getClientUserProfile(request.auth.uid);
        const tenantId = profile.tenantId;
        if (!tenantId) throw new HttpsError('failed-precondition', 'Tenant nao identificado.');

        const entitlements = await getTenantEntitlementsData(tenantId);
        let fallbackUsed = false;
        let resolvedEntitlements = entitlements;
        if (!entitlements) {
            const tenantSettings = await getTenantSettingsData(tenantId);
            fallbackUsed = !tenantSettings;
            resolvedEntitlements = tenantSettings
                ? {
                    tier: tenantSettings.tier || 'basic',
                    enabledProducts: tenantSettings.enabledProducts || [],
                }
                : null;
        }

        const catalog = buildClientProductCatalog({
            entitlements: resolvedEntitlements,
            fallbackUsed,
        });

        return {
            tenantId,
            source: entitlements ? 'tenantEntitlements' : (fallbackUsed ? 'defaults' : 'legacyTenantSettingsFallback'),
            ...catalog,
        };
    },
);

exports.materializeV2Artifacts = onCall(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario.');
        const profile = await getOpsUserProfile(request.auth.uid);
        if (!['analyst', 'supervisor', 'admin'].includes(profile?.role)) {
            throw new HttpsError('permission-denied', 'Apenas analistas podem materializar artefatos.');
        }

        const { caseId } = request.data;
        if (!caseId) throw new HttpsError('invalid-argument', 'caseId e obrigatorio.');

        const caseRef = db.collection('cases').doc(caseId);
        const caseSnap = await caseRef.get();
        if (!caseSnap.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
        const caseData = caseSnap.data();

        return await materializeModuleRunsForCase(caseId, caseData);
    }
);

/* =========================================================
   WATCHLIST CALLABLES (Premium - Ops)
   ========================================================= */

async function ensureOpsCanOperateWatchlist(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessario.');
    const profile = await getOpsUserProfile(request.auth.uid);
    if (!['analyst', 'senior_analyst', 'supervisor', 'admin'].includes(profile?.role)) {
        throw new HttpsError('permission-denied', 'Somente analistas podem gerenciar watchlists.');
    }
    return profile;
}

exports.createWatchlist = onCall(
    { region: 'southamerica-east1' },
    async (request) => {
        const profile = await ensureOpsCanOperateWatchlist(request);
        const subjectId = String(request.data?.subjectId || '').trim();
        const tenantId = String(request.data?.tenantId || profile.tenantId || '').trim();
        const modules = Array.isArray(request.data?.modules) ? request.data.modules.map((m) => String(m)) : [];
        const intervalDays = Number(request.data?.intervalDays) > 0 ? Number(request.data.intervalDays) : 30;
        if (!subjectId) throw new HttpsError('invalid-argument', 'subjectId obrigatorio.');
        if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId obrigatorio.');
        if (!canOperateTenant(profile, tenantId)) {
            throw new HttpsError('permission-denied', 'Sem permissao para este tenant.');
        }

        const entitlements = await getTenantEntitlementsData(tenantId);
        const resolved = resolveTenantEntitlements(entitlements || {});
        if (!isTenantFeatureEnabled(resolved, 'WATCHLIST_MONITORING')) {
            throw new HttpsError('failed-precondition', 'Monitoramento de watchlist nao habilitado para este tenant.');
        }

        const watchlistId = await addToWatchlist({ subjectId, tenantId, modules, intervalDays });

        await writeAuditEvent({
            action: 'WATCHLIST_CREATED',
            tenantId,
            actor: { type: ACTOR_TYPE.OPS_USER, id: request.auth.uid, email: profile.email || request.auth.uid },
            entity: { type: 'WATCHLIST', id: watchlistId, label: subjectId },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            metadata: { subjectId, modules, intervalDays },
        }).catch((err) => console.warn('createWatchlist audit failed:', err.message));

        return { success: true, watchlistId };
    },
);

async function withWatchlistContext(request, action, handler) {
    const profile = await ensureOpsCanOperateWatchlist(request);
    const watchlistId = String(request.data?.watchlistId || '').trim();
    if (!watchlistId) throw new HttpsError('invalid-argument', 'watchlistId obrigatorio.');
    const ref = db.collection('watchlists').doc(watchlistId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Watchlist nao encontrada.');
    const data = snap.data() || {};
    if (!canOperateTenant(profile, data.tenantId)) {
        throw new HttpsError('permission-denied', 'Sem permissao para este tenant.');
    }
    const result = await handler({ profile, watchlistId, data });
    await writeAuditEvent({
        action,
        tenantId: data.tenantId,
        actor: { type: ACTOR_TYPE.OPS_USER, id: request.auth.uid, email: profile.email || request.auth.uid },
        entity: { type: 'WATCHLIST', id: watchlistId, label: data.subjectId || watchlistId },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        metadata: { subjectId: data.subjectId || null },
    }).catch((err) => console.warn(`${action} audit failed:`, err.message));
    return { success: true, watchlistId, ...result };
}

exports.pauseWatchlist = onCall(
    { region: 'southamerica-east1' },
    async (request) => withWatchlistContext(request, 'WATCHLIST_PAUSED', async ({ watchlistId }) => {
        await pauseWatchlist(watchlistId);
        return { active: false };
    }),
);

exports.resumeWatchlist = onCall(
    { region: 'southamerica-east1' },
    async (request) => withWatchlistContext(request, 'WATCHLIST_RESUMED', async ({ watchlistId }) => {
        await resumeWatchlist(watchlistId);
        return { active: true };
    }),
);

exports.deleteWatchlist = onCall(
    { region: 'southamerica-east1' },
    async (request) => withWatchlistContext(request, 'WATCHLIST_DELETED', async ({ watchlistId }) => {
        await deleteWatchlist(watchlistId);
        return { deleted: true };
    }),
);

exports.runWatchlistNow = onCall(
    { region: 'southamerica-east1' },
    async (request) => withWatchlistContext(request, 'WATCHLIST_RUN_NOW', async ({ watchlistId, data }) => {
        const outcome = await processSingleWatchlist(watchlistId, data, {
            pipelineRunner: async (caseId, caseData, runnerOptions = {}) => {
                return materializeModuleRunsForCase(caseId, caseData, {
                    ...runnerOptions,
                    source: 'watchlist_manual',
                });
            },
            logger: console,
        });

        return {
            outcome,
            alertsCreated: outcome.alertsCreated || 0,
            status: outcome.status || 'unknown',
        };
    }),
);

async function getClientQuotaStatusInner(uid) {
    const profile = await getClientUserProfile(uid);
    const tenantId = profile.tenantId;

    const tenantData = await getTenantSettingsData(tenantId);
    const dailyLimit = tenantData?.dailyLimit ?? null;
    const monthlyLimit = tenantData?.monthlyLimit ?? null;
    const allowDailyExceedance = tenantData?.allowDailyExceedance !== false;
    const allowMonthlyExceedance = tenantData?.allowMonthlyExceedance === true;

    if (dailyLimit == null && monthlyLimit == null) {
        return { hasLimits: false, dailyLimit: null, monthlyLimit: null, dailyCount: 0, monthlyCount: 0 };
    }

    const now = new Date();
    const dayKey = formatDateKey(now);
    const monthKey = formatMonthKey(now);

    const usageSnap = await db.collection('tenantUsage').doc(tenantId).get();
    const usage = usageSnap.exists ? usageSnap.data() : {};

    const dailyCount = (usage.dayKey === dayKey) ? (usage.dailyCount || 0) : 0;
    const monthlyCount = (usage.monthKey === monthKey) ? (usage.monthlyCount || 0) : 0;

    return {
        hasLimits: true,
        dailyLimit,
        monthlyLimit,
        dailyCount,
        monthlyCount,
        allowDailyExceedance,
        allowMonthlyExceedance,
    };
}

/* =========================================================
   SCHEDULED JOBS (Phase 4 - Premium)
   ========================================================= */

/**
 * Daily job to process active watchlists.
 * Runs at 03:00 AM (Sao Paulo time).
 */
exports.scheduledMonitoringJob = onSchedule(
    { schedule: '00 03 * * *', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1' },
    async () => {
        try {
            const result = await processWatchlists({
                pipelineRunner: async (caseId, caseData, runnerOptions = {}) => {
                    return materializeModuleRunsForCase(caseId, caseData, {
                        ...runnerOptions,
                        source: 'watchlist',
                    });
                },
            });
            console.log(`scheduledMonitoringJob: Success. processed=${result.processed} alerts=${result.alertsCreated} failures=${result.failures}`);
        } catch (error) {
            console.error('scheduledMonitoringJob: Failed to process watchlists:', error);
        }
    }
);

exports.scheduledBillingClosureJob = onSchedule(
    { schedule: '30 02 1 * *', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1' },
    async () => {
        const monthKey = previousMonthKey(new Date());
        if (!monthKey) {
            console.warn('scheduledBillingClosureJob: monthKey indisponivel.');
            return;
        }

        const tenantsSnap = await db.collection('tenantEntitlements').limit(200).get();
        let processed = 0;
        let failed = 0;

        for (const tenantDoc of tenantsSnap.docs) {
            const data = tenantDoc.data() || {};
            if (data.status === 'inactive' || data.status === 'suspended') continue;
            try {
                await closeBillingPeriod(tenantDoc.id, monthKey, {
                    actor: { uid: 'scheduled-billing-closure', email: 'system' },
                });
                processed++;
            } catch (error) {
                failed++;
                console.error(`scheduledBillingClosureJob: falha ao fechar ${tenantDoc.id}/${monthKey}:`, error);
            }
        }

        console.log(`scheduledBillingClosureJob: ${processed} fechamento(s), ${failed} falha(s), mes ${monthKey}.`);
    }
);

/* =========================================================
   REST API V1 â€” Exposes controllers via HTTP
   ========================================================= */

const { router } = require('./interfaces/http/routes');
const { tenantResolver } = require('./interfaces/http/middleware/tenantResolver');

exports.apiV1 = onRequest(
    {
      region: 'southamerica-east1',
      cors: true,
      secrets: [bigdatacorpAccessToken, bigdatacorpTokenId],
    },
    async (req, res) => {
        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Origin', '*');
            res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
            res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.status(204).send('');
            return;
        }
        await tenantResolver(req, res, async () => {
            await router(req, res);
        });
    }
);
