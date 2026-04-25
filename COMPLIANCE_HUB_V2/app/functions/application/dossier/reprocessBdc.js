/**
 * Application: Reprocess BDC for an existing dossier.
 * Manually runs BigDataCorp enrichment for all pending/failed BDC moduleRuns
 * and updates the case to ready.
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../constants/collections');
const { enrichFromPreset } = require('../../services/bdcEnrichmentOrchestrator');
const { getDatasetsForPreset } = require('../../adapters/bigdatacorpCatalog');

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
const { normalizeRelationships, buildRelationshipEvidenceContent } = require('../../normalizers/bigdatacorp/relationships');

const db = getFirestore();

const BDC_CREDENTIALS = {
  accessToken: process.env.BIGDATACORP_ACCESS_TOKEN || '',
  tokenId: process.env.BIGDATACORP_TOKEN_ID || '',
};

function summarizeRaw(rawData) {
  if (Array.isArray(rawData)) return { type: 'array', length: rawData.length };
  if (typeof rawData === 'object') return { type: 'object', keys: Object.keys(rawData) };
  return { type: typeof rawData };
}

async function buildEvidence(caseData, datasetKey, rawData) {
  const subjectType = caseData.subjectType;
  let evidenceContent = null;
  let resultCount = 0;

  switch (datasetKey) {
    case 'basic_data': {
      const normalizer = subjectType === 'pj' ? normalizeBasicDataEmpresa : normalizeBasicDataPessoa;
      const normalized = normalizer(rawData);
      const contacts = normalizeContacts(rawData);
      if (normalized && caseData.subjectId) {
        await db.collection(COLLECTIONS.SUBJECTS).doc(caseData.subjectId).update({
          basicData: { ...normalized, lastUpdated: new Date() },
          emails: contacts.emails,
          phones: contacts.phones,
          addresses: contacts.addresses,
          lastConsultedAt: new Date(),
        });
      }
      evidenceContent = { text: 'Dados cadastrais consultados com sucesso.', basicData: normalized, contacts };
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
      evidenceContent = { text: 'Dados financeiros consultados.', rawSummary: summarizeRaw(rawData) };
      resultCount = rawData ? 1 : 0;
      break;
    }
    case 'class_organization': {
      evidenceContent = { text: 'Conselhos de classe consultados.', memberships: rawData };
      resultCount = Array.isArray(rawData) ? rawData.length : 0;
      break;
    }
    case 'relationships': {
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

  return { evidenceContent, resultCount };
}

/**
 * Execute BDC reprocessing for a given case.
 * @param {object} params
 * @param {string} params.caseId
 * @param {string} params.tenantId
 * @returns {Promise<object>}
 */
