/**
 * Normalizer: BigDataCorp Historical Basic Data
 */

function normalizeHistoricalBasicData(bdcResult) {
  if (!bdcResult) return null;

  return {
    currentName: bdcResult.CurrentName || null,
    currentStatus: bdcResult.CurrentStatus || null,
    currentGender: bdcResult.CurrentGender || null,
    birthDate: bdcResult.BirthDate || null,
    age: bdcResult.Age || null,
    taxIdNumber: bdcResult.TaxIdNumber || null,
    hasObitIndication: bdcResult.HasObitIndication || false,
    nameChangeHistory: bdcResult.NameChangeHistory || [],
    statusChangeHistory: bdcResult.StatusChangeHistory || [],
    nameChangesTotal: bdcResult.NameChangesTotal || 0,
    statusChangesTotal: bdcResult.StatusChangesTotal || 0,
  };
}

function buildHistoricalBasicDataEvidence(data) {
  if (!data) return null;
  const parts = [];
  if (data.nameChangesTotal > 0) parts.push(`${data.nameChangesTotal} alteração(ões) de nome`);
  if (data.statusChangesTotal > 0) parts.push(`${data.statusChangesTotal} alteração(ões) de status`);
  if (data.hasObitIndication) parts.push('Indicação de óbito no histórico');
  return parts.length ? parts.join(' | ') : null;
}

module.exports = {
  normalizeHistoricalBasicData,
  buildHistoricalBasicDataEvidence,
};
