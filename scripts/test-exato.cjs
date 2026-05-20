const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.exato.digital';
const TOKEN = process.env.EXATO_API_TOKEN;

if (!TOKEN) {
  console.error('EXATO_API_TOKEN ausente no ambiente.');
  process.exit(1);
}

const ALVOS = [
  { id: 1, slug: 'andre', nome: 'ANDRE LUIZ CRUZ DOS SANTOS', cpf: '48052053854', uf: 'SP' },
  { id: 2, slug: 'diego', nome: 'DIEGO EMANUEL ALVES DE SOUZA', cpf: '10794180329', uf: 'CE' },
  { id: 3, slug: 'renan', nome: 'RENAN GUIMARAES DE SOUSA AUGUSTO', cpf: '11819916766', uf: 'RJ' },
  { id: 4, slug: 'francisco', nome: 'FRANCISCO TACIANO DE SOUSA', cpf: '05023290336', uf: 'CE' },
  { id: 5, slug: 'matheus', nome: 'MATHEUS GONCALVES DOS SANTOS', cpf: '46247243804', uf: 'SP' },
];

const RESULTS_DIR = path.join(__dirname, '..', 'results', 'exato');
fs.mkdirSync(RESULTS_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postForm(endpoint, formEntries, options = {}) {
  const started = Date.now();
  const url = new URL(`${API_BASE}${endpoint}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(formEntries)) {
    if (value !== undefined && value !== null && value !== '') {
      body.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      token: TOKEN,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(options.timeoutMs || 120000),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    elapsedMs: Date.now() - started,
    data,
  };
}

function summarizeProcessResult(payload) {
  const result = payload?.Result || {};
  const processos = Array.isArray(result.Processos) ? result.Processos : [];

  const processNumbers = processos.map((p) => p.Numero).filter(Boolean);
  const criminal = processos.filter((p) => /penal|crim|inqu[eé]rito|execu[cç][aã]o penal|viol[eê]ncia dom[eé]stica/i.test(
    [p.Tipo, p.Assunto, p.Situacao].filter(Boolean).join(' '),
  ));
  const labor = processos.filter((p) => /trabalh/i.test([p.Tipo, p.Assunto, p.TribunalTipo, p.TribunalNome].filter(Boolean).join(' ')));
  const active = processos.filter((p) => /ativo|andamento|tramita|pendente|aberto/i.test(p.Situacao || ''));

  return {
    apiResultType: payload?.ApiResultType || null,
    transactionResultType: payload?.TransactionResultType || null,
    elapsedTimeInMilliseconds: payload?.ElapsedTimeInMilliseconds ?? null,
    totalCost: payload?.TotalCost ?? null,
    totalCostInCredits: payload?.TotalCostInCredits ?? null,
    outdatedResult: payload?.OutdatedResult ?? null,
    hasPdf: payload?.HasPdf ?? null,
    pdfUrl: payload?.PdfUrl || null,
    originalFilesUrl: payload?.OriginalFilesUrl || null,
    message: payload?.Message || null,
    totalProcessos: result?.TotalProcessos ?? processos.length,
    totalComoSubstituto: result?.TotalProcessosComoSubstituto ?? null,
    totalComoRequerente: result?.TotalProcessosComoRequerente ?? null,
    totalComoRequerido: result?.TotalProcessosComoRequerido ?? null,
    totalComoOutraParte: result?.TotalProcessosComoOutraParte ?? null,
    processNumbers,
    criminalProcessNumbers: criminal.map((p) => p.Numero).filter(Boolean),
    laborProcessNumbers: labor.map((p) => p.Numero).filter(Boolean),
    activeProcessNumbers: active.map((p) => p.Numero).filter(Boolean),
    processos: processos.map((p) => ({
      numero: p.Numero || null,
      tipo: p.Tipo || null,
      assunto: p.Assunto || null,
      tribunalNome: p.TribunalNome || null,
      tribunalInstancia: p.TribunalInstancia || null,
      tribunalTipo: p.TribunalTipo || null,
      tribunalDistrito: p.TribunalDistrito || null,
      corpoJulgador: p.CorpoJulgador || null,
      estado: p.Estado || null,
      situacao: p.Situacao || null,
      numeroVolumes: p.NumeroVolumes ?? null,
      numeroPaginas: p.NumeroPaginas ?? null,
      valor: p.Valor ?? null,
      publicacaoData: p.PublicacaoData || null,
      notificacaoData: p.NotificacaoData || null,
      ultimaMovimentacaoData: p.UltimaMovimentacaoData || null,
      capturaData: p.CapturaData || null,
      ultimaAtualizacaoData: p.UltimaAtualizacaoData || null,
      partesCount: Array.isArray(p.Partes) ? p.Partes.length : 0,
      movimentacoesCount: Array.isArray(p.Movimentacoes) ? p.Movimentacoes.length : 0,
      peticoesCount: Array.isArray(p.Peticoes) ? p.Peticoes.length : 0,
      partes: Array.isArray(p.Partes) ? p.Partes.slice(0, 12).map((parte) => ({
        documento: parte.Documento || null,
        nome: parte.Nome || null,
        polaridade: parte.Polaridade || null,
        tipo: parte.Tipo || null,
        oab: parte.ParteDetalhes?.OAB || null,
      })) : [],
      movimentacoes: Array.isArray(p.Movimentacoes) ? p.Movimentacoes.slice(0, 20).map((mov) => ({
        movimento: mov.Movimento || null,
        publicacaoData: mov.PublicacaoData || null,
        capturaData: mov.CapturaData || null,
      })) : [],
    })),
  };
}

function summarizeWarrantResult(payload) {
  const result = payload?.Result || {};
  const mandados = Array.isArray(result.Mandados) ? result.Mandados : [];
  const active = mandados.filter((m) => /pendente|aberto|ativo|cumprimento/i.test(m.DescricaoStatus || ''));

  return {
    apiResultType: payload?.ApiResultType || null,
    transactionResultType: payload?.TransactionResultType || null,
    elapsedTimeInMilliseconds: payload?.ElapsedTimeInMilliseconds ?? null,
    totalCost: payload?.TotalCost ?? null,
    totalCostInCredits: payload?.TotalCostInCredits ?? null,
    outdatedResult: payload?.OutdatedResult ?? null,
    hasPdf: payload?.HasPdf ?? null,
    pdfUrl: payload?.PdfUrl || null,
    originalFilesUrl: payload?.OriginalFilesUrl || null,
    message: payload?.Message || null,
    totalMandados: mandados.length,
    activeMandados: active.length,
    warrantProcessNumbers: mandados.map((m) => m.NumeroProcesso).filter(Boolean),
    mandados: mandados.map((m) => ({
      id: m.Id ?? null,
      numeroPeca: m.NumeroPeca || null,
      numeroPecaFormatado: m.NumeroPecaFormatado || null,
      numeroProcesso: m.NumeroProcesso || null,
      nomePessoa: m.NomePessoa || null,
      descricaoStatus: m.DescricaoStatus || null,
      dataExpedicao: m.DataExpedicao || null,
      nomeOrgao: m.NomeOrgao || null,
      descricaoPeca: m.DescricaoPeca || null,
      nomeMae: m.NomeMae || null,
      nomePai: m.NomePai || null,
      descricaoSexo: m.DescricaoSexo || null,
      descricaoProfissao: m.DescricaoProfissao || null,
      dataNascimento: m.DataNascimento || null,
      detalhes: m.DetalhesCompleto ? {
        url: m.DetalhesCompleto.Url || null,
        sinteseDecisao: m.DetalhesCompleto.SinteseDecisao || null,
        magistrado: m.DetalhesCompleto.Magistrado || null,
        motivoExpedicao: m.DetalhesCompleto.MotivoExpedicao || null,
        motivoExpedicaoAlvara: m.DetalhesCompleto.MotivoExpedicaoAlvara || null,
        dataValidade: m.DetalhesCompleto.DataValidade || null,
        especiePrisao: m.DetalhesCompleto.EspeciePrisao || null,
        regimePrisional: m.DetalhesCompleto.RegimePrisional || null,
        tempoPenaAno: m.DetalhesCompleto.TempoPenaAno ?? null,
        tempoPenaMes: m.DetalhesCompleto.TempoPenaMes ?? null,
        tempoPenaDia: m.DetalhesCompleto.TempoPenaDia ?? null,
        recaptura: m.DetalhesCompleto.Recaptura || null,
        isSolturaConcedida: m.DetalhesCompleto.IsSolturaConcedida || null,
        pessoa: m.DetalhesCompleto.Pessoa ? {
          cpf: m.DetalhesCompleto.Pessoa.Cpf ?? null,
          nome: m.DetalhesCompleto.Pessoa.Nome || null,
          nomeSocial: m.DetalhesCompleto.Pessoa.NomeSocial || null,
          nascimentoData: m.DetalhesCompleto.Pessoa.NascimentoData || null,
          sexo: m.DetalhesCompleto.Pessoa.Sexo || null,
          maeNome: m.DetalhesCompleto.Pessoa.MaeNome || null,
          paiNome: m.DetalhesCompleto.Pessoa.PaiNome || null,
          rgNumero: m.DetalhesCompleto.Pessoa.RgNumero || null,
          rgUf: m.DetalhesCompleto.Pessoa.RgUf || null,
          receitaSituacaoCadastral: m.DetalhesCompleto.Pessoa.ReceitaSituacaoCadastral || null,
          rendaMensalPresumida: m.DetalhesCompleto.Pessoa.RendaMensalPresumida ?? null,
          pepFuncao: m.DetalhesCompleto.Pessoa.PepFuncao || null,
          homonimos: m.DetalhesCompleto.Pessoa.Homonimos ?? null,
        } : null,
        orgaoUsuarioCriador: m.DetalhesCompleto.OrgaoUsuarioCriador ? {
          nome: m.DetalhesCompleto.OrgaoUsuarioCriador.Nome || null,
          tipo: m.DetalhesCompleto.OrgaoUsuarioCriador.Tipo || null,
          telefone: m.DetalhesCompleto.OrgaoUsuarioCriador.Telefone || null,
          municipio: m.DetalhesCompleto.OrgaoUsuarioCriador.Municipio?.Nome || null,
          uf: m.DetalhesCompleto.OrgaoUsuarioCriador.Municipio?.Uf?.Sigla || null,
        } : null,
      } : null,
    })),
  };
}

async function main() {
  const runAt = new Date().toISOString();
  const summary = {
    runAt,
    endpoints: {
      processos: '/br/exato/processos',
      mandadosPrisao: '/br/cnj/mandados-prisao',
    },
    cases: [],
  };

  for (const alvo of ALVOS) {
    console.log(`\n[${alvo.id}] ${alvo.nome} (${alvo.cpf})`);

    const processos = await postForm('/br/exato/processos', { cpf: alvo.cpf }, { timeoutMs: 120000 });
    const processosPath = path.join(RESULTS_DIR, `exato_processos_${alvo.id}_${alvo.slug}.json`);
    fs.writeFileSync(processosPath, JSON.stringify(processos, null, 2), 'utf8');
    console.log(`  Processos: HTTP ${processos.status} | ${processos.elapsedMs} ms`);
    await sleep(1200);

    const mandados = await postForm('/br/cnj/mandados-prisao', { cpf: alvo.cpf }, { timeoutMs: 120000 });
    const mandadosPath = path.join(RESULTS_DIR, `exato_mandados_${alvo.id}_${alvo.slug}.json`);
    fs.writeFileSync(mandadosPath, JSON.stringify(mandados, null, 2), 'utf8');
    console.log(`  Mandados:  HTTP ${mandados.status} | ${mandados.elapsedMs} ms`);
    await sleep(1200);

    summary.cases.push({
      ...alvo,
      processosHttpStatus: processos.status,
      mandadosHttpStatus: mandados.status,
      processosElapsedMs: processos.elapsedMs,
      mandadosElapsedMs: mandados.elapsedMs,
      processos: summarizeProcessResult(processos.data),
      mandados: summarizeWarrantResult(mandados.data),
    });
  }

  const summaryPath = path.join(RESULTS_DIR, 'exato_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('\nResumo:');
  for (const item of summary.cases) {
    console.log(
      `  [${item.id}] ${item.slug} | proc=${item.processos.totalProcessos} (${item.processos.criminalProcessNumbers.length} crim)` +
      ` | mand=${item.mandados.totalMandados} (${item.mandados.activeMandados} ativos)` +
      ` | procMs=${item.processosElapsedMs} | mandMs=${item.mandadosElapsedMs}`,
    );
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
