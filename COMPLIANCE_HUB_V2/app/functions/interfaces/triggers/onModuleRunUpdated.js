/**
 * Trigger: onModuleRunUpdated
 * Handles retry logic for failed module runs and progress updates.
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../constants/collections');
const { CASE_STATUS_V2 } = require('../../domain/v2CaseStatus');

const db = getFirestore();

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 5000, 15000]; // exponential-ish backoff

exports.onModuleRunUpdatedV2 = onDocumentUpdated(
  { document: 'moduleRuns/{runId}', region: 'southamerica-east1' },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const runId = event.params.runId;

    if (!before || !after) return;

    // Detect status change to failed_retryable
    if (before.status !== 'failed_retryable' && after.status === 'failed_retryable') {
      await handleRetry(runId, after);
    }

    // Detect status change to pending (manual retry requested)
    if (before.status !== 'pending' && after.status === 'pending') {
      await handleManualRetry(runId, after);
    }

    // Update case progress whenever a module run completes
    if (before.status !== after.status && isTerminalStatus(after.status)) {
      await updateCaseProgress(after.caseId);
    }
  }
);

async function handleRetry(runId, runData) {
  const retryCount = runData.retryCount || 0;

  if (retryCount >= MAX_RETRIES) {
    await db.collection(COLLECTIONS.MODULE_RUNS).doc(runId).update({
      status: 'failed_final',
      updatedAt: new Date(),
    });
    return;
  }

  const delay = RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];

  await new Promise(resolve => setTimeout(resolve, delay));

  await db.collection(COLLECTIONS.MODULE_RUNS).doc(runId).update({
    status: 'pending',
    retryCount: retryCount + 1,
    updatedAt: new Date(),
  });
}

async function handleManualRetry(runId, runData) {
  await db.collection(COLLECTIONS.MODULE_RUNS).doc(runId).update({
    retryCount: 0,
    error: null,
    wasReused: false,
    updatedAt: new Date(),
  });
}

async function updateCaseProgress(caseId) {
  const [caseDoc, runsSnap] = await Promise.all([
    db.collection(COLLECTIONS.CASES).doc(caseId).get(),
    db.collection(COLLECTIONS.MODULE_RUNS).where('caseId', '==', caseId).get(),
  ]);

  if (!caseDoc.exists) return;

  const runs = runsSnap.docs.map(d => d.data());
  const total = runs.length;
  if (total === 0) return;

  const weights = {
    'completed_with_findings': 1.0,
    'completed_no_findings': 1.0,
    'skipped_reuse': 1.0,
    'skipped_policy': 1.0,
    'failed_final': 1.0,
    'not_entitled': 1.0,
    'failed_retryable': 0.5,
    'running': 0.3,
    'queued': 0.1,
    'pending': 0,
  };

  const weightedSum = runs.reduce((sum, run) => sum + (weights[run.status] || 0), 0);
  const progress = Math.round((weightedSum / total) * 100);

  const completed = runs.filter(r =>
    ['completed_with_findings', 'completed_no_findings', 'skipped_reuse'].includes(r.status)
  ).length;

  const progressDetail = {
    totalSources: total,
    completed,
    withFindings: runs.filter(r => r.status === 'completed_with_findings').length,
    failed: runs.filter(r => r.status === 'failed_final').length,
    pending: runs.filter(r => ['pending', 'queued', 'running'].includes(r.status)).length,
    sources: runs.map(r => ({
      sourceKey: r.sourceKey,
      status: r.status,
      label: mapStatusLabel(r.status),
      variant: mapStatusVariant(r.status),
    })),
  };

  await db.collection(COLLECTIONS.CASES).doc(caseId).update({
    progress,
    progressDetail,
    updatedAt: new Date(),
  });
}

function isTerminalStatus(status) {
  return [
    'completed_with_findings',
    'completed_no_findings',
    'skipped_reuse',
    'skipped_policy',
    'failed_final',
    'not_entitled',
  ].includes(status);
}

function mapStatusLabel(status) {
  const labels = {
    completed_with_findings: 'Com resultado',
    completed_no_findings: 'Nenhum resultado',
    skipped_reuse: 'Concluído',
    skipped_policy: 'Não aplicável',
    failed_retryable: 'Indisponível',
    failed_final: 'Falha',
    pending: 'Criado',
    running: 'Processando',
    not_entitled: 'Não contratado',
  };
  return labels[status] || status;
}

function mapStatusVariant(status) {
  const variants = {
    completed_with_findings: 'success',
    completed_no_findings: 'warning',
    skipped_reuse: 'info',
    skipped_policy: 'neutral',
    failed_retryable: 'error',
    failed_final: 'error',
    pending: 'neutral',
    running: 'info',
    not_entitled: 'neutral',
  };
  return variants[status] || 'neutral';
}
