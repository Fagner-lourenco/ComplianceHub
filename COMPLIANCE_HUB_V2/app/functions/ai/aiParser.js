/**
 * AI response parsing with 4-layer fallback strategy.
 */

const { isStringArray } = require('../utils/stringUtils');
const {
    sanitizeAiStructured,
    sanitizeAiHomonymStructured,
    sanitizeAiPrefillStructured,
} = require('./aiSanitizer');

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

module.exports = {
    parseJsonSchemaResponse,
    extractFallbackAiResponse,
    extractFallbackAiHomonymResponse,
    extractFallbackAiPrefillResponse,
    parseAiResponse,
    parseAiHomonymResponse,
    parseAiPrefillResponse,
    validateAiSchema,
    validateAiHomonymSchema,
    validateAiPrefillSchema,
};
