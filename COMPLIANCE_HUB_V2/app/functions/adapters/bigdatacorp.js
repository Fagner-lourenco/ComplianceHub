/**
 * BigDataCorp API adapter (V2 Extended).
 *
 * Uses Node 20 built-in `fetch` — no extra deps.
 * Auth: dual-header JWT (AccessToken + TokenId).
 * Base URL: https://plataforma.bigdatacorp.com.br
 * Method: POST (all endpoints).
 *
 * Datasets supported (full catalog in bigdatacorpCatalog.js):
 *   PF: basic_data, processes, kyc, occupation_data, phones_extended,
 *       addresses_extended, emails_extended, online_presence, financial_data,
 *       class_organization, government_debtors, collections, financial_risk,
 *       political_involvement, media_profile_and_exposure
 *   PJ: basic_data, processes, kyc, relationships, owners_kyc, activity_indicators,
 *       company_evolution, phones_extended, addresses_extended, emails_extended,
 *       online_presence, government_debtors, collections, owners_lawsuits
 */

const { resolveEndpoint } = require('./bigdatacorpCatalog');

const BASE_URL = process.env.BIGDATACORP_BASE_URL || 'https://plataforma.bigdatacorp.com.br';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = 25000;

// Key mapping: BDC dataset key → Result[0] property name
const DATASET_RESULT_KEYS = {
  basic_data: 'BasicData',
  kyc: 'KycData',
  processes: 'Processes',
  'processes.limit': 'Processes',
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
  financial_risk: 'FinancialRisk',
  political_involvement: 'PoliticalInvolvement',
  media_profile_and_exposure: 'MediaProfileAndExposure',
  owners_lawsuits: 'OwnersLawsuits',
  employees_kyc: 'EmployeesKycData',
  economic_group_kyc: 'EconomicGroupKycData',
  dynamic_qsa_data: 'DynamicQsaData',
  history_basic_data: 'HistoryBasicData',
  historical_basic_data: 'HistoricalBasicData',
  lawsuits_distribution_data: 'LawsuitsDistributionData',
  property_data: 'PropertyData',
  university_student_data: 'UniversityStudentData',
  profession_data: 'ProfessionData',
  awards_and_certifications: 'AwardsAndCertifications',
  sports_exposure: 'SportsExposure',
  election_candidate_data: 'ElectionCandidateData',
  online_ads: 'OnlineAds',
  syndicate_agreements: 'SyndicateAgreements',
  social_conscience: 'SocialConscience',
  merchant_category_data: 'MerchantCategoryData',
  indebtedness_question: 'IndebtednessQuestion',
};

class BigDataCorpError extends Error {
  constructor(message, statusCode, retryable, datasetStatus) {
    super(message);
    this.name = 'BigDataCorpError';
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.datasetStatus = datasetStatus || null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractDatasetKey(datasetStr) {
  // "processes.limit(100)" → "processes"
  // "processes.limit(100).next(50)" → "processes"
  const match = datasetStr.match(/^([a-z_]+)/i);
  return match ? match[1] : datasetStr;
}

function getResultKey(datasetStr) {
  const base = extractDatasetKey(datasetStr);
  return DATASET_RESULT_KEYS[base] || base;
}

/**
 * Low-level POST call with timeout + retry on 429/5xx.
 *
 * @param {string} path  e.g. '/pessoas'
 * @param {object} body  JSON body
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @returns {Promise<object>}  Parsed JSON body
 */
async function callPost(path, body, credentials) {
  const url = `${BASE_URL}${path}`;
  let lastError = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'AccessToken': credentials.accessToken,
          'TokenId': credentials.tokenId,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      // HTTP-level errors
      if (response.status === 401 || response.status === 403) {
        throw new BigDataCorpError(
          `BigDataCorp auth error: ${response.status}`,
          response.status,
          false,
        );
      }
      if (response.status === 429) {
        lastError = new BigDataCorpError(
          `BigDataCorp rate limited (429)`,
          429,
          true,
        );
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await delay(backoff);
        continue;
      }
      if (response.status >= 500) {
        lastError = new BigDataCorpError(
          `BigDataCorp server error: ${response.status}`,
          response.status,
          true,
        );
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await delay(backoff);
        continue;
      }

      if (!response.ok) {
        throw new BigDataCorpError(
          `BigDataCorp HTTP error: ${response.status}`,
          response.status,
          false,
        );
      }

      const data = await response.json();

      // Check response-body Status (BigDataCorp uses negative codes for errors)
      const status = data?.Status;
      if (status && typeof status === 'object') {
        const statusCode = status.Code ?? status.code ?? 0;
        if (statusCode < 0) {
          // -1000 to -1199: auth errors (non-retryable)
          if (statusCode <= -1000 && statusCode > -1200) {
            throw new BigDataCorpError(
              `BigDataCorp auth error in response: ${statusCode} - ${status.Message || ''}`,
              statusCode,
              false,
              status,
            );
          }
          // -1200 to -1999: internal/server errors (retryable)
          if (statusCode <= -1200 && statusCode > -2000) {
            lastError = new BigDataCorpError(
              `BigDataCorp internal error: ${statusCode} - ${status.Message || ''}`,
              statusCode,
              true,
              status,
            );
            const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            await delay(backoff);
            continue;
          }
          // -100 to -999: input/validation errors (non-retryable)
          throw new BigDataCorpError(
            `BigDataCorp input error: ${statusCode} - ${status.Message || ''}`,
            statusCode,
            false,
            status,
          );
        }
      }

      return data;
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof BigDataCorpError && !error.retryable) throw error;
      if (error.name === 'AbortError') {
        lastError = new BigDataCorpError(
          `BigDataCorp request timeout (${REQUEST_TIMEOUT_MS}ms)`,
          0,
          true,
        );
      } else if (!(error instanceof BigDataCorpError)) {
        lastError = new BigDataCorpError(
          `BigDataCorp network error: ${error.message}`,
          0,
          true,
        );
      } else {
        lastError = error;
      }
      if (attempt < MAX_RETRIES - 1) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await delay(backoff);
      }
    }
  }

  throw lastError;
}

