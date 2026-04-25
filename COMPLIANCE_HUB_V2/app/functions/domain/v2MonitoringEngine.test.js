import { describe, it, expect, vi } from 'vitest';
import {
    processSingleWatchlist,
    addToWatchlist,
    pauseWatchlist,
    resumeWatchlist,
    deleteWatchlist,
    buildPhantomCaseId,
    normalizeWatchlistData,
    CIRCUIT_BREAKER_FAILURE_THRESHOLD,
} from './v2MonitoringEngine.js';

function makeRef({ existsInitially = false, initialData = null } = {}) {
    const state = { exists: existsInitially, data: initialData };
    const set = vi.fn(async (payload) => {
        state.exists = true;
        state.data = { ...(state.data || {}), ...payload };
    });
    const get = vi.fn(async () => ({
        exists: state.exists,
        data: () => state.data,
    }));
    const del = vi.fn(async () => {
        state.exists = false;
        state.data = null;
    });
    return { set, get, delete: del, _state: state };
}

function makeDb({ subjects = {}, watchlists = {}, riskSignals = [] } = {}) {
    const subjectRefs = {};
    const watchlistRefs = {};
    const caseWrites = [];
    const alertWrites = [];
    let autoId = 0;
    const batch = {
        set: vi.fn((ref, data) => alertWrites.push({ ref, data })),
        commit: vi.fn(async () => ({})),
    };

    function subjectDoc(id) {
        if (!subjectRefs[id]) {
            subjectRefs[id] = makeRef({
                existsInitially: Boolean(subjects[id]),
                initialData: subjects[id] || null,
            });
        }
        return subjectRefs[id];
    }
    function watchlistDoc(id) {
        if (!watchlistRefs[id]) {
            watchlistRefs[id] = makeRef({
                existsInitially: Boolean(watchlists[id]),
                initialData: watchlists[id] || null,
            });
        }
        return watchlistRefs[id];
    }

    const db = {
        batch: () => batch,
        collection: (name) => {
            if (name === 'subjects') {
                return { doc: (id) => subjectDoc(id) };
            }
            if (name === 'watchlists') {
                return { doc: (id) => watchlistDoc(id) };
            }
            if (name === 'cases') {
                return {
                    doc: (id) => ({
                        set: vi.fn(async (payload, opts) => { caseWrites.push({ id, payload, opts }); }),
                    }),
                };
            }
            if (name === 'alerts') {
                return {
                    doc: () => ({ id: `alert-${++autoId}` }),
                };
            }
            if (name === 'riskSignals') {
                return {
                    where: (_field, _op, value) => ({
                        get: vi.fn(async () => ({
                            docs: riskSignals
                                .filter((s) => s.caseId === value)
                                .map((s) => ({ id: s.id, data: () => s })),
                        })),
                    }),
                };
            }
            throw new Error(`unexpected collection ${name}`);
        },
    };

    return { db, subjectRefs, watchlistRefs, caseWrites, alertWrites, batch };
}

describe('normalizeWatchlistData', () => {
    it('applies defaults for missing fields', () => {
        const out = normalizeWatchlistData({});
        expect(out.intervalDays).toBe(30);
        expect(out.modules).toEqual([]);
        expect(out.active).toBe(true);
        expect(out.consecutiveFailures).toBe(0);
    });

    it('preserves provided values', () => {
        const out = normalizeWatchlistData({
            subjectId: 's1',
            tenantId: 't1',
            modules: ['criminal'],
            intervalDays: 7,
            active: false,
            lastSignals: [{ id: 'a' }],
            consecutiveFailures: 2,
        });
        expect(out).toMatchObject({
            subjectId: 's1',
            tenantId: 't1',
            modules: ['criminal'],
            intervalDays: 7,
            active: false,
            consecutiveFailures: 2,
        });
        expect(out.lastSignals).toHaveLength(1);
    });
});

describe('buildPhantomCaseId', () => {
    it('prefixes with wl_ and includes timestamp', () => {
        const id = buildPhantomCaseId('w1', new Date(1700000000000));
        expect(id).toBe('wl_w1_1700000000000');
    });
});

