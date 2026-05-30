/**
 * reportEngine.test.js — Testes unitários para funções puras de relatório
 */

const {
    SAFE_NARRATIVE_TEXTS,
    normalizedNarrativeText,
    narrativeMatches,
    buildSafeNarrativeReplacement,
    sanitizeNarrativesForFlags,
    resolvePublicReportStatus,
    hasPublicReportMinimumContent,
    computePublicSnapshotHash,
    buildSourceSummary,
    buildStatusSummary,
    buildNextSteps,
    buildReportSlug,
    calculateTurnaroundHours,
    buildKeyFindings,
    buildExecutiveSummary,
    buildExecutiveSummaryFallback,
    hasMeaningfulValue,
    resolveNarrativeField,
} = require('../modules/reportEngine');

describe('reportEngine', () => {
    describe('normalizedNarrativeText', () => {
        it('normaliza texto removendo acentos e convertendo para lowercase', () => {
            expect(normalizedNarrativeText('Ação Criminal')).toBe('acao criminal');
            expect(normalizedNarrativeText('Mandado de PRISÃO')).toBe('mandado de prisao');
        });
    });

    describe('narrativeMatches', () => {
        it('retorna true quando algum padrão casa', () => {
            expect(narrativeMatches('Há apontamento criminal', [/apontamento criminal/])).toBe(true);
            expect(narrativeMatches('Nada encontrado', [/apontamento criminal/])).toBe(false);
        });
    });

    describe('buildSafeNarrativeReplacement', () => {
        it('retorna texto seguro para criminalNotes', () => {
            expect(buildSafeNarrativeReplacement('criminalNotes', { criminalFlag: 'POSITIVE' }))
                .toBe(SAFE_NARRATIVE_TEXTS.criminalPositive);
            expect(buildSafeNarrativeReplacement('criminalNotes', { criminalFlag: 'NEGATIVE' }))
                .toBe(SAFE_NARRATIVE_TEXTS.criminalNegative);
        });

        it('retorna texto seguro para laborNotes', () => {
            expect(buildSafeNarrativeReplacement('laborNotes', { laborFlag: 'POSITIVE' }))
                .toBe(SAFE_NARRATIVE_TEXTS.laborPositive);
            expect(buildSafeNarrativeReplacement('laborNotes', { laborFlag: 'NEGATIVE' }))
                .toBe(SAFE_NARRATIVE_TEXTS.laborNegative);
        });
    });

    describe('sanitizeNarrativesForFlags', () => {
        it('substitui criminalNotes quando flag NEGATIVE e texto inconsistente', () => {
            const result = sanitizeNarrativesForFlags(
                { criminalFlag: 'NEGATIVE' },
                { criminalNotes: 'Há apontamento criminal localizado' }
            );
            expect(result.narratives.criminalNotes).toBe(SAFE_NARRATIVE_TEXTS.criminalNegative);
            expect(result.warnings.length).toBeGreaterThan(0);
        });

        it('mantém criminalNotes quando flag POSITIVE e texto explícito', () => {
            const result = sanitizeNarrativesForFlags(
                { criminalFlag: 'POSITIVE' },
                { criminalNotes: 'Foram identificados apontamentos criminais' }
            );
            expect(result.narratives.criminalNotes).toBe('Foram identificados apontamentos criminais');
            expect(result.warnings.length).toBe(0);
        });
    });

    describe('resolvePublicReportStatus', () => {
        it('retorna REVOKED quando active é false', () => {
            expect(resolvePublicReportStatus({ active: false })).toBe('REVOKED');
        });

        it('retorna EXPIRED quando expirado', () => {
            const past = new Date(Date.now() - 1000);
            expect(resolvePublicReportStatus({ expiresAt: past })).toBe('EXPIRED');
        });

        it('retorna ACTIVE quando válido', () => {
            const future = new Date(Date.now() + 1000);
            expect(resolvePublicReportStatus({ expiresAt: future })).toBe('ACTIVE');
        });
    });

    describe('hasPublicReportMinimumContent', () => {
        it('retorna false quando sem candidateName', () => {
            expect(hasPublicReportMinimumContent({ finalVerdict: 'FIT' })).toBe(false);
        });

        it('retorna true quando tem candidateName, summary e verdict', () => {
            expect(hasPublicReportMinimumContent({
                candidateName: 'João',
                executiveSummary: 'Resumo',
                finalVerdict: 'FIT',
            })).toBe(true);
        });
    });

    describe('computePublicSnapshotHash', () => {
        it('retorna hash hexadecimal de 16 caracteres', () => {
            const hash = computePublicSnapshotHash({ a: 1, b: 2 });
            expect(hash).toMatch(/^[a-f0-9]{16}$/);
        });

        it('retorna hash determinístico para mesmo input', () => {
            const data = { name: 'Test', value: 123 };
            expect(computePublicSnapshotHash(data)).toBe(computePublicSnapshotHash(data));
        });
    });

    describe('buildSourceSummary', () => {
        it('retorna mensagem para DONE', () => {
            expect(buildSourceSummary({ status: 'DONE' })).toContain('concluidas');
        });

        it('retorna mensagem para CORRECTION_NEEDED', () => {
            expect(buildSourceSummary({ status: 'CORRECTION_NEEDED' })).toContain('correcao');
        });
    });

    describe('buildStatusSummary', () => {
        it('retorna mensagem para NOT_RECOMMENDED', () => {
            expect(buildStatusSummary({ status: 'DONE', finalVerdict: 'NOT_RECOMMENDED' }))
                .toContain('nao recomendacao');
        });

        it('retorna mensagem para FIT', () => {
            expect(buildStatusSummary({ status: 'DONE', finalVerdict: 'FIT' }))
                .toContain('sem impeditivos');
        });
    });

    describe('buildNextSteps', () => {
        it('retorna passos para NOT_RECOMMENDED', () => {
            const steps = buildNextSteps({ status: 'DONE', finalVerdict: 'NOT_RECOMMENDED' });
            expect(steps.length).toBeGreaterThan(0);
            expect(steps[0]).toContain('alcada');
        });

        it('retorna passos para CORRECTION_NEEDED', () => {
            const steps = buildNextSteps({ status: 'CORRECTION_NEEDED' });
            expect(steps[0]).toContain('Corrigir');
        });
    });

    describe('buildReportSlug', () => {
        it('gera slug com nome e sufixo do caseId', () => {
            const slug = buildReportSlug('case-123', { candidateName: 'Joao Silva' });
            expect(slug).toContain('joao-silva');
            expect(slug.length).toBeLessThanOrEqual(80);
        });
    });

    describe('calculateTurnaroundHours', () => {
        it('calcula diferença em horas', () => {
            const createdAt = new Date('2026-01-01T00:00:00');
            const concludedAt = new Date('2026-01-01T12:00:00');
            const result = calculateTurnaroundHours(
                { createdAt, concludedAt },
                null
            );
            expect(result).toBe(12);
        });

        it('retorna null quando sem datas', () => {
            expect(calculateTurnaroundHours({})).toBe(null);
        });
    });

    describe('buildKeyFindings', () => {
        it('inclui evidências da IA', () => {
            const findings = buildKeyFindings({
                aiStructured: { evidencias: ['Evidência 1'] },
            }, {});
            expect(findings).toContain('Evidência 1');
        });

        it('inclui contagem de mandados', () => {
            const findings = buildKeyFindings({ juditActiveWarrantCount: 2 }, {});
            expect(findings[0]).toContain('2 mandado(s)');
        });
    });

    describe('buildExecutiveSummary', () => {
        it('retorna null quando aiDecision é IGNORED', () => {
            expect(buildExecutiveSummary({ aiDecision: 'IGNORED' })).toBe(null);
        });

        it('retorna resumo da IA quando disponível', () => {
            expect(buildExecutiveSummary({
                aiStructured: { resumo: 'Resumo gerado' },
            })).toBe('Resumo gerado');
        });
    });

    describe('buildExecutiveSummaryFallback', () => {
        it('gera fallback para NOT_RECOMMENDED', () => {
            const summary = buildExecutiveSummaryFallback({ finalVerdict: 'NOT_RECOMMENDED' });
            expect(summary).toContain('nao recomendacao');
        });

        it('usa resumo da IA quando disponível', () => {
            const summary = buildExecutiveSummaryFallback({
                aiStructured: { resumo: 'Resumo IA' },
                finalVerdict: 'FIT',
            });
            expect(summary).toBe('Resumo IA');
        });
    });

    describe('hasMeaningfulValue', () => {
        it('retorna false para valores vazios', () => {
            expect(hasMeaningfulValue('')).toBe(false);
            expect(hasMeaningfulValue(null)).toBe(false);
            expect(hasMeaningfulValue([])).toBe(false);
        });

        it('retorna true para valores válidos', () => {
            expect(hasMeaningfulValue('texto')).toBe(true);
            expect(hasMeaningfulValue([1, 2])).toBe(true);
            expect(hasMeaningfulValue({ a: 1 })).toBe(true);
        });
    });

    describe('resolveNarrativeField', () => {
        it('retorna valor do payload quando presente', () => {
            expect(resolveNarrativeField(
                { field: 'old' },
                { field: 'new' },
                'field'
            )).toBe('new');
        });

        it('retorna valor do merged quando payload ausente', () => {
            expect(resolveNarrativeField(
                { field: 'value' },
                {},
                'field'
            )).toBe('value');
        });

        it('usa fallback quando necessário', () => {
            expect(resolveNarrativeField(
                {},
                {},
                'field',
                { fallbackValue: () => 'fallback' }
            )).toBe('fallback');
        });
    });
});