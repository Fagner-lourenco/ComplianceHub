/**
 * Script de teste AVANÇADO: Filtros de Tribunal e Judit Async
 * 
 * Objetivo: Testar todas as otimizações identificadas na análise:
 *   1. Escavador com filtro tribunais[] por UF
 *   2. Escavador com filtro status=ATIVO
 *   3. Judit ASYNC com search_params.filter.tribunals
 *   4. Judit ASYNC com on_demand=true
 *   5. Escavador endpoint /tribunais (GRÁTIS) para mapear UF→tribunais
 *   6. Busca por nome COM filtro de tribunal (reduzir homônimos)
 */

const fs = require('fs');
const path = require('path');

// --- Config ---
const envFile = fs.readFileSync(path.join(__dirname, 'functions', '.env'), 'utf8');
const ESCAVADOR_TOKEN = envFile.match(/ESCAVADOR_API_TOKEN="([^"]+)"/)?.[1];
const JUDIT_KEY = envFile.match(/JUDIT_API_KEY="([^"]+)"/)?.[1];

const ALVOS = [
  { id: 1, nome: 'ANDRE LUIZ CRUZ DOS SANTOS',        cpf: '48052053854', cpfFmt: '480.520.538-54', uf: 'SP', cidade: 'São Paulo' },
  { id: 2, nome: 'DIEGO EMANUEL ALVES DE SOUZA',       cpf: '10794180329', cpfFmt: '107.941.803-29', uf: 'CE', cidade: 'Fortaleza' },
  { id: 3, nome: 'RENAN GUIMARAES DE SOUSA AUGUSTO',   cpf: '11819916766', cpfFmt: '118.199.167-66', uf: 'RJ', cidade: 'Rio de Janeiro' },
  { id: 4, nome: 'FRANCISCO TACIANO DE SOUSA',          cpf: '05023290336', cpfFmt: '050.232.903-36', uf: 'CE', cidade: 'Sobral' },
  { id: 5, nome: 'MATHEUS GONCALVES DOS SANTOS',        cpf: '46247243804', cpfFmt: '462.472.438-04', uf: 'SP', cidade: 'São Paulo' },
];

const RESULTS_DIR = path.join(__dirname, 'results', 'advanced');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

function save(filename, data) {
  const fp = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  💾 ${filename}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ========== ESCAVADOR HELPERS ==========

async function escavadorGet(urlPath) {
  const url = `https://api.escavador.com/api/v2${urlPath}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${ESCAVADOR_TOKEN}`,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.text();
  return { status: res.status, data: res.ok ? JSON.parse(body) : body };
}

async function escavadorProcessos(cpf, options = {}) {
  const params = new URLSearchParams();
  params.set('cpf_cnpj', cpf);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.status) params.set('status', options.status);
  if (options.incluirHomonimos) params.set('incluir_homonimos', 'true');
  if (options.dataMinima) params.set('data_minima', options.dataMinima);
  if (Array.isArray(options.tribunais)) {
    for (const t of options.tribunais) params.append('tribunais[]', t);
  }
  return escavadorGet(`/envolvido/processos?${params.toString()}`);
}

async function escavadorPorNome(nome, options = {}) {
  const params = new URLSearchParams();
  params.set('nome', nome);
  if (options.limit) params.set('limit', String(options.limit));
  if (Array.isArray(options.tribunais)) {
    for (const t of options.tribunais) params.append('tribunais[]', t);
  }
  return escavadorGet(`/envolvido/processos?${params.toString()}`);
}

async function escavadorTribunaisPorUf(uf) {
  return escavadorGet(`/tribunais?estados[]=${uf}`);
}

// ========== JUDIT HELPERS ==========

async function juditPost(baseUrl, pathStr, body) {
  const url = `${baseUrl}${pathStr}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'api-key': JUDIT_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  return { status: res.status, data: res.ok ? JSON.parse(text) : text };
}

async function juditGet(url) {
  const res = await fetch(url, {
    headers: { 'api-key': JUDIT_KEY },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  return { status: res.status, data: res.ok ? JSON.parse(text) : text };
}

async function juditPoll(requestId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await juditGet(`https://requests.prod.judit.io/requests/${requestId}`);
    const status = data.status || data.request_status;
    process.stdout.write(`  ⏳ Poll ${i + 1}: ${status}\r`);
    if (status === 'completed' || status === 'done') { console.log(); return data; }
    if (status === 'failed' || status === 'error') { console.log(); return { ...data, _failed: true }; }
    await sleep(3000);
  }
  console.log();
  return { _timeout: true };
}

