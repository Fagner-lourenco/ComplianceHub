/**
 * Dossier Schema Engine
 * Maps moduleKeys → macro-areas → sections → sources.
 * Enables Lexi-style UI with customizable dossier layouts for PF/PJ/hybrid.
 */

const DOSSIER_SCHEMA_VERSION = 'v2-dossier-schema-2026-04-23';

// =============================================================================
// MACRO AREA DEFINITIONS
// =============================================================================

const MACRO_AREAS = {
  juridico: {
    areaKey: 'juridico',
    label: 'Jurídico',
    icon: '⚖️',
    description: 'Processos judiciais, criminais, trabalhistas e mandados',
    defaultOrder: 1,
  },
  cadastro: {
    areaKey: 'cadastro',
    label: 'Cadastro',
    icon: '🆔',
    description: 'Identificação cadastral PF/PJ, Receita Federal, TSE',
    defaultOrder: 2,
  },
  financeiro: {
    areaKey: 'financeiro',
    label: 'Financeiro',
    icon: '💰',
    description: 'Certidões de débito, restituições, dívidas ativas',
    defaultOrder: 3,
  },
  reguladores: {
    areaKey: 'reguladores',
    label: 'Reguladores',
    icon: '🛡️',
    description: 'KYC, PEP, sanções, órgãos reguladores',
    defaultOrder: 4,
  },
  midia_internet: {
    areaKey: 'midia_internet',
    label: 'Mídia/Internet',
    icon: '🌐',
    description: 'OSINT, redes sociais, perfil digital',
    defaultOrder: 5,
  },
  listas_restritivas: {
    areaKey: 'listas_restritivas',
    label: 'Listas Restritivas',
    icon: '🚫',
    description: 'OFAC, Interpol, ONU, Banco Central, trabalho escravo',
    defaultOrder: 6,
  },
  bens_imoveis: {
    areaKey: 'bens_imoveis',
    label: 'Bens e Imóveis',
    icon: '🏠',
    description: 'Imóveis, veículos, patentes, ativos',
    defaultOrder: 7,
  },
  profissional: {
    areaKey: 'profissional',
    label: 'Profissional',
    icon: '💼',
    description: 'Histórico empregatício, ocupação, qualificações',
    defaultOrder: 8,
  },
  socioambiental: {
    areaKey: 'socioambiental',
    label: 'Socioambiental',
    icon: '🌱',
    description: 'ESG, licenças ambientais, impacto social',
    defaultOrder: 9,
  },
  conflito_interesse: {
    areaKey: 'conflito_interesse',
    label: 'Conflito de Interesse',
    icon: '⚠️',
    description: 'Análise de conflitos de interesse e vinculações',
    defaultOrder: 10,
  },
  monitoramento: {
    areaKey: 'monitoramento',
    label: 'Monitoramento',
    icon: '👁️',
    description: 'Monitoramento contínuo e alertas',
    defaultOrder: 11,
  },
};

