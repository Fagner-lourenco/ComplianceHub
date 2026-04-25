/**
 * Normalizer: BigDataCorp Processes
 * Transforms BDC processes response into canonical JudicialProcess array.
 */

const {
  normalizeProcessStatus,
  normalizePartyType,
  inferProcessArea,
  inferSegment,
  normalizeValue,
  formatValueBrl,
  extractCourtCode,
} = require('../../domain/v2NormalizationRules');

/**
 * Normalize a single BDC process.
 * @param {object} p — raw process from BDC
 * @returns {object} JudicialProcess
 */
function normalizeProcess(p) {
  if (!p) return null;

  // Extract parties
  const parties = p.Parties || [];
  const activeParty = parties.find(pt => pt.Type === 'Autor' || pt.Type === 'Requerente');
  const passiveParty = parties.find(pt => pt.Type === 'Réu' || pt.Type === 'Requerido');

  const relatedPeople = parties
    .filter(pt => pt.Doc && pt.Name)
    .map(pt => ({
      name: pt.Name,
      documentType: pt.Doc.length === 11 ? 'cpf' : 'cnpj',
      document: pt.Doc,
    }));

  // Extract movements
  const movements = (p.Movements || []).map(m => ({
    date: m.Date || null,
    description: m.Description || '',
  }));

  const valueCents = normalizeValue(p.Value);

  return {
    number: p.Number || '',
    className: p.ClassName || '',
    court: extractCourtCode(p.Court),
    courtUnit: p.CourtUnit || p.Vara || '',
    status: normalizeProcessStatus(p.Status),
    participation: normalizePartyType(p.PartyType),
    subject: p.Subject || '',
    area: inferProcessArea(p.ClassName, p.Subject),
    segment: inferSegment(p.Court),
    district: p.District || p.Comarca || '',
    distributionDate: p.DistributionDate || null,
    value: valueCents,
    valueFormatted: formatValueBrl(valueCents),
    link: p.Link || '',
    activeParty: activeParty?.Name || '',
    passiveParty: passiveParty?.Name || '',
    relatedPeople,
    movements,
    isSecret: p.IsSecret === true || p.Segredo === true,
    isMonitored: false,
  };
}

/**
 * Normalize all processes from BDC response.
 * @param {Array} bdcProcesses — Result[0].Processes
 * @param {object} [options]
 * @param {string} [options.subjectDocument] — CPF/CNPJ being queried (for match validation)
 * @returns {Array<JudicialProcess>}
 */
function normalizeProcesses(bdcProcesses) {
  if (!Array.isArray(bdcProcesses)) return [];

  return bdcProcesses
    .map(p => normalizeProcess(p))
    .filter(Boolean)
    .filter(() => {
      // Optional: filter out low-match-quality records
      // TODO: implement when BDC exposes MatchRate on processes
      return true;
    });
}

/**
 * Build an EvidenceItem of type 'process_list' from normalized processes.
 * @param {Array} processes
 * @returns {object} evidence content
 */
function buildProcessListEvidence(processes) {
  return {
    processes,
    totalCount: processes.length,
    summary: {
      byStatus: processes.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {}),
      byArea: processes.reduce((acc, p) => {
        acc[p.area] = (acc[p.area] || 0) + 1;
        return acc;
      }, {}),
      byParticipation: processes.reduce((acc, p) => {
        acc[p.participation] = (acc[p.participation] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

module.exports = {
  normalizeProcess,
  normalizeProcesses,
  buildProcessListEvidence,
};
