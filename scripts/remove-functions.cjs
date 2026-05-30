const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'functions', 'index.js');
let content = fs.readFileSync(filePath, 'utf-8');

const functionsToRemove = [
  {
    name: 'asIsoOrNull',
    pattern: /function asIsoOrNull\(value\) \{\s*const date = asDate\(value\);\s*return date \? date\.toISOString\(\) : null;\s*\}\s*/
  },
  {
    name: 'normalizeSearchText',
    pattern: /function normalizeSearchText\(value\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'resolveOpsMetricsTenant',
    pattern: /function resolveOpsMetricsTenant\(profile, requestedTenantId\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'isGlobalOpsProfile',
    pattern: /function isGlobalOpsProfile\(profile\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'normalizeMetricsPeriod',
    pattern: /function normalizeMetricsPeriod\(value\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'getOverallEnrichmentStatusBackend',
    pattern: /function getOverallEnrichmentStatusBackend\(caseData\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'getSlaStateBackend',
    pattern: /function getSlaStateBackend\(caseData, now = new Date\(\)\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'compareOpsCases',
    pattern: /function compareOpsCases\(left, right, sortField, sortDir\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'compareClientCases',
    pattern: /function compareClientCases\(left, right, sortField, sortDir\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'matchesClientCaseSearch',
    pattern: /function matchesClientCaseSearch\(caseData, rawTerm\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'matchesClientCaseFilters',
    pattern: /function matchesClientCaseFilters\(caseData, filters\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'matchesOpsCaseSearch',
    pattern: /function matchesOpsCaseSearch\(caseData, rawTerm\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'matchesOpsCaseFilters',
    pattern: /function matchesOpsCaseFilters\(caseData, filters = \{\}, options = \{\}\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'buildOpsCaseStats',
    pattern: /function buildOpsCaseStats\(cases\) \{[\s\S]*?\n\}\s*/
  },
  {
    name: 'buildOpsMetricsFromCases',
    pattern: /function buildOpsMetricsFromCases\(cases,[\s\S]*?\n\}\s*/
  },
  {
    name: 'buildClientDashboardMetricsFromCases',
    pattern: /function buildClientDashboardMetricsFromCases\(cases,[\s\S]*?\n\}\s*/
  },
  {
    name: 'fetchCaseMetricDocuments',
    pattern: /async function fetchCaseMetricDocuments\(\{[\s\S]*?\n\}\s*/
  },
  {
    name: 'fetchTenantCaseDocuments',
    pattern: /async function fetchTenantCaseDocuments\(\{[\s\S]*?\n\}\s*/
  },
  {
    name: 'enforceTenantSubmissionLimits',
    pattern: /async function enforceTenantSubmissionLimits\([\s\S]*?\n\}\s*/
  },
  {
    name: 'compensateTenantSubmissionLimit',
    pattern: /async function compensateTenantSubmissionLimit\([\s\S]*?\n\}\s*/
  },
];

for (const fn of functionsToRemove) {
  const before = content.length;
  content = content.replace(fn.pattern, '');
  const after = content.length;
  if (before !== after) {
    console.log(`Removido: ${fn.name} (${before - after} chars)`);
  } else {
    console.log(`NÃO ENCONTRADO: ${fn.name}`);
  }
}

fs.writeFileSync(filePath, content);
console.log('Arquivo atualizado com sucesso!');
