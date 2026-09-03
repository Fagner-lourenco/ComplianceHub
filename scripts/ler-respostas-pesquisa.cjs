/**
 * ler-respostas-pesquisa.cjs — Lista as respostas da pesquisa de produto.
 *
 * Somente leitura: nao escreve nem apaga nada. Serve para conferir que a
 * pagina publica (/pesquisa.html) esta gravando em `researchResponses` com
 * todos os campos esperados, e depois para acompanhar a coleta.
 *
 * Uso:
 *   node scripts/ler-respostas-pesquisa.cjs                 # resumo das ultimas 20
 *   node scripts/ler-respostas-pesquisa.cjs --detalhe       # inclui as respostas
 *   node scripts/ler-respostas-pesquisa.cjs --origem=convite-x
 *   node scripts/ler-respostas-pesquisa.cjs --limite=100
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const BASE = 'firestore.googleapis.com';

const args = process.argv.slice(2);
const DETALHE = args.includes('--detalhe');
const ORIGEM = (args.find((a) => a.startsWith('--origem=')) || '').split('=')[1] || null;
const LIMITE = parseInt((args.find((a) => a.startsWith('--limite=')) || '').split('=')[1] || '20', 10);

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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    }, postData);
    if (res.status !== 200) throw new Error(`Falha ao renovar token: ${JSON.stringify(res.body)}`);
    return res.body.access_token;
}

function decodeValue(val) {
    if (val === undefined || val === null) return null;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return val.doubleValue;
    if ('booleanValue' in val) return val.booleanValue;
    if ('nullValue' in val) return null;
    if ('timestampValue' in val) return val.timestampValue;
    if ('mapValue' in val) return decodeDoc(val.mapValue.fields || {});
    if ('arrayValue' in val) return (val.arrayValue.values || []).map(decodeValue);
    return val;
}

function decodeDoc(fields) {
    const out = {};
    for (const [k, v] of Object.entries(fields || {})) out[k] = decodeValue(v);
    return out;
}

async function main() {
    const token = await getAccessToken();
    // Filtrar por origem E ordenar por data exigiria indice composto no
    // Firestore. Como o volume da pesquisa e pequeno, filtra no servidor e
    // ordena aqui — evita pedir indice novo so para uma consulta operacional.
    const query = {
        structuredQuery: {
            from: [{ collectionId: 'researchResponses' }],
            limit: LIMITE,
        },
    };
    if (ORIGEM) {
        query.structuredQuery.where = {
            fieldFilter: { field: { fieldPath: 'origem' }, op: 'EQUAL', value: { stringValue: ORIGEM } },
        };
    } else {
        query.structuredQuery.orderBy = [{ field: { fieldPath: 'criadoEm' }, direction: 'DESCENDING' }];
    }
    const corpo = JSON.stringify(query);
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) },
    }, corpo);

    if (res.status !== 200) {
        console.error('Erro na consulta:', res.status, JSON.stringify(res.body).slice(0, 500));
        process.exit(1);
    }

    const docs = (Array.isArray(res.body) ? res.body : [])
        .filter((linha) => linha.document)
        .map((linha) => ({ id: linha.document.name.split('/').pop(), ...decodeDoc(linha.document.fields) }))
        .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));

    if (docs.length === 0) {
        console.log('Nenhuma resposta encontrada.');
        return;
    }

    console.log(`${docs.length} resposta(s)${ORIGEM ? ` da origem "${ORIGEM}"` : ''}:\n`);
    for (const d of docs) {
        const min = d.duracaoSegundos != null ? `${Math.round(d.duracaoSegundos / 60)}min` : '—';
        console.log(`${d.id}  ${d.criadoEm || '—'}`);
        console.log(`   origem=${d.origem || '(sem origem)'}  respostas=${d.totalRespostas}  parcial=${d.parcial}  anonima=${d.anonima}  duracao=${min}  viewport=${d.viewport || '—'}`);
        console.log(`   versao=${d.surveyVersion}  iniciadoEm=${d.iniciadoEm || '—'}  enviadoEm=${d.enviadoEm || '—'}`);
        if (DETALHE) {
            for (const [k, v] of Object.entries(d.answers || {})) {
                console.log(`      ${k}: ${Array.isArray(v) ? v.join(', ') : String(v).slice(0, 160)}`);
            }
        }
        console.log('');
    }

    const completas = docs.filter((d) => !d.parcial).length;
    const porOrigem = {};
    docs.forEach((d) => { const o = d.origem || '(sem origem)'; porOrigem[o] = (porOrigem[o] || 0) + 1; });
    console.log(`Resumo: ${completas} completas, ${docs.length - completas} parciais.`);
    console.log('Por origem:', JSON.stringify(porOrigem));
}

main().catch((err) => { console.error(err); process.exit(1); });
