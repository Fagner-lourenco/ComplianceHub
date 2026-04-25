/**
 * Normalizer: BigDataCorp Owners KYC (PJ)
 * Transforms BDC owners_kyc response into canonical shareholder compliance data.
 *
 * NOTE: owners_kyc can be very large (1+ MB for companies with many shareholders).
 * The adapter should apply a default limit(50) and expose pagination controls.
 */

/**
 * Normalize a single owner's KYC entry.
 * @param {object} owner
 * @returns {object|null}
 */
function normalizeOwner(owner) {
  if (!owner) return null;

  return {
    name: owner.Name || '',
    document: owner.TaxId || owner.Doc || '',
    documentType: (owner.TaxId || owner.Doc || '').length === 11 ? 'cpf' : 'cnpj',
    type: owner.Type || '',
    ownershipPercentage: owner.OwnershipPercentage || null,
    startDate: owner.StartDate || null,
    endDate: owner.EndDate || null,
    isActive: !owner.EndDate,
    kyc: {
      isCurrentlyPep: owner.IsCurrentlyPEP === true,
      isCurrentlySanctioned: owner.IsCurrentlySanctioned === true,
      wasPreviouslySanctioned: owner.WasPreviouslySanctioned === true,
      pepHistory: Array.isArray(owner.PEPHistory)
        ? owner.PEPHistory.map(p => ({
            level: p.Level || 0,
            organs: p.Organs || [],
            startDate: p.StartDate || null,
            endDate: p.EndDate || null,
          }))
        : [],
      sanctionsHistory: Array.isArray(owner.SanctionsHistory)
        ? owner.SanctionsHistory.map(s => ({
            source: s.Source || '',
            startDate: s.StartDate || null,
            endDate: s.EndDate || null,
          }))
        : [],
    },
  };
}

/**
 * Normalize owners KYC data.
 * @param {object} bdcResult — Result[0].OwnersKycData
 * @returns {object|null}
 */
function normalizeOwnersKyc(bdcResult) {
  if (!bdcResult) return null;

  const activeOwners = Array.isArray(bdcResult.ActiveOwners)
    ? bdcResult.ActiveOwners.map(normalizeOwner).filter(Boolean)
    : [];
  const inactiveOwners = Array.isArray(bdcResult.InactiveOwners)
    ? bdcResult.InactiveOwners.map(normalizeOwner).filter(Boolean)
    : [];

  const allOwners = [...activeOwners, ...inactiveOwners];
  const pepOwners = allOwners.filter(o => o.kyc.isCurrentlyPep || o.kyc.pepHistory.length > 0);
  const sanctionedOwners = allOwners.filter(o => o.kyc.isCurrentlySanctioned || o.kyc.wasPreviouslySanctioned);

  return {
    totalActive: bdcResult.TotalCurrentlyPEP || activeOwners.length,
    totalCurrentlyPep: bdcResult.TotalCurrentlyPEP || 0,
    totalCurrentlySanctioned: bdcResult.TotalCurrentlySanctioned || 0,
    totalHistoricallyPep: bdcResult.TotalHistoricallyPEP || 0,
    totalHistoricallySanctioned: bdcResult.TotalHistoricallySanctioned || 0,
    pepPercentage: bdcResult.PEPPercentage || 0,
    averageSanctionsPerOwner: bdcResult.AverageSanctionsPerOwner || 0,
    ownerMaxSanctions: bdcResult.OwnerMaxSanctions || 0,
    ownerMinSanctions: bdcResult.OwnerMinSanctions || 0,
    activeOwners,
    inactiveOwners,
    pepOwners,
    sanctionedOwners,
    // Raw aggregates for quick checks
    last30DaysSanctions: bdcResult.Last30DaysSanctions || 0,
    last90DaysSanctions: bdcResult.Last90DaysSanctions || 0,
    last180DaysSanctions: bdcResult.Last180DaysSanctions || 0,
    last365DaysSanctions: bdcResult.Last365DaysSanctions || 0,
    firstPepOccurenceDate: bdcResult.FirstPEPOccurenceDate || null,
    lastPepOccurenceDate: bdcResult.LastPEPOccurenceDate || null,
    firstSanctionDate: bdcResult.FirstSanctionDate || null,
    lastSanctionDate: bdcResult.LastSanctionDate || null,
  };
}

/**
 * Build an EvidenceItem content block from normalized owners KYC.
 * @param {object} normalized
 * @returns {object}
 */
function buildOwnersKycEvidenceContent(normalized) {
  if (!normalized) {
    return { text: 'Nenhum dado KYC de sócios encontrado.' };
  }

  const paragraphs = [];

  if (normalized.totalCurrentlyPep > 0) {
    paragraphs.push(`ALERTA: ${normalized.totalCurrentlyPep} sócio(s) atualmente classificado(s) como PEP.`);
  }
  if (normalized.totalCurrentlySanctioned > 0) {
    paragraphs.push(`ALERTA CRÍTICO: ${normalized.totalCurrentlySanctioned} sócio(s) com sanção(ões) ATIVA(S).`);
  }
  if (normalized.totalHistoricallySanctioned > 0 && normalized.totalCurrentlySanctioned === 0) {
    paragraphs.push(`${normalized.totalHistoricallySanctioned} sócio(s) com sanção(ões) histórica(s) (não ativas).`);
  }
  if (normalized.pepPercentage > 0) {
    paragraphs.push(`Percentual de PEPs entre sócios: ${(normalized.pepPercentage * 100).toFixed(1)}%.`);
  }

  return {
    text: paragraphs.join(' ') || 'Nenhum risco de compliance detectado entre os sócios.',
    summary: {
      totalCurrentlyPep: normalized.totalCurrentlyPep,
      totalCurrentlySanctioned: normalized.totalCurrentlySanctioned,
      totalHistoricallyPep: normalized.totalHistoricallyPep,
      totalHistoricallySanctioned: normalized.totalHistoricallySanctioned,
      pepPercentage: normalized.pepPercentage,
      averageSanctionsPerOwner: normalized.averageSanctionsPerOwner,
    },
    flaggedOwners: {
      pep: normalized.pepOwners.map(o => ({ name: o.name, document: o.document })),
      sanctioned: normalized.sanctionedOwners.map(o => ({ name: o.name, document: o.document })),
    },
    activeOwnersCount: normalized.activeOwners.length,
    inactiveOwnersCount: normalized.inactiveOwners.length,
  };
}

module.exports = {
  normalizeOwnersKyc,
  buildOwnersKycEvidenceContent,
  normalizeOwner,
};
