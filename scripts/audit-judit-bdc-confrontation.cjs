const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT = 'compliance-hub-br';
const CID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function req(options, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: response.statusCode, body: data }); }
      });
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

function decodeFirestoreValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(decodeFirestoreValue);
  if (v.mapValue) {
    const obj = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = decodeFirestoreValue(val);
    return obj;
  }
  return v;
}

async function getToken() {
  const tokenPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: cfg.tokens.refresh_token,
    client_id: CID,
    client_secret: CS
  }).toString();
  const r = await req({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
  }, body);
  if (r.status !== 200) throw new Error('Token failed');
  return r.body.access_token;
}

async function listDoneCases(startAtName = null) {
  const token = await getToken();
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'cases' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'EQUAL',
          value: { stringValue: 'DONE' }
        }
      },
      orderBy: [
        {
          field: { fieldPath: '__name__' },
          direction: 'ASCENDING'
        }
      ],
      select: {
        fields: [
          { fieldPath: 'candidateName' },
          { fieldPath: 'cpf' },
          { fieldPath: 'status' },
          { fieldPath: 'finalVerdict' },
          { fieldPath: 'criminalFlag' },
          { fieldPath: 'laborFlag' },
          { fieldPath: 'warrantFlag' },
          { fieldPath: 'juditRoleSummary' },
          { fieldPath: 'bigdatacorpProcessos' },
          { fieldPath: 'juditCriminalFlag' },
          { fieldPath: 'juditCriminalCount' },
          { fieldPath: 'bigdatacorpCriminalFlag' },
          { fieldPath: 'bigdatacorpCriminalCount' },
          { fieldPath: 'juditLaborFlag' },
          { fieldPath: 'juditLaborCount' },
          { fieldPath: 'bigdatacorpLaborFlag' },
          { fieldPath: 'bigdatacorpLaborCount' },
          { fieldPath: 'juditProcessTotal' },
          { fieldPath: 'bigdatacorpProcessTotal' },
          { fieldPath: 'createdAt' },
          { fieldPath: 'concludedAt' }
        ]
      },
      limit: 500
    }
  };
  
  if (startAtName) {
    query.structuredQuery.startAt = {
      values: [{ referenceValue: `projects/${PROJECT}/databases/(default)/documents/cases/${startAtName}` }],
      before: false
    };
  }
  
  const r = await req({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + PROJECT + '/databases/(default)/documents:runQuery',
    method: 'POST',
    headers: { 
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  }, JSON.stringify(query));
  
  if (r.status !== 200) throw new Error('Query failed: ' + JSON.stringify(r.body));
  return r.body;
}

function extractProcessNumbers(roleSummary) {
  if (!Array.isArray(roleSummary)) return [];
  return roleSummary
    .filter(p => p.code && p.code.match(/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/))
    .map(p => p.code);
}

function extractBdcProcessNumbers(processos) {
  if (!Array.isArray(processos)) return [];
  return processos
    .filter(p => p.cnj && p.cnj.match(/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/))
    .map(p => p.cnj);
}

function maskCpf(cpf) {
  if (!cpf || cpf.length < 2) return 'N/A';
  return '***.***.***-' + cpf.slice(-2);
}

