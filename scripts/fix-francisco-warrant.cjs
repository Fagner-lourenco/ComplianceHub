/**
 * fix-francisco-warrant.cjs
 * 
 * Fixes Francisco Taciano's case by fetching the warrant data from the
 * ORIGINAL completed Judit request and patching the Firestore document.
 * 
 * The original request (1a110a9e-598c-406e-8793-064dcd3ac474) completed
 * on April 2 and has 1 warrant. The fallback bug caused it to be written
 * as NEGATIVE because the request was still pending when the fallback ran.
 *
 * Usage: node scripts/fix-francisco-warrant.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const CASE_ID = 'o70PElyraor9PXdDrKoX';
const JUDIT_REQUEST_ID = '1a110a9e-598c-406e-8793-064dcd3ac474';
const JUDIT_API_KEY = '99884e54-16dd-4aea-85a9-70a7b0721767';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

// Import normalizer (pure function, no side effects)
const { normalizeJuditWarrants } = require('../functions/normalizers/judit.js');

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

async function fetchJuditResponses(requestId, apiKey) {
    const res = await httpsRequest({
        hostname: 'requests.prod.judit.io',
        path: `/responses?request_id=${requestId}&page=1&page_size=100`,
        method: 'GET',
        headers: { 'api-key': apiKey, 'Accept': 'application/json' },
    });
    if (res.status !== 200) throw new Error(`Judit responses API error: HTTP ${res.status}`);
    return res.body.page_data || [];
}

function toFirestoreValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
    if (typeof val === 'object') {
        const fields = {};
        for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
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

const BASE_HOST = 'firestore.googleapis.com';
const DOC_PATH = `projects/${PROJECT_ID}/databases/(default)/documents/cases/${CASE_ID}`;

async function main() {
    console.log('=== Fix Francisco Warrant ===\n');

    // 1. Get access token
    console.log('Getting Firebase access token...');
    const token = await getAccessToken();
    console.log('✓ Token obtained.\n');

    // 2. Read current case
    console.log('Reading current case data...');
    const getRes = await httpsRequest({
        hostname: BASE_HOST,
        path: `/v1/${DOC_PATH}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (getRes.status !== 200) {
        console.error(`Case not found (HTTP ${getRes.status}):`, getRes.body);
        process.exit(1);
    }

    const fields = getRes.body.fields || {};
    console.log(`  Name:           ${fromFirestoreValue(fields.candidateName || {})}`);
    console.log(`  CPF:            ${fromFirestoreValue(fields.cpfMasked || fields.cpf || {})}`);
    console.log(`  Status:         ${fromFirestoreValue(fields.status || {})}`);
    console.log(`  Judit Status:   ${fromFirestoreValue(fields.juditEnrichmentStatus || {})}`);
    console.log(`  Warrant Flag:   ${fromFirestoreValue(fields.juditWarrantFlag || {})}`);
    console.log(`  Warrant Count:  ${fromFirestoreValue(fields.juditWarrantCount || {})}`);
    console.log(`  Warrant Notes:  ${fromFirestoreValue(fields.juditWarrantNotes || {})}`);
    console.log();

    // 3. Fetch warrant data from original Judit request
    console.log(`Fetching warrant responses from Judit request ${JUDIT_REQUEST_ID}...`);
    const items = await fetchJuditResponses(JUDIT_REQUEST_ID, JUDIT_API_KEY);
    console.log(`✓ Got ${items.length} warrant item(s).\n`);

    if (items.length === 0) {
        console.error('No warrant data returned from Judit. Aborting.');
        process.exit(1);
    }

    // 4. Normalize the warrant data
    const normalized = normalizeJuditWarrants(items);
    const { _source, ...warrantFields } = normalized;

    console.log('Normalized warrant data:');
    console.log(`  Flag:           ${warrantFields.juditWarrantFlag}`);
    console.log(`  Count:          ${warrantFields.juditWarrantCount}`);
    console.log(`  Active Count:   ${warrantFields.juditActiveWarrantCount}`);
    console.log(`  Notes:          ${warrantFields.juditWarrantNotes}`);
    console.log();

    // 5. Build Firestore update payload
    const updatePayload = {};
    for (const [key, value] of Object.entries(warrantFields)) {
        if (value !== undefined && value !== null) {
            updatePayload[key] = toFirestoreValue(value);
        }
    }
    // Update the source metadata
    updatePayload['juditSources'] = fields.juditSources || { mapValue: { fields: {} } };
    // Merge warrant source into existing juditSources
    const existingSources = updatePayload['juditSources']?.mapValue?.fields || {};
    existingSources.warrant = toFirestoreValue({
        ..._source,
        fixedAt: new Date().toISOString(),
        fixReason: 'Fallback bug: processed empty responses from pending request as NEGATIVE',
    });
    updatePayload['juditSources'] = { mapValue: { fields: existingSources } };
    updatePayload['updatedAt'] = { timestampValue: new Date().toISOString() };

    // Build updateMask (only update the fields we're changing)
    const updateMask = Object.keys(updatePayload).map(f => `updateMask.fieldPaths=${f}`).join('&');

    console.log('Patching Firestore document...');
    const body = JSON.stringify({ fields: updatePayload });
    const patchRes = await httpsRequest({
        hostname: BASE_HOST,
        path: `/v1/${DOC_PATH}?${updateMask}`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);

    if (patchRes.status !== 200) {
        console.error(`Patch failed (HTTP ${patchRes.status}):`, JSON.stringify(patchRes.body, null, 2));
        process.exit(1);
    }

    console.log('✓ Case patched successfully!\n');

    // 6. Verify
    console.log('Verifying updated case...');
    const verifyRes = await httpsRequest({
        hostname: BASE_HOST,
        path: `/v1/${DOC_PATH}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const verifyFields = verifyRes.body.fields || {};
    console.log(`  Warrant Flag:   ${fromFirestoreValue(verifyFields.juditWarrantFlag || {})}`);
    console.log(`  Warrant Count:  ${fromFirestoreValue(verifyFields.juditWarrantCount || {})}`);
    console.log(`  Active Count:   ${fromFirestoreValue(verifyFields.juditActiveWarrantCount || {})}`);
    console.log(`  Warrant Notes:  ${fromFirestoreValue(verifyFields.juditWarrantNotes || {})}`);
    console.log('\nDone! Francisco\'s warrant data has been corrected.');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
