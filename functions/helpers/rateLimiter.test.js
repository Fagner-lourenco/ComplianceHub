import { describe, expect, it, vi, beforeEach } from 'vitest';

const { checkRateLimit, _setTestDb } = require('./rateLimiter');

describe('rateLimiter', () => {
    let mockSet;
    let mockGet;
    let mockDoc;
    let mockCollection;
    let mockRunTransaction;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSet = vi.fn();
        mockGet = vi.fn();
        mockDoc = vi.fn(() => ({ get: mockGet, set: mockSet }));
        mockCollection = vi.fn(() => ({ doc: mockDoc }));
        mockRunTransaction = vi.fn();

        const mockDb = {
            collection: mockCollection,
            runTransaction: mockRunTransaction,
        };

        _setTestDb(mockDb);
    });

    function setupMockTransaction(requests = [], exists = false) {
        mockRunTransaction.mockImplementation(async (fn) => {
            const mockTx = {
                get: vi.fn().mockResolvedValue({
                    exists,
                    data: () => ({ requests }),
                }),
                set: mockSet,
            };
            return fn(mockTx);
        });
    }

    it('permite requisições dentro do limite', async () => {
        setupMockTransaction([], false);

        // 3 requisições devem ser permitidas
        await checkRateLimit('user123', { maxRequests: 3, windowMs: 60000 });
        await checkRateLimit('user123', { maxRequests: 3, windowMs: 60000 });
        await checkRateLimit('user123', { maxRequests: 3, windowMs: 60000 });

        expect(mockRunTransaction).toHaveBeenCalledTimes(3);
    });

    it('rejeita 4ª requisição com RATE_LIMIT_EXCEEDED', async () => {
        const now = Date.now();
        const requests = [now - 1000, now - 2000, now - 3000]; // 3 requisições recentes

        setupMockTransaction(requests, true);

        await expect(
            checkRateLimit('user123', { maxRequests: 3, windowMs: 60000 })
        ).rejects.toThrow('RATE_LIMIT_EXCEEDED');
    });

    it('limpa timestamps antigos automaticamente', async () => {
        const now = Date.now();
        const windowMs = 60000;
        // 2 requisições antigas (fora da janela) e 2 recentes
        const requests = [
            now - windowMs - 1000, // antiga
            now - windowMs - 2000, // antiga
            now - 1000,            // recente
            now - 2000,            // recente
        ];

        let capturedRequests = [];
        mockRunTransaction.mockImplementation(async (fn) => {
            const mockTx = {
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({ requests }),
                }),
                set: vi.fn().mockImplementation((_, data) => {
                    capturedRequests = data.requests;
                }),
            };
            return fn(mockTx);
        });

        // Com maxRequests: 3, deve permitir (2 recentes + 1 nova = 3)
        await checkRateLimit('user123', { maxRequests: 3, windowMs });

        // Verificar que timestamps antigos foram removidos
        expect(capturedRequests.length).toBe(3); // 2 recentes + 1 nova
        expect(capturedRequests.every((ts) => ts > now - windowMs)).toBe(true);
    });

    it('isolamento por identifier', async () => {
        const now = Date.now();

        // user123 atingiu limite
        setupMockTransaction([now - 1000, now - 2000, now - 3000], true);

        await expect(
            checkRateLimit('user123', { maxRequests: 3, windowMs: 60000 })
        ).rejects.toThrow('RATE_LIMIT_EXCEEDED');

        // user456 deve conseguir (collection/doc diferente)
        vi.clearAllMocks();
        setupMockTransaction([], false);

        await expect(
            checkRateLimit('user456', { maxRequests: 3, windowMs: 60000 })
        ).resolves.not.toThrow();
    });

    it('isolamento por key', async () => {
        const now = Date.now();

        // user123:backfill atingiu limite
        setupMockTransaction([now - 1000, now - 2000, now - 3000], true);

        await expect(
            checkRateLimit('user123', { maxRequests: 3, windowMs: 60000, key: 'backfill' })
        ).rejects.toThrow('RATE_LIMIT_EXCEEDED');

        // user123:export deve conseguir (key diferente)
        vi.clearAllMocks();
        setupMockTransaction([], false);

        await expect(
            checkRateLimit('user123', { maxRequests: 3, windowMs: 60000, key: 'export' })
        ).resolves.not.toThrow();
    });

    it('transaction resolve concorrência atomicamente', async () => {
        const now = Date.now();
        let requestCount = 0;

        mockRunTransaction.mockImplementation(async (fn) => {
            requestCount++;
            // Simular que na 2ª chamada, a 1ª já preencheu o limite
            const currentRequests = requestCount === 1
                ? [now - 1000, now - 2000] // 2 requisições
                : [now - 1000, now - 2000, now - 3000]; // 3 requisições (limite atingido)

            const mockTx = {
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({ requests: currentRequests }),
                }),
                set: mockSet,
            };
            return fn(mockTx);
        });

        // 1ª chamada: permite (2 < 3)
        await checkRateLimit('user123', { maxRequests: 3, windowMs: 60000 });

        // 2ª chamada concorrente: deve rejeitar (3 >= 3)
        await expect(
            checkRateLimit('user123', { maxRequests: 3, windowMs: 60000 })
        ).rejects.toThrow('RATE_LIMIT_EXCEEDED');
    });

    it('cria documento automaticamente na primeira chamada', async () => {
        setupMockTransaction([], false);

        await checkRateLimit('novo_user', { maxRequests: 10, windowMs: 60000 });

        // tx.set(ref, data) - verificar o segundo argumento (data)
        expect(mockSet).toHaveBeenCalledTimes(1);
        const [, dataArg] = mockSet.mock.calls[0];
        expect(dataArg).toMatchObject({
            requests: expect.any(Array),
            updatedAt: expect.any(Object), // FieldValue.serverTimestamp()
        });
    });

    it('throw se identifier não é fornecido', async () => {
        await expect(checkRateLimit()).rejects.toThrow('identifier é obrigatório');
        await expect(checkRateLimit('')).rejects.toThrow('identifier é obrigatório');
        await expect(checkRateLimit(123)).rejects.toThrow('identifier é obrigatório');
    });

    it('usa valores default quando options não é fornecido', async () => {
        setupMockTransaction([], false);

        // Deve usar maxRequests: 10 e windowMs: 60000 (defaults)
        await checkRateLimit('user_default');

        expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });
});
