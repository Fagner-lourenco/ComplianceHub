/**
 * AI structured output sanitization utilities.
 */

const { sanitizeAiOutput } = require('../utils/stringUtils');

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

module.exports = {
    sanitizeStructuredList,
    sanitizeStructuredText,
    sanitizeProcessAssessments,
    sanitizeAiStructured,
    sanitizeAiHomonymStructured,
    sanitizeAiPrefillStructured,
};
