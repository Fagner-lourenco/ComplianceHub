import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { normalizeEscavadorProcessos } = require('../normalizers/escavador');
const {
    normalizeJuditExecution,
    normalizeJuditLawsuits,
    normalizeJuditWarrants,
} = require('../normalizers/judit');
const { buildHomonymAnalysisInput } = require('./aiHomonym');
const { computeAutoClassification } = require('../modules/autoClassification');
const { __test } = require('../index');
const {
    validateConcludeFinalFlags,
} = require('../modules/concludeCaseAndSettings');

const {
    buildAiPrompt,
    buildAiClassificationReviewPrompt,
    buildAiClassificationReviewContext,
    applyAiClassificationReviewGuardrails,
    buildAiHomonymPrompt,
    parseAiClassificationReviewResponse,
    validateAiClassificationReviewSchema,
    evaluateNegativePartialSafetyNet,
    sanitizeAuditMetadataValue,
} = __test;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

function loadJson(...parts) {
    return JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));
}

function adaptJuditLawsuits(payload) {
    return {
        hasLawsuits: payload.has_lawsuits ?? payload.hasLawsuits ?? false,
        requestId: payload.request_id ?? payload.requestId ?? null,
        responseData: payload.lawsuits || payload.responseData || [],
    };
}

function adaptJuditWarrants(payload) {
    return {
        requestId: payload.requestId || payload.create?.request_id || payload.request_id || null,
        responseData: payload.responses?.page_data || payload.page_data || payload.responseData || [],
    };
}

function adaptJuditExecution(payload) {
    return {
        requestId: payload.requestId || payload.request_id || null,
        responseData: payload.page_data || payload.responseData || [],
    };
}

function adaptEscavador(payload) {
    return {
        envolvido: payload.envolvido || payload.envolvido_encontrado || null,
        items: payload.items || [],
        totalPages: payload.totalPages || payload.paginator?.total_pages || 1,
    };
}

function guessUfFromSigla(sigla) {
    const match = String(sigla || '').toUpperCase().match(/([A-Z]{2})$/);
    return match ? match[1] : null;
}

function buildWeakEscavadorFromSummary(payload) {
    const envolvido = payload.envolvido || payload.envolvido_encontrado || {};
    const itemsSummary = Array.isArray(payload.items_summary) ? payload.items_summary : [];
    const processos = itemsSummary.slice(0, 12).map((item) => {
        const primaryFont = Array.isArray(item.fontes) && item.fontes.length > 0 ? item.fontes[0] : {};
        const titleAtivo = String(item.titulo_polo_ativo || '').toUpperCase();
        const titlePassivo = String(item.titulo_polo_passivo || '').toUpperCase();
        let tipoNormalizado = 'Outro';
        if (/JUSTI|MINISTERIO|JUSTIÇA|PÚBLICA/.test(titleAtivo) || /JUSTI|MINISTERIO|JUSTIÇA|PÚBLICA/.test(titlePassivo)) {
            tipoNormalizado = 'Reu';
        }
        return {
            numeroCnj: item.numero_cnj || null,
            area: primaryFont.area || null,
            tribunalSigla: primaryFont.sigla || null,
            processUf: guessUfFromSigla(primaryFont.sigla),
            processCity: null,
            hasExactCpfMatch: false,
            tipoNormalizado,
            polo: titlePassivo ? 'PASSIVO' : titleAtivo ? 'ATIVO' : null,
            matchDocumentoPor: 'NOME_EXATO_UNICO',
        };
    });

    const criminalCount = processos.filter((processo) => /crim|penal/i.test(processo.area || '')).length;
    return {
        escavadorProcessTotal: envolvido.quantidade_processos || payload.totalItems || processos.length,
        escavadorCriminalFlag: criminalCount > 0 ? 'POSITIVE' : 'NEGATIVE',
        escavadorCriminalCount: criminalCount,
        escavadorActiveCount: 0,
        escavadorCpfsComEsseNome: envolvido.cpfs_com_esse_nome || 0,
        escavadorHomonymFlag: (envolvido.cpfs_com_esse_nome || 0) > 1,
        escavadorProcessos: processos,
        escavadorNotes: `Escavador resumo por homonimos: ${processos.length} processos analisados offline.`,
    };
}

function buildCaseBase({ candidateName, cpf, hiringUf, city, ddd, allUfs = [hiringUf] }) {
    return {
        candidateName,
        cpf,
        hiringUf,
        enrichmentContact: {
            primaryUf: allUfs[0],
            allUfs,
            phones: ddd ? [`(${ddd}) 99999-0000`] : [],
            addresses: city ? [`RUA TESTE, 100, CENTRO, ${city}, ${allUfs[0]}, 00000-000`] : [],
        },
        juditAllUfs: allUfs,
        escavadorEnrichmentStatus: 'DONE',
        juditEnrichmentStatus: 'DONE',
    };
}

function buildAndreCase() {
    const cpf = '48052053854';
    const judit = normalizeJuditLawsuits(adaptJuditLawsuits(loadJson('results', 'judit_lawsuits_1_andre.json')), cpf);
    const escavadorWeak = buildWeakEscavadorFromSummary(loadJson('results', 'missing', 'esc_1_cpf_homonimos.json'));
    return {
        ...buildCaseBase({
            candidateName: 'ANDRE LUIZ CRUZ DOS SANTOS',
            cpf,
            hiringUf: 'SP',
            city: 'SANTOS',
            ddd: '13',
        }),
        ...judit,
        ...escavadorWeak,
    };
}

