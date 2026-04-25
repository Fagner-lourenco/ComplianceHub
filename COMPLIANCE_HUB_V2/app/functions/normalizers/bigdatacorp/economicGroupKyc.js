function normalizeEconomicGroupKyc(bdcResult) {
  if (!bdcResult) return null;
  return {
    totalCompanies: bdcResult.TotalCompanies || 0,
    companiesWithSanctions: bdcResult.CompaniesWithSanctions || 0,
    companiesWithPep: bdcResult.CompaniesWithPep || 0,
  };
}
function buildEconomicGroupKycEvidence(data) {
  if (!data) return null;
  const parts = [];
  if (data.companiesWithSanctions) parts.push(`${data.companiesWithSanctions} empresas do grupo sancionadas`);
  if (data.companiesWithPep) parts.push(`${data.companiesWithPep} empresas do grupo com PEP`);
  return parts.length ? parts.join(' | ') : null;
}
module.exports = { normalizeEconomicGroupKyc, buildEconomicGroupKycEvidence };
