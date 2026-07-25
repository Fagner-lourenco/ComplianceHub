/**
 * reprocess-gate-blocked-cases.cjs
 *
 * Reprocessa casos bloqueados pelo gate de identidade por CPF irregular/obito
 * (motivos que NAO bloqueiam mais apos o fix "gate so por nome").
 * Casos bloqueados por nome divergente NAO sao tocados (bloqueio legitimo).
 * Casos cujo nome re-bloquearia no gate novo tambem NAO sao tocados
 * (reprocessar = pagar BDC para bloquear de novo).
 *
 * RUNBOOK (nesta ordem):
 *   1. Deploy do backend com o fix do gate (enrichmentPhases.js) JA APLICADO.
 *   2. `node scripts/reprocess-gate-blocked-cases.cjs`            → dry-run (default, nao escreve nada)
 *   3. `node scripts/reprocess-gate-blocked-cases.cjs --apply --limit 1` → piloto com 1 caso; acompanhar o
 *      pipeline do caso ate settle (bdc DONE/BLOCKED, judit, autoclassify).
 *   4. `node scripts/reprocess-gate-blocked-cases.cjs --apply`    → lote completo (throttle 4s/caso).
 *
 * Seguranca:
 *   - Backup JSON completo de cada doc em results/reprocess-backups/<timestamp>/<caseId>.json ANTES do patch.
 *   - Patch usa updateMask: so os campos listados sao alterados/removidos; nenhum outro dado e tocado.
 *   - O patch (CORRECTION_NEEDED -> PENDING + bigdatacorpEnrichmentStatus PENDING) dispara o trigger ja
 *     deployado enrichBigDataCorpOnCorrection; a cascata (Judit/DJEN/Escavador2/autoclassify) segue sozinha.
 *
 * Custo estimado por caso reprocessado: BDC ~R$0,20 + cascata Judit (lawsuits R$0,50; warrant R$1,00 quando
 * habilitado) → ~R$0,70-1,70/caso. O dry-run imprime a estimativa.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const BATCH_SIZE = 200;
const THROTTLE_MS = 4000;
const DEFAULT_MIN_NAME_SIMILARITY = 0.7;

/** Motivos de bloqueio antigos que o gate novo nao bloqueia mais (BDC primario). */
const REPROCESSABLE_REASON_RE = /^CPF status|^Indicacao de obito/;
/** Motivo de bloqueio que continua valido no gate novo. */
const NAME_BLOCK_REASON_RE = /^Similaridade insuficiente/;

/**
 * Predicado puro de selecao. Retorna { eligible, reason }.
 * Elegivel apenas se: caso ainda em CORRECTION_NEEDED por identity_gate_blocked,
 * BDC BLOCKED, motivo antigo era CPF/obito E o nome passaria no gate novo.
 */
function shouldReprocessCase(caseData = {}, { minNameSimilarity = DEFAULT_MIN_NAME_SIMILARITY } = {}) {
    if (caseData.status !== 'CORRECTION_NEEDED') return { eligible: false, reason: 'case_not_in_correction' };
    if (caseData.correctionReason !== 'identity_gate_blocked') return { eligible: false, reason: 'other_correction_reason' };
    if (caseData.bigdatacorpEnrichmentStatus !== 'BLOCKED') return { eligible: false, reason: 'bdc_not_blocked' };
    const gate = caseData.bigdatacorpGateResult;
    if (!gate || typeof gate.reason !== 'string') return { eligible: false, reason: 'missing_gate_result' };
    if (NAME_BLOCK_REASON_RE.test(gate.reason)) return { eligible: false, reason: 'blocked_by_name' };
    if (!REPROCESSABLE_REASON_RE.test(gate.reason)) return { eligible: false, reason: 'unknown_block_reason' };
    const nameSim = Number(gate.nameSimilarity) || 0;
    const namePasses = minNameSimilarity <= 0 || nameSim >= minNameSimilarity;
    if (!namePasses) return { eligible: false, reason: 'name_would_block' };
    return { eligible: true, reason: 'ok' };
}