function buildDiegoCase() {
    const cpf = '10794180329';
    const judit = normalizeJuditLawsuits(adaptJuditLawsuits(loadJson('results', 'judit_lawsuits_2_diego.json')), cpf);
    const escavador = normalizeEscavadorProcessos(adaptEscavador(loadJson('results', 'escavador_2_diego.json')), cpf);
    return {
        ...buildCaseBase({
            candidateName: 'DIEGO EMANUEL ALVES DE SOUZA',
            cpf,
            hiringUf: 'CE',
            city: 'FORTALEZA',
            ddd: '85',
        }),
        ...judit,
        ...escavador,
    };
}

function buildDiegoJuditOnlyCase() {
    return {
        ...buildCaseBase({
            candidateName: 'DIEGO EMANUEL ALVES DE SOUZA',
            cpf: '10794180329',
            hiringUf: 'CE',
            city: 'FORTALEZA',
            ddd: '85',
        }),
        ...normalizeJuditLawsuits(
            adaptJuditLawsuits(loadJson('results', 'judit_lawsuits_2_diego.json')),
            '10794180329',
        ),
        escavadorEnrichmentStatus: 'PENDING',
        escavadorProcessTotal: 0,
        escavadorCriminalCount: 0,
        escavadorActiveCount: 0,
        escavadorCpfsComEsseNome: 0,
        escavadorHomonymFlag: false,
        escavadorProcessos: [],
        escavadorNotes: '',
    };
}

function buildCleanZeroEvidenceCase() {
    return {
        ...buildCaseBase({
            candidateName: 'CANDIDATO SEM APONTAMENTO',
            cpf: '12345678909',
            hiringUf: 'SP',
            city: 'SAO PAULO',
            ddd: '11',
        }),
        juditEnrichmentStatus: 'DONE',
        juditProcessTotal: 0,
        juditCriminalCount: 0,
        juditProcessos: [],
        escavadorEnrichmentStatus: 'SKIPPED',
        escavadorProcessTotal: 0,
        escavadorCriminalCount: 0,
        escavadorProcessos: [],
        bigdatacorpEnrichmentStatus: 'DONE',
        bigdatacorpProcessTotal: 0,
        bigdatacorpCriminalCount: 0,
        bigdatacorpCriminalFlag: 'NEGATIVE',
        bigdatacorpProcessos: [],
        djenEnrichmentStatus: 'DONE',
        djenCriminalFlag: 'NEGATIVE',
        enrichmentStatus: 'SKIPPED',
    };
}

function buildCleanZeroEvidenceBdcBlockedCase() {
    return {
        ...buildCleanZeroEvidenceCase(),
        bigdatacorpEnrichmentStatus: 'BLOCKED',
        bigdatacorpProcessTotal: undefined,
        bigdatacorpCriminalCount: undefined,
        bigdatacorpCriminalFlag: undefined,
        enrichmentStatus: 'PENDING',
    };
}

function buildCaseWithJuditRole({ role, area = 'DIREITO PENAL', isCriminal = true, isLabor = false }) {
    return {
        ...buildCleanZeroEvidenceCase(),
        candidateName: `CASO JUDIT ${role}`,
        juditProcessTotal: 1,
        juditCriminalCount: isCriminal ? 1 : 0,
        juditRoleSummary: [{
            code: '0000000-00.2024.8.00.0000',
            area,
            personType: role,
            side: 'PASSIVO',
            hasExactCpfMatch: true,
            hasDivergentCpf: false,
            isCriminal,
            isLabor,
            isPossibleHomonym: false,
            subjects: isCriminal ? ['Roubo'] : ['Horas Extras'],
            classifications: isCriminal ? ['Ação Penal - Procedimento Ordinário'] : ['Ação Trabalhista - Rito Sumaríssimo'],
        }],
    };
}

function buildCaseWithBigDataCorpProcess({ role, courtType = 'CRIMINAL', isCriminal = true, isLabor = false }) {
    return {
        ...buildCleanZeroEvidenceCase(),
        candidateName: `CASO BDC ${role}`,
        bigdatacorpProcessTotal: 1,
        bigdatacorpCriminalCount: isCriminal ? 1 : 0,
        bigdatacorpLaborCount: isLabor ? 1 : 0,
        bigdatacorpCriminalFlag: isCriminal ? 'POSITIVE' : 'NEGATIVE',
        bigdatacorpLaborFlag: isLabor ? 'POSITIVE' : 'NEGATIVE',
        bigdatacorpProcessos: [{
            numero: '0000000-00.2024.8.00.0000',
            courtType,
            cnjBroadSubject: isCriminal ? 'DIREITO PENAL' : 'DIREITO DO TRABALHO',
            cnjSubject: isCriminal ? 'Roubo' : 'Horas Extras',
            cnjProcedure: isCriminal ? 'Apelação Criminal' : 'Recurso Ordinário Trabalhista',
            specificRole: role,
            isDirectCpfMatch: true,
            isCriminal,
            isLabor,
        }],
    };
}