async function runAudit() {
  console.log('Iniciando auditoria de casos DONE...');
  
  let lastDocName = null;
  const allCases = [];
  let pageCount = 0;
  let hasMore = true;
  
  while (hasMore && pageCount < 20) {
    pageCount++;
    console.log(`Buscando pagina ${pageCount}...`);
    const result = await listDoneCases(lastDocName);
    
    // Filter out empty documents (end of stream marker)
    const docs = result.filter(doc => doc.document);
    
    if (docs.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const doc of docs) {
      const fields = {};
      for (const [k, v] of Object.entries(doc.document.fields || {})) {
        fields[k] = decodeFirestoreValue(v);
      }
      
      const juditProcs = extractProcessNumbers(fields.juditRoleSummary);
      const bdcProcs = extractBdcProcessNumbers(fields.bigdatacorpProcessos);
      
      const intersection = juditProcs.filter(p => bdcProcs.includes(p));
      const juditOnly = juditProcs.filter(p => !bdcProcs.includes(p));
      const bdcOnly = bdcProcs.filter(p => !juditProcs.includes(p));
      
      const juditProcessTotal = fields.juditProcessTotal || juditProcs.length;
      const bdcProcessTotal = fields.bigdatacorpProcessTotal || bdcProcs.length;

      allCases.push({
        id: doc.document.name.split('/').pop(),
        candidateName: fields.candidateName || 'N/A',
        cpf: maskCpf(fields.cpf),
        finalVerdict: fields.finalVerdict || 'N/A',
        criminalFlag: fields.criminalFlag || 'N/A',
        laborFlag: fields.laborFlag || 'N/A',
        warrantFlag: fields.warrantFlag || 'N/A',
        juditCriminalFlag: fields.juditCriminalFlag || 'N/A',
        juditCriminalCount: fields.juditCriminalCount || 0,
        bdcCriminalFlag: fields.bigdatacorpCriminalFlag || 'N/A',
        bdcCriminalCount: fields.bigdatacorpCriminalCount || 0,
        juditLaborFlag: fields.juditLaborFlag || 'N/A',
        juditLaborCount: fields.juditLaborCount || 0,
        bdcLaborFlag: fields.bigdatacorpLaborFlag || 'N/A',
        bdcLaborCount: fields.bigdatacorpLaborCount || 0,
        juditProcessTotal: juditProcessTotal,
        bdcProcessTotal: bdcProcessTotal,
        juditCount: juditProcs.length,
        bdcCount: bdcProcs.length,
        intersection: intersection,
        intersectionCount: intersection.length,
        juditOnly: juditOnly,
        juditOnlyCount: juditOnly.length,
        bdcOnly: bdcOnly,
        bdcOnlyCount: bdcOnly.length,
        hasJudit: juditProcessTotal > 0,
        hasBdc: bdcProcessTotal > 0,
        hasBoth: juditProcessTotal > 0 && bdcProcessTotal > 0,
        hasNeither: juditProcessTotal === 0 && bdcProcessTotal === 0,
        hasBdcDetails: bdcProcs.length > 0,
        createdAt: fields.createdAt,
        concludedAt: fields.concludedAt
      });
    }
    
    console.log(`Pagina ${pageCount}: ${docs.length} documentos | Total acumulado: ${allCases.length} casos DONE`);
    
    // Check if we got less than limit (last page)
    if (docs.length < 500) {
      hasMore = false;
    } else {
      // Get last document name for next page
      const lastDoc = docs[docs.length - 1];
      lastDocName = lastDoc.document.name.split('/').pop();
    }
  }
  
  // Generate report
  const total = allCases.length;
  const withJuditOnly = allCases.filter(c => c.hasJudit && !c.hasBdc).length;
  const withBdcOnly = allCases.filter(c => !c.hasJudit && c.hasBdc).length;
  const withBoth = allCases.filter(c => c.hasBoth).length;
  const withNeither = allCases.filter(c => c.hasNeither).length;
  
  const withIntersection = allCases.filter(c => c.intersectionCount > 0).length;
  const withJuditOnlyProcs = allCases.filter(c => c.juditOnlyCount > 0).length;
  const withBdcOnlyProcs = allCases.filter(c => c.bdcOnlyCount > 0).length;
  const withBdcProcessCounters = allCases.filter(c => c.bdcProcessTotal > 0).length;
  const withBdcProcessDetails = allCases.filter(c => c.hasBdcDetails).length;
  
  const criminalDivergence = allCases.filter(c => {
    return c.juditCriminalFlag !== 'N/A' && c.bdcCriminalFlag !== 'N/A' && 
           c.juditCriminalFlag !== c.bdcCriminalFlag;
  }).length;
  
  const laborDivergence = allCases.filter(c => {
    return c.juditLaborFlag !== 'N/A' && c.bdcLaborFlag !== 'N/A' && 
           c.juditLaborFlag !== c.bdcLaborFlag;
  }).length;
  
  const juditFoundBdcDidnt = allCases.filter(c => c.juditProcessTotal > 0 && c.bdcProcessTotal === 0).length;
  const bdcFoundJuditDidnt = allCases.filter(c => c.bdcProcessTotal > 0 && c.juditProcessTotal === 0).length;
  
  const report = {
    summary: {
      totalCases: total,
      withJuditOnly: withJuditOnly,
      withBdcOnly: withBdcOnly,
      withBoth: withBoth,
      withNeither: withNeither,
      withIntersection: withIntersection,
      withJuditOnlyProcs: withJuditOnlyProcs,
      withBdcOnlyProcs: withBdcOnlyProcs,
      withBdcProcessCounters: withBdcProcessCounters,
      withBdcProcessDetails: withBdcProcessDetails,
      juditCoverage: total > 0 ? ((withJuditOnly + withBoth) / total * 100).toFixed(1) + '%' : '0%',
      bdcCoverage: total > 0 ? ((withBdcOnly + withBoth) / total * 100).toFixed(1) + '%' : '0%',
      intersectionRate: total > 0 ? (withIntersection / total * 100).toFixed(1) + '%' : '0%',
      criminalDivergence: criminalDivergence,
      laborDivergence: laborDivergence,
      juditFoundBdcDidnt: juditFoundBdcDidnt,
      bdcFoundJuditDidnt: bdcFoundJuditDidnt
    },
    cases: allCases
  };
  
  const outputPath = path.join(process.cwd(), 'results', 'audit-judit-bdc-confrontation.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  
  // Generate markdown summary
  const mdReport = `# Auditoria Judit vs BigDataCorp - Casos Concluidos

## Resumo Executivo

- **Total de casos analisados:** ${total}
- **Cobertura Judit:** ${report.summary.juditCoverage}
- **Cobertura BigDataCorp:** ${report.summary.bdcCoverage}
- **Taxa de intersecao por CNJ:** ${report.summary.intersectionRate}
- **Observacao:** BigDataCorp possui contadores de processos em ${withBdcProcessCounters} casos, mas detalhes bigdatacorpProcessos persistidos em ${withBdcProcessDetails} casos. Portanto, a comparacao de eficiencia usa contadores por provider; a intersecao por CNJ fica limitada aos poucos/nenhum casos com detalhes persistidos do BDC.

## Distribuicao de Processos

| Cenario | Quantidade | Percentual |
|---------|-----------|------------|
| Judit apenas | ${withJuditOnly} | ${total > 0 ? (withJuditOnly/total*100).toFixed(1) : 0}% |
| BigDataCorp apenas | ${withBdcOnly} | ${total > 0 ? (withBdcOnly/total*100).toFixed(1) : 0}% |
| Ambos com processo | ${withBoth} | ${total > 0 ? (withBoth/total*100).toFixed(1) : 0}% |
| Nenhum | ${withNeither} | ${total > 0 ? (withNeither/total*100).toFixed(1) : 0}% |

## Divergencias entre Providers

| Tipo de Divergencia | Quantidade |
|---------------------|-----------|
| Criminal: Judit != BDC | ${criminalDivergence} |
| Trabalhista: Judit != BDC | ${laborDivergence} |
| Judit encontrou, BDC nao | ${juditFoundBdcDidnt} |
| BDC encontrou, Judit nao | ${bdcFoundJuditDidnt} |

## Eficiencia por Provider

### Judit
- Casos com processos: ${withJuditOnly + withBoth} (${report.summary.juditCoverage})
- Casos em que Judit encontrou e BDC nao: ${juditFoundBdcDidnt}
- CNJs detalhados apenas no Judit: ${withJuditOnlyProcs}

### BigDataCorp
- Casos com processos: ${withBdcOnly + withBoth} (${report.summary.bdcCoverage})
- Casos em que BDC encontrou e Judit nao: ${bdcFoundJuditDidnt}
- Casos com contadores BDC positivos: ${withBdcProcessCounters}
- Casos com detalhes BDC persistidos: ${withBdcProcessDetails}

## Casos com Intersecao Completa

${withIntersection} casos tiveram pelo menos 1 CNJ confirmado por ambos os providers. Este numero deve ser lido com cautela porque os detalhes de processos do BDC nao estao persistidos na maior parte da base, apesar dos contadores positivos.

## Detalhamento por Caso

${allCases.map(c => {
  const juditStatus = c.juditProcessTotal > 0 ? `${c.juditProcessTotal} processo(s)` : 'Sem processos';
  const bdcStatus = c.bdcProcessTotal > 0 ? `${c.bdcProcessTotal} processo(s)` : 'Sem processos';
  const overlap = c.intersectionCount > 0 ? ` (${c.intersectionCount} em comum)` : '';
  return `- **${c.candidateName}** (${c.cpf}) | Veredito: ${c.finalVerdict}\n  - Judit: ${juditStatus} | Criminal: ${c.juditCriminalFlag} | Trabalhista: ${c.juditLaborFlag}\n  - BDC: ${bdcStatus} | Criminal: ${c.bdcCriminalFlag} | Trabalhista: ${c.bdcLaborFlag}${overlap}`;
}).join('\n\n')}

---
*Gerado em: ${new Date().toISOString()}*
`;

  const mdPath = path.join(process.cwd(), 'docs', 'audits', 'audit-judit-bdc-confrontation.md');
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, mdReport);
  
  console.log('\n=== RESUMO DA AUDITORIA ===');
  console.log('Total casos DONE: ' + total);
  console.log('Judit apenas: ' + withJuditOnly + ' (' + (total > 0 ? (withJuditOnly/total*100).toFixed(1) : 0) + '%)');
  console.log('BDC apenas: ' + withBdcOnly + ' (' + (total > 0 ? (withBdcOnly/total*100).toFixed(1) : 0) + '%)');
  console.log('Ambos: ' + withBoth + ' (' + (total > 0 ? (withBoth/total*100).toFixed(1) : 0) + '%)');
  console.log('Nenhum: ' + withNeither + ' (' + (total > 0 ? (withNeither/total*100).toFixed(1) : 0) + '%)');
  console.log('\nCobertura Judit: ' + report.summary.juditCoverage);
  console.log('Cobertura BDC: ' + report.summary.bdcCoverage);
  console.log('Taxa de intersecao: ' + report.summary.intersectionRate);
  console.log('Casos com contadores BDC positivos: ' + withBdcProcessCounters);
  console.log('Casos com detalhes BDC persistidos: ' + withBdcProcessDetails);
  console.log('\nDivergencias criminais: ' + criminalDivergence);
  console.log('Divergencias trabalhistas: ' + laborDivergence);
  console.log('Judit encontrou, BDC nao: ' + juditFoundBdcDidnt);
  console.log('BDC encontrou, Judit nao: ' + bdcFoundJuditDidnt);
  console.log('\nRelatorio JSON: ' + outputPath);
  console.log('Relatorio Markdown: ' + mdPath);
}

runAudit().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
