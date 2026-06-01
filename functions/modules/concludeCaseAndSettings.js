/**
 * concludeCaseAndSettings.js — Conclusão de casos e configurações do tenant
 * Extraído do monolito index.js durante refatoração Phase C
 */

const { HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');

const {
  buildSanitizedPublicResultSnapshot,
  hasMeaningfulValue,
} = require('./reportEngine');

const { stripUndefined } = require('../helpers/normalize');
const { ALLOWED_CONCLUDE_FIELDS, ALLOWED_DRAFT_FIELDS, REVIEW_DRAFT_ARRAY_FIELDS } = require('./_shared/fieldConstants');
const { sanitizeStructuredText, sanitizeStructuredList: sanitizeStructuredListBase } = require('./_shared/sanitizers');

/* =========================================================
   Constantes locais
   ========================================================= */

const FINAL_CRIMINAL_FLAGS = new Set(['NEGATIVE', 'POSITIVE', 'INCONCLUSIVE']);

function sanitizeStructuredList(value, maxItems = 8, maxLength = 220) {
  return sanitizeStructuredListBase(value, maxItems, maxLength);
}

/* =========================================================
   Funções puras de sanitização / normalização
   ========================================================= */

function normalizeKeyFindingsValue(value) {
  if (Array.isArray(value)) {
    return sanitizeStructuredList(value, 8, 220);
  }
  if (typeof value === 'string') {
    return sanitizeStructuredList(
      value.split(/\r?\n|;/).map((item) => item.trim()),
      8,
      220,
    );
  }
  return [];
}

function normalizeNarrativeValue(field, value, { defaultAnalysisConfig } = {}) {
  if (value === undefined) return undefined;
  if (field === 'enabledPhases') {
    const allowed = new Set(Object.keys(defaultAnalysisConfig || {}));
    return Array.isArray(value) ? value.filter((item) => allowed.has(item)) : [];
  }
  if (field === 'keyFindings') return normalizeKeyFindingsValue(value);
  if (REVIEW_DRAFT_ARRAY_FIELDS.has(field)) return Array.isArray(value) ? value.filter(Boolean) : [];
  if (typeof value === 'string') {
    const maxLength = field === 'executiveSummary' ? 900 : field === 'analystComment' ? 900 : 1400;
    return sanitizeStructuredText(value, maxLength);
  }
  return value;
}

/* =========================================================
   pickConcludePayload / pickDraftPayload
   ========================================================= */

function pickConcludePayload(payload = {}, { defaultAnalysisConfig } = {}) {
  const result = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (ALLOWED_CONCLUDE_FIELDS.has(key)) {
      result[key] = normalizeNarrativeValue(key, value, { defaultAnalysisConfig });
    }
  }
  result.status = 'DONE';
  result.concludedAt = FieldValue.serverTimestamp();
  result.correctionReason = FieldValue.delete();
  result.correctionNotes = FieldValue.delete();
  result.correctionRequestedAt = FieldValue.delete();
  result.correctionRequestedBy = FieldValue.delete();
  result.reviewDraft = FieldValue.delete();
  result.draftSavedAt = FieldValue.delete();
  result.updatedAt = FieldValue.serverTimestamp();
  return result;
}

function pickDraftPayload(payload = {}, existingReviewDraft = {}) {
  const reviewDraft = { ...(existingReviewDraft || {}) };
  for (const [key, value] of Object.entries(payload || {})) {
    if (ALLOWED_DRAFT_FIELDS.has(key)) {
      reviewDraft[key] = normalizeNarrativeValue(key, value);
    }
  }
  reviewDraft.__source = 'analyst';
  return {
    reviewDraft: stripUndefined(reviewDraft),
    draftSavedAt: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/* =========================================================
   Validação de flags finais
   ========================================================= */

function validateConcludeFinalFlags(payload = {}) {
  if (hasMeaningfulValue(payload.criminalFlag) && !FINAL_CRIMINAL_FLAGS.has(payload.criminalFlag)) {
    throw new HttpsError(
      'invalid-argument',
      'Selecione um resultado criminal final para concluir: Sem apontamento, Com apontamento ou Inconclusivo.',
    );
  }
}

/* =========================================================
   syncPublicResultLatest
   ========================================================= */

async function syncPublicResultLatest(caseId, caseData, payload = {}, options = {}, db) {
  const publicData = buildSanitizedPublicResultSnapshot(caseId, caseData, payload, options);
  const writePayload = {
    ...publicData,
    publishedAt: FieldValue.serverTimestamp(),
  };
  if (!writePayload.concludedAt) {
    writePayload.concludedAt = options.concludedAtOverride || FieldValue.serverTimestamp();
  }
  await db.collection('cases').doc(caseId).collection('publicResult').doc('latest').set(writePayload);
  return publicData;
}


/* =========================================================
   Exports
   ========================================================= */

module.exports = {
  pickConcludePayload,
  pickDraftPayload,
  validateConcludeFinalFlags,
  normalizeNarrativeValue,
  syncPublicResultLatest,
};