function buildRenanCase() {
    const cpf = '11819916766';
    const judit = normalizeJuditLawsuits(adaptJuditLawsuits(loadJson('results', 'judit_lawsuits_3_renan.json')), cpf);
    const escavador = normalizeEscavadorProcessos(adaptEscavador(loadJson('results', 'escavador_3_renan.json')), cpf);
    return {
        ...buildCaseBase({
            candidateName: 'RENAN GUIMARAES DE SOUSA AUGUSTO',
            cpf,
            hiringUf: 'RJ',
            city: 'RIO DE JANEIRO',
            ddd: '21',
        }),
        ...judit,
        ...escavador,
    };
}

function buildFranciscoCase() {
    const cpf = '05023290336';
    const judit = normalizeJuditLawsuits(adaptJuditLawsuits(loadJson('results', 'judit_lawsuits_4_francisco.json')), cpf);
    const warrants = normalizeJuditWarrants(adaptJuditWarrants(loadJson('results', 'judit_warrant_4_francisco.json')));
    const executions = normalizeJuditExecution(adaptJuditExecution(loadJson('results', 'missing', 'judit_4_execucao_penal.json')));
    const escavador = normalizeEscavadorProcessos(adaptEscavador(loadJson('results', 'escavador_4_francisco.json')), cpf);
    return {
        ...buildCaseBase({
            candidateName: 'FRANCISCO TACIANO DE SOUSA',
            cpf,
            hiringUf: 'CE',
            city: 'SOBRAL',
            ddd: '88',
        }),
        ...judit,
        ...warrants,
        ...executions,
        ...escavador,
    };
}

function buildMatheusCase() {
    const cpf = '46247243804';
    const judit = normalizeJuditLawsuits(adaptJuditLawsuits(loadJson('results', 'judit_lawsuits_5_matheus.json')), cpf);
    const warrants = normalizeJuditWarrants(adaptJuditWarrants(loadJson('results', 'judit_warrant_5_matheus.json')));
    const escavadorWeak = buildWeakEscavadorFromSummary(loadJson('results', 'missing', 'esc_5_cpf_homonimos.json'));
    return {
        ...buildCaseBase({
            candidateName: 'MATHEUS GONCALVES DOS SANTOS',
            cpf,
            hiringUf: 'SP',
            city: 'SAO PAULO',
            ddd: '11',
            allUfs: ['SP', 'PR'],
        }),
        ...judit,
        ...warrants,
        ...escavadorWeak,
    };
}

