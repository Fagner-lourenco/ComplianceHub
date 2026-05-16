import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { __test } = require('../index');
const { sanitizeAiOutput, normalizeUnicodeToAscii, fixLatinMojibake } = __test;

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

describe('normalizeUnicodeToAscii', () => {
    it('converte smart quotes para aspas retas', () => {
        const text = 'Texto com \u2018aspas\u2019 e \u201Cduplas\u201D';
        const result = normalizeUnicodeToAscii(text);
        expect(result).toBe("Texto com 'aspas' e \"duplas\"");
    });

    it('converte em-dash para duplo hifen', () => {
        const text = 'Texto com \u2014 travessao';
        const result = normalizeUnicodeToAscii(text);
        expect(result).toBe('Texto com -- travessao');
    });

    it('converte en-dash para hifen simples', () => {
        const text = 'Periodo \u2013 2024';
        const result = normalizeUnicodeToAscii(text);
        expect(result).toBe('Periodo - 2024');
    });

    it('converte ellipsis para tres pontos', () => {
        const text = 'E assim por diante\u2026';
        const result = normalizeUnicodeToAscii(text);
        expect(result).toBe('E assim por diante...');
    });

    it('converte non-breaking space para espaco regular', () => {
        const text = 'Texto\u00A0com\u00A0espacos';
        const result = normalizeUnicodeToAscii(text);
        expect(result).toBe('Texto com espacos');
    });

    it('preserva texto ASCII intacto', () => {
        const text = 'Texto normal sem caracteres especiais';
        expect(normalizeUnicodeToAscii(text)).toBe(text);
    });

    it('retorna null/undefined/empty inalterado', () => {
        expect(normalizeUnicodeToAscii(null)).toBe(null);
        expect(normalizeUnicodeToAscii(undefined)).toBe(undefined);
        expect(normalizeUnicodeToAscii('')).toBe('');
    });

    it('sanitizeAiOutput aplica normalizeUnicodeToAscii', () => {
        const text = 'Processo \u201Cimportante\u201D \u2014 decisao final';
        const result = sanitizeAiOutput(text);
        expect(result).toBe('Processo "importante" -- decisao final');
    });
});

describe('fixLatinMojibake', () => {
    it('corrige mojibake comum de caracteres acentuados', () => {
        // Usa escapes Unicode para evitar problemas de encoding no editor
        expect(fixLatinMojibake('\u00C3\u00A7')).toBe('\u00E7'); // Ã§ -> Ã§
        expect(fixLatinMojibake('\u00C3\u00A3o')).toBe('\u00E3o'); // Ã£o -> Ã£o
        expect(fixLatinMojibake('\u00C3\u00A1gua')).toBe('\u00E1gua'); // Ã¡gua -> Ã¡gua
        expect(fixLatinMojibake('\u00C3\u00A9')).toBe('\u00E9'); // Ã© -> Ã©
        expect(fixLatinMojibake('\u00C3\u00AD')).toBe('\u00ED'); // Ã­ -> Ã­
        expect(fixLatinMojibake('\u00C3\u00B3')).toBe('\u00F3'); // Ã³ -> Ã³
        expect(fixLatinMojibake('\u00C3\u00BA')).toBe('\u00FA'); // Ãº -> Ãº
        expect(fixLatinMojibake('\u00C3\u00B4')).toBe('\u00F4'); // Ã´ -> Ã´
        expect(fixLatinMojibake('\u00C3\u00A2')).toBe('\u00E2'); // Ã¢ -> Ã¢
        expect(fixLatinMojibake('\u00C3\u00AA')).toBe('\u00EA'); // Ãª -> Ãª
    });

    it('corrige mojibake de maiusculas acentuadas', () => {
        expect(fixLatinMojibake('\u00C3\u0081')).toBe('\u00C1'); // Ã -> Ã
        expect(fixLatinMojibake('\u00C3\u0087')).toBe('\u00C7'); // Ã -> Ã
        expect(fixLatinMojibake('\u00C3\u0083O')).toBe('\u00C3O'); // ÃO -> ÃO
    });

    it('nao altera texto sem mojibake', () => {
        const text = 'Texto normal sem problemas';
        expect(fixLatinMojibake(text)).toBe(text);
    });

    it('retorna null/undefined/empty inalterado', () => {
        expect(fixLatinMojibake(null)).toBe(null);
        expect(fixLatinMojibake(undefined)).toBe(undefined);
        expect(fixLatinMojibake('')).toBe('');
    });

    it('sanitizeAiOutput aplica fixLatinMojibake', () => {
        const text = 'Processo com mojibake: \u00C3\u00A7\u00C3\u00A3o \u00C3\u00A1gil';
        const result = sanitizeAiOutput(text);
        expect(result).toBe('Processo com mojibake: \u00E7\u00E3o \u00E1gil');
    });
});
