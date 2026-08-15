/**
 * caseQueriesAssignments.js — Queries, filtros, métricas e atribuições de casos
 * Extraído do monolito index.js durante refatoração Phase C
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');

const {
  serializeClientCaseDocument,
  matchesClientCaseFilters,
  buildOpsCaseStats,
} = require('./caseManager/caseFilters');

const { paginateFirestoreQuery } = require('../helpers/paginateFirestoreQuery');
const { formatDateKey, formatMonthKey } = require('./utilityHelpers');

/* =========================================================
   Constantes
   ========================================================= */

const CASE_QUERY_PAGE_SIZE = 500;
const CLIENT_CASE_PAGE_SIZE_MAX = 100;
const CLIENT_CASE_SEARCH_SCAN_LIMIT = 10000;
const CASE_QUERY_MAX_DOCS = 10000;
const CASE_METRICS_PERIODS = new Set([0, 7, 30, 90, 365]);

const OPS_METRIC_FIELDS = [
  'tenantId', 'tenantName', 'status', 'finalVerdict', 'createdAt', 'concludedAt', 'updatedAt', 'turnaroundHours',
  'juditEnrichmentStatus', 'escavadorEnrichmentStatus', 'escavador2EnrichmentStatus', 'enrichmentStatus', 'bigdatacorpEnrichmentStatus', 'djenEnrichmentStatus',
  'enrichmentSources', 'aiClassificationReviewRawResponse', 'aiClassificationReview', 'aiRawResponse', 'aiStructured',
  'aiClassificationReviewOk', 'aiStructuredOk', 'aiClassificationReviewError', 'aiError', 'aiClassificationReviewFromCache', 'aiFromCache',
  'aiCostUsd', 'aiHomonymCostUsd', 'aiClassificationReviewCostUsd', 'aiClassificationReviewTokens', 'aiTokens', 'aiDecision',
];

const CLIENT_DASHBOARD_FIELDS = [
  'caseId', 'tenantId', 'candidateName', 'candidatePosition', 'status', 'finalVerdict', 'createdAt', 'createdMonthKey',
  'concludedAt', 'updatedAt', 'turnaroundHours', 'criminalFlag', 'laborFlag', 'warrantFlag', 'osintLevel', 'socialStatus',
  'digitalFlag', 'conflictInterest',
];

// Runtime das listagens do portal cliente. Vive aqui, e nao duplicado em cada
// registro, porque a V1 e a V2 compartilham a mesma varredura de tenant
// (fetchClientCaseMatches): se so uma tiver teto de instancias, o caminho sem
// teto reabre o incidente de 2026-08-14. O cors muda por chamador, entao entra
// por spread no ponto de registro.
const CLIENT_CASE_LIST_RUNTIME = Object.freeze({
  region: 'southamerica-east1',
  timeoutSeconds: 120,
  memory: '1GiB',
  maxInstances: 10,
});

const OPS_CASE_LIST_FIELDS = [
  'caseId', 'tenantId', 'tenantName', 'candidateName', 'cpf', 'cpfMasked', 'candidatePosition', 'createdAt', 'updatedAt',
  'concludedAt', 'turnaroundHours', 'slaHours', 'status', 'riskLevel', 'criminalFlag', 'finalVerdict', 'priority',
  'assigneeId', 'assigneeName', 'assigneeEmail', 'juditEnrichmentStatus', 'escavadorEnrichmentStatus', 'escavador2EnrichmentStatus', 'enrichmentStatus',
  'bigdatacorpEnrichmentStatus', 'djenEnrichmentStatus', 'aiStatus',
];

const METRIC_PROVIDERS = [
  { key: 'judit', field: 'juditEnrichmentStatus' },
  { key: 'escavador', field: 'escavadorEnrichmentStatus' },
  { key: 'escavador2', field: 'escavador2EnrichmentStatus' },
  { key: 'fontedata', field: 'enrichmentStatus' },
  { key: 'bigdatacorp', field: 'bigdatacorpEnrichmentStatus' },
  { key: 'djen', field: 'djenEnrichmentStatus' },
];

