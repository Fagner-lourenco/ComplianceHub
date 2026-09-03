/**
 * exportar-respostas-pesquisa.cjs — Relatorio legivel das respostas da pesquisa.
 *
 * Somente leitura. O script irmao (ler-respostas-pesquisa.cjs) lista os codigos
 * crus gravados no Firestore (`daily_volume: 4_7`). Este aqui cruza esses
 * codigos com o dicionario de perguntas do proprio formulario para produzir o
 * texto por extenso — que e o que serve para analise.
 *
 * O dicionario e lido de public/pesquisa.html em vez de duplicado aqui: a
 * pagina e a fonte da verdade das perguntas, e uma copia manual sairia de
 * sincronia na primeira edicao do questionario.
 *
 * Uso:
 *   node scripts/exportar-respostas-pesquisa.cjs                # gera HTML + JSON
 *   node scripts/exportar-respostas-pesquisa.cjs --incluir-testes
 *   node scripts/exportar-respostas-pesquisa.cjs --saida=caminho/relatorio.html
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const PROJECT_ID = 'compliance-hub-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const BASE = 'firestore.googleapis.com';

// Origens usadas nos testes de integracao da propria pesquisa. Ficam fora do
// relatorio por padrao para nao contaminarem a analise.
const ORIGENS_DE_TESTE = new Set(['teste-integracao', 'validacao-final', 'teste-mobile-final', 'teste-navegador', 'teste-mobile']);

const args = process.argv.slice(2);
const INCLUIR_TESTES = args.includes('--incluir-testes');
const SAIDA = (args.find((a) => a.startsWith('--saida=')) || '').split('=')[1] || 'scripts/out/respostas-pesquisa.html';

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

/** Le o array QUESTIONS da pagina publicada, sem duplicar o questionario aqui. */
function carregarPerguntas() {
    const html = fs.readFileSync('public/pesquisa.html', 'utf-8');
    const inicio = html.indexOf('const QUESTIONS = [');
    if (inicio === -1) throw new Error('Nao achei o array QUESTIONS em public/pesquisa.html');
    const fim = html.indexOf('\n];', inicio);
    if (fim === -1) throw new Error('Nao achei o fim do array QUESTIONS');
    const trecho = html.slice(inicio, fim + 3);
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(`${trecho}\nthis.QUESTIONS = QUESTIONS;`, sandbox);
    return sandbox.QUESTIONS;
}

function rotuloDaOpcao(pergunta, valor) {
    const achado = (pergunta.options || []).find((o) => o[0] === valor);
    return achado ? achado[1] : valor;
}

function descreverResposta(pergunta, valor, todasAsRespostas) {
    const outro = todasAsRespostas ? todasAsRespostas[`${pergunta.id}__other`] : null;
    const comOutro = (lista) => (outro ? lista.map((v) => (/^outr|^other/i.test(v) ? `${v}: ${outro}` : v)) : lista);
    if (valor === null || valor === undefined || valor === '') return null;
    if (pergunta.type === 'multi') {
        const lista = Array.isArray(valor) ? valor : [valor];
        return comOutro(lista.map((v) => rotuloDaOpcao(pergunta, v)));
    }
    if (pergunta.type === 'single') return comOutro([rotuloDaOpcao(pergunta, valor)]);
    if (pergunta.type === 'scale5' || pergunta.type === 'scale10') {
        const rotulos = pergunta.labels || [];
        const max = pergunta.type === 'scale5' ? 5 : 10;
        const extremo = rotulos.length === 2 ? ` (${rotulos[0]} → ${rotulos[1]})` : '';
        return [`${valor} de ${max}${extremo}`];
    }
    return [String(valor)];
}

function esc(s) {
    return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function buscarRespostas(token) {
    const corpo = JSON.stringify({
        structuredQuery: {
            from: [{ collectionId: 'researchResponses' }],
            orderBy: [{ field: { fieldPath: 'criadoEm' }, direction: 'DESCENDING' }],
            limit: 500,
        },
    });
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) },
    }, corpo);
    if (res.status !== 200) throw new Error(`Consulta falhou: ${res.status} ${JSON.stringify(res.body).slice(0, 400)}`);
    return (Array.isArray(res.body) ? res.body : [])
        .filter((l) => l.document)
        .map((l) => ({ id: l.document.name.split('/').pop(), ...decodeDoc(l.document.fields) }));
}

