/**
 * enrichmentTriggers.test.js — Testes básicos para triggers de enriquecimento
 */

import { describe, it, expect, vi } from 'vitest';
import {
    createEnrichJuditOnCaseHandler,
    createEnrichBigDataCorpOnCaseHandler,
    createEnrichBigDataCorpOnCorrectionHandler,
    createEnrichJuditOnCorrectionHandler,
    createEnrichEscavadorOnCaseHandler,
    createEnrichCreditOnCaseHandler,
    createEnrichDjenOnCaseHandler,
    createEnrichEscavador2OnCaseHandler,
} from './enrichmentTriggers.js';

function makeMockDb(overrides = {}) {
    const caseDoc = {
        update: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
                juditEnrichmentStatus: 'DONE',
                bigdatacorpEnrichmentStatus: 'DONE',
                escavadorEnrichmentStatus: 'SKIPPED',
                djenEnrichmentStatus: 'SKIPPED',
                ...overrides.caseData,
            }),
        }),
    };
    const publicResultDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
        delete: vi.fn().mockResolvedValue(undefined),
    };
    const publicReportDoc = {
        get: vi.fn().mockResolvedValue({ exists: false }),
        update: vi.fn().mockResolvedValue(undefined),
    };
    return {
        collection: vi.fn((name) => {
            if (name === 'cases') {
                return {
                    doc: vi.fn(() => ({
                        ...caseDoc,
                        collection: vi.fn((sub) => {
                            if (sub === 'publicResult') {
                                return { doc: vi.fn(() => publicResultDoc) };
                            }
                            return { doc: vi.fn(() => ({})) };
                        }),
                    })),
                };
            }
            if (name === 'publicReports') {
                return { doc: vi.fn(() => publicReportDoc) };
            }
            return { doc: vi.fn(() => ({})) };
        }),
    };
}

function makeDeps(overrides = {}) {
    return {
        db: makeMockDb(overrides),
        FieldValue: { serverTimestamp: vi.fn(() => 'timestamp'), delete: vi.fn(() => 'deleted') },
        acquirePhaseRun: vi.fn().mockResolvedValue({ acquired: true, caseData: {} }),
        loadJuditConfig: vi.fn().mockResolvedValue({ enabled: true }),
        loadBigDataCorpConfig: vi.fn().mockResolvedValue({ enabled: true }),
        loadEscavadorConfig: vi.fn().mockResolvedValue({ enabled: true, alwaysRun: false }),
        loadEscavador2Config: vi.fn().mockResolvedValue({ enabled: true, request: {}, dedupe: { dateToleranceDays: 90 } }),
        loadDjenConfig: vi.fn().mockResolvedValue({ enabled: true, searchStrategy: 'hybrid' }),
        runJuditEnrichmentPhase: vi.fn().mockResolvedValue(undefined),
        runBigDataCorpEnrichmentPhase: vi.fn().mockResolvedValue(undefined),
        runEscavadorEnrichmentPhase: vi.fn().mockResolvedValue(undefined),
        runEscavador2EnrichmentPhase: vi.fn().mockResolvedValue(undefined),
        runDjenEnrichmentPhase: vi.fn().mockResolvedValue(undefined),
        isJuditSettled: vi.fn((data) => data?.juditEnrichmentStatus === 'DONE'),
        isSettledProviderStatus: vi.fn((status) => ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED', 'BLOCKED'].includes(status)),
        maybeRunAutoClassifyAndAi: vi.fn().mockResolvedValue(undefined),
        writeAuditEvent: vi.fn().mockResolvedValue(undefined),
        ACTOR_TYPE: { SYSTEM: 'system' },
        SOURCE: { CLOUD_FUNCTION: 'cloud_function' },
        ...overrides,
    };
}

describe('createEnrichJuditOnCaseHandler', () => {
    it('ignora quando bigdatacorpEnrichmentStatus não mudou', async () => {
        const handler = createEnrichJuditOnCaseHandler(makeDeps());
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ bigdatacorpEnrichmentStatus: 'DONE', juditEnrichmentStatus: 'PENDING' }) },
                after: { data: () => ({ bigdatacorpEnrichmentStatus: 'DONE', juditEnrichmentStatus: 'PENDING' }) },
            },
        };
        await handler(event);
        // Não deve lançar erro e deve retornar silenciosamente
    });

    it('roda quando bigdatacorp muda para terminal e judit está PENDING', async () => {
        const deps = makeDeps();
        const handler = createEnrichJuditOnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ bigdatacorpEnrichmentStatus: 'PENDING', juditEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
                after: { data: () => ({ bigdatacorpEnrichmentStatus: 'DONE', juditEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
            },
        };
        await handler(event);
        expect(deps.runJuditEnrichmentPhase).toHaveBeenCalled();
    });
});

