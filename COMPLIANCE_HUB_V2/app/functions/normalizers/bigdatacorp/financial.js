/**
 * Normalizer: BigDataCorp Financial Data
 */

/**
 * Normalize financial data.
 * @param {object} bdcResult
 * @returns {object|null}
 */
function normalizeFinancial(bdcResult) {
  if (!bdcResult) return null;

  return {
    incomeRange: bdcResult.IncomeRange || '',
    employeesRange: bdcResult.EmployeesRange || '',
    activityLevel: bdcResult.ActivityLevel || '',
    hasActivity: bdcResult.HasActivity === true,
    shellCompanyLikelyhood: bdcResult.ShellCompanyLikelyhood === true,
    hasRecentEmail: bdcResult.HasRecentEmail === true,
    hasActiveDomain: bdcResult.HasActiveDomain === true,
    capitalSocial: bdcResult.CapitalSocial || null,
    companySize: bdcResult.Size || '',
  };
}

/**
 * Normalize government debtors data.
 * @param {object} bdcResult
 * @returns {object|null}
 */
function normalizeGovernmentDebtors(bdcResult) {
  if (!bdcResult) return null;

  return {
    isGovernmentDebtor: bdcResult.IsGovernmentDebtor === true,
    debtAmount: bdcResult.DebtAmount || null,
    debtType: bdcResult.DebtType || '',
    organ: bdcResult.Organ || '',
  };
}

/**
 * Normalize collections data.
 * @param {object} bdcResult
 * @returns {object|null}
 */
function normalizeCollections(bdcResult) {
  if (!bdcResult) return null;

  return {
    isPresentInCollection: bdcResult.IsPresentInCollection === true,
    collectionCompanies: bdcResult.CollectionCompanies || [],
  };
}

module.exports = {
  normalizeFinancial,
  normalizeGovernmentDebtors,
  normalizeCollections,
};
