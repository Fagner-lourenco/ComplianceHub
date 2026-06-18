/**
 * repair-madero-cases-after-overwrite.cjs
 *
 * Repara os 95 documentos sobrescritos pelo script de correcao de vereditos.
 * O erro original foi PATCH REST sem updateMask, que removeu campos de listagem
 * como tenantId, status, createdAt e candidateName.
 *
 * Fonte de restauracao: results/escavador2-audit-madero-br/cases/{caseId}.json
 * Mantem os campos de veredito/narrativas que ja ficaram no Firestore.
 *
 * Uso:
 *   node scripts/repair-madero-cases-after-overwrite.cjs --dry-run
 *   node scripts/repair-madero-cases-after-overwrite.cjs --apply --yes
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const TENANT_ID = 'madero-br';
const TENANT_NAME = 'Madero';
const OUTPUT_DIR = path.join(__dirname, '..', 'results', 'escavador2-audit-madero-br');
const CASES_DIR = path.join(OUTPUT_DIR, 'cases');
const PLAN_PATH = path.join(OUTPUT_DIR, 'correction-plan.json');
const REPORT_PATH = path.join(OUTPUT_DIR, 'repair-overwrite-report.json');
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const YES = args.has('--yes');
const DRY_RUN = args.has('--dry-run') || !APPLY;

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) throw new Error('Refresh token nao encontrado no Firebase CLI config.');

  const postData = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: FIREBASE_CLI_CLIENT_ID,
    client_secret: FIREBASE_CLI_CLIENT_SECRET,
  }).toString();
  const res = await httpsRequest({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, postData);
  if (res.status !== 200) throw new Error('Falha ao renovar access token: ' + JSON.stringify(res.body));
  return res.body.access_token;
}

function fromFirestoreValue(value) {
  if (!value) return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if (value.mapValue) {
    const result = {};
    for (const [key, child] of Object.entries(value.mapValue.fields || {})) {
      result[key] = fromFirestoreValue(child);
    }
    return result;
  }
  return null;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') {
    const fields = {};
    for (const [key, child] of Object.entries(value)) fields[key] = toFirestoreValue(child);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

async function firestoreGet(token, docPath, maskFields = []) {
  const mask = maskFields.length
    ? '?' + maskFields.map((field) => `mask.fieldPaths=${encodeURIComponent(field)}`).join('&')
    : '';
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}${mask}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error(`Falha ao buscar ${docPath}: ${res.status} ${JSON.stringify(res.body)}`);
  const data = {};
  for (const [key, value] of Object.entries(res.body.fields || {})) data[key] = fromFirestoreValue(value);
  return data;
}

async function firestorePatch(token, docPath, fields) {
  const keys = Object.keys(fields).filter((key) => fields[key] !== undefined);
  if (!keys.length) return null;
  const payload = { fields: {} };
  for (const key of keys) payload.fields[key] = toFirestoreValue(fields[key]);
  const updateMask = keys.map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&');
  const body = JSON.stringify(payload);
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}?${updateMask}`,
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (res.status !== 200) throw new Error(`Falha ao atualizar ${docPath}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

function formatDateKey(iso) {
  return String(iso || '').slice(0, 10) || null;
}

function formatMonthKey(iso) {
  return String(iso || '').slice(0, 7) || null;
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

function loadRepairItems() {
  const plan = Object.values(JSON.parse(fs.readFileSync(PLAN_PATH, 'utf-8')));
  return plan.map((item) => {
    const filePath = path.join(CASES_DIR, `${item.caseId}.json`);
    if (!fs.existsSync(filePath)) throw new Error(`Snapshot local ausente: ${filePath}`);
    const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const meta = snapshot.caseMeta || {};
    const caseData = snapshot.caseData || {};
    return { item, meta, caseData };
  });
}

function buildCaseRepairFields({ item, meta, caseData }, currentCase = {}) {
  return compact({
    tenantId: TENANT_ID,
    tenantName: currentCase.tenantName || TENANT_NAME,
    caseNumber: meta.caseNumber || currentCase.caseNumber || null,
    requestId: meta.requestId || currentCase.requestId || null,
    candidateName: meta.candidateName || caseData.candidateName || item.candidateName,
    cpf: meta.cpf || caseData.cpf || item.cpf || null,
    cpfMasked: meta.cpfMasked || currentCase.cpfMasked || null,
    status: meta.status || 'DONE',
    createdAt: meta.createdAt,
    concludedAt: meta.concludedAt || currentCase.concludedAt || null,
    reportReady: true,
    finalVerdict: currentCase.finalVerdict || item.proposedVerdict || meta.finalVerdict,
    criminalFlag: currentCase.criminalFlag || item.flags?.criminalFlag || meta.criminalFlag,
    laborFlag: currentCase.laborFlag || item.flags?.laborFlag || meta.laborFlag,
    warrantFlag: currentCase.warrantFlag || meta.warrantFlag || 'NEGATIVE',
    riskScore: currentCase.riskScore ?? item.risk?.riskScore ?? meta.riskScore,
    riskLevel: currentCase.riskLevel || item.risk?.riskLevel || meta.riskLevel,
    bigdatacorpEnrichmentStatus: meta.bigdatacorpEnrichmentStatus || currentCase.bigdatacorpEnrichmentStatus || null,
    juditEnrichmentStatus: meta.juditEnrichmentStatus || currentCase.juditEnrichmentStatus || null,
    escavadorEnrichmentStatus: meta.escavadorEnrichmentStatus || currentCase.escavadorEnrichmentStatus || null,
    djenEnrichmentStatus: meta.djenEnrichmentStatus || currentCase.djenEnrichmentStatus || null,
    bigdatacorpProcessos: Array.isArray(caseData.bigdatacorpProcessos) ? caseData.bigdatacorpProcessos : currentCase.bigdatacorpProcessos,
    bigdatacorpActiveWarrants: Array.isArray(caseData.bigdatacorpActiveWarrants) ? caseData.bigdatacorpActiveWarrants : currentCase.bigdatacorpActiveWarrants,
    juditRoleSummary: Array.isArray(caseData.juditRoleSummary) ? caseData.juditRoleSummary : currentCase.juditRoleSummary,
    djenComunicacoes: Array.isArray(caseData.djenComunicacoes) ? caseData.djenComunicacoes : currentCase.djenComunicacoes,
  });
}

function buildClientCaseRepairFields(caseId, caseFields, currentClientCase = {}, currentCase = {}) {
  const createdDateKey = formatDateKey(caseFields.createdAt);
  const createdMonthKey = formatMonthKey(caseFields.createdAt);
  return compact({
    caseId,
    tenantId: TENANT_ID,
    tenantName: currentClientCase.tenantName || caseFields.tenantName || TENANT_NAME,
    candidateName: caseFields.candidateName,
    cpf: caseFields.cpf,
    cpfMasked: caseFields.cpfMasked,
    status: caseFields.status,
    createdAt: caseFields.createdAt,
    createdDateKey,
    createdMonthKey,
    concludedAt: caseFields.concludedAt,
    reportReady: true,
    finalVerdict: caseFields.finalVerdict,
    criminalFlag: caseFields.criminalFlag,
    laborFlag: caseFields.laborFlag,
    warrantFlag: caseFields.warrantFlag,
    riskScore: caseFields.riskScore,
    riskLevel: caseFields.riskLevel,
    statusSummary: currentCase.statusSummary || currentClientCase.statusSummary,
    sourceSummary: currentCase.sourceSummary || currentClientCase.sourceSummary,
    nextSteps: currentCase.nextSteps || currentClientCase.nextSteps,
    timelineEvents: currentCase.timelineEvents || currentClientCase.timelineEvents,
    keyFindings: currentCase.keyFindings || currentClientCase.keyFindings,
    executiveSummary: currentCase.executiveSummary || currentClientCase.executiveSummary,
    criminalNotes: currentCase.criminalNotes || currentClientCase.criminalNotes,
    laborNotes: currentCase.laborNotes || currentClientCase.laborNotes,
    updatedAt: currentCase.updatedAt || currentClientCase.updatedAt || new Date(),
    hasNotes: Boolean(currentCase.analystComment || currentCase.executiveSummary || currentClientCase.hasNotes),
    hasEvidence: Boolean((Array.isArray(currentCase.keyFindings) && currentCase.keyFindings.length) || currentClientCase.hasEvidence),
  });
}

async function main() {
  if (APPLY && !YES) throw new Error('Use --apply --yes para confirmar escrita em producao.');
  const repairItems = loadRepairItems();
  const token = DRY_RUN ? null : await getAccessToken();
  const readToken = token || await getAccessToken();
  const report = { mode: DRY_RUN ? 'dry-run' : 'apply', startedAt: new Date().toISOString(), total: repairItems.length, repaired: [], failed: [], skipped: [] };
  const mask = ['tenantId', 'status', 'createdAt', 'candidateName', 'cpf', 'cpfMasked', 'concludedAt', 'finalVerdict', 'criminalFlag', 'laborFlag', 'warrantFlag', 'riskScore', 'riskLevel', 'statusSummary', 'sourceSummary', 'nextSteps', 'timelineEvents', 'keyFindings', 'executiveSummary', 'criminalNotes', 'laborNotes', 'analystComment', 'updatedAt', 'reportReady'];

  for (let index = 0; index < repairItems.length; index += 1) {
    const entry = repairItems[index];
    const caseId = entry.item.caseId;
    try {
      const currentCase = await firestoreGet(readToken, `cases/${caseId}`, mask);
      const currentClientCase = await firestoreGet(readToken, `clientCases/${caseId}`, mask);
      if (!currentCase) {
        report.skipped.push({ caseId, reason: 'case missing' });
        continue;
      }
      const caseFields = buildCaseRepairFields(entry, currentCase);
      const clientFields = buildClientCaseRepairFields(caseId, caseFields, currentClientCase || {}, currentCase || {});
      const requiredMissing = ['tenantId', 'status', 'createdAt', 'candidateName'].filter((key) => !currentCase[key]);
      console.log(`[${index + 1}/${repairItems.length}] ${caseId} ${caseFields.candidateName} | missing=${requiredMissing.join(',') || 'none'}`);
      if (!DRY_RUN) {
        await firestorePatch(token, `cases/${caseId}`, caseFields);
        await firestorePatch(token, `clientCases/${caseId}`, clientFields);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      report.repaired.push({ caseId, candidateName: caseFields.candidateName, caseFields: Object.keys(caseFields), clientFields: Object.keys(clientFields), requiredMissing });
    } catch (error) {
      report.failed.push({ caseId, error: error.message });
      console.error(`  ERRO ${caseId}: ${error.message}`);
    }
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nRelatorio salvo em ${REPORT_PATH}`);
  console.log(`Modo: ${report.mode} | Reparados: ${report.repaired.length} | Falhas: ${report.failed.length} | Pulados: ${report.skipped.length}`);
  if (DRY_RUN) console.log('Dry-run apenas. Execute com --apply --yes para escrever.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
