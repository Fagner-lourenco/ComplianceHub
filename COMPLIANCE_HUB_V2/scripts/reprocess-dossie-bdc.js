#!/usr/bin/env node
/**
 * Reprocessa um dossiê existente executando todas as consultas BDC
 * até que todos os moduleRuns estejam completos.
 *
 * Uso:
 *   node scripts/reprocess-dossie-bdc.js <caseId> [--env ../app/functions/.env]
 *
 * Exemplo:
 *   node scripts/reprocess-dossie-bdc.js PndArfG2NzVHd8Y7yksO
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 1. Load environment (BDC credentials + Firebase)
// ---------------------------------------------------------------------------
function loadEnvFile(filePath) {
  const full = path.resolve(filePath);
  if (!fs.existsSync(full)) return;
  const content = fs.readFileSync(full, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// Try multiple env sources
loadEnvFile(path.join(__dirname, '..', '.env.bdc'));
loadEnvFile(path.join(__dirname, '..', 'app', 'functions', '.env'));
loadEnvFile(path.join(__dirname, '..', 'app', '.env.local'));

// ---------------------------------------------------------------------------
// 2. Initialize Firebase Admin
// ---------------------------------------------------------------------------
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (require('firebase-admin').apps.length === 0) {
  initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'compliance-hub-v2' });
}
const db = getFirestore();

// ---------------------------------------------------------------------------
// 3. Imports from functions codebase
// ---------------------------------------------------------------------------
const { enrichFromPreset } = require('../app/functions/services/bdcEnrichmentOrchestrator');
const { getDatasetsForPreset } = require('../app/functions/adapters/bigdatacorpCatalog');
const { COLLECTIONS } = require('../app/functions/constants/collections');

// Normalizers & evidence builders used by the trigger
const { normalizeProcesses, buildProcessListEvidence } = require('../app/functions/normalizers/bigdatacorp/processes');
const { normalizeKyc, buildKycEvidenceContent } = require('../app/functions/normalizers/bigdatacorp/kyc');
const { normalizeBasicDataPessoa, normalizeBasicDataEmpresa, normalizeContacts } = require('../app/functions/normalizers/bigdatacorp/basicData');
const { normalizeOccupation } = require('../app/functions/normalizers/bigdatacorp/occupation');
const { normalizeOnlinePresence, buildOnlinePresenceEvidenceContent } = require('../app/functions/normalizers/bigdatacorp/onlinePresence');
const { normalizeActivityIndicators, buildActivityIndicatorsEvidenceContent } = require('../app/functions/normalizers/bigdatacorp/activityIndicators');
const { normalizeCompanyEvolution, buildCompanyEvolutionEvidenceContent } = require('../app/functions/normalizers/bigdatacorp/companyEvolution');
const { normalizeOwnersKyc, buildOwnersKycEvidenceContent } = require('../app/functions/normalizers/bigdatacorp/ownersKyc');
const { normalizeGovernmentDebtors, buildGovernmentDebtorsEvidenceContent } = require('../app/functions/normalizers/bigdatacorp/governmentDebtors');
const { normalizeCollections, buildCollectionsEvidenceContent } = require('../app/functions/normalizers/bigdatacorp/collections');
const { normalizeRelationships, buildRelationshipEvidenceContent } = require('../app/functions/normalizers/bigdatacorp/relationships');

// ---------------------------------------------------------------------------
// 4. CLI args
// ---------------------------------------------------------------------------
const caseId = process.argv[2];
if (!caseId) {
  console.error('❌ Uso: node scripts/reprocess-dossie-bdc.js <caseId>');
  process.exit(1);
}

const BDC_CREDENTIALS = {
  accessToken: process.env.BIGDATACORP_ACCESS_TOKEN || '',
  tokenId: process.env.BIGDATACORP_TOKEN_ID || '',
};

if (!BDC_CREDENTIALS.accessToken || !BDC_CREDENTIALS.tokenId) {
  console.error('❌ Credenciais BDC não encontradas. Defina BIGDATACORP_ACCESS_TOKEN e BIGDATACORP_TOKEN_ID.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 5. Helpers
// ---------------------------------------------------------------------------
function summarizeRaw(rawData) {
  if (Array.isArray(rawData)) return { type: 'array', length: rawData.length };
  if (typeof rawData === 'object') return { type: 'object', keys: Object.keys(rawData) };
  return { type: typeof rawData };
}

async function runDataset(caseData, datasetKey, rawData) {
  const tenantId = caseData.tenantId;
  const subjectType = caseData.subjectType;

  let evidenceContent = null;
  let resultCount = 0;

  switch (datasetKey) {
    case 'basic_data': {
      const normalizer = subjectType === 'pj' ? normalizeBasicDataEmpresa : normalizeBasicDataPessoa;
      const normalized = normalizer(rawData);
      const contacts = normalizeContacts(rawData);
      if (normalized) {
        await db.collection(COLLECTIONS.SUBJECTS).doc(caseData.subjectId).update({
          basicData: { ...normalized, lastUpdated: new Date() },
          emails: contacts.emails,
          phones: contacts.phones,
          addresses: contacts.addresses,
          lastConsultedAt: new Date(),
        });
      }
      evidenceContent = { text: `Dados cadastrais consultados com sucesso.`, basicData: normalized, contacts };
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

// ---------------------------------------------------------------------------
// 6. Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n🔄 Reprocessando dossiê ${caseId}...\n`);

  // Fetch case
  const caseRef = db.collection(COLLECTIONS.CASES).doc(caseId);
  const caseDoc = await caseRef.get();
  if (!caseDoc.exists) {
    console.error('❌ Caso não encontrado.');
    process.exit(1);
  }
  const caseData = caseDoc.data();
  console.log(`📁 Caso: ${caseData.name || caseData.documentFormatted || caseId}`);
  console.log(`📋 Preset: ${caseData.presetKey} | Tipo: ${caseData.subjectType} | Doc: ${caseData.document}\n`);

  // Reset case status
  await caseRef.update({ status: 'enriching', updatedAt: new Date() });

  // Fetch existing moduleRuns
  const runsSnap = await db.collection(COLLECTIONS.MODULE_RUNS)
    .where('caseId', '==', caseId)
    .get();

  // Group by sourceKey and keep Firestore refs
  const runsBySource = {};
  for (const d of runsSnap.docs) {
    const run = d.data();
    if (!run.sourceKey?.startsWith('bigdatacorp_')) continue;
    const dsKey = run.sourceKey.replace('bigdatacorp_', '');
    if (!runsBySource[dsKey]) runsBySource[dsKey] = [];
    runsBySource[dsKey].push({ id: d.id, ref: d.ref, ...run });
  }

  // Determine datasets from preset (fallback to existing runs)
  let datasets = getDatasetsForPreset(caseData.presetKey || 'compliance', caseData.subjectType || 'pf');
  if (!datasets.length) {
    datasets = Object.keys(runsBySource);
  }

  console.log(`🎯 Datasets a consultar: ${datasets.join(', ') || 'NENHUM'}\n`);

  if (!datasets.length) {
    console.log('⚠️ Nenhum dataset BDC encontrado para este caso.');
    await caseRef.update({ status: 'ready', updatedAt: new Date() });
    process.exit(0);
  }

  // Call BDC combined
  console.log('☎️  Chamando BigDataCorp (combined)...');
  let enrichment;
  try {
    enrichment = await enrichFromPreset(caseData.document, BDC_CREDENTIALS, {
      presetKey: caseData.presetKey || 'compliance',
      subjectType: caseData.subjectType || 'pf',
      extraDatasets: datasets,
    });
  } catch (err) {
    console.error('❌ Falha na chamada BDC:', err.message);
    await caseRef.update({ status: 'correction_needed', error: { message: err.message, code: 'BDC_ERROR' }, updatedAt: new Date() });
    process.exit(1);
  }

  console.log(`✅ BDC respondeu em ${enrichment.elapsedMs}ms — status: ${enrichment.status}\n`);

  // Process each dataset
  const resultEntry = enrichment.resultEntry || {};
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
    if (!runs || runs.length === 0) {
      console.log(`⏭️  ${dsKey}: nenhum moduleRun vinculado, pulando.`);
      continue;
    }

    const resultKey = keyMap[dsKey];
    const rawData = resultEntry?.[resultKey] || null;

    if (!rawData) {
      console.log(`⚠️  ${dsKey}: BDC não retornou dados.`);
      for (const run of runs) {
        await run.ref.update({
          status: 'completed_no_findings',
          resultCount: 0,
          updatedAt: new Date(),
        });
      }
      completedCount++;
      continue;
    }

    try {
      const { evidenceContent, resultCount } = await runDataset(caseData, dsKey, rawData);

      // Create evidence item
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

      console.log(`✅ ${dsKey}: ${status} (${resultCount} resultado(s))`);
      completedCount++;
    } catch (err) {
      console.error(`❌ ${dsKey}: erro no processamento — ${err.message}`);
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

  // Update non-BDC moduleRuns to skipped (so checkCompletion can pass)
  const otherRunsSnap = await db.collection(COLLECTIONS.MODULE_RUNS)
    .where('caseId', '==', caseId)
    .get();
  let skippedCount = 0;
  for (const d of otherRunsSnap.docs) {
    const run = d.data();
    if (!run.sourceKey?.startsWith('bigdatacorp_')) {
      if (run.status === 'pending') {
        await d.ref.update({ status: 'skipped_policy', updatedAt: new Date() });
        skippedCount++;
      }
    }
  }

  // Finalize case
  const totalRuns = otherRunsSnap.size;
  const progress = Math.round((completedCount / totalRuns) * 100);

  await caseRef.update({
    status: 'ready',
    progress,
    progressDetail: {
      totalSources: totalRuns,
      completed: completedCount + skippedCount,
      withFindings: completedCount,
      failed: failedCount,
      pending: 0,
      sources: [], // simplified
    },
    completedAt: new Date(),
    lastProcessedAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`\n🏁 Finalizado!`);
  console.log(`   • Completados: ${completedCount}`);
  console.log(`   • Falhas:      ${failedCount}`);
  console.log(`   • Pulados:     ${skippedCount}`);
  console.log(`   • Progresso:   ${progress}%`);
  console.log(`   • Status:      ready\n`);
}

main().catch((err) => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});
