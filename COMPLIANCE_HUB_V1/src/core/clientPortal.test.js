import { describe, expect, it } from 'vitest';
import { buildCaseReportPath, getClientDashboardMetrics, getReportAvailability, resolveClientCaseView } from './clientPortal';
import { getMockCaseById, MOCK_CASES } from '../data/mockData';

describe('clientPortal helpers', () => {
    it('usa fallback do mock sanitizado para casos concluidos sem publicResult real', () => {
        const caseData = getMockCaseById('CASE-002');
        const resolved = resolveClientCaseView(caseData, null);

        expect(resolved.finalVerdict).toBe('NOT_RECOMMENDED');
        expect(resolved.reportReady).toBe(true);
        expect(resolved.keyFindings.length).toBeGreaterThan(0);
        expect(buildCaseReportPath(caseData, true)).toBe('/demo/r/CASE-002');
    });

    it('calcula metricas do tenant demo com contagens corretas por status e veredito', () => {
        const tenantCases = MOCK_CASES.filter((caseData) => caseData.tenantId === 'TEN-001');
        const metrics = getClientDashboardMetrics(tenantCases);

        expect(metrics.total).toBe(8);
        expect(metrics.done).toBe(4);
        expect(metrics.inProgress).toBe(2);
        expect(metrics.pending).toBe(1);
        expect(metrics.corrections).toBe(1);
        expect(metrics.verdicts).toEqual({
            FIT: 1,
            ATTENTION: 1,
            NOT_RECOMMENDED: 2,
        });
        expect(getReportAvailability(getMockCaseById('CASE-003'), null).available).toBe(false);
        expect(getReportAvailability(getMockCaseById('CASE-001'), null).available).toBe(true);
    });

    it('preserva keyFindings do publicResult quando o espelho do clientCases ainda nao sincronizou', () => {
        const caseData = {
            id: 'CASE-777',
            status: 'DONE',
            candidateName: 'Caso de teste',
            keyFindings: [],
        };
        const publicResult = {
            keyFindings: ['Mandado ativo pendente de cumprimento.'],
        };

        const resolved = resolveClientCaseView(caseData, publicResult);

        expect(resolved.keyFindings).toEqual(['Mandado ativo pendente de cumprimento.']);
    });
});
