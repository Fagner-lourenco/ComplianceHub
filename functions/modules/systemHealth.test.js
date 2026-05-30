/**
 * Testes para systemHealth.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getSystemHealthLogic,
    getClientQuotaStatusInner,
} from './systemHealth';

describe('getSystemHealthLogic', () => {
    it('retorna providers com status', async () => {
        const mockDocs = [
            {
                id: 'judit',
                data: () => ({ failCount: 2, lastSuccess: new Date(), lastError: 'timeout' }),
            },
            {
                id: 'escavador',
                data: () => ({ failCount: 0, lastSuccess: new Date() }),
            },
        ];

        const db = {
            collection: vi.fn(() => ({
                get: vi.fn(async () => ({
                    forEach: (cb) => mockDocs.forEach(cb),
                })),
            })),
        };

        const getOpsUserProfile = vi.fn(async () => ({ role: 'admin' }));
        const circuitBreaker = { COLLECTION: 'systemHealth' };

        const result = await getSystemHealthLogic({ db, getOpsUserProfile, circuitBreaker });

        expect(result.providers).toHaveProperty('judit');
        expect(result.providers).toHaveProperty('escavador');
        expect(result.providers.judit.failCount).toBe(2);
        expect(result.providers.escavador.failCount).toBe(0);
    });

    it('nega acesso para role nao autorizado', async () => {
        const getOpsUserProfile = vi.fn(async () => ({ role: 'client_manager' }));
        const db = { collection: vi.fn() };
        const circuitBreaker = { COLLECTION: 'systemHealth' };

        await expect(
            getSystemHealthLogic({ db, getOpsUserProfile, circuitBreaker })
        ).rejects.toThrow('Apenas analistas podem acessar.');
    });
});

describe('getClientQuotaStatusInner', () => {
    const NOW = new Date('2026-04-10T15:00:00Z');

    beforeEach(() => {
        vi.useFakeTimers({ now: NOW });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function buildMockDeps({ profile, tenantSettings, usage } = {}) {
        const store = {
            userProfiles: { 'uid-1': profile },
            tenantSettings: { 'tenant-1': tenantSettings },
            tenantUsage: { 'tenant-1': usage },
        };

        return {
            getClientUserProfile: vi.fn(async (uid) => {
                const data = store.userProfiles[uid];
                if (!data) throw new Error('Perfil do cliente nao encontrado.');
                if (!['client_viewer', 'client_operator', 'client_manager', 'CLIENT'].includes(data.role)) {
                    throw new Error('Perfil do cliente sem permissao para esta operacao.');
                }
                if (!data.tenantId) throw new Error('Cliente sem tenantId associado.');
                return data;
            }),
            getTenantSettingsData: vi.fn(async (tenantId) => {
                return store.tenantSettings[tenantId] || null;
            }),
            db: {
                collection: vi.fn((collName) => ({
                    doc: vi.fn((docId) => ({
                        get: vi.fn(async () => {
                            const data = store[collName]?.[docId];
                            if (data === undefined) return { exists: false, data: () => ({}) };
                            return { exists: true, data: () => data };
                        }),
                    })),
                })),
            },
        };
    }

    it('retorna hasLimits false quando tenant nao tem limites', async () => {
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: {},
        });

        const result = await getClientQuotaStatusInner({ ...deps, uid: 'uid-1' });
        expect(result).toEqual({
            hasLimits: false,
            dailyLimit: null,
            monthlyLimit: null,
            dailyCount: 0,
            monthlyCount: 0,
        });
    });

    it('retorna contadores corretos quando ha uso atual', async () => {
        const DAY_KEY = '2026-04-10';
        const MONTH_KEY = '2026-04';
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 10, monthlyLimit: 50, allowDailyExceedance: false },
            usage: { dayKey: DAY_KEY, monthKey: MONTH_KEY, dailyCount: 7, monthlyCount: 30 },
        });

        const result = await getClientQuotaStatusInner({ ...deps, uid: 'uid-1' });
        expect(result).toEqual({
            hasLimits: true,
            dailyLimit: 10,
            monthlyLimit: 50,
            dailyCount: 7,
            monthlyCount: 30,
            allowDailyExceedance: false,
            allowMonthlyExceedance: false,
        });
    });

    it('reseta contagem diaria quando dayKey esta desatualizado', async () => {
        const MONTH_KEY = '2026-04';
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 10, monthlyLimit: 50 },
            usage: { dayKey: '2026-04-09', monthKey: MONTH_KEY, dailyCount: 99, monthlyCount: 30 },
        });

        const result = await getClientQuotaStatusInner({ ...deps, uid: 'uid-1' });
        expect(result.dailyCount).toBe(0);
        expect(result.monthlyCount).toBe(30);
    });

    it('reseta contagem mensal quando monthKey esta desatualizado', async () => {
        const DAY_KEY = '2026-04-10';
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 10, monthlyLimit: 50 },
            usage: { dayKey: DAY_KEY, monthKey: '2026-03', dailyCount: 5, monthlyCount: 200 },
        });

        const result = await getClientQuotaStatusInner({ ...deps, uid: 'uid-1' });
        expect(result.dailyCount).toBe(5);
        expect(result.monthlyCount).toBe(0);
    });

    it('retorna zero quando nao ha doc de uso', async () => {
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 10, monthlyLimit: 50 },
        });

        const result = await getClientQuotaStatusInner({ ...deps, uid: 'uid-1' });
        expect(result.dailyCount).toBe(0);
        expect(result.monthlyCount).toBe(0);
        expect(result.hasLimits).toBe(true);
    });

    it('forward allowDailyExceedance e allowMonthlyExceedance', async () => {
        const DAY_KEY = '2026-04-10';
        const MONTH_KEY = '2026-04';
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: {
                dailyLimit: 10,
                monthlyLimit: 50,
                allowDailyExceedance: true,
                allowMonthlyExceedance: true,
            },
            usage: { dayKey: DAY_KEY, monthKey: MONTH_KEY, dailyCount: 1, monthlyCount: 1 },
        });

        const result = await getClientQuotaStatusInner({ ...deps, uid: 'uid-1' });
        expect(result.allowDailyExceedance).toBe(true);
        expect(result.allowMonthlyExceedance).toBe(true);
    });

    it('lida com apenas daily limit configurado', async () => {
        const DAY_KEY = '2026-04-10';
        const MONTH_KEY = '2026-04';
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 5 },
            usage: { dayKey: DAY_KEY, monthKey: MONTH_KEY, dailyCount: 3, monthlyCount: 20 },
        });

        const result = await getClientQuotaStatusInner({ ...deps, uid: 'uid-1' });
        expect(result.hasLimits).toBe(true);
        expect(result.dailyLimit).toBe(5);
        expect(result.monthlyLimit).toBe(null);
    });

    it('throws when profile has non-client role', async () => {
        const deps = buildMockDeps({ profile: { role: 'ops_analyst', tenantId: 'tenant-1' } });
        await expect(getClientQuotaStatusInner({ ...deps, uid: 'uid-1' })).rejects.toThrow('sem permissao');
    });

    it('throws when profile has no tenantId', async () => {
        const deps = buildMockDeps({ profile: { role: 'client_manager' } });
        await expect(getClientQuotaStatusInner({ ...deps, uid: 'uid-1' })).rejects.toThrow('tenantId');
    });
});
