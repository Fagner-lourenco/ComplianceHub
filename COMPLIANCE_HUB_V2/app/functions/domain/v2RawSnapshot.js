'use strict';

/**
 * Raw Snapshot — immutable storage of provider responses.
 *
 * Principles:
 * - Raw payload NEVER goes to the client.
 * - Snapshots are immutable after creation (new query = new snapshot).
 * - Heavy payloads can be stored in Cloud Storage with metadata in Firestore.
 * - Each snapshot links back to a ProviderRequest for audit.
 */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

let _overrideDb = null;

function getDb() {
    return _overrideDb || getFirestore();
}

function _setDb(mockDb) {
    _overrideDb = mockDb;
}

const RAW_SNAPSHOT_VERSION = 'v2-raw-snapshot-2026-04-23';
const MAX_FIRESTORE_DOC_SIZE_BYTES = 900000; // ~900KB safety margin (limit is 1MB)

function buildRawSnapshotId(providerRequestId, timestamp = Date.now()) {
    return `raw_${providerRequestId}_${timestamp}`;
}

function computePayloadHash(payload) {
    const crypto = require('crypto');
    const json = JSON.stringify(payload);
    return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Create a raw snapshot from a provider response.
 *
 * If the payload exceeds Firestore limits, it stores a pointer/placeholder
 * and the caller is responsible for uploading to Cloud Storage.
 */
async function createRawSnapshot({
    tenantId,
    caseId,
    subjectId,
    providerRequestId,
    provider,
    endpoint,
    datasets,
    payload,
    queriedAt = new Date().toISOString(),
} = {}) {
    const payloadHash = computePayloadHash(payload);
    const id = buildRawSnapshotId(providerRequestId, Date.now());

    const jsonSize = JSON.stringify(payload).length;
    const isOversized = jsonSize > MAX_FIRESTORE_DOC_SIZE_BYTES;

    const doc = {
        id,
        tenantId: tenantId || null,
        caseId: caseId || null,
        subjectId: subjectId || null,
        providerRequestId: providerRequestId || null,
        provider,
        endpoint: endpoint || null,
        datasets: datasets || [],
        payloadHash,
        queriedAt,
        createdAt: FieldValue.serverTimestamp(),
        version: RAW_SNAPSHOT_VERSION,
        isOversized,
        // Only store payload inline if it fits; otherwise caller must store in Storage
        payload: isOversized ? null : payload,
        storageRef: isOversized ? null : null, // populated later if stored in Storage
    };

    await getDb().collection('rawSnapshots').doc(id).set(doc);
    return { id, doc, isOversized, jsonSize };
}

/**
 * Retrieve a raw snapshot by ID.
 * If the snapshot is oversized, returns metadata only (caller fetches from Storage).
 */
async function getRawSnapshot(snapshotId) {
    const snap = await getDb().collection('rawSnapshots').doc(snapshotId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() || {}) };
}

/**
 * Mark a snapshot as stored in Cloud Storage.
 */
async function markSnapshotInStorage(snapshotId, storagePath) {
    await getDb().collection('rawSnapshots').doc(snapshotId).set({
        storageRef: storagePath,
        storedInFirestore: false,
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

module.exports = {
    RAW_SNAPSHOT_VERSION,
    MAX_FIRESTORE_DOC_SIZE_BYTES,
    buildRawSnapshotId,
    computePayloadHash,
    createRawSnapshot,
    getRawSnapshot,
    markSnapshotInStorage,
    _setDb,
};
