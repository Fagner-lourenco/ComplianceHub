/**
 * unstick-escavador2-cases.cjs
 *
 * Destrava casos parados em escavador2EnrichmentStatus=RUNNING cujo worker morreu
 * sem chamar o callback (ex.: login wall HTTP 402 da Escavador -> 503 -> Cloud Tasks
 * esgota as tentativas). Nesse estado o caso NUNCA sai de RUNNING e, como RUNNING
 * nao e terminal, canRunFinalClassification impede o analista de concluir.
 *
 * NAO escreve direto no Firestore: usa o proprio endpoint escavador2Callback com
 * status FAILED — o mesmo caminho do worker. Assim o caso e a task sao marcados na
 * mesma transacao e a auto-classificacao e redisparada, exatamente como numa falha real.
 *
 * RUNBOOK:
 *   1. node scripts/unstick-escavador2-cases.cjs                  -> dry-run (nao altera nada)
 *   2. node scripts/unstick-escavador2-cases.cjs --apply --limit 1 -> piloto, conferir o caso
 *   3. node scripts/unstick-escavador2-cases.cjs --apply           -> lote
 *
 * Seguranca:
 *   - Backup JSON de cada caso em results/escavador2-unstick-backups/<timestamp>/
 *   - So toca casos com RUNNING parado ha mais de --min-age-minutes (default 20),
 *     para nunca matar uma consulta legitimamente em andamento
 *   - Nao toca casos DONE nem CORRECTION_NEEDED
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const PROJECT_ID = 'compliance-hub-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const CALLBACK_URL = 'https://escavador2callback-dowqa75f4a-rj.a.run.app';
const DEFAULT_MIN_AGE_MINUTES = 20;
const THROTTLE_MS = 1500;

/** Estados do escavador2 que NAO sao terminais e travam a conclusao do caso. */
const NON_TERMINAL = ['RUNNING'];
/** Status do caso em que faz sentido destravar. */
const ACTIONABLE_CASE_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING_INFO'];

/**
 * Predicado puro de selecao. Retorna { eligible, reason }.
 */
function shouldUnstickCase(caseData = {}, { minAgeMinutes = DEFAULT_MIN_AGE_MINUTES, now = Date.now() } = {}) {
    if (!NON_TERMINAL.includes(caseData.escavador2EnrichmentStatus)) {
        return { eligible: false, reason: 'escavador2_not_running' };
    }
    if (!ACTIONABLE_CASE_STATUSES.includes(caseData.status)) {
        return { eligible: false, reason: `case_status_${caseData.status || 'desconhecido'}` };
    }
    const reference = caseData.updatedAt || caseData.createdAt;
    if (!reference) return { eligible: false, reason: 'sem_timestamp' };
    const ageMinutes = (now - new Date(reference).getTime()) / 60000;
    if (!Number.isFinite(ageMinutes)) return { eligible: false, reason: 'timestamp_invalido' };
    if (ageMinutes < minAgeMinutes) {
        return { eligible: false, reason: `em_andamento_ha_${ageMinutes.toFixed(0)}min` };
    }
    return { eligible: true, reason: 'ok', ageMinutes };
}

/* ============================ infra ============================ */

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
    if (res.status !== 200) throw new Error('Token refresh falhou');
    return res.body.access_token;
}

