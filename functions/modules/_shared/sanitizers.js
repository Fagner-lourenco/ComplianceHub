/**
 * sanitizers.js — Funções puras de validação e sanitização
 * Extraídas do monolito index.js durante refatoração
 */

function isStringArray(value) {
    return !value || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}

function validateCpfDigits(digits) {
    if (typeof digits !== 'string' || digits.length !== 11) return false;
    if (/(\d)\1{10}/.test(digits)) return false;
    for (let t = 9; t < 11; t++) {
        let sum = 0;
        for (let i = 0; i < t; i++) sum += Number(digits[i]) * (t + 1 - i);
        const remainder = (sum * 10) % 11;
        if ((remainder === 10 ? 0 : remainder) !== Number(digits[t])) return false;
    }
    return true;
}

function sanitizeCpf(cpf) {
    return String(cpf || '').replace(/\D/g, '').slice(0, 11);
}

function maskCpf(cpf) {
    const digits = sanitizeCpf(cpf);
    if (digits.length !== 11) return '';
    return `***.***.***-${digits.slice(9)}`;
}

function stripInvalidControlChars(text) {
    if (typeof text !== 'string') return text;
    return Array.from(text, (char) => {
        const code = char.charCodeAt(0);
        return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127 ? ' ' : char;
    }).join('');
}

function fixLatinMojibake(text) {
    if (!text || typeof text !== 'string') return text;
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

function normalizeUnicodeToAscii(text) {
    if (!text || typeof text !== 'string') return text;
    return text
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2014/g, '--')
        .replace(/\u2013/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/\u00A0/g, ' ');
}

function sanitizeAiOutput(text) {
    if (!text) return text;
    return stripInvalidControlChars(fixLatinMojibake(normalizeUnicodeToAscii(text)))
        .replace(/<[^>]*>/g, '')
        .replace(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, '[CPF_REMOVIDO]')
        .replace(/(?<!\d)\(?\d{2}\)?\s?\d{4,5}-?\d{4}(?!\d)/g, '[TEL_REMOVIDO]');
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

function formatRequestedBy(profile, uid) {
    const name = String(profile?.displayName || '').trim();
    const email = String(profile?.email || '').trim();
    if (name && email) return `${name} (${email})`;
    if (name) return name;
    if (email) return email;
    return uid || '';
}

function sanitizePublicReportHtml(html) {
    return String(html || '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
        .replace(/<button\b[^>]*\bclass="[^"]*\bprint-btn\b[^"]*"[^>]*>[\s\S]*?<\/button>/gi, '')
        .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\s(href|src)=("|')\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
}

module.exports = {
    isStringArray,
    stripInvalidControlChars,
    validateCpfDigits,
    sanitizeCpf,
    maskCpf,
    sanitizeAiOutput,
    sanitizeStructuredList,
    sanitizeStructuredText,
    fixLatinMojibake,
    normalizeUnicodeToAscii,
    sanitizePublicReportHtml,
    formatRequestedBy,
};
