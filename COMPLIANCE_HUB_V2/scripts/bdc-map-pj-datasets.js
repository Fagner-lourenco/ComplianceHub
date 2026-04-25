#!/usr/bin/env node
/**
 * BDC Map PJ Datasets
 */

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env.bdc');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const BASE_URL = 'https://plataforma.bigdatacorp.com.br';
const RESULTS_DIR = path.resolve(__dirname, '..', 'bdc_api_results');

const CNPJS = [
  { doc: '42975374000172', id: 'empresa_1', nome: 'NOVAX INTELIGENCIA SOLUCOES INTEGRADAS LTDA' },
  { doc: '13783221000478', id: 'empresa_2', nome: 'CNPJ 13.783.221/0004-78' },
];

const DATASETS_PJ = [
  { key: 'government_debtors', endpoint: '/empresas', cost: 0.05 },
  { key: 'collections', endpoint: '/empresas', cost: 0.07 },
  { key: 'phones_extended', endpoint: '/empresas', cost: 0.05 },
  { key: 'addresses_extended', endpoint: '/empresas', cost: 0.05 },
  { key: 'emails_extended', endpoint: '/empresas', cost: 0.05 },
  { key: 'online_presence', endpoint: '/empresas', cost: 0.05 },
  { key: 'financial_data', endpoint: '/empresas', cost: 0.05 },
  { key: 'history_basic_data', endpoint: '/empresas', cost: 0.05 },
  { key: 'dynamic_qsa_data', endpoint: '/empresas', cost: 0.09 },
  { key: 'owners_lawsuits', endpoint: '/empresas', cost: 0.13 },
  { key: 'employees_kyc', endpoint: '/empresas', cost: 0.41 },
  { key: 'economic_group_kyc', endpoint: '/empresas', cost: 0.41 },
  { key: 'merchant_category_data', endpoint: '/empresas', cost: 0.05 },
  { key: 'syndicate_agreements', endpoint: '/empresas', cost: 0.05 },
  { key: 'social_conscience', endpoint: '/empresas', cost: 0.05 },
  { key: 'media_profile_and_exposure', endpoint: '/empresas', cost: 0.05 },
  { key: 'online_ads', endpoint: '/empresas', cost: 0.05 },
  { key: 'property_data', endpoint: '/empresas', cost: 0.05 },
  { key: 'awards_and_certifications', endpoint: '/empresas', cost: 0.09 },
  { key: 'lawsuits_distribution_data', endpoint: '/empresas', cost: 0.05 },
];

const credentials = {
  accessToken: process.env.BIGDATACORP_ACCESS_TOKEN,
  tokenId: process.env.BIGDATACORP_TOKEN_ID,
};

if (!credentials.accessToken || !credentials.tokenId) {
  console.error('Credenciais nao encontradas');
  process.exit(1);
}

async function bdcCall(endpoint, body) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
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
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function save(subdir, filename, data) {
  const dir = path.join(RESULTS_DIR, subdir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(data, null, 2), 'utf-8');
}

function extractResultInfo(data) {
  const entry = Array.isArray(data?.Result) ? data.Result[0] : null;
  if (!entry) return { hasData: false, keys: [], sampleSize: 0 };
  const keys = Object.keys(entry).filter(k => k !== 'MatchKeys');
  const sampleSize = JSON.stringify(entry).length;
  return { hasData: keys.length > 0, keys, sampleSize };
}

async function main() {
  console.log('BDC Map PJ Datasets');
  console.log('===================\n');

  const report = {
    generatedAt: new Date().toISOString(),
    totalCnpjs: CNPJS.length,
    totalDatasets: DATASETS_PJ.length,
    estimatedCostBRL: DATASETS_PJ.reduce((s, d) => s + d.cost, 0) * CNPJS.length,
    results: {},
  };

  let callCount = 0;
  let successCount = 0;
  let emptyCount = 0;
  let errorCount = 0;

  for (const target of CNPJS) {
    console.log(`\n--- ${target.id} | ${target.doc} ---`);
    report.results[target.id] = { doc: target.doc, nome: target.nome, datasets: {} };

    for (const ds of DATASETS_PJ) {
      callCount++;
      const datasetStr = ds.key === 'media_profile_and_exposure' ? `${ds.key}.limit(100)` : ds.key;
      const body = { q: `doc{${target.doc}}`, Datasets: datasetStr, Limit: 1 };
      const filename = `${ds.key}.json`;
      process.stdout.write(`  [${callCount.toString().padStart(3)}] ${ds.key.padEnd(30)} ... `);

      try {
        const data = await bdcCall(ds.endpoint, body);
        save(target.id, filename, data);
        const info = extractResultInfo(data);
        const statusCode = data?.Status?.[ds.key]?.[0]?.Code;

        if (!info.hasData || statusCode !== 0) {
          emptyCount++;
          console.log(`EMPTY${statusCode !== undefined ? ` (Status ${statusCode})` : ''}`);
          report.results[target.id].datasets[ds.key] = { status: 'empty', statusCode, keys: info.keys };
        } else {
          successCount++;
          console.log(`OK -- ${info.keys.join(', ')} (${info.sampleSize} bytes)`);
          report.results[target.id].datasets[ds.key] = { status: 'ok', keys: info.keys, sampleSize: info.sampleSize };
        }
      } catch (err) {
        errorCount++;
        console.log(`ERROR -- ${err.message}`);
        save(target.id, `ERROR_${filename}`, { error: err.message, dataset: ds.key, doc: target.doc, timestamp: new Date().toISOString() });
        report.results[target.id].datasets[ds.key] = { status: 'error', error: err.message };
      }
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  report.summary = { totalCalls: callCount, success: successCount, empty: emptyCount, errors: errorCount };
  save('', '_PJ_DATASET_MAPPING.json', report);

  console.log('\n===================');
  console.log('Resumo');
  console.log(`Total: ${callCount} | OK: ${successCount} | Vazio: ${emptyCount} | Erro: ${errorCount}`);
  console.log(`Custo: R$ ${report.estimatedCostBRL.toFixed(2)}`);
  console.log('===================');
}

main().catch(console.error);
