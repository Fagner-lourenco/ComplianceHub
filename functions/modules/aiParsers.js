/**
 * aiParsers.js — Parsing, sanitização e validação de respostas da OpenAI
 * Extraído do monolito index.js durante refatoração Phase C
 */

const {
    isStringArray,
    sanitizeStructuredList,
    sanitizeStructuredText,
    stripInvalidControlChars,
    sanitizeAiOutput,
} = require('./_shared/sanitizers');

function looksLikeRawJsonOrTechnicalPayload(text) {
    if (typeof text !== 'string') return false;
    const normalized = text.trim();
    if (!normalized) return false;
    if (/^[{[]/.test(normalized)) return true;
    return /"?(summary|identityAssessment|classificationValidation|consultativeSuggestion|autoFlag|possibleErrors|manualReviewPoints|providerDivergence|hasExactCpfMatch|isDirectCpfMatch|matchType|isCriminal|isDefendant|criminalFlag|laborFlag|warrantFlag)"?\s*[:=]/i.test(normalized)
        || /\b(identityAssessment|classificationValidation|consultativeSuggestion|autoFlag|possibleErrors|manualReviewPoints|providerDivergence|hasExactCpfMatch|isDirectCpfMatch|matchType|isCriminal|isDefendant|criminalFlag|laborFlag|warrantFlag)\b/i.test(normalized)
        || /\b(HIGH_COVERAGE|PARTIAL_COVERAGE|LOW_COVERAGE|LOW_RISK_ROLE_ONLY|AGREE_WITH_CAUTION|INSUFFICIENT_DATA|MAINTAIN_AUTOCLASSIFICATION|REVIEW_BEFORE_CONCLUDING|CONTEST_AUTOCLASSIFICATION)\b/.test(normalized);
}

function sanitizeClassificationReviewText(value, maxLength = 500) {
    const text = sanitizeStructuredText(value, maxLength);
    return looksLikeRawJsonOrTechnicalPayload(text) ? '' : text;
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

function sanitizeClassificationReviewAxis(axis) {
    if (!axis || typeof axis !== 'object') return null;
    return {
        autoFlag: typeof axis.autoFlag === 'string' ? axis.autoFlag.toUpperCase() : (axis.autoFlag ?? null),
        assessment: typeof axis.assessment === 'string' ? axis.assessment.toUpperCase() : (axis.assessment ?? null),
        evidenceStrength: typeof axis.evidenceStrength === 'string' ? axis.evidenceStrength.toUpperCase() : (axis.evidenceStrength ?? null),
        rationale: sanitizeClassificationReviewText(axis.rationale, 400),
        possibleErrors: sanitizeStructuredList(axis.possibleErrors, 6, 220).filter((item) => !looksLikeRawJsonOrTechnicalPayload(item)),
    };
}

function sanitizeAiClassificationReviewStructured(structured) {
    if (!structured || typeof structured !== 'object') return structured;
    const validation = structured.classificationValidation || {};
    const identity = structured.identityAssessment || {};
    const suggestion = structured.consultativeSuggestion || {};
    return {
        summary: sanitizeClassificationReviewText(structured.summary, 700),
        identityAssessment: {
            status: typeof identity.status === 'string' ? identity.status.toUpperCase() : (identity.status ?? null),
            rationale: sanitizeClassificationReviewText(identity.rationale, 350),
            homonymRisk: typeof identity.homonymRisk === 'string' ? identity.homonymRisk.toUpperCase() : (identity.homonymRisk ?? null),
        },
        classificationValidation: {
            criminal: sanitizeClassificationReviewAxis(validation.criminal),
            labor: sanitizeClassificationReviewAxis(validation.labor),
            warrant: sanitizeClassificationReviewAxis(validation.warrant),
        },
        inconsistencies: sanitizeStructuredList(structured.inconsistencies, 8, 240).filter((item) => !looksLikeRawJsonOrTechnicalPayload(item)),
        manualReviewPoints: sanitizeStructuredList(structured.manualReviewPoints, 10, 240).filter((item) => !looksLikeRawJsonOrTechnicalPayload(item)),
        consultativeSuggestion: {
            action: typeof suggestion.action === 'string' ? suggestion.action.toUpperCase() : (suggestion.action ?? null),
            rationale: sanitizeClassificationReviewText(suggestion.rationale, 400),
        },
        confidence: typeof structured.confidence === 'string' ? structured.confidence.toUpperCase() : (structured.confidence ?? null),
    };
}

/**
 * Tenta reparar JSON malformado com state machine que corrige:
 * 1. Aspas duplas não escapadas dentro de strings — caso mais comum da OpenAI
 * 2. Vírgulas trailing antes de } e ]
 */
function attemptJsonRepair(raw) {
    // Tenta parse direto primeiro
    try { JSON.parse(raw); return raw; } catch { /* continua */ }

    // Fix 1: remove trailing commas
    let json = raw.replace(/,(\s*[}\]])/g, '$1');
    try { JSON.parse(json); return json; } catch { /* continua */ }

    // Fix 2: repara aspas não escapadas usando state machine
    // Regra: se estamos dentro de string e encontramos " não escapada,
    // olhamos o próximo char significativo (não whitespace).
    // Se for , } ] ou : → fecha string e sai do modo string.
    // Senão → aspa literal de conteúdo ⇒ escapa.
    let result = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];

        if (escaped) {
            result += ch;
            escaped = false;
            continue;
        }

        if (ch === '\\') {
            result += ch;
            escaped = true;
            continue;
        }

        if (ch === '"') {
            if (inString) {
                // Encontra o próximo caractere não-whitespace
                let j = i + 1;
                while (j < raw.length && /[ \t\r\n]/.test(raw[j])) j += 1;
                const next = j < raw.length ? raw[j] : '';

                if (next === ',' || next === '}' || next === ']' || next === ':') {
                    // Fim estrutural da string
                    inString = false;
                    result += ch;
                } else {
                    // Aspa literal dentro da string ⇒ escapa
                    result += '\\"';
                }
            } else {
                inString = true;
                result += ch;
            }
            continue;
        }

        result += ch;
    }

    try { JSON.parse(result); return result; } catch { return null; }
}

