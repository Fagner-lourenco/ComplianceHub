import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    isSeniorReviewerRole,
    resolveReviewGate,
} = require('./v2ReviewGate.cjs');
const { ROLES } = require('./v2Rbac.cjs');

describe('v2ReviewGate', () => {
    it('permite analyst aprovar caso operacional sem exigencia senior', () => {
        const gate = resolveReviewGate({
            actorRole: ROLES.ANALYST,
            moduleRuns: [{ moduleKey: 'identity_pf', status: 'completed_no_findings', reviewPolicy: 'operational_review' }],
            riskSignals: [],
            caseData: { finalVerdict: 'FIT' },
        });

        expect(gate.allowed).toBe(true);
        expect(gate.policyResult.reviewLevel).toBe('operational_review');
        expect(gate.policyResult.requiresSenior).toBe(false);
    });

    it('permite analyst aprovar caso que exige apenas revisao analitica', () => {
        const gate = resolveReviewGate({
            actorRole: ROLES.ANALYST,
            moduleRuns: [{ moduleKey: 'criminal', status: 'completed_with_findings', reviewPolicy: 'analytical_review' }],
            riskSignals: [{ severity: 'high', reason: 'Apontamento relevante' }],
            caseData: { finalVerdict: 'ATTENTION' },
        });

        expect(gate.allowed).toBe(true);
        expect(gate.policyResult.reviewLevel).toBe('analytical_review');
        expect(gate.policyResult.requiresSenior).toBe(false);
    });

    it('bloqueia analyst quando policy exige senior_approval por sinal critico', () => {
        const gate = resolveReviewGate({
            actorRole: ROLES.ANALYST,
            moduleRuns: [{ moduleKey: 'warrants', status: 'completed_with_findings', reviewPolicy: 'senior_approval_on_positive' }],
            riskSignals: [{ severity: 'critical', reason: 'Mandado ativo' }],
            caseData: { finalVerdict: 'NOT_RECOMMENDED' },
        });

        expect(gate.allowed).toBe(false);
        expect(gate.denialReasonCode).toBe('senior_approval_required');
        expect(gate.policyResult.reviewLevel).toBe('senior_approval');
        expect(gate.policyResult.requiresSenior).toBe(true);
    });

    it('permite senior_analyst concluir caso que exige senior_approval', () => {
        const gate = resolveReviewGate({
            actorRole: ROLES.SENIOR_ANALYST,
            moduleRuns: [{ moduleKey: 'warrants', status: 'completed_with_findings', reviewPolicy: 'senior_approval_on_positive' }],
            riskSignals: [{ severity: 'critical', reason: 'Mandado ativo' }],
            caseData: { finalVerdict: 'NOT_RECOMMENDED' },
        });

        expect(gate.allowed).toBe(true);
        expect(gate.policyResult.requiresSenior).toBe(true);
        expect(isSeniorReviewerRole(ROLES.SENIOR_ANALYST)).toBe(true);
    });

    it('nega role desconhecida mesmo em caso limpo', () => {
        const gate = resolveReviewGate({
            actorRole: 'unknown',
            moduleRuns: [],
            riskSignals: [],
            caseData: { finalVerdict: 'FIT' },
        });

        expect(gate.allowed).toBe(false);
        expect(gate.denialReasonCode).toBe('actor_not_ops');
    });
});