const DOSSIER_PRESET_REGISTRY = {
  compliance: {
    presetKey: 'compliance',
    label: 'Compliance',
    subjectTypes: ['pf', 'pj'],
    defaultSchemaBySubject: {
      pf: 'dossier_pf_full',
      pj: 'dossier_pj',
    },
    defaultSectionKeysBySubject: {
      pf: ['identity_pf', 'criminal', 'labor', 'judicial', 'warrants', 'kyc'],
      pj: ['identity_pj', 'judicial', 'kyc', 'occupation', 'conflictInterest'],
    },
    defaultMacroAreas: ['cadastro', 'juridico', 'reguladores'],
  },
  internacional: {
    presetKey: 'internacional',
    label: 'Compliance Internacional',
    subjectTypes: ['pf', 'pj'],
    defaultSchemaBySubject: {
      pf: 'reputational_risk',
      pj: 'kyb_business',
    },
    defaultSectionKeysBySubject: {
      pf: ['identity_pf', 'kyc', 'ofac', 'interpol', 'osint', 'social', 'digital'],
      pj: ['identity_pj', 'kyc', 'ofac', 'interpol', 'osint'],
    },
    defaultMacroAreas: ['cadastro', 'reguladores', 'midia_internet', 'listas_restritivas'],
  },
  financeiro: {
    presetKey: 'financeiro',
    label: 'Financeiro',
    subjectTypes: ['pf', 'pj'],
    defaultSchemaBySubject: {
      pf: 'dossier_pf_full',
      pj: 'dossier_pj',
    },
    defaultSectionKeysBySubject: {
      pf: ['identity_pf', 'certidoes', 'kyc', 'judicial'],
      pj: ['identity_pj', 'certidoes', 'kyc', 'judicial'],
    },
    defaultMacroAreas: ['cadastro', 'financeiro', 'juridico', 'reguladores'],
  },
  investigativo: {
    presetKey: 'investigativo',
    label: 'Investigativo',
    subjectTypes: ['pf', 'pj'],
    defaultSchemaBySubject: {
      pf: 'dossier_pf_full',
      pj: 'dossier_pj',
    },
    defaultSectionKeysBySubject: {
      pf: ['identity_pf', 'criminal', 'judicial', 'warrants', 'osint', 'social', 'digital', 'conflictInterest'],
      pj: ['identity_pj', 'judicial', 'osint', 'occupation', 'conflictInterest'],
    },
    defaultMacroAreas: ['cadastro', 'juridico', 'midia_internet', 'conflito_interesse'],
  },
  juridico: {
    presetKey: 'juridico',
    label: 'Juridico',
    subjectTypes: ['pf', 'pj'],
    defaultSchemaBySubject: {
      pf: 'dossier_pf_full',
      pj: 'dossier_pj',
    },
    defaultSectionKeysBySubject: {
      pf: ['identity_pf', 'criminal', 'labor', 'judicial', 'warrants'],
      pj: ['identity_pj', 'judicial', 'warrants'],
    },
    defaultMacroAreas: ['cadastro', 'juridico'],
  },
  pld: {
    presetKey: 'pld',
    label: 'PLD',
    subjectTypes: ['pf', 'pj'],
    defaultSchemaBySubject: {
      pf: 'kyc_individual',
      pj: 'kyb_business',
    },
    defaultSectionKeysBySubject: {
      pf: ['identity_pf', 'kyc', 'ofac', 'interpol'],
      pj: ['identity_pj', 'kyc', 'ofac', 'interpol'],
    },
    defaultMacroAreas: ['cadastro', 'reguladores', 'listas_restritivas'],
  },
  rh: {
    presetKey: 'rh',
    label: 'Recursos Humanos',
    subjectTypes: ['pf'],
    defaultSchemaBySubject: {
      pf: 'kye_employee',
    },
    defaultSectionKeysBySubject: {
      pf: ['identity_pf', 'criminal', 'labor', 'judicial', 'warrants', 'kyc', 'occupation', 'osint'],
    },
    defaultMacroAreas: ['cadastro', 'juridico', 'reguladores', 'profissional', 'midia_internet'],
  },
};

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function uniqueStrings(values = []) {
  return [...new Set(
    asArray(values)
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )];
}

function normalizePlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function pickSubjectScopedValue(value, subjectType = 'pf') {
  if (!value) return [];
  if (Array.isArray(value)) return uniqueStrings(value);
  if (typeof value !== 'object') return [];
  return uniqueStrings(value[subjectType] || value.default || value.hybrid || []);
}

function pickSubjectScopedSchemaKey(value, subjectType = 'pf') {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return null;
  return value[subjectType] || value.default || value.hybrid || null;
}

function expandSectionKeysFromMacroAreas(macroAreaKeys = []) {
  const selectedAreaKeys = new Set(uniqueStrings(macroAreaKeys));
  return uniqueStrings(
    Object.values(SECTION_REGISTRY)
      .filter((section) => selectedAreaKeys.has(section.macroArea))
      .map((section) => section.sectionKey)
  );
}

