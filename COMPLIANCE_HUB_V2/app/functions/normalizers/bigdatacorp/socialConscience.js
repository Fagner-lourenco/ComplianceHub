function normalizeSocialConscience(bdcResult) {
  if (!bdcResult) return null;
  return {
    score: bdcResult.Score || null,
    level: bdcResult.Level || null,
  };
}
function buildSocialConscienceEvidence(data) {
  if (!data || !data.score) return null;
  return `Consciência Social: ${data.score}`;
}
module.exports = { normalizeSocialConscience, buildSocialConscienceEvidence };
