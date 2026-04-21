/**
 * Fetch complete case data from Firestore REST API for analysis.
 * Uses Firebase CLI stored credentials (same approach as rerun-case-rest.cjs).
 * Usage: node scripts/fetch-case-data.cjs <caseId>
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const CASE_ID = process.argv[2];
if (!CASE_ID || CASE_ID.startsWith('--')) {
    console.error('Usage: node scripts/fetch-case-data.cjs <caseId>');
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

function decodeFirestoreValue(val) {
    if (val === undefined || val === null) return null;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return val.doubleValue;
    if ('booleanValue' in val) return val.booleanValue;
    if ('nullValue' in val) return null;
    if ('timestampValue' in val) return val.timestampValue;
    if ('mapValue' in val) return decodeFirestoreDoc(val.mapValue.fields || {});
    if ('arrayValue' in val) return (val.arrayValue.values || []).map(decodeFirestoreValue);
    if ('referenceValue' in val) return val.referenceValue;
    if ('geoPointValue' in val) return val.geoPointValue;
    if ('bytesValue' in val) return val.bytesValue;
    return val;
}

function decodeFirestoreDoc(fields) {
    const result = {};
    for (const [key, val] of Object.entries(fields || {})) {
        result[key] = decodeFirestoreValue(val);
    }
    return result;
}

async function main() {
    console.log(`Fetching case ${CASE_ID}...`);
    console.log('Getting access token from Firebase CLI credentials...');
    const token = await getAccessToken();

    const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/cases/${CASE_ID}`;
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.status !== 200) {
        console.error('Case not found or error:', res.status);
        process.exit(1);
    }

    const data = decodeFirestoreDoc(res.body.fields);

    // Fetch AI cache subcollection
    const aiCacheRes = await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}/aiCache`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });

    const aiCache = {};
    if (aiCacheRes.status === 200 && aiCacheRes.body.documents) {
        for (const doc of aiCacheRes.body.documents) {
            const docName = doc.name.split('/').pop();
            aiCache[docName] = decodeFirestoreDoc(doc.fields);
        }
    }

    const output = {
        _caseId: CASE_ID,
        _fetchedAt: new Date().toISOString(),
        caseData: data,
        aiCache,
    };

    const outPath = path.join(__dirname, '..', 'results', `case_${CASE_ID}.json`);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\nCase data written to: ${outPath}`);
    console.log(`\nStatus: ${data.status}`);
    console.log(`Judit: ${data.juditEnrichmentStatus}`);
    console.log(`Escavador: ${data.escavadorEnrichmentStatus}`);
    console.log(`BigDataCorp: ${data.bigdatacorpEnrichmentStatus}`);
    console.log(`AI: ${data.aiStructuredOk ? 'OK' : 'pending/failed'}`);
    console.log(`AI Homonym: ${data.aiHomonymStructuredOk ? 'OK' : data.aiHomonymTriggered ? 'triggered but not OK' : 'not triggered'}`);
    console.log(`Coverage: ${data.coverageLevel || 'N/A'}`);
    console.log(`Divergence: ${data.providerDivergence || 'N/A'}`);
    console.log(`Criminal: ${data.criminalFlag || 'N/A'}`);
    console.log(`Warrant: ${data.warrantFlag || 'N/A'}`);
    console.log(`Labor: ${data.laborFlag || 'N/A'}`);

    if (data.coverageNotes?.length) {
        console.log(`\nCoverage Notes:`);
        data.coverageNotes.forEach((n) => console.log(`  - ${n}`));
    }
    if (data.ambiguityNotes?.length) {
        console.log(`\nAmbiguity Notes:`);
        data.ambiguityNotes.forEach((n) => console.log(`  - ${n}`));
    }

    if (data.aiHomonymStructured) {
        console.log(`\nHomonym AI:`);
        console.log(`  Decision: ${data.aiHomonymStructured.decision}`);
        console.log(`  Confidence: ${data.aiHomonymStructured.confidence}`);
        console.log(`  Risk: ${data.aiHomonymStructured.homonymRisk}`);
        console.log(`  Justification: ${data.aiHomonymStructured.justification}`);
    }

    if (data.prefillNarratives) {
        console.log(`\nPrefill source: ${data.prefillNarratives.metadata?.source || 'N/A'}`);
    }
}

main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
