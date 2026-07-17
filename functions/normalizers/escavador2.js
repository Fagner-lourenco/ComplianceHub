function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const { isExcludedCrimeType, hasCriminalIndicator, CONSUMER_CIVIL_NOISE } = require('../helpers/crimeTypeFilter');
const { classifyRole, normalizeSideForClassifier } = require('../helpers/roleClassifier');

const RAW_AUDIT_MAX_BYTES = 128 * 1024;

function positiveFlag(value, count) {
  return value === true || Number(count || 0) > 0 ? 'POSITIVE' : 'NEGATIVE';
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asObjectArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object');
  return value && typeof value === 'object' ? [value] : [];
}

function textOrNull(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text || null;
}

function collectProcessParties(processo = {}) {
  const parties = [];
  const seen = new Set();
  const add = (name, side) => {
    const cleanName = textOrNull(name);
    if (!cleanName || !side) return;
    const key = `${side}:${cleanName.toLocaleUpperCase('pt-BR')}`;
    if (seen.has(key)) return;
    seen.add(key);
    parties.push({
      name: cleanName,
      role: side === 'ACTIVE' ? 'Polo Ativo' : 'Polo Passivo',
      side,
    });
  };
  const addPoles = (source) => {
    const data = asObject(source);
    add(data.polo_ativo, 'ACTIVE');
    add(data.polo_passivo, 'PASSIVE');
  };

  addPoles(processo.lista);
  addPoles(processo.detalhes?.processo);
  for (const fonte of asObjectArray(processo.detalhes?.raw?.fontes)) {
    for (const envolvido of asObjectArray(fonte.envolvidos)) {
      const polo = textOrNull(envolvido.polo)?.toUpperCase();
      add(envolvido.nome, polo === 'ATIVO' ? 'ACTIVE' : polo === 'PASSIVO' ? 'PASSIVE' : null);
    }
  }
  return parties;
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
  // Forma-objeto ({detalhes, movimentacoes, documentos}) eh status da COLETA
  // (DONE/PENDING/...), nao status processual — nao pode virar texto de relatorio.
  return null;
}

function compactFetchSummary(value) {
  if (Array.isArray(value)) return { total: value.length };
  if (!value || typeof value !== 'object') {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  }
  const countOrNull = (count) => (
    typeof count === 'number' && Number.isFinite(count) && count >= 0 ? count : null
  );
  return {
    total: countOrNull(value.total),
    coletadas: countOrNull(value.coletadas),
    coletados: countOrNull(value.coletados),
  };
}

