/**
 * Normalizer: BigDataCorp Company Evolution (PJ)
 * Transforms BDC company_evolution response into canonical temporal business data.
 */

/**
 * Normalize company evolution data.
 * @param {object} bdcResult — Result[0].CompanyEvolutionData
 * @returns {object|null}
 */
function normalizeCompanyEvolution(bdcResult) {
  if (!bdcResult) return null;

  const history = Array.isArray(bdcResult.DataHistoryOverTime)
    ? bdcResult.DataHistoryOverTime.map(entry => ({
        date: entry.Date || entry.ReferenceDate || null,
        capital: entry.Capital || entry.AverageCapital || null,
        employees: entry.QtyEmployees || entry.AverageQtyEmployees || null,
        qsaCount: entry.QtyQSA || entry.AverageQtyQSA || null,
        subsidiaries: entry.QtySubsidiaries || entry.AverageQtySubsidiaries || null,
        activityLevel: entry.ActivityLevel || null,
      }))
    : [];

  return {
    averageCapital: bdcResult.AverageCapital || null,
    averageCapital1YearAgo: bdcResult.AverageCapital1YearAgo || null,
    averageCapital3YearsAgo: bdcResult.AverageCapital3YearsAgo || null,
    averageCapital5YearsAgo: bdcResult.AverageCapital5YearsAgo || null,
    averageEmployees: bdcResult.AverageQtyEmployees || null,
    averageEmployees1YearAgo: bdcResult.AverageQtyEmployees1YearAgo || null,
    averageEmployees3YearsAgo: bdcResult.AverageQtyEmployees3YearsAgo || null,
    averageEmployees5YearsAgo: bdcResult.AverageQtyEmployees5YearsAgo || null,
    averageQsaCount: bdcResult.AverageQtyQSA || null,
    averageQsaCount1YearAgo: bdcResult.AverageQtyQSA1YearAgo || null,
    averageQsaCount3YearsAgo: bdcResult.AverageQtyQSA3YearsAgo || null,
    averageQsaCount5YearsAgo: bdcResult.AverageQtyQSA5YearsAgo || null,
    averageSubsidiaries: bdcResult.AverageQtySubsidiaries || null,
    maxCapital: bdcResult.MaxCapital || null,
    minCapital: bdcResult.MinCapital || null,
    maxEmployees: bdcResult.MaxQtyEmployees || null,
    minEmployees: bdcResult.MinQtyEmployees || null,
    maxQsaCount: bdcResult.MaxQtyQSA || null,
    minQsaCount: bdcResult.MinQtyQSA || null,
    maxSubsidiaries: bdcResult.MaxQtySubsidiaries || null,
    minSubsidiaries: bdcResult.MinQtySubsidiaries || null,
    hasQsaChangedAnytime: bdcResult.HasQSAChangedAnytime === true,
    growthStatus1YearAgo: bdcResult.YearOverYearGrowthRateStatus1YearAgo || '',
    growthStatus3YearsAgo: bdcResult.YearOverYearGrowthRateStatus3YearsAgo || '',
    growthStatus5YearsAgo: bdcResult.YearOverYearGrowthRateStatus5YearsAgo || '',
    history,
  };
}

/**
 * Build an EvidenceItem content block from normalized company evolution.
 * @param {object} normalized
 * @returns {object}
 */
function buildCompanyEvolutionEvidenceContent(normalized) {
  if (!normalized) {
    return { text: 'Nenhum dado de evolução da empresa encontrado.' };
  }

  const paragraphs = [];

  if (normalized.averageCapital !== null) {
    paragraphs.push(`Capital médio: R$ ${Number(normalized.averageCapital).toLocaleString('pt-BR')}.`);
  }
  if (normalized.averageEmployees !== null) {
    paragraphs.push(`Média de funcionários: ${normalized.averageEmployees}.`);
  }
  if (normalized.hasQsaChangedAnytime) {
    paragraphs.push('Alteração histórica na composição societária detectada.');
  }

  const growthMsgs = [];
  if (normalized.growthStatus1YearAgo) growthMsgs.push(`1 ano: ${normalized.growthStatus1YearAgo}`);
  if (normalized.growthStatus3YearsAgo) growthMsgs.push(`3 anos: ${normalized.growthStatus3YearsAgo}`);
  if (normalized.growthStatus5YearsAgo) growthMsgs.push(`5 anos: ${normalized.growthStatus5YearsAgo}`);
  if (growthMsgs.length > 0) {
    paragraphs.push(`Crescimento — ${growthMsgs.join(', ')}.`);
  }

  return {
    text: paragraphs.join(' ') || 'Evolução da empresa insuficiente para análise.',
    capital: {
      current: normalized.averageCapital,
      oneYearAgo: normalized.averageCapital1YearAgo,
      threeYearsAgo: normalized.averageCapital3YearsAgo,
      fiveYearsAgo: normalized.averageCapital5YearsAgo,
    },
    employees: {
      current: normalized.averageEmployees,
      oneYearAgo: normalized.averageEmployees1YearAgo,
      threeYearsAgo: normalized.averageEmployees3YearsAgo,
      fiveYearsAgo: normalized.averageEmployees5YearsAgo,
    },
    qsa: {
      hasChanged: normalized.hasQsaChangedAnytime,
      current: normalized.averageQsaCount,
    },
    growth: {
      oneYear: normalized.growthStatus1YearAgo,
      threeYears: normalized.growthStatus3YearsAgo,
      fiveYears: normalized.growthStatus5YearsAgo,
    },
    history: normalized.history,
  };
}

module.exports = {
  normalizeCompanyEvolution,
  buildCompanyEvolutionEvidenceContent,
};