function inferMacroAreasFromSections(sectionKeys = []) {
  return uniqueStrings(
    uniqueStrings(sectionKeys)
      .map((sectionKey) => SECTION_REGISTRY[sectionKey]?.macroArea)
      .filter(Boolean)
  );
}

// =============================================================================
// SECTION REGISTRY — Maps moduleKey → sectionKey → macroArea
// =============================================================================

const SECTION_REGISTRY = {
  // Jurídico
  criminal: {
    sectionKey: 'criminal',
    macroArea: 'juridico',
    label: 'Análise Criminal',
    sourceKeys: ['fontedata_criminal', 'judit_execution', 'escavador_criminal'],
    analyticsEnabled: true,
  },
  labor: {
    sectionKey: 'labor',
    macroArea: 'juridico',
    label: 'Análise Trabalhista',
    sourceKeys: ['fontedata_labor', 'judit_labor'],
    analyticsEnabled: true,
  },
  judicial: {
    sectionKey: 'judicial',
    macroArea: 'juridico',
    label: 'Processos Judiciais',
    sourceKeys: ['bigdatacorp_processes', 'bigdatacorp_lawsuits_distribution', 'bigdatacorp_owners_lawsuits', 'judit_lawsuits', 'escavador_processos', 'djen_comunicacoes'],
    analyticsEnabled: true,
  },
  warrants: {
    sectionKey: 'warrants',
    macroArea: 'juridico',
    label: 'Mandados e Alertas',
    sourceKeys: ['fontedata_warrant', 'judit_warrant'],
    analyticsEnabled: true,
  },

  // Cadastro
  identity_pf: {
    sectionKey: 'identity_pf',
    macroArea: 'cadastro',
    label: 'Identificação PF',
    sourceKeys: ['bigdatacorp_basic_data', 'bigdatacorp_historical_basic_data', 'judit_entity', 'fontedata_identity', 'fontedata_gate'],
    analyticsEnabled: false,
  },
  identity_pj: {
    sectionKey: 'identity_pj',
    macroArea: 'cadastro',
    label: 'Identificação PJ',
    sourceKeys: ['bigdatacorp_basic_data', 'bigdatacorp_history_basic_data', 'fontedata_identity'],
    analyticsEnabled: false,
  },

  // Financeiro (future-ready)
  certidoes: {
    sectionKey: 'certidoes',
    macroArea: 'financeiro',
    label: 'Certidões',
    sourceKeys: ['bigdatacorp_financial_risk', 'bigdatacorp_indebtedness'],
    analyticsEnabled: false,
  },

  // Reguladores
  kyc: {
    sectionKey: 'kyc',
    macroArea: 'reguladores',
    label: 'KYC, PEP e Sanções',
    sourceKeys: ['bigdatacorp_kyc'],
    analyticsEnabled: false,
  },

  // Mídia/Internet
  osint: {
    sectionKey: 'osint',
    macroArea: 'midia_internet',
    label: 'Risco Reputacional',
    sourceKeys: ['osint_web_search', 'bigdatacorp_media_profile', 'bigdatacorp_online_ads'],
    analyticsEnabled: false,
  },
  social: {
    sectionKey: 'social',
    macroArea: 'midia_internet',
    label: 'Redes Sociais',
    sourceKeys: ['social_profiles'],
    analyticsEnabled: false,
  },
  digital: {
    sectionKey: 'digital',
    macroArea: 'midia_internet',
    label: 'Perfil Digital',
    sourceKeys: ['digital_footprint'],
    analyticsEnabled: false,
  },

  // Listas Restritivas (future-ready)
  ofac: {
    sectionKey: 'ofac',
    macroArea: 'listas_restritivas',
    label: 'OFAC / Sanções Internacionais',
    sourceKeys: ['bigdatacorp_social_conscience', 'bigdatacorp_syndicate_agreements', 'bigdatacorp_merchant_category'],
    analyticsEnabled: true,
    isPlaceholder: false,
  },
  interpol: {
    sectionKey: 'interpol',
    macroArea: 'listas_restritivas',
    label: 'Interpol',
    sourceKeys: [],
    analyticsEnabled: false,
    isPlaceholder: true,
  },

  // Bens e Imóveis (future-ready)
  imoveis: {
    sectionKey: 'imoveis',
    macroArea: 'bens_imoveis',
    label: 'Imóveis',
    sourceKeys: [],
    analyticsEnabled: false,
    isPlaceholder: true,
  },
  veiculos: {
    sectionKey: 'veiculos',
    macroArea: 'bens_imoveis',
    label: 'Veículos',
    sourceKeys: [],
    analyticsEnabled: false,
    isPlaceholder: true,
  },

  // Profissional
  occupation: {
    sectionKey: 'occupation',
    macroArea: 'profissional',
    label: 'Ocupação e Emprego',
    sourceKeys: ['bigdatacorp_occupation'],
    analyticsEnabled: false,
  },

  // Socioambiental (future-ready)
  esg: {
    sectionKey: 'esg',
    macroArea: 'socioambiental',
    label: 'ESG',
    sourceKeys: [],
    analyticsEnabled: false,
    isPlaceholder: true,
  },

  // Conflito de Interesse
  conflictInterest: {
    sectionKey: 'conflictInterest',
    macroArea: 'conflito_interesse',
    label: 'Conflito de Interesse',
    sourceKeys: ['conflict_analysis'],
    analyticsEnabled: false,
  },

  // Monitoramento
  ongoing_monitoring: {
    sectionKey: 'ongoing_monitoring',
    macroArea: 'monitoramento',
    label: 'Monitoramento Contínuo',
    sourceKeys: ['watchlist_alerts'],
    analyticsEnabled: false,
  },
};