describe('offline calibration with the 5 reference CPFs', () => {
    it('Andre stays ambiguous and recommends manual review', () => {
        const caseData = buildAndreCase();
        const homonymInput = buildHomonymAnalysisInput(caseData);
        const classification = computeAutoClassification(caseData);

        expect(homonymInput.needsAnalysis).toBe(true);
        expect(homonymInput.providerCoverage.overall.level).toBe('LOW_COVERAGE');
        expect(classification.criminalFlag).toBe('INCONCLUSIVE');
        expect(classification.criminalEvidenceQuality).toBe('WEAK_NAME_ONLY');
        expect(classification.reviewRecommended).toBe(true);
    });

    it('Diego remains low risk with partial negative coverage and no homonym analysis', () => {
        const caseData = buildDiegoCase();
        const homonymInput = buildHomonymAnalysisInput(caseData);
        const classification = computeAutoClassification(caseData);

        expect(homonymInput.needsAnalysis).toBe(false);
        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.criminalEvidenceQuality).toBe('NEGATIVE_WITH_PARTIAL_COVERAGE');
        expect(classification.coverageLevel).toBe('PARTIAL_COVERAGE');
        expect(classification.laborFlag).toBe('NEGATIVE');
    });

    it('Renan preserves the witness reading and does not trigger homonym analysis', () => {
        const caseData = buildRenanCase();
        const homonymInput = buildHomonymAnalysisInput(caseData);
        const classification = computeAutoClassification(caseData);

        expect(homonymInput.needsAnalysis).toBe(false);
        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.laborFlag).toBe('NEGATIVE');
        expect(classification.criminalNotes).toMatch(/baixo risco|testemunha/i);
    });

    it('Francisco keeps hard facts and never gets relativized by homonym logic', () => {
        const caseData = buildFranciscoCase();
        const homonymInput = buildHomonymAnalysisInput(caseData);
        const classification = computeAutoClassification(caseData);

        expect(homonymInput.needsAnalysis).toBe(false);
        expect(classification.criminalFlag).toBe('POSITIVE');
        expect(classification.warrantFlag).toBe('POSITIVE');
        expect(classification.criminalSeverity).toBe('HIGH');
        expect(classification.reviewRecommended).toBe(false);
    });

    it('Matheus keeps the exact CPF hit while isolating noisy name-based evidence', () => {
        const caseData = buildMatheusCase();
        const homonymInput = buildHomonymAnalysisInput(caseData);
        const classification = computeAutoClassification(caseData);

        expect(homonymInput.needsAnalysis).toBe(true);
        expect(homonymInput.providerCoverage.overall.level).toBe('PARTIAL_COVERAGE');
        expect(classification.criminalFlag).toBe('POSITIVE');
        expect(classification.criminalEvidenceQuality).toBe('MIXED_STRONG_AND_WEAK');
        expect(classification.criminalNotes).toMatch(/ambigua|fraco|nome/i);
    });

    it('safety net becomes eligible for suspicious low-coverage negatives before Escavador runs', () => {
        const caseData = buildDiegoJuditOnlyCase();
        const classification = computeAutoClassification(caseData);
        const safetyNet = evaluateNegativePartialSafetyNet(caseData, classification);

        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.criminalEvidenceQuality).toBe('NEGATIVE_WITH_PARTIAL_COVERAGE');
        expect(safetyNet.eligible).toBe(true);
        expect(safetyNet.action).toBe('RUN_ESCAVADOR');
        expect(safetyNet.reasons).toContain('LOW_COVERAGE');
        expect(safetyNet.reasons).toContain('JUDIT_ZERO_PROCESS');
    });

    it('classifies completed zero-evidence provider returns as no criminal finding', () => {
        const caseData = buildCleanZeroEvidenceCase();
        const classification = computeAutoClassification(caseData);
        const safetyNet = evaluateNegativePartialSafetyNet(caseData, classification);

        expect(classification.coverageLevel).toBe('LOW_COVERAGE');
        expect(classification.coverageNotes).toContain('Nenhum provider retornou processo aproveitavel.');
        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.criminalEvidenceQuality).toBe('CONFIRMED_NEGATIVE');
        expect(safetyNet.eligible).toBe(false);
    });

    it('keeps zero-evidence cases negative when BigDataCorp is blocked but no process provider returned evidence', () => {
        const caseData = buildCleanZeroEvidenceBdcBlockedCase();
        const classification = computeAutoClassification(caseData);
        const safetyNet = evaluateNegativePartialSafetyNet(caseData, classification);

        expect(classification.coverageLevel).toBe('LOW_COVERAGE');
        expect(classification.coverageNotes).toContain('Nenhum provider retornou processo aproveitavel.');
        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.criminalEvidenceQuality).toBe('CONFIRMED_NEGATIVE');
        expect(classification.criminalNotes).toContain('Criminal SEM APONTAMENTO');
        expect(classification.laborFlag).toBe('NEGATIVE');
        expect(classification.laborNotes).toContain('Nao foram identificados processos trabalhistas materiais');
        expect(safetyNet.eligible).toBe(false);
    });

    it('safety net stays off when Escavador already ran or hard facts exist', () => {
        const diegoSafetyNet = evaluateNegativePartialSafetyNet(buildDiegoCase(), computeAutoClassification(buildDiegoCase()));
        const franciscoSafetyNet = evaluateNegativePartialSafetyNet(buildFranciscoCase(), computeAutoClassification(buildFranciscoCase()));

        expect(diegoSafetyNet.eligible).toBe(false);
        expect(franciscoSafetyNet.eligible).toBe(false);
        expect(franciscoSafetyNet.action).toBe('NONE');
    });

    it('AI prompts carry the new coverage and ambiguous-evidence semantics', () => {
        const andreCase = buildAndreCase();
        const andrePrompt = buildAiPrompt({
            ...andreCase,
            ...computeAutoClassification(andreCase),
        });
        const matheusHomonymPrompt = buildAiHomonymPrompt(buildHomonymAnalysisInput(buildMatheusCase()));

        expect(andrePrompt).toMatch(/Cobertura das fontes/);
        expect(andrePrompt).toMatch(/Qualidade da evidencia criminal/);
        expect(matheusHomonymPrompt).toMatch(/AMBIGUOUS_EVIDENCE_ONLY/);
        expect(matheusHomonymPrompt).toMatch(/referenceCandidates/);
        expect(matheusHomonymPrompt).toMatch(/ambiguousCandidates/);
    });
});

describe('audit metadata sanitization', () => {
    it('removes Firestore sentinel-like values from nested metadata', () => {
        const sentinel = { _methodName: 'FieldValue.delete' };

        expect(sanitizeAuditMetadataValue(sentinel)).toBeNull();
        expect(sanitizeAuditMetadataValue({ decision: sentinel, confidence: 'LOW' })).toEqual({
            decision: null,
            confidence: 'LOW',
        });
    });
});

describe('conclusion final flag validation', () => {
    it('rejeita flag criminal consultiva na conclusao', () => {
        expect(() => validateConcludeFinalFlags({ criminalFlag: 'INCONCLUSIVE_HOMONYM' })).toThrow(
            /resultado criminal final/i,
        );
        expect(() => validateConcludeFinalFlags({ criminalFlag: 'NEGATIVE' })).not.toThrow();
        expect(() => validateConcludeFinalFlags({ criminalFlag: 'POSITIVE' })).not.toThrow();
        expect(() => validateConcludeFinalFlags({ criminalFlag: 'INCONCLUSIVE' })).not.toThrow();
    });
});

