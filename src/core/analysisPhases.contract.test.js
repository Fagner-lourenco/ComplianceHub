/**
 * analysisPhases.contract.test.js — garante paridade frontend/backend dos espelhos
 * manuais de DEFAULT_ANALYSIS_CONFIG (firestoreService x functions/_shared/analysisConfig).
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import {
    DEFAULT_ANALYSIS_CONFIG,
    ANALYSIS_PHASE_LABELS,
    getEnabledPhases,
} from './analysisPhases';

const require = createRequire(import.meta.url);
const backend = require('../../functions/modules/_shared/analysisConfig');

describe('contrato frontend/backend — DEFAULT_ANALYSIS_CONFIG', () => {
    it('mesmas chaves nos dois lados', () => {
        expect(Object.keys(DEFAULT_ANALYSIS_CONFIG).sort())
            .toEqual(Object.keys(backend.DEFAULT_ANALYSIS_CONFIG).sort());
    });

    it('mesmos flags enabled nos dois lados', () => {
        for (const [key, value] of Object.entries(DEFAULT_ANALYSIS_CONFIG)) {
            expect(backend.DEFAULT_ANALYSIS_CONFIG[key]?.enabled, `fase ${key}`).toBe(value.enabled);
        }
    });

    it('toda fase tem label', () => {
        for (const key of Object.keys(DEFAULT_ANALYSIS_CONFIG)) {
            expect(typeof ANALYSIS_PHASE_LABELS[key], `label de ${key}`).toBe('string');
        }
    });
});

describe('creditRestriction (fase automática)', () => {
    it('desabilitada por padrao no frontend', () => {
        expect(DEFAULT_ANALYSIS_CONFIG.creditRestriction).toEqual({ enabled: false });
    });

    it('tem label Crédito e Restrições', () => {
        expect(ANALYSIS_PHASE_LABELS.creditRestriction).toBe('Crédito e Restrições');
    });

    it('getEnabledPhases exclui creditRestriction por padrao', () => {
        expect(getEnabledPhases(DEFAULT_ANALYSIS_CONFIG)).not.toContain('creditRestriction');
    });

    it('getEnabledPhases inclui quando tenant habilita', () => {
        const config = { ...DEFAULT_ANALYSIS_CONFIG, creditRestriction: { enabled: true } };
        expect(getEnabledPhases(config)).toContain('creditRestriction');
    });
});
