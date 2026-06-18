/**
 * fieldConstants.test.js — Valida constantes de campos extraídas do index.js
 */

import { describe, it, expect } from 'vitest';
import {
    IDENTITY_FIELDS,
    RESULT_ONLY_FIELDS,
    PUBLIC_RESULT_FIELDS,
    CLIENT_CASE_FIELDS,
    ALLOWED_CONCLUDE_FIELDS,
    ALLOWED_DRAFT_FIELDS,
    REVIEW_DRAFT_ARRAY_FIELDS,
    CLIENT_SAFE_PUBLICATION_FIELDS,
    CLIENT_CASE_PRIVATE_FIELDS,
} from './fieldConstants.js';

describe('fieldConstants', () => {
    it('IDENTITY_FIELDS contém campos esperados', () => {
        expect(IDENTITY_FIELDS).toContain('candidateName');
        expect(IDENTITY_FIELDS).toContain('cpfMasked');
        expect(IDENTITY_FIELDS).toContain('bigdatacorpName');
        expect(IDENTITY_FIELDS).toContain('bigdatacorpHasDeathRecord');
    });

    it('RESULT_ONLY_FIELDS contém campos de resultado', () => {
        expect(RESULT_ONLY_FIELDS).toContain('criminalFlag');
        expect(RESULT_ONLY_FIELDS).toContain('finalVerdict');
        expect(RESULT_ONLY_FIELDS).toContain('riskScore');
        expect(RESULT_ONLY_FIELDS).toContain('executiveSummary');
        expect(RESULT_ONLY_FIELDS).toContain('keyFindings');
    });

    it('CLIENT_SAFE_PUBLICATION_FIELDS contém campos de publicação segura', () => {
        expect(CLIENT_SAFE_PUBLICATION_FIELDS).toContain('statusSummary');
        expect(CLIENT_SAFE_PUBLICATION_FIELDS).toContain('reportReady');
    });

    it('PUBLIC_RESULT_FIELDS é a união correta', () => {
        expect(PUBLIC_RESULT_FIELDS).toEqual(
            expect.arrayContaining([...IDENTITY_FIELDS, ...RESULT_ONLY_FIELDS, ...CLIENT_SAFE_PUBLICATION_FIELDS]),
        );
        // Sem duplicatas
        expect(new Set(PUBLIC_RESULT_FIELDS).size).toBe(PUBLIC_RESULT_FIELDS.length);
    });

    it('CLIENT_CASE_FIELDS contém PUBLIC_RESULT_FIELDS + privados', () => {
        expect(CLIENT_CASE_FIELDS).toEqual(expect.arrayContaining(PUBLIC_RESULT_FIELDS));
        expect(CLIENT_CASE_FIELDS).toContain('cpf');
        expect(CLIENT_CASE_FIELDS).toContain('candidateId');
        expect(CLIENT_CASE_FIELDS).toContain('tenantName');
    });

    it('PUBLIC_RESULT_FIELDS NÃO contém CPF completo', () => {
        expect(PUBLIC_RESULT_FIELDS).not.toContain('cpf');
    });

    it('ALLOWED_CONCLUDE_FIELDS contém campos essenciais', () => {
        expect(ALLOWED_CONCLUDE_FIELDS.has('finalVerdict')).toBe(true);
        expect(ALLOWED_CONCLUDE_FIELDS.has('analystComment')).toBe(true);
        expect(ALLOWED_CONCLUDE_FIELDS.has('criminalFlag')).toBe(true);
        expect(ALLOWED_CONCLUDE_FIELDS.has('assigneeId')).toBe(true);
        expect(ALLOWED_CONCLUDE_FIELDS.has('enabledPhases')).toBe(true);
    });

    it('ALLOWED_DRAFT_FIELDS contém campos de rascunho', () => {
        expect(ALLOWED_DRAFT_FIELDS.has('finalVerdict')).toBe(true);
        expect(ALLOWED_DRAFT_FIELDS.has('riskScore')).toBe(true);
        expect(ALLOWED_DRAFT_FIELDS.has('riskLevel')).toBe(true);
        expect(ALLOWED_DRAFT_FIELDS.has('analystComment')).toBe(true);
    });

    it('ALLOWED_CONCLUDE_FIELDS inclui todos os ALLOWED_DRAFT_FIELDS exceto riskScore/riskLevel', () => {
        // draft tem riskScore/riskLevel que conclude não tem (intencional)
        for (const field of ALLOWED_DRAFT_FIELDS) {
            if (field !== 'riskScore' && field !== 'riskLevel') {
                expect(ALLOWED_CONCLUDE_FIELDS.has(field)).toBe(true);
            }
        }
    });

    it('REVIEW_DRAFT_ARRAY_FIELDS contém arrays editáveis', () => {
        expect(REVIEW_DRAFT_ARRAY_FIELDS.has('keyFindings')).toBe(true);
        expect(REVIEW_DRAFT_ARRAY_FIELDS.has('osintVectors')).toBe(true);
        expect(REVIEW_DRAFT_ARRAY_FIELDS.has('socialReasons')).toBe(true);
        expect(REVIEW_DRAFT_ARRAY_FIELDS.has('digitalVectors')).toBe(true);
    });
});
