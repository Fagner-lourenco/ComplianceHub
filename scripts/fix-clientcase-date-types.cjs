/**
 * fix-clientcase-date-types.cjs
 *
 * Converte campos de data armazenados como `stringValue` (ISO 8601) em
 * `timestampValue` (Firestore nativo) nas colecoes `clientCases` e `cases`
 * para o tenant `madero-br`. O script NAO altera nenhum outro campo.
 *
 * Uso:
 *   node scripts/fix-clientcase-date-types.cjs --dry-run            (padrao)
 *   node scripts/fix-clientcase-date-types.cjs --apply --yes
 *
 * Por seguranca:
 *   - GET usa `mask.fieldPaths` limitado aos 3 campos de data.
 *   - PATCH usa `updateMask.fieldPaths` identico ao payload.
 *   - Apenas docs com string dates em `createdAt|updatedAt|concludedAt` sao tocados.
 *   - O payload de PATCH contem EXATAMENTE os campos de data; nada mais.
 *   - 5 documentos corrompidos (`.fieldPaths=*`) sao deletados por ID hardcoded.
 */

'use strict';

const DATE_FIELDS = ['createdAt', 'updatedAt', 'concludedAt'];

const CORRUPTED_DOC_IDS = [
    '.fieldPaths=candidateName',
    '.fieldPaths=name',
    '.fieldPaths=status',
    '.fieldPaths=status&updateMask.fieldPaths=bigdatacorpEnrichmentStatus',
    '.fieldPaths=status&updateMask.fieldPaths=correctionReason&updateMask.fieldPaths=bigdatacorpEnrichmentStatus',
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * @param {{stringValue?: string} | null | undefined} fv Firestore field value shape
 * @returns {boolean} true only if fv has a stringValue that matches ISO 8601 UTC and parses to a real Date
 */
function isStringIsoDate(fv) {
    if (!fv || typeof fv !== 'object') return false;
    if (typeof fv.stringValue !== 'string') return false;
    if (!ISO_DATE_RE.test(fv.stringValue)) return false;
    const ms = Date.parse(fv.stringValue);
    return Number.isFinite(ms);
}

/**
 * @param {Record<string, any> | null | undefined} fields Firestore field map (typically from a masked GET)
 * @returns {Record<string, {timestampValue: string}>} payload with ONLY the 3 date fields that are string-typed
 *          ISO 8601 dates. Empty object if nothing to fix. NEVER includes non-date fields.
 */
function buildFixPayload(fields) {
    const payload = {};
    for (const key of DATE_FIELDS) {
        const fv = fields?.[key];
        if (isStringIsoDate(fv)) {
            payload[key] = { timestampValue: fv.stringValue };
        }
    }
    return payload;
}

/**
 * @param {string[]} fieldNames Firestore field paths to update
 * @returns {string} URL query string with `updateMask.fieldPaths=NAME` per field, URL-encoded
 */
function buildUpdateMask(fieldNames) {
    return fieldNames
        .map((name) => `updateMask.fieldPaths=${encodeURIComponent(name)}`)
        .join('&');
}

module.exports = {
    DATE_FIELDS,
    CORRUPTED_DOC_IDS,
    ISO_DATE_RE,
    isStringIsoDate,
    buildFixPayload,
    buildUpdateMask,
};

const path = require('path');
const fs = require('fs');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const TARGET_TENANT = 'madero-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const PAGE_SIZE = 50;
const RATE_LIMIT_MS = 100;
const REPORT_PATH = path.join(__dirname, '..', 'results', 'fix-clientcase-date-types-report.json');

const APPLY = process.argv.includes('--apply');
const YES = process.argv.includes('--yes');
const DRY_RUN = !APPLY;
const FILTER_TENANT = process.argv
    .find((a) => a.startsWith('--tenant='))
    ?.slice('--tenant='.length) || TARGET_TENANT;

function httpsRequest({ hostname, path: reqPath, method, headers }, body) {
    return new Promise((resolve, reject) => {
        const req = https.request({ hostname, path: reqPath, method, headers }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                let parsed = raw;
                try { parsed = JSON.parse(raw); } catch (_) { /* keep raw */ }
                resolve({ status: res.statusCode, body: parsed });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getAccessToken() {
    const configPath = path.join(process.env.USERPROFILE || process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const refreshToken = config?.tokens?.refresh_token;
    if (!refreshToken) throw new Error('Refresh token nao encontrado em firebase-tools.json. Rode `firebase login` primeiro.');
    const postData =
        'grant_type=refresh_token&' +
        `refresh_token=${encodeURIComponent(refreshToken)}&` +
        `client_id=${encodeURIComponent(FIREBASE_CLI_CLIENT_ID)}&` +
        `client_secret=${encodeURIComponent(FIREBASE_CLI_CLIENT_SECRET)}`;
    const res = await httpsRequest({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    }, postData);
    if (res.status !== 200) throw new Error('Falha ao obter access token: ' + JSON.stringify(res.body));
    return res.body.access_token;
}

function makeRestBaseUrl() {
    return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
}

async function listCollectionPage(token, collectionId, pageToken) {
    const url = new URL(`${makeRestBaseUrl()}/${collectionId}`);
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await httpsRequest({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) throw new Error(`Falha listando ${collectionId}: ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
    return res.body || {};
}

async function getDocWithMask(token, docPath, fields) {
    const url = new URL(`${makeRestBaseUrl()}/${docPath}`);
    for (const f of fields) url.searchParams.append('mask.fieldPaths', f);
    const res = await httpsRequest({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return null;
    if (res.status !== 200) throw new Error(`Falha GET ${docPath}: ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
    return res.body;
}

async function patchDoc(token, docPath, payload) {
    const fieldNames = Object.keys(payload);
    const mask = buildUpdateMask(fieldNames);
    const url = new URL(`${makeRestBaseUrl()}/${docPath}`);
    if (mask) url.search = '?' + mask;
    const body = JSON.stringify({ fields: payload });
    const res = await httpsRequest({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    return res;
}

async function deleteDoc(token, docPath) {
    const url = new URL(`${makeRestBaseUrl()}/${docPath}`);
    const res = await httpsRequest({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    return res;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function scanClientCases(token, tenantId, onDoc) {
    let pageToken = null;
    let scanned = 0;
    let pages = 0;
    do {
        const body = await listCollectionPage(token, 'clientCases', pageToken);
        pages += 1;
        const docs = body.documents || [];
        for (const doc of docs) {
            scanned += 1;
            const id = doc.name.split('/').pop();
            if (CORRUPTED_DOC_IDS.includes(id)) {
                await onDoc({ id, doc, isCorrupted: true });
                continue;
            }
            if (tenantId) {
                const t = doc.fields?.tenantId?.stringValue;
                if (t !== tenantId) continue;
            }
            await onDoc({ id, doc, isCorrupted: false });
        }
        pageToken = body.nextPageToken || null;
    } while (pageToken);
    return { scanned, pages };
}

async function run() {
    console.log(`[fix-clientcase-date-types] mode=${DRY_RUN ? 'dry-run' : 'apply'} tenant=${FILTER_TENANT}`);
    if (APPLY && !YES) {
        console.error('ERRO: --apply requer --yes. Abortando.');
        process.exit(2);
    }
    const token = await getAccessToken();
    const report = {
        startedAt: new Date().toISOString(),
        mode: DRY_RUN ? 'dry-run' : 'apply',
        tenant: FILTER_TENANT,
        scanned: 0,
        clientCasesConverted: 0,
        clientCasesSkipped: 0,
        clientCasesFailed: 0,
        casesConverted: 0,
        casesSkipped: 0,
        casesFailed: 0,
        corruptedDeleted: 0,
        corruptedFailed: 0,
        samples: [],
        errors: [],
        finishedAt: null,
    };

    const onDoc = async ({ id, doc, isCorrupted }) => {
        if (isCorrupted) {
            try {
                if (!DRY_RUN) {
                    const res = await deleteDoc(token, `clientCases/${id}`);
                    if (res.status === 200 || res.status === 404) {
                        report.corruptedDeleted += 1;
                        console.log(`[deleted] clientCases/${id}`);
                    } else {
                        throw new Error(`status ${res.status}`);
                    }
                } else {
                    report.corruptedDeleted += 1;
                    console.log(`[dry-run delete] clientCases/${id}`);
                }
            } catch (e) {
                report.corruptedFailed += 1;
                report.errors.push({ kind: 'delete', id, error: e.message });
            }
            await sleep(RATE_LIMIT_MS);
            return;
        }
        const masked = await getDocWithMask(token, `clientCases/${id}`, DATE_FIELDS);
        if (!masked) {
            report.clientCasesSkipped += 1;
            return;
        }
        const payload = buildFixPayload(masked.fields || {});
        if (Object.keys(payload).length === 0) {
            report.clientCasesSkipped += 1;
            return;
        }
        if (report.samples.length < 3) {
            report.samples.push({ id, before: masked.fields, payload });
        }
        if (!DRY_RUN) {
            try {
                const res = await patchDoc(token, `clientCases/${id}`, payload);
                if (res.status !== 200) throw new Error(`status ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
                report.clientCasesConverted += 1;
                console.log(`[clientCases/${id}] converted ${Object.keys(payload).join(',')}`);
            } catch (e) {
                report.clientCasesSkipped += 1;
                report.errors.push({ kind: 'patch-clientCase', id, error: e.message });
            }
        } else {
            report.clientCasesConverted += 1;
            console.log(`[dry-run clientCases/${id}] would convert ${Object.keys(payload).join(',')}`);
        }
        try {
            const casesMasked = await getDocWithMask(token, `cases/${id}`, DATE_FIELDS);
            if (casesMasked) {
                const casesPayload = buildFixPayload(casesMasked.fields || {});
                if (Object.keys(casesPayload).length > 0) {
                    if (!DRY_RUN) {
                        const res = await patchDoc(token, `cases/${id}`, casesPayload);
                        if (res.status !== 200) throw new Error(`status ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
                        report.casesConverted += 1;
                        console.log(`[cases/${id}] converted ${Object.keys(casesPayload).join(',')}`);
                    } else {
                        report.casesConverted += 1;
                        console.log(`[dry-run cases/${id}] would convert ${Object.keys(casesPayload).join(',')}`);
                    }
                } else {
                    report.casesSkipped += 1;
                }
            } else {
                report.casesSkipped += 1;
            }
        } catch (e) {
            report.casesFailed += 1;
            report.errors.push({ kind: 'patch-case', id, error: e.message });
        }
        await sleep(RATE_LIMIT_MS);
    };

    function writeReport() {
        report.finishedAt = new Date().toISOString();
        try {
            fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
            fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
            console.log(`[fix-clientcase-date-types] relatorio salvo em ${REPORT_PATH}`);
        } catch (e) {
            console.warn('Nao foi possivel salvar relatorio:', e.message);
        }
    }

    function printSummary() {
        console.log('\n=== RESUMO ===');
        console.log(`docs escaneados: ${report.scanned}`);
        console.log(`clientCases convertidos: ${report.clientCasesConverted}`);
        console.log(`clientCases pulados: ${report.clientCasesSkipped}`);
        console.log(`clientCases com erro: ${report.clientCasesFailed}`);
        console.log(`cases raiz convertidos: ${report.casesConverted}`);
        console.log(`cases raiz pulados: ${report.casesSkipped}`);
        console.log(`cases raiz com erro: ${report.casesFailed}`);
        console.log(`corrompidos deletados: ${report.corruptedDeleted}`);
        console.log(`corrompidos com erro: ${report.corruptedFailed}`);
        if (report.errors.length) {
            console.log(`\nERROS (${report.errors.length}):`);
            for (const e of report.errors.slice(0, 10)) console.log(' -', e.kind, e.id, e.error);
        }
    }

    try {
        const scan = await scanClientCases(token, FILTER_TENANT, onDoc);
        report.scanned = scan.scanned;
    } finally {
        writeReport();
        printSummary();
    }
}

if (require.main === module) {
    run().catch((e) => {
        console.error('FATAL:', e.message);
        process.exit(1);
    });
}