describe('createEnrichCreditOnCaseHandler', () => {
    function makeCreditEvent(before, after) {
        return {
            params: { caseId: 'c1' },
            data: { before: { data: () => before }, after: { data: () => after } },
        };
    }

    function makeCreditDeps(overrides = {}) {
        const caseUpdate = vi.fn().mockResolvedValue(undefined);
        const caseGet = vi.fn().mockResolvedValue({ exists: true, data: () => ({ creditEnrichmentStatus: 'DONE' }) });
        const db = {
            collection: vi.fn(() => ({ doc: vi.fn(() => ({ update: caseUpdate, get: caseGet })) })),
        };
        const deps = makeDeps({
            db,
            runCreditEnrichmentPhase: vi.fn().mockResolvedValue({ status: 'DONE', error: null }),
            ...overrides,
        });
        return { deps, caseUpdate };
    }

    const BASE_AFTER = {
        tenantId: 't1',
        status: 'PENDING',
        enabledPhases: ['criminal', 'creditRestriction'],
        creditEnrichmentStatus: 'PENDING',
        bigdatacorpEnrichmentStatus: 'DONE',
        bigdatacorpGateResult: { passed: true },
    };
    const BASE_BEFORE = { ...BASE_AFTER, bigdatacorpEnrichmentStatus: 'RUNNING' };

    it('roda quando BDC settla DONE com gate passed e fase habilitada', async () => {
        const { deps } = makeCreditDeps();
        const handler = createEnrichCreditOnCaseHandler(deps);
        await handler(makeCreditEvent(BASE_BEFORE, BASE_AFTER));
        expect(deps.runCreditEnrichmentPhase).toHaveBeenCalled();
        expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalled();
    });

    it('ignora quando bigdatacorpEnrichmentStatus nao mudou', async () => {
        const { deps, caseUpdate } = makeCreditDeps();
        const handler = createEnrichCreditOnCaseHandler(deps);
        await handler(makeCreditEvent(BASE_AFTER, BASE_AFTER));
        expect(deps.runCreditEnrichmentPhase).not.toHaveBeenCalled();
        expect(caseUpdate).not.toHaveBeenCalled();
    });

    it('ignora quando credit ja esta settado', async () => {
        const { deps, caseUpdate } = makeCreditDeps();
        const handler = createEnrichCreditOnCaseHandler(deps);
        await handler(makeCreditEvent(BASE_BEFORE, { ...BASE_AFTER, creditEnrichmentStatus: 'DONE' }));
        expect(deps.runCreditEnrichmentPhase).not.toHaveBeenCalled();
        expect(caseUpdate).not.toHaveBeenCalled();
    });

    it('fase nao habilitada com status PENDING → escreve SKIPPED phase_not_enabled + maybeRun', async () => {
        const { deps, caseUpdate } = makeCreditDeps();
        const handler = createEnrichCreditOnCaseHandler(deps);
        await handler(makeCreditEvent(
            { ...BASE_BEFORE, enabledPhases: ['criminal'] },
            { ...BASE_AFTER, enabledPhases: ['criminal'] },
        ));
        expect(deps.runCreditEnrichmentPhase).not.toHaveBeenCalled();
        expect(caseUpdate).toHaveBeenCalledWith(expect.objectContaining({
            creditEnrichmentStatus: 'SKIPPED',
            creditSkippedReason: 'phase_not_enabled',
        }));
        expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalled();
    });

    it('fase nao habilitada sem campo credit → return silencioso (zero writes)', async () => {
        const { deps, caseUpdate } = makeCreditDeps();
        const handler = createEnrichCreditOnCaseHandler(deps);
        const after = { ...BASE_AFTER, enabledPhases: ['criminal'] };
        delete after.creditEnrichmentStatus;
        const before = { ...BASE_BEFORE, enabledPhases: ['criminal'] };
        delete before.creditEnrichmentStatus;
        await handler(makeCreditEvent(before, after));
        expect(deps.runCreditEnrichmentPhase).not.toHaveBeenCalled();
        expect(caseUpdate).not.toHaveBeenCalled();
        expect(deps.maybeRunAutoClassifyAndAi).not.toHaveBeenCalled();
    });

    it('gate bloqueado → SKIPPED identity_gate_not_passed mesmo com caso CORRECTION_NEEDED', async () => {
        const { deps, caseUpdate } = makeCreditDeps();
        const handler = createEnrichCreditOnCaseHandler(deps);
        await handler(makeCreditEvent(
            { ...BASE_BEFORE, bigdatacorpEnrichmentStatus: 'RUNNING' },
            {
                ...BASE_AFTER,
                status: 'CORRECTION_NEEDED',
                bigdatacorpEnrichmentStatus: 'BLOCKED',
                bigdatacorpGateResult: { passed: false },
            },
        ));
        expect(deps.runCreditEnrichmentPhase).not.toHaveBeenCalled();
        expect(caseUpdate).toHaveBeenCalledWith(expect.objectContaining({
            creditEnrichmentStatus: 'SKIPPED',
            creditSkippedReason: 'identity_gate_not_passed',
        }));
        expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalled();
    });

    it('BDC FAILED sem gate result → SKIPPED identity_gate_not_passed', async () => {
        const { deps, caseUpdate } = makeCreditDeps();
        const handler = createEnrichCreditOnCaseHandler(deps);
        const after = { ...BASE_AFTER, bigdatacorpEnrichmentStatus: 'FAILED' };
        delete after.bigdatacorpGateResult;
        await handler(makeCreditEvent(BASE_BEFORE, after));
        expect(deps.runCreditEnrichmentPhase).not.toHaveBeenCalled();
        expect(caseUpdate).toHaveBeenCalledWith(expect.objectContaining({
            creditEnrichmentStatus: 'SKIPPED',
            creditSkippedReason: 'identity_gate_not_passed',
        }));
    });

    it('caso ja DONE → return silencioso sem rodar', async () => {
        const { deps, caseUpdate } = makeCreditDeps();
        const handler = createEnrichCreditOnCaseHandler(deps);
        await handler(makeCreditEvent(BASE_BEFORE, { ...BASE_AFTER, status: 'DONE' }));
        expect(deps.runCreditEnrichmentPhase).not.toHaveBeenCalled();
        expect(caseUpdate).not.toHaveBeenCalled();
    });

    it('lock nao adquirido → nao roda', async () => {
        const { deps } = makeCreditDeps({
            acquirePhaseRun: vi.fn().mockResolvedValue({ acquired: false, caseData: { creditEnrichmentStatus: 'RUNNING' } }),
        });
        const handler = createEnrichCreditOnCaseHandler(deps);
        await handler(makeCreditEvent(BASE_BEFORE, BASE_AFTER));
        expect(deps.runCreditEnrichmentPhase).not.toHaveBeenCalled();
    });

    it('excecao do runner → escreve FAILED + maybeRun', async () => {
        const { deps, caseUpdate } = makeCreditDeps({
            runCreditEnrichmentPhase: vi.fn().mockRejectedValue(new Error('boom')),
        });
        const handler = createEnrichCreditOnCaseHandler(deps);
        await handler(makeCreditEvent(BASE_BEFORE, BASE_AFTER));
        expect(caseUpdate).toHaveBeenCalledWith(expect.objectContaining({
            creditEnrichmentStatus: 'FAILED',
        }));
        expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalled();
    });
});

