function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const MIN_MASKED_CNJ_UNMASKED_POSITIONS = 12;

function parseCnjPattern(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/[^0-9X]/gi, '').toUpperCase();
  return normalized.length === 20 ? normalized : null;
}

function countUnmaskedPositions(pattern) {
  let count = 0;
  for (let i = 0; i < pattern.length; i += 1) {
    if (pattern[i] !== 'X') count += 1;
  }
  return count;
}

function isPositionalMaskedMatch(candidatePattern, knownPattern, minUnmaskedPositions = MIN_MASKED_CNJ_UNMASKED_POSITIONS) {
  if (!candidatePattern || !knownPattern) return false;
  if (candidatePattern.length !== 20 || knownPattern.length !== 20) return false;
  if (countUnmaskedPositions(candidatePattern) < minUnmaskedPositions) return false;

  for (let i = 0; i < 20; i += 1) {
    const candidateChar = candidatePattern[i];
    const knownChar = knownPattern[i];
    if (candidateChar === 'X' || knownChar === 'X') continue;
    if (candidateChar !== knownChar) return false;
  }
  return true;
}

function normalizeCnjDigits(value) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  if (/[xX]/.test(text)) return null;
  const digits = text.replace(/\D/g, '');
  return digits.length === 20 ? digits : null;
}

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
  return text || null;
}

function normalizeAreaBucket(value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (/CRIM|PENAL/.test(text)) return 'CRIMINAL';
  if (/TRABALH|LABOR/.test(text)) return 'LABOR';
  if (/\b(CIVEL|CIVIL)\b/.test(text)) return 'CIVIL';
  return text;
}

const LEGAL_STOPWORDS = new Set([
  'ACAO', 'ACOES', 'PROCEDIMENTO', 'PROCEDIMENTOS', 'CIVEL', 'CIVEIS', 'COMUM',
  'ORDINARIA', 'ESPECIAL', 'SUMARIO', 'SUMARISSIMO', 'MONITORIA', 'CUMPRIMENTO',
  'SENTENCA', 'EXECUCAO', 'EXECUCOES', 'DE', 'DO', 'DA', 'DOS', 'DAS', 'EM', 'NO',
  'NA', 'POR', 'PARA', 'E', 'OU', 'COM', 'SEM', 'SOB', 'SOBRE',
]);

function normalizeTribunal(value) {
  const text = normalizeText(value);
  if (!text) return null;

  const acronymMatch = text.match(/\b(TRT|TJ|TRF|JF|STM|TSE|TRE|STJ|STF)\s*-?\s*(\d{1,2})?\b/i);
  if (acronymMatch) {
    const [, acronym, number] = acronymMatch;
    const normalizedNumber = number ? number.replace(/[ªº]/g, '') : '';
    return normalizedNumber ? `${acronym}${normalizedNumber}` : acronym;
  }

  if (/REGIONAL\s+DO\s+TRABALHO|JUSTI[ÇC]A\s+DO\s+TRABALHO/i.test(text)) {
    const numberMatch = text.match(/\b(\d{1,2})[ªº]?\s*REGI[AÃ]O/i);
    return numberMatch ? `TRT${numberMatch[1]}` : 'TRT';
  }

  if (/JUSTI[ÇC]A\s+FEDERAL/i.test(text)) {
    const numberMatch = text.match(/\b(\d{1,2})[ªº]?\s*REGI[AÃ]O/i);
    return numberMatch ? `TRF${numberMatch[1]}` : 'JF';
  }

  if (/JUSTI[ÇC]A\s+ESTADUAL/i.test(text)) {
    const stateMap = {
      'SAO PAULO': 'SP', 'RIO DE JANEIRO': 'RJ', 'MINAS GERAIS': 'MG', 'BAHIA': 'BA',
      PARANA: 'PR', 'RIO GRANDE DO SUL': 'RS', PERNAMBUCO: 'PE', CEARA: 'CE',
      PARA: 'PA', 'SANTA CATARINA': 'SC', GOIAS: 'GO', MARANHAO: 'MA', PARAIBA: 'PB',
      AMAZONAS: 'AM', PIAUI: 'PI', 'MATO GROSSO': 'MT', 'RIO GRANDE DO NORTE': 'RN',
      ALAGOAS: 'AL', 'DISTRITO FEDERAL': 'DF', 'MATO GROSSO DO SUL': 'MS', SERGIPE: 'SE',
      RONDONIA: 'RO', TOCANTINS: 'TO', ACRE: 'AC', AMAPA: 'AP', RORAIMA: 'RR',
    };
    for (const [name, uf] of Object.entries(stateMap)) {      if (text.includes(name)) return `TJ${uf}`;
    }
  }

  return text
    .replace(/[-\s]/g, '')
    .replace(/[ªº]/g, '')
    .replace(/\b(DE|DO|DA|DOS|DAS|REGI[AÃ]O|REGI[ÕO]ES|TRABALHO|FEDERAL|ESTADUAL|JUSTI[ÇC]A|TRIBUNAL|REGIONAL)\b/gi, '');
}

