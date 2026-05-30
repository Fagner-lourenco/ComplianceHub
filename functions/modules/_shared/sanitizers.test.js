/**
 * sanitizers.test.js — Testes para funções puras de validação e sanitização
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const {
    validateCpfDigits,
    sanitizeCpf,
    maskCpf,
    validateAiClassificationReviewSchema,
    sanitizeStructuredList,
    sanitizeStructuredText,
    fixLatinMojibake,
    normalizeUnicodeToAscii,
    sanitizePublicReportHtml,
    formatRequestedBy,
} = require('./sanitizers.js');

describe('validateCpfDigits', () => {
    it('retorna true para CPF válido', () => {
        expect(validateCpfDigits('52998224725')).toBe(true);
    });

    it('retorna false para CPF com dígitos iguais', () => {
        expect(validateCpfDigits('11111111111')).toBe(false);
    });

    it('retorna false para CPF com tamanho diferente de 11', () => {
        expect(validateCpfDigits('1234567890')).toBe(false);
        expect(validateCpfDigits('123456789012')).toBe(false);
    });

    it('retorna false para entrada não-string', () => {
        expect(validateCpfDigits(null)).toBe(false);
        expect(validateCpfDigits(12345678901)).toBe(false);
    });
});

describe('sanitizeCpf', () => {
    it('remove caracteres não-numéricos', () => {
        expect(sanitizeCpf('529.982.247-25')).toBe('52998224725');
    });

    it('limita a 11 dígitos', () => {
        expect(sanitizeCpf('1234567890123')).toBe('12345678901');
    });

    it('retorna string vazia para entrada vazia', () => {
        expect(sanitizeCpf('')).toBe('');
        expect(sanitizeCpf(null)).toBe('');
    });
});

describe('maskCpf', () => {
    it('mascara CPF válido', () => {
        expect(maskCpf('529.982.247-25')).toBe('***.***.***-25');
    });

    it('retorna string vazia para CPF inválido', () => {
        expect(maskCpf('123')).toBe('');
    });
});

describe('validateAiClassificationReviewSchema', () => {
    it('retorna true para objeto válido', () => {
        const valid = {
            summary: 'Resumo',
            identityAssessment: {
                status: 'CONFIRMED',
                rationale: 'Razão',
                homonymRisk: 'LOW',
            },
            classificationValidation: {
                criminal: {
                    autoFlag: 'NEGATIVE',
                    assessment: 'AGREE',
                    evidenceStrength: 'STRONG',
                    rationale: 'Razão',
                    possibleErrors: [],
                },
                labor: {
                    autoFlag: 'NEGATIVE',
                    assessment: 'AGREE',
                    evidenceStrength: 'STRONG',
                    rationale: 'Razão',
                    possibleErrors: [],
                },
                warrant: {
                    autoFlag: 'NEGATIVE',
                    assessment: 'AGREE',
                    evidenceStrength: 'STRONG',
                    rationale: 'Razão',
                    possibleErrors: [],
                },
            },
            inconsistencies: [],
            manualReviewPoints: [],
            consultativeSuggestion: {
                action: 'MAINTAIN_AUTOCLASSIFICATION',
                rationale: 'Razão',
            },
            confidence: 'HIGH',
        };
        expect(validateAiClassificationReviewSchema(valid)).toBe(true);
    });

    it('retorna false para objeto inválido', () => {
        expect(validateAiClassificationReviewSchema(null)).toBe(false);
        expect(validateAiClassificationReviewSchema({})).toBe(false);
    });
});

describe('sanitizeStructuredList', () => {
    it('limita número de itens e comprimento', () => {
        const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
        expect(sanitizeStructuredList(input, 5)).toHaveLength(5);
    });

    it('trunca itens muito longos', () => {
        const input = ['a'.repeat(300)];
        const result = sanitizeStructuredList(input, 1, 10);
        expect(result[0]).toBe('a'.repeat(7) + '...');
    });

    it('remove strings vazias', () => {
        const input = ['a', '', 'b'];
        expect(sanitizeStructuredList(input)).toEqual(['a', 'b']);
    });

    it('retorna array vazio para entrada não-array', () => {
        expect(sanitizeStructuredList(null)).toEqual([]);
    });
});

describe('sanitizeStructuredText', () => {
    it('trunca texto muito longo', () => {
        const input = 'a'.repeat(600);
        expect(sanitizeStructuredText(input, 500)).toBe('a'.repeat(497) + '...');
    });

    it('normaliza espaços e quebras', () => {
        const input = 'a   b\n\n\n\nc';
        expect(sanitizeStructuredText(input)).toBe('a b\n\nc');
    });

    it('retorna string vazia para entrada não-string', () => {
        expect(sanitizeStructuredText(null)).toBe('');
    });
});

describe('fixLatinMojibake', () => {
    it('corrige mojibake comum', () => {
        expect(fixLatinMojibake('Jo\u00C3\u00A3o')).toBe('Jo\u00E3o');
    });

    it('retorna texto inalterado se não houver mojibake', () => {
        expect(fixLatinMojibake('João')).toBe('João');
    });

    it('retorna entrada para tipos não-string', () => {
        expect(fixLatinMojibake(null)).toBe(null);
    });
});

describe('normalizeUnicodeToAscii', () => {
    it('converte aspas inteligentes', () => {
        expect(normalizeUnicodeToAscii('\u2018test\u2019')).toBe("'test'");
    });

    it('converte em-dash', () => {
        expect(normalizeUnicodeToAscii('\u2014')).toBe('--');
    });

    it('retorna entrada para tipos não-string', () => {
        expect(normalizeUnicodeToAscii(null)).toBe(null);
    });
});

describe('sanitizePublicReportHtml', () => {
    it('remove tags script', () => {
        const input = '<script>alert(1)</script><p>Safe</p>';
        expect(sanitizePublicReportHtml(input)).toBe('<p>Safe</p>');
    });

    it('remove iframes', () => {
        const input = '<iframe src="evil"></iframe><p>Safe</p>';
        expect(sanitizePublicReportHtml(input)).toBe('<p>Safe</p>');
    });

    it('remove handlers de evento inline', () => {
        const input = '<p onclick="alert(1)">Safe</p>';
        expect(sanitizePublicReportHtml(input)).toBe('<p>Safe</p>');
    });

    it('neutraliza javascript: em href/src', () => {
        const input = '<a href="javascript:alert(1)">Link</a>';
        expect(sanitizePublicReportHtml(input)).toBe('<a href="#">Link</a>');
    });
});

describe('formatRequestedBy', () => {
    it('formata nome e email', () => {
        expect(formatRequestedBy({ displayName: 'João', email: 'joao@test.com' }))
            .toBe('João (joao@test.com)');
    });

    it('retorna apenas nome se email ausente', () => {
        expect(formatRequestedBy({ displayName: 'João' })).toBe('João');
    });

    it('retorna uid se nada disponível', () => {
        expect(formatRequestedBy({}, 'uid123')).toBe('uid123');
    });

    it('retorna string vazia se nada disponível e sem uid', () => {
        expect(formatRequestedBy({})).toBe('');
    });
});