describe('createEnrichBigDataCorpOnCaseHandler', () => {
    it('ignora caso sem tenantId', async () => {
        const deps = makeDeps();
        const handler = createEnrichBigDataCorpOnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: { data: () => ({ tenantId: null }), exists: true },
        };
        await handler(event);
        expect(deps.runBigDataCorpEnrichmentPhase).not.toHaveBeenCalled();
    });

    it('roda em caso novo com tenantId', async () => {
        const deps = makeDeps();
        const handler = createEnrichBigDataCorpOnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: { data: () => ({ tenantId: 't1', bigdatacorpEnrichmentStatus: 'PENDING' }), exists: true },
        };
        await handler(event);
        expect(deps.runBigDataCorpEnrichmentPhase).toHaveBeenCalled();
    });

    it('marca FAILED quando BigDataCorp falha apos adquirir lock', async () => {
        const deps = makeDeps({
            runBigDataCorpEnrichmentPhase: vi.fn().mockRejectedValue(new Error('provider down')),
        });
        const handler = createEnrichBigDataCorpOnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: { data: () => ({ tenantId: 't1', bigdatacorpEnrichmentStatus: 'PENDING' }), exists: true },
        };
        await handler(event);

        const caseRef = deps.db.collection('cases').doc('c1');
        expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
            bigdatacorpEnrichmentStatus: 'FAILED',
            bigdatacorpError: 'provider down',
        }));
    });
});

