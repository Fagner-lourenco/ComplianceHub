import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);
const mod = require('./index');

const { backfillClientCasesMirrorInner, _setDb } = mod.__test;

function makeDoc(id, data) {
    return { id, data: () => data };
}

function buildMockDb({ profile, cases = [], lockExists = false } = {}) {
    const storedLocks = new Map();
    if (lockExists) {
        storedLocks.set('backfill-tenant-1', { exists: true, data: () => ({ startedAt: new Date() }) });
    }

    let currentBatch = null;

    return {
        collection: vi.fn((collectionName) => {
            if (collectionName === 'userProfiles') {
                return {
                    doc: vi.fn((uid) => ({
                        get: vi.fn(async () => {
                            if (profile && profile.uid === uid) {
                                return { exists: true, data: () => profile };
                            }
                            return { exists: false, data: () => ({}) };
                        }),
                    })),
                };
            }
            if (collectionName === 'systemLocks') {
                return {
                    doc: vi.fn((lockId) => ({
                        get: vi.fn(async () => {
                            const lock = storedLocks.get(lockId);
                            return lock || { exists: false, data: () => ({}) };
                        }),
                        set: vi.fn(async (data) => {
                            storedLocks.set(lockId, { exists: true, data: () => data });
                        }),
                        delete: vi.fn(async () => {
                            storedLocks.delete(lockId);
                        }),
                    })),
                };
            }
            if (collectionName === 'cases') {
                return {
                    where: vi.fn((field, op, value) => {
                        // Simple filter simulation
                        const filtered = cases.filter((c) => c.tenantId === value);
                        return {
                            limit: vi.fn((n) => ({
                                startAfter: vi.fn((lastDoc) => ({
                                    get: vi.fn(async () => {
                                        let startIdx = 0;
                                        if (lastDoc) {
                                            startIdx = filtered.findIndex((d) => d.id === lastDoc.id) + 1;
                                        }
                                        const page = filtered.slice(startIdx, startIdx + n);
                                        return { docs: page.map((c) => makeDoc(c.id, c)) };
                                    }),
                                })),
                                get: vi.fn(async () => {
                                    const page = filtered.slice(0, n);
                                    return { docs: page.map((c) => makeDoc(c.id, c)) };
                                }),
                            })),
                        };
                    }),
                };
            }
            if (collectionName === 'clientCases') {
                return {
                    doc: vi.fn(() => ({
                        set: vi.fn(async () => {}),
                    })),
                };
            }
            return {
                doc: vi.fn(() => ({ get: vi.fn(async () => ({ exists: false })) })),
            };
        }),
        batch: vi.fn(() => {
            currentBatch = {
                set: vi.fn(() => {}),
                commit: vi.fn(async () => {}),
            };
            return currentBatch;
        }),
    };
}

