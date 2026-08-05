const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectId = 'compliance-hub-br';
const cpf = '81257570900';
const outputDir = 'C:\\Users\\Analista\\AppData\\Local\\Temp\\opencode';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function getSecret(name) {
  const cmd = `gcloud secrets versions access latest --secret="${name}" --project=${projectId}`;
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

async function callBdc(accessToken, tokenId, limit, offset) {
  let datasetStr = `processes.limit(${limit})`;
  if (offset > 0) {
    datasetStr = `processes.limit(${limit}).next(${offset})`;
  }
  const body = {
    q: `doc{${cpf}} returnupdates{false}`,
    Datasets: datasetStr,
    Limit: 1,
  };
  const response = await fetch('https://plataforma.bigdatacorp.com.br/pessoas', {
    method: 'POST',
    headers: {
      AccessToken: accessToken,
      TokenId: tokenId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function main() {
  const accessToken = getSecret('BIGDATACORP_ACCESS_TOKEN');
  const tokenId = getSecret('BIGDATACORP_TOKEN_ID');

  const limit = 100;
  const allRaw = [];
  let offset = 0;
  let totalProcessCount = 0;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore && pageCount < 10) {
    pageCount++;
    const data = await callBdc(accessToken, tokenId, limit, offset);
    allRaw.push(data);
    const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;
    const processes = resultEntry?.Processes || null;
    const count = Array.isArray(processes) ? processes.length : 0;
    totalProcessCount += count;
    hasMore = count === limit && pageCount < 10;
    if (hasMore) {
      offset += limit;
    }
  }

  const output = {
    cpf,
    queriedAt: new Date().toISOString(),
    pageCount,
    totalProcessCount,
    rawPages: allRaw,
  };

  const outputPath = path.join(outputDir, `bdc-processos-${cpf}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`SAVED:${outputPath}`);
  console.log(`PAGES:${pageCount}`);
  console.log(`COUNT:${totalProcessCount}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
