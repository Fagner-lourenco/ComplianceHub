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
