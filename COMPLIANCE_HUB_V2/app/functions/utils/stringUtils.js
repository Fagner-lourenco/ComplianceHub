/**
 * String and text sanitization utilities.
 */

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

/**
 * Sanitize AI response — remove any CPF/phone numbers the model may hallucinate.
 */
function sanitizeAiOutput(text) {
    if (!text) return text;
    return text
        .replace(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, '[CPF_REMOVIDO]')
        .replace(/(?<!\d)\(?(\d{2})\)?\s?\d{4,5}-?\d{4}(?!\d)/g, '[TEL_REMOVIDO]');
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

function isStringArray(value) {
    return !value || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
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

module.exports = {
    normalizeNameForGate,
    computeNameSimilarity,
    sanitizeAiOutput,
    compactErrorMessage,
    extractApiErrorMessage,
    formatOpenAiError,
    formatAiRuntimeError,
    isStringArray,
    stripUndefined,
};