describe('processSingleWatchlist', () => {
    const subjectId = 'subj-1';
    const tenantId = 'tenant-1';
    const baseWatchlist = {
        subjectId,
        tenantId,
        modules: ['criminal'],
        intervalDays: 30,
        active: true,
        lastSignals: [],
    };

    it('skips when subject missing', async () => {
        const { db, watchlistRefs } = makeDb({
            subjects: {},
            watchlists: { 'wl-1': baseWatchlist },
        });
        const pipelineRunner = vi.fn();
        const result = await processSingleWatchlist('wl-1', baseWatchlist, {
            db,
            pipelineRunner,
            now: new Date(2026, 3, 22),
            logger: { log: () => {}, warn: () => {}, error: () => {} },
        });
        expect(result.status).toBe('skipped');
        expect(result.reason).toBe('subject_missing');
        expect(pipelineRunner).not.toHaveBeenCalled();
        expect(watchlistRefs['wl-1'].set).toHaveBeenCalled();
    });

    it('skips when identifiers missing', async () => {
        const { db } = makeDb();
        const result = await processSingleWatchlist('wl-1', { subjectId: null, tenantId: null }, {
            db,
            pipelineRunner: vi.fn(),
            logger: { log: () => {}, warn: () => {}, error: () => {} },
        });
        expect(result.status).toBe('skipped');
        expect(result.reason).toBe('missing_identifiers');
    });

    it('runs pipeline and emits alerts for new signals', async () => {
        const phantomSignal = {
            id: 'sig-1',
            caseId: null, // filled in below
            moduleKey: 'criminal',
            kind: 'criminal_risk',
            severity: 'high',
            reason: 'New criminal finding',
        };
        const fixedNow = new Date(2026, 3, 22);
        const phantomCaseId = buildPhantomCaseId('wl-1', fixedNow);
        phantomSignal.caseId = phantomCaseId;

        const { db, watchlistRefs, alertWrites, caseWrites, batch } = makeDb({
            subjects: { [subjectId]: { cpf: '12345678909', personName: 'Test Person' } },
            watchlists: { 'wl-1': baseWatchlist },
            riskSignals: [phantomSignal],
        });

        const pipelineRunner = vi.fn(async () => ({ ok: true }));

        const result = await processSingleWatchlist('wl-1', baseWatchlist, {
            db,
            pipelineRunner,
            now: fixedNow,
            logger: { log: () => {}, warn: () => {}, error: () => {} },
        });

        expect(result.status).toBe('ok');
        expect(result.alertsCreated).toBe(1);
        expect(result.phantomCaseId).toBe(phantomCaseId);
        expect(pipelineRunner).toHaveBeenCalledWith(phantomCaseId, expect.objectContaining({ subjectId, tenantId, source: 'watchlist' }), expect.objectContaining({ moduleKeys: ['criminal'] }));
        expect(caseWrites).toHaveLength(1);
        expect(caseWrites[0].id).toBe(phantomCaseId);
        expect(caseWrites[0].payload).toMatchObject({ source: 'watchlist', billingCountable: false });
        expect(alertWrites).toHaveLength(1);
        expect(alertWrites[0].data).toMatchObject({
            tenantId,
            subjectId,
            caseId: phantomCaseId,
            watchlistId: 'wl-1',
            kind: 'watchlist_finding',
            severity: 'high',
        });
        expect(batch.commit).toHaveBeenCalled();
        expect(watchlistRefs['wl-1'].set).toHaveBeenCalled();
        const watchlistUpdate = watchlistRefs['wl-1'].set.mock.calls.at(-1)[0];
        expect(watchlistUpdate.lastStatus).toBe('ok');
        expect(watchlistUpdate.lastSignals).toHaveLength(1);
    });

    it('does not emit alerts when signals unchanged', async () => {
        const fixedNow = new Date(2026, 3, 22);
        const phantomCaseId = buildPhantomCaseId('wl-1', fixedNow);
        const previous = [{ id: 'pre-1', moduleKey: 'criminal', kind: 'criminal_risk', severity: 'high' }];
        const current = [{ id: 'cur-1', caseId: phantomCaseId, moduleKey: 'criminal', kind: 'criminal_risk', severity: 'high' }];

        const watchlistData = { ...baseWatchlist, lastSignals: previous };
        const { db, alertWrites } = makeDb({
            subjects: { [subjectId]: {} },
            watchlists: { 'wl-1': watchlistData },
            riskSignals: current,
        });

        const result = await processSingleWatchlist('wl-1', watchlistData, {
            db,
            pipelineRunner: vi.fn(async () => ({})),
            now: fixedNow,
            logger: { log: () => {}, warn: () => {}, error: () => {} },
        });

        expect(result.status).toBe('ok');
        expect(result.alertsCreated).toBe(0);
        expect(alertWrites).toHaveLength(0);
    });

    it('increments consecutiveFailures on pipeline error', async () => {
        const { db, watchlistRefs } = makeDb({
            subjects: { [subjectId]: {} },
            watchlists: { 'wl-1': baseWatchlist },
        });
        const pipelineRunner = vi.fn(async () => { throw new Error('provider_down'); });

        const result = await processSingleWatchlist('wl-1', baseWatchlist, {
            db,
            pipelineRunner,
            now: new Date(2026, 3, 22),
            logger: { log: () => {}, warn: () => {}, error: () => {} },
        });

        expect(result.status).toBe('error');
        const update = watchlistRefs['wl-1'].set.mock.calls.at(-1)[0];
        expect(update.consecutiveFailures).toBe(1);
        expect(update.lastStatus).toBe('error');
        expect(update.lastError).toBe('provider_down');
        expect(update.active).toBeUndefined();
    });

    it('auto-pauses after circuit breaker threshold', async () => {
        const data = { ...baseWatchlist, consecutiveFailures: CIRCUIT_BREAKER_FAILURE_THRESHOLD - 1 };
        const { db, watchlistRefs } = makeDb({
            subjects: { [subjectId]: {} },
            watchlists: { 'wl-1': data },
        });
        const pipelineRunner = vi.fn(async () => { throw new Error('boom'); });

        const result = await processSingleWatchlist('wl-1', data, {
            db,
            pipelineRunner,
            now: new Date(2026, 3, 22),
            logger: { log: () => {}, warn: () => {}, error: () => {} },
        });

        expect(result.status).toBe('auto_paused');
        const update = watchlistRefs['wl-1'].set.mock.calls.at(-1)[0];
        expect(update.active).toBe(false);
        expect(update.consecutiveFailures).toBe(CIRCUIT_BREAKER_FAILURE_THRESHOLD);
        expect(update.lastStatus).toBe('auto_paused');
    });

    it('performs metadata-only update when pipelineRunner missing', async () => {
        const { db, watchlistRefs } = makeDb({
            subjects: { [subjectId]: {} },
            watchlists: { 'wl-1': baseWatchlist },
        });
        const result = await processSingleWatchlist('wl-1', baseWatchlist, {
            db,
            now: new Date(2026, 3, 22),
            logger: { log: () => {}, warn: () => {}, error: () => {} },
        });
        expect(result.status).toBe('scheduled');
        expect(watchlistRefs['wl-1'].set).toHaveBeenCalled();
    });
});

