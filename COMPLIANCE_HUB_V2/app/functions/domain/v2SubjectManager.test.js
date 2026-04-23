import { describe, it, expect } from 'vitest';
import { classifyTaxId } from './v2SubjectManager.cjs';

describe('classifyTaxId', () => {
    it('classifies 11-digit string as CPF', () => {
        expect(classifyTaxId('12345678901')).toEqual({ docType: 'cpf', digits: '12345678901' });
    });

    it('classifies 14-digit string as CNPJ', () => {
        expect(classifyTaxId('12345678000195')).toEqual({ docType: 'cnpj', digits: '12345678000195' });
    });

    it('strips non-digit characters before classifying', () => {
        expect(classifyTaxId('123.456.789-01')).toEqual({ docType: 'cpf', digits: '12345678901' });
        expect(classifyTaxId('12.345.678/0001-95')).toEqual({ docType: 'cnpj', digits: '12345678000195' });
    });

    it('returns docType null for invalid lengths', () => {
        expect(classifyTaxId('123')).toEqual({ docType: null, digits: '123' });
        expect(classifyTaxId('')).toEqual({ docType: null, digits: '' });
        expect(classifyTaxId(null)).toEqual({ docType: null, digits: '' });
    });

    it('honors explicit taxIdType over inference', () => {
        expect(classifyTaxId('12345678901', 'cnpj')).toEqual({ docType: 'cnpj', digits: '12345678901' });
        expect(classifyTaxId('12345678000195', 'cpf')).toEqual({ docType: 'cpf', digits: '12345678000195' });
    });

    it('ignores unknown explicit types and falls back to inference', () => {
        expect(classifyTaxId('12345678901', 'rg')).toEqual({ docType: 'cpf', digits: '12345678901' });
    });
});
