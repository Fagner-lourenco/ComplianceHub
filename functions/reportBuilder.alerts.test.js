/**
 * reportBuilder.alerts.test.js — alertas de identidade no relatório (espelho backend)
 */

import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildCaseReportHtml } = require('./reportBuilder.cjs');

const baseCase = {
    id: 'CASE-001',
    candidateName: 'João Silva',
    cpfMasked: '***.***.***-00',
    tenantName: 'Empresa Teste',
    riskLevel: 'GREEN',
    finalVerdict: 'FIT',
    enabledPhases: ['criminal'],
    criminalFlag: 'NEGATIVE',
};

describe('reportBuilder.cjs — alertas de identidade (banner)', () => {
    it('exibe banner vermelho de óbito', () => {
        const html = buildCaseReportHtml({ ...baseCase, bigdatacorpHasDeathRecord: true });
        expect(html).toContain('class="abox"');
        expect(html).toContain('Indicativo de óbito');
    });

    it('exibe banner para CPF cancelado', () => {
        const html = buildCaseReportHtml({ ...baseCase, bigdatacorpCpfStatus: 'CANCELADA' });
        expect(html).toContain('class="abox"');
        expect(html).toContain('CPF cancelado');
    });

    it('não exibe banner quando CPF regular e sem óbito', () => {
        const html = buildCaseReportHtml({ ...baseCase, bigdatacorpCpfStatus: 'REGULAR' });
        expect(html).not.toContain('class="abox"');
    });
});

describe('reportBuilder.cjs — fase Crédito e Restrições', () => {
    const creditCase = {
        ...baseCase,
        enabledPhases: ['criminal', 'creditRestriction'],
        creditRestrictionFlag: 'RESTRICTED',
        creditQuantumScore: 480,
        creditRestrictionSummary: 'Restrições de crédito ativas: 2 negativação(ões) ativa(s).',
        creditRestrictionDetails: { activeNegativeAppointments: 2, registeredProtests: 1, inactiveNegativeAppointments: 0 },
    };

    it('renderiza phaseRow com semáforo vermelho, score e tags', () => {
        const html = buildCaseReportHtml(creditCase);
        expect(html).toContain('Crédito e Restrições');
        expect(html).toContain('pr--red');
        expect(html).toContain('Score Quantum: 480');
        expect(html).toContain('Restrições de crédito ativas');
    });

    it('CLEAN renderiza verde com label Sem restrições', () => {
        const html = buildCaseReportHtml({
            ...creditCase,
            creditRestrictionFlag: 'CLEAN',
            creditRestrictionSummary: 'Sem restrições de crédito ativas na base Quod.',
            creditRestrictionDetails: { activeNegativeAppointments: 0 },
        });
        expect(html).toContain('Crédito e Restrições');
        expect(html).toContain('Sem restrição');
    });

    it('NOT_AVAILABLE renderiza cinza (indisponível)', () => {
        const html = buildCaseReportHtml({
            ...creditCase,
            creditRestrictionFlag: 'NOT_AVAILABLE',
            creditQuantumScore: null,
            creditRestrictionSummary: 'Consulta de crédito/restrições indisponível na base Quod.',
            creditRestrictionDetails: null,
        });
        expect(html).toContain('pr--gray');
        expect(html).toContain('indisponível');
    });

    it('fase desabilitada não gera linha mesmo com dados', () => {
        const html = buildCaseReportHtml({ ...creditCase, enabledPhases: ['criminal'] });
        expect(html).not.toContain('Crédito e Restrições');
    });

    it('fase habilitada sem dados não gera linha', () => {
        const html = buildCaseReportHtml({
            ...baseCase,
            enabledPhases: ['criminal', 'creditRestriction'],
        });
        expect(html).not.toContain('Crédito e Restrições');
    });
});
