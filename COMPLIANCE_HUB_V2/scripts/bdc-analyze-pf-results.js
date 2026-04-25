#!/usr/bin/env node
/**
 * BDC Analyze PF Results
 * Reads JSONs from bdc_api_results/pessoa_N/ and generates reports.
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.resolve(__dirname, '..', 'bdc_api_results');

const CPFS = [
  { doc: '48052053854', id: 'pessoa_1', nome: 'ANDRE LUIZ CRUZ DOS SANTOS', uf: 'SP', risco: 'ALTO' },
  { doc: '10794180329', id: 'pessoa_2', nome: 'DIEGO EMANUEL ALVES DE SOUZA', uf: 'CE', risco: 'BAIXO' },
  { doc: '11819916766', id: 'pessoa_3', nome: 'RENAN GUIMARAES DE SOUSA AUGUSTO', uf: 'RJ', risco: 'BAIXO' },
  { doc: '05023290336', id: 'pessoa_4', nome: 'FRANCISCO TACIANO DE SOUSA', uf: 'CE', risco: 'CRITICO' },
  { doc: '46247243804', id: 'pessoa_5', nome: 'MATHEUS GONCALVES DOS SANTOS', uf: 'SP', risco: 'MEDIO' },
];

const DATASETS = [
  'government_debtors',
  'collections',
  'historical_basic_data',
  'financial_risk',
  'indebtedness_question',
  'university_student_data',
  'profession_data',
  'awards_and_certifications',
  'sports_exposure',
  'political_involvement',
  'election_candidate_data',
  'online_ads',
  'media_profile_and_exposure',
  'lawsuits_distribution_data',
  'property_data',
];

function getStatusCode(data, datasetKey) {
  if (!data?.Status) return null;
  if (Array.isArray(data.Status[datasetKey])) {
    return data.Status[datasetKey][0]?.Code;
  }
  return data.Status.Code;
}

function getStatusMessage(data, datasetKey) {
  if (!data?.Status) return null;
  if (Array.isArray(data.Status[datasetKey])) {
    return data.Status[datasetKey][0]?.Message;
  }
  return data.Status.Message;
}

function extractDatasetData(data, datasetKey) {
  const entry = Array.isArray(data?.Result) ? data.Result[0] : null;
  if (!entry) return null;

  // Map dataset key to result entry key (camelCase/PascalCase)
  const keyMap = {
    government_debtors: 'GovernmentDebtors',
    collections: 'Collections',
    historical_basic_data: 'HistoricalBasicData',
    financial_risk: 'FinancialRisk',
    indebtedness_question: 'IndebtednessQuestion',
    university_student_data: 'UniversityStudentData',
    profession_data: 'ProfessionData',
    awards_and_certifications: 'AwardsAndCertifications',
    sports_exposure: 'SportsExposure',
    political_involvement: 'PoliticalInvolvement',
    election_candidate_data: 'ElectionCandidateData',
    online_ads: 'OnlineAds',
    media_profile_and_exposure: 'MediaProfileAndExposure',
    lawsuits_distribution_data: 'LawsuitsDistributionData',
    property_data: 'PropertyData',
  };

  const resultKey = keyMap[datasetKey];
  return entry[resultKey] || null;
}

function isEmptyDataset(datasetData) {
  if (datasetData === null || datasetData === undefined) return true;
  if (Array.isArray(datasetData) && datasetData.length === 0) return true;
  if (typeof datasetData === 'object') {
    const keys = Object.keys(datasetData);
    if (keys.length === 0) return true;
    // Check for "zero" patterns
    const allZero = keys.every(k => {
      const v = datasetData[k];
      return v === 0 || v === false || v === '' || v === '0001-01-01T00:00:00' || v === '9999-12-31T23:59:59.9999999' ||
        (Array.isArray(v) && v.length === 0) ||
        (typeof v === 'object' && Object.keys(v).length === 0);
    });
    return allZero;
  }
  return false;
}

function getNonEmptyKeys(datasetData) {
  if (!datasetData || typeof datasetData !== 'object') return [];
  if (Array.isArray(datasetData)) return [`array[${datasetData.length}]`];
  return Object.keys(datasetData).filter(k => {
    const v = datasetData[k];
    if (v === 0 || v === false || v === '' || v === '0001-01-01T00:00:00' || v === '9999-12-31T23:59:59.9999999') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === 'object' && Object.keys(v).length === 0) return false;
    return true;
  });
}

function sampleValues(datasetData, maxSamples = 3) {
  if (!datasetData || typeof datasetData !== 'object') return [];
  const samples = [];
  for (const [k, v] of Object.entries(datasetData)) {
    if (samples.length >= maxSamples) break;
    if (v === 0 || v === false || v === '' || v === '0001-01-01T00:00:00' || v === '9999-12-31T23:59:59.9999999') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && Object.keys(v).length === 0) continue;
    const valPreview = typeof v === 'string' ? v.slice(0, 60) : JSON.stringify(v).slice(0, 60);
    samples.push(`${k}: ${valPreview}`);
  }
  return samples;
}

function classifyDataset(okCount, hasMeaningfulData) {
  if (hasMeaningfulData) return 'A'; // Adotar
  if (okCount >= 3) return 'B'; // Retorna dados em muitos CPFs, mas todos vazios/zeros
  if (okCount >= 1) return 'C'; // Poucos CPFs retornam dados
  return 'D'; // Erro ou sempre vazio
}

function main() {
  console.log('Analisando resultados BDC para PF...\n');

  const report = {
    generatedAt: new Date().toISOString(),
    totalCpfs: CPFS.length,
    totalDatasets: DATASETS.length,
    results: {},
    datasetSummary: {},
  };

  // Initialize dataset summary
  for (const ds of DATASETS) {
    report.datasetSummary[ds] = {
      okCount: 0,
      emptyCount: 0,
      errorCount: 0,
      meaningfulDataCount: 0,
      classification: 'D',
    };
  }

  for (const target of CPFS) {
    report.results[target.id] = {
      doc: target.doc,
      nome: target.nome,
      uf: target.uf,
      risco: target.risco,
      datasets: {},
    };

    for (const ds of DATASETS) {
      const filepath = path.join(RESULTS_DIR, target.id, `${ds}.json`);
      const errorPath = path.join(RESULTS_DIR, target.id, `ERROR_${ds}.json`);

      if (!fs.existsSync(filepath)) {
        if (fs.existsSync(errorPath)) {
          const errData = JSON.parse(fs.readFileSync(errorPath, 'utf-8'));
          report.results[target.id].datasets[ds] = {
            status: 'error',
            error: errData.error,
          };
          report.datasetSummary[ds].errorCount++;
        } else {
          report.results[target.id].datasets[ds] = { status: 'missing' };
          report.datasetSummary[ds].errorCount++;
        }
        continue;
      }

      const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      const statusCode = getStatusCode(data, ds);
      const statusMsg = getStatusMessage(data, ds);
      const datasetData = extractDatasetData(data, ds);
      const isEmpty = isEmptyDataset(datasetData);
      const nonEmptyKeys = getNonEmptyKeys(datasetData);
      const hasMeaningfulData = nonEmptyKeys.length > 0;

      if (statusCode !== 0) {
        report.results[target.id].datasets[ds] = {
          status: 'api_error',
          statusCode,
          statusMsg,
        };
        report.datasetSummary[ds].errorCount++;
      } else if (isEmpty) {
        report.results[target.id].datasets[ds] = {
          status: 'empty',
          statusCode,
          keys: Object.keys(datasetData || {}),
        };
        report.datasetSummary[ds].emptyCount++;
      } else {
        report.results[target.id].datasets[ds] = {
          status: 'ok',
          statusCode,
          keys: Object.keys(datasetData || {}),
          nonEmptyKeys,
          samples: sampleValues(datasetData),
          sizeBytes: JSON.stringify(datasetData).length,
        };
        report.datasetSummary[ds].okCount++;
        if (hasMeaningfulData) {
          report.datasetSummary[ds].meaningfulDataCount++;
        }
      }
    }
  }

  // Classify datasets
  for (const ds of DATASETS) {
    const s = report.datasetSummary[ds];
    s.classification = classifyDataset(s.okCount, s.meaningfulDataCount > 0);
  }

  // Save JSON report
  fs.writeFileSync(
    path.join(RESULTS_DIR, '_PF_DATASET_MAPPING.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );

  // Generate markdown field analysis
  let md = '# Análise de Datasets BDC para PF\n\n';
  md += `> Gerado em: ${new Date().toISOString()}\n\n`;
  md += '## Resumo por Dataset\n\n';
  md += '| Dataset | OK | Vazio | Erro | Dados Úteis | Classificação |\n';
  md += '|---------|----|-------|------|-------------|---------------|\n';

  for (const ds of DATASETS) {
    const s = report.datasetSummary[ds];
    const classLabel = s.classification === 'A' ? '✅ Adotar' :
                       s.classification === 'B' ? '⚠️ Condicional' :
                       s.classification === 'C' ? '❌ Descartar' : '⛔ Erro/Indisponível';
    md += `| ${ds} | ${s.okCount} | ${s.emptyCount} | ${s.errorCount} | ${s.meaningfulDataCount} | ${classLabel} |\n`;
  }

  md += '\n## Detalhes por Dataset\n\n';
  for (const ds of DATASETS) {
    md += `### ${ds}\n\n`;
    const s = report.datasetSummary[ds];
    md += `- **Classificação**: ${s.classification}\n`;
    md += `- **CPFs com dados**: ${s.okCount}\n`;
    md += `- **CPFs vazios**: ${s.emptyCount}\n`;
    md += `- **CPFs com dados úteis**: ${s.meaningfulDataCount}\n`;
    md += `- **Erros**: ${s.errorCount}\n\n`;

    // Show per-CPF details for OK ones
    for (const target of CPFS) {
      const dsReport = report.results[target.id].datasets[ds];
      if (dsReport.status === 'ok') {
        md += `**${target.id}** (${target.risco}): ${dsReport.nonEmptyKeys.join(', ')}\n`;
        if (dsReport.samples?.length) {
          md += `  - ${dsReport.samples.join('\n  - ')}\n`;
        }
        md += '\n';
      }
    }
  }

  fs.writeFileSync(path.join(RESULTS_DIR, '_PF_FIELD_ANALYSIS.md'), md, 'utf-8');

  // Generate recommendations
  let rec = '# Recomendações de Integração BDC — PF\n\n';
  rec += `> Gerado em: ${new Date().toISOString()}\n\n`;

  const adopted = DATASETS.filter(ds => report.datasetSummary[ds].classification === 'A');
  const conditional = DATASETS.filter(ds => report.datasetSummary[ds].classification === 'B');
  const discarded = DATASETS.filter(ds => report.datasetSummary[ds].classification === 'C');
  const errorDs = DATASETS.filter(ds => report.datasetSummary[ds].classification === 'D');

  rec += '## ✅ Datasets para Adotar (Classificação A)\n\n';
  if (adopted.length === 0) {
    rec += '_Nenhum dataset retornou dados úteis significativos nos 5 CPFs de teste._\n\n';
  } else {
    for (const ds of adopted) {
      rec += `- **${ds}**: ${report.datasetSummary[ds].meaningfulDataCount}/5 CPFs com dados úteis\n`;
    }
    rec += '\n';
  }

  rec += '## ⚠️ Datasets Condicionais (Classificação B)\n\n';
  if (conditional.length === 0) {
    rec += '_Nenhum dataset condicional._\n\n';
  } else {
    for (const ds of conditional) {
      rec += `- **${ds}**: API responde corretamente, mas dados são sempre vazios/zeros nos CPFs testados. Pode ser útil para perfis de risco diferentes.\n`;
    }
    rec += '\n';
  }

  rec += '## ❌ Datasets para Descartar (Classificação C/D)\n\n';
  for (const ds of [...discarded, ...errorDs]) {
    rec += `- **${ds}**: ${report.datasetSummary[ds].errorCount > 0 ? 'Erro na API ou' : ''} dados não retornam nos CPFs testados.\n`;
  }
  rec += '\n';

  rec += '## Observações\n\n';
  rec += '1. Os 5 CPFs de teste podem não representar todos os perfis de risco. Um CPF com risco CRÍTICO ou ALTO pode ter mais dados em datasets como `collections`, `government_debtors`, `political_involvement`.\n';
  rec += '2. Datasets como `media_profile_and_exposure` e `online_ads` dependem fortemente da exposição pública do indivíduo.\n';
  rec += '3. `profession_data` e `university_student_data` dependem de registros em conselhos de classe ou instituições de ensino.\n';
  rec += '4. Recomenda-se testar com um conjunto maior e mais diverso de CPFs antes de descartar definitivamente qualquer dataset.\n';

  fs.writeFileSync(path.join(RESULTS_DIR, '_PF_RECOMMENDATIONS.md'), rec, 'utf-8');

  console.log('========================================');
  console.log('Análise Concluída');
  console.log('========================================');
  console.log(`Datasets OK (com dados):        ${DATASETS.filter(ds => report.datasetSummary[ds].okCount > 0).length}`);
  console.log(`Datasets com dados úteis:       ${DATASETS.filter(ds => report.datasetSummary[ds].meaningfulDataCount > 0).length}`);
  console.log(`Datasets sempre vazios:         ${DATASETS.filter(ds => report.datasetSummary[ds].emptyCount === CPFS.length).length}`);
  console.log(`Datasets com erro:              ${DATASETS.filter(ds => report.datasetSummary[ds].errorCount > 0).length}`);
  console.log('\nArquivos gerados:');
  console.log('  - bdc_api_results/_PF_DATASET_MAPPING.json');
  console.log('  - bdc_api_results/_PF_FIELD_ANALYSIS.md');
  console.log('  - bdc_api_results/_PF_RECOMMENDATIONS.md');
  console.log('========================================');
}

main();