function pickFields(value, fields) {
  const source = asObject(value);
  return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

function compactNormalizedData(value) {
  return pickFields(value, [
    'classe',
    'tipo',
    'natureza',
    'assunto',
    'subject',
    'subjects',
    'classifications',
    'cnj_subject',
    'cnj_broad_subject',
    'cnj_procedure',
    'tribunal',
    'tribunal_sigla',
    'uf',
    'cidade',
    'orgao_julgador',
    'status',
    'status_predito',
    'data_inicio',
    'data_fim',
    'ultima_movimentacao',
  ]);
}

function isShortMetadataValue(value) {
  return (typeof value === 'number' && Number.isFinite(value))
    || typeof value === 'boolean'
    || (typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 256);
}

function compactPartialError(value) {
  return Object.fromEntries(Object.entries(pickFields(
    value,
    ['processo', 'cnj', 'codigo', 'erro', 'mensagem', 'fase', 'status'],
  )).filter(([, item]) => isShortMetadataValue(item)));
}

function compactStats(value) {
  return Object.fromEntries(Object.entries(asObject(value)).filter(([, item]) => isShortMetadataValue(item)));
}

function compactProcessForAudit(processo = {}) {
  processo = asObject(processo);
  const normalizado = asObject(processo.normalizado);
  return {
    status: normalizeStatus(processo.status),
    cnj: processo.cnj || null,
    classificacao: processo.classificacao || null,
    papel_candidato: processo.papel_candidato || null,
    lista: processo.lista ? {
      polo_ativo: processo.lista.polo_ativo || null,
      polo_passivo: processo.lista.polo_passivo || null,
      papeis_pessoa_pesquisada: processo.lista.papeis_pessoa_pesquisada || null,
    } : null,
    normalizado: {
      cnj: normalizado.cnj || null,
      match: normalizado.match || null,
      dados: compactNormalizedData(normalizado.dados),
      status_fetch: normalizado.status_fetch || null,
    },
    detalhes: processo.detalhes?.processo ? {
      processo: {
        polo_ativo: processo.detalhes.processo.polo_ativo || null,
        polo_passivo: processo.detalhes.processo.polo_passivo || null,
      },
    } : null,
  };
}

function rawByteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function buildCompactRawResponse(response = {}) {
  response = asObject(response);
  const compact = {
    consulta: pickFields(response.consulta, ['cpf', 'nome', 'status']),
    perfil: pickFields(response.perfil, ['cpf', 'nome', 'nome_completo', 'data_nascimento']),
    resumo: pickFields(response.resumo, [
      'total_processos',
      'tem_criminal',
      'total_criminais',
      'tem_trabalhista',
      'total_trabalhistas',
      'total_riscos_materiais',
      'total_cnj_mascarado',
      'total_cnj_completo_extraido',
    ]),
    erros_parciais: asArray(response.erros_parciais).map(compactPartialError),
    estatisticas: compactStats(response.estatisticas),
    processos: asArray(response.processos).map(compactProcessForAudit),
  };
  const originalCount = compact.processos.length;

  // Evidencias processuais tem prioridade sobre metadados tecnicos agregados.
  if (rawByteLength(compact) > RAW_AUDIT_MAX_BYTES && compact.erros_parciais.length > 0) {
    compact.errosParciaisOmitidos = compact.erros_parciais.length;
    compact.erros_parciais = [];
  }
  const statsCount = Object.keys(compact.estatisticas).length;
  if (rawByteLength(compact) > RAW_AUDIT_MAX_BYTES && statsCount > 0) {
    compact.estatisticasOmitidas = statsCount;
    compact.estatisticas = {};
  }
  if (rawByteLength(compact) > RAW_AUDIT_MAX_BYTES && Object.keys(compact.perfil).length > 0) {
    compact.perfilOmitido = true;
    compact.perfil = {};
  }

  while (rawByteLength(compact) > RAW_AUDIT_MAX_BYTES && compact.processos.length > 0) {
    compact.processos.pop();
    compact.truncado = true;
    compact.processosOmitidos = originalCount - compact.processos.length;
  }
  if (rawByteLength(compact) <= RAW_AUDIT_MAX_BYTES) return compact;

  const fallback = {
    consulta: {
      cpf: response.consulta?.cpf || null,
      nome: response.consulta?.nome || null,
      status: response.consulta?.status || null,
    },
    resumo: {
      total_processos: response.resumo?.total_processos ?? originalCount,
      total_criminais: response.resumo?.total_criminais ?? null,
      total_trabalhistas: response.resumo?.total_trabalhistas ?? null,
    },
    truncado: true,
    processosOmitidos: originalCount,
  };
  if (rawByteLength(fallback) <= RAW_AUDIT_MAX_BYTES) return fallback;

  return { truncado: true, processosOmitidos: originalCount };
}

function normalizeRoleFlags(role = {}, area = '') {
  const tipoPrincipal = role.tipo_principal || role.categoria || null;
  const polo = role.polo_principal || null;
  const roleClassification = classifyRole(tipoPrincipal, area, normalizeSideForClassifier(polo));

  return {
    roleClassification,
    isDefendant: roleClassification.category === 'DEFENDANT',
    isPlaintiff: roleClassification.category === 'PLAINTIFF',
    isVictim: roleClassification.category === 'VICTIM',
    isWitness: roleClassification.category === 'WITNESS',
    isLawyer: roleClassification.category === 'LAWYER',
  };
}

function mapProcess(processo = {}, index = 0) {
  processo = asObject(processo);
  const cnj = processo.cnj || {};
  const dados = processo.normalizado?.dados || {};
  const match = processo.normalizado?.match || {};
  const papel = processo.papel_candidato || {};
  const area = normalizeArea(processo.classificacao?.area);
  const areaForRole = area === 'CRIMINAL' ? 'Criminal' : area === 'LABOR' ? 'Trabalhista' : area;
  const fullCnj = cnj.valor_completo_extraido || (!cnj.mascarado ? cnj.valor : null);
  const numeroCnj = fullCnj || cnj.valor || null;
  const status = normalizeStatus(processo.status) || normalizeStatus(dados.status_predito);
  const processCity = textOrNull(dados.cidade);
  const judgingBody = textOrNull(dados.orgao_julgador);
  const parties = collectProcessParties(processo);
  const roleFlags = normalizeRoleFlags(papel, areaForRole);
  const tipoNormalizado = papel.tipo_principal || papel.categoria || null;

  const subjects = Array.isArray(dados.subjects) ? dados.subjects : (Array.isArray(processo.subjects) ? processo.subjects : []);
  const classifications = Array.isArray(dados.classifications) ? dados.classifications : (Array.isArray(processo.classifications) ? processo.classifications : []);
  const cnjSubject = dados.cnj_subject || processo.cnjSubject || null;
  const cnjBroadSubject = dados.cnj_broad_subject || processo.cnjBroadSubject || null;
  const cnjProcedure = dados.cnj_procedure || processo.cnjProcedure || null;

  const criminalFacts = {
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
  };
  const excludedCrimeType = isExcludedCrimeType(criminalFacts);
  const hasIndicator = hasCriminalIndicator(criminalFacts);
  // Consumer/civil rotulado como criminal pela API = falso positivo puro; some.
  // Demais exclusoes (TRANSITO/AMBIENTAL/HTE/CARTA_PRECATORIA_NOISE) continuam
  // isCriminal para cair no tier ATTENTION de criminalMateriality, nao em POSITIVE.
  const isCivilFalsePositive = excludedCrimeType === CONSUMER_CIVIL_NOISE;
  // Guard anti-falso-positivo da API: sem indicador criminal canonico nem
  // risco_material do provider, area=CRIMINAL sozinha nao marca o processo.
  const isCriminal = area === 'CRIMINAL'
    && !isCivilFalsePositive
    && (hasIndicator || processo.classificacao?.risco_material === true);

  return {
    escavador2Index: index,
    numeroCnj,
    cnj: numeroCnj,
    numeroCnjMascarado: cnj.mascarado ? cnj.valor || null : null,
    numeroCnjCompletoExtraido: cnj.valor_completo_extraido || null,
    cnjResolutionStatus: cnj.status_resolucao || null,
    area,
    isCriminal,
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
    processCity,
    comarca: processCity,
    vara: judgingBody,
    judgingBody,
    parties,
    ...roleFlags,
    movimentacoesResumo: compactFetchSummary(processo.movimentacoes_resumo),
    documentosResumo: compactFetchSummary(processo.documentos_resumo),
    _sourceEscavador2: {
      provider: 'escavador2',
      cnj,
      classificacao: processo.classificacao || null,
      papel_candidato: papel,
      normalizado: {
        cnj: processo.normalizado?.cnj || null,
        match,
        dados: compactNormalizedData(dados),
        status_fetch: processo.normalizado?.status_fetch || null,
      },
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
      response: buildCompactRawResponse(response),
    },
    escavador2CostBRL: 0,
  };
}

module.exports = {
  normalizeEscavador2Response,
  normalizeArea,
};
