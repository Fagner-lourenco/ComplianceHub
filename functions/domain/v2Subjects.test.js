import { describe, expect, it } from 'vitest';
import {
    buildSubjectFromCase,
    buildSubjectId,
    buildSubjectUpdatePayload,
    buildPFProfile,
    buildPJProfile,
    buildCanonicalDossierArtifacts,
    enrichSubjectWithAliases,
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

    it('summarize inclui linkedCaseCount quando disponivel', () => {
        const { subject } = buildSubjectFromCase({
            caseId: 'CASE-A',
            caseData: { tenantId: 'tenant-1', cpf: '12345678901', candidateName: 'Ana Lima' },
        });
        subject.linkedCaseIds = ['CASE-A', 'CASE-B', 'CASE-C'];
        const summary = summarizeSubjectForCase(subject);
        expect(summary.linkedCaseCount).toBe(3);
    });
});

describe('buildPFProfile', () => {
    it('extrai campos PF do caseData', () => {
        const profile = buildPFProfile({ birthDate: '1990-05-15', motherName: 'Maria', nationality: 'BR' });
        expect(profile.birthDate).toBe('1990-05-15');
        expect(profile.motherName).toBe('Maria');
        expect(profile.nationality).toBe('BR');
    });

    it('usa nomeMae como fallback para motherName', () => {
        const profile = buildPFProfile({ nomeMae: 'Joana' });
        expect(profile.motherName).toBe('Joana');
    });

    it('inclui candidateName em knownNames', () => {
        const profile = buildPFProfile({ candidateName: 'Carlos Alberto' });
        expect(profile.knownNames).toContain('Carlos Alberto');
    });
});

describe('buildPJProfile', () => {
    it('extrai campos PJ do caseData', () => {
        const profile = buildPJProfile({
            cnpj: '12.345.678/0001-99',
            legalName: 'Empresa LTDA',
            tradeName: 'Empresa Trade',
        });
        expect(profile.legalName).toBe('Empresa LTDA');
        expect(profile.tradeName).toBe('Empresa Trade');
        expect(profile.cnpjBase).toBe('12345678');
    });

    it('infere legalName de razaoSocial', () => {
        const profile = buildPJProfile({ razaoSocial: 'Razao Social SA', cnpj: '12345678000199' });
        expect(profile.legalName).toBe('Razao Social SA');
    });

    it('inclui nomes conhecidos unicos em knownNames', () => {
        const profile = buildPJProfile({ candidateName: 'Emp SA', legalName: 'Empresa SA', tradeName: 'Emp Trade' });
        expect(profile.knownNames).toContain('Emp SA');
        expect(profile.knownNames).toContain('Empresa SA');
    });
});

describe('buildSubjectFromCase PJ', () => {
    it('constroi subject PJ com pjProfile', () => {
        const { subject } = buildSubjectFromCase({
            caseId: 'CASE-PJ-001',
            caseData: {
                tenantId: 'tenant-xyz',
                cnpj: '12345678000199',
                legalName: 'Empresa LTDA',
                productKey: 'kyb_business',
            },
        });
        expect(subject.type).toBe('pj');
        expect(subject.primaryDocument.docType).toBe('cnpj');
        expect(subject.pjProfile).not.toBeNull();
        expect(subject.pfProfile).toBeNull();
        expect(subject.pjProfile.cnpjBase).toBe('12345678');
    });
});

describe('buildSubjectUpdatePayload', () => {
    it('inclui todos os campos obrigatorios sem linkedCaseIds quando sentinel nao fornecido', () => {
        const { subject } = buildSubjectFromCase({
            caseId: 'CASE-X',
            caseData: { tenantId: 'tenant-1', cpf: '11122233344', candidateName: 'Lia' },
        });
        const payload = buildSubjectUpdatePayload({ subject, caseId: 'CASE-X' });
        expect(payload).toHaveProperty('type');
        expect(payload).toHaveProperty('lastDossierSummary');
        expect(payload.lastDossierSummary.caseId).toBe('CASE-X');
        expect(payload).not.toHaveProperty('linkedCaseIds');
    });

    it('inclui linkedCaseIds quando arrayUnionSentinel fornecido', () => {
        const { subject } = buildSubjectFromCase({
            caseId: 'CASE-Y',
            caseData: { tenantId: 'tenant-2', cpf: '55566677788', candidateName: 'Pedro' },
        });
        const sentinel = { _methodName: 'FieldValue.arrayUnion', values: ['CASE-Y'] };
        const payload = buildSubjectUpdatePayload({ subject, caseId: 'CASE-Y', arrayUnionSentinel: sentinel });
        expect(payload.linkedCaseIds).toBe(sentinel);
    });

    it('lanca erro quando subject ausente', () => {
        expect(() => buildSubjectUpdatePayload({ caseId: 'X' })).toThrow();
    });
});

