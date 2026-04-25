/**
 * read-case-results.cjs
 * Reads prefillNarratives and deterministicPrefill from Firestore for validation.
 * Usage: node scripts/read-case-results.cjs <caseId1> [caseId2] ...
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const CASE_IDS = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!CASE_IDS.length) {
  console.error('Usage: node scripts/read-case-results.cjs <caseId1> [caseId2] ...');
  process.exit(1);
}

const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
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
  const refreshToken = config.tokens.refresh_token;
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
  }, postData);
  if (res.status !== 200) throw new Error(`Token refresh failed: ${JSON.stringify(res.body)}`);
  return res.body.access_token;
}

function fromFirestoreValue(val) {
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.nullValue !== undefined) return null;
  if (val.arrayValue) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if (val.mapValue) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = fromFirestoreValue(v);
    return obj;
  }
  return null;
}

async function readCase(token, caseId) {
  const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/cases/${caseId}`;
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/${docPath}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (res.status !== 200) return { error: res.status, body: res.body };
  const fields = res.body.fields || {};
  const data = {};
  for (const [k, v] of Object.entries(fields)) data[k] = fromFirestoreValue(v);
  return data;
}

function truncate(s, max = 2000) {
  if (!s) return '(vazio)';
  if (typeof s !== 'string') return JSON.stringify(s).slice(0, max);
  return s.length > max ? s.slice(0, max) + '...' : s;
}

(async () => {
  const token = await getAccessToken();
  for (const caseId of CASE_IDS) {
    const d = await readCase(token, caseId);
    if (d.error) { console.log(`=== ${caseId}: ERROR ${d.error} ===\n`); continue; }
    
    const name = d.fullName || d.name || caseId;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CASO: ${name} (${caseId})`);
    console.log(`${'='.repeat(80)}`);
    console.log(`status: ${d.status}`);
    console.log(`enrichmentStatus: ${d.enrichmentStatus}`);
    console.log(`escavadorEnrichmentStatus: ${d.escavadorEnrichmentStatus}`);
    console.log(`juditEnrichmentStatus: ${d.juditEnrichmentStatus}`);
    console.log(`criminalFlag: ${d.criminalFlag}`);
    console.log(`laborFlag: ${d.laborFlag}`);
    console.log(`warrantFlag: ${d.warrantFlag}`);
    
    const pn = d.prefillNarratives || {};
    const dp = d.deterministicPrefill || {};
    
    console.log(`\n--- prefillNarratives.metadata ---`);
    console.log(JSON.stringify(pn.metadata || '(sem metadata)', null, 2));
    
    console.log(`\n--- deterministicPrefill.metadata ---`);
    console.log(JSON.stringify(dp.metadata || '(sem metadata)', null, 2));

    const fields = ['criminalNotes', 'laborNotes', 'warrantNotes', 'executiveSummary', 'keyFindings', 'finalJustification'];
    for (const f of fields) {
      console.log(`\n--- prefillNarratives.${f} ---`);
      console.log(truncate(pn[f], 1500));
    }
    
    console.log(`\n--- deterministicPrefill.keyFindings ---`);
    console.log(truncate(JSON.stringify(dp.keyFindings), 600));
    
    // Structured data dump for audit
    if (process.argv.includes('--full')) {
      const structFields = [
        'escavadorProcessos', 'escavadorProcessTotal', 'escavadorCriminalCount', 'escavadorCriminalFlag',
        'escavadorActiveCount', 'escavadorNotes', 'escavadorSources', 'escavadorHomonymFlag',
        'juditRoleSummary', 'juditProcessTotal', 'juditCriminalCount', 'juditCriminalFlag',
        'juditActiveCount','juditNotes','juditWarrantNotes','juditActiveWarrantCount',
        'juditWarrants', 'juditExecutionNotes',
        'bigdatacorpWarrants', 'bigdatacorpWarrantCount', 'bigdatacorpActiveWarrantCount',
        'bigdatacorpCriminalFlag', 'bigdatacorpLaborFlag', 'bigdatacorpCriminalProcesses',
        'bigdatacorpLaborProcesses','bigdatacorpSanctions','bigdatacorpSanctionFlag',
        'fontedataLaborFlag','fontedataProcessos','fontedataCriminalFlag',
        'relevantCriminalCandidates','relevantLaborCandidates','relevantWarrantCandidates',
        'criminalEvidenceQuality','criminalSeverity','coverageLevel','providerDivergence',
        'coverageNotes','riskScore','riskLevel','sanctionFlag','sanctionNotes',
        'autoClassifiedAt','criminalNotes','laborNotes','warrantNotes',
      ];
      for (const sf of structFields) {
        if (d[sf] !== undefined && d[sf] !== null) {
          console.log(`\n--- ${sf} ---`);
          if (typeof d[sf] === 'object') console.log(JSON.stringify(d[sf], null, 2).slice(0, 3000));
          else console.log(String(d[sf]).slice(0, 1000));
        }
      }
    }
    
    // Debug fields for failed cases
    if (!pn.metadata) {
      console.log(`\n--- DEBUG: ALL FIELDS ---`);
      const allKeys = Object.keys(d).sort();
      for (const k of allKeys) {
        const v = d[k];
        const display = typeof v === 'object' ? JSON.stringify(v).slice(0, 100) : String(v).slice(0, 100);
        console.log(`  ${k}: ${display}`);
      }
    }
  }
  process.exit(0);
})();
