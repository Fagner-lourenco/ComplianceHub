import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

// Firebase env for module initialization
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

const require = createRequire(import.meta.url);

let mod;
try {
    mod = require('./index');
} catch {
    // Firebase init may fail in some CI environments
}

const describeIfLoaded = mod?.__test ? describe : describe.skip;

describeIfLoaded('getClientQuotaStatusInner', () => {
    const { getClientQuotaStatusInner, formatDateKey, formatMonthKey, _setDb } = mod.__test;

    const NOW = new Date('2026-04-10T15:00:00Z');
    const DAY_KEY = formatDateKey(NOW);
    const MONTH_KEY = formatMonthKey(NOW);

    beforeEach(() => {
        vi.useFakeTimers({ now: NOW });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ── Firestore mock builder ────────────────────────────────────────────────

    function buildMockDb({ profile, tenantSettings, usage } = {}) {
        const store = {
            userProfiles: { 'uid-1': profile },
            tenantSettings: { 'tenant-1': tenantSettings },
            tenantUsage: { 'tenant-1': usage },
        };

        return {
            collection: vi.fn((collName) => ({
                doc: vi.fn((docId) => ({
                    get: vi.fn(async () => {
                        const data = store[collName]?.[docId];
                        if (data === undefined) return { exists: false, data: () => ({}) };
                        return { exists: true, data: () => data };
                    }),
                })),
            })),
        };
    }

    // ── No profile → throws permission-denied ────────────────────────────────

    it('throws when user profile does not exist', async () => {
        _setDb(buildMockDb({})); // no profile doc
        await expect(getClientQuotaStatusInner('uid-1')).rejects.toThrow('Perfil do cliente');
    });

    // ── Profile without client role → throws ─────────────────────────────────

    it('throws when profile has non-client role', async () => {
        _setDb(buildMockDb({ profile: { role: 'ops_analyst', tenantId: 'tenant-1' } }));
        await expect(getClientQuotaStatusInner('uid-1')).rejects.toThrow('sem permissao');
    });

    // ── Profile without tenantId → throws ────────────────────────────────────

    it('throws when profile has no tenantId', async () => {
        _setDb(buildMockDb({ profile: { role: 'client_manager' } })); // no tenantId
        await expect(getClientQuotaStatusInner('uid-1')).rejects.toThrow('tenantId');
    });

    // ── No limits configured → hasLimits false ───────────────────────────────

    it('returns hasLimits false when tenant has no limits', async () => {
        _setDb(buildMockDb({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { /* no dailyLimit, no monthlyLimit */ },
        }));

        const result = await getClientQuotaStatusInner('uid-1');
        expect(result).toEqual({
            hasLimits: false,
            dailyLimit: null,
            monthlyLimit: null,
            dailyCount: 0,
            monthlyCount: 0,
        });
    });

    // ── Tenant settings null (no doc) → hasLimits false ──────────────────────

    it('returns hasLimits false when tenantSettings doc does not exist', async () => {
        _setDb(buildMockDb({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            // no tenantSettings → getTenantSettingsData returns null
        }));

        const result = await getClientQuotaStatusInner('uid-1');
        expect(result).toEqual({
            hasLimits: false,
            dailyLimit: null,
            monthlyLimit: null,
            dailyCount: 0,
            monthlyCount: 0,
        });
    });

    // ── With limits + current usage → correct counts ─────────────────────────

    it('returns correct counts when usage matches current day/month', async () => {
        _setDb(buildMockDb({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 10, monthlyLimit: 50, allowDailyExceedance: false },
            usage: { dayKey: DAY_KEY, monthKey: MONTH_KEY, dailyCount: 7, monthlyCount: 30 },
        }));

        const result = await getClientQuotaStatusInner('uid-1');
        expect(result).toEqual({
            hasLimits: true,
            dailyLimit: 10,
            monthlyLimit: 50,
            dailyCount: 7,
            monthlyCount: 30,
            allowDailyExceedance: false,
            allowMonthlyExceedance: false, // default
        });
    });

    // ── Lazy reset: stale dayKey → dailyCount 0 ──────────────────────────────

    it('resets daily count when dayKey is stale', async () => {
        _setDb(buildMockDb({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 10, monthlyLimit: 50 },
            usage: { dayKey: '2026-04-09', monthKey: MONTH_KEY, dailyCount: 99, monthlyCount: 30 },
        }));

        const result = await getClientQuotaStatusInner('uid-1');
        expect(result.dailyCount).toBe(0);
        expect(result.monthlyCount).toBe(30);
    });

    // ── Lazy reset: stale monthKey → monthlyCount 0 ──────────────────────────

    it('resets monthly count when monthKey is stale', async () => {
        _setDb(buildMockDb({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 10, monthlyLimit: 50 },
            usage: { dayKey: DAY_KEY, monthKey: '2026-03', dailyCount: 5, monthlyCount: 200 },
        }));

        const result = await getClientQuotaStatusInner('uid-1');
        expect(result.dailyCount).toBe(5);
        expect(result.monthlyCount).toBe(0);
    });

    // ── No usage doc (first query) → counts 0 ───────────────────────────────

    it('returns zero counts when no usage doc exists', async () => {
        _setDb(buildMockDb({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 10, monthlyLimit: 50 },
            // no usage doc
        }));

        const result = await getClientQuotaStatusInner('uid-1');
        expect(result.dailyCount).toBe(0);
        expect(result.monthlyCount).toBe(0);
        expect(result.hasLimits).toBe(true);
    });

    // ── allowExceedance flags forwarded correctly ────────────────────────────

    it('forwards allowDailyExceedance and allowMonthlyExceedance', async () => {
        _setDb(buildMockDb({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: {
                dailyLimit: 10,
                monthlyLimit: 50,
                allowDailyExceedance: true,
                allowMonthlyExceedance: true,
            },
            usage: { dayKey: DAY_KEY, monthKey: MONTH_KEY, dailyCount: 1, monthlyCount: 1 },
        }));

        const result = await getClientQuotaStatusInner('uid-1');
        expect(result.allowDailyExceedance).toBe(true);
        expect(result.allowMonthlyExceedance).toBe(true);
    });

    // ── Only daily limit set → monthly null ──────────────────────────────────

    it('handles only daily limit (monthly null)', async () => {
        _setDb(buildMockDb({
            profile: { role: 'client_manager', tenantId: 'tenant-1' },
            tenantSettings: { dailyLimit: 5 }, // no monthlyLimit
            usage: { dayKey: DAY_KEY, monthKey: MONTH_KEY, dailyCount: 3, monthlyCount: 20 },
        }));

        const result = await getClientQuotaStatusInner('uid-1');
        expect(result.hasLimits).toBe(true);
        expect(result.dailyLimit).toBe(5);
        expect(result.monthlyLimit).toBe(null);
    });
});