/**
 * Parse AI response with 4-layer fallback:
 * 1. Direct JSON.parse (with repair attempts)
 * 2. Extract JSON from markdown code block (with repair)
 * 3. Regex field extraction from text
 * 4. Raw text fallback
 */
function parseJsonSchemaResponse(content, validator, fallbackExtractor, sanitizer = (value) => value) {
    if (!content || typeof content !== 'string') {
        return { structured: null, raw: content || '', ok: false };
    }

    // Layer 1: Direct JSON.parse (with repair)
    try {
        let trimmed = content.trim();
        if (/^[{[]/.test(trimmed)) {
            let parsed;
            try {
                parsed = sanitizer(JSON.parse(trimmed));
            } catch (jsonErr) {
                const repaired = attemptJsonRepair(trimmed);
                if (repaired) {
                    console.warn('[AI_PARSE] Layer 1: JSON repaired');
                    parsed = sanitizer(JSON.parse(repaired));
                } else {
                    throw jsonErr;
                }
            }
            if (parsed && validator(parsed)) return { structured: parsed, raw: content, ok: true };
            console.warn('[AI_PARSE] Layer 1: JSON parsed, schema FAILED', { preview: trimmed.slice(0, 200), keys: Object.keys(parsed || {}).join(',') });
        }
    } catch (err) {
        console.warn('[AI_PARSE] Layer 1: JSON parse/repair failed', { error: err.message, preview: content.slice(0, 200) });
    }

    // Layer 2: Extract JSON from markdown code block (any position in text, with repair)
    const mdMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (mdMatch) {
        try {
            let inner = mdMatch[1].trim();
            let parsed;
            try {
                parsed = sanitizer(JSON.parse(inner));
            } catch (jsonErr) {
                const repaired = attemptJsonRepair(inner);
                if (repaired) {
                    console.warn('[AI_PARSE] Layer 2: JSON repaired');
                    parsed = sanitizer(JSON.parse(repaired));
                } else {
                    throw jsonErr;
                }
            }
            if (parsed && validator(parsed)) return { structured: parsed, raw: content, ok: true };
            console.warn('[AI_PARSE] Layer 2: JSON parsed, schema FAILED', { preview: inner.slice(0, 200), keys: Object.keys(parsed || {}).join(',') });
        } catch (err) {
            console.warn('[AI_PARSE] Layer 2: JSON parse/repair failed', { error: err.message, preview: mdMatch[1].slice(0, 200) });
        }
    }

    try {
        const extracted = sanitizer(fallbackExtractor?.(content) || null);
        if (extracted && Object.keys(extracted).length > 0) {
            return { structured: extracted, raw: content, ok: validator(extracted) };
        }
    } catch { /* continue */ }

    console.error('[AI_PARSE] All layers exhausted — returning ok=false', { preview: content.slice(0, 300) });
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
        const match = content.match(new RegExp(`${key}['":\\s]*([^\n]+)`, 'i'));
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

function extractFallbackAiClassificationReviewResponse(content) {
    // A classificacao revisora alimenta a UI principal. Se o JSON vier quebrado,
    // nao podemos transformar payload bruto em resumo operacional.
    void content;
    return null;
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

function parseAiClassificationReviewResponse(content) {
    return parseJsonSchemaResponse(stripInvalidControlChars(content), validateAiClassificationReviewSchema, extractFallbackAiClassificationReviewResponse, sanitizeAiClassificationReviewStructured);
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
    const textFields = ['executiveSummary', 'criminalNotes', 'laborNotes', 'warrantNotes', 'finalJustification'];
    for (const field of textFields) {
        if (obj[field] !== undefined && obj[field] !== null && typeof obj[field] !== 'string') return false;
    }
    if (obj.keyFindings !== undefined && obj.keyFindings !== null && !isStringArray(obj.keyFindings)) return false;
    return true;
}

function validateClassificationReviewAxis(axis, validFlags) {
    const validAssessments = ['AGREE', 'AGREE_WITH_CAUTION', 'DISAGREE', 'INSUFFICIENT_DATA'];
    const validStrength = ['STRONG', 'MIXED', 'WEAK', 'INSUFFICIENT'];
    if (!axis || typeof axis !== 'object') return false;
    if (axis.autoFlag && !validFlags.includes(axis.autoFlag)) return false;
    if (!validAssessments.includes(axis.assessment)) return false;
    if (!validStrength.includes(axis.evidenceStrength)) return false;
    if (typeof axis.rationale !== 'string') return false;
    if (!isStringArray(axis.possibleErrors)) return false;
    return true;
}

function validateAiClassificationReviewSchema(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const validIdentityStatus = ['CONFIRMED', 'ATTENTION', 'BLOCKED', 'UNKNOWN'];
    const validHomonymRisk = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'];
    const validSuggestionActions = ['MAINTAIN_AUTOCLASSIFICATION', 'REVIEW_BEFORE_CONCLUDING', 'CONTEST_AUTOCLASSIFICATION'];
    const validConfidence = ['HIGH', 'MEDIUM', 'LOW'];
    const validCriminalFlags = ['NEGATIVE', 'POSITIVE', 'INCONCLUSIVE', 'NOT_FOUND'];
    const validSimpleFlags = ['NEGATIVE', 'POSITIVE', 'INCONCLUSIVE', 'NOT_FOUND'];

    if (typeof obj.summary !== 'string') return false;
    if (!obj.identityAssessment || typeof obj.identityAssessment !== 'object') return false;
    if (!validIdentityStatus.includes(obj.identityAssessment.status)) return false;
    if (typeof obj.identityAssessment.rationale !== 'string') return false;
    if (!validHomonymRisk.includes(obj.identityAssessment.homonymRisk)) return false;

    const validation = obj.classificationValidation;
    if (!validation || typeof validation !== 'object') return false;
    if (!validateClassificationReviewAxis(validation.criminal, validCriminalFlags)) return false;
    if (!validateClassificationReviewAxis(validation.labor, validSimpleFlags)) return false;
    if (!validateClassificationReviewAxis(validation.warrant, validSimpleFlags)) return false;
    if (!isStringArray(obj.inconsistencies)) return false;
    if (!isStringArray(obj.manualReviewPoints)) return false;
    if (!obj.consultativeSuggestion || typeof obj.consultativeSuggestion !== 'object') return false;
    if (!validSuggestionActions.includes(obj.consultativeSuggestion.action)) return false;
    if (typeof obj.consultativeSuggestion.rationale !== 'string') return false;
    if (!validConfidence.includes(obj.confidence)) return false;
    return true;
}

module.exports = {
    isStringArray,
    sanitizeStructuredList,
    sanitizeStructuredText,
    stripInvalidControlChars,
    looksLikeRawJsonOrTechnicalPayload,
    sanitizeClassificationReviewText,
    sanitizeProcessAssessments,
    sanitizeAiStructured,
    sanitizeAiHomonymStructured,
    sanitizeAiPrefillStructured,
    sanitizeClassificationReviewAxis,
    sanitizeAiClassificationReviewStructured,
    sanitizeAiOutput,
    attemptJsonRepair,
    parseJsonSchemaResponse,
    extractFallbackAiResponse,
    extractFallbackAiHomonymResponse,
    extractFallbackAiPrefillResponse,
    extractFallbackAiClassificationReviewResponse,
    parseAiResponse,
    parseAiHomonymResponse,
    parseAiPrefillResponse,
    parseAiClassificationReviewResponse,
    validateAiSchema,
    validateAiHomonymSchema,
    validateAiPrefillSchema,
    validateClassificationReviewAxis,
    validateAiClassificationReviewSchema,
};
