import { createRequire } from 'node:module';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const require = createRequire(import.meta.url);

const ledgerMocks = vi.hoisted(() => ({
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    collection: vi.fn(),
    doc: vi.fn(),
    serverTimestamp: vi.fn(() => new Date('2026-04-23T00:00:00Z')),
}));

function buildMockDb() {
    const col = {
        doc: ledgerMocks.doc,
        where: ledgerMocks.where,
        orderBy: ledgerMocks.orderBy,
        limit: ledgerMocks.limit,
    };
    return {
        collection: vi.fn(() => col),
    };
}

ledgerMocks.doc.mockReturnValue({
    set: ledgerMocks.setDoc,
    get: ledgerMocks.getDoc,
});

ledgerMocks.where.mockReturnValue({
    where: ledgerMocks.where,
    orderBy: ledgerMocks.orderBy,
    limit: ledgerMocks.limit,
});

ledgerMocks.orderBy.mockReturnValue({
    limit: ledgerMocks.limit,
});

ledgerMocks.limit.mockReturnValue({
    get: ledgerMocks.getDocs,
});

ledgerMocks.getDocs.mockResolvedValue({ empty: true, docs: [] });

const {
    hashRequest,
    buildProviderRequestId,
    createProviderRequest,
    resolveProviderRequest,
    markProviderRequestReused,
    findReusableProviderRequest,
    _setDb,
} = require('./v2ProviderLedger.js');

describe('v2ProviderLedger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _setDb(buildMockDb());
    });

    it('hashRequest returns consistent SHA-256 hex', () => {
        const h1 = hashRequest({ cpf: '48052053854', datasets: 'basic_data' });
        const h2 = hashRequest({ cpf: '48052053854', datasets: 'basic_data' });
        expect(h1).toBe(h2);
        expect(h1).toHaveLength(32);
    });

    it('hashRequest retorna hashes diferentes para queries diferentes', () => {
        const h1 = hashRequest({ cpf: '48052053854', datasets: 'basic_data' });
        const h2 = hashRequest({ cpf: '48052053854', datasets: 'kyc' });
        expect(h1).not.toBe(h2);
    });

    it('buildProviderRequestId includes all parts', () => {
        const id = buildProviderRequestId({
            tenantId: 't1',
            caseId: 'c1',
            provider: 'bigdatacorp',
            dataset: 'combined',
            requestHash: 'abc123',
        });
        expect(id).toContain('t1');
        expect(id).toContain('c1');
        expect(id).toContain('bigdatacorp');
        expect(id).toContain('combined');
        expect(id).toContain('abc123');
    });

    it('buildProviderRequestId sanitiza caracteres invalidos', () => {
        const id = buildProviderRequestId({
            tenantId: 't@1#',
            caseId: 'c$1%',
            provider: 'big/data',
            dataset: 'com+bined',
            requestHash: 'ab/c=123',
        });
        expect(id).not.toContain('@');
        expect(id).not.toContain('#');
        expect(id).not.toContain('$');
        expect(id).not.toContain('%');
        expect(id).not.toContain('/');
        expect(id).not.toContain('=');
        expect(id).not.toContain('+');
    });

    it('createProviderRequest writes pending doc to providerRequests', async () => {
        const result = await createProviderRequest({
            tenantId: 't1',
            caseId: 'c1',
            provider: 'bigdatacorp',
            dataset: 'combined',
            query: { cpf: '48052053854' },
        });
        expect(result.id).toBeTruthy();
        expect(result.doc.status).toBe('pending');
        expect(result.doc.provider).toBe('bigdatacorp');
        expect(ledgerMocks.setDoc).toHaveBeenCalled();
    });

    it('createProviderRequest inclui estimatedCostBRL quando fornecido', async () => {
        const result = await createProviderRequest({
            tenantId: 't1',
            caseId: 'c1',
            provider: 'bigdatacorp',
            dataset: 'combined',
            query: { cpf: '48052053854' },
            estimatedCostBRL: 0.20,
        });
        expect(result.doc.estimatedCostBRL).toBe(0.20);
    });

    it('resolveProviderRequest updates status and cost', async () => {
        await resolveProviderRequest('req_123', {
            status: 'completed',
            actualCostBRL: 0.20,
            rawSnapshotIds: ['snap_1'],
        });
        expect(ledgerMocks.setDoc).toHaveBeenCalled();
        const update = ledgerMocks.setDoc.mock.calls[0][0];
        expect(update.status).toBe('completed');
        expect(update.actualCostBRL).toBe(0.20);
        expect(update.rawSnapshotIds).toEqual(['snap_1']);
    });

    it('resolveProviderRequest aceita status failed com errorCode', async () => {
        await resolveProviderRequest('req_123', {
            status: 'failed',
            errorCode: 'TIMEOUT',
            errorMessage: 'Request timed out',
        });
        const update = ledgerMocks.setDoc.mock.calls[0][0];
        expect(update.status).toBe('failed');
        expect(update.errorCode).toBe('TIMEOUT');
        expect(update.errorMessage).toBe('Request timed out');
    });

    it('markProviderRequestReused marks as reused with reason', async () => {
        await markProviderRequestReused('req_123', { reusedSnapshotId: 'snap_old', reason: 'freshness_valid' });
        expect(ledgerMocks.setDoc).toHaveBeenCalled();
        const update = ledgerMocks.setDoc.mock.calls[0][0];
        expect(update.status).toBe('reused');
        expect(update.reuseReason).toBe('freshness_valid');
        expect(update.reusedSnapshotId).toBe('snap_old');
    });

    it('findReusableProviderRequest retorna null quando nao ha docs', async () => {
        ledgerMocks.getDocs.mockResolvedValue({ empty: true, docs: [] });
        const result = await findReusableProviderRequest({
            tenantId: 't1',
            provider: 'bigdatacorp',
            dataset: 'combined',
            requestHash: 'abc123',
        });
        expect(result).toBeNull();
    });

    it('findReusableProviderRequest retorna doc mais recente quando existe', async () => {
        const mockDoc = {
            id: 'req_recent',
            data: () => ({
                tenantId: 't1',
                provider: 'bigdatacorp',
                dataset: 'combined',
                requestHash: 'abc123',
                status: 'completed',
                rawSnapshotIds: ['snap_1'],
            }),
        };
        ledgerMocks.getDocs.mockResolvedValue({ empty: false, docs: [mockDoc] });
        const result = await findReusableProviderRequest({
            tenantId: 't1',
            provider: 'bigdatacorp',
            dataset: 'combined',
            requestHash: 'abc123',
        });
        expect(result).not.toBeNull();
        expect(result.id).toBe('req_recent');
        expect(result.rawSnapshotIds).toContain('snap_1');
    });

    it('findReusableProviderRequest usa maxAgeMs para filtrar por idade', async () => {
        ledgerMocks.getDocs.mockResolvedValue({ empty: true, docs: [] });
        await findReusableProviderRequest({
            tenantId: 't1',
            provider: 'bigdatacorp',
            dataset: 'combined',
            requestHash: 'abc123',
            maxAgeMs: 3600000,
        });
        expect(ledgerMocks.where).toHaveBeenCalledWith('startedAt', '>=', expect.any(Date));
    });
});
