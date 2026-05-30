/**
 * aiParsers.js — Parsing, sanitização e validação de respostas da OpenAI
 * Extraído do monolito index.js durante refatoração Phase C
 */

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

function stripInvalidControlChars(text) {
    if (typeof text !== 'string') return text;
    return Array.from(text, (char) => {
        const code = char.charCodeAt(0);
        return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127 ? ' ' : char;
    }).join('');
}

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
    const validCriminalFlags = ['NEGATIVE', 'NEGATIVE_PARTIAL', 'POSITIVE', 'INCONCLUSIVE', 'INCONCLUSIVE_HOMONYM', 'INCONCLUSIVE_LOW_COVERAGE', 'NOT_FOUND'];
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

/**
 * Normaliza caracteres Unicode problematicos para ASCII equivalente.
 * Previne mojibake em browsers/editores com encoding incorreto.
 */
function normalizeUnicodeToAscii(text) {
    if (!text || typeof text !== 'string') return text;
    return text
        .replace(/[\u2018\u2019]/g, "'")   // smart single quotes → apostrophe
        .replace(/[\u201C\u201D]/g, '"')   // smart double quotes → straight quotes
        .replace(/\u2014/g, '--')           // em-dash → double hyphen
        .replace(/\u2013/g, '-')            // en-dash → hyphen
        .replace(/\u2026/g, '...')          // ellipsis → three dots
        .replace(/\u00A0/g, ' ');           // non-breaking space → regular space
}

function fixLatinMojibake(text) {
    if (!text || typeof text !== 'string') return text;
    // Heuristica: se nao ha padroes tipicos de mojibake latino, retorna como esta
    if (!/\u00C3[\u0080-\u00BF]/.test(text)) {
        return text;
    }
    const map = {
        '\u00C3\u00A1': '\u00E1', '\u00C3\u00A9': '\u00E9', '\u00C3\u00AD': '\u00ED',
        '\u00C3\u00B3': '\u00F3', '\u00C3\u00BA': '\u00FA', '\u00C3\u00A0': '\u00E0',
        '\u00C3\u00A8': '\u00E8', '\u00C3\u00AC': '\u00EC', '\u00C3\u00B2': '\u00F2',
        '\u00C3\u00B9': '\u00F9', '\u00C3\u00A2': '\u00E2', '\u00C3\u00AA': '\u00EA',
        '\u00C3\u00AE': '\u00EE', '\u00C3\u00B4': '\u00F4', '\u00C3\u00BB': '\u00FB',
        '\u00C3\u00A3': '\u00E3', '\u00C3\u00B5': '\u00F5', '\u00C3\u00A7': '\u00E7',
        '\u00C3\u0080': '\u00C0', '\u00C3\u0081': '\u00C1', '\u00C3\u0082': '\u00C2',
        '\u00C3\u0083': '\u00C3', '\u00C3\u0084': '\u00C4', '\u00C3\u0085': '\u00C5',
        '\u00C3\u0086': '\u00C6', '\u00C3\u0087': '\u00C7', '\u00C3\u0088': '\u00C8',
        '\u00C3\u0089': '\u00C9', '\u00C3\u008A': '\u00CA', '\u00C3\u008B': '\u00CB',
        '\u00C3\u008C': '\u00CC', '\u00C3\u008D': '\u00CD', '\u00C3\u008E': '\u00CE',
        '\u00C3\u008F': '\u00CF', '\u00C3\u0091': '\u00D1', '\u00C3\u0092': '\u00D2',
        '\u00C3\u0093': '\u00D3', '\u00C3\u0094': '\u00D4', '\u00C3\u0095': '\u00D5',
        '\u00C3\u0096': '\u00D6', '\u00C3\u0098': '\u00D8', '\u00C3\u0099': '\u00D9',
        '\u00C3\u009A': '\u00DA', '\u00C3\u009B': '\u00DB', '\u00C3\u009C': '\u00DC',
        '\u00C3\u009D': '\u00DD', '\u00C3\u009F': '\u00DF',
    };
    let result = text;
    for (const [from, to] of Object.entries(map)) {
        result = result.split(from).join(to);
    }
    return result;
}

/**
 * Sanitize AI response - remove any CPF/phone numbers the model may hallucinate.
 */
function sanitizeAiOutput(text) {
    if (!text) return text;
    return stripInvalidControlChars(fixLatinMojibake(normalizeUnicodeToAscii(text)))
        .replace(/<[^>]*>/g, '')
        .replace(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, '[CPF_REMOVIDO]')
        .replace(/(?<!\d)\(?\d{2}\)?\s?\d{4,5}-?\d{4}(?!\d)/g, '[TEL_REMOVIDO]');
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