function normalizeTokens(value) {
  const text = normalizeText(value);
  if (!text) return [];
  return text
    .split(/[^A-Z0-9]+/)
    .filter((token) => token.length >= 3 && !LEGAL_STOPWORDS.has(token));
}

function collectSubjectTexts(item) {
  const texts = [];
  if (item.classOrSubject) texts.push(item.classOrSubject);
  if (item.cnjSubject) texts.push(item.cnjSubject);
  if (item.cnjBroadSubject) texts.push(item.cnjBroadSubject);
  if (item.cnjProcedure) texts.push(item.cnjProcedure);
  if (Array.isArray(item.subjects)) texts.push(...item.subjects);
  if (Array.isArray(item.classifications)) texts.push(...item.classifications);
  return texts;
}

function hasSubjectOverlap(source, target, minShared = 1) {
  const sourceTokens = new Set();
  for (const text of collectSubjectTexts(source)) {
    for (const token of normalizeTokens(text)) sourceTokens.add(token);
  }
  if (sourceTokens.size === 0) return false;

  let shared = 0;
  for (const text of collectSubjectTexts(target)) {
    for (const token of normalizeTokens(text)) {
      if (sourceTokens.has(token)) {
        shared += 1;
      }
    }
  }
  return shared >= minShared;
}

