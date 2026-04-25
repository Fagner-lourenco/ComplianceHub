/**
 * Normalizer: BigDataCorp KYC
 * Transforms BDC KYC response into canonical compliance signals.
 */

const {
  normalizePepEntry,
  normalizeSanctionEntry,
} = require('../../domain/v2NormalizationRules');

/**
 * Normalize KYC data from BDC.
 * @param {object} kycData — Result[0].KycData
 * @returns {object} normalized KYC content
 */
function normalizeKyc(kycData) {
  if (!kycData) return null;

  const pepHistory = (kycData.PEPHistory || []).map(normalizePepEntry);
  const sanctionsHistory = (kycData.SanctionsHistory || []).map(normalizeSanctionEntry);

  // Categorize sanctions by source
  const domesticSources = ['CNJ', 'CEAF', 'CNEP', 'MTE', 'TCU', 'BC', 'CVM'];
  const internationalSources = ['INTERPOL', 'FBI', 'OFAC', 'EU', 'UNSC'];

  const domesticSanctions = sanctionsHistory.filter(s =>
    domesticSources.includes(s.source?.toUpperCase())
  );
  const internationalSanctions = sanctionsHistory.filter(s =>
    internationalSources.includes(s.source?.toUpperCase())
  );

  return {
    pepHistory,
    sanctionsHistory,
    domesticSanctions,
    internationalSanctions,
    isCurrentlySanctioned: kycData.IsCurrentlySanctioned === true,
    wasPreviouslySanctioned: kycData.WasPreviouslySanctioned === true,
    isCurrentlyPresentOnSource: kycData.IsCurrentlyPresentOnSource === true,
    wasRecentlyPresentOnSource: kycData.WasRecentlyPresentOnSource === true,
    hasPep: pepHistory.length > 0,
    hasSanctions: sanctionsHistory.length > 0,
    highestPepLevel: pepHistory.length > 0
      ? Math.max(...pepHistory.map(p => p.level))
      : 0,
  };
}

/**
 * Build an EvidenceItem content block from normalized KYC.
 * @param {object} normalizedKyc
 * @returns {object}
 */
function buildKycEvidenceContent(normalizedKyc) {
  if (!normalizedKyc) {
    return { text: 'Nenhum dado KYC encontrado.' };
  }

  const paragraphs = [];

  if (normalizedKyc.hasPep) {
    paragraphs.push(`PEP detectado: Nível ${normalizedKyc.highestPepLevel}.`);
  }
  if (normalizedKyc.isCurrentlySanctioned) {
    paragraphs.push('Sanção ATIVA detectada.');
  } else if (normalizedKyc.wasPreviouslySanctioned) {
    paragraphs.push('Sanção anterior detectada (não ativa).');
  }

  return {
    text: paragraphs.join(' ') || 'Sem registros de PEP ou sanções.',
    pepHistory: normalizedKyc.pepHistory,
    sanctionsHistory: normalizedKyc.sanctionsHistory,
    flags: {
      isCurrentlySanctioned: normalizedKyc.isCurrentlySanctioned,
      wasPreviouslySanctioned: normalizedKyc.wasPreviouslySanctioned,
      hasPep: normalizedKyc.hasPep,
    },
  };
}

module.exports = {
  normalizeKyc,
  buildKycEvidenceContent,
};