/* =========================================================
   Funções puras — Helpers
   ========================================================= */

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'string') {
    const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (brMatch) {
      const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = brMatch;
      const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asIsoOrNull(value) {
  const date = asDate(value);
  return date ? date.toISOString() : null;
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveOpsMetricsTenant(profile, requestedTenantId) {
  const normalizedTenantId = String(requestedTenantId || '').trim() || null;
  if (isGlobalOpsProfile(profile)) return normalizedTenantId;
  return profile.tenantId || null;
}

function isGlobalOpsProfile(profile) {
  return !profile?.tenantId && ['admin', 'owner'].includes(profile?.role);
}

function normalizeMetricsPeriod(value) {
  const periodDays = Number(value);
  if (!CASE_METRICS_PERIODS.has(periodDays)) {
    throw new HttpsError('invalid-argument', 'Periodo de metricas invalido.');
  }
  return periodDays;
}

function getMetricCaseDate(caseData, field) {
  return asDate(caseData?.[field]);
}

function diffHoursBackend(startValue, endValue) {
  const start = getMetricCaseDate({ value: startValue }, 'value');
  const end = getMetricCaseDate({ value: endValue }, 'value');
  if (!start || !end) return null;
  const hours = (end.getTime() - start.getTime()) / 36e5;
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
}

function pctBackend(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function makeRunId(caseId) {
  return `${caseId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildProviderRunIds(caseId) {
  const runId = makeRunId(caseId);
  return {
    enrichmentRunId: `enrichment_${runId}`,
    bigdatacorpRunId: `bdc_${runId}`,
    juditRunId: `judit_${runId}`,
    escavadorRunId: `escavador_${runId}`,
    escavador2RunId: `escavador2_${runId}`,
    fontedataRunId: `fontedata_${runId}`,
    djenRunId: `djen_${runId}`,
  };
}

const FULL_RERUN_DERIVED_FIELDS = [
  'autoClassifiedAt', 'autoClassifySignature', 'autoClassifyLock', 'autoClassifyRerunRequested',
  'aiStatus', 'aiRawResponse', 'aiAnalysis', 'aiStructured', 'aiStructuredOk', 'aiError',
  'aiCostUsd', 'aiTokens', 'aiExecutedAt', 'aiProvidersIncluded', 'aiPromptVersion', 'aiFromCache',
  'aiHomonymStructured', 'aiHomonymStructuredOk', 'aiHomonymRawResponse', 'aiHomonymTriggered',
  'aiHomonymDecision', 'aiHomonymConfidence', 'aiHomonymRisk', 'aiHomonymRecommendedAction',
  'aiHomonymCostUsd', 'aiHomonymTokens', 'aiHomonymExecutedAt', 'aiHomonymError',
  'prefillNarratives', 'deterministicPrefill',
  'riskScore', 'riskLevel', 'finalVerdict', 'publicReportToken', 'reportSlug', 'reportReady',
  'sourceSummary', 'statusSummary', 'nextSteps',
  'criminalFlag', 'criminalSeverity', 'criminalEvidenceQuality', 'criminalNotes',
  'warrantFlag', 'warrantNotes', 'laborFlag', 'laborSeverity', 'laborNotes',
  'coverageLevel', 'coverageNotes', 'providerDivergence', 'ambiguityNotes', 'reviewRecommended',
  'negativePartialSafetyNetEligible', 'negativePartialSafetyNetReasons',
  'negativePartialSafetyNetAction', 'negativePartialSafetyNetTriggered',
  'juditIdentity', 'juditGateResult', 'juditPrimaryUf', 'juditAllUfs', 'juditHasLawsuits',
  'juditProcessTotal', 'juditRoleSummary', 'juditProcessos', 'juditCriminalFlag', 'juditCriminalCount',
  'juditWarrantFlag', 'juditWarrantNotes', 'juditWarrants', 'juditActiveWarrantCount',
  'juditExecutionFlag', 'juditExecutionCount', 'juditExecutions', 'juditExecutionNotes',
  'juditNameSearchFlag', 'juditNameSearchProcessTotal', 'juditNameSearchCriminalCount',
  'juditNameSearchCpfsComNome', 'juditNeedsEscavador', 'juditNeedsEscavadorReason',
  'juditPendingAsyncPhases', 'juditPendingAsyncCount', 'juditRequestIds', 'juditSources',
  'juditRawPayloads', 'juditCostBRL', 'juditEnrichedAt', 'juditPartialDataAvailable',
  'escavadorProcessTotal', 'escavadorProcessos', 'escavadorCriminalFlag', 'escavadorCriminalCount',
  'escavadorLaborFlag', 'escavadorLaborCount', 'escavadorNotes', 'escavadorCpfsComEsseNome',
  'escavadorSources', 'escavadorEnrichedAt',
  'djenComunicacoes', 'djenCriminalFlag', 'djenLaborFlag', 'djenNotes',
  'djenSources', 'djenCostBRL', 'djenElapsedMs', 'djenQueryDate', 'djenEnrichedAt',
  'escavador2ApiStatus', 'escavador2ProcessTotal', 'escavador2Processos',
  'escavador2CriminalFlag', 'escavador2CriminalCount', 'escavador2LaborFlag', 'escavador2LaborCount',
  'escavador2MaterialRiskCount', 'escavador2CnjMaskedCount', 'escavador2CnjExtractedCount',
  'escavador2DuplicateCount', 'escavador2NewFindingCount', 'escavador2HasNewMaterialRisk',
  'escavador2Notes', 'escavador2PartialErrors', 'escavador2Stats', 'escavador2Sources',
  'escavador2RawPayloads', 'escavador2CostBRL', 'escavador2EnrichedAt',
  'escavador2ProcessOmissions', 'escavador2TechnicalOmissions', 'escavador2PersistenceTruncated',
  'escavador2PersistenceFallback',
  'bigdatacorpBasicData', 'bigdatacorpGateResult', 'bigdatacorpName', 'bigdatacorpCpfStatus',
  'bigdatacorpProcessTotal', 'bigdatacorpCriminalFlag', 'bigdatacorpCriminalCount',
  'bigdatacorpDirectCriminalCount', 'bigdatacorpPossibleHomonymCriminalCount',
  'bigdatacorpLaborFlag', 'bigdatacorpLaborCount', 'bigdatacorpDirectLaborCount',
  'bigdatacorpPossibleHomonymLaborCount', 'bigdatacorpCivilCount', 'bigdatacorpProcessos',
  'bigdatacorpProcessNotes', 'bigdatacorpKycNotes', 'bigdatacorpProfessionNotes',
  'bigdatacorpIsPep', 'bigdatacorpIsSanctioned', 'bigdatacorpWasSanctioned',
  'bigdatacorpSanctionDetails', 'bigdatacorpActiveWarrants', 'bigdatacorpHasArrestWarrant',
  'bigdatacorpSources', 'bigdatacorpRawPayloads', 'bigdatacorpCostBRL', 'bigdatacorpEnrichedAt',
  'enrichmentSources', 'enrichmentIdentity', 'enrichmentGateResult', 'enrichmentPrimaryUf',
  'enrichmentAllUfs', 'fontedataCriminalFlag', 'fontedataWarrantFlag', 'fontedataLaborFlag',
  'enrichedAt',
];

/* =========================================================
   Funções puras — Enrichment status / SLA
   ========================================================= */

function isTerminalEnrichmentStatus(status) {
  return ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED', 'BLOCKED'].includes(status);
}

function getOverallEnrichmentStatusBackend(caseData) {
  const statuses = [
    caseData?.juditEnrichmentStatus,
    caseData?.escavadorEnrichmentStatus,
    caseData?.enrichmentStatus,
    caseData?.bigdatacorpEnrichmentStatus,
    caseData?.djenEnrichmentStatus,
    caseData?.escavador2EnrichmentStatus,
    caseData?.aiStatus,
  ].filter(Boolean);

  if (statuses.includes('RUNNING')) return 'RUNNING';
  if (statuses.includes('BLOCKED')) return 'BLOCKED';
  if (statuses.includes('PARTIAL')) return 'PARTIAL';
  if (statuses.includes('FAILED') && statuses.includes('DONE')) return 'PARTIAL';
  if (statuses.includes('FAILED')) return 'FAILED';
  if (statuses.includes('DONE')) return 'DONE';
  if (statuses.length > 0 && statuses.every((status) => status === 'SKIPPED')) return 'SKIPPED';
  return 'PENDING';
}

function getSlaStateBackend(caseData, now = new Date()) {
  const createdAt = asDate(caseData?.createdAt);
  if (!createdAt) return 'no_sla';
  const slaHours = Number(caseData?.slaHours ?? 48);
  const totalMs = slaHours * 60 * 60 * 1000;
  const deadline = new Date(createdAt.getTime() + totalMs);

  if (caseData?.status === 'DONE') {
    const concludedAt = asDate(caseData?.concludedAt);
    const elapsedMs = concludedAt
      ? concludedAt.getTime() - createdAt.getTime()
      : (Number(caseData?.turnaroundHours) || 0) * 60 * 60 * 1000;
    return elapsedMs <= totalMs ? 'completed_on_time' : 'completed_late';
  }

  const remainingMs = deadline.getTime() - now.getTime();
  if (remainingMs < 0) return 'overdue';
  const elapsedMs = totalMs - remainingMs;
  const percentElapsed = Math.max(0, (elapsedMs / totalMs) * 100);
  return percentElapsed >= 75 ? 'warning' : 'on_time';
}

/* =========================================================
   Funções pura — Comparação
   ========================================================= */

const URGENCY_BLOCKED_STATUSES = new Set(['CORRECTION_NEEDED', 'WAITING_INFO']);

function isUrgencyBlockedOnClient(caseData) {
  return URGENCY_BLOCKED_STATUSES.has(caseData?.status);
}

function computeUrgencyRank(caseData, now = new Date()) {
  const created = caseData.createdAt ? new Date(caseData.createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return Number.MAX_SAFE_INTEGER;
  const slaHours = Number(caseData.slaHours) > 0 ? Number(caseData.slaHours) : 48;
  const remainingMs = created.getTime() + slaHours * 3600000 - now.getTime();
  const highBoost = caseData.priority === 'HIGH' ? -1 : 0;
  // remainingMs negativo (vencido) ordena naturalmente antes; boost HIGH desloca meio degrau
  return remainingMs + highBoost * 1800000;
}

function compareOpsCases(left, right, sortField, sortDir, now = new Date()) {
  if (sortField === 'urgency') {
    const leftBlocked = isUrgencyBlockedOnClient(left);
    const rightBlocked = isUrgencyBlockedOnClient(right);
    if (leftBlocked !== rightBlocked) return leftBlocked ? 1 : -1;
    const diff = computeUrgencyRank(left, now) - computeUrgencyRank(right, now);
    if (diff !== 0) return diff;
    return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
  }
  const field = ['candidateName', 'createdAt', 'status', 'finalVerdict', 'riskLevel'].includes(sortField) ? sortField : 'createdAt';
  const direction = sortDir === 'asc' ? 1 : -1;
  let leftValue = left[field] || '';
  let rightValue = right[field] || '';
  if (field === 'candidateName') {
    leftValue = normalizeSearchText(leftValue);
    rightValue = normalizeSearchText(rightValue);
  }
  if (leftValue < rightValue) return -1 * direction;
  if (leftValue > rightValue) return 1 * direction;
  return String(left.id || '').localeCompare(String(right.id || ''));
}

function compareClientCases(left, right, sortField, sortDir) {
  const field = ['candidateName', 'createdAt', 'status', 'finalVerdict'].includes(sortField) ? sortField : 'createdAt';
  const direction = sortDir === 'asc' ? 1 : -1;
  let leftValue = left[field] || '';
  let rightValue = right[field] || '';
  if (field === 'candidateName') {
    leftValue = normalizeSearchText(leftValue);
    rightValue = normalizeSearchText(rightValue);
  }
  if (leftValue < rightValue) return -1 * direction;
  if (leftValue > rightValue) return 1 * direction;
  return String(left.id || '').localeCompare(String(right.id || ''));
}

/* =========================================================
   Funções puras — Filtros (versões completas do monolito)
   ========================================================= */

function matchesClientCaseSearchFull(caseData, rawTerm) {
  const term = normalizeSearchText(rawTerm);
  if (!term) return true;
  const digits = String(rawTerm || '').replace(/\D/g, '');
  const candidateName = normalizeSearchText(caseData.candidateName);
  const cpfDigits = String(caseData.cpf || caseData.cpfMasked || '').replace(/\D/g, '');
  const caseId = normalizeSearchText(caseData.caseId || caseData.id);

  if (candidateName.includes(term)) return true;
  if (caseId.includes(term)) return true;
  return digits.length >= 3 && cpfDigits.includes(digits);
}

function matchesClientCaseFiltersFull(caseData, filters) {
  const status = String(filters?.status || 'ALL');
  const verdict = String(filters?.verdict || 'ALL');
  const dateFrom = String(filters?.dateFrom || '');
  const dateTo = String(filters?.dateTo || '');
  const createdDate = String(caseData.createdAt || '').slice(0, 10);

  if (status !== 'ALL' && caseData.status !== status) return false;
  if (verdict !== 'ALL' && caseData.finalVerdict !== verdict) return false;
  if (dateFrom && createdDate && createdDate < dateFrom) return false;
  if (dateTo && createdDate && createdDate > dateTo) return false;
  if (filters?.searchTerm && !matchesClientCaseSearchFull(caseData, filters.searchTerm)) return false;
  return true;
}

function matchesOpsCaseSearchFull(caseData, rawTerm) {
  const term = normalizeSearchText(rawTerm);
  if (!term) return true;
  const digits = String(rawTerm || '').replace(/\D/g, '');
  const candidateName = normalizeSearchText(caseData.candidateName);
  const cpfDigits = String(caseData.cpf || caseData.cpfMasked || '').replace(/\D/g, '');
  const caseId = normalizeSearchText(caseData.caseId || caseData.id);

  if (candidateName.includes(term)) return true;
  if (caseId.includes(term)) return true;
  return digits.length >= 3 && cpfDigits.includes(digits);
}

function matchesOpsCaseFiltersFull(caseData, filters = {}, options = {}) {
  const status = String(filters.status || filters.filter || 'ALL');
  const risk = String(filters.risk || 'ALL');
  const verdict = String(filters.verdict || 'ALL');
  const enrichment = String(filters.enrichment || 'ALL');
  const sla = String(filters.sla || 'ALL');
  const assignment = String(filters.assignment || 'ALL');
  const dateFrom = String(filters.dateFrom || '');
  const dateTo = String(filters.dateTo || '');
  const createdDate = String(caseData.createdAt || '').slice(0, 10);

  if (options.queueOnly && caseData.status === 'DONE') return false;
  if (status !== 'ALL' && caseData.status !== status) return false;
  if (risk !== 'ALL' && caseData.riskLevel !== risk) return false;
  if (verdict !== 'ALL' && caseData.finalVerdict !== verdict) return false;
  if (enrichment !== 'ALL' && getOverallEnrichmentStatusBackend(caseData) !== enrichment) return false;
  if (sla !== 'ALL') {
    const state = getSlaStateBackend(caseData);
    if (sla === 'ON_TIME' && state !== 'on_time') return false;
    if (sla === 'WARNING' && state !== 'warning') return false;
    if (sla === 'OVERDUE' && state !== 'overdue') return false;
  }
  if (assignment === 'UNASSIGNED' && caseData.assigneeId) return false;
  if (assignment === 'MINE' && caseData.assigneeId !== options.assigneeUid) return false;
  if (dateFrom && createdDate && createdDate < dateFrom) return false;
  if (dateTo && createdDate && createdDate > dateTo) return false;
  if (filters.searchTerm && !matchesOpsCaseSearchFull(caseData, filters.searchTerm)) return false;
  return true;
}

/* =========================================================
   Funções puras — Métricas
   ========================================================= */

function buildOpsMetricsFromCases(cases, { showAllTenants = false } = {}) {
  const done = cases.filter((caseData) => caseData.status === 'DONE');
  const running = cases.filter((caseData) => caseData.status !== 'DONE' && caseData.status !== 'CORRECTION_NEEDED');
  const corrections = cases.filter((caseData) => caseData.status === 'CORRECTION_NEEDED');
  const verdicts = { FIT: 0, ATTENTION: 0, NOT_RECOMMENDED: 0, INCONCLUSIVE: 0 };
  done.forEach((caseData) => {
    const key = caseData.finalVerdict || 'INCONCLUSIVE';
    verdicts[key] = (verdicts[key] || 0) + 1;
  });

  const prov = {};
  METRIC_PROVIDERS.forEach((provider) => {
    const stats = { calls: 0, done: 0, partial: 0, failed: 0, running: 0, costBRL: 0 };
    cases.forEach((caseData) => {
      const status = caseData[provider.field];
      if (!status || status === 'SKIPPED') return;
      stats.calls += 1;
      if (status === 'DONE') stats.done += 1;
      else if (status === 'PARTIAL') stats.partial += 1;
      else if (status === 'FAILED') stats.failed += 1;
      else if (status === 'RUNNING') stats.running += 1;
    });
    prov[provider.key] = stats;
  });

  let fdTotalBRL = 0;
  const fdPhaseCosts = {};
  cases.forEach((caseData) => {
    const sources = caseData.enrichmentSources || {};
    Object.entries(sources).forEach(([phase, info]) => {
      const cost = Number.parseFloat(info?.cost) || 0;
      fdTotalBRL += cost;
      fdPhaseCosts[phase] = (fdPhaseCosts[phase] || 0) + cost;
    });
  });
  prov.fontedata.costBRL = fdTotalBRL;

  const aiCases = cases.filter((caseData) => caseData.aiClassificationReviewRawResponse || caseData.aiClassificationReview || caseData.aiRawResponse || caseData.aiStructured);
  const structOk = aiCases.filter((caseData) => (caseData.aiClassificationReviewOk ?? caseData.aiStructuredOk) === true).length;
  const structFail = aiCases.filter((caseData) => (caseData.aiClassificationReviewOk ?? caseData.aiStructuredOk) === false).length;
  const aiErrors = cases.filter((caseData) => (caseData.aiClassificationReviewError || caseData.aiError) && !(caseData.aiClassificationReviewRawResponse || caseData.aiRawResponse)).length;
  const cached = aiCases.filter((caseData) => caseData.aiClassificationReviewFromCache || caseData.aiFromCache).length;
  const aiCostUSD = aiCases.reduce((sum, caseData) => sum + (caseData.aiCostUsd || 0) + (caseData.aiHomonymCostUsd || 0) + (caseData.aiClassificationReviewCostUsd || 0), 0);
  const tokIn = aiCases.reduce((sum, caseData) => sum + (caseData.aiClassificationReviewTokens?.input || caseData.aiTokens?.input || 0), 0);
  const tokOut = aiCases.reduce((sum, caseData) => sum + (caseData.aiClassificationReviewTokens?.output || caseData.aiTokens?.output || 0), 0);
  const decisions = { ACCEPTED: 0, ADJUSTED: 0, IGNORED: 0, none: 0 };
  aiCases.forEach((caseData) => {
    const key = caseData.aiDecision || 'none';
    decisions[key] = (decisions[key] || 0) + 1;
  });

  const turnaroundHours = done
    .map((caseData) => (typeof caseData.turnaroundHours === 'number' ? caseData.turnaroundHours : diffHoursBackend(caseData.createdAt, caseData.concludedAt || caseData.updatedAt)))
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  const avgDays = turnaroundHours.length
    ? (turnaroundHours.reduce((sum, value) => sum + value, 0) / turnaroundHours.length / 24).toFixed(1)
    : null;

  const byTenant = {};
  if (showAllTenants) {
    cases.forEach((caseData) => {
      const tenant = caseData.tenantName || caseData.tenantId || '?';
      if (!byTenant[tenant]) byTenant[tenant] = { total: 0, done: 0, fdCost: 0, aiCost: 0 };
      byTenant[tenant].total += 1;
      if (caseData.status === 'DONE') byTenant[tenant].done += 1;
      byTenant[tenant].aiCost += (caseData.aiCostUsd || 0) + (caseData.aiHomonymCostUsd || 0) + (caseData.aiClassificationReviewCostUsd || 0);
      Object.values(caseData.enrichmentSources || {}).forEach((info) => {
        byTenant[tenant].fdCost += Number.parseFloat(info?.cost) || 0;
      });
    });
  }

  return {
    total: cases.length,
    done: done.length,
    running: running.length,
    corrections: corrections.length,
    verdicts,
    prov,
    fdPhaseCosts: Object.entries(fdPhaseCosts).sort((left, right) => right[1] - left[1]),
    fdTotalBRL,
    ai: { total: aiCases.length, structOk, structFail, errors: aiErrors, cached, costUSD: aiCostUSD, tokIn, tokOut, decisions },
    avgDays,
    completionRate: pctBackend(done.length, cases.length),
    structuredRate: pctBackend(structOk, aiCases.length),
    cacheRate: pctBackend(cached, aiCases.length),
    reviewRate: pctBackend((decisions.ADJUSTED || 0) + (decisions.IGNORED || 0), aiCases.length),
    byTenant: Object.entries(byTenant).sort((left, right) => (right[1].fdCost + right[1].aiCost) - (left[1].fdCost + left[1].aiCost)),
  };
}

function buildClientDashboardMetricsFromCases(cases, now = new Date()) {
  const doneCases = cases.filter((caseData) => caseData.status === 'DONE');
  const inProgressCases = cases.filter((caseData) => ['IN_PROGRESS', 'WAITING_INFO'].includes(caseData.status));
  const pendingCases = cases.filter((caseData) => caseData.status === 'PENDING');
  const correctionCases = cases.filter((caseData) => caseData.status === 'CORRECTION_NEEDED');
  const waitingInfoCases = cases.filter((caseData) => caseData.status === 'WAITING_INFO');
  const verdicts = {
    FIT: doneCases.filter((caseData) => caseData.finalVerdict === 'FIT').length,
    ATTENTION: doneCases.filter((caseData) => caseData.finalVerdict === 'ATTENTION').length,
    NOT_RECOMMENDED: doneCases.filter((caseData) => caseData.finalVerdict === 'NOT_RECOMMENDED').length,
  };
  const turnaroundHours = doneCases
    .map((caseData) => (typeof caseData.turnaroundHours === 'number' ? caseData.turnaroundHours : diffHoursBackend(caseData.createdAt, caseData.concludedAt)))
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  const avgTurnaroundHours = turnaroundHours.length
    ? turnaroundHours.reduce((sum, value) => sum + value, 0) / turnaroundHours.length
    : null;
  const months = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const currentMonth = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const monthCases = cases.filter((caseData) => String(caseData.createdMonthKey || caseData.createdAt || '').startsWith(key));
    months.push({
      key,
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'America/Sao_Paulo' }).format(currentMonth),
      count: monthCases.length,
      doneCount: monthCases.filter((caseData) => caseData.status === 'DONE').length,
    });
  }
  const recentCompletedCases = [...doneCases]
    .filter((caseData) => caseData.concludedAt)
    .sort((left, right) => String(right.concludedAt).localeCompare(String(left.concludedAt)))
    .slice(0, 4);
  const attentionRules = [
    { label: 'Antecedentes criminais', match: (caseData) => ['POSITIVE', 'INCONCLUSIVE'].includes(caseData.criminalFlag) },
    { label: 'Processos trabalhistas', match: (caseData) => ['POSITIVE', 'INCONCLUSIVE'].includes(caseData.laborFlag) },
    { label: 'Mandados de prisao', match: (caseData) => caseData.warrantFlag === 'POSITIVE' },
    { label: 'Exposicao OSINT', match: (caseData) => ['MEDIUM', 'HIGH'].includes(caseData.osintLevel) },
    { label: 'Redes sociais', match: (caseData) => ['CONCERN', 'CONTRAINDICATED'].includes(caseData.socialStatus) },
    { label: 'Perfil digital', match: (caseData) => ['ALERT', 'CRITICAL'].includes(caseData.digitalFlag) },
    { label: 'Conflito de interesse', match: (caseData) => caseData.conflictInterest === 'YES' },
  ];
  const topFlagCounts = {};
  doneCases
    .filter((caseData) => ['ATTENTION', 'NOT_RECOMMENDED'].includes(caseData.finalVerdict))
    .forEach((caseData) => {
      attentionRules.forEach((rule) => {
        if (rule.match(caseData)) topFlagCounts[rule.label] = (topFlagCounts[rule.label] || 0) + 1;
      });
    });

  return {
    total: cases.length,
    done: doneCases.length,
    inProgress: inProgressCases.length,
    pending: pendingCases.length,
    corrections: correctionCases.length,
    waitingInfo: waitingInfoCases.length,
    completionRate: cases.length > 0 ? Math.round((doneCases.length / cases.length) * 100) : 0,
    avgTurnaroundHours,
    verdicts,
    months,
    maxMonthCount: Math.max(...months.map((month) => month.count), 1),
    topFlags: Object.entries(topFlagCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count })),
    recentCompletedCases,
  };
}

/* =========================================================
   Funções puras — Fetch documents
   ========================================================= */

async function fetchCaseMetricDocuments({ db, collectionId = 'cases', tenantId = null, periodDays = 0, fields = [] }) {
  const cutoff = periodDays > 0 ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000) : null;
  let lastDoc = null;
  let pageCount = 0;
  const docs = [];

  while (true) {
    let q = db.collection(collectionId);
    if (tenantId) q = q.where('tenantId', '==', tenantId);
    if (cutoff) q = q.where('createdAt', '>=', cutoff);
    q = q.orderBy('createdAt', 'desc');
    if (fields.length > 0) q = q.select(...fields);
    if (lastDoc) q = q.startAfter(lastDoc);
    q = q.limit(CASE_QUERY_PAGE_SIZE);
    const snapshot = await q.get();
    pageCount += 1;
    docs.push(...snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    if (snapshot.docs.length < CASE_QUERY_PAGE_SIZE) break;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return { docs, pageCount };
}

async function fetchTenantCaseDocuments({ db, collectionId, tenantId = null, fields = [], maxDocs = CASE_QUERY_MAX_DOCS }) {
  let lastDoc = null;
  let pageCount = 0;
  let scannedRecords = 0;
  const docs = [];

  while (scannedRecords < maxDocs) {
    let q = db.collection(collectionId);
    if (tenantId) q = q.where('tenantId', '==', tenantId);
    q = q.orderBy('createdAt', 'desc');
    if (fields.length > 0) q = q.select(...fields);
    if (lastDoc) q = q.startAfter(lastDoc);
    q = q.limit(Math.min(CASE_QUERY_PAGE_SIZE, maxDocs - scannedRecords));
    const snap = await q.get();
    pageCount += 1;
    const currentDocs = snap.docs || [];
    scannedRecords += currentDocs.length;
    docs.push(...currentDocs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    if (currentDocs.length < CASE_QUERY_PAGE_SIZE) break;
    lastDoc = currentDocs[currentDocs.length - 1];
  }

  return { docs, pageCount, scannedRecords, capped: scannedRecords >= maxDocs };
}

/**
 * Varre clientCases do tenant aplicando os filtros do portal cliente.
 *
 * Usado pelo listClientCases (V1) e pelo fallback do V2 — os dois mantinham o
 * mesmo laço copiado. O filtro de status/verdict vai para a query quando
 * possível: com um deles fixado, a varredura le so a fatia correspondente em vez
 * dos 10k docs do tenant. Nao empurramos os dois juntos porque nao existe indice
 * composto (tenantId + status + finalVerdict + createdAt).
 *
 * @returns {Promise<{matches: Object[], scannedRecords: number, pageCount: number, capped: boolean}>}
 */
async function fetchClientCaseMatches({ db, tenantId, filters = {}, scanLimit = CLIENT_CASE_SEARCH_SCAN_LIMIT }) {
  const statusFilter = String(filters.status || 'ALL');
  const verdictFilter = String(filters.verdict || 'ALL');
  const pushDown = statusFilter !== 'ALL'
    ? { field: 'status', value: statusFilter }
    : (verdictFilter !== 'ALL' ? { field: 'finalVerdict', value: verdictFilter } : null);

  const matches = [];
  let lastDoc = null;
  let scannedRecords = 0;
  let pageCount = 0;
  let capped = false;

  while (true) {
    let q = db.collection('clientCases').where('tenantId', '==', tenantId);
    if (pushDown) q = q.where(pushDown.field, '==', pushDown.value);
    q = q.orderBy('createdAt', 'desc');
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.limit(CASE_QUERY_PAGE_SIZE).get();
    pageCount += 1;
    const docs = snap.docs || [];
    docs.forEach((docSnap) => {
      scannedRecords += 1;
      const serialized = serializeClientCaseDocument(docSnap);
      if (matchesClientCaseFilters(serialized, filters)) matches.push(serialized);
    });
    if (docs.length < CASE_QUERY_PAGE_SIZE) break;
    if (scannedRecords >= scanLimit) {
      capped = true;
      break;
    }
    lastDoc = docs[docs.length - 1];
  }

  return { matches, scannedRecords, pageCount, capped };
}

function buildClientCaseStats(cases) {
  return cases.reduce((acc, caseData) => {
    acc.total += 1;
    if (caseData.status === 'DONE') acc.done += 1;
    if (caseData.status === 'PENDING') acc.pending += 1;
    if (caseData.status === 'IN_PROGRESS') acc.inProgress += 1;
    if (caseData.status === 'WAITING_INFO') acc.waiting += 1;
    if (caseData.status === 'CORRECTION_NEEDED') acc.corrections += 1;
    if (caseData.finalVerdict === 'NOT_RECOMMENDED') acc.notRecommended += 1;
    return acc;
  }, { total: 0, done: 0, pending: 0, inProgress: 0, waiting: 0, corrections: 0, notRecommended: 0 });
}

/* =========================================================
   Funções puras — Tenant submission limits
   ========================================================= */

async function enforceTenantSubmissionLimits(deps, tenantId, settings, { actor, ip } = {}) {
  const { db, writeAuditEvent, SOURCE } = deps;
    const now = new Date();
    const dayKey = formatDateKey(now);
    const monthKey = formatMonthKey(now);
    if (settings?.dailyLimit == null && settings?.monthlyLimit == null) return { dailyCount: 0, monthlyCount: 0, exceeded: false };

    const usageRef = db.collection('tenantUsage').doc(tenantId);

    const result = await db.runTransaction(async (tx) => {
      const usageSnap = await tx.get(usageRef);
      const usage = usageSnap.exists ? usageSnap.data() : {};

      let dailyCount = (usage.dayKey === dayKey) ? (usage.dailyCount || 0) : 0;
      let monthlyCount = (usage.monthKey === monthKey) ? (usage.monthlyCount || 0) : 0;

      const dailyLimit = settings.dailyLimit ?? null;
      const monthlyLimit = settings.monthlyLimit ?? null;
      const allowDailyExceedance = settings.allowDailyExceedance !== false;
      const allowMonthlyExceedance = settings.allowMonthlyExceedance === true;

      let exceeded = false;
      let blockedReason = null;

      if (dailyLimit && dailyCount >= dailyLimit) {
        if (!allowDailyExceedance) {
          blockedReason = 'daily';
        } else {
          exceeded = true;
        }
      }

      if (!blockedReason && monthlyLimit && monthlyCount >= monthlyLimit) {
        if (!allowMonthlyExceedance) {
          blockedReason = 'monthly';
        } else {
          exceeded = true;
        }
      }

      if (blockedReason) {
        return { blocked: true, blockedReason, dailyCount, monthlyCount, dailyLimit, monthlyLimit };
      }

      dailyCount += 1;
      monthlyCount += 1;

      tx.set(usageRef, {
        tenantId,
        dayKey,
        monthKey,
        dailyCount,
        monthlyCount,
        lastSubmissionAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: false });

      return { blocked: false, exceeded, dailyCount, monthlyCount, dailyLimit, monthlyLimit };
    });

    if (result.blocked) {
      const action = result.blockedReason === 'daily' ? 'SUBMISSION_BLOCKED_DAILY' : 'SUBMISSION_BLOCKED_MONTHLY';
      const limit = result.blockedReason === 'daily' ? result.dailyLimit : result.monthlyLimit;
      if (actor) {
        await writeAuditEvent({
          action,
          tenantId,
          actor,
          entity: { type: 'TENANT', id: tenantId, label: tenantId },
          source: SOURCE.PORTAL_CLIENT,
          ip: ip || null,
          detail: result.blockedReason === 'daily'
            ? `Submissao bloqueada — limite diario de ${limit} consultas atingido`
            : `Submissao bloqueada — limite mensal de ${limit} consultas atingido`,
          templateVars: result.blockedReason === 'daily'
            ? { dailyLimit: limit }
            : { monthlyLimit: limit },
        });
      }
      const msg = result.blockedReason === 'daily'
        ? `Limite diario de ${limit} consultas atingido. Tente novamente amanha.`
        : `Limite mensal de ${limit} consultas atingido. Entre em contato com o administrador.`;
      throw new HttpsError('resource-exhausted', msg);
    }

    if (result.exceeded) {
      const isDailyExceeded = result.dailyLimit && result.dailyCount > result.dailyLimit;
      const isMonthlyExceeded = result.monthlyLimit && result.monthlyCount > result.monthlyLimit;
      if (isDailyExceeded && actor) {
        await writeAuditEvent({
          action: 'DAILY_LIMIT_EXCEEDED',
          tenantId,
          actor,
          entity: { type: 'TENANT', id: tenantId, label: tenantId },
          source: SOURCE.PORTAL_CLIENT,
          ip: ip || null,
          detail: `Limite diario excedido (${result.dailyCount}/${result.dailyLimit}) — consulta registrada como excedente do dia`,
          templateVars: { dailyCount: result.dailyCount, dailyLimit: result.dailyLimit },
        });
      }
      if (isMonthlyExceeded && actor) {
        await writeAuditEvent({
          action: 'MONTHLY_LIMIT_EXCEEDED',
          tenantId,
          actor,
          entity: { type: 'TENANT', id: tenantId, label: tenantId },
          source: SOURCE.PORTAL_CLIENT,
          ip: ip || null,
          detail: `Limite mensal excedido (${result.monthlyCount}/${result.monthlyLimit}) — consulta faturavel no proximo ciclo`,
          templateVars: { monthlyCount: result.monthlyCount, monthlyLimit: result.monthlyLimit },
        });
      }
    }

    return { dailyCount: result.dailyCount, monthlyCount: result.monthlyCount, exceeded: result.exceeded };
}

async function compensateTenantSubmissionLimit({ db, tenantId }) {
  const usageRef = db.collection('tenantUsage').doc(tenantId);
  try {
    await db.runTransaction(async (tx) => {
      const usageSnap = await tx.get(usageRef);
      if (!usageSnap.exists) return;
      const usage = usageSnap.data();
      const dailyCount = Math.max(0, (usage.dailyCount || 0) - 1);
      const monthlyCount = Math.max(0, (usage.monthlyCount || 0) - 1);
      tx.update(usageRef, {
        dailyCount,
        monthlyCount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (compErr) {
    console.error(`[compensateTenantSubmissionLimit] Failed to decrement quota for tenant ${tenantId}:`, compErr.message);
  }
}

/* =========================================================
   Handlers — Factories
   ========================================================= */

function createListOpsCasesHandler({
  db,
  getOpsUserProfile,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120, memory: '1GiB', cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
      const profile = await getOpsUserProfile(uid);
      const tenantId = resolveOpsMetricsTenant(profile, request.data?.tenantId);
      const pageSize = Math.min(Math.max(Number(request.data?.pageSize) || 50, 1), CLIENT_CASE_PAGE_SIZE_MAX);
      const page = Math.max(Number(request.data?.page) || 1, 1);
      const filters = request.data?.filters || {};
      const queueOnly = Boolean(request.data?.queueOnly);
      const assigneeUid = String(request.data?.assigneeUid || uid || '');
      const sortField = String(request.data?.sortField || 'createdAt');
      const sortDir = String(request.data?.sortDir || 'desc') === 'asc' ? 'asc' : 'desc';
      const now = new Date();

      const { docs, pageCount, scannedRecords, capped } = await fetchTenantCaseDocuments({
        db,
        collectionId: 'cases',
        tenantId,
        fields: OPS_CASE_LIST_FIELDS,
      });
      const serialized = docs.map((docData) => ({
        ...docData,
        createdAt: asIsoOrNull(docData.createdAt) || docData.createdAt || null,
        updatedAt: asIsoOrNull(docData.updatedAt) || docData.updatedAt || null,
        concludedAt: asIsoOrNull(docData.concludedAt) || docData.concludedAt || null,
      }));
      const statsBase = queueOnly
        ? serialized.filter((caseData) => caseData.status !== 'DONE')
        : serialized;
      const allMatches = serialized.filter((caseData) => matchesOpsCaseFiltersFull(caseData, filters, { queueOnly, assigneeUid }));
      allMatches.sort((left, right) => compareOpsCases(left, right, sortField, sortDir, now));

      const start = (page - 1) * pageSize;
      const pageCases = allMatches.slice(start, start + pageSize);
      return {
        cases: pageCases,
        total: allMatches.length,
        stats: buildOpsCaseStats(statsBase),
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(allMatches.length / pageSize)),
        hasMore: start + pageSize < allMatches.length,
        meta: {
          source: 'server',
          scannedRecords,
          pageCount,
          capped,
          tenantId,
          queueOnly,
        },
      };
    },
  );
}

function createListClientCasesHandler({
  db,
  getClientUserProfile,
}) {
  return onCall(
    // maxInstances vem de CLIENT_CASE_LIST_RUNTIME: sem teto, uma rajada de buscas
    // escalava ate o limite padrao de instancias, cada uma varrendo o tenant
    // inteiro — 100 timeouts em 5s (2026-08-14).
    { ...CLIENT_CASE_LIST_RUNTIME, cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
      const profile = await getClientUserProfile(uid);
      const pageSize = Math.min(Math.max(Number(request.data?.pageSize) || 50, 1), CLIENT_CASE_PAGE_SIZE_MAX);
      const page = Math.max(Number(request.data?.page) || 1, 1);
      const filters = request.data?.filters || {};
      const sortField = String(request.data?.sortField || 'createdAt');
      const sortDir = String(request.data?.sortDir || 'desc') === 'asc' ? 'asc' : 'desc';

      const { matches: allMatches, scannedRecords, pageCount, capped } = await fetchClientCaseMatches({
        db,
        tenantId: profile.tenantId,
        filters,
      });

      allMatches.sort((left, right) => compareClientCases(left, right, sortField, sortDir));
      const start = (page - 1) * pageSize;
      const pageCases = allMatches.slice(start, start + pageSize);
      const stats = buildClientCaseStats(allMatches);
      return {
        cases: pageCases,
        total: allMatches.length,
        stats,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(allMatches.length / pageSize)),
        hasMore: start + pageSize < allMatches.length,
        meta: {
          source: 'server',
          scannedRecords,
          pageCount,
          capped,
        },
      };
    },
  );
}

function createListOpsCasesV2Handler({
  db,
  getOpsUserProfile,
}) {
  return async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
      const profile = await getOpsUserProfile(uid);
      const tenantId = resolveOpsMetricsTenant(profile, request.data?.tenantId);
      const limit = request.data?.limit;
      const cursor = request.data?.cursor || null;
      const filters = request.data?.filters || {};
      const queueOnly = Boolean(request.data?.queueOnly);
      const assigneeUid = String(request.data?.assigneeUid || uid || '');
      const sortField = String(request.data?.sortField || 'createdAt');
      const sortDir = String(request.data?.sortDir || 'desc') === 'asc' ? 'asc' : 'desc';
      const fallbackToV1 = Boolean(request.data?.fallbackToV1);
      const now = new Date();

      const unsupportedFilters = ['searchTerm', 'enrichment', 'sla', 'assignment'];
      const hasUnsupportedFilters = unsupportedFilters.some((key) => {
        const val = filters[key];
        return val !== undefined && val !== null && val !== '' && val !== 'ALL';
      });
      const hasUnsupportedSortField = sortField === 'urgency';
      const needsFallback = hasUnsupportedFilters || hasUnsupportedSortField;

      if (needsFallback && !fallbackToV1) {
        const reasons = unsupportedFilters.filter((k) => {
          const val = filters[k];
          return val !== undefined && val !== null && val !== '' && val !== 'ALL';
        });
        if (hasUnsupportedSortField) reasons.push('sortField=urgency');
        throw new HttpsError('invalid-argument', 'Filtros nao suportados em V2. Use fallbackToV1=true ou remova os filtros: ' + reasons.join(', '));
      }

      if (needsFallback && fallbackToV1) {
        const { docs, pageCount, scannedRecords, capped } = await fetchTenantCaseDocuments({
          db,
          collectionId: 'cases',
          tenantId,
          fields: OPS_CASE_LIST_FIELDS,
        });
        const serialized = docs.map((docData) => ({
          ...docData,
          createdAt: asIsoOrNull(docData.createdAt) || docData.createdAt || null,
          updatedAt: asIsoOrNull(docData.updatedAt) || docData.updatedAt || null,
          concludedAt: asIsoOrNull(docData.concludedAt) || docData.concludedAt || null,
        }));
        const statsBase = queueOnly
          ? serialized.filter((caseData) => caseData.status !== 'DONE')
          : serialized;
        const allMatches = serialized.filter((caseData) => matchesOpsCaseFiltersFull(caseData, filters, { queueOnly, assigneeUid }));
        allMatches.sort((left, right) => compareOpsCases(left, right, sortField, sortDir, now));
        const pageSize = Math.min(Math.max(Number(request.data?.pageSize) || 50, 1), CLIENT_CASE_PAGE_SIZE_MAX);
        const page = Math.max(Number(request.data?.page) || 1, 1);
        const start = (page - 1) * pageSize;
        const pageCases = allMatches.slice(start, start + pageSize);
        return {
          cases: pageCases,
          nextCursor: null,
          hasMore: start + pageSize < allMatches.length,
          pageSize,
          stats: buildOpsCaseStats(statsBase),
          total: allMatches.length,
          totalPages: Math.max(1, Math.ceil(allMatches.length / pageSize)),
          meta: {
            source: 'server',
            version: 'V1-fallback',
            fallbackUsed: true,
            scannedRecords,
            pageCount,
            capped,
            tenantId,
            queueOnly,
          },
        };
      }

      let baseQuery = db.collection('cases').where('tenantId', '==', tenantId);

      const statusFilter = String(filters.status || filters.filter || 'ALL');
      if (statusFilter !== 'ALL') {
        baseQuery = baseQuery.where('status', '==', statusFilter);
      }
      const riskFilter = String(filters.risk || 'ALL');
      if (riskFilter !== 'ALL') {
        baseQuery = baseQuery.where('riskLevel', '==', riskFilter);
      }
      const verdictFilter = String(filters.verdict || 'ALL');
      if (verdictFilter !== 'ALL') {
        baseQuery = baseQuery.where('finalVerdict', '==', verdictFilter);
      }

      const orderDirection = sortDir === 'asc' ? 'asc' : 'desc';
      baseQuery = baseQuery.orderBy(sortField, orderDirection).orderBy('__name__', orderDirection);

      const { docs, nextCursor, hasMore, pageSize } = await paginateFirestoreQuery(baseQuery, {
        cursor,
        limit,
        cursorField: sortField,
        cursorDir: sortDir,
      });

      const cases = docs.map((docSnap) => serializeClientCaseDocument(docSnap));

      const filteredCases = cases.filter((caseData) => {
        if (queueOnly && caseData.status === 'DONE') return false;
        if (assigneeUid && filters.assignment === 'MINE' && caseData.assigneeId !== assigneeUid) return false;
        if (assigneeUid && filters.assignment === 'UNASSIGNED' && caseData.assigneeId) return false;
        return true;
      });

      return {
        cases: filteredCases,
        nextCursor,
        hasMore,
        pageSize,
        stats: null,
        total: null,
        totalPages: null,
        meta: {
          source: 'server',
          version: 'V2',
          fallbackUsed: false,
          tenantId,
          queueOnly,
          sortField,
          sortDir,
        },
      };
  };
}

function createListClientCasesV2Handler({
  db,
  getClientUserProfile,
}) {
  return async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
      const profile = await getClientUserProfile(uid);
      const tenantId = profile.tenantId;
      const limit = request.data?.limit;
      const cursor = request.data?.cursor || null;
      const filters = request.data?.filters || {};
      const sortField = String(request.data?.sortField || 'createdAt');
      const sortDir = String(request.data?.sortDir || 'desc') === 'asc' ? 'asc' : 'desc';
      const fallbackToV1 = Boolean(request.data?.fallbackToV1);

      const unsupportedFilters = ['searchTerm'];
      const hasUnsupportedFilters = unsupportedFilters.some((key) => {
        const val = filters[key];
        return val !== undefined && val !== null && val !== '' && val !== 'ALL';
      });

      if (hasUnsupportedFilters && !fallbackToV1) {
        throw new HttpsError('invalid-argument', 'Filtros nao suportados em V2. Use fallbackToV1=true ou remova os filtros: ' + unsupportedFilters.filter((k) => {
          const val = filters[k];
          return val !== undefined && val !== null && val !== '' && val !== 'ALL';
        }).join(', '));
      }

      if (hasUnsupportedFilters && fallbackToV1) {
        const pageSize = Math.min(Math.max(Number(request.data?.pageSize) || 50, 1), CLIENT_CASE_PAGE_SIZE_MAX);
        const page = Math.max(Number(request.data?.page) || 1, 1);

        const { matches: allMatches, scannedRecords, pageCount, capped } = await fetchClientCaseMatches({
          db,
          tenantId,
          filters,
        });

        allMatches.sort((left, right) => compareClientCases(left, right, sortField, sortDir));
        const start = (page - 1) * pageSize;
        const pageCases = allMatches.slice(start, start + pageSize);
        const stats = buildClientCaseStats(allMatches);

        return {
          cases: pageCases,
          nextCursor: null,
          hasMore: start + pageSize < allMatches.length,
          pageSize,
          stats,
          total: allMatches.length,
          totalPages: Math.max(1, Math.ceil(allMatches.length / pageSize)),
          meta: {
            source: 'server',
            version: 'V1-fallback',
            fallbackUsed: true,
            scannedRecords,
            pageCount,
            capped,
          },
        };
      }

      let baseQuery = db.collection('clientCases').where('tenantId', '==', tenantId);

      const statusFilter = String(filters.status || 'ALL');
      if (statusFilter !== 'ALL') {
        baseQuery = baseQuery.where('status', '==', statusFilter);
      }
      const verdictFilter = String(filters.verdict || 'ALL');
      if (verdictFilter !== 'ALL') {
        baseQuery = baseQuery.where('finalVerdict', '==', verdictFilter);
      }

      const orderDirection = sortDir === 'asc' ? 'asc' : 'desc';
      baseQuery = baseQuery.orderBy(sortField, orderDirection).orderBy('__name__', orderDirection);

      const { docs, nextCursor, hasMore, pageSize } = await paginateFirestoreQuery(baseQuery, {
        cursor,
        limit,
        cursorField: sortField,
        cursorDir: sortDir,
      });

      const cases = docs.map((docSnap) => serializeClientCaseDocument(docSnap));

      const dateFrom = String(filters.dateFrom || '');
      const dateTo = String(filters.dateTo || '');
      const filteredCases = cases.filter((caseData) => {
        const createdDate = String(caseData.createdAt || '').slice(0, 10);
        if (dateFrom && createdDate && createdDate < dateFrom) return false;
        if (dateTo && createdDate && createdDate > dateTo) return false;
        return true;
      });

      return {
        cases: filteredCases,
        nextCursor,
        hasMore,
        pageSize,
        stats: null,
        total: null,
        totalPages: null,
        meta: {
          source: 'server',
          version: 'V2',
          fallbackUsed: false,
          tenantId,
          sortField,
          sortDir,
        },
      };
  };
}

function createGetOpsCaseMetricsHandler({
  db,
  getOpsUserProfile,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120, memory: '1GiB', cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
      const profile = await getOpsUserProfile(uid);
      const periodDays = normalizeMetricsPeriod(request.data?.periodDays ?? 30);
      const tenantId = resolveOpsMetricsTenant(profile, request.data?.tenantId);
      const { docs, pageCount } = await fetchCaseMetricDocuments({
        db,
        collectionId: 'cases',
        tenantId,
        periodDays,
        fields: OPS_METRIC_FIELDS,
      });
      const metrics = buildOpsMetricsFromCases(docs, { showAllTenants: !tenantId && isGlobalOpsProfile(profile) });
      return {
        ...metrics,
        meta: {
          source: 'server',
          scannedRecords: docs.length,
          pageCount,
          generatedAt: new Date().toISOString(),
          periodDays,
          tenantId,
        },
      };
    },
  );
}

function createGetClientDashboardMetricsHandler({
  db,
  getClientUserProfile,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 120, memory: '1GiB', cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');
      const profile = await getClientUserProfile(uid);
      const { docs, pageCount } = await fetchCaseMetricDocuments({
        db,
        collectionId: 'clientCases',
        tenantId: profile.tenantId,
        periodDays: 0,
        fields: CLIENT_DASHBOARD_FIELDS,
      });
      const serialized = docs.map((docData) => serializeClientCaseDocument(docData));
      const metrics = buildClientDashboardMetricsFromCases(serialized);
      return {
        ...metrics,
        meta: {
          source: 'server',
          scannedRecords: docs.length,
          pageCount,
          generatedAt: new Date().toISOString(),
        },
      };
    },
  );
}

function createAssignCaseToCurrentAnalystHandler({
  db,
  getOpsUserProfile,
  assertOpsCanAccessCase,
  writeAuditEvent,
  getClientIp,
  ACTOR_TYPE,
  SOURCE,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const profile = await getOpsUserProfile(uid);
      const caseId = String(request.data?.caseId || '').trim();
      if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

      const caseRef = db.collection('cases').doc(caseId);
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');

      const caseData = caseDoc.data() || {};
      assertOpsCanAccessCase(profile, caseData, caseId);

      await db.runTransaction(async (t) => {
        const snap = await t.get(caseRef);
        const data = snap.data() || {};
        if (data.status !== 'PENDING') {
          throw new HttpsError('failed-precondition', `Caso nao pode ser assumido (status: ${data.status || 'desconhecido'}).`);
        }
        if (data.assigneeId) {
          throw new HttpsError('failed-precondition', 'Caso ja possui responsavel.');
        }
        t.update(caseRef, {
          assigneeId: uid,
          status: 'IN_PROGRESS',
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      await writeAuditEvent({
        action: 'CASE_ASSIGNED',
        tenantId: caseData.tenantId || null,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
        related: { caseId },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        detail: `Caso assumido: ${caseData.candidateName || caseId}`,
      });

      return { success: true };
    },
  );
}

function createAssignCaseToAnalystHandler({
  db,
  getOpsUserProfile,
  assertCanAssignCase,
  assertOpsCanAccessCase,
  writeAuditEvent,
  getClientIp,
  ACTOR_TYPE,
  SOURCE,
  OPS_ROLES,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const callerProfile = await getOpsUserProfile(uid);
      assertCanAssignCase(callerProfile);

      const caseId = String(request.data?.caseId || '').trim();
      const targetUid = String(request.data?.targetUid || '').trim();
      if (!caseId || !targetUid) throw new HttpsError('invalid-argument', 'caseId e targetUid obrigatorios.');

      const caseRef = db.collection('cases').doc(caseId);
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
      const caseData = caseDoc.data() || {};
      assertOpsCanAccessCase(callerProfile, caseData, caseId);

      const targetDoc = await db.collection('userProfiles').doc(targetUid).get();
      if (!targetDoc.exists) throw new HttpsError('not-found', 'Analista nao encontrado.');
      const targetProfile = targetDoc.data();
      if (!OPS_ROLES.has(targetProfile.role)) {
        throw new HttpsError('invalid-argument', 'Usuario alvo nao e um analista.');
      }
      if (targetProfile.status === 'inactive') {
        throw new HttpsError('failed-precondition', 'Analista esta inativo.');
      }
      if (caseData.tenantId && targetProfile.tenantId !== caseData.tenantId) {
        throw new HttpsError('permission-denied', 'Analista nao pertence ao mesmo tenant.');
      }

      const isReassignment = !!caseData.assigneeId;
      await db.runTransaction(async (t) => {
        const snap = await t.get(caseRef);
        const data = snap.data() || {};
        const updateFields = {
          assigneeId: targetUid,
          assigneeName: targetProfile.displayName || targetProfile.email || targetUid,
          assigneeEmail: targetProfile.email || '',
          assignedAt: new Date().toISOString(),
          assignedBy: uid,
          assignedByEmail: callerProfile.email || '',
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (data.status === 'PENDING') {
          updateFields.status = 'IN_PROGRESS';
        }
        t.update(caseRef, updateFields);
      });

      await writeAuditEvent({
        action: isReassignment ? 'CASE_REASSIGNED' : 'CASE_ASSIGNED',
        tenantId: caseData.tenantId || null,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: callerProfile.email || uid },
        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
        related: { caseId, targetUid, targetEmail: targetProfile.email },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        detail: `Caso ${isReassignment ? 'reatribuido' : 'atribuido'} para ${targetProfile.displayName || targetProfile.email}`,
        templateVars: { actorName: callerProfile.displayName || callerProfile.email, candidateName: caseData.candidateName },
      });

      return { success: true, assigneeId: targetUid, assigneeName: targetProfile.displayName };
    },
  );
}

function createUnassignCaseHandler({
  db,
  getOpsUserProfile,
  assertCanAssignCase,
  assertOpsCanAccessCase,
  writeAuditEvent,
  getClientIp,
  ACTOR_TYPE,
  SOURCE,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const callerProfile = await getOpsUserProfile(uid);
      assertCanAssignCase(callerProfile);

      const caseId = String(request.data?.caseId || '').trim();
      if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

      const caseRef = db.collection('cases').doc(caseId);
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
      const caseData = caseDoc.data() || {};
      assertOpsCanAccessCase(callerProfile, caseData, caseId);

      if (!caseData.assigneeId) {
        throw new HttpsError('failed-precondition', 'Caso nao possui responsavel.');
      }

      if (caseData.status === 'DONE') {
        throw new HttpsError('failed-precondition', 'Nao e possivel remover responsavel de caso concluido.');
      }

      const updateFields = {
        assigneeId: FieldValue.delete(),
        assigneeName: FieldValue.delete(),
        assigneeEmail: FieldValue.delete(),
        assignedAt: FieldValue.delete(),
        assignedBy: FieldValue.delete(),
        assignedByEmail: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      const hasReviewData = caseData.reviewDraft && Object.keys(caseData.reviewDraft).length > 0;
      if (!hasReviewData && caseData.status === 'IN_PROGRESS') {
        updateFields.status = 'PENDING';
      }

      await caseRef.update(updateFields);

      await writeAuditEvent({
        action: 'CASE_UNASSIGNED',
        tenantId: caseData.tenantId || null,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: callerProfile.email || uid },
        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
        related: { caseId },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        detail: `Responsavel removido do caso ${caseData.candidateName || caseId}`,
      });

      return { success: true };
    },
  );
}

function createReturnCaseToClientHandler({
  db,
  getOpsUserProfile,
  assertOpsCanAccessCase,
  writeAuditEvent,
  getClientIp,
  ACTOR_TYPE,
  SOURCE,
  buildResetPublishedCaseFields,
  revokeCasePublicationArtifacts,
  createSystemCaseMessage,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 60, cors: true },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const profile = await getOpsUserProfile(uid);
      const caseId = String(request.data?.caseId || '').trim();
      const reason = String(request.data?.reason || '').trim();
      const notes = String(request.data?.notes || '').trim();
      if (!caseId || !reason) {
        throw new HttpsError('invalid-argument', 'caseId e motivo sao obrigatorios.');
      }

      const caseRef = db.collection('cases').doc(caseId);
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
      const caseData = caseDoc.data() || {};

      assertOpsCanAccessCase(profile, caseData, caseId);

      const updateFields = {
        status: 'CORRECTION_NEEDED',
        correctionReason: reason,
        correctionNotes: notes,
        correctionRequestedAt: new Date().toISOString(),
        correctionRequestedBy: profile.email || uid,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (caseData.status === 'DONE') {
        Object.assign(updateFields, buildResetPublishedCaseFields(caseData, {
          preserveReviewDraft: true,
        }));
      }

      if (caseData.publicReportToken || caseData.status === 'DONE') {
        await revokeCasePublicationArtifacts(caseId, caseData);
      }

      await caseRef.update(updateFields);

      try {
        const systemBody = notes
          ? `A equipe solicitou uma correcao nesta analise. Motivo: ${reason}. Detalhes: ${notes}.`
          : `A equipe solicitou uma correcao nesta analise. Motivo: ${reason}.`;
        await createSystemCaseMessage({
          caseId,
          caseData,
          tenantId: caseData.tenantId,
          db,
          systemType: 'CORRECTION_REQUESTED',
          body: systemBody,
        });
      } catch (err) {
        console.warn('[communication] failed to create system message for correction', err);
      }

      await writeAuditEvent({
        action: 'CASE_RETURNED',
        tenantId: caseData.tenantId || null,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
        related: { caseId },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        detail: `Caso devolvido: ${reason}`,
        templateVars: { reason },
      });

      return { success: true };
    },
  );
}

function createRerunAiAnalysisHandler({
  db,
  getOpsUserProfile,
  assertOpsCanAccessCase,
  rerunAiForCase,
  isAiEnabledForTenant,
  openaiApiKey,
}) {
  const options = { region: 'southamerica-east1', cors: true };
  if (openaiApiKey) options.secrets = [openaiApiKey];

  return onCall(
    options,
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const { caseId } = request.data || {};
      if (!caseId || typeof caseId !== 'string') {
        throw new HttpsError('invalid-argument', 'caseId obrigatorio.');
      }

      const profile = await getOpsUserProfile(uid);

      const caseRef = db.collection('cases').doc(caseId);
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
      const caseData = caseDoc.data() || {};
      assertOpsCanAccessCase(profile, caseData, caseId);

      const aiCheck = await isAiEnabledForTenant(caseData.tenantId, db);
      if (!aiCheck.enabled) {
        throw new HttpsError('failed-precondition', aiCheck.reason || 'IA desabilitada para este tenant.');
      }

      return rerunAiForCase(caseRef, caseId, caseData, uid, profile, request);
    },
  );
}

function createRerunEnrichmentPhaseHandler({
  db,
  getOpsUserProfile,
  assertOpsCanAccessCase,
  isDoneOrPartial,
  loadBigDataCorpConfig,
  loadFonteDataConfig,
  loadJuditConfig,
  loadEscavadorConfig,
  loadEscavador2Config,
  loadDjenConfig,
  runBigDataCorpEnrichmentPhase,
  runFonteDataEnrichmentPhase,
  runJuditEnrichmentPhase,
  runEscavadorEnrichmentPhase,
  runEscavador2EnrichmentPhase,
  runDjenEnrichmentPhase,
  acquirePhaseRun,
  maybeRunAutoClassifyAndAi,
  markPendingJuditRequestsStale,
  buildProviderRunIds,
  rerunAiForCase,
  isAiEnabledForTenant,
  writeAuditEvent,
  getClientIp,
  ACTOR_TYPE,
  SOURCE,
  secrets = [],
  memory,
}) {
  return onCall(
    { region: 'southamerica-east1', timeoutSeconds: 540, cors: true, secrets, memory },
    async (request) => {
      const uid = request.auth?.uid;
      if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

      const { caseId, phase, scope = 'cascade' } = request.data || {};
      if (!caseId || typeof caseId !== 'string') {
        throw new HttpsError('invalid-argument', 'caseId obrigatorio.');
      }
      if (!['fontedata', 'escavador', 'escavador2', 'judit', 'bigdatacorp', 'djen', 'ai', 'all'].includes(phase)) {
        throw new HttpsError('invalid-argument', 'Fase invalida para rerun.');
      }
      if (!['single', 'cascade'].includes(scope)) {
        throw new HttpsError('invalid-argument', 'Escopo invalido. Use "single" ou "cascade".');
      }

      const profile = await getOpsUserProfile(uid);
      const caseRef = db.collection('cases').doc(caseId);
      const caseDoc = await caseRef.get();
      if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');

      const caseData = caseDoc.data() || {};
      assertOpsCanAccessCase(profile, caseData, caseId);

      if (phase === 'ai') {
        if (typeof rerunAiForCase !== 'function') {
          throw new HttpsError('failed-precondition', 'Reexecucao de IA nao configurada neste handler.');
        }
        const aiCheck = await isAiEnabledForTenant(caseData.tenantId, db);
        if (!aiCheck.enabled) {
          throw new HttpsError('failed-precondition', aiCheck.reason || 'IA desabilitada para este tenant.');
        }
        return rerunAiForCase(caseRef, caseId, caseData, uid, profile, request);
      }

      if (caseData.status === 'DONE' || caseData.status === 'CORRECTION_NEEDED') {
        throw new HttpsError('failed-precondition', 'Nao e permitido reexecutar enriquecimento em casos concluidos ou devolvidos.');
      }

      if (phase === 'all') {
        const force = request.data?.force === true;
        const reason = request.data?.reason || 'manual_full_rerun';

        const runningProviders = [
          caseData.bigdatacorpEnrichmentStatus === 'RUNNING' ? 'BigDataCorp' : null,
          caseData.juditEnrichmentStatus === 'RUNNING' ? 'Judit' : null,
          caseData.djenEnrichmentStatus === 'RUNNING' ? 'DJEN' : null,
          caseData.escavadorEnrichmentStatus === 'RUNNING' ? 'Escavador' : null,
          caseData.escavador2EnrichmentStatus === 'RUNNING' ? 'Escavador2' : null,
        ].filter(Boolean);

        if (runningProviders.length > 0 && !force) {
          throw new HttpsError(
            'failed-precondition',
            `Provider(s) em execucao: ${runningProviders.join(', ')}. Use force=true para forcar o rerun.`,
          );
        }

        const staleCount = await markPendingJuditRequestsStale(db, caseId, `${reason}_full_rerun`);
        const runIds = buildProviderRunIds(caseId);

        const resetPayload = {
          ...runIds,
          enrichmentGeneration: FieldValue.increment(1),
          bigdatacorpEnrichmentStatus: 'PENDING',
          juditEnrichmentStatus: 'PENDING',
          djenEnrichmentStatus: 'PENDING',
          escavadorEnrichmentStatus: 'PENDING',
          escavador2EnrichmentStatus: 'PENDING',
          enrichmentStatus: 'PENDING',
          bigdatacorpError: null,
          juditError: null,
          djenError: null,
          escavadorError: null,
          escavador2Error: null,
          enrichmentError: null,
          fullRerunRequestedAt: FieldValue.serverTimestamp(),
          fullRerunRequestedBy: uid,
          fullRerunReason: reason,
          fullRerunStatus: 'PENDING',
          updatedAt: FieldValue.serverTimestamp(),
        };

        for (const field of FULL_RERUN_DERIVED_FIELDS) {
          resetPayload[field] = FieldValue.delete();
        }

        await caseRef.update(resetPayload);

        const bdcConfig = await loadBigDataCorpConfig(caseData.tenantId);
        if (bdcConfig.enabled) {
          const runLock = await acquirePhaseRun(caseRef, 'bigdatacorpEnrichmentStatus');
          if (runLock.acquired) {
            const freshData = (await caseRef.get()).data() || {};
            await runBigDataCorpEnrichmentPhase(caseRef, caseId, freshData, bdcConfig);
          }
        } else {
          await caseRef.update({
            bigdatacorpEnrichmentStatus: 'SKIPPED',
            bigdatacorpError: 'Provider desabilitado para este tenant.',
            updatedAt: FieldValue.serverTimestamp(),
          });
          await maybeRunAutoClassifyAndAi(caseRef, caseId, 'BigDataCorp disabled on full rerun');
        }

        await writeAuditEvent({
          action: 'ENRICHMENT_FULL_RERUN',
          tenantId: caseData.tenantId,
          actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
          entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
          related: { caseId },
          source: SOURCE.PORTAL_OPS,
          ip: getClientIp(request),
          metadata: { reason, staleJuditRequests: staleCount, force },
          templateVars: { candidateName: caseData.candidateName || caseId },
        });

        return {
          success: true,
          phase: 'all',
          message: 'Rerun geral iniciado. BigDataCorp foi acionado; demais etapas seguirao pelos triggers.',
          staleJuditRequests: staleCount,
        };
      }

      const phaseMeta = {
        fontedata: { statusField: 'enrichmentStatus', errorField: 'enrichmentError', label: 'FonteData' },
        escavador: { statusField: 'escavadorEnrichmentStatus', errorField: 'escavadorError', label: 'Escavador' },
        escavador2: { statusField: 'escavador2EnrichmentStatus', errorField: 'escavador2Error', label: 'Escavador2' },
        judit: { statusField: 'juditEnrichmentStatus', errorField: 'juditError', label: 'Judit' },
        bigdatacorp: { statusField: 'bigdatacorpEnrichmentStatus', errorField: 'bigdatacorpError', label: 'BigDataCorp' },
        djen: { statusField: 'djenEnrichmentStatus', errorField: 'djenError', label: 'DJEN' },
      };
      const meta = phaseMeta[phase];
      const beforeStatus = caseData[meta.statusField] || 'PENDING';

      if (beforeStatus === 'RUNNING') {
        throw new HttpsError('failed-precondition', `${meta.label} ja esta em execucao.`);
      }
      if (phase === 'fontedata' && beforeStatus === 'BLOCKED') {
        throw new HttpsError('failed-precondition', 'FonteData bloqueou o caso no gate de identidade. Corrija os dados antes de tentar novamente.');
      }
      if (!['FAILED', 'PARTIAL', 'DONE', 'SKIPPED', 'BLOCKED'].includes(beforeStatus)) {
        throw new HttpsError('failed-precondition', `${meta.label} so pode ser reexecutado quando estiver em estado terminal.`);
      }
      if (phase === 'escavador' && !isDoneOrPartial(caseData.juditEnrichmentStatus)) {
        throw new HttpsError('failed-precondition', 'Judit precisa estar concluido antes do rerun do Escavador.');
      }
      if (phase === 'escavador2') {
        const unsettledProviders = [
          !isTerminalEnrichmentStatus(caseData.bigdatacorpEnrichmentStatus) ? 'BigDataCorp' : null,
          !isTerminalEnrichmentStatus(caseData.juditEnrichmentStatus) ? 'Judit' : null,
          caseData.juditNeedsEscavador === true && !isTerminalEnrichmentStatus(caseData.escavadorEnrichmentStatus) ? 'Escavador' : null,
          caseData.djenEnrichmentStatus && !isTerminalEnrichmentStatus(caseData.djenEnrichmentStatus) ? 'DJEN' : null,
        ].filter(Boolean);
        if (unsettledProviders.length > 0) {
          throw new HttpsError('failed-precondition', `Judit precisa estar terminalizado antes do rerun do Escavador2. Provedores pendentes: ${unsettledProviders.join(', ')}.`);
        }
      }

      if (!caseData.tenantId) {
        throw new HttpsError('failed-precondition', 'Caso sem tenantId.');
      }
      const getFreshCaseData = async () => {
        const freshDoc = await caseRef.get();
        return freshDoc.data() || caseData;
      };

      if (phase === 'fontedata') {
        const enrichmentConfig = await loadFonteDataConfig(caseData.tenantId);
        if (!enrichmentConfig.enabled) {
          throw new HttpsError('failed-precondition', 'FonteData desabilitado para este tenant.');
        }
        if (scope === 'cascade') {
          const invalidateFields = {
            updatedAt: FieldValue.serverTimestamp(),
          };
          await caseRef.update(invalidateFields);
        }
        const lock = await acquirePhaseRun(caseRef, 'enrichmentStatus');
        if (!lock.acquired) {
          throw new HttpsError('failed-precondition', 'Enriquecimento ja em andamento. Aguarde a conclusao.');
        }
        await runFonteDataEnrichmentPhase(caseRef, caseId, await getFreshCaseData(), enrichmentConfig);
        try {
          await maybeRunAutoClassifyAndAi(caseRef, caseId, 'FonteData rerun');
        } catch (classifyErr) {
          console.error(`Case ${caseId} [AutoClassify via FonteData rerun]: error:`, classifyErr.message);
        }
      }

      if (phase === 'escavador') {
        const escavadorConfig = await loadEscavadorConfig(caseData.tenantId);
        if (!escavadorConfig.enabled) {
          throw new HttpsError('failed-precondition', 'Escavador desabilitado para este tenant.');
        }
        if (scope === 'cascade') {
          const invalidateFields = {
            escavador2EnrichmentStatus: 'PENDING',
            escavador2Error: null,
            updatedAt: FieldValue.serverTimestamp(),
          };
          for (const field of FULL_RERUN_DERIVED_FIELDS) {
            if (field.startsWith('escavador2') && field !== 'escavador2RawPayloads') {
              invalidateFields[field] = FieldValue.delete();
            }
          }
          await caseRef.update(invalidateFields);
        }
        await runEscavadorEnrichmentPhase(caseRef, caseId, await getFreshCaseData(), escavadorConfig);
      }

      if (phase === 'escavador2') {
        const escavador2Config = await loadEscavador2Config(caseData.tenantId);
        if (!escavador2Config.enabled) {
          throw new HttpsError('failed-precondition', 'Escavador2 desabilitado para este tenant.');
        }
        await caseRef.update({
          escavador2ProcessOmissions: FieldValue.delete(),
          escavador2TechnicalOmissions: FieldValue.delete(),
          escavador2PersistenceTruncated: FieldValue.delete(),
          escavador2PersistenceFallback: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        await runEscavador2EnrichmentPhase(caseRef, caseId, await getFreshCaseData(), escavador2Config);
      }

      if (phase === 'judit') {
        const juditConfig = await loadJuditConfig(caseData.tenantId);
        if (!juditConfig.enabled) {
          throw new HttpsError('failed-precondition', 'Judit desabilitado para este tenant.');
        }
        if (scope === 'cascade') {
          await caseRef.update({ updatedAt: FieldValue.serverTimestamp() });
        }
        const freshCaseData = await getFreshCaseData();
        const skipGate = freshCaseData.juditGateResult?.passed === true;
        await runJuditEnrichmentPhase(caseRef, caseId, freshCaseData, juditConfig, { skipGate });
      }

      if (phase === 'bigdatacorp') {
        const bdcConfig = await loadBigDataCorpConfig(caseData.tenantId);
        if (!bdcConfig.enabled) {
          throw new HttpsError('failed-precondition', 'BigDataCorp desabilitado para este tenant.');
        }
        if (scope === 'cascade') {
          await caseRef.update({ updatedAt: FieldValue.serverTimestamp() });
        }
        await runBigDataCorpEnrichmentPhase(caseRef, caseId, await getFreshCaseData(), bdcConfig);
      }

      if (phase === 'djen') {
        const djenConfig = await loadDjenConfig(caseData.tenantId);
        if (!djenConfig.enabled) {
          throw new HttpsError('failed-precondition', 'DJEN desabilitado para este tenant.');
        }
        if (scope === 'cascade') {
          const invalidateFields = {
            escavador2EnrichmentStatus: 'PENDING',
            escavador2Error: null,
            updatedAt: FieldValue.serverTimestamp(),
          };
          for (const field of FULL_RERUN_DERIVED_FIELDS) {
            if (field.startsWith('escavador2') && field !== 'escavador2RawPayloads') {
              invalidateFields[field] = FieldValue.delete();
            }
          }
          await caseRef.update(invalidateFields);
        }
        await runDjenEnrichmentPhase(caseRef, caseId, await getFreshCaseData(), djenConfig);
      }

      const refreshedDoc = await caseRef.get();
      const refreshedData = refreshedDoc.data() || {};
      const afterStatus = refreshedData[meta.statusField] || beforeStatus;
      const afterError = refreshedData[meta.errorField] || null;

      await writeAuditEvent({
        action: 'ENRICHMENT_PHASE_RERUN',
        tenantId: refreshedData.tenantId,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
        entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
        related: { caseId },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        metadata: { phase, beforeStatus, afterStatus, error: afterError },
        templateVars: { candidateName: caseData.candidateName || caseId, phase },
      });

      return {
        success: afterStatus === 'DONE' || afterStatus === 'PARTIAL',
        phase,
        status: afterStatus,
        error: afterError,
      };
    },
  );
}

/* =========================================================
   Exports
   ========================================================= */

module.exports = {
  // Funções puras
  asDate,
  asIsoOrNull,
  normalizeSearchText,
  serializeClientCaseDocument,
  matchesClientCaseSearch: matchesClientCaseSearchFull,
  matchesClientCaseFilters: matchesClientCaseFiltersFull,
  resolveOpsMetricsTenant,
  isGlobalOpsProfile,
  normalizeMetricsPeriod,
  getMetricCaseDate,
  diffHoursBackend,
  pctBackend,
  makeRunId,
  buildProviderRunIds,
  getOverallEnrichmentStatusBackend,
  getSlaStateBackend,
  compareOpsCases,
  compareClientCases,
  matchesClientCaseSearchFull,
  matchesClientCaseFiltersFull,
  matchesOpsCaseSearchFull,
  matchesOpsCaseFiltersFull,
  buildOpsMetricsFromCases,
  buildClientDashboardMetricsFromCases,
  fetchCaseMetricDocuments,
  fetchTenantCaseDocuments,
  enforceTenantSubmissionLimits,
  compensateTenantSubmissionLimit,

  // Constantes
  CASE_QUERY_PAGE_SIZE,
  CLIENT_CASE_PAGE_SIZE_MAX,
  CLIENT_CASE_SEARCH_SCAN_LIMIT,
  CASE_QUERY_MAX_DOCS,
  CASE_METRICS_PERIODS,
  OPS_METRIC_FIELDS,
  CLIENT_DASHBOARD_FIELDS,
  OPS_CASE_LIST_FIELDS,
  CLIENT_CASE_LIST_RUNTIME,

  // Helpers de listagem do portal cliente
  fetchClientCaseMatches,
  buildClientCaseStats,

  // Handlers
  createListOpsCasesHandler,
  createListClientCasesHandler,
  createListOpsCasesV2Handler,
  createListClientCasesV2Handler,
  createGetOpsCaseMetricsHandler,
  createGetClientDashboardMetricsHandler,
  createAssignCaseToCurrentAnalystHandler,
  createAssignCaseToAnalystHandler,
  createUnassignCaseHandler,
  createReturnCaseToClientHandler,
  createRerunAiAnalysisHandler,
  createRerunEnrichmentPhaseHandler,
};