function montarHtml({ perguntas, respostas, porPergunta, orfas, geradoEm }) {
    const totalRespondentes = respostas.length;
    const duracoes = respostas.map((r) => r.duracaoSegundos).filter((d) => Number.isFinite(d) && d > 0);
    const medianaMin = duracoes.length
        ? Math.round(duracoes.sort((a, b) => a - b)[Math.floor(duracoes.length / 2)] / 60)
        : null;

    const secoes = [];
    let secaoAtual = null;
    for (const q of perguntas) {
        const dados = porPergunta.get(q.id);
        if (!dados || dados.respostas.length === 0) continue;
        if (q.section !== secaoAtual) { secaoAtual = q.section; secoes.push({ nome: q.section, itens: [] }); }
        secoes[secoes.length - 1].itens.push({ q, dados });
    }

    const blocoPerguntas = secoes.map((s) => `
    <section class="secao">
      <h2>${esc(s.nome)}</h2>
      ${s.itens.map(({ q, dados }) => {
        const fechada = ['single', 'multi', 'scale5', 'scale10'].includes(q.type);
        const corpo = fechada
            ? `<table class="contagem">${dados.contagem.map(([rot, n]) => `
                  <tr>
                    <td class="rot">${esc(rot)}</td>
                    <td class="barra"><span style="width:${Math.round((n / dados.respostas.length) * 100)}%"></span></td>
                    <td class="n">${n} <small>${Math.round((n / dados.respostas.length) * 100)}%</small></td>
                  </tr>`).join('')}</table>`
            : `<ul class="livres">${dados.respostas.map((r) => `
                  <li><span class="quem">#${esc(r.respondente)}</span>${esc(r.texto)}</li>`).join('')}</ul>`;
        return `
        <article class="pergunta">
          <h3>${esc(q.title)}</h3>
          <p class="meta">${esc(q.type)} · ${dados.respostas.length} de ${totalRespondentes} responderam${q.type === 'multi' ? ' · multipla escolha' : ''}</p>
          ${corpo}
        </article>`;
    }).join('')}
    </section>`).join('');

    const blocoRespondentes = respostas.map((r, i) => `
    <details class="respondente">
      <summary><b>#${i + 1}</b> · ${esc((r.criadoEm || '').slice(0, 16).replace('T', ' '))} · ${r.totalRespostas} respostas · ${r.duracaoSegundos ? `${Math.round(r.duracaoSegundos / 60)} min` : 'duração —'} · ${esc(r.viewport || '—')} · ${esc(r.origem || 'sem origem')}</summary>
      <dl>
        ${perguntas.filter((q) => r.answers && r.answers[q.id] !== undefined).map((q) => `
          <dt>${esc(q.title)}</dt>
          <dd>${(descreverResposta(q, r.answers[q.id], r.answers) || []).map((v) => esc(v)).join('<br>')}</dd>`).join('')}
      </dl>
    </details>`).join('');

    const avisoOrfas = orfas.length === 0 ? '' : `
    <p class="aviso"><b>${orfas.length} chave(s) de resposta sem pergunta correspondente</b> no formulário atual
    (${esc(orfas.join(', '))}). Isso acontece se o questionário mudou depois da coleta — os valores estão no JSON.</p>`;

    return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Respostas da pesquisa ComplianceHub</title>
<style>
:root{--tinta:#17343B;--primaria:#2E6F62;--linha:#DCE3E0;--papel:#F7F9F8;--fraco:#66787D}
*{box-sizing:border-box}
body{margin:0;background:var(--papel);color:#22383C;font:15px/1.55 -apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:920px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:28px;margin:0 0 6px;color:var(--tinta);letter-spacing:-.02em}
.sub{color:var(--fraco);font-size:13px;margin:0 0 24px}
.cartoes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:30px}
.cartao{background:#fff;border:1px solid var(--linha);padding:14px}
.cartao b{display:block;font-size:24px;color:var(--primaria)}
.cartao span{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--fraco)}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--primaria);margin:36px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--linha)}
.pergunta{background:#fff;border:1px solid var(--linha);padding:16px 18px;margin-bottom:12px}
.pergunta h3{font-size:16px;margin:0 0 4px;color:var(--tinta);font-weight:600}
.meta{font-size:11px;color:var(--fraco);margin:0 0 12px}
table.contagem{width:100%;border-collapse:collapse}
table.contagem td{padding:3px 0;vertical-align:middle}
td.rot{font-size:13px;width:45%;padding-right:12px}
td.barra{width:40%}
td.barra span{display:block;height:14px;background:var(--primaria);min-width:2px}
td.n{font-size:13px;text-align:right;width:15%;white-space:nowrap}
td.n small{color:var(--fraco)}
ul.livres{list-style:none;margin:0;padding:0}
ul.livres li{border-left:3px solid var(--primaria);background:#FAFCFB;padding:10px 12px;margin-bottom:7px;font-size:14px;white-space:pre-wrap}
.quem{display:block;font-size:10px;color:var(--fraco);margin-bottom:3px}
.respondente{background:#fff;border:1px solid var(--linha);margin-bottom:7px}
.respondente summary{cursor:pointer;padding:11px 14px;font-size:13px}
.respondente dl{margin:0;padding:4px 16px 16px;border-top:1px solid var(--linha)}
.respondente dt{font-size:12px;color:var(--fraco);margin-top:12px}
.respondente dd{margin:3px 0 0;font-size:14px;white-space:pre-wrap}
.aviso{background:#FDF6E9;border-left:3px solid #C9922F;padding:11px 13px;font-size:13px}
@media(max-width:600px){td.rot{width:auto;display:block}td.barra{display:none}.wrap{padding:20px 14px 48px}}
</style></head><body><div class="wrap">
<h1>Respostas da pesquisa</h1>
<p class="sub">ComplianceHub · gerado em ${esc(geradoEm)}${INCLUIR_TESTES ? ' · inclui envios de teste' : ' · envios de teste excluídos'}</p>
<div class="cartoes">
  <div class="cartao"><b>${totalRespondentes}</b><span>respondentes</span></div>
  <div class="cartao"><b>${medianaMin === null ? '—' : `${medianaMin} min`}</b><span>tempo mediano</span></div>
  <div class="cartao"><b>${porPergunta.size}</b><span>perguntas com resposta</span></div>
</div>
${avisoOrfas}
${blocoPerguntas}
<h2>Respostas completas, por pessoa</h2>
${blocoRespondentes}
</div></body></html>`;
}

async function main() {
    const perguntas = carregarPerguntas();
    const porId = new Map(perguntas.map((q) => [q.id, q]));

    const token = await getAccessToken();
    let respostas = await buscarRespostas(token);
    if (!INCLUIR_TESTES) respostas = respostas.filter((r) => !ORIGENS_DE_TESTE.has(r.origem));
    respostas.sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));

    if (respostas.length === 0) {
        console.log('Nenhuma resposta (fora as de teste). Use --incluir-testes para ver todas.');
        return;
    }

    // Agrega por pergunta e detecta chaves gravadas que nao existem mais no formulario.
    const porPergunta = new Map();
    const orfas = new Set();
    respostas.forEach((r, i) => {
        for (const [chave, valor] of Object.entries(r.answers || {})) {
            // O formulario grava o texto de "Outro" numa chave irma `<id>__other`
            // (otherKey em public/pesquisa.html). Nao e pergunta propria: entra
            // junto da resposta de origem, senao o que a pessoa escreveu some.
            if (chave.endsWith('__other')) continue;
            const q = porId.get(chave);
            if (!q) { orfas.add(chave); continue; }
            if (!porPergunta.has(chave)) porPergunta.set(chave, { respostas: [], contagem: [] });
            const descrito = descreverResposta(q, valor, r.answers);
            if (!descrito) continue;
            porPergunta.get(chave).respostas.push({ respondente: i + 1, texto: descrito.join(' | '), valores: descrito });
        }
    });
    for (const [chave, dados] of porPergunta) {
        const q = porId.get(chave);
        if (!['single', 'multi', 'scale5', 'scale10'].includes(q.type)) continue;
        const contador = new Map();
        dados.respostas.forEach((r) => r.valores.forEach((v) => contador.set(v, (contador.get(v) || 0) + 1)));
        dados.contagem = [...contador.entries()].sort((a, b) => b[1] - a[1]);
    }

    const geradoEm = respostas[respostas.length - 1].criadoEm || 'data desconhecida';
    const html = montarHtml({ perguntas, respostas, porPergunta, orfas: [...orfas], geradoEm });

    fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
    fs.writeFileSync(SAIDA, html, 'utf-8');
    const caminhoJson = SAIDA.replace(/\.html$/, '.json');
    fs.writeFileSync(caminhoJson, JSON.stringify({ geradoEm, respostas }, null, 2), 'utf-8');

    console.log(`${respostas.length} respondente(s), ${porPergunta.size} perguntas com resposta.`);
    if (orfas.size) console.log(`Chaves sem pergunta correspondente: ${[...orfas].join(', ')}`);
    console.log(`HTML: ${SAIDA}`);
    console.log(`JSON: ${caminhoJson}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