async function juditFetchResponses(requestId, queryParams = '') {
  const url = `https://requests.prod.judit.io/responses?request_id=${requestId}&page=1&page_size=100${queryParams}`;
  return juditGet(url);
}

/**
 * Judit ASYNC request with full filter support.
 * @param {string} cpfFmt  Formatted CPF
 * @param {object} options  { responseType, filter, onDemand, cacheTtlDays }
 */
async function juditAsyncRequest(cpfFmt, options = {}) {
  const body = {
    search: {
      search_type: 'cpf',
      search_key: cpfFmt,
    },
  };
  if (options.responseType) body.search.response_type = options.responseType;
  if (options.onDemand) body.search.on_demand = true;
  if (options.cacheTtlDays) body.search.cache_ttl_in_days = options.cacheTtlDays;
  if (options.filter && Object.keys(options.filter).length > 0) {
    body.search.search_params = { filter: options.filter };
  }

  console.log(`  📋 POST /requests body:`, JSON.stringify(body).substring(0, 300));
  const create = await juditPost('https://requests.prod.judit.io', '/requests', body);
  
  if (create.status !== 200 && create.status !== 201) {
    console.log(`  ❌ Create failed: HTTP ${create.status}`, typeof create.data === 'string' ? create.data.substring(0, 200) : '');
    return { error: `Create HTTP ${create.status}`, create };
  }

  const requestId = create.data?.request_id;
  if (!requestId) {
    console.log(`  ❌ No request_id`);
    return { error: 'No request_id', create };
  }
  console.log(`  🆔 request_id: ${requestId}`);

  const poll = await juditPoll(requestId);
  if (poll._failed) return { error: 'Request failed', create: create.data, poll };
  if (poll._timeout) return { error: 'Poll timeout', create: create.data, poll };

  // Fetch responses
  const responses = await juditFetchResponses(requestId);
  
  // Also try with tags.criminal=true filter
  let criminalOnly = null;
  if (!options.responseType || options.responseType === 'lawsuit') {
    const crimResp = await juditFetchResponses(requestId, '&tags.criminal=true');
    criminalOnly = crimResp.data;
  }

  return {
    requestId,
    create: create.data,
    responses: responses.data,
    criminalOnly,
    pageData: responses.data?.page_data || [],
    totalCount: responses.data?.all_count || 0,
  };
}

/**
 * Judit ASYNC by NAME with filters.
 */
async function juditAsyncByName(nome, options = {}) {
  const body = {
    search: {
      search_type: 'name',
      search_key: nome,
    },
  };
  if (options.responseType) body.search.response_type = options.responseType;
  if (options.onDemand) body.search.on_demand = true;
  if (options.filter && Object.keys(options.filter).length > 0) {
    body.search.search_params = { filter: options.filter };
  }

  console.log(`  📋 POST /requests (name) body:`, JSON.stringify(body).substring(0, 300));
  const create = await juditPost('https://requests.prod.judit.io', '/requests', body);
  
  if (create.status !== 200 && create.status !== 201) {
    console.log(`  ❌ Create failed: HTTP ${create.status}`, typeof create.data === 'string' ? create.data.substring(0, 200) : '');
    return { error: `Create HTTP ${create.status}`, create };
  }

  const requestId = create.data?.request_id;
  if (!requestId) return { error: 'No request_id', create };
  console.log(`  🆔 request_id: ${requestId}`);

  const poll = await juditPoll(requestId);
  if (poll._failed) return { error: 'Request failed', create: create.data, poll };
  if (poll._timeout) return { error: 'Poll timeout', create: create.data, poll };

  const responses = await juditFetchResponses(requestId);
  let criminalOnly = null;
  if (!options.responseType) {
    const crimResp = await juditFetchResponses(requestId, '&tags.criminal=true');
    criminalOnly = crimResp.data;
  }

  return {
    requestId,
    create: create.data,
    responses: responses.data,
    criminalOnly,
    pageData: responses.data?.page_data || [],
    totalCount: responses.data?.all_count || 0,
  };
}

