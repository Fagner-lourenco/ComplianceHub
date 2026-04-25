/**
 * Normalizer: BigDataCorp ESG Datasets
 */

/**
 * Normalize syndicate agreements.
 * @param {object} bdcResult
 * @returns {object|null}
 */
function normalizeSyndicateAgreements(bdcResult) {
  if (!bdcResult) return null;

  const agreements = Array.isArray(bdcResult) ? bdcResult : bdcResult.Agreements || [];

  return {
    count: agreements.length,
    agreements: agreements.map(a => ({
      unionName: a.UnionName || '',
      category: a.Category || '',
      startDate: a.StartDate || null,
      endDate: a.EndDate || null,
    })),
  };
}

/**
 * Normalize social conscience (ESG metrics).
 * @param {object} bdcResult
 * @returns {object|null}
 */
function normalizeSocialConscience(bdcResult) {
  if (!bdcResult) return null;

  return {
    score: bdcResult.SocialConscienceScore || null,
    accessibility: bdcResult.AccessibilityScore || null,
    diversity: bdcResult.DiversityScore || null,
    equity: bdcResult.EquityScore || null,
  };
}

module.exports = {
  normalizeSyndicateAgreements,
  normalizeSocialConscience,
};
