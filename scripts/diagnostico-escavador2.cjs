/**
 * diagnostico-escavador2.cjs — Coleta evidencia de TODAS as camadas do
 * escavador2 de uma vez, para localizar em qual delas o fluxo quebra.
 *
 * Somente leitura. Nao reprocessa nada, nao escreve nada.
 *
 * O escavador2 atravessa: gatilho (Cloud Functions) -> Cloud Tasks ->
 * worker (Cloud Run escavador2-api) -> callback -> Firestore. Olhar so uma
 * camada leva a diagnostico errado: ja aconteceu de o deploy reportar sucesso
 * com o trafego preso numa revisao antiga, e de erro 403 do provedor ser
 * confundido com falha permanente.
 *
 * Uso:
 *   node scripts/diagnostico-escavador2.cjs                # ultimas 24h
 *   node scripts/diagnostico-escavador2.cjs --horas=72
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT = 'compliance-hub-br';
const args = process.argv.slice(2);
const HORAS = parseInt((args.find((a) => a.startsWith('--horas=')) || '').split('=')[1] || '24', 10);
const AGORA = new Date(process.env.DIAG_AGORA || Date.now());
const DESDE = new Date(AGORA.getTime() - HORAS * 3600 * 1000).toISOString();

async function getAccessToken() {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: cfg.tokens.refresh_token,
            client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
            client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
        }),
    });
    if (!res.ok) throw new Error(`token exchange falhou: ${res.status}`);
    return (await res.json()).access_token;
}

function decodeValue(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return parseInt(v.integerValue, 10);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('nullValue' in v) return null;
    if ('mapValue' in v) return decodeDoc(v.mapValue.fields || {});
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
    return v;
}
function decodeDoc(f) {
    const o = {};
    for (const [k, v] of Object.entries(f || {})) o[k] = decodeValue(v);
    return o;
}

async function runQuery(token, structuredQuery) {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredQuery }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error?.message || res.status };
    return {
        docs: (Array.isArray(data) ? data : []).filter((r) => r.document)
            .map((r) => ({ id: r.document.name.split('/').pop(), ...decodeDoc(r.document.fields) })),
    };
}

async function getDoc(token, caminho) {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${caminho}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error?.message || res.status };
    return decodeDoc(data.fields);
}

async function listLogs(token, filter, limit = 100) {
    const res = await fetch('https://logging.googleapis.com/v2/entries:list', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceNames: [`projects/${PROJECT}`], filter, orderBy: 'timestamp desc', pageSize: limit }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error?.message || res.status };
    return { entries: data.entries || [] };
}

function resumirLog(e) {
    const texto = e.textPayload
        || (e.jsonPayload ? (e.jsonPayload.message || JSON.stringify(e.jsonPayload)) : '')
        || e.protoPayload?.statusMessage || '';
    return `[${(e.timestamp || '').slice(0, 19)}] ${e.severity || ''} ${String(texto).replace(/\s+/g, ' ').slice(0, 300)}`;
}

/** Agrupa mensagens parecidas para nao imprimir 200 linhas iguais. */
function agrupar(entradas, extrair) {
    const mapa = new Map();
    for (const e of entradas) {
        const chave = extrair(e);
        if (!mapa.has(chave)) mapa.set(chave, { n: 0, exemplo: e, primeiro: e.timestamp, ultimo: e.timestamp });
        const g = mapa.get(chave);
        g.n += 1;
        if (e.timestamp < g.primeiro) g.primeiro = e.timestamp;
        if (e.timestamp > g.ultimo) g.ultimo = e.timestamp;
    }
    return [...mapa.entries()].sort((a, b) => b[1].n - a[1].n);
}

