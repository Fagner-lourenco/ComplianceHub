/**
 * Testes para getClientQuotaStatusInner (extraído para modules/systemHealth.js)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClientQuotaStatusInner } from './modules/systemHealth';
import { formatDateKey, formatMonthKey } from './modules/utilityHelpers';

const NOW = new Date('2026-04-10T15:00:00Z');
const DAY_KEY = formatDateKey(NOW);
const MONTH_KEY = formatMonthKey(NOW);

describe('getClientQuotaStatusInner', () => {
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

    it('throws when user profile does not exist', async () => {
        const deps = buildMockDeps({}); // no profile doc
        await expect(getClientQuotaStatusInner({ ...deps, uid: 'uid-1' })).rejects.toThrow('Perfil do cliente');
    });

    it('throws when profile has non-client role', async () => {
        const deps = buildMockDeps({ profile: { role: 'ops_analyst', tenantId: 'tenant-1' } });
        await expect(getClientQuotaStatusInner({ ...deps, uid: 'uid-1' })).rejects.toThrow('sem permissao');
    });

    it('throws when profile has no tenantId', async () => {
        const deps = buildMockDeps({ profile: { role: 'client_manager' } }); // no tenantId
        await expect(getClientQuotaStatusInner({ ...deps, uid: 'uid-1' })).rejects.toThrow('tenantId');
    });

    it('returns hasLimits false when tenant has no limits', async () => {
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { /* no dailyLimit, no monthlyLimit */ },
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

    it('returns hasLimits false when tenantSettings doc does not exist', async () => {
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            // no tenantSettings → getTenantSettingsData returns null
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

    it('returns correct counts when usage matches current day/month', async () => {
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

    it('resets daily count when dayKey is stale', async () => {
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 10, monthlyLimit: 50 },
            usage: { dayKey: '2026-04-09', monthKey: MONTH_KEY, dailyCount: 99, monthlyCount: 30 },
        });

        const result = await getClientQuotaStatusInner({ ...deps, uid: 'uid-1' });
        expect(result.dailyCount).toBe(0);
        expect(result.monthlyCount).toBe(30);
    });

    it('resets monthly count when monthKey is stale', async () => {
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 10, monthlyLimit: 50 },
            usage: { dayKey: DAY_KEY, monthKey: '2026-03', dailyCount: 5, monthlyCount: 200 },
        });

        const result = await getClientQuotaStatusInner({ ...deps, uid: 'uid-1' });
        expect(result.dailyCount).toBe(5);
        expect(result.monthlyCount).toBe(0);
    });

    it('returns zero counts when no usage doc exists', async () => {
        const deps = buildMockDeps({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 10, monthlyLimit: 50 },
            // no usage doc
        });

        const result = await getClientQuotaStatusInner({ ...deps, uid: 'uid-1' });
        expect(result.dailyCount).toBe(0);
        expect(result.monthlyCount).toBe(0);
        expect(result.hasLimits).toBe(true);
    });

    it('forwards allowDailyExceedance and allowMonthlyExceedance', async () => {
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

    it('handles only daily limit (monthly null)', async () => {
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
});