/**
 * Build the Datasets string for a combined query.
 * Applies default limits for known heavy datasets.
 *
 * @param {string[]} datasets
 * @returns {string}
 */
function buildDatasetsString(datasets) {
  return datasets.map((ds) => {
    // Apply safe defaults for heavy datasets when no limit is specified
    if (ds === 'processes') return 'processes.limit(100)';
    if (ds === 'owners_kyc') return 'owners_kyc.limit(50)';
    if (ds === 'relationships') return 'relationships.limit(100)';
    if (ds === 'media_profile_and_exposure') return 'media_profile_and_exposure.limit(50)';
    return ds;
  }).join(',');
}

/**
 * Extract all requested datasets from Result[0].
 *
 * @param {object} data — raw BDC response
 * @param {string[]} datasetStrings — original dataset strings requested
 * @returns {object}
 */
function extractAllDatasets(data, datasetStrings) {
  const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;
  const extracted = { raw: data, resultEntry };

  if (!resultEntry) return extracted;

  for (const dsStr of datasetStrings) {
    const key = getResultKey(dsStr);
    if (resultEntry[key] !== undefined) {
      extracted[key] = resultEntry[key];
    }
  }

  return extracted;
}

/**
 * Query multiple datasets in a single POST call.
 * Combined query reduces latency vs separate calls.
 *
 * @param {string} doc — CPF or CNPJ (11 or 14 digits, no formatting)
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @param {object} [options]
 * @param {string[]} [options.datasets] — dataset keys to query (defaults to basic 4 PF)
 * @param {'pf'|'pj'} [options.subjectType='pf'] — subject type
 * @param {number} [options.processLimit=100] — max processes to return
 * @param {number} [options.ownersKycLimit=50] — max owners for owners_kyc
 * @returns {Promise<{ raw: object, resultEntry: object|null, elapsedMs: number, datasets: object }>}
 */
async function queryCombined(doc, credentials, options = {}) {
  const subjectType = options.subjectType || 'pf';
  const datasets = options.datasets || ['basic_data', 'processes.limit(100)', 'kyc', 'occupation_data'];
  const startMs = Date.now();

  const endpoint = resolveEndpoint(extractDatasetKey(datasets[0]), subjectType) || (subjectType === 'pj' ? '/empresas' : '/pessoas');

  const datasetStr = buildDatasetsString(datasets);

  const body = {
    q: `doc{${doc}} returnupdates{false}`,
    Datasets: datasetStr,
    Limit: 1,
  };

  const data = await callPost(endpoint, body, credentials);
  const elapsedMs = Date.now() - startMs;

  const extracted = extractAllDatasets(data, datasets);
  const resultEntry = extracted.resultEntry;

  // Backward-compatible fields for consumers expecting the old interface
  const basicData = resultEntry?.BasicData || null;
  const processes = resultEntry?.Processes || null;
  const kycData = resultEntry?.KycData || null;
  const professionData = resultEntry?.ProfessionData || null;

  return {
    raw: data,
    resultEntry,
    elapsedMs,
    datasets: extracted,
    // Legacy aliases
    basicData,
    processes,
    kycData,
    professionData,
  };
}

/**
 * Query only a specific dataset (for pagination or standalone use).
 *
 * @param {string} doc — CPF or CNPJ
 * @param {string} datasetStr — dataset string, e.g. 'processes.limit(100).next(50)'
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @param {'pf'|'pj'} [subjectType='pf']
 * @returns {Promise<{ raw: object, data: object|null, elapsedMs: number }>}
 */
