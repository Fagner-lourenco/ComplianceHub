/**
 * analysisConfig.js — Configuração padrão de análise
 * Extraída do monolito index.js para reuso entre módulos
 */

const DEFAULT_ANALYSIS_CONFIG = {
    criminal: { enabled: true },
    labor: { enabled: true },
    warrant: { enabled: true },
    osint: { enabled: true },
    social: { enabled: true },
    digital: { enabled: true },
    conflictInterest: { enabled: true },
};

module.exports = {
    DEFAULT_ANALYSIS_CONFIG,
};
