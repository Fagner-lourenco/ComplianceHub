function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function positiveFlag(value, count) {
  return value === true || Number(count || 0) > 0 ? 'POSITIVE' : 'NEGATIVE';
}

function normalizeArea(value) {
  const area = String(value || '').trim().toUpperCase();
  if (area === 'CRIMINAL') return 'CRIMINAL';
  if (area === 'LABOR') return 'LABOR';
  if (area === 'CIVIL') return 'CIVIL';
  return 'UNKNOWN';
}

function mapProcess(processo = {}, index = 0) {
  const cnj = processo.cnj || {};
  const dados = processo.normalizado?.dados || {};
  const match = processo.normalizado?.match || {};
  const papel = processo.papel_candidato || {};
  const area = normalizeArea(processo.classificacao?.area);
  const fullCnj = cnj.valor_completo_extraido || (!cnj.mascarado ? cnj.valor : null);

  return {
    escavador2Index: index,
    numeroCnj: fullCnj || cnj.valor || null,
    numeroCnjMascarado: cnj.mascarado ? cnj.valor || null : null,
    numeroCnjCompletoExtraido: cnj.valor_completo_extraido || null,
    cnjResolutionStatus: cnj.status_resolucao || null,
    area,
    isCriminal: area === 'CRIMINAL',
    isLabor: area === 'LABOR',
    isMaterialRisk: processo.classificacao?.risco_material === true,
    tribunalSigla: dados.tribunal_sigla || null,
    processUf: dados.uf || null,
    classe: dados.classe || null,
    assunto: dados.assunto || null,
    dataInicio: dados.data_inicio || null,
    ultimaMovimentacao: dados.ultima_movimentacao || null,
    roleCategory: papel.categoria || 'UNKNOWN',
    tipoPrincipal: papel.tipo_principal || null,
    polo: papel.polo_principal || null,
    hasExactCpfMatch: match.has_exact_cpf_match === true,
    matchType: match.tipo || null,
    status: processo.status || {},
    movimentacoesResumo: processo.movimentacoes_resumo || null,
    documentosResumo: processo.documentos_resumo || null,
    _sourceEscavador2: {
      provider: 'escavador2',
      cnj,
      classificacao: processo.classificacao || null,
      papel_candidato: papel,
      normalizado: processo.normalizado || null,
    },
  };
}

function normalizeEscavador2Response(response = {}) {
  const resumo = response.resumo || {};
  const processos = asArray(response.processos).map(mapProcess);
  const criminalCount = Number(resumo.total_criminais ?? processos.filter((item) => item.isCriminal).length);
  const laborCount = Number(resumo.total_trabalhistas ?? processos.filter((item) => item.isLabor).length);

  return {
    escavador2ApiStatus: response.consulta?.status || null,
    escavador2ProcessTotal: Number(resumo.total_processos ?? processos.length),
    escavador2Processos: processos,
    escavador2CriminalFlag: positiveFlag(resumo.tem_criminal, criminalCount),
    escavador2CriminalCount: criminalCount,
    escavador2LaborFlag: positiveFlag(resumo.tem_trabalhista, laborCount),
    escavador2LaborCount: laborCount,
    escavador2MaterialRiskCount: Number(resumo.total_riscos_materiais || 0),
    escavador2CnjMaskedCount: Number(resumo.total_cnj_mascarado || 0),
    escavador2CnjExtractedCount: Number(resumo.total_cnj_completo_extraido || 0),
    escavador2PartialErrors: asArray(response.erros_parciais),
    escavador2Stats: response.estatisticas || {},
    escavador2Sources: {
      consulta: response.consulta || null,
      perfil: response.perfil || null,
      resumo,
      consultedAt: new Date().toISOString(),
    },
    escavador2RawPayloads: {
      response,
    },
    escavador2CostBRL: 0,
  };
}

module.exports = {
  normalizeEscavador2Response,
  normalizeArea,
};