async function queryDataset(doc, datasetStr, credentials, subjectType = 'pf') {
  const startMs = Date.now();
  const endpoint = resolveEndpoint(extractDatasetKey(datasetStr), subjectType) || (subjectType === 'pj' ? '/empresas' : '/pessoas');

  const body = {
    q: `doc{${doc}} returnupdates{false}`,
    Datasets: datasetStr,
    Limit: 1,
  };

  const data = await callPost(endpoint, body, credentials);
  const elapsedMs = Date.now() - startMs;
  const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;
  const resultKey = getResultKey(datasetStr);

  return {
    raw: data,
    data: resultEntry?.[resultKey] || null,
    elapsedMs,
  };
}

/**
 * Query only processes dataset (for pagination or standalone use).
 *
 * @param {string} doc
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @param {object} [options]
 * @param {number} [options.limit=100]
 * @param {number} [options.offset=0] — Page offset (next)
 * @param {'pf'|'pj'} [options.subjectType='pf']
 * @returns {Promise<{ raw: object, processes: object|null, elapsedMs: number }>}
 */
async function queryProcesses(doc, credentials, options = {}) {
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  const subjectType = options.subjectType || 'pf';
  const startMs = Date.now();

  let datasetStr = `processes.limit(${limit})`;
  if (offset > 0) {
    datasetStr = `processes.limit(${limit}).next(${offset})`;
  }

  const body = {
    q: `doc{${doc}} returnupdates{false}`,
    Datasets: datasetStr,
    Limit: 1,
  };

  const endpoint = subjectType === 'pj' ? '/empresas' : '/pessoas';
  const data = await callPost(endpoint, body, credentials);
  const elapsedMs = Date.now() - startMs;
  const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;

  // PJ returns Lawsuits, PF returns Processes
  const processes = resultEntry?.Processes || resultEntry?.Lawsuits || null;

  return {
    raw: data,
    processes,
    elapsedMs,
  };
}

/**
 * Query only KYC dataset (standalone for PEP/sanctions check).
 *
 * @param {string} doc
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @param {'pf'|'pj'} [subjectType='pf']
 * @returns {Promise<{ raw: object, kycData: object|null, elapsedMs: number }>}
 */
async function queryKyc(doc, credentials, subjectType = 'pf') {
  const startMs = Date.now();

  const body = {
    q: `doc{${doc}}`,
    Datasets: 'kyc',
    Limit: 1,
  };

  const endpoint = subjectType === 'pj' ? '/empresas' : '/pessoas';
  const data = await callPost(endpoint, body, credentials);
  const elapsedMs = Date.now() - startMs;
  const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;

  return {
    raw: data,
    kycData: resultEntry?.KycData || null,
    elapsedMs,
  };
}

/**
 * Query relationships/QSA dataset (PJ only).
 *
 * @param {string} cnpj
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @param {object} [options]
 * @param {number} [options.limit=100]
 * @param {number} [options.offset=0]
 * @returns {Promise<{ raw: object, relationships: object|null, elapsedMs: number }>}
 */
async function queryRelationships(cnpj, credentials, options = {}) {
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  const startMs = Date.now();

  let datasetStr = `relationships.limit(${limit})`;
  if (offset > 0) {
    datasetStr = `relationships.limit(${limit}).next(${offset})`;
  }

  const body = {
    q: `doc{${cnpj}} returnupdates{false}`,
    Datasets: datasetStr,
    Limit: 1,
  };

  const data = await callPost('/empresas', body, credentials);
  const elapsedMs = Date.now() - startMs;
  const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;

  return {
    raw: data,
    relationships: resultEntry?.Relationships || null,
    elapsedMs,
  };
}

/**
 * Query owners KYC dataset (PJ only).
 *
 * @param {string} cnpj
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @param {object} [options]
 * @param {number} [options.limit=50]
 * @returns {Promise<{ raw: object, ownersKycData: object|null, elapsedMs: number }>}
 */
async function queryOwnersKyc(cnpj, credentials, options = {}) {
  const limit = options.limit || 50;
  const startMs = Date.now();

  const body = {
    q: `doc{${cnpj}} returnupdates{false}`,
    Datasets: `owners_kyc.limit(${limit})`,
    Limit: 1,
  };

  const data = await callPost('/empresas', body, credentials);
  const elapsedMs = Date.now() - startMs;
  const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;

  return {
    raw: data,
    ownersKycData: resultEntry?.OwnersKycData || null,
    elapsedMs,
  };
}

module.exports = {
  queryCombined,
  queryDataset,
  queryProcesses,
  queryKyc,
  queryRelationships,
  queryOwnersKyc,
  BigDataCorpError,
  // Exposed for testing / debugging
  buildDatasetsString,
  extractDatasetKey,
  getResultKey,
};
