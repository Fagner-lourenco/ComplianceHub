/**
 * list-cases.cjs
 * Lists all cases from Firestore with key fields for diagnosis.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
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
    if (res.status !== 200) throw new Error('Token refresh failed: ' + JSON.stringify(res.body));
    return res.body.access_token;
}

function fromFirestoreValue(v) {
    if (!v) return null;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.timestampValue !== undefined) return v.timestampValue;
    if (v.nullValue !== undefined) return null;
    if (v.arrayValue) return (v.arrayValue.values || []).map(fromFirestoreValue);
    if (v.mapValue) {
        const obj = {};
        for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = fromFirestoreValue(val);
        return obj;
    }
    return JSON.stringify(v);
}

async function main() {
    const token = await getAccessToken();
    
    const res = await httpsRequest({
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/cases?pageSize=100`,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status !== 200) {
        console.error('Failed:', res.body);
        process.exit(1);
    }

    const docs = res.body.documents || [];
    console.log(`\n📋 ${docs.length} cases found.\n`);

    const KEY_FIELDS = [
        'candidateName', 'cpfMasked', 'cpf', 'status', 'tenantId',
        'riskScore', 'riskLevel', 'finalVerdict',
        'criminalFlag', 'criminalSeverity', 'criminalNotes',
        'laborFlag', 'laborSeverity', 'laborNotes',
        'warrantFlag', 'warrantNotes',
        'analystComment', 'executiveSummary',
        'publicReportToken', 'concludedAt',
        'enrichmentStatus', 'escavadorEnrichmentStatus', 'juditEnrichmentStatus',
        'keyFindings', 'enabledPhases',
    ];

    for (const doc of docs) {
        const id = doc.name.split('/').pop();
        const fields = doc.fields || {};
        const plain = {};
        for (const [k, v] of Object.entries(fields)) plain[k] = fromFirestoreValue(v);

        console.log(`═══════════════════════════════════════════`);
        console.log(`📌 Case ID: ${id}`);
        console.log(`   Name:     ${plain.candidateName || '?'}`);
        console.log(`   CPF:      ${plain.cpfMasked || plain.cpf || '?'}`);
        console.log(`   Status:   ${plain.status || '?'}`);
        console.log(`   Tenant:   ${plain.tenantId || '?'}`);
        console.log(`   Score:    ${plain.riskScore ?? 'N/A'} | Level: ${plain.riskLevel || 'N/A'} | Verdict: ${plain.finalVerdict || 'N/A'}`);
        console.log(`   Criminal: ${plain.criminalFlag || 'N/A'} (sev: ${plain.criminalSeverity || 'N/A'})`);
        console.log(`   Labor:    ${plain.laborFlag || 'N/A'} (sev: ${plain.laborSeverity || 'N/A'})`);
        console.log(`   Warrant:  ${plain.warrantFlag || 'N/A'}`);
        console.log(`   Analyst:  ${(plain.analystComment || '').substring(0, 80) || 'N/A'}`);
        console.log(`   Token:    ${plain.publicReportToken || 'N/A'}`);
        console.log(`   Enrichment: FD=${plain.enrichmentStatus || 'N/A'} ESC=${plain.escavadorEnrichmentStatus || 'N/A'} JUD=${plain.juditEnrichmentStatus || 'N/A'}`);
        
        // Count total fields
        const allKeys = Object.keys(plain);
        const missingKey = KEY_FIELDS.filter(k => plain[k] === undefined || plain[k] === null || plain[k] === '');
        console.log(`   Fields:   ${allKeys.length} total | Missing key fields: ${missingKey.join(', ') || 'none'}`);
        console.log('');
    }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
