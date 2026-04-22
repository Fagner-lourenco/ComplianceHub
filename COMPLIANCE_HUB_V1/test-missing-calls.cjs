/**
 * test-missing-calls.cjs
 * 
 * Fills remaining gaps in our API test matrix:
 * 1) Escavador CPF + incluir_homonimos=true  (5 calls)
 * 2) Judit async NOME sem filtro — Andre + Matheus (2 calls)
 * 3) Judit execução penal CPF              (5 calls)
 * 
 * Total: 12 new API calls. No duplicates with prior tests.
 * NO tribunal filters used.
 */

const fs = require('fs');
const path = require('path');

const ESCAVADOR_TOKEN = process.env.ESCAVADOR_TOKEN;
const JUDIT_API_KEY = '99884e54-16dd-4aea-85a9-70a7b0721767';

const ESCAVADOR_BASE = 'https://api.escavador.com/api/v2';
const JUDIT_ASYNC_BASE = 'https://requests.prod.judit.io';

const RESULTS_DIR = path.join(__dirname, 'results', 'missing');
fs.mkdirSync(RESULTS_DIR, { recursive: true });

const PEOPLE = [
    { id: 1, name: 'ANDRE LUIZ CRUZ DOS SANTOS', cpf: '48052053854' },
    { id: 2, name: 'DIEGO EMANUEL ALVES DE SOUZA', cpf: '10794180329' },
    { id: 3, name: 'RENAN GUIMARAES DE SOUSA AUGUSTO', cpf: '11819916766' },
    { id: 4, name: 'FRANCISCO TACIANO DE SOUSA', cpf: '05023290336' },
    { id: 5, name: 'MATHEUS GONCALVES DOS SANTOS', cpf: '46247243804' },
];

function formatCpf(cpf) {
    const c = cpf.replace(/\D/g, '');
    return `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9)}`;
}