async function main() {
    const token = await getAccessToken();
    console.log(`Janela: desde ${DESDE} (${HORAS}h)\n`);

    // ---------- Camada 1: estado do circuito ----------
    console.log('=== 1. CIRCUITO (systemHealth/escavador2) ===');
    const circuito = await getDoc(token, 'systemHealth/escavador2');
    console.log(circuito.error ? `  (sem documento: ${circuito.error})` : JSON.stringify(circuito, null, 2));
    for (const p of ['escavador', 'judit', 'bigdatacorp']) {
        const c = await getDoc(token, `systemHealth/${p}`);
        if (!c.error) console.log(`  ${p}: state=${c.state || c.status || '?'} failures=${c.consecutiveFailures ?? c.failureCount ?? '?'} openedAt=${c.openedAt || c.lastOpenedAt || '—'}`);
    }

    // ---------- Camada 2: casos ----------
    console.log('\n=== 2. CASOS por escavador2EnrichmentStatus ===');
    const estados = ['FAILED', 'PENDING', 'RUNNING', 'PARTIAL', 'SKIPPED', 'BLOCKED'];
    const porEstado = {};
    for (const estado of estados) {
        const r = await runQuery(token, {
            from: [{ collectionId: 'cases' }],
            where: { fieldFilter: { field: { fieldPath: 'escavador2EnrichmentStatus' }, op: 'EQUAL', value: { stringValue: estado } } },
            limit: 300,
        });
        if (r.error) { console.log(`  ${estado}: ERRO ${r.error}`); continue; }
        porEstado[estado] = r.docs;
        const recentes = r.docs.filter((d) => (d.updatedAt || d.createdAt || '') >= DESDE);
        console.log(`  ${estado}: ${r.docs.length} no total, ${recentes.length} na janela`);
    }

    // ---------- Camada 3: motivo das falhas ----------
    console.log('\n=== 3. MOTIVO DAS FALHAS (casos FAILED/BLOCKED recentes) ===');
    const suspeitos = [...(porEstado.FAILED || []), ...(porEstado.BLOCKED || [])]
        .filter((d) => (d.updatedAt || d.createdAt || '') >= DESDE)
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    if (suspeitos.length === 0) {
        console.log('  nenhum caso FAILED/BLOCKED na janela');
    } else {
        const motivos = new Map();
        for (const d of suspeitos) {
            const motivo = d.escavador2Error || d.escavador2FailureReason || d.escavador2SkippedReason || d.escavador2BlockType || '(sem motivo gravado)';
            const chave = String(motivo).replace(/\s+/g, ' ').slice(0, 160);
            motivos.set(chave, (motivos.get(chave) || 0) + 1);
        }
        for (const [motivo, n] of [...motivos.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}x  ${motivo}`);
        console.log('\n  amostra:');
        for (const d of suspeitos.slice(0, 8)) {
            console.log(`   ${d.id}  ${d.updatedAt || '—'}  status=${d.status}  fase=${d.escavador2EnrichmentStatus}`);
            const extras = Object.entries(d).filter(([k]) => /^escavador2/i.test(k)).map(([k, v]) => `${k}=${JSON.stringify(v)}`.slice(0, 120));
            extras.forEach((x) => console.log(`      ${x}`));
        }
    }

    // ---------- Camada 4: worker Cloud Run ----------
    console.log('\n=== 4. WORKER (Cloud Run escavador2-api) — erros na janela ===');
    const worker = await listLogs(token,
        `resource.type="cloud_run_revision" AND resource.labels.service_name="escavador2-api" AND timestamp>="${DESDE}" AND severity>=WARNING`, 300);
    if (worker.error) console.log(`  ERRO: ${worker.error}`);
    else if (worker.entries.length === 0) console.log('  nenhum WARNING/ERROR na janela');
    else {
        console.log(`  ${worker.entries.length} entradas WARNING+`);
        for (const [chave, g] of agrupar(worker.entries, (e) => {
            const t = e.textPayload || JSON.stringify(e.jsonPayload || {});
            return String(t).replace(/\s+/g, ' ').replace(/\b[0-9a-f]{8,}\b/g, '<id>').replace(/\d{11,}/g, '<num>').slice(0, 130);
        }).slice(0, 12)) {
            console.log(`  ${g.n}x  ${chave}`);
            console.log(`        de ${g.primeiro.slice(0, 19)} ate ${g.ultimo.slice(0, 19)}`);
        }
    }

    console.log('\n=== 4b. WORKER — volume total na janela (qualquer severidade) ===');
    const workerTudo = await listLogs(token,
        `resource.type="cloud_run_revision" AND resource.labels.service_name="escavador2-api" AND timestamp>="${DESDE}"`, 5);
    if (workerTudo.error) console.log(`  ERRO: ${workerTudo.error}`);
    else if (workerTudo.entries.length === 0) console.log('  SEM NENHUM LOG — o worker pode nao estar recebendo requisicao');
    else workerTudo.entries.forEach((e) => console.log(`  ${resumirLog(e)}`));

    // ---------- Camada 5: Cloud Functions ----------
    console.log('\n=== 5. CLOUD FUNCTIONS — erros mencionando escavador2 ===');
    const fn = await listLogs(token,
        `resource.type="cloud_run_revision" AND resource.labels.service_name!="escavador2-api" AND timestamp>="${DESDE}" AND severity>=ERROR AND (textPayload:"escavador2" OR jsonPayload.message:"escavador2")`, 100);
    if (fn.error) console.log(`  ERRO: ${fn.error}`);
    else if (fn.entries.length === 0) console.log('  nenhum erro mencionando escavador2');
    else {
        for (const [chave, g] of agrupar(fn.entries, (e) => {
            const t = e.textPayload || e.jsonPayload?.message || JSON.stringify(e.jsonPayload || {});
            return String(t).replace(/\s+/g, ' ').replace(/\b[0-9a-f]{8,}\b/g, '<id>').slice(0, 150);
        }).slice(0, 12)) {
            console.log(`  ${g.n}x  ${chave}`);
            console.log(`        de ${g.primeiro.slice(0, 19)} ate ${g.ultimo.slice(0, 19)}  (${g.exemplo.resource?.labels?.service_name || '?'})`);
        }
    }
}

main().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
