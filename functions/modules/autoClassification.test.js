import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    canRunFinalClassification,
    computeAutoClassifySignature,
    computeAutoClassification,
    createAutoClassificationHandlers,
} = require('./autoClassification');

function mockBuildHomonymAnalysisInput() {
    return {
        needsAnalysis: false,
        providerCoverage: {
            overall: {
                level: 'HIGH_COVERAGE',
                providerDivergence: 'NONE',
                reasons: [],
            },
        },
        referenceCandidates: [],
        ambiguousCandidates: [],
        hardFacts: [],
        ambiguityReasons: [],
    };
}

function mockFilterDjenComunicacoesByConfirmedProcess() {
    return [];
}

const mockSafeNarrativeTexts = {
    laborNegative: 'Nenhum processo trabalhista encontrado.',
};

const mockDeps = {
    buildHomonymAnalysisInput: mockBuildHomonymAnalysisInput,
    filterDjenComunicacoesByConfirmedProcess: mockFilterDjenComunicacoesByConfirmedProcess,
    SAFE_NARRATIVE_TEXTS: mockSafeNarrativeTexts,
};

function makeCase(overrides = {}) {
    return {
        enrichmentStatus: 'DONE',
        bigdatacorpEnrichmentStatus: 'DONE',
        juditEnrichmentStatus: 'DONE',
        escavadorEnrichmentStatus: 'DONE',
        djenEnrichmentStatus: 'DONE',
        juditNeedsEscavador: false,
        ...overrides,
    };
}

function makeCaseWithEscavador2NewFindings(overrides = {}) {
    return makeCase({
        escavador2EnrichmentStatus: 'DONE',
        escavador2Processos: [],
        ...overrides,
    });
}

describe('canRunFinalClassification', () => {
    const hasPendingJuditAsync = vi.fn(() => false);
    const isProviderTerminalForPipeline = vi.fn((status) =>
        ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED', 'BLOCKED'].includes(status),
    );
    const helpers = { hasPendingJuditAsync, isProviderTerminalForPipeline };

    it('returns ready when all providers are terminal', () => {
        const result = canRunFinalClassification(makeCase(), helpers);
        expect(result).toEqual({ ok: true, reason: 'ready' });
    });

    it('defers when judit async is pending', () => {
        hasPendingJuditAsync.mockReturnValueOnce(true);
        const result = canRunFinalClassification(makeCase(), helpers);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('judit_async_pending');
    });

    it('defers with fallback helper when judit pending async count is positive', () => {
        const result = canRunFinalClassification(makeCase({ juditPendingAsyncCount: 1 }));
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('judit_async_pending');
    });

    it('defers when bigdatacorp is not terminal', () => {
        const result = canRunFinalClassification(makeCase({ bigdatacorpEnrichmentStatus: 'RUNNING' }), helpers);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('bigdatacorp_RUNNING');
    });

    it('defers when judit is not terminal', () => {
        const result = canRunFinalClassification(makeCase({ juditEnrichmentStatus: 'PENDING' }), helpers);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('judit_PENDING');
    });

    it('defers when escavador is required but not terminal', () => {
        const result = canRunFinalClassification(makeCase({ juditNeedsEscavador: true, escavadorEnrichmentStatus: 'RUNNING' }), helpers);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('escavador_RUNNING');
    });

    it('defers when djen is pending', () => {
        const result = canRunFinalClassification(makeCase({ djenEnrichmentStatus: 'RUNNING' }), helpers);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('djen_RUNNING');
    });

    it('defers when escavador2 is pending (Escavador2)', () => {
        const result = canRunFinalClassification(makeCase({ escavador2EnrichmentStatus: 'PENDING' }), helpers);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('escavador2_PENDING');
    });

    it('allows when escavador2 failed (Escavador2)', () => {
        const result = canRunFinalClassification(makeCase({ escavador2EnrichmentStatus: 'FAILED' }), helpers);
        expect(result.ok).toBe(true);
        expect(result.reason).toBe('ready');
    });
});

