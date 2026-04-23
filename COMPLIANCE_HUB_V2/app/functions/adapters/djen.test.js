import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    queryComunicacoesByName,
    queryComunicacoesByProcesso,
    queryTribunais,
    DjenError,
} = require('./djen.js');

describe('DjenError', () => {
    it('stores statusCode and retryable flag', () => {
        const err = new DjenError('rate limit', 429, true);
        expect(err.name).toBe('DjenError');
        expect(err.statusCode).toBe(429);
        expect(err.retryable).toBe(true);
        expect(err.message).toBe('rate limit');
    });
});

describe('queryComunicacoesByProcesso', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns parsed comunicações for a process number', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            headers: new Map(),
            json: async () => ({
                status: 'success',
                count: 2,
                items: [
                    { id: 1, siglaTribunal: 'TJMG', nomeClasse: 'APELAÇÃO CRIMINAL', numero_processo: '00104442320228130701' },
                    { id: 2, siglaTribunal: 'TJMG', nomeClasse: 'APELAÇÃO CRIMINAL', numero_processo: '00104442320228130701' },
                ],
            }),
        }));

        const result = await queryComunicacoesByProcesso('00104442320228130701');
        expect(result.count).toBe(2);
        expect(result.items).toHaveLength(2);
        expect(result.items[0].siglaTribunal).toBe('TJMG');
        expect(result._request.params.numeroProcesso).toBe('00104442320228130701');
    });

    it('returns empty when 404', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({}),
        }));

        const result = await queryComunicacoesByProcesso('99999999999999999999');
        expect(result.count).toBe(0);
        expect(result.items).toEqual([]);
    });

    it('paginates when process has >100 comunicações', async () => {
        let callCount = 0;
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                return {
                    ok: true,
                    headers: new Map(),
                    json: async () => ({
                        status: 'success',
                        count: 120,
                        items: Array(100).fill({ id: callCount }),
                    }),
                };
            }
            return {
                ok: true,
                headers: new Map(),
                json: async () => ({
                    status: 'success',
                    count: 120,
                    items: Array(20).fill({ id: callCount }),
                }),
            };
        }));

        const result = await queryComunicacoesByProcesso('00104442320228130701');
        expect(result.count).toBe(120);
        expect(result.items).toHaveLength(120);
        expect(result._request.pages).toBe(2);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe('queryComunicacoesByName', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches single page when count <= 100', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            headers: new Map(),
            json: async () => ({
                status: 'success',
                count: 3,
                items: [
                    { id: 1, siglaTribunal: 'TJCE' },
                    { id: 2, siglaTribunal: 'TJSP' },
                    { id: 3, siglaTribunal: 'TJMG' },
                ],
            }),
        }));

        const result = await queryComunicacoesByName('FRANCISCO WILLIAN BRITO');
        expect(result.count).toBe(3);
        expect(result.items).toHaveLength(3);
        expect(result._request.params.nomeParte).toBe('FRANCISCO WILLIAN BRITO');
        // Should only call fetch once (no pagination needed)
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('paginates when count > 100', async () => {
        let callCount = 0;
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                return {
                    ok: true,
                    headers: new Map(),
                    json: async () => ({
                        status: 'success',
                        count: 150,
                        items: Array(100).fill({ id: callCount }),
                    }),
                };
            }
            return {
                ok: true,
                headers: new Map(),
                json: async () => ({
                    status: 'success',
                    count: 150,
                    items: Array(50).fill({ id: callCount }),
                }),
            };
        }));

        const result = await queryComunicacoesByName('RENAN AUGUSTO', { maxPages: 5 });
        expect(result.count).toBe(150);
        expect(result.items).toHaveLength(150);
        expect(result._request.pages).toBe(2);
    });

    it('passes siglaTribunal filter', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            headers: new Map(),
            json: async () => ({ status: 'success', count: 0, items: [] }),
        }));

        await queryComunicacoesByName('DIEGO', { siglaTribunal: 'TJSP' });

        const calledUrl = fetch.mock.calls[0][0];
        expect(calledUrl).toContain('siglaTribunal=TJSP');
    });
});

describe('retry logic', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('retries on 500 and succeeds', async () => {
        let attempt = 0;
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
            attempt++;
            if (attempt === 1) {
                return { ok: false, status: 500, text: async () => 'server error' };
            }
            return {
                ok: true,
                headers: new Map(),
                json: async () => ({ status: 'success', count: 1, items: [{ id: 1 }] }),
            };
        }));

        const result = await queryComunicacoesByProcesso('123');
        expect(result.count).toBe(1);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('throws non-retryable error on 400', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            text: async () => 'bad request',
        }));

        await expect(queryComunicacoesByProcesso('123')).rejects.toThrow(DjenError);
    });
});

describe('queryTribunais', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns tribunal list', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            headers: new Map(),
            json: async () => ([
                { uf: 'MG', tribunais: [{ sigla: 'TJMG' }] },
                { uf: 'SP', tribunais: [{ sigla: 'TJSP' }] },
            ]),
        }));

        const result = await queryTribunais();
        expect(result.tribunais).toHaveLength(2);
        expect(result.tribunais[0].uf).toBe('MG');
    });
});

describe('rate limit headers', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('attaches _rateLimit from response headers', async () => {
        const headers = new Map([['x-ratelimit-remaining', '48'], ['x-ratelimit-limit', '50']]);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            headers,
            json: async () => ({ status: 'success', count: 1, items: [{ id: 1 }] }),
        }));

        const result = await queryComunicacoesByProcesso('123');
        expect(result._rateLimit).toEqual({ remaining: 48, limit: 50 });
    });

    it('returns null _rateLimit when headers are absent', async () => {
        const headers = new Map();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            headers,
            json: async () => ({ status: 'success', count: 1, items: [{ id: 1 }] }),
        }));

        const result = await queryComunicacoesByProcesso('456');
        expect(result._rateLimit).toEqual({ remaining: null, limit: null });
    });
});
