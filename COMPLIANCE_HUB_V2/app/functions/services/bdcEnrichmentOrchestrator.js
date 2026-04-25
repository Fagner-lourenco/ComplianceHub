/**
 * BDC Enrichment Orchestrator
 * Centralizes BigDataCorp enrichment logic: preset → datasets → adapter → normalizers.
 *
 * Usage:
 *   const { enrichFromPreset } = require('./bdcEnrichmentOrchestrator');
 *   const result = await enrichFromPreset('48052053854', credentials, {
 *     presetKey: 'dossier_pf_full',
 *     subjectType: 'pf',
 *   });
 */

const { queryCombined, queryDataset } = require('../adapters/bigdatacorp');
const { getDatasetsForPreset, estimatePresetCost, getDataset } = require('../adapters/bigdatacorpCatalog');

const { normalizeBasicDataPessoa, normalizeBasicDataEmpresa, normalizeContacts } = require('../normalizers/bigdatacorp/basicData');
const { normalizeKyc, buildKycEvidenceContent } = require('../normalizers/bigdatacorp/kyc');
const { normalizeProcesses, buildProcessListEvidence } = require('../normalizers/bigdatacorp/processes');
const { normalizeOccupation } = require('../normalizers/bigdatacorp/occupation');
const { normalizeOnlinePresence, buildOnlinePresenceEvidenceContent } = require('../normalizers/bigdatacorp/onlinePresence');
const { normalizeActivityIndicators, buildActivityIndicatorsEvidenceContent } = require('../normalizers/bigdatacorp/activityIndicators');
const { normalizeCompanyEvolution, buildCompanyEvolutionEvidenceContent } = require('../normalizers/bigdatacorp/companyEvolution');
const { normalizeRelationships, buildRelationshipEvidenceContent } = require('../normalizers/bigdatacorp/relationships');
const { normalizeOwnersKyc, buildOwnersKycEvidenceContent } = require('../normalizers/bigdatacorp/ownersKyc');
const { normalizeGovernmentDebtors, buildGovernmentDebtorsEvidenceContent } = require('../normalizers/bigdatacorp/governmentDebtors');
const { normalizeCollections, buildCollectionsEvidenceContent } = require('../normalizers/bigdatacorp/collections');
const { normalizeFinancialRisk, buildFinancialRiskEvidence } = require('../normalizers/bigdatacorp/risk');
const { normalizeIndebtedness, buildIndebtednessEvidence } = require('../normalizers/bigdatacorp/risk');
const { normalizeMediaProfile, buildMediaProfileEvidence } = require('../normalizers/bigdatacorp/mediaProfile');
const { normalizeLawsuitsDistribution, buildLawsuitsDistributionEvidence } = require('../normalizers/bigdatacorp/lawsuitsDistribution');
const { normalizeHistoricalBasicData, buildHistoricalBasicDataEvidence } = require('../normalizers/bigdatacorp/historicalBasicData');
const { normalizeOwnersLawsuits, buildOwnersLawsuitsEvidence } = require('../normalizers/bigdatacorp/ownersLawsuits');
const { normalizeEmployeesKyc, buildEmployeesKycEvidence } = require('../normalizers/bigdatacorp/employeesKyc');
const { normalizeEconomicGroupKyc, buildEconomicGroupKycEvidence } = require('../normalizers/bigdatacorp/economicGroupKyc');
const { normalizeDynamicQsa, buildDynamicQsaEvidence } = require('../normalizers/bigdatacorp/dynamicQsa');
const { normalizeHistoryBasicData, buildHistoryBasicDataEvidence } = require('../normalizers/bigdatacorp/historyBasicData');
const { normalizeMerchantCategory, buildMerchantCategoryEvidence } = require('../normalizers/bigdatacorp/merchantCategory');
const { normalizeSyndicateAgreements, buildSyndicateAgreementsEvidence } = require('../normalizers/bigdatacorp/syndicateAgreements');
const { normalizeSocialConscience, buildSocialConscienceEvidence } = require('../normalizers/bigdatacorp/socialConscience');
const { normalizeOnlineAds, buildOnlineAdsEvidence } = require('../normalizers/bigdatacorp/onlineAds');

