/**
 * Teste isolado de um unico CPF contra a API Escavador2.
 * Usa payload minimo para depurar 502.
 */

const { execSync } = require('child_process');
const path = require('path');

const ADAPTER_PATH = path.join(__dirname, '..', 'functions', 'adapters', 'escavador2.js');
const NORMALIZER_PATH = path.join(__dirname, '..', 'functions', 'normalizers', 'escavador2.js');

function getApiKey() {
  const key = execSync(
    'gcloud secrets versions access latest --secret=escavador2-api-key --project=compliance-hub-br',
    { encoding: 'utf8', timeout: 30000 }
  );
  return key.trim();
}

async function main() {
  const cpf = process.argv[2] || '016.302.905-99';
  const nome = process.argv[3] || 'ANTONIO DIEGO CONCEICAO NOBRE';

  const apiKey = getApiKey();
  console.log(`Chave lida (comprimento=${apiKey.length})`);
  console.log(`CPF: ${cpf}`);
  console.log(`Nome: ${nome}`);

  const { consultarEscavador2 } = require(ADAPTER_PATH);
  const { normalizeEscavador2Response } = require(NORMALIZER_PATH);

  const startedAt = Date.now();
  try {
    const raw = await consultarEscavador2({
      cpf,
      nome,
      apiKey,
      options: {
        detalhar: true,
        movimentacoes: 'risk_only',
        documentos: 'risk_only',
      },
    });
    const elapsedMs = Date.now() - startedAt;
    const normalized = normalizeEscavador2Response(raw);

    console.log(`\nTempo: ${elapsedMs}ms`);
    console.log(`Status: ${normalized.escavador2ApiStatus}`);
    console.log(`Total processos: ${normalized.escavador2ProcessTotal}`);
    console.log(`Criminal: ${normalized.escavador2CriminalFlag} (${normalized.escavador2CriminalCount})`);
    console.log(`Trabalhista: ${normalized.escavador2LaborFlag} (${normalized.escavador2LaborCount})`);
    console.log(`Processos:`, JSON.stringify(normalized.escavador2Processos.map((p) => ({
      numeroCnj: p.numeroCnj,
      area: p.area,
      tribunalSigla: p.tribunalSigla,
      uf: p.processUf,
      isMaterialRisk: p.isMaterialRisk,
      matchType: p.matchType,
    })), null, 2));
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    console.log(`\nTempo ate erro: ${elapsedMs}ms`);
    console.log(`ERRO: ${err.message}`);
    if (err.statusCode) console.log(`HTTP status: ${err.statusCode}`);
    if (err.responseBody) console.log(`Body: ${err.responseBody}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