function firstValue(item, keys) {
  for (const key of keys) {
    if (item?.[key] !== null && item?.[key] !== undefined && item?.[key] !== '') return item[key];
  }
  return null;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(left, right) {
  const leftDate = normalizeDate(left);
  const rightDate = normalizeDate(right);
  if (!leftDate || !rightDate) return null;
  return Math.abs(leftDate.getTime() - rightDate.getTime()) / 86400000;
}

function buildKnownProcess(item, provider) {
  const processNumber = firstValue(item, [
    'numero',
    'processNumber',
    'numeroCnj',
    'numeroProcesso',
    'numeroProcessoMascara',
    'code',
    'numeroCnjCompletoExtraido',
  ]);
  const area = firstValue(item, ['area', 'courtType', 'areaDireito']);
  const tribunal = firstValue(item, ['tribunalSigla', 'tribunal', 'tribunalAcronym', 'courtName', 'court', 'orgao']);
  const uf = firstValue(item, ['processUf', 'state', 'uf']);
  const classOrSubject = firstValue(item, [
    'classe',
    'className',
    'assunto',
    'assuntoPrincipal',
    'subject',
    'assuntos',
    'cnjSubject',
    'cnjProcedure',
  ]);
  const date = firstValue(item, [
    'dataInicio',
    'distributionDate',
    'lastStepDate',
    'lastMovementDate',
    'dataDisponibilizacao',
    'date',
    'dataDistribuicao',
  ]);

  return {
    provider,
    processNumber,
    cnjDigits: normalizeCnjDigits(processNumber),
    cnjPattern: parseCnjPattern(processNumber),
    areaBucket: normalizeAreaBucket(area),
    tribunal: normalizeTribunal(tribunal),
    uf: normalizeText(uf),
    classOrSubject: normalizeText(classOrSubject),
    subjects: asArray(item.subjects || item.assuntos),
    classifications: asArray(item.classifications || item.classes),
    cnjSubject: normalizeText(item.cnjSubject),
    cnjBroadSubject: normalizeText(item.cnjBroadSubject),
    cnjProcedure: normalizeText(item.cnjProcedure || item.tipo),
    date,
  };
}

function collectKnownProcesses(caseData) {
  return [
    ...asArray(caseData.bigdatacorpProcessos).map((item) => buildKnownProcess(item, 'bigdatacorp')),
    ...asArray(caseData.juditRoleSummary).map((item) => buildKnownProcess(item, 'judit')),
    ...asArray(caseData.juditProcessos).map((item) => buildKnownProcess(item, 'judit')),
    ...asArray(caseData.escavadorProcessos).map((item) => buildKnownProcess(item, 'escavador')),
    ...asArray(caseData.djenComunicacoes).map((item) => buildKnownProcess(item, 'djen')),
    ...asArray(caseData.processosCompleta).map((item) => buildKnownProcess(item, 'fontedata')),
  ];
}

function buildEscavador2Process(item) {
  const processNumber = firstValue(item, ['numeroCnjCompletoExtraido', 'numeroCnj', 'processNumber', 'numeroProcesso']);
  const area = firstValue(item, ['area']);
  const tribunal = firstValue(item, ['tribunalSigla', 'tribunal']);
  const uf = firstValue(item, ['processUf', 'uf']);
  const classOrSubject = firstValue(item, [
    'classe',
    'assunto',
    'assuntoPrincipal',
    'subject',
    'cnjSubject',
    'cnjProcedure',
  ]);
  const date = firstValue(item, ['dataInicio', 'ultimaMovimentacao', 'date']);

  return {
    processNumber,
    cnjDigits: normalizeCnjDigits(processNumber),
    cnjPattern: parseCnjPattern(processNumber),
    areaBucket: normalizeAreaBucket(area),
    tribunal: normalizeTribunal(tribunal),
    uf: normalizeText(uf),
    classOrSubject: normalizeText(classOrSubject),
    subjects: asArray(item.subjects),
    classifications: asArray(item.classifications),
    cnjSubject: normalizeText(item.cnjSubject),
    cnjBroadSubject: normalizeText(item.cnjBroadSubject),
    cnjProcedure: normalizeText(item.cnjProcedure),
    date,
  };
}

function hasMetadataMatch(source, target, toleranceDays) {
  if (source.areaBucket && target.areaBucket && source.areaBucket !== target.areaBucket) return false;
  if (!source.tribunal || !target.tribunal || source.tribunal !== target.tribunal) return false;
  if ((source.uf || target.uf) && source.uf !== target.uf) return false;

  const dayDiff = daysBetween(source.date, target.date);
  if (dayDiff === null || dayDiff > toleranceDays) return false;

  const sourceClass = normalizeText(source.classOrSubject);
  const targetClass = normalizeText(target.classOrSubject);

  if (sourceClass && targetClass) {
    if (sourceClass === targetClass) return true;
    if (hasSubjectOverlap(source, target, 1)) return true;
    return false;
  }

  return true;
}

function findDuplicate(process, knownProcesses, toleranceDays) {
  if (process.cnjDigits) {
    const fullMatch = knownProcesses.find((known) => known.cnjDigits && known.cnjDigits === process.cnjDigits);
    if (fullMatch) return { known: fullMatch, strength: 'CNJ_FULL' };
  }

  if (process.cnjPattern) {
    const maskedMatch = knownProcesses.find((known) => known.cnjPattern && isPositionalMaskedMatch(process.cnjPattern, known.cnjPattern));
    if (maskedMatch) return { known: maskedMatch, strength: 'CNJ_MASKED' };
  }

  const metadataMatch = knownProcesses.find((known) => hasMetadataMatch(process, known, toleranceDays));
  return metadataMatch ? { known: metadataMatch, strength: 'metadata' } : null;
}

function deduplicateEscavador2Findings(caseData = {}, options = {}) {
  const toleranceDays = Number.isFinite(options.dateToleranceDays) ? options.dateToleranceDays : 90;
  const knownProcesses = collectKnownProcesses(caseData);
  let duplicateCount = 0;
  let newFindingCount = 0;
  let hasNewMaterialRisk = false;

  const escavador2Processos = asArray(caseData.escavador2Processos).map((item) => {
    const process = buildEscavador2Process(item);
    const duplicate = findDuplicate(process, knownProcesses, toleranceDays);
    const isDuplicate = Boolean(duplicate);
    const isNewEscavador2Finding = !isDuplicate;

    if (isDuplicate) duplicateCount += 1;
    if (isNewEscavador2Finding) newFindingCount += 1;
    if (isNewEscavador2Finding && item?.isMaterialRisk === true) hasNewMaterialRisk = true;

    return {
      ...item,
      isDuplicate,
      isDuplicateEscavador2Finding: isDuplicate,
      duplicateOfProvider: duplicate?.known.provider || null,
      duplicateOfProcessNumber: duplicate?.known.processNumber || null,
      duplicateMatchStrength: duplicate?.strength || null,
      isNewEscavador2Finding,
    };
  });

  return {
    escavador2Processos,
    escavador2DuplicateCount: duplicateCount,
    escavador2NewFindingCount: newFindingCount,
    escavador2HasNewMaterialRisk: hasNewMaterialRisk,
  };
}

module.exports = {
  normalizeCnjDigits,
  parseCnjPattern,
  isPositionalMaskedMatch,
  normalizeTribunal,
  hasSubjectOverlap,
  deduplicateEscavador2Findings,
};