// ---------------------------------------------------------------------------
// DATASET → NORMALIZER MAP
// ---------------------------------------------------------------------------

const DATASET_NORMALIZERS = {
  basic_data: (raw, subjectType) => {
    const normalizer = subjectType === 'pj' ? normalizeBasicDataEmpresa : normalizeBasicDataPessoa;
    const basicData = normalizer(raw);
    const contacts = normalizeContacts(raw);
    return { basicData, contacts };
  },
  kyc: (raw) => {
    const kyc = normalizeKyc(raw);
    const evidence = buildKycEvidenceContent(kyc);
    return { kyc, evidence };
  },
  processes: (raw) => {
    const processes = normalizeProcesses(raw?.Lawsuits || raw?.Processes || raw);
    const evidence = buildProcessListEvidence(processes);
    return { processes, evidence };
  },
  occupation_data: (raw) => {
    const occupation = normalizeOccupation(raw);
    return { occupation };
  },
  phones_extended: (raw) => {
    const contacts = normalizeContacts({ ExtendedPhones: raw });
    return { contacts };
  },
  addresses_extended: (raw) => {
    const contacts = normalizeContacts({ ExtendedAddresses: raw });
    return { contacts };
  },
  emails_extended: (raw) => {
    const contacts = normalizeContacts({ ExtendedEmails: raw });
    return { contacts };
  },
  online_presence: (raw) => {
    const presence = normalizeOnlinePresence(raw);
    const evidence = buildOnlinePresenceEvidenceContent(presence);
    return { onlinePresence: presence, evidence };
  },
  financial_data: (raw) => {
    // financial_data returns FinantialData (note the typo in BDC)
    return { financial: raw };
  },
  class_organization: (raw) => {
    return { memberships: raw };
  },
  relationships: (raw) => {
    const rels = normalizeRelationships(raw);
    const evidence = buildRelationshipEvidenceContent(rels);
    return { relationships: rels, evidence };
  },
  activity_indicators: (raw) => {
    const indicators = normalizeActivityIndicators(raw);
    const evidence = buildActivityIndicatorsEvidenceContent(indicators);
    return { activityIndicators: indicators, evidence };
  },
  company_evolution: (raw) => {
    const evolution = normalizeCompanyEvolution(raw);
    const evidence = buildCompanyEvolutionEvidenceContent(evolution);
    return { companyEvolution: evolution, evidence };
  },
  owners_kyc: (raw) => {
    const ownersKyc = normalizeOwnersKyc(raw);
    const evidence = buildOwnersKycEvidenceContent(ownersKyc);
    return { ownersKyc, evidence };
  },
  government_debtors: (raw) => {
    const debtors = normalizeGovernmentDebtors(raw);
    const evidence = buildGovernmentDebtorsEvidenceContent(debtors);
    return { governmentDebtors: debtors, evidence };
  },
  collections: (raw) => {
    const collections = normalizeCollections(raw);
    const evidence = buildCollectionsEvidenceContent(collections);
    return { collections, evidence };
  },
  financial_risk: (raw) => {
    const risk = normalizeFinancialRisk(raw);
    const evidence = buildFinancialRiskEvidence(risk);
    return { financialRisk: risk, evidence };
  },
  indebtedness_question: (raw) => {
    const debt = normalizeIndebtedness(raw);
    const evidence = buildIndebtednessEvidence(debt);
    return { indebtedness: debt, evidence };
  },
  media_profile_and_exposure: (raw) => {
    const profile = normalizeMediaProfile(raw);
    const evidence = buildMediaProfileEvidence(profile);
    return { mediaProfile: profile, evidence };
  },
  lawsuits_distribution_data: (raw) => {
    const dist = normalizeLawsuitsDistribution(raw);
    const evidence = buildLawsuitsDistributionEvidence(dist);
    return { lawsuitsDistribution: dist, evidence };
  },
  historical_basic_data: (raw) => {
    const hist = normalizeHistoricalBasicData(raw);
    const evidence = buildHistoricalBasicDataEvidence(hist);
    return { historicalBasicData: hist, evidence };
  },
  owners_lawsuits: (raw) => {
    const data = normalizeOwnersLawsuits(raw);
    const evidence = buildOwnersLawsuitsEvidence(data);
    return { ownersLawsuits: data, evidence };
  },
  employees_kyc: (raw) => {
    const data = normalizeEmployeesKyc(raw);
    const evidence = buildEmployeesKycEvidence(data);
    return { employeesKyc: data, evidence };
  },
  economic_group_kyc: (raw) => {
    const data = normalizeEconomicGroupKyc(raw);
    const evidence = buildEconomicGroupKycEvidence(data);
    return { economicGroupKyc: data, evidence };
  },
  dynamic_qsa_data: (raw) => {
    const data = normalizeDynamicQsa(raw);
    const evidence = buildDynamicQsaEvidence(data);
    return { dynamicQsa: data, evidence };
  },
  history_basic_data: (raw) => {
    const data = normalizeHistoryBasicData(raw);
    const evidence = buildHistoryBasicDataEvidence(data);
    return { historyBasicData: data, evidence };
  },
  merchant_category_data: (raw) => {
    const data = normalizeMerchantCategory(raw);
    const evidence = buildMerchantCategoryEvidence(data);
    return { merchantCategory: data, evidence };
  },
  syndicate_agreements: (raw) => {
    const data = normalizeSyndicateAgreements(raw);
    const evidence = buildSyndicateAgreementsEvidence(data);
    return { syndicateAgreements: data, evidence };
  },
  social_conscience: (raw) => {
    const data = normalizeSocialConscience(raw);
    const evidence = buildSocialConscienceEvidence(data);
    return { socialConscience: data, evidence };
  },
  profession_data: (raw) => {
    const occupation = normalizeOccupation(raw);
    return { occupation };
  },
  online_ads: (raw) => {
    const data = normalizeOnlineAds(raw);
    const evidence = buildOnlineAdsEvidence(data);
    return { onlineAds: data, evidence };
  },
};

