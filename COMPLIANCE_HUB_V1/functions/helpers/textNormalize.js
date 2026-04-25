/**
 * Shared text normalization utilities.
 * Centralizes NFD decomposition + diacritics removal to avoid duplication.
 */

function normalizeText(value, { toCase = 'lower' } = {}) {
    const text = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (toCase === 'upper') return text.toUpperCase();
    if (toCase === 'lower') return text.toLowerCase();
    return text;
}

module.exports = { normalizeText };
