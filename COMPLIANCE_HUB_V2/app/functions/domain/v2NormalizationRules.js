/**
 * Domain: V2 Normalization Rules
 * Transforms raw BDC responses into canonical internal formats.
 */

// =============================================================================
// PROCESS NORMALIZATION
// =============================================================================

const PROCESS_STATUS_MAP = {
  'ATIVO': 'Em tramitacao',
  'EM_TRAMITACAO': 'Em tramitacao',
  'ARQUIVADO': 'Arquivamento definitivo',
  'ARQUIVAMENTO_DEFINITIVO': 'Arquivamento definitivo',
  'RECURSO': 'Em grau de recurso',
  'EM_GRAU_DE_RECURSO': 'Em grau de recurso',
  'SUSPENSO': 'Suspensa',
  'SUSPENSA': 'Suspensa',
  'BAIXADO': 'Arquivamento definitivo',
  'EXTINTO': 'Arquivamento definitivo',
};

const PARTY_TYPE_MAP = {
  'AUTOR': 'autor',
  'REU': 'reu',
  'REQUERENTE': 'autor',
  'REQUERIDO': 'reu',
  'EXEQUENTE': 'autor',
  'EXECUTADO': 'reu',
  'ENVOLVIDO': 'envolvido',
  'TERCEIRO': 'terceiro',
  'INTERESSADO': 'envolvido',
};

const AREA_KEYWORDS = {
  criminal: ['CRIMINAL', 'PENAL', 'DELITO', 'CRIME', 'CONTRAVENCAO', 'HABEAS', 'CORPUS'],
  trabalhista: ['TRABALHISTA', 'TRABALHO', 'RECLAMACAO_TRABALHISTA', 'RECLAMATORIA', 'ACIDENTE_TRABALHO'],
  civil: ['CIVEL', 'CONTRATO', 'INDENIZACAO', 'RESPONSABILIDADE', 'DANO', 'OBRIGACAO'],
  tributario: ['TRIBUTARIO', 'TRIBUTARIA', 'FISCAL', 'IMPOSTO', 'TAXA', 'CONTRIBUICAO'],
  administrativo: ['ADMINISTRATIVO', 'ADMINISTRATIVA', 'MANDADO_SEGURANCA', 'MS'],
  previdenciario: ['PREVIDENCIARIO', 'PREVIDENCIARIA', 'BENEFICIO', 'APOSENTADORIA', 'AUXILIO'],
};

const SEGMENT_MAP = {
  'JUSTICA ESTADUAL': 'justica_estadual',
  'JUSTICA FEDERAL': 'justica_federal',
  'TRABALHISTA': 'trt',
  'TRIBUNAL SUPERIOR DO TRABALHO': 'tst',
  'SUPERIOR TRIBUNAL DE JUSTICA': 'stj',
  'SUPREMO TRIBUNAL FEDERAL': 'stf',
  'JUSTICA ELEITORAL': 'tse',
  'JUSTICA MILITAR': 'justica_militar',
};

/**
 * Normalize process status from BDC to canonical enum.
 * @param {string} bdcStatus
 * @returns {string}
 */
function normalizeProcessStatus(bdcStatus) {
  if (!bdcStatus) return 'Outro';
  return PROCESS_STATUS_MAP[bdcStatus.toUpperCase()] || 'Outro';
}

/**
 * Normalize party type.
 * @param {string} bdcPartyType
 * @returns {string}
 */
function normalizePartyType(bdcPartyType) {
  if (!bdcPartyType) return 'terceiro';
  return PARTY_TYPE_MAP[bdcPartyType.toUpperCase()] || 'terceiro';
}

/**
 * Infer process area from class name and subject.
 * @param {string} className
 * @param {string} subject
 * @returns {string}
 */
function inferProcessArea(className, subject) {
  const text = `${className || ''} ${subject || ''}`.toUpperCase();
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) return area;
  }
  return 'outro';
}

/**
 * Infer judicial segment from court name.
 * @param {string} court
 * @returns {string}
 */
function inferSegment(court) {
  if (!court) return 'outro';
  const upper = court.toUpperCase();
  for (const [name, key] of Object.entries(SEGMENT_MAP)) {
    if (upper.includes(name)) return key;
  }
  if (upper.includes('TJ-')) return 'justica_estadual';
  if (upper.includes('TRT-')) return 'trt';
  if (upper.includes('TRF-')) return 'justica_federal';
  return 'outro';
}

