'use strict';

const RAW_PAYLOAD_RETENTION_POLICY = 'raw_payload_180d';
const RAW_PAYLOAD_VISIBILITY = 'restricted_raw';

function stripStorageOnlyFields(snapshot = {}) {
    const { storagePayload: _storagePayload, ...rest } = snapshot;
    return rest;
}

function normalizeRawSnapshotMetadata(snapshot = {}) {
    return {
        ...stripStorageOnlyFields(snapshot),
        retentionPolicy: snapshot.retentionPolicy || RAW_PAYLOAD_RETENTION_POLICY,
        visibility: snapshot.visibility || RAW_PAYLOAD_VISIBILITY,
        payloadSize: Number(snapshot.payloadSize || 0),
    };
}

async function persistRawPayloadObject({ bucket, path, payload, metadata = {} }) {
    if (!bucket || typeof bucket.file !== 'function') {
        throw new Error('persistRawPayloadObject: bucket with file(path) is required.');
    }
    if (!path) throw new Error('persistRawPayloadObject: path is required.');
    if (payload === undefined || payload === null) {
        throw new Error('persistRawPayloadObject: payload is required.');
    }

    const body = JSON.stringify(payload);
    const file = bucket.file(path);
    await file.save(body, {
        resumable: false,
        contentType: 'application/json',
        metadata: {
            cacheControl: 'private, max-age=0, no-transform',
            metadata: {
                tenantId: metadata.tenantId || '',
                caseId: metadata.caseId || '',
                provider: metadata.provider || '',
                moduleKey: metadata.moduleKey || '',
                payloadHash: metadata.payloadHash || '',
                retentionPolicy: metadata.retentionPolicy || RAW_PAYLOAD_RETENTION_POLICY,
                visibility: metadata.visibility || RAW_PAYLOAD_VISIBILITY,
            },
        },
    });
    return { path, size: body.length };
}

async function persistRawSnapshotPayloads(rawSnapshots = [], options = {}) {
    const { bucket, logger = console } = options;
    const persisted = [];

    for (const snapshot of rawSnapshots) {
        const normalized = normalizeRawSnapshotMetadata(snapshot);
        const storagePayload = snapshot.storagePayload;

        if (!normalized.payloadRef) {
            persisted.push(normalized);
            continue;
        }

        if (storagePayload === undefined || storagePayload === null) {
            persisted.push({
                ...normalized,
                payloadStorageStatus: 'missing_payload_candidate',
            });
            continue;
        }

        try {
            const result = await persistRawPayloadObject({
                bucket,
                path: normalized.payloadRef,
                payload: storagePayload,
                metadata: normalized,
            });
            persisted.push({
                ...normalized,
                payload: null,
                payloadSize: normalized.payloadSize || result.size,
                payloadStorageStatus: 'stored',
            });
        } catch (err) {
            logger.warn?.('persistRawSnapshotPayloads failed', {
                rawSnapshotId: normalized.id,
                payloadRef: normalized.payloadRef,
                error: err?.message || String(err),
            });
            persisted.push({
                ...normalized,
                payload: null,
                payloadStorageStatus: 'failed',
                payloadStorageError: err?.message || String(err),
            });
        }
    }

    return persisted;
}

module.exports = {
    RAW_PAYLOAD_RETENTION_POLICY,
    RAW_PAYLOAD_VISIBILITY,
    normalizeRawSnapshotMetadata,
    persistRawPayloadObject,
    persistRawSnapshotPayloads,
};
