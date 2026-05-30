/**
 * Export Manager — Async export jobs with Cloud Storage.
 *
 * Requisitos:
 * - Processa em batches
 * - Gera CSV no mínimo
 * - Upload para Storage
 * - Atualiza status em exportJobs
 * - Respeita cancelamento
 */

const { HttpsError } = require('firebase-functions/v2/https');

const EXPORT_JOB_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    DONE: 'done',
    ERROR: 'error',
    CANCELLED: 'cancelled',
};

const EXPORT_FORMATS = new Set(['csv', 'xlsx', 'pdf']);
const MAX_PENDING_JOBS_PER_USER = 3;

function validateExportJobPayload(data) {
    const format = String(data?.format || 'csv').toLowerCase();
    if (!EXPORT_FORMATS.has(format)) {
        throw new HttpsError('invalid-argument', `Formato invalido: ${format}. Use: csv, xlsx, pdf.`);
    }

    const filters = data?.filters || {};
    const allowedFilterKeys = new Set(['status', 'dateFrom', 'dateTo', 'scopeCode']);
    const unknownKeys = Object.keys(filters).filter((k) => !allowedFilterKeys.has(k));
    if (unknownKeys.length > 0) {
        throw new HttpsError('invalid-argument', `Filtros desconhecidos: ${unknownKeys.join(', ')}`);
    }

    return { format, filters };
}

function sanitizeFilename(name) {
    return String(name || '')
        .replace(/[^a-zA-Z0-9\-_]/g, '_')
        .replace(/_{2,}/g, '_')
        .slice(0, 100);
}

function buildCsvContent(rows, headers) {
    const delimiter = ';';
    const lines = [];
    lines.push(headers.map((h) => escapeCsvField(h, delimiter)).join(delimiter));
    rows.forEach((row) => {
        lines.push(headers.map((h) => escapeCsvField(row[h], delimiter)).join(delimiter));
    });
    return '\uFEFF' + lines.join('\n');
}

function escapeCsvField(value, delimiter = ';') {
    const str = String(value ?? '');
    const normalized = str.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    const safe = /^[=+\-@\t\r]/.test(normalized) ? `'${normalized}` : normalized;
    if (safe.includes(delimiter) || safe.includes('"') || safe.includes('\n') || safe.includes('\r')) {
        return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
}

function buildExportFilename(tenantId, format, timestamp = new Date()) {
    const ts = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `exports/${tenantId}/${ts}.${format}`;
}

module.exports = {
    EXPORT_JOB_STATUS,
    EXPORT_FORMATS,
    MAX_PENDING_JOBS_PER_USER,
    validateExportJobPayload,
    sanitizeFilename,
    buildCsvContent,
    escapeCsvField,
    buildExportFilename,
};
