/**
 * Config: Enrichment Defaults
 * Default dataset configurations per preset and subject type.
 */

const { PRESET_DATASET_MAP, estimatePresetCost } = require('../adapters/bigdatacorpCatalog');

/**
 * Get default datasets for a preset.
 * @param {string} presetKey
 * @param {'pf'|'pj'} subjectType
 * @returns {string[]}
 */
function getDefaultDatasets(presetKey, subjectType) {
  return PRESET_DATASET_MAP[presetKey]?.[subjectType] || [];
}

/**
 * Get estimated cost for a preset.
 * @param {string} presetKey
 * @param {'pf'|'pj'} subjectType
 * @returns {number}
 */
function getPresetCost(presetKey, subjectType) {
  return estimatePresetCost(presetKey, subjectType);
}

/**
 * All preset metadata for UI display.
 */
const PRESET_METADATA = {
  compliance: {
    label: 'Compliance',
    description: 'Verificação completa de PEP, sanções e processos judiciais.',
    icon: '🛡️',
  },
  internacional: {
    label: 'Compliance Internacional',
    description: 'Verificação de sanções internacionais e presença digital.',
    icon: '🌍',
  },
  financeiro: {
    label: 'Financeiro',
    description: 'Análise de dívidas, risco financeiro e certidões.',
    icon: '💰',
  },
  investigativo: {
    label: 'Investigativo',
    description: 'Investigação aprofundada com OSINT e mídia.',
    icon: '🔍',
  },
  juridico: {
    label: 'Jurídico',
    description: 'Foco em processos judiciais e mandados.',
    icon: '⚖️',
  },
  pld: {
    label: 'PLD',
    description: 'Prevenção à lavagem de dinheiro e KYC.',
    icon: '💵',
  },
  rh: {
    label: 'Recursos Humanos',
    description: 'Background check para contratação.',
    icon: '👥',
  },
  dossier_pf_full: {
    label: 'Dossiê PF Completo',
    description: 'Dossiê máximo: identidade, contato, profissão, financeiro, compliance, processos e presença digital.',
    icon: '📋',
  },
  dossier_pj_full: {
    label: 'Dossiê PJ Completo',
    description: 'Dossiê máximo: cadastro, QSA, sócios, atividade, evolução, compliance, processos e contato.',
    icon: '🏢',
  },
};

module.exports = {
  getDefaultDatasets,
  getPresetCost,
  PRESET_METADATA,
};