function save(filename, data) {
    fs.writeFileSync(path.join(RESULTS_DIR, filename), JSON.stringify(data, null, 2));
    console.log(`  💾 Saved ${filename}`);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Escavador helpers ───────────────────────────────────────────
async function escavadorGet(urlStr) {
    const res = await fetch(urlStr, {
        headers: {
            'Authorization': `Bearer ${ESCAVADOR_TOKEN}`,
            'X-Requested-With': 'XMLHttpRequest',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Escavador ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}

// ─── Judit helpers ───────────────────────────────────────────────
async function juditPost(basePath, body) {
    const res = await fetch(`${JUDIT_ASYNC_BASE}${basePath}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': JUDIT_API_KEY,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Judit POST ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
}

async function juditGet(basePath) {
    const res = await fetch(`${JUDIT_ASYNC_BASE}${basePath}`, {
        headers: { 'api-key': JUDIT_API_KEY },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Judit GET ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
}

async function juditPollAndFetch(requestId, label) {
    // Poll for completion
    for (let i = 0; i < 30; i++) {
        await sleep(3000);
        const status = await juditGet(`/requests/${requestId}`);
        const s = status.status || status.request_status;
        process.stdout.write(`.`);
        if (s === 'completed') {
            console.log(` ✅ completed`);
            break;
        }
        if (s === 'failed' || s === 'error') {
            console.log(` ❌ ${s}`);
            return { status: s, request_id: requestId, items: [] };
        }
        if (i === 29) {
            console.log(` ⏱️ timeout after 90s`);
            return { status: 'timeout', request_id: requestId, items: [] };
        }
    }

    // Fetch responses
    const resp = await juditGet(`/responses?request_id=${requestId}&page=1&page_size=100`);
    return {
        request_id: requestId,
        status: 'completed',
        all_count: resp.all_count || 0,
        page_data: resp.page_data || [],
    };
}

// ═══════════════════════════════════════════════════════════════════
// TEST 1: Escavador CPF + incluir_homonimos=true  (5 calls)
// ═══════════════════════════════════════════════════════════════════
async function testEscavadorHomonimos() {
    console.log('\n══════════════════════════════════════════');
    console.log('TEST 1: Escavador CPF + incluir_homonimos=true');
    console.log('══════════════════════════════════════════');

    for (const p of PEOPLE) {
        console.log(`\n[${p.id}] ${p.name} (CPF: ${p.cpf})`);
        try {
            const url = `${ESCAVADOR_BASE}/envolvido/processos?cpf_cnpj=${p.cpf}&incluir_homonimos=1&limit=100`;
            const data = await escavadorGet(url);

            const envolvido = data.envolvido_encontrado || null;
            const items = data.items || [];
            const nextPage = data.links?.next || null;

            const summary = {
                query: { cpf: p.cpf, incluir_homonimos: true, limit: 100 },
                envolvido,
                totalItems: items.length,
                hasNextPage: !!nextPage,
                items_summary: items.map(i => ({
                    numero_cnj: i.numero_cnj,
                    ano_inicio: i.ano_inicio,
                    titulo_polo_ativo: i.titulo_polo_ativo?.slice(0, 50),
                    titulo_polo_passivo: i.titulo_polo_passivo?.slice(0, 50),
                    fontes: (i.fontes || []).map(f => ({
                        sigla: f.sigla,
                        area: f.capa?.area,
                        classe: f.capa?.classe,
                        status_predito: f.status_predito,
                    })),
                })),
                raw_response: data,
            };

            console.log(`  Envolvido: ${envolvido?.nome || 'NOT FOUND'}`);
            console.log(`  qtd_processos: ${envolvido?.quantidade_processos ?? 'N/A'}`);
            console.log(`  Items retornados: ${items.length} | Next page: ${!!nextPage}`);

            if (items.length > 0) {
                const areas = {};
                items.forEach(i => {
                    (i.fontes || []).forEach(f => {
                        const area = f.capa?.area || 'N/A';
                        areas[area] = (areas[area] || 0) + 1;
                    });
                });
                console.log(`  Áreas:`, areas);
            }

            save(`esc_${p.id}_cpf_homonimos.json`, summary);
            await sleep(1200); // rate limit
        } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
            save(`esc_${p.id}_cpf_homonimos.json`, { error: err.message });
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// TEST 2: Judit async NOME sem filtro — Andre + Matheus (2 calls)
// ═══════════════════════════════════════════════════════════════════
async function testJuditNomeBaseline() {
    console.log('\n══════════════════════════════════════════');
    console.log('TEST 2: Judit async NOME sem filtro (Andre + Matheus)');
    console.log('══════════════════════════════════════════');

    // Only Andre (1) and Matheus (5) — Diego/Renan/Francisco already done
    const targets = PEOPLE.filter(p => p.id === 1 || p.id === 5);

    for (const p of targets) {
        console.log(`\n[${p.id}] ${p.name}`);
        try {
            const body = {
                search: {
                    search_type: 'name',
                    search_key: p.name,
                },
            };

            console.log(`  Creating async request...`);
            const created = await juditPost('/requests', body);
            const requestId = created.request_id;
            console.log(`  request_id: ${requestId}`);
            process.stdout.write(`  Polling`);

            const result = await juditPollAndFetch(requestId, p.name);

            const criminal = (result.page_data || []).filter(d =>
                d.response_data?.tags?.criminal === true
            ).length;

            console.log(`  Total: ${result.all_count || 0} | Criminal: ${criminal}`);

            const summary = {
                query: { search_type: 'name', search_key: p.name, filters: 'NONE' },
                request_id: requestId,
                status: result.status,
                all_count: result.all_count || 0,
                criminal_count: criminal,
                potential_homonym_count: (result.page_data || []).filter(d =>
                    d.response_data?.tags?.potential_homonym === true
                ).length,
                page_data_summary: (result.page_data || []).slice(0, 20).map(d => ({
                    code: d.response_data?.code,
                    tribunal: d.response_data?.tribunal_acronym,
                    area: d.response_data?.area,
                    criminal: d.response_data?.tags?.criminal,
                    potential_homonym: d.response_data?.tags?.potential_homonym,
                    side: (d.response_data?.parties || []).find(pp =>
                        pp.name?.toUpperCase().includes(p.name.split(' ')[0])
                    )?.side || 'N/A',
                })),
                raw_response: result,
            };

            save(`judit_${p.id}_nome_baseline.json`, summary);
            await sleep(2000);
        } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
            save(`judit_${p.id}_nome_baseline.json`, { error: err.message });
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// TEST 3: Judit execução penal CPF (5 calls)
// ═══════════════════════════════════════════════════════════════════
async function testJuditExecucaoPenal() {
    console.log('\n══════════════════════════════════════════');
    console.log('TEST 3: Judit execução penal por CPF');
    console.log('══════════════════════════════════════════');

    for (const p of PEOPLE) {
        console.log(`\n[${p.id}] ${p.name} (CPF: ${p.cpf})`);
        try {
            const body = {
                search: {
                    search_type: 'cpf',
                    search_key: formatCpf(p.cpf),
                    response_type: 'execution',
                },
            };

            console.log(`  Creating async request (execution)...`);
            const created = await juditPost('/requests', body);
            const requestId = created.request_id;
            console.log(`  request_id: ${requestId}`);
            process.stdout.write(`  Polling`);

            const result = await juditPollAndFetch(requestId, `${p.name} execution`);

            console.log(`  Total execuções: ${result.all_count || 0}`);

            const summary = {
                query: { search_type: 'cpf', search_key: formatCpf(p.cpf), response_type: 'execution' },
                request_id: requestId,
                status: result.status,
                all_count: result.all_count || 0,
                page_data: result.page_data || [],
            };

            save(`judit_${p.id}_execucao_penal.json`, summary);
            await sleep(2000);
        } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
            save(`judit_${p.id}_execucao_penal.json`, { error: err.message });
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   TEST MISSING CALLS — Fill matrix gaps      ║');
    console.log('║   12 new calls: 5 Esc + 2 Judit nome + 5 EP ║');
    console.log('╚══════════════════════════════════════════════╝');

    if (!ESCAVADOR_TOKEN) {
        console.error('❌ Set ESCAVADOR_TOKEN env var');
        process.exit(1);
    }

    // 1) Escavador incluir_homonimos=true (5 calls)
    await testEscavadorHomonimos();

    // 2) Judit nome baseline — ALREADY DONE, skip to save credits
    // await testJuditNomeBaseline();

    // 3) Judit execução penal — ALREADY DONE, skip to save credits
    // await testJuditExecucaoPenal();

    console.log('\n\n✅ All 12 calls completed. Results in results/missing/');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
