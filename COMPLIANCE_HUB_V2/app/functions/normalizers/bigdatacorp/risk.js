/**
 * Normalizer: BigDataCorp Risk Datasets
 */

/**
 * Normalize financial risk data.
 * @param {object} bdcResult
 * @returns {object|null}
 */
function normalizeFinancialRisk(bdcResult) {
  if (!bdcResult) return null;

  return {
    riskLevel: bdcResult.FinancialRiskLevel || 'UNKNOWN',
    riskScore: bdcResult.FinancialRiskScore || null,
    totalAssets: bdcResult.TotalAssets || null,
    estimatedIncomeRange: bdcResult.EstimatedIncomeRange || null,
    isCurrentlyEmployed: bdcResult.IsCurrentlyEmployed || false,
    isCurrentlyOwner: bdcResult.IsCurrentlyOwner || false,
    isCurrentlyOnCollection: bdcResult.IsCurrentlyOnCollection || false,
    last365DaysCollectionOccurrences: bdcResult.Last365DaysCollectionOccurrences || 0,
    currentConsecutiveCollectionMonths: bdcResult.CurrentConsecutiveCollectionMonths || 0,
    isCurrentlyReceivingAssistance: bdcResult.IsCurrentlyReceivingAssistance || false,
  };
}

function buildFinancialRiskEvidence(risk) {
  if (!risk) return null;
  const parts = [];
  if (risk.riskLevel && risk.riskLevel !== 'UNKNOWN') parts.push(`Nível: ${risk.riskLevel}`);
  if (risk.riskScore) parts.push(`Score: ${risk.riskScore}`);
  if (risk.totalAssets) parts.push(`Patrimônio: ${risk.totalAssets}`);
  if (risk.estimatedIncomeRange) parts.push(`Renda: ${risk.estimatedIncomeRange}`);
  if (risk.isCurrentlyOnCollection) parts.push('Em cobrança');
  return parts.length ? parts.join(' | ') : null;
}

/**
 * Normalize indebtedness probability.
 * @param {object} bdcResult
 * @returns {object|null}
 */
function normalizeIndebtedness(bdcResult) {
  if (!bdcResult) return null;

  return {
    likelyInDebt: bdcResult.LikelyInDebt || false,
    indebtednessProbability: bdcResult.IndebtednessProbability || null,
    indebtednessScore: bdcResult.IndebtednessScore || null,
  };
}

function buildIndebtednessEvidence(data) {
  if (!data) return null;
  if (data.likelyInDebt) return 'Alta probabilidade de inadimplência';
  if (data.indebtednessProbability) return `Probabilidade: ${data.indebtednessProbability}`;
  return null;
}

module.exports = {
  normalizeFinancialRisk,
  buildFinancialRiskEvidence,
  normalizeIndebtedness,
  buildIndebtednessEvidence,
};
