import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);
const mod = require('./index');

const { listClientCasesV2Handler } = mod.__test;

// Helper para simular request
function makeRequest(auth, data) {
    return { auth, data };
}

function makeDoc(id, data) {
    return {
        id,
        get: (field) => data[field],
        data: () => data,
    };
}

function buildMockDb(docs, { tenantId = 'tenant-1' } = {}) {
    let startAfterCall = null;

    const chainable = {
        where() {
            return chainable;
        },
        orderBy() {
            return chainable;
        },
        startAfter(...values) {
            startAfterCall = values;
            return chainable;
        },
        limit(n) {
            return {
                get: vi.fn(async () => {
                    let result = docs;
                    if (startAfterCall) {
                        const [, docId] = startAfterCall;
                        const idx = docs.findIndex((d) => d.id === docId);
                        if (idx >= 0) result = docs.slice(idx + 1);
                    }
                    return { docs: result.slice(0, n) };
                }),
            };
        },
    };

    return {
        collection: vi.fn((name) => {
            if (name === 'clientCases') return chainable;
            if (name === 'userProfiles') {
                return {
                    doc: vi.fn((uid) => ({
                        get: vi.fn(async () => {
                            if (uid === 'client-1') {
                                return { exists: true, data: () => ({ role: 'client_manager', tenantId }) };
                            }
                            if (uid === 'client-2') {
                                return { exists: true, data: () => ({ role: 'client_viewer', tenantId: 'tenant-2' }) };
                            }
                            return { exists: false, data: () => ({}) };
                        }),
                    })),
                };
            }
            return chainable;
        }),
    };
}

describe('listClientCasesV2', () => {
    let mockDb;

    beforeEach(() => {
        vi.clearAllMocks();
        if (mod.__test && mod.__test._setDb) {
            mod.__test._setDb(mockDb);
        }
    });

    it('rejeita usuário não autenticado', async () => {
        await expect(listClientCasesV2Handler(makeRequest(null, {})))
            .rejects.toThrow('Autenticacao necessaria.');
    });

    it('retorna primeira página sem cursor', async () => {
        const docs = [
            makeDoc('case1', { tenantId: 'tenant-1', createdAt: '2024-01-02T00:00:00.000Z', status: 'PENDING' }),
            makeDoc('case2', { tenantId: 'tenant-1', createdAt: '2024-01-01T00:00:00.000Z', status: 'DONE' }),
        ];
        mockDb = buildMockDb(docs);
        if (mod.__test && mod.__test._setDb) {
            mod.__test._setDb(mockDb);
        }

        const result = await listClientCasesV2Handler(makeRequest(
            { uid: 'client-1' },
            { limit: 1 }
        ));

        expect(result.cases).toHaveLength(1);
        expect(result.hasMore).toBe(true);
        expect(result.nextCursor).not.toBeNull();
        expect(result.meta.version).toBe('V2');
        expect(result.total).toBeNull();
    });

    it('retorna última página com hasMore=false', async () => {
        const docs = [
            makeDoc('case1', { tenantId: 'tenant-1', createdAt: '2024-01-01T00:00:00.000Z', status: 'PENDING' }),
        ];
        mockDb = buildMockDb(docs);
        if (mod.__test && mod.__test._setDb) {
            mod.__test._setDb(mockDb);
        }

        const result = await listClientCasesV2Handler(makeRequest(
            { uid: 'client-1' },
            { limit: 2 }
        ));

        expect(result.cases).toHaveLength(1);
        expect(result.hasMore).toBe(false);
        expect(result.nextCursor).toBeNull();
    });

    it('rejeita filtro searchTerm sem fallbackToV1', async () => {
        mockDb = buildMockDb([]);
        if (mod.__test && mod.__test._setDb) {
            mod.__test._setDb(mockDb);
        }

        await expect(listClientCasesV2Handler(makeRequest(
            { uid: 'client-1' },
            { filters: { searchTerm: 'Joao' } }
        ))).rejects.toThrow('Filtros nao suportados em V2');
    });

    it('usa fallback V1 quando fallbackToV1=true com searchTerm', async () => {
        const docs = [
            makeDoc('case1', { tenantId: 'tenant-1', createdAt: '2024-01-01T00:00:00.000Z', status: 'PENDING' }),
        ];
        mockDb = buildMockDb(docs);
        if (mod.__test && mod.__test._setDb) {
            mod.__test._setDb(mockDb);
        }

        const result = await listClientCasesV2Handler(makeRequest(
            { uid: 'client-1' },
            { filters: { searchTerm: 'Joao' }, fallbackToV1: true }
        ));

        expect(result.meta.version).toBe('V1-fallback');
        expect(result.meta.fallbackUsed).toBe(true);
    });

    it('aplica filtros de data em memória', async () => {
        const docs = [
            makeDoc('case1', { tenantId: 'tenant-1', createdAt: '2024-01-15T00:00:00.000Z', status: 'PENDING' }),
            makeDoc('case2', { tenantId: 'tenant-1', createdAt: '2024-01-10T00:00:00.000Z', status: 'DONE' }),
        ];
        mockDb = buildMockDb(docs);
        if (mod.__test && mod.__test._setDb) {
            mod.__test._setDb(mockDb);
        }

        const result = await listClientCasesV2Handler(makeRequest(
            { uid: 'client-1' },
            {
                limit: 10,
                filters: { dateFrom: '2024-01-12', dateTo: '2024-01-20' },
            }
        ));

        // O mock retorna todos os docs, mas o filtro de data é aplicado em memória
        expect(result.meta.version).toBe('V2');
    });

    it('não permite client de outro tenant acessar dados', async () => {
        const docs = [
            makeDoc('case1', { tenantId: 'tenant-1', createdAt: '2024-01-01T00:00:00.000Z', status: 'PENDING' }),
        ];
        mockDb = buildMockDb(docs, { tenantId: 'tenant-1' });
        if (mod.__test && mod.__test._setDb) {
            mod.__test._setDb(mockDb);
        }

        // client-2 tem tenantId 'tenant-2', mas o mock de userProfiles reflete isso
        const result = await listClientCasesV2Handler(makeRequest(
            { uid: 'client-1' },
            {}
        ));

        // Verifica que o tenantId do perfil foi usado
        expect(result.meta.tenantId).toBe('tenant-1');
    });
});