describe('DJEN integration in computeAutoClassification', () => {
    it('DJEN criminal isolado nao altera flag criminal nem notas finais', () => {
        const caseData = {
            ...buildCleanZeroEvidenceCase(),
            djenEnrichmentStatus: 'DONE',
            djenCriminalFlag: 'POSITIVE',
            djenCriminalCount: 3,
            djenLaborFlag: false,
            djenComunicacoes: [{ area: 'criminal', numeroProcesso: '0001111-11.2026.8.26.0001' }],
        };
        const classification = computeAutoClassification(caseData);

        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.criminalNotes).not.toContain('DJEN');
    });

    it('djenCriminalFlag NEGATIVE does not turn criminal positive alone', () => {
        const caseData = {
            djenEnrichmentStatus: 'DONE',
            djenCriminalFlag: 'NEGATIVE',
            djenCriminalCount: 0,
        };
        const classification = computeAutoClassification(caseData);

        expect(classification.criminalFlag).not.toBe('POSITIVE');
    });

    it('DJEN trabalhista isolado nao altera flag trabalhista nem notas finais', () => {
        const caseData = {
            ...buildCleanZeroEvidenceCase(),
            djenEnrichmentStatus: 'DONE',
            djenCriminalFlag: 'NEGATIVE',
            djenLaborFlag: true,
            djenLaborCount: 2,
            djenComunicacoes: [{ area: 'trabalhista', numeroProcesso: '0002222-22.2026.5.12.0001' }],
        };
        const classification = computeAutoClassification(caseData);

        expect(classification.laborFlag).toBe('NEGATIVE');
        expect(classification.laborNotes).not.toContain('DJEN');
    });

    it('DJEN not done does not contribute to classification', () => {
        const caseData = {
            djenEnrichmentStatus: 'PENDING',
            djenCriminalFlag: 'POSITIVE',
            djenCriminalCount: 5,
        };
        const classification = computeAutoClassification(caseData);

        // djenCriminal should be false because djenDone is false
        expect(classification.criminalNotes || '').not.toContain('DJEN');
    });

    it('DJEN POSITIVE com muitos homonimos nao torna criminal inconclusivo', () => {
        const caseData = {
            ...buildCleanZeroEvidenceCase(),
            djenEnrichmentStatus: 'DONE',
            djenCriminalFlag: 'POSITIVE',
            djenCriminalCount: 47,
            djenLaborFlag: false,
            bigdatacorpNamesakeCount: 304,
            djenComunicacoes: [{ area: 'criminal', numeroProcesso: '0003333-33.2026.8.26.0001' }],
        };
        const classification = computeAutoClassification(caseData);

        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.reviewRecommended).toBe(false);
        expect(classification.criminalNotes).not.toContain('DJEN');
    });

    it('DJEN POSITIVE com poucos homonimos tambem permanece consultivo', () => {
        const caseData = {
            ...buildCleanZeroEvidenceCase(),
            djenEnrichmentStatus: 'DONE',
            djenCriminalFlag: 'POSITIVE',
            djenCriminalCount: 3,
            djenLaborFlag: false,
            bigdatacorpNamesakeCount: 5,
            djenComunicacoes: [{ area: 'criminal', numeroProcesso: '0004444-44.2026.8.26.0001' }],
        };
        const classification = computeAutoClassification(caseData);

        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.criminalNotes).not.toContain('DJEN');
    });
});

describe('real role semantics for auto classification', () => {
    it('classifies Judit criminal RÉU with exact CPF as positive', () => {
        const classification = computeAutoClassification(buildCaseWithJuditRole({ role: 'RÉU' }));

        expect(classification.criminalFlag).toBe('POSITIVE');
        expect(classification.criminalEvidenceQuality).toBe('HARD_FACT');
    });

    it('keeps Judit criminal VÍTIMA with exact CPF as low-risk negative', () => {
        const classification = computeAutoClassification(buildCaseWithJuditRole({ role: 'VÍTIMA' }));

        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.criminalEvidenceQuality).toBe('LOW_RISK_ROLE_ONLY');
    });

    it('classifies BigDataCorp criminal APELANTE with exact CPF as positive', () => {
        const classification = computeAutoClassification(buildCaseWithBigDataCorpProcess({ role: 'APELANTE' }));

        expect(classification.criminalFlag).toBe('POSITIVE');
    });

    it('keeps BigDataCorp criminal TESTEMUNHA DO JUÍZO with exact CPF as low-risk negative', () => {
        const classification = computeAutoClassification(buildCaseWithBigDataCorpProcess({ role: 'TESTEMUNHA DO JUÍZO' }));

        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.criminalEvidenceQuality).toBe('LOW_RISK_ROLE_ONLY');
    });

    it('classifies BigDataCorp labor RECORRENTE with exact CPF as positive', () => {
        const classification = computeAutoClassification(buildCaseWithBigDataCorpProcess({
            role: 'RECORRENTE',
            courtType: 'TRABALHISTA',
            isCriminal: false,
            isLabor: true,
        }));

        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.laborFlag).toBe('POSITIVE');
    });

    it('keeps BigDataCorp labor RECLAMADO with exact CPF as negative', () => {
        const classification = computeAutoClassification(buildCaseWithBigDataCorpProcess({
            role: 'RECLAMADO',
            courtType: 'TRABALHISTA',
            isCriminal: false,
            isLabor: true,
        }));

        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.laborFlag).toBe('NEGATIVE');
    });
});