describe('createEnrichBigDataCorpOnCorrectionHandler', () => {
    it('ignora quando status não é CORRECTION_NEEDED → PENDING', async () => {
        const deps = makeDeps();
        const handler = createEnrichBigDataCorpOnCorrectionHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ status: 'PENDING', bigdatacorpEnrichmentStatus: 'PENDING' }) },
                after: { data: () => ({ status: 'PENDING', bigdatacorpEnrichmentStatus: 'PENDING' }) },
            },
        };
        await handler(event);
        expect(deps.runBigDataCorpEnrichmentPhase).not.toHaveBeenCalled();
    });

    it('reinicia pipeline em correction', async () => {
        const deps = makeDeps();
        const handler = createEnrichBigDataCorpOnCorrectionHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ status: 'CORRECTION_NEEDED', bigdatacorpEnrichmentStatus: 'PENDING', tenantId: 't1' }) },
                after: { data: () => ({ status: 'PENDING', bigdatacorpEnrichmentStatus: 'PENDING', tenantId: 't1' }) },
            },
        };
        await handler(event);
        expect(deps.runBigDataCorpEnrichmentPhase).toHaveBeenCalled();
    });

    it('marca FAILED quando BigDataCorp falha durante correction', async () => {
        const deps = makeDeps({
            runBigDataCorpEnrichmentPhase: vi.fn().mockRejectedValue(new Error('provider down')),
        });
        const handler = createEnrichBigDataCorpOnCorrectionHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ status: 'CORRECTION_NEEDED', bigdatacorpEnrichmentStatus: 'PENDING', tenantId: 't1' }) },
                after: { data: () => ({ status: 'PENDING', bigdatacorpEnrichmentStatus: 'PENDING', tenantId: 't1' }) },
            },
        };
        await handler(event);

        const caseRef = deps.db.collection('cases').doc('c1');
        expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
            bigdatacorpEnrichmentStatus: 'FAILED',
            bigdatacorpError: 'provider down',
        }));
    });
});