// =============================================================================
// DOSSIER SCHEMA REGISTRY — Pre-defined layouts
// =============================================================================

const DOSSIER_SCHEMA_REGISTRY = {
  // PF Schemas
  dossier_pf_basic: {
    schemaKey: 'dossier_pf_basic',
    label: 'Dossiê PF Essencial',
    subjectType: 'pf',
    description: 'Identificação cadastral e decisão supervisionada',
    macroAreas: ['cadastro', 'juridico', 'reguladores'],
    sections: ['identity_pf', 'criminal', 'warrants', 'kyc'],
    isCustomizable: false,
  },
  dossier_pf_full: {
    schemaKey: 'dossier_pf_full',
    label: 'Dossiê PF Completo',
    subjectType: 'pf',
    description: 'Dossiê completo com criminal, trabalhista, judicial e KYC',
    macroAreas: ['cadastro', 'juridico', 'reguladores', 'midia_internet', 'profissional', 'conflito_interesse'],
    sections: ['identity_pf', 'criminal', 'labor', 'judicial', 'warrants', 'kyc', 'osint', 'social', 'digital', 'occupation', 'conflictInterest'],
    isCustomizable: true,
  },

  // PJ Schemas
  dossier_pj: {
    schemaKey: 'dossier_pj',
    label: 'Dossiê PJ',
    subjectType: 'pj',
    description: 'Dossiê empresarial com identificação, processos, KYC corporativo, ESG e mídia',
    macroAreas: ['cadastro', 'juridico', 'reguladores', 'profissional', 'midia_internet', 'socioambiental'],
    sections: ['identity_pj', 'judicial', 'kyc', 'occupation', 'conflictInterest', 'osint', 'esg'],
    isCustomizable: true,
  },

  // Specialized Schemas
  kyc_individual: {
    schemaKey: 'kyc_individual',
    label: 'KYC Individual',
    subjectType: 'pf',
    description: 'Cadastral + sanções + PEP + criminal',
    macroAreas: ['cadastro', 'reguladores', 'juridico', 'listas_restritivas'],
    sections: ['identity_pf', 'kyc', 'criminal', 'ofac', 'interpol'],
    isCustomizable: true,
  },
  kyb_business: {
    schemaKey: 'kyb_business',
    label: 'KYB Empresa',
    subjectType: 'pj',
    description: 'Quadro societário, sanções, processos',
    macroAreas: ['cadastro', 'reguladores', 'juridico', 'profissional'],
    sections: ['identity_pj', 'kyc', 'judicial', 'occupation'],
    isCustomizable: true,
  },
  kye_employee: {
    schemaKey: 'kye_employee',
    label: 'KYE Colaborador',
    subjectType: 'pf',
    description: 'Background check de contratação',
    macroAreas: ['cadastro', 'juridico', 'reguladores', 'midia_internet', 'profissional'],
    sections: ['identity_pf', 'criminal', 'labor', 'kyc', 'osint', 'social', 'digital', 'occupation'],
    isCustomizable: true,
  },
  reputational_risk: {
    schemaKey: 'reputational_risk',
    label: 'Risco Reputacional',
    subjectType: 'pf',
    description: 'OSINT, digital, social',
    macroAreas: ['midia_internet', 'reguladores'],
    sections: ['osint', 'social', 'digital', 'kyc'],
    isCustomizable: true,
  },
  kys_supplier: {
    schemaKey: 'kys_supplier',
    label: 'KYS — Due Diligence de Fornecedor',
    subjectType: 'pj',
    description: 'Avaliação de risco de cadeia de suprimentos com análise de sócios',
    macroAreas: ['cadastro', 'juridico', 'reguladores', 'profissional', 'conflito_interesse'],
    sections: ['identity_pj', 'identity_pf', 'criminal', 'kyc', 'relationship', 'occupation', 'conflictInterest'],
    isCustomizable: true,
  },
  tpr_third_party: {
    schemaKey: 'tpr_third_party',
    label: 'TPR — Terceiros em Compliance',
    subjectType: 'hybrid',
    description: 'Due diligence avançada para terceiros de alto risco: PF e PJ dual',
    macroAreas: ['cadastro', 'juridico', 'reguladores', 'profissional', 'midia_internet', 'conflito_interesse'],
    sections: ['identity_pf', 'identity_pj', 'criminal', 'labor', 'kyc', 'relationship', 'osint', 'occupation', 'conflictInterest'],
    isCustomizable: true,
  },
  ongoing_monitoring: {
    schemaKey: 'ongoing_monitoring',
    label: 'Monitoramento Contínuo',
    subjectType: 'pf',
    description: 'Reconsulta periódica automatizada com alertas',
    macroAreas: ['cadastro', 'juridico', 'reguladores'],
    sections: ['identity_pf', 'kyc', 'criminal', 'warrants', 'ongoing_monitoring'],
    isCustomizable: false,
  },
  report_secure: {
    schemaKey: 'report_secure',
    label: 'Relatório Seguro',
    subjectType: 'pf',
    description: 'Relatório auditável com hash de integridade',
    macroAreas: ['cadastro', 'juridico', 'reguladores', 'profissional', 'conflito_interesse'],
    sections: ['identity_pf', 'criminal', 'labor', 'kyc', 'osint', 'occupation', 'conflictInterest'],
    isCustomizable: true,
  },

  // Custom / Blank
  custom: {
    schemaKey: 'custom',
    label: 'Dossiê Personalizado',
    subjectType: 'hybrid',
    description: 'Layout configurável pelo usuário',
    macroAreas: [],
    sections: [],
    isCustomizable: true,
    isBlank: true,
  },
};

