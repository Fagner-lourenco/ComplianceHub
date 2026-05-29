import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);
const mod = require('./index');

const { clientPayloadChanged } = mod.__test;

describe('clientPayloadChanged', () => {
    it('ignora timestamps diferentes', () => {
        const payload = { name: 'John', updatedAt: new Date('2026-01-01') };
        const existing = { name: 'John', updatedAt: new Date('2026-01-02') };
        expect(clientPayloadChanged(payload, existing)).toBe(false);
    });

    it('detecta flag diferente', () => {
        const payload = { criminalFlag: 'POSITIVE' };
        const existing = { criminalFlag: 'NEGATIVE' };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });

    it('detecta array diferente', () => {
        const payload = { warrants: [{ id: 1 }] };
        const existing = { warrants: [{ id: 1 }, { id: 2 }] };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });

    it('ignora arrays iguais', () => {
        const payload = { warrants: [{ id: 1 }] };
        const existing = { warrants: [{ id: 1 }] };
        expect(clientPayloadChanged(payload, existing)).toBe(false);
    });

    it('detecta objeto diferente', () => {
        const payload = { meta: { score: 10 } };
        const existing = { meta: { score: 20 } };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });

    it('ignora objeto igual', () => {
        const payload = { meta: { score: 10 } };
        const existing = { meta: { score: 10 } };
        expect(clientPayloadChanged(payload, existing)).toBe(false);
    });

    it('detecta primitivo diferente', () => {
        const payload = { name: 'John' };
        const existing = { name: 'Jane' };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });

    it('ignora primitivo igual', () => {
        const payload = { name: 'John' };
        const existing = { name: 'John' };
        expect(clientPayloadChanged(payload, existing)).toBe(false);
    });

    it('detecta chave nova', () => {
        const payload = { name: 'John', age: 30 };
        const existing = { name: 'John' };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });

    it('detecta chave removida', () => {
        const payload = { name: 'John' };
        const existing = { name: 'John', age: 30 };
        expect(clientPayloadChanged(payload, existing)).toBe(true);
    });
});