/**
 * Normalize monetary value from BDC (various formats to cents).
 * @param {number|string} bdcValue
 * @returns {number}
 */
function normalizeValue(bdcValue) {
  if (!bdcValue) return 0;
  if (typeof bdcValue === 'number') return Math.round(bdcValue * 100);
  const cleaned = String(bdcValue)
    .replace(/[^\d,]/g, '')
    .replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

/**
 * Format value as BRL string.
 * @param {number} cents
 * @returns {string}
 */
function formatValueBrl(cents) {
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Extract court code (TJ-CE, TRT-1, etc.).
 * @param {string} bdcCourt
 * @returns {string}
 */
function extractCourtCode(bdcCourt) {
  if (!bdcCourt) return '';
  const match = String(bdcCourt).match(/(TJ|TRT|TRF|STJ|STF|TST|TSE)-?([A-Z0-9]+)/i);
  return match ? `${match[1].toUpperCase()}-${match[2].toUpperCase()}` : bdcCourt;
}

/**
 * Normalize match quality from BDC MatchRate.
 * @param {number} matchRate
 * @returns {string} exact | high | medium | low
 */
function normalizeMatchQuality(matchRate) {
  if (matchRate >= 95) return 'exact';
  if (matchRate >= 90) return 'high';
  if (matchRate >= 70) return 'medium';
  return 'low';
}

// =============================================================================
// KYC NORMALIZATION
// =============================================================================

/**
 * Normalize PEP history entry.
 * @param {object} pep
 * @returns {object}
 */
function normalizePepEntry(pep) {
  return {
    level: parseInt(pep.Level) || 0,
    jobTitle: pep.JobTitle || '',
    department: pep.Department || '',
    motive: pep.Motive || '',
    source: pep.Source || '',
    taxId: pep.TaxId || '',
    startDate: pep.StartDate || null,
    endDate: pep.EndDate || null,
  };
}

/**
 * Normalize sanctions history entry.
 * @param {object} sanction
 * @returns {object}
 */
function normalizeSanctionEntry(sanction) {
  return {
    source: sanction.Source || '',
    type: sanction.Type || '',
    description: sanction.Description || '',
    startDate: sanction.StartDate || null,
    endDate: sanction.EndDate || null,
    isActive: sanction.IsActive || false,
  };
}

// =============================================================================
// BASIC DATA NORMALIZATION
// =============================================================================

function normalizeBasicDataPF(bdcBasicData) {
  return {
    name: bdcBasicData.Name || '',
    taxId: bdcBasicData.TaxId || '',
    birthDate: bdcBasicData.BirthDate || null,
    age: bdcBasicData.Age || null,
    gender: bdcBasicData.Gender || '',
    motherName: bdcBasicData.MotherName || '',
    fatherName: bdcBasicData.FatherName || '',
    taxIdStatus: bdcBasicData.TaxIdStatus || '',
    registrationStatus: bdcBasicData.RegistrationStatus || '',
  };
}

function normalizeBasicDataPJ(bdcBasicData) {
  return {
    name: bdcBasicData.Name || '',
    taxId: bdcBasicData.TaxId || '',
    companyStatus: bdcBasicData.CompanyStatus || '',
    legalNature: bdcBasicData.LegalNature || '',
    foundationDate: bdcBasicData.FoundationDate || null,
    fantasyName: bdcBasicData.FantasyName || '',
    cnae: bdcBasicData.Cnae || '',
    capitalSocial: bdcBasicData.CapitalSocial || null,
    size: bdcBasicData.Size || '',
    situation: bdcBasicData.Situation || '',
  };
}

module.exports = {
  // Process
  normalizeProcessStatus,
  normalizePartyType,
  inferProcessArea,
  inferSegment,
  normalizeValue,
  formatValueBrl,
  extractCourtCode,
  normalizeMatchQuality,

  // KYC
  normalizePepEntry,
  normalizeSanctionEntry,

  // Basic Data
  normalizeBasicDataPF,
  normalizeBasicDataPJ,

  // Raw maps (for custom logic)
  PROCESS_STATUS_MAP,
  PARTY_TYPE_MAP,
  AREA_KEYWORDS,
  SEGMENT_MAP,
};
