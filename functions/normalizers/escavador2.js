function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const { isExcludedCrimeType, hasCriminalIndicator } = require('../helpers/crimeTypeFilter');

function positiveFlag(value, count) {
  return value === true || Number(count || 0) > 0 ? 'POSITIVE' : 'NEGATIVE';
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeArea(value) {
  const area = String(value || '').trim().toUpperCase();
  if (/CRIM|PENAL/.test(area)) return 'CRIMINAL';
  if (/TRABALH|LABOR/.test(area)) return 'LABOR';
  if (/CIVIL/.test(area)) return 'CIVIL';
  return 'UNKNOWN';
}

function normalizeStatus(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || Array.isArray(value)) return String(value);

  const details = [
    value.detalhes && `detalhes: ${value.detalhes}`,
    value.movimentacoes && `movimentacoes: ${value.movimentacoes}`,
    value.documentos && `documentos: ${value.documentos}`,
  ].filter(Boolean);
  if (details.length > 0) return details.join(' | ');
  return null;
}

function normalizeRoleFlags(role = {}) {
  const text = [role.categoria, role.tipo_principal, role.polo_principal]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  return {
    isDefendant: /DEFENDANT|REU|RECLAMAD|REQUERID|EXECUTAD|PASSIVO/.test(text),
    isPlaintiff: /PLAINTIFF|AUTOR|RECLAMANTE|REQUERENTE|EXEQUENTE|ATIVO/.test(text),
    isVictim: /VICTIM|VITIMA|OFENDID|PREJUDICAD|AGRAVIAD/.test(text),
    isWitness: /WITNESS|TESTEMUNH|INFORMANTE/.test(text),
    isLawyer: /LAWYER|ADVOGAD|PROCURADOR/.test(text),
  };
}

function mapProcess(processo = {}, index = 0) {
  processo = asObject(processo);
  const cnj = processo.cnj || {};
  const dados = processo.normalizado?.dados || {};
  const match = processo.normalizado?.match || {};
  const papel = processo.papel_candidato || {};
  const area = normalizeArea(processo.classificacao?.area);
  const fullCnj = cnj.valor_completo_extraido || (!cnj.mascarado ? cnj.valor : null);
  const numeroCnj = fullCnj || cnj.valor || null;
  const status = normalizeStatus(processo.status);
  const roleFlags = normalizeRoleFlags(papel);
  const tipoNormalizado = papel.tipo_principal || papel.categoria || null;

  const subjects = Array.isArray(dados.subjects) ? dados.subjects : (Array.isArray(processo.subjects) ? processo.subjects : []);
  const classifications = Array.isArray(dados.classifications) ? dados.classifications : (Array.isArray(processo.classifications) ? processo.classifications : []);
  const cnjSubject = dados.cnj_subject || processo.cnjSubject || null;
  const cnjBroadSubject = dados.cnj_broad_subject || processo.cnjBroadSubject || null;
  const cnjProcedure = dados.cnj_procedure || processo.cnjProcedure || null;

  const excludedCrimeType = isExcludedCrimeType({
    area,
    classe: dados.classe,
    tipo: dados.tipo,
    natureza: dados.natureza,
    assunto: dados.assunto,
    subject: dados.subject,
    cnjSubject,
    cnjBroadSubject,
    subjects,
    classifications,
  });

  return {
    escavador2Index: index,
    numeroCnj,
    cnj: numeroCnj,
    numeroCnjMascarado: cnj.mascarado ? cnj.valor || null : null,
    numeroCnjCompletoExtraido: cnj.valor_completo_extraido || null,
    cnjResolutionStatus: cnj.status_resolucao || null,
    area,
    isCriminal: area === 'CRIMINAL' && hasCriminalIndicator({ area, classe: dados.classe, assunto: dados.assunto, tipo: dados.tipo, natureza: dados.natureza, subjects, classifications }) && !excludedCrimeType,
    isLabor: area === 'LABOR',
    isTrabalhista: area === 'LABOR',
    isExcludedCrimeType: excludedCrimeType || null,
    isMaterialRisk: processo.classificacao?.risco_material === true && !excludedCrimeType,
    subjects,
    classifications,
    cnjSubject,
    cnjBroadSubject,
    cnjProcedure,
    tribunalSigla: dados.tribunal_sigla || null,
    tribunal: dados.tribunal_sigla || null,
    processUf: dados.uf || null,
    classe: dados.classe || null,
    assunto: dados.assunto || null,
    assuntoPrincipal: dados.assunto || null,
    dataInicio: dados.data_inicio || null,
    data: dados.data_inicio || null,
    distributionDate: dados.data_inicio || null,
    ultimaMovimentacao: dados.ultima_movimentacao || null,
    dataUltimaMovimentacao: dados.ultima_movimentacao || null,
    lastMovementDate: dados.ultima_movimentacao || null,
    roleCategory: papel.categoria || 'UNKNOWN',
    tipoPrincipal: papel.tipo_principal || null,
    tipoNormalizado,
    specificRole: tipoNormalizado,
    polo: papel.polo_principal || null,
    hasExactCpfMatch: match.has_exact_cpf_match === true,
    matchType: match.tipo || null,
    tipoMatch: match.tipo || null,
    status,
    ...roleFlags,
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

function normalizeEscavador2Response(response = {}, options = {}) {
  response = asObject(response);
  options = asObject(options);
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
      consultedAt: options.consultedAt || null,
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
