/**
 * Controller: Dossier REST API
 * Routes all dossier-related onRequest endpoints.
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../../constants/collections');
const { rateLimit } = require('../middleware/rateLimiter');

const { validateDocument, formatDocument } = require('../../../helpers/cpfCnpj');
const { docHash } = require('../../../helpers/hash');
const { applyPagination, buildPaginatedResponse } = require('../../../helpers/pagination');
const { resolveDossierConfiguration } = require('../../../domain/dossierSchema');
const { resolveTenantEntitlements, isTenantFeatureEnabled, FEATURE_FLAGS } = require('../../../domain/v2EntitlementResolver');
const { resolveReviewGate } = require('../../../domain/v2ReviewGate');

const db = getFirestore();

// ---------------------------------------------------------------------------
// Route dispatcher
// ---------------------------------------------------------------------------

async function dossierController(req, res) {
  const method = req.method;
  const path = req.routePath || '/';

  // Extract caseId for sub-routes: /:id, /:id/process, /:id/comments, etc.
  const caseIdMatch = path.match(/^\/([^/]+)/);
  if (caseIdMatch && caseIdMatch[1] && caseIdMatch[1] !== 'dossiers') {
    req.caseId = caseIdMatch[1];
  }

  if (method === 'GET' && path === '/') {
    return await listDossiers(req, res);
  }
  if (method === 'POST' && path === '/') {
    return await rateLimit('dossierCreation')(req, res, async () => createDossier(req, res));
  }
  if (method === 'GET' && /^\/[^/]+$/.test(path)) {
    return await getDossierDetail(req, res);
  }
  if (method === 'POST' && /^\/[^/]+\/process$/.test(path)) {
    return await processDossier(req, res);
  }
  if (method === 'POST' && /^\/[^/]+\/retry-source$/.test(path)) {
    return await retrySource(req, res);
  }
  if (method === 'POST' && /^\/[^/]+\/reprocess-bdc$/.test(path)) {
    return await reprocessBdc(req, res);
  }
  if (method === 'PATCH' && /^\/[^/]+$/.test(path)) {
    return await patchDossier(req, res);
  }
  if (method === 'POST' && /^\/[^/]+\/comments$/.test(path)) {
    return await createComment(req, res);
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

// ---------------------------------------------------------------------------
// LIST — GET /api/v1/dossiers
// ---------------------------------------------------------------------------

async function listDossiers(req, res) {
  const tenantId = req.tenantId;
  const { status, tag, createdBy, cursor, limit = '20' } = req.query;

  let query = db.collection(COLLECTIONS.CASES);
  if (tenantId !== 'all') {
    query = query.where('tenantId', '==', tenantId);
  }

  if (status) query = query.where('status', '==', status);
  if (tag) query = query.where('tag', '==', tag);
  if (createdBy) query = query.where('createdBy', '==', createdBy);

  // Parallel: get paginated items + total count
  let countQuery = db.collection(COLLECTIONS.CASES);
  if (tenantId !== 'all') {
    countQuery = countQuery.where('tenantId', '==', tenantId);
  }
  if (status) countQuery = countQuery.where('status', '==', status);
  if (tag) countQuery = countQuery.where('tag', '==', tag);
  if (createdBy) countQuery = countQuery.where('createdBy', '==', createdBy);

  const { query: paginatedQuery, limit: pageLimit } = applyPagination(query, {
    limit: parseInt(limit),
    cursor,
    orderField: 'createdAt',
    orderDirection: 'desc',
  });

  const [snapshot, countSnapshot] = await Promise.all([
    paginatedQuery.get(),
    countQuery.count().get(),
  ]);

  const result = buildPaginatedResponse(snapshot, pageLimit, (doc) => {
    const d = doc.data();
    const statusLabel = mapStatusToLabel(d.status);
    return {
      id: doc.id,
      createdAt: d.createdAt?.toDate?.()
        ? d.createdAt.toDate().toLocaleString('pt-BR')
        : null,
      tag: d.tag || null,
      criterion: d.name || d.documentFormatted || '',
      subjectName: d.name || d.documentFormatted || '',
      progress: d.progress || 0,
      status: statusLabel,
      monitoringEnabled: d.flags?.monitoria || false,
      workflow: d.flags?.workflow ? 'Automático' : 'Manual',
      riskLevel: d.riskLevel || '—',
      score: d.score?.overall != null ? String(d.score.overall) : null,
      analystName: d.createdByName || '',
    };
  });

  result.meta.total = countSnapshot.data().count || 0;

  res.json({ success: true, data: { dossiers: result.items }, meta: result.meta });
}

// ---------------------------------------------------------------------------
// CREATE — POST /api/v1/dossiers
// ---------------------------------------------------------------------------

async function createDossier(req, res) {
  const tenantId = req.tenantId;
  const uid = req.uid;
  const profile = req.userProfile;

  const body = req.body || {};

  // Support both REST-native payload and frontend-compatible payload
  const subjectType = body.subjectType || body.subjectKind || 'pf';
  const document = body.document || body.cpf || body.cnpj || '';
  const name = body.name || body.fullName || body.legalName || '';
  const presetKey = body.presetKey || body.dossierPresetKey || 'compliance';
  const tag = body.tag || (Array.isArray(body.tagIds) && body.tagIds.length > 0 ? body.tagIds[0] : null);
  const autoProcess = body.autoProcess !== undefined ? Boolean(body.autoProcess) : true;
  const parameters = body.parameters || {};

  // Validation
  const docValidation = validateDocument(document);
  if (!docValidation.valid) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_DOCUMENT', message: 'CPF ou CNPJ inválido.' },
    });
  }

  // ── Entitlement check ──
  const tenantSnap = await db.collection(COLLECTIONS.TENANT_ENTITLEMENTS).doc(tenantId).get();
  const entitlements = resolveTenantEntitlements(tenantSnap.exists ? tenantSnap.data() : {});

  if (!isTenantFeatureEnabled(entitlements, FEATURE_FLAGS.CASE_CREATION)) {
    return res.status(403).json({
      success: false,
      error: { code: 'NOT_ENTITLED', message: 'Tenant não possui permissão para criação de dossiês.' },
    });
  }

  // Monthly limit check
  if (entitlements.maxCasesPerMonth) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const monthlyCount = await db.collection(COLLECTIONS.CASES)
      .where('tenantId', '==', tenantId)
      .where('createdAt', '>=', startOfMonth)
      .count().get();
    if (monthlyCount.data().count >= entitlements.maxCasesPerMonth) {
      return res.status(429).json({
        success: false,
        error: { code: 'QUOTA_EXCEEDED', message: 'Limite mensal de dossiês atingido.' },
      });
    }
  }

  // Preset entitlement check (enabledProducts or enabledModules)
  const enabledProducts = entitlements.enabledProducts || [];
  const enabledModules = entitlements.enabledModules || [];
  if (enabledProducts.length > 0 && !enabledProducts.includes(presetKey)) {
    return res.status(403).json({
      success: false,
      error: { code: 'PRESET_NOT_ENTITLED', message: `Preset '${presetKey}' não contratado pelo tenant.` },
    });
  }

  const inferredType = subjectType || docValidation.type;
  const cleanDoc = document.replace(/\D/g, '');
  const formattedDoc = formatDocument(cleanDoc);

  // Resolve configuration via dossierSchema engine
  const config = resolveDossierConfiguration({
    subjectType: inferredType,
    dossierPresetKey: presetKey,
    tag,
    parameters,
    autoProcessRequested: autoProcess,
  });

  if (!config.isValid) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: config.validationErrors.join('; ') },
    });
  }

  // Filter sections by entitled modules
  if (enabledModules.length > 0) {
    config.requestedSectionKeys = config.requestedSectionKeys.filter((sk) => enabledModules.includes(sk));
    config.requestedMacroAreaKeys = config.requestedMacroAreaKeys.filter((mk) => enabledModules.includes(mk));
  }

  // Generate dossier number (sequential per tenant) via transaction
  const dossierNumber = await generateDossierNumber(tenantId);

  // Find or create subject
  const subjectRef = await findOrCreateSubject(tenantId, cleanDoc, name, inferredType);

  // Create case document
  const caseRef = db.collection(COLLECTIONS.CASES).doc();
  const now = new Date();

  const caseData = {
    tenantId,
    dossierNumber,
    subjectType: inferredType,
    document: cleanDoc,
    documentFormatted: formattedDoc,
    name: name || '',
    presetKey: config.dossierPresetKey || presetKey,
    schemaKey: config.dossierSchemaKey,
    customProfileId: null,
    requestedSectionKeys: config.requestedSectionKeys,
    requestedMacroAreaKeys: config.requestedMacroAreaKeys,
    tag: config.tag || null,
    parameters,
    status: 'received',
    progress: 0,
    progressDetail: {
      totalSources: 0,
      completed: 0,
      withFindings: 0,
      failed: 0,
      pending: 0,
      sources: [],
    },
    autoProcess,
    startedAt: autoProcess ? now : null,
    subjectId: subjectRef.id,
    moduleRunIds: [],
    evidenceItemIds: [],
    riskSignalIds: [],
    analysis: {
      conclusive: '',
      status: 'pending',
    },
    createdBy: uid,
    createdByName: profile.name || '',
    createdAt: now,
    updatedAt: now,
    flags: {
      monitoria: false,
      workflow: false,
      upFlag: false,
      score: true,
    },
  };

  await caseRef.set(caseData);

  // Create moduleRuns for each requested source
  const moduleRuns = await createModuleRuns(caseRef.id, tenantId, config);
  caseData.moduleRunIds = moduleRuns.map(m => m.id);
  caseData.progressDetail.totalSources = moduleRuns.length;
  caseData.progressDetail.pending = moduleRuns.length;

  await caseRef.update({
    moduleRunIds: caseData.moduleRunIds,
    progressDetail: caseData.progressDetail,
  });

  // Trigger auto-processing if enabled
  if (autoProcess) {
    // Firestore trigger will pick up the case creation and start enrichment
    await caseRef.update({ status: 'enriching' });
  }

  res.status(201).json({
    success: true,
    data: {
      id: caseRef.id,
      createdAt: now.toLocaleString('pt-BR'),
      tag: caseData.tag,
      criterion: caseData.name || caseData.documentFormatted,
      subjectName: caseData.name || caseData.documentFormatted,
      progress: 0,
      status: mapStatusToLabel(autoProcess ? 'enriching' : 'received'),
      monitoringEnabled: false,
      workflow: 'Manual',
      riskLevel: '—',
      score: null,
      analystName: profile.name || '',
      presetKey: config.dossierPresetLabel || presetKey,
    },
  });
}

// ---------------------------------------------------------------------------
// DETAIL — GET /api/v1/dossiers/:id
// ---------------------------------------------------------------------------

async function getDossierDetail(req, res) {
  const tenantId = req.tenantId;
  const caseId = req.routePath.split('/')[1];
  const mode = req.query.mode || 'analitico';

  const caseDoc = await db.collection(COLLECTIONS.CASES).doc(caseId).get();
  if (!caseDoc.exists || (tenantId !== 'all' && caseDoc.data().tenantId !== tenantId)) {
    return res.status(404).json({
      success: false,
      error: { code: 'DOSSIER_NOT_FOUND', message: 'Dossiê não encontrado.' },
    });
  }

  const caseData = caseDoc.data();

  // Fetch related data
  const subjectId = caseData.subjectId;
  const [subjectSnap, moduleRunsSnap, evidenceSnap, riskSnap, commentSnap] = await Promise.all([
    subjectId ? db.collection(COLLECTIONS.SUBJECTS).doc(subjectId).get() : Promise.resolve({ exists: false }),
    db.collection(COLLECTIONS.MODULE_RUNS).where('caseId', '==', caseId).get(),
    db.collection(COLLECTIONS.EVIDENCE_ITEMS).where('caseId', '==', caseId).get(),
    db.collection(COLLECTIONS.RISK_SIGNALS).where('caseId', '==', caseId).get(),
    db.collection('comments').where('caseId', '==', caseId).get(),
  ]);

  const subject = subjectSnap.exists ? subjectSnap.data() : null;
  const moduleRuns = moduleRunsSnap.docs.map(d => d.data()).sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime() || 0;
    const bTime = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime() || 0;
    return aTime - bTime;
  });
  console.log(`[getDossierDetail] caseId=${caseId} evidenceSnap.size=${evidenceSnap.size}`);
  const evidenceItems = evidenceSnap.docs.map(d => d.data()).sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime() || 0;
    const bTime = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime() || 0;
    return aTime - bTime;
  });
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  const riskSignals = riskSnap.docs.map(d => d.data()).sort((a, b) => {
    return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
  });
  const comments = commentSnap.docs.map(d => d.data()).sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime() || 0;
    const bTime = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime() || 0;
    return bTime - aTime;
  });

  // Build macro areas from dossierSchema
  const { buildDossierProjection } = require('../../../domain/dossierSchema');
  const projection = buildDossierProjection({
    schemaKey: caseData.schemaKey,
    moduleKeys: caseData.requestedSectionKeys,
    moduleRuns,
    requestedSectionKeys: caseData.requestedSectionKeys,
    requestedMacroAreaKeys: caseData.requestedMacroAreaKeys,
  });

  // Analytics (if mode === 'analitico')
  let analytics = null;
  if (mode === 'analitico') {
    analytics = buildAnalytics(evidenceItems, moduleRuns);
  }

  // Build sourceSections for analitico mode
  const sourceSections = projection.macroAreas.map((area) => {
    const sectionRows = area.sections.map((s) => {
      const run = moduleRuns.find((r) => r.sourceKey === s.sectionKey);
      let rowStatus = 'pending';
      if (['completed', 'completed_with_findings', 'completed_no_findings'].includes(s.executionStatus)) rowStatus = s.hasFindings ? 'ok' : 'ok';
      if (['failed', 'failed_retryable', 'failed_final'].includes(s.executionStatus)) rowStatus = 'error';
      if (s.executionStatus === 'running') rowStatus = 'pending';
      return {
        source: s.sectionKey,
        label: s.label,
        fonte: s.label,
        status: rowStatus,
        result: run?.resultSummary || s.statusLabel || '',
        error: run?.error || null,
      };
    });
    return {
      id: area.areaKey,
      title: area.label,
      icon: area.icon,
      count: area.sourcesWithResults,
      rows: sectionRows,
    };
  });

  // Build detailGroups for detalhado mode
  const detailGroups = projection.macroAreas.map((area) => ({
    id: `det-${area.areaKey}`,
    title: area.label,
    icon: area.icon,
    entries: area.sections.map((s) => {
      const run = moduleRuns.find((r) => r.sourceKey === s.sectionKey || r.moduleKey === s.sectionKey);
      const ev = evidenceItems.find((e) => e.sourceKey === s.sectionKey || e.sectionKey === s.sectionKey || e.sourceKey === run?.sourceKey);
      return {
        id: `${area.areaKey}-${s.sectionKey}`,
        title: s.label,
        paragraph: ev?.content?.paragraph || run?.resultSummary || s.statusLabel || '',
        table: ev?.content?.table || null,
      };
    }),
  }));

  // Build macroAreas tabs
  const macroAreas = projection.macroAreas.map((area, idx) => ({
    key: area.areaKey,
    label: area.label,
    icon: area.icon,
    active: idx === 0,
  }));

  res.json({
    success: true,
    data: {
      id: caseDoc.id,
      subjectName: caseData.name,
      candidateName: caseData.name,
      document: caseData.documentFormatted,
      cpf: caseData.subjectType === 'pf' ? caseData.document : null,
      cpfMasked: caseData.subjectType === 'pf' ? caseData.documentFormatted : null,
      cnpj: caseData.subjectType === 'pj' ? caseData.document : null,
      cnpjMasked: caseData.subjectType === 'pj' ? caseData.documentFormatted : null,
      status: mapStatusToLabel(caseData.status),
      productKey: caseData.schemaKey,
      riskScore: caseData.score?.overall != null ? String(caseData.score.overall) : null,
      riskLevel: caseData.riskLevel || '—',
      finalVerdict: caseData.analysis?.status === 'approved' ? 'Aprovado' : caseData.analysis?.status === 'rejected' ? 'Reprovado' : 'Pendente',
      progress: caseData.progress || 0,
      createdAt: caseData.createdAt?.toDate?.()
        ? caseData.createdAt.toDate().toLocaleString('pt-BR')
        : null,
      presetKey: caseData.presetKey,
      analystName: caseData.createdByName,
      monitoringEnabled: caseData.flags?.monitoria || false,
      workflow: caseData.flags?.workflow ? 'Automático' : 'Manual',
      sourceSections,
      detailGroups,
      macroAreas,
      moduleRuns: moduleRuns.map((r) => ({
        id: r.sourceKey || r.moduleKey,
        moduleKey: r.sourceKey || r.moduleKey,
        status: r.status,
        progress: r.progress || (r.status === 'completed' ? 100 : r.status === 'failed' ? 0 : 50),
        errorMessage: r.error || null,
      })),
      comments: comments.map((c) => ({
        id: c.id || '',
        text: c.text,
        author: c.authorName,
        authorName: c.authorName,
        createdAt: c.createdAt?.toDate?.()
          ? c.createdAt.toDate().toLocaleString('pt-BR')
          : null,
        highlighted: c.isRelevant || false,
      })),
      analysis: {
        conclusion: caseData.analysis?.conclusive || '',
        conclusive: caseData.analysis?.conclusive || '',
        status: caseData.analysis?.status || 'pending',
      },
      analytics,
    },
  });
}

// ---------------------------------------------------------------------------
// PROCESS — POST /api/v1/dossiers/:id/process
// ---------------------------------------------------------------------------

async function processDossier(req, res) {
  const tenantId = req.tenantId;
  const caseId = (req.routePath || '/').split('/')[1];

  const caseRef = db.collection(COLLECTIONS.CASES).doc(caseId);
  const caseDoc = await caseRef.get();

  if (!caseDoc.exists || (tenantId !== 'all' && caseDoc.data().tenantId !== tenantId)) {
    return res.status(404).json({
      success: false,
      error: { code: 'DOSSIER_NOT_FOUND', message: 'Dossiê não encontrado.' },
    });
  }

  await caseRef.update({ status: 'enriching', startedAt: new Date(), updatedAt: new Date() });

  res.json({
    success: true,
    data: { id: caseId, status: 'Processando', message: 'Processamento iniciado.' },
  });
}

// ---------------------------------------------------------------------------
// RETRY SOURCE — POST /api/v1/dossiers/:id/retry-source
// ---------------------------------------------------------------------------

async function retrySource(req, res) {
  const tenantId = req.tenantId;
  const caseId = (req.routePath || '/').split('/')[1];
  const { sourceKey } = req.body || {};

  if (!sourceKey) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ARGUMENT', message: 'sourceKey é obrigatório.' },
    });
  }

  const moduleRunsSnap = await db
    .collection(COLLECTIONS.MODULE_RUNS)
    .where('caseId', '==', caseId)
    .where('sourceKey', '==', sourceKey)
    .limit(1)
    .get();

  if (moduleRunsSnap.empty) {
    return res.status(404).json({
      success: false,
      error: { code: 'SOURCE_NOT_FOUND', message: 'Fonte não encontrada neste dossiê.' },
    });
  }

  const runRef = moduleRunsSnap.docs[0].ref;
  await runRef.update({
    status: 'pending',
    retryCount: 0,
    error: null,
    updatedAt: new Date(),
  });

  // Trigger will pick up the pending moduleRun
  res.json({
    success: true,
    data: { sourceKey, status: 'Reprocessamento solicitado.' },
  });
}

// ---------------------------------------------------------------------------
// REPROCESS BDC — POST /api/v1/dossiers/:id/reprocess-bdc
// ---------------------------------------------------------------------------

async function reprocessBdc(req, res) {
  const tenantId = req.tenantId;
  const caseId = (req.routePath || '/').split('/')[1];

  try {
    const { execute } = require('../../../application/dossier/reprocessBdc');
    const result = await execute({ caseId, tenantId });
    res.json({ success: true, data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

// ---------------------------------------------------------------------------
// PATCH — PATCH /api/v1/dossiers/:id
// ---------------------------------------------------------------------------

async function patchDossier(req, res) {
  const tenantId = req.tenantId;
  const caseId = (req.routePath || '/').split('/')[1];
  const updates = req.body || {};

  const caseRef = db.collection(COLLECTIONS.CASES).doc(caseId);
  const caseDoc = await caseRef.get();

  if (!caseDoc.exists || (tenantId !== 'all' && caseDoc.data().tenantId !== tenantId)) {
    return res.status(404).json({
      success: false,
      error: { code: 'DOSSIER_NOT_FOUND', message: 'Dossiê não encontrado.' },
    });
  }

  const allowedUpdates = {};
  if (updates.tag !== undefined) allowedUpdates.tag = updates.tag;
  if (updates.conclusive !== undefined) {
    allowedUpdates['analysis.conclusive'] = updates.conclusive;
  }
  if (updates.analysis?.conclusive !== undefined) {
    allowedUpdates['analysis.conclusive'] = updates.analysis.conclusive;
  }

  if (Object.keys(allowedUpdates).length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ARGUMENT', message: 'Nenhum campo atualizável fornecido.' },
    });
  }

  allowedUpdates.updatedAt = new Date();
  await caseRef.update(allowedUpdates);

  res.json({ success: true, data: { id: caseId, updated: Object.keys(allowedUpdates) } });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapStatusToLabel(status) {
  const map = {
    received: 'Iniciar',
    enriching: 'Processando',
    ready: 'Concluído',
    published: 'Publicado',
    correction_needed: 'Correção necessária',
  };
  return map[status] || status;
}

async function generateDossierNumber(tenantId) {
  const counterRef = db.collection('counters').doc(`dossier_${tenantId}`);

  return db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let nextNumber = 1;

    if (counterDoc.exists) {
      nextNumber = (counterDoc.data().value || 0) + 1;
    }

    transaction.set(counterRef, { value: nextNumber, updatedAt: new Date() });
    return String(nextNumber).padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1.$2');
  });
}

async function findOrCreateSubject(tenantId, document, name, type) {
  const subjectsRef = db.collection(COLLECTIONS.SUBJECTS);
  const existing = await subjectsRef
    .where('tenantId', '==', tenantId)
    .where('document', '==', document)
    .limit(1)
    .get();

  if (!existing.empty) {
    return existing.docs[0].ref;
  }

  const newSubject = subjectsRef.doc();
  await newSubject.set({
    tenantId,
    type,
    document,
    documentHash: docHash(document),
    name: name || '',
    basicData: {},
    emails: [],
    phones: [],
    addresses: [],
    caseIds: [],
    lastConsultedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return newSubject;
}

async function createModuleRuns(caseId, tenantId, config) {
  const runs = [];
  const { resolveSections } = require('../../../domain/dossierSchema');
  const sections = resolveSections(config.requestedSectionKeys);

  for (const section of sections) {
    for (const sourceKey of (section.sourceKeys || [])) {
      const runRef = db.collection(COLLECTIONS.MODULE_RUNS).doc();
      const runData = {
        tenantId,
        caseId,
        moduleKey: section.sectionKey,
        macroArea: section.macroArea,
        sourceKey,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        resultCount: 0,
        evidenceItemIds: [],
        wasReused: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await runRef.set(runData);
      runs.push({ id: runRef.id, ...runData });
    }
  }

  return runs;
}

function buildAnalytics(evidenceItems, moduleRuns) {
  const processes = extractProcesses(evidenceItems);

  const statusCounts = {};
  const tribunalCounts = {};
  const assuntoCounts = {};
  const varaCounts = {};
  const classeCounts = {};

  for (const p of processes) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    tribunalCounts[p.court] = (tribunalCounts[p.court] || 0) + 1;
    assuntoCounts[p.subject] = (assuntoCounts[p.subject] || 0) + 1;
    varaCounts[p.courtUnit] = (varaCounts[p.courtUnit] || 0) + 1;
    classeCounts[p.className] = (classeCounts[p.className] || 0) + 1;
  }

  return {
    total_processos: processes.length,
    processos_autor: processes.filter(p => p.participation === 'autor').length,
    processos_reu: processes.filter(p => p.participation === 'reu').length,
    processos_envolvido: processes.filter(p => p.participation === 'envolvido').length,
    processos_segredo: processes.filter(p => p.isSecret).length,
    graficos: {
      status_processos: statusCounts,
      por_tribunal: Object.entries(tribunalCounts).map(([nome, quantidade]) => ({ nome, quantidade })),
      por_assunto: Object.entries(assuntoCounts).map(([nome, quantidade]) => ({ nome, quantidade })),
      por_vara: Object.entries(varaCounts).map(([nome, quantidade]) => ({ nome, quantidade })),
      por_classe: Object.entries(classeCounts).map(([nome, quantidade]) => ({ nome, quantidade })),
    },
  };
}

// ---------------------------------------------------------------------------
// ANALYSIS SUB-ROUTES
// ---------------------------------------------------------------------------

async function createComment(req, res) {
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

  try {
    const { execute: addComment } = require('../../../application/analysis/addComment');
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
    status: 'published',
    'analysis.status': 'approved',
    'analysis.approvedBy': uid,
    'analysis.approvedAt': now,
    'analysis.decisionId': decisionRef.id,
    updatedAt: now,
  });

  res.json({ success: true, data: { id: caseId, status: 'published', analysis: 'approved', decisionId: decisionRef.id } });
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
    status: 'correction_needed',
    'analysis.status': 'rejected',
    'analysis.rejectedBy': uid,
    'analysis.rejectedAt': now,
    'analysis.rejectionReason': body.reason || '',
    'analysis.decisionId': decisionRef.id,
    updatedAt: now,
  });

  res.json({ success: true, data: { id: caseId, status: 'correction_needed', analysis: 'rejected', decisionId: decisionRef.id } });
}

function extractProcesses(evidenceItems) {
  const processes = [];
  for (const item of evidenceItems) {
    if (item.evidenceType === 'process_list' && item.content?.processes) {
      processes.push(...item.content.processes);
    }
  }
  return processes;
}

module.exports = { dossierController };
