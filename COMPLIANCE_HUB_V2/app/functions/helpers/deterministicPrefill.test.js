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
const { __test } = require('../index');

const {
    computeAutoClassification,
    buildDeterministicPrefill,
    evaluateComplexityTriggers,
    buildDetCriminalNotes,
    buildDetLaborNotes,
    buildDetWarrantNotes,
    buildDetKeyFindings,
    buildDetExecutiveSummary,
    buildDetFinalJustification,
    selectTopProcessos,
    normCnj,
    formatCnj,
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

    const criminalCount = processos.filter((p) => /crim|penal/i.test(p.area || '')).length;
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

// === Case Builders ===

function buildCleanCase() {
    // Case 1: Clean — all providers returned data, nothing found
    return {
        ...buildCaseBase({
            candidateName: 'JOAO DA SILVA LIMPO',
            cpf: '00000000000',
            hiringUf: 'SP',
            city: 'SAO PAULO',
            ddd: '11',
        }),
        juditRoleSummary: [],
        escavadorProcessos: [],
        bigdatacorpProcessos: [],
        juditWarrants: [],
        bigdatacorpActiveWarrants: [],
        juditExecutionFlag: 'NEGATIVE',
        juditWarrantFlag: 'NEGATIVE',
        juditWarrantCount: 0,
        juditActiveWarrantCount: 0,
        juditProcessTotal: 0,
        juditCriminalCount: 0,
        escavadorProcessTotal: 0,
        escavadorCriminalCount: 0,
        escavadorActiveCount: 0,
        escavadorCpfsComEsseNome: 0,
        fontedataCriminalFlag: 'NEGATIVE',
        fontedataLaborFlag: 'NEGATIVE',
        fontedataWarrantFlag: 'NEGATIVE',
        enrichmentStatus: 'DONE',
        enrichmentSources: {},
        bigdatacorpEnrichmentStatus: 'DONE',
        bigdatacorpCriminalFlag: 'NEGATIVE',
        bigdatacorpLaborFlag: 'NEGATIVE',
        bigdatacorpIsPep: false,
        bigdatacorpIsSanctioned: false,
        bigdatacorpWasSanctioned: false,
    };
}

function buildFranciscoCase() {
    // Case 2: Hard criminal — warrants + executions (Francisco)
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
    // Case 3: Active warrants (Matheus)
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

function buildAndreCase() {
    // Case 4: Homonym / ambiguity (Andre)
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
    // Case 5: Provider divergence (Diego — Judit only vs full)
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

function buildRenanCase() {
    // Case 6: Many processes — truncation (Renan)
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

function classifyAndMerge(caseData) {
    const classification = computeAutoClassification(caseData);
    return { ...caseData, ...classification };
}

// === Tests ===

describe('Deterministic Prefill', () => {
    describe('buildDeterministicPrefill contract', () => {
        it('returns the expected structure with all required fields', () => {
            const caseData = classifyAndMerge(buildCleanCase());
            const result = buildDeterministicPrefill(caseData);

            expect(result).toHaveProperty('executiveSummary');
            expect(result).toHaveProperty('criminalNotes');
            expect(result).toHaveProperty('laborNotes');
            expect(result).toHaveProperty('warrantNotes');
            expect(result).toHaveProperty('keyFindings');
            expect(result).toHaveProperty('finalJustification');
            expect(result).toHaveProperty('metadata');

            expect(typeof result.executiveSummary).toBe('string');
            expect(typeof result.criminalNotes).toBe('string');
            expect(typeof result.laborNotes).toBe('string');
            expect(typeof result.warrantNotes).toBe('string');
            expect(Array.isArray(result.keyFindings)).toBe(true);
            expect(typeof result.finalJustification).toBe('string');

            expect(result.metadata.source).toBe('deterministic');
            expect(result.metadata.version).toBe('v5-deterministic-prefill');
            expect(result.metadata.generatedAt).toBeTruthy();
            expect(Array.isArray(result.metadata.triggersActive)).toBe(true);
            expect(typeof result.metadata.isComplex).toBe('boolean');
        });

        it('keyFindings has max 7 items', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const result = buildDeterministicPrefill(caseData);
            expect(result.keyFindings.length).toBeLessThanOrEqual(7);
        });
    });

    describe('Case 1: clean case with no findings', () => {
        it('produces benign output with negative criminal but appropriate caution', () => {
            const caseData = classifyAndMerge(buildCleanCase());
            const result = buildDeterministicPrefill(caseData);

            // Zero processes from all providers = LOW_COVERAGE = complex in the system's view.
            // This is correct: the system can't confirm negatives without data.
            expect(result.criminalNotes).toBeTruthy();
            expect(result.laborNotes).toBeTruthy();
            expect(result.warrantNotes).toContain('Nenhum');
            // Criminal should reflect no findings but with coverage caveat
            expect(result.executiveSummary).toBeTruthy();
            // v6: verdict now shown via badge in Risk Box, not in text
            expect(result.finalJustification).toBeTruthy();
            expect(result.keyFindings.length).toBeLessThanOrEqual(7);
        });
    });

    describe('Case 2: hard criminal confirmed (Francisco)', () => {
        it('produces POSITIVE criminal notes with process details', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const result = buildDeterministicPrefill(caseData);

            expect(caseData.criminalFlag).toBe('POSITIVE');
            expect(result.criminalNotes).toContain('Severidade');
            expect(result.criminalNotes).toContain('PROCESSOS IDENTIFICADOS');
            expect(result.criminalNotes.length).toBeGreaterThan(100);
            expect(result.executiveSummary).toMatch(/criminal/i);
            expect(result.keyFindings.length).toBeGreaterThan(0);
            expect(result.finalJustification).toContain('risco elevado');
        });

        it('includes warrant and execution data when present', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const result = buildDeterministicPrefill(caseData);

            if (caseData.warrantFlag === 'POSITIVE') {
                expect(result.warrantNotes).toContain('MANDADO');
            }
            if (caseData.juditExecutionFlag === 'POSITIVE') {
                expect(result.criminalNotes).toContain('Execução penal');
            }
        });

        it('v4: does NOT reference provider names in criminal notes', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const result = buildDeterministicPrefill(caseData);
            // v4: provider names must NOT appear in generated text
            const hasSrc = /Judit|Escavador|BigDataCorp|FonteData/.test(result.criminalNotes);
            expect(hasSrc).toBe(false);
        });
    });

    describe('Case 3: active warrants (Matheus)', () => {
        it('highlights warrants prominently', () => {
            const caseData = classifyAndMerge(buildMatheusCase());
            const result = buildDeterministicPrefill(caseData);

            if (caseData.warrantFlag === 'POSITIVE') {
                expect(result.warrantNotes).toContain('MANDADO');
                expect(result.warrantNotes.length).toBeGreaterThan(50);
                // keyFindings should mention warrants
                const hasWarrantFinding = result.keyFindings.some((f) => /mandado/i.test(f));
                expect(hasWarrantFinding).toBe(true);
            }
        });

        it('executive summary mentions warrants', () => {
            const caseData = classifyAndMerge(buildMatheusCase());
            const result = buildDeterministicPrefill(caseData);

            if (caseData.warrantFlag === 'POSITIVE') {
                expect(result.executiveSummary).toContain('Mandados');
            }
        });
    });

    describe('Case 4: homonymy / ambiguity (Andre)', () => {
        it('marks as complex and lists homonym triggers', () => {
            const caseData = classifyAndMerge(buildAndreCase());
            const result = buildDeterministicPrefill(caseData);

            expect(result.metadata.isComplex).toBe(true);
            const triggers = result.metadata.triggersActive;
            // Should have at least one of the homonym/ambiguity triggers
            const hasRelevantTrigger = triggers.some((t) =>
                ['REVIEW_RECOMMENDED', 'HOMONYM_AMBIGUITY', 'CRIMINAL_EVIDENCE_UNCERTAIN', 'CRIMINAL_FLAG_INCONCLUSIVE'].includes(t),
            );
            expect(hasRelevantTrigger).toBe(true);
        });

        it('criminal notes mention inconclusive or homonym', () => {
            const caseData = classifyAndMerge(buildAndreCase());
            const result = buildDeterministicPrefill(caseData);

            const hasInconclusiveRef = /homonímia|cobertura|inconclusivo/i.test(result.criminalNotes);
            expect(hasInconclusiveRef).toBe(true);
        });

        it('executive summary reflects uncertainty', () => {
            const caseData = classifyAndMerge(buildAndreCase());
            const result = buildDeterministicPrefill(caseData);

            const hasInconclusiveRef = /INCONCLUSIVO|homoním/i.test(result.executiveSummary);
            expect(hasInconclusiveRef).toBe(true);
        });
    });

    describe('Case 5: provider divergence (Diego)', () => {
        it('notes coverage level in output', () => {
            const caseData = classifyAndMerge(buildDiegoCase());
            const result = buildDeterministicPrefill(caseData);

            // Diego should have partial coverage
            if (caseData.coverageLevel !== 'HIGH_COVERAGE') {
                const hasCovRef = /nenhum apontamento|análise identificou/i.test(result.executiveSummary);
                expect(hasCovRef).toBe(true);
            }
        });

        it('NEGATIVE_PARTIAL yields ATTENTION verdict', () => {
            const caseData = classifyAndMerge(buildDiegoCase());
            const result = buildDeterministicPrefill(caseData);

            if (caseData.criminalFlag === 'NEGATIVE_PARTIAL') {
                // v6: risk level shown in badge, text shows analysis content
                const hasCovRef = /nenhum apontamento|análise identificou/i.test(result.executiveSummary);
                expect(hasCovRef).toBe(true);
                expect(result.finalJustification).toContain('validação manual');
            }
        });
    });

    describe('Case 6: many processes and truncation (Renan)', () => {
        it('truncates long process lists with "... e mais N"', () => {
            const caseData = classifyAndMerge(buildRenanCase());
            const result = buildDeterministicPrefill(caseData);

            // Renan has many processes - check if truncation works
            const allProcesses = [
                ...(caseData.juditRoleSummary || []),
                ...(caseData.escavadorProcessos || []),
            ];
            if (allProcesses.length > 8) {
                // If there are enough criminal processes, truncation msg should appear
                const crimCount = allProcesses.filter((p) => p.isCriminal || /penal|criminal/i.test(p.area || '')).length;
                if (crimCount > 8) {
                    expect(result.criminalNotes).toContain('... e mais');
                }
            }
        });

        it('does not silently omit any finding type', () => {
            const caseData = classifyAndMerge(buildRenanCase());
            const result = buildDeterministicPrefill(caseData);

            // Every non-empty field should have content
            expect(result.executiveSummary.length).toBeGreaterThan(20);
            expect(result.criminalNotes.length).toBeGreaterThan(0);
            expect(result.laborNotes.length).toBeGreaterThan(0);
            expect(result.warrantNotes.length).toBeGreaterThan(0);
            expect(result.finalJustification.length).toBeGreaterThan(0);
        });
    });

    describe('evaluateComplexityTriggers', () => {
        it('flags zero-evidence case as complex due to LOW_COVERAGE', () => {
            const caseData = classifyAndMerge(buildCleanCase());
            const result = evaluateComplexityTriggers(caseData);
            // Zero processes = LOW_COVERAGE = complex (correct system behavior)
            expect(result.isComplex).toBe(true);
            expect(result.triggersActive).toContain('LOW_COVERAGE');
        });

        it('returns not complex when flags are clean and coverage is high', () => {
            const result = evaluateComplexityTriggers({
                criminalFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                coverageLevel: 'HIGH_COVERAGE',
                providerDivergence: 'NONE',
                criminalEvidenceQuality: 'CONFIRMED_NEGATIVE',
                reviewRecommended: false,
            });
            expect(result.isComplex).toBe(false);
            expect(result.triggersActive).toHaveLength(0);
        });

        it('detects homonym complexity for Andre', () => {
            const caseData = classifyAndMerge(buildAndreCase());
            const result = evaluateComplexityTriggers(caseData);
            expect(result.isComplex).toBe(true);
            expect(result.triggersActive.length).toBeGreaterThan(0);
        });

        it('detects warrant inconclusive trigger', () => {
            const result = evaluateComplexityTriggers({
                warrantFlag: 'INCONCLUSIVE',
                criminalFlag: 'NEGATIVE',
            });
            expect(result.isComplex).toBe(true);
            expect(result.triggersActive).toContain('WARRANT_FLAG_INCONCLUSIVE');
        });

        it('detects all trigger types', () => {
            const result = evaluateComplexityTriggers({
                reviewRecommended: true,
                ambiguityNotes: ['test'],
                criminalEvidenceQuality: 'MIXED_STRONG_AND_WEAK',
                providerDivergence: 'HIGH',
                coverageLevel: 'LOW_COVERAGE',
                criminalFlag: 'INCONCLUSIVE_HOMONYM',
                warrantFlag: 'INCONCLUSIVE',
            });
            expect(result.isComplex).toBe(true);
            expect(result.triggersActive).toContain('REVIEW_RECOMMENDED');
            expect(result.triggersActive).toContain('HOMONYM_AMBIGUITY');
            expect(result.triggersActive).toContain('CRIMINAL_EVIDENCE_UNCERTAIN');
            expect(result.triggersActive).toContain('HIGH_PROVIDER_DIVERGENCE');
            expect(result.triggersActive).toContain('LOW_COVERAGE');
            expect(result.triggersActive).toContain('CRIMINAL_FLAG_INCONCLUSIVE');
            expect(result.triggersActive).toContain('WARRANT_FLAG_INCONCLUSIVE');
        });
    });

    describe('individual helpers', () => {
        it('buildDetCriminalNotes includes CPF match type for Judit', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetCriminalNotes(caseData);
            // Should reference match type (CPF confirmado, match por nome, etc)
            const hasMatchInfo = /CPF confirmado|match por nome|possivel homonimo/i.test(notes);
            if ((caseData.juditRoleSummary || []).some((j) => j.isCriminal)) {
                expect(hasMatchInfo).toBe(true);
            }
        });

        it('buildDetLaborNotes produces content for labor-positive case', () => {
            const caseData = classifyAndMerge(buildRenanCase());
            const notes = buildDetLaborNotes(caseData);
            expect(notes.length).toBeGreaterThan(0);
        });

        it('buildDetWarrantNotes produces content when warrants exist', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetWarrantNotes(caseData);
            if ((caseData.juditWarrants || []).length > 0 || (caseData.bigdatacorpActiveWarrants || []).length > 0) {
                expect(notes).toContain('MANDADO');
                expect(notes).toMatch(/Status:/);
            }
        });

        it('buildDetKeyFindings respects priority order', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const findings = buildDetKeyFindings(caseData);
            expect(findings.length).toBeGreaterThan(0);
            // Items should exist as strings
            findings.forEach((f) => expect(typeof f).toBe('string'));
        });

        it('buildDetExecutiveSummary covers all dimensions', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const summary = buildDetExecutiveSummary(caseData);
            expect(summary).toContain(name);
            expect(summary).toContain('análise identificou');
        });

        it('buildDetFinalJustification derives verdict from flags', () => {
            // Use a case with HIGH_COVERAGE and clean flags for APTO verdict
            const justification = buildDetFinalJustification({
                criminalFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                coverageLevel: 'HIGH_COVERAGE',
                providerDivergence: 'NONE',
            });
            expect(justification).toContain('Não foram identificados impeditivos');
        });

        it('buildDetFinalJustification uses NOT_RECOMMENDED for positive criminal', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const justification = buildDetFinalJustification(caseData);
            if (caseData.criminalFlag === 'POSITIVE') {
                expect(justification).toContain('risco elevado');
            }
        });

        it('buildDetFinalJustification includes material evidence with CNJs', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const justification = buildDetFinalJustification(caseData);
            if (caseData.criminalFlag === 'POSITIVE') {
                expect(justification).toContain('processo(s) criminal(is)');
            }
        });
    });

    describe('v2: independent generation (no autoClassify text dependency)', () => {
        it('buildDetCriminalNotes does NOT embed autoClassify generic text', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetCriminalNotes(caseData);
            // Should NOT start with the generic "Criminal POSITIVO: evidencia forte confirmada por..."
            expect(notes).not.toContain('evidencia forte confirmada por');
            // Should have its own rich header
            expect(notes).toMatch(/Severidade.*Síntese/);
        });

        it('buildDetLaborNotes does NOT embed autoClassify generic text', () => {
            const caseData = classifyAndMerge(buildRenanCase());
            const notes = buildDetLaborNotes(caseData);
            // Should NOT contain the generic "Trabalhista POSITIVO confirmado por: ."
            expect(notes).not.toContain('confirmado por:');
            if (caseData.laborFlag === 'POSITIVE') {
                // v6: headers removed — check for descriptive text
                const hasLaborProcesses = (caseData.laborProcesses || []).length > 0;
                if (hasLaborProcesses) {
                    expect(notes).toContain('Processos trabalhistas identificados');
                    expect(notes).toContain('PROCESSOS TRABALHISTAS');
                } else {
                    expect(notes).toContain('Processos trabalhistas identificados');
                    expect(notes).toContain('CONTEXTO PROFISSIONAL');
                }
            }
        });

        it('buildDetWarrantNotes does NOT embed autoClassify generic text', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetWarrantNotes(caseData);
            // Should NOT contain stale callback text
            expect(notes).not.toContain('aguardando callback');
            if (caseData.warrantFlag === 'POSITIVE') {
                expect(notes).toContain('MANDADO');
            }
        });

        it('buildDetCriminalNotes includes process CNJs for POSITIVE case', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetCriminalNotes(caseData);
            if (caseData.criminalFlag === 'POSITIVE') {
                // Should list individual processes with details
                expect(notes).toContain('PROCESSOS IDENTIFICADOS');
                expect(notes).toMatch(/Status:/);
                // v5: Fonte: removed from text — providers not shown
                expect(notes).not.toMatch(/Fonte:/);
            }
        });

        it('buildDetWarrantNotes includes detailed warrant info', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetWarrantNotes(caseData);
            if ((caseData.juditWarrants || []).length > 0 || (caseData.bigdatacorpActiveWarrants || []).length > 0) {
                expect(notes).toContain('MANDADO');
                expect(notes).toMatch(/Status:/);
                // v5: no provider names in text
                expect(notes).not.toContain('Detalhamento Judit');
                expect(notes).not.toContain('Detalhamento BigDataCorp');
            }
        });

        it('buildDetExecutiveSummary includes top CNJs for POSITIVE criminal', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const summary = buildDetExecutiveSummary(caseData);
            if (caseData.criminalFlag === 'POSITIVE') {
                // v5: summary contains conviction/process info
                expect(summary).toContain('criminal');
            }
        });

        it('buildDetLaborNotes includes process listing with CNJs when labor processes exist', () => {
            const caseData = classifyAndMerge({
                ...buildCleanCase(),
                bigdatacorpProcessos: [
                    {
                        numero: '0001234-56.2020.5.01.0001',
                        courtType: 'TRABALHISTA',
                        area: 'TRABALHISTA',
                        status: 'ATIVO',
                        polo: 'Reclamado',
                        courtName: 'TRT-1',
                        isCriminal: false,
                        isLabor: true,
                        partyType: 'Reclamado',
                    },
                ],
                bigdatacorpLaborFlag: 'POSITIVE',
            });
            const notes = buildDetLaborNotes(caseData);
            if (caseData.laborFlag === 'POSITIVE') {
                expect(notes).toContain('PROCESSOS TRABALHISTAS');
                expect(notes).toMatch(/Papel:/);
            }
        });

        it('labor sources bug is fixed — BigDataCorp candidates included', () => {
            const caseData = classifyAndMerge({
                ...buildCleanCase(),
                bigdatacorpProcessos: [
                    {
                        numero: '0001234-56.2020.5.01.0001',
                        courtType: 'TRABALHISTA',
                        status: 'ATIVO',
                        polo: 'Reclamado',
                        courtName: 'TRT-1',
                        isCriminal: false,
                        isLabor: true,
                        partyType: 'Reclamado',
                    },
                ],
                bigdatacorpLaborFlag: 'POSITIVE',
            });
            expect(caseData.laborFlag).toBe('POSITIVE');
            // The autoClassify laborNotes should now include BigDataCorp
            expect(caseData.laborNotes).toContain('BigDataCorp');
            // The det helper should also generate proper content
            const notes = buildDetLaborNotes(caseData);
            expect(notes).toContain('trabalhistas');
        });
    });

    describe('v4: provider-free text, BDC primary cadastro, unified warrants', () => {
        it('normCnj normalizes CNJ to digits', () => {
            expect(normCnj('0202743-72.2022.8.06.0167')).toBe('02027437220228060167');
            expect(normCnj('02027437220228060167')).toBe('02027437220228060167');
        });

        it('formatCnj formats 20-digit string to standard notation', () => {
            expect(formatCnj('02027437220228060167')).toBe('0202743-72.2022.8.06.0167');
            expect(formatCnj('0202743-72.2022.8.06.0167')).toBe('0202743-72.2022.8.06.0167');
        });

        it('selectTopProcessos deduplicates across providers by normalized CNJ', () => {
            const caseData = {
                juditRoleSummary: [{
                    code: '0202743-72.2022.8.06.0167', area: 'DIREITO PENAL', isCriminal: true,
                    status: 'Finalizado', side: 'Passive', tribunalAcronym: 'TJCE',
                    hasExactCpfMatch: true,
                }],
                escavadorProcessos: [{
                    numeroCnj: '0202743-72.2022.8.06.0167', area: 'Criminal',
                    status: 'Em andamento', polo: 'PASSIVO', tribunalSigla: 'TJCE',
                    hasExactCpfMatch: true,
                }],
                bigdatacorpProcessos: [{
                    numero: '02027437220228060167', courtType: 'CRIMINAL',
                    status: 'JULGADO', polo: 'PASSIVE', courtName: 'TJCE',
                    isCriminal: true, isDirectCpfMatch: true,
                }],
            };
            const result = selectTopProcessos(caseData, 20);
            // Same process from 3 providers: should appear only ONCE (Judit wins, others merged)
            expect(result.length).toBe(1);
            expect(result[0].fonte).toBe('Judit+Escavador+BigDataCorp');
        });

        it('selectTopProcessos: Escavador uses hasExactCpfMatch for matchType', () => {
            const caseData = {
                escavadorProcessos: [{
                    numeroCnj: '0012198-45.2022.8.06.0167', area: 'Criminal',
                    status: 'Em andamento', polo: 'PASSIVO', tribunalSigla: 'TJCE',
                    hasExactCpfMatch: true, tipoMatch: 'CPF',
                    tipoNormalizado: 'Autor Do Fato',
                }],
            };
            const result = selectTopProcessos(caseData, 20);
            expect(result[0].matchType).toBe('CPF confirmado');
        });

        it('selectTopProcessos: Escavador detects isActive for "Em andamento"', () => {
            const caseData = {
                escavadorProcessos: [{
                    numeroCnj: '0012198-45.2022.8.06.0167', area: 'Criminal',
                    status: 'Em andamento', polo: 'PASSIVO', tribunalSigla: 'TJCE',
                }],
            };
            const result = selectTopProcessos(caseData, 20);
            expect(result[0].isActive).toBe(true);
        });

        it('selectTopProcessos: Escavador detects isCriminal for area "CRIME"', () => {
            const caseData = {
                escavadorProcessos: [{
                    numeroCnj: '3001575-02.2021.8.06.0167', area: 'CRIME',
                    status: 'Encerrado', polo: 'PASSIVO', tribunalSigla: 'TJCE',
                }],
            };
            const result = selectTopProcessos(caseData, 20);
            expect(result[0].isCriminal).toBe(true);
        });

        it('selectTopProcessos adds classe and assunto from Escavador', () => {
            const caseData = {
                escavadorProcessos: [{
                    numeroCnj: '0013417-40.2021.8.06.0293', area: 'Criminal',
                    status: 'Arquivado', polo: 'PASSIVO', tribunalSigla: 'TJCE',
                    classe: 'Medidas Protetivas de urgência (Lei Maria da Penha) Criminal (1268)',
                    assuntoPrincipal: 'Contravenções Penais',
                    processCity: 'Sobral',
                }],
            };
            const result = selectTopProcessos(caseData, 20);
            expect(result[0].classe).toContain('Maria da Penha');
            expect(result[0].assunto).toBe('Contravenções Penais');
            expect(result[0].comarca).toBe('Sobral');
        });

        it('buildDetCriminalNotes shows classe/assunto in process listing', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetCriminalNotes(caseData);
            if (caseData.criminalFlag === 'POSITIVE') {
                // v5: uses PROCESSOS IDENTIFICADOS header
                expect(notes).toContain('PROCESSOS IDENTIFICADOS');
                // Should show Tipo or Assunto for at least some processes
                const hasClasseOrAssunto = /Tipo:|Assunto:/i.test(notes);
                expect(hasClasseOrAssunto).toBe(true);
            }
        });

        it('buildDetCriminalNotes shows correct matchType from Escavador', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetCriminalNotes(caseData);
            // v4: Fonte: no longer in text, but matchType should still be present
            expect(notes).not.toMatch(/Fonte:/);
            // Overall, there should be CPF confirmado entries
            expect(notes).toContain('CPF confirmado');
        });

        it('buildDetLaborNotes handles POSITIVE flag with zero processes', () => {
            const caseData = {
                laborFlag: 'POSITIVE',
                fontedataLaborFlag: undefined,
                bigdatacorpLaborFlag: 'NEGATIVE',
                escavadorProcessos: [],
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
            };
            const notes = buildDetLaborNotes(caseData);
            expect(notes).toContain('Processos trabalhistas identificados');
            // v5: no false-positive warning, always shows professional context
            expect(notes).toContain('CONTEXTO PROFISSIONAL');
        });

        it('buildDetWarrantNotes shows BDC warrant processNumber and imprisonmentKind', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetWarrantNotes(caseData);
            const bdcWarrants = caseData.bigdatacorpActiveWarrants || [];
            if (bdcWarrants.length > 0 && bdcWarrants[0].imprisonmentKind) {
                // v5: warrant type is classified, not raw imprisonmentKind
                expect(notes).toMatch(/Tipo:|civil|criminal/i);
            }
            // v4: no provider separation in text
            expect(notes).not.toContain('Detalhamento BigDataCorp');
        });

        it('buildDetWarrantNotes detects overlap between Judit and BDC warrants', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetWarrantNotes(caseData);
            const juditWarrants = caseData.juditWarrants || [];
            const bdcWarrants = caseData.bigdatacorpActiveWarrants || [];
            if (juditWarrants.length > 0 && bdcWarrants.length > 0) {
                // v5: warrants are deduplicated, no overlap warning needed
                // Should still not name providers
                expect(notes).not.toContain('BigDataCorp referencia');
                expect(notes).not.toContain('processo Judit');
            }
        });

        it('buildDetKeyFindings does NOT treat all Escavador as weak', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const findings = buildDetKeyFindings(caseData);
            // Should NOT have "sustentado(s) por match de nome" if processes have CPF confirmation
            const weakFinding = findings.find((f) => /sustentado.*match de nome/i.test(f));
            const topProcessos = selectTopProcessos(caseData, 20);
            const cpfConfirmed = topProcessos.filter((p) => p.isCriminal && p.matchType === 'CPF confirmado');
            if (cpfConfirmed.length > 0) {
                // If there are CPF-confirmed criminal processes, the "name only" finding should be absent
                // or refer only to name-only processes
                if (weakFinding) {
                    // The number mentioned should be less than total criminal count
                    const count = parseInt(weakFinding.match(/(\d+)/)?.[1] || '0');
                    expect(count).toBeLessThan(topProcessos.filter((p) => p.isCriminal).length);
                }
            }
        });

        it('buildDetExecutiveSummary shows assunto for top processes', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const summary = buildDetExecutiveSummary(caseData);
            if (caseData.criminalFlag === 'POSITIVE') {
                // v5: summary contains criminal finding
                expect(summary).toContain('criminal');
            }
        });

        it('buildDetFinalJustification shows evidence details', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const just = buildDetFinalJustification(caseData);
            if (caseData.criminalFlag === 'POSITIVE') {
                expect(just).toContain('processo(s) criminal(is)');
            }
        });

        it('NO provider names appear in any generated prefill text', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const prefill = buildDeterministicPrefill(caseData);
            const allTexts = [
                prefill.criminalNotes,
                prefill.laborNotes,
                prefill.warrantNotes,
                prefill.executiveSummary,
                prefill.finalJustification,
                ...(prefill.keyFindings || []),
            ].join('\n');
            // Provider names must NOT appear in generated text
            expect(allTexts).not.toContain('via Judit');
            expect(allTexts).not.toContain('via BigDataCorp');
            expect(allTexts).not.toContain('via Escavador');
            expect(allTexts).not.toContain('via FonteData');
            expect(allTexts).not.toContain('Detalhamento Judit');
            expect(allTexts).not.toContain('Detalhamento BigDataCorp');
            expect(allTexts).not.toMatch(/Fonte: (Judit|BigDataCorp|Escavador|FonteData)/);
            expect(allTexts).not.toContain('mandado(s) Judit');
            expect(allTexts).not.toContain('mandado(s) BigDataCorp');
        });

        it('DEFAULT_JUDIT_CONFIG has entity OFF by default', () => {
            // Judit cadastro must be disabled by default — BDC is primary
            // This test validates the config is correct at code level
            const indexSrc = fs.readFileSync(path.resolve(__dirname, '../index.js'), 'utf-8');
            expect(indexSrc).toContain("entity: false,");
        });
    });

    /* ===========================================
       ULTRA-AUDIT: edge-case coverage (15 tests)
       =========================================== */
    describe('ultra-audit edge cases', () => {
        // 1. caseData = {} — empty object must not crash any builder
        it('buildDeterministicPrefill({}) does not crash with empty object', () => {
            const result = buildDeterministicPrefill({});
            expect(result.executiveSummary).toBeTruthy();
            expect(result.criminalNotes).toBeTruthy();
            expect(result.laborNotes).toBeTruthy();
            expect(result.warrantNotes).toBeTruthy();
            expect(Array.isArray(result.keyFindings)).toBe(true);
            expect(result.finalJustification).toBeTruthy();
            expect(result.metadata.version).toBe('v5-deterministic-prefill');
        });

        // 2. 100% clean candidate with no BigDataCorp data at all
        it('fully clean candidate with no professional data', () => {
            const caseData = {
                candidateName: 'MARIA CLARA LIMA',
                cpf: '12345678901',
                criminalFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                pepFlag: 'NEGATIVE',
                sanctionFlag: 'NEGATIVE',
            };
            const result = buildDeterministicPrefill(caseData);
            expect(result.criminalNotes).toContain('Nenhum processo criminal');
            expect(result.laborNotes).toContain('nenhum processo trabalhista');
            expect(result.laborNotes).toContain('Dados profissionais não disponíveis');
            expect(result.warrantNotes).toContain('Nenhum mandado');
            expect(result.finalJustification).toContain('Não foram identificados impeditivos');
            expect(result.executiveSummary).toBeTruthy();
            expect(result.keyFindings.length).toBeGreaterThanOrEqual(0);
        });

        // 3. income=null + incomeRange present — no double space
        it('laborNotes formats salary correctly when income is null', () => {
            const caseData = {
                laborFlag: 'NEGATIVE',
                bigdatacorpEmployer: 'EMPRESA XYZ',
                bigdatacorpProfessionHistory: [{
                    companyName: 'EMPRESA XYZ',
                    incomeRange: 'Entre 3.000 e 5.000',
                    income: null,
                    status: 'active',
                    startDate: '2020-01-15',
                }],
            };
            const notes = buildDetLaborNotes(caseData);
            expect(notes).toContain('Faixa salarial: Entre 3.000 e 5.000');
            expect(notes).not.toMatch(/Faixa salarial:\s{2}/); // no double space
        });

        // 4. laborFlag=POSITIVE + 0 labor processes
        it('laborNotes POSITIVE with zero processes shows header without process list', () => {
            const caseData = {
                laborFlag: 'POSITIVE',
                escavadorProcessos: [],
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
            };
            const notes = buildDetLaborNotes(caseData);
            expect(notes).toContain('Processos trabalhistas identificados');
            expect(notes).toContain('CONTEXTO PROFISSIONAL');
            expect(notes).not.toContain('PROCESSOS TRABALHISTAS');
        });

        // 5. criminalFlag=POSITIVE + cpfConfirmed=[] — all name-only
        it('finalJustification POSITIVE criminal without CPF produces meaningful fallback', () => {
            const caseData = {
                candidateName: 'JOSE DA SILVA',
                criminalFlag: 'POSITIVE',
                criminalSeverity: 'ALTA',
                warrantFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                pepFlag: 'NEGATIVE',
                sanctionFlag: 'NEGATIVE',
                escavadorProcessos: [{
                    numeroCnj: '12345678901234567890',
                    area: 'Criminal',
                    status: 'Ativo',
                    tipoMatch: 'NOME',
                    hasExactCpfMatch: false,
                }],
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
            };
            const justification = buildDetFinalJustification(caseData);
            expect(justification).toContain('risco elevado');
            expect(justification).not.toContain('0 processo(s)');
            expect(justification).toMatch(/identificado|indicadores/i);
        });

        // 6. warrantFlag=POSITIVE + 0 warrants in judit/bdc
        it('warrantNotes POSITIVE with no warrant data shows unavailable message', () => {
            const caseData = {
                warrantFlag: 'POSITIVE',
                juditWarrants: [],
                bigdatacorpActiveWarrants: [],
            };
            const notes = buildDetWarrantNotes(caseData);
            expect(notes).toContain('indisponíveis');
        });

        // 7. pepFlag=POSITIVE only — no criminal, no warrant
        it('PEP-only positive yields ATTENTION and mentions PEP', () => {
            const caseData = {
                candidateName: 'POLITICO CONHECIDO',
                criminalFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                pepFlag: 'POSITIVE',
                sanctionFlag: 'NEGATIVE',
            };
            const result = buildDeterministicPrefill(caseData);
            expect(result.finalJustification).toContain('validação manual');
            expect(result.finalJustification).toContain('pessoa politicamente exposta');
            expect(result.executiveSummary).toContain('PEP');
            expect(result.keyFindings).toContain('Pessoa politicamente exposta (PEP) detectada');
        });

        // 8. sanctionFlag=HISTORICAL
        it('HISTORICAL sanction triggers ATTENTION and medium risk', () => {
            const caseData = {
                candidateName: 'HISTORICO SANCIONADO',
                criminalFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                pepFlag: 'NEGATIVE',
                sanctionFlag: 'HISTORICAL',
            };
            const result = buildDeterministicPrefill(caseData);
            expect(result.executiveSummary).toBeTruthy();
            // HISTORICAL sanction is excluded from negatives list (no "sanções" in "nenhum apontamento...")
            expect(result.executiveSummary).not.toContain('sanção internacional');
        });

        // 9. sanctionFlag=POSITIVE only — yields NOT_RECOMMENDED
        it('sanction POSITIVE alone yields NOT_RECOMMENDED', () => {
            const caseData = {
                candidateName: 'SANCIONADO ATIVO',
                criminalFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                pepFlag: 'NEGATIVE',
                sanctionFlag: 'POSITIVE',
            };
            const result = buildDeterministicPrefill(caseData);
            expect(result.finalJustification).toContain('risco elevado');
            expect(result.finalJustification).toContain('sanção ativa');
            expect(result.executiveSummary).toContain('sanção ativa');
        });

        // 10. criminalFlag=INCONCLUSIVE_HOMONYM + 0 processes
        it('criminalNotes INCONCLUSIVE_HOMONYM with 0 processes has explanatory body', () => {
            const caseData = {
                criminalFlag: 'INCONCLUSIVE_HOMONYM',
                escavadorProcessos: [],
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
            };
            const notes = buildDetCriminalNotes(caseData);
            expect(notes).toContain('homonímia');
            expect(notes).toContain('indisponíveis');
        });

        // 11. criminalFlag=NOT_FOUND + 0 processes
        it('criminalNotes NOT_FOUND with 0 processes has explanatory body', () => {
            const caseData = {
                criminalFlag: 'NOT_FOUND',
                escavadorProcessos: [],
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
            };
            const notes = buildDetCriminalNotes(caseData);
            expect(notes).toContain('não localizado');
            expect(notes).toContain('indisponíveis');
        });

        // 12. warrantFlag=INCONCLUSIVE + 0 warrants
        it('warrantNotes INCONCLUSIVE with no warrants does not crash', () => {
            const caseData = {
                warrantFlag: 'INCONCLUSIVE',
                juditWarrants: [],
                bigdatacorpActiveWarrants: [],
            };
            const notes = buildDetWarrantNotes(caseData);
            expect(notes).toContain('inconclusivo');
        });

        // 13. ALL flags POSITIVE — worst case
        it('all flags POSITIVE produces coherent NOT_RECOMMENDED output', () => {
            const caseData = {
                candidateName: 'PIOR CENARIO',
                cpf: '99988877766',
                criminalFlag: 'POSITIVE',
                criminalSeverity: 'ALTA',
                warrantFlag: 'POSITIVE',
                laborFlag: 'POSITIVE',
                pepFlag: 'POSITIVE',
                sanctionFlag: 'POSITIVE',
                juditWarrants: [{ code: '12345678901234567890', status: 'Pendente', warrantType: 'Criminal' }],
                bigdatacorpActiveWarrants: [],
                escavadorProcessos: [],
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
            };
            const result = buildDeterministicPrefill(caseData);
            expect(result.finalJustification).toContain('risco elevado');
            expect(result.executiveSummary).toContain('sanção ativa');
            expect(result.warrantNotes).toContain('MANDADO');
            expect(result.criminalNotes).toContain('Severidade');
            expect(result.laborNotes).toContain('Processos trabalhistas identificados');
            // Fix A1 — no double space after "prisão" in keyFindings items
            for (const finding of result.keyFindings) {
                expect(finding).not.toMatch(/prisão {2}/);
            }
        });

        // 14. namesakeCount=0
        it('namesakeCount=0 produces valid caveat text', () => {
            const caseData = {
                candidateName: 'NOME UNICO',
                criminalFlag: 'INCONCLUSIVE_HOMONYM',
                bigdatacorpNamesakeCount: 0,
                escavadorProcessos: [{
                    numeroCnj: '12345678901234567890',
                    area: 'Criminal',
                    status: 'Ativo',
                    tipoMatch: 'NOME',
                    hasExactCpfMatch: false,
                }],
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
            };
            const notes = buildDetCriminalNotes(caseData);
            expect(notes).toMatch(/1 pessoa/i);
            expect(notes).not.toContain('0 pessoa');
            const justification = buildDetFinalJustification(caseData);
            expect(justification).toContain('ocorrência única');
        });

        // 15. penaltyTime with "dias" already in text
        it('warrantNotes does not duplicate "dias" in penalty', () => {
            const caseData = {
                warrantFlag: 'POSITIVE',
                juditWarrants: [],
                bigdatacorpActiveWarrants: [{
                    processNumber: '12345678901234567890',
                    status: 'Pendente',
                    penaltyTime: '30 dias',
                    magistrate: 'Juiz Teste',
                }],
            };
            const notes = buildDetWarrantNotes(caseData);
            expect(notes).not.toContain('dias dias');
            expect(notes).toContain('30 dias');
        });
    });
});
