/**
 * Application: Process Dossier Use Case
 * Initiates enrichment for a dossier by transitioning status and
 * queuing module runs for execution.
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../constants/collections');
const { CASE_STATUS_V2, transitionCaseStatus } = require('../../domain/v2CaseStatus');

const db = getFirestore();

/**
 * Start processing a dossier.
 * @param {object} params
 * @param {string} params.caseId
 * @param {string} params.tenantId
 * @param {string} [params.triggeredBy] — UID of user who triggered
 * @returns {Promise<object>}
 */
async function execute(params) {
  const { caseId, tenantId, triggeredBy } = params;

  const caseRef = db.collection(COLLECTIONS.CASES).doc(caseId);
  const caseDoc = await caseRef.get();

  if (!caseDoc.exists) {
    const error = new Error('Dossiê não encontrado.');
    error.code = 'DOSSIER_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const caseData = caseDoc.data();
  if (caseData.tenantId !== tenantId) {
    const error = new Error('Dossiê não pertence ao tenant.');
    error.code = 'CASE_NOT_IN_TENANT';
    error.statusCode = 403;
    throw error;
  }

  // Validate state transition
  const transition = transitionCaseStatus(caseData.status, CASE_STATUS_V2.ENRICHING);
  if (!transition.changed) {
    const error = new Error(transition.error || 'Transição de status inválida.');
    error.code = 'FAILED_PRECONDITION';
    error.statusCode = 409;
    throw error;
  }

  // Reset pending module runs
  const pendingRuns = await db.collection(COLLECTIONS.MODULE_RUNS)
    .where('caseId', '==', caseId)
    .where('status', 'in', ['failed_final', 'failed_retryable', 'skipped_policy'])
    .get();

  const batch = db.batch();
  for (const doc of pendingRuns.docs) {
    batch.update(doc.ref, {
      status: 'pending',
      retryCount: 0,
      error: null,
      updatedAt: new Date(),
    });
  }
  await batch.commit();

  // Update case status
  await caseRef.update({
    status: CASE_STATUS_V2.ENRICHING,
    startedAt: new Date(),
    updatedAt: new Date(),
    lastProcessedBy: triggeredBy || null,
  });

  return {
    caseId,
    status: CASE_STATUS_V2.ENRICHING,
    message: 'Processamento iniciado.',
    resetRuns: pendingRuns.size,
  };
}

module.exports = { execute };
