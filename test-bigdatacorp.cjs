/**
 * Script de teste BigDataCorp — Comparação com Escavador & Judit
 *
 * Testa os mesmos 5 candidatos do MATRIZ_RESULTADOS.md para:
 *   1. Consulta combinada (4 datasets: basic_data + processes + kyc + occupation_data)
 *   2. Consulta processes isolada (com filtros: courttype CRIMINAL, TRABALHISTA)
 *   3. Consulta KYC isolada (PEP + Sanções)
 *   4. Normalização e comparação com resultados já conhecidos
 *
 * Salva resultados em results/bigdatacorp/
 */

const fs = require('fs');
const path = require('path');

// --- Config ---
const envFile = fs.readFileSync(path.join(__dirname, 'functions', '.env'), 'utf8');
const ACCESS_TOKEN = envFile.match(/BIGDATACORP_ACCESS_TOKEN="([^"]+)"/)?.[1];
const TOKEN_ID = envFile.match(/BIGDATACORP_TOKEN_ID="([^"]+)"/)?.[1];

if (!ACCESS_TOKEN || !TOKEN_ID) {
  console.error('❌ BIGDATACORP_ACCESS_TOKEN ou TOKEN_ID não encontrado em functions/.env');
  process.exit(1);
}

const CREDENTIALS = { accessToken: ACCESS_TOKEN, tokenId: TOKEN_ID };
const BASE_URL = 'https://plataforma.bigdatacorp.com.br';

const ALVOS = [
  { id: 1, nome: 'ANDRE LUIZ CRUZ DOS SANTOS',      cpf: '48052053854', uf: 'SP', risco: 'ALTO',    escCpf: 0,  escHom: 14, juditCpf: 0, juditWarrant: 0, juditCrim: 0 },
  { id: 2, nome: 'DIEGO EMANUEL ALVES DE SOUZA',     cpf: '10794180329', uf: 'CE', risco: 'BAIXO',   escCpf: 1,  escHom: 0,  juditCpf: 0, juditWarrant: 0, juditCrim: 0 },
  { id: 3, nome: 'RENAN GUIMARAES DE SOUSA AUGUSTO', cpf: '11819916766', uf: 'RJ', risco: 'BAIXO',   escCpf: 1,  escHom: 0,  juditCpf: 1, juditWarrant: 0, juditCrim: 0 },
  { id: 4, nome: 'FRANCISCO TACIANO DE SOUSA',        cpf: '05023290336', uf: 'CE', risco: 'CRITICO', escCpf: 7,  escHom: 0,  juditCpf: 1, juditWarrant: 1, juditCrim: 1 },
  { id: 5, nome: 'MATHEUS GONCALVES DOS SANTOS',      cpf: '46247243804', uf: 'SP', risco: 'MEDIO',   escCpf: 0,  escHom: 164, juditCpf: 1, juditWarrant: 0, juditCrim: 0 },
];

const RESULTS_DIR = path.join(__dirname, 'results', 'bigdatacorp');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

