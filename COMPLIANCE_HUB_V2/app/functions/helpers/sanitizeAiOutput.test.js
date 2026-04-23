import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { __test } = require('../index');
const { sanitizeAiOutput } = __test;

describe('sanitizeAiOutput', () => {
    describe('P10: should not mask digits inside CNJ numbers', () => {
        it('preserves 20+ digit CNJ numbers intact', () => {
            const cnj = '0204723542022806016701000326';
            expect(sanitizeAiOutput(cnj)).toBe(cnj);
        });

        it('preserves formatted CNJ numbers like 0204723-54.2022.8.06.0167', () => {
            const cnj = '0204723-54.2022.8.06.0167';
            expect(sanitizeAiOutput(cnj)).toBe(cnj);
        });

        it('preserves CNJ in surrounding text', () => {
            const text = 'Processo CNJ 0204723542022806016701000326 encontrado no sistema.';
            expect(sanitizeAiOutput(text)).toBe(text);
        });

        it('preserves multiple CNJ numbers in text', () => {
            const text = 'Processos: 0204723542022806016701000326 e 5001234567890123456789012';
            expect(sanitizeAiOutput(text)).not.toContain('[CPF_REMOVIDO]');
        });
    });

    describe('should still mask real CPFs', () => {
        it('masks formatted CPF (123.456.789-00)', () => {
            const text = 'CPF do candidato: 123.456.789-00';
            expect(sanitizeAiOutput(text)).toContain('[CPF_REMOVIDO]');
            expect(sanitizeAiOutput(text)).not.toContain('123.456.789-00');
        });

        it('masks unformatted CPF (12345678900) standing alone', () => {
            const text = 'CPF 12345678900 detectado.';
            expect(sanitizeAiOutput(text)).toContain('[CPF_REMOVIDO]');
            expect(sanitizeAiOutput(text)).not.toContain('12345678900');
        });

        it('masks partially formatted CPF (123456789-00)', () => {
            const text = 'CPF: 123456789-00';
            expect(sanitizeAiOutput(text)).toContain('[CPF_REMOVIDO]');
        });

        it('masks CPF at start of text', () => {
            const text = '12345678900 pertence ao candidato.';
            expect(sanitizeAiOutput(text)).toContain('[CPF_REMOVIDO]');
        });

        it('masks CPF at end of text', () => {
            const text = 'Documento: 123.456.789-00';
            expect(sanitizeAiOutput(text)).toContain('[CPF_REMOVIDO]');
        });
    });

    describe('should still mask phone numbers', () => {
        it('masks formatted phone (11) 99999-1234', () => {
            const text = 'Telefone: (11) 99999-1234';
            expect(sanitizeAiOutput(text)).toContain('[TEL_REMOVIDO]');
        });
    });

    it('returns null/empty for falsy input', () => {
        expect(sanitizeAiOutput(null)).toBe(null);
        expect(sanitizeAiOutput(undefined)).toBe(undefined);
        expect(sanitizeAiOutput('')).toBe('');
    });
});
