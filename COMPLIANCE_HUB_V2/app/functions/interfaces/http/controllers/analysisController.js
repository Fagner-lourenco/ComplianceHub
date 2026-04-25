/**
 * Controller: Analysis REST API
 * Handles comments, conclusive analysis, approval/rejection.
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../../constants/collections');
const { CASE_STATUS_V2 } = require('../../../domain/v2CaseStatus');
const { execute: addComment } = require('../../../application/analysis/addComment');
const { resolveReviewGate } = require('../../../domain/v2ReviewGate');

const db = getFirestore();

async function analysisController(req, res) {
  const method = req.method;
  const path = req.routePath || '/';

  // Extract caseId from path (e.g. /abc123/comments → abc123)
  const caseIdMatch = path.match(/^\/([^/]+)/);
  if (caseIdMatch && caseIdMatch[1]) req.caseId = caseIdMatch[1];

  if (method === 'POST' && /^\/[^/]+\/comments$/.test(path)) {
    return await createComment(req, res);
  }
  if (method === 'PATCH' && /^\/[^/]+$/.test(path)) {
    return await updateAnalysis(req, res);
  }
  if (method === 'POST' && /^\/[^/]+\/approve$/.test(path)) {
    return await approveDossier(req, res);
  }
  if (method === 'POST' && /^\/[^/]+\/reject$/.test(path)) {
    return await rejectDossier(req, res);
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
  });
}

async function createComment(req, res) {
  const tenantId = req.tenantId;
  const uid = req.uid;
  const profile = req.userProfile;
  const caseId = req.caseId;
  const body = req.body || {};

  try {
    const result = await addComment({
      caseId,
      tenantId,
      authorId: uid,
      authorName: profile.name || '',
      authorRole: profile.role || '',
      text: body.text,
      type: body.type || 'comment',
      evidenceItemId: body.evidenceItemId,
      sectionKey: body.sectionKey,
      isRelevant: body.isRelevant || false,
      isConclusive: body.isConclusive || false,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

async function updateAnalysis(req, res) {
  const tenantId = req.tenantId;
  const caseId = req.caseId;
  const body = req.body || {};

  const caseRef = db.collection(COLLECTIONS.CASES).doc(caseId);
  const caseDoc = await caseRef.get();

  if (!caseDoc.exists || (tenantId !== 'all' && caseDoc.data().tenantId !== tenantId)) {
    return res.status(404).json({
      success: false,
      error: { code: 'DOSSIER_NOT_FOUND', message: 'Dossiê não encontrado.' },
    });
  }

  const updates = {};
  if (body.conclusive !== undefined) updates['analysis.conclusive'] = body.conclusive;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ARGUMENT', message: 'Nenhum campo para atualizar.' },
    });
  }

  updates.updatedAt = new Date();
  await caseRef.update(updates);

  res.json({ success: true, data: { id: caseId, updated: Object.keys(updates) } });
}

async function approveDossier(req, res) {
  const tenantId = req.tenantId;
  const uid = req.uid;
  const profile = req.userProfile;
  const caseId = req.caseId;

  const caseRef = db.collection(COLLECTIONS.CASES).doc(caseId);
  const caseDoc = await caseRef.get();

  if (!caseDoc.exists || (tenantId !== 'all' && caseDoc.data().tenantId !== tenantId)) {
    return res.status(404).json({
      success: false,
      error: { code: 'DOSSIER_NOT_FOUND', message: 'Dossiê não encontrado.' },
    });
  }

  const caseData = caseDoc.data();

  // Fetch moduleRuns and riskSignals for review gate
  const [moduleRunsSnap, riskSnap] = await Promise.all([
    db.collection(COLLECTIONS.MODULE_RUNS).where('caseId', '==', caseId).get(),
    db.collection(COLLECTIONS.RISK_SIGNALS).where('caseId', '==', caseId).get(),
  ]);

  const moduleRuns = moduleRunsSnap.docs.map(d => d.data());
  const riskSignals = riskSnap.docs.map(d => d.data());

  // Resolve review gate
  const gateResult = resolveReviewGate({
    moduleRuns,
    riskSignals,
    caseData,
    actorRole: profile.role || null,
  });

  if (!gateResult.allowed) {
    return res.status(403).json({
      success: false,
      error: {
        code: gateResult.denialReasonCode,
        message: gateResult.denialMessage,
        policy: gateResult.policyResult,
      },
    });
  }

  // Create Decision record
  const decisionRef = db.collection(COLLECTIONS.DECISIONS).doc();
  const now = new Date();
  await decisionRef.set({
    tenantId,
    caseId,
    type: 'approval',
    decidedBy: uid,
    decidedByName: profile.name || '',
    decidedByRole: profile.role || '',
    policySummary: gateResult.policyResult,
    moduleRunCount: moduleRuns.length,
    riskSignalCount: riskSignals.length,
    createdAt: now,
  });

  await caseRef.update({
    status: CASE_STATUS_V2.PUBLISHED,
    'analysis.status': 'approved',
    'analysis.approvedBy': uid,
    'analysis.approvedAt': now,
    'analysis.decisionId': decisionRef.id,
    updatedAt: now,
  });

  res.json({
    success: true,
    data: { id: caseId, status: 'published', analysis: 'approved', decisionId: decisionRef.id },
  });
}

async function rejectDossier(req, res) {
  const tenantId = req.tenantId;
  const uid = req.uid;
  const profile = req.userProfile;
  const caseId = req.caseId;
  const body = req.body || {};

  const caseRef = db.collection(COLLECTIONS.CASES).doc(caseId);
  const caseDoc = await caseRef.get();

  if (!caseDoc.exists || (tenantId !== 'all' && caseDoc.data().tenantId !== tenantId)) {
    return res.status(404).json({
      success: false,
      error: { code: 'DOSSIER_NOT_FOUND', message: 'Dossiê não encontrado.' },
    });
  }

  // Create Decision record for rejection
  const decisionRef = db.collection(COLLECTIONS.DECISIONS).doc();
  const now = new Date();
  await decisionRef.set({
    tenantId,
    caseId,
    type: 'rejection',
    decidedBy: uid,
    decidedByName: profile.name || '',
    decidedByRole: profile.role || '',
    reason: body.reason || '',
    createdAt: now,
  });

  await caseRef.update({
    status: CASE_STATUS_V2.CORRECTION_NEEDED,
    'analysis.status': 'rejected',
    'analysis.rejectedBy': uid,
    'analysis.rejectedAt': now,
    'analysis.rejectionReason': body.reason || '',
    'analysis.decisionId': decisionRef.id,
    updatedAt: now,
  });

  res.json({
    success: true,
    data: { id: caseId, status: 'correction_needed', analysis: 'rejected', decisionId: decisionRef.id },
  });
}

module.exports = { analysisController };
