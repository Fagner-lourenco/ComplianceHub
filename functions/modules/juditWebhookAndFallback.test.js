/**
 * juditWebhookAndFallback.test.js — Testes unitários para o módulo Judit Webhook e Fallback
 */

import { describe, it, expect, vi } from 'vitest';

const {
    buildJuditCallbackUrl,
    registerJuditWebhookRequest,
    handleJuditWebhookLogic,
    runJuditAsyncFallbackLogic,
    JUDIT_WEBHOOK_STALE_MS,
} = require('./juditWebhookAndFallback');

function createMockDb(initialDocs = {}) {
    const docs = { ...initialDocs };
    return {
        collection: vi.fn((col) => ({
            doc: vi.fn((id) => ({
                get: vi.fn(async () => {
                    const data = docs[`${col}/${id}`];
                    return {
                        exists: !!data,
                        data: () => data || null,
                        ref: { id, path: `${col}/${id}`, set: vi.fn(async () => {}), update: vi.fn(async () => {}), delete: vi.fn(async () => {}) },
                    };
                }),
                set: vi.fn(async () => {}),
                update: vi.fn(async () => {}),
                delete: vi.fn(async () => {}),
            })),
            where: vi.fn(() => ({
                limit: vi.fn(() => ({
                    get: vi.fn(async () => ({
                        empty: Object.keys(docs).filter((k) => k.startsWith(col)).length === 0,
                        size: Object.keys(docs).filter((k) => k.startsWith(col)).length,
                        docs: Object.entries(docs)
                            .filter(([k]) => k.startsWith(col))
                            .map(([id, data]) => ({
                                id: id.replace(`${col}/`, ''),
                                data: () => data,
                                ref: { id: id.replace(`${col}/`, ''), path: id, set: vi.fn(async () => {}), update: vi.fn(async () => {}), delete: vi.fn(async () => {}) },
                            })),
                    })),
                })),
            })),
        })),
        runTransaction: vi.fn(async (fn) => {
            const tx = {
                get: vi.fn(async (ref) => {
                    const data = docs[ref.path];
                    return {
                        exists: !!data,
                        data: () => data || null,
                        ref,
                    };
                }),
                update: vi.fn((ref, data) => {
                    docs[ref.path] = { ...(docs[ref.path] || {}), ...data };
                }),
            };
            return fn(tx);
        }),
    };
}

const mockFieldValue = {
    serverTimestamp: vi.fn(() => 'mockTimestamp'),
    delete: vi.fn(() => 'mockDelete'),
};

function createMockJuditApiKey(value = 'test-api-key') {
    return { value: vi.fn(() => value) };
}

function createMockNormalize(name) {
    return vi.fn(() => ({
        [`${name}Flag`]: 'POSITIVE',
        [`${name}Count`]: 1,
        _source: { mock: true },
    }));
}

function createDeps(overrides = {}) {
    return {
        db: createMockDb(),
        FieldValue: mockFieldValue,
        juditApiKey: createMockJuditApiKey(),
        fetchResponses: vi.fn(async () => [{ id: 1 }]),
        checkRequestStatus: vi.fn(async () => 'completed'),
        normalizeJuditWarrants: createMockNormalize('warrant'),
        normalizeJuditExecution: createMockNormalize('execution'),
        normalizeJuditLawsuits: createMockNormalize('lawsuits'),
        loadJuditConfig: vi.fn(async () => ({ escalation: { triggerEscavador: [], processCountThreshold: 5 } })),
        evaluateEscavadorNeed: vi.fn(() => false),
        maybeRunAutoClassifyAndAi: vi.fn(async () => ({})),
        ...overrides,
    };
}

describe('buildJuditCallbackUrl', () => {
    it('returns env var when set', () => {
        process.env.JUDIT_WEBHOOK_URL = 'https://custom.example.com';
        expect(buildJuditCallbackUrl()).toBe('https://custom.example.com');
        delete process.env.JUDIT_WEBHOOK_URL;
    });

    it('returns default when env var not set', () => {
        delete process.env.JUDIT_WEBHOOK_URL;
        expect(buildJuditCallbackUrl()).toBe('https://juditwebhook-dowqa75f4a-rj.a.run.app');
    });
});

describe('registerJuditWebhookRequest', () => {
    it('does nothing if required params missing', async () => {
        const db = createMockDb();
        await registerJuditWebhookRequest({ db, FieldValue: mockFieldValue, requestId: null, caseId: 'c1', phaseType: 'warrant' });
        expect(db.collection).not.toHaveBeenCalled();
    });

    it('registers request with enrichmentGeneration', async () => {
        const db = createMockDb({
            'cases/c1': { enrichmentGeneration: 3 },
        });
        await registerJuditWebhookRequest({ db, FieldValue: mockFieldValue, requestId: 'r1', caseId: 'c1', phaseType: 'warrant' });
        expect(db.collection).toHaveBeenCalledWith('juditWebhookRequests');
    });

    it('handles case read error gracefully', async () => {
        const db = createMockDb();
        db.collection = vi.fn(() => ({
            doc: vi.fn(() => ({
                get: vi.fn(async () => { throw new Error('read fail'); }),
                set: vi.fn(async () => {}),
            })),
        }));
        await expect(registerJuditWebhookRequest({ db, FieldValue: mockFieldValue, requestId: 'r1', caseId: 'c1', phaseType: 'warrant' })).resolves.not.toThrow();
    });
});