describe('computeAutoClassifySignature', () => {
    const computeSimpleHash = vi.fn((val) => `hash_${val.length}`);

    it('computes signature from case data', () => {
        const caseData = {
            enrichmentGeneration: 1,
            bigdatacorpEnrichmentStatus: 'DONE',
            bigdatacorpProcessTotal: 5,
            juditPendingAsyncPhases: ['warrant', 'execution'],
            bigdatacorpActiveWarrants: [{ numero: '123' }, { id: '456' }],
        };
        const result = computeAutoClassifySignature(caseData, { computeSimpleHash });
        expect(result).toMatch(/^hash_/);
        expect(computeSimpleHash).toHaveBeenCalled();
    });

    it('handles empty case data', () => {
        const result = computeAutoClassifySignature({}, { computeSimpleHash });
        expect(result).toMatch(/^hash_/);
    });

    it('includes Escavador2 fields in signature', () => {
        const caseData = {
            enrichmentGeneration: 1,
            escavador2EnrichmentStatus: 'DONE',
            escavador2ProcessTotal: 3,
            escavador2CriminalCount: 1,
            escavador2LaborCount: 1,
            escavador2NewFindingCount: 2,
            escavador2DuplicateCount: 1,
            escavador2HasNewMaterialRisk: true,
        };
        const result = computeAutoClassifySignature(caseData, { computeSimpleHash });
        expect(result).toMatch(/^hash_/);
        expect(computeSimpleHash).toHaveBeenCalledWith(expect.stringContaining('"escavador2EnrichmentStatus":"DONE"'));
        expect(computeSimpleHash).toHaveBeenCalledWith(expect.stringContaining('"escavador2ProcessTotal":3'));
        expect(computeSimpleHash).toHaveBeenCalledWith(expect.stringContaining('"escavador2HasNewMaterialRisk":true'));
    });

    it('changes signature when Escavador2 process role changes but counts stay same', () => {
        const makeCaseWithRole = (isDefendant) => ({
            escavador2EnrichmentStatus: 'DONE',
            escavador2ProcessTotal: 1,
            escavador2CriminalCount: 1,
            escavador2LaborCount: 0,
            escavador2NewFindingCount: 1,
            escavador2DuplicateCount: 0,
            escavador2HasNewMaterialRisk: false,
            escavador2Processos: [{
                numeroCnj: '0001234-56.2024.8.26.0100',
                isCriminal: true,
                isLabor: false,
                isNewEscavador2Finding: true,
                isDefendant,
                isPlaintiff: false,
                isVictim: false,
                isWitness: false,
                isMaterialRisk: false,
                isExcludedCrimeType: false,
            }],
            bigdatacorpEnrichmentStatus: 'DONE',
            juditEnrichmentStatus: 'DONE',
            escavadorEnrichmentStatus: 'SKIPPED',
            djenEnrichmentStatus: 'SKIPPED',
            enrichmentStatus: 'SKIPPED',
        });

        const sigA = computeAutoClassifySignature(makeCaseWithRole(false), { computeSimpleHash });
        const sigB = computeAutoClassifySignature(makeCaseWithRole(true), { computeSimpleHash });
        expect(sigA).not.toBe(sigB);
    });
});

