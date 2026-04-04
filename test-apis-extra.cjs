const fs = require('fs');
const envFile = fs.readFileSync('functions/.env', 'utf8');
const ESCAVADOR_TOKEN = envFile.split('\n').find(l => l.startsWith('ESCAVADOR_API_TOKEN')).split('"')[1];
const JUDIT_KEY = envFile.split('\n').find(l => l.startsWith('JUDIT_API_KEY')).split('"')[1];

async function main() {
  // 1. ANDRE por nome no Escavador (0 por CPF, FonteData achou 5)
  console.log('=== ESCAVADOR: ANDRE por NOME ===');
  const r1 = await fetch('https://api.escavador.com/api/v2/envolvido/processos?nome=' + encodeURIComponent('ANDRE LUIZ CRUZ DOS SANTOS'), {
    headers: { 'Authorization': 'Bearer ' + ESCAVADOR_TOKEN, 'X-Requested-With': 'XMLHttpRequest' }
  });
  console.log('HTTP', r1.status);
  const d1 = await r1.json();
  console.log('Processos:', (d1.items || []).length, '| Envolvido:', d1.envolvido_encontrado?.nome || 'null', '| qtd_procs:', d1.envolvido_encontrado?.quantidade_processos || 0);
  fs.writeFileSync('results/escavador_1_andre_byname.json', JSON.stringify(d1, null, 2));

  // 2. MATHEUS por nome (0 por CPF Escavador, Judit achou 1)
  console.log('\n=== ESCAVADOR: MATHEUS por NOME ===');
  const r2 = await fetch('https://api.escavador.com/api/v2/envolvido/processos?nome=' + encodeURIComponent('MATHEUS GONCALVES DOS SANTOS'), {
    headers: { 'Authorization': 'Bearer ' + ESCAVADOR_TOKEN, 'X-Requested-With': 'XMLHttpRequest' }
  });
  console.log('HTTP', r2.status);
  const d2 = await r2.json();
  console.log('Processos:', (d2.items || []).length, '| Envolvido:', d2.envolvido_encontrado?.nome || 'null', '| qtd_procs:', d2.envolvido_encontrado?.quantidade_processos || 0);
  fs.writeFileSync('results/escavador_5_matheus_byname.json', JSON.stringify(d2, null, 2));

  // 3. Re-check ANDRE warrant (deu timeout antes)
  console.log('\n=== JUDIT: Re-check ANDRE warrant (request f408e128) ===');
  const w1 = await fetch('https://requests.prod.judit.io/requests/f408e128-ab82-4e1f-8f1d-acf7d994e9fb', { headers: { 'api-key': JUDIT_KEY } });
  const w1d = await w1.json();
  console.log('Status:', w1d.status);
  if (w1d.status === 'completed') {
    const resp1 = await fetch('https://requests.prod.judit.io/responses?request_id=f408e128-ab82-4e1f-8f1d-acf7d994e9fb&page=1&page_size=100', { headers: { 'api-key': JUDIT_KEY } });
    const rd1 = await resp1.json();
    console.log('Warrants:', (rd1.page_data || []).length);
    fs.writeFileSync('results/judit_warrant_1_andre_v2.json', JSON.stringify(rd1, null, 2));
  }

  // 4. Re-check DIEGO warrant (deu timeout antes)
  console.log('\n=== JUDIT: Re-check DIEGO warrant (request 2756fe0f) ===');
  const w2 = await fetch('https://requests.prod.judit.io/requests/2756fe0f-6213-45d6-a041-00545099edab', { headers: { 'api-key': JUDIT_KEY } });
  const w2d = await w2.json();
  console.log('Status:', w2d.status);
  if (w2d.status === 'completed') {
    const resp2 = await fetch('https://requests.prod.judit.io/responses?request_id=2756fe0f-6213-45d6-a041-00545099edab&page=1&page_size=100', { headers: { 'api-key': JUDIT_KEY } });
    const rd2 = await resp2.json();
    console.log('Warrants:', (rd2.page_data || []).length);
    fs.writeFileSync('results/judit_warrant_2_diego_v2.json', JSON.stringify(rd2, null, 2));
  }

  console.log('\n=== DONE ===');
}

main().catch(e => console.error(e));