function save(filename, data) {
  const fp = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  💾 ${filename}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ========== API HELPERS ==========

async function bdcPost(body) {
  const res = await fetch(`${BASE_URL}/pessoas`, {
    method: 'POST',
    headers: {
      'AccessToken': ACCESS_TOKEN,
      'TokenId': TOKEN_ID,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { _raw: text, _httpStatus: res.status }; }

  return { httpStatus: res.status, ok: res.ok, data };
}

/**
 * Consulta combinada — 4 datasets em 1 call
 */
async function queryCombined(cpf, processLimit = 100) {
  return bdcPost({
    q: `doc{${cpf}} returnupdates{false}`,
    Datasets: `basic_data,processes.limit(${processLimit}),kyc,occupation_data`,
    Limit: 1,
  });
}

/**
 * Consulta processes com filtro courttype
 */
async function queryProcessesFiltered(cpf, courtType, limit = 100) {
  return bdcPost({
    q: `doc{${cpf}} returnupdates{false}`,
    Datasets: `processes.filter(courttype=${courtType}).limit(${limit})`,
    Limit: 1,
  });
}

/**
 * Consulta processes com filtro status ATIVO
 */
async function queryProcessesActive(cpf, limit = 100) {
  return bdcPost({
    q: `doc{${cpf}} returnupdates{false}`,
    Datasets: `processes.filter(status=ATIVO).limit(${limit})`,
    Limit: 1,
  });
}

/**
 * Consulta processes com filtro estado (UF)
 */
async function queryProcessesByState(cpf, state, limit = 100) {
  return bdcPost({
    q: `doc{${cpf}} returnupdates{false}`,
    Datasets: `processes.filter(state=${state}).limit(${limit})`,
    Limit: 1,
  });
}

/**
 * Consulta KYC isolada
 */
async function queryKyc(cpf) {
  return bdcPost({
    q: `doc{${cpf}}`,
    Datasets: 'kyc',
    Limit: 1,
  });
}

/**
 * Consulta basic_data isolada
 */
async function queryBasicData(cpf) {
  return bdcPost({
    q: `doc{${cpf}}`,
    Datasets: 'basic_data',
    Limit: 1,
  });
}

// ========== ANALYSIS HELPERS ==========

function extractResult(response) {
  if (!response.ok || !response.data?.Result) return null;
  return Array.isArray(response.data.Result) ? response.data.Result[0] : null;
}

function extractStatus(response) {
  const statuses = {};
  if (response.data?.Status) statuses._global = response.data.Status;
  const result = extractResult(response);
  if (result?.MatchKeys) statuses.matchKeys = result.MatchKeys;
  // Dataset-level statuses
  for (const key of ['BasicData', 'Processes', 'KycData', 'ProfessionData']) {
    if (result?.[key]?.Status) statuses[key] = result[key].Status;
  }
  return statuses;
}

function analyzeProcesses(result) {
  const procs = result?.Processes;
  if (!procs) return { total: 0, lawsuits: [], _note: 'Sem dados de processos' };

  const lawsuits = procs.Lawsuits || [];
  let criminal = 0, labor = 0, civil = 0, active = 0;
  const byCourt = {};
  const byState = {};
  const cpfMatches = [];

  for (const l of lawsuits) {
    const ct = (l.CourtType || '').toLowerCase();
    if (/criminal|penal/.test(ct)) criminal++;
    else if (/trabalh/.test(ct)) labor++;
    else civil++;

    if (/ativ/i.test(l.Status || '')) active++;

    const court = l.CourtName || l.CourtType || 'N/A';
    byCourt[court] = (byCourt[court] || 0) + 1;

    const state = l.State || 'N/A';
    byState[state] = (byState[state] || 0) + 1;

    // Check if any party has a Doc (CPF)
    for (const p of (l.Parties || [])) {
      if (p.Doc) {
        cpfMatches.push({
          processo: l.Number,
          partyCpf: p.Doc,
          partyName: p.Name,
          polarity: p.Polarity,
        });
      }
    }
  }

  return {
    total: lawsuits.length,
    criminal, labor, civil, active,
    byCourt, byState,
    cpfMatchCount: cpfMatches.length,
    cpfMatches: cpfMatches.slice(0, 20),
    lawsuitSummary: lawsuits.slice(0, 15).map(l => ({
      number: l.Number,
      type: l.Type,
      subject: l.MainSubject,
      courtType: l.CourtType,
      courtName: l.CourtName,
      state: l.State,
      status: l.Status,
      parties: (l.Parties || []).length,
      partiesWithDoc: (l.Parties || []).filter(p => p.Doc).length,
    })),
  };
}

function analyzeKyc(result) {
  const kyc = result?.KycData;
  if (!kyc) return { found: false, _note: 'Sem dados KYC' };

  const pepHistory = kyc.PEPHistory || [];
  const sanctions = kyc.SanctionsHistory || kyc.SanctionsList || [];

  return {
    found: true,
    isPep: pepHistory.length > 0,
    pepCount: pepHistory.length,
    pepDetails: pepHistory.slice(0, 10).map(p => ({
      level: p.Level,
      jobTitle: p.JobTitle,
      department: p.Department,
      source: p.Source,
      startDate: p.StartDate,
      endDate: p.EndDate,
    })),
    isCurrentlySanctioned: kyc.IsCurrentlySanctioned || false,
    wasPreviouslySanctioned: kyc.WasPreviouslySanctioned || false,
    sanctionCount: sanctions.length,
    sanctionSources: [...new Set(sanctions.map(s => s.Source).filter(Boolean))],
    sanctionTypes: [...new Set(sanctions.map(s => s.StandardizedSanctionType).filter(Boolean))],
    sanctionDetails: sanctions.slice(0, 10).map(s => ({
      source: s.Source,
      type: s.Type,
      standardizedType: s.StandardizedSanctionType,
      isCurrently: s.IsCurrentlyPresentOnSource,
      wasRecently: s.WasRecentlyPresentOnSource,
    })),
    // All raw keys available
    _kycKeys: Object.keys(kyc),
  };
}

function analyzeBasicData(result) {
  const bd = result?.BasicData;
  if (!bd) return { found: false };

  return {
    found: true,
    name: bd.Name,
    alternativeName: bd.AlternativeName || null,
    taxIdStatus: bd.TaxIdStatus,
    gender: bd.Gender,
    birthDate: bd.BirthDate,
    motherName: bd.MotherName,
    fatherName: bd.FatherName,
    age: bd.Age,
    namesakeCount: bd.NumberOfFullNameNamesakes,
    nameWordCount: bd.NameWordCount,
    // All raw keys
    _bdKeys: Object.keys(bd),
  };
}

function analyzeProfession(result) {
  const prof = result?.ProfessionData;
  if (!prof) return { found: false };

  const professions = prof.Professions || [];
  return {
    found: professions.length > 0,
    count: professions.length,
    professions: professions.slice(0, 10).map(p => ({
      source: p.Source,
      sector: p.Sector,
      companyName: p.CompanyName,
      level: p.Level,
      status: p.Status,
      income: p.Income,
      startDate: p.StartDate,
      endDate: p.EndDate,
    })),
    // All raw keys
    _profKeys: prof ? Object.keys(prof) : [],
  };
}

// ========== MAIN ==========

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  BigDataCorp API Test — 5 Candidatos × Múltiplos Cenários');
  console.log('═══════════════════════════════════════════════════════\n');

  const summary = [];

  for (const alvo of ALVOS) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 CANDIDATO ${alvo.id}: ${alvo.nome}`);
    console.log(`   CPF: ${alvo.cpf} | UF: ${alvo.uf} | Risco esperado: ${alvo.risco}`);
    console.log(`   Escavador CPF: ${alvo.escCpf} | homônimos: ${alvo.escHom} | Judit CPF: ${alvo.juditCpf} | Warrant: ${alvo.juditWarrant}`);
    console.log(`${'─'.repeat(60)}`);

    const candidateSummary = {
      id: alvo.id,
      nome: alvo.nome,
      cpf: alvo.cpf,
      uf: alvo.uf,
      riscoEsperado: alvo.risco,
      comparação: { escavadorCpf: alvo.escCpf, escavadorHomonimos: alvo.escHom, juditCpf: alvo.juditCpf, juditWarrant: alvo.juditWarrant },
      bigdatacorp: {},
    };

    // ── TEST 1: Consulta Combinada (4 datasets) ──
    console.log('\n  ▶ Test 1: Consulta combinada (basic_data + processes + kyc + occupation)');
    try {
      const res = await queryCombined(alvo.cpf);
      save(`bdc_${alvo.id}_combined.json`, res.data);

      const result = extractResult(res);
      const statuses = extractStatus(res);
      const procAnalysis = analyzeProcesses(result);
      const kycAnalysis = analyzeKyc(result);
      const bdAnalysis = analyzeBasicData(result);
      const profAnalysis = analyzeProfession(result);

      console.log(`    HTTP: ${res.httpStatus} | Status codes: ${JSON.stringify(statuses._global || {})}`);
      console.log(`    BasicData: nome=${bdAnalysis.name || 'N/A'}, cpfStatus=${bdAnalysis.taxIdStatus || 'N/A'}, homônimos=${bdAnalysis.namesakeCount ?? 'N/A'}`);
      console.log(`    Processes: total=${procAnalysis.total}, criminal=${procAnalysis.criminal}, trabalhista=${procAnalysis.labor}, ativo=${procAnalysis.active}`);
      console.log(`    CPF matches: ${procAnalysis.cpfMatchCount} processos com CPF exato nas partes`);
      console.log(`    KYC: isPep=${kycAnalysis.isPep || false}, sanctioned=${kycAnalysis.isCurrentlySanctioned || false}, wasSanctioned=${kycAnalysis.wasPreviouslySanctioned || false}, sanctions=${kycAnalysis.sanctionCount || 0}`);
      console.log(`    Profissão: ${profAnalysis.found ? profAnalysis.count + ' registro(s)' : 'nenhum dado'}`);

      candidateSummary.bigdatacorp.combined = {
        httpStatus: res.httpStatus,
        basicData: bdAnalysis,
        processes: procAnalysis,
        kyc: kycAnalysis,
        profession: profAnalysis,
      };

      // Save normalized analysis separately
      save(`bdc_${alvo.id}_analysis.json`, {
        statuses,
        basicData: bdAnalysis,
        processes: procAnalysis,
        kyc: kycAnalysis,
        profession: profAnalysis,
      });
    } catch (err) {
      console.log(`    ❌ ERRO: ${err.message}`);
      candidateSummary.bigdatacorp.combined = { error: err.message };
    }
    await sleep(500);

    // ── TEST 2: Processes filtro CRIMINAL ──
    console.log('\n  ▶ Test 2: Processes filtro courttype=CRIMINAL');
    try {
      const res = await queryProcessesFiltered(alvo.cpf, 'CRIMINAL');
      save(`bdc_${alvo.id}_criminal.json`, res.data);

      const result = extractResult(res);
      const procAnalysis = analyzeProcesses(result);
      console.log(`    HTTP: ${res.httpStatus} | Total criminal: ${procAnalysis.total}, CPF matches: ${procAnalysis.cpfMatchCount}`);

      candidateSummary.bigdatacorp.criminal = {
        total: procAnalysis.total,
        cpfMatches: procAnalysis.cpfMatchCount,
        active: procAnalysis.active,
      };
    } catch (err) {
      console.log(`    ❌ ERRO: ${err.message}`);
      candidateSummary.bigdatacorp.criminal = { error: err.message };
    }
    await sleep(500);

    // ── TEST 3: Processes filtro TRABALHISTA ──
    console.log('\n  ▶ Test 3: Processes filtro courttype=TRABALHISTA');
    try {
      const res = await queryProcessesFiltered(alvo.cpf, 'TRABALHISTA');
      save(`bdc_${alvo.id}_trabalhista.json`, res.data);

      const result = extractResult(res);
      const procAnalysis = analyzeProcesses(result);
      console.log(`    HTTP: ${res.httpStatus} | Total trabalhista: ${procAnalysis.total}, CPF matches: ${procAnalysis.cpfMatchCount}`);

      candidateSummary.bigdatacorp.trabalhista = {
        total: procAnalysis.total,
        cpfMatches: procAnalysis.cpfMatchCount,
      };
    } catch (err) {
      console.log(`    ❌ ERRO: ${err.message}`);
      candidateSummary.bigdatacorp.trabalhista = { error: err.message };
    }
    await sleep(500);

    // ── TEST 4: Processes filtro ATIVO ──
    console.log('\n  ▶ Test 4: Processes filtro status=Ativo');
    try {
      const res = await queryProcessesActive(alvo.cpf);
      save(`bdc_${alvo.id}_ativo.json`, res.data);

      const result = extractResult(res);
      const procAnalysis = analyzeProcesses(result);
      console.log(`    HTTP: ${res.httpStatus} | Total ativos: ${procAnalysis.total}, criminal=${procAnalysis.criminal}, CPF matches: ${procAnalysis.cpfMatchCount}`);

      candidateSummary.bigdatacorp.ativo = {
        total: procAnalysis.total,
        criminal: procAnalysis.criminal,
        cpfMatches: procAnalysis.cpfMatchCount,
      };
    } catch (err) {
      console.log(`    ❌ ERRO: ${err.message}`);
      candidateSummary.bigdatacorp.ativo = { error: err.message };
    }
    await sleep(500);

    // ── TEST 5: Processes filtro estado (UF) ──
    console.log(`\n  ▶ Test 5: Processes filtro state=${alvo.uf}`);
    try {
      const res = await queryProcessesByState(alvo.cpf, alvo.uf);
      save(`bdc_${alvo.id}_uf_${alvo.uf.toLowerCase()}.json`, res.data);

      const result = extractResult(res);
      const procAnalysis = analyzeProcesses(result);
      console.log(`    HTTP: ${res.httpStatus} | Total na UF ${alvo.uf}: ${procAnalysis.total}, criminal=${procAnalysis.criminal}`);

      candidateSummary.bigdatacorp.porUf = {
        uf: alvo.uf,
        total: procAnalysis.total,
        criminal: procAnalysis.criminal,
      };
    } catch (err) {
      console.log(`    ❌ ERRO: ${err.message}`);
      candidateSummary.bigdatacorp.porUf = { error: err.message };
    }
    await sleep(500);

    // ── TEST 6: KYC isolada (PEP + Sanções) ──
    console.log('\n  ▶ Test 6: KYC isolada (PEP + Sanções)');
    try {
      const res = await queryKyc(alvo.cpf);
      save(`bdc_${alvo.id}_kyc.json`, res.data);

      const result = extractResult(res);
      const kycAnalysis = analyzeKyc(result);
      console.log(`    HTTP: ${res.httpStatus} | PEP: ${kycAnalysis.isPep || false}${kycAnalysis.pepCount > 0 ? ` (${kycAnalysis.pepCount} registros)` : ''}`);
      console.log(`    Sanctioned: ${kycAnalysis.isCurrentlySanctioned || false} | Was: ${kycAnalysis.wasPreviouslySanctioned || false} | Count: ${kycAnalysis.sanctionCount || 0}`);
      if (kycAnalysis.sanctionSources?.length > 0) console.log(`    Sources: ${kycAnalysis.sanctionSources.join(', ')}`);
      if (kycAnalysis.sanctionTypes?.length > 0) console.log(`    Types: ${kycAnalysis.sanctionTypes.join(', ')}`);

      candidateSummary.bigdatacorp.kyc = kycAnalysis;
    } catch (err) {
      console.log(`    ❌ ERRO: ${err.message}`);
      candidateSummary.bigdatacorp.kyc = { error: err.message };
    }
    await sleep(500);

    summary.push(candidateSummary);
  }

  // ========== MATRIZ COMPARATIVA ==========
  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('  MATRIZ COMPARATIVA: BigDataCorp vs Escavador vs Judit');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════');

  console.log('\n┌─────┬──────────────────────────────────┬─────────────┬────────────┬────────────┬───────────────┬──────────┬──────────┐');
  console.log('│ #   │ Candidato                        │ Esc CPF     │ Judit CPF  │ BDC Total  │ BDC Criminal  │ BDC PEP  │ BDC Sanç │');
  console.log('├─────┼──────────────────────────────────┼─────────────┼────────────┼────────────┼───────────────┼──────────┼──────────┤');

  for (const s of summary) {
    const bdc = s.bigdatacorp.combined || {};
    const proc = bdc.processes || {};
    const kyc = bdc.kyc || {};
    console.log(`│ ${String(s.id).padEnd(3)} │ ${s.nome.slice(0, 32).padEnd(32)} │ ${String(s.comparação.escavadorCpf).padEnd(11)} │ ${String(s.comparação.juditCpf).padEnd(10)} │ ${String(proc.total ?? '?').padEnd(10)} │ ${String(proc.criminal ?? '?').padEnd(13)} │ ${String(kyc.isPep ?? '?').padEnd(8)} │ ${String(kyc.sanctionCount ?? '?').padEnd(8)} │`);
  }

  console.log('└─────┴──────────────────────────────────┴─────────────┴────────────┴────────────┴───────────────┴──────────┴──────────┘');

  // ========== DADOS EXCLUSIVOS BDC ==========
  console.log('\n\n📊 DADOS EXCLUSIVOS BigDataCorp (não disponíveis no Escavador/Judit):');
  console.log('─'.repeat(70));

  for (const s of summary) {
    const bdc = s.bigdatacorp.combined || {};
    const bd = bdc.basicData || {};
    const proc = bdc.processes || {};
    const kyc = bdc.kyc || {};
    const prof = bdc.profession || {};

    console.log(`\n  ${s.id}. ${s.nome}:`);

    // BasicData exclusivos
    if (bd.found) {
      console.log(`     📝 Homônimos: ${bd.namesakeCount ?? 'N/A'} (Escavador cpfsComEsseNome: ${s.comparação.escavadorHomonimos || 'N/A'})`);
      if (bd.motherName) console.log(`     👩 Nome da mãe: ${bd.motherName}`);
      if (bd.fatherName) console.log(`     👨 Nome do pai: ${bd.fatherName}`);
    }

    // CPF Match exclusivo
    if (proc.cpfMatchCount > 0) {
      console.log(`     🎯 CPF EXATO em ${proc.cpfMatchCount} processo(s) — EXCLUSIVO BDC (Escavador/Judit não têm CPF nas partes)`);
    }

    // KYC exclusivo
    if (kyc.found) {
      console.log(`     🔍 KYC/PEP/Sanções — EXCLUSIVO BDC (Escavador/Judit não oferecem)`);
      if (kyc.isPep) console.log(`        ⚠️ PEP DETECTADO: ${kyc.pepCount} registro(s)`);
      if (kyc.sanctionCount > 0) console.log(`        🚨 SANÇÕES: ${kyc.sanctionCount} registro(s) de ${kyc.sanctionSources?.join(', ')}`);
    }

    // Profissão exclusivo
    if (prof.found) {
      console.log(`     💼 Profissão: ${prof.count} registro(s) — EXCLUSIVO BDC`);
      for (const p of (prof.professions || []).slice(0, 3)) {
        console.log(`        ${p.companyName || 'N/A'} | ${p.sector || 'N/A'} | ${p.status || 'N/A'} | ${p.source || 'N/A'}`);
      }
    }

    // Filtros exclusivos
    if (s.bigdatacorp.porUf && !s.bigdatacorp.porUf.error) {
      console.log(`     📍 Filtro UF ${s.uf}: ${s.bigdatacorp.porUf.total} processo(s) (BDC filtra server-side; Escavador usa tribunais[])`);
    }
  }

  // Save complete summary
  save('_SUMMARY.json', summary);
  save('_COMPARISON_MATRIX.json', summary.map(s => ({
    id: s.id,
    nome: s.nome,
    cpf: s.cpf,
    escavadorCpf: s.comparação.escavadorCpf,
    escavadorHomonimos: s.comparação.escavadorHomonimos,
    juditCpf: s.comparação.juditCpf,
    juditWarrant: s.comparação.juditWarrant,
    bdcTotal: s.bigdatacorp.combined?.processes?.total ?? null,
    bdcCriminal: s.bigdatacorp.combined?.processes?.criminal ?? null,
    bdcLabor: s.bigdatacorp.combined?.processes?.labor ?? null,
    bdcActive: s.bigdatacorp.combined?.processes?.active ?? null,
    bdcCpfMatches: s.bigdatacorp.combined?.processes?.cpfMatchCount ?? null,
    bdcPep: s.bigdatacorp.combined?.kyc?.isPep ?? null,
    bdcSanctionCount: s.bigdatacorp.combined?.kyc?.sanctionCount ?? null,
    bdcSanctionSources: s.bigdatacorp.combined?.kyc?.sanctionSources ?? [],
    bdcProfessionCount: s.bigdatacorp.combined?.profession?.count ?? null,
    bdcNamesakeCount: s.bigdatacorp.combined?.basicData?.namesakeCount ?? null,
    bdcCriminalFiltered: s.bigdatacorp.criminal?.total ?? null,
    bdcTrabalhistaFiltered: s.bigdatacorp.trabalhista?.total ?? null,
    bdcAtivoFiltered: s.bigdatacorp.ativo?.total ?? null,
    bdcUfFiltered: s.bigdatacorp.porUf?.total ?? null,
  })));

  console.log('\n\n✅ Testes concluídos! Resultados salvos em results/bigdatacorp/');
  console.log(`   Total de arquivos: ${fs.readdirSync(RESULTS_DIR).length}`);
}

main().catch(err => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});
