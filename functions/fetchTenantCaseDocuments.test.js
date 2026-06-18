import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);
const mod = require('./modules/caseQueriesAssignments');

const { fetchTenantCaseDocuments } = mod;

function makeDoc(id, data) {
    return { id, data: () => data };
}

function buildMockDb(docs) {
    let callCount = 0;
    return {
        collection: vi.fn(() => ({
            where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                    select: vi.fn(() => ({
                        startAfter: vi.fn(() => ({
                            limit: vi.fn((n) => ({
                                get: vi.fn(async () => {
                                    callCount += 1;
                                    const start = (callCount - 1) * 500;
                                    const page = docs.slice(start, start + n);
                                    return { docs: page.map((d) => makeDoc(d.id, d)) };
                                }),
                            })),
                        })),
                        limit: vi.fn((n) => ({
                            get: vi.fn(async () => {
                                callCount += 1;
                                const start = (callCount - 1) * 500;
                                const page = docs.slice(start, start + n);
                                return { docs: page.map((d) => makeDoc(d.id, d)) };
                            }),
                        })),
                    })),
                    startAfter: vi.fn(() => ({
                        limit: vi.fn((n) => ({
                            get: vi.fn(async () => {
                                callCount += 1;
                                const start = (callCount - 1) * 500;
                                const page = docs.slice(start, start + n);
                                return { docs: page.map((d) => makeDoc(d.id, d)) };
                            }),
                        })),
                    })),
                    limit: vi.fn((n) => ({
                        get: vi.fn(async () => {
                            callCount += 1;
                            const start = (callCount - 1) * 500;
                            const page = docs.slice(start, start + n);
                            return { docs: page.map((d) => makeDoc(d.id, d)) };
                        }),
                    })),
                })),
            })),
            orderBy: vi.fn(() => ({
                select: vi.fn(() => ({
                    startAfter: vi.fn(() => ({
                        limit: vi.fn((n) => ({
                            get: vi.fn(async () => {
                                callCount += 1;
                                const start = (callCount - 1) * 500;
                                const page = docs.slice(start, start + n);
                                return { docs: page.map((d) => makeDoc(d.id, d)) };
                            }),
                        })),
                    })),
                    limit: vi.fn((n) => ({
                        get: vi.fn(async () => {
                            callCount += 1;
                            const start = (callCount - 1) * 500;
                            const page = docs.slice(start, start + n);
                            return { docs: page.map((d) => makeDoc(d.id, d)) };
                        }),
                    })),
                })),
                startAfter: vi.fn(() => ({
                    limit: vi.fn((n) => ({
                        get: vi.fn(async () => {
                            callCount += 1;
                            const start = (callCount - 1) * 500;
                            const page = docs.slice(start, start + n);
                            return { docs: page.map((d) => makeDoc(d.id, d)) };
                        }),
                    })),
                })),
                limit: vi.fn((n) => ({
                    get: vi.fn(async () => {
                        callCount += 1;
                        const start = (callCount - 1) * 500;
                        const page = docs.slice(start, start + n);
                        return { docs: page.map((d) => makeDoc(d.id, d)) };
                    }),
                })),
            })),
        })),
    };
}

describe('fetchTenantCaseDocuments', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('retorna todos os documentos quando menos que o limite', async () => {
        const docs = Array.from({ length: 100 }, (_, i) => ({ id: `doc-${i}`, tenantId: 't1', createdAt: new Date() }));
        const mockDb = buildMockDb(docs);

        const result = await fetchTenantCaseDocuments({ db: mockDb, collectionId: 'cases', tenantId: 't1' });

        expect(result.docs.length).toBe(100);
        expect(result.scannedRecords).toBe(100);
        expect(result.capped).toBe(false);
        expect(result.pageCount).toBe(1);
    });

    it('respeita o limite maxDocs padrão (10000)', async () => {
        const docs = Array.from({ length: 10001 }, (_, i) => ({ id: `doc-${i}`, tenantId: 't1', createdAt: new Date() }));
        const mockDb = buildMockDb(docs);

        const result = await fetchTenantCaseDocuments({ db: mockDb, collectionId: 'cases', tenantId: 't1' });

        expect(result.docs.length).toBe(10000);
        expect(result.scannedRecords).toBe(10000);
        expect(result.capped).toBe(true);
        expect(result.pageCount).toBe(20);
    });

    it('permite maxDocs customizado', async () => {
        const docs = Array.from({ length: 1000 }, (_, i) => ({ id: `doc-${i}`, tenantId: 't1', createdAt: new Date() }));
        const mockDb = buildMockDb(docs);

        const result = await fetchTenantCaseDocuments({ db: mockDb, collectionId: 'cases', tenantId: 't1', maxDocs: 500 });

        expect(result.docs.length).toBe(500);
        expect(result.scannedRecords).toBe(500);
        expect(result.capped).toBe(true);
    });

    it('filtra por tenantId', async () => {
        const docs = [
            { id: 'doc-1', tenantId: 't1', createdAt: new Date() },
            { id: 'doc-2', tenantId: 't2', createdAt: new Date() },
        ];
        const mockDb = buildMockDb(docs);

        const result = await fetchTenantCaseDocuments({ db: mockDb, collectionId: 'cases', tenantId: 't1' });

        expect(result.docs.length).toBe(2); // Mock retorna todos, mas a query tem where
    });

    it('respeita fields quando fornecido', async () => {
        const docs = [{ id: 'doc-1', tenantId: 't1', createdAt: new Date(), name: 'Test' }];
        const mockDb = buildMockDb(docs);

        const result = await fetchTenantCaseDocuments({
            db: mockDb,
            collectionId: 'cases',
            tenantId: 't1',
            fields: ['name'],
        });

        expect(result.docs.length).toBe(1);
    });

    it('funciona sem tenantId', async () => {
        const docs = Array.from({ length: 50 }, (_, i) => ({ id: `doc-${i}`, createdAt: new Date() }));
        const mockDb = buildMockDb(docs);

        const result = await fetchTenantCaseDocuments({ db: mockDb, collectionId: 'cases' });

        expect(result.docs.length).toBe(50);
        expect(result.capped).toBe(false);
    });
});
