/**
 * analysisConfig.js — Configuração padrão de análise
 * Extraída do monolito index.js para reuso entre módulos
 * SYNC: manter idêntico a src/core/analysisPhases.js (frontend);
 * paridade garantida por src/core/analysisPhases.contract.test.js.
 */

const DEFAULT_ANALYSIS_CONFIG = {
    criminal: { enabled: true },
    labor: { enabled: true },
    warrant: { enabled: true },
    osint: { enabled: true },
    social: { enabled: true },
    digital: { enabled: true },
    conflictInterest: { enabled: true },
    // Fase automática (sem revisão do analista): consulta crédito/restrições via BDC.
    // Default OFF — habilitar por tenant gera custo BDC (~R$1,80/caso).
    creditRestriction: { enabled: false },
};

// Fases 100% automáticas: não têm etapa no wizard nem checklist e não podem
// ser exigidas na validação de conclude (casos criados antes do toggle
// não as têm em enabledPhases).
const AUTOMATIC_ANALYSIS_PHASES = ['creditRestriction'];

/**
 * Fases manuais habilitadas no tenant que estão ausentes do payload de conclude.
 * Fases automáticas nunca são exigidas.
 */
function computeMissingRequiredPhases(tenantAnalysisConfig = {}, payloadEnabledPhases = []) {
    const automatic = new Set(AUTOMATIC_ANALYSIS_PHASES);
    return Object.entries(tenantAnalysisConfig)
        .filter(([key, value]) => value?.enabled && !automatic.has(key))
        .map(([key]) => key)
        .filter((key) => !payloadEnabledPhases.includes(key));
}

module.exports = {
    DEFAULT_ANALYSIS_CONFIG,
    AUTOMATIC_ANALYSIS_PHASES,
    computeMissingRequiredPhases,
};
