/**
 * test-names-missing.cjs
 * Buscas por NOME sem filtros que faltaram: DIEGO, RENAN, FRANCISCO
 * Escavador + Judit para cada um
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const ESCAVADOR_TOKEN = process.env.ESCAVADOR_TOKEN || 'COLOQUE_SEU_TOKEN';
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
    console.log(`  -> Salvo: ${fp}`);
}

// ============ ESCAVADOR ============
function escavadorByName(nome, limit = 100) {
    return new Promise((resolve, reject) => {
        const q = encodeURIComponent(nome);
        const urlPath = `/api/v2/envolvido?q=${q}&limit=${limit}`;
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
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// ============ JUDIT ============
function juditPost(endpoint, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const options = {
            hostname: 'lawsuits.production.judit.io',
            path: endpoint,
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
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function juditByName(nome) {
    // Judit sync by name (no filters)
    const body = { search_type: 'person_name', search_key: nome };
    return juditPost('/lawsuits', body);
}

async function main() {
    console.log('=== BUSCAS POR NOME FALTANTES (sem filtros) ===\n');

    for (const p of PESSOAS) {
        const tag = p.nome.split(' ')[0].toLowerCase();
        console.log(`\n--- ${p.id}. ${p.nome} (CPF ${p.cpf}) ---`);

        // ESCAVADOR por nome
        console.log(`  [Escavador] Buscando por nome...`);
        try {
            const esc = await escavadorByName(p.nome);
            const items = esc.data?.items || [];
            const cpfs = new Set();
            items.forEach((item) => {
                const envolvidos = item.fontes?.[0]?.envolvidos || [];
                envolvidos.forEach((e) => { if (e.cpf) cpfs.add(e.cpf); });
            });
            console.log(`  [Escavador] Status: ${esc.status}, Items: ${items.length}, CPFs distintos: ${cpfs.size}`);
            
            // Count criminal
            const criminalRegex = /penal|crim|execu[çc][ãa]o.*penal|maria.*penha|viol[eê]ncia.*dom[eé]st/i;
            let crimCount = 0;
            items.forEach((item) => {
                const assuntos = (item.assuntos_normalizados || []).join(' ');
                const classe = item.classe?.nome || '';
                if (criminalRegex.test(assuntos) || criminalRegex.test(classe)) crimCount++;
            });
            console.log(`  [Escavador] Criminal items: ${crimCount}`);
            
            saveResult(`esc_${p.id}_${tag}_nome.json`, { cpf: p.cpf, nome: p.nome, totalItems: items.length, distinctCpfs: cpfs.size, criminalItems: crimCount, raw: esc.data });
        } catch (err) {
            console.error(`  [Escavador] ERRO: ${err.message}`);
            saveResult(`esc_${p.id}_${tag}_nome.json`, { error: err.message });
        }

        await sleep(1500); // rate limit

        // JUDIT por nome
        console.log(`  [Judit] Buscando por nome...`);
        try {
            const jud = await juditByName(p.nome);
            const lawsuits = jud.data?.lawsuits || [];
            const total = lawsuits.length;
            const hasCriminal = lawsuits.filter((l) => l.tags?.criminal === true).length;
            const hasWarrant = lawsuits.filter((l) => l.tags?.warrant === true).length;
            console.log(`  [Judit] Status: ${jud.status}, Lawsuits: ${total}, Criminal: ${hasCriminal}, Warrant tags: ${hasWarrant}`);
            
            // Person types 
            const personTypes = {};
            lawsuits.forEach((l) => {
                const persons = l.persons || [];
                persons.forEach((per) => {
                    const nameUpper = (per.name || '').toUpperCase();
                    if (nameUpper.includes(p.nome.split(' ')[0].toUpperCase())) {
                        const pt = per.person_type || 'UNKNOWN';
                        personTypes[pt] = (personTypes[pt] || 0) + 1;
                    }
                });
            });
            console.log(`  [Judit] Person types: ${JSON.stringify(personTypes)}`);
            
            saveResult(`judit_${p.id}_${tag}_nome.json`, { cpf: p.cpf, nome: p.nome, totalLawsuits: total, criminalCount: hasCriminal, warrantTags: hasWarrant, personTypes, raw: jud.data });
        } catch (err) {
            console.error(`  [Judit] ERRO: ${err.message}`);
            saveResult(`judit_${p.id}_${tag}_nome.json`, { error: err.message });
        }

        await sleep(1500); // rate limit
    }

    console.log('\n=== CONCLUÍDO ===');
}

main().catch(console.error);
