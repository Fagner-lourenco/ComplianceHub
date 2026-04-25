/**
 * Application: Create Dossier Use Case
 * Orchestrates dossier creation with schema resolution, subject lookup,
 * module run generation, and optional auto-processing.
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../constants/collections');
const { resolveDossierConfiguration, resolveSections } = require('../../domain/dossierSchema');
const { validateDocument, formatDocument } = require('../../helpers/cpfCnpj');
const { docHash } = require('../../helpers/hash');
const { resolveTenantEntitlements, isTenantFeatureEnabled, FEATURE_FLAGS } = require('../../domain/v2EntitlementResolver');

const db = getFirestore();

/**
 * Execute the create dossier use case.
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.uid
 * @param {object} params.profile
 * @param {'pf'|'pj'} params.subjectType
 * @param {string} params.document
 * @param {string} params.name
 * @param {string} [params.presetKey='compliance']
 * @param {string} [params.tag]
 * @param {boolean} [params.autoProcess=true]
 * @param {object} [params.parameters]
 * @returns {Promise<object>} created dossier
 */
async function execute(params) {
  const {
    tenantId,
    uid,
    profile,
    subjectType: inputSubjectType,
    document,
    name,
    presetKey = 'compliance',
    tag,
    autoProcess = true,
    parameters = {},
  } = params;

  // Validate document
  const docValidation = validateDocument(document);
  if (!docValidation.valid) {
    const error = new Error('CPF ou CNPJ inválido.');
    error.code = 'INVALID_DOCUMENT';
    error.statusCode = 400;
    throw error;
  }

  // ── Entitlement check ──
  const tenantSnap = await db.collection(COLLECTIONS.TENANT_ENTITLEMENTS).doc(tenantId).get();
  const entitlements = resolveTenantEntitlements(tenantSnap.exists ? tenantSnap.data() : {});

  if (!isTenantFeatureEnabled(entitlements, FEATURE_FLAGS.CASE_CREATION)) {
    const error = new Error('Tenant não possui permissão para criação de dossiês.');
    error.code = 'NOT_ENTITLED';
    error.statusCode = 403;
    throw error;
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
      const error = new Error('Limite mensal de dossiês atingido.');
      error.code = 'QUOTA_EXCEEDED';
      error.statusCode = 429;
      throw error;
    }
  }

  // Preset entitlement check
  const enabledProducts = entitlements.enabledProducts || [];
  if (enabledProducts.length > 0 && !enabledProducts.includes(presetKey)) {
    const error = new Error(`Preset '${presetKey}' não contratado pelo tenant.`);
    error.code = 'PRESET_NOT_ENTITLED';
    error.statusCode = 403;
    throw error;
  }

  const inferredType = inputSubjectType || docValidation.type;
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

  // Filter sections by entitled modules
  const enabledModules = entitlements.enabledModules || [];
  if (enabledModules.length > 0) {
    config.requestedSectionKeys = config.requestedSectionKeys.filter((sk) => enabledModules.includes(sk));
    config.requestedMacroAreaKeys = config.requestedMacroAreaKeys.filter((mk) => enabledModules.includes(mk));
  }

  if (!config.isValid) {
    const error = new Error(config.validationErrors.join('; '));
    error.code = 'VALIDATION_ERROR';
    error.statusCode = 400;
    throw error;
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
    status: autoProcess ? 'enriching' : 'received',
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

  return {
    id: caseRef.id,
    dossierNumber,
    status: caseData.status,
    progress: 0,
    moduleRunCount: moduleRuns.length,
    config,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

module.exports = { execute };