function buildCpfPendingRegularizationCase() {
    return {
        ...buildCleanZeroEvidenceCase(),
        enrichmentGateResult: {
            passed: true,
            cpfStatus: 'PENDENTE DE REGULARIZACAO',
            cpfPendingRegularization: true,
            nameSimilarity: 1.0,
            nameProvided: 'CANDIDATO SEM APONTAMENTO',
            nameFound: 'CANDIDATO SEM APONTAMENTO',
            hasDeathRecord: false,
            reason: null,
            consultedAt: new Date().toISOString(),
        },
    };
}

function buildCpfPendingRegularizationBdcCase() {
    return {
        ...buildCleanZeroEvidenceCase(),
        bigdatacorpGateResult: {
            passed: true,
            cpfStatus: 'PENDENTE DE REGULARIZACAO',
            cpfPendingRegularization: true,
            nameSimilarity: 1.0,
            nameProvided: 'CANDIDATO SEM APONTAMENTO',
            nameFound: 'CANDIDATO SEM APONTAMENTO',
            hasDeathRecord: false,
            reason: 'OK',
            source: 'bigdatacorp-basicdata',
            consultedAt: new Date().toISOString(),
        },
    };
}

describe('CPF PENDENTE DE REGULARIZACAO gate handling', () => {
    it('FonteData gate passes for PENDENTE DE REGULARIZACAO and flags attention', () => {
        const caseData = buildCpfPendingRegularizationCase();
        const classification = computeAutoClassification(caseData);

        expect(classification.cpfPendingRegularization).toBe(true);
        expect(classification.cpfPendingNotes).toContain('pendente de regularizacao');
        expect(classification.criminalNotes).toContain('pendente de regularizacao');
        expect(classification.criminalFlag).toBe('NEGATIVE');
    });

    it('BigDataCorp gate passes for PENDENTE DE REGULARIZACAO and flags attention', () => {
        const caseData = buildCpfPendingRegularizationBdcCase();
        const classification = computeAutoClassification(caseData);

        expect(classification.cpfPendingRegularization).toBe(true);
        expect(classification.cpfPendingNotes).toContain('pendente de regularizacao');
        expect(classification.criminalNotes).toContain('pendente de regularizacao');
        expect(classification.criminalFlag).toBe('NEGATIVE');
    });

    it('buildExpandedKeyFindings includes CPF pending regularization alert', () => {
        const caseData = buildCpfPendingRegularizationCase();
        const { buildExpandedKeyFindings } = __test;
        const findings = buildExpandedKeyFindings(caseData, {});

        expect(findings).toContain('CPF com situacao cadastral pendente de regularizacao na Receita Federal.');
    });

    it('CPF pending regularization does not trigger reviewRecommended by itself', () => {
        const caseData = buildCpfPendingRegularizationCase();
        const classification = computeAutoClassification(caseData);

        expect(classification.reviewRecommended).toBe(false);
        expect(classification.criminalFlag).toBe('NEGATIVE');
        expect(classification.laborFlag).toBe('NEGATIVE');
    });
});