// =============================================================================
// SOURCE STATUS MAPPING — For UI badges
// =============================================================================

const SOURCE_STATUS_LABELS = {
  completed_with_findings: { label: 'Com resultado', variant: 'success' },
  completed_no_findings: { label: 'Nenhum resultado', variant: 'warning' },
  skipped_reuse: { label: 'Concluido', variant: 'info' },
  skipped_policy: { label: 'Não aplicável', variant: 'neutral' },
  failed_retryable: { label: 'Indisponível', variant: 'error' },
  failed_final: { label: 'Falha', variant: 'error' },
  pending: { label: 'Criado', variant: 'neutral' },
  running: { label: 'Processando', variant: 'info' },
  not_entitled: { label: 'Não contratado', variant: 'neutral' },
};

// =============================================================================
// RESOLVERS
// =============================================================================

/**
 * Resolve a dossier schema by schemaKey.
 * @param {string} schemaKey
 * @returns {object|null}
 */
function resolveSchema(schemaKey) {
  return DOSSIER_SCHEMA_REGISTRY[schemaKey] || null;
}

/**
 * Resolve the default schema for a productKey.
 * @param {string} productKey
 * @returns {object|null}
 */
function resolveSchemaForProduct(productKey) {
  const mapping = {
    dossier_pf_basic: 'dossier_pf_basic',
    dossier_pf_full: 'dossier_pf_full',
    dossier_pf_custom: 'custom',
    dossier_pj: 'dossier_pj',
    dossier_pj_custom: 'custom',
    kyc_individual: 'kyc_individual',
    kyb_business: 'kyb_business',
    kye_employee: 'kye_employee',
    kys_supplier: 'kys_supplier',
    tpr_third_party: 'tpr_third_party',
    ongoing_monitoring: 'ongoing_monitoring',
    report_secure: 'report_secure',
    reputational_risk: 'reputational_risk',
  };
  const schemaKey = mapping[productKey];
  return schemaKey ? resolveSchema(schemaKey) : null;
}

