import { describe, expect, it } from 'vitest';
import {
    resolveReportModuleKeys,
    resolveReportSections,
    buildReportSnapshotFromV2,
} from './v2ReportSections.js';

describe('v2ReportSections', () => {
    it('caso PF basico inclui criminal e labor quando ha evidencias', () => {
        const moduleRuns = [
            { moduleKey: 'identity_pf', status: 'completed_with_findings', requested: true },
            { moduleKey: 'criminal', status: 'completed_with_findings', requested: true },
            { moduleKey: 'labor', status: 'completed_no_findings', requested: true },
            { moduleKey: 'decision', status: 'completed_no_findings', requested: false },
            { moduleKey: 'report_secure', status: 'completed_no_findings', requested: false },
        ];
        const evidenceItems = [
            { id: 'ev1', moduleKey: 'identity_pf' },
            { id: 'ev2', moduleKey: 'criminal' },
            { id: 'ev3', moduleKey: 'labor' },
        ];
        const riskSignals = [
            { id: 'rs1', moduleKey: 'criminal', kind: 'criminal_risk', severity: 'high', scoreImpact: 35, reason: 'Achado criminal' },
        ];

        const result = resolveReportSections({
            caseId: 'CASE-001',
            productKey: 'kye_employee',
            moduleRuns,
            evidenceItems,
            riskSignals,
        });

        expect(result.reportModuleKeys).toContain('identity_pf');
        expect(result.reportModuleKeys).toContain('criminal');
        expect(result.reportModuleKeys).toContain('labor');
        expect(result.sections.find((s) => s.sectionKey === 'identity')).toBeTruthy();
        expect(result.sections.find((s) => s.sectionKey === 'criminal')).toBeTruthy();
        expect(result.sections.find((s) => s.sectionKey === 'riskOverview')).toBeTruthy();
        expect(result.evidenceSetHash).toBeTruthy();
        expect(result.contentHash).toBeTruthy();
    });

    it('caso com sinal critico de mandado inclui warrants no relatorio', () => {
        const moduleRuns = [
            { moduleKey: 'identity_pf', status: 'completed_with_findings', requested: true },
            { moduleKey: 'warrants', status: 'completed_with_findings', requested: true },
            { moduleKey: 'decision', status: 'completed_no_findings', requested: false },
        ];
        const evidenceItems = [
            { id: 'ev1', moduleKey: 'identity_pf' },
            { id: 'ev2', moduleKey: 'warrants' },
        ];
        const riskSignals = [
            { id: 'rs1', moduleKey: 'warrants', kind: 'warrant_risk', severity: 'critical', scoreImpact: 50, reason: 'Mandado ativo' },
        ];

        const result = resolveReportSections({
            caseId: 'CASE-002',
            productKey: 'kyc_individual',
            moduleRuns,
            evidenceItems,
            riskSignals,
        });

        expect(result.reportModuleKeys).toContain('warrants');
        const warrantSection = result.sections.find((s) => s.sectionKey === 'warrants');
        expect(warrantSection).toBeTruthy();
        expect(warrantSection.signalCount).toBe(1);
    });

    it('modulo executado sem evidencias nao entra em reportModuleKeys', () => {
        const moduleRuns = [
            { moduleKey: 'identity_pf', status: 'completed_no_findings', requested: true },
            { moduleKey: 'osint', status: 'completed_no_findings', requested: true },
            { moduleKey: 'decision', status: 'completed_no_findings', requested: false },
        ];
        const evidenceItems = [{ id: 'ev1', moduleKey: 'identity_pf' }];

        const result = resolveReportSections({
            caseId: 'CASE-003',
            productKey: 'reputational_risk',
            moduleRuns,
            evidenceItems,
            riskSignals: [],
        });

        expect(result.reportModuleKeys).toContain('identity_pf');
        expect(result.reportModuleKeys).not.toContain('osint');
        expect(result.executedNoEvidenceKeys).toContain('osint');
    });

    it('sinal provider_divergence fica registrado em sectionContributions', () => {
        const moduleRuns = [
            { moduleKey: 'identity_pf', status: 'completed_with_findings', requested: true },
            { moduleKey: 'criminal', status: 'completed_with_findings', requested: true },
        ];
        const evidenceItems = [
            { id: 'ev1', moduleKey: 'identity_pf' },
            { id: 'ev2', moduleKey: 'criminal' },
        ];
        const riskSignals = [
            {
                id: 'rs1', moduleKey: 'criminal', kind: 'provider_divergence',
                severity: 'high', scoreImpact: 20, reason: 'Contagens de processos divergentes entre fontes',
                supportingEvidenceIds: ['ev2'],
            },
        ];

        const result = resolveReportSections({
            caseId: 'CASE-004',
            productKey: 'kye_employee',
            moduleRuns,
            evidenceItems,
            riskSignals,
        });

        expect(result.sectionContributions['criminal']).toBeTruthy();
        expect(result.sectionContributions['criminal'].signalIds).toContain('rs1');
        expect(result.sections.find((s) => s.sectionKey === 'criminal')).toBeTruthy();
    });

    it('buildReportSnapshotFromV2 produz payload compativel com ReportSnapshot', () => {
        const result = buildReportSnapshotFromV2({
            caseId: 'CASE-005',
            tenantId: 'tenant-abc',
            productKey: 'kye_employee',
            moduleRuns: [
                { moduleKey: 'identity_pf', status: 'completed_with_findings', requested: true },
                { moduleKey: 'criminal', status: 'completed_with_findings', requested: true },
            ],
            evidenceItems: [
                { id: 'ev1', moduleKey: 'identity_pf' },
                { id: 'ev2', moduleKey: 'criminal' },
            ],
            riskSignals: [],
            html: '<html>report</html>',
            builderVersion: 'v2-test',
        });

        expect(result.caseId).toBe('CASE-005');
        expect(result.tenantId).toBe('tenant-abc');
        expect(result.reportModuleKeys).toContain('identity_pf');
        expect(result.contentHash).toBeTruthy();
        expect(result.evidenceSetHash).toBeTruthy();
        expect(result.status).toBe('ready');
        expect(result.sections.length).toBeGreaterThan(0);
    });

    it('modulo pending nao entra em reportModuleKeys e fica em requestedButNotExecutedKeys', () => {
        const moduleRuns = [
            { moduleKey: 'identity_pf', status: 'completed_with_findings', requested: true },
            { moduleKey: 'criminal', status: 'pending', requested: true },
        ];
        const evidenceItems = [{ id: 'ev1', moduleKey: 'identity_pf' }];

        const result = resolveReportSections({
            caseId: 'CASE-006',
            productKey: 'kye_employee',
            moduleRuns,
            evidenceItems,
            riskSignals: [],
        });

        expect(result.reportModuleKeys).not.toContain('criminal');
        expect(result.requestedButNotExecutedKeys).toContain('criminal');
    });

    it('resolveReportModuleKeys sem moduleRuns e sem evidencias retorna apenas internos presentes', () => {
        const { reportModuleKeys } = resolveReportModuleKeys({
            moduleRuns: [],
            evidenceItems: [],
            riskSignals: [],
        });
        expect(reportModuleKeys).toHaveLength(0);
    });
});
