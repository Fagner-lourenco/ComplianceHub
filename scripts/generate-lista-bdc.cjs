const fs = require('fs');
const r = JSON.parse(fs.readFileSync('results/audit-judit-only-criminal-impact.json', 'utf8'));
const lines = [];
lines.push('LISTA DE CASOS JUDIT CRIMINAL POSITIVO / BIGDATACORP NEGATIVO');
lines.push('');
let n = 1;
for (const c of r.cases) {
  lines.push('---');
  lines.push(n + '. ' + c.candidateName);
  lines.push('   CPF: ' + c.cpf);
  lines.push('   Case ID: ' + c.id);
  lines.push('   Veredito final: ' + c.finalVerdict);
  lines.push('   Flag criminal final: ' + c.finalFlags.criminalFlag);
  lines.push('   BDC criminal: ' + c.providers.bigdatacorpCriminalFlag + ' (count ' + c.providers.bigdatacorpCriminalCount + ')');
  lines.push('   Judit criminal: ' + c.providers.juditCriminalFlag + ' (count ' + c.providers.juditCriminalCount + ')');
  for (const p of c.juditProcesses) {
    lines.push('   CNJ: ' + p.cnj);
    lines.push('   Tribunal: ' + p.tribunalAcronym + ', UF: ' + p.state);
    lines.push('   Cidade: ' + p.city + ', Comarca: ' + p.county);
    lines.push('   Data distribuicao: ' + (p.distributionDate || 'N/A'));
    lines.push('   Classe: ' + ((p.classifications || []).join(' / ') || 'N/A'));
    lines.push('   Assunto: ' + ((p.subjects || []).join(' / ') || 'N/A'));
    lines.push('   Papel: ' + p.role + ', Lado: ' + p.side);
    lines.push('   Status: ' + (p.status || 'N/A'));
    lines.push('   Ultimo andamento: ' + (p.lastStep || 'N/A'));
    lines.push('   CPF exato: ' + (p.hasExactCpfMatch ? 'SIM' : 'N/A'));
    lines.push('');
  }
  n++;
}
lines.push('---');
lines.push('FIM DA LISTA');
const txt = lines.join('\n');
fs.writeFileSync('results/lista-casos-bdc-nao-detectou.txt', txt);
console.log('Arquivo salvo: results/lista-casos-bdc-nao-detectou.txt');
console.log(txt);