function resolvePreset(presetKey) {
  const key = String(presetKey || '').trim().toLowerCase();
  return DOSSIER_PRESET_REGISTRY[key] || null;
}

function resolveSchemaKeyForContext({
  productKey = '',
  dossierSchemaKey = '',
  dossierPresetKey = '',
  subjectType = 'pf',
} = {}) {
  const explicitSchema = resolveSchema(String(dossierSchemaKey || '').trim());
  if (explicitSchema) return explicitSchema.schemaKey;

  const preset = resolvePreset(dossierPresetKey);
  const presetSchemaKey = pickSubjectScopedSchemaKey(preset?.defaultSchemaBySubject, subjectType);
  if (presetSchemaKey && resolveSchema(presetSchemaKey)) {
    return presetSchemaKey;
  }

  const productSchema = resolveSchemaForProduct(productKey);
  return productSchema?.schemaKey || 'custom';
}

function resolveDossierConfiguration(params = {}) {
  const subjectType = String(params.subjectType || 'pf').trim().toLowerCase() || 'pf';
  const preset = resolvePreset(params.dossierPresetKey);
  const dossierSchemaKey = resolveSchemaKeyForContext({
    productKey: params.productKey,
    dossierSchemaKey: params.dossierSchemaKey,
    dossierPresetKey: params.dossierPresetKey,
    subjectType,
  });
  const schema = resolveSchema(dossierSchemaKey) || DOSSIER_SCHEMA_REGISTRY.custom;

  const explicitRequestedModuleKeys = uniqueStrings(params.requestedModuleKeys);
  let requestedSectionKeys = uniqueStrings(params.requestedSectionKeys);
  if (requestedSectionKeys.length === 0) {
    const presetSections = pickSubjectScopedValue(preset?.defaultSectionKeysBySubject, subjectType);
    requestedSectionKeys = presetSections.length > 0
      ? presetSections
      : uniqueStrings(schema.sections);
  }

  let requestedMacroAreaKeys = uniqueStrings(params.requestedMacroAreaKeys);
  if (requestedMacroAreaKeys.length === 0) {
    const presetMacroAreas = uniqueStrings(preset?.defaultMacroAreas);
    requestedMacroAreaKeys = presetMacroAreas.length > 0
      ? presetMacroAreas
      : inferMacroAreasFromSections(requestedSectionKeys);
  }
  if (requestedSectionKeys.length === 0 && requestedMacroAreaKeys.length > 0) {
    requestedSectionKeys = expandSectionKeysFromMacroAreas(requestedMacroAreaKeys);
  }
  if (requestedMacroAreaKeys.length === 0 && requestedSectionKeys.length > 0) {
    requestedMacroAreaKeys = inferMacroAreasFromSections(requestedSectionKeys);
  }

  const requestedModuleKeys = uniqueStrings([
    ...explicitRequestedModuleKeys,
    ...requestedSectionKeys.filter((sectionKey) => Boolean(SECTION_REGISTRY[sectionKey])),
  ]);
  const requestedSourceKeys = uniqueStrings(params.requestedSourceKeys);
  const tags = uniqueStrings(params.tags);
  const tag = String(params.tag || tags[0] || '').trim() || null;
  const parameters = normalizePlainObject(params.parameters);
  const configurationSource = String(
    params.configurationSource
    || (params.customProfileName ? 'custom_profile' : '')
    || (preset ? 'preset' : '')
    || (params.dossierSchemaKey ? 'schema' : '')
    || 'product_default'
  ).trim();
  const validation = validateCustomSchema({
    macroAreas: requestedMacroAreaKeys,
    sections: requestedSectionKeys,
  });

  return {
    configVersion: DOSSIER_SCHEMA_VERSION,
    configurationSource,
    subjectType,
    dossierPresetKey: preset?.presetKey || null,
    dossierPresetLabel: preset?.label || null,
    dossierSchemaKey: schema?.schemaKey || 'custom',
    dossierSchemaLabel: schema?.label || 'Dossie Personalizado',
    requestedMacroAreaKeys,
    requestedSectionKeys,
    requestedModuleKeys,
    requestedSourceKeys,
    tag,
    tags,
    parameters,
    autoProcessRequested: params.autoProcessRequested === true,
    customProfileName: String(params.customProfileName || '').trim() || null,
    customProfileDescription: String(params.customProfileDescription || '').trim() || null,
    viewModes: ['analitico', 'detalhado'],
    isValid: validation.valid,
    validationErrors: validation.errors,
  };
}

