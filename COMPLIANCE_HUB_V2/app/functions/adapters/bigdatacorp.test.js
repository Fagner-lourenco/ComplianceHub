import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { queryCombined, queryProcesses, queryKyc, BigDataCorpError } = require('./bigdatacorp');

describe('bigdatacorp adapter', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    const credentials = { accessToken: 'token_123', tokenId: 'id_456' };

    it('queryCombined returns structured result from BDC response', async () => {
        const mockResponse = {
            Result: [{
                BasicData: { Name: 'Joao Silva', TaxIdStatus: 'REGULAR' },
                Processes: { Lawsuits: [{ Number: '123' }] },
                KycData: { IsPep: false },
                ProfessionData: { CurrentJob: 'Developer' },
            }],
        };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockResponse,
        });

        const result = await queryCombined('48052053854', credentials);
        expect(result.raw).toEqual(mockResponse);
        expect(result.basicData.Name).toBe('Joao Silva');
        expect(result.processes.Lawsuits).toHaveLength(1);
        expect(result.kycData.IsPep).toBe(false);
        expect(result.professionData.CurrentJob).toBe('Developer');
        expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it('queryCombined handles empty Result array', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ Result: [] }),
        });

        const result = await queryCombined('48052053854', credentials);
        expect(result.basicData).toBeNull();
        expect(result.processes).toBeNull();
        expect(result.kycData).toBeNull();
        expect(result.professionData).toBeNull();
    });

    it('queryProcesses returns only processes dataset', async () => {
        const mockResponse = {
            Result: [{ Processes: { Lawsuits: [{ Number: '456' }] } }],
        };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockResponse,
        });

        const result = await queryProcesses('48052053854', credentials, { limit: 50 });
        expect(result.processes.Lawsuits).toHaveLength(1);
        expect(result.raw).toEqual(mockResponse);
    });

    it('queryKyc returns only kyc dataset', async () => {
        const mockResponse = {
            Result: [{ KycData: { IsPep: true, PepLevel: 'HIGH' } }],
        };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockResponse,
        });

        const result = await queryKyc('48052053854', credentials);
        expect(result.kycData.IsPep).toBe(true);
    });

    it('retries on 429 and succeeds', async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ status: 429, ok: false })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ Result: [{ BasicData: { Name: 'Retry' } }] }),
            });

        const result = await queryCombined('48052053854', credentials);
        expect(result.basicData.Name).toBe('Retry');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('throws non-retryable BigDataCorpError on 401', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            status: 401,
            ok: false,
        });

        await expect(queryCombined('48052053854', credentials)).rejects.toThrow(BigDataCorpError);
        await expect(queryCombined('48052053854', credentials)).rejects.toThrow('auth error');
    });

    it('throws BigDataCorpError on timeout after retries', { timeout: 15000 }, async () => {
        global.fetch = vi.fn().mockImplementation(() => {
            const err = new Error('Timeout');
            err.name = 'AbortError';
            return Promise.reject(err);
        });

        await expect(queryCombined('48052053854', credentials)).rejects.toThrow('timeout');
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('BigDataCorpError has retryable flag', () => {
        const err = new BigDataCorpError('test', 429, true);
        expect(err.statusCode).toBe(429);
        expect(err.retryable).toBe(true);
        expect(err.name).toBe('BigDataCorpError');
    });
});
