import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    buildSeniorReviewRequestId,
    buildSeniorReviewRequest,
    isSeniorReviewApproved,
    resolveSeniorReviewDecision,
    summarizeSeniorReviewQueue,
} = require('./v2SeniorReviewQueue.cjs');

describe('v2SeniorReviewQueue', () => {
    it('gera id estavel por caso', () => {
        expect(buildSeniorReviewRequestId('case-1')).toBe('senior_case-1');
    });

    it('materializa request senior com motivos, sinais e modulos', () => {
        const request = buildSeniorReviewRequest({
            caseId: 'case-1',
            caseData: { tenantId: 'tenant-1', subjectId: 'subj-1', candidateName: 'Ana', productKey: 'dossier_pf_full' },
            policyResult: {
                reviewLevel: 'senior_approval',
                reasons: ['Sinal critico'],
                moduleReasons: [{ moduleKey: 'warrants', reviewLevel: 'senior_approval' }],
            },
            riskSignals: [{ id: 'sig-1', severity: 'critical', reason: 'Mandado ativo' }],
            moduleRuns: [{ moduleKey: 'warrants' }, { moduleKey: 'criminal' }],
            actor: { uid: 'analyst-1', email: 'a@example.com' },
            requestedAt: '2026-04-22T10:00:00.000Z',
        });

        expect(request).toMatchObject({
            id: 'senior_case-1',
            tenantId: 'tenant-1',
            caseId: 'case-1',
            subjectId: 'subj-1',
            status: 'pending',
            requestedBy: 'analyst-1',
            requiresSenior: true,
        });
        expect(request.reasons).toEqual(expect.arrayContaining(['Sinal critico', 'Mandado ativo']));
        expect(request.moduleKeys).toEqual(['warrants', 'criminal']);
        expect(request.riskSignalIds).toEqual(['sig-1']);
    });

    it('resolve aprovacao senior de forma explicita', () => {
        expect(isSeniorReviewApproved({ status: 'approved' })).toBe(true);
        expect(resolveSeniorReviewDecision({ status: 'rejected', resolvedBy: 'senior-1' })).toMatchObject({
            status: 'rejected',
            approved: false,
            final: true,
            resolvedBy: 'senior-1',
        });
    });

    it('resume fila por status', () => {
        expect(summarizeSeniorReviewQueue([
            { status: 'pending' },
            { status: 'pending' },
            { status: 'approved' },
            { status: 'rejected' },
        ])).toMatchObject({ total: 4, pending: 2, approved: 1, rejected: 1 });
    });
});
