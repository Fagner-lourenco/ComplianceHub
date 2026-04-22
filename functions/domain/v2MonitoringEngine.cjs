'use strict';

const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { diffRiskSignals } = require('./v2MonitoringDiff.cjs');

let _db;
function defaultDb() {
    if (!_db) _db = getFirestore();
    return _db;
}

const WATCHLIST_BATCH_LIMIT = 100;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

function addDays(base, days) {
    const out = new Date(base.getTime());
    out.setDate(out.getDate() + Number(days || 0));
    return out;
}

function buildPhantomCaseId(watchlistId, runAt) {
    const ts = runAt instanceof Date ? runAt.getTime() : Date.now();
    return `wl_${watchlistId}_${ts}`;
}

function normalizeWatchlistData(data = {}) {
    return {
        subjectId: data.subjectId || null,
        tenantId: data.tenantId || null,
        modules: Array.isArray(data.modules) ? data.modules : [],
        intervalDays: Number(data.intervalDays) > 0 ? Number(data.intervalDays) : 30,
        active: data.active !== false,
        lastSignals: Array.isArray(data.lastSignals) ? data.lastSignals : [],
        consecutiveFailures: Number(data.consecutiveFailures || 0),
    };
}

async function processWatchlists(options = {}) {
    const {
        db = defaultDb(),
        pipelineRunner,
        now = new Date(),
        logger = console,
    } = options;

    logger.log('v2MonitoringEngine: Starting watchlist processing cycle...');

    const snapshot = await db.collection('watchlists')
        .where('active', '==', true)
        .where('nextRunAt', '<=', now)
        .limit(WATCHLIST_BATCH_LIMIT)
        .get();

    if (snapshot.empty) {
        logger.log('v2MonitoringEngine: No watchlists due for processing.');
        return { processed: 0, alertsCreated: 0, failures: 0 };
    }

    const outcomes = [];
    for (const doc of snapshot.docs) {
        try {
            const outcome = await processSingleWatchlist(doc.id, doc.data(), {
                db,
                pipelineRunner,
                now,
                logger,
            });
            outcomes.push(outcome);
        } catch (err) {
            logger.error(`v2MonitoringEngine: watchlist ${doc.id} failed`, err);
            outcomes.push({ watchlistId: doc.id, status: 'error', error: err?.message || String(err) });
        }
    }

    const alertsCreated = outcomes.reduce((sum, o) => sum + (o.alertsCreated || 0), 0);
    const failures = outcomes.filter((o) => o.status === 'error' || o.status === 'auto_paused').length;

    logger.log(`v2MonitoringEngine: cycle done. processed=${outcomes.length} alerts=${alertsCreated} failures=${failures}`);
    return { processed: outcomes.length, alertsCreated, failures, outcomes };
}

