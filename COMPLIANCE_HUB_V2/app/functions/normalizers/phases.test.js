import { describe, expect, it } from 'vitest';

const {
    normalizeReceitaFederal,
    normalizeIdentity,
    normalizeProcessos,
    normalizeProcessosCompleta,
    normalizeWarrant,
    normalizeLabor,
    normalizeCriminal,
} = require('./phases.js');

describe('phases normalizers', () => {
    describe('normalizeReceitaFederal', () => {
        it('extracts identity fields from receita federal payload', () => {
            const result = normalizeReceitaFederal({
                data: {
                    nomePessoaFisica: 'Maria Silva',
                    situacaoCadastral: 'REGULAR',
                    dataNascimento: '1985-03-15',
                    possuiObito: false,
                },
                meta: { requestId: 'req-1', cost: 1.5 },
            });
            expect(result.enrichmentIdentity.name).toBe('Maria Silva');
            expect(result.enrichmentIdentity.cpfStatus).toBe('REGULAR');
            expect(result.enrichmentIdentity.hasDeathRecord).toBe(false);
            expect(result._source.provider).toBe('fontedata');
        });

        it('handles missing data gracefully', () => {
            const result = normalizeReceitaFederal({ data: {}, meta: {} });
            expect(result.enrichmentIdentity.name).toBeNull();
            expect(result.enrichmentIdentity.cpfStatus).toBeNull();
            expect(result.enrichmentIdentity.hasDeathRecord).toBe(false);
        });
    });

    describe('normalizeIdentity', () => {
        it('extracts contact info from identity payload', () => {
            const result = normalizeIdentity({
                data: {
                    nome: 'Joao Souza',
                    cpf: '12345678901',
                    telefones: [{ telefoneComDDD: '(11) 91234-5678' }],
                    emails: ['joao@example.com'],
                },
                meta: { requestId: 'req-2' },
            });
            expect(result.enrichmentContact.name).toBe('Joao Souza');
            expect(result.enrichmentContact.phones).toContain('(11) 91234-5678');
            expect(result.enrichmentContact.emails).toContain('joao@example.com');
        });

        it('handles string phones', () => {
            const result = normalizeIdentity({
                data: { telefones: ['(11) 91234-5678'] },
                meta: {},
            });
            expect(result.enrichmentContact.phones).toContain('(11) 91234-5678');
        });
    });

    describe('normalizeProcessos', () => {
        it('extracts lawsuit summary', () => {
            const result = normalizeProcessos({
                data: { processos: [{ numero: '001', tribunal: 'TJSP' }], totalProcessos: 1 },
                meta: {},
            });
            expect(result.criminalFlag).toBe('NEGATIVE');
            expect(result.processTotal).toBe(1);
            expect(Array.isArray(result.processSegmentos)).toBe(true);
        });

        it('returns zero total when no processos', () => {
            const result = normalizeProcessos({ data: {}, meta: {} });
            expect(result.processTotal).toBe(0);
            expect(result.criminalFlag).toBe('NEGATIVE');
        });
    });

    describe('normalizeProcessosCompleta', () => {
        it('extracts detailed lawsuit info', () => {
            const result = normalizeProcessosCompleta({
                data: { processos: [{ numero: '002', assunto: 'Dano Moral' }] },
                meta: {},
            });
            expect(Array.isArray(result.processosCompleta)).toBe(true);
            expect(result.processosCompleta[0].numero).toBe('002');
        });
    });

    describe('normalizeWarrant', () => {
        it('extracts warrant info', () => {
            const result = normalizeWarrant({
                data: { possuiMandado: true, mandadosPrisao: [{ numeroPeca: 'M001', situacao: 'ATIVO' }] },
                meta: {},
            });
            expect(result.warrantFlag).toBe('POSITIVE');
            expect(result.warrantCount).toBe(1);
        });

        it('returns NEGATIVE when no mandados', () => {
            const result = normalizeWarrant({ data: {}, meta: {} });
            expect(result.warrantFlag).toBe('NEGATIVE');
            expect(result.warrantCount).toBe(0);
        });
    });

    describe('normalizeLabor', () => {
        it('extracts labor process info', () => {
            const result = normalizeLabor({
                data: { possuiProcesso: true, processos: [{ numero: 'L001', reclamante: 'Joao' }] },
                meta: {},
            });
            expect(result.laborFlag).toBe('POSITIVE');
            expect(result.laborProcessCount).toBe(1);
        });

        it('returns NEGATIVE when no processos', () => {
            const result = normalizeLabor({ data: {}, meta: {} });
            expect(result.laborFlag).toBe('NEGATIVE');
            expect(result.laborProcessCount).toBe(0);
        });
    });

    describe('normalizeCriminal alias', () => {
        it('is the same as normalizeProcessos', () => {
            expect(normalizeCriminal).toBe(normalizeProcessos);
        });
    });
});
