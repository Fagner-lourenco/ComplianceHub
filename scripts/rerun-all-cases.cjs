/**
 * rerun-all-cases.cjs
 * Lists all cases in Firestore and re-triggers enrichment for each one.
 * Usage: node scripts/rerun-all-cases.cjs [--confirm]
 *   Without --confirm: dry-run (shows all cases that would be rerun)
 *   With --confirm: actually strips and re-creates each case
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const CONFIRM = process.argv.includes('--confirm');
const DELAY_BETWEEN_CASES_MS = 5000; // 5s between cases to avoid overloading

// Firebase client credentials
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

const BASE = 'firestore.googleapis.com';

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

async function listAllCases(token) {
    const cases = [];
    let pageToken = null;
    do {
        const qs = pageToken ? `?pageSize=100&pageToken=${pageToken}` : '?pageSize=100';
        const res = await httpsRequest({
            hostname: BASE,
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/cases${qs}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.status !== 200) throw new Error(`List failed (${res.status}): ${JSON.stringify(res.body)}`);
        for (const doc of (res.body.documents || [])) {
            const id = doc.name.split('/').pop();
            const fields = doc.fields || {};
            const plain = {};
            for (const [k, v] of Object.entries(fields)) plain[k] = fromFirestoreValue(v);
            cases.push({ id, ...plain });
        }
        pageToken = res.body.nextPageToken || null;
    } while (pageToken);
    return cases;
}

async function main() {
    console.log(`\n========================================`);
    console.log(`  RERUN ALL CASES`);
    console.log(`  Mode: ${CONFIRM ? '⚠️  EXECUTANDO (--confirm)' : '🔍 DRY-RUN'}`);
    console.log(`========================================\n`);

    const token = await getAccessToken();
    console.log('✓ Access token obtained.\n');

    const cases = await listAllCases(token);
    console.log(`Found ${cases.length} case(s) in Firestore:\n`);

    for (let i = 0; i < cases.length; i++) {
        const c = cases[i];
        console.log(`  ${i + 1}. [${c.id}] ${c.candidateName || '?'} — status: ${c.status || '?'} — tenant: ${c.tenantId || '?'}`);
    }

    if (!CONFIRM) {
        console.log(`\n🔍 [DRY-RUN] Nenhuma alteração feita.`);
        console.log(`Para executar de verdade, rode:`);
        console.log(`  node scripts/rerun-all-cases.cjs --confirm\n`);
        console.log(`Isto vai rerun ${cases.length} caso(s) com intervalo de ${DELAY_BETWEEN_CASES_MS / 1000}s entre cada.`);
        return;
    }

    console.log(`\n⚠️  Re-running ${cases.length} case(s)...\n`);

    let success = 0;
    let failed = 0;
    for (let i = 0; i < cases.length; i++) {
        const c = cases[i];
        console.log(`\n--- [${i + 1}/${cases.length}] ${c.candidateName || c.id} ---`);
        try {
            execSync(`node scripts/rerun-case-rest.cjs ${c.id} --confirm`, {
                cwd: path.resolve(__dirname, '..'),
                stdio: 'inherit',
            });
            success++;
        } catch (err) {
            console.error(`  ✗ FAILED: ${err.message}`);
            failed++;
        }
        if (i < cases.length - 1) {
            console.log(`  Waiting ${DELAY_BETWEEN_CASES_MS / 1000}s before next case...`);
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_CASES_MS));
        }
    }

    console.log(`\n========================================`);
    console.log(`  DONE: ${success} succeeded, ${failed} failed`);
    console.log(`========================================\n`);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
