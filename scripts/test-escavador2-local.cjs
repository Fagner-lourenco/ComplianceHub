/**
 * Teste local isolado do adapter Escavador2.
 * Nao escreve no Firestore de producao.
 * Le a chave do Secret Manager via gcloud CLI e consulta a API real.
 */

const { execSync } = require('child_process');
const path = require('path');

const ADAPTER_PATH = path.join(__dirname, '..', 'functions', 'adapters', 'escavador2.js');
const NORMALIZER_PATH = path.join(__dirname, '..', 'functions', 'normalizers', 'escavador2.js');

const CPFs = [
  { cpf: '163.100.854-41', nome: 'YSLANNY CLAUDYA GOMES DE SÁ', expected: 'Apto' },
  { cpf: '016.302.905-99', nome: 'ANTONIO DIEGO CONCEICAO NOBRE', expected: 'Nao recomendado' },
  { cpf: '071.502.802-26', nome: 'AUDISLEY LACERDA TEIXEIRA LEAL', expected: 'Apto' },
  { cpf: '922.336.605-44', nome: 'LEILA JACIARA SANTOS FEITOSA', expected: 'Atencao' },
  { cpf: '154.673.877-07', nome: 'JONATHAN JOSE DE LIMA COSTA', expected: 'Nao recomendado' },
  { cpf: '051.749.485-00', nome: 'LUCIA DE SOUZA NASCIMENTO', expected: 'Pendente/correcao' },
];

function getApiKey() {
  try {
    const key = execSync(
      'gcloud secrets versions access latest --secret=escavador2-api-key --project=compliance-hub-br',
      { encoding: 'utf8', timeout: 30000 }
    );
    return key.trim();
  } catch (err) {
    throw new Error(`Falha ao ler escavador2-api-key do Secret Manager: ${err.message}`);
  }
}

async function main() {
  const apiKey = getApiKey();
  console.log(`Chave lida do Secret Manager (comprimento=${apiKey.length})`);

  const { consultarEscavador2 } = require(ADAPTER_PATH);
  const { normalizeEscavador2Response } = require(NORMALIZER_PATH);

  for (const item of CPFs) {
    console.log('\n========================================');
    console.log(`CPF: ${item.cpf}`);
    console.log(`Nome: ${item.nome}`);
    console.log(`Esperado ComplianceHub: ${item.expected}`);
    console.log('========================================');

    const startedAt = Date.now();
    try {
      const raw = await consultarEscavador2({
        cpf: item.cpf,
        nome: item.nome,
        apiKey,
        options: {
          detalhar: true,
          movimentacoes: 'risk_only',
          documentos: 'risk_only',
          limit_movimentacoes: 20,
          limit_documentos: 20,
        },
      });
      const elapsedMs = Date.now() - startedAt;

      const normalized = normalizeEscavador2Response(raw, { consultedAt: new Date().toISOString() });

      console.log(`Tempo de resposta: ${elapsedMs}ms`);
      console.log(`Status API: ${normalized.escavador2ApiStatus}`);
      console.log(`Total processos: ${normalized.escavador2ProcessTotal}`);
      console.log(`Criminal: ${normalized.escavador2CriminalFlag} (${normalized.escavador2CriminalCount})`);
      console.log(`Trabalhista: ${normalized.escavador2LaborFlag} (${normalized.escavador2LaborCount})`);
      console.log(`Riscos materiais: ${normalized.escavador2MaterialRiskCount}`);
      console.log(`CNJs mascarados: ${normalized.escavador2CnjMaskedCount}`);
      console.log(`CNJs completos extraidos: ${normalized.escavador2CnjExtractedCount}`);

      if (normalized.escavador2PartialErrors.length > 0) {
        console.log(`Erros parciais: ${normalized.escavador2PartialErrors.length}`);
        console.log(JSON.stringify(normalized.escavador2PartialErrors, null, 2));
      }

      normalized.escavador2Processos.forEach((proc, idx) => {
        console.log(`\n  [${idx + 1}] Processo`);
        console.log(`    numeroCnj: ${proc.numeroCnj || '(mascarado)'}`);
        console.log(`    numeroCnjMascarado: ${proc.numeroCnjMascarado || '-'}`);
        console.log(`    area: ${proc.area}`);
        console.log(`    isCriminal: ${proc.isCriminal}`);
        console.log(`    isLabor: ${proc.isLabor}`);
        console.log(`    isMaterialRisk: ${proc.isMaterialRisk}`);
        console.log(`    tribunalSigla: ${proc.tribunalSigla || '-'}`);
        console.log(`    processUf: ${proc.processUf || '-'}`);
        console.log(`    classe: ${proc.classe || '-'}`);
        console.log(`    assunto: ${proc.assunto || '-'}`);
        console.log(`    polo: ${proc.polo || '-'}`);
        console.log(`    matchType: ${proc.matchType || '-'}`);
        console.log(`    hasExactCpfMatch: ${proc.hasExactCpfMatch}`);
      });
    } catch (err) {
      const elapsedMs = Date.now() - startedAt;
      console.log(`Tempo ate erro: ${elapsedMs}ms`);
      console.log(`ERRO: ${err.message}`);
      if (err.statusCode) console.log(`HTTP status: ${err.statusCode}`);
      if (err.responseBody) console.log(`Body: ${err.responseBody}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