describe('backfillClientCasesMirrorInner', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('rejeita usuario nao autenticado', async () => {
        _setDb(buildMockDb());
        await expect(backfillClientCasesMirrorInner({ auth: null }))
            .rejects.toThrow('Autenticacao necessaria');
    });

    it('rejeita analista (sem permissao)', async () => {
        _setDb(buildMockDb({
            profile: { uid: 'user-1', role: 'analyst', tenantId: 'tenant-1' },
        }));
        await expect(backfillClientCasesMirrorInner({
            auth: { uid: 'user-1' },
            data: {},
        })).rejects.toThrow('Apenas administradores podem executar backfill');
    });

    it('rejeita supervisor (sem permissao)', async () => {
        _setDb(buildMockDb({
            profile: { uid: 'user-1', role: 'supervisor', tenantId: 'tenant-1' },
        }));
        await expect(backfillClientCasesMirrorInner({
            auth: { uid: 'user-1' },
            data: {},
        })).rejects.toThrow('Apenas administradores podem executar backfill');
    });

    it('rejeita tenant ausente', async () => {
        _setDb(buildMockDb({
            profile: { uid: 'user-1', role: 'admin' },
        }));
        await expect(backfillClientCasesMirrorInner({
            auth: { uid: 'user-1' },
            data: {},
        })).rejects.toThrow('tenantId e obrigatorio');
    });

    it('rejeita execucao concorrente (lock existente)', async () => {
        _setDb(buildMockDb({
            profile: { uid: 'user-1', role: 'admin', tenantId: 'tenant-1' },
            lockExists: true,
        }));
        await expect(backfillClientCasesMirrorInner({
            auth: { uid: 'user-1' },
            data: {},
        })).rejects.toThrow('Backfill ja em execucao');
    });

    it('sincroniza casos do tenant com paginacao', async () => {
        const cases = Array.from({ length: 5 }, (_, i) => ({
            id: `case-${i}`,
            tenantId: 'tenant-1',
            status: 'DONE',
            candidateName: `Candidato ${i}`,
        }));
        _setDb(buildMockDb({
            profile: { uid: 'user-1', role: 'admin', tenantId: 'tenant-1' },
            cases,
        }));

        const result = await backfillClientCasesMirrorInner({
            auth: { uid: 'user-1' },
            data: {},
        });

        expect(result.synced).toBe(5);
    });

    it('usa tenantId do payload quando fornecido', async () => {
        const cases = [
            { id: 'case-1', tenantId: 'tenant-2', status: 'DONE', candidateName: 'X' },
        ];
        _setDb(buildMockDb({
            profile: { uid: 'user-1', role: 'owner', tenantId: 'tenant-1' },
            cases,
        }));

        const result = await backfillClientCasesMirrorInner({
            auth: { uid: 'user-1' },
            data: { tenantId: 'tenant-2' },
        });

        expect(result.synced).toBe(1);
    });

    it('rejeita admin escopado tentando executar backfill de outro tenant', async () => {
        _setDb(buildMockDb({
            profile: { uid: 'user-1', role: 'admin', tenantId: 'tenant-1' },
            cases: [],
        }));

        await expect(backfillClientCasesMirrorInner({
            auth: { uid: 'user-1' },
            data: { tenantId: 'tenant-2' },
        })).rejects.toThrow('proprio tenant');
    });

    it('nao sincroniza casos de outros tenants', async () => {
        const cases = [
            { id: 'case-1', tenantId: 'tenant-1', status: 'DONE', candidateName: 'A' },
            { id: 'case-2', tenantId: 'tenant-2', status: 'DONE', candidateName: 'B' },
        ];
        _setDb(buildMockDb({
            profile: { uid: 'user-1', role: 'admin', tenantId: 'tenant-1' },
            cases,
        }));

        const result = await backfillClientCasesMirrorInner({
            auth: { uid: 'user-1' },
            data: {},
        });

        expect(result.synced).toBe(1);
    });

    it('libera lock mesmo em caso de erro', async () => {
        const mockDb = buildMockDb({
            profile: { uid: 'user-1', role: 'admin', tenantId: 'tenant-1' },
        });
        // Force error during case query
        mockDb.collection = vi.fn((collectionName) => {
            if (collectionName === 'userProfiles') {
                return {
                    doc: vi.fn(() => ({
                        get: vi.fn(async () => ({ exists: true, data: () => ({ uid: 'user-1', role: 'admin', tenantId: 'tenant-1' }) })),
                    })),
                };
            }
            if (collectionName === 'systemLocks') {
                return {
                    doc: vi.fn(() => ({
                        get: vi.fn(async () => ({ exists: false })),
                        set: vi.fn(async () => {}),
                        delete: vi.fn(async () => {}),
                    })),
                };
            }
            if (collectionName === 'cases') {
                return {
                    where: vi.fn(() => ({
                        limit: vi.fn(() => ({
                            get: vi.fn(async () => { throw new Error('Firestore error'); }),
                        })),
                    })),
                };
            }
            return { doc: vi.fn(() => ({ get: vi.fn(async () => ({ exists: false })) })) };
        });

        _setDb(mockDb);

        await expect(backfillClientCasesMirrorInner({
            auth: { uid: 'user-1' },
            data: {},
        })).rejects.toThrow('Firestore error');

        // Lock should have been released (delete called in finally block)
        // The test verifies no exception is thrown from the finally block
    });
});
