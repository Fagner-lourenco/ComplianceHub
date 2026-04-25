/**
 * Trigger: onCaseCreated
 * Orchestrates BDC-first enrichment when a case is created with autoProcess.
 *
 * Flow:
 * 1. Check if case.status === 'enriching'
 * 2. For each pending moduleRun with BDC sourceKey:
 *    a. Check Provider Ledger cache
 *    b. If not cached: call BDC adapter
 *    c. Store rawSnapshot
 *    d. Create providerRequest
 *    e. Normalize response
 *    f. Create evidenceItems
 *    g. Update moduleRun status
 * 3. When all runs complete: calculate score, update case to 'ready'
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../constants/collections');
const { CASE_STATUS_V2 } = require('../../domain/v2CaseStatus');
const { recalculateAndSaveScore } = require('../../domain/v2ScoreEngine');
const { queryCombined, callPost } = require('../../adapters/bigdatacorp');
const { BdcQueryBuilder } = require('../../adapters/bigdatacorpQueryBuilder');
const { getDataset } = require('../../adapters/bigdatacorpCatalog');
const { providerCacheKey, docHash } = require('../../helpers/hash');
const { normalizeProcesses, buildProcessListEvidence } = require('../../normalizers/bigdatacorp/processes');
const { normalizeKyc, buildKycEvidenceContent } = require('../../normalizers/bigdatacorp/kyc');
const { normalizeBasicDataPessoa, normalizeBasicDataEmpresa, normalizeContacts } = require('../../normalizers/bigdatacorp/basicData');
const { normalizeOccupation } = require('../../normalizers/bigdatacorp/occupation');
const { normalizeOnlinePresence, buildOnlinePresenceEvidenceContent } = require('../../normalizers/bigdatacorp/onlinePresence');
const { normalizeActivityIndicators, buildActivityIndicatorsEvidenceContent } = require('../../normalizers/bigdatacorp/activityIndicators');
const { normalizeCompanyEvolution, buildCompanyEvolutionEvidenceContent } = require('../../normalizers/bigdatacorp/companyEvolution');
const { normalizeOwnersKyc, buildOwnersKycEvidenceContent } = require('../../normalizers/bigdatacorp/ownersKyc');
const { normalizeGovernmentDebtors, buildGovernmentDebtorsEvidenceContent } = require('../../normalizers/bigdatacorp/governmentDebtors');
const { normalizeCollections, buildCollectionsEvidenceContent } = require('../../normalizers/bigdatacorp/collections');
const { uploadJsonIfLarge } = require('../../infrastructure/storage/cloudStorage');
const { syncClientCaseListProjection } = require('../../domain/v2ClientProjectionBuilder');

const db = getFirestore();

// BDC credentials from environment
const BDC_CREDENTIALS = {
  accessToken: process.env.BIGDATACORP_ACCESS_TOKEN || '',
  tokenId: process.env.BIGDATACORP_TOKEN_ID || '',
};

exports.enrichBigDataCorpOnCaseV2 = onDocumentCreated(
  { document: 'cases/{caseId}', region: 'southamerica-east1' },
  async (event) => {
    const caseId = event.params.caseId;
    const snap = event.data;
    if (!snap) return;

    const caseData = snap.data();
    if (!caseData || caseData.status !== CASE_STATUS_V2.ENRICHING) {
      return;
    }

    // Only process BDC sourceKeys
    const bdcRunsSnap = await db.collection(COLLECTIONS.MODULE_RUNS)
      .where('caseId', '==', caseId)
      .where('status', '==', 'pending')
      .where('sourceKey', '>=', 'bigdatacorp_')
      .where('sourceKey', '<', 'bigdatacorp_\uf8ff')
      .get();

    if (bdcRunsSnap.empty) {
      // No BDC runs pending — check if all runs are done
      await checkCompletion(caseId);
      return;
    }

    // Group runs by dataset to make combined calls
    const runsByDataset = {};
    for (const doc of bdcRunsSnap.docs) {
      const run = doc.data();
      const datasetKey = run.sourceKey.replace('bigdatacorp_', '');
      if (!runsByDataset[datasetKey]) runsByDataset[datasetKey] = [];
      runsByDataset[datasetKey].push({ id: doc.id, ref: doc.ref, ...run });
    }

    // Execute BDC queries
    const subjectType = caseData.subjectType;
    const document = caseData.document;
    const endpoint = subjectType === 'pj' ? '/empresas' : '/pessoas';

    try {
      // For efficiency: call combined query for all requested datasets
      const standardDatasets = ['basic_data', 'processes', 'kyc', 'occupation_data'];
      const extendedDatasets = Object.keys(runsByDataset).filter(ds => !standardDatasets.includes(ds));
      const allDatasets = [...standardDatasets.filter(ds => runsByDataset[ds]), ...extendedDatasets];
      const needsCombined = allDatasets.length > 0;

      let combinedResult = null;
      if (needsCombined) {
        combinedResult = await queryCombined(document, BDC_CREDENTIALS, {
          datasets: allDatasets,
          subjectType: caseData.subjectType || 'pf',
        });
      }

      // Process each dataset
      for (const [datasetKey, runs] of Object.entries(runsByDataset)) {
        await processDataset(caseId, caseData.tenantId, datasetKey, runs, combinedResult, endpoint);
      }

      // Check completion
      await checkCompletion(caseId);
    } catch (error) {
      console.error(`enrichBigDataCorpOnCaseV2 failed for ${caseId}:`, error);
      await db.collection(COLLECTIONS.CASES).doc(caseId).update({
        status: CASE_STATUS_V2.CORRECTION_NEEDED,
        error: { message: error.message, code: error.code || 'BDC_ERROR' },
        updatedAt: new Date(),
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Dataset Processing
// ---------------------------------------------------------------------------

async function processDataset(caseId, tenantId, datasetKey, runs, combinedResult, endpoint) {
  const datasetDef = getDataset(datasetKey);
  if (!datasetDef) {
    // Unknown dataset — mark runs as failed
    for (const run of runs) {
      await run.ref.update({
        status: 'failed_final',
        error: { code: 'UNKNOWN_DATASET', message: `Dataset ${datasetKey} not in catalog.` },
        updatedAt: new Date(),
      });
    }
    return;
  }

  // Check Provider Ledger cache
  const caseDoc = await db.collection(COLLECTIONS.CASES).doc(caseId).get();
  const caseData = caseDoc.data();
  const docHashValue = docHash(caseData.document);
  const cacheKey = providerCacheKey({
    tenantId,
    provider: 'bigdatacorp',
    endpoint,
    dataset: datasetKey,
    docHash: docHashValue,
  });

  const cachedRequest = await db.collection(COLLECTIONS.PROVIDER_REQUESTS)
    .where('tenantId', '==', tenantId)
    .where('queryHash', '==', cacheKey)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  let rawData = null;
  let wasReused = false;
  let providerRequestId = null;

  if (!cachedRequest.empty) {
    const cached = cachedRequest.docs[0].data();
    const freshnessMs = (datasetDef.freshnessHours || 24) * 3600_000;
    const cachedAt = cached.createdAt?.toMillis?.() || Date.now();

    if (Date.now() - cachedAt < freshnessMs) {
      // Cache hit
      const rawSnap = await db.collection(COLLECTIONS.RAW_SNAPSHOTS)
        .doc(cached.rawSnapshotId)
        .get();
      if (rawSnap.exists) {
        rawData = rawSnap.data().payload;
        wasReused = true;
        providerRequestId = cachedRequest.docs[0].id;

        // Update reuse count
        await cachedRequest.docs[0].ref.update({
          reusedCount: (cached.reusedCount || 0) + 1,
        });
      }
    }
  }

  // Cache miss — call BDC
  if (!rawData) {
    if (combinedResult) {
      // Extract from combined call result using the resultEntry keys
      const resultEntry = combinedResult.resultEntry;
      if (resultEntry) {
        const keyMap = {
          basic_data: 'BasicData',
          processes: 'Processes',
          kyc: 'KycData',
          occupation_data: 'ProfessionData',
          phones_extended: 'ExtendedPhones',
          addresses_extended: 'ExtendedAddresses',
          emails_extended: 'ExtendedEmails',
          online_presence: 'OnlinePresence',
          financial_data: 'FinantialData',
          class_organization: 'Memberships',
          relationships: 'Relationships',
          activity_indicators: 'ActivityIndicators',
          company_evolution: 'CompanyEvolutionData',
          owners_kyc: 'OwnersKycData',
          government_debtors: 'GovernmentDebtors',
          collections: 'Collections',
        };
        const resultKey = keyMap[datasetKey];
        if (resultKey && resultEntry[resultKey] !== undefined) {
          rawData = resultEntry[resultKey];
        }
      }
    }

    if (rawData === null) {
      // Standalone call
      const builder = new BdcQueryBuilder();
      builder.addDataset(datasetKey, { limit: datasetDef.maxLimit || 100 });
      const body = builder.buildBody(`doc{${caseData.document}} returnupdates{false}`);

      const response = await callPost(endpoint, body, BDC_CREDENTIALS);
      const entry = Array.isArray(response?.Result) ? response.Result[0] : null;
      rawData = entry?.[capitalizeFirst(datasetKey)] || entry;
    }

    // Store raw snapshot
    const rawRef = db.collection(COLLECTIONS.RAW_SNAPSHOTS).doc();
    const storageResult = await uploadJsonIfLarge(
      `raw-snapshots/${tenantId}/${rawRef.id}.json`,
      rawData
    );

    await rawRef.set({
      tenantId,
      payload: storageResult.stored ? null : rawData,
      payloadSize: storageResult.size,
      storagePath: storageResult.path || null,
      createdAt: new Date(),
    });

    // Create provider request
    const reqRef = db.collection(COLLECTIONS.PROVIDER_REQUESTS).doc();
    await reqRef.set({
      tenantId,
      caseId,
      moduleRunId: runs[0].id,
      provider: 'bigdatacorp',
      endpoint,
      datasetKey,
      queryKey: `doc{${caseData.document}}`,
      queryHash: cacheKey,
      cost: typeof datasetDef.cost === 'object'
        ? datasetDef.cost[caseData.subjectType] || datasetDef.cost.default || 0
        : datasetDef.cost || 0,
      currency: 'BRL',
      isReusable: true,
      freshnessHours: datasetDef.freshnessHours || 24,
      reusedCount: 0,
      rawSnapshotId: rawRef.id,
      responseStatus: 0,
      responseTimeMs: 0,
      createdAt: new Date(),
    });

    providerRequestId = reqRef.id;

    // Create provider record (ledger-level abstraction)
    const recordRef = db.collection(COLLECTIONS.PROVIDER_RECORDS).doc();
    await recordRef.set({
      tenantId,
      caseId,
      subjectId: caseData.subjectId,
      moduleRunId: runs[0].id,
      providerRequestId: reqRef.id,
      provider: 'bigdatacorp',
      endpoint,
      datasetKey,
      document: caseData.document,
      subjectType: caseData.subjectType,
      cost: typeof datasetDef.cost === 'object'
        ? datasetDef.cost[caseData.subjectType] || datasetDef.cost.default || 0
        : datasetDef.cost || 0,
      currency: 'BRL',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Normalize and create evidence
  let evidenceContent = null;
  let resultCount = 0;

  switch (datasetKey) {
    case 'basic_data': {
      const normalizer = caseData.subjectType === 'pj'
        ? normalizeBasicDataEmpresa
        : normalizeBasicDataPessoa;
      const normalized = normalizer(rawData);
      const contacts = normalizeContacts(rawData);

      if (normalized) {
        // Update subject cache
        await db.collection(COLLECTIONS.SUBJECTS).doc(caseData.subjectId).update({
          basicData: { ...normalized, lastUpdated: new Date() },
          emails: contacts.emails,
          phones: contacts.phones,
          addresses: contacts.addresses,
          lastConsultedAt: new Date(),
        });
      }

      evidenceContent = {
        text: `Dados cadastrais consultados com sucesso.`,
        basicData: normalized,
        contacts,
      };
      resultCount = 1;
      break;
    }

    case 'processes': {
      const processes = normalizeProcesses(rawData);
      evidenceContent = buildProcessListEvidence(processes);
      resultCount = processes.length;
      break;
    }

    case 'kyc': {
      const kyc = normalizeKyc(rawData);
      evidenceContent = buildKycEvidenceContent(kyc);
      resultCount = kyc?.hasPep || kyc?.hasSanctions ? 1 : 0;
      break;
    }

    case 'occupation_data': {
      const occupation = normalizeOccupation(rawData);
      evidenceContent = {
        text: occupation ? `Ocupação: ${occupation.jobs.map(j => j.title).join(', ')}` : 'Nenhum dado de ocupação encontrado.',
        occupation,
      };
      resultCount = occupation?.jobs?.length || 0;
      break;
    }

    case 'phones_extended':
    case 'addresses_extended':
    case 'emails_extended': {
      const contacts = normalizeContacts(rawData);
      const typeLabel = datasetKey === 'phones_extended' ? 'telefones' : datasetKey === 'addresses_extended' ? 'endereços' : 'e-mails';
      evidenceContent = {
        text: `Contato (${typeLabel}): ${contacts.stats?.[datasetKey === 'phones_extended' ? 'phones' : datasetKey === 'addresses_extended' ? 'addresses' : 'emails']?.total || 0} registro(s).`,
        contacts,
      };
      resultCount = contacts.emails?.length || contacts.phones?.length || contacts.addresses?.length || 0;
      break;
    }

    case 'online_presence': {
      const presence = normalizeOnlinePresence(rawData);
      evidenceContent = buildOnlinePresenceEvidenceContent(presence);
      resultCount = presence?.totalWebPassages || 0;
      break;
    }

    case 'financial_data': {
      // financial_data returns FinantialData for both PF and PJ
      evidenceContent = {
        text: 'Dados financeiros consultados.',
        rawSummary: summarizeRaw(rawData),
      };
      resultCount = rawData ? 1 : 0;
      break;
    }

    case 'class_organization': {
      evidenceContent = {
        text: 'Conselhos de classe consultados.',
        memberships: rawData,
      };
      resultCount = Array.isArray(rawData) ? rawData.length : 0;
      break;
    }

    case 'relationships': {
      const { normalizeRelationships, buildRelationshipEvidenceContent } = require('../../normalizers/bigdatacorp/relationships');
      const rels = normalizeRelationships(rawData);
      evidenceContent = buildRelationshipEvidenceContent(rels);
      resultCount = rels?.count || 0;
      break;
    }

    case 'activity_indicators': {
      const indicators = normalizeActivityIndicators(rawData);
      evidenceContent = buildActivityIndicatorsEvidenceContent(indicators);
      resultCount = indicators?.hasActivity ? 1 : 0;
      break;
    }

    case 'company_evolution': {
      const evolution = normalizeCompanyEvolution(rawData);
      evidenceContent = buildCompanyEvolutionEvidenceContent(evolution);
      resultCount = evolution?.history?.length || 0;
      break;
    }

    case 'owners_kyc': {
      const ownersKyc = normalizeOwnersKyc(rawData);
      evidenceContent = buildOwnersKycEvidenceContent(ownersKyc);
      resultCount = ownersKyc?.totalCurrentlyPep || ownersKyc?.totalCurrentlySanctioned || 0;
      break;
    }

    case 'government_debtors': {
      const debtors = normalizeGovernmentDebtors(rawData);
      evidenceContent = buildGovernmentDebtorsEvidenceContent(debtors);
      resultCount = debtors?.isGovernmentDebtor ? 1 : 0;
      break;
    }

    case 'collections': {
      const collections = normalizeCollections(rawData);
      evidenceContent = buildCollectionsEvidenceContent(collections);
      resultCount = collections?.totalCompanies || 0;
      break;
    }

    default:
      evidenceContent = { text: `Dataset ${datasetKey} consultado.`, rawSummary: summarizeRaw(rawData) };
      resultCount = Array.isArray(rawData) ? rawData.length : rawData ? 1 : 0;
  }

  // Create evidence item
  const evidenceRef = db.collection(COLLECTIONS.EVIDENCE_ITEMS).doc();
  await evidenceRef.set({
    tenantId,
    caseId,
    moduleRunId: runs[0].id,
    macroArea: runs[0].macroArea,
    sectionKey: runs[0].moduleKey,
    sourceKey: runs[0].sourceKey,
    evidenceType: datasetKey === 'processes' ? 'process_list' : 'paragraph',
    content: evidenceContent,
    isRelevant: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Update module runs
  const status = resultCount > 0 ? 'completed_with_findings' : 'completed_no_findings';
  for (const run of runs) {
    await run.ref.update({
      status,
      resultCount,
      evidenceItemIds: [evidenceRef.id],
      providerRequestId,
      wasReused,
      completedAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

// ---------------------------------------------------------------------------
// Completion Check
// ---------------------------------------------------------------------------

async function checkCompletion(caseId) {
  const [caseDoc, runsSnap] = await Promise.all([
    db.collection(COLLECTIONS.CASES).doc(caseId).get(),
    db.collection(COLLECTIONS.MODULE_RUNS).where('caseId', '==', caseId).get(),
  ]);

  if (!caseDoc.exists) return;

  const runs = runsSnap.docs.map(d => d.data());
  const allDone = runs.every(r =>
    ['completed_with_findings', 'completed_no_findings', 'skipped_reuse',
     'skipped_policy', 'failed_final', 'not_entitled'].includes(r.status)
  );

  if (!allDone) return;

  // Calculate progress
  const completed = runs.filter(r =>
    ['completed_with_findings', 'completed_no_findings', 'skipped_reuse'].includes(r.status)
  ).length;
  const progress = Math.round((completed / runs.length) * 100);

  // Calculate score
  let score = null;
  try {
    score = await recalculateAndSaveScore(db, caseId);
  } catch (err) {
    console.error(`Score calculation failed for ${caseId}:`, err);
  }

  // Sync client-safe projection
  try {
    await syncClientCaseListProjection(caseId, caseDoc.data());
  } catch (err) {
    console.error(`syncClientCaseListProjection failed for ${caseId}:`, err);
  }

  // Update case to ready
  await db.collection(COLLECTIONS.CASES).doc(caseId).update({
    status: CASE_STATUS_V2.READY,
    progress,
    progressDetail: {
      totalSources: runs.length,
      completed,
      withFindings: runs.filter(r => r.status === 'completed_with_findings').length,
      failed: runs.filter(r => r.status === 'failed_final').length,
      pending: 0,
      sources: runs.map(r => ({
        sourceKey: r.sourceKey,
        status: r.status,
        label: mapStatusLabel(r.status),
        variant: mapStatusVariant(r.status),
      })),
    },
    score,
    completedAt: new Date(),
    lastProcessedAt: new Date(),
    updatedAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function summarizeRaw(rawData) {
  if (Array.isArray(rawData)) return { type: 'array', length: rawData.length };
  if (typeof rawData === 'object') return { type: 'object', keys: Object.keys(rawData) };
  return { type: typeof rawData };
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