async function execute(params) {
  const { caseId, tenantId } = params;

  if (!BDC_CREDENTIALS.accessToken || !BDC_CREDENTIALS.tokenId) {
    const error = new Error('Credenciais BDC não configuradas no ambiente.');
    error.code = 'BDC_CREDENTIALS_MISSING';
    error.statusCode = 500;
    throw error;
  }

  const caseRef = db.collection(COLLECTIONS.CASES).doc(caseId);
  const caseDoc = await caseRef.get();

  if (!caseDoc.exists) {
    const error = new Error('Dossiê não encontrado.');
    error.code = 'DOSSIER_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const caseData = caseDoc.data();
  if (tenantId !== 'all' && caseData.tenantId !== tenantId) {
    const error = new Error('Dossiê não pertence ao tenant.');
    error.code = 'CASE_NOT_IN_TENANT';
    error.statusCode = 403;
    throw error;
  }

  // Reset case status
  await caseRef.update({ status: 'enriching', updatedAt: new Date() });

  // Fetch BDC moduleRuns
  const runsSnap = await db.collection(COLLECTIONS.MODULE_RUNS)
    .where('caseId', '==', caseId)
    .get();

  const runsBySource = {};
  for (const d of runsSnap.docs) {
    const run = d.data();
    if (!run.sourceKey?.startsWith('bigdatacorp_')) continue;
    const dsKey = run.sourceKey.replace('bigdatacorp_', '');
    if (!runsBySource[dsKey]) runsBySource[dsKey] = [];
    runsBySource[dsKey].push({ id: d.id, ref: d.ref, ...run });
  }

  let datasets = getDatasetsForPreset(caseData.presetKey || 'compliance', caseData.subjectType || 'pf');
  if (!datasets.length) {
    datasets = Object.keys(runsBySource);
  }

  if (!datasets.length) {
    await caseRef.update({ status: 'ready', updatedAt: new Date() });
    return { caseId, status: 'ready', message: 'Nenhum dataset BDC para processar.' };
  }

  // Call BDC
  const enrichment = await enrichFromPreset(caseData.document, BDC_CREDENTIALS, {
    presetKey: caseData.presetKey || 'compliance',
    subjectType: caseData.subjectType || 'pf',
    extraDatasets: datasets,
  });

  if (enrichment.status === 'failed') {
    await caseRef.update({
      status: 'correction_needed',
      error: { message: enrichment.errors.join('; '), code: 'BDC_ERROR' },
      updatedAt: new Date(),
    });
    const error = new Error(`BDC falhou: ${enrichment.errors.join('; ')}`);
    error.code = 'BDC_ERROR';
    error.statusCode = 502;
    throw error;
  }

  const resultEntry = enrichment.resultEntry || {};
  console.log(`[reprocessBdc] caseId=${caseId} BDC resultEntry keys:`, Object.keys(resultEntry));
  console.log(`[reprocessBdc] caseId=${caseId} BDC raw keys sample:`, Object.keys(enrichment.raw || {}).slice(0, 20));
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

  let completedCount = 0;
  let failedCount = 0;

  for (const dsKey of datasets) {
    const runs = runsBySource[dsKey];
    if (!runs || runs.length === 0) continue;

    const resultKey = keyMap[dsKey];
    const rawData = resultEntry?.[resultKey] || null;
    console.log(`[reprocessBdc] caseId=${caseId} dataset=${dsKey} resultKey=${resultKey} hasData=${!!rawData}`);

    if (!rawData) {
      for (const run of runs) {
        await run.ref.update({ status: 'completed_no_findings', resultCount: 0, updatedAt: new Date() });
      }
      completedCount++;
      continue;
    }

    try {
      const { evidenceContent, resultCount } = await buildEvidence(caseData, dsKey, rawData);
      const evidenceRef = db.collection(COLLECTIONS.EVIDENCE_ITEMS).doc();
      await evidenceRef.set({
        tenantId: caseData.tenantId,
        caseId,
        moduleRunId: runs[0].id,
        macroArea: runs[0].macroArea,
        sectionKey: runs[0].moduleKey,
        sourceKey: runs[0].sourceKey,
        evidenceType: dsKey === 'processes' ? 'process_list' : 'paragraph',
        content: evidenceContent,
        isRelevant: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const status = resultCount > 0 ? 'completed_with_findings' : 'completed_no_findings';
      for (const run of runs) {
        await run.ref.update({
          status,
          resultCount,
          evidenceItemIds: [evidenceRef.id],
          completedAt: new Date(),
          updatedAt: new Date(),
        });
      }
      completedCount++;
    } catch (err) {
      for (const run of runs) {
        await run.ref.update({
          status: 'failed_final',
          error: { message: err.message, code: 'PROCESS_ERROR' },
          updatedAt: new Date(),
        });
      }
      failedCount++;
    }
  }

  // Skip non-BDC pending runs so case can complete
  let skippedCount = 0;
  for (const d of runsSnap.docs) {
    const run = d.data();
    if (!run.sourceKey?.startsWith('bigdatacorp_')) {
      if (run.status === 'pending') {
        await d.ref.update({ status: 'skipped_policy', updatedAt: new Date() });
        skippedCount++;
      }
    }
  }

  const totalRuns = runsSnap.size;
  const progress = totalRuns > 0 ? Math.round((completedCount / totalRuns) * 100) : 100;

  await caseRef.update({
    status: 'ready',
    progress,
    progressDetail: {
      totalSources: totalRuns,
      completed: completedCount + skippedCount,
      withFindings: completedCount,
      failed: failedCount,
      pending: 0,
      sources: [],
    },
    completedAt: new Date(),
    lastProcessedAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    caseId,
    status: 'ready',
    bdcStatus: enrichment.status,
    datasetsProcessed: datasets.length,
    completed: completedCount,
    failed: failedCount,
    skipped: skippedCount,
    progress,
    elapsedMs: enrichment.elapsedMs,
  };
}

module.exports = { execute };