describe('watchlist management callables', () => {
    it('addToWatchlist writes canonical doc', async () => {
        const { db, watchlistRefs } = makeDb();
        const id = await addToWatchlist(
            { subjectId: 'subj', tenantId: 'ten', modules: ['criminal'], intervalDays: 15 },
            { db, now: new Date(2026, 3, 22) },
        );
        expect(id).toBe('wl_subj');
        const payload = watchlistRefs['wl_subj'].set.mock.calls[0][0];
        expect(payload).toMatchObject({
            subjectId: 'subj',
            tenantId: 'ten',
            modules: ['criminal'],
            intervalDays: 15,
            active: true,
            runCount: 0,
            consecutiveFailures: 0,
        });
    });

    it('addToWatchlist throws when subjectId or tenantId missing', async () => {
        const { db } = makeDb();
        await expect(addToWatchlist({}, { db })).rejects.toThrow(/required/);
    });

    it('pauseWatchlist flips active flag', async () => {
        const { db, watchlistRefs } = makeDb({ watchlists: { 'wl-1': { subjectId: 's', tenantId: 't', intervalDays: 30 } } });
        await pauseWatchlist('wl-1', { db });
        const payload = watchlistRefs['wl-1'].set.mock.calls[0][0];
        expect(payload).toMatchObject({ active: false, lastStatus: 'paused' });
    });

    it('resumeWatchlist reschedules with interval', async () => {
        const { db, watchlistRefs } = makeDb({ watchlists: { 'wl-1': { subjectId: 's', tenantId: 't', intervalDays: 10, active: false } } });
        await resumeWatchlist('wl-1', { db, now: new Date(2026, 3, 22) });
        const payload = watchlistRefs['wl-1'].set.mock.calls.at(-1)[0];
        expect(payload.active).toBe(true);
        expect(payload.consecutiveFailures).toBe(0);
        expect(payload.lastStatus).toBe('active');
        expect(payload.nextRunAt).toBeDefined();
    });

    it('resumeWatchlist throws when missing', async () => {
        const { db } = makeDb();
        await expect(resumeWatchlist('missing', { db })).rejects.toThrow(/not found/);
    });

    it('deleteWatchlist deletes doc', async () => {
        const { db, watchlistRefs } = makeDb({ watchlists: { 'wl-1': {} } });
        const result = await deleteWatchlist('wl-1', { db });
        expect(result).toEqual({ watchlistId: 'wl-1', deleted: true });
        expect(watchlistRefs['wl-1'].delete).toHaveBeenCalled();
    });
});
