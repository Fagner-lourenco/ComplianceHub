/**
 * Provider enrichment status helpers.
 */

function isDoneOrPartial(status) {
    return status === 'DONE' || status === 'PARTIAL';
}

function isSettledProviderStatus(status) {
    return status === 'DONE' || status === 'PARTIAL' || status === 'FAILED' || status === 'SKIPPED' || status === 'BLOCKED';
}

function getAiProvidersIncluded(caseData) {
    return [
        isDoneOrPartial(caseData.enrichmentStatus) ? 'FonteData' : null,
        isDoneOrPartial(caseData.escavadorEnrichmentStatus) ? 'Escavador' : null,
        isDoneOrPartial(caseData.juditEnrichmentStatus) ? 'Judit' : null,
        isDoneOrPartial(caseData.bigdatacorpEnrichmentStatus) ? 'BigDataCorp' : null,
    ].filter(Boolean);
}

module.exports = {
    isDoneOrPartial,
    isSettledProviderStatus,
    getAiProvidersIncluded,
};
