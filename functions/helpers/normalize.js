/**
 * normalize.js — Funções puras de normalização e sanitização
 * Extraídas do monolito index.js para reuso entre módulos
 */

function asDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'string') {
        const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (brMatch) {
            const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = brMatch;
            const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
            return Number.isNaN(d.getTime()) ? null : d;
        }
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function isFirestoreSentinel(value) {
    if (!value || typeof value !== 'object') return false;
    const methodName = value._methodName || value.methodName;
    if (typeof methodName === 'string' && /FieldValue|delete|serverTimestamp|increment/i.test(methodName)) return true;
    const ctorName = value.constructor?.name || '';
    return /FieldValue|Transform|Delete/i.test(ctorName) && Object.getPrototypeOf(value) !== Object.prototype;
}

function sanitizeAuditMetadataValue(value) {
    if (value === undefined || isFirestoreSentinel(value)) return null;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (Array.isArray(value)) return value.map(sanitizeAuditMetadataValue);
    if (typeof value === 'object') {
        if (Object.getPrototypeOf(value) !== Object.prototype) return null;
        const clean = {};
        for (const [key, child] of Object.entries(value)) {
            clean[key] = sanitizeAuditMetadataValue(child);
        }
        return clean;
    }
    return null;
}

function sanitizePublicStructuredValue(value) {
    if (typeof value === 'string') return sanitizeStructuredText(value, 1200);
    if (Array.isArray(value)) return value.slice(0, 50).map(sanitizePublicStructuredValue);
    if (!value || typeof value !== 'object') return value;
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
    const clean = {};
    for (const [key, child] of Object.entries(value)) {
        clean[key] = sanitizePublicStructuredValue(child);
    }
    return clean;
}

function sanitizeStructuredText(value, maxLength = 1200) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return trimmed.slice(0, maxLength) + '...';
}

function sanitizeStructuredList(value, maxItems = 8, maxLength = 220) {
    if (!Array.isArray(value)) return value;
    return value
        .filter((item) => item !== null && item !== undefined)
        .slice(0, maxItems)
        .map((item) => (typeof item === 'string' ? sanitizeStructuredText(item, maxLength) : item));
}

function normalizeTenantSlug(value = '') {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

function hasBenignNoProcessCoverage(caseData = {}) {
    const coverageNotes = Array.isArray(caseData.coverageNotes) ? caseData.coverageNotes : [];
    return caseData.criminalFlag === 'NEGATIVE'
        && caseData.coverageLevel === 'LOW_COVERAGE'
        && caseData.providerDivergence !== 'HIGH'
        && coverageNotes.length > 0
        && coverageNotes.every((note) => /nenhum provider retornou processo aproveitavel/i.test(String(note || '')));
}

module.exports = {
    asDate,
    stripUndefined,
    isFirestoreSentinel,
    sanitizeAuditMetadataValue,
    sanitizePublicStructuredValue,
    sanitizeStructuredText,
    sanitizeStructuredList,
    normalizeTenantSlug,
    hasBenignNoProcessCoverage,
};