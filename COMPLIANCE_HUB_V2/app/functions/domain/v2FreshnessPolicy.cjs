'use strict';

// TTL in days per module type. Determines when a rawSnapshot is considered stale.
const FRESHNESS_TTL_DAYS = {
    identity: 30,
    criminal: 7,
    labor: 14,
    warrant: 1,
    osint: 7,
    social: 14,
    digital: 14,
    credit: 7,
    sanctions: 1,
    pep: 1,
    // premium
    watchlist: 1,
    relationship_graph: 30,
    adverse_media: 3,
};

const DEFAULT_TTL_DAYS = 7;
const MS_PER_DAY = 86_400_000;

function getFreshnessPolicy(moduleKey) {
    const ttlDays = FRESHNESS_TTL_DAYS[moduleKey] ?? DEFAULT_TTL_DAYS;
    return { moduleKey, ttlDays, ttlMs: ttlDays * MS_PER_DAY };
}

function isSnapshotFresh(snapshot, moduleKey, nowMs = Date.now()) {
    if (!snapshot) return false;

    const { ttlMs } = getFreshnessPolicy(moduleKey);

    let capturedAtMs = null;
    if (snapshot.capturedAt) {
        const ts = snapshot.capturedAt;
        capturedAtMs = ts.seconds != null ? ts.seconds * 1000 : new Date(ts).getTime();
    } else if (snapshot.createdAt) {
        const ts = snapshot.createdAt;
        capturedAtMs = ts.seconds != null ? ts.seconds * 1000 : new Date(ts).getTime();
    }

    if (capturedAtMs == null || Number.isNaN(capturedAtMs)) return false;
    return (nowMs - capturedAtMs) <= ttlMs;
}

function shouldReuseSnapshot(snapshot, moduleKey, nowMs = Date.now()) {
    if (!snapshot) return false;
    if (snapshot.status === 'ERROR' || snapshot.status === 'PENDING') return false;
    return isSnapshotFresh(snapshot, moduleKey, nowMs);
}

module.exports = {
    FRESHNESS_TTL_DAYS,
    DEFAULT_TTL_DAYS,
    getFreshnessPolicy,
    isSnapshotFresh,
    shouldReuseSnapshot,
};
