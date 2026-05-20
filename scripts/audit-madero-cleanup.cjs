/**
 * audit-madero-cleanup.cjs
 *
 * Read-only audit for Madero cases affected by the 2026-05 classification/SLA fixes.
 * Lists stale automatic inconclusive narratives and DJEN records stuck behind skipped Escavador.
 *
 * Usage:
 *   node scripts/audit-madero-cleanup.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const TENANT_ID = 'madero-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function httpsRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
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
    const postData = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: config.tokens.refresh_token,
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

    if (res.status !== 200) throw new Error('Token refresh failed: ' + JSON.stringify(res.body));
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

function fromFirestoreDocument(doc) {
    const result = { id: doc.name.split('/').pop() };
    for (const [key, value] of Object.entries(doc.fields || {})) {
        result[key] = fromFirestoreValue(value);
    }
    return result;
}

async function listTenantCases(token) {
    const docs = [];
    let pageToken = null;
    do {
        const query = {
            structuredQuery: {
                from: [{ collectionId: 'cases' }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'tenantId' },
                        op: 'EQUAL',
                        value: { stringValue: TENANT_ID },
                    },
                },
                limit: 300,
            },
        };
        if (pageToken) query.structuredQuery.startAt = { values: [{ stringValue: pageToken }] };

        const body = JSON.stringify(query);
        const res = await httpsRequest({
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        }, body);

        if (res.status !== 200) throw new Error('Erro ao listar cases: ' + JSON.stringify(res.body));
        const batch = (res.body || []).filter((entry) => entry.document).map((entry) => entry.document);
        docs.push(...batch);
        pageToken = null;
    } while (pageToken);

    return docs.map(fromFirestoreDocument);
}

function containsStaleInconclusiveText(value) {
    return /inconclusiv|baixa cobertura|cobertura insuficiente|CRIMINAL_FLAG_INCONCLUSIVE/i.test(JSON.stringify(value || ''));
}

function inspectCase(caseData) {
    const staleFields = [];
    const fieldsToCheck = [
        'criminalNotes',
        'executiveSummary',
        'keyFindings',
        'finalJustification',
        'deterministicPrefill',
        'prefillNarratives',
        'aiStructuredReport',
    ];

    for (const field of fieldsToCheck) {
        if (containsStaleInconclusiveText(caseData[field])) staleFields.push(field);
    }

    const stuckDjen = caseData.status === 'DONE'
        && caseData.djenEnrichmentStatus === 'PENDING'
        && caseData.juditNeedsEscavador === true
        && caseData.escavadorEnrichmentStatus === 'SKIPPED';

    return { staleFields, stuckDjen };
}

async function main() {
    console.log(`Auditando casos ${TENANT_ID} [read-only]...`);
    const token = await getAccessToken();
    const cases = await listTenantCases(token);

    const staleNarratives = [];
    const stuckDjen = [];
    for (const caseData of cases) {
        const result = inspectCase(caseData);
        if (result.staleFields.length > 0) {
            staleNarratives.push({
                id: caseData.id,
                status: caseData.status,
                criminalFlag: caseData.criminalFlag,
                criminalEvidenceQuality: caseData.criminalEvidenceQuality,
                staleFields: result.staleFields,
            });
        }
        if (result.stuckDjen) {
            stuckDjen.push({
                id: caseData.id,
                status: caseData.status,
                djenEnrichmentStatus: caseData.djenEnrichmentStatus,
                escavadorEnrichmentStatus: caseData.escavadorEnrichmentStatus,
            });
        }
    }

    console.log('\nResumo');
    console.log(`- Total casos: ${cases.length}`);
    console.log(`- Narrativas automaticas possivelmente antigas: ${staleNarratives.length}`);
    console.log(`- DJEN pendente apos Escavador SKIPPED: ${stuckDjen.length}`);

    console.log('\nNarrativas antigas');
    console.table(staleNarratives);

    console.log('\nDJEN pendente');
    console.table(stuckDjen);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
