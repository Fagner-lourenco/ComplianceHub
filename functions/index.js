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

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
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
        processos: true,
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

/* =========================================================
   AI ANALYSIS — Structured JSON output with anti-hallucination
   Runs AFTER all providers complete (FonteData + Escavador + Judit)
   ========================================================= */

const AI_MODEL = 'gpt-5.4-nano';
const AI_MAX_TOKENS = 1200;
const AI_PROMPT_VERSION = 'v2-structured';
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
    riscoHomonimo: 'ALTO|MEDIO|BAIXO|NENHUM',
    confianca: 'ALTO|MEDIO|BAIXO',
    sugestaoScore: '0-100',
    sugestaoVeredito: 'FIT|ATTENTION|NOT_RECOMMENDED',
    justificativa: 'string (max 300 chars)',
    alertas: ['string'],
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

/**
 * Parse AI response with 4-layer fallback:
 * 1. Direct JSON.parse
 * 2. Extract JSON from markdown code block
 * 3. Regex field extraction from text
 * 4. Raw text fallback
 */
function parseAiResponse(content) {
    if (!content || typeof content !== 'string') {
        return { structured: null, raw: content || '', ok: false };
    }

    // Layer 1: direct parse
    try {
        const parsed = JSON.parse(content.trim());
        if (validateAiSchema(parsed)) return { structured: parsed, raw: content, ok: true };
        return { structured: parsed, raw: content, ok: false };
    } catch { /* continue */ }

    // Layer 2: extract from ```json ... ``` block
    const mdMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (mdMatch) {
        try {
            const parsed = JSON.parse(mdMatch[1].trim());
            if (validateAiSchema(parsed)) return { structured: parsed, raw: content, ok: true };
            return { structured: parsed, raw: content, ok: false };
        } catch { /* continue */ }
    }

    // Layer 3: regex extraction of key fields
    try {
        const extracted = {};
        const scoreMatch = content.match(/sugestaoScore['":\s]*(\d{1,3})/i);
        if (scoreMatch) extracted.sugestaoScore = Math.min(100, parseInt(scoreMatch[1]));
        const veredictoMatch = content.match(/sugestaoVeredito['":\s]*(FIT|ATTENTION|NOT_RECOMMENDED)/i);
        if (veredictoMatch) extracted.sugestaoVeredito = veredictoMatch[1].toUpperCase();
        const confiancaMatch = content.match(/confianca['":\s]*(ALTO|MEDIO|BAIXO)/i);
        if (confiancaMatch) extracted.confianca = confiancaMatch[1].toUpperCase();
        const riscoMatch = content.match(/riscoHomonimo['":\s]*(ALTO|MEDIO|BAIXO|NENHUM)/i);
        if (riscoMatch) extracted.riscoHomonimo = riscoMatch[1].toUpperCase();
        extracted.resumo = content.slice(0, 500);
        if (Object.keys(extracted).length > 2) {
            return { structured: extracted, raw: content, ok: false };
        }
    } catch { /* continue */ }

    // Layer 4: raw text fallback
    return { structured: null, raw: content, ok: false };
}

function validateAiSchema(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const validVereditos = ['FIT', 'ATTENTION', 'NOT_RECOMMENDED'];
    const validConfianca = ['ALTO', 'MEDIO', 'BAIXO'];
    const validRisco = ['ALTO', 'MEDIO', 'BAIXO', 'NENHUM'];
    if (typeof obj.resumo !== 'string') return false;
    if (obj.sugestaoVeredito && !validVereditos.includes(obj.sugestaoVeredito)) return false;
    if (obj.confianca && !validConfianca.includes(obj.confianca)) return false;
    if (obj.riscoHomonimo && !validRisco.includes(obj.riscoHomonimo)) return false;
    if (obj.sugestaoScore !== undefined && (typeof obj.sugestaoScore !== 'number' || obj.sugestaoScore < 0 || obj.sugestaoScore > 100)) return false;
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
    return payload;
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
    const region = 'southamerica-east1';
    const projectId = getProjectId();
    return `https://${region}-${projectId}.cloudfunctions.net/juditWebhook`;
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
function computeAiCacheKey(caseData) {
    const parts = [
        caseData.cpf || '',
        caseData.enrichmentStatus || '',
        caseData.escavadorEnrichmentStatus || '',
        caseData.juditEnrichmentStatus || '',
        caseData.escavadorProcessTotal || 0,
        caseData.juditProcessTotal || 0,
        caseData.criminalFlag || '',
        caseData.warrantFlag || '',
        caseData.laborFlag || '',
    ].join('|');
    // Simple hash
    let hash = 0;
    for (let i = 0; i < parts.length; i++) {
        hash = ((hash << 5) - hash + parts.charCodeAt(i)) | 0;
    }
    return `ai_${Math.abs(hash).toString(36)}`;
}

async function runAiAnalysis(caseData, apiKey, options = {}) {
    const { skipCache = false } = options;

    // Circuit breaker check
    if (Date.now() < _aiCircuitOpenUntil) {
        console.warn('AI circuit breaker OPEN — skipping analysis.');
        return { error: 'Circuit breaker aberto. IA temporariamente desativada.', inputTokens: 0, outputTokens: 0 };
    }

    const prompt = buildAiPrompt(caseData);
    const inputEstimate = Math.ceil(prompt.length / 3.5);
    const caseRef = db.collection('cases').doc(caseData.id || caseData._caseId);

    // Check cache (subcollection aiCache/latest)
    if (!skipCache) {
        try {
            const cacheDoc = await caseRef.collection('aiCache').doc('latest').get();
            if (cacheDoc.exists) {
                const cached = cacheDoc.data();
                const cacheAge = Date.now() - (cached.cachedAt?.toMillis?.() || 0);
                const cacheKey = computeAiCacheKey(caseData);
                if (cacheAge < AI_CACHE_TTL_MS && cached.cacheKey === cacheKey) {
                    console.log(`AI cache HIT for case (age: ${Math.round(cacheAge / 60000)}min)`);
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
            console.warn('AI cache read failed:', cacheErr.message);
        }
    }

    // Retry with backoff: 1 retry on 429 or 5xx
    let lastError = null;
    let shouldTripCircuit = false;
    for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
            await new Promise(r => setTimeout(r, 2000));
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
                        { role: 'system', content: AI_SYSTEM_MESSAGE },
                        { role: 'user', content: prompt },
                    ],
                }),
                signal: controller.signal,
            });

            clearTimeout(timer);

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                lastError = formatOpenAiError(response.status, body);
                console.error(`AI analysis attempt ${attempt + 1} failed: ${response.status} ${body}`);
                // Retry on 429 or 5xx
                if (response.status === 429 || response.status >= 500) {
                    shouldTripCircuit = true;
                    continue;
                }
                // Non-retryable error
                return { error: lastError, inputTokens: inputEstimate, outputTokens: 0 };
            }

            // Success — reset circuit breaker
            _aiCircuitFailures = 0;

            const json = await response.json();
            const usage = json.usage || {};
            const rawContent = json.choices?.[0]?.message?.content || '';
            const sanitized = sanitizeAiOutput(rawContent);
            const parsed = parseAiResponse(sanitized);

            const result = {
                analysis: sanitized,
                structured: parsed.structured,
                structuredOk: parsed.ok,
                inputTokens: usage.prompt_tokens || inputEstimate,
                outputTokens: usage.completion_tokens || Math.ceil(rawContent.length / 3.5),
                model: AI_MODEL,
                fromCache: false,
            };

            // Write to cache subcollection (non-blocking)
            const cacheKey = computeAiCacheKey(caseData);
            caseRef.collection('aiCache').doc('latest').set({
                aiRawResponse: result.analysis,
                aiStructured: result.structured || null,
                aiStructuredOk: result.structuredOk,
                aiModel: result.model,
                aiTokens: { input: result.inputTokens, output: result.outputTokens },
                cacheKey,
                cachedAt: FieldValue.serverTimestamp(),
            }).catch(err => console.warn('AI cache write failed:', err.message));

            return result;
        } catch (err) {
            lastError = formatAiRuntimeError(err);
            shouldTripCircuit = true;
            console.error(`AI analysis attempt ${attempt + 1} error:`, err.message);
        }
    }

    // All retries exhausted
    if (shouldTripCircuit) {
        _aiCircuitFailures++;
        if (_aiCircuitFailures >= AI_CIRCUIT_THRESHOLD) {
            _aiCircuitOpenUntil = Date.now() + AI_CIRCUIT_COOLDOWN_MS;
            console.error('AI circuit breaker OPENED after consecutive failures.');
        }
    }
    return { error: lastError, inputTokens: inputEstimate, outputTokens: 0 };
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

    // Auto-classification results
    if (caseData.criminalFlag) parts.push('', '--- AUTO-CLASSIFICACAO ---',
        `Criminal: ${caseData.criminalFlag}`,
        `Mandado: ${caseData.warrantFlag || 'N/A'}`,
        `Trabalhista: ${caseData.laborFlag || 'N/A'}`);
    if (caseData.criminalNotes) parts.push(`Notas criminal: ${caseData.criminalNotes.slice(0, 300)}`);
    if (caseData.warrantNotes) parts.push(`Notas mandado: ${caseData.warrantNotes.slice(0, 300)}`);
    if (caseData.laborNotes) parts.push(`Notas trabalhista: ${caseData.laborNotes.slice(0, 300)}`);

    parts.push('', 'Analise todos os dados acima e responda EXCLUSIVAMENTE no JSON conforme o schema solicitado.');
    return parts.join('\n');
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

        const options = {
            limit: 100,
            incluirHomonimos: filters.incluirHomonimos !== false,
            tribunais: tribunais.length > 0 ? tribunais : undefined,
            status: filters.status || undefined,
        };

        console.log(`Case ${caseId} [Escavador]: querying CPF=${cpf}, UFs=${ufs.join(',')}, tribunais=${tribunais.join(',') || 'all'}`);

        const rawItems = await queryProcessosByPerson(cpf, token, options);
        const normalized = normalizeEscavadorProcessos(rawItems, cpf);
        const { _source, ...fields } = normalized;

        await caseRef.update({
            ...fields,
            escavadorEnrichmentStatus: 'DONE',
            escavadorError: null,
            escavadorSources: _source,
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
    const juditSources = {};
    const juditRawPayloads = {};  // persist request bodies + raw responses for audit
    const juditRequestIds = { ...(caseData.juditRequestIds || {}) };
    const pendingAsyncPhases = [];
    const pendingWebhookRegistrations = [];
    if (gateEntityData) {
        juditSources.entity = gateEntityData._source;
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
                            if (value !== undefined && value !== null && !updatePayload[field]) {
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
    if (tenantId) {
        try {
            const tenantData = await getTenantSettingsData(tenantId);
            if (tenantData) {
                aiEnabled = tenantData.enrichmentConfig?.ai?.enabled === true;

                if (aiEnabled && tenantData.enrichmentConfig?.ai?.monthlyBudgetUsd) {
                    const budget = tenantData.enrichmentConfig.ai.monthlyBudgetUsd;
                    const now = new Date();
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    const costSnapshot = await db.collection('cases')
                        .where('tenantId', '==', tenantId)
                        .where('aiExecutedAt', '>=', monthStart)
                        .select('aiCostUsd')
                        .get();
                    let totalCost = 0;
                    costSnapshot.forEach((docSnap) => {
                        totalCost += docSnap.data().aiCostUsd || 0;
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

    if (aiEnabled) {
        try {
            const aiKey = openaiApiKey.value();
            if (aiKey) {
                const caseDataForAi = { ...freshData, ...autoClassification, _caseId: caseId };
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
            }
        } catch (aiErr) {
            console.error(`Case ${caseId} [AI]: error:`, aiErr.message);
            updatePayload.aiError = aiErr.message;
        }
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
    const notes = [];

    const fontedataCriminal = (caseData.fontedataCriminalFlag || caseData.criminalFlag) === 'POSITIVE';
    const escavadorCriminal = caseData.escavadorCriminalFlag === 'POSITIVE';
    const juditCriminal = caseData.juditCriminalFlag === 'POSITIVE';
    const escavadorCount = caseData.escavadorCriminalCount || 0;
    const juditCount = caseData.juditCriminalCount || 0;
    const hasHomonyms = caseData.juditHomonymFlag || false;
    const escavadorFailed = caseData.escavadorEnrichmentStatus === 'FAILED';
    const juditFailed = caseData.juditEnrichmentStatus === 'FAILED';
    const fontedataFailed = caseData.enrichmentStatus === 'FAILED';

    if (fontedataCriminal || escavadorCriminal || juditCriminal) {
        if (hasHomonyms && !juditCriminal && !fontedataCriminal) {
            result.criminalFlag = 'INCONCLUSIVE';
            notes.push('Criminal INCONCLUSIVO: processos criminais encontrados via Escavador, mas ha possiveis homonimos.');
        } else {
            result.criminalFlag = 'POSITIVE';
            const sources = [];
            if (fontedataCriminal) sources.push('FonteData');
            if (escavadorCriminal) sources.push(`Escavador (${escavadorCount})`);
            if (juditCriminal) sources.push(`Judit (${juditCount})`);
            notes.push(`Criminal POSITIVO confirmado por: ${sources.join(', ')}.`);
        }
    } else if (escavadorFailed && juditFailed && fontedataFailed) {
        result.criminalFlag = 'NOT_FOUND';
        notes.push('Criminal NAO ENCONTRADO: todas as APIs falharam.');
    } else if (escavadorFailed || juditFailed) {
        result.criminalFlag = 'NEGATIVE';
        const failedSources = [];
        if (escavadorFailed) failedSources.push('Escavador');
        if (juditFailed) failedSources.push('Judit');
        notes.push(`Criminal NEGATIVO (parcial, ${failedSources.join(' e ')} falhou).`);
    } else {
        result.criminalFlag = 'NEGATIVE';
        notes.push('Nenhum processo criminal/penal detectado em nenhuma fonte.');
    }

    if (result.criminalFlag === 'POSITIVE') {
        const totalCriminal = Math.max(escavadorCount, juditCount);
        if (totalCriminal >= 5) result.criminalSeverity = 'HIGH';
        else if (totalCriminal >= 2) result.criminalSeverity = 'MEDIUM';
        else result.criminalSeverity = 'LOW';
    }

    const juditWarrantPositive = caseData.juditWarrantFlag === 'POSITIVE';
    const juditWarrantInconclusive = caseData.juditWarrantFlag === 'INCONCLUSIVE';
    const juditActiveWarrants = caseData.juditActiveWarrantCount || 0;
    const juditTotalWarrants = caseData.juditWarrantCount || 0;
    const fontedataWarrant = (caseData.fontedataWarrantFlag || caseData.warrantFlag) === 'POSITIVE';
    const juditExecutionPositive = caseData.juditExecutionFlag === 'POSITIVE';
    const warrantSourceFailed = juditFailed && caseData.enrichmentSources?.warrant?.error;

    if (juditWarrantPositive || fontedataWarrant) {
        result.warrantFlag = 'POSITIVE';
        const parts = [];
        if (juditActiveWarrants > 0) parts.push(`${juditActiveWarrants} mandado(s) ativo(s) via Judit`);
        if (fontedataWarrant) parts.push('detectado via FonteData');
        notes.push(`Mandado POSITIVO: ${parts.join(', ')}.`);
        if (caseData.juditWarrantNotes) notes.push(caseData.juditWarrantNotes);
    } else if (juditWarrantInconclusive) {
        result.warrantFlag = 'INCONCLUSIVE';
        notes.push(`Mandado INCONCLUSIVO: ${juditTotalWarrants} mandado(s) encontrado(s) mas nenhum com status pendente.`);
        if (caseData.juditWarrantNotes) notes.push(caseData.juditWarrantNotes);
    } else if (warrantSourceFailed) {
        result.warrantFlag = 'NOT_FOUND';
        notes.push('Mandado NAO ENCONTRADO: consulta Judit falhou.');
    } else {
        result.warrantFlag = 'NEGATIVE';
        notes.push('Nenhum mandado de prisao encontrado.');
    }

    const fontedataLabor = (caseData.fontedataLaborFlag || caseData.laborFlag) === 'POSITIVE';
    const escavadorProcessos = caseData.escavadorProcessos || [];
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const escavadorLabor = escavadorProcessos.some((processo) => /trabalh/i.test(processo.area || ''));
    const juditLabor = juditRoleSummary.some((role) => /trabalh/i.test(role.area || ''));
    const laborSourceFailed = fontedataFailed && caseData.enrichmentSources?.labor?.error;

    if (fontedataLabor || escavadorLabor || juditLabor) {
        result.laborFlag = 'POSITIVE';
        const sources = [];
        if (fontedataLabor) sources.push('FonteData TRT');
        if (escavadorLabor) sources.push('Escavador');
        if (juditLabor) sources.push('Judit');
        notes.push(`Trabalhista POSITIVO confirmado por: ${sources.join(', ')}.`);
    } else if (laborSourceFailed && !escavadorLabor && !juditLabor) {
        result.laborFlag = 'NOT_FOUND';
        notes.push('Trabalhista NAO ENCONTRADO: consulta FonteData TRT falhou.');
    } else {
        result.laborFlag = 'NEGATIVE';
        notes.push('Nenhum processo trabalhista detectado.');
    }

    result.criminalNotes = notes.filter((note) => /criminal|penal/i.test(note)).join('\n');
    result.warrantNotes = notes.filter((note) => /mandado/i.test(note)).join('\n');
    result.laborNotes = notes.filter((note) => /trabalh/i.test(note)).join('\n');

    result.enrichmentOriginalValues = {
        ...enrichmentOriginalValues,
        criminalFlag: result.criminalFlag,
        warrantFlag: result.warrantFlag,
        laborFlag: result.laborFlag,
        criminalNotes: result.criminalNotes,
        warrantNotes: result.warrantNotes,
        laborNotes: result.laborNotes,
    };
    if (result.criminalSeverity) {
        result.enrichmentOriginalValues.criminalSeverity = result.criminalSeverity;
    }

    if (juditExecutionPositive) {
        result.criminalNotes += `\nExecucao penal detectada via Judit (${caseData.juditExecutionCount || 0}).`;
        if (caseData.juditExecutionNotes) result.criminalNotes += `\n${caseData.juditExecutionNotes}`;
        if (result.criminalFlag !== 'POSITIVE') result.criminalFlag = 'POSITIVE';
        result.enrichmentOriginalValues.criminalFlag = result.criminalFlag;
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

const PUBLIC_RESULT_FIELDS = [
    'candidateName', 'cpfMasked', 'candidatePosition', 'hiringUf', 'tenantId', 'createdAt',
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

exports.publishResultOnCaseDone = onDocumentUpdated(
    { document: 'cases/{caseId}', region: 'southamerica-east1' },
    async (event) => {
        const before = event.data?.before?.data();
        const after = event.data?.after?.data();
        if (!before || !after) return;

        // Guard: only fire when status transitions to DONE
        if (before.status === 'DONE' || after.status !== 'DONE') return;

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
   RE-RUN AI ANALYSIS — Callable function for analysts
   Rate limited: max 3 runs per case, min 1 min between runs.
   ========================================================= */

const OPS_ROLES = new Set(['analyst', 'supervisor', 'admin']);

async function getOpsUserProfile(uid) {
    const profileDoc = await db.collection('userProfiles').doc(uid).get();
    if (!profileDoc.exists || !OPS_ROLES.has(profileDoc.data().role)) {
        throw new HttpsError('permission-denied', 'Apenas analistas podem re-executar fases do pipeline.');
    }
    return profileDoc.data();
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

    const aiResult = await runAiAnalysis({ ...caseData, _caseId: caseId }, aiKey, { skipCache: true });
    const updatePayload = buildAiUpdatePayload(caseData, aiResult, { aiRunCount: aiRunCount + 1 });
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
        }),
        timestamp: FieldValue.serverTimestamp(),
    });

    return {
        success: !aiResult.error,
        phase: 'ai',
        status: aiResult.error ? 'FAILED' : 'DONE',
        structured: aiResult.structured || null,
        structuredOk: aiResult.structuredOk || false,
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
   Events: response_created (incremental), request_completed (final).

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
        if (!payload || !payload.request_id) {
            res.status(400).send('Missing request_id');
            return;
        }

        const { request_id: requestId, event_type: eventType } = payload;

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

        console.log(`[Judit Webhook]: event=${eventType || 'unknown'} for case=${caseId}, phase=${phaseType}, request=${requestId}`);

        if (eventType === 'request_completed') {
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
                console.error(`[Judit Webhook]: error processing request_completed for case ${caseId}:`, err.message);
            }
        }

        // Always respond 200 to Judit to avoid retries
        res.status(200).json({ ok: true, case_id: caseId, event: eventType });
    },
);
