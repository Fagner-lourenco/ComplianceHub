import { describe, it, expect } from 'vitest';
import { validateCpf, validateUrl } from './validators';

describe('validators', () => {
    // ── validateCpf ──────────────────────────────────────────────────────────

    describe('validateCpf', () => {
        // CPFs validos gerados com algoritmo modulo 11
        it('aceita CPF valido sem formatacao', () => {
            expect(validateCpf('52998224725')).toBe(true);  // CPF válido conhecido
        });

        it('aceita CPF valido com formatacao (pontos e traco)', () => {
            expect(validateCpf('529.982.247-25')).toBe(true);
        });

        it('rejeita CPF com todos os digitos iguais', () => {
            expect(validateCpf('00000000000')).toBe(false);
            expect(validateCpf('11111111111')).toBe(false);
            expect(validateCpf('22222222222')).toBe(false);
            expect(validateCpf('99999999999')).toBe(false);
        });

        it('rejeita CPF com comprimento errado', () => {
            expect(validateCpf('1234567890')).toBe(false);     // 10 digitos
            expect(validateCpf('123456789012')).toBe(false);   // 12 digitos
            expect(validateCpf('')).toBe(false);                // vazio
            expect(validateCpf('123')).toBe(false);             // muito curto
        });

        it('rejeita CPF com digito verificador incorreto', () => {
            expect(validateCpf('52998224726')).toBe(false);    // ultimo digito errado
            expect(validateCpf('52998224735')).toBe(false);    // penultimo digito errado
        });

        it('valida CPFs reais conhecidos', () => {
            // CPFs gerados algoritmicamente (sem dados reais)
            expect(validateCpf('11144477735')).toBe(true);
            expect(validateCpf('111.444.777-35')).toBe(true);
        });
    });

    // ── validateUrl ──────────────────────────────────────────────────────────

    describe('validateUrl', () => {
        it('aceita string vazia (campo opcional)', () => {
            expect(validateUrl('')).toBe(true);
        });

        it('aceita null/undefined (campo opcional)', () => {
            expect(validateUrl(null)).toBe(true);
            expect(validateUrl(undefined)).toBe(true);
        });

        it('aceita handle de rede social com @', () => {
            expect(validateUrl('@joaosilva')).toBe(true);
            expect(validateUrl('@empresa_br')).toBe(true);
        });

        it('aceita URLs validas (https/http)', () => {
            expect(validateUrl('https://www.instagram.com/user')).toBe(true);
            expect(validateUrl('http://example.com')).toBe(true);
            expect(validateUrl('https://linkedin.com/in/fulano')).toBe(true);
        });

        it('rejeita strings que nao sao URL nem handle', () => {
            expect(validateUrl('nao-sou-uma-url')).toBe(false);
            expect(validateUrl('joaosilva')).toBe(false);
            expect(validateUrl('www.example.com')).toBe(false); // sem protocolo
        });
    });
});
