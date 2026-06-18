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
        .replace(/[.,;:!?()\]{}'"\\/|-]/g, ' ')
        .replace(/\b(de|da|dos|das|do|e)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isTokenMatch(a, b) {
    if (a === b) return true;
    if (a.length === 1 || b.length === 1) {
        return a[0] === b[0];
    }
    return false;
}

function countTokenMatches(tokensA, tokensB) {
    const used = new Set();
    let matches = 0;
    for (const tokenA of tokensA) {
        for (let i = 0; i < tokensB.length; i++) {
            if (used.has(i)) continue;
            if (isTokenMatch(tokenA, tokensB[i])) {
                matches++;
                used.add(i);
                break;
            }
        }
    }
    return matches;
}

function computeNameSimilarity(nameA, nameB) {
    const tokensA = normalizeNameForGate(nameA).split(' ').filter(Boolean).sort();
    const tokensB = normalizeNameForGate(nameB).split(' ').filter(Boolean).sort();
    if (tokensA.length === 0 || tokensB.length === 0) return 0;

    const exactMatches = countTokenMatches(tokensA, tokensB);
    const maxLength = Math.max(tokensA.length, tokensB.length);

    if (exactMatches === maxLength) return 1;

    const unionSize = new Set([...tokensA, ...tokensB]).size;
    const jaccard = unionSize === 0 ? 0 : exactMatches / unionSize;

    const coverage = exactMatches / maxLength;

    return parseFloat(Math.max(jaccard, coverage * 0.95).toFixed(4));
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
