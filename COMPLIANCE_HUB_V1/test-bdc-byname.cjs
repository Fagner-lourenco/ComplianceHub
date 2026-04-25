/**
 * BDC - Busca por NOME (name{}) para comparação com busca por CPF (doc{})
 */
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, 'functions', '.env'), 'utf8');
const ACCESS_TOKEN = envFile.match(/BIGDATACORP_ACCESS_TOKEN="([^"]+)"/)?.[1];
const TOKEN_ID = envFile.match(/BIGDATACORP_TOKEN_ID="([^"]+)"/)?.[1];

const ALVOS = [
  { id: 1, nome: 'ANDRE LUIZ CRUZ DOS SANTOS',       cpf: '48052053854', uf: 'SP' },
  { id: 2, nome: 'DIEGO EMANUEL ALVES DE SOUZA',     cpf: '10794180329', uf: 'CE' },
  { id: 3, nome: 'RENAN GUIMARAES DE SOUSA AUGUSTO', cpf: '11819916766', uf: 'RJ' },
  { id: 4, nome: 'FRANCISCO TACIANO DE SOUSA',       cpf: '05023290336', uf: 'CE' },
  { id: 5, nome: 'MATHEUS GONCALVES DOS SANTOS',     cpf: '46247243804', uf: 'SP' },
];

async function bdcPost(body) {
  const res = await fetch('https://plataforma.bigdatacorp.com.br/pessoas', {
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
  return { httpStatus: res.status, ok: res.ok, data: JSON.parse(await res.text()) };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('========================================');
  console.log('BDC BUSCA POR NOME - 5 CANDIDATOS');
  console.log('========================================\n');

  const summary = [];

  for (const a of ALVOS) {
    console.log(`\n=== ${a.id}. ${a.nome} (CPF: ${a.cpf}) ===`);

    // Busca por NOME com Limit=5 para capturar múltiplos matches
    const r = await bdcPost({
      q: `name{${a.nome}}`,
      Datasets: 'processes.limit(100)',
      Limit: 5,
    });

    if (!r.ok) {
      console.log(`  ❌ ERROR: HTTP ${r.httpStatus}`);
      summary.push({ id: a.id, nome: a.nome, error: r.httpStatus });
      await sleep(2000);
      continue;
    }

    const results = r.data.Result || [];
    console.log(`  👤 Entidades encontradas: ${results.length}`);

    let totalProcesses = 0;
    const entities = [];

    results.forEach((ent, i) => {
      const mk = ent.MatchKeys || '';
      const procs = ent.Processes?.Lawsuits || [];
      const procCount = procs.length;
      totalProcesses += procCount;

      // Check if this entity matches our target CPF
      const isTargetCPF = mk.includes(a.cpf);

      console.log(`  [${i + 1}] MatchKeys: ${mk} => ${procCount} processos ${isTargetCPF ? '✅ NOSSO CPF' : ''}`);

      if (procCount > 0) {
        procs.forEach((p, j) => {
          console.log(`      ${j + 1}: ${p.Number} | ${p.Type || '?'} | ${p.Status}`);
        });
      }

      entities.push({
        matchKeys: mk,
        isTargetCPF,
        processCount: procCount,
        processes: procs.map(p => ({ number: p.Number, type: p.Type, status: p.Status })),
      });
    });

    console.log(`  📊 Total processos (todas entidades): ${totalProcesses}`);

    // Compare with CPF-based search
    const cpfFile = path.join(__dirname, 'results', 'bigdatacorp', `bdc_${a.id}_combined.json`);
    if (fs.existsSync(cpfFile)) {
      const cpfData = JSON.parse(fs.readFileSync(cpfFile, 'utf8'));
      const cpfProcs = cpfData.Result?.[0]?.Processes?.Lawsuits || [];
      console.log(`  🔄 Comparação: CPF search=${cpfProcs.length} processos vs NAME search=${totalProcesses} processos`);

      // Check for new CNJs not in CPF search
      const cpfCNJs = new Set(cpfProcs.map(p => p.Number));
      const nameCNJs = [];
      entities.forEach(e => e.processes.forEach(p => nameCNJs.push(p.number)));
      const newCNJs = nameCNJs.filter(c => !cpfCNJs.has(c));
      if (newCNJs.length > 0) {
        console.log(`  🆕 NOVOS processos encontrados por NOME que CPF não achou: ${newCNJs.length}`);
        newCNJs.forEach(c => console.log(`      + ${c}`));
      } else {
        console.log(`  ✅ Nenhum processo novo encontrado por nome`);
      }
    }

    // Save
    const outFile = `bdc_${a.id}_byname.json`;
    fs.writeFileSync(
      path.join(__dirname, 'results', 'bigdatacorp', outFile),
      JSON.stringify(r.data, null, 2)
    );
    console.log(`  💾 ${outFile}`);

    summary.push({ id: a.id, nome: a.nome, entities: results.length, totalProcesses, entityDetails: entities });

    await sleep(2000);
  }

  // Final summary
  console.log('\n========================================');
  console.log('RESUMO FINAL - BUSCA POR NOME vs CPF');
  console.log('========================================\n');

  summary.forEach(s => {
    if (s.error) {
      console.log(`${s.id}. ${s.nome}: ERRO ${s.error}`);
    } else {
      console.log(`${s.id}. ${s.nome}: ${s.entities} entidades, ${s.totalProcesses} processos`);
    }
  });
}

main().catch(e => console.error('FATAL:', e));
