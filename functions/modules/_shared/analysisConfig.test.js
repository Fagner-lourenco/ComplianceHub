/**
 * analysisConfig.test.js — fases de análise: defaults, fases automáticas e validação de conclude
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    DEFAULT_ANALYSIS_CONFIG,
    AUTOMATIC_ANALYSIS_PHASES,
    computeMissingRequiredPhases,
} = require('./analysisConfig');

describe('DEFAULT_ANALYSIS_CONFIG', () => {
    it('contem creditRestriction desabilitada por padrao', () => {
        expect(DEFAULT_ANALYSIS_CONFIG.creditRestriction).toEqual({ enabled: false });
    });

    it('mantem as 7 fases manuais habilitadas por padrao', () => {
        for (const key of ['criminal', 'labor', 'warrant', 'osint', 'social', 'digital', 'conflictInterest']) {
            expect(DEFAULT_ANALYSIS_CONFIG[key]).toEqual({ enabled: true });
        }
    });
});

describe('AUTOMATIC_ANALYSIS_PHASES', () => {
    it('inclui creditRestriction', () => {
        expect(AUTOMATIC_ANALYSIS_PHASES).toContain('creditRestriction');
    });
});

describe('computeMissingRequiredPhases', () => {
    it('exige fases manuais habilitadas ausentes no payload', () => {
        const tenantConfig = { criminal: { enabled: true }, labor: { enabled: true } };
        expect(computeMissingRequiredPhases(tenantConfig, ['labor'])).toEqual(['criminal']);
    });

    it('nao exige fases automaticas (creditRestriction) mesmo habilitadas', () => {
        const tenantConfig = { criminal: { enabled: true }, creditRestriction: { enabled: true } };
        expect(computeMissingRequiredPhases(tenantConfig, ['criminal'])).toEqual([]);
    });

    it('ignora fases desabilitadas', () => {
        const tenantConfig = { criminal: { enabled: true }, social: { enabled: false } };
        expect(computeMissingRequiredPhases(tenantConfig, ['criminal'])).toEqual([]);
    });
});
