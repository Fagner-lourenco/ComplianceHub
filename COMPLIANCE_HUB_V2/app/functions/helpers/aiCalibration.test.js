import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

process.env.FUNCTIONS_EMULATOR = 'true';

const require = createRequire(import.meta.url);
const { normalizeEscavadorProcessos } = require('../normalizers/escavador');
const {
    normalizeJuditExecution,
    normalizeJuditLawsuits,
    normalizeJuditWarrants,
} = require('../normalizers/judit');
const { buildHomonymAnalysisInput } = require('./aiHomonym');
const { __test } = require('../__test-helpers');

const {
    computeAutoClassification,
    buildAiPrompt,
    buildAiHomonymPrompt,
    evaluateNegativePartialSafetyNet,
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
        expect(classification.criminalFlag).toBe('INCONCLUSIVE_HOMONYM');
        expect(classification.reviewRecommended).toBe(true);
    });

    it('Diego remains low risk with partial negative coverage and no homonym analysis', () => {
        const caseData = buildDiegoCase();
        const homonymInput = buildHomonymAnalysisInput(caseData);
        const classification = computeAutoClassification(caseData);

        expect(homonymInput.needsAnalysis).toBe(false);
        expect(classification.criminalFlag).toBe('NEGATIVE_PARTIAL');
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

        expect(classification.criminalFlag).toBe('INCONCLUSIVE_LOW_COVERAGE');
        expect(safetyNet.eligible).toBe(true);
        expect(safetyNet.action).toBe('RUN_ESCAVADOR');
        expect(safetyNet.reasons).toContain('LOW_COVERAGE');
        expect(safetyNet.reasons).toContain('JUDIT_ZERO_PROCESS');
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

describe('DJEN integration in computeAutoClassification', () => {
    it('djenCriminalFlag POSITIVE contributes to criminalFlag POSITIVE', () => {
        const caseData = {
            djenEnrichmentStatus: 'DONE',
            djenCriminalFlag: 'POSITIVE',
            djenCriminalCount: 3,
            djenLaborFlag: false,
        };
        const classification = computeAutoClassification(caseData);

        expect(classification.criminalFlag).toBe('POSITIVE');
        expect(classification.criminalNotes).toContain('DJEN');
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

    it('djenLaborFlag true contributes to laborFlag POSITIVE', () => {
        const caseData = {
            djenEnrichmentStatus: 'DONE',
            djenCriminalFlag: 'NEGATIVE',
            djenLaborFlag: true,
            djenLaborCount: 2,
        };
        const classification = computeAutoClassification(caseData);

        expect(classification.laborFlag).toBe('POSITIVE');
        expect(classification.laborNotes).toContain('DJEN');
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

    it('DJEN POSITIVE with high namesake count is downgraded to weak evidence', () => {
        const caseData = {
            djenEnrichmentStatus: 'DONE',
            djenCriminalFlag: 'POSITIVE',
            djenCriminalCount: 47,
            djenLaborFlag: false,
            bigdatacorpNamesakeCount: 304,
        };
        const classification = computeAutoClassification(caseData);

        // DJEN alone with 304 namesakes should NOT produce POSITIVE
        expect(classification.criminalFlag).not.toBe('POSITIVE');
        expect(classification.criminalFlag).toBe('INCONCLUSIVE_HOMONYM');
        expect(classification.criminalNotes).toContain('homonimo');
    });

    it('DJEN POSITIVE with low namesake count remains strong evidence', () => {
        const caseData = {
            djenEnrichmentStatus: 'DONE',
            djenCriminalFlag: 'POSITIVE',
            djenCriminalCount: 3,
            djenLaborFlag: false,
            bigdatacorpNamesakeCount: 5,
        };
        const classification = computeAutoClassification(caseData);

        // 5 namesakes is within threshold — DJEN stays strong
        expect(classification.criminalFlag).toBe('POSITIVE');
        expect(classification.criminalNotes).toContain('DJEN');
    });
});
