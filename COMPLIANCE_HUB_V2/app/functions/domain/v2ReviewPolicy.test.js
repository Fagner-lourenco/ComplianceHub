import { describe, expect, it } from 'vitest';
import {
    resolveReviewPolicyForCase,
    requiresSeniorApproval,
    resolveModuleReviewLevel,
    resolveSignalReviewLevel,
    maxPolicyLevel,
    V2_REVIEW_POLICY_VERSION,
} from './v2ReviewPolicy.js';

describe('v2ReviewPolicy — maxPolicyLevel', () => {
    it('retorna none para array vazio', () => {
        expect(maxPolicyLevel([])).toBe('none');
    });

    it('retorna o nivel mais alto', () => {
        expect(maxPolicyLevel(['operational_review', 'senior_approval', 'analytical_review'])).toBe('senior_approval');
    });

    it('ignora valores nulos/undefined', () => {
        expect(maxPolicyLevel([null, undefined, 'analytical_review'])).toBe('analytical_review');
    });
});

describe('v2ReviewPolicy — resolveModuleReviewLevel', () => {
    it('retorna none para moduleRun nulo', () => {
        expect(resolveModuleReviewLevel(null)).toBe('none');
    });

    it('senior_approval para policy senior_approval independente de status', () => {
        expect(resolveModuleReviewLevel({ moduleKey: 'judicial', status: 'pending', reviewPolicy: 'senior_approval' })).toBe('senior_approval');
        expect(resolveModuleReviewLevel({ moduleKey: 'judicial', status: 'completed_no_findings', reviewPolicy: 'senior_approval' })).toBe('senior_approval');
    });

    it('senior_approval para policy human_review_required', () => {
        expect(resolveModuleReviewLevel({ moduleKey: 'x', status: 'pending', reviewPolicy: 'human_review_required' })).toBe('senior_approval');
    });

    it('senior_approval para senior_approval_on_positive apenas quando positivo', () => {
        const runPositive = { moduleKey: 'criminal', status: 'completed_with_findings', reviewPolicy: 'senior_approval_on_positive' };
        const runNeutral = { moduleKey: 'criminal', status: 'completed_no_findings', reviewPolicy: 'senior_approval_on_positive' };
        expect(resolveModuleReviewLevel(runPositive)).toBe('senior_approval');
        expect(resolveModuleReviewLevel(runNeutral)).toBe('none');
    });

    it('analytical_review para analytical_review_on_positive apenas quando positivo', () => {
        const runPositive = { moduleKey: 'labor', status: 'completed_with_findings', reviewPolicy: 'analytical_review_on_positive' };
        const runNeutral = { moduleKey: 'labor', status: 'pending', reviewPolicy: 'analytical_review_on_positive' };
        expect(resolveModuleReviewLevel(runPositive)).toBe('analytical_review');
        expect(resolveModuleReviewLevel(runNeutral)).toBe('analytical_review');
    });

    it('analytical_review para policy analytical_review', () => {
        expect(resolveModuleReviewLevel({ moduleKey: 'osint', status: 'pending', reviewPolicy: 'analytical_review' })).toBe('analytical_review');
    });

    it('operational_review para policy operational_review', () => {
        expect(resolveModuleReviewLevel({ moduleKey: 'identity_pf', status: 'pending', reviewPolicy: 'operational_review' })).toBe('operational_review');
    });

    it('policy do contrato prevalece sobre policy do moduleRun', () => {
        const run = { moduleKey: 'identity_pf', status: 'pending', reviewPolicy: 'operational_review' };
        const contract = { reviewPolicy: 'senior_approval' };
        expect(resolveModuleReviewLevel(run, contract)).toBe('senior_approval');
    });

    it('usa policy do moduleRun quando contrato nao tem reviewPolicy', () => {
        const run = { moduleKey: 'identity_pf', status: 'pending', reviewPolicy: 'analytical_review' };
        expect(resolveModuleReviewLevel(run, {})).toBe('analytical_review');
    });
});

describe('v2ReviewPolicy — resolveSignalReviewLevel', () => {
    it('retorna none sem sinais', () => {
        expect(resolveSignalReviewLevel([])).toBe('none');
    });

    it('senior_approval para sinal critical', () => {
        expect(resolveSignalReviewLevel([{ severity: 'critical', reason: 'Mandado de prisao' }])).toBe('senior_approval');
    });

    it('analytical_review para sinal high', () => {
        expect(resolveSignalReviewLevel([{ severity: 'high', reason: 'Processos cíveis' }])).toBe('analytical_review');
    });

    it('none para sinal medium ou low', () => {
        expect(resolveSignalReviewLevel([{ severity: 'medium' }, { severity: 'low' }])).toBe('none');
    });

    it('critical prevalece sobre high', () => {
        const signals = [{ severity: 'high' }, { severity: 'critical' }, { severity: 'medium' }];
        expect(resolveSignalReviewLevel(signals)).toBe('senior_approval');
    });
});

