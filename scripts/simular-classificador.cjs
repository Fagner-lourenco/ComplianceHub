#!/usr/bin/env node
'use strict';

/**
 * simular-classificador.cjs
 *
 * Responde "se eu mudar esta regra, quantos casos mudariam de veredito e quais?"
 * SEM tocar em producao.
 *
 * COMO FUNCIONA
 * Le os casos ja armazenados no Firestore e roda o classificador REAL
 * (functions/modules/autoClassification.js, funcao pura) duas vezes sobre o mesmo
 * caso: uma com as regras de hoje e outra com a variante proposta. Depois compara.
 *
 * Nao ha reimplementacao de regra aqui — as variantes apenas alteram a ENTRADA
 * (ex.: recalculam isCriminal de um processo) e deixam o classificador de verdade
 * decidir. Isso evita o erro classico de manter um "mirror" das regras no script,
 * que envelhece e passa a mentir.
 *
 * ESTE SCRIPT NAO ESCREVE NADA. Nao existe flag --execute; ele so faz GET.
 *
 * Uso:
 *   node scripts/simular-classificador.cjs --variante=crime-amplo
 *   node scripts/simular-classificador.cjs --variante=baseline --limite=500
 *   node scripts/simular-classificador.cjs --lista           # lista as variantes
 *
 * Saida: resumo no terminal + JSON completo em scripts/out/simulacao-<variante>.json
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const { computeAutoClassification } = require(path.join(__dirname, '../functions/modules/autoClassification'));
const { calculateRisk } = require(path.join(__dirname, '../functions/shared/riskCalculator'));
const { buildProcessText } = require(path.join(__dirname, '../functions/helpers/crimeTypeFilter'));

// ─── Config ──────────────────────────────────────────────────────────────────
const PROJECT_ID = 'compliance-hub-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const BASE_HOST = 'firestore.googleapis.com';
const DB_PATH = 'projects/' + PROJECT_ID + '/databases/(default)/documents';
const OUT_DIR = path.join(__dirname, 'out');

const argOf = (nome, padrao) => {
    const hit = process.argv.find((a) => a.startsWith('--' + nome + '='));
    return hit ? hit.split('=').slice(1).join('=') : padrao;
};
const VARIANTE = argOf('variante', 'baseline');
const LIMITE = Number(argOf('limite', '0')) || 0;
const SO_DONE = !process.argv.includes('--todos');

// ─── HTTP ────────────────────────────────────────────────────────────────────
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
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
        },
    }, postData);
    if (res.status !== 200) throw new Error('Falha no token: ' + JSON.stringify(res.body));
    return res.body.access_token;
}

// Decoder completo (o fromFV do backfill-risk-consistency nao cobre map/timestamp,
// e escavador2Processos e um array de maps).
function fromFV(val) {
    if (!val || typeof val !== 'object') return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
    if (val.doubleValue !== undefined) return val.doubleValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.timestampValue !== undefined) return val.timestampValue;
    if (val.nullValue !== undefined) return null;
    if (val.arrayValue) return (val.arrayValue.values || []).map(fromFV);
    if (val.mapValue) return fromFields(val.mapValue.fields || {});
    return null;
}

function fromFields(fields) {
    const out = {};
    for (const [k, v] of Object.entries(fields || {})) out[k] = fromFV(v);
    return out;
}

async function listarCasos(token) {
    const casos = [];
    let pageToken = null;
    let paginas = 0;
    do {
        const qs = 'pageSize=300' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
        const res = await httpsRequest({
            hostname: BASE_HOST,
            path: '/v1/' + DB_PATH + '/cases?' + qs,
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
        });
        if (res.status !== 200) throw new Error('Erro ao listar cases: ' + JSON.stringify(res.body));
        paginas += 1;
        for (const d of (res.body.documents || [])) {
            const data = fromFields(d.fields);
            if (SO_DONE && data.status !== 'DONE') continue;
            casos.push({ id: d.name.split('/').pop(), data });
            if (LIMITE && casos.length >= LIMITE) return { casos, paginas };
        }
        pageToken = res.body.nextPageToken || null;
        process.stderr.write(`\r  paginas lidas: ${paginas} | casos: ${casos.length}   `);
    } while (pageToken);
    process.stderr.write('\n');
    return { casos, paginas };
}

// ─── Variantes ───────────────────────────────────────────────────────────────
// Cada variante recebe o caseData e devolve uma COPIA modificada da entrada.
// A decisao continua sendo do classificador real.

const CARTA_PRECATORIA = /\bCARTA\s+PRECATORIA\s+CRIMINAL\b/i;
// Proposta: hoje o padrao tem o typo DEPONIMENTO (palavra inexistente) e nao cobre
// oitiva/inquiricao — carta precatoria de mera oitiva passa como processo criminal.
const CARTA_PRECATORIA_RUIDO_NOVO = /\b(INTIMACAO|NOTIFICACAO|DEPOIMENTO|DEPONIMENTO|OITIVA|INQUIRICAO|PROVAS|CITACAO)\b/i;

const VARIANTES = {
    baseline: {
        descricao: 'Nao muda nada. Serve para validar o proprio harness: recalcula com as regras de HOJE e compara com o que esta gravado.',
        aplicar: (caseData) => caseData,
    },

    'crime-amplo': {
        descricao: 'Crime passa a ser tudo que a fonte classifica como criminal, EXCETO as exclusoes taxativas. Hoje exige lista branca (CRIMINAL_INDICATOR_PATTERN) ou risco_material do provedor.',
        aplicar: (caseData) => {
            const processos = caseData.escavador2Processos;
            if (!Array.isArray(processos) || processos.length === 0) return caseData;
            return {
                ...caseData,
                escavador2Processos: processos.map((p) => {
                    if (!p || p.area !== 'CRIMINAL') return p;
                    // A exclusao taxativa ja foi decidida pelo modulo real no
                    // enriquecimento e esta gravada em isExcludedCrimeType.
                    // CONSUMER_CIVIL_NOISE zera; as demais mantem isCriminal
                    // para cair no tier de ATENCAO.
                    const ehFalsoPositivoCivel = p.isExcludedCrimeType === 'CONSUMER_CIVIL_NOISE';
                    return { ...p, isCriminal: !ehFalsoPositivoCivel };
                }),
            };
        },
    },

    'carta-precatoria': {
        descricao: 'Corrige o typo DEPONIMENTO e acrescenta DEPOIMENTO/OITIVA/INQUIRICAO ao ruido de carta precatoria.',
        aplicar: (caseData) => {
            const processos = caseData.escavador2Processos;
            if (!Array.isArray(processos) || processos.length === 0) return caseData;
            return {
                ...caseData,
                escavador2Processos: processos.map((p) => {
                    if (!p || p.isExcludedCrimeType) return p;
                    const texto = buildProcessText(p);
                    if (CARTA_PRECATORIA.test(texto) && CARTA_PRECATORIA_RUIDO_NOVO.test(texto)) {
                        return { ...p, isCriminal: true, isExcludedCrimeType: 'CARTA_PRECATORIA_NOISE' };
                    }
                    return p;
                }),
            };
        },
    },
};

// ─── Avaliacao ───────────────────────────────────────────────────────────────
const CAMPOS_FLAG = ['criminalFlag', 'laborFlag', 'warrantFlag'];

function vereditoDe(caseData, classificacao) {
    const entrada = {
        criminalFlag: classificacao.criminalFlag || caseData.criminalFlag,
        criminalSeverity: classificacao.criminalSeverity || caseData.criminalSeverity,
        laborFlag: classificacao.laborFlag || caseData.laborFlag,
        warrantFlag: classificacao.warrantFlag || caseData.warrantFlag,
        osintLevel: caseData.osintLevel,
        socialStatus: caseData.socialStatus,
        digitalFlag: caseData.digitalFlag,
        conflictInterest: caseData.conflictInterest,
        cpfPendingRegularization: caseData.cpfPendingRegularization === true,
    };
    return calculateRisk(entrada, caseData.enabledPhases);
}

function classificar(caseData) {
    try {
        return { ok: true, resultado: computeAutoClassification(caseData) || {} };
    } catch (err) {
        return { ok: false, erro: err.message };
    }
}

async function main() {
    if (process.argv.includes('--lista')) {
        console.log('Variantes disponiveis:\n');
        for (const [nome, v] of Object.entries(VARIANTES)) console.log(`  ${nome}\n    ${v.descricao}\n`);
        return;
    }

    const variante = VARIANTES[VARIANTE];
    if (!variante) {
        console.error(`Variante desconhecida: ${VARIANTE}. Use --lista para ver as opcoes.`);
        process.exit(1);
    }

    console.log(`Variante: ${VARIANTE}`);
    console.log(`  ${variante.descricao}\n`);
    console.log('Lendo casos (somente leitura)...');

    const token = await getAccessToken();
    const { casos, paginas } = await listarCasos(token);
    console.log(`Corpus: ${casos.length} casos${SO_DONE ? ' com status DONE' : ''} em ${paginas} paginas.\n`);

    const resumo = {
        variante: VARIANTE,
        descricao: variante.descricao,
        corpus: casos.length,
        erroClassificador: 0,
        editadoPeloAnalista: 0,
        regraMudouDesdeOCaso: 0,
        processosAlteradosPelaVariante: 0,
        casosComEntradaAlterada: 0,
        processosCriminaisSuprimidos: {},
        amostraSuprimidos: [],
        flagsMudaram: 0,
        vereditoMudou: 0,
        transicoesFlag: {},
        transicoesVeredito: {},
        semDadoEscavador2: 0,
        truncados: 0,
    };
    const detalhes = [];
    const divergencias = [];

    for (const { id, data } of casos) {
        if (data.escavador2PersistenceTruncated || data.escavador2ProcessOmissions) resumo.truncados += 1;
        if (!Array.isArray(data.escavador2Processos) || data.escavador2Processos.length === 0) resumo.semDadoEscavador2 += 1;

        const atual = classificar(data);
        if (!atual.ok) { resumo.erroClassificador += 1; continue; }

        // Sanidade do harness: recalcular hoje deveria reproduzir o que o
        // classificador gravou. Cuidado: o campo atual pode ter sido EDITADO pelo
        // analista. O valor original do pipeline fica em enrichmentOriginalValues,
        // entao a comparacao honesta e contra ele; so o que nao bate nem com o
        // original e divergencia de verdade do harness.
        const originais = data.enrichmentOriginalValues || {};
        for (const campo of CAMPOS_FLAG) {
            const gravado = data[campo];
            const original = originais[campo];
            const recalculado = atual.resultado[campo];
            if (!recalculado || !gravado) continue;

            if (recalculado === gravado) continue; // o codigo de hoje reproduz o que esta la: ok

            // Nao bateu. Duas explicacoes possiveis, e elas nao sao equivalentes:
            if (original && original !== gravado) {
                // O analista editou a flag depois do pipeline. O valor gravado nao e
                // palavra do classificador, entao nao ha o que conferir aqui.
                resumo.editadoPeloAnalista += 1;
                divergencias.push({ caseId: id, campo, original, gravado, recalculado, motivo: 'analista editou a flag apos o pipeline' });
                break;
            }
            // O gravado E a palavra do classificador, e hoje ele diria outra coisa:
            // a regra mudou desde que este caso rodou. Nao e erro do harness, mas
            // precisa aparecer, porque significa que o corpus mistura versoes de regra.
            resumo.regraMudouDesdeOCaso += 1;
            divergencias.push({ caseId: id, campo, original: original || null, gravado, recalculado, motivo: 'regra evoluiu desde que o caso foi classificado' });
            break;
        }

        // Diagnostico: a variante mexeu na ENTRADA? Sem isso nao da para
        // distinguir "regra nao muda nada" de "variante nao achou o que mudar".
        const dataVariante = variante.aplicar(data);
        const antes = data.escavador2Processos || [];
        const depois = dataVariante.escavador2Processos || [];
        let alteradosNesteCaso = 0;
        for (let i = 0; i < antes.length; i += 1) {
            if (!antes[i] || !depois[i]) continue;
            if (antes[i].isCriminal !== depois[i].isCriminal || antes[i].isExcludedCrimeType !== depois[i].isExcludedCrimeType) alteradosNesteCaso += 1;
        }
        if (alteradosNesteCaso > 0) {
            resumo.processosAlteradosPelaVariante += alteradosNesteCaso;
            resumo.casosComEntradaAlterada += 1;
        }
        // Populacao potencial: processo que a fonte diz ser criminal mas o
        // classificador nao conta hoje, agrupado pelo motivo.
        for (const p of antes) {
            if (!p || p.area !== 'CRIMINAL' || p.isCriminal === true) continue;
            const motivo = p.isExcludedCrimeType || (p.isMaterialRisk ? 'sem_motivo_aparente' : 'sem_indicador_na_lista_branca');
            resumo.processosCriminaisSuprimidos[motivo] = (resumo.processosCriminaisSuprimidos[motivo] || 0) + 1;
            if ((motivo === 'sem_motivo_aparente' || motivo === 'sem_indicador_na_lista_branca') && resumo.amostraSuprimidos.length < 25) {
                resumo.amostraSuprimidos.push({ caseId: id, motivo, classe: p.classe || null, assunto: p.assunto || null, subjects: p.subjects || null, classifications: p.classifications || null, riscoMaterial: p.isMaterialRisk === true, papel: p.roleCategory || null, cpfConfere: p.hasExactCpfMatch === true });
            }
        }

        const proposto = classificar(dataVariante);
        if (!proposto.ok) { resumo.erroClassificador += 1; continue; }

        const mudancasFlag = [];
        for (const campo of CAMPOS_FLAG) {
            const de = atual.resultado[campo] || null;
            const para = proposto.resultado[campo] || null;
            if (de !== para) {
                mudancasFlag.push({ campo, de, para });
                const chave = `${campo}: ${de} -> ${para}`;
                resumo.transicoesFlag[chave] = (resumo.transicoesFlag[chave] || 0) + 1;
            }
        }

        const vAtual = vereditoDe(data, atual.resultado);
        const vProposto = vereditoDe(data, proposto.resultado);
        const vereditoMudou = vAtual.suggestedVerdict !== vProposto.suggestedVerdict;
        if (vereditoMudou) {
            const chave = `${vAtual.suggestedVerdict} -> ${vProposto.suggestedVerdict}`;
            resumo.transicoesVeredito[chave] = (resumo.transicoesVeredito[chave] || 0) + 1;
            resumo.vereditoMudou += 1;
        }

        if (mudancasFlag.length > 0) {
            resumo.flagsMudaram += 1;
            detalhes.push({
                caseId: id,
                tenant: data.tenantId || null,
                statusCaso: data.status,
                vereditoFinalDoAnalista: data.finalVerdict || null,
                mudancasFlag,
                sugeridoAtual: vAtual.suggestedVerdict,
                sugeridoProposto: vProposto.suggestedVerdict,
                scoreAtual: vAtual.riskScore,
                scoreProposto: vProposto.riskScore,
                // amostra do que motivou a mudanca, sem dado pessoal
                processos: (data.escavador2Processos || [])
                    .filter((p) => p && p.area === 'CRIMINAL')
                    .slice(0, 5)
                    .map((p) => ({
                        classe: p.classe || null,
                        assunto: p.assunto || null,
                        excluidoPor: p.isExcludedCrimeType || null,
                        eraCriminal: p.isCriminal === true,
                        riscoMaterialProvedor: p.isMaterialRisk === true,
                        papel: p.roleCategory || null,
                        cpfConfere: p.hasExactCpfMatch === true,
                    })),
            });
        }
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const arquivo = path.join(OUT_DIR, `simulacao-${VARIANTE}.json`);
    fs.writeFileSync(arquivo, JSON.stringify({ resumo, divergencias, detalhes }, null, 2), 'utf-8');

    console.log('─'.repeat(60));
    console.log(`Casos analisados            : ${resumo.corpus}`);
    console.log(`Sem processos do Escavador2 : ${resumo.semDadoEscavador2}`);
    console.log(`Com dado truncado/omitido   : ${resumo.truncados}`);
    console.log(`Erro ao classificar         : ${resumo.erroClassificador}`);
    console.log(`Flag editada pelo analista  : ${resumo.editadoPeloAnalista}  (esperado; o gravado nao e palavra do classificador)`);
    console.log(`Regra evoluiu desde o caso  : ${resumo.regraMudouDesdeOCaso}  (corpus mistura versoes de regra)`);
    console.log('');
    console.log(`Processos alterados na entrada: ${resumo.processosAlteradosPelaVariante} (em ${resumo.casosComEntradaAlterada} casos)`);
    if (Object.keys(resumo.processosCriminaisSuprimidos).length) {
        console.log('Processos area=CRIMINAL que o classificador NAO conta hoje:');
        for (const [k, v] of Object.entries(resumo.processosCriminaisSuprimidos).sort((a, b) => b[1] - a[1])) console.log(`  ${v.toString().padStart(5)}x  ${k}`);
    }
    console.log('');
    console.log(`Casos com FLAG diferente    : ${resumo.flagsMudaram}`);
    console.log(`Casos com VEREDITO diferente: ${resumo.vereditoMudou}`);
    if (Object.keys(resumo.transicoesFlag).length) {
        console.log('\nTransicoes de flag:');
        for (const [k, v] of Object.entries(resumo.transicoesFlag).sort((a, b) => b[1] - a[1])) console.log(`  ${v.toString().padStart(5)}x  ${k}`);
    }
    if (Object.keys(resumo.transicoesVeredito).length) {
        console.log('\nTransicoes de veredito sugerido:');
        for (const [k, v] of Object.entries(resumo.transicoesVeredito).sort((a, b) => b[1] - a[1])) console.log(`  ${v.toString().padStart(5)}x  ${k}`);
    }
    console.log(`\nDetalhe completo: ${arquivo}`);
    console.log('Nenhuma escrita foi feita.');
}

main().catch((err) => { console.error('ERRO:', err.message); process.exit(1); });