// ---------------------------------------------------------------------------
// PRESET → SECTIONS MAP (for dossier schema alignment)
// ---------------------------------------------------------------------------

const PRESET_SECTION_MAP = {
  dossier_pf_full: [
    'identity_pf', 'contact_pf', 'financial_pf', 'online_presence',
    'judicial', 'kyc', 'profissional', 'reguladores',
  ],
  dossier_pj_full: [
    'identity_pj', 'relationship', 'owners_kyc', 'employees_kyc', 'economic_group_kyc',
    'financial_pj', 'online_presence', 'judicial', 'kyc', 'osint', 'esg',
  ],
  compliance: ['identity_pf', 'judicial', 'kyc'],
  financeiro: ['identity_pf', 'judicial', 'financeiro'],
  investigativo: ['identity_pf', 'judicial', 'kyc', 'midia_internet'],
  juridico: ['identity_pf', 'judicial'],
  pld: ['identity_pf', 'kyc', 'financeiro'],
  rh: ['identity_pf', 'judicial', 'kyc', 'profissional'],
  internacional: ['identity_pf', 'kyc', 'midia_internet'],
};

// ---------------------------------------------------------------------------
// CORE FUNCTION
// ---------------------------------------------------------------------------

/**
 * Enrich a subject from BigDataCorp using a preset configuration.
 *
 * @param {string} doc — CPF (11 digits) or CNPJ (14 digits), no formatting
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @param {object} options
 * @param {string} options.presetKey — preset key from bigdatacorpCatalog
 * @param {'pf'|'pj'} options.subjectType
 * @param {string[]} [options.extraDatasets] — additional datasets beyond preset
 * @param {number} [options.processLimit=100]
 * @param {number} [options.ownersKycLimit=50]
 * @returns {Promise<{
 *   status: 'done'|'partial'|'failed',
 *   raw: object,
 *   resultEntry: object|null,
 *   elapsedMs: number,
 *   datasets: object,
 *   sections: object,
 *   evidence: object,
 *   costEstimate: number,
 *   errors: string[],
 * }>}
 */