async function processSingleWatchlist(watchlistId, rawData, options = {}) {
    const {
        db = defaultDb(),
        pipelineRunner,
        now = new Date(),
        logger = console,
    } = options;

    const data = normalizeWatchlistData(rawData);
    if (!data.subjectId || !data.tenantId) {
        logger.warn(`v2MonitoringEngine: watchlist ${watchlistId} missing subjectId/tenantId`);
        return { watchlistId, status: 'skipped', reason: 'missing_identifiers', alertsCreated: 0 };
    }
    if (typeof pipelineRunner !== 'function') {
        logger.warn(`v2MonitoringEngine: watchlist ${watchlistId} has no pipelineRunner; metadata-only update`);
        await db.collection('watchlists').doc(watchlistId).set({
            lastRunAt: FieldValue.serverTimestamp(),
            nextRunAt: Timestamp.fromDate(addDays(now, data.intervalDays)),
            runCount: FieldValue.increment(1),
        }, { merge: true });
        return { watchlistId, status: 'scheduled', alertsCreated: 0 };
    }

    const watchlistRef = db.collection('watchlists').doc(watchlistId);

    try {
        const subjectSnap = await db.collection('subjects').doc(data.subjectId).get();
        if (!subjectSnap.exists) {
            await watchlistRef.set({
                lastRunAt: FieldValue.serverTimestamp(),
                nextRunAt: Timestamp.fromDate(addDays(now, data.intervalDays)),
                runCount: FieldValue.increment(1),
                lastStatus: 'subject_missing',
            }, { merge: true });
            return { watchlistId, status: 'skipped', reason: 'subject_missing', alertsCreated: 0 };
        }
        const subject = subjectSnap.data() || {};

        const phantomCaseId = buildPhantomCaseId(watchlistId, now);
        const casePayload = {
            id: phantomCaseId,
            tenantId: data.tenantId,
            subjectId: data.subjectId,
            source: 'watchlist',
            watchlistId,
            status: 'RUNNING',
            productKey: subject.productKey || 'dossier_pf',
            requestedModuleKeys: data.modules,
            effectiveModuleKeys: data.modules,
            createdAt: FieldValue.serverTimestamp(),
            requestedAt: FieldValue.serverTimestamp(),
            billingCountable: false,
            cpf: subject.cpf || null,
            cnpj: subject.cnpj || null,
            personName: subject.personName || subject.fullName || null,
        };

        await db.collection('cases').doc(phantomCaseId).set(casePayload, { merge: true });

        const runnerCaseData = { ...casePayload, createdAt: now, requestedAt: now };
        await pipelineRunner(phantomCaseId, runnerCaseData, { moduleKeys: data.modules });

        const signalsSnap = await db.collection('riskSignals')
            .where('caseId', '==', phantomCaseId)
            .get();
        const currentSignals = signalsSnap.docs.map((d) => d.data());

        const alerts = diffRiskSignals({
            previousSignals: data.lastSignals,
            currentSignals,
            context: {
                tenantId: data.tenantId,
                subjectId: data.subjectId,
                caseId: phantomCaseId,
                watchlistId,
            },
        });

        let alertsCreated = 0;
        if (alerts.length > 0) {
            const batch = db.batch();
            for (const alert of alerts) {
                const alertRef = db.collection('alerts').doc();
                batch.set(alertRef, {
                    ...alert,
                    id: alertRef.id,
                    createdAt: FieldValue.serverTimestamp(),
                });
            }
            await batch.commit();
            alertsCreated = alerts.length;
        }

        await watchlistRef.set({
            lastRunAt: FieldValue.serverTimestamp(),
            nextRunAt: Timestamp.fromDate(addDays(now, data.intervalDays)),
            runCount: FieldValue.increment(1),
            lastPhantomCaseId: phantomCaseId,
            lastStatus: 'ok',
            lastSignals: currentSignals.map((s) => ({
                id: s.id || null,
                moduleKey: s.moduleKey || null,
                kind: s.kind || null,
                severity: s.severity || null,
            })),
            lastAlertAt: alertsCreated > 0 ? FieldValue.serverTimestamp() : (rawData.lastAlertAt || null),
            consecutiveFailures: 0,
        }, { merge: true });

        return { watchlistId, status: 'ok', alertsCreated, phantomCaseId };
    } catch (err) {
        const nextFailures = data.consecutiveFailures + 1;
        const shouldAutoPause = nextFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD;
        await watchlistRef.set({
            lastRunAt: FieldValue.serverTimestamp(),
            nextRunAt: Timestamp.fromDate(addDays(now, data.intervalDays)),
            runCount: FieldValue.increment(1),
            consecutiveFailures: nextFailures,
            lastStatus: shouldAutoPause ? 'auto_paused' : 'error',
            lastError: err?.message || String(err),
            ...(shouldAutoPause ? { active: false, autoPausedAt: FieldValue.serverTimestamp() } : {}),
        }, { merge: true });

        logger.error(`v2MonitoringEngine: watchlist ${watchlistId} error`, err);
        return {
            watchlistId,
            status: shouldAutoPause ? 'auto_paused' : 'error',
            alertsCreated: 0,
            error: err?.message || String(err),
        };
    }
}

async function addToWatchlist({ subjectId, tenantId, modules = [], intervalDays = 30 }, options = {}) {
    const { db = defaultDb(), now = new Date() } = options;
    if (!subjectId || !tenantId) {
        throw new Error('addToWatchlist: subjectId and tenantId are required.');
    }
    const watchlistId = `wl_${subjectId}`;
    const effectiveInterval = Number(intervalDays) > 0 ? Number(intervalDays) : 30;
    const nextRun = addDays(now, effectiveInterval);
    await db.collection('watchlists').doc(watchlistId).set({
        subjectId,
        tenantId,
        modules,
        intervalDays: effectiveInterval,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        lastRunAt: null,
        nextRunAt: Timestamp.fromDate(nextRun),
        runCount: 0,
        lastSignals: [],
        consecutiveFailures: 0,
    }, { merge: true });
    return watchlistId;
}

async function pauseWatchlist(watchlistId, options = {}) {
    const { db = defaultDb() } = options;
    await db.collection('watchlists').doc(watchlistId).set({
        active: false,
        pausedAt: FieldValue.serverTimestamp(),
        lastStatus: 'paused',
    }, { merge: true });
    return { watchlistId, active: false };
}

async function resumeWatchlist(watchlistId, options = {}) {
    const { db = defaultDb(), now = new Date() } = options;
    const ref = db.collection('watchlists').doc(watchlistId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new Error(`Watchlist ${watchlistId} not found.`);
    }
    const data = normalizeWatchlistData(snap.data());
    await ref.set({
        active: true,
        resumedAt: FieldValue.serverTimestamp(),
        consecutiveFailures: 0,
        nextRunAt: Timestamp.fromDate(addDays(now, data.intervalDays)),
        lastStatus: 'active',
    }, { merge: true });
    return { watchlistId, active: true };
}

async function deleteWatchlist(watchlistId, options = {}) {
    const { db = defaultDb() } = options;
    await db.collection('watchlists').doc(watchlistId).delete();
    return { watchlistId, deleted: true };
}

module.exports = {
    processWatchlists,
    processSingleWatchlist,
    addToWatchlist,
    pauseWatchlist,
    resumeWatchlist,
    deleteWatchlist,
    normalizeWatchlistData,
    buildPhantomCaseId,
    toDate,
    addDays,
    CIRCUIT_BREAKER_FAILURE_THRESHOLD,
};
