/**
 * utilityHelpers.js — Funções puras de utilidade extraídas do monolito
 * Normalização de nomes, similaridade, formatação de datas
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

function formatDateKey(date, timeZone = 'America/Sao_Paulo') {
    if (date == null) return null;
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

module.exports = {
    normalizeNameForGate,
    computeNameSimilarity,
    formatDateKey,
    formatMonthKey,
};
