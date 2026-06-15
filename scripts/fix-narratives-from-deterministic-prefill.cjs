/**
 * fix-narratives-from-deterministic-prefill.cjs
 *
 * Corrige os campos raiz (criminalNotes, laborNotes, executiveSummary, etc.)
 * e prefillNarratives com os valores corretos do deterministicPrefill.
 *
 * O deterministicPrefill foi regenerado com dados limpos de BDC/Judit/DJEN,
 * CNJs desmascarados, e consistente com os flags.
 *
 * ⚠️ REGRAS DE SEGURANCA:
 * 1. PATCH com updateMask explícito — NUNCA sem máscara
 * 2. analystComment, timelineEvents, nextSteps NUNCA são tocados
 * 3. finalVerdict, flags, risco NUNCA são tocados
 * 4. Dry-run obrigatório antes de apply
 *
 * Uso:
 *   node scripts/fix-narratives-from-deterministic-prefill.cjs --dry-run
 *   node scripts/fix-narratives-from-deterministic-prefill.cjs --apply --yes
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const OUTPUT_DIR = path.join(__dirname, '..', 'results', 'escavador2-audit-madero-br');
const PLAN_PATH = path.join(OUTPUT_DIR, 'correction-plan.json');
const REPORT_PATH = path.join(OUTPUT_DIR, 'fix-narratives-report.json');
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const YES = args.has('--yes');
const DRY_RUN = args.has('--dry-run') || !APPLY;

// =============================================================================
// UTILITARIOS HTTP + FIRESTORE REST
// =============================================================================

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

async function firestoreGetCase(token, caseId) {
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/cases/${caseId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error(`Falha ao buscar cases/${caseId}: ${res.status} ${JSON.stringify(res.body)}`);
  const data = {};
  for (const [key, value] of Object.entries(res.body.fields || {})) data[key] = fromFirestoreValue(value);
  return data;
}

async function firestorePatchNarratives(token, caseId, fields) {
  const keys = Object.keys(fields).filter((key) => fields[key] !== undefined);
  if (!keys.length) return null;
  fields.updatedAt = new Date();
  const allKeys = [...new Set([...keys, 'updatedAt'])];
  const payload = { fields: {} };
  for (const key of allKeys) {
    payload.fields[key] = toFirestoreValue(fields[key]);
  }
  const updateMask = allKeys
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join('&');
  const body = JSON.stringify(payload);
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/cases/${caseId}?${updateMask}`,
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (res.status !== 200) throw new Error(`Falha ao atualizar cases/${caseId}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

function buildStatusSummary(verdict) {
  if (verdict === 'NOT_RECOMMENDED') return 'Concluido com indicacao de nao recomendacao.';
  if (verdict === 'ATTENTION') return 'Concluido com pontos de atencao.';
  return 'Concluido.';
}

function buildSourceSummary() {
  return 'Analise automatizada e revisao operacional concluidas.';
}

// =============================================================================
// CAMPO QUE A UI MAIS LE: O prefillNarratives raiz
// =============================================================================

function buildPrefillNarratives(existingPrefill, det) {
  const existingMeta = (existingPrefill && existingPrefill.metadata) ? existingPrefill.metadata : {};
  return {
    criminalNotes: det.criminalNotes || '',
    laborNotes: det.laborNotes || '',
    warrantNotes: det.warrantNotes || '',
    executiveSummary: det.executiveSummary || '',
    keyFindings: det.keyFindings || [],
    finalJustification: det.finalJustification || '',
    metadata: {
      ...existingMeta,
      source: 'deterministic',
      deterministicVersion: (det.metadata && det.metadata.version) || 'v5-deterministic-prefill',
      regeneratedAt: new Date().toISOString(),
    },
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  if (APPLY && !YES) {
    console.error('Use --apply --yes para confirmar escrita em producao.');
    process.exit(1);
  }

  const plan = Object.values(JSON.parse(fs.readFileSync(PLAN_PATH, 'utf-8')));
  const token = DRY_RUN ? null : await getAccessToken();
  const readToken = token || await getAccessToken();

  const report = {
    mode: DRY_RUN ? 'dry-run' : 'apply',
    startedAt: new Date().toISOString(),
    total: plan.length,
    fixed: [],
    skipped: [],
    failed: [],
  };

  for (let index = 0; index < plan.length; index += 1) {
    const item = plan[index];
    const caseId = item.caseId;
    const name = item.candidateName || '?';

    try {
      const caseData = await firestoreGetCase(readToken, caseId);
      if (!caseData) {
        report.skipped.push({ caseId, name, reason: 'case not found' });
        console.log(`[${index + 1}/${plan.length}] ${caseId} ${name} SKIPPED: not found`);
        continue;
      }

      const det = caseData.deterministicPrefill;
      if (!det || !det.criminalNotes) {
        report.skipped.push({ caseId, name, reason: 'deterministicPrefill missing or empty' });
        console.log(`[${index + 1}/${plan.length}] ${caseId} ${name} SKIPPED: no deterministicPrefill`);
        continue;
      }

      const verdict = caseData.finalVerdict || item.proposedVerdict || 'FIT';
      const criminalFlag = caseData.criminalFlag || '?';
      const laborFlag = caseData.laborFlag || '?';

      const payload = {
        criminalNotes: det.criminalNotes,
        laborNotes: det.laborNotes,
        warrantNotes: det.warrantNotes || '',
        executiveSummary: det.executiveSummary,
        keyFindings: det.keyFindings || [],
        finalJustification: det.finalJustification || '',
        statusSummary: buildStatusSummary(verdict),
        sourceSummary: buildSourceSummary(),
        prefillNarratives: buildPrefillNarratives(caseData.prefillNarratives, det),
      };

      // Detectar divergências para log
      const crimOld = (caseData.criminalNotes || '').substring(0, 60);
      const crimNew = (det.criminalNotes || '').substring(0, 60);
      const laborOld = (caseData.laborNotes || '').substring(0, 60);
      const laborNew = (det.laborNotes || '').substring(0, 60);
      const changed = (crimOld !== crimNew) || (laborOld !== laborNew);
      const marker = changed ? 'FIX' : 'OK';

      console.log(`[${index + 1}/${plan.length}] ${marker} ${caseId.substring(0, 6)} ${name.padEnd(42)} flags=${criminalFlag}/${laborFlag} v=${verdict}`);

      if (!DRY_RUN) {
        await firestorePatchNarratives(token, caseId, payload);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      report.fixed.push({
        caseId,
        name,
        verdict,
        flags: `${criminalFlag}/${laborFlag}`,
        changed,
        criminalNotesOld: crimOld,
        criminalNotesNew: crimNew,
        laborNotesOld: laborOld,
        laborNotesNew: laborNew,
      });
    } catch (error) {
      report.failed.push({ caseId, name, error: error.message });
      console.error(`[${index + 1}/${plan.length}] ERRO ${caseId} ${name}: ${error.message}`);
    }
  }

  report.finishedAt = new Date().toISOString();
  const changedCount = report.fixed.filter((r) => r.changed).length;
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nRelatorio salvo em ${REPORT_PATH}`);
  console.log(`Modo: ${report.mode} | Corrigidos: ${report.fixed.length} (com mudanca: ${changedCount}) | Falhas: ${report.failed.length} | Pulados: ${report.skipped.length}`);
  if (DRY_RUN) console.log('Dry-run apenas. Execute com --apply --yes para escrever.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
