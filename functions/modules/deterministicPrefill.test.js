/**
 * deterministicPrefill.test.js — Testes unitários para o módulo deterministicPrefill
 */

import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    buildDeterministicPrefill,
    evaluateComplexityTriggers,
    buildDetCriminalNotes,
    buildDetLaborNotes,
    buildDetWarrantNotes,
    buildDetKeyFindings,
    buildDetExecutiveSummary,
    buildDetFinalJustification,
} = require('./deterministicPrefill');

function buildMockCaseData(overrides = {}) {
    return {
        candidateName: 'Joao Silva',
        cpf: '12345678901',
        criminalFlag: 'NEGATIVE',
        laborFlag: 'NEGATIVE',
        warrantFlag: 'NEGATIVE',
        pepFlag: 'NEGATIVE',
        sanctionFlag: 'NEGATIVE',
        coverageLevel: 'FULL',
        providerDivergence: 'NONE',
        ...overrides,
    };
}

describe('deterministicPrefill', () => {
    describe('buildDetKeyFindings — alertas cadastrais', () => {
        it('inclui indicativo de obito nos keyFindings', () => {
            const findings = buildDetKeyFindings(buildMockCaseData({ bigdatacorpHasDeathRecord: true }));
            expect(findings.some((f) => /óbito/i.test(f))).toBe(true);
        });

        it('inclui CPF cancelado nos keyFindings', () => {
            const findings = buildDetKeyFindings(buildMockCaseData({ bigdatacorpCpfStatus: 'CANCELADA' }));
            expect(findings.some((f) => /CPF cancelado/i.test(f))).toBe(true);
        });

        it('inclui CPF suspenso nos keyFindings', () => {
            const findings = buildDetKeyFindings(buildMockCaseData({ bigdatacorpCpfStatus: 'SUSPENSA' }));
            expect(findings.some((f) => /CPF suspenso/i.test(f))).toBe(true);
        });

        it('nao inclui alerta cadastral para CPF regular sem obito', () => {
            const findings = buildDetKeyFindings(buildMockCaseData({ bigdatacorpCpfStatus: 'REGULAR' }));
            expect(findings.some((f) => /óbito|CPF cancelado|CPF suspenso/i.test(f))).toBe(false);
        });
    });

    describe('evaluateComplexityTriggers', () => {
        it('returns no triggers for clean negative case', () => {
            const caseData = buildMockCaseData();
            const result = evaluateComplexityTriggers(caseData);
            expect(result.isComplex).toBe(false);
            expect(result.triggersActive).toEqual([]);
        });

        it('detects REVIEW_RECOMMENDED', () => {
            const caseData = buildMockCaseData({ reviewRecommended: true });
            const result = evaluateComplexityTriggers(caseData);
            expect(result.triggersActive).toContain('REVIEW_RECOMMENDED');
            expect(result.isComplex).toBe(true);
        });

        it('detects HOMONYM_AMBIGUITY', () => {
            const caseData = buildMockCaseData({ ambiguityNotes: ['possivel homonimia'] });
            const result = evaluateComplexityTriggers(caseData);
            expect(result.triggersActive).toContain('HOMONYM_AMBIGUITY');
        });

        it('detects LOW_COVERAGE', () => {
            const caseData = buildMockCaseData({ coverageLevel: 'LOW_COVERAGE' });
            const result = evaluateComplexityTriggers(caseData);
            expect(result.triggersActive).toContain('LOW_COVERAGE');
        });

        it('ignores LOW_COVERAGE for benign no-process negative', () => {
            const caseData = buildMockCaseData({
                criminalFlag: 'NEGATIVE',
                coverageLevel: 'LOW_COVERAGE',
                coverageNotes: ['nenhum provider retornou processo aproveitavel'],
            });
            const result = evaluateComplexityTriggers(caseData);
            expect(result.triggersActive).not.toContain('LOW_COVERAGE');
        });
    });

    describe('buildDeterministicPrefill', () => {
        it('returns all required fields', () => {
            const caseData = buildMockCaseData();
            const result = buildDeterministicPrefill(caseData);
            expect(result).toHaveProperty('executiveSummary');
            expect(result).toHaveProperty('criminalNotes');
            expect(result).toHaveProperty('laborNotes');
            expect(result).toHaveProperty('warrantNotes');
            expect(result).toHaveProperty('keyFindings');
            expect(result).toHaveProperty('finalJustification');
            expect(result).toHaveProperty('metadata');
            expect(result.metadata.source).toBe('deterministic');
            expect(result.metadata.version).toBe('v5-deterministic-prefill');
            expect(Array.isArray(result.metadata.triggersActive)).toBe(true);
        });

        it('includes criminal notes for POSITIVE flag', () => {
            const caseData = buildMockCaseData({ criminalFlag: 'POSITIVE' });
            const result = buildDeterministicPrefill(caseData);
            expect(result.criminalNotes).toBeTruthy();
        });
    });

    describe('buildDetCriminalNotes', () => {
        it('returns safe negative text for NEGATIVE flag', () => {
            const caseData = buildMockCaseData({ criminalFlag: 'NEGATIVE' });
            const result = buildDetCriminalNotes(caseData);
            expect(result).toContain('Nao foram identificados');
        });

        it('returns homonym message for INCONCLUSIVE with weak-name evidence', () => {
            const caseData = buildMockCaseData({ criminalFlag: 'INCONCLUSIVE', criminalEvidenceQuality: 'WEAK_NAME_ONLY' });
            const result = buildDetCriminalNotes(caseData);
            expect(result).toContain('homonímia');
        });

        it('handles POSITIVE with no processes gracefully', () => {
            const caseData = buildMockCaseData({ criminalFlag: 'POSITIVE' });
            const result = buildDetCriminalNotes(caseData);
            expect(typeof result).toBe('string');
        });
    });

    describe('buildDetLaborNotes', () => {
        it('returns safe negative text for NEGATIVE flag', () => {
            const caseData = buildMockCaseData({ laborFlag: 'NEGATIVE' });
            const result = buildDetLaborNotes(caseData);
            expect(result).toContain('Nao foram identificados');
        });

        it('returns inconclusive message', () => {
            const caseData = buildMockCaseData({ laborFlag: 'INCONCLUSIVE' });
            const result = buildDetLaborNotes(caseData);
            expect(result).toContain('inconclusivo');
        });
    });

    describe('buildDetWarrantNotes', () => {
        it('returns safe negative text for NEGATIVE flag', () => {
            const caseData = buildMockCaseData({ warrantFlag: 'NEGATIVE' });
            const result = buildDetWarrantNotes(caseData);
            expect(result).toContain('Nenhum mandado');
        });

        it('handles POSITIVE with no warrant data', () => {
            const caseData = buildMockCaseData({ warrantFlag: 'POSITIVE' });
            const result = buildDetWarrantNotes(caseData);
            expect(typeof result).toBe('string');
        });
    });

    describe('buildDetKeyFindings', () => {
        it('returns array of findings', () => {
            const caseData = buildMockCaseData();
            const result = buildDetKeyFindings(caseData);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeLessThanOrEqual(7);
        });

        it('includes PEP finding when flag is POSITIVE', () => {
            const caseData = buildMockCaseData({ pepFlag: 'POSITIVE' });
            const result = buildDetKeyFindings(caseData);
            expect(result.some((f) => f.includes('PEP'))).toBe(true);
        });
    });

    describe('buildDetExecutiveSummary', () => {
        it('returns a string summary', () => {
            const caseData = buildMockCaseData();
            const result = buildDetExecutiveSummary(caseData);
            expect(typeof result).toBe('string');
        });
    });

    describe('buildDetFinalJustification', () => {
        it('returns FIT verdict for clean case', () => {
            const caseData = buildMockCaseData();
            const result = buildDetFinalJustification(caseData);
            expect(result).toContain('impeditivos materiais');
        });

        it('returns NOT_RECOMMENDED for criminal POSITIVE', () => {
            const caseData = buildMockCaseData({ criminalFlag: 'POSITIVE' });
            const result = buildDetFinalJustification(caseData);
            expect(result).toContain('risco elevado');
        });
    });
});