/* ============================ REST helpers ============================ */

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
    if (!fs.existsSync(configPath)) {
        throw new Error(`Firebase CLI config nao encontrado em: ${configPath}. Rode 'firebase login' antes.`);
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const postData = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: config.tokens.refresh_token,
        client_id: FIREBASE_CLI_CLIENT_ID,
        client_secret: FIREBASE_CLI_CLIENT_SECRET,
    }).toString();
    const res = await httpsRequest({
        hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    }, postData);
    if (res.status !== 200) throw new Error('Token refresh falhou: ' + JSON.stringify(res.body));
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

function toFirestoreValue(v) {
    if (v === null || v === undefined) return { nullValue: 'NULL_VALUE' };
    if (typeof v === 'string') return { stringValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'boolean') return { booleanValue: v };
    return { stringValue: String(v) };
}

/**
 * PATCH com updateMask: campos em `setFields` sao gravados; campos em `deleteFields`
 * entram so no mask (sem valor) e sao removidos do documento.
 */
async function patchCase(token, caseId, setFields, deleteFields) {
    const fields = {};
    const maskParts = [];
    for (const [k, v] of Object.entries(setFields)) {
        fields[k] = toFirestoreValue(v);
        maskParts.push(`updateMask.fieldPaths=${encodeURIComponent(k)}`);
    }
    for (const k of deleteFields) {
        maskParts.push(`updateMask.fieldPaths=${encodeURIComponent(k)}`);
    }
    const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/cases/${caseId}`;
    const body = JSON.stringify({ fields });
    const res = await httpsRequest({
        hostname: 'firestore.googleapis.com',
        path: `/v1/${docPath}?${maskParts.join('&')}`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, body);
    if (res.status !== 200) throw new Error(`Patch ${caseId} falhou (${res.status}): ${JSON.stringify(res.body).slice(0, 300)}`);
}

async function fetchTenantMinSimilarity(token, tenantId, cache) {
    if (cache.has(tenantId)) return cache.get(tenantId);
    let minSim = DEFAULT_MIN_NAME_SIMILARITY;
    try {
        const res = await httpsRequest({
            hostname: 'firestore.googleapis.com',
            path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/tenantSettings/${encodeURIComponent(tenantId)}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 200) {
            const data = {};
            for (const [k, v] of Object.entries(res.body.fields || {})) data[k] = fromFirestoreValue(v);
            const configured = data?.enrichmentConfig?.bigdatacorp?.gate?.minNameSimilarity;
            if (typeof configured === 'number') minSim = configured;
        }
    } catch { /* usa default */ }
    cache.set(tenantId, minSim);
    return minSim;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const apply = process.argv.includes('--apply');
    const limitArgIdx = process.argv.indexOf('--limit');
    const limit = limitArgIdx > -1 ? Number(process.argv[limitArgIdx + 1]) : Infinity;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  REPROCESSAMENTO DE CASOS BLOQUEADOS POR GATE (${apply ? 'APPLY' : 'DRY-RUN'})`);
    console.log('═══════════════════════════════════════════════════════════════');

    const token = await getAccessToken();
    const minSimCache = new Map();

    let nextPageToken = null;
    let total = 0;
    const eligible = [];
    const skipped = [];

    do {
        let url = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/cases?pageSize=${BATCH_SIZE}`;
        if (nextPageToken) url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
        const res = await httpsRequest({
            hostname: 'firestore.googleapis.com', path: url, method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status !== 200) {
            console.error('Falha ao listar casos:', JSON.stringify(res.body).slice(0, 300));
            process.exit(1);
        }
        const docs = res.body.documents || [];
        nextPageToken = res.body.nextPageToken || null;

        for (const doc of docs) {
            total++;
            const id = doc.name.split('/').pop();
            const c = {};
            for (const [k, v] of Object.entries(doc.fields || {})) c[k] = fromFirestoreValue(v);

            if (c.bigdatacorpEnrichmentStatus !== 'BLOCKED') continue;

            const minSim = c.tenantId
                ? await fetchTenantMinSimilarity(token, c.tenantId, minSimCache)
                : DEFAULT_MIN_NAME_SIMILARITY;
            const verdict = shouldReprocessCase(c, { minNameSimilarity: minSim });
            const row = {
                caseId: id,
                tenantId: c.tenantId || 'N/A',
                tenantName: c.tenantName || 'N/A',
                caseStatus: c.status,
                gateReason: c.bigdatacorpGateResult?.reason || null,
                nameSimilarity: c.bigdatacorpGateResult?.nameSimilarity ?? null,
                minNameSimilarity: minSim,
                verdict: verdict.reason,
                raw: c,
            };
            if (verdict.eligible) eligible.push(row); else skipped.push(row);
        }
    } while (nextPageToken);

    console.log(`\nCasos varridos: ${total}`);
    console.log(`Bloqueados encontrados: ${eligible.length + skipped.length}`);
    console.log(`Elegiveis para reprocesso: ${eligible.length}`);
    console.log('\nNao elegiveis (motivo):');
    for (const s of skipped) {
        console.log(`  - ${s.caseId} [${s.tenantName}] status=${s.caseStatus} gate="${s.gateReason}" sim=${s.nameSimilarity} → ${s.verdict}`);
    }
    console.log('\nElegiveis:');
    for (const e of eligible) {
        console.log(`  ✔ ${e.caseId} [${e.tenantName}] gate="${e.gateReason}" sim=${e.nameSimilarity} (limiar ${e.minNameSimilarity})`);
    }
    const n = Math.min(eligible.length, limit);
    console.log(`\nCusto estimado do reprocesso (${n} caso(s)): BDC ~R$${(n * 0.2).toFixed(2)} + cascata Judit → total ~R$${(n * 0.7).toFixed(2)} a R$${(n * 1.7).toFixed(2)}`);

    if (!apply) {
        console.log('\nDRY-RUN: nada foi alterado. Use --apply para executar.');
        return;
    }
    if (eligible.length === 0) {
        console.log('\nNenhum caso elegivel. Nada a fazer.');
        return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'results', 'reprocess-backups', stamp);
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`\nBackups em: ${backupDir}`);

    let processed = 0;
    for (const e of eligible) {
        if (processed >= limit) break;
        fs.writeFileSync(path.join(backupDir, `${e.caseId}.json`), JSON.stringify(e.raw, null, 2));
        console.log(`\n[${processed + 1}/${Math.min(eligible.length, limit)}] Reprocessando ${e.caseId} (${e.tenantName})...`);
        await patchCase(token, e.caseId, {
            status: 'PENDING',
            bigdatacorpEnrichmentStatus: 'PENDING',
            bigdatacorpError: null,
            gateReprocessedAt: new Date().toISOString(),
            gateReprocessedBy: 'reprocess-gate-blocked-cases.cjs',
        }, [
            'bigdatacorpGateResult',
            'correctionReason',
            'correctionNotes',
            'correctionRequestedAt',
            'correctionRequestedBy',
        ]);
        console.log('  PATCH ok — trigger enrichBigDataCorpOnCorrection deve assumir.');
        processed++;
        if (processed < Math.min(eligible.length, limit)) await sleep(THROTTLE_MS);
    }
    console.log(`\nConcluido: ${processed} caso(s) reprocessado(s). Acompanhe os pipelines no cockpit ops.`);
}

module.exports = { shouldReprocessCase };

if (require.main === module) {
    main().catch(err => {
        console.error('\n❌ Erro:', err.message);
        process.exit(1);
    });
}
