function normalizeDynamicQsa(bdcResult) {
  if (!bdcResult) return null;
  return {
    qsa: bdcResult.QSA || [],
    lastUpdateDate: bdcResult.LastUpdateDate || null,
    totalPartners: bdcResult.TotalPartners || 0,
  };
}
function buildDynamicQsaEvidence(data) {
  if (!data || !data.totalPartners) return null;
  return `${data.totalPartners} sócios (QSA dinâmico)`;
}
module.exports = { normalizeDynamicQsa, buildDynamicQsaEvidence };
