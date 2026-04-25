import { describe, expect, it } from 'vitest';
import {
    buildClientProjectionContract,
    buildDecisionContract,
    buildReportSnapshotContract,
    resolvePublicReportAvailability,
    validatePublicationGates,
} from './v2Core.js';

describe('v2Core contracts', () => {
    const caseData = {
        tenantId: 'tenant-1',
        caseId: 'case-1',
        candidateName: 'Maria Compliance',
        cpfMasked: '123.***.***-00',
        status: 'DONE',
        enabledPhases: ['criminal', 'labor', 'warrant'],
        finalVerdict: 'FIT',
        riskScore: 12,
        riskLevel: 'LOW',
    };

    const publicResult = {
        candidateName: 'Maria Compliance',
        cpfMasked: '123.***.***-00',
        finalVerdict: 'FIT',
        riskScore: 12,
        riskLevel: 'LOW',
        executiveSummary: 'Analise concluida sem apontamentos criticos.',
        keyFindings: ['Sem mandados ativos identificados.'],
        reportSlug: 'CH-case-1',
    };

    it('gera Decision aprovada com hash de evidencia deterministico', () => {
        const decision = buildDecisionContract({
            caseId: 'case-1',
            caseData,
            publicResult,
            reviewer: { uid: 'analyst-1' },
        });

        expect(decision.status).toBe('approved');
        expect(decision.productKey).toBe('dossier_pf_basic');
        expect(decision.moduleKeys).toContain('warrants');
        expect(decision.evidenceSetHash).toHaveLength(64);
        expect(decision.approvedBy).toBe('analyst-1');
    });

    it('bloqueia availability sem PublicReport publicado', () => {
        const decision = { id: 'dec-1', status: 'approved' };
        const reportSnapshot = { id: 'snap-1', status: 'ready' };

        const availability = resolvePublicReportAvailability({ decision, reportSnapshot });

        expect(availability.status).toBe('generating');
        expect(availability.reasonCode).toBe('public_report_missing');
        expect(availability.isActionable).toBe(false);
    });

    it('libera availability apenas com decision, snapshot e token coerentes', () => {
        const decision = { id: 'dec-1', status: 'approved' };
        const reportSnapshot = { id: 'snap-1', status: 'ready' };
        const publicReport = {
            id: 'token-1',
            token: 'token-1',
            active: true,
            status: 'ready',
            reportSnapshotId: 'snap-1',
            expiresAt: new Date(Date.now() + 3600_000),
        };

        const availability = resolvePublicReportAvailability({ decision, reportSnapshot, publicReport });

        expect(availability.status).toBe('ready');
        expect(availability.publicReportToken).toBe('token-1');
        expect(availability.isActionable).toBe(true);
    });

    it('gera ReportSnapshot e ClientProjection cliente-safe', () => {
        const decision = {
            id: 'dec-1',
            status: 'approved',
            verdict: 'FIT',
            riskScore: 12,
            riskLevel: 'LOW',
            evidenceSetHash: 'hash-1',
        };
        const reportSnapshot = buildReportSnapshotContract({
            caseId: 'case-1',
            caseData,
            publicResult,
            decision,
            html: '<html>ok</html>',
            builderVersion: 'test-builder',
            createdBy: 'analyst-1',
        });
        const gates = validatePublicationGates({ decision, reportSnapshot, html: '<html>ok</html>' });
        const availability = resolvePublicReportAvailability({
            decision,
            reportSnapshot: { ...reportSnapshot, id: 'snap-1' },
            publicReport: { id: 'token-1', active: true, status: 'ready', reportSnapshotId: 'snap-1' },
        });
        const projection = buildClientProjectionContract({
            caseId: 'case-1',
            caseData,
            publicResult,
            decision,
            reportSnapshot: { ...reportSnapshot, id: 'snap-1' },
            availability,
        });

        expect(reportSnapshot.status).toBe('ready');
        expect(reportSnapshot.clientSafeData.executiveSummary).toBe(publicResult.executiveSummary);
        expect(gates.ok).toBe(true);
        expect(projection.reportAvailability.status).toBe('ready');
        expect(projection.publicReportToken).toBe('token-1');
    });

    it('mantem modulos internos fora da lista comercial do cliente', () => {
        const projection = buildClientProjectionContract({
            caseId: 'case-1',
            caseData: {
                ...caseData,
                requestedModuleKeys: ['criminal', 'warrant'],
                effectiveModuleKeys: ['identity_pf', 'criminal', 'warrants', 'decision', 'report_secure'],
            },
            publicResult,
            decision: { id: 'dec-1', status: 'approved' },
            reportSnapshot: { id: 'snap-1' },
            availability: { status: 'ready', publicReportToken: 'token-1' },
        });

        const moduleKeys = projection.commercialModules.map((module) => module.moduleKey);
        expect(moduleKeys).toEqual(['criminal', 'warrants']);
        expect(moduleKeys).not.toContain('decision');
        expect(moduleKeys).not.toContain('report_secure');
    });

    it('resolvePublicReportAvailability retorna revoked quando token expirado', () => {
        const decision = { id: 'dec-1', status: 'approved' };
        const reportSnapshot = { id: 'snap-1', status: 'ready' };
        const publicReport = {
            id: 'token-1',
            token: 'token-1',
            active: true,
            status: 'ready',
            reportSnapshotId: 'snap-1',
            expiresAt: new Date(Date.now() - 3600_000),
        };

        const availability = resolvePublicReportAvailability({ decision, reportSnapshot, publicReport });
        expect(availability.status).toBe('revoked');
        expect(availability.isActionable).toBe(false);
    });

    it('validatePublicationGates rejeita quando decision nao e approved', () => {
        const gates = validatePublicationGates({
            decision: { status: 'rejected' },
            reportSnapshot: { status: 'ready' },
            html: '<html>ok</html>',
        });
        expect(gates.ok).toBe(false);
    });

    it('validatePublicationGates rejeita quando html vazio', () => {
        const gates = validatePublicationGates({
            decision: { status: 'approved' },
            reportSnapshot: { status: 'ready' },
            html: '',
        });
        expect(gates.ok).toBe(false);
    });

    it('buildDecisionContract reflete verdict do publicResult no decisionBasis', () => {
        const decision = buildDecisionContract({
            caseId: 'case-1',
            caseData: { ...caseData, finalVerdict: 'NOT_RECOMMENDED' },
            publicResult: { ...publicResult, finalVerdict: 'NOT_RECOMMENDED' },
            reviewer: { uid: 'analyst-1' },
        });
        expect(decision.verdict).toBe('NOT_RECOMMENDED');
    });
});
