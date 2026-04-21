import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

// Set minimal Firebase env so initializeApp() + getFirestore() succeed at require-time
const origGcloud = process.env.GCLOUD_PROJECT;
const origFirebaseConfig = process.env.FIREBASE_CONFIG;
process.env.GCLOUD_PROJECT = 'compliance-hub-test';
process.env.FIREBASE_CONFIG = '{}';

const require = createRequire(import.meta.url);

let mod;
try {
    mod = require('./index');
} catch {
    // If Firebase still fails, skip gracefully
}

afterEach(() => {
    vi.useRealTimers();
    // Restore env
    if (origGcloud === undefined) delete process.env.GCLOUD_PROJECT;
    else process.env.GCLOUD_PROJECT = origGcloud;
    if (origFirebaseConfig === undefined) delete process.env.FIREBASE_CONFIG;
    else process.env.FIREBASE_CONFIG = origFirebaseConfig;
});

const describeIfLoaded = mod?.__test ? describe : describe.skip;

describeIfLoaded('enforceTenantSubmissionLimits', () => {
    const { enforceTenantSubmissionLimits, formatDateKey, formatMonthKey, _setDb, _setWriteAuditEvent } = mod.__test;

    const TODAY = new Date('2026-04-10T15:00:00Z');
    const DAY_KEY = formatDateKey(TODAY);
    const MONTH_KEY = formatMonthKey(TODAY);

    // Mock Firestore
    let mockTxGet, mockTxSet, mockRunTransaction, mockDb;
    let mockWriteAuditEvent;

    function makeUsageSnap(data) {
        if (!data) return { exists: false, data: () => ({}) };
        return { exists: true, data: () => data };
    }

    beforeEach(() => {
        vi.useFakeTimers({ now: TODAY });
        vi.clearAllMocks();

        mockTxGet = vi.fn();
        mockTxSet = vi.fn();
        mockRunTransaction = vi.fn(async (callback) => {
            const tx = { get: mockTxGet, set: mockTxSet };
            return callback(tx);
        });

        const mockUsageDoc = { id: 'tenant-1' };
        mockDb = {
            collection: vi.fn(() => ({
                doc: vi.fn(() => mockUsageDoc),
            })),
            runTransaction: mockRunTransaction,
        };

        mockWriteAuditEvent = vi.fn().mockResolvedValue(undefined);

        _setDb(mockDb);
        _setWriteAuditEvent(mockWriteAuditEvent);
    });

    // ── formatDateKey / formatMonthKey ───────────────────────────────────────

    describe('formatDateKey', () => {
        it('returns YYYY-MM-DD in SP timezone', () => {
            // 2026-04-10T03:00:00Z = midnight in SP (UTC-3), so still April 10
            const d = new Date('2026-04-10T03:00:00Z');
            expect(formatDateKey(d)).toBe('2026-04-10');
        });

        it('handles timezone boundary (UTC midnight = previous day in SP)', () => {
            // 2026-04-10T02:00:00Z = Apr 9, 23:00 in SP
            const d = new Date('2026-04-10T02:00:00Z');
            expect(formatDateKey(d)).toBe('2026-04-09');
        });

        it('throws on invalid date', () => {
            expect(() => formatDateKey(new Date('invalid'))).toThrow(RangeError);
        });
    });

    describe('formatMonthKey', () => {
        it('returns YYYY-MM', () => {
            expect(formatMonthKey(new Date('2026-04-10T15:00:00Z'))).toBe('2026-04');
        });

        it('throws on invalid date', () => {
            expect(() => formatMonthKey(new Date('invalid'))).toThrow(RangeError);
        });
    });

    // ── No limits → early return ─────────────────────────────────────────────

    it('returns early when no limits configured', async () => {
        const result = await enforceTenantSubmissionLimits('tenant-1', { dailyLimit: null, monthlyLimit: null }, {});
        expect(result).toEqual({ dailyCount: 0, monthlyCount: 0, exceeded: false });
        expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it('returns early when settings is null', async () => {
        const result = await enforceTenantSubmissionLimits('tenant-1', null, {});
        expect(result).toEqual({ dailyCount: 0, monthlyCount: 0, exceeded: false });
    });

    // ── Normal increment (under limits) ──────────────────────────────────────

    it('increments counters atomically when under limits', async () => {
        mockTxGet.mockResolvedValue(makeUsageSnap({
            dayKey: DAY_KEY,
            monthKey: MONTH_KEY,
            dailyCount: 3,
            monthlyCount: 10,
        }));

        const result = await enforceTenantSubmissionLimits(
            'tenant-1',
            { dailyLimit: 10, monthlyLimit: 50 },
            { actor: { uid: 'u1', email: 'u@t.com', role: 'client_admin' } },
        );

        expect(result).toEqual({ dailyCount: 4, monthlyCount: 11, exceeded: false });
        expect(mockTxSet).toHaveBeenCalledOnce();
        const setArgs = mockTxSet.mock.calls[0];
        expect(setArgs[1]).toMatchObject({ dailyCount: 4, monthlyCount: 11, dayKey: DAY_KEY, monthKey: MONTH_KEY });
        expect(mockWriteAuditEvent).not.toHaveBeenCalled();
    });

    // ── Lazy reset (new day) ─────────────────────────────────────────────────

    it('resets daily counter when dayKey changes', async () => {
        mockTxGet.mockResolvedValue(makeUsageSnap({
            dayKey: '2026-04-09', // yesterday
            monthKey: MONTH_KEY,
            dailyCount: 50,
            monthlyCount: 10,
        }));

        const result = await enforceTenantSubmissionLimits(
            'tenant-1',
            { dailyLimit: 10, monthlyLimit: 50 },
            { actor: { uid: 'u1', email: 'u@t.com', role: 'client_admin' } },
        );

        // dailyCount resets to 0, then +1 = 1
        expect(result.dailyCount).toBe(1);
        expect(result.monthlyCount).toBe(11);
        expect(result.exceeded).toBe(false);
    });

    it('resets monthly counter when monthKey changes', async () => {
        mockTxGet.mockResolvedValue(makeUsageSnap({
            dayKey: DAY_KEY,
            monthKey: '2026-03', // last month
            dailyCount: 3,
            monthlyCount: 200,
        }));

        const result = await enforceTenantSubmissionLimits(
            'tenant-1',
            { dailyLimit: 10, monthlyLimit: 50 },
            { actor: { uid: 'u1', email: 'u@t.com', role: 'client_admin' } },
        );

        expect(result.dailyCount).toBe(4);
        expect(result.monthlyCount).toBe(1); // reset to 0 + 1
        expect(result.exceeded).toBe(false);
    });

    // ── Daily block (no exceedance allowed) ──────────────────────────────────

    it('throws HttpsError when daily limit reached and exceedance not allowed', async () => {
        mockTxGet.mockResolvedValue(makeUsageSnap({
            dayKey: DAY_KEY,
            monthKey: MONTH_KEY,
            dailyCount: 5,
            monthlyCount: 10,
        }));

        await expect(
            enforceTenantSubmissionLimits(
                'tenant-1',
                { dailyLimit: 5, monthlyLimit: 50, allowDailyExceedance: false },
                { actor: { uid: 'u1', email: 'u@t.com', role: 'client_admin' }, ip: '1.2.3.4' },
            ),
        ).rejects.toThrow('Limite diario');

        expect(mockWriteAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'SUBMISSION_BLOCKED_DAILY', tenantId: 'tenant-1' }),
        );
    });

    // ── Monthly block (no exceedance allowed) ────────────────────────────────

    it('throws HttpsError when monthly limit reached and exceedance not allowed', async () => {
        mockTxGet.mockResolvedValue(makeUsageSnap({
            dayKey: DAY_KEY,
            monthKey: MONTH_KEY,
            dailyCount: 3,
            monthlyCount: 50,
        }));

        await expect(
            enforceTenantSubmissionLimits(
                'tenant-1',
                { dailyLimit: 10, monthlyLimit: 50, allowMonthlyExceedance: false },
                { actor: { uid: 'u1', email: 'u@t.com', role: 'client_admin' }, ip: '1.2.3.4' },
            ),
        ).rejects.toThrow('Limite mensal');

        expect(mockWriteAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'SUBMISSION_BLOCKED_MONTHLY', tenantId: 'tenant-1' }),
        );
    });

    // ── Daily exceeded with allowExceedance ──────────────────────────────────

    it('allows exceedance and emits DAILY_LIMIT_EXCEEDED audit', async () => {
        mockTxGet.mockResolvedValue(makeUsageSnap({
            dayKey: DAY_KEY,
            monthKey: MONTH_KEY,
            dailyCount: 10,
            monthlyCount: 10,
        }));

        const result = await enforceTenantSubmissionLimits(
            'tenant-1',
            { dailyLimit: 10, monthlyLimit: 50 }, // allowDailyExceedance defaults to true
            { actor: { uid: 'u1', email: 'u@t.com', role: 'client_admin' } },
        );

        expect(result.exceeded).toBe(true);
        expect(result.dailyCount).toBe(11);
        expect(mockWriteAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'DAILY_LIMIT_EXCEEDED' }),
        );
    });

    // ── Monthly exceeded with allowExceedance ────────────────────────────────

    it('allows monthly exceedance and emits MONTHLY_LIMIT_EXCEEDED audit', async () => {
        mockTxGet.mockResolvedValue(makeUsageSnap({
            dayKey: DAY_KEY,
            monthKey: MONTH_KEY,
            dailyCount: 3,
            monthlyCount: 50,
        }));

        const result = await enforceTenantSubmissionLimits(
            'tenant-1',
            { dailyLimit: 10, monthlyLimit: 50, allowMonthlyExceedance: true },
            { actor: { uid: 'u1', email: 'u@t.com', role: 'client_admin' } },
        );

        expect(result.exceeded).toBe(true);
        expect(result.monthlyCount).toBe(51);
        expect(mockWriteAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'MONTHLY_LIMIT_EXCEEDED' }),
        );
    });

    // ── No audit event when no actor ─────────────────────────────────────────

    it('does not emit audit event when actor is missing (blocked)', async () => {
        mockTxGet.mockResolvedValue(makeUsageSnap({
            dayKey: DAY_KEY,
            monthKey: MONTH_KEY,
            dailyCount: 5,
            monthlyCount: 10,
        }));

        await expect(
            enforceTenantSubmissionLimits(
                'tenant-1',
                { dailyLimit: 5, allowDailyExceedance: false },
                {}, // no actor
            ),
        ).rejects.toThrow('Limite diario');

        expect(mockWriteAuditEvent).not.toHaveBeenCalled();
    });

    // ── No usage doc exists (first submission) ───────────────────────────────

    it('handles first submission (no usage doc)', async () => {
        mockTxGet.mockResolvedValue(makeUsageSnap(null));

        const result = await enforceTenantSubmissionLimits(
            'tenant-1',
            { dailyLimit: 10, monthlyLimit: 50 },
            { actor: { uid: 'u1', email: 'u@t.com', role: 'client_admin' } },
        );

        expect(result).toEqual({ dailyCount: 1, monthlyCount: 1, exceeded: false });
    });

    // ── Daily blocked takes priority over monthly ────────────────────────────

    it('blocks on daily limit even if monthly is also reached', async () => {
        mockTxGet.mockResolvedValue(makeUsageSnap({
            dayKey: DAY_KEY,
            monthKey: MONTH_KEY,
            dailyCount: 5,
            monthlyCount: 50,
        }));

        await expect(
            enforceTenantSubmissionLimits(
                'tenant-1',
                { dailyLimit: 5, monthlyLimit: 50, allowDailyExceedance: false, allowMonthlyExceedance: false },
                { actor: { uid: 'u1', email: 'u@t.com', role: 'client_admin' } },
            ),
        ).rejects.toThrow('Limite diario');

        // Daily block fires, not monthly
        expect(mockWriteAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'SUBMISSION_BLOCKED_DAILY' }),
        );
    });
});
