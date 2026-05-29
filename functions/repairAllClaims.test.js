import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);
const mod = require('./index');

const { repairAllClaimsInner, _setDb, _setGetAuth } = mod.__test;

function makeDoc(id, data) {
    return { id, data: () => data };
}

function buildMockDb({ callerRole = 'admin', profiles = [] } = {}) {
    let callCount = 0;
    const chunks = [];
    for (let i = 0; i < profiles.length; i += 500) {
        chunks.push(profiles.slice(i, i + 500));
    }

    return {
        collection: vi.fn((collectionName) => {
            if (collectionName === 'userProfiles') {
                return {
                    doc: vi.fn((docId) => ({
                        get: vi.fn(async () => {
                            if (docId === 'caller-1') {
                                return { exists: true, data: () => ({ role: callerRole }) };
                            }
                            return { exists: false, data: () => ({}) };
                        }),
                    })),
                    orderBy: vi.fn(() => ({
                        limit: vi.fn(() => ({
                            startAfter: vi.fn(() => ({
                                get: vi.fn(async () => {
                                    callCount += 1;
                                    const page = chunks[callCount - 1] || [];
                                    return { empty: page.length === 0, docs: page.map((p) => makeDoc(p.id, p.data)) };
                                }),
                            })),
                            get: vi.fn(async () => {
                                callCount += 1;
                                const page = chunks[callCount - 1] || [];
                                return { empty: page.length === 0, docs: page.map((p) => makeDoc(p.id, p.data)) };
                            }),
                        })),
                    })),
                };
            }
            return { doc: vi.fn(() => ({ get: vi.fn(async () => ({ exists: false })) })) };
        }),
    };
}

describe('repairAllClaimsInner', () => {
    const mockSetCustomUserClaims = vi.fn();

    beforeEach(() => {
        vi.restoreAllMocks();
        mockSetCustomUserClaims.mockClear();
        _setGetAuth(() => ({
            setCustomUserClaims: mockSetCustomUserClaims,
        }));
    });

    it('rejeita usuario nao autenticado', async () => {
        _setDb(buildMockDb());
        await expect(repairAllClaimsInner({ auth: null }))
            .rejects.toThrow('Autenticacao necessaria');
    });

    it('rejeita nao-admin', async () => {
        _setDb(buildMockDb({ callerRole: 'analyst' }));
        await expect(repairAllClaimsInner({ auth: { uid: 'caller-1' } }))
            .rejects.toThrow('Apenas administradores podem executar reparo em massa');
    });

    it('processa todos os usuarios em paginas', async () => {
        const profiles = Array.from({ length: 1000 }, (_, i) => ({
            id: `user-${i}`,
            data: { role: 'analyst', tenantId: 'tenant-1' },
        }));
        _setDb(buildMockDb({ callerRole: 'admin', profiles }));

        const result = await repairAllClaimsInner({ auth: { uid: 'caller-1' } });

        expect(result.total).toBe(1000);
        expect(result.fixed).toBe(1000);
        expect(result.skipped).toBe(0);
        expect(result.errors).toBe(0);
        expect(mockSetCustomUserClaims).toHaveBeenCalledTimes(1000);
    });

    it('pula usuarios sem role ou tenantId', async () => {
        const profiles = [
            { id: 'user-1', data: { role: 'analyst', tenantId: 'tenant-1' } },
            { id: 'user-2', data: { role: null, tenantId: 'tenant-1' } },
            { id: 'user-3', data: { role: 'analyst', tenantId: null } },
            { id: 'user-4', data: {} },
        ];
        _setDb(buildMockDb({ callerRole: 'admin', profiles }));

        const result = await repairAllClaimsInner({ auth: { uid: 'caller-1' } });

        expect(result.total).toBe(4);
        expect(result.fixed).toBe(1);
        expect(result.skipped).toBe(3);
    });

    it('conta erros do auth', async () => {
        mockSetCustomUserClaims.mockRejectedValueOnce(new Error('Auth error'));
        const profiles = [
            { id: 'user-1', data: { role: 'analyst', tenantId: 'tenant-1' } },
            { id: 'user-2', data: { role: 'analyst', tenantId: 'tenant-1' } },
        ];
        _setDb(buildMockDb({ callerRole: 'admin', profiles }));

        const result = await repairAllClaimsInner({ auth: { uid: 'caller-1' } });

        expect(result.total).toBe(2);
        expect(result.fixed).toBe(1);
        expect(result.errors).toBe(1);
    });

    it('limita concorrencia a 10', async () => {
        const profiles = Array.from({ length: 25 }, (_, i) => ({
            id: `user-${i}`,
            data: { role: 'analyst', tenantId: 'tenant-1' },
        }));
        _setDb(buildMockDb({ callerRole: 'admin', profiles }));

        let concurrent = 0;
        let maxConcurrent = 0;
        mockSetCustomUserClaims.mockImplementation(async () => {
            concurrent += 1;
            maxConcurrent = Math.max(maxConcurrent, concurrent);
            await new Promise((resolve) => setTimeout(resolve, 10));
            concurrent -= 1;
        });

        await repairAllClaimsInner({ auth: { uid: 'caller-1' } });

        expect(maxConcurrent).toBeLessThanOrEqual(10);
    });
});