describe('computeAutoClassification', () => {
    it('returns NEGATIVE when no evidence', () => {
        const caseData = makeCase({
            fontedataCriminalFlag: 'NEGATIVE',
            bigdatacorpCriminalFlag: 'NEGATIVE',
            djenCriminalFlag: 'NEGATIVE',
        });
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.criminalFlag).toBe('NEGATIVE');
        expect(result.warrantFlag).toBe('NEGATIVE');
        expect(result.laborFlag).toBe('NEGATIVE');
    });

    it('returns POSITIVE criminal when fontedata is positive', () => {
        const caseData = makeCase({
            fontedataCriminalFlag: 'POSITIVE',
            bigdatacorpCriminalFlag: 'NEGATIVE',
            djenCriminalFlag: 'NEGATIVE',
        });
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.criminalFlag).toBe('POSITIVE');
        expect(result.criminalEvidenceQuality).toBe('HARD_FACT');
    });

    it('returns POSITIVE warrant when judit warrant is positive', () => {
        const caseData = makeCase({
            juditWarrantFlag: 'POSITIVE',
            juditActiveWarrantCount: 2,
        });
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.warrantFlag).toBe('POSITIVE');
    });

    it('returns POSITIVE labor when fontedata labor is positive', () => {
        const caseData = makeCase({
            fontedataLaborFlag: 'POSITIVE',
        });
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.laborFlag).toBe('POSITIVE');
    });

    it('handles PEP detection', () => {
        const caseData = makeCase({
            bigdatacorpIsPep: true,
            bigdatacorpPepLevel: 'MUNICIPAL',
        });
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.pepFlag).toBe('POSITIVE');
        expect(result.pepLevel).toBe('MUNICIPAL');
        expect(result.reviewRecommended).toBe(true);
    });

    it('handles sanctions detection', () => {
        const caseData = makeCase({
            bigdatacorpIsSanctioned: true,
            bigdatacorpSanctionSources: ['INTERPOL'],
        });
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.sanctionFlag).toBe('POSITIVE');
        expect(result.sanctionSources).toContain('INTERPOL');
    });

    it('returns NOT_FOUND when all providers failed', () => {
        const caseData = makeCase({
            escavadorEnrichmentStatus: 'FAILED',
            juditEnrichmentStatus: 'FAILED',
            enrichmentStatus: 'FAILED',
        });
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.criminalFlag).toBe('NOT_FOUND');
    });

    it('preserves enrichmentOriginalValues', () => {
        const caseData = makeCase({
            enrichmentOriginalValues: { previous: 'value' },
        });
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.enrichmentOriginalValues.previous).toBe('value');
        expect(result.enrichmentOriginalValues.criminalFlag).toBe(result.criminalFlag);
    });

    it('does not throw when Escavador2 has new criminal/labor findings', () => {
        const caseData = makeCase({
            escavador2EnrichmentStatus: 'DONE',
            escavador2Processos: [
                { isNewEscavador2Finding: true, isCriminal: true },
                { isNewEscavador2Finding: true, isLabor: true },
            ],
        });
        expect(() => computeAutoClassification(caseData, mockDeps)).not.toThrow();
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.criminalNotes).toContain(
            'Nova consulta processual identificou 1 processo(s) criminal(is) novo(s), sem papel material confirmatorio.',
        );
        expect(result.laborNotes).toContain(
            'Nova consulta processual identificou 1 processo(s) trabalhista(s) ativo(s) nao identificado(s) pelos demais provedores.',
        );
    });

    it('returns POSITIVE criminal when Escavador2 has a new material criminal finding', () => {
        const caseData = makeCaseWithEscavador2NewFindings({
            escavador2Processos: [{
                numeroCnj: '000XXXX-33.2022.8.17.8201',
                isNewEscavador2Finding: true,
                isCriminal: true,
                isLabor: false,
                isDefendant: true,
                isVictim: false,
                isWitness: false,
                isMaterialRisk: true,
                classe: 'TERMO CIRCUNSTANCIADO',
                assunto: 'Receptacao culposa',
            }],
        });
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.criminalFlag).toBe('POSITIVE');
        expect(result.criminalNotes).toContain('Nova consulta processual identificou 1 processo(s) criminal(is) material(is) nao identificado(s) pelos demais provedores.');
        expect(result.criminalNotes).toContain('Escavador2');
    });

    it('returns POSITIVE labor when Escavador2 has a new plaintiff labor finding', () => {
        const caseData = makeCaseWithEscavador2NewFindings({
            escavador2Processos: [{
                numeroCnj: '015XXXX-22.2009.5.06.0014',
                isNewEscavador2Finding: true,
                isCriminal: false,
                isLabor: true,
                isTrabalhista: true,
                isPlaintiff: true,
                isDefendant: false,
                classe: 'RECLAMACAO TRABALHISTA',
                assunto: null,
            }],
        });
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.laborFlag).toBe('POSITIVE');
        expect(result.laborNotes).toContain('Escavador2');
    });

    it('keeps labor NEGATIVE when Escavador2 new finding is only a labor defendant', () => {
        const caseData = makeCaseWithEscavador2NewFindings({
            escavador2Processos: [{
                numeroCnj: '015XXXX-22.2009.5.06.0014',
                isNewEscavador2Finding: true,
                isCriminal: false,
                isLabor: true,
                isTrabalhista: true,
                isPlaintiff: false,
                isDefendant: true,
                classe: 'RECLAMACAO TRABALHISTA',
            }],
        });
        const result = computeAutoClassification(caseData, mockDeps);
        expect(result.laborFlag).toBe('NEGATIVE');
    });
});

