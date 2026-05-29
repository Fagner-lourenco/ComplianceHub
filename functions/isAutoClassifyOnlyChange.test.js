import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);
const mod = require('./index');

const { isAutoClassifyOnlyChange } = mod.__test;

describe('isAutoClassifyOnlyChange', () => {
    it('retorna true quando apenas riskScore muda', () => {
        const before = { name: 'John', riskScore: 30 };
        const after = { name: 'John', riskScore: 50 };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(true);
    });

    it('retorna false quando status muda', () => {
        const before = { name: 'John', status: 'PENDING' };
        const after = { name: 'John', status: 'IN_PROGRESS' };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(false);
    });

    it('retorna false quando misto (auto + status)', () => {
        const before = { name: 'John', status: 'PENDING', riskScore: 30 };
        const after = { name: 'John', status: 'IN_PROGRESS', riskScore: 50 };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(false);
    });

    it('retorna true quando múltiplos campos auto mudam', () => {
        const before = { name: 'John', riskScore: 30, criminalFlag: 'NEGATIVE' };
        const after = { name: 'John', riskScore: 50, criminalFlag: 'POSITIVE' };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(true);
    });

    it('retorna true quando não há mudanças', () => {
        const before = { name: 'John', riskScore: 30 };
        const after = { name: 'John', riskScore: 30 };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(true);
    });

    it('retorna false quando campo não-auto é adicionado', () => {
        const before = { name: 'John' };
        const after = { name: 'John', analystComment: 'Note' };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(false);
    });

    it('retorna false quando campo não-auto é removido', () => {
        const before = { name: 'John', analystComment: 'Note' };
        const after = { name: 'John' };
        expect(isAutoClassifyOnlyChange(before, after)).toBe(false);
    });
});
