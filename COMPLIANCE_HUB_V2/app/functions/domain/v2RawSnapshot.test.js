import { createRequire } from 'node:module';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const require = createRequire(import.meta.url);

const snapshotMocks = vi.hoisted(() => ({
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    collection: vi.fn(),
    doc: vi.fn(),
    serverTimestamp: vi.fn(() => new Date('2026-04-23T00:00:00Z')),
}));

function buildMockDb() {
    return {
        collection: snapshotMocks.collection,
    };
}

snapshotMocks.collection.mockReturnValue({
    doc: snapshotMocks.doc,
});

snapshotMocks.doc.mockReturnValue({
    set: snapshotMocks.setDoc,
    get: snapshotMocks.getDoc,
});

const {
    computePayloadHash,
    buildRawSnapshotId,
    createRawSnapshot,
    getRawSnapshot,
    markSnapshotInStorage,
    _setDb,
} = require('./v2RawSnapshot.js');

describe('v2RawSnapshot', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _setDb(buildMockDb());
    });

    it('computePayloadHash returns consistent SHA-256', () => {
        const h1 = computePayloadHash({ foo: 'bar' });
        const h2 = computePayloadHash({ foo: 'bar' });
        expect(h1).toBe(h2);
        expect(h1).toHaveLength(64);
    });

    it('computePayloadHash retorna hashes diferentes para payloads diferentes', () => {
        const h1 = computePayloadHash({ foo: 'bar' });
        const h2 = computePayloadHash({ foo: 'baz' });
        expect(h1).not.toBe(h2);
    });

    it('buildRawSnapshotId includes requestId and timestamp', () => {
        const id = buildRawSnapshotId('req_123', 1234567890);
        expect(id).toContain('req_123');
        expect(id).toContain('1234567890');
    });

    it('createRawSnapshot stores payload inline when small', async () => {
        const result = await createRawSnapshot({
            tenantId: 't1',
            caseId: 'c1',
            providerRequestId: 'req_123',
            provider: 'bigdatacorp',
            endpoint: '/pessoas',
            datasets: ['basic_data'],
            payload: { Result: [{ BasicData: { Name: 'Test' } }] },
        });
        expect(result.id).toBeTruthy();
        expect(result.isOversized).toBe(false);
        expect(result.doc.payload).toBeDefined();
        expect(snapshotMocks.setDoc).toHaveBeenCalled();
    });

    it('createRawSnapshot marks as oversized when payload > limit', async () => {
        const hugePayload = { data: 'x'.repeat(1000000) };
        const result = await createRawSnapshot({
            tenantId: 't1',
            caseId: 'c1',
            providerRequestId: 'req_123',
            provider: 'bigdatacorp',
            payload: hugePayload,
        });
        expect(result.isOversized).toBe(true);
        expect(result.doc.payload).toBeNull();
    });

    it('createRawSnapshot inclui todos os metadados', async () => {
        const result = await createRawSnapshot({
            tenantId: 't1',
            caseId: 'c1',
            subjectId: 'sub_1',
            providerRequestId: 'req_123',
            provider: 'bigdatacorp',
            endpoint: '/pessoas',
            datasets: ['basic_data', 'processes'],
            payload: { foo: 'bar' },
            queriedAt: '2026-04-23T10:00:00Z',
        });
        expect(result.doc.tenantId).toBe('t1');
        expect(result.doc.caseId).toBe('c1');
        expect(result.doc.subjectId).toBe('sub_1');
        expect(result.doc.providerRequestId).toBe('req_123');
        expect(result.doc.provider).toBe('bigdatacorp');
        expect(result.doc.endpoint).toBe('/pessoas');
        expect(result.doc.datasets).toEqual(['basic_data', 'processes']);
        expect(result.doc.queriedAt).toBe('2026-04-23T10:00:00Z');
    });

    it('getRawSnapshot returns doc data', async () => {
        snapshotMocks.getDoc.mockResolvedValue({
            exists: true,
            id: 'snap_1',
            data: () => ({ provider: 'bigdatacorp', payloadHash: 'abc' }),
        });
        const result = await getRawSnapshot('snap_1');
        expect(result.id).toBe('snap_1');
        expect(result.provider).toBe('bigdatacorp');
    });

    it('getRawSnapshot returns null quando doc nao existe', async () => {
        snapshotMocks.getDoc.mockResolvedValue({
            exists: false,
            id: 'snap_missing',
            data: () => null,
        });
        const result = await getRawSnapshot('snap_missing');
        expect(result).toBeNull();
    });

    it('markSnapshotInStorage updates storageRef', async () => {
        await markSnapshotInStorage('snap_1', 'gs://bucket/path.json');
        expect(snapshotMocks.setDoc).toHaveBeenCalled();
        const update = snapshotMocks.setDoc.mock.calls[0][0];
        expect(update.storageRef).toBe('gs://bucket/path.json');
        expect(update.storedInFirestore).toBe(false);
    });
});
