/**
 * reprocess-gate-blocked-cases.test.cjs — predicado de seleção do reprocessamento
 * Vitest globals habilitados em vite.config.js (globals: true) — não usar require('vitest').
 */
const { shouldReprocessCase } = require('./reprocess-gate-blocked-cases.cjs');

function makeBlockedCase(overrides = {}) {
    return {
        status: 'CORRECTION_NEEDED',
        correctionReason: 'identity_gate_blocked',
        bigdatacorpEnrichmentStatus: 'BLOCKED',
        bigdatacorpGateResult: {
            passed: false,
            reason: 'CPF status CANCELADA',
            nameSimilarity: 0.95,
            cpfStatus: 'CANCELADA',
        },
        ...overrides,
    };
}

describe('shouldReprocessCase', () => {
    it('elegivel: bloqueado por CPF status com nome que passaria no gate novo', () => {
        const r = shouldReprocessCase(makeBlockedCase(), { minNameSimilarity: 0.7 });
        expect(r.eligible).toBe(true);
    });

    it('elegivel: bloqueado por indicacao de obito com nome ok', () => {
        const r = shouldReprocessCase(makeBlockedCase({
            bigdatacorpGateResult: { passed: false, reason: 'Indicacao de obito', nameSimilarity: 0.9 },
        }), { minNameSimilarity: 0.7 });
        expect(r.eligible).toBe(true);
    });

    it('nao elegivel: nome re-bloquearia no gate novo (similaridade abaixo do limiar)', () => {
        const r = shouldReprocessCase(makeBlockedCase({
            bigdatacorpGateResult: { passed: false, reason: 'CPF status ', nameSimilarity: 0 },
        }), { minNameSimilarity: 0.5 });
        expect(r.eligible).toBe(false);
        expect(r.reason).toBe('name_would_block');
    });

    it('nao elegivel: bloqueio original por nome divergente', () => {
        const r = shouldReprocessCase(makeBlockedCase({
            bigdatacorpGateResult: { passed: false, reason: 'Similaridade insuficiente: 0.30 < 0.70', nameSimilarity: 0.3 },
        }));
        expect(r.eligible).toBe(false);
        expect(r.reason).toBe('blocked_by_name');
    });

    it('nao elegivel: caso ja concluido (DONE)', () => {
        const r = shouldReprocessCase(makeBlockedCase({ status: 'DONE' }));
        expect(r.eligible).toBe(false);
    });

    it('nao elegivel: sem bigdatacorpGateResult (doc corrompido/legado)', () => {
        const r = shouldReprocessCase(makeBlockedCase({ bigdatacorpGateResult: undefined }));
        expect(r.eligible).toBe(false);
    });

    it('nao elegivel: bdc nao esta BLOCKED', () => {
        const r = shouldReprocessCase(makeBlockedCase({ bigdatacorpEnrichmentStatus: 'DONE' }));
        expect(r.eligible).toBe(false);
    });

    it('nao elegivel: correctionReason diferente de identity_gate_blocked', () => {
        const r = shouldReprocessCase(makeBlockedCase({ correctionReason: 'dados_incompletos' }));
        expect(r.eligible).toBe(false);
    });
});
