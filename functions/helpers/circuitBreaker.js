/**
 * Circuit Breaker for external API providers (Judit, Escavador, FonteData).
 *
 * Uses Firestore collection `systemHealth/{providerId}` to track failures.
 * Cloud Functions are stateless, so state must be persisted.
 *
 * States:
 *   CLOSED  — normal operation (failCount < threshold)
 *   OPEN    — circuit tripped, calls rejected until disabledUntil
 *   HALF    — disabledUntil has passed, next call is a probe
 *
 * Thresholds are configurable per provider via PROVIDER_DEFAULTS.
 */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const COLLECTION = 'systemHealth';

const PROVIDER_DEFAULTS = {
    judit:      { maxFails: 5, cooldownMs: 10 * 60 * 1000 },
    escavador:  { maxFails: 5, cooldownMs: 10 * 60 * 1000 },
    fontedata:  { maxFails: 5, cooldownMs: 10 * 60 * 1000 },
    openai:     { maxFails: 3, cooldownMs:  5 * 60 * 1000 },
};

/**
 * Check if a provider's circuit is open (calls should be skipped).
 * Returns { open, reason } — open=true means skip the call.
 */
async function checkCircuit(providerId) {
    const db = getFirestore();
    const ref = db.collection(COLLECTION).doc(providerId);
    const snap = await ref.get();

    if (!snap.exists) return { open: false };

    const data = snap.data();
    const defaults = PROVIDER_DEFAULTS[providerId] || { maxFails: 5, cooldownMs: 600000 };

    if (data.disabledUntil && data.disabledUntil.toDate() > new Date()) {
        return {
            open: true,
            reason: `Circuit OPEN for ${providerId}: ${data.failCount} consecutive failures. Resets at ${data.disabledUntil.toDate().toISOString()}.`,
        };
    }

    // If disabledUntil has passed, the circuit is HALF-OPEN — allow the call (probe)
    if (data.disabledUntil && data.disabledUntil.toDate() <= new Date()) {
        return { open: false, halfOpen: true };
    }

    if ((data.failCount || 0) >= defaults.maxFails) {
        return {
            open: true,
            reason: `Circuit OPEN for ${providerId}: ${data.failCount} consecutive failures (threshold: ${defaults.maxFails}).`,
        };
    }

    return { open: false };
}

/**
 * Record a successful call — resets the failure counter.
 */
async function recordSuccess(providerId) {
    const db = getFirestore();
    const ref = db.collection(COLLECTION).doc(providerId);
    await ref.set({
        providerId,
        failCount: 0,
        lastSuccess: FieldValue.serverTimestamp(),
        disabledUntil: null,
        lastError: null,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Record a failed call — increments failure count, may trip the circuit.
 */
async function recordFailure(providerId, errorMessage) {
    const db = getFirestore();
    const ref = db.collection(COLLECTION).doc(providerId);
    const defaults = PROVIDER_DEFAULTS[providerId] || { maxFails: 5, cooldownMs: 600000 };

    const snap = await ref.get();
    const current = snap.exists ? snap.data() : {};
    const newFailCount = (current.failCount || 0) + 1;

    const update = {
        providerId,
        failCount: newFailCount,
        lastFailure: FieldValue.serverTimestamp(),
        lastError: (errorMessage || '').slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (newFailCount >= defaults.maxFails) {
        update.disabledUntil = new Date(Date.now() + defaults.cooldownMs);
    }

    await ref.set(update, { merge: true });
}

module.exports = {
    checkCircuit,
    recordSuccess,
    recordFailure,
    PROVIDER_DEFAULTS,
    COLLECTION,
};