describe('autoClassification uses roleClassifier HIGH_RISK_CRIMINAL_ROLES', () => {
    it('flags EXECTDO BigDataCorp process as criminal POSITIVE', () => {
        const caseData = {
            bigdatacorpEnrichmentStatus: 'DONE',
            juditEnrichmentStatus: 'DONE',
            escavadorEnrichmentStatus: 'SKIPPED',
            escavador2EnrichmentStatus: 'DONE',
            djenEnrichmentStatus: 'DONE',
            bigdatacorpCriminalFlag: 'POSITIVE',
            bigdatacorpProcessos: [
                {
                    numero: '00023961320168260996',
                    isCriminal: true,
                    isDirectCpfMatch: true,
                    specificRole: 'EXECTDO',
                    polo: 'PASSIVE',
                    partyType: null,
                    courtType: 'CRIMINAL',
                    cnjSubject: 'PENA PRIVATIVA DE LIBERDADE',
                    status: 'ARQUIVADO',
                },
            ],
            juditProcessos: [],
            juditRoleSummary: [],
            escavador2Processos: [],
            djenCommunications: [],
            bigdatacorpNamesakeCount: 1,
        };

        const result = computeAutoClassification(caseData);

        expect(result.criminalFlag).toBe('POSITIVE');
        expect(result.criminalEvidenceQuality).toBe('HARD_FACT');
    });

    it('flags AUTOR A DO FATO BigDataCorp process as criminal POSITIVE', () => {
        const caseData = {
            bigdatacorpEnrichmentStatus: 'DONE',
            juditEnrichmentStatus: 'DONE',
            escavadorEnrichmentStatus: 'SKIPPED',
            escavador2EnrichmentStatus: 'DONE',
            djenEnrichmentStatus: 'DONE',
            bigdatacorpCriminalFlag: 'POSITIVE',
            bigdatacorpProcessos: [
                {
                    numero: '15012855620198260270',
                    isCriminal: true,
                    isDirectCpfMatch: true,
                    specificRole: 'AUTORA DO FATO',
                    polo: 'PASSIVE',
                    partyType: null,
                    courtType: 'CRIMINAL',
                    cnjSubject: 'LEVE',
                    status: 'ARQUIVADO',
                },
            ],
            juditProcessos: [],
            juditRoleSummary: [],
            escavador2Processos: [],
            djenCommunications: [],
            bigdatacorpNamesakeCount: 1,
        };

        const result = computeAutoClassification(caseData);
        expect(result.criminalFlag).toBe('POSITIVE');
        expect(result.criminalEvidenceQuality).toBe('HARD_FACT');
    });

    it('flags PASSIVO Judit role summary as criminal POSITIVE', () => {
        const caseData = {
            bigdatacorpEnrichmentStatus: 'DONE',
            juditEnrichmentStatus: 'DONE',
            escavadorEnrichmentStatus: 'SKIPPED',
            escavador2EnrichmentStatus: 'DONE',
            djenEnrichmentStatus: 'DONE',
            juditCriminalFlag: 'POSITIVE',
            juditRoleSummary: [
                {
                    code: '0001722-07.2015.8.10.0029',
                    personType: 'PASSIVO',
                    side: 'Passive',
                    area: 'DIREITO CRIMINAL',
                    isCriminal: true,
                    hasExactCpfMatch: true,
                },
            ],
            bigdatacorpProcessos: [],
            juditProcessos: [],
            escavador2Processos: [],
            djenCommunications: [],
            bigdatacorpNamesakeCount: 1,
        };

        const result = computeAutoClassification(caseData);
        expect(result.criminalFlag).toBe('POSITIVE');
        expect(result.criminalEvidenceQuality).toBe('HARD_FACT');
    });

    it('flags ENVOLVIDO/Passive Judit role summary as criminal POSITIVE via side fallback', () => {
        const caseData = {
            bigdatacorpEnrichmentStatus: 'DONE',
            juditEnrichmentStatus: 'DONE',
            escavadorEnrichmentStatus: 'SKIPPED',
            escavador2EnrichmentStatus: 'DONE',
            djenEnrichmentStatus: 'DONE',
            juditCriminalFlag: 'POSITIVE',
            juditRoleSummary: [
                {
                    code: '0001722-07.2015.8.10.0029',
                    personType: 'ENVOLVIDO',
                    side: 'Passive',
                    area: 'DIREITO CRIMINAL',
                    isCriminal: true,
                    hasExactCpfMatch: true,
                    isPossibleHomonym: false,
                },
            ],
            bigdatacorpProcessos: [],
            juditProcessos: [],
            escavador2Processos: [],
            djenCommunications: [],
            bigdatacorpNamesakeCount: 1,
        };

        const result = computeAutoClassification(caseData);
        expect(result.criminalFlag).toBe('POSITIVE');
        expect(result.criminalEvidenceQuality).toBe('HARD_FACT');
    });
});

