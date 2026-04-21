import { describe, expect, it } from 'vitest';
import {
    buildOperationalArtifactsForCase,
    buildProviderRequestsForCase,
} from './v2OperationalArtifacts.cjs';

describe('v2OperationalArtifacts', () => {
    it('materializa providerRequests idempotentes a partir das fontes reais legadas', () => {
        const caseData = {
            tenantId: 'tenant-1',
            subjectId: 'subject-1',
            productKey: 'dossier_pf_basic',
            bigdatacorpEnrichmentStatus: 'DONE',
            bigdatacorpSources: {
                basicData: { requestId: 'bdc-basic-1', cost: 0.03, consultedAt: '2026-04-21T12:00:00.000Z' },
                processes: { requestId: 'bdc-process-1', cost: 0.07, consultedAt: '2026-04-21T12:00:01.000Z' },
                kyc: { requestId: 'bdc-kyc-1', cost: 0.05, consultedAt: '2026-04-21T12:00:02.000Z' },
            },
        };

        const first = buildProviderRequestsForCase({ caseId: 'case-1', caseData });
        const second = buildProviderRequestsForCase({ caseId: 'case-1', caseData });

        expect(first.map((request) => request.id)).toEqual(second.map((request) => request.id));
        expect(first).toHaveLength(3);
        expect(first.find((request) => request.moduleKey === 'identity_pf')?.provider).toBe('bigdatacorp');
        expect(first.find((request) => request.moduleKey === 'judicial')?.datasets).toEqual(['processes']);
        expect(first.find((request) => request.moduleKey === 'kyc')?.idempotencyKey).toContain('bdc-kyc-1');
    });

    it('cria evidencias e riskSignals vinculados aos modulos corretos', () => {
        const artifacts = buildOperationalArtifactsForCase({
            caseId: 'case-2',
            caseData: {
                tenantId: 'tenant-1',
                subjectId: 'subject-1',
                productKey: 'dossier_pf_basic',
                candidateName: 'Maria Exemplo',
                bigdatacorpName: 'Maria Exemplo',
                bigdatacorpCpfStatus: 'REGULAR',
                bigdatacorpEnrichmentStatus: 'DONE',
                bigdatacorpSources: {
                    basicData: { requestId: 'bdc-basic-2' },
                    processes: { requestId: 'bdc-process-2' },
                    kyc: { requestId: 'bdc-kyc-2' },
                },
                criminalFlag: 'POSITIVE',
                juditCriminalCount: 2,
                warrantFlag: 'POSITIVE',
                juditActiveWarrantCount: 1,
                bigdatacorpIsPep: true,
            },
            moduleRuns: [
                { moduleKey: 'identity_pf' },
                { moduleKey: 'criminal' },
                { moduleKey: 'warrants' },
                { moduleKey: 'kyc' },
            ],
        });

        expect(artifacts.providerRequests.length).toBeGreaterThanOrEqual(3);
        expect(artifacts.evidenceItems.map((item) => item.moduleKey)).toContain('identity_pf');
        expect(artifacts.evidenceItems.map((item) => item.moduleKey)).toContain('criminal');
        expect(artifacts.evidenceItems.map((item) => item.moduleKey)).toContain('warrants');
        expect(artifacts.riskSignals.map((signal) => signal.kind)).toContain('criminal_risk');
        expect(artifacts.riskSignals.map((signal) => signal.kind)).toContain('warrant_risk');
        expect(artifacts.riskSignals.find((signal) => signal.kind === 'warrant_risk')?.severity).toBe('critical');
        expect(artifacts.artifactIdsByModule.warrants.riskSignalIds.length).toBe(1);
        expect(artifacts.summary.evidenceCount).toBe(4);
    });

    it('mantem signals preliminares sem promover decisao automatica', () => {
        const artifacts = buildOperationalArtifactsForCase({
            caseId: 'case-3',
            caseData: {
                tenantId: 'tenant-1',
                criminalFlag: 'NEGATIVE',
                laborFlag: 'POSITIVE',
                juditLaborCount: 3,
                juditSources: {
                    lawsuits: { requestId: 'judit-lawsuits-3' },
                },
            },
        });

        const laborSignal = artifacts.riskSignals.find((signal) => signal.moduleKey === 'labor');
        expect(laborSignal.status).toBe('preliminary');
        expect(laborSignal.reviewPolicyResult).toBe('review_if_used_in_decision');
        expect(laborSignal.supportingEvidenceIds.length).toBe(1);
    });
});
