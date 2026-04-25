#!/usr/bin/env node
/**
 * BDC Map PF Datasets — Mapeia endpoints BDC restantes para PF
 *
 * Executa chamadas individuais para 15 datasets faltantes nos 5 CPFs de teste.
 * Salva resultados em bdc_api_results/ e gera relatório de cobertura.
 *
 * Uso:
 *   node scripts/bdc-map-pf-datasets.js
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
  { doc: '48052053854', id: 'pessoa_1', nome: 'ANDRE LUIZ CRUZ DOS SANTOS', uf: 'SP', risco: 'ALTO' },
  { doc: '10794180329', id: 'pessoa_2', nome: 'DIEGO EMANUEL ALVES DE SOUZA', uf: 'CE', risco: 'BAIXO' },
  { doc: '11819916766', id: 'pessoa_3', nome: 'RENAN GUIMARAES DE SOUSA AUGUSTO', uf: 'RJ', risco: 'BAIXO' },
  { doc: '05023290336', id: 'pessoa_4', nome: 'FRANCISCO TACIANO DE SOUSA', uf: 'CE', risco: 'CRITICO' },
  { doc: '46247243804', id: 'pessoa_5', nome: 'MATHEUS GONCALVES DOS SANTOS', uf: 'SP', risco: 'MEDIO' },
];

// Datasets faltantes para PF (não estão nos presets/scripts atuais)
const DATASETS_PF = [
  { key: 'government_debtors', endpoint: '/pessoas', cost: 0.05, note: 'Devedor do governo' },
  { key: 'collections', endpoint: '/pessoas', cost: 0.07, note: 'Presença em cobrança' },
  { key: 'historical_basic_data', endpoint: '/pessoas', cost: 0.03, note: 'Histórico cadastral' },
  { key: 'financial_risk', endpoint: '/pessoas', cost: 0.05, note: 'Risco financeiro' },
  { key: 'indebtedness_question', endpoint: '/pessoas', cost: 0.09, note: 'Probabilidade de negativação' },
  { key: 'university_student_data', endpoint: '/pessoas', cost: 0.05, note: 'Dados acadêmicos' },
  { key: 'profession_data', endpoint: '/pessoas', cost: 0.05, note: 'Dados profissionais' },
  { key: 'awards_and_certifications', endpoint: '/pessoas', cost: 0.09, note: 'Prêmios e certificações' },
  { key: 'sports_exposure', endpoint: '/pessoas', cost: 0.07, note: 'Exposição esportiva' },
  { key: 'political_involvement', endpoint: '/pessoas', cost: 0.05, note: 'Envolvimento político' },
  { key: 'election_candidate_data', endpoint: '/pessoas', cost: 0.05, note: 'Dados eleitorais' },
  { key: 'online_ads', endpoint: '/pessoas', cost: 0.05, note: 'Anúncios online' },
  { key: 'media_profile_and_exposure', endpoint: '/pessoas', cost: 0.05, note: 'Exposição na mídia (paginado)' },
  { key: 'lawsuits_distribution_data', endpoint: '/pessoas', cost: 0.05, note: 'Distribuição de processos' },
  { key: 'property_data', endpoint: '/pessoas', cost: 0.05, note: 'Propriedades e ativos' },
];

const credentials = {
  accessToken: process.env.BIGDATACORP_ACCESS_TOKEN,
  tokenId: process.env.BIGDATACORP_TOKEN_ID,
};

if (!credentials.accessToken || !credentials.tokenId) {
  console.error('❌ Credenciais não encontradas em .env.bdc');
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
  console.log('========================================');
  console.log('BDC Map PF Datasets — Mapeamento Completo');
  console.log('========================================\n');

  const report = {
    generatedAt: new Date().toISOString(),
    totalCpfs: CPFS.length,
    totalDatasets: DATASETS_PF.length,
    estimatedCostBRL: DATASETS_PF.reduce((s, d) => s + d.cost, 0) * CPFS.length,
    results: {},
  };

  let callCount = 0;
  let successCount = 0;
  let emptyCount = 0;
  let errorCount = 0;

  for (const target of CPFS) {
    console.log(`\n--- ${target.id} | ${target.nome} | ${target.doc} ---`);
    report.results[target.id] = {
      doc: target.doc,
      nome: target.nome,
      uf: target.uf,
      risco: target.risco,
      datasets: {},
    };

    for (const ds of DATASETS_PF) {
      callCount++;
      const datasetStr = ds.key === 'media_profile_and_exposure'
        ? `${ds.key}.limit(100)`
        : ds.key;

      const body = {
        q: `doc{${target.doc}}`,
        Datasets: datasetStr,
        Limit: 1,
      };

      const filename = `${ds.key}.json`;
      process.stdout.write(`  [${callCount.toString().padStart(3)}] ${ds.key.padEnd(30)} ... `);

      try {
        const data = await bdcCall(ds.endpoint, body);
        save(target.id, filename, data);

        const info = extractResultInfo(data);
        const statusCode = data?.Status?.Code;
        const statusMsg = data?.Status?.Message;

        if (!info.hasData || statusCode !== 0) {
          emptyCount++;
          console.log(`⚪ VAZIO${statusCode !== undefined ? ` (Status ${statusCode}: ${statusMsg || '?'})` : ''}`);
          report.results[target.id].datasets[ds.key] = {
            status: 'empty',
            statusCode,
            statusMsg,
            keys: info.keys,
            sampleSize: info.sampleSize,
          };
        } else {
          successCount++;
          console.log(`✅ OK — ${info.keys.join(', ')} (${info.sampleSize} bytes)`);
          report.results[target.id].datasets[ds.key] = {
            status: 'ok',
            statusCode,
            keys: info.keys,
            sampleSize: info.sampleSize,
          };
        }
      } catch (err) {
        errorCount++;
        console.log(`❌ ERRO — ${err.message}`);
        save(target.id, `ERROR_${filename}`, { error: err.message, dataset: ds.key, doc: target.doc, timestamp: new Date().toISOString() });
        report.results[target.id].datasets[ds.key] = {
          status: 'error',
          error: err.message,
        };
      }

      await new Promise(r => setTimeout(r, 1200)); // polite delay
    }
  }

  // Generate summary report
  report.summary = {
    totalCalls: callCount,
    success: successCount,
    empty: emptyCount,
    errors: errorCount,
  };

  save('', '_PF_DATASET_MAPPING.json', report);

  console.log('\n========================================');
  console.log('Resumo');
  console.log('========================================');
  console.log(`Total chamadas: ${callCount}`);
  console.log(`✅ Com dados:   ${successCount}`);
  console.log(`⚪ Vazios:      ${emptyCount}`);
  console.log(`❌ Erros:       ${errorCount}`);
  console.log(`Custo estimado: R$ ${report.estimatedCostBRL.toFixed(2)}`);
  console.log(`\nRelatório: bdc_api_results/_PF_DATASET_MAPPING.json`);
  console.log('========================================');
}

main().catch(console.error);