/**
 * Resolve sections for a given list of moduleKeys.
 * @param {string[]} moduleKeys
 * @returns {Array<{sectionKey, macroArea, label, sourceKeys, analyticsEnabled}>}
 */
function resolveSections(moduleKeys = []) {
  const keySet = new Set(moduleKeys);
  return Object.values(SECTION_REGISTRY)
    .filter((s) => keySet.has(s.sectionKey))
    .sort((a, b) => {
      const orderA = MACRO_AREAS[a.macroArea]?.defaultOrder || 99;
      const orderB = MACRO_AREAS[b.macroArea]?.defaultOrder || 99;
      return orderA - orderB || a.label.localeCompare(b.label);
    });
}

/**
 * Group sections by macro-area.
 * @param {string[]} moduleKeys
 * @returns {Array<{areaKey, label, icon, sections: []}>}
 */
function resolveMacroAreas(moduleKeys = []) {
  const sections = resolveSections(moduleKeys);
  const grouped = {};

  for (const section of sections) {
    const areaKey = section.macroArea;
    if (!grouped[areaKey]) {
      const areaDef = MACRO_AREAS[areaKey];
      grouped[areaKey] = {
        areaKey,
        label: areaDef?.label || areaKey,
        icon: areaDef?.icon || '📋',
        description: areaDef?.description || '',
        order: areaDef?.defaultOrder || 99,
        sections: [],
      };
    }
    grouped[areaKey].sections.push(section);
  }

  return Object.values(grouped).sort((a, b) => a.order - b.order);
}

/**
 * Build a rich projection for the client UI.
 * @param {object} params — { schemaKey, moduleKeys, moduleRuns, evidenceItems, riskSignals }
 * @returns {object}
 */
