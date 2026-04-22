/**
 * Cloud Functions: Judit-First Enrichment Pipeline (Datalake-First Strategy)
 *
 * Flow (datalake-first — async DISABLED by default):
 * 1. GATE: Judit Entity Data Lake (R$ 0,12) — validate CPF active + name similarity
 *    Fallback: FonteData receita-federal-pf (R$ 0,54) if Judit gate fails
 * 2. If gate fails → BLOCKED
 * 3. LAWSUITS: Sync datalake simples (R$ 0,50) — DEFAULT. Datalake detalhada (R$ 1,50/1k). On Demand (R$ 6,00/1k) only if forced.
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
const { defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

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

initializeApp();
const db = getFirestore();

const fontedataApiKey = defineString('FONTEDATA_API_KEY');
const openaiApiKey = defineString('OPENAI_API_KEY');
const escavadorApiToken = defineString('ESCAVADOR_API_TOKEN');
const juditApiKey = defineString('JUDIT_API_KEY');

/**
 * Default enrichment config when tenant has none configured.
 * Cenário D structure — all phases configurable.
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
        entity: true,            // R$0.12 — gate (Dados Cadastrais Data Lake)
        lawsuits: true,          // R$0.50 simples | R$1.50/1k datalake | R$6.00/1k on_demand
        warrant: true,           // R$1.00 — mandado de prisao
        execution: true,         // R$0.50 — execucao criminal
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

function asDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/* =========================================================
   AI ANALYSIS — Structured JSON output with anti-hallucination
   Runs AFTER all providers complete (FonteData + Escavador + Judit)
   ========================================================= */

const AI_MODEL = 'gpt-5.4-nano';
const AI_MAX_TOKENS = 1200;
const AI_PROMPT_VERSION = 'v3-evidence-based';
const AI_HOMONYM_PROMPT_VERSION = 'v1-homonym-dedicated';
const AI_HOMONYM_CONTEXT_VERSION = 'v1-derived-geo';
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
- confianca: grau de confiabilidade geral dos dados disponíveis
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
- se houver analise especializada de homonimos, use-a como insumo consultivo sobre os achados ambiguos e cite-a explicitamente`;

const AI_HOMONYM_SYSTEM_MESSAGE = `Voce e um analista especializado em desambiguacao de homonimos em due diligence.
Responda EXCLUSIVAMENTE em JSON valido conforme o schema abaixo. Nao inclua texto fora do JSON.
Baseie-se APENAS nos fatos estruturados fornecidos. Nao invente campos, cidades, CPFs ou vinculos.
Se faltar dado, registre isso em unknowns.
Fatos duros prevalecem: CPF exato em parte, mandado ativo e execucao penal positiva nao podem ser relativizados.

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
    const normalized = sanitizeAiOutput(value).replace(/\s+/g, ' ').trim();
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

function parseAiResponse(content) {
    return parseJsonSchemaResponse(content, validateAiSchema, extractFallbackAiResponse, sanitizeAiStructured);
}

function parseAiHomonymResponse(content) {
    return parseJsonSchemaResponse(content, validateAiHomonymSchema, extractFallbackAiHomonymResponse, sanitizeAiHomonymStructured);
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
    if (obj.revisaoManualSugerida !== undefined && typeof obj.revisaoManualSugerida !== 'boolean') return false;
    if (obj.sugestaoScore !== undefined && (typeof obj.sugestaoScore !== 'number' || obj.sugestaoScore < 0 || obj.sugestaoScore > 100)) return false;
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

/**
 * Sanitize AI response — remove any CPF/phone numbers the model may hallucinate.
 */
function sanitizeAiOutput(text) {
    if (!text) return text;
    return text
        .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, '[CPF_REMOVIDO]')
        .replace(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g, '[TEL_REMOVIDO]');
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
    return status === 'DONE' || status === 'PARTIAL' || status === 'FAILED' || status === 'SKIPPED';
}

