/**
 * Script de teste direto: Escavador + Judit
 * Foco: Processos (criminal/trabalhista) + Mandados de Prisão
 * Mesmos 5 CPFs da análise FonteData
 */

const fs = require('fs');
const path = require('path');

// --- Config ---
const ESCAVADOR_TOKEN = process.env.ESCAVADOR_API_TOKEN || fs.readFileSync(path.join(__dirname, 'functions', '.env'), 'utf8').match(/ESCAVADOR_API_TOKEN="([^"]+)"/)?.[1];
const JUDIT_KEY = process.env.JUDIT_API_KEY || fs.readFileSync(path.join(__dirname, 'functions', '.env'), 'utf8').match(/JUDIT_API_KEY="([^"]+)"/)?.[1];

const ALVOS = [
  { id: 1, nome: 'ANDRE LUIZ CRUZ DOS SANTOS',        cpf: '48052053854', cpfFmt: '480.520.538-54' },
  { id: 2, nome: 'DIEGO EMANUEL ALVES DE SOUZA',       cpf: '10794180329', cpfFmt: '107.941.803-29' },
  { id: 3, nome: 'RENAN GUIMARAES DE SOUSA AUGUSTO',   cpf: '11819916766', cpfFmt: '118.199.167-66' },
  { id: 4, nome: 'FRANCISCO TACIANO DE SOUSA',          cpf: '05023290336', cpfFmt: '050.232.903-36' },
  { id: 5, nome: 'MATHEUS GONCALVES DOS SANTOS',        cpf: '46247243804', cpfFmt: '462.472.438-04' },
];

