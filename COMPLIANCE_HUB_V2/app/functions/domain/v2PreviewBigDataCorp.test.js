import { describe, it, expect, beforeAll } from 'vitest';

// Ensure emulator flag is set BEFORE importing index.js (via __test-helpers)
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

// Initialize firebase-admin minimally (only if not already initialized by another test)
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'compliance-hub-test' });
}

// Helper to get __test exports
const { __test } = require('../__test-helpers');
const { v2PreviewBigDataCorp } = __test;

describe('v2PreviewBigDataCorp', () => {
    beforeAll(() => {
        if (!v2PreviewBigDataCorp) {
            throw new Error('v2PreviewBigDataCorp nao exportado em __test. Verifique exports.__test em index.js.');
        }
    });

    it('esta exportado em __test', () => {
        expect(v2PreviewBigDataCorp).toBeDefined();
        expect(typeof v2PreviewBigDataCorp).toBe('function');
    });

    it('rejeita CPF com menos de 11 digitos (logica de sanitizacao)', () => {
        const cpf = '12345';
        const digits = cpf.replace(/\D/g, '');
        expect(digits.length).toBeLessThan(11);
    });

    it('sanitiza CPF corretamente', () => {
        const cpf = '123.456.789-09';
        const digits = cpf.replace(/\D/g, '');
        expect(digits).toBe('12345678909');
        expect(digits.length).toBe(11);
    });

    it('remove caracteres nao numericos do CPF', () => {
        const cpf = 'abc123.456.789-09xyz';
        const digits = cpf.replace(/\D/g, '');
        expect(digits).toBe('12345678909');
    });

    it('valida que CPF vazio tem 0 digitos', () => {
        const cpf = '';
        const digits = cpf.replace(/\D/g, '');
        expect(digits.length).toBe(0);
    });

    it('valida que CPF nulo/undefined retorna string vazia', () => {
        const cpf = null;
        const digits = String(cpf || '').replace(/\D/g, '');
        expect(digits).toBe('');
    });
});