describe('handleJuditWebhookLogic', () => {
    it('returns 400 when request_id missing', async () => {
        const deps = createDeps();
        const req = { body: {} };
        const result = await handleJuditWebhookLogic({ req, ...deps });
        expect(result.status).toBe(400);
        expect(result.body.ok).toBe(false);
    });

    it('ignores unknown request_id', async () => {
        const deps = createDeps();
        const req = { body: { reference_id: 'unknown', payload: { request_id: 'unknown' } } };
        const result = await handleJuditWebhookLogic({ req, ...deps });
        expect(result.status).toBe(200);
        expect(result.body.ignored).toBe(true);
    });

    it('handles incremental event', async () => {
        const deps = createDeps();
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', enrichmentGeneration: 1 },
            'cases/c1': { enrichmentGeneration: 1, status: 'ENRICHING' },
        });
        const req = { body: { reference_id: 'r1', payload: { request_id: 'r1', response_type: 'partial' } } };
        const result = await handleJuditWebhookLogic({ req, ...deps });
        expect(result.status).toBe(200);
        expect(result.body.reason).toBe('incremental');
    });

    it('processes completed event for warrant', async () => {
        const deps = createDeps();
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', enrichmentGeneration: 1 },
            'cases/c1': { enrichmentGeneration: 1, cpf: '123.456.789-00', status: 'ENRICHING', tenantId: 't1' },
        });
        const req = { body: { reference_id: 'r1', payload: { request_id: 'r1', response_type: 'application_info', response_data: { code: 600 } } } };
        const result = await handleJuditWebhookLogic({ req, ...deps });
        expect(result.status).toBe(200);
        expect(result.body.ok).toBe(true);
        expect(deps.fetchResponses).toHaveBeenCalledWith('r1', 'test-api-key');
        expect(deps.normalizeJuditWarrants).toHaveBeenCalled();
    });

    it('processes error event', async () => {
        const deps = createDeps();
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', enrichmentGeneration: 1 },
            'cases/c1': { enrichmentGeneration: 1, status: 'ENRICHING' },
        });
        const req = { body: { reference_id: 'r1', payload: { request_id: 'r1', response_type: 'application_error', response_data: { code: 500, message: 'fail' } } } };
        const result = await handleJuditWebhookLogic({ req, ...deps });
        expect(result.status).toBe(200);
        expect(result.body.ok).toBe(true);
    });

    it('rejects stale callback by generation mismatch', async () => {
        const deps = createDeps();
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', enrichmentGeneration: 1 },
            'cases/c1': { enrichmentGeneration: 2 },
        });
        const req = { body: { reference_id: 'r1', payload: { request_id: 'r1', response_type: 'application_info', response_data: { code: 600 } } } };
        const result = await handleJuditWebhookLogic({ req, ...deps });
        expect(result.status).toBe(200);
        expect(result.body.reason).toBe('stale_generation');
    });

    it('skips if lock already terminal', async () => {
        const deps = createDeps();
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', enrichmentGeneration: 1, status: 'DONE' },
            'cases/c1': { enrichmentGeneration: 1 },
        });
        deps.db.runTransaction = vi.fn(async (fn) => {
            const tx = {
                get: vi.fn(async () => ({
                    exists: true,
                    data: () => ({ status: 'DONE' }),
                })),
                update: vi.fn(),
            };
            return fn(tx);
        });
        const req = { body: { reference_id: 'r1', payload: { request_id: 'r1', response_type: 'application_info', response_data: { code: 600 } } } };
        const result = await handleJuditWebhookLogic({ req, ...deps });
        expect(result.status).toBe(200);
        expect(result.body.ignored).toBe(true);
    });

    it('handles missing case gracefully', async () => {
        const deps = createDeps();
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', enrichmentGeneration: 1 },
        });
        const req = { body: { reference_id: 'r1', payload: { request_id: 'r1', response_type: 'application_info', response_data: { code: 600 } } } };
        const result = await handleJuditWebhookLogic({ req, ...deps });
        expect(result.status).toBe(200);
        expect(result.body.ignored).toBe(true);
    });
});

