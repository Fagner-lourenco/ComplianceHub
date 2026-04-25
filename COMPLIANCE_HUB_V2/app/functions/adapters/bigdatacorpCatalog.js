/**
 * BigDataCorp Dataset Catalog
 * Complete mapping of all available BDC datasets to their endpoints, costs,
 * applicable subject types, and field selectors.
 *
 * Source: D:\ComplianceHub\COMPLIANCE_HUB_V2\docs\manual
 * Updated: 2026-04-24
 */

const CATALOG_VERSION = 'bdc-catalog-2026-04-24';

// =============================================================================
// DATASET DEFINITIONS
// =============================================================================

const BDC_DATASETS = {
  // ---------------------------------------------------------------------------
  // JURÍDICO
  // ---------------------------------------------------------------------------
  processes: {
    key: 'processes',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.07,
    applicableTo: ['pf', 'pj'],
    description: 'Processos judiciais e administrativos',
    fields: [
      'Number', 'ClassName', 'Court', 'Status', 'Parties', 'Movements',
      'Value', 'Subject', 'Area', 'Segment', 'District', 'CourtUnit',
      'DistributionDate', 'Link',
    ],
    pagination: true,
    maxLimit: 100,
    freshnessHours: 24,
  },
  owners_lawsuits: {
    key: 'owners_lawsuits',
    endpoint: '/empresas',
    cost: 0.13,
    applicableTo: ['pj'],
    description: 'Processos dos sócios da empresa',
    freshnessHours: 24,
  },
  lawsuits_distribution_data: {
    key: 'lawsuits_distribution_data',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    description: 'Dados agregados de distribuição de processos',
    freshnessHours: 48,
  },

  // ---------------------------------------------------------------------------
  // CADASTRO / IDENTIDADE
  // ---------------------------------------------------------------------------
  basic_data: {
    key: 'basic_data',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: { pf: 0.03, pj: 0.02 },
    applicableTo: ['pf', 'pj'],
    description: 'Dados cadastrais básicos',
    fields: ['Name', 'TaxId', 'BirthDate', 'Age', 'Gender', 'MotherName', 'FatherName', 'TaxIdStatus'],
    freshnessHours: 168, // 7 dias
  },
  historical_basic_data: {
    key: 'historical_basic_data',
    endpoint: '/pessoas',
    cost: 0.03,
    applicableTo: ['pf'],
    description: 'Histórico de alterações cadastrais PF',
    freshnessHours: 168,
  },
  history_basic_data: {
    key: 'history_basic_data',
    endpoint: '/empresas',
    cost: 0.05,
    applicableTo: ['pj'],
    description: 'Histórico de alterações cadastrais PJ',
    freshnessHours: 168,
  },
  basic_data_with_configurable_recency: {
    key: 'basic_data_with_configurable_recency',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.09,
    applicableTo: ['pf', 'pj'],
    description: 'Dados cadastrais com recência configurável',
    freshnessHours: 1,
  },
  emails_extended: {
    key: 'emails_extended',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    description: 'E-mails associados com atributos de qualidade',
    fields: ['Email', 'Type', 'ValidationStatus', 'LastSeen', 'Domain'],
    freshnessHours: 72,
  },
  phones_extended: {
    key: 'phones_extended',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    description: 'Telefones com classificação e validação',
    fields: ['Phone', 'Type', 'DDD', 'ValidationStatus', 'LastSeen'],
    freshnessHours: 72,
  },
  addresses_extended: {
    key: 'addresses_extended',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    description: 'Endereços com tipo, CEP e validação',
    fields: ['Street', 'Number', 'Neighborhood', 'City', 'State', 'Zipcode', 'Type', 'LastSeen'],
    freshnessHours: 72,
  },

  // ---------------------------------------------------------------------------
  // REGULADORES / COMPLIANCE
  // ---------------------------------------------------------------------------
  kyc: {
    key: 'kyc',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    description: 'PEP, sanções nacionais e internacionais',
    fields: [
      'PEPHistory', 'SanctionsHistory',
      'IsCurrentlySanctioned', 'WasPreviouslySanctioned',
      'IsCurrentlyPresentOnSource', 'WasRecentlyPresentOnSource',
    ],
    freshnessHours: 24,
  },
  owners_kyc: {
    key: 'owners_kyc',
    endpoint: '/empresas',
    cost: 0.09,
    applicableTo: ['pj'],
    description: 'KYC agregado dos sócios',
    freshnessHours: 24,
  },
  employees_kyc: {
    key: 'employees_kyc',
    endpoint: '/empresas',
    cost: 0.41,
    applicableTo: ['pj'],
    description: 'KYC agregado dos funcionários',
    freshnessHours: 24,
  },
  economic_group_kyc: {
    key: 'economic_group_kyc',
    endpoint: '/empresas',
    cost: 0.41,
    applicableTo: ['pj'],
    description: 'KYC do grupo econômico completo',
    freshnessHours: 24,
  },

  // ---------------------------------------------------------------------------
  // FINANCEIRO
  // ---------------------------------------------------------------------------
  financial_data: {
    key: 'financial_data',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    description: 'Informações financeiras',
    freshnessHours: 72,
  },
  government_debtors: {
    key: 'government_debtors',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    description: 'Status de devedor do governo',
    freshnessHours: 48,
  },
  collections: {
    key: 'collections',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.07,
    applicableTo: ['pf', 'pj'],
    description: 'Presença em cobrança',
    freshnessHours: 48,
  },
  financial_risk: {
    key: 'financial_risk',
    endpoint: '/pessoas',
    cost: 0.05,
    applicableTo: ['pf'],
    description: 'Risco financeiro da pessoa',
    freshnessHours: 72,
  },
  indebtedness_question: {
    key: 'indebtedness_question',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.09,
    applicableTo: ['pf', 'pj'],
    description: 'Probabilidade de negativação',
    freshnessHours: 72,
  },
  company_evolution: {
    key: 'company_evolution',
    endpoint: '/empresas',
    cost: 0.05,
    applicableTo: ['pj'],
    description: 'Evolução temporal da empresa',
    freshnessHours: 168,
  },
  activity_indicators: {
    key: 'activity_indicators',
    endpoint: '/empresas',
    cost: 0.05,
    applicableTo: ['pj'],
    description: 'Indicadores inferidos de atividade',
    freshnessHours: 168,
  },
  merchant_category_data: {
    key: 'merchant_category_data',
    endpoint: '/empresas',
    cost: 0.05,
    applicableTo: ['pj'],
    description: 'Dados de categoria comercial (MCC)',
    freshnessHours: 168,
  },

  // ---------------------------------------------------------------------------
  // PROFISSIONAL
  // ---------------------------------------------------------------------------
  occupation_data: {
    key: 'occupation_data',
    endpoint: '/pessoas',
    cost: 0.05,
    applicableTo: ['pf'],
    description: 'Histórico empregatício e ocupação',
    fields: ['Jobs', 'IncomeRange', 'EmployeesRange', 'IsPublicServer', 'Sector'],
    freshnessHours: 168,
  },
  class_organization: {
    key: 'class_organization',
    endpoint: '/pessoas',
    cost: 0.05,
    applicableTo: ['pf'],
    description: 'Conselhos de classe e registros profissionais',
    freshnessHours: 168,
  },
  university_student_data: {
    key: 'university_student_data',
    endpoint: '/pessoas',
    cost: 0.05,
    applicableTo: ['pf'],
    description: 'Histórico escolar e acadêmico',
    freshnessHours: 168,
  },
  profession_data: {
    key: 'profession_data',
    endpoint: '/pessoas',
    cost: 0.05,
    applicableTo: ['pf'],
    description: 'Dados profissionais diversos',
    freshnessHours: 168,
  },
  awards_and_certifications: {
    key: 'awards_and_certifications',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.09,
    applicableTo: ['pf', 'pj'],
    description: 'Prêmios e certificações',
    freshnessHours: 168,
  },
  sports_exposure: {
    key: 'sports_exposure',
    endpoint: '/pessoas',
    cost: 0.07,
    applicableTo: ['pf'],
    description: 'Exposição esportiva',
    freshnessHours: 168,
  },

  // ---------------------------------------------------------------------------
  // RELACIONAMENTOS (PJ)
  // ---------------------------------------------------------------------------
  relationships: {
    key: 'relationships',
    endpoint: '/empresas',
    cost: 0.03,
    applicableTo: ['pj'],
    description: 'Relacionamentos societários (QSA)',
    fields: ['Name', 'Type', 'Level', 'OwnershipPercentage', 'StartDate'],
    freshnessHours: 72,
  },
  dynamic_qsa_data: {
    key: 'dynamic_qsa_data',
    endpoint: '/empresas',
    cost: 0.09,
    applicableTo: ['pj'],
    description: 'QSA de recência configurável',
    freshnessHours: 24,
  },

  // ---------------------------------------------------------------------------
  // PRESENÇA DIGITAL
  // ---------------------------------------------------------------------------
  online_presence: {
    key: 'online_presence',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    description: 'Indicadores de presença online',
    freshnessHours: 72,
  },
  online_ads: {
    key: 'online_ads',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    description: 'Anúncios online',
    freshnessHours: 72,
  },

  // ---------------------------------------------------------------------------
  // POLÍTICO / ELEITORAL
  // ---------------------------------------------------------------------------
  political_involvement: {
    key: 'political_involvement',
    endpoint: '/pessoas',
    cost: 0.05,
    applicableTo: ['pf'],
    description: 'Nível de envolvimento político',
    freshnessHours: 72,
  },
  election_candidate_data: {
    key: 'election_candidate_data',
    endpoint: '/pessoas',
    cost: 0.05,
    applicableTo: ['pf'],
    description: 'Dados de candidaturas eleitorais',
    freshnessHours: 72,
  },

  // ---------------------------------------------------------------------------
  // MÍDIA / REPUTAÇÃO
  // ---------------------------------------------------------------------------
  media_profile_and_exposure: {
    key: 'media_profile_and_exposure',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    description: 'Exposição na mídia e popularidade',
    pagination: true,
    freshnessHours: 24,
  },

  // ---------------------------------------------------------------------------
  // ESG
  // ---------------------------------------------------------------------------
  syndicate_agreements: {
    key: 'syndicate_agreements',
    endpoint: '/empresas',
    cost: 0.05,
    applicableTo: ['pj'],
    description: 'Acordos sindicais',
    freshnessHours: 168,
  },
  social_conscience: {
    key: 'social_conscience',
    endpoint: '/empresas',
    cost: 0.05,
    applicableTo: ['pj'],
    description: 'Métricas de engajamento social (ESG)',
    freshnessHours: 168,
  },

  // ---------------------------------------------------------------------------
  // RISCO
  // ---------------------------------------------------------------------------
  collections_pj: {
    key: 'collections',
    endpoint: '/empresas',
    cost: 0.07,
    applicableTo: ['pj'],
    description: 'Presença em cobrança (PJ)',
    freshnessHours: 48,
  },

  // ---------------------------------------------------------------------------
  // ATIVOS
  // ---------------------------------------------------------------------------
  property_data: {
    key: 'property_data',
    endpoint: '/pessoas',
    endpointPj: '/empresas',
    cost: 0.05,
    applicableTo: ['pf', 'pj'],
    description: 'Dados de propriedades e ativos',
    freshnessHours: 168,
  },
};

