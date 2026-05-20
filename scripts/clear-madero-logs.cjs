/**
 * clear-madero-logs.cjs
 * Limpa os logs (auditLogs e tenantAuditLogs) da franquia Madero (tenantId: madero-br).
 * Usage: node scripts/clear-madero-logs.cjs [--confirm]
 *   Without --confirm: dry-run (mostra quantos logs seriam deletados)
 *   With --confirm: executa a exclusao
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const TENANT_ID = 'madero-br';
const CONFIRM = process.argv.includes('--confirm');

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

async function runQuery(token, structuredQuery) {
    const body = JSON.stringify({ structuredQuery });
    const res = await httpsRequest({
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    if (res.status !== 200) {
        throw new Error(`Query failed (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
    }
    return res.body;
}

async function deleteDoc(token, docPath) {
    const res = await httpsRequest({
        hostname: 'firestore.googleapis.com',
        path: `/v1/${docPath}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    return res.status;
}

async function deleteLogsFromCollection(token, collectionId, tenantId) {
    const structuredQuery = {
        from: [{ collectionId }],
        where: {
            fieldFilter: {
                field: { fieldPath: 'tenantId' },
                op: 'EQUAL',
                value: { stringValue: tenantId },
            },
        },
        limit: { value: 500 },
    };

    const results = await runQuery(token, structuredQuery);
    const docsToDelete = [];

    for (const item of results) {
        if (item.document && item.document.name) {
            docsToDelete.push(item.document.name);
        }
    }

    console.log(`  ${collectionId}: ${docsToDelete.length} documento(s) encontrado(s)`);

    if (!CONFIRM) {
        for (const docName of docsToDelete) {
            console.log(`    [DRY-RUN] Deletaria: ${docName.split('/').pop()}`);
        }
        return docsToDelete.length;
    }

    let deleted = 0;
    for (const docName of docsToDelete) {
        const status = await deleteDoc(token, docName);
        if (status === 200 || status === 204) {
            deleted++;
            console.log(`    ✅ Deletado: ${docName.split('/').pop()}`);
        } else {
            console.log(`    ❌ Falha (HTTP ${status}): ${docName.split('/').pop()}`);
        }
    }
    return deleted;
}

async function main() {
    console.log('=== Limpar Logs da Franquia Madero ===');
    console.log(`Tenant ID: ${TENANT_ID}`);
    console.log(`Modo: ${CONFIRM ? '⚠️  EXECUTANDO (--confirm)' : '🔍 DRY-RUN (sem --confirm)'}`);
    console.log('');

    const token = await getAccessToken();
    console.log('Token OK.\n');

    const collections = ['auditLogs', 'tenantAuditLogs'];
    let totalFound = 0;
    let totalDeleted = 0;

    for (const collectionId of collections) {
        console.log(`📁 Coleção: ${collectionId}`);
        const count = await deleteLogsFromCollection(token, collectionId, TENANT_ID);
        totalFound += count;
        if (CONFIRM) totalDeleted += count;
        console.log('');
    }

    if (CONFIRM) {
        console.log(`✅ Total deletado: ${totalDeleted} log(s) da franquia ${TENANT_ID}.`);
    } else {
        console.log(`🔍 Total encontrado: ${totalFound} log(s) da franquia ${TENANT_ID}.`);
        console.log(`\nPara executar a exclusao, rode:`);
        console.log(`  node scripts/clear-madero-logs.cjs --confirm`);
    }
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
