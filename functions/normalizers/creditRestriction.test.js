/**
 * creditRestriction.test.js — normalizer da fase de crédito/restrições (Quod + Quantum)
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    deriveCreditRestrictionFlag,
    normalizeQuantumScore,
    buildCreditRestrictionSummary,
    normalizeCreditRestriction,
} = require('./creditRestriction');

function quodData(overrides = {}) {
    return {
        HasMinRegister: true,
        HasNegativeIndicator: false,
        HasInquiryIndicator: true,
        TotalIndebtednessValue: 0,
        TotalActiveNegativeAppointments: 0,
        TotalInactiveNegativeAppointments: 0,
        TotalLawsuitsAppointments: 0,
        LastNegativeAppointmentDate: '0001-01-01T00:00:00',
        TotalRegisteredProtests: 0,
        TotalInquiriesLast30Days: 5,
        TotalInquiriesLast60Days: 8,
        TotalInquiriesLast90Days: 10,
        TotalInquiriesMore90Days: 20,
        ...overrides,
    };
}

describe('deriveCreditRestrictionFlag', () => {
    const cases = [
        ['sem dados → NOT_AVAILABLE', null, 'NOT_AVAILABLE'],
        ['tudo zerado → CLEAN', quodData(), 'CLEAN'],
        ['HasNegativeIndicator → RESTRICTED', quodData({ HasNegativeIndicator: true }), 'RESTRICTED'],
        ['negativacao ativa → RESTRICTED', quodData({ TotalActiveNegativeAppointments: 2 }), 'RESTRICTED'],
        ['protesto → RESTRICTED', quodData({ TotalRegisteredProtests: 1 }), 'RESTRICTED'],
        ['negativacao inativa → ATTENTION', quodData({ TotalInactiveNegativeAppointments: 3 }), 'ATTENTION'],
        ['apontamento judicial → ATTENTION', quodData({ TotalLawsuitsAppointments: 1 }), 'ATTENTION'],
        ['divida sem negativacao ativa → CLEAN (indebtedness nao pinta vermelho)', quodData({ TotalIndebtednessValue: 150000 }), 'CLEAN'],
        ['ativa + inativa → RESTRICTED (vermelho vence)', quodData({ TotalActiveNegativeAppointments: 1, TotalInactiveNegativeAppointments: 5 }), 'RESTRICTED'],
    ];
    for (const [name, input, expected] of cases) {
        it(name, () => {
            expect(deriveCreditRestrictionFlag(input)).toBe(expected);
        });
    }
});

describe('normalizeQuantumScore', () => {
    const cases = [
        ['"606" → 606', '606', 606],
        ['"0" → 0', '0', 0],
        ['"999" → 999', '999', 999],
        ['numero 710 → 710', 710, 710],
        ['vazio → null', '', null],
        ['null → null', null, null],
        ['undefined → null', undefined, null],
        ['nao-numerico → null', 'abc', null],
    ];
    for (const [name, input, expected] of cases) {
        it(name, () => {
            expect(normalizeQuantumScore(input)).toBe(expected);
        });
    }
});

describe('buildCreditRestrictionSummary', () => {
    it('RESTRICTED lista restricoes ativas e score', () => {
        const s = buildCreditRestrictionSummary('RESTRICTED', {
            activeNegativeAppointments: 2,
            registeredProtests: 1,
            indebtednessValue: 1234.56,
        }, 480);
        expect(s).toMatch(/negativa/i);
        expect(s).toMatch(/protesto/i);
        expect(s).toContain('480');
    });

    it('CLEAN sem restricoes', () => {
        const s = buildCreditRestrictionSummary('CLEAN', { activeNegativeAppointments: 0 }, 710);
        expect(s).toMatch(/sem restri/i);
        expect(s).toContain('710');
    });

    it('NOT_AVAILABLE indica indisponibilidade', () => {
        const s = buildCreditRestrictionSummary('NOT_AVAILABLE', null, null);
        expect(s).toMatch(/indispon/i);
    });

    it('sem score omite mencao ao Quantum', () => {
        const s = buildCreditRestrictionSummary('CLEAN', { activeNegativeAppointments: 0 }, null);
        expect(s).not.toMatch(/quantum/i);
    });
});

// Payload REAL capturado da BDC em 2026-07-25 (CPF e TransactionID removidos).
// Trava o contrato do /marketplace contra mudancas silenciosas de shape.
describe('normalizeCreditRestriction — payload real da BDC', () => {
    const REAL_QUOD = {
        HasMinRegister: false,
        HasNegativeIndicator: false,
        HasInquiryIndicator: true,
        TotalIndebtednessValue: 0,
        TotalActiveNegativeAppointments: 0,
        TotalInactiveNegativeAppointments: 0,
        TotalLawsuitsAppointments: 0,
        LastNegativeAppointmentDate: '0001-01-01T00:00:00',
        TotalRegisteredProtests: 0,
        TotalInquiriesLast30Days: 0,
        TotalInquiriesLast60Days: 0,
        TotalInquiriesLast90Days: 0,
        TotalInquiriesMore90Days: 2,
        TotalInquiriesBySegment: { 'Instituições Financeiras': 1 },
    };

    it('CPF sem restricoes → CLEAN com score e resumo', () => {
        const result = normalizeCreditRestriction({
            quodRisk: { ok: true, data: REAL_QUOD },
            quantumScore: { ok: true, score: '718' },
        });

        expect(result.creditRestrictionFlag).toBe('CLEAN');
        expect(result.creditQuantumScore).toBe(718);
        expect(result.creditRestrictionSummary).toContain('718');
        expect(result.creditRestrictionDetails.lastNegativeAppointmentDate).toBeNull();
        expect(result.creditRestrictionDetails.inquiriesMore90Days).toBe(2);
    });

    // Segundo payload REAL (2026-07-25): CPF com restricoes. Traz campos que a doc
    // nao mostrava — detalhamento de negativacoes e de acoes judiciais.
    const REAL_QUOD_RESTRICTED = {
        HasMinRegister: false,
        HasNegativeIndicator: true,
        HasInquiryIndicator: true,
        TotalIndebtednessValue: 7606.02,
        TotalActiveNegativeAppointments: 2,
        TotalInactiveNegativeAppointments: 0,
        TotalNegativeAppointmentsByNature: { CT: 1, FI: 1 },
        NegativeAppointmentsDetails: [
            { Nature: 'CT', Amount: 135.09, Status: 'A', ReferenceDate: '2026-03-12T00:00:00' },
            { Nature: 'FI', Amount: 7470.93, Status: 'A', ReferenceDate: '2021-11-03T00:00:00' },
        ],
        TotalLawsuitsAppointments: 1,
        TotalLawsuitsAppointmentsByProcessType: { 'EXECUCAO DE TITULO EXTRAJUDICIAL': 1 },
        LawsuitsAppointmentsDetails: [
            { ProcessType: 'EXECUCAO DE TITULO EXTRAJUDICIAL', ProcessAuthor: 'BANCO BRADESCO S/A', JusticeType: 'ESTADUAL', Amount: 0, ReferenceDate: '2022-07-29T00:00:00' },
        ],
        TotalAmountMoneyOfReceivedLawsuits: 0,
        LastNegativeAppointmentDate: '2026-06-04T00:00:00',
        TotalRegisteredProtests: 0,
        TotalInquiriesLast30Days: 0,
        TotalInquiriesMore90Days: 2,
    };

    it('CPF com restricoes → RESTRICTED com detalhamento de negativacoes e acoes judiciais', () => {
        const result = normalizeCreditRestriction({
            quodRisk: { ok: true, data: REAL_QUOD_RESTRICTED },
            quantumScore: { ok: false, score: null, statusCode: -1200 },
        });

        expect(result.creditRestrictionFlag).toBe('RESTRICTED');
        expect(result.creditQuantumScore).toBeNull();

        const d = result.creditRestrictionDetails;
        expect(d.negativeAppointments).toHaveLength(2);
        expect(d.negativeAppointments[0]).toEqual({ nature: 'FI', amount: 7470.93, status: 'A', referenceDate: '2021-11-03T00:00:00' });
        expect(d.lawsuitAppointments).toHaveLength(1);
        expect(d.lawsuitAppointments[0]).toEqual({
            processType: 'EXECUCAO DE TITULO EXTRAJUDICIAL',
            author: 'BANCO BRADESCO S/A',
            justiceType: 'ESTADUAL',
            amount: 0,
            referenceDate: '2022-07-29T00:00:00',
        });
        expect(d.lastNegativeAppointmentDate).toBe('2026-06-04T00:00:00');

        expect(result.creditRestrictionSummary).toMatch(/R\$\s?7\.606,02/);
        expect(result.creditRestrictionSummary).toMatch(/EXECUCAO DE TITULO EXTRAJUDICIAL/i);
        expect(result.creditRestrictionSummary).toMatch(/BANCO BRADESCO/i);
    });

    it('ordena negativacoes por valor e limita a 5', () => {
        const many = Array.from({ length: 8 }, (_, i) => ({ Nature: 'FI', Amount: (i + 1) * 100, Status: 'A', ReferenceDate: '2025-01-01T00:00:00' }));
        const result = normalizeCreditRestriction({
            quodRisk: { ok: true, data: { ...REAL_QUOD_RESTRICTED, NegativeAppointmentsDetails: many } },
            quantumScore: { ok: false, score: null },
        });
        expect(result.creditRestrictionDetails.negativeAppointments).toHaveLength(5);
        expect(result.creditRestrictionDetails.negativeAppointments[0].amount).toBe(800);
    });

    it('payload sem os campos de detalhe (contrato antigo) nao quebra', () => {
        const result = normalizeCreditRestriction({
            quodRisk: { ok: true, data: REAL_QUOD },
            quantumScore: { ok: true, score: '718' },
        });
        expect(result.creditRestrictionDetails.negativeAppointments).toEqual([]);
        expect(result.creditRestrictionDetails.lawsuitAppointments).toEqual([]);
    });

    it('mesmo payload com negativacao ativa → RESTRICTED', () => {
        const result = normalizeCreditRestriction({
            quodRisk: { ok: true, data: { ...REAL_QUOD, HasNegativeIndicator: true, TotalActiveNegativeAppointments: 2, TotalIndebtednessValue: 4530.77 } },
            quantumScore: { ok: true, score: '412' },
        });

        expect(result.creditRestrictionFlag).toBe('RESTRICTED');
        expect(result.creditRestrictionSummary).toMatch(/2 negativa/);
        expect(result.creditRestrictionSummary).toMatch(/R\$/);
    });
});

describe('normalizeCreditRestriction', () => {
    it('monta payload completo com quod + quantum ok', () => {
        const result = normalizeCreditRestriction({
            quodRisk: { ok: true, data: quodData({ TotalActiveNegativeAppointments: 1 }) },
            quantumScore: { ok: true, score: '606' },
        });

        expect(result.creditRestrictionFlag).toBe('RESTRICTED');
        expect(result.creditQuantumScore).toBe(606);
        expect(result.creditRestrictionDetails.activeNegativeAppointments).toBe(1);
        expect(result.creditRestrictionDetails.inquiriesLast30Days).toBe(5);
        expect(result.creditRestrictionDetails.lastNegativeAppointmentDate).toBeNull();
        expect(typeof result.creditRestrictionSummary).toBe('string');
        expect(result._sources.quodRisk.found).toBe(true);
        expect(result._sources.quantumScore.found).toBe(true);
    });

    it('quod falhou → NOT_AVAILABLE mesmo com quantum ok', () => {
        const result = normalizeCreditRestriction({
            quodRisk: { ok: false, data: null, statusCode: -1301 },
            quantumScore: { ok: true, score: '710' },
        });

        expect(result.creditRestrictionFlag).toBe('NOT_AVAILABLE');
        expect(result.creditQuantumScore).toBe(710);
        expect(result.creditRestrictionDetails).toBeNull();
        expect(result._sources.quodRisk.found).toBe(false);
    });

    it('data real de ultima negativacao e preservada', () => {
        const result = normalizeCreditRestriction({
            quodRisk: { ok: true, data: quodData({ LastNegativeAppointmentDate: '2025-03-10T00:00:00' }) },
            quantumScore: { ok: false, score: null },
        });
        expect(result.creditRestrictionDetails.lastNegativeAppointmentDate).toBe('2025-03-10T00:00:00');
        expect(result.creditQuantumScore).toBeNull();
    });
});
