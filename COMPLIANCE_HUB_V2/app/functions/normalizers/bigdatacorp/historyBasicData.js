function normalizeHistoryBasicData(bdcResult) {
  if (!bdcResult) return null;
  return {
    currentName: bdcResult.CurrentName || null,
    currentStatus: bdcResult.CurrentStatus || null,
    statusChangeHistory: bdcResult.StatusChangeHistory || [],
    nameChangeHistory: bdcResult.NameChangeHistory || [],
    statusChangesTotal: bdcResult.StatusChangesTotal || 0,
    nameChangesTotal: bdcResult.NameChangesTotal || 0,
  };
}
function buildHistoryBasicDataEvidence(data) {
  if (!data) return null;
  const parts = [];
  if (data.nameChangesTotal > 0) parts.push(`${data.nameChangesTotal} alterações de nome`);
  if (data.statusChangesTotal > 0) parts.push(`${data.statusChangesTotal} alterações de status`);
  return parts.length ? parts.join(' | ') : null;
}
module.exports = { normalizeHistoryBasicData, buildHistoryBasicDataEvidence };
