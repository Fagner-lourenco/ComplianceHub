/**
 * migrate-case-tenant.cjs
 * Migra um caso concluido de um tenant para outro, atualizando TODOS
 * os documentos relacionados (candidate, publicResult, auditLogs, etc.).
 *
 * Usage: node scripts/migrate-case-tenant.cjs <caseId> <targetTenantId> [--confirm]
 *   Without --confirm: dry-run (mostra o que seria alterado)
 *   With --confirm: executa a migracao
 *
 * Ex: node scripts/migrate-case-tenant.cjs PauZPeOeg4ZkEYILcWZS madero-br --confirm
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const CASE_ID = process.argv[2];
const TARGET_TENANT_ID = process.argv[3];
const CONFIRM = process.argv.includes('--confirm');

if (!CASE_ID || CASE_ID.startsWith('--')) {
    console.error('Usage: node scripts/migrate-case-tenant.cjs <caseId> <targetTenantId> [--confirm]');
    process.exit(1);
}
if (!TARGET_TENANT_ID || TARGET_TENANT_ID.startsWith('--')) {
    console.error('Usage: node scripts/migrate-case-tenant.cjs <caseId> <targetTenantId> [--confirm]');
    process.exit(1);
}

const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const BASE = 'firestore.googleapis.com';
const DB = `projects/${PROJECT_ID}/databases/(default)/documents`;
const CASE_DOC_PATH = `${DB}/cases/${CASE_ID}`;

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

// ── Firestore value decoders ──────────────────────────────────────────────────

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
    return val;
}

function decodeFirestoreDoc(fields) {
    const result = {};
    for (const [key, val] of Object.entries(fields || {})) {
        result[key] = decodeFirestoreValue(val);
    }
    return result;
}

function encodeFirestoreValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'number') {
        if (Number.isInteger(value)) return { integerValue: String(value) };
        return { doubleValue: value };
    }
    if (typeof value === 'boolean') return { booleanValue: value };
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    return { stringValue: String(value) };
}

// ── REST API helpers ──────────────────────────────────────────────────────────

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
    const firestoreFields = {};
    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) continue;
        firestoreFields[key] = encodeFirestoreValue(value);
    }
    if (Object.keys(firestoreFields).length === 0) return { status: 200, changed: false };
    const updateMask = Object.keys(firestoreFields).map(f => `updateMask.fieldPaths=${f}`).join('&');
    const body = JSON.stringify({ fields: firestoreFields });
    return await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}?${updateMask}`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
}

async function listSubcollectionDocs(token, parentPath) {
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${parentPath}?pageSize=300`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status !== 200) return [];
    return (res.body.documents || []).map(d => d.name);
}

async function runQuery(token, collectionId, filterField, filterValue) {
    const structuredQuery = {
        from: [{ collectionId }],
        where: {
            fieldFilter: {
                field: { fieldPath: filterField },
                op: 'EQUAL',
                value: { stringValue: filterValue },
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
    if (res.status !== 200) return [];
    return (res.body || []).filter(item => item.document).map(item => item.document.name);
}

// ── Dry-run / confirm helpers ─────────────────────────────────────────────────

function logPatch(label, docPath, fields) {
    const docId = docPath.split('/').pop();
    const fieldList = Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(', ');
    if (CONFIRM) {
        console.log(`  ✅ ${label}: ${docId}  [${fieldList}]`);
    } else {
        console.log(`  [DRY-RUN] ${label}: ${docId}  →  ${fieldList}`);
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   MIGRACAO DE CASO ENTRE TENANTS             ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║ Case ID     : ${CASE_ID.padEnd(30)}║`);
    console.log(`║ Tenant alvo : ${TARGET_TENANT_ID.padEnd(30)}║`);
    console.log(`║ Modo        : ${CONFIRM ? '⚠️  EXECUTANDO (--confirm)' : '🔍 DRY-RUN (sem --confirm)'}     ║`);
    console.log('╚══════════════════════════════════════════════╝');

    const token = await getAccessToken();
    console.log('\n🔑 Token OK.\n');

    // ── Step 0: Backup ──────────────────────────────────────────────────────
    console.log('━━━ STEP 0: BACKUP ━━━');

    const caseRes = await getDoc(token, CASE_DOC_PATH);
    if (caseRes.status === 404) {
        console.error(`❌ Caso ${CASE_ID} nao encontrado.`);
        process.exit(1);
    }
    if (caseRes.status !== 200) {
        console.error(`❌ Erro ao ler caso (HTTP ${caseRes.status})`);
        process.exit(1);
    }

    const caseData = decodeFirestoreDoc(caseRes.body.fields);
    const sourceTenantId = caseData.tenantId;
    const candidateId = caseData.candidateId;
    const candidateName = caseData.candidateName || '(desconhecido)';
    const status = caseData.status || '(desconhecido)';
    const sourceTenantName = caseData.tenantName || sourceTenantId;

    console.log(`  Candidato   : ${candidateName}`);
    console.log(`  Status      : ${status}`);
    console.log(`  Tenant atual: ${sourceTenantName} (${sourceTenantId})`);
    console.log(`  CandidateId : ${candidateId || '(ausente)'}`);

    // Validate
    if (sourceTenantId === TARGET_TENANT_ID) {
        console.log('\n⚠️  Caso ja esta no tenant alvo. Nada a migrar.');
        process.exit(0);
    }
    if (!sourceTenantId) {
        console.error('❌ Caso nao tem tenantId. Impossivel migrar.');
        process.exit(1);
    }
    if (status !== 'DONE') {
        console.log(`\n⚠️  ATENCAO: Caso com status "${status}" (nao DONE). Migracao de caso em andamento pode causar inconsistencias.`);
    }

    // Read target tenant name
    let targetTenantName = TARGET_TENANT_ID;
    try {
        const tsRes = await getDoc(token, `${DB}/tenantSettings/${TARGET_TENANT_ID}`);
        if (tsRes.status === 200) {
            const tsData = decodeFirestoreDoc(tsRes.body.fields);
            targetTenantName = tsData.name || TARGET_TENANT_ID;
        }
    } catch (e) { /* keep default */ }
    console.log(`  Tenant alvo : ${targetTenantName} (${TARGET_TENANT_ID})`);

    // Save backup
    if (CONFIRM) {
        const backupDir = path.join(__dirname, '..', 'results');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const backupFile = path.join(backupDir, `backup_${CASE_ID}_${Date.now()}.json`);
        fs.writeFileSync(backupFile, JSON.stringify({
            _caseId: CASE_ID,
            _sourceTenantId: sourceTenantId,
            _targetTenantId: TARGET_TENANT_ID,
            _backupAt: new Date().toISOString(),
            caseData,
        }, null, 2));
        console.log(`  📦 Backup salvo: ${backupFile}`);
    }

    // ── Step 1: Update cases/{caseId} ───────────────────────────────────────
    console.log('\n━━━ STEP 1: ATUALIZAR CASO ━━━');
    const casePatch = { tenantId: TARGET_TENANT_ID, tenantName: targetTenantName };
    logPatch('cases', CASE_DOC_PATH, casePatch);
    if (CONFIRM) {
        const res = await patchDoc(token, CASE_DOC_PATH, casePatch);
        if (res.status !== 200) console.log(`    ❌ Erro (HTTP ${res.status})`);
    }

    // ── Step 2: Update candidates/{candidateId} ─────────────────────────────
    console.log('\n━━━ STEP 2: ATUALIZAR CANDIDATO ━━━');
    if (candidateId) {
        const candidatePath = `${DB}/candidates/${candidateId}`;
        const candPatch = { tenantId: TARGET_TENANT_ID, tenantName: targetTenantName };
        logPatch('candidates', candidatePath, candPatch);
        if (CONFIRM) {
            const res = await patchDoc(token, candidatePath, candPatch);
            if (res.status !== 200) console.log(`    ❌ Erro (HTTP ${res.status})`);
        }
    } else {
        console.log('  ⚠️  Sem candidateId. Pulando.');
    }

    // ── Step 3: Update cases/{caseId}/publicResult/latest ───────────────────
    console.log('\n━━━ STEP 3: ATUALIZAR PUBLIC RESULT ━━━');
    {
        const prPath = `${CASE_DOC_PATH}/publicResult/latest`;
        const prPatch = { tenantId: TARGET_TENANT_ID };
        logPatch('publicResult/latest', prPath, prPatch);
        if (CONFIRM) {
            const res = await patchDoc(token, prPath, prPatch);
            if (res.status !== 200) console.log(`    ❌ Erro (HTTP ${res.status}) ou documento nao existe`);
        }
    }

    // ── Step 4: Update clientCases/{caseId} ─────────────────────────────────
    console.log('\n━━━ STEP 4: ATUALIZAR CLIENT CASES ━━━');
    {
        const ccPath = `${DB}/clientCases/${CASE_ID}`;
        const ccPatch = { tenantId: TARGET_TENANT_ID, tenantName: targetTenantName };
        logPatch('clientCases', ccPath, ccPatch);
        if (CONFIRM) {
            const res = await patchDoc(token, ccPath, ccPatch);
            if (res.status !== 200 && res.status !== 404) console.log(`    ⚠️ HTTP ${res.status}`);
        }
    }

    // ── Step 5: Update publicReports ────────────────────────────────────────
    console.log('\n━━━ STEP 5: ATUALIZAR PUBLIC REPORTS ━━━');
    {
        const reportDocs = await runQuery(token, 'publicReports', 'caseId', CASE_ID);
        console.log(`  ${reportDocs.length} relatorio(s) encontrado(s) por caseId`);
        for (const docPath of reportDocs) {
            const rpPatch = { tenantId: TARGET_TENANT_ID };
            logPatch('publicReports', docPath, rpPatch);
            if (CONFIRM) {
                await patchDoc(token, docPath, rpPatch);
            }
        }
        if (reportDocs.length === 0) console.log('  Nenhum para atualizar.');
    }

    // ── Step 6: Update auditLogs ────────────────────────────────────────────
    console.log('\n━━━ STEP 6: ATUALIZAR AUDIT LOGS ━━━');
    {
        const auditDocs = await runQuery(token, 'auditLogs', 'related.caseId', CASE_ID);
        console.log(`  ${auditDocs.length} log(s) de auditoria encontrado(s)`);
        for (const docPath of auditDocs) {
            const alPatch = { tenantId: TARGET_TENANT_ID };
            logPatch('auditLogs', docPath, alPatch);
            if (CONFIRM) {
                await patchDoc(token, docPath, alPatch);
            }
        }
        if (auditDocs.length === 0) console.log('  Nenhum para atualizar.');
    }

    // ── Step 7: Update tenantAuditLogs ──────────────────────────────────────
    console.log('\n━━━ STEP 7: ATUALIZAR TENANT AUDIT LOGS ━━━');
    {
        const tenantAuditDocs = await runQuery(token, 'tenantAuditLogs', 'related.caseId', CASE_ID);
        console.log(`  ${tenantAuditDocs.length} log(s) de auditoria (cliente) encontrado(s)`);
        for (const docPath of tenantAuditDocs) {
            const talPatch = { tenantId: TARGET_TENANT_ID };
            logPatch('tenantAuditLogs', docPath, talPatch);
            if (CONFIRM) {
                await patchDoc(token, docPath, talPatch);
            }
        }
        if (tenantAuditDocs.length === 0) console.log('  Nenhum para atualizar.');
    }

    // ── Step 8: Update caseMessages ─────────────────────────────────────────
    console.log('\n━━━ STEP 8: ATUALIZAR MENSAGENS ━━━');
    {
        const msgDocs = await runQuery(token, 'caseMessages', 'caseId', CASE_ID);
        console.log(`  ${msgDocs.length} mensagen(s) encontrada(s)`);
        for (const docPath of msgDocs) {
            const msgPatch = { tenantId: TARGET_TENANT_ID };
            logPatch('caseMessages', docPath, msgPatch);
            if (CONFIRM) {
                await patchDoc(token, docPath, msgPatch);
            }
        }
        if (msgDocs.length === 0) console.log('  Nenhuma para atualizar.');
    }

    // ── Step 9: Update notifications ────────────────────────────────────────
    console.log('\n━━━ STEP 9: ATUALIZAR NOTIFICACOES ━━━');
    {
        const notifDocs = await runQuery(token, 'notifications', 'caseId', CASE_ID);
        console.log(`  ${notifDocs.length} notificacao(oes) encontrada(s)`);
        for (const docPath of notifDocs) {
            const nPatch = { tenantId: TARGET_TENANT_ID };
            logPatch('notifications', docPath, nPatch);
            if (CONFIRM) {
                await patchDoc(token, docPath, nPatch);
            }
        }
        if (notifDocs.length === 0) console.log('  Nenhuma para atualizar.');
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════╗');
    if (CONFIRM) {
        console.log('║  ✅ MIGRACAO CONCLUIDA                       ║');
        console.log(`║  ${candidateName.slice(0, 28).padEnd(28)} ║`);
        console.log(`║  ${sourceTenantName.slice(0, 15).padEnd(15)} → ${targetTenantName.slice(0, 15).padEnd(15)} ║`);
    } else {
        console.log('║  🔍 DRY-RUN CONCLUIDO                       ║');
        console.log('║  Para executar, rode com --confirm           ║');
    }
    console.log('╚══════════════════════════════════════════════╝');
}

main().catch(err => { console.error('\n❌ Erro:', err.message); process.exit(1); });
