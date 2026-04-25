'use strict';

/**
 * Provider Ledger — tracks every provider request for audit, billing, and replay.
 *
 * Each query to a provider (BigDataCorp, Judit, Escavador, etc.) creates a
 * ProviderRequest document. The raw response is stored separately in rawSnapshots.
 *
 * Principles:
 * - Every provider call must be logged.
 * - The ledger is the source of truth for "what was asked, when, and what it cost".
 * - Raw snapshots are immutable after creation.
 * - Client never sees provider names; only sees normalized evidence.
 */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

let _overrideDb = null;

function getDb() {
    return _overrideDb || getFirestore();
}

function _setDb(mockDb) {
    _overrideDb = mockDb;
}

const PROVIDER_LEDGER_VERSION = 'v2-provider-ledger-2026-04-23';

function buildProviderRequestId({ tenantId, caseId, provider, dataset, requestHash }) {
    const parts = [provider, dataset, requestHash || 'unknown'];
    if (caseId) parts.unshift(caseId);
    if (tenantId) parts.unshift(tenantId);
    return parts.join('_').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 256);
}

function hashRequest({ cpf, cnpj, datasets, query }) {
    const crypto = require('crypto');
    const payload = JSON.stringify({ cpf, cnpj, datasets, query });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

/**
 * Create a ProviderRequest record before calling the provider.
 * Returns the doc ID so the caller can update it after the response arrives.
 */
async function createProviderRequest({
    tenantId,
    caseId,
    subjectId,
    provider,
    dataset,
    query,
    estimatedCostBRL = null,
    requestedBy = 'system',
} = {}) {
    const requestHash = hashRequest(query || {});
    const id = buildProviderRequestId({ tenantId, caseId, provider, dataset, requestHash });

    const doc = {
        id,
        tenantId: tenantId || null,
        caseId: caseId || null,
        subjectId: subjectId || null,
        provider,
        dataset: dataset || 'combined',
        query: query || null,
        requestHash,
        status: 'pending',
        startedAt: FieldValue.serverTimestamp(),
        finishedAt: null,
        errorCode: null,
        errorMessage: null,
        estimatedCostBRL,
        actualCostBRL: null,
        rawSnapshotIds: [],
        version: PROVIDER_LEDGER_VERSION,
        requestedBy,
    };

    await getDb().collection('providerRequests').doc(id).set(doc, { merge: true });
    return { id, doc };
}

/**
 * Update a ProviderRequest after the provider responds.
 */
async function resolveProviderRequest(requestId, {
    status = 'completed',
    actualCostBRL = null,
    rawSnapshotIds = [],
    errorCode = null,
    errorMessage = null,
} = {}) {
    const update = {
        status,
        finishedAt: FieldValue.serverTimestamp(),
        actualCostBRL,
        rawSnapshotIds: rawSnapshotIds.length > 0 ? rawSnapshotIds : [],
        errorCode,
        errorMessage,
        updatedAt: FieldValue.serverTimestamp(),
    };

    await getDb().collection('providerRequests').doc(requestId).set(update, { merge: true });
}

/**
 * Mark a provider request as reused (snapshot valid, no new call made).
 */
async function markProviderRequestReused(requestId, { reusedSnapshotId, reason = 'freshness_valid' } = {}) {
    await getDb().collection('providerRequests').doc(requestId).set({
        status: 'reused',
        reusedSnapshotId,
        reuseReason: reason,
        finishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

/**
 * Find a recent provider request for the same query that has a valid raw snapshot.
 * Used for freshness-based reuse.
 */
async function findReusableProviderRequest({ tenantId, provider, dataset, requestHash, maxAgeMs = 86400000 } = {}) {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const query = getDb().collection('providerRequests')
        .where('tenantId', '==', tenantId || null)
        .where('provider', '==', provider)
        .where('dataset', '==', dataset)
        .where('requestHash', '==', requestHash)
        .where('status', 'in', ['completed', 'reused'])
        .where('startedAt', '>=', cutoff)
        .orderBy('startedAt', 'desc')
        .limit(1);

    const snap = await query.get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...(doc.data() || {}) };
}

module.exports = {
    PROVIDER_LEDGER_VERSION,
    buildProviderRequestId,
    hashRequest,
    createProviderRequest,
    resolveProviderRequest,
    markProviderRequestReused,
    findReusableProviderRequest,
    _setDb,
};
