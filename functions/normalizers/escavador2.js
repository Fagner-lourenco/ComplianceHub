function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const { isExcludedCrimeType, hasCriminalIndicator, CONSUMER_CIVIL_NOISE } = require('../helpers/crimeTypeFilter');
const { classifyRole, normalizeSideForClassifier } = require('../helpers/roleClassifier');

const RAW_AUDIT_MAX_BYTES = 128 * 1024;
// Reserva margem para os demais campos do caso e para marcadores adicionados pela deduplicacao.
const ESCAVADOR2_PERSISTED_MAX_BYTES = 320 * 1024;
const ESCAVADOR2_CALLBACK_MINIMAL_MAX_BYTES = 96 * 1024;
const SEMANTIC_ARRAY_MAX_ITEMS = 20;
const SEMANTIC_TEXT_MAX_BYTES = 1024;
const NORMALIZED_TEXT_MAX_BYTES = 4096;
const TECHNICAL_ITEMS_MAX = 100;

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

function boundedTextOrNull(value, maxBytes = NORMALIZED_TEXT_MAX_BYTES) {
  const text = textOrNull(value);
  return text && Buffer.byteLength(text, 'utf8') <= maxBytes ? text : null;
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

function compactSemanticArray(value) {
  const source = asArray(value);
  const values = [];
  let omitted = 0;
  for (const item of source) {
    const text = textOrNull(item);
    if (!text || Buffer.byteLength(text, 'utf8') > SEMANTIC_TEXT_MAX_BYTES || values.length >= SEMANTIC_ARRAY_MAX_ITEMS) {
      omitted += 1;
      continue;
    }
    values.push(text);
  }
  return { values, omitted };
}

function compactNormalizedData(value) {
  const compact = pickFields(value, [
    'classe',
    'tipo',
    'natureza',
    'assunto',
    'subject',
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
  const omittedFields = [];
  for (const [field, item] of Object.entries(compact)) {
    const valid = (typeof item === 'string' && Buffer.byteLength(item, 'utf8') <= NORMALIZED_TEXT_MAX_BYTES)
      || typeof item === 'number'
      || typeof item === 'boolean'
      || item === null;
    if (!valid) {
      delete compact[field];
      omittedFields.push(field);
    }
  }
  const subjects = compactSemanticArray(asObject(value).subjects);
  const classifications = compactSemanticArray(asObject(value).classifications);
  if (subjects.values.length > 0) compact.subjects = subjects.values;
  if (subjects.omitted > 0) compact.subjectsOmitidos = subjects.omitted;
  if (classifications.values.length > 0) compact.classifications = classifications.values;
  if (classifications.omitted > 0) compact.classificationsOmitidas = classifications.omitted;
  if (omittedFields.length > 0) compact.camposOmitidos = omittedFields;
  return compact;
}

function isShortMetadataValue(value) {
  return (typeof value === 'number' && Number.isFinite(value))
    || typeof value === 'boolean'
    || (typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 256);
}

function compactIdentityFields(value, fields) {
  return Object.fromEntries(Object.entries(pickFields(value, fields)).filter(([, item]) => (
    typeof item === 'string' && Buffer.byteLength(item, 'utf8') <= NORMALIZED_TEXT_MAX_BYTES
  )));
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
    cnj: pickFields(processo.cnj, ['valor', 'mascarado', 'valor_completo_extraido', 'status_resolucao']),
    classificacao: pickFields(processo.classificacao, ['area', 'risco_material']),
    papel_candidato: pickFields(processo.papel_candidato, ['tipo_principal', 'polo_principal', 'categoria']),
    lista: processo.lista ? {
      polo_ativo: processo.lista.polo_ativo || null,
      polo_passivo: processo.lista.polo_passivo || null,
      papeis_pessoa_pesquisada: processo.lista.papeis_pessoa_pesquisada || null,
    } : null,
    normalizado: {
      cnj: normalizado.cnj || null,
      match: pickFields(normalizado.match, ['tipo', 'has_exact_cpf_match']),
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

function minimizeProcessForAudit(process = {}) {
  const dados = asObject(process.normalizado?.dados);
  return {
    status: process.status || null,
    cnj: process.cnj || {},
    classificacao: process.classificacao || {},
    papel_candidato: process.papel_candidato || {},
    lista: process.lista || null,
    normalizado: {
      match: process.normalizado?.match || {},
      dados: pickFields(dados, [
        'classe', 'assunto', 'tribunal_sigla', 'uf', 'cidade', 'orgao_julgador',
        'status_predito', 'data_inicio', 'data_fim', 'ultima_movimentacao', 'camposOmitidos',
      ]),
    },
    detalhes: process.detalhes || null,
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

  if (rawByteLength(compact) > RAW_AUDIT_MAX_BYTES && compact.processos.length > 0) {
    compact.processos = compact.processos.map(minimizeProcessForAudit);
    compact.processosMinimizados = compact.processos.length;
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
  const compactDados = compactNormalizedData(dados);
  const match = processo.normalizado?.match || {};
  const papel = processo.papel_candidato || {};
  const area = normalizeArea(processo.classificacao?.area);
  const areaForRole = area === 'CRIMINAL' ? 'Criminal' : area === 'LABOR' ? 'Trabalhista' : area;
  const fullCnj = cnj.valor_completo_extraido || (!cnj.mascarado ? cnj.valor : null);
  const numeroCnj = fullCnj || cnj.valor || null;
  const status = normalizeStatus(processo.status) || normalizeStatus(compactDados.status_predito);
  const processCity = boundedTextOrNull(compactDados.cidade);
  const judgingBody = boundedTextOrNull(compactDados.orgao_julgador);
  const parties = collectProcessParties(processo);
  const roleFlags = normalizeRoleFlags(papel, areaForRole);
  const tipoNormalizado = papel.tipo_principal || papel.categoria || null;

  const compactSubjects = compactSemanticArray(Array.isArray(dados.subjects) ? dados.subjects : processo.subjects);
  const compactClassifications = compactSemanticArray(Array.isArray(dados.classifications) ? dados.classifications : processo.classifications);
  const subjects = compactSubjects.values;
  const classifications = compactClassifications.values;
  const cnjSubject = boundedTextOrNull(compactDados.cnj_subject || processo.cnjSubject);
  const cnjBroadSubject = boundedTextOrNull(compactDados.cnj_broad_subject || processo.cnjBroadSubject);
  const cnjProcedure = boundedTextOrNull(compactDados.cnj_procedure || processo.cnjProcedure);

  const criminalFacts = {
    area,
    classe: compactDados.classe,
    tipo: compactDados.tipo,
    natureza: compactDados.natureza,
    assunto: compactDados.assunto,
    subject: compactDados.subject,
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
    tribunalSigla: compactDados.tribunal_sigla || null,
    tribunal: compactDados.tribunal_sigla || null,
    processUf: compactDados.uf || null,
    classe: compactDados.classe || null,
    assunto: compactDados.assunto || null,
    assuntoPrincipal: compactDados.assunto || null,
    dataInicio: compactDados.data_inicio || null,
    data: compactDados.data_inicio || null,
    distributionDate: compactDados.data_inicio || null,
    ultimaMovimentacao: compactDados.ultima_movimentacao || null,
    dataUltimaMovimentacao: compactDados.ultima_movimentacao || null,
    lastMovementDate: compactDados.ultima_movimentacao || null,
    roleCategory: roleFlags.roleClassification.category,
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
    semanticOmissions: compactSubjects.omitted > 0 || compactClassifications.omitted > 0 || compactDados.camposOmitidos ? {
      subjects: compactSubjects.omitted,
      classifications: compactClassifications.omitted,
      fields: compactDados.camposOmitidos || [],
    } : null,
    _sourceEscavador2: { provider: 'escavador2' },
  };
}

function minimizeCanonicalProcess(process = {}) {
  process = asObject(process);
  const compact = {};
  const textFields = [
    'numeroCnj', 'cnj', 'numeroCnjMascarado', 'numeroCnjCompletoExtraido', 'cnjResolutionStatus',
    'area', 'isExcludedCrimeType', 'cnjSubject', 'cnjBroadSubject', 'cnjProcedure', 'tribunalSigla',
    'tribunal', 'processUf', 'classe', 'assunto', 'assuntoPrincipal', 'status', 'dataInicio', 'data',
    'distributionDate', 'ultimaMovimentacao', 'dataUltimaMovimentacao', 'lastMovementDate',
    'roleCategory', 'tipoPrincipal', 'tipoNormalizado', 'specificRole', 'polo', 'matchType',
    'tipoMatch', 'processCity', 'comarca', 'vara', 'judgingBody', 'duplicateOfProvider',
    'duplicateOfProcessNumber', 'duplicateMatchStrength',
  ];
  for (const field of textFields) {
    const value = boundedTextOrNull(process[field]);
    if (Object.prototype.hasOwnProperty.call(process, field)) compact[field] = value;
  }
  const booleanFields = [
    'isCriminal', 'isLabor', 'isTrabalhista', 'isMaterialRisk', 'hasExactCpfMatch', 'isDefendant',
    'isPlaintiff', 'isVictim', 'isWitness', 'isLawyer', 'isDuplicate',
    'isDuplicateEscavador2Finding', 'isNewEscavador2Finding',
  ];
  for (const field of booleanFields) {
    if (typeof process[field] === 'boolean') compact[field] = process[field];
  }
  if (typeof process.escavador2Index === 'number' && Number.isFinite(process.escavador2Index)) {
    compact.escavador2Index = process.escavador2Index;
  }
  const subjects = compactSemanticArray(process.subjects).values.slice(0, 5);
  const classifications = compactSemanticArray(process.classifications).values.slice(0, 5);
  if (Object.prototype.hasOwnProperty.call(process, 'subjects')) compact.subjects = subjects;
  if (Object.prototype.hasOwnProperty.call(process, 'classifications')) compact.classifications = classifications;
  const compactParty = (party) => {
    const source = asObject(party);
    const result = compactIdentityFields(source, [
      'name', 'role', 'side', 'document', 'documento', 'cpf', 'documentNumber', 'taxId',
    ]);
    const documents = asArray(source.documents).slice(0, 10).map((document) => (
      typeof document === 'string'
        ? boundedTextOrNull(document)
        : compactIdentityFields(document, ['number', 'value', 'type'])
    )).filter((document) => document && (typeof document === 'string' || Object.keys(document).length > 0));
    if (documents.length > 0) result.documents = documents;
    return result;
  };
  const originalParties = asArray(process.parties);
  const parties = originalParties.slice(0, 50).map(compactParty).filter((party) => Object.keys(party).length > 0);
  if (Object.prototype.hasOwnProperty.call(process, 'parties')) compact.parties = parties;
  const roleClassification = compactIdentityFields(process.roleClassification, ['category', 'riskLevel', 'reason']);
  if (Object.keys(roleClassification).length > 0) compact.roleClassification = roleClassification;
  const semanticOmissions = compactStats(process.semanticOmissions);
  if (Object.keys(semanticOmissions).length > 0) compact.semanticOmissions = semanticOmissions;
  for (const field of ['movimentacoesResumo', 'documentosResumo']) {
    if (!Object.prototype.hasOwnProperty.call(process, field)) continue;
    const summary = asObject(process[field]);
    compact[field] = {
      total: typeof summary.total === 'number' && Number.isFinite(summary.total) && summary.total >= 0 ? summary.total : null,
      coletadas: typeof summary.coletadas === 'number' && Number.isFinite(summary.coletadas) && summary.coletadas >= 0 ? summary.coletadas : null,
      coletados: typeof summary.coletados === 'number' && Number.isFinite(summary.coletados) && summary.coletados >= 0 ? summary.coletados : null,
    };
  }
  if (asArray(process.subjects).length > subjects.length
    || asArray(process.classifications).length > classifications.length
    || originalParties.length > parties.length) {
    compact.persistenceOmissions = {
      subjects: Math.max(0, asArray(process.subjects).length - subjects.length),
      classifications: Math.max(0, asArray(process.classifications).length - classifications.length),
      parties: Math.max(0, originalParties.length - parties.length),
    };
  }
  compact._sourceEscavador2 = { provider: 'escavador2' };
  return compact;
}

function processPriority(process = {}) {
  return (process.isNewEscavador2Finding === true ? 32 : 0)
    + (process.isMaterialRisk === true ? 16 : 0)
    + (process.isCriminal === true ? 8 : 0)
    + (process.isLabor === true ? 4 : 0)
    + (process.hasExactCpfMatch === true ? 2 : 0);
}

function nonNegativeNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sanitizePersistedPayload(value = {}) {
  const source = asObject(value);
  const payload = {
    escavador2ApiStatus: boundedTextOrNull(source.escavador2ApiStatus, 256),
    escavador2ProcessTotal: nonNegativeNumber(source.escavador2ProcessTotal),
    escavador2Processos: asArray(source.escavador2Processos).map(minimizeCanonicalProcess),
    escavador2CostBRL: nonNegativeNumber(source.escavador2CostBRL),
  };
  const countFields = [
    'escavador2CriminalCount', 'escavador2LaborCount', 'escavador2MaterialRiskCount',
    'escavador2CnjMaskedCount', 'escavador2CnjExtractedCount', 'escavador2DuplicateCount',
    'escavador2NewFindingCount',
  ];
  for (const field of countFields) payload[field] = nonNegativeNumber(source[field]);
  for (const field of ['escavador2CriminalFlag', 'escavador2LaborFlag']) {
    const flag = boundedTextOrNull(source[field], 32);
    if (flag) payload[field] = flag;
  }
  if (typeof source.escavador2HasNewMaterialRisk === 'boolean') {
    payload.escavador2HasNewMaterialRisk = source.escavador2HasNewMaterialRisk;
  }
  const partialErrors = asArray(source.escavador2PartialErrors).slice(0, TECHNICAL_ITEMS_MAX).map(compactPartialError);
  if (partialErrors.length > 0) payload.escavador2PartialErrors = partialErrors;
  const stats = Object.fromEntries(Object.entries(compactStats(source.escavador2Stats)).slice(0, TECHNICAL_ITEMS_MAX));
  if (Object.keys(stats).length > 0) payload.escavador2Stats = stats;
  const sources = asObject(source.escavador2Sources);
  const compactSources = {
    consulta: compactIdentityFields(sources.consulta, ['cpf', 'nome', 'status']),
    perfil: compactIdentityFields(sources.perfil, ['cpf', 'nome', 'nome_completo', 'data_nascimento']),
    resumo: Object.fromEntries(Object.entries(asObject(sources.resumo)).filter(([, item]) => (
      (typeof item === 'number' && Number.isFinite(item)) || typeof item === 'boolean'
    ))),
    consultedAt: boundedTextOrNull(sources.consultedAt, 256),
  };
  if (Object.values(compactSources).some((item) => item !== null && (typeof item !== 'object' || Object.keys(item).length > 0))) {
    payload.escavador2Sources = compactSources;
  }
  const rawPayloads = asObject(source.escavador2RawPayloads);
  if (rawPayloads.response && rawByteLength(rawPayloads.response) <= RAW_AUDIT_MAX_BYTES) {
    payload.escavador2RawPayloads = { response: rawPayloads.response };
  }
  const technicalOmissions = compactStats(source.escavador2TechnicalOmissions);
  if (Object.keys(technicalOmissions).length > 0) payload.escavador2TechnicalOmissions = technicalOmissions;
  const processOmissions = compactStats(source.escavador2ProcessOmissions);
  if (Object.keys(processOmissions).length > 0) payload.escavador2ProcessOmissions = processOmissions;
  return payload;
}

function enforceEscavador2PersistedBudget(value, maxBytes = ESCAVADOR2_PERSISTED_MAX_BYTES) {
  const payload = sanitizePersistedPayload(value);
  if (rawByteLength(payload) <= maxBytes) return payload;

  const originalErrors = asArray(payload.escavador2PartialErrors).length;
  const originalStats = Object.keys(asObject(payload.escavador2Stats)).length;
  const previousOmissions = payload.escavador2TechnicalOmissions || {};
  delete payload.escavador2PartialErrors;
  delete payload.escavador2Stats;
  payload.escavador2TechnicalOmissions = {
    partialErrors: Number(previousOmissions.partialErrors || 0) + originalErrors,
    stats: Number(previousOmissions.stats || 0) + originalStats,
  };
  if (rawByteLength(payload) <= maxBytes) return payload;

  if (payload.escavador2Sources) {
    payload.escavador2Sources = {
      consulta: compactIdentityFields(payload.escavador2Sources.consulta, ['cpf', 'nome', 'status']),
      consultedAt: boundedTextOrNull(payload.escavador2Sources.consultedAt, 256),
      compacted: true,
    };
  }
  if (rawByteLength(payload) <= maxBytes) return payload;

  const rawProcessCount = payload.escavador2RawPayloads?.response?.processos?.length || 0;
  if (payload.escavador2RawPayloads) {
    payload.escavador2RawPayloads = { response: { truncado: true, processosOmitidos: rawProcessCount } };
  }

  const originalProcesses = payload.escavador2Processos;
  const previousProcessOmissions = asObject(payload.escavador2ProcessOmissions);
  const originalProcessCount = Math.max(
    originalProcesses.length,
    nonNegativeNumber(previousProcessOmissions.original),
    originalProcesses.length + nonNegativeNumber(previousProcessOmissions.omitted),
  );
  const prioritized = [...originalProcesses].sort((left, right) => (
    processPriority(right) - processPriority(left)
    || Number(left.escavador2Index || 0) - Number(right.escavador2Index || 0)
  ));
  payload.escavador2Processos = [];
  payload.escavador2ProcessOmissions = { original: originalProcessCount, omitted: originalProcessCount };
  for (const process of prioritized) {
    payload.escavador2Processos.push(process);
    payload.escavador2ProcessOmissions.omitted -= 1;
    if (rawByteLength(payload) > maxBytes) {
      payload.escavador2Processos.pop();
      payload.escavador2ProcessOmissions.omitted += 1;
    }
  }
  payload.escavador2Processos.sort((left, right) => Number(left.escavador2Index || 0) - Number(right.escavador2Index || 0));
  if (payload.escavador2ProcessOmissions.omitted === 0) delete payload.escavador2ProcessOmissions;
  if (rawByteLength(payload) <= maxBytes) return payload;

  const fallback = {
    escavador2ApiStatus: payload.escavador2ApiStatus,
    escavador2ProcessTotal: payload.escavador2ProcessTotal,
    escavador2Processos: [],
    escavador2ProcessOmissions: { original: originalProcessCount, omitted: originalProcessCount },
    escavador2PersistenceTruncated: true,
    escavador2CostBRL: 0,
  };
  if (rawByteLength(fallback) <= maxBytes) return fallback;
  return { escavador2Processos: [], escavador2PersistenceTruncated: true };
}

function buildMinimalEscavador2Persistence(normalized = {}) {
  const payload = pickFields(asObject(normalized), [
    'escavador2ApiStatus', 'escavador2ProcessTotal', 'escavador2CriminalFlag',
    'escavador2CriminalCount', 'escavador2LaborFlag', 'escavador2LaborCount',
    'escavador2MaterialRiskCount', 'escavador2CnjMaskedCount', 'escavador2CnjExtractedCount',
    'escavador2DuplicateCount', 'escavador2NewFindingCount', 'escavador2HasNewMaterialRisk',
    'escavador2CostBRL',
  ]);
  payload.escavador2Processos = asArray(normalized.escavador2Processos);
  return enforceEscavador2PersistedBudget(payload, ESCAVADOR2_CALLBACK_MINIMAL_MAX_BYTES);
}

function normalizeEscavador2Response(response = {}, options = {}) {
  response = asObject(response);
  options = asObject(options);
  const resumo = response.resumo || {};
  const processos = asArray(response.processos).map(mapProcess);
  const criminalCount = Number(resumo.total_criminais ?? processos.filter((item) => item.isCriminal).length);
  const laborCount = Number(resumo.total_trabalhistas ?? processos.filter((item) => item.isLabor).length);

  const payload = {
    escavador2ApiStatus: boundedTextOrNull(response.consulta?.status, 256),
    escavador2ProcessTotal: Number(resumo.total_processos ?? processos.length),
    escavador2Processos: processos,
    escavador2CriminalFlag: positiveFlag(resumo.tem_criminal, criminalCount),
    escavador2CriminalCount: criminalCount,
    escavador2LaborFlag: positiveFlag(resumo.tem_trabalhista, laborCount),
    escavador2LaborCount: laborCount,
    escavador2MaterialRiskCount: Number(resumo.total_riscos_materiais || 0),
    escavador2CnjMaskedCount: Number(resumo.total_cnj_mascarado || 0),
    escavador2CnjExtractedCount: Number(resumo.total_cnj_completo_extraido || 0),
    escavador2PartialErrors: asArray(response.erros_parciais).slice(0, TECHNICAL_ITEMS_MAX).map(compactPartialError),
    escavador2Stats: Object.fromEntries(Object.entries(compactStats(response.estatisticas)).slice(0, TECHNICAL_ITEMS_MAX)),
    escavador2Sources: {
      consulta: compactIdentityFields(response.consulta, ['cpf', 'nome', 'status']),
      perfil: compactIdentityFields(response.perfil, ['cpf', 'nome', 'nome_completo', 'data_nascimento']),
      resumo: Object.fromEntries(Object.entries(asObject(resumo)).filter(([, item]) => (
        (typeof item === 'number' && Number.isFinite(item)) || typeof item === 'boolean'
      ))),
      consultedAt: boundedTextOrNull(options.consultedAt, 256),
    },
    escavador2RawPayloads: {
      response: buildCompactRawResponse(response),
    },
    escavador2CostBRL: 0,
  };
  const partialErrorsOmitted = Math.max(0, asArray(response.erros_parciais).length - payload.escavador2PartialErrors.length);
  const statsOmitted = Math.max(0, Object.keys(asObject(response.estatisticas)).length - Object.keys(payload.escavador2Stats).length);
  if (partialErrorsOmitted > 0 || statsOmitted > 0) {
    payload.escavador2TechnicalOmissions = { partialErrors: partialErrorsOmitted, stats: statsOmitted };
  }
  return enforceEscavador2PersistedBudget(payload);
}

module.exports = {
  normalizeEscavador2Response,
  normalizeArea,
  ESCAVADOR2_PERSISTED_MAX_BYTES,
  ESCAVADOR2_CALLBACK_MINIMAL_MAX_BYTES,
  enforceEscavador2PersistedBudget,
  buildMinimalEscavador2Persistence,
};