describe('enrichSubjectWithAliases', () => {
    it('adiciona aliases ao pfProfile.knownNames sem duplicatas', () => {
        const { subject } = buildSubjectFromCase({
            caseId: 'CASE-A',
            caseData: { tenantId: 't1', cpf: '12345678901', candidateName: 'Ana' },
        });
        const enriched = enrichSubjectWithAliases(subject, ['Ana Lima', 'Ana L.', 'Ana']);
        expect(enriched.pfProfile.knownNames).toContain('Ana Lima');
        expect(enriched.pfProfile.knownNames).toContain('Ana L.');
        // 'Ana' already present — dedup
        expect(enriched.pfProfile.knownNames.filter((n) => n === 'Ana').length).toBe(1);
    });

    it('retorna subject inalterado quando aliases vazio', () => {
        const { subject } = buildSubjectFromCase({
            caseId: 'CASE-B',
            caseData: { tenantId: 't1', cpf: '11111111111', candidateName: 'Bob' },
        });
        const result = enrichSubjectWithAliases(subject, []);
        expect(result).toBe(subject);
    });

    it('retorna subject inalterado quando subject null', () => {
        expect(enrichSubjectWithAliases(null, ['nome'])).toBeNull();
    });
});

describe('buildCanonicalDossierArtifacts', () => {
    it('materializa pessoa canonica e fato PF a partir de subject com CPF', () => {
        const { subject } = buildSubjectFromCase({
            caseId: 'CASE-PF',
            caseData: {
                tenantId: 'tenant-1',
                cpf: '12345678901',
                candidateName: 'Ana Lima',
                birthDate: '1990-01-01',
            },
        });

        const artifacts = buildCanonicalDossierArtifacts({
            subject,
            caseId: 'CASE-PF',
            evidenceItems: [{ id: 'ev-1' }],
            riskSignals: [{ id: 'rs-1', severity: 'high' }],
        });

        expect(artifacts.entityCollection).toBe('persons');
        expect(artifacts.entity.id).toMatch(/^person_cpf_/);
        expect(artifacts.entity.cpf).toBe('12345678901');
        expect(artifacts.subjectPatch.canonicalPersonId).toBe(artifacts.entity.id);
        expect(artifacts.facts.find((fact) => fact.kind === 'identity_pf')).toBeTruthy();
        expect(artifacts.facts.find((fact) => fact.kind === 'risk_summary').value.highOrCriticalCount).toBe(1);
    });

    it('materializa empresa canonica e fato PJ a partir de subject com CNPJ', () => {
        const { subject } = buildSubjectFromCase({
            caseId: 'CASE-PJ',
            caseData: {
                tenantId: 'tenant-1',
                cnpj: '12.345.678/0001-99',
                legalName: 'Empresa LTDA',
                productKey: 'dossier_pj',
            },
        });

        const artifacts = buildCanonicalDossierArtifacts({ subject, caseId: 'CASE-PJ' });

        expect(artifacts.entityCollection).toBe('companies');
        expect(artifacts.entity.id).toMatch(/^company_cnpj_/);
        expect(artifacts.entity.cnpj).toBe('12345678000199');
        expect(artifacts.subjectPatch.canonicalCompanyId).toBe(artifacts.entity.id);
        expect(artifacts.facts.find((fact) => fact.kind === 'identity_pj')).toBeTruthy();
    });

    it('nao materializa entidade canonica quando faltam dados fortes', () => {
        const artifacts = buildCanonicalDossierArtifacts({
            subject: { id: 'subj-1', tenantId: 'tenant-1', type: 'pf', primaryDocument: null },
            caseId: 'CASE-X',
        });

        expect(artifacts.entity).toBeNull();
        expect(artifacts.entityCollection).toBeNull();
        expect(artifacts.facts).toHaveLength(0);
    });
});
