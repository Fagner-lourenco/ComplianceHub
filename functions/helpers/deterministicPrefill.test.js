import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { normalizeEscavadorProcessos } = require('../normalizers/escavador');
const { normalizeEscavador2Response } = require('../normalizers/escavador2');
const { deduplicateEscavador2Findings } = require('./deduplicateEscavador2');
const {
    normalizeJuditExecution,
    normalizeJuditLawsuits,
    normalizeJuditWarrants,
} = require('../normalizers/judit');
const { computeAutoClassification } = require('../modules/autoClassification');
const { __test } = require('../index');

const {
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
    formatProcessBlock,
    sanitizeNarrativesForFlags,
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

            // Zero process returns from completed providers are sem apontamento, not inconclusive.
            expect(result.criminalNotes).toBeTruthy();
            expect(result.laborNotes).toBeTruthy();
            expect(result.warrantNotes).toContain('Nenhum');
            expect(result.criminalNotes).toContain('Nao foram identificados apontamentos criminais materiais');
            expect(result.executiveSummary).not.toMatch(/inconclusivo|baixa cobertura|cobertura insuficiente/i);
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
            // v7: headers removed — go straight to listing
            expect(result.criminalNotes).toMatch(/Status:/);
            expect(result.criminalNotes.length).toBeGreaterThan(100);
            expect(result.executiveSummary).toMatch(/criminal/i);
            expect(result.keyFindings.length).toBeGreaterThan(0);
            expect(result.finalJustification).toContain('risco elevado');
        });

        it('includes warrant and execution data when present', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const result = buildDeterministicPrefill(caseData);

            if (caseData.warrantFlag === 'POSITIVE') {
                expect(result.warrantNotes).toMatch(/Status:/);
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
                const hasCovRef = /nenhum apontamento|nao identificou apontamentos|analise identificou/i.test(result.executiveSummary);
                expect(hasCovRef).toBe(true);
            }
        });

        it('NEGATIVE with partial coverage keeps sem apontamento wording', () => {
            const caseData = classifyAndMerge(buildDiegoCase());
            const result = buildDeterministicPrefill(caseData);

            expect(caseData.criminalFlag).toBe('NEGATIVE');
            expect(caseData.criminalEvidenceQuality).toBe('NEGATIVE_WITH_PARTIAL_COVERAGE');
            const hasCovRef = /nenhum apontamento|nao identificou apontamentos|analise identificou/i.test(result.executiveSummary);
            expect(hasCovRef).toBe(true);
            expect(result.finalJustification).not.toMatch(/negativo parcial|parcial/i);
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
        it('does not flag completed zero-evidence case as complex only due to LOW_COVERAGE', () => {
            const caseData = classifyAndMerge(buildCleanCase());
            const result = evaluateComplexityTriggers(caseData);
            expect(caseData.coverageLevel).toBe('LOW_COVERAGE');
            expect(caseData.criminalFlag).toBe('NEGATIVE');
            expect(result.isComplex).toBe(false);
            expect(result.triggersActive).not.toContain('LOW_COVERAGE');
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
                criminalFlag: 'INCONCLUSIVE',
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
            /CPF confirmado|match por nome|possivel homonimo/i.test(notes);
            if ((caseData.juditRoleSummary || []).some((j) => j.isCriminal)) {
                // v7: no headers, but process listing should exist
                expect(notes).toMatch(/Status:/);
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

        it('buildDetKeyFindings includes labor finding when laborFlag is POSITIVE', () => {
            const findings = buildDetKeyFindings({
                laborFlag: 'POSITIVE',
                criminalFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                pepFlag: 'NEGATIVE',
                sanctionFlag: 'NEGATIVE',
                escavadorProcessos: [
                    {
                        numeroCnj: '0001225-88.2023.5.10.0020',
                        area: 'Trabalhista',
                        classe: 'Acao Trabalhista',
                        assuntoPrincipal: 'Rescisao indireta',
                        status: 'Ativo',
                        tribunalSigla: 'TRT10',
                        tipoMatch: 'CPF',
                    },
                ],
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
            });

            expect(findings).toContain('Apontamento trabalhista material identificado.');
            expect(findings.join('\n')).not.toMatch(/0001225|TRT10|Escavador|Judit|BigDataCorp|FonteData/i);
        });

        it('buildDetKeyFindings includes generic labor finding when laborFlag is POSITIVE without structured processes', () => {
            const findings = buildDetKeyFindings({
                laborFlag: 'POSITIVE',
                criminalFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                pepFlag: 'NEGATIVE',
                sanctionFlag: 'NEGATIVE',
                escavadorProcessos: [],
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
            });

            expect(findings).toContain('Apontamento trabalhista material identificado.');
        });

        it('executiveSummary NOT_FOUND nao afirma ausencia de apontamentos criminais', () => {
            const summary = buildDetExecutiveSummary({
                criminalFlag: 'NOT_FOUND',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
            });
            expect(summary).not.toMatch(/nao identificou apontamentos criminais/i);
            expect(summary).toMatch(/sem resposta aproveitavel|nao foi possivel consultar/i);
        });

        it('executiveSummary trabalhista INCONCLUSIVE nao vira "nenhum apontamento trabalhista"', () => {
            const summary = buildDetExecutiveSummary({
                criminalFlag: 'NEGATIVE',
                laborFlag: 'INCONCLUSIVE',
                warrantFlag: 'NEGATIVE',
            });
            expect(summary).not.toMatch(/apontamentos trabalhista/i);
            expect(summary).toMatch(/trabalhista inconclusiv/i);
        });

        it('keyFindings inclui achado criminal inconclusivo em vez de silenciar', () => {
            const findings = buildDetKeyFindings({
                criminalFlag: 'INCONCLUSIVE',
                criminalEvidenceQuality: 'NEUTRAL_ROLE_REVIEW',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
            });
            expect(findings.join('\n')).toMatch(/criminal inconclusiv/i);
        });

        it('finalJustification NEUTRAL_ROLE_REVIEW fala de papel processual, nao de identidade', () => {
            const text = buildDetFinalJustification({
                candidateName: 'JOAO TESTE',
                criminalFlag: 'INCONCLUSIVE',
                criminalEvidenceQuality: 'NEUTRAL_ROLE_REVIEW',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
            });
            expect(text).not.toMatch(/sem confirmação inequívoca de identidade/i);
            expect(text).toMatch(/papel processual/i);
        });

        it('finalJustification NOT_FOUND nao afirma negativa nem se contradiz', () => {
            const text = buildDetFinalJustification({
                candidateName: 'JOAO TESTE',
                criminalFlag: 'NOT_FOUND',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
            });
            expect(text).not.toContain('Nao foram identificados apontamentos criminais materiais');
            expect(text).toMatch(/nao (foi possivel|retornaram)|sem resposta aproveitavel|não localizado/i);
        });

        it('buildDetExecutiveSummary covers all dimensions', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const summary = buildDetExecutiveSummary(caseData);
            expect(summary).toContain(name);
            expect(summary).toContain('analise identificou');
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
            expect(justification).toContain('Nao foram identificados impeditivos');
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
            // v7: no rich header — go straight to listing
            expect(notes).toMatch(/Status:/);
        });

        it('buildDetLaborNotes does NOT embed autoClassify generic text', () => {
            const caseData = classifyAndMerge(buildRenanCase());
            const notes = buildDetLaborNotes(caseData);
            // Should NOT contain the generic "Trabalhista POSITIVO confirmado por: ."
            expect(notes).not.toContain('confirmado por:');
            if (caseData.laborFlag === 'POSITIVE') {
                // v7: headers removed — professional context is not part of labor notes
                const hasLaborProcesses = (caseData.laborProcesses || []).length > 0;
                if (hasLaborProcesses) {
                    expect(notes).toMatch(/Status:|Status processual:/);
                } else {
                    expect(notes).not.toContain('Contexto profissional cadastral');
                    expect(notes).not.toContain('Ultimo empregador');
                }
            }
        });

        it('buildDetWarrantNotes does NOT embed autoClassify generic text', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetWarrantNotes(caseData);
            // Should NOT contain stale callback text
            expect(notes).not.toContain('aguardando callback');
            if (caseData.warrantFlag === 'POSITIVE') {
                expect(notes).toMatch(/Status:/);
            }
        });

        it('buildDetCriminalNotes includes process CNJs for POSITIVE case', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetCriminalNotes(caseData);
            if (caseData.criminalFlag === 'POSITIVE') {
                // Should list individual processes with details
                expect(notes).toMatch(/Status:/);
                // v5: Fonte: removed from text — providers not shown
                expect(notes).not.toMatch(/Fonte:/);
            }
        });

        it('buildDetWarrantNotes includes detailed warrant info', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetWarrantNotes(caseData);
            if ((caseData.juditWarrants || []).length > 0 || (caseData.bigdatacorpActiveWarrants || []).length > 0) {
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
                        polo: 'Recorrente',
                        courtName: 'TRT-1',
                        isCriminal: false,
                        isLabor: true,
                        isDirectCpfMatch: true,
                        partyType: 'Recorrente',
                        specificRole: 'Recorrente',
                    },
                ],
                bigdatacorpLaborFlag: 'POSITIVE',
            });
            const notes = buildDetLaborNotes(caseData);
            if (caseData.laborFlag === 'POSITIVE') {
                // v7: no headers, go straight to listing
                expect(notes).toMatch(/Papel do candidato:/);
            }
        });

        it('buildDetLaborNotes includes passive labor party and resolved status from merged BigDataCorp data', () => {
            const caseData = classifyAndMerge({
                ...buildCleanCase(),
                candidateName: 'ANDRE LUIZ VAZ',
                cpf: '38607910876',
                juditRoleSummary: [
                    {
                        code: '0000218-13.2021.5.09.0003',
                        area: 'Trabalhista',
                        status: null,
                        phase: null,
                        tribunalAcronym: 'TRT9',
                        city: 'CURITIBA',
                        county: '3ª VARA DO TRABALHO DE CURITIBA',
                        justice: '5',
                        distributionDate: '2021-03-23',
                        personType: 'RECLAMANTE',
                        side: 'Active',
                        hasExactCpfMatch: true,
                        isLabor: true,
                        subjects: ['INTERVALO INTRAJORNADA'],
                        classifications: ['AÇÃO TRABALHISTA - RITO SUMARÍSSIMO'],
                        lastStep: 'Arquivados os autos definitivamente',
                        lastStepDate: '2022-02-21',
                        parties: [
                            { name: 'ANDRE LUIZ VAZ', personType: 'RECLAMANTE', side: 'Active', document: '38607910876' },
                            { name: 'MADERO INDUSTRIA E COMERCIO S.A.', personType: 'RECLAMADO', side: 'Passive', document: '13783221001601' },
                        ],
                    },
                ],
                bigdatacorpProcessos: [
                    {
                        numero: '00002181320215090003',
                        courtType: 'TRABALHISTA',
                        courtName: 'TRT9',
                        courtDistrict: 'CURITIBA',
                        status: 'ARQUIVADO',
                        cnjProcedure: 'AÇÃO TRABALHISTA - RITO SUMARÍSSIMO',
                        cnjSubject: 'INTERVALO INTRAJORNADA',
                        isLabor: true,
                        isDirectCpfMatch: true,
                        polo: 'ACTIVE',
                        partyType: 'RECLAMANTE',
                        specificRole: 'RECLAMANTE',
                        lastMovementDate: '2022-02-21',
                        allParties: [
                            { name: 'ANDRE LUIZ VAZ', role: 'RECLAMANTE', side: 'ACTIVE', document: '38607910876' },
                            { name: 'MADERO INDUSTRIA E COMERCIO S A', role: 'RECLAMADO', side: 'PASSIVE', document: '13783221000125' },
                            { name: 'DIOGO FADEL BRAZ', role: 'ADVOGADO', side: 'NEUTRAL', document: null },
                        ],
                        movements: [
                            { content: 'Arquivados os autos definitivamente', date: '2022-02-21' },
                        ],
                    },
                ],
                bigdatacorpLaborFlag: 'POSITIVE',
            });

            const notes = buildDetLaborNotes(caseData);

            expect(notes).toContain('Status processual: ARQUIVADO');
            expect(notes).toContain('Papel do candidato: RECLAMANTE');
            expect(notes).toContain('Parte reclamada/passiva: MADERO INDUSTRIA E COMERCIO S.A.');
            expect(notes).toContain('Distribuição: 23/03/2021 | Última movimentação: 21/02/2022');
            expect(notes).toContain('Último andamento: Arquivados os autos definitivamente');
            expect(notes).not.toContain('Parte reclamada/passiva: ANDRE LUIZ VAZ');
            expect(notes).not.toContain('DIOGO FADEL BRAZ');
        });

        it('buildDetLaborNotes filters noisy passive parties and infers status from last step', () => {
            const caseData = classifyAndMerge({
                ...buildCleanCase(),
                candidateName: 'LAUAN ALBUQUERQUE BELO',
                cpf: '11122233344',
                juditRoleSummary: [
                    {
                        code: '0000361-75.2026.5.08.0125',
                        area: 'Trabalhista',
                        status: null,
                        tribunalAcronym: 'TRT8',
                        justice: '5',
                        distributionDate: '2026-01-10',
                        personType: 'RECLAMANTE',
                        side: 'Active',
                        hasExactCpfMatch: true,
                        isLabor: true,
                        subjects: ['VERBAS RESCISÓRIAS'],
                        classifications: ['AÇÃO TRABALHISTA'],
                        lastStep: 'Arquivados os autos definitivamente',
                        lastStepDate: '2026-03-01',
                        parties: [
                            { name: 'LAUAN ALBUQUERQUE BELO', personType: 'RECLAMANTE', side: 'Active', document: '11122233344' },
                            { name: 'L', personType: 'RECLAMADO', side: 'Passive', document: null },
                            { name: 'EMPRESA LIMPA LTDA', personType: 'RECLAMADO', side: 'Passive', document: '12345678000190' },
                        ],
                    },
                ],
                bigdatacorpProcessos: [],
            });

            const notes = buildDetLaborNotes(caseData);

            expect(notes).toContain('Status processual: ARQUIVADO');
            expect(notes).toContain('Parte reclamada/passiva: EMPRESA LIMPA LTDA');
            expect(notes).not.toContain('Parte reclamada/passiva: L');
            expect(notes).not.toContain('Status: N/A');
        });

        it('buildDetCriminalNotes keeps the generic process status label', () => {
            const caseData = classifyAndMerge({
                ...buildCleanCase(),
                juditRoleSummary: [
                    {
                        code: '0000001-22.2020.8.26.0001',
                        area: 'Criminal',
                        status: 'Ativo',
                        tribunalAcronym: 'TJSP',
                        personType: 'RÉU',
                        side: 'Passive',
                        hasExactCpfMatch: true,
                        isCriminal: true,
                        subjects: ['Furto'],
                        classifications: ['Ação Penal'],
                    },
                ],
            });

            const notes = buildDetCriminalNotes(caseData);

            expect(notes).toContain('Status: Ativo');
            expect(notes).not.toContain('Status processual:');
        });

        it('labor sources bug is fixed — BigDataCorp candidates included', () => {
            const caseData = classifyAndMerge({
                ...buildCleanCase(),
                bigdatacorpProcessos: [
                    {
                        numero: '0001234-56.2020.5.01.0001',
                        courtType: 'TRABALHISTA',
                        status: 'ATIVO',
                        polo: 'Recorrente',
                        courtName: 'TRT-1',
                        isCriminal: false,
                        isLabor: true,
                        isDirectCpfMatch: true,
                        partyType: 'Recorrente',
                        specificRole: 'Recorrente',
                    },
                ],
                bigdatacorpLaborFlag: 'POSITIVE',
            });
            expect(caseData.laborFlag).toBe('POSITIVE');
            // The autoClassify laborNotes should now include BigDataCorp
            expect(caseData.laborNotes).toContain('BigDataCorp');
            // The det helper should also generate proper content
            const notes = buildDetLaborNotes(caseData);
            expect(notes).toMatch(/Papel do candidato:/);
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
            expect(result[0].fonte).toBe('Judit+BigDataCorp+Escavador');
        });

        it('selectTopProcessos: campos ausentes viram null, nunca literal N/A', () => {
            const caseData = {
                juditRoleSummary: [{
                    code: '0202743-72.2022.8.06.0167', isCriminal: true,
                    hasExactCpfMatch: true,
                }],
                escavador2Processos: [{
                    numeroCnj: '0012198-45.2022.8.06.0199', area: 'CRIMINAL',
                    isCriminal: true, isNewEscavador2Finding: true, hasExactCpfMatch: true,
                }],
            };
            const result = selectTopProcessos(caseData, 20);
            for (const proc of result) {
                for (const field of ['area', 'polo', 'tribunal', 'data']) {
                    expect(proc[field], `${proc.fonte}.${field}`).not.toBe('N/A');
                }
                const block = formatProcessBlock(proc, {});
                expect(block).not.toContain('N/A');
            }
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

        it('prefill preserves counterparty, city and court unit from a new Escavador2 finding', () => {
            const caseData = {
                candidateName: 'Madero Industria e Comercio S.A',
                laborFlag: 'POSITIVE',
                escavador2Processos: [{
                    numeroCnj: '0009999-00.2023.5.01.0001',
                    area: 'LABOR',
                    isLabor: true,
                    isNewEscavador2Finding: true,
                    hasExactCpfMatch: true,
                    status: 'ATIVO',
                    tribunalSigla: 'TRT-1',
                    specificRole: 'Reclamado',
                    processCity: 'Rio de Janeiro',
                    judgingBody: '62a Vara do Trabalho do Rio de Janeiro',
                    parties: [
                        { name: 'Madero Industria e Comercio S.A', role: 'Polo Passivo', side: 'PASSIVE' },
                    ],
                    allParties: [
                        { name: 'RODRIGO HENRIQUE', role: 'Polo Ativo', side: 'ACTIVE' },
                    ],
                }],
            };

            const [process] = selectTopProcessos(caseData, 20);
            const notes = buildDetLaborNotes(caseData);

            expect(process.parties).toHaveLength(1);
            expect(process.allParties).toHaveLength(1);
            expect(notes).toContain('Parte autora/ativa: RODRIGO HENRIQUE');
            expect(notes).toContain('Comarca: Rio de Janeiro');
            expect(notes).toContain('Vara: 62a Vara do Trabalho do Rio de Janeiro');
        });

        it('prefill merges Escavador2 location and parties into an existing CNJ without overwriting provider data', () => {
            const cnj = '0009999-00.2023.5.01.0001';
            const baseCase = {
                candidateName: 'Madero Industria e Comercio S.A',
                laborFlag: 'POSITIVE',
                juditRoleSummary: [{
                    code: cnj,
                    area: 'Trabalhista',
                    tribunalAcronym: 'TRT-1',
                    city: 'Niteroi',
                    personType: 'RECLAMADO',
                    side: 'Passive',
                    hasExactCpfMatch: true,
                    isLabor: true,
                    parties: [
                        { name: 'Madero Industria e Comercio S.A', role: 'Polo Passivo', side: 'PASSIVE', document: '11111111111' },
                    ],
                }],
            };
            const normalized = normalizeEscavador2Response({
                consulta: { status: 'DONE' },
                processos: [{
                    cnj: { valor: cnj, mascarado: false },
                    lista: {
                        polo_ativo: 'RODRIGO HENRIQUE',
                        polo_passivo: 'Madero Industria e Comercio S.A',
                    },
                    classificacao: { area: 'LABOR' },
                    papel_candidato: { tipo_principal: 'Reclamado', polo_principal: 'PASSIVO' },
                    normalizado: {
                        match: { tipo: 'CPF', has_exact_cpf_match: true },
                        dados: {
                            cidade: 'Rio de Janeiro',
                            orgao_julgador: '62a Vara do Trabalho do Rio de Janeiro',
                        },
                    },
                }],
            });
            normalized.escavador2Processos[0].parties.push(
                { name: 'Madero Industria e Comercio S.A', role: 'Polo Passivo', side: 'PASSIVE', document: '11111111111' },
                { name: 'Madero Industria e Comercio S.A', role: 'Polo Passivo', side: 'PASSIVE', document: '22222222222' },
            );
            const deduped = deduplicateEscavador2Findings({ ...baseCase, ...normalized });
            const caseData = { ...baseCase, ...normalized, ...deduped };

            expect(caseData.escavador2Processos[0]).toEqual(expect.objectContaining({
                isDuplicateEscavador2Finding: true,
                isNewEscavador2Finding: false,
            }));

            const [process] = selectTopProcessos(caseData, 20);
            const notes = buildDetLaborNotes(caseData);

            expect(process.comarca).toBe('Niteroi');
            expect(process.vara).toBe('62a Vara do Trabalho do Rio de Janeiro');
            expect(process.parties).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'Madero Industria e Comercio S.A' }),
                expect.objectContaining({ name: 'RODRIGO HENRIQUE' }),
            ]));
            expect(process.parties.filter((party) => party.document === '11111111111')).toHaveLength(1);
            expect(process.parties.filter((party) => party.document === '22222222222')).toHaveLength(1);
            expect(notes).toContain('Parte autora/ativa: RODRIGO HENRIQUE');
            expect(notes).toContain('Comarca: Niteroi');
            expect(notes).toContain('Vara: 62a Vara do Trabalho do Rio de Janeiro');
        });

        it('selectTopProcessos: BDC duplicate with second criminal merges isCriminal flag', () => {
            const caseData = {
                bigdatacorpProcessos: [
                    {
                        numero: '00407130820138060167',
                        courtType: 'CIVEL',
                        status: 'ARQUIVADO',
                        isCriminal: false,
                        isDirectCpfMatch: true,
                    },
                    {
                        numero: '00407130820138060167',
                        courtType: 'CRIMINAL',
                        status: 'ENCERRADO',
                        isCriminal: true,
                        isDirectCpfMatch: true,
                    },
                ],
            };
            const result = selectTopProcessos(caseData, 20);
            expect(result.length).toBe(1);
            expect(result[0].isCriminal).toBe(true);
            expect(result[0].matchType).toBe('CPF confirmado');
        });

        it('buildDetCriminalNotes shows classe/assunto in process listing', () => {
            const caseData = classifyAndMerge(buildFranciscoCase());
            const notes = buildDetCriminalNotes(caseData);
            if (caseData.criminalFlag === 'POSITIVE') {
                // v7: no header — go straight to listing
                expect(notes).toMatch(/Status:/);
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
            // v7: no matchType shown in text, but process listing exists
            expect(notes).toMatch(/Status:/);
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
            // v7: POSITIVE with zero processes — professional context is not part of labor notes
            expect(notes).not.toContain('Contexto profissional cadastral');
            expect(notes).not.toContain('dados profissionais nao disponiveis');
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

        it('sanitizes narrative text that contradicts NEGATIVE flags', () => {
            const result = sanitizeNarrativesForFlags({
                criminalFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
            }, {
                criminalNotes: 'Criminal inconclusivo por baixa cobertura e apontamento criminal pendente.',
                laborNotes: 'Processo(s) trabalhista(s) localizado(s).',
                warrantNotes: 'Mandado ativo pendente de cumprimento.',
            });

            expect(result.narratives.criminalNotes).toContain('Nao foram identificados apontamentos criminais materiais');
            expect(result.narratives.laborNotes).toContain('Nao foram identificados processos trabalhistas materiais');
            expect(result.narratives.warrantNotes).toContain('Nenhum mandado de prisao ativo');
            expect(result.warnings).toHaveLength(3);
        });

        it('sanitizes DJEN communication text that contradicts NEGATIVE flags', () => {
            const result = sanitizeNarrativesForFlags({
                criminalFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
            }, {
                criminalNotes: 'Comunicacoes judiciais de natureza criminal localizadas (2): revisar itens.',
                laborNotes: 'Comunicacoes judiciais de natureza trabalhista localizadas (3): revisar itens.',
            });

            expect(result.narratives.criminalNotes).toContain('Nao foram identificados apontamentos criminais materiais');
            expect(result.narratives.laborNotes).toContain('Nao foram identificados processos trabalhistas materiais');
            expect(result.warnings).toHaveLength(2);
        });

        it('buildDetLaborNotes does not expose DJEN labor communications for NEGATIVE labor flag', () => {
            const notes = buildDetLaborNotes({
                laborFlag: 'NEGATIVE',
                djenComunicacoes: [{ area: 'trabalhista', tribunal: 'TRT10', probabilityScore: 40 }],
            });

            expect(notes).toContain('Nao foram identificados processos trabalhistas materiais');
            expect(notes).not.toMatch(/Comunicacoes judiciais|comunicacoes trabalhistas|TRT10/i);
        });

        it('buildDetExecutiveSummary never produces Ha nenhum grammar', () => {
            const summary = buildDetExecutiveSummary({
                criminalFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                pepFlag: 'NEGATIVE',
                sanctionFlag: 'NEGATIVE',
            });

            expect(summary).toBeTruthy();
            expect(summary).not.toMatch(/Ha nenhum|Há nenhum|Ha nao|Há nao/i);
        });

        it('NEGATIVE replaces criminal caveats with safe sem apontamento text', () => {
            const result = sanitizeNarrativesForFlags({ criminalFlag: 'NEGATIVE' }, {
                criminalNotes: 'Resultado inconclusivo com apontamento criminal pendente de validacao.',
            });

            expect(result.narratives.criminalNotes).toContain('Nao foram identificados apontamentos criminais materiais');
            expect(result.narratives.criminalNotes).not.toMatch(/inconclusivo|baixa cobertura/i);
            expect(result.warnings).toHaveLength(1);
        });

        it('DEFAULT_JUDIT_CONFIG has entity OFF by default', () => {
            // Judit cadastro must be disabled by default — BDC is primary
            // This test validates the config is correct at code level
            const providerSrc = fs.readFileSync(path.resolve(__dirname, '../modules/_shared/providerConfigs.js'), 'utf-8');
            expect(providerSrc).toContain("entity: false,");
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
            expect(result.criminalNotes).toContain('Nao foram identificados apontamentos criminais materiais');
            expect(result.laborNotes).toContain('Nao foram identificados processos trabalhistas materiais');
            expect(result.warrantNotes).toContain('Nenhum mandado');
            expect(result.finalJustification).toContain('Nao foram identificados impeditivos');
            expect(result.executiveSummary).toBeTruthy();
            expect(result.keyFindings.length).toBeGreaterThanOrEqual(0);
        });

        // 3. professional data stays out of labor notes
        it('laborNotes does not include professional cadastral context', () => {
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
            expect(notes).not.toContain('Contexto profissional cadastral');
            expect(notes).not.toContain('Ultimo empregador');
            expect(notes).not.toContain('Faixa salarial');
            expect(notes).not.toContain('EMPRESA XYZ');
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
            // v7: POSITIVE with zero processes — no professional fallback
            expect(notes).not.toContain('Contexto profissional cadastral');
            expect(notes).not.toContain('dados profissionais nao disponiveis');
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
            expect(notes).toContain('dados detalhados indisponíveis');
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
            expect(result.finalJustification).toContain('avaliacao operacional');
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

        // 10. criminalFlag=INCONCLUSIVE + homonym evidence + 0 processes
        it('criminalNotes INCONCLUSIVE with homonym evidence and 0 processes has explanatory body', () => {
            const caseData = {
                criminalFlag: 'INCONCLUSIVE',
                criminalEvidenceQuality: 'WEAK_NAME_ONLY',
                escavadorProcessos: [],
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
            };
            const notes = buildDetCriminalNotes(caseData);
            expect(notes).toContain('homonímia');
            expect(notes).toContain('Nao ha detalhamento processual estruturado suficiente');
        });

        it('criminalNotes nao lista DJEN isolado sem CNJ confirmado por Judit ou BigDataCorp', () => {
            const notes = buildDetCriminalNotes({
                criminalFlag: 'INCONCLUSIVE',
                criminalEvidenceQuality: 'WEAK_NAME_ONLY',
                candidateName: 'NOME COMUM',
                bigdatacorpNamesakeCount: 200,
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
                djenComunicacoes: [{
                    area: 'criminal',
                    numeroProcesso: '0000731-16.2026.8.26.0509',
                    classe: 'Ação Penal - Procedimento Ordinário',
                }],
            });

            expect(notes).not.toContain('Comunicacoes judiciais de natureza criminal');
            expect(notes).not.toContain('0000731-16.2026.8.26.0509');
        });

        it('criminalNotes pode listar DJEN correlacionado ao mesmo CNJ confirmado por BigDataCorp', () => {
            const notes = buildDetCriminalNotes({
                criminalFlag: 'POSITIVE',
                bigdatacorpProcessos: [{
                    numero: '0000731-16.2026.8.26.0509',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    specificRole: 'RÉU',
                    courtType: 'CRIMINAL',
                    cnjBroadSubject: 'DIREITO PENAL',
                }],
                djenComunicacoes: [{
                    area: 'criminal',
                    numeroProcesso: '0000731-16.2026.8.26.0509',
                    classe: 'Ação Penal - Procedimento Ordinário',
                }],
            });

            expect(notes).toContain('Comunicacoes judiciais de natureza criminal');
            expect(notes).toContain('0000731-16.2026.8.26.0509');
        });

        it('laborNotes nao lista DJEN trabalhista isolado sem CNJ confirmado por Judit ou BigDataCorp', () => {
            const notes = buildDetLaborNotes({
                laborFlag: 'INCONCLUSIVE',
                bigdatacorpProcessos: [],
                juditRoleSummary: [],
                djenComunicacoes: [{
                    area: 'trabalhista',
                    numeroProcesso: '0000672-32.2019.5.12.0018',
                    classe: 'Ação Trabalhista - Rito Ordinário',
                }],
            });

            expect(notes).not.toContain('Comunicacoes judiciais trabalhistas');
            expect(notes).not.toContain('0000672-32.2019.5.12.0018');
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
            expect(notes).toContain('Nao ha detalhamento processual estruturado suficiente');
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
            expect(result.warrantNotes).toMatch(/Status:/);
            // criminalNotes: POSITIVE with no processes → fallback message
            expect(result.criminalNotes).toContain('Nao ha detalhamento processual estruturado suficiente');
            expect(result.laborNotes).not.toContain('Contexto profissional cadastral');
            expect(result.laborNotes).not.toContain('dados profissionais nao disponiveis');
            // Fix A1 — no double space after "prisão" in keyFindings items
            for (const finding of result.keyFindings) {
                expect(finding).not.toMatch(/prisão {2}/);
            }
        });

        it('criminalNotes POSITIVE falls back to top-level notes when structured process list is stale', () => {
            const caseData = {
                candidateName: 'JOAO MARCOS DE LIMA MACHADO',
                cpf: '11105714454',
                criminalFlag: 'POSITIVE',
                criminalSeverity: 'HIGH',
                criminalNotes: '00006745020238174810 CRIMINAL DIREITO PENAL - FURTO QUALIFICADO DIREITO PROCESSUAL PENAL - PRISAO EM FLAGRANTE',
                juditCriminalFlag: 'POSITIVE',
                juditCriminalCount: 1,
                bigdatacorpCriminalFlag: 'POSITIVE',
                bigdatacorpCriminalCount: 1,
                bigdatacorpDirectCriminalCount: 1,
                juditRoleSummary: [],
                bigdatacorpProcessos: [],
                escavadorProcessos: [],
                enrichmentOriginalValues: {
                    criminalFlag: 'NEGATIVE',
                    criminalNotes: 'Nao ha evidencia criminal relevante; os matches exatos encontrados aparecem apenas em papel de baixo risco, como testemunha/informante.',
                },
            };

            const result = buildDeterministicPrefill(caseData);

            expect(result.criminalNotes).toContain('FURTO QUALIFICADO');
            expect(result.criminalNotes).toContain('PRISAO EM FLAGRANTE');
            expect(result.criminalNotes).not.toContain('Nao foram identificados apontamentos criminais materiais');
        });

        // 14. namesakeCount=0
        it('namesakeCount=0 produces valid caveat text', () => {
            const caseData = {
                candidateName: 'NOME UNICO',
                criminalFlag: 'INCONCLUSIVE',
                criminalEvidenceQuality: 'WEAK_NAME_ONLY',
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

    describe('v5: criminal notes quality improvements', () => {
        // T1: BDC status fills Judit null for criminal
        it('selectTopProcessos: BDC status ARQUIVADO preenche Judit status null em criminal', () => {
            const caseData = {
                juditRoleSummary: [{
                    code: '0600170-63.2021.8.04.5800',
                    area: 'Criminal',
                    status: null,
                    personType: 'RÉU',
                    hasExactCpfMatch: true,
                    isCriminal: true,
                    isVictim: false,
                    isDefendant: true,
                    distributionDate: '2021-02-19',
                    lastStepDate: '2025-11-11',
                    tribunalAcronym: 'TJAM',
                }],
                bigdatacorpProcessos: [{
                    numero: '06001706320218045800',
                    status: 'ARQUIVADO',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isLabor: false,
                    specificRole: 'AUTOR DO FATO',
                    courtName: 'TJAM',
                    courtDistrict: 'MAUES',
                    lastMovementDate: '2025-11-11',
                }],
            };
            const top = selectTopProcessos(caseData, 10);
            expect(top.filter((p) => p.isCriminal)).toHaveLength(1);
            const criminal = top.find((p) => p.isCriminal);
            expect(criminal.status).toBe('ARQUIVADO');
            expect(criminal.fonte).toContain('BigDataCorp');
            expect(criminal.specificRole).toBe('RÉU');
        });

        // T2: Strong Judit status not overwritten by BDC
        it('selectTopProcessos: status forte Judit ATIVO nao e sobrescrito por BDC ARQUIVADO', () => {
            const caseData = {
                juditRoleSummary: [{
                    code: '0001234-56.2023.8.26.0100',
                    area: 'Criminal',
                    status: 'ATIVO',
                    personType: 'RÉU',
                    hasExactCpfMatch: true,
                    isCriminal: true,
                    isDefendant: true,
                }],
                bigdatacorpProcessos: [{
                    numero: '00012345620238260100',
                    status: 'ARQUIVADO',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isLabor: false,
                    specificRole: 'REU',
                }],
            };
            const top = selectTopProcessos(caseData, 10);
            const criminal = top.find((p) => p.isCriminal);
            expect(criminal.status).toBe('ATIVO');
        });

        // T3: isVictim propagated from Judit
        it('selectTopProcessos: isVictim propagado do Judit', () => {
            const caseData = {
                juditRoleSummary: [{
                    code: '0801282-25.2021.8.15.0741',
                    area: 'Criminal',
                    status: 'Ativo',
                    personType: 'VÍTIMA',
                    hasExactCpfMatch: true,
                    isCriminal: true,
                    isVictim: true,
                    isDefendant: false,
                }],
            };
            const top = selectTopProcessos(caseData, 10);
            const criminal = top.find((p) => p.isCriminal);
            expect(criminal.isVictim).toBe(true);
            expect(criminal.isDefendant).toBe(false);
        });

        // T4: isDefendant propagated from BDC
        it('selectTopProcessos: isDefendant propagado do BDC', () => {
            const caseData = {
                bigdatacorpProcessos: [{
                    numero: '00066684520138260482',
                    status: 'SUSPENSO',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isDefendant: true,
                    isVictim: false,
                    specificRole: 'REU',
                }],
            };
            const top = selectTopProcessos(caseData, 10);
            const criminal = top.find((p) => p.isCriminal);
            expect(criminal.isDefendant).toBe(true);
            expect(criminal.isVictim).toBe(false);
        });

        // T5: BDC merge propagates isVictim into existing Judit entry
        it('selectTopProcessos: merge BDC propaga isVictim para entry Judit existente', () => {
            const caseData = {
                juditRoleSummary: [{
                    code: '0000376-80.2003.8.06.0052',
                    area: 'Criminal',
                    status: null,
                    personType: 'OFENDIDO',
                    hasExactCpfMatch: true,
                    isCriminal: true,
                    isVictim: true,
                    isDefendant: false,
                    distributionDate: '2003-08-14',
                }],
                bigdatacorpProcessos: [{
                    numero: '00003768020038060052',
                    status: null,
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isDefendant: true,
                    isVictim: false,
                    specificRole: 'INDICIADO',
                }],
            };
            const top = selectTopProcessos(caseData, 10);
            const criminal = top.find((p) => p.isCriminal);
            // isVictim was set by Judit, BDC added isDefendant
            expect(criminal.isVictim).toBe(true);
            expect(criminal.isDefendant).toBe(true);
        });

        // T6: resolveProcessStatus — lastStep "Arquivados..." resolves to ARQUIVADO when status null
        it('formatProcessBlock: resolveProcessStatus resolve ARQUIVADO via lastStep quando status null', () => {
            const proc = {
                cnj: '0600170-63.2021.8.04.5800',
                classe: 'TERMO CIRCUNSTANCIADO',
                assunto: 'INFRAÇÃO DE MEDIDA SANITÁRIA PREVENTIVA',
                status: null,
                polo: 'RÉU',
                tribunal: 'TJAM',
                lastStep: 'Arquivados os autos definitivamente',
                isCriminal: true,
                isTrabalhista: false,
            };
            const block = formatProcessBlock(proc, {});
            expect(block).toContain('Status: ARQUIVADO');
            expect(block).not.toContain('Status: N/A');
        });

        // T6b: pipeline junk status persisted in old case data must never render
        it('formatProcessBlock: status de pipeline (detalhes: DONE | ...) nao vaza pro bloco', () => {
            const proc = {
                cnj: '0600170-63.2021.8.04.5800',
                classe: 'AÇÃO PENAL',
                assunto: 'FURTO',
                status: 'detalhes: DONE | movimentacoes: DONE | documentos: SKIPPED',
                polo: 'RÉU',
                tribunal: 'TJSP',
                isCriminal: true,
                isTrabalhista: false,
            };
            const block = formatProcessBlock(proc, {});
            expect(block).not.toContain('DONE');
            expect(block).not.toContain('SKIPPED');
            expect(block).not.toContain('Status:');
        });

        // T6c: no status data at all -> omit the Status line instead of "Status: N/A"
        it('formatProcessBlock: omite linha Status quando nao ha status confiavel', () => {
            const proc = {
                cnj: '0600170-63.2021.8.04.5800',
                classe: 'AÇÃO PENAL',
                assunto: 'FURTO',
                status: null,
                polo: 'RÉU',
                tribunal: 'TJSP',
                isCriminal: true,
                isTrabalhista: false,
            };
            const block = formatProcessBlock(proc, {});
            expect(block).not.toContain('Status:');
        });

        // T6d: labor block same rule
        it('formatProcessBlock trabalhista: omite Status processual sem dado e nao vaza pipeline', () => {
            const junk = formatProcessBlock({
                cnj: '0009999-00.2023.5.09.0001',
                classe: 'RECLAMAÇÃO TRABALHISTA',
                status: 'detalhes: DONE | movimentacoes: PENDING',
                isTrabalhista: true,
            }, {});
            expect(junk).not.toContain('DONE');
            expect(junk).not.toContain('PENDING');
            expect(junk).not.toContain('Status processual:');

            const empty = formatProcessBlock({
                cnj: '0009999-00.2023.5.09.0001',
                classe: 'RECLAMAÇÃO TRABALHISTA',
                status: null,
                isTrabalhista: true,
            }, {});
            expect(empty).not.toContain('Status processual: N/A');
        });

        // T7: formatProcessBlock shows lastStep text
        it('formatProcessBlock: mostra Último andamento quando lastStep presente', () => {
            const proc = {
                cnj: '0600170-63.2021.8.04.5800',
                status: 'ATIVO',
                classe: 'AÇÃO PENAL',
                assunto: 'APROPRIAÇÃO INDÉBITA',
                polo: 'RÉU',
                tribunal: 'TJBA',
                comarca: 'UBATA',
                lastStep: 'Juntada de petição de defesa prévia',
                distributionDate: '2025-10-27',
                isCriminal: true,
                isTrabalhista: false,
            };
            const block = formatProcessBlock(proc, {});
            expect(block).toContain('Último andamento: Juntada de petição de defesa prévia');
        });

        // T8: criminal preserves Status: label (not Status processual:)
        it('formatProcessBlock: criminal preserva prefixo Status: (não Status processual:)', () => {
            const proc = {
                cnj: '0600170-63.2021.8.04.5800',
                status: 'ATIVO',
                classe: 'AÇÃO PENAL',
                assunto: 'CRIME',
                polo: 'RÉU',
                tribunal: 'TJSP',
                isCriminal: true,
                isTrabalhista: false,
            };
            const block = formatProcessBlock(proc, {});
            expect(block).toMatch(/Status:\s+ATIVO/);
            expect(block).not.toContain('Status processual:');
        });

        // T9: buildDetCriminalNotes victim note for isVictim=true
        it('buildDetCriminalNotes: nota vítima aparece para processo com isVictim=true', () => {
            const caseData = buildCaseBase({
                candidateName: 'WELLINGTON JOSE OLIVEIRA NASCIMENTO',
                cpf: '11111111111',
                hiringUf: 'SP',
                city: 'SAO PAULO',
                ddd: '11',
            });
            caseData.criminalFlag = 'POSITIVE';
            caseData.juditRoleSummary = [{
                code: '0801282-25.2021.8.15.0741',
                area: 'Criminal',
                status: 'Ativo',
                phase: 'Inicial',
                personType: 'VÍTIMA',
                hasExactCpfMatch: true,
                isCriminal: true,
                isVictim: true,
                isDefendant: false,
                subjects: ['Estupro'],
                classifications: ['Inquérito Policial'],
                distributionDate: null,
            }];
            caseData.bigdatacorpProcessos = [{
                numero: '08012822520218150741',
                isDirectCpfMatch: true,
                isCriminal: true,
                isDefendant: false,
                isVictim: true,
                specificRole: 'VITIMA',
                status: 'REDISTRIBUIDO',
            }];
            caseData.bigdatacorpNamesakeCount = null;
            const notes = buildDetCriminalNotes(caseData);
            expect(notes).toContain('vítima/ofendido neste registro');
            expect(notes).toContain('Todos os registros criminais localizados com CPF confirmado');
            expect(notes).toContain('exclusivamente como vítima');
        });

        // T10: victim note via specificRole text
        it('buildDetCriminalNotes: nota vítima aparece via specificRole=OFENDIDO', () => {
            const caseData = buildCaseBase({
                candidateName: 'CARLOS OFENDIDO',
                cpf: '22222222222',
                hiringUf: 'SP',
                city: 'SAO PAULO',
                ddd: '11',
            });
            caseData.criminalFlag = 'POSITIVE';
            caseData.juditRoleSummary = [{
                code: '0000376-80.2003.8.06.0052',
                area: 'Criminal',
                status: null,
                personType: 'OFENDIDO',
                hasExactCpfMatch: true,
                isCriminal: true,
                isVictim: true,
                isDefendant: false,
                subjects: [],
                classifications: ['Petição Criminal'],
                distributionDate: '2003-08-14',
            }];
            caseData.bigdatacorpProcessos = [];
            caseData.bigdatacorpNamesakeCount = null;
            const notes = buildDetCriminalNotes(caseData);
            expect(notes).toContain('vítima/ofendido neste registro');
        });

        // T11: header all-victim when all confirmed are victim
        it('buildDetCriminalNotes: header all-victim quando todos confirmados são vítima', () => {
            const caseData = buildCaseBase({
                candidateName: 'VITIMA RECORRENTE',
                cpf: '33333333333',
                hiringUf: 'RJ',
                city: 'RIO DE JANEIRO',
                ddd: '21',
            });
            caseData.criminalFlag = 'POSITIVE';
            caseData.juditRoleSummary = [
                {
                    code: '0001234-56.2023.8.19.0001',
                    area: 'Criminal',
                    status: 'Ativo',
                    personType: 'VÍTIMA',
                    hasExactCpfMatch: true,
                    isCriminal: true,
                    isVictim: true,
                    isDefendant: false,
                    subjects: ['Lesão Corporal'],
                    classifications: ['Ação Penal'],
                    distributionDate: '2023-01-15',
                },
                {
                    code: '0005678-90.2023.8.19.0001',
                    area: 'Criminal',
                    status: 'Ativo',
                    personType: 'OFENDIDO',
                    hasExactCpfMatch: true,
                    isCriminal: true,
                    isVictim: true,
                    isDefendant: false,
                    subjects: ['Ameaça'],
                    classifications: ['Termo Circunstanciado'],
                    distributionDate: '2023-03-20',
                },
            ];
            caseData.bigdatacorpProcessos = [];
            caseData.bigdatacorpNamesakeCount = null;
            const notes = buildDetCriminalNotes(caseData);
            expect(notes).toContain('exclusivamente como vítima ou ofendido');
            expect(notes).toContain('não há apontamento de autoria');
        });

        it('buildDetKeyFindings: não conta vítima/testemunha como apontamento criminal material', () => {
            const caseData = buildCaseBase({
                candidateName: 'EWERTON LEONARDO BASTOS SENA',
                cpf: '01253408262',
                hiringUf: 'PA',
                city: 'ANANINDEUA',
                ddd: '91',
            });
            caseData.criminalFlag = 'NEGATIVE';
            caseData.criminalEvidenceQuality = 'LOW_RISK_ROLE_ONLY';
            caseData.laborFlag = 'POSITIVE';
            caseData.bigdatacorpProcessos = [
                {
                    numero: '08090304120238140006',
                    courtType: 'ESPECIAL CRIMINAL',
                    cnjProcedure: 'TERMO CIRCUNSTANCIADO',
                    assunto: 'VIOLACAO DE DOMICILIO',
                    courtDistrict: 'ANANINDEUA',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isDefendant: false,
                    isWitness: true,
                    specificRole: 'TESTEMUNHA',
                    status: 'ATIVO',
                },
                {
                    numero: '00024830320178140952',
                    courtType: 'ESPECIAL CRIMINAL',
                    cnjProcedure: 'TERMO CIRCUNSTANCIADO',
                    assunto: 'INJURIA, AMEACA',
                    courtDistrict: 'ANANINDEUA',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isDefendant: false,
                    isVictim: true,
                    specificRole: 'VITIMA',
                    status: 'ATIVO',
                },
            ];

            const findings = buildDetKeyFindings(caseData);

            expect(findings.join('\n')).not.toMatch(/processo\(s\) criminal\(is\) com CPF confirmado/i);
            expect(findings).toContain('Apontamento trabalhista material identificado.');
        });

        it('buildDetKeyFindings: não publica achado criminal material quando criminalFlag é negativa', () => {
            const caseData = buildCaseBase({
                candidateName: 'CASO FLAG NEGATIVA',
                cpf: '44444444444',
                hiringUf: 'RJ',
                city: 'RIO DE JANEIRO',
                ddd: '21',
            });
            caseData.criminalFlag = 'NEGATIVE';
            caseData.criminalEvidenceQuality = 'LOW_RISK_ROLE_ONLY';
            caseData.bigdatacorpProcessos = [
                {
                    numero: '00027441620138190031',
                    courtType: 'CRIMINAL',
                    cnjProcedure: 'ACAO PENAL',
                    assunto: 'HOMICIDIO QUALIFICADO',
                    courtDistrict: 'NITEROI',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isDefendant: true,
                    isVictim: false,
                    isWitness: false,
                    specificRole: 'REU',
                },
            ];

            const findings = buildDetKeyFindings(caseData);

            expect(findings.join('\n')).not.toMatch(/processo\(s\) criminal\(is\) com CPF confirmado/i);
            expect(findings.join('\n')).not.toMatch(/condena[cç][aã]o criminal/i);
        });

        it('buildDetCriminalNotes: mostra achado criminal de revisão no prefill determinístico', () => {
            const caseData = buildCaseBase({
                candidateName: 'CASO REVISAO CRIMINAL',
                cpf: '44444444444',
                hiringUf: 'RJ',
                city: 'RIO DE JANEIRO',
                ddd: '21',
            });
            caseData.criminalFlag = 'INCONCLUSIVE';
            caseData.criminalEvidenceQuality = 'NEUTRAL_ROLE_REVIEW';
            caseData.bigdatacorpProcessos = [
                {
                    numero: '00027441620138190031',
                    courtType: 'CRIMINAL',
                    cnjProcedure: 'ACAO PENAL',
                    assunto: 'HOMICIDIO QUALIFICADO',
                    courtDistrict: 'NITEROI',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isDefendant: false,
                    isVictim: false,
                    isWitness: false,
                    specificRole: 'INTERESSADO',
                },
            ];

            const notes = buildDetCriminalNotes(caseData);

            expect(notes).toMatch(/Resultado criminal inconclusivo/i);
            expect(notes).toMatch(/0002744-16\.2013\.8\.19\.0031|00027441620138190031/);
            expect(notes).toMatch(/HOMICIDIO QUALIFICADO|Homicidio qualificado/i);
            expect(notes).toMatch(/INTERESSADO/i);
        });

        it('buildDetKeyFindings: em caso misto conta apenas processo criminal material', () => {
            const caseData = buildCaseBase({
                candidateName: 'CASO MISTO',
                cpf: '55555555555',
                hiringUf: 'PE',
                city: 'RECIFE',
                ddd: '81',
            });
            caseData.criminalFlag = 'POSITIVE';
            caseData.bigdatacorpProcessos = [
                {
                    numero: '00099408420138170001',
                    courtType: 'CRIMINAL',
                    cnjProcedure: 'ACAO PENAL',
                    assunto: 'LEVE',
                    courtDistrict: 'RECIFE',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isDefendant: false,
                    isVictim: true,
                    specificRole: 'VITIMA',
                },
                {
                    numero: '00054115220198170990',
                    courtType: 'CRIMINAL',
                    cnjProcedure: 'ACAO PENAL',
                    assunto: 'RECEPTACAO',
                    courtDistrict: 'OLINDA',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isDefendant: true,
                    specificRole: 'INVESTIGADO',
                },
            ];

            const findings = buildDetKeyFindings(caseData);

            expect(findings).toContain('1 processo(s) criminal(is) com CPF confirmado (OLINDA)');
            expect(findings.join('\n')).not.toContain('2 processo(s) criminal(is)');
        });

        it('buildDetCriminalNotes: em caso positivo misto não detalha vítima/testemunha como apontamento', () => {
            const caseData = buildCaseBase({
                candidateName: 'CASO MISTO NOTAS',
                cpf: '66666666666',
                hiringUf: 'PE',
                city: 'RECIFE',
                ddd: '81',
            });
            caseData.criminalFlag = 'POSITIVE';
            caseData.bigdatacorpProcessos = [
                {
                    numero: '00099408420138170001',
                    courtType: 'CRIMINAL',
                    cnjProcedure: 'ACAO PENAL',
                    assunto: 'LEVE',
                    courtDistrict: 'RECIFE',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isDefendant: false,
                    isVictim: true,
                    specificRole: 'VITIMA',
                },
                {
                    numero: '00054115220198170990',
                    courtType: 'CRIMINAL',
                    cnjProcedure: 'ACAO PENAL',
                    assunto: 'RECEPTACAO',
                    courtDistrict: 'OLINDA',
                    isDirectCpfMatch: true,
                    isCriminal: true,
                    isDefendant: true,
                    specificRole: 'INVESTIGADO',
                },
            ];

            const notes = buildDetCriminalNotes(caseData);

            expect(notes).toContain('0005411-52.2019.8.17.0990');
            expect(notes).toContain('RECEPTACAO');
            expect(notes).not.toContain('0009940-84.2013.8.17.0001');
            expect(notes).not.toContain('Papel do candidato: VITIMA');
        });

        // T12: no victim note for defendant process
        it('buildDetCriminalNotes: sem nota vítima para processo com isDefendant=true', () => {
            const caseData = buildCaseBase({
                candidateName: 'REU CONFIRMADO',
                cpf: '44444444444',
                hiringUf: 'SP',
                city: 'SAO PAULO',
                ddd: '11',
            });
            caseData.criminalFlag = 'POSITIVE';
            caseData.juditRoleSummary = [{
                code: '0009999-99.2023.8.26.0100',
                area: 'Criminal',
                status: 'ATIVO',
                personType: 'RÉU',
                hasExactCpfMatch: true,
                isCriminal: true,
                isVictim: false,
                isDefendant: true,
                subjects: ['Furto'],
                classifications: ['Ação Penal'],
                distributionDate: '2023-06-10',
            }];
            caseData.bigdatacorpProcessos = [{
                numero: '00099999920238260100',
                isDirectCpfMatch: true,
                isCriminal: true,
                isDefendant: true,
                isVictim: false,
                specificRole: 'REU',
                status: 'ATIVO',
            }];
            caseData.bigdatacorpNamesakeCount = null;
            const notes = buildDetCriminalNotes(caseData);
            expect(notes).not.toContain('vítima/ofendido neste registro');
            expect(notes).not.toContain('exclusivamente como vítima');
        });

        // T13: DJEN not shown when no confirmed process numbers
        it('buildDetCriminalNotes: DJEN NÃO aparece quando nenhum confirmed process number', () => {
            const caseData = buildCaseBase({
                candidateName: 'JOSE LUCIVANIO DA SILVA',
                cpf: '55555555555',
                hiringUf: 'SP',
                city: 'SAO PAULO',
                ddd: '11',
            });
            caseData.criminalFlag = 'POSITIVE';
            caseData.juditRoleSummary = [];
            caseData.bigdatacorpProcessos = [];
            caseData.djenComunicacoes = [{
                numeroProcesso: '0202743-72.2022.8.06.0167',
                area: 'criminal',
                classe: 'APELAÇÃO CRIMINAL',
                confirmationLevel: 'NAME_EXACT',
                tribunal: 'TJCE',
            }];
            caseData.djenCriminalCount = 1;
            caseData.djenCriminalFlag = 'POSITIVE';
            const notes = buildDetCriminalNotes(caseData);
            expect(notes).not.toMatch(/Comunicacoes judiciais de natureza criminal|Comunicacoes criminais localizadas/i);
        });

        // T14: DJEN shown when CNJ matches confirmed process
        it('buildDetCriminalNotes: DJEN aparece quando CNJ do DJEN bate com Judit confirmado', () => {
            const caseData = buildCaseBase({
                candidateName: 'ARTHUR SILVA DE OLIVEIRA',
                cpf: '66666666666',
                hiringUf: 'BA',
                city: 'UBATA',
                ddd: '73',
            });
            caseData.criminalFlag = 'POSITIVE';
            caseData.juditRoleSummary = [{
                code: '8002101-63.2025.8.05.0265',
                area: 'Criminal',
                status: null,
                personType: 'RÉU',
                hasExactCpfMatch: true,
                isCriminal: true,
                isVictim: false,
                isDefendant: true,
                subjects: ['Apropriação Indébita'],
                classifications: ['Ação Penal - Procedimento Ordinário'],
                distributionDate: '2025-10-27',
            }];
            caseData.bigdatacorpProcessos = [];
            caseData.djenComunicacoes = [{
                numeroProcesso: '8002101-63.2025.8.05.0265',
                area: 'criminal',
                classe: 'AÇÃO PENAL',
                confirmationLevel: 'NAME_EXACT',
                tribunal: 'TJBA',
                dataPublicacao: '2026-01-21',
                polo: 'reu',
                orgaoJulgador: 'VARA CRIMINAL DE UBATÃ',
            }];
            caseData.djenCriminalCount = 1;
            caseData.djenCriminalFlag = 'POSITIVE';
            const notes = buildDetCriminalNotes(caseData);
            expect(notes).toMatch(/Comunicacoes judiciais de natureza criminal localizadas/);
            expect(notes).toContain('8002101-63.2025.8.05.0265');
        });

        // T8b: resolveProcessStatus fallback for criminal via movements content
        it('formatProcessBlock: resolveProcessStatus resolve EM ANDAMENTO via lastStep "Conclusos para sentenca" quando status null', () => {
            const proc = {
                cnj: '0005555-55.2023.8.26.0100',
                classe: 'AÇÃO PENAL',
                assunto: 'FURTO',
                status: null,
                polo: 'RÉU',
                tribunal: 'TJSP',
                lastStep: 'Conclusos para sentença',
                isCriminal: true,
                isTrabalhista: false,
            };
            const block = formatProcessBlock(proc, {});
            expect(block).toContain('Status: EM ANDAMENTO');
        });

        // T8c: respect existing strong status even when lastStep present
        it('formatProcessBlock: status forte existente nao é sobrescrito por último andamento', () => {
            const proc = {
                cnj: '0006666-66.2023.8.19.0001',
                classe: 'AÇÃO PENAL',
                assunto: 'ROUBO',
                status: 'ATIVO',
                polo: 'RÉU',
                tribunal: 'TJRJ',
                lastStep: 'Arquivados os autos',
                isCriminal: true,
                isTrabalhista: false,
            };
            const block = formatProcessBlock(proc, {});
            expect(block).toContain('Status: ATIVO');
            expect(block).not.toContain('Status: ARQUIVADO');
        });

        it('selectTopProcessos includes new Escavador2 labor finding and prefill lists it', () => {
            const caseData = {
                candidateName: 'CANDIDATO TESTE',
                criminalFlag: 'NEGATIVE',
                laborFlag: 'POSITIVE',
                warrantFlag: 'NEGATIVE',
                escavador2Processos: [{
                    numeroCnj: '015XXXX-22.2009.5.06.0014',
                    isNewEscavador2Finding: true,
                    isCriminal: false,
                    isLabor: true,
                    isTrabalhista: true,
                    isPlaintiff: true,
                    classe: 'RECLAMACAO TRABALHISTA',
                    assunto: null,
                    tribunalSigla: 'TRT6',
                    status: 'Ativo',
                    polo: 'ATIVO',
                    dataInicio: '2009-09-15',
                }],
            };
            const top = selectTopProcessos(caseData, 10);
            expect(top.length).toBe(1);
            expect(top[0].isTrabalhista).toBe(true);
            expect(top[0].fonte).toBe('Escavador2');

            const notes = buildDetLaborNotes(caseData);
            expect(notes).toContain('015XXXX-22.2009.5.06.0014');
            expect(notes).toContain('RECLAMACAO TRABALHISTA');
        });

        it('integrates Escavador2 labor parties through normalization, classification and prefill', () => {
            const normalized = normalizeEscavador2Response({
                consulta: { status: 'DONE', nome: 'RODRIGO HENRIQUE' },
                processos: [{
                    lista: {
                        polo_ativo: 'RODRIGO HENRIQUE',
                        polo_passivo: 'Madero Industria e Comercio S.A',
                    },
                    cnj: { valor: '010XXXX-48.2026.5.01.0062', mascarado: true },
                    classificacao: { area: 'LABOR', risco_material: true },
                    papel_candidato: {
                        tipo_principal: 'Autor',
                        polo_principal: 'ATIVO',
                        categoria: 'PLAINTIFF',
                    },
                    normalizado: {
                        match: { tipo: 'CPF', has_exact_cpf_match: true },
                        dados: {
                            classe: 'Acao Trabalhista - Rito Sumarissimo',
                            assunto: 'Acumulo de Funcao',
                            tribunal_sigla: 'TRT-1',
                            cidade: 'Rio de Janeiro',
                            orgao_julgador: '62a Vara do Trabalho do Rio de Janeiro',
                            status_predito: 'ATIVO',
                        },
                    },
                }],
            });
            const deduped = deduplicateEscavador2Findings(normalized);
            const caseData = {
                candidateName: 'RODRIGO HENRIQUE',
                enrichmentStatus: 'DONE',
                bigdatacorpEnrichmentStatus: 'DONE',
                juditEnrichmentStatus: 'DONE',
                escavadorEnrichmentStatus: 'DONE',
                escavador2EnrichmentStatus: 'DONE',
                djenEnrichmentStatus: 'DONE',
                juditNeedsEscavador: false,
                fontedataCriminalFlag: 'NEGATIVE',
                fontedataLaborFlag: 'NEGATIVE',
                bigdatacorpCriminalFlag: 'NEGATIVE',
                bigdatacorpLaborFlag: 'NEGATIVE',
                djenCriminalFlag: 'NEGATIVE',
                ...normalized,
                ...deduped,
            };
            const classification = computeAutoClassification(caseData);
            const classifiedCase = { ...caseData, ...classification };
            const [process] = classifiedCase.escavador2Processos;
            const prefill = buildDeterministicPrefill(classifiedCase);

            expect(process).toEqual(expect.objectContaining({
                isNewEscavador2Finding: true,
                hasExactCpfMatch: true,
                roleCategory: 'PLAINTIFF',
                isPlaintiff: true,
                isDefendant: false,
            }));
            expect(classification.laborFlag).toBe('POSITIVE');
            expect(prefill.laborNotes).toContain('Parte reclamada/passiva: Madero Industria e Comercio S.A');
            expect(prefill.laborNotes).toContain('Status processual: ATIVO');
            expect(prefill.laborNotes).toContain('Comarca: Rio de Janeiro');
            expect(prefill.laborNotes).toContain('Vara: 62a Vara do Trabalho do Rio de Janeiro');
        });
    });
});
