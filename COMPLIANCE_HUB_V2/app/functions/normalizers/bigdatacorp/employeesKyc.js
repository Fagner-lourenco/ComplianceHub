function normalizeEmployeesKyc(bdcResult) {
  if (!bdcResult) return null;
  return {
    totalEmployees: bdcResult.TotalEmployees || 0,
    employeesWithSanctions: bdcResult.EmployeesWithSanctions || 0,
    employeesWithPep: bdcResult.EmployeesWithPep || 0,
  };
}
function buildEmployeesKycEvidence(data) {
  if (!data) return null;
  const parts = [];
  if (data.employeesWithSanctions) parts.push(`${data.employeesWithSanctions} funcionários sancionados`);
  if (data.employeesWithPep) parts.push(`${data.employeesWithPep} funcionários PEP`);
  return parts.length ? parts.join(' | ') : null;
}
module.exports = { normalizeEmployeesKyc, buildEmployeesKycEvidence };
