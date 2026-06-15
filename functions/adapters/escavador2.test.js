import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    DEFAULT_BASE_URL,
    DEFAULT_TIMEOUT_MS,
    Escavador2Error,
    buildEscavador2Payload,
    consultarEscavador2,
} = require('./escavador2.js');

describe('Escavador2Error', () => {
    it('is exported as a class with statusCode and responseBody', () => {
        const error = new Escavador2Error('falha', 500, 'server error');

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(Escavador2Error);
        expect(error.name).toBe('Escavador2Error');
        expect(error.statusCode).toBe(500);
        expect(error.responseBody).toBe('server error');
    });
});

describe('buildEscavador2Payload', () => {
    it('normalizes CPF and applies default risk-only payload options', () => {
        const payload = buildEscavador2Payload({
            cpf: '123.456.789-09',
            nome: '  Maria Silva  ',
        });

        expect(payload).toEqual({
            cpf: '12345678909',
            nome: 'Maria Silva',
            detalhar: true,
            movimentacoes: 'risk_only',
            documentos: 'risk_only',
            limit_movimentacoes: 20,
            limit_documentos: 20,
        });
    });

    it('allows options to override default payload values', () => {
        const payload = buildEscavador2Payload({
            cpf: '12345678909',
            nome: 'Maria Silva',
            options: {
                detalhar: false,
                movimentacoes: 'all',
                documentos: 'none',
                limit_movimentacoes: 5,
                limit_documentos: 7,
            },
        });

        expect(payload).toEqual({
            cpf: '12345678909',
            nome: 'Maria Silva',
            detalhar: false,
            movimentacoes: 'all',
            documentos: 'none',
            limit_movimentacoes: 5,
            limit_documentos: 7,
        });
    });
});

describe('consultarEscavador2', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('posts to Escavador2 endpoint with JSON headers and normalized default body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'ok' }),
        }));

        const result = await consultarEscavador2({
            cpf: '123.456.789-09',
            nome: 'Maria Silva',
            apiKey: 'secret-key',
        });

        expect(result).toEqual({ status: 'ok' });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(`${DEFAULT_BASE_URL}/escavador2/consultar`, expect.objectContaining({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Api-Key': 'secret-key',
            },
            body: JSON.stringify({
                cpf: '12345678909',
                nome: 'Maria Silva',
                detalhar: true,
                movimentacoes: 'risk_only',
                documentos: 'risk_only',
                limit_movimentacoes: 20,
                limit_documentos: 20,
            }),
            signal: expect.any(AbortSignal),
        }));
    });

    it('uses the default timeout when AbortController is available', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'ok' }),
        }));

        await consultarEscavador2({
            cpf: '12345678909',
            nome: 'Maria Silva',
            apiKey: 'secret-key',
        });

        const requestInit = fetch.mock.calls[0][1];
        expect(DEFAULT_TIMEOUT_MS).toBe(300000);
        expect(requestInit.signal).toBeInstanceOf(AbortSignal);
        expect(requestInit.signal.aborted).toBe(false);
    });

    it('aborts unresolved fetch and throws Escavador2Error on timeout', async () => {
        vi.useFakeTimers();
        let capturedSignal;

        vi.stubGlobal('fetch', vi.fn((_url, requestInit) => {
            capturedSignal = requestInit.signal;
            return new Promise((_resolve, reject) => {
                requestInit.signal.addEventListener('abort', () => {
                    const error = new Error('aborted');
                    error.name = 'AbortError';
                    reject(error);
                });
            });
        }));

        const promise = consultarEscavador2({
            cpf: '12345678909',
            nome: 'Maria Silva',
            apiKey: 'secret-key',
            timeoutMs: 25,
        });

        expect(capturedSignal.aborted).toBe(false);
        const expectation = expect(promise).rejects.toMatchObject({
            name: 'Escavador2Error',
            message: 'Escavador2 timeout apos 25ms',
            statusCode: null,
            responseBody: null,
        });

        await vi.advanceTimersByTimeAsync(25);

        expect(capturedSignal.aborted).toBe(true);
        await expectation;
    });

    it('calls fetch without signal when AbortController is unavailable', async () => {
        const OriginalAbortController = globalThis.AbortController;
        vi.stubGlobal('AbortController', undefined);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'ok' }),
        }));

        try {
            await consultarEscavador2({
                cpf: '12345678909',
                nome: 'Maria Silva',
                apiKey: 'secret-key',
            });
        } finally {
            vi.stubGlobal('AbortController', OriginalAbortController);
        }

        expect(fetch.mock.calls[0][1]).not.toHaveProperty('signal');
    });

    it('posts overridden payload options', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ status: 'ok' }),
        }));

        await consultarEscavador2({
            cpf: '12345678909',
            nome: 'Maria Silva',
            apiKey: 'secret-key',
            baseUrl: 'https://example.test',
            options: {
                detalhar: false,
                movimentacoes: 'all',
                documentos: 'none',
                limit_movimentacoes: 3,
                limit_documentos: 4,
            },
        });

        expect(fetch).toHaveBeenCalledWith('https://example.test/escavador2/consultar', expect.objectContaining({
            body: JSON.stringify({
                cpf: '12345678909',
                nome: 'Maria Silva',
                detalhar: false,
                movimentacoes: 'all',
                documentos: 'none',
                limit_movimentacoes: 3,
                limit_documentos: 4,
            }),
        }));
    });

    it('throws Escavador2Error with statusCode and responseBody on non-ok HTTP response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 502,
            text: async () => 'bad gateway',
        }));

        await expect(consultarEscavador2({
            cpf: '12345678909',
            nome: 'Maria Silva',
            apiKey: 'secret-key',
        })).rejects.toMatchObject({
            name: 'Escavador2Error',
            statusCode: 502,
            responseBody: 'bad gateway',
        });
    });

    it('throws before fetch when apiKey is missing', async () => {
        vi.stubGlobal('fetch', vi.fn());

        await expect(consultarEscavador2({
            cpf: '12345678909',
            nome: 'Maria Silva',
        })).rejects.toThrow('ESCAVADOR2_API_KEY nao configurado.');

        expect(fetch).not.toHaveBeenCalled();
    });

    it('throws before fetch when CPF length is invalid', async () => {
        vi.stubGlobal('fetch', vi.fn());

        await expect(consultarEscavador2({
            cpf: '123',
            nome: 'Maria Silva',
            apiKey: 'secret-key',
        })).rejects.toThrow('CPF invalido para Escavador2.');

        expect(fetch).not.toHaveBeenCalled();
    });
});
