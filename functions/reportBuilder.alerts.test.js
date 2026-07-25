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