function getAiProvidersIncluded(caseData) {
    return [
        isDoneOrPartial(caseData.enrichmentStatus) ? 'FonteData' : null,
        isDoneOrPartial(caseData.escavadorEnrichmentStatus) ? 'Escavador' : null,
        isDoneOrPartial(caseData.juditEnrichmentStatus) ? 'Judit' : null,
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

async function getTenantSettingsData(tenantId) {
    if (!tenantId) return null;
    const tenantDoc = await db.collection('tenantSettings').doc(tenantId).get();
    return tenantDoc.exists ? tenantDoc.data() : null;
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

function getProjectId() {
    if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
    if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;

    if (process.env.FIREBASE_CONFIG) {
        try {
            return JSON.parse(process.env.FIREBASE_CONFIG).projectId || 'compliance-hub-br';
        } catch {
            return 'compliance-hub-br';
        }
    }

    return 'compliance-hub-br';
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
    let hash = 0;
    const input = String(value || '');
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
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
                    max_completion_tokens: AI_MAX_TOKENS,
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
 * Select top-N processos for AI prompt, prioritizing criminal + trabalhista.
 * Merges Escavador and Judit arrays, deduplicates by CNJ, sorts by priority.
 */
function selectTopProcessos(caseData, limit = 10) {
    const escavadorProcessos = caseData.escavadorProcessos || [];
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const seen = new Set();
    const all = [];

    for (const p of juditRoleSummary) {
        const cnj = p.code || '';
        if (cnj) seen.add(cnj);
        all.push({
            cnj: cnj || 'N/A',
            area: p.area || 'N/A',
            status: p.status || 'N/A',
            polo: p.side || p.personType || 'N/A',
            tribunal: p.tribunalAcronym || 'N/A',
            data: p.distributionDate || 'N/A',
            fonte: 'Judit',
            isCriminal: !!p.isCriminal,
            isTrabalhista: /trabalh/i.test(p.area || ''),
            isActive: p.status === 'ATIVO',
        });
    }

    for (const p of escavadorProcessos) {
        const cnj = p.numeroCnj || '';
        if (cnj && seen.has(cnj)) continue;
        if (cnj) seen.add(cnj);
        all.push({
            cnj: cnj || 'N/A',
            area: p.area || 'N/A',
            status: p.status || 'N/A',
            polo: p.polo || p.tipoNormalizado || 'N/A',
            tribunal: p.tribunalSigla || 'N/A',
            data: p.dataInicio || 'N/A',
            fonte: 'Escavador',
            isCriminal: /penal|criminal/i.test(p.area || ''),
            isTrabalhista: /trabalh/i.test(p.area || ''),
            isActive: /ativo/i.test(p.status || ''),
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
 * Build AI prompt — PII-minimized, all providers included.
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

    // Top-10 processos detalhados (criminal+trabalhista prioritarios)
    const topProcessos = selectTopProcessos(caseData, 10);
    if (topProcessos.length > 0) {
        parts.push('', '--- TOP PROCESSOS DETALHADOS ---');
        for (const p of topProcessos) {
            parts.push(`${p.cnj} | ${p.area} | ${p.status} | ${p.polo} | ${p.tribunal} | ${p.data} | Fonte: ${p.fonte}`);
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
        `Trabalhista: ${caseData.laborFlag || 'N/A'}`);
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
        return { status: 'BLOCKED', error: gateReason || null };
    }

    console.log(`Case ${caseId}: identity gate PASSED (similarity: ${(nameSim * 100).toFixed(0)}%).`);

    const uf = enrichmentConfig.filters?.uf || caseData.hiringUf || null;
    const tasks = [];

    if (phases.identity !== false) {
        tasks.push({
            key: 'identity',
            promise: queryIdentity(cpf, apiKey).then(normalizeIdentity),
        });
    }

    if (phases.criminal !== false) {
        tasks.push({
            key: 'criminal',
            promise: queryProcessosAgrupada(cpf, apiKey).then(normalizeProcessos),
        });
    }

    if (phases.warrant !== false) {
        tasks.push({
            key: 'warrant',
            promise: queryWarrant(cpf, apiKey).then(normalizeWarrant),
        });
    }

    if (phases.labor !== false) {
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

        console.log(
            `Case ${caseId} [Escavador]: DONE. ` +
            `Processos: ${fields.escavadorProcessTotal || 0}, ` +
            `Criminal: ${fields.escavadorCriminalFlag || 'NEGATIVE'}, ` +
            `Tribunais filter: [${tribunais.join(',')}].`,
        );

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
        await caseRef.update({
            escavadorEnrichmentStatus: 'FAILED',
            escavadorError: errMsg,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'FAILED', error: errMsg };
    }
}

/* =========================================================
   ESCAVADOR NEED EVALUATION — Determines if Escavador
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
    const escavadorAlreadyHandled = ['RUNNING', 'DONE', 'PARTIAL', 'FAILED'].includes(escavadorStatus);
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

    const phases = juditConfig.phases;

    // ─── GATE: Judit Entity Data Lake (R$0.12) ───
    // Skip gate on rerun if it already passed (juditGateResult.passed === true)
    let gateEntityData = null;
    let entityUfs = [];
    if (!options.skipGate && phases.entity !== false) {
        const existingGate = caseData.juditGateResult;
        if (existingGate?.passed === true) {
            console.log(`Case ${caseId} [Judit]: gate already passed, skipping entity query.`);
            entityUfs = caseData.juditAllUfs || [];
        } else {
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
                // Judit gate failed — try FonteData receita-federal as fallback
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

    // ─── ENRICHMENT: datalake-first strategy ───
    // Flow: 1) Sync datalake lawsuits (R$0.50) → 2) Parallel warrants + execution → 3) Name supplement → 4) Async ONLY if triggered
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

    // ─── STEP 1: Lawsuits (sync datalake by default, async only if explicitly forced) ───
    if (phases.lawsuits !== false) {
        const useAsync = juditFilters.useAsync === true;  // DEFAULT=false → sync datalake
        try {
            let lawsuitsRaw;
            if (useAsync) {
                console.log(`Case ${caseId} [Judit]: lawsuits via ASYNC (datalake R$1.50/1k ou on_demand R$6.00/1k) — explicitly forced.`);
                lawsuitsRaw = await queryLawsuitsAsync(cpf, apiKey, { tribunals, cacheTtlDays });
            } else {
                console.log(`Case ${caseId} [Judit]: lawsuits via SYNC datalake (R$0.50) — default path.`);
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

    // ─── STEP 2: Warrants + Execution (parallel, always async — these endpoints have no sync alternative) ───
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

    const totalPhases = (phases.lawsuits !== false ? 1 : 0) + parallelTasks.length;

    // ─── STEP 3: NAME SEARCH SUPPLEMENT — search by name when CPF found 0 lawsuits ───
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
            console.log(`Case ${caseId} [Judit]: name search skipped — ${entityHomonymCount} CPFs with same name exceeds max ${maxCpfs}.`);
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

    // ─── EVALUATE: should Escavador run as cross-validation? ───
    const needsEscavador = evaluateEscavadorNeed(updatePayload, juditConfig);

    // ─── PERSIST ───
    const error = errors.length > 0 ? errors.join('; ') : null;
    const persistencePayload = savePersistence ? { juditRawPayloads } : {};

    // Judit pricing: entity R$0.12, lawsuits_sync R$0.50, warrant R$1.00, execution R$0.50
    let juditCostBRL = 0;
    if (gateEntityData) juditCostBRL += 0.12;
    if (juditSources.lawsuits && !juditSources.lawsuits.error) {
        juditCostBRL += juditFilters.useAsync === true ? 1.50 : 0.50;
    }
    if (juditSources.warrant && !juditSources.warrant.error) juditCostBRL += 1.00;
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

    if (!options.skipAutoClassify && (juditStatus === 'DONE' || juditStatus === 'PARTIAL')) {
        try {
            const freshDoc = await caseRef.get();
            const freshData = freshDoc.data() || {};

            if (needsEscavador && (freshData.escavadorEnrichmentStatus === 'RUNNING' || freshData.escavadorEnrichmentStatus === 'PENDING' || !freshData.escavadorEnrichmentStatus)) {
                console.log(`Case ${caseId} [AutoClassify]: Skipped — Escavador needed and still ${freshData.escavadorEnrichmentStatus || 'PENDING'}. Will run when Escavador completes.`);
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
        `Warrant: ${updatePayload.juditWarrantFlag || 'N/A'}, ` +
        `Processos: ${updatePayload.juditProcessTotal || 0}, ` +
        `NeedsEscavador: ${needsEscavador}, ` +
        `Tribunals filter: [${tribunals.join(',')}].`,
    );

    return { status: juditStatus, error, needsEscavador };
}

/* =========================================================
   FONTEDATA — Kept as helper for manual rerun only.
   No longer triggered automatically on case creation.
   ========================================================= */
// exports.enrichFonteDataOnCase removed — FonteData is now fallback only.
// The runFonteDataEnrichmentPhase function is still available via rerunEnrichmentPhase.

/* =========================================================
   JUDIT — PRIMARY Cloud Function (triggered on case creation)
   Runs Judit gate (entity R$0.12) + lawsuits + warrants + execution.
   ========================================================= */

exports.enrichJuditOnCase = onDocumentCreated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 540, memory: '512MiB' },
    async (event) => {
        const snap = event.data;
        if (!snap) return;

        const caseData = snap.data();
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
        } catch (err) {
            console.error(`Case ${caseId} [Judit]: error:`, err.message);
            throw err;
        }
    },
);

/* =========================================================
   JUDIT — Re-enrichment after client correction.
   Triggered when a case transitions from CORRECTION_NEEDED to
   PENDING with a fresh correctedAt. Since enrichJuditOnCase is
   onDocumentCreated and won't re-fire, this handles re-trigger.
   ========================================================= */

exports.enrichJuditOnCorrection = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1', timeoutSeconds: 540, memory: '512MiB' },
    async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        // Guard: only trigger on CORRECTION_NEEDED → PENDING transition
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
   ESCAVADOR — Sequential Cloud Function (waits for FonteData)
   Triggered when enrichmentStatus changes to DONE/PARTIAL.
   Reads enrichmentPrimaryUf to apply tribunal filters.
   ========================================================= */

/* =========================================================
   ESCAVADOR — Conditional Cloud Function (waits for Judit)
   Triggered when juditEnrichmentStatus changes to DONE/PARTIAL.
   Only runs if juditNeedsEscavador is true OR config forces it.
   ========================================================= */

exports.enrichEscavadorOnCase = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
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
                console.log(`Case ${caseId} [Escavador]: skipped — Judit found no flags requiring cross-validation.`);
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
        } catch (err) {
            console.error(`Case ${caseId} [Escavador]: error:`, err.message);
            throw err;
        }
    },
);

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

                    db.collection('auditLogs').add({
                        tenantId,
                        userId: 'system',
                        userEmail: 'cloud-function',
                        action: 'AI_HOMONYM_ANALYSIS_RUN',
                        target: caseId,
                        detail: JSON.stringify({
                            model: homonymResult.model,
                            tokens: updatePayload.aiHomonymTokens,
                            cost: updatePayload.aiHomonymCostUsd,
                            structuredOk: homonymResult.structuredOk,
                            promptVersion: AI_HOMONYM_PROMPT_VERSION,
                            contextVersion: AI_HOMONYM_CONTEXT_VERSION,
                            decision: homonymResult.structured?.decision || null,
                            confidence: homonymResult.structured?.confidence || null,
                            fromCache: !!homonymResult.fromCache,
                        }),
                        timestamp: FieldValue.serverTimestamp(),
                    }).catch((error) => console.warn('Audit log write failed:', error.message));
                }

                const aiResult = await runAiAnalysis(caseDataForAi, aiKey);
                Object.assign(updatePayload, buildAiUpdatePayload({ ...freshData, ...autoClassification }, aiResult));
                console.log(`Case ${caseId} [AI]: ${aiResult.error ? 'ERROR' : 'OK'} (${aiResult.fromCache ? 'cached' : 'fresh'}, $${(updatePayload.aiCostUsd || 0).toFixed(4)}, structured=${aiResult.structuredOk})`);

                db.collection('auditLogs').add({
                    tenantId,
                    userId: 'system',
                    userEmail: 'cloud-function',
                    action: 'AI_ANALYSIS_RUN',
                    target: caseId,
                    detail: JSON.stringify({
                        model: aiResult.model,
                        tokens: updatePayload.aiTokens,
                        cost: updatePayload.aiCostUsd,
                        structuredOk: aiResult.structuredOk,
                        promptVersion: AI_PROMPT_VERSION,
                        fromCache: !!aiResult.fromCache,
                    }),
                    timestamp: FieldValue.serverTimestamp(),
                }).catch((error) => console.warn('Audit log write failed:', error.message));
            } else if (homonymInput.needsAnalysis) {
                updatePayload.aiHomonymError = 'Chave OpenAI nao configurada.';
            }
        } catch (aiErr) {
            console.error(`Case ${caseId} [AI]: error:`, aiErr.message);
            updatePayload.aiError = aiErr.message;
            if (homonymInput.needsAnalysis && !updatePayload.aiHomonymError) {
                updatePayload.aiHomonymError = aiErr.message;
            }
        }
    } else if (homonymInput.needsAnalysis && !updatePayload.aiHomonymError) {
        updatePayload.aiHomonymError = updatePayload.aiError || 'IA desabilitada para este tenant.';
    }

    if (Object.keys(updatePayload).length > 0) {
        await caseRef.update({
            ...updatePayload,
            autoClassifiedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
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
    const fontedataCriminal = caseData.fontedataCriminalFlag === 'POSITIVE';
    const fontedataLabor = caseData.fontedataLaborFlag === 'POSITIVE';
    const fontedataWarrant = caseData.fontedataWarrantFlag === 'POSITIVE';
    const juditExecutionPositive = caseData.juditExecutionFlag === 'POSITIVE';
    const homonymInput = buildHomonymAnalysisInput(caseData);
    const coverage = homonymInput.providerCoverage || {};
    const overallCoverage = coverage.overall || {};
    const processCandidates = homonymInput.processCandidates || [];
    const referenceCandidates = homonymInput.referenceCandidates || [];
    const ambiguousCandidates = homonymInput.ambiguousCandidates || [];
    const hardFacts = new Set(homonymInput.hardFacts || []);
    const coverageReasonLabels = {
        JUDIT_ZERO_ESCAVADOR_FOUND: 'Judit sem retorno processual enquanto Escavador encontrou registros.',
        ESCAVADOR_ZERO_JUDIT_FOUND: 'Escavador sem retorno enquanto Judit encontrou registros.',
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
    const isLaborCandidate = (candidate) => /trabalh/i.test(candidate?.area || '');
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
        ...relevantCriminalCandidates.map((candidate) => candidate.source),
        ...(hardFacts.has('ACTIVE_WARRANT') ? ['Judit/Warrant'] : []),
        ...(hardFacts.has('PENAL_EXECUTION') ? ['Judit/Execution'] : []),
    ])];
    const strongCriminalCount = relevantCriminalCandidates.length
        + (hardFacts.has('ACTIVE_WARRANT') ? 1 : 0)
        + (hardFacts.has('PENAL_EXECUTION') ? 1 : 0)
        + (fontedataCriminal ? 1 : 0);
    const hasStrongCriminalEvidence = strongCriminalCount > 0;
    const hasWeakCriminalEvidence = weakCriminalCandidates.length > 0;
    const hasLowRiskOnly = lowRiskReferenceCandidates.length > 0
        && relevantCriminalCandidates.length === 0
        && !fontedataCriminal
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
            pushUnique(criminalNotes, `Mandado ativo confirmado via Judit (${caseData.juditActiveWarrantCount || 0}).`);
        }
        if (hardFacts.has('PENAL_EXECUTION')) {
            pushUnique(criminalNotes, `Execucao penal positiva confirmada via Judit (${caseData.juditExecutionCount || 0}).`);
        }
        if (hasWeakCriminalEvidence) {
            pushUnique(criminalNotes, `Achados adicionais por nome/match fraco (${weakCriminalCandidates.length}) foram separados como evidencia ambigua e nao rebaixam o fato duro.`);
        }
    } else if (hasWeakCriminalEvidence) {
        result.criminalFlag = 'INCONCLUSIVE_HOMONYM';
        result.criminalEvidenceQuality = 'WEAK_NAME_ONLY';
        pushUnique(criminalNotes, `Criminal INCONCLUSIVO por homonimia: ${weakCriminalCandidates.length} achado(s) dependem de nome, identidade fraca ou geografia inconsistente.`);
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

    if (juditWarrantPositive || fontedataWarrant) {
        result.warrantFlag = 'POSITIVE';
        const parts = [];
        if (juditActiveWarrants > 0) parts.push(`${juditActiveWarrants} mandado(s) ativo(s) via Judit`);
        if (fontedataWarrant) parts.push('detectado via FonteData');
        pushUnique(warrantNotes, `Mandado POSITIVO: ${parts.join(', ')}.`);
        if (caseData.juditWarrantNotes) pushUnique(warrantNotes, caseData.juditWarrantNotes);
    } else if (juditWarrantInconclusive) {
        result.warrantFlag = 'INCONCLUSIVE';
        pushUnique(warrantNotes, `Mandado INCONCLUSIVO: ${juditTotalWarrants} mandado(s) encontrado(s), mas nenhum com status pendente.`);
        if (caseData.juditWarrantNotes) pushUnique(warrantNotes, caseData.juditWarrantNotes);
    } else if (warrantSourceFailed) {
        result.warrantFlag = 'NOT_FOUND';
        pushUnique(warrantNotes, 'Mandado NAO ENCONTRADO: consulta Judit falhou.');
    } else {
        result.warrantFlag = 'NEGATIVE';
        pushUnique(warrantNotes, 'Nenhum mandado de prisao encontrado.');
    }

    const laborSourceFailed = fontedataFailed && caseData.enrichmentSources?.labor?.error;

    if (fontedataLabor || relevantLaborCandidates.length > 0) {
        result.laborFlag = 'POSITIVE';
        const sources = [];
        if (fontedataLabor) sources.push('FonteData TRT');
        if (relevantLaborCandidates.some((candidate) => candidate.source === 'Escavador')) sources.push('Escavador');
        if (relevantLaborCandidates.some((candidate) => candidate.source === 'Judit')) sources.push('Judit');
        pushUnique(laborNotes, `Trabalhista POSITIVO confirmado por: ${sources.join(', ')}.`);
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
    result.criminalNotes = criminalNotes.join('\n');
    result.warrantNotes = warrantNotes.join('\n');
    result.laborNotes = laborNotes.join('\n');

    result.enrichmentOriginalValues = {
        ...enrichmentOriginalValues,
        criminalFlag: result.criminalFlag,
        warrantFlag: result.warrantFlag,
        laborFlag: result.laborFlag,
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
   JUDIT onDocumentUpdated — REMOVED (now onDocumentCreated primary).
   Backward compat: old cases with enrichmentStatus DONE/PARTIAL
   will NOT auto-trigger Judit. Use manual rerun instead.
   ========================================================= */

/* =========================================================
   PUBLISH RESULT ON CASE DONE — Subcollection for client access
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
];

const PUBLIC_RESULT_FIELDS = [...IDENTITY_FIELDS, ...RESULT_ONLY_FIELDS];

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
    'executiveSummary',
    'statusSummary',
    'sourceSummary',
    'keyFindings',
    'nextSteps',
    'clientNotes',
    'processHighlights',
    'warrantFindings',
    'timelineEvents',
    'reportReady',
    'reportSlug',
    'hasNotes',
    'hasEvidence',
    'turnaroundHours',
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
            || (Array.isArray(caseData.timelineEvents) && caseData.timelineEvents.some((event) => event.status === 'risk'))
        );
    }

    return payload;
}

async function writeClientCaseMirror(caseId, caseData) {
    await db.collection('clientCases').doc(caseId).set(buildClientCasePayload(caseId, caseData), { merge: true });
}

exports.syncClientCaseOnCreate = onDocumentCreated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const caseData = event.data?.data();
        if (!caseData) return;
        const caseId = event.params.caseId;
        await writeClientCaseMirror(caseId, caseData);
    },
);

exports.syncClientCaseOnUpdate = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const after = event.data?.after?.data();
        if (!after) return;
        const caseId = event.params.caseId;
        await writeClientCaseMirror(caseId, after);
    },
);

exports.syncClientCaseOnDelete = onDocumentDeleted(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const caseId = event.params.caseId;
        await db.collection('clientCases').doc(caseId).delete().catch(() => {});
    },
);

exports.publishResultOnCaseDone = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        // Refresh the sanitized public result whenever a DONE case changes.
        if (after.status !== 'DONE') return;

        const caseId = event.params.caseId;
        const publicData = {};

        for (const field of PUBLIC_RESULT_FIELDS) {
            if (after[field] !== undefined && after[field] !== null) {
                publicData[field] = after[field];
            }
        }

        publicData.publishedAt = FieldValue.serverTimestamp();
        publicData.concludedAt = after.updatedAt || FieldValue.serverTimestamp();

        const publicRef = db.collection('cases').doc(caseId).collection('publicResult').doc('latest');
        await publicRef.set(publicData);

        console.log(`Case ${caseId}: publicResult/latest published with ${Object.keys(publicData).length} fields.`);
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

            const tenantRef = db.collection('tenantSettings').doc(tenantId);
            const tenantDoc = await tenantRef.get();
            if (!tenantDoc.exists) {
                await tenantRef.set({
                    analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG },
                    updatedAt: FieldValue.serverTimestamp(),
                });
            }

            await db.collection('auditLogs').add({
                tenantId: null,
                userId: uid,
                userEmail: operatorProfile.email || uid,
                action: 'USER_CREATED',
                target: authUser.uid,
                detail: `Cliente criado: ${tenantName || tenantId} (${email})`,
                timestamp: FieldValue.serverTimestamp(),
            });

            return { uid: authUser.uid, tenantId };
        } catch (error) {
            await getAuth().deleteUser(authUser.uid).catch(() => {});
            throw error;
        }
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

        await enforceTenantSubmissionLimits(tenantId, tenantData || {});

        const now = new Date();
        const createdDateKey = formatDateKey(now);
        const createdMonthKey = formatMonthKey(now);
        const candidateRef = db.collection('candidates').doc();
        const caseRef = db.collection('cases').doc();

        const auditRef = db.collection('auditLogs').doc();
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

        batch.set(caseRef, {
            tenantId,
            tenantName,
            candidateId: candidateRef.id,
            candidateName,
            candidatePosition: String(position || ''),
            department: String(department || ''),
            cpf: cpfDigits,
            cpfMasked: maskCpf(cpfDigits),
            hiringUf: String(hiringUf || ''),
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
        });

        batch.set(auditRef, {
            tenantId,
            userId: uid,
            userEmail: profile.email || uid,
            action: 'SOLICITATION_CREATED',
            target: caseRef.id,
            detail: `Nova solicitacao criada para ${candidateName}`,
            timestamp: FieldValue.serverTimestamp(),
        });

        await batch.commit();

        return {
            caseId: caseRef.id,
            candidateId: candidateRef.id,
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
        const auditRef = db.collection('auditLogs').doc();
        const batch = db.batch();
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
            // Without this, old statuses (DONE/BLOCKED/SKIPPED) block rerunEnrichmentPhase
            // and enrichJuditOnCase (onDocumentCreated) never re-fires on an existing doc.
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

        batch.set(auditRef, {
            tenantId: profile.tenantId,
            userId: uid,
            userEmail: profile.email || uid,
            action: 'CASE_CORRECTED',
            target: caseId,
            detail: `Caso corrigido e reenviado: ${String(candidateName).trim()}`,
            timestamp: FieldValue.serverTimestamp(),
        });

        await batch.commit();

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
        const auditRef = db.collection('auditLogs').doc();
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

        batch.set(auditRef, {
            tenantId: profile.tenantId,
            userId: uid,
            userEmail: profile.email || uid,
            action: 'EXPORT_CREATED',
            target: `${type}:${scope}`,
            detail: `Exportacao gerada com ${Number(records) || 0} registros`,
            timestamp: FieldValue.serverTimestamp(),
        });

        await batch.commit();

        return { exportId: exportRef.id };
    },
);

exports.backfillClientCasesMirror = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 540 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
        await getOpsUserProfile(uid);

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
        const rawHtml = String(request.data?.html || '');
        if (!rawHtml.trim()) {
            throw new HttpsError('invalid-argument', 'HTML do relatorio ausente.');
        }

        const html = sanitizePublicReportHtml(rawHtml);
        if (!html.trim()) {
            throw new HttpsError('invalid-argument', 'HTML do relatorio ficou vazio apos sanitizacao.');
        }

        const meta = sanitizePublicReportMeta(request.data?.meta || {});
        const TTL_DAYS = 30;
        const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
        const reportRef = db.collection('publicReports').doc();

        await reportRef.set({
            html,
            createdAt: FieldValue.serverTimestamp(),
            expiresAt,
            ...meta,
        });

        await db.collection('auditLogs').add({
            tenantId: null,
            userId: uid,
            userEmail: profile.email || uid,
            action: 'PUBLIC_REPORT_CREATED',
            target: reportRef.id,
            detail: `Relatorio publico gerado${meta.candidateName ? ` para ${meta.candidateName}` : ''}`,
            timestamp: FieldValue.serverTimestamp(),
        });

        return {
            token: reportRef.id,
            expiresAt: expiresAt.toISOString(),
        };
    },
);

const ALLOWED_CONCLUDE_FIELDS = new Set([
    'assigneeId',
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
    'analystComment',
    'riskLevel',
    'riskScore',
    'enabledPhases',
    'hasNotes',
]);

const ALLOWED_DRAFT_FIELDS = new Set([
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
    'analystComment',
]);

function pickConcludePayload(payload = {}) {
    const result = {};
    for (const [key, value] of Object.entries(payload || {})) {
        if (ALLOWED_CONCLUDE_FIELDS.has(key)) {
            result[key] = value;
        }
    }
    result.status = 'DONE';
    result.correctionReason = FieldValue.delete();
    result.correctionNotes = FieldValue.delete();
    result.correctionRequestedAt = FieldValue.delete();
    result.correctionRequestedBy = FieldValue.delete();
    result.updatedAt = FieldValue.serverTimestamp();
    return result;
}

function pickDraftPayload(payload = {}) {
    const result = {};
    for (const [key, value] of Object.entries(payload || {})) {
        if (ALLOWED_DRAFT_FIELDS.has(key)) {
            result[key] = value;
        }
    }
    result.draftSavedAt = new Date().toISOString();
    result.updatedAt = FieldValue.serverTimestamp();
    return result;
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
        await caseRef.update({
            assigneeId: uid,
            status: 'IN_PROGRESS',
            updatedAt: FieldValue.serverTimestamp(),
        });

        await db.collection('auditLogs').add({
            tenantId: caseData.tenantId || null,
            userId: uid,
            userEmail: profile.email || uid,
            action: 'CASE_ASSIGNED',
            target: caseId,
            detail: `Caso assumido: ${caseData.candidateName || caseId}`,
            timestamp: FieldValue.serverTimestamp(),
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

        await caseRef.update({
            status: 'CORRECTION_NEEDED',
            correctionReason: reason,
            correctionNotes: notes,
            correctionRequestedAt: new Date().toISOString(),
            correctionRequestedBy: profile.email || uid,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await db.collection('auditLogs').add({
            tenantId: caseData.tenantId || null,
            userId: uid,
            userEmail: profile.email || uid,
            action: 'CASE_RETURNED',
            target: caseId,
            detail: `Caso devolvido: ${reason}`,
            timestamp: FieldValue.serverTimestamp(),
        });

        return { success: true };
    },
);

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
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
        const caseData = caseDoc.data() || {};

        const updatePayload = pickConcludePayload(payload);
        if (!updatePayload.assigneeId) {
            updatePayload.assigneeId = caseData.assigneeId || uid;
        }

        // Hard facts validation: block conclusion if Judit found active warrants but warrantFlag is unresolved
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

        await caseRef.update(updatePayload);

        await db.collection('auditLogs').add({
            tenantId: caseData.tenantId || null,
            userId: uid,
            userEmail: profile.email || uid,
            action: 'CASE_CONCLUDED',
            target: caseId,
            detail: `Caso concluido para ${caseData.candidateName || caseId}`,
            timestamp: FieldValue.serverTimestamp(),
        });

        return { success: true };
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

        const payload = {
            analysisConfig,
            updatedAt: FieldValue.serverTimestamp(),
            dailyLimit: limits.dailyLimit ?? null,
            monthlyLimit: limits.monthlyLimit ?? null,
        };
        if (enrichmentConfig !== undefined) {
            payload.enrichmentConfig = enrichmentConfig;
        }

        await db.collection('tenantSettings').doc(tenantId).set(payload, { merge: true });

        await db.collection('auditLogs').add({
            tenantId,
            userId: uid,
            userEmail: profile.email || uid,
            action: 'TENANT_CONFIG_UPDATED',
            target: tenantId,
            detail: `Configuracoes atualizadas para ${tenantId}`,
            timestamp: FieldValue.serverTimestamp(),
        });

        return { success: true };
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

        const updatePayload = pickDraftPayload(payload);
        await caseRef.update(updatePayload);

        await db.collection('auditLogs').add({
            tenantId: caseData.tenantId || null,
            userId: uid,
            userEmail: profile.email || uid,
            action: 'CASE_DRAFT_SAVED',
            target: caseId,
            detail: `Rascunho salvo para ${caseData.candidateName || caseId}`,
            timestamp: FieldValue.serverTimestamp(),
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

        await caseRef.update({
            aiDecision: decision,
            updatedAt: FieldValue.serverTimestamp(),
        });

        await db.collection('auditLogs').add({
            tenantId: caseData.tenantId || null,
            userId: uid,
            userEmail: profile.email || uid,
            action: 'AI_DECISION_SET',
            target: caseId,
            detail: `Decisao IA atualizada para ${decision} em ${caseData.candidateName || caseId}`,
            timestamp: FieldValue.serverTimestamp(),
        });

        return { success: true };
    },
);

/* =========================================================
   RE-RUN AI ANALYSIS — Callable function for analysts
   Rate limited: max 3 runs per case, min 1 min between runs.
   ========================================================= */

const OPS_ROLES = new Set(['analyst', 'supervisor', 'admin']);
const CLIENT_REQUESTER_ROLES = new Set(['CLIENT', 'client_manager']);
const CLIENT_VIEW_ROLES = new Set(['CLIENT', 'client_viewer', 'client_manager']);

async function getOpsUserProfile(uid) {
    const profileDoc = await db.collection('userProfiles').doc(uid).get();
    if (!profileDoc.exists || !OPS_ROLES.has(profileDoc.data().role)) {
        throw new HttpsError('permission-denied', 'Apenas analistas podem re-executar fases do pipeline.');
    }
    return profileDoc.data();
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

function sanitizePublicReportMeta(meta = {}) {
    return {
        type: ['single', 'batch'].includes(meta.type) ? meta.type : 'single',
        candidateName: String(meta.candidateName || '').trim().slice(0, 160),
    };
}

async function enforceTenantSubmissionLimits(tenantId, settings) {
    const now = new Date();
    const dayKey = formatDateKey(now);
    const monthKey = formatMonthKey(now);
    if (!settings?.dailyLimit && !settings?.monthlyLimit) return;

    const snapshot = await db.collection('cases')
        .where('tenantId', '==', tenantId)
        .orderBy('createdAt', 'desc')
        .limit(2000)
        .select('createdAt', 'createdDateKey', 'createdMonthKey')
        .get();

    let dailyCount = 0;
    let monthlyCount = 0;
    snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const createdAtDate = asDate(data.createdAt);
        const currentDayKey = data.createdDateKey || (createdAtDate ? formatDateKey(createdAtDate) : null);
        const currentMonthKey = data.createdMonthKey || (createdAtDate ? formatMonthKey(createdAtDate) : null);
        if (settings.dailyLimit && currentDayKey === dayKey) dailyCount += 1;
        if (settings.monthlyLimit && currentMonthKey === monthKey) monthlyCount += 1;
    });

    if (settings.dailyLimit && dailyCount >= settings.dailyLimit) {
        throw new HttpsError('resource-exhausted', `Limite diario de ${settings.dailyLimit} consultas atingido. Tente novamente amanha.`);
    }
    if (settings.monthlyLimit && monthlyCount >= settings.monthlyLimit) {
        throw new HttpsError('resource-exhausted', `Limite mensal de ${settings.monthlyLimit} consultas atingido. Entre em contato com o administrador.`);
    }
}

async function rerunAiForCase(caseRef, caseId, caseData, uid, profile) {
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
    await caseRef.update(updatePayload);

    await db.collection('auditLogs').add({
        tenantId: caseData.tenantId,
        userId: uid,
        userEmail: profile.email || uid,
        action: 'AI_RERUN',
        target: caseId,
        detail: JSON.stringify({
            model: aiResult.model,
            cost: updatePayload.aiCostUsd,
            structuredOk: aiResult.structuredOk,
            runNumber: aiRunCount + 1,
            error: aiResult.error || null,
            homonymDecision: updatePayload.aiHomonymDecision || null,
            homonymConfidence: updatePayload.aiHomonymConfidence || null,
            homonymError: updatePayload.aiHomonymError || null,
        }),
        timestamp: FieldValue.serverTimestamp(),
    });

    return {
        success: !aiResult.error,
        phase: 'ai',
        status: aiResult.error ? 'FAILED' : 'DONE',
        structured: aiResult.structured || null,
        structuredOk: aiResult.structuredOk || false,
        homonymStructured: homonymResult?.structured || null,
        homonymStructuredOk: homonymResult?.structuredOk || false,
        error: aiResult.error || null,
    };
}

exports.rerunAiAnalysis = onCall(
    { region: 'southamerica-east1' },
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

        return rerunAiForCase(caseRef, caseId, caseDoc.data() || {}, uid, profile);
    },
);

exports.rerunEnrichmentPhase = onCall(
    { region: 'southamerica-east1', timeoutSeconds: 540 },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const { caseId, phase } = request.data || {};
        if (!caseId || typeof caseId !== 'string') {
            throw new HttpsError('invalid-argument', 'caseId obrigatorio.');
        }
        if (!['fontedata', 'escavador', 'judit', 'ai'].includes(phase)) {
            throw new HttpsError('invalid-argument', 'Fase invalida para rerun.');
        }

        const profile = await getOpsUserProfile(uid);
        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');

        const caseData = caseDoc.data() || {};
        if (phase === 'ai') {
            return rerunAiForCase(caseRef, caseId, caseData, uid, profile);
        }

        if (caseData.status === 'DONE' || caseData.status === 'CORRECTION_NEEDED') {
            throw new HttpsError('failed-precondition', 'Nao e permitido reexecutar enriquecimento em casos concluidos ou devolvidos.');
        }

        const phaseMeta = {
            fontedata: { statusField: 'enrichmentStatus', errorField: 'enrichmentError', label: 'FonteData' },
            escavador: { statusField: 'escavadorEnrichmentStatus', errorField: 'escavadorError', label: 'Escavador' },
            judit: { statusField: 'juditEnrichmentStatus', errorField: 'juditError', label: 'Judit' },
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

        const refreshedDoc = await caseRef.get();
        const refreshedData = refreshedDoc.data() || {};
        const afterStatus = refreshedData[meta.statusField] || beforeStatus;
        const afterError = refreshedData[meta.errorField] || null;

        await db.collection('auditLogs').add({
            tenantId: refreshedData.tenantId,
            userId: uid,
            userEmail: profile.email || uid,
            action: 'ENRICHMENT_PHASE_RERUN',
            target: caseId,
            detail: JSON.stringify({
                phase,
                beforeStatus,
                afterStatus,
                error: afterError,
            }),
            timestamp: FieldValue.serverTimestamp(),
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
   JUDIT WEBHOOK HANDLER — Receives async results from Judit
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
    { region: 'southamerica-east1', cors: false },
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
   JUDIT ASYNC FALLBACK — Polls stale webhook-pending phases
   Runs every 10 minutes. If a case has been waiting for a webhook
   callback for more than 10 minutes, falls back to direct polling.
   ========================================================= */

const JUDIT_WEBHOOK_STALE_MS = 10 * 60 * 1000; // 10 minutes

exports.juditAsyncFallback = onSchedule(
    { schedule: 'every 10 minutes', region: 'southamerica-east1', timeoutSeconds: 300 },
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
                        // Hard timeout — request never completed after 30 min
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
                    // Request still pending and within acceptable window — skip, will retry next run
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

                // Request is completed — now safely fetch responses
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

                // Successfully fetched responses — process them like the webhook would
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
                            console.log(`[Judit Fallback]: auto-classify skipped for case ${caseId} — Escavador still pending.`);
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
};
