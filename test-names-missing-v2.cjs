/**
 * test-names-missing-v2.cjs
 * Buscas por NOME sem filtros que faltaram: DIEGO, RENAN, FRANCISCO
 * Corrigido: Escavador usa /envolvido/processos?nome=, Judit usa async requests.prod.judit.io
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const ESCAVADOR_TOKEN = process.env.ESCAVADOR_TOKEN || '';
const JUDIT_API_KEY = '99884e54-16dd-4aea-85a9-70a7b0721767';

const PESSOAS = [
    { id: 2, nome: 'DIEGO EMANUEL ALVES DE SOUZA', cpf: '10794180329' },
    { id: 3, nome: 'RENAN GUIMARAES DE SOUSA AUGUSTO', cpf: '11819916766' },
    { id: 4, nome: 'FRANCISCO TACIANO DE SOUSA', cpf: '05023290336' },
];

const RESULTS_DIR = path.join(__dirname, 'results', 'names');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

function saveResult(filename, data) {
    const fp = path.join(RESULTS_DIR, filename);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
    console.log(`  -> Salvo: ${filename}`);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ============ ESCAVADOR — /envolvido/processos?nome=XXX ============
function escavadorByName(nome) {
    return new Promise((resolve, reject) => {
        const urlPath = `/api/v2/envolvido/processos?nome=${encodeURIComponent(nome)}`;
        const options = {
            hostname: 'api.escavador.com',
            path: urlPath,
            method: 'GET',
            headers: { Authorization: `Bearer ${ESCAVADOR_TOKEN}`, Accept: 'application/json' },
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch (e) { resolve({ status: res.statusCode, raw: body }); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// ============ JUDIT — Async POST requests.prod.judit.io/requests ============
function juditPostAsync(body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const options = {
            hostname: 'requests.prod.judit.io',
            path: '/requests',
            method: 'POST',
            headers: {
                'api-key': JUDIT_API_KEY,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, raw: data }); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function juditGetPoll(requestId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'requests.prod.judit.io',
            path: `/requests/${requestId}`,
            method: 'GET',
            headers: { 'api-key': JUDIT_API_KEY, Accept: 'application/json' },
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, raw: data }); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function juditGetResponses(requestId, extraParams = '') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'requests.prod.judit.io',
            path: `/requests/${requestId}/responses?limit=100${extraParams}`,
            method: 'GET',
            headers: { 'api-key': JUDIT_API_KEY, Accept: 'application/json' },
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, raw: data }); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function juditPollUntilDone(requestId, maxPolls = 30) {
    for (let i = 0; i < maxPolls; i++) {
        await sleep(3000);
        const poll = await juditGetPoll(requestId);
        const status = poll.data?.status;
        console.log(`    poll ${i + 1}: status=${status}`);
        if (status === 'completed' || status === 'failed') return poll;
    }
    return { timeout: true };
}

async function juditByNameAsync(nome) {
    const body = {
        search: {
            search_type: 'name',
            search_key: nome,
        },
    };
    console.log(`  POST /requests body: ${JSON.stringify(body)}`);
    const create = await juditPostAsync(body);
    if (create.status !== 200 && create.status !== 201) {
        return { error: `Create HTTP ${create.status}`, details: create.data || create.raw };
    }
    const requestId = create.data?.request_id;
    if (!requestId) return { error: 'No request_id', details: create.data };
    console.log(`  request_id: ${requestId}`);

    const poll = await juditPollUntilDone(requestId);
    if (poll.timeout) return { error: 'Poll timeout', requestId };
    if (poll.data?.status === 'failed') return { error: 'Request failed', requestId, poll: poll.data };

    // Fetch all responses
    const allResp = await juditGetResponses(requestId);
    // Fetch criminal-only
    const crimResp = await juditGetResponses(requestId, '&tags.criminal=true');
    
    return {
        requestId,
        allResponses: allResp.data,
        criminalOnly: crimResp.data,
    };
}

async function main() {
    console.log('=== BUSCAS POR NOME v2 — DIEGO, RENAN, FRANCISCO ===\n');

    for (const p of PESSOAS) {
        const tag = p.nome.split(' ')[0].toLowerCase();
        console.log(`\n--- ${p.id}. ${p.nome} ---`);

        // ---- ESCAVADOR POR NOME ----
        console.log(`  [Escavador] /envolvido/processos?nome=...`);
        try {
            const esc = await escavadorByName(p.nome);
            const items = esc.data?.items || [];
            const env = esc.data?.envolvido_encontrado;
            const cpfsSet = new Set();
            items.forEach((item) => {
                (item.fontes || []).forEach((f) => {
                    (f.envolvidos || []).forEach((e) => { if (e.cpf) cpfsSet.add(e.cpf); });
                });
            });

            // Criminal detection
            const crimRe = /penal|crim|maria.*penha|viol[eê]ncia.*dom|drogas|arma|homic|roubo|furto|estupro|lesão.*corporal|ameaça|tráfico/i;
            let crimCount = 0;
            items.forEach((item) => {
                const a = (item.assuntos_normalizados || []).join(' ');
                const c = item.classe?.nome || '';
                if (crimRe.test(a) || crimRe.test(c)) crimCount++;
            });

            const summary = {
                httpStatus: esc.status,
                envolvido: env ? { nome: env.nome, qtdProcessos: env.quantidade_processos, cpfsComEsseNome: env.cpfs_com_esse_nome } : null,
                totalItems: items.length,
                distinctCpfs: cpfsSet.size,
                criminalItems: crimCount,
            };
            console.log(`  [Escavador] HTTP ${esc.status} | items=${items.length} | envolvido=${env?.nome || 'null'} | cpfs=${cpfsSet.size} | criminal=${crimCount}`);
            saveResult(`esc_${p.id}_${tag}_nome.json`, { ...summary, raw: esc.data });
        } catch (err) {
            console.error(`  [Escavador] ERRO: ${err.message}`);
            saveResult(`esc_${p.id}_${tag}_nome.json`, { error: err.message });
        }

        await sleep(2000);

        // ---- JUDIT POR NOME (ASYNC) ----
        console.log(`  [Judit] Async by name...`);
        try {
            const jud = await juditByNameAsync(p.nome);
            if (jud.error) {
                console.log(`  [Judit] ERRO: ${jud.error}`);
                saveResult(`judit_${p.id}_${tag}_nome.json`, jud);
            } else {
                const allData = jud.allResponses?.data || [];
                const crimData = jud.criminalOnly?.data || [];
                const total = jud.allResponses?.all_count || allData.length;
                const crimTotal = jud.criminalOnly?.all_count || crimData.length;

                // Person types for matches
                const personTypes = {};
                allData.forEach((l) => {
                    (l.persons || []).forEach((per) => {
                        const nameUp = (per.name || '').toUpperCase();
                        if (nameUp.includes(p.nome.split(' ')[0].toUpperCase())) {
                            const pt = per.person_type || 'UNKNOWN';
                            personTypes[pt] = (personTypes[pt] || 0) + 1;
                        }
                    });
                });

                const summary = {
                    requestId: jud.requestId,
                    totalLawsuits: total,
                    criminalCount: crimTotal,
                    personTypes,
                    sampleProcesses: allData.slice(0, 5).map((l) => ({
                        cnj: l.cnj, tribunal: l.tribunal_acronym, area: l.main_subject_name,
                        criminal: l.tags?.criminal, status: l.status, persons: (l.persons || []).map((p2) => `${p2.person_type}:${p2.name}`).join(', '),
                    })),
                };
                console.log(`  [Judit] Total: ${total} | Criminal: ${crimTotal} | PersonTypes: ${JSON.stringify(personTypes)}`);
                saveResult(`judit_${p.id}_${tag}_nome.json`, { ...summary, raw: jud });
            }
        } catch (err) {
            console.error(`  [Judit] ERRO: ${err.message}`);
            saveResult(`judit_${p.id}_${tag}_nome.json`, { error: err.message });
        }

        await sleep(2000);
    }

    console.log('\n=== CONCLUÍDO ===');
}

main().catch(console.error);
