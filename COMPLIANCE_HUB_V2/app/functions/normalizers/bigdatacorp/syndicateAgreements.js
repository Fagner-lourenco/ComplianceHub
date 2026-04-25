function normalizeSyndicateAgreements(bdcResult) {
  if (!bdcResult) return null;
  return {
    agreements: bdcResult.Agreements || [],
    totalAgreements: bdcResult.TotalAgreements || 0,
  };
}
function buildSyndicateAgreementsEvidence(data) {
  if (!data || !data.totalAgreements) return null;
  return `${data.totalAgreements} acordo(s) sindical`;
}
module.exports = { normalizeSyndicateAgreements, buildSyndicateAgreementsEvidence };