// ========== UF → TRIBUNAL MAP ==========

const UF_TRIBUNAL_MAP = {
  SP: ['TJSP', 'TRT-2', 'TRT-15'],
  RJ: ['TJRJ', 'TRT-1'],
  CE: ['TJCE', 'TRT-7'],
  PR: ['TJPR', 'TRT-9'],
  MG: ['TJMG', 'TRT-3'],
  RS: ['TJRS', 'TRT-4'],
  BA: ['TJBA', 'TRT-5'],
  PE: ['TJPE', 'TRT-6'],
  DF: ['TJDFT', 'TRT-10'],
  SC: ['TJSC', 'TRT-12'],
  GO: ['TJGO', 'TRT-18'],
};

// ========== MAIN ==========

async function main() {
  console.log('='.repeat(80));
  console.log('TESTE AVANÇADO — FILTROS DE TRIBUNAL + JUDIT ASYNC + ON_DEMAND');
  console.log(`Data: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
  console.log(`Escavador: ${ESCAVADOR_TOKEN ? '✅' : '❌'}`);
  console.log(`Judit: ${JUDIT_KEY ? '✅' : '❌'}\n`);

  // ===============================================
  // ETAPA 0: Escavador /tribunais por UF (GRÁTIS)
  // ===============================================
  console.log('\n' + '='.repeat(80));
  console.log('ETAPA 0: ESCAVADOR — Mapear UF → Tribunais (endpoint grátis)');
  console.log('='.repeat(80));

  const ufsToTest = ['SP', 'CE', 'RJ', 'PR'];
  const tribunalByUf = {};
  for (const uf of ufsToTest) {
    console.log(`\n🏛️ UF=${uf}:`);
    try {
      const r = await escavadorTribunaisPorUf(uf);
      if (r.status === 200) {
        const tribunais = Array.isArray(r.data) ? r.data : (r.data?.items || r.data?.data || []);
        const siglas = tribunais.map(t => t.sigla || t.acronym || t.nome || t).filter(Boolean);
        tribunalByUf[uf] = siglas;
        console.log(`  ✅ ${siglas.length} tribunais: ${siglas.join(', ')}`);
        save(`tribunais_${uf}.json`, r.data);
      } else {
        console.log(`  ⚠️ HTTP ${r.status}: ${typeof r.data === 'string' ? r.data.substring(0, 200) : JSON.stringify(r.data).substring(0, 200)}`);
      }
    } catch (err) {
      console.log(`  ❌ ${err.message}`);
    }
    await sleep(500);
  }

  // ===============================================
  // ETAPA 1: Escavador COM filtro de tribunal
  // ===============================================
  console.log('\n' + '='.repeat(80));
  console.log('ETAPA 1: ESCAVADOR — CPF COM filtro tribunais[] por UF');
  console.log('='.repeat(80));

  for (const alvo of ALVOS) {
    const tribunais = UF_TRIBUNAL_MAP[alvo.uf] || [];
    console.log(`\n🔍 [${alvo.id}] ${alvo.nome} | UF=${alvo.uf} | tribunais=${tribunais.join(',')}`);
    
    // 1a. CPF + tribunal filter
    try {
      const r = await escavadorProcessos(alvo.cpf, { tribunais, limit: 100 });
      const items = r.data?.items || [];
      const env = r.data?.envolvido_encontrado;
      console.log(`  CPF+tribunal: HTTP ${r.status} | items=${items.length} | envolvido=${env?.nome || 'null'}`);
      save(`esc_${alvo.id}_cpf_tribunal.json`, r.data);
    } catch (err) {
      console.log(`  ❌ CPF+tribunal: ${err.message}`);
    }
    await sleep(1000);

    // 1b. CPF + status=ATIVO
    try {
      const r = await escavadorProcessos(alvo.cpf, { status: 'ATIVO', limit: 100 });
      const items = r.data?.items || [];
      console.log(`  CPF+ATIVO: HTTP ${r.status} | items=${items.length}`);
      save(`esc_${alvo.id}_cpf_ativo.json`, r.data);
    } catch (err) {
      console.log(`  ❌ CPF+ATIVO: ${err.message}`);
    }
    await sleep(1000);

    // 1c. CPF SEM filtro (baseline — comparar com resultado anterior)
    try {
      const r = await escavadorProcessos(alvo.cpf, { limit: 100 });
      const items = r.data?.items || [];
      const env = r.data?.envolvido_encontrado;
      console.log(`  CPF sem filtro: HTTP ${r.status} | items=${items.length} | envolvido=${env?.nome || 'null'}`);
      save(`esc_${alvo.id}_cpf_baseline.json`, r.data);
    } catch (err) {
      console.log(`  ❌ CPF baseline: ${err.message}`);
    }
    await sleep(1000);
  }

  // ===============================================
  // ETAPA 2: Escavador POR NOME com tribunal filter
  // ===============================================
  console.log('\n' + '='.repeat(80));
  console.log('ETAPA 2: ESCAVADOR — NOME COM filtro tribunais[]');
  console.log('Foco: ANDRE (0 por CPF) e MATHEUS (0 por CPF)');
  console.log('='.repeat(80));

  for (const alvo of [ALVOS[0], ALVOS[4]]) {
    const tribunais = UF_TRIBUNAL_MAP[alvo.uf] || [];
    console.log(`\n🔍 [${alvo.id}] ${alvo.nome} | tribunal=${tribunais.join(',')}`);
    
    // 2a. Nome + tribunal
    try {
      const r = await escavadorPorNome(alvo.nome, { tribunais, limit: 100 });
      const items = r.data?.items || [];
      const env = r.data?.envolvido_encontrado;
      console.log(`  Nome+tribunal: HTTP ${r.status} | items=${items.length} | envolvido=${env?.nome || 'null'} | qtd_procs=${env?.quantidade_processos || 0}`);
      if (r.data?.cpfs_com_esse_nome) console.log(`  cpfs_com_esse_nome: ${r.data.cpfs_com_esse_nome}`);
      save(`esc_${alvo.id}_nome_tribunal.json`, r.data);
    } catch (err) {
      console.log(`  ❌ Nome+tribunal: ${err.message}`);
    }
    await sleep(1500);

    // 2b. Nome SEM tribunal (comparar homônimos)
    try {
      const r = await escavadorPorNome(alvo.nome, { limit: 50 });
      const items = r.data?.items || [];
      const env = r.data?.envolvido_encontrado;
      console.log(`  Nome sem filtro: HTTP ${r.status} | items=${items.length} | envolvido=${env?.nome || 'null'} | qtd_procs=${env?.quantidade_processos || 0}`);
      save(`esc_${alvo.id}_nome_baseline.json`, r.data);
    } catch (err) {
      console.log(`  ❌ Nome baseline: ${err.message}`);
    }
    await sleep(1500);
  }

  // ===============================================
  // ETAPA 3: Judit ASYNC por CPF com filtros de tribunal
  // ===============================================
  console.log('\n' + '='.repeat(80));
  console.log('ETAPA 3: JUDIT ASYNC — CPF + filtro tribunals + on_demand');
  console.log('='.repeat(80));

  // Map UF to Judit tribunal format
  const JUDIT_TRIBUNALS = {
    SP: ['TJSP', 'TRT1SP', 'TRT2SP'],
    RJ: ['TJRJ', 'TRT1RJ'],
    CE: ['TJCE', 'TRT7CE'],
    PR: ['TJPR', 'TRT9PR'],
  };

  for (const alvo of ALVOS) {
    const tribunals = JUDIT_TRIBUNALS[alvo.uf] || [];
    console.log(`\n🔍 [${alvo.id}] ${alvo.nome} | UF=${alvo.uf}`);

    // 3a. ASYNC COM filtro de tribunal
    console.log(`\n  --- 3a: ASYNC + tribunals filter ---`);
    try {
      const r = await juditAsyncRequest(alvo.cpfFmt, {
        filter: tribunals.length > 0 ? {
          tribunals: { keys: tribunals, not_equal: false }
        } : {},
      });
      console.log(`  Async+tribunal: total=${r.totalCount} | criminal=${r.criminalOnly?.all_count || 0} | error=${r.error || 'none'}`);
      if (r.pageData?.length) {
        for (const item of r.pageData.slice(0, 5)) {
          const rd = item.response_data || item;
          console.log(`    - ${rd.code || rd.lawsuit_cnj || 'N/A'} | ${rd.tribunal_acronym || 'N/A'} | area=${rd.area || 'N/A'} | tags=${JSON.stringify(rd.tags || {})}`);
        }
      }
      save(`judit_${alvo.id}_async_tribunal.json`, r);
    } catch (err) {
      console.log(`  ❌ ${err.message}`);
    }
    await sleep(2000);

    // 3b. ASYNC COM on_demand=true (busca real-time nos tribunais)
    // APENAS para ANDRE e MATHEUS (que deram 0 em testes anteriores)
    if (alvo.id === 1 || alvo.id === 5) {
      console.log(`\n  --- 3b: ASYNC + on_demand=true ---`);
      try {
        const r = await juditAsyncRequest(alvo.cpfFmt, {
          onDemand: true,
          filter: tribunals.length > 0 ? {
            tribunals: { keys: tribunals, not_equal: false }
          } : {},
        });
        console.log(`  Async+on_demand: total=${r.totalCount} | criminal=${r.criminalOnly?.all_count || 0} | error=${r.error || 'none'}`);
        if (r.pageData?.length) {
          for (const item of r.pageData.slice(0, 5)) {
            const rd = item.response_data || item;
            console.log(`    - ${rd.code || rd.lawsuit_cnj || 'N/A'} | ${rd.tribunal_acronym || 'N/A'} | area=${rd.area || 'N/A'}`);
          }
        }
        save(`judit_${alvo.id}_async_ondemand.json`, r);
      } catch (err) {
        console.log(`  ❌ on_demand: ${err.message}`);
      }
      await sleep(2000);
    }

    // 3c. ASYNC SEM filtro (baseline)
    console.log(`\n  --- 3c: ASYNC sem filtro (baseline) ---`);
    try {
      const r = await juditAsyncRequest(alvo.cpfFmt, {});
      console.log(`  Async baseline: total=${r.totalCount} | criminal=${r.criminalOnly?.all_count || 0} | error=${r.error || 'none'}`);
      if (r.pageData?.length) {
        for (const item of r.pageData.slice(0, 5)) {
          const rd = item.response_data || item;
          console.log(`    - ${rd.code || rd.lawsuit_cnj || 'N/A'} | ${rd.tribunal_acronym || 'N/A'} | area=${rd.area || 'N/A'}`);
        }
      }
      save(`judit_${alvo.id}_async_baseline.json`, r);
    } catch (err) {
      console.log(`  ❌ baseline: ${err.message}`);
    }
    await sleep(2000);

    // 3d. WARRANTS ASYNC com tribunal filter
    console.log(`\n  --- 3d: WARRANTS ASYNC + tribunal filter ---`);
    try {
      const r = await juditAsyncRequest(alvo.cpfFmt, {
        responseType: 'warrant',
        filter: tribunals.length > 0 ? {
          tribunals: { keys: tribunals, not_equal: false }
        } : {},
      });
      console.log(`  Warrants+tribunal: total=${r.totalCount} | error=${r.error || 'none'}`);
      if (r.pageData?.length) {
        for (const item of r.pageData.slice(0, 5)) {
          const rd = item.response_data || item;
          console.log(`    - ${rd.code || 'N/A'} | tipo=${rd.warrant_type || 'N/A'} | status=${rd.status || 'N/A'}`);
        }
      }
      save(`judit_${alvo.id}_warrant_tribunal.json`, r);
    } catch (err) {
      console.log(`  ❌ warrants: ${err.message}`);
    }
    await sleep(2000);
  }

  // ===============================================
  // ETAPA 4: Judit ASYNC por NOME com filtros
  // ===============================================
  console.log('\n' + '='.repeat(80));
  console.log('ETAPA 4: JUDIT ASYNC — POR NOME + filtro tribunal');
  console.log('Foco: ANDRE (0 por CPF em todos anteriores) e MATHEUS');
  console.log('='.repeat(80));

  for (const alvo of [ALVOS[0], ALVOS[4]]) {
    const tribunals = JUDIT_TRIBUNALS[alvo.uf] || [];
    console.log(`\n🔍 [${alvo.id}] ${alvo.nome} | UF=${alvo.uf}`);

    // 4a. Nome + tribunal
    console.log(`\n  --- 4a: NOME + tribunal ---`);
    try {
      const r = await juditAsyncByName(alvo.nome, {
        filter: tribunals.length > 0 ? {
          tribunals: { keys: tribunals, not_equal: false }
        } : {},
      });
      console.log(`  Nome+tribunal: total=${r.totalCount} | criminal=${r.criminalOnly?.all_count || 0} | error=${r.error || 'none'}`);
      if (r.pageData?.length) {
        for (const item of r.pageData.slice(0, 8)) {
          const rd = item.response_data || item;
          const parties = rd.parties || [];
          const mainParty = parties.find(p => (p.name || '').toUpperCase().includes(alvo.nome.split(' ')[0].toUpperCase()));
          console.log(`    - ${rd.code || 'N/A'} | ${rd.tribunal_acronym || 'N/A'} | area=${rd.area || 'N/A'} | role=${mainParty?.person_type || '?'}`);
        }
      }
      save(`judit_${alvo.id}_nome_tribunal.json`, r);
    } catch (err) {
      console.log(`  ❌ ${err.message}`);
    }
    await sleep(2000);

    // 4b. Nome + on_demand + tribunal
    console.log(`\n  --- 4b: NOME + on_demand + tribunal ---`);
    try {
      const r = await juditAsyncByName(alvo.nome, {
        onDemand: true,
        filter: tribunals.length > 0 ? {
          tribunals: { keys: tribunals, not_equal: false }
        } : {},
      });
      console.log(`  Nome+on_demand: total=${r.totalCount} | criminal=${r.criminalOnly?.all_count || 0} | error=${r.error || 'none'}`);
      if (r.pageData?.length) {
        for (const item of r.pageData.slice(0, 8)) {
          const rd = item.response_data || item;
          console.log(`    - ${rd.code || 'N/A'} | ${rd.tribunal_acronym || 'N/A'} | area=${rd.area || 'N/A'}`);
        }
      }
      save(`judit_${alvo.id}_nome_ondemand.json`, r);
    } catch (err) {
      console.log(`  ❌ nome+on_demand: ${err.message}`);
    }
    await sleep(2000);
  }

  // ===============================================
  // SUMMARY
  // ===============================================
  console.log('\n' + '='.repeat(80));
  console.log('RESUMO FINAL');
  console.log('='.repeat(80));
  
  const summaryFiles = fs.readdirSync(RESULTS_DIR);
  for (const f of summaryFiles.sort()) {
    if (!f.endsWith('.json')) continue;
    try {
      const d = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8'));
      
      if (f.startsWith('esc_')) {
        const items = d?.items || [];
        const env = d?.envolvido_encontrado;
        console.log(`${f.padEnd(40)} | items=${String(items.length).padStart(3)} | envolvido=${(env?.nome || 'null').substring(0, 30)}`);
      } else if (f.startsWith('judit_')) {
        const total = d.totalCount ?? d.all_count ?? '?';
        const criminal = d.criminalOnly?.all_count ?? '?';
        const err = d.error || '';
        console.log(`${f.padEnd(40)} | total=${String(total).padStart(3)} | criminal=${String(criminal).padStart(3)} | ${err}`);
      } else if (f.startsWith('tribunais_')) {
        const count = Array.isArray(d) ? d.length : (d?.items?.length || '?');
        console.log(`${f.padEnd(40)} | tribunais=${count}`);
      }
    } catch { /* skip */ }
  }

  console.log('\n✅ Todos os resultados salvos em: results/advanced/');
  console.log('='.repeat(80));
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
