/**
 * BDC Run All — Executa chamadas batch para todos os CPFs e CNPJs
 * em múltiplos endpoints e salva os resultados.
 */

const fs = require('fs');
const path = require('path');

// Load credentials from .env.bdc
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

const CPFS = [
  { doc: '48052053854', id: 'pessoa_1' },
  { doc: '10794180329', id: 'pessoa_2' },
  { doc: '11819916766', id: 'pessoa_3' },
  { doc: '05023290336', id: 'pessoa_4' },
  { doc: '46247243804', id: 'pessoa_5' },
];

const CNPJS = [
  { doc: '42975374000172', id: 'empresa_1' },
  { doc: '13783221000478', id: 'empresa_2' },
];

const DATASETS_PF = [
  'basic_data',
  'kyc',
  'processes.limit(100)',
  'occupation_data',
  'phones_extended',
  'addresses_extended',
  'emails_extended',
  'online_presence',
  'financial_data',
  'class_organization',
  'government_debtors',
  'collections',
  'historical_basic_data',
  'financial_risk',
  'indebtedness_question',
  'media_profile_and_exposure',
  'lawsuits_distribution_data',
];

const DATASETS_PJ = [
  'basic_data',
  'kyc',
  'relationships',
  'processes.limit(100)',
  'activity_indicators',
  'company_evolution',
  'owners_kyc',
];

const credentials = {
  accessToken: process.env.BIGDATACORP_ACCESS_TOKEN,
  tokenId: process.env.BIGDATACORP_TOKEN_ID,
};

if (!credentials.accessToken || !credentials.tokenId) {
  console.error('Credenciais não encontradas em .env.bdc');
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

async function runBatch(targets, endpoint, datasets, typeLabel) {
  for (const target of targets) {
    for (const dataset of datasets) {
      const body = {
        q: `doc{${target.doc}}`,
        Datasets: dataset,
        Limit: 1,
      };
      const filename = `${dataset.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
      console.log(`[${typeLabel}] ${target.id} | ${target.doc} | ${dataset} ...`);
      try {
        const data = await bdcCall(endpoint, body);
        save(target.id, filename, data);
        const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;
        const keys = resultEntry ? Object.keys(resultEntry).filter(k => k !== 'MatchKeys') : [];
        console.log(`  ✅ OK — ${keys.join(', ') || 'vazio'}`);
        if (data?.Status?.Code !== undefined && data.Status.Code !== 0) {
          console.log(`  ⚠️ Status: ${data.Status.Code}`);
        }
      } catch (err) {
        console.log(`  ❌ ERRO — ${err.message}`);
        // Save error for reference
        save(target.id, `ERROR_${filename}`, { error: err.message, dataset, doc: target.doc, timestamp: new Date().toISOString() });
      }
      await new Promise(r => setTimeout(r, 1200)); // polite delay
    }
  }
}

async function main() {
  console.log('========================================');
  console.log('BDC Run All — Iniciando chamadas');
  console.log('========================================\n');

  console.log('--- PF (Pessoas) ---');
  await runBatch(CPFS, '/pessoas', DATASETS_PF, 'PF');

  console.log('\n--- PJ (Empresas) ---');
  await runBatch(CNPJS, '/empresas', DATASETS_PJ, 'PJ');

  console.log('\n========================================');
  console.log('Finalizado! Resultados em bdc_api_results/');
  console.log('========================================');
}

main().catch(console.error);