function getInternalApiKey() {
    return execSync(`firebase functions:secrets:access ESCAVADOR2_API_KEY --project ${PROJECT_ID}`, {
        encoding: 'utf-8', shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/sh', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
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
    return null;
}

async function postFailedCallback(caseId, generation, apiKey, errorMessage) {
    const url = new URL(CALLBACK_URL);
    url.searchParams.set('caseId', caseId);
    url.searchParams.set('generation', String(generation || 0));
    const body = JSON.stringify({ status: 'FAILED', error: errorMessage });
    const res = await httpsRequest({
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Internal-Api-Key': apiKey,
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    return res;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const apply = process.argv.includes('--apply');
    const limitIdx = process.argv.indexOf('--limit');
    const limit = limitIdx > -1 ? Number(process.argv[limitIdx + 1]) : Infinity;
    const ageIdx = process.argv.indexOf('--min-age-minutes');
    const minAgeMinutes = ageIdx > -1 ? Number(process.argv[ageIdx + 1]) : DEFAULT_MIN_AGE_MINUTES;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  DESTRAVAR CASOS PRESOS NO ESCAVADOR2 (${apply ? 'APPLY' : 'DRY-RUN'})`);
    console.log(`  Idade minima em RUNNING: ${minAgeMinutes} min`);
    console.log('═══════════════════════════════════════════════════════════════');

    const token = await getAccessToken();
    let pageToken = null;
    let total = 0;
    const eligible = [];
    const skipped = [];

    do {
        let url = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/cases?pageSize=300`;
        if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
        const res = await httpsRequest({
            hostname: 'firestore.googleapis.com', path: url, method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status !== 200) { console.error('Falha ao listar casos:', JSON.stringify(res.body).slice(0, 300)); process.exit(1); }
        const docs = res.body.documents || [];
        pageToken = res.body.nextPageToken || null;

        for (const doc of docs) {
            total++;
            const c = {};
            for (const [k, v] of Object.entries(doc.fields || {})) c[k] = fromFirestoreValue(v);
            if (c.escavador2EnrichmentStatus !== 'RUNNING') continue;

            const verdict = shouldUnstickCase(c, { minAgeMinutes });
            const row = {
                caseId: doc.name.split('/').pop(),
                tenantName: c.tenantName || 'N/A',
                caseStatus: c.status,
                generation: c.enrichmentGeneration || 0,
                callbackStatus: c.escavador2CallbackStatus || null,
                updatedAt: c.updatedAt,
                idadeMin: c.updatedAt ? ((Date.now() - new Date(c.updatedAt).getTime()) / 60000).toFixed(0) : '?',
                verdict: verdict.reason,
                raw: c,
            };
            if (verdict.eligible) eligible.push(row); else skipped.push(row);
        }
    } while (pageToken);

    console.log(`\nCasos varridos: ${total}`);
    console.log(`Em RUNNING: ${eligible.length + skipped.length} | Elegiveis para destrave: ${eligible.length}`);

    if (skipped.length > 0) {
        console.log('\nNao elegiveis:');
        for (const s of skipped) console.log(`  - ${s.caseId} [${s.tenantName}] caso=${s.caseStatus} idade=${s.idadeMin}min -> ${s.verdict}`);
    }
    console.log('\nElegiveis:');
    for (const e of eligible) console.log(`  ✔ ${e.caseId} [${e.tenantName}] caso=${e.caseStatus} gen=${e.generation} parado ha ${e.idadeMin}min`);

    if (!apply) {
        console.log('\nDRY-RUN: nada foi alterado. Use --apply para executar.');
        return;
    }
    if (eligible.length === 0) {
        console.log('\nNenhum caso elegivel. Nada a fazer.');
        return;
    }

    const apiKey = getInternalApiKey();
    if (!apiKey) throw new Error('ESCAVADOR2_API_KEY nao acessivel.');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'results', 'escavador2-unstick-backups', stamp);
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`\nBackups em: ${backupDir}`);

    const errorMessage = 'Escavador2 indisponivel: proxy BrightData recusou as rotas /busca e /cpf do Escavador (HTTP 402, policy_20140 — acesso residencial sem KYC bloqueado por robots.txt). Marcado como falho para liberar a conclusao do caso.';
    let done = 0, failed = 0;
    for (const e of eligible) {
        if (done + failed >= limit) break;
        fs.writeFileSync(path.join(backupDir, `${e.caseId}.json`), JSON.stringify(e.raw, null, 2));
        process.stdout.write(`[${done + failed + 1}/${Math.min(eligible.length, limit)}] ${e.caseId} ... `);
        const res = await postFailedCallback(e.caseId, e.generation, apiKey, errorMessage);
        if (res.status === 200 && res.body?.ok) {
            console.log(`OK (${JSON.stringify(res.body)})`);
            done++;
        } else {
            console.log(`FALHOU status=${res.status} ${JSON.stringify(res.body).slice(0, 160)}`);
            failed++;
        }
        await sleep(THROTTLE_MS);
    }
    console.log(`\nConcluido: ${done} destravado(s), ${failed} com erro.`);
}

module.exports = { shouldUnstickCase };

if (require.main === module) {
    main().catch(err => { console.error('\n❌ Erro:', err.message); process.exit(1); });
}
