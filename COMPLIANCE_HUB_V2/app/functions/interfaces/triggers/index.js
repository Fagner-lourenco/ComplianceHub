/**
 * Firestore Trigger Functions Registry
 *
 * MIGRATION NOTE (2026-04-24):
 * The legacy enrichBigDataCorpOnCase trigger has been DISABLED to prevent
 * double-execution with enrichBigDataCorpOnCaseV2 (new V2 pipeline).
 * If rollback is needed, uncomment the line below and redeploy.
 */

const bootstrap = require('../../bootstrap');

// ---------------------------------------------------------------------------
// Enrichment Triggers
// ---------------------------------------------------------------------------
exports.enrichJuditOnCase = bootstrap.enrichJuditOnCase;
// DISABLED: exports.enrichBigDataCorpOnCase = bootstrap.enrichBigDataCorpOnCase;
exports.enrichJuditOnCorrection = bootstrap.enrichJuditOnCorrection;
exports.enrichEscavadorOnCase = bootstrap.enrichEscavadorOnCase;
exports.enrichDjenOnCase = bootstrap.enrichDjenOnCase;

// ---------------------------------------------------------------------------
// Sync & Publication Triggers
// ---------------------------------------------------------------------------
exports.syncClientCaseOnCreate = bootstrap.syncClientCaseOnCreate;
exports.syncClientCaseOnUpdate = bootstrap.syncClientCaseOnUpdate;
exports.syncClientCaseOnDelete = bootstrap.syncClientCaseOnDelete;
exports.publishResultOnCaseDone = bootstrap.publishResultOnCaseDone;