const RESULTS_DIR = path.join(__dirname, 'results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR);

function save(filename, data) {
  const fp = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  💾 Salvo: ${filename}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ========== ESCAVADOR ==========

async function escavadorProcessos(cpf) {
  const url = `https://api.escavador.com/api/v2/envolvido/processos?cpf_cnpj=${cpf}`;
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

async function escavadorPorNome(nome) {
  const url = `https://api.escavador.com/api/v2/envolvido/processos?nome=${encodeURIComponent(nome)}`;
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

// ========== JUDIT LAWSUITS (sync) ==========

async function juditLawsuits(cpfFmt) {
  const url = 'https://lawsuits.production.judit.io/lawsuits';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': JUDIT_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      search: { search_type: 'cpf', search_key: cpfFmt },
      process_status: true,
    }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.text();
  return { status: res.status, data: res.ok ? JSON.parse(body) : body };
}

// ========== JUDIT WARRANTS (async: create → poll → fetch) ==========

async function juditWarrantCreate(cpfFmt) {
  const url = 'https://requests.prod.judit.io/requests';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': JUDIT_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      search: { search_type: 'cpf', search_key: cpfFmt, response_type: 'warrant' },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.text();
  return { status: res.status, data: res.ok ? JSON.parse(body) : body };
}

async function juditPoll(requestId) {
  const url = `https://requests.prod.judit.io/requests/${requestId}`;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(url, {
      headers: { 'api-key': JUDIT_KEY },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const status = data.status || data.request_status;
    console.log(`    ⏳ Poll ${i + 1}: status=${status}`);
    if (status === 'completed' || status === 'done') return data;
    if (status === 'failed' || status === 'error') return { ...data, _failed: true };
    await sleep(3000);
  }
  return { _timeout: true };
}

async function juditFetchResponses(requestId) {
  const url = `https://requests.prod.judit.io/responses?request_id=${requestId}&page=1&page_size=100`;
  const res = await fetch(url, {
    headers: { 'api-key': JUDIT_KEY },
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.text();
  return { status: res.status, data: res.ok ? JSON.parse(body) : body };
}

async function juditWarrantFull(cpfFmt, label) {
  console.log(`  📋 Criando request warrant...`);
  const create = await juditWarrantCreate(cpfFmt);
  if (create.status !== 200 && create.status !== 201) {
    return { create, poll: null, responses: null, error: `Create failed: ${create.status}` };
  }

  const requestId = create.data?.request_id || create.data?.id;
  if (!requestId) {
    return { create, poll: null, responses: null, error: 'No request_id in response' };
  }
  console.log(`  🆔 request_id: ${requestId}`);

  console.log(`  ⏳ Polling...`);
  const poll = await juditPoll(requestId);
  if (poll._failed || poll._timeout) {
    return { create: create.data, poll, responses: null, error: poll._failed ? 'Request failed' : 'Poll timeout' };
  }

  console.log(`  📥 Fetching responses...`);
  const responses = await juditFetchResponses(requestId);
  return { create: create.data, poll, responses: responses.data, requestId };
}

// ========== MAIN ==========

async function main() {
  console.log('='.repeat(70));
  console.log('ANÁLISE APIs ESCAVADOR + JUDIT — 5 CPFs');
  console.log(`Data: ${new Date().toISOString()}`);
  console.log('='.repeat(70));
  console.log(`\nEscavador token: ${ESCAVADOR_TOKEN ? '✅ (' + ESCAVADOR_TOKEN.substring(0, 20) + '...)' : '❌ MISSING'}`);
  console.log(`Judit key: ${JUDIT_KEY ? '✅ (' + JUDIT_KEY + ')' : '❌ MISSING'}\n`);

  // ========== FASE 1: ESCAVADOR ==========
  console.log('\n' + '='.repeat(70));
  console.log('FASE 1: ESCAVADOR — Processos por CPF');
  console.log('='.repeat(70));

  for (const alvo of ALVOS) {
    console.log(`\n🔍 [${alvo.id}/5] ${alvo.nome} (CPF: ${alvo.cpf})`);
    try {
      const result = await escavadorProcessos(alvo.cpf);
      console.log(`  HTTP ${result.status}`);

      if (result.status === 200) {
        const d = result.data;
        const items = d.data?.items || d.items || [];
        const envolvido = d.data?.envolvido || d.envolvido || null;
        const totalPages = d.data?.last_page || d.last_page || 1;
        console.log(`  ✅ Encontrado: ${items.length} processos (páginas: ${totalPages})`);
        if (envolvido) console.log(`  👤 Envolvido: ${envolvido.nome || envolvido.name || 'N/A'}`);
        save(`escavador_${alvo.id}_${alvo.nome.split(' ')[0].toLowerCase()}.json`, result.data);
      } else if (result.status === 404) {
        console.log(`  ⚠️ Nada encontrado por CPF. Tentando por NOME...`);
        const byName = await escavadorPorNome(alvo.nome);
        console.log(`  HTTP ${byName.status} (busca por nome)`);
        save(`escavador_${alvo.id}_${alvo.nome.split(' ')[0].toLowerCase()}_byname.json`, byName.data || byName);
      } else {
        console.log(`  ❌ Erro: ${typeof result.data === 'string' ? result.data.substring(0, 200) : JSON.stringify(result.data).substring(0, 200)}`);
        save(`escavador_${alvo.id}_${alvo.nome.split(' ')[0].toLowerCase()}_error.json`, result);
      }
    } catch (err) {
      console.log(`  ❌ Exception: ${err.message}`);
      save(`escavador_${alvo.id}_${alvo.nome.split(' ')[0].toLowerCase()}_error.json`, { error: err.message });
    }
    await sleep(1000); // rate limit
  }

  // ========== FASE 2: JUDIT LAWSUITS ==========
  console.log('\n' + '='.repeat(70));
  console.log('FASE 2: JUDIT — Lawsuits (sync)');
  console.log('='.repeat(70));

  for (const alvo of ALVOS) {
    console.log(`\n🔍 [${alvo.id}/5] ${alvo.nome} (CPF: ${alvo.cpfFmt})`);
    try {
      const result = await juditLawsuits(alvo.cpfFmt);
      console.log(`  HTTP ${result.status}`);

      if (result.status === 200) {
        const d = result.data;
        const hasLawsuits = d.has_lawsuits || false;
        const responseData = Array.isArray(d.response_data) ? d.response_data : [];
        console.log(`  ✅ has_lawsuits: ${hasLawsuits} | processos: ${responseData.length}`);
        if (d.request_id) console.log(`  🆔 request_id: ${d.request_id}`);
        save(`judit_lawsuits_${alvo.id}_${alvo.nome.split(' ')[0].toLowerCase()}.json`, result.data);
      } else {
        console.log(`  ❌ Erro: ${typeof result.data === 'string' ? result.data.substring(0, 300) : JSON.stringify(result.data).substring(0, 300)}`);
        save(`judit_lawsuits_${alvo.id}_${alvo.nome.split(' ')[0].toLowerCase()}_error.json`, result);
      }
    } catch (err) {
      console.log(`  ❌ Exception: ${err.message}`);
      save(`judit_lawsuits_${alvo.id}_error.json`, { error: err.message });
    }
    await sleep(500);
  }

  // ========== FASE 3: JUDIT WARRANTS ==========
  console.log('\n' + '='.repeat(70));
  console.log('FASE 3: JUDIT — Warrants (async)');
  console.log('='.repeat(70));

  for (const alvo of ALVOS) {
    console.log(`\n🔍 [${alvo.id}/5] ${alvo.nome} (CPF: ${alvo.cpfFmt})`);
    try {
      const result = await juditWarrantFull(alvo.cpfFmt, alvo.nome);
      if (result.error) {
        console.log(`  ❌ ${result.error}`);
      } else {
        const pageData = result.responses?.page_data || result.responses || [];
        const count = Array.isArray(pageData) ? pageData.length : 0;
        console.log(`  ✅ Warrants encontrados: ${count}`);
      }
      save(`judit_warrant_${alvo.id}_${alvo.nome.split(' ')[0].toLowerCase()}.json`, result);
    } catch (err) {
      console.log(`  ❌ Exception: ${err.message}`);
      save(`judit_warrant_${alvo.id}_error.json`, { error: err.message });
    }
    await sleep(1000);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ CONCLUÍDO — Todos os resultados salvos em ./results/');
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
