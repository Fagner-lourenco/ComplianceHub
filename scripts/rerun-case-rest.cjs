/**
 * rerun-case-rest.cjs
 * Re-triggers the enrichment pipeline for a case by delete + recreate
 * using the Firestore REST API and Firebase CLI stored credentials.
 * No service account key needed — uses the firebase-tools refresh token.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const CASE_ID = process.argv[2];
if (!CASE_ID) {
    console.error('Usage: node rerun-case-rest.cjs <caseId>');
    process.exit(1);
}

// Firebase client credentials (same as Firebase CLI uses)
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

const BASE = `firestore.googleapis.com`;
const DOC_PATH = `projects/${PROJECT_ID}/databases/(default)/documents/cases/${CASE_ID}`;

async function firestoreGet(token, docPath) {
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    return res;
}

async function firestoreDelete(token, docPath) {
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    return res;
}

async function firestorePatch(token, docPath, fields) {
    const body = JSON.stringify({ fields });
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    return res;
}

// Convert Firestore REST format to plain object
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

// Convert plain value to Firestore REST format
function toFirestoreValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
    if (typeof val === 'object') {
        // Preserve timestamp strings as-is
        if (val._seconds !== undefined) return { timestampValue: new Date(val._seconds * 1000).toISOString() };
        const fields = {};
        for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

// Fields to preserve
const PRESERVE_FIELDS = new Set([
    'candidateName', 'cpf', 'cpfMasked', 'candidatePosition', 'hiringUf',
    'tenantId', 'createdBy', 'createdAt', 'requestedBy',
    'enabledPhases', 'notes',
]);

// Fields to strip (enrichment results)
const STRIP_PREFIXES = ['enrichment', 'escavador', 'judit', 'ai', 'gate', 'identity',
    'criminal', 'warrant', 'labor', 'escalat', 'risk', 'finalVerdict', 'analyst',
    'osint', 'social', 'digital', 'conflict'];

function shouldStrip(field) {
    if (PRESERVE_FIELDS.has(field)) return false;
    if (field === 'status' || field === 'updatedAt') return true;
    const lower = field.toLowerCase();
    return STRIP_PREFIXES.some(p => lower.startsWith(p));
}

async function main() {
    console.log(`\nRe-triggering enrichment for case: ${CASE_ID}`);
    console.log('Getting access token from Firebase CLI credentials...');

    const token = await getAccessToken();
    console.log('✓ Access token obtained.');

    // 1. Read current case
    const getRes = await firestoreGet(token, DOC_PATH);
    if (getRes.status !== 200) {
        console.error(`Case not found (HTTP ${getRes.status}):`, getRes.body);
        process.exit(1);
    }

    const fields = getRes.body.fields || {};
    const plain = {};
    for (const [k, v] of Object.entries(fields)) plain[k] = fromFirestoreValue(v);

    console.log(`\nCase found:`);
    console.log(`  Name:   ${plain.candidateName || '?'}`);
    console.log(`  CPF:    ${plain.cpfMasked || plain.cpf || '?'}`);
    console.log(`  Tenant: ${plain.tenantId || '?'}`);
    console.log(`  Status: ${plain.status || '?'}`);
    console.log(`  FD:     ${plain.enrichmentStatus || 'none'}`);
    console.log(`  Escav:  ${plain.escavadorEnrichmentStatus || 'none'}`);
    console.log(`  Judit:  ${plain.juditEnrichmentStatus || 'none'}`);

    // 2. Build clean document (only identity fields)
    const cleanFields = {};
    for (const [k, v] of Object.entries(fields)) {
        if (!shouldStrip(k)) {
            cleanFields[k] = v;
        }
    }
    // Set status to PENDING
    cleanFields.status = toFirestoreValue('PENDING');
    cleanFields.updatedAt = { timestampValue: new Date().toISOString() };

    const strippedCount = Object.keys(fields).length - Object.keys(cleanFields).length;
    console.log(`\nWill strip ${strippedCount} enrichment fields, keeping ${Object.keys(cleanFields).length} identity fields.`);

    // 3. Delete subcollections (publicResult, aiCache)
    for (const subcol of ['publicResult', 'aiCache']) {
        const listRes = await httpsRequest({
            hostname: BASE,
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/cases/${CASE_ID}/${subcol}?pageSize=100`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (listRes.status === 200 && listRes.body.documents) {
            for (const doc of listRes.body.documents) {
                const delRes = await firestoreDelete(token, doc.name.split('/documents/')[1]);
                console.log(`  Deleted subcol doc: ${subcol}/${doc.name.split('/').pop()} (${delRes.status})`);
            }
        }
    }

    // 4. Delete the case document
    const delRes = await firestoreDelete(token, DOC_PATH);
    if (delRes.status !== 200) {
        console.error(`Delete failed (HTTP ${delRes.status}):`, delRes.body);
        process.exit(1);
    }
    console.log(`✓ Deleted case ${CASE_ID}.`);

    // 5. Wait a moment, then recreate with same ID to trigger onDocumentCreated
    await new Promise(r => setTimeout(r, 1500));

    const createRes = await firestorePatch(token, DOC_PATH, cleanFields);
    if (createRes.status !== 200) {
        console.error(`Recreate failed (HTTP ${createRes.status}):`, createRes.body);
        process.exit(1);
    }
    console.log(`✓ Recreated case ${CASE_ID} with status PENDING.`);
    console.log(`\n✅ Pipeline re-triggered. FonteData → Escavador → Judit → AI will run automatically.`);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
