/**
 * Normalizer: BigDataCorp Lawsuits Distribution Data
 */

function normalizeLawsuitsDistribution(bdcResult) {
  if (!bdcResult) return null;

  return {
    totalLawsuits: bdcResult.TotalLawsuits || 0,
    typeDistribution: bdcResult.TypeDistribution || {},
    courtNameDistribution: bdcResult.CourtNameDistribution || {},
    statusDistribution: bdcResult.StatusDistribution || {},
    stateDistribution: bdcResult.StateDistribution || {},
    partyTypeDistribution: bdcResult.PartyTypeDistribution || {},
    courtTypeDistribution: bdcResult.CourtTypeDistribution || {},
    courtLevelDistribution: bdcResult.CourtLevelDistribution || {},
    cnjProcedureTypeDistribution: bdcResult.CnjProcedureTypeDistribution || {},
    cnjSubjectDistribution: bdcResult.CnjSubjectDistribution || {},
    cnjBroadSubjectDistribution: bdcResult.CnjBroadSubjectDistribution || {},
  };
}

function buildLawsuitsDistributionEvidence(dist) {
  if (!dist || dist.totalLawsuits === 0) return null;
  const parts = [`${dist.totalLawsuits} processos`];
  if (dist.courtTypeDistribution) {
    const types = Object.entries(dist.courtTypeDistribution)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    if (types) parts.push(types);
  }
  if (dist.statusDistribution) {
    const statuses = Object.entries(dist.statusDistribution)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    if (statuses) parts.push(statuses);
  }
  return parts.join(' | ');
}

module.exports = {
  normalizeLawsuitsDistribution,
  buildLawsuitsDistributionEvidence,
};
