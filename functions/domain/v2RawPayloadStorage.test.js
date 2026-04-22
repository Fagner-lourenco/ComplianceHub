import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    RAW_PAYLOAD_RETENTION_POLICY,
    RAW_PAYLOAD_VISIBILITY,
    normalizeRawSnapshotMetadata,
    persistRawPayloadObject,
    persistRawSnapshotPayloads,
} = require('./v2RawPayloadStorage.cjs');

function createFakeBucket() {
    const save = vi.fn().mockResolvedValue(undefined);
    return {
        save,
        bucket: {
            file: vi.fn(() => ({ save })),
        },
    };
}

describe('v2RawPayloadStorage', () => {
    it('normaliza metadata e remove storagePayload antes de persistir no Firestore', () => {
        const normalized = normalizeRawSnapshotMetadata({
            id: 'snap-1',
            tenantId: 'tenant-1',
            payloadSize: '42',
            storagePayload: { secret: true },
        });

        expect(normalized.storagePayload).toBeUndefined();
        expect(normalized.retentionPolicy).toBe(RAW_PAYLOAD_RETENTION_POLICY);
        expect(normalized.visibility).toBe(RAW_PAYLOAD_VISIBILITY);
        expect(normalized.payloadSize).toBe(42);
    });

    it('grava payload bruto no bucket com metadata restrita', async () => {
        const { bucket, save } = createFakeBucket();

        const result = await persistRawPayloadObject({
            bucket,
            path: 'raw_snapshots/snap-1.json',
            payload: { hello: 'world' },
            metadata: {
                tenantId: 'tenant-1',
                caseId: 'case-1',
                provider: 'bigdatacorp',
                moduleKey: 'identity_pf',
                payloadHash: 'hash-1',
            },
        });

        expect(bucket.file).toHaveBeenCalledWith('raw_snapshots/snap-1.json');
        expect(save).toHaveBeenCalledWith(JSON.stringify({ hello: 'world' }), expect.objectContaining({
            resumable: false,
            contentType: 'application/json',
        }));
        expect(save.mock.calls[0][1].metadata.metadata).toEqual(expect.objectContaining({
            tenantId: 'tenant-1',
            caseId: 'case-1',
            provider: 'bigdatacorp',
            moduleKey: 'identity_pf',
            payloadHash: 'hash-1',
            retentionPolicy: RAW_PAYLOAD_RETENTION_POLICY,
            visibility: RAW_PAYLOAD_VISIBILITY,
        }));
        expect(result.size).toBe(JSON.stringify({ hello: 'world' }).length);
    });

    it('mantem payload pequeno inline e externaliza payload grande com payloadRef', async () => {
        const { bucket, save } = createFakeBucket();
        const snapshots = await persistRawSnapshotPayloads([
            {
                id: 'snap-small',
                tenantId: 'tenant-1',
                payload: { small: true },
                payloadRef: null,
                payloadSize: 14,
            },
            {
                id: 'snap-large',
                tenantId: 'tenant-1',
                caseId: 'case-1',
                provider: 'bigdatacorp',
                moduleKey: 'judicial',
                payload: null,
                payloadRef: 'raw_snapshots/snap-large.json',
                payloadSize: 1024,
                storagePayload: { large: 'payload' },
            },
        ], { bucket });

        expect(snapshots[0]).toEqual(expect.objectContaining({
            id: 'snap-small',
            payload: { small: true },
            payloadRef: null,
            visibility: RAW_PAYLOAD_VISIBILITY,
        }));
        expect(snapshots[1]).toEqual(expect.objectContaining({
            id: 'snap-large',
            payload: null,
            payloadRef: 'raw_snapshots/snap-large.json',
            payloadStorageStatus: 'stored',
        }));
        expect(snapshots[1].storagePayload).toBeUndefined();
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('marca ausencia de candidato de storage sem expor campo temporario', async () => {
        const snapshots = await persistRawSnapshotPayloads([
            {
                id: 'snap-missing',
                tenantId: 'tenant-1',
                payloadRef: 'raw_snapshots/snap-missing.json',
                payload: null,
            },
        ]);

        expect(snapshots[0]).toEqual(expect.objectContaining({
            id: 'snap-missing',
            payloadStorageStatus: 'missing_payload_candidate',
        }));
        expect(snapshots[0].storagePayload).toBeUndefined();
    });
});