describe('runJuditAsyncFallbackLogic', () => {
    it('returns 0 processed when no stale requests', async () => {
        const deps = createDeps();
        deps.db = createMockDb();
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.processed).toBe(0);
    });

    it('returns error when api key missing', async () => {
        const staleDate = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS - 1000);
        const deps = createDeps();
        deps.juditApiKey = { value: vi.fn(() => null) };
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', createdAt: { toDate: () => staleDate }, tenantId: 't1' },
        });
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.error).toBe('missing_api_key');
    });

    it('skips if lock not acquired (terminal)', async () => {
        const staleDate = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS - 1000);
        const deps = createDeps();
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', status: 'DONE', createdAt: staleDate },
        });
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.processed).toBe(0);
    });

    it('cleans mapping when case not found', async () => {
        const staleDate = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS - 1000);
        const deps = createDeps();
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', createdAt: staleDate },
        });
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.processed).toBe(0);
    });

    it('marks timeout after 30min pending', async () => {
        const staleDate = new Date(Date.now() - 31 * 60 * 1000);
        const deps = createDeps();
        deps.checkRequestStatus = vi.fn(async () => 'pending');
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', createdAt: { toDate: () => staleDate }, tenantId: 't1' },
            'cases/c1': { enrichmentGeneration: 1, status: 'ENRICHING', juditPendingAsyncPhases: ['warrant'] },
        });
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.processed).toBe(1);
    });

    it('marks cancelled request', async () => {
        const staleDate = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS - 1000);
        const deps = createDeps();
        deps.checkRequestStatus = vi.fn(async () => 'cancelled');
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', createdAt: { toDate: () => staleDate }, tenantId: 't1' },
            'cases/c1': { enrichmentGeneration: 1, status: 'ENRICHING', juditPendingAsyncPhases: ['warrant'] },
        });
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.processed).toBe(1);
    });

    it('marks failed request', async () => {
        const staleDate = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS - 1000);
        const deps = createDeps();
        deps.checkRequestStatus = vi.fn(async () => 'failed');
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', createdAt: { toDate: () => staleDate }, tenantId: 't1' },
            'cases/c1': { enrichmentGeneration: 1, status: 'ENRICHING', juditPendingAsyncPhases: ['warrant'] },
        });
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.processed).toBe(1);
    });

    it('processes completed request', async () => {
        const staleDate = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS - 1000);
        const deps = createDeps();
        deps.checkRequestStatus = vi.fn(async () => 'completed');
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', createdAt: { toDate: () => staleDate }, tenantId: 't1' },
            'cases/c1': { enrichmentGeneration: 1, status: 'ENRICHING', juditPendingAsyncPhases: ['warrant'], cpf: '123.456.789-00' },
        });
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.processed).toBe(1);
        expect(deps.fetchResponses).toHaveBeenCalledWith('r1', 'test-api-key');
        expect(deps.normalizeJuditWarrants).toHaveBeenCalled();
    });

    it('handles fetch error gracefully', async () => {
        const staleDate = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS - 1000);
        const deps = createDeps();
        deps.checkRequestStatus = vi.fn(async () => 'completed');
        deps.fetchResponses = vi.fn(async () => { throw new Error('fetch fail'); });
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', createdAt: { toDate: () => staleDate }, tenantId: 't1' },
            'cases/c1': { enrichmentGeneration: 1, status: 'ENRICHING', juditPendingAsyncPhases: ['warrant'] },
        });
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.processed).toBe(1);
    });

    it('skips if phase already resolved', async () => {
        const staleDate = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS - 1000);
        const deps = createDeps();
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', createdAt: { toDate: () => staleDate }, tenantId: 't1' },
            'cases/c1': { enrichmentGeneration: 1, status: 'ENRICHING', juditPendingAsyncPhases: [] },
        });
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.processed).toBe(0);
    });

    it('handles stale generation in fallback', async () => {
        const staleDate = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS - 1000);
        const deps = createDeps();
        deps.db = createMockDb({
            'juditWebhookRequests/r1': { caseId: 'c1', phaseType: 'warrant', createdAt: { toDate: () => staleDate }, enrichmentGeneration: 1, tenantId: 't1' },
            'cases/c1': { enrichmentGeneration: 2, status: 'ENRICHING', juditPendingAsyncPhases: ['warrant'] },
        });
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.processed).toBe(0);
    });

    it('retries when request still pending within window', async () => {
        const staleDate = new Date(Date.now() - JUDIT_WEBHOOK_STALE_MS - 1000);
        const deps = createDeps();
        deps.checkRequestStatus = vi.fn(async () => 'pending');
        deps.db = createMockDb({
            'juditWebhookRequests/r1': {
                caseId: 'c1',
                phaseType: 'warrant',
                createdAt: { toDate: () => staleDate },
                tenantId: 't1',
            },
            'cases/c1': { enrichmentGeneration: 1, status: 'ENRICHING', juditPendingAsyncPhases: ['warrant'] },
        });
        const result = await runJuditAsyncFallbackLogic(deps);
        expect(result.processed).toBe(0);
    });
});