describe('AI classification review prompt', () => {
    it('builds a prompt focused on auditing the deterministic autoclassification', () => {
        const prompt = buildAiClassificationReviewPrompt({
            id: 'case-review-1',
            candidateName: 'Arthur Silva de Oliveira',
            cpf: '09012345605',
            candidatePosition: 'Operador',
            hiringUf: 'BA',
            criminalFlag: 'POSITIVE',
            criminalSeverity: 'HIGH',
            laborFlag: 'NEGATIVE',
            warrantFlag: 'NEGATIVE',
            coverageLevel: 'HIGH_COVERAGE',
            providerDivergence: 'MEDIUM',
            criminalEvidenceQuality: 'MIXED_STRONG_AND_WEAK',
            reviewRecommended: true,
            juditRoleSummary: [{
                code: '8002101-63.2025.8.05.0265',
                area: 'DIREITO PENAL',
                personType: 'RÉU',
                side: 'PASSIVO',
                hasExactCpfMatch: true,
                isCriminal: true,
                isDefendant: true,
                subjects: ['Apropriacao indebita'],
            }],
            bigdatacorpProcessos: [{
                numero: '80021016320258050265',
                isCriminal: true,
                isDirectCpfMatch: true,
                specificRole: 'REU',
                matchType: 'DOC',
                assunto: 'APROPRIACAO INDEBITA',
            }],
            djenComunicacoes: [{
                area: 'trabalhista',
                classe: 'AGRAVO REGIMENTAL TRABALHISTA',
                polo: 'A',
                isDefendant: false,
                probabilityScore: 55,
                matchType: 'NAME_EXACT',
            }],
            aiHomonymStructuredOk: true,
            aiHomonymStructured: {
                decision: 'UNCERTAIN',
                confidence: 'LOW',
                homonymRisk: 'MEDIUM',
                justification: 'Dados insuficientes para descartar totalmente homonimia em achados por nome.',
                evidenceFor: [],
                evidenceAgainst: [],
                unknowns: ['Sem CPF no achado DJEN.'],
                recommendedAction: 'MANUAL_REVIEW',
            },
        });

        expect(prompt).toContain('Revise a autoclassificacao deterministica');
        expect(prompt).toContain('"criminalFlag": "POSITIVE"');
        expect(prompt).toContain('"laborFlag": "NEGATIVE"');
        expect(prompt).toContain('"warrantFlag": "NEGATIVE"');
        expect(prompt).toContain('090.***.***-05');
        expect(prompt).toContain('"hasExactCpfMatch": true');
        expect(prompt).toContain('"isDirectCpfMatch": true');
        expect(prompt).toContain('"djen"');
        expect(prompt).toContain('"homonymReview"');
    });

    it('treats consulted sources with zero labor and warrant findings as valid negative evidence', () => {
        const context = buildAiClassificationReviewContext({
            criminalFlag: 'NEGATIVE',
            laborFlag: 'NEGATIVE',
            warrantFlag: 'NEGATIVE',
            coverageLevel: 'HIGH_COVERAGE',
            bigdatacorpEnrichmentStatus: 'DONE',
            bigdatacorpLaborCount: 0,
            bigdatacorpDirectLaborCount: 0,
            bigdatacorpActiveWarrants: [],
            juditEnrichmentStatus: 'DONE',
            juditActiveWarrantCount: 0,
            juditWarrants: [],
            djenEnrichmentStatus: 'DONE',
            djenLaborFlag: 'NEGATIVE',
            djenComunicacoes: [],
        });

        expect(context.labor.sourceCoverageStatus).toBe('COMPLETE');
        expect(context.labor.zeroFindingSources).toContain('BigDataCorp');
        expect(context.labor.shouldRequireCaution).toBe(false);
        expect(context.warrant.sourceCoverageStatus).toBe('COMPLETE');
        expect(context.warrant.zeroFindingSources).toContain('Judit');
        expect(context.warrant.zeroFindingSources).toContain('BigDataCorp');
        expect(context.warrant.shouldRequireCaution).toBe(false);
    });

    it('removes generic caution from negative axes when axis context has complete zero findings', () => {
        const review = {
            summary: 'Caso sem achados materiais nas fontes consultadas.',
            identityAssessment: { status: 'CONFIRMED', rationale: 'Identidade confirmada.', homonymRisk: 'LOW' },
            classificationValidation: {
                criminal: {
                    autoFlag: 'NEGATIVE',
                    assessment: 'AGREE_WITH_CAUTION',
                    evidenceStrength: 'MIXED',
                    rationale: 'Ha divergencia criminal a revisar.',
                    possibleErrors: ['Confirmar papel processual criminal.'],
                },
                labor: {
                    autoFlag: 'NEGATIVE',
                    assessment: 'AGREE_WITH_CAUTION',
                    evidenceStrength: 'WEAK',
                    rationale: 'Ainda assim, a cobertura e parcial e nao ha detalhamento alem do retornado.',
                    possibleErrors: ['Cobertura parcial pode esconder achados.'],
                },
                warrant: {
                    autoFlag: 'NEGATIVE',
                    assessment: 'AGREE_WITH_CAUTION',
                    evidenceStrength: 'WEAK',
                    rationale: 'Pode haver mandado em outra base.',
                    possibleErrors: ['Revisar cobertura.'],
                },
            },
            inconsistencies: [],
            manualReviewPoints: [],
            consultativeSuggestion: { action: 'REVIEW_BEFORE_CONCLUDING', rationale: 'Revisar cautelas.' },
            confidence: 'MEDIUM',
        };
        const guarded = applyAiClassificationReviewGuardrails(review, {
            criminalFlag: 'NEGATIVE',
            laborFlag: 'NEGATIVE',
            warrantFlag: 'NEGATIVE',
            providerDivergence: 'MEDIUM',
            coverageLevel: 'HIGH_COVERAGE',
            bigdatacorpEnrichmentStatus: 'DONE',
            bigdatacorpCriminalFlag: 'NEGATIVE',
            bigdatacorpCriminalCount: 0,
            bigdatacorpLaborFlag: 'NEGATIVE',
            bigdatacorpLaborCount: 0,
            bigdatacorpDirectLaborCount: 0,
            bigdatacorpActiveWarrants: [],
            juditEnrichmentStatus: 'DONE',
            juditCriminalFlag: 'POSITIVE',
            juditCriminalCount: 1,
            juditRoleSummary: [{ isCriminal: true, isVictim: true, isDefendant: false, personType: 'VITIMA' }],
            juditActiveWarrantCount: 0,
            juditWarrants: [],
            djenEnrichmentStatus: 'DONE',
            djenLaborFlag: 'NEGATIVE',
            djenComunicacoes: [],
        });

        expect(guarded.classificationValidation.criminal.assessment).toBe('AGREE_WITH_CAUTION');
        expect(guarded.classificationValidation.labor.assessment).toBe('AGREE');
        expect(guarded.classificationValidation.labor.evidenceStrength).toBe('STRONG');
        expect(guarded.classificationValidation.labor.possibleErrors).toEqual([]);
        expect(guarded.classificationValidation.warrant.assessment).toBe('AGREE');
        expect(guarded.classificationValidation.warrant.evidenceStrength).toBe('STRONG');
        expect(guarded.classificationValidation.warrant.possibleErrors).toEqual([]);
    });

    it('validates and sanitizes a structured classification review response', () => {
        const content = JSON.stringify({
            summary: 'Caso com criminal positivo confirmado por CPF e mandado negativo.',
            identityAssessment: {
                status: 'confirmed',
                rationale: 'Nome e CPF compatíveis nas fontes principais.',
                homonymRisk: 'low',
            },
            classificationValidation: {
                criminal: {
                    autoFlag: 'positive',
                    assessment: 'agree_with_caution',
                    evidenceStrength: 'mixed',
                    rationale: 'Ha fato forte por CPF, mas divergencia de quantidade entre fontes.',
                    possibleErrors: ['Processos podem estar duplicados entre fontes.'],
                },
                labor: {
                    autoFlag: 'negative',
                    assessment: 'agree',
                    evidenceStrength: 'weak',
                    rationale: 'Nao ha evidencia trabalhista material; DJEN por nome e fraco.',
                    possibleErrors: [],
                },
                warrant: {
                    autoFlag: 'negative',
                    assessment: 'agree',
                    evidenceStrength: 'strong',
                    rationale: 'Nao ha mandado ativo confirmado.',
                    possibleErrors: [],
                },
            },
            inconsistencies: ['Divergencia media entre fontes sobre quantidade de processos.'],
            manualReviewPoints: ['Confirmar papel processual material.', 'Verificar duplicidade entre fontes.'],
            consultativeSuggestion: {
                action: 'review_before_concluding',
                rationale: 'Manter flags, com revisao manual antes da conclusao.',
            },
            confidence: 'medium',
        });

        const parsed = parseAiClassificationReviewResponse(content);

        expect(parsed.ok).toBe(true);
        expect(parsed.structured.identityAssessment.status).toBe('CONFIRMED');
        expect(parsed.structured.classificationValidation.criminal.assessment).toBe('AGREE_WITH_CAUTION');
        expect(parsed.structured.consultativeSuggestion.action).toBe('REVIEW_BEFORE_CONCLUDING');
        expect(validateAiClassificationReviewSchema(parsed.structured)).toBe(true);
    });

    it('rejects classification review responses without per-axis validation', () => {
        const parsed = parseAiClassificationReviewResponse(JSON.stringify({
            summary: 'Resumo sem validacao por eixo.',
            identityAssessment: { status: 'CONFIRMED', rationale: 'OK', homonymRisk: 'LOW' },
            classificationValidation: {},
            inconsistencies: [],
            manualReviewPoints: [],
            consultativeSuggestion: { action: 'MAINTAIN_AUTOCLASSIFICATION', rationale: 'OK' },
            confidence: 'HIGH',
        }));

        expect(parsed.ok).toBe(false);
    });

    it('does not turn malformed classification review JSON into raw summary', () => {
        const content = `{
            "summary": "Judit indicou processo penal, mas o papel aparece como "vitima" e exige revisao.",
            "identityAssessment": { "status": "CONFIRMED", "rationale": "CPF confirmado.", "homonymRisk": "LOW" },
            "classificationValidation": {}
        }`;

        const parsed = parseAiClassificationReviewResponse(content);

        expect(parsed.ok).toBe(false);
        expect(parsed.structured).toBeNull();
    });

    it('removes technical payload terms from classification review narratives', () => {
        const parsed = parseAiClassificationReviewResponse(JSON.stringify({
            summary: 'criminalFlag NEGATIVE com providerDivergence=MEDIUM.',
            identityAssessment: {
                status: 'CONFIRMED',
                rationale: 'hasExactCpfMatch=true no payload.',
                homonymRisk: 'LOW',
            },
            classificationValidation: {
                criminal: {
                    autoFlag: 'NEGATIVE',
                    assessment: 'AGREE_WITH_CAUTION',
                    evidenceStrength: 'MIXED',
                    rationale: 'isCriminal=true mas isDefendant=false.',
                    possibleErrors: ['possibleErrors: campo tecnico nao deve aparecer.'],
                },
                labor: {
                    autoFlag: 'NEGATIVE',
                    assessment: 'AGREE',
                    evidenceStrength: 'STRONG',
                    rationale: 'Nao ha achado trabalhista material nas fontes consultadas.',
                    possibleErrors: [],
                },
                warrant: {
                    autoFlag: 'NEGATIVE',
                    assessment: 'AGREE',
                    evidenceStrength: 'STRONG',
                    rationale: 'Nao ha mandado ativo confirmado.',
                    possibleErrors: [],
                },
            },
            inconsistencies: ['classificationValidation: payload tecnico vazou.'],
            manualReviewPoints: ['Confirmar criterio operacional do processo penal arquivado.'],
            consultativeSuggestion: {
                action: 'REVIEW_BEFORE_CONCLUDING',
                rationale: '{"summary":"payload bruto"}',
            },
            confidence: 'MEDIUM',
        }));

        expect(parsed.ok).toBe(true);
        expect(parsed.structured.summary).toBe('');
        expect(parsed.structured.identityAssessment.rationale).toBe('');
        expect(parsed.structured.classificationValidation.criminal.rationale).toBe('');
        expect(parsed.structured.classificationValidation.criminal.possibleErrors).toEqual([]);
        expect(parsed.structured.inconsistencies).toEqual([]);
        expect(parsed.structured.consultativeSuggestion.rationale).toBe('');
        expect(parsed.structured.manualReviewPoints).toEqual(['Confirmar criterio operacional do processo penal arquivado.']);
    });
});
