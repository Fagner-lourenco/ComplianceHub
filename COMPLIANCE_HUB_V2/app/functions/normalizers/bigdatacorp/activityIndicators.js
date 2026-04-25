/**
 * Normalizer: BigDataCorp Activity Indicators (PJ)
 * Transforms BDC activity_indicators response into canonical business activity data.
 */

/**
 * Normalize activity indicators data.
 * @param {object} bdcResult — Result[0].ActivityIndicators
 * @returns {object|null}
 */
function normalizeActivityIndicators(bdcResult) {
  if (!bdcResult) return null;

  return {
    activityLevel: bdcResult.ActivityLevel || 0,
    hasActivity: bdcResult.HasActivity === true,
    incomeRange: bdcResult.IncomeRange || '',
    employeesRange: bdcResult.EmployeesRange || '',
    hasActiveDomain: bdcResult.HasActiveDomain === true,
    hasActiveSsl: bdcResult.HasActiveSSL === true,
    hasCorporateEmail: bdcResult.HasCorporateEmail === true,
    hasRecentAddress: bdcResult.HasRecentAddress === true,
    hasRecentEmail: bdcResult.HasRecentEmail === true,
    hasRecentPhone: bdcResult.HasRecentPhone === true,
    hasRecentPassages: bdcResult.HasRecentPassages === true,
    shellCompanyLikelihood: bdcResult.ShellCompanyLikelyhood || 0,
    numberOfBranches: bdcResult.NumberOfBranches || 0,
    // Economic group aggregates
    economicGroup: {
      avgActivityLevel: bdcResult.FirstLevelEconomicGroupAverageActivityLevel || 0,
      maxActivityLevel: bdcResult.FirstLevelEconomicGroupMaxActivityLevel || 0,
      minActivityLevel: bdcResult.FirstLevelEconomicGroupMinActivityLevel || 0,
    },
  };
}

/**
 * Build an EvidenceItem content block from normalized activity indicators.
 * @param {object} normalized
 * @returns {object}
 */
function buildActivityIndicatorsEvidenceContent(normalized) {
  if (!normalized) {
    return { text: 'Nenhum indicador de atividade encontrado.' };
  }

  const paragraphs = [];

  if (normalized.hasActivity) {
    paragraphs.push(`Empresa com atividade detectada (nível ${normalized.activityLevel.toFixed(2)}).`);
  } else {
    paragraphs.push('Nenhuma atividade detectada para esta empresa.');
  }

  if (normalized.incomeRange) {
    paragraphs.push(`Faixa de faturamento: ${normalized.incomeRange}.`);
  }
  if (normalized.employeesRange) {
    paragraphs.push(`Faixa de funcionários: ${normalized.employeesRange}.`);
  }
  if (normalized.shellCompanyLikelihood > 0.5) {
    paragraphs.push(`ALERTA: Alta probabilidade de empresa de fachada (${(normalized.shellCompanyLikelihood * 100).toFixed(0)}%).`);
  }
  if (normalized.numberOfBranches > 0) {
    paragraphs.push(`${normalized.numberOfBranches} filial(is) identificada(s).`);
  }

  return {
    text: paragraphs.join(' ') || 'Indicadores de atividade insuficientes.',
    activity: {
      level: normalized.activityLevel,
      hasActivity: normalized.hasActivity,
      shellCompanyLikelihood: normalized.shellCompanyLikelihood,
    },
    size: {
      incomeRange: normalized.incomeRange,
      employeesRange: normalized.employeesRange,
      numberOfBranches: normalized.numberOfBranches,
    },
    digital: {
      hasActiveDomain: normalized.hasActiveDomain,
      hasCorporateEmail: normalized.hasCorporateEmail,
      hasRecentEmail: normalized.hasRecentEmail,
      hasRecentPhone: normalized.hasRecentPhone,
      hasRecentAddress: normalized.hasRecentAddress,
    },
  };
}

module.exports = {
  normalizeActivityIndicators,
  buildActivityIndicatorsEvidenceContent,
};
