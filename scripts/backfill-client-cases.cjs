/**
 * backfill-client-cases.cjs
 * Repara todos os documentos clientCases existentes aplicando buildClientCasePayload
 * atualizado (IDENTITY_FIELDS agora sempre sincronizados para casos nÃ£o-DONE).
 *
 * Usage:
 *   node scripts/backfill-client-cases.cjs [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const DRY_RUN = process.argv.includes('--dry-run');
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

function toFV(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(toFV) } };
    if (typeof val === 'object') {
        const fields = {};
        for (const [k, v] of Object.entries(val)) fields[k] = toFV(v);
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

function fromFV(val) {
    if (!val) return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
    if (val.doubleValue !== undefined) return val.doubleValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.timestampValue !== undefined) return val.timestampValue;
    if (val.nullValue !== undefined) return null;
    if (val.arrayValue) return (val.arrayValue.values || []).map(fromFV);
    if (val.mapValue) {
        const obj = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = fromFV(v);
        return obj;
    }
    return null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ field lists (mirror de functions/index.js) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const IDENTITY_FIELDS = [
    'candidateName', 'cpfMasked', 'candidatePosition', 'hiringUf', 'tenantId', 'createdAt',
];

const RESULT_ONLY_FIELDS = [
    'criminalFlag', 'criminalSeverity', 'criminalNotes',
    'laborFlag', 'laborSeverity', 'laborNotes',
    'warrantFlag', 'warrantNotes',
    'osintLevel', 'osintVectors', 'osintNotes',
    'socialStatus', 'socialReasons', 'socialNotes',
    'digitalFlag', 'digitalVectors', 'digitalNotes',
    'conflictInterest', 'conflictNotes',
    'riskScore', 'riskLevel', 'finalVerdict', 'analystComment',
    'enabledPhases',
];

const PUBLIC_RESULT_FIELDS = [...IDENTITY_FIELDS, ...RESULT_ONLY_FIELDS];

const CLIENT_CASE_FIELDS = [
    ...PUBLIC_RESULT_FIELDS,
    'candidateId', 'tenantName', 'status', 'priority',
    'createdDateKey', 'createdMonthKey',
    'concludedAt', 'updatedAt', 'correctedAt',
    'correctionReason', 'correctionNotes', 'correctionRequestedAt', 'correctionRequestedBy',
    'executiveSummary', 'statusSummary', 'sourceSummary',
    'keyFindings', 'nextSteps', 'clientNotes',
    'processHighlights', 'warrantFindings', 'timelineEvents',
    'reportReady', 'reportSlug',
    'hasNotes', 'hasEvidence', 'turnaroundHours',
];

// Build payload fields (Firestore format) preserving original value types
function buildPayloadFields(caseId, rawFields) {
    const status = fromFV(rawFields.status);
    const isConcluded = status === 'DONE';
    const fieldsToSync = isConcluded
        ? CLIENT_CASE_FIELDS
        : CLIENT_CASE_FIELDS.filter((f) => !RESULT_ONLY_FIELDS.includes(f));

    const payload = { caseId: toFV(caseId) };

    for (const field of fieldsToSync) {
        const fv = rawFields[field];
        if (fv && fv.nullValue === undefined) {
            payload[field] = fv; // copy raw Firestore Value (preserves timestamps etc.)
        }
    }

    // Computed fields
    const createdAtFV = rawFields.createdAt;
    if (!payload.createdDateKey && createdAtFV?.timestampValue) {
        const d = new Date(createdAtFV.timestampValue);
        if (!Number.isNaN(d.getTime())) payload.createdDateKey = toFV(d.toISOString().slice(0, 10));
    }
    if (!payload.createdMonthKey && createdAtFV?.timestampValue) {
        const d = new Date(createdAtFV.timestampValue);
        if (!Number.isNaN(d.getTime())) payload.createdMonthKey = toFV(d.toISOString().slice(0, 7));
    }
    if (!payload.reportReady) {
        const reportReadyRaw = fromFV(rawFields.reportReady);
        payload.reportReady = toFV(isConcluded && reportReadyRaw !== false);
    }
    const analystComment = fromFV(rawFields.analystComment);
    const executiveSummary = fromFV(rawFields.executiveSummary);
    const clientNotes = fromFV(rawFields.clientNotes);
    payload.hasNotes = toFV(Boolean(analystComment || executiveSummary || clientNotes));

    const processHighlights = fromFV(rawFields.processHighlights);
    const warrantFindings = fromFV(rawFields.warrantFindings);
    const timelineEvents = fromFV(rawFields.timelineEvents);
    payload.hasEvidence = toFV(Boolean(
        (Array.isArray(processHighlights) && processHighlights.length > 0)
        || (Array.isArray(warrantFindings) && warrantFindings.length > 0)
        || (Array.isArray(timelineEvents) && timelineEvents.some((e) => e.status === 'risk'))
    ));

    return payload;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ REST helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BASE_HOST = 'firestore.googleapis.com';
const DB_PATH = 'projects/' + PROJECT_ID + '/databases/(default)/documents';

async function listCases(token) {
    const docs = [];
    let pageToken = null;
    do {
        const qs = 'pageSize=300' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
        const res = await httpsRequest({
            hostname: BASE_HOST,
            path: '/v1/' + DB_PATH + '/cases?' + qs,
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
        });
        if (res.status !== 200) throw new Error('Erro ao listar cases: ' + JSON.stringify(res.body));
        (res.body.documents || []).forEach((d) => docs.push(d));
        pageToken = res.body.nextPageToken || null;
    } while (pageToken);
    return docs;
}

async function batchWrite(token, writes) {
    const body = JSON.stringify({ writes });
    const res = await httpsRequest({
        hostname: BASE_HOST,
        path: '/v1/' + DB_PATH + ':batchWrite',
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    return res;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function main() {
    console.log('=== Backfill clientCases' + (DRY_RUN ? ' [DRY-RUN]' : '') + ' ===\n');
    const token = await getAccessToken();
    console.log('Token OK. Listando casos...');

    const caseDocs = await listCases(token);
    console.log('Total de casos encontrados: ' + caseDocs.length + '\n');

    const CHUNK = 400;
    let synced = 0;
    let errors = 0;

    for (let i = 0; i < caseDocs.length; i += CHUNK) {
        const chunk = caseDocs.slice(i, i + CHUNK);
        const writes = chunk.map((doc) => {
            const caseId = doc.name.split('/').pop();
            const payloadFields = buildPayloadFields(caseId, doc.fields || {});
            const fieldPaths = Object.keys(payloadFields);
            return {
                update: {
                    name: DB_PATH + '/clientCases/' + caseId,
                    fields: payloadFields,
                },
                updateMask: { fieldPaths },
            };
        });

        if (DRY_RUN) {
            writes.forEach((w) => {
                const caseId = w.update.name.split('/').pop();
                const f = w.update.fields;
                const tenantId = fromFV(f.tenantId) || 'MISSING';
                const name = fromFV(f.candidateName) || 'MISSING';
                const status = fromFV(f.status) || 'MISSING';
                console.log('  [DRY-RUN] ' + caseId + ' | status=' + status + ' | tenantId=' + tenantId + ' | candidateName=' + name);
                synced += 1;
            });
        } else {
            const res = await batchWrite(token, writes);
            if (res.status !== 200) {
                console.error('  Batch ' + (Math.floor(i / CHUNK) + 1) + ' ERRO:', JSON.stringify(res.body).slice(0, 300));
                errors += chunk.length;
            } else {
                const writeResults = res.body.writeResults || [];
                const statusList = res.body.status || [];
                const batchErrors = statusList.filter((s) => s && s.code && s.code !== 0);
                if (batchErrors.length > 0) {
                    console.error('  Batch ' + (Math.floor(i / CHUNK) + 1) + ': ' + batchErrors.length + ' erros parciais.');
                    errors += batchErrors.length;
                    synced += chunk.length - batchErrors.length;
                } else {
                    console.log('  Batch ' + (Math.floor(i / CHUNK) + 1) + ': ' + chunk.length + ' documentos sincronizados.');
                    synced += chunk.length;
                }
            }
        }
    }

    console.log('\nBackfill concluÃ­do. Sincronizados: ' + synced + ', Erros: ' + errors);
    process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Erro fatal:', err.message); process.exit(1); });