describe('createEnrichJuditOnCorrectionHandler', () => {
    it('aguarda bigdatacorp settled antes de rodar correction', async () => {
        const deps = makeDeps();
        const handler = createEnrichJuditOnCorrectionHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ status: 'CORRECTION_NEEDED', juditEnrichmentStatus: 'PENDING', bigdatacorpEnrichmentStatus: 'PENDING', tenantId: 't1' }) },
                after: { data: () => ({ status: 'PENDING', juditEnrichmentStatus: 'PENDING', bigdatacorpEnrichmentStatus: 'PENDING', tenantId: 't1' }) },
            },
        };
        await handler(event);
        expect(deps.runJuditEnrichmentPhase).not.toHaveBeenCalled();
    });

    it('roda correction quando bigdatacorp está settled', async () => {
        const deps = makeDeps();
        const handler = createEnrichJuditOnCorrectionHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ status: 'CORRECTION_NEEDED', juditEnrichmentStatus: 'PENDING', bigdatacorpEnrichmentStatus: 'DONE', tenantId: 't1' }) },
                after: { data: () => ({ status: 'PENDING', juditEnrichmentStatus: 'PENDING', bigdatacorpEnrichmentStatus: 'DONE', tenantId: 't1' }) },
            },
        };
        await handler(event);
        expect(deps.runJuditEnrichmentPhase).toHaveBeenCalled();
    });
});

describe('createEnrichEscavadorOnCaseHandler', () => {
    it('ignora quando judit não está settled', async () => {
        const deps = makeDeps();
        const handler = createEnrichEscavadorOnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ juditEnrichmentStatus: 'PENDING', escavadorEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
                after: { data: () => ({ juditEnrichmentStatus: 'PENDING', escavadorEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
            },
        };
        await handler(event);
        expect(deps.runEscavadorEnrichmentPhase).not.toHaveBeenCalled();
    });

    it('pula quando escavador está desabilitado', async () => {
        const deps = makeDeps({
            loadEscavadorConfig: vi.fn().mockResolvedValue({ enabled: false }),
        });
        const handler = createEnrichEscavadorOnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ juditEnrichmentStatus: 'PENDING', escavadorEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
                after: { data: () => ({ juditEnrichmentStatus: 'DONE', escavadorEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
            },
        };
        await handler(event);
        expect(deps.runEscavadorEnrichmentPhase).not.toHaveBeenCalled();
    });
});

describe('createEnrichEscavador2OnCaseHandler', () => {
    it('runs after DJEN settles and all upstream providers are terminal', async () => {
        const deps = makeDeps();
        const handler = createEnrichEscavador2OnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ djenEnrichmentStatus: 'RUNNING' }) },
                after: { data: () => ({
                    tenantId: 't1',
                    status: 'PENDING',
                    bigdatacorpEnrichmentStatus: 'DONE',
                    juditEnrichmentStatus: 'DONE',
                    escavadorEnrichmentStatus: 'SKIPPED',
                    djenEnrichmentStatus: 'DONE',
                    escavador2EnrichmentStatus: 'PENDING',
                }) },
            },
        };

        await handler(event);

        expect(deps.acquirePhaseRun).toHaveBeenCalledWith(expect.anything(), 'escavador2EnrichmentStatus');
        expect(deps.runEscavador2EnrichmentPhase).toHaveBeenCalled();
    });

    it('waits while DJEN is still running', async () => {
        const deps = makeDeps();
        const handler = createEnrichEscavador2OnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ djenEnrichmentStatus: 'PENDING' }) },
                after: { data: () => ({
                    tenantId: 't1',
                    status: 'PENDING',
                    bigdatacorpEnrichmentStatus: 'DONE',
                    juditEnrichmentStatus: 'DONE',
                    escavadorEnrichmentStatus: 'SKIPPED',
                    djenEnrichmentStatus: 'RUNNING',
                    escavador2EnrichmentStatus: 'PENDING',
                }) },
            },
        };

        await handler(event);

        expect(deps.runEscavador2EnrichmentPhase).not.toHaveBeenCalled();
    });

    it('marks SKIPPED and classifies when Escavador2 is disabled for tenant', async () => {
        const deps = makeDeps({ loadEscavador2Config: vi.fn().mockResolvedValue({ enabled: false }) });
        const handler = createEnrichEscavador2OnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ djenEnrichmentStatus: 'RUNNING' }) },
                after: { data: () => ({
                    tenantId: 't1',
                    status: 'PENDING',
                    bigdatacorpEnrichmentStatus: 'DONE',
                    juditEnrichmentStatus: 'DONE',
                    escavadorEnrichmentStatus: 'SKIPPED',
                    djenEnrichmentStatus: 'DONE',
                    escavador2EnrichmentStatus: 'PENDING',
                }) },
            },
        };

        await handler(event);

        const caseRef = deps.db.collection('cases').doc('c1');
        expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
            escavador2EnrichmentStatus: 'SKIPPED',
            escavador2Error: null,
        }));
        expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalledWith(expect.anything(), 'c1', 'Escavador2 disabled');
    });

    it('marks FAILED and classifies when trigger setup fails', async () => {
        const deps = makeDeps({ runEscavador2EnrichmentPhase: vi.fn().mockRejectedValue(new Error('phase exploded')) });
        const handler = createEnrichEscavador2OnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ djenEnrichmentStatus: 'RUNNING' }) },
                after: { data: () => ({
                    tenantId: 't1',
                    status: 'PENDING',
                    bigdatacorpEnrichmentStatus: 'DONE',
                    juditEnrichmentStatus: 'DONE',
                    escavadorEnrichmentStatus: 'SKIPPED',
                    djenEnrichmentStatus: 'DONE',
                    escavador2EnrichmentStatus: 'PENDING',
                }) },
            },
        };

        await handler(event);

        const caseRef = deps.db.collection('cases').doc('c1');
        expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
            escavador2EnrichmentStatus: 'FAILED',
            escavador2Error: 'phase exploded',
        }));
        expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalledWith(expect.anything(), 'c1', 'Escavador2 trigger failure');
    });
});

