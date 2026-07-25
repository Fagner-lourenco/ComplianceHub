import { describe, expect, it } from 'vitest';
import { buildCaseReportHtml, buildBatchReportHtml } from '../core/reportBuilder';

describe('reportBuilder consistency', () => {
    const mockCaseData = {
        id: 'CASE-001',
        candidateName: 'João Silva',
        cpfMasked: '***.***.***-00',
        candidatePosition: 'Analista',
        tenantName: 'Empresa Teste',
        status: 'DONE',
        createdAt: '2026-05-01T10:00:00Z',
        criminalFlag: 'NEGATIVE',
        laborFlag: 'NEGATIVE',
        warrantFlag: 'NEGATIVE',
        osintLevel: 'LOW',
        socialStatus: 'APPROVED',
        digitalFlag: 'CLEAN',
        conflictInterest: 'NO',
        riskScore: 15,
        riskLevel: 'GREEN',
        finalVerdict: 'FIT',
        analystComment: 'Candidato aprovado sem ressalvas.',
        executiveSummary: 'Análise concluída com resultado positivo.',
        keyFindings: ['Nenhum impeditivo identificado'],
        nextSteps: ['Prosseguir com contratação'],
        enabledPhases: ['criminal', 'labor', 'warrant', 'osint', 'social', 'digital'],
    };

    it('buildCaseReportHtml gera HTML válido com dados mínimos', () => {
        const html = buildCaseReportHtml(mockCaseData);
        expect(html).toContain('João Silva');
        expect(html).toContain('Empresa Teste');
        expect(html).toContain('Recomendado');
        expect(html).toContain('Documento Confidencial');
    });

    it('buildCaseReportHtml inclui todas as seções quando dados disponíveis', () => {
        const html = buildCaseReportHtml(mockCaseData);
        expect(html).toContain('Identificação do Candidato');
        expect(html).toContain('Resultado da Análise de Risco');
        expect(html).toContain('Análises Realizadas');
        expect(html).toContain('Justificativa Final');
        expect(html).toContain('Próximos Passos');
    });

    it('buildCaseReportHtml usa publicResult como fonte primária', () => {
        // Simula dados enriquecidos (como viriam do backend)
        const enrichedData = {
            ...mockCaseData,
            email: 'joao@email.com',
            phone: '(11) 99999-9999',
            department: 'TI',
            sourceSummary: 'Fontes: Judit, Escavador, BigDataCorp',
            statusSummary: 'Análise concluída com sucesso',
        };

        const html = buildCaseReportHtml(enrichedData);
        expect(html).toContain('joao@email.com');
        expect(html).toContain('(11) 99999-9999');
        expect(html).toContain('TI');
    });

    it('buildBatchReportHtml gera relatório consolidado', () => {
        const cases = [mockCaseData, { ...mockCaseData, id: 'CASE-002', candidateName: 'Maria Santos' }];
        const html = buildBatchReportHtml(cases, 'Empresa Teste');
        expect(html).toContain('Relatório Consolidado');
        expect(html).toContain('João Silva');
        expect(html).toContain('Maria Santos');
        expect(html).toContain('2 candidatos');
    });

    it('buildCaseReportHtml retorna string vazia quando caseData é nulo', () => {
        expect(buildCaseReportHtml(null)).toBe('');
        expect(buildCaseReportHtml(undefined)).toBe('');
    });

    it('buildBatchReportHtml retorna string vazia quando cases é vazio', () => {
        expect(buildBatchReportHtml([], 'Tenant')).toBe('');
        expect(buildBatchReportHtml(null, 'Tenant')).toBe('');
    });

    describe('alertas de identidade (banner)', () => {
        it('exibe banner vermelho de óbito', () => {
            const html = buildCaseReportHtml({ ...mockCaseData, bigdatacorpHasDeathRecord: true });
            expect(html).toContain('class="abox"');
            expect(html).toContain('Indicativo de óbito');
        });

        it('exibe banner para CPF cancelado', () => {
            const html = buildCaseReportHtml({ ...mockCaseData, bigdatacorpCpfStatus: 'CANCELADA' });
            expect(html).toContain('class="abox"');
            expect(html).toContain('CPF cancelado');
        });

        it('não exibe banner quando CPF regular e sem óbito', () => {
            const html = buildCaseReportHtml({ ...mockCaseData, bigdatacorpCpfStatus: 'REGULAR' });
            expect(html).not.toContain('class="abox"');
        });
    });
});
