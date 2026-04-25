/**
 * Application: Build Report Snapshot
 * Generates a client-safe projection of a dossier for report generation.
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../constants/collections');
const { buildDossierProjection } = require('../../domain/dossierSchema');

const db = getFirestore();

/**
 * Build a report snapshot for a case.
 * @param {object} params
 * @param {string} params.caseId
 * @param {string} params.tenantId
 * @returns {Promise<object>}
 */
async function execute(params) {
  const { caseId, tenantId } = params;

  const caseDoc = await db.collection(COLLECTIONS.CASES).doc(caseId).get();
  if (!caseDoc.exists || caseDoc.data().tenantId !== tenantId) {
    const error = new Error('Dossiê não encontrado.');
    error.code = 'DOSSIER_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const caseData = caseDoc.data();

  // Fetch all related data
  const [subjectSnap, moduleRunsSnap, evidenceSnap, riskSnap, commentSnap] = await Promise.all([
    db.collection(COLLECTIONS.SUBJECTS).doc(caseData.subjectId).get(),
    db.collection(COLLECTIONS.MODULE_RUNS).where('caseId', '==', caseId).orderBy('createdAt', 'asc').get(),
    db.collection(COLLECTIONS.EVIDENCE_ITEMS).where('caseId', '==', caseId).orderBy('createdAt', 'asc').get(),
    db.collection(COLLECTIONS.RISK_SIGNALS).where('caseId', '==', caseId).orderBy('severity', 'desc').get(),
    db.collection('comments').where('caseId', '==', caseId).orderBy('createdAt', 'desc').get(),
  ]);

  const subject = subjectSnap.exists ? subjectSnap.data() : null;
  const moduleRuns = moduleRunsSnap.docs.map(d => d.data());
  const evidenceItems = evidenceSnap.docs.map(d => d.data());
  const riskSignals = riskSnap.docs.map(d => d.data());
  const comments = commentSnap.docs.map(d => d.data());

  // Build projection
  const projection = buildDossierProjection({
    schemaKey: caseData.schemaKey,
    moduleKeys: caseData.requestedSectionKeys,
    moduleRuns,
    requestedSectionKeys: caseData.requestedSectionKeys,
    requestedMacroAreaKeys: caseData.requestedMacroAreaKeys,
  });

  // Build client-safe snapshot
  const snapshot = {
    caseId,
    tenantId,
    dossierNumber: caseData.dossierNumber,
    generatedAt: new Date(),
    subject: {
      type: caseData.subjectType,
      document: maskDocument(caseData.document),
      name: caseData.name,
      basicData: subject?.basicData || {},
    },
    summary: projection.summary,
    macroAreas: projection.macroAreas,
    evidenceItems: evidenceItems.map(e => ({
      id: e.id,
      macroArea: e.macroArea,
      sectionKey: e.sectionKey,
      sourceKey: e.sourceKey,
      evidenceType: e.evidenceType,
      content: sanitizeEvidenceContent(e.content),
      isRelevant: e.isRelevant,
      riskLevel: e.riskLevel,
    })),
    riskSignals: riskSignals.map(r => ({
      code: r.code,
      category: r.category,
      severity: r.severity,
      title: r.title,
      description: r.description,
    })),
    score: caseData.score || null,
    analysis: {
      conclusive: caseData.analysis?.conclusive || '',
      status: caseData.analysis?.status || 'pending',
      comments: comments.map(c => ({
        author: c.authorName,
        text: c.text,
        date: c.createdAt,
      })),
    },
  };

  // Save to reportSnapshots
  const snapRef = db.collection(COLLECTIONS.REPORT_SNAPSHOTS).doc();
  await snapRef.set(snapshot);

  // Update case
  await db.collection(COLLECTIONS.CASES).doc(caseId).update({
    reportSnapshotId: snapRef.id,
    updatedAt: new Date(),
  });

  return { snapshotId: snapRef.id, snapshot };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskDocument(doc) {
  if (!doc) return '';
  if (doc.length === 11) {
    return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4');
  }
  if (doc.length === 14) {
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.***.***/$4-$5');
  }
  return doc;
}

function sanitizeEvidenceContent(content) {
  if (!content) return content;
  // Remove any potentially sensitive raw data
  const { rawSummary, ...safe } = content;
  return safe;
}

module.exports = { execute };
