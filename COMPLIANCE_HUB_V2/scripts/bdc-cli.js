#!/usr/bin/env node
/**
 * BDC CLI — Ferramenta de chamadas à API BigDataCorp
 *
 * Uso:
 *   node scripts/bdc-cli.js --cpf 48052053854 --dataset basic_data
 *   node scripts/bdc-cli.js --cpf 48052053854 --dataset "basic_data,kyc,processes.limit(100)"
 *   node scripts/bdc-cli.js --cnpj 42975374000172 --dataset basic_data
 *   node scripts/bdc-cli.js --batch-pf --dataset phones_extended
 *
 * Credenciais:
 *   1. Variáveis de ambiente: BIGDATACORP_ACCESS_TOKEN e BIGDATACORP_TOKEN_ID
 *   2. Parâmetros --token e --tokenId
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BIGDATACORP_BASE_URL || 'https://plataforma.bigdatacorp.com.br';
const RESULTS_DIR = path.resolve(__dirname, '..', 'bdc_api_results');

// CPFs de teste migrados da V1
const TEST_CPFS = [
  { doc: '48052053854', id: 'pessoa_1', nome: 'ANDRE LUIZ CRUZ DOS SANTOS', uf: 'SP', risco: 'ALTO' },
  { doc: '10794180329', id: 'pessoa_2', nome: 'DIEGO EMANUEL ALVES DE SOUZA', uf: 'CE', risco: 'BAIXO' },
  { doc: '11819916766', id: 'pessoa_3', nome: 'RENAN GUIMARAES DE SOUSA AUGUSTO', uf: 'RJ', risco: 'BAIXO' },
  { doc: '05023290336', id: 'pessoa_4', nome: 'FRANCISCO TACIANO DE SOUSA', uf: 'CE', risco: 'CRITICO' },
  { doc: '46247243804', id: 'pessoa_5', nome: 'MATHEUS GONCALVES DOS SANTOS', uf: 'SP', risco: 'MEDIO' },
];

// CNPJs de teste fornecidos
const TEST_CNPJS = [
  { doc: '42975374000172', id: 'empresa_1', nome: 'CNPJ 42.975.374/0001-72' },
  { doc: '13783221000478', id: 'empresa_2', nome: 'CNPJ 13.783.221/0004-78' },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--cpf') opts.cpf = args[++i];
    else if (key === '--cnpj') opts.cnpj = args[++i];
    else if (key === '--dataset') opts.dataset = args[++i];
    else if (key === '--batch-pf') opts.batchPf = true;
    else if (key === '--batch-pj') opts.batchPj = true;
    else if (key === '--token') opts.token = args[++i];
    else if (key === '--tokenId') opts.tokenId = args[++i];
    else if (key === '--out') opts.out = args[++i];
    else if (key === '--help' || key === '-h') opts.help = true;
  }
  return opts;
}

function getCredentials(opts) {
  const token = opts.token || process.env.BIGDATACORP_ACCESS_TOKEN;
  const tokenId = opts.tokenId || process.env.BIGDATACORP_TOKEN_ID;
  if (!token || !tokenId) {
    console.error('❌ Credenciais BDC não encontradas.');
    console.error('   Defina BIGDATACORP_ACCESS_TOKEN e BIGDATACORP_TOKEN_ID como variáveis de ambiente,');
    console.error('   ou passe --token e --tokenId.');
    process.exit(1);
  }
  return { accessToken: token, tokenId };
}

async function bdcCall(endpoint, body, credentials) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'AccessToken': credentials.accessToken,
      'TokenId': credentials.tokenId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function saveResult(subdir, filename, data) {
  const dir = path.join(RESULTS_DIR, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`💾 Salvo: ${filepath}`);
  return filepath;
}

function printHelp() {
  console.log(`
BDC CLI — BigDataCorp API Caller
=================================

Chamadas individuais:
  node scripts/bdc-cli.js --cpf 48052053854 --dataset basic_data
  node scripts/bdc-cli.js --cpf 48052053854 --dataset "basic_data,kyc"
  node scripts/bdc-cli.js --cnpj 42975374000172 --dataset basic_data

Batch:
  node scripts/bdc-cli.js --batch-pf --dataset phones_extended
  node scripts/bdc-cli.js --batch-pj --dataset basic_data
  node scripts/bdc-cli.js --batch-pf --dataset "basic_data,kyc,processes.limit(100)"

Parâmetros:
  --cpf <cpf>        CPF da pessoa (somente números)
  --cnpj <cnpj>      CNPJ da empresa (somente números)
  --dataset <ds>     Dataset(s) separados por vírgula
  --batch-pf         Executa para todos os 5 CPFs de teste
  --batch-pj         Executa para todos os 2 CNPJs de teste
  --token <t>        AccessToken BDC (override env)
  --tokenId <id>     TokenId BDC (override env)
  --out <dir>        Subpasta de saída (default: auto)
  --help             Este help

Datasets populares PF:
  basic_data, kyc, processes.limit(100), occupation_data,
  emails_extended, phones_extended, addresses_extended,
  historical_basic_data, online_presence, financial_data,
  class_organization, government_debtors, collections,
  financial_risk, indebtedness_question, media_profile_and_exposure,
  lawsuits_distribution_data

Datasets populares PJ:
  basic_data, kyc, owners_kyc, processes.limit(100),
  relationships, dynamic_qsa_data, company_evolution,
  activity_indicators, collections, syndicate_agreements
`);
}

async function main() {
  const opts = parseArgs();
  if (opts.help) {
    printHelp();
    return;
  }

  const credentials = getCredentials(opts);

  const targets = [];
  if (opts.batchPf) {
    TEST_CPFS.forEach(t => targets.push({ type: 'pf', ...t }));
  } else if (opts.batchPj) {
    TEST_CNPJS.forEach(t => targets.push({ type: 'pj', ...t }));
  } else if (opts.cpf) {
    targets.push({ type: 'pf', doc: opts.cpf, id: `cpf_${opts.cpf}` });
  } else if (opts.cnpj) {
    targets.push({ type: 'pj', doc: opts.cnpj, id: `cnpj_${opts.cnpj}` });
  } else {
    console.error('❌ Especifique --cpf, --cnpj, --batch-pf ou --batch-pj');
    printHelp();
    process.exit(1);
  }

  if (!opts.dataset) {
    console.error('❌ Especifique --dataset');
    process.exit(1);
  }

  for (const target of targets) {
    const endpoint = target.type === 'pf' ? '/pessoas' : '/empresas';
    const body = {
      q: `doc{${target.doc}}`,
      Datasets: opts.dataset,
      Limit: 1,
    };

    console.log(`\n🔍 ${target.type.toUpperCase()} ${target.doc} (${target.nome || ''})`);
    console.log(`   POST ${BASE_URL}${endpoint}  |  Datasets: ${opts.dataset}`);

    try {
      const data = await bdcCall(endpoint, body, credentials);
      const outDir = opts.out || target.id;
      const filename = `${opts.dataset.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
      saveResult(outDir, filename, data);

      const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;
      const keys = resultEntry ? Object.keys(resultEntry).filter(k => k !== 'MatchKeys') : [];
      console.log(`   ✅ OK | Retornou: ${keys.join(', ') || 'NENHUM'}`);
      if (data?.Status?.Code !== undefined && data.Status.Code !== 0) {
        console.log(`   ⚠️  Status Code: ${data.Status.Code} — ${data.Status.Message || ''}`);
      }
    } catch (err) {
      console.error(`   ❌ Erro: ${err.message}`);
    }

    if (targets.length > 1) await new Promise(r => setTimeout(r, 1000));
  }
}

main().catch(console.error);
