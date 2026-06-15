function asArray(value) {
  return Array.isArray(value) ? value : [];
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
  if (/CIVEL|CIVIL/.test(text)) return 'CIVIL';
  return text;
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
    areaBucket: normalizeAreaBucket(area),
    tribunal: normalizeText(tribunal),
    uf: normalizeText(uf),
    classOrSubject: normalizeText(classOrSubject),
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
  const classOrSubject = firstValue(item, ['classe', 'assunto', 'assuntoPrincipal', 'subject']);
  const date = firstValue(item, ['dataInicio', 'ultimaMovimentacao', 'date']);

  return {
    processNumber,
    cnjDigits: normalizeCnjDigits(processNumber),
    areaBucket: normalizeAreaBucket(area),
    tribunal: normalizeText(tribunal),
    uf: normalizeText(uf),
    classOrSubject: normalizeText(classOrSubject),
    date,
  };
}

function hasMetadataMatch(source, target, toleranceDays) {
  if (!source.areaBucket || source.areaBucket !== target.areaBucket) return false;
  if (!source.classOrSubject || source.classOrSubject !== target.classOrSubject) return false;
  if (!source.tribunal || source.tribunal !== target.tribunal) return false;
  if ((source.uf || target.uf) && source.uf !== target.uf) return false;

  const dayDiff = daysBetween(source.date, target.date);
  return dayDiff !== null && dayDiff <= toleranceDays;
}

function findDuplicate(process, knownProcesses, toleranceDays) {
  const cnjMatch = process.cnjDigits
    ? knownProcesses.find((known) => known.cnjDigits === process.cnjDigits)
    : null;
  if (cnjMatch) return { known: cnjMatch, strength: 'CNJ_FULL' };

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
  deduplicateEscavador2Findings,
};