// =============================================================================
// PRESET -> DATASET MAPPINGS
// =============================================================================

const PRESET_DATASET_MAP = {
  compliance: {
    pf: ['basic_data', 'processes', 'kyc'],
    pj: ['basic_data', 'processes', 'kyc', 'relationships'],
  },
  internacional: {
    pf: ['basic_data', 'kyc', 'online_presence', 'political_involvement'],
    pj: ['basic_data', 'kyc', 'online_presence', 'owners_kyc'],
  },
  financeiro: {
    pf: ['basic_data', 'processes', 'financial_data', 'collections', 'government_debtors'],
    pj: ['basic_data', 'financial_data', 'government_debtors', 'company_evolution'],
  },
  investigativo: {
    pf: ['basic_data', 'processes', 'kyc', 'online_presence', 'media_profile_and_exposure'],
    pj: ['basic_data', 'processes', 'kyc', 'online_presence', 'relationships'],
  },
  juridico: {
    pf: ['basic_data', 'processes', 'owners_lawsuits'],
    pj: ['basic_data', 'processes', 'owners_lawsuits'],
  },
  pld: {
    pf: ['basic_data', 'kyc', 'financial_data', 'collections'],
    pj: ['basic_data', 'kyc', 'relationships', 'financial_data'],
  },
  rh: {
    pf: ['basic_data', 'processes', 'kyc', 'occupation_data', 'class_organization'],
    pj: [],
  },
  // Full dossier presets — maximum data coverage
  dossier_pf_full: {
    pf: ['basic_data', 'processes', 'kyc', 'occupation_data', 'phones_extended', 'addresses_extended', 'emails_extended', 'online_presence', 'financial_data', 'class_organization', 'government_debtors', 'collections', 'historical_basic_data', 'financial_risk', 'indebtedness_question', 'media_profile_and_exposure', 'lawsuits_distribution_data'],
    pj: [],
  },
  dossier_pj_full: {
    pf: [],
    pj: ['basic_data', 'processes', 'kyc', 'relationships', 'owners_kyc', 'activity_indicators', 'company_evolution', 'phones_extended', 'addresses_extended', 'emails_extended', 'government_debtors', 'collections', 'history_basic_data', 'dynamic_qsa_data', 'owners_lawsuits', 'employees_kyc', 'economic_group_kyc', 'merchant_category_data', 'syndicate_agreements', 'social_conscience', 'media_profile_and_exposure', 'lawsuits_distribution_data', 'online_ads'],
  },
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get dataset definition by key.
 * @param {string} datasetKey
 * @returns {object|null}
 */
function getDataset(datasetKey) {
  return BDC_DATASETS[datasetKey] || null;
}

/**
 * Resolve the correct endpoint for a dataset based on subject type.
 * @param {string} datasetKey
 * @param {'pf' | 'pj'} subjectType
 * @returns {string|null}
 */
function resolveEndpoint(datasetKey, subjectType) {
  const ds = getDataset(datasetKey);
  if (!ds) return null;
  if (subjectType === 'pj' && ds.endpointPj) return ds.endpointPj;
  return ds.endpoint;
}

/**
 * Get cost for a dataset.
 * @param {string} datasetKey
 * @param {'pf' | 'pj'} subjectType
 * @returns {number}
 */
function getCost(datasetKey, subjectType) {
  const ds = getDataset(datasetKey);
  if (!ds) return 0;
  if (typeof ds.cost === 'object') {
    return ds.cost[subjectType] || ds.cost.default || 0;
  }
  return ds.cost || 0;
}

/**
 * Get datasets for a preset and subject type.
 * @param {string} presetKey
 * @param {'pf' | 'pj'} subjectType
 * @returns {string[]}
 */
function getDatasetsForPreset(presetKey, subjectType) {
  const preset = PRESET_DATASET_MAP[presetKey];
  if (!preset) return [];
  return preset[subjectType] || [];
}

/**
 * Calculate estimated cost for a preset.
 * @param {string} presetKey
 * @param {'pf' | 'pj'} subjectType
 * @returns {number}
 */
function estimatePresetCost(presetKey, subjectType) {
  const datasets = getDatasetsForPreset(presetKey, subjectType);
  return datasets.reduce((sum, ds) => sum + getCost(ds, subjectType), 0);
}

module.exports = {
  CATALOG_VERSION,
  BDC_DATASETS,
  PRESET_DATASET_MAP,
  getDataset,
  resolveEndpoint,
  getCost,
  getDatasetsForPreset,
  estimatePresetCost,
};