describe('v2ReviewPolicy — resolveReviewPolicyForCase', () => {
    it('retorna operational_review para caso vazio', () => {
        const result = resolveReviewPolicyForCase({});
        expect(result.reviewLevel).toBe('operational_review');
        expect(result.requiresSenior).toBe(false);
        expect(result.policyVersion).toBe(V2_REVIEW_POLICY_VERSION);
    });

    it('escalona para senior por sinal critical', () => {
        const result = resolveReviewPolicyForCase({
            riskSignals: [{ id: 's1', severity: 'critical', reason: 'Mandado ativo' }],
        });
        expect(result.reviewLevel).toBe('senior_approval');
        expect(result.requiresSenior).toBe(true);
        expect(result.reasons.some((r) => r.includes('critico'))).toBe(true);
    });

    it('escalona para analytical_review por sinal high', () => {
        const result = resolveReviewPolicyForCase({
            riskSignals: [{ id: 's1', severity: 'high', reason: 'Processos trabalhistas' }],
        });
        expect(result.reviewLevel).toBe('analytical_review');
        expect(result.requiresSenior).toBe(false);
    });

    it('escalona por modulo com senior_approval policy', () => {
        const result = resolveReviewPolicyForCase({
            moduleRuns: [
                { moduleKey: 'judicial', status: 'completed_with_findings', reviewPolicy: 'senior_approval' },
            ],
        });
        expect(result.reviewLevel).toBe('senior_approval');
        expect(result.requiresSenior).toBe(true);
        expect(result.reasons.some((r) => r.includes('judicial'))).toBe(true);
    });

    it('escalona por veredito NOT_RECOMMENDED', () => {
        const result = resolveReviewPolicyForCase({
            caseData: { finalVerdict: 'NOT_RECOMMENDED' },
        });
        expect(result.reviewLevel).toBe('senior_approval');
        expect(result.requiresSenior).toBe(true);
        expect(result.reasons.some((r) => r.includes('NOT_RECOMMENDED'))).toBe(true);
    });

    it('escalona por veredito REJECTED', () => {
        const result = resolveReviewPolicyForCase({
            caseData: { verdict: 'REJECTED' },
        });
        expect(result.requiresSenior).toBe(true);
    });

    it('usa moduleRegistry quando fornecido', () => {
        const registry = {
            criminal: { reviewPolicy: 'senior_approval_on_positive' },
        };
        const resultPositive = resolveReviewPolicyForCase({
            moduleRuns: [{ moduleKey: 'criminal', status: 'completed_with_findings' }],
            moduleRegistry: registry,
        });
        expect(resultPositive.reviewLevel).toBe('senior_approval');

        const resultNegative = resolveReviewPolicyForCase({
            moduleRuns: [{ moduleKey: 'criminal', status: 'completed_no_findings' }],
            moduleRegistry: registry,
        });
        // Nenhum modulo eleva o nivel; piso do caso e operational_review
        expect(resultNegative.reviewLevel).toBe('operational_review');
    });

    it('combina multiplas fontes e retorna o nivel mais alto', () => {
        const result = resolveReviewPolicyForCase({
            moduleRuns: [{ moduleKey: 'labor', status: 'pending', reviewPolicy: 'analytical_review' }],
            riskSignals: [{ severity: 'critical' }],
        });
        expect(result.reviewLevel).toBe('senior_approval');
    });
});

describe('v2ReviewPolicy — requiresSeniorApproval', () => {
    it('retorna false para caso limpo', () => {
        expect(requiresSeniorApproval({})).toBe(false);
    });

    it('retorna true para sinal critical', () => {
        expect(requiresSeniorApproval({ riskSignals: [{ severity: 'critical' }] })).toBe(true);
    });

    it('retorna false para sinal high (apenas analytical)', () => {
        expect(requiresSeniorApproval({ riskSignals: [{ severity: 'high' }] })).toBe(false);
    });

    it('retorna true para veredito negativo', () => {
        expect(requiresSeniorApproval({ caseData: { finalVerdict: 'NOT_RECOMMENDED' } })).toBe(true);
    });
});
