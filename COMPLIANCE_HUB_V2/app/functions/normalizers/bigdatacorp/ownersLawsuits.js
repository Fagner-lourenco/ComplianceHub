function normalizeOwnersLawsuits(bdcResult) {
  if (!bdcResult) return null;
  return {
    lawsuits: bdcResult.Lawsuits || [],
    totalLawsuits: bdcResult.TotalLawsuits || 0,
    ownersWithLawsuits: bdcResult.OwnersWithLawsuits || 0,
  };
}
function buildOwnersLawsuitsEvidence(data) {
  if (!data || !data.totalLawsuits) return null;
  return `${data.totalLawsuits} processos de sócios`;
}
module.exports = { normalizeOwnersLawsuits, buildOwnersLawsuitsEvidence };
