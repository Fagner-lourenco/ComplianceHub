/**
 * analysisPhases.js — Fases de análise por tenant (config padrão, labels e helpers).
 * Módulo sem dependências para permitir teste de contrato com o backend.
 * SYNC: manter DEFAULT_ANALYSIS_CONFIG idêntico a functions/modules/_shared/analysisConfig.js;
 * paridade garantida por analysisPhases.contract.test.js.
 */

export const DEFAULT_ANALYSIS_CONFIG = {
    criminal:         { enabled: true },
    labor:            { enabled: true },
    warrant:          { enabled: true },
    osint:            { enabled: true },
    social:           { enabled: true },
    digital:          { enabled: true },
    conflictInterest: { enabled: true },
    // Fase automática (sem revisão do analista): consulta crédito/restrições via BDC.
    // Default OFF — habilitar por tenant gera custo BDC (~R$1,80/caso).
    creditRestriction: { enabled: false },
};

export const ANALYSIS_PHASE_LABELS = {
    criminal:         'Análise criminal',
    labor:            'Trabalhista',
    warrant:          'Mandado de prisão',
    osint:            'Perfis públicos',
    social:           'Social',
    digital:          'Perfil digital',
    conflictInterest: 'Conflito de interesse',
    creditRestriction: 'Crédito e Restrições',
};

// Fases 100% automáticas: sem etapa no wizard, sem checklist, resultado vem do servidor.
export const AUTOMATIC_ANALYSIS_PHASES = ['creditRestriction'];

export function getEnabledPhases(analysisConfig) {
    return Object.entries(analysisConfig || DEFAULT_ANALYSIS_CONFIG)
        .filter(([, value]) => value?.enabled)
        .map(([key]) => key);
}
