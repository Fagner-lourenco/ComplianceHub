/**
 * fix-clientcase-date-types.cjs
 *
 * Converte campos de data armazenados como `stringValue` (ISO 8601) em
 * `timestampValue` (Firestore nativo) nas colecoes `clientCases` e `cases`
 * para o tenant `madero-br`. O script NAO altera nenhum outro campo.
 *
 * Uso:
 *   node scripts/fix-clientcase-date-types.cjs --dry-run            (padrao)
 *   node scripts/fix-clientcase-date-types.cjs --apply --yes
 *
 * Por seguranca:
 *   - GET usa `mask.fieldPaths` limitado aos 3 campos de data.
 *   - PATCH usa `updateMask.fieldPaths` identico ao payload.
 *   - Apenas docs com string dates em `createdAt|updatedAt|concludedAt` sao tocados.
 *   - O payload de PATCH contem EXATAMENTE os campos de data; nada mais.
 *   - 5 documentos corrompidos (`.fieldPaths=*`) sao deletados por ID hardcoded.
 */

'use strict';

const DATE_FIELDS = ['createdAt', 'updatedAt', 'concludedAt'];

const CORRUPTED_DOC_IDS = [
    '.fieldPaths=candidateName',
    '.fieldPaths=name',
    '.fieldPaths=status',
    '.fieldPaths=status&updateMask.fieldPaths=bigdatacorpEnrichmentStatus',
    '.fieldPaths=status&updateMask.fieldPaths=correctionReason&updateMask.fieldPaths=bigdatacorpEnrichmentStatus',
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function isStringIsoDate(fv) {
    if (!fv || typeof fv !== 'object') return false;
    if (typeof fv.stringValue !== 'string') return false;
    if (!ISO_DATE_RE.test(fv.stringValue)) return false;
    const ms = Date.parse(fv.stringValue);
    return Number.isFinite(ms);
}

function buildFixPayload(fields) {
    const payload = {};
    for (const key of DATE_FIELDS) {
        if (isStringIsoDate(fields?.[key])) {
            payload[key] = { timestampValue: fields[key].stringValue };
        }
    }
    return payload;
}

function buildUpdateMask(fieldNames) {
    return fieldNames
        .map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`)
        .join('&');
}

module.exports = {
    DATE_FIELDS,
    CORRUPTED_DOC_IDS,
    ISO_DATE_RE,
    isStringIsoDate,
    buildFixPayload,
    buildUpdateMask,
};

if (require.main === module) {
    console.error('Stub: full apply/dry-run implementation is added in Task 2.');
    process.exit(1);
}
