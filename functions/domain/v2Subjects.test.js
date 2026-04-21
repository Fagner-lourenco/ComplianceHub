import { describe, expect, it } from 'vitest';
import {
    buildSubjectFromCase,
    buildSubjectId,
    inferPrimaryDocument,
    inferSubjectType,
    summarizeSubjectForCase,
} from './v2Subjects.cjs';

describe('v2Subjects', () => {
    it('infere tipo PF para caso com CPF', () => {
        const type = inferSubjectType({ cpf: '12345678901', productKey: 'kyc_individual' });
        expect(type).toBe('pf');
    });

    it('infere tipo PJ para caso com CNPJ sem CPF', () => {
        const type = inferSubjectType({ cnpj: '12345678000199', productKey: 'kyb_business' });
        expect(type).toBe('pj');
    });

    it('infere tipo PJ pelo productKey dossier_pj mesmo sem CNPJ', () => {
        const type = inferSubjectType({ productKey: 'dossier_pj' });
        expect(type).toBe('pj');
    });

    it('extrai CPF limpo como documento primario', () => {
        const result = inferPrimaryDocument({ cpf: '123.456.789-01' });
        expect(result.docType).toBe('cpf');
        expect(result.docValue).toBe('12345678901');
    });

    it('extrai CNPJ limpo como documento primario quando nao ha CPF', () => {
        const result = inferPrimaryDocument({ cnpj: '12.345.678/0001-99' });
        expect(result.docType).toBe('cnpj');
        expect(result.docValue).toBe('12345678000199');
    });

    it('retorna docType null quando nao ha documento valido', () => {
        const result = inferPrimaryDocument({});
        expect(result.docType).toBeNull();
        expect(result.docValue).toBeNull();
    });

    it('gera subjectId deterministico para mesmos inputs', () => {
        const id1 = buildSubjectId('tenant-1', 'cpf', '12345678901');
        const id2 = buildSubjectId('tenant-1', 'cpf', '12345678901');
        expect(id1).toBe(id2);
        expect(id1).toMatch(/^subj_cpf_/);
    });

    it('gera subjectIds diferentes para documentos diferentes', () => {
        const id1 = buildSubjectId('tenant-1', 'cpf', '12345678901');
        const id2 = buildSubjectId('tenant-1', 'cpf', '98765432100');
        expect(id1).not.toBe(id2);
    });

    it('retorna null quando faltam dados para subjectId', () => {
        expect(buildSubjectId(null, 'cpf', '12345678901')).toBeNull();
        expect(buildSubjectId('tenant-1', null, '12345678901')).toBeNull();
        expect(buildSubjectId('tenant-1', 'cpf', null)).toBeNull();
    });

    it('constroi subject com todos os campos obrigatorios a partir do case', () => {
        const { subject, subjectId } = buildSubjectFromCase({
            caseId: 'CASE-001',
            caseData: {
                tenantId: 'tenant-abc',
                cpf: '12345678901',
                candidateName: 'Joao da Silva',
                productKey: 'kyc_individual',
            },
        });

        expect(subject.id).toBe(subjectId);
        expect(subject.tenantId).toBe('tenant-abc');
        expect(subject.type).toBe('pf');
        expect(subject.primaryDocument.docType).toBe('cpf');
        expect(subject.primaryDocument.docValue).toBe('12345678901');
        expect(subject.declaredName).toBe('Joao da Silva');
        expect(subject.createdFromCaseId).toBe('CASE-001');
        expect(subject.linkedCaseIds).toContain('CASE-001');
        expect(subject.status).toBe('active');
        expect(subject.version).toMatch(/^v2-subjects-/);
    });

    it('usa fallback subjectId baseado em caseId quando documento e invalido', () => {
        const { subject, subjectId } = buildSubjectFromCase({
            caseId: 'CASE-999',
            caseData: { tenantId: 'tenant-x' },
        });
        expect(subjectId).toBe('subj_case_CASE-999');
        expect(subject.id).toBe('subj_case_CASE-999');
        expect(subject.primaryDocument).toBeNull();
    });

    it('preenche lastDossierSummary a partir do moduleRunSummary', () => {
        const { subject } = buildSubjectFromCase({
            caseId: 'CASE-002',
            caseData: {
                tenantId: 'tenant-abc',
                cpf: '11122233344',
                candidateName: 'Maria Souza',
                productKey: 'kye_employee',
                finalVerdict: 'ATTENTION',
            },
            moduleRunSummary: {
                evidenceCount: 4,
                riskSignalCount: 2,
            },
        });

        expect(subject.lastDossierSummary.evidenceCount).toBe(4);
        expect(subject.lastDossierSummary.riskSignalCount).toBe(2);
        expect(subject.lastDossierSummary.verdict).toBe('ATTENTION');
        expect(subject.lastDossierSummary.productKey).toBe('kye_employee');
    });

    it('gera resumo de subject para exibicao no cockpit', () => {
        const { subject } = buildSubjectFromCase({
            caseId: 'CASE-003',
            caseData: {
                tenantId: 'tenant-abc',
                cpf: '55566677788',
                candidateName: 'Pedro Alves',
                productKey: 'tpr_third_party',
            },
        });

        const summary = summarizeSubjectForCase(subject);
        expect(summary.subjectId).toBe(subject.id);
        expect(summary.type).toBe('pf');
        expect(summary.declaredName).toBe('Pedro Alves');
        expect(summary.primaryDocument.docValue).toBe('55566677788');
    });

    it('retorna null para subject invalido ou vazio', () => {
        expect(summarizeSubjectForCase(null)).toBeNull();
        expect(summarizeSubjectForCase({})).toBeNull();
    });
});
