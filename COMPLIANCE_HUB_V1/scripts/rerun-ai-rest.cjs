/**
 * Force re-run AI analysis by clearing AI cache and triggering re-classify.
 * Uses Firestore REST API with Firebase CLI credentials.
 * Usage: node scripts/rerun-ai-rest.cjs <caseId>
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const CASE_ID = process.argv[2];
if (!CASE_ID || CASE_ID.startsWith('--')) {
    console.error('Usage: node scripts/rerun-ai-rest.cjs <caseId>');
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

const BASE = 'firestore.googleapis.com';
const DOC_PATH = `projects/${PROJECT_ID}/databases/(default)/documents/cases/${CASE_ID}`;

async function main() {
    console.log(`Force re-running AI for case ${CASE_ID}...`);
    const token = await getAccessToken();

    // 1. Delete AI cache docs
    for (const cacheDoc of ['latest', 'homonym', 'report_prefill']) {
        const delRes = await httpsRequest({
            hostname: BASE,
            path: `/v1/${DOC_PATH}/aiCache/${cacheDoc}`,
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        console.log(`  Deleted aiCache/${cacheDoc}: ${delRes.status}`);
    }

    // 2. Reset AI-related fields to force re-analysis
    const resetFields = {
        aiStructured: { nullValue: null },
        aiStructuredOk: { booleanValue: false },
        aiRawResponse: { nullValue: null },
        aiError: { nullValue: null },
        aiFromCache: { booleanValue: false },
        aiHomonymStructured: { nullValue: null },
        aiHomonymStructuredOk: { booleanValue: false },
        aiHomonymRawResponse: { nullValue: null },
        aiHomonymError: { nullValue: null },
        aiHomonymTriggered: { booleanValue: false },
        aiHomonymFromCache: { booleanValue: false },
    };

    // 3. Set a trigger field to force Escavador trigger re-evaluation → auto-classify
    // We use juditNeedsEscavador toggle to re-trigger the enrichEscavadorOnCase function
    // which will then call runAutoClassifyAndAi
    resetFields.updatedAt = { timestampValue: new Date().toISOString() };

    const updateMask = Object.keys(resetFields).map(k => `fields.${k}`).join('&updateMask.fieldPaths=');
    const body = JSON.stringify({ fields: resetFields });

    const patchRes = await httpsRequest({
        hostname: BASE,
        path: `/v1/${DOC_PATH}?updateMask.fieldPaths=${updateMask}`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);

    if (patchRes.status === 200) {
        console.log('✅ AI fields reset. The enrichEscavadorOnCase trigger should fire and re-run auto-classify + AI.');
        console.log('Wait 30-60 seconds, then fetch the case data to verify.');
    } else {
        console.error('PATCH failed:', patchRes.status, JSON.stringify(patchRes.body));
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