function buildDossierProjection(params = {}) {
  const {
    schemaKey,
    moduleKeys = [],
    moduleRuns = [],
    requestedSectionKeys = [],
    requestedMacroAreaKeys = [],
  } = params;
  const schema = schemaKey ? resolveSchema(schemaKey) : null;
  const subjectType = String(params.subjectType || schema?.subjectType || 'pf').trim().toLowerCase() || 'pf';
  const projectedSectionKeys = uniqueStrings([
    ...uniqueStrings(requestedSectionKeys),
    ...uniqueStrings(schema?.sections),
    ...uniqueStrings(moduleKeys),
  ]);
  const macroAreas = resolveMacroAreas(projectedSectionKeys.length > 0 ? projectedSectionKeys : moduleKeys);
  const desiredAreaKeys = uniqueStrings([
    ...uniqueStrings(requestedMacroAreaKeys),
    ...uniqueStrings(schema?.macroAreas),
    ...inferMacroAreasFromSections(projectedSectionKeys),
  ]);

  // Enrich sections with execution status from moduleRuns
  const runMap = new Map();
  for (const run of moduleRuns) {
    if (run.moduleKey) runMap.set(run.moduleKey, run);
  }

  for (const area of macroAreas) {
    for (const section of area.sections) {
      const run = runMap.get(section.sectionKey);
      section.executionStatus = run?.status || 'pending';
      section.statusLabel = SOURCE_STATUS_LABELS[run?.status]?.label || 'Criado';
      section.statusVariant = SOURCE_STATUS_LABELS[run?.status]?.variant || 'neutral';
      section.hasFindings = run?.status === 'completed_with_findings';
      section.resultCount = run?.resultCount || 0;
    }
    // Area-level counters
    area.totalSources = area.sections.length;
    area.sourcesWithResults = area.sections.filter((s) => s.hasFindings).length;
    area.sourcesUnavailable = area.sections.filter((s) =>
      ['failed_retryable', 'failed_final'].includes(s.executionStatus)
    ).length;
  }

  desiredAreaKeys.forEach((areaKey) => {
    if (macroAreas.some((area) => area.areaKey === areaKey)) return;
    const areaDef = MACRO_AREAS[areaKey];
    macroAreas.push({
      areaKey,
      label: areaDef?.label || areaKey,
      icon: areaDef?.icon || '[]',
      description: areaDef?.description || '',
      order: areaDef?.defaultOrder || 99,
      sections: [],
      totalSources: 0,
      sourcesWithResults: 0,
      sourcesUnavailable: 0,
    });
  });

  macroAreas.sort((left, right) => (left.order || 99) - (right.order || 99));

  return {
    version: DOSSIER_SCHEMA_VERSION,
    schemaKey: schema?.schemaKey || 'custom',
    schemaLabel: schema?.label || 'Dossiê Personalizado',
    subjectType,
    macroAreas,
    summary: {
      totalAreas: macroAreas.length,
      totalSources: macroAreas.reduce((sum, a) => sum + a.totalSources, 0),
      sourcesWithResults: macroAreas.reduce((sum, a) => sum + a.sourcesWithResults, 0),
      sourcesUnavailable: macroAreas.reduce((sum, a) => sum + a.sourcesUnavailable, 0),
    },
  };
}

/**
 * Validate a custom schema configuration.
 * @param {object} config — { macroAreas: string[], sections: string[] }
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateCustomSchema(config = {}) {
  const errors = [];
  const { macroAreas = [], sections = [] } = config;

  for (const areaKey of macroAreas) {
    if (!MACRO_AREAS[areaKey]) {
      errors.push(`Macro-área inválida: ${areaKey}`);
    }
  }

  for (const sectionKey of sections) {
    if (!SECTION_REGISTRY[sectionKey]) {
      errors.push(`Seção inválida: ${sectionKey}`);
    }
  }

  // Check consistency: all sections must belong to selected macroAreas
  for (const sectionKey of sections) {
    const section = SECTION_REGISTRY[sectionKey];
    if (section && !macroAreas.includes(section.macroArea)) {
      errors.push(`Seção ${sectionKey} pertence à área ${section.macroArea}, que não está selecionada`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  DOSSIER_SCHEMA_VERSION,
  MACRO_AREAS,
  SECTION_REGISTRY,
  DOSSIER_SCHEMA_REGISTRY,
  DOSSIER_PRESET_REGISTRY,
  SOURCE_STATUS_LABELS,
  resolveSchema,
  resolveSchemaForProduct,
  resolvePreset,
  resolveDossierConfiguration,
  resolveSchemaKeyForContext,
  resolveSections,
  resolveMacroAreas,
  inferMacroAreasFromSections,
  buildDossierProjection,
  validateCustomSchema,
  normalizePlainObject,
};
