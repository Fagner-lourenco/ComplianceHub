/**
 * clean-madero-all.cjs
 * Limpa TODOS os dados da franquia Madero (tenantId: madero-br)
 * exceto usuarios (userProfiles) e configuracoes (tenantSettings).
 *
 * Deleta: cases, clientCases, candidates, publicReports, auditLogs,
 *         tenantAuditLogs, exports, notifications, caseMessages, tenantUsage
 *
 * Usage: node scripts/clean-madero-all.cjs [--confirm]
 *   Without --confirm: dry-run (mostra o que seria deletado)
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

const BASE = 'firestore.googleapis.com';
const DB = `projects/${PROJECT_ID}/databases/(default)/documents`;
const PAGE_SIZE = 300;

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

async function runQuery(token, collectionId, tenantId) {
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
    const body = JSON.stringify({ structuredQuery });
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${DB}:runQuery`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    if (res.status !== 200) {
        console.error(`  Query failed (HTTP ${res.status}):`, JSON.stringify(res.body).slice(0, 500));
        return [];
    }
    return (res.body || []).filter(item => item.document).map(item => item.document.name);
}

async function listSubcollections(token, docPath) {
    const body = JSON.stringify({});
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}:listCollectionIds`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    if (res.status !== 200) return [];
    return res.body.collectionIds || [];
}

async function listDocsInCollection(token, collectionPath) {
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${collectionPath}?pageSize=${PAGE_SIZE}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status !== 200) return [];
    return (res.body.documents || []).map(d => d.name);
}

async function deleteDoc(token, docPath) {
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    return res.status;
}

async function getDoc(token, docPath) {
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    return res;
}

async function patchDoc(token, docPath, fields) {
    // Build update mask and field values
    const fieldPaths = Object.keys(fields);
    const firestoreFields = {};
    for (const [key, value] of Object.entries(fields)) {
        if (typeof value === 'string') {
            firestoreFields[key] = { stringValue: value };
        } else if (typeof value === 'number') {
            firestoreFields[key] = { integerValue: String(value) };
        } else if (value === null || value === undefined) {
            firestoreFields[key] = { nullValue: null };
        }
    }
    const updateMask = fieldPaths.map(f => `updateMask.fieldPaths=${f}`).join('&');
    const body = JSON.stringify({ fields: firestoreFields });
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}?${updateMask}`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    return res.status;
}

// ── Section: Clean a collection by tenantId ───────────────────────────────────

async function cleanCollection(token, collectionId, label, stats) {
    console.log(`\n📁 ${label} (${collectionId})`);
    const docs = await runQuery(token, collectionId, TENANT_ID);
    stats.found += docs.length;
    console.log(`  ${docs.length} documento(s) encontrado(s)`);

    if (docs.length === 0) return;

    if (!CONFIRM) {
        for (const docName of docs.slice(0, 10)) {
            console.log(`    [DRY-RUN] Deletaria: ${docName.split('/').pop()}`);
        }
        if (docs.length > 10) console.log(`    ... e mais ${docs.length - 10} documento(s)`);
        return;
    }

    let deleted = 0;
    for (const docName of docs) {
        const status = await deleteDoc(token, docName);
        if (status === 200 || status === 204) {
            deleted++;
        } else {
            console.log(`    ❌ Falha (HTTP ${status}): ${docName.split('/').pop()}`);
        }
    }
    stats.deleted += deleted;
    console.log(`    ✅ ${deleted} deletado(s)`);
}

// ── Section: Clean cases with subcollections ──────────────────────────────────

async function cleanCases(token, stats) {
    console.log(`\n📁 CASES com subcolecoes (cases)`);
    const caseDocs = await runQuery(token, 'cases', TENANT_ID);
    stats.found += caseDocs.length;
    console.log(`  ${caseDocs.length} caso(s) encontrado(s)`);

    if (caseDocs.length === 0) return;

    if (!CONFIRM) {
        for (const docName of caseDocs.slice(0, 10)) {
            console.log(`    [DRY-RUN] Caso: ${docName.split('/').pop()}`);
        }
        if (caseDocs.length > 10) console.log(`    ... e mais ${caseDocs.length - 10} caso(s)`);
        return;
    }

    let deletedCases = 0;
    let deletedSubs = 0;

    for (const caseDocPath of caseDocs) {
        const caseId = caseDocPath.split('/').pop();

        // List and delete subcollections first
        const subcols = await listSubcollections(token, caseDocPath);
        for (const colId of subcols) {
            const colPath = `${caseDocPath}/${colId}`;
            const subDocs = await listDocsInCollection(token, colPath);
            for (const subDocPath of subDocs) {
                const status = await deleteDoc(token, subDocPath);
                if (status === 200 || status === 204) {
                    deletedSubs++;
                } else {
                    console.log(`    ❌ Sub-doc falha (HTTP ${status}): ${subDocPath.split('/').pop()}`);
                }
            }
        }

        // Delete the case document itself
        const delStatus = await deleteDoc(token, caseDocPath);
        if (delStatus === 200 || delStatus === 204) {
            deletedCases++;
        } else {
            console.log(`    ❌ Caso falha (HTTP ${delStatus}): ${caseId}`);
        }
    }

    stats.deleted += deletedCases + deletedSubs;
    console.log(`    ✅ ${deletedCases} caso(s) + ${deletedSubs} sub-doc(s) deletados`);
}

// ── Section: Reset tenantUsage counters ───────────────────────────────────────

async function resetTenantUsage(token, stats) {
    console.log(`\n📊 RESET tenantUsage (tenantUsage/${TENANT_ID})`);

    const docPath = `${DB}/tenantUsage/${TENANT_ID}`;
    const res = await getDoc(token, docPath);

    if (res.status === 404) {
        console.log(`  Documento nao existe. Nada a resetar.`);
        return;
    }

    stats.found += 1;

    if (!CONFIRM) {
        console.log(`  [DRY-RUN] Resetaria: dailyCount=0, monthlyCount=0`);
        return;
    }

    const status = await patchDoc(token, docPath, {
        dailyCount: 0,
        monthlyCount: 0,
    });

    if (status === 200) {
        stats.deleted += 1;
        console.log(`  ✅ Contadores zerados`);
    } else {
        console.log(`  ❌ Falha ao resetar (HTTP ${status})`);
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   LIMPEZA TOTAL DA FRANQUIA MADERO           ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║ Tenant ID  : ${TENANT_ID}                  ║`);
    console.log(`║ Modo       : ${CONFIRM ? '⚠️  EXECUTANDO (--confirm)' : '🔍 DRY-RUN (sem --confirm)'}     ║`);
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║ MANTIDOS: userProfiles, tenantSettings       ║');
    console.log('╚══════════════════════════════════════════════╝');

    const token = await getAccessToken();
    console.log('\n🔑 Token OK.\n');

    const stats = { found: 0, deleted: 0 };

    // Phase 1: Non-case collections (leaf data, safe to delete first)
    await cleanCollection(token, 'exports',         'Exportacoes',     stats);
    await cleanCollection(token, 'publicReports',   'Relatorios publicos', stats);
    await cleanCollection(token, 'notifications',   'Notificacoes',    stats);
    await cleanCollection(token, 'caseMessages',    'Mensagens',       stats);

    // Phase 2: Audit logs
    await cleanCollection(token, 'auditLogs',       'Auditoria (ops)',  stats);
    await cleanCollection(token, 'tenantAuditLogs', 'Auditoria (cliente)', stats);

    // Phase 3: Cases (with subcollections) — last to avoid trigger interference
    await cleanCases(token, stats);

    // Phase 4: Candidates (after cases)
    await cleanCollection(token, 'candidates',      'Candidatos',      stats);

    // Phase 5: clientCases (auto-sync may have repopulated; clean again)
    await cleanCollection(token, 'clientCases',     'Client Cases (espelho)', stats);

    // Phase 6: Reset usage counters
    await resetTenantUsage(token, stats);

    // Summary
    console.log('\n╔══════════════════════════════════════╗');
    if (CONFIRM) {
        console.log(`║  ✅ LIMPEZA CONCLUIDA                ║`);
        console.log(`║  ${String(stats.deleted).padStart(4)} documento(s) deletados/zerados    ║`);
    } else {
        console.log(`║  🔍 DRY-RUN CONCLUIDO               ║`);
        console.log(`║  ${String(stats.found).padStart(4)} documento(s) seriam afetados       ║`);
    }
    console.log('╚══════════════════════════════════════╝');
}

main().catch(err => { console.error('\n❌ Erro:', err.message); process.exit(1); });
