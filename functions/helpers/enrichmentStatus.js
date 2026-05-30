/**
 * enrichmentStatus.js — Funções puras de status de enriquecimento
 * Extraídas do monolito index.js para reuso entre módulos
 */

function isSettledProviderStatus(status) {
    return status === 'DONE' || status === 'PARTIAL' || status === 'FAILED' || status === 'SKIPPED' || status === 'BLOCKED';
}

function isProviderTerminalForPipeline(status) {
    return ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED', 'BLOCKED'].includes(status);
}

function hasPendingJuditAsync(caseData = {}) {
    const count = Number(caseData.juditPendingAsyncCount || 0);
    const phases = Array.isArray(caseData.juditPendingAsyncPhases)
        ? caseData.juditPendingAsyncPhases.filter(Boolean)
        : [];
    return count > 0 || phases.length > 0;
}

function isJuditSettled(caseData = {}) {
    return isProviderTerminalForPipeline(caseData.juditEnrichmentStatus)
        && !hasPendingJuditAsync(caseData);
}

module.exports = {
    isSettledProviderStatus,
    isProviderTerminalForPipeline,
    hasPendingJuditAsync,
    isJuditSettled,
};