describe('createEnrichDjenOnCaseHandler', () => {
    it('ignora quando judit não mudou para settled', async () => {
        const deps = makeDeps();
        const handler = createEnrichDjenOnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ juditEnrichmentStatus: 'DONE', djenEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
                after: { data: () => ({ juditEnrichmentStatus: 'DONE', djenEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
            },
        };
        await handler(event);
        expect(deps.runDjenEnrichmentPhase).not.toHaveBeenCalled();
    });

    it('pula quando djen está desabilitado', async () => {
        const deps = makeDeps({
            loadDjenConfig: vi.fn().mockResolvedValue({ enabled: false, searchStrategy: 'hybrid' }),
        });
        const handler = createEnrichDjenOnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ juditEnrichmentStatus: 'PENDING', djenEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
                after: { data: () => ({ juditEnrichmentStatus: 'DONE', djenEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
            },
        };
        await handler(event);
        expect(deps.runDjenEnrichmentPhase).not.toHaveBeenCalled();
    });

    it('marca FAILED e tenta classificar quando trigger DJEN falha antes da fase', async () => {
        const deps = makeDeps({
            loadDjenConfig: vi.fn().mockRejectedValue(new Error('config down')),
        });
        const handler = createEnrichDjenOnCaseHandler(deps);
        const event = {
            params: { caseId: 'c1' },
            data: {
                before: { data: () => ({ juditEnrichmentStatus: 'PENDING', djenEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
                after: { data: () => ({ juditEnrichmentStatus: 'DONE', djenEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING' }) },
            },
        };
        await handler(event);

        const caseRef = deps.db.collection('cases').doc('c1');
        expect(caseRef.update).toHaveBeenCalledWith(expect.objectContaining({
            djenEnrichmentStatus: 'FAILED',
            djenError: 'config down',
        }));
        expect(deps.maybeRunAutoClassifyAndAi).toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Motivo do SKIPPED (2026-09): antes, 'desabilitado pela empresa', 'sub-fase
// desligada' e 'nao precisou rodar' gravavam o mesmo SKIPPED com *Error null.
// O analista via a fonte sumir da tela sem saber se ela nao foi contratada ou
// se caiu. Estes testes travam a distincao no ponto de escrita.
// ─────────────────────────────────────────────────────────────────────────────
describe('motivo do SKIPPED por provedor', () => {
    const eventoDe = (extraBefore = {}, extraAfter = {}) => ({
        params: { caseId: 'c1' },
        data: {
            before: { data: () => ({ bigdatacorpEnrichmentStatus: 'PENDING', juditEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING', ...extraBefore }) },
            after: { data: () => ({ bigdatacorpEnrichmentStatus: 'DONE', juditEnrichmentStatus: 'PENDING', tenantId: 't1', status: 'PENDING', ...extraAfter }) },
        },
    });

    function capturarUpdate(deps) {
        const chamadas = [];
        deps.db.collection = vi.fn(() => ({
            doc: vi.fn(() => ({
                update: vi.fn((payload) => { chamadas.push(payload); return Promise.resolve(); }),
                get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
                collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }) })) })),
            })),
        }));
        return chamadas;
    }

    it('Judit desabilitada no tenant grava disabled_for_tenant', async () => {
        const deps = makeDeps({ loadJuditConfig: vi.fn().mockResolvedValue({ enabled: false }) });
        const updates = capturarUpdate(deps);
        await createEnrichJuditOnCaseHandler(deps)(eventoDe());
        expect(updates).toContainEqual(expect.objectContaining({
            juditEnrichmentStatus: 'SKIPPED',
            juditSkippedReason: 'disabled_for_tenant',
        }));
    });

    it('BigDataCorp desabilitado no tenant grava disabled_for_tenant', async () => {
        const deps = makeDeps({ loadBigDataCorpConfig: vi.fn().mockResolvedValue({ enabled: false }) });
        const updates = capturarUpdate(deps);
        await createEnrichBigDataCorpOnCaseHandler(deps)({
            params: { caseId: 'c1' },
            data: { data: () => ({ tenantId: 't1', status: 'PENDING', bigdatacorpEnrichmentStatus: 'PENDING' }) },
        });
        expect(updates).toContainEqual(expect.objectContaining({
            bigdatacorpEnrichmentStatus: 'SKIPPED',
            bigdatacorpSkippedReason: 'disabled_for_tenant',
        }));
    });

    it('Escavador2 desabilitado no tenant grava disabled_for_tenant', async () => {
        const deps = makeDeps({ loadEscavador2Config: vi.fn().mockResolvedValue({ enabled: false }) });
        const updates = capturarUpdate(deps);
        await createEnrichEscavador2OnCaseHandler(deps)(eventoDe(
            { escavador2EnrichmentStatus: 'PENDING' },
            { escavador2EnrichmentStatus: 'PENDING', juditEnrichmentStatus: 'DONE' },
        ));
        expect(updates).toContainEqual(expect.objectContaining({
            escavador2EnrichmentStatus: 'SKIPPED',
            escavador2SkippedReason: 'disabled_for_tenant',
        }));
    });

    it('Escavador nao necessario grava not_needed, e NAO disabled_for_tenant', async () => {
        const deps = makeDeps({ loadEscavadorConfig: vi.fn().mockResolvedValue({ enabled: true, alwaysRun: false }) });
        const updates = capturarUpdate(deps);
        await createEnrichEscavadorOnCaseHandler(deps)(eventoDe(
            { escavadorEnrichmentStatus: 'PENDING', juditNeedsEscavador: false },
            { escavadorEnrichmentStatus: 'PENDING', juditEnrichmentStatus: 'DONE', juditNeedsEscavador: false },
        ));
        const skip = updates.find((u) => u.escavadorEnrichmentStatus === 'SKIPPED');
        expect(skip).toBeDefined();
        expect(skip.escavadorSkippedReason).toBe('not_needed');
    });

    it('Escavador desabilitado no tenant grava disabled_for_tenant, e NAO not_needed', async () => {
        const deps = makeDeps({ loadEscavadorConfig: vi.fn().mockResolvedValue({ enabled: false }) });
        const updates = capturarUpdate(deps);
        await createEnrichEscavadorOnCaseHandler(deps)(eventoDe(
            { escavadorEnrichmentStatus: 'PENDING', juditNeedsEscavador: true },
            { escavadorEnrichmentStatus: 'PENDING', juditEnrichmentStatus: 'DONE', juditNeedsEscavador: true },
        ));
        const skip = updates.find((u) => u.escavadorEnrichmentStatus === 'SKIPPED');
        expect(skip).toBeDefined();
        expect(skip.escavadorSkippedReason).toBe('disabled_for_tenant');
    });
});