describe('createAutoClassificationHandlers', () => {
    const mockDb = {
        runTransaction: vi.fn(async (fn) => fn({
            get: vi.fn(async (ref) => {
                if (ref && ref.get) {
                    return ref.get();
                }
                return { exists: true, data: () => ({}) };
            }),
            update: vi.fn(),
        })),
        collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: vi.fn(async () => ({ exists: false })) })) })),
    };
    const mockFieldValue = {
        serverTimestamp: vi.fn(() => 'serverTimestamp'),
        delete: vi.fn(() => 'delete'),
    };
    const mockCaseRef = {
        get: vi.fn(async () => ({ exists: true, data: () => ({}) })),
        update: vi.fn(async () => {}),
    };

    function buildDeps(overrides = {}) {
        return {
            db: mockDb,
            FieldValue: mockFieldValue,
            canRunFinalClassification: vi.fn(() => ({ ok: true, reason: 'ready' })),
            computeAutoClassifySignature: vi.fn(() => 'signature_123'),
            computeAutoClassification: vi.fn(() => ({ criminalFlag: 'NEGATIVE', warrantFlag: 'NEGATIVE', laborFlag: 'NEGATIVE' })),
            asDate: vi.fn((val) => val ? new Date(val) : null),
            getTenantSettingsData: vi.fn(async () => null),
            loadEscavadorConfig: vi.fn(async () => ({ enabled: false })),
            evaluateNegativePartialSafetyNet: vi.fn(() => ({ eligible: false, reasons: [], action: 'NONE' })),
            buildHomonymAnalysisInput: mockBuildHomonymAnalysisInput,
            buildAiHomonymResetPayload: vi.fn(() => ({
                aiHomonymTriggered: false,
                aiHomonymDecision: mockFieldValue.delete(),
            })),
            runAiHomonymAnalysis: vi.fn(async () => ({ structuredOk: true, structured: { decision: 'LIKELY_MATCH' } })),
            buildAiHomonymUpdatePayload: vi.fn(() => ({ aiHomonymCostUsd: 0.001 })),
            runAiClassificationReviewAnalysis: vi.fn(async () => ({ structuredOk: true, structured: { summary: 'OK' } })),
            buildAiClassificationReviewUpdatePayload: vi.fn(() => ({ aiClassificationReviewCostUsd: 0.001 })),
            getAiProvidersIncluded: vi.fn(() => ['BigDataCorp']),
            writeAuditEvent: vi.fn(async () => {}),
            ACTOR_TYPE: { SYSTEM: 'SYSTEM' },
            SOURCE: { CLOUD_FUNCTION: 'CLOUD_FUNCTION' },
            AI_MODEL: 'gpt-test',
            AI_PROMPT_VERSION: 'v1',
            AI_HOMONYM_CONTEXT_VERSION: 'v1',
            AI_HOMONYM_PROMPT_VERSION: 'v1',
            AI_CLASSIFICATION_REVIEW_PROMPT_VERSION: 'v1',
            AI_PREFILL_PROMPT_VERSION: 'v1',
            openaiApiKey: { value: vi.fn(() => 'test-key') },
            estimateAiCostUsd: vi.fn(() => 0.001),
            stripUndefined: vi.fn((obj) => obj),
            buildDeterministicPrefill: vi.fn(() => ({
                metadata: { isComplex: false, triggersActive: [], version: 'v1' },
                keyFindings: [],
                criminalNotes: '',
                laborNotes: '',
                warrantNotes: '',
                executiveSummary: '',
                finalJustification: '',
            })),
            sanitizeAiPrefillStructured: vi.fn((s) => s),
            sanitizeNarrativesForFlags: vi.fn((_, narratives) => ({ narratives, warnings: [] })),
            recordAiCostLedger: vi.fn(async () => {}),
            ...overrides,
        };
    }

    it('acquires lock successfully', async () => {
        const deps = buildDeps();
        const handlers = createAutoClassificationHandlers(deps);
        const caseRef = {
            get: vi.fn(async () => ({ exists: true, data: () => ({}) })),
        };
        const result = await handlers.acquireAutoClassifyRun(caseRef, 'case-1');
        expect(result.acquired).toBe(true);
        expect(result.owner).toBeTruthy();
    });

    it('skips acquisition when already current', async () => {
        const deps = buildDeps();
        const handlers = createAutoClassificationHandlers(deps);
        const caseRef = {
            get: vi.fn(async () => ({
                exists: true,
                data: () => ({ autoClassifySignature: 'signature_123', autoClassifiedAt: new Date() }),
            })),
        };
        const result = await handlers.acquireAutoClassifyRun(caseRef, 'case-1');
        expect(result.acquired).toBe(false);
        expect(result.reason).toBe('already_current');
    });

    it('releases lock and returns rerun flag', async () => {
        const deps = buildDeps();
        const handlers = createAutoClassificationHandlers(deps);
        const caseRef = {
            get: vi.fn(async () => ({
                exists: true,
                data: () => ({ autoClassifyLock: { owner: 'owner-1' }, autoClassifyRerunRequested: true }),
            })),
        };
        const result = await handlers.releaseAutoClassifyRun(caseRef, 'owner-1');
        expect(result).toBe(true);
    });

    it('maybeRunAutoClassifyAndAi defers when not ready', async () => {
        const deps = buildDeps({
            canRunFinalClassification: vi.fn(() => ({ ok: false, reason: 'judit_pending' })),
        });
        const handlers = createAutoClassificationHandlers(deps);
        const result = await handlers.maybeRunAutoClassifyAndAi(mockCaseRef, 'case-1', 'Test');
        expect(result.ran).toBe(false);
        expect(result.reason).toBe('judit_pending');
    });

    it('maybeRunAutoClassifyAndAi runs when ready', async () => {
        const deps = buildDeps();
        const handlers = createAutoClassificationHandlers(deps);
        const result = await handlers.maybeRunAutoClassifyAndAi(mockCaseRef, 'case-1', 'Test');
        expect(result.ran).toBe(true);
    });

    it('skips when skipAutoClassify option is true', async () => {
        const deps = buildDeps();
        const handlers = createAutoClassificationHandlers(deps);
        const result = await handlers.maybeRunAutoClassifyAndAi(mockCaseRef, 'case-1', 'Test', { skipAutoClassify: true });
        expect(result.ran).toBe(false);
        expect(result.reason).toBe('skipAutoClassify');
    });

    it('runAutoClassifyAndAi skips when lock not acquired', async () => {
        const deps = buildDeps();
        const handlers = createAutoClassificationHandlers(deps);
        const caseRef = {
            get: vi.fn(async () => ({
                exists: true,
                data: () => ({ autoClassifySignature: 'signature_123', autoClassifiedAt: new Date() }),
            })),
        };
        const result = await handlers.runAutoClassifyAndAi(caseRef, 'case-1', {});
        expect(result.skipped).toBe(true);
    });
});
