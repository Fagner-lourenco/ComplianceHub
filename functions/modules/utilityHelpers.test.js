/**
 * Testes para utilityHelpers.js
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeNameForGate,
    computeNameSimilarity,
    formatDateKey,
    formatMonthKey,
} from './utilityHelpers';

describe('normalizeNameForGate', () => {
    it('normaliza nome com acentos', () => {
        expect(normalizeNameForGate('João da Silva')).toBe('joao silva');
    });

    it('remove artigos', () => {
        expect(normalizeNameForGate('Maria dos Santos e Oliveira')).toBe('maria santos oliveira');
    });

    it('retorna string vazia para input nulo', () => {
        expect(normalizeNameForGate(null)).toBe('');
        expect(normalizeNameForGate(undefined)).toBe('');
        expect(normalizeNameForGate('')).toBe('');
    });

    it('normaliza espaços excessivos', () => {
        expect(normalizeNameForGate('  Ana   Maria  ')).toBe('ana maria');
    });
});

describe('computeNameSimilarity', () => {
    it('retorna 1 para nomes iguais', () => {
        expect(computeNameSimilarity('João Silva', 'João Silva')).toBe(1);
    });

    it('retorna 0 para nomes completamente diferentes', () => {
        expect(computeNameSimilarity('João Silva', 'Maria Oliveira')).toBe(0);
    });

    it('calcula similaridade parcial', () => {
        const similarity = computeNameSimilarity('João Silva Santos', 'João Silva');
        expect(similarity).toBeGreaterThan(0);
        expect(similarity).toBeLessThan(1);
    });

    it('retorna 0 quando um nome está vazio', () => {
        expect(computeNameSimilarity('', 'João Silva')).toBe(0);
        expect(computeNameSimilarity('João Silva', '')).toBe(0);
    });
});

describe('formatDateKey', () => {
    it('formata data para chave YYYY-MM-DD', () => {
        const date = new Date('2026-05-29T12:00:00Z');
        const key = formatDateKey(date);
        expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('retorna null para input inválido', () => {
        expect(formatDateKey(null)).toBeNull();
        expect(formatDateKey(undefined)).toBeNull();
    });
});

describe('formatMonthKey', () => {
    it('formata data para chave YYYY-MM', () => {
        const date = new Date('2026-05-29T12:00:00Z');
        const key = formatMonthKey(date);
        expect(key).toMatch(/^\d{4}-\d{2}$/);
    });

    it('retorna null para input inválido', () => {
        expect(formatMonthKey(null)).toBeNull();
        expect(formatMonthKey(undefined)).toBeNull();
    });
});
