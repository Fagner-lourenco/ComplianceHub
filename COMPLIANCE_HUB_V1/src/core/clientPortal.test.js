import { describe, expect, it } from 'vitest';
import { buildCaseReportPath, getClientDashboardMetrics, getReportAvailability, resolveClientCaseView, sanitizeCaseForClient } from './clientPortal';
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

    it('sanitizeCaseForClient inclui todos os campos de PUBLIC_RESULT_FIELDS', () => {
        // REPORT-TEST-001: Garantir que PUBLIC_RESULT_FIELDS está sincronizado com backend
        const caseData = {
            id: 'CASE-TEST',
            status: 'DONE',
            candidateName: 'Teste',
            statusSummary: 'Resumo de status',
            sourceSummary: 'Fontes: Judit, Escavador',
            nextSteps: ['Prosseguir'],
            timelineEvents: [{ type: 'created', title: 'Criado' }],
            socialProfiles: { linkedin: 'https://linkedin.com/in/teste' },
            reportReady: true,
            reportSlug: 'teste-slug',
            concludedAt: '2026-05-04T10:00:00Z',
            turnaroundHours: 24,
        };

        const sanitized = sanitizeCaseForClient(caseData);

        expect(sanitized.statusSummary).toBe('Resumo de status');
        expect(sanitized.sourceSummary).toBe('Fontes: Judit, Escavador');
        expect(sanitized.nextSteps).toEqual(['Prosseguir']);
        expect(sanitized.timelineEvents).toEqual([{ type: 'created', title: 'Criado' }]);
        expect(sanitized.socialProfiles).toEqual({ linkedin: 'https://linkedin.com/in/teste' });
        expect(sanitized.reportReady).toBe(true);
        expect(sanitized.reportSlug).toBe('teste-slug');
        expect(sanitized.concludedAt).toBe('2026-05-04T10:00:00Z');
        expect(sanitized.turnaroundHours).toBe(24);
    });
});
