#!/usr/bin/env node
/**
 * BDC Analyze PJ Results
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.resolve(__dirname, '..', 'bdc_api_results');

const CNPJS = [
  { doc: '42975374000172', id: 'empresa_1', nome: 'NOVAX INTELIGENCIA SOLUCOES INTEGRADAS LTDA' },
  { doc: '13783221000478', id: 'empresa_2', nome: 'CNPJ 13.783.221/0004-78' },
];

const DATASETS = [
  'government_debtors', 'collections', 'phones_extended', 'addresses_extended',
  'emails_extended', 'online_presence', 'financial_data', 'history_basic_data',
  'dynamic_qsa_data', 'owners_lawsuits', 'employees_kyc', 'economic_group_kyc',
  'merchant_category_data', 'syndicate_agreements', 'social_conscience',
  'media_profile_and_exposure', 'online_ads', 'property_data',
  'awards_and_certifications', 'lawsuits_distribution_data',
];

function getStatusCode(data, ds) {
  if (!data?.Status) return null;
  if (Array.isArray(data.Status[ds])) return data.Status[ds][0]?.Code;
  return data.Status.Code;
}

function extractDatasetData(data, ds) {
  const entry = Array.isArray(data?.Result) ? data.Result[0] : null;
  if (!entry) return null;
  const keyMap = {
    government_debtors: 'GovernmentDebtors', collections: 'Collections',
    phones_extended: 'ExtendedPhones', addresses_extended: 'ExtendedAddresses',
    emails_extended: 'ExtendedEmails', online_presence: 'OnlinePresence',
    financial_data: 'FinantialData', history_basic_data: 'HistoryBasicData',
    dynamic_qsa_data: 'DynamicQSAData', owners_lawsuits: 'OwnersLawsuits',
    employees_kyc: 'EmployeesKycData', economic_group_kyc: 'EconomicGroupKycData',
    merchant_category_data: 'MerchantCategoryData', syndicate_agreements: 'SyndicateAgreements',
    social_conscience: 'SocialConsciousness', media_profile_and_exposure: 'MediaProfileAndExposure',
    online_ads: 'OnlineAds', property_data: 'PropertyData',
    awards_and_certifications: 'AwardsAndCertifications', lawsuits_distribution_data: 'LawsuitsDistributionData',
  };
  return entry[keyMap[ds]] || null;
}

function isEmptyDataset(d) {
  if (d === null || d === undefined) return true;
  if (Array.isArray(d) && d.length === 0) return true;
  if (typeof d === 'object') {
    const keys = Object.keys(d);
    if (keys.length === 0) return true;
    return keys.every(k => {
      const v = d[k];
      return v === 0 || v === false || v === '' || v === '0001-01-01T00:00:00' || v === '9999-12-31T23:59:59.9999999' ||
        (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && Object.keys(v).length === 0);
    });
  }
  return false;
}

function getNonEmptyKeys(d) {
  if (!d || typeof d !== 'object') return [];
  if (Array.isArray(d)) return [`array[${d.length}]`];
  return Object.keys(d).filter(k => {
    const v = d[k];
    if (v === 0 || v === false || v === '' || v === '0001-01-01T00:00:00' || v === '9999-12-31T23:59:59.9999999') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === 'object' && Object.keys(v).length === 0) return false;
    return true;
  });
}

function main() {
  console.log('Analisando resultados BDC para PJ...\n');

  const report = { generatedAt: new Date().toISOString(), totalCnpjs: CNPJS.length, totalDatasets: DATASETS.length, results: {}, datasetSummary: {} };
  for (const ds of DATASETS) report.datasetSummary[ds] = { okCount: 0, emptyCount: 0, errorCount: 0, meaningfulDataCount: 0, classification: 'D' };

  for (const target of CNPJS) {
    report.results[target.id] = { doc: target.doc, nome: target.nome, datasets: {} };
    for (const ds of DATASETS) {
      const filepath = path.join(RESULTS_DIR, target.id, `${ds}.json`);
      const errorPath = path.join(RESULTS_DIR, target.id, `ERROR_${ds}.json`);
      if (!fs.existsSync(filepath)) {
        if (fs.existsSync(errorPath)) { const e = JSON.parse(fs.readFileSync(errorPath, 'utf-8')); report.results[target.id].datasets[ds] = { status: 'error', error: e.error }; report.datasetSummary[ds].errorCount++; }
        else { report.results[target.id].datasets[ds] = { status: 'missing' }; report.datasetSummary[ds].errorCount++; }
        continue;
      }
      const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      const statusCode = getStatusCode(data, ds);
      const datasetData = extractDatasetData(data, ds);
      const isEmpty = isEmptyDataset(datasetData);
      const nonEmptyKeys = getNonEmptyKeys(datasetData);
      const hasMeaningfulData = nonEmptyKeys.length > 0;

      if (statusCode !== 0) { report.results[target.id].datasets[ds] = { status: 'api_error', statusCode }; report.datasetSummary[ds].errorCount++; }
      else if (isEmpty) { report.results[target.id].datasets[ds] = { status: 'empty', keys: Object.keys(datasetData || {}) }; report.datasetSummary[ds].emptyCount++; }
      else { report.results[target.id].datasets[ds] = { status: 'ok', keys: Object.keys(datasetData || {}), nonEmptyKeys, sizeBytes: JSON.stringify(datasetData).length }; report.datasetSummary[ds].okCount++; if (hasMeaningfulData) report.datasetSummary[ds].meaningfulDataCount++; }
    }
  }

  for (const ds of DATASETS) {
    const s = report.datasetSummary[ds];
    s.classification = s.meaningfulDataCount > 0 ? 'A' : s.okCount >= 1 ? 'B' : s.errorCount > 0 ? 'D' : 'C';
  }

  fs.writeFileSync(path.join(RESULTS_DIR, '_PJ_DATASET_MAPPING.json'), JSON.stringify(report, null, 2), 'utf-8');

  let md = '# Analise de Datasets BDC para PJ\n\n';
  md += `> Gerado em: ${new Date().toISOString()}\n\n`;
  md += '## Resumo por Dataset\n\n| Dataset | OK | Vazio | Erro | Dados Uteis | Classificacao |\n|---------|----|-------|------|-------------|---------------|\n';
  for (const ds of DATASETS) {
    const s = report.datasetSummary[ds];
    const lbl = s.classification === 'A' ? 'Adotar' : s.classification === 'B' ? 'Condicional' : s.classification === 'C' ? 'Descartar' : 'Erro';
    md += `| ${ds} | ${s.okCount} | ${s.emptyCount} | ${s.errorCount} | ${s.meaningfulDataCount} | ${lbl} |\n`;
  }

  md += '\n## Detalhes\n\n';
  for (const ds of DATASETS) {
    md += `### ${ds}\n\n`;
    for (const target of CNPJS) {
      const dr = report.results[target.id].datasets[ds];
      if (dr.status === 'ok') { md += `**${target.id}**: ${dr.nonEmptyKeys.join(', ')}\n\n`; }
    }
  }

  fs.writeFileSync(path.join(RESULTS_DIR, '_PJ_FIELD_ANALYSIS.md'), md, 'utf-8');

  let rec = '# Recomendacoes de Integracao BDC -- PJ\n\n';
  const adopted = DATASETS.filter(ds => report.datasetSummary[ds].classification === 'A');
  rec += '## Datasets para Adotar (A)\n\n';
  for (const ds of adopted) rec += `- **${ds}**: ${report.datasetSummary[ds].meaningfulDataCount}/${CNPJS.length} CNPJs com dados uteis\n`;
  rec += '\n';
  fs.writeFileSync(path.join(RESULTS_DIR, '_PJ_RECOMMENDATIONS.md'), rec, 'utf-8');

  console.log('========================================');
  console.log('Analise Concluida');
  console.log(`Adotar: ${adopted.length} datasets`);
  console.log('========================================');
}

main();