async function enrichFromPreset(doc, credentials, options = {}) {
  const presetKey = options.presetKey || 'compliance';
  const subjectType = options.subjectType || 'pf';
  const extraDatasets = options.extraDatasets || [];
  const processLimit = options.processLimit || 100;
  const ownersKycLimit = options.ownersKycLimit || 50;

  const errors = [];
  const sections = {};
  const evidence = {};

  // 1. Resolve datasets from preset
  let datasets = getDatasetsForPreset(presetKey, subjectType);
  if (datasets.length === 0 && presetKey === 'dossier_pf_full') {
    // fallback: if catalog doesn't have the preset, use manual list
    datasets = subjectType === 'pf'
      ? ['basic_data', 'processes', 'kyc', 'occupation_data', 'phones_extended', 'addresses_extended', 'emails_extended', 'online_presence', 'financial_data', 'class_organization', 'government_debtors', 'collections']
      : ['basic_data', 'processes', 'kyc', 'relationships', 'owners_kyc', 'activity_indicators', 'company_evolution', 'phones_extended', 'addresses_extended', 'emails_extended', 'online_presence', 'government_debtors', 'collections'];
  }
  datasets = [...new Set([...datasets, ...extraDatasets])];

  const costEstimate = estimatePresetCost(presetKey, subjectType);

  // 2. Call BDC (single combined call)
  let result;
  try {
    result = await queryCombined(doc, credentials, {
      datasets,
      subjectType,
      processLimit,
      ownersKycLimit,
    });
  } catch (err) {
    errors.push(`BDC query failed: ${err.message}`);
    return {
      status: 'failed',
      raw: null,
      resultEntry: null,
      elapsedMs: 0,
      datasets: {},
      sections,
      evidence,
      costEstimate,
      errors,
    };
  }

  // 3. Normalize each dataset
  for (const dsStr of datasets) {
    const dsKey = dsStr.replace(/\.limit\(\d+\)/, '').replace(/\.next\(\d+\)/, '');
    const normalizer = DATASET_NORMALIZERS[dsKey];
    const resultKey = {
      basic_data: 'BasicData',
      kyc: 'KycData',
      processes: 'Processes',
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
    }[dsKey];

    const rawData = result.resultEntry?.[resultKey] || null;

    if (!rawData) {
      // Dataset not returned by BDC — may be empty or unavailable for this subject
      continue;
    }

    try {
      if (normalizer) {
        const normalized = normalizer(rawData, subjectType);
        sections[dsKey] = normalized;
        if (normalized.evidence) {
          evidence[dsKey] = normalized.evidence;
        }
      } else {
        sections[dsKey] = { raw: rawData };
      }
    } catch (normErr) {
      errors.push(`Normalizer failed for ${dsKey}: ${normErr.message}`);
      sections[dsKey] = { raw: rawData, normalizationError: normErr.message };
    }
  }

  // 4. Determine status
  const normalizedCount = Object.keys(sections).length;
  const status = errors.length === 0 ? 'done' : (normalizedCount > 0 ? 'partial' : 'failed');

  return {
    status,
    raw: result.raw,
    resultEntry: result.resultEntry,
    elapsedMs: result.elapsedMs,
    datasets: result.datasets,
    sections,
    evidence,
    costEstimate,
    errors,
  };
}

/**
 * Enrich a single dataset standalone (for pagination or retry scenarios).
 *
 * @param {string} doc
 * @param {string} datasetKey
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @param {'pf'|'pj'} subjectType
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function enrichDataset(doc, datasetKey, credentials, subjectType = 'pf', options = {}) {
  const dsDef = getDataset(datasetKey);
  if (!dsDef) {
    throw new Error(`Unknown dataset: ${datasetKey}`);
  }

  const limit = options.limit || dsDef.maxLimit || 100;
  const offset = options.offset || 0;
  const datasetStr = offset > 0 ? `${datasetKey}.limit(${limit}).next(${offset})` : `${datasetKey}.limit(${limit})`;

  const result = await queryDataset(doc, datasetStr, credentials, subjectType);
  const normalizer = DATASET_NORMALIZERS[datasetKey];

  if (normalizer) {
    return normalizer(result.data, subjectType);
  }
  return { raw: result.data };
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

module.exports = {
  enrichFromPreset,
  enrichDataset,
  DATASET_NORMALIZERS,
  PRESET_SECTION_MAP,
};
