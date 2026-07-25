/**
 * bigdatacorp.test.js — adapter BDC: consulta marketplace de crédito (Quod + Quantum)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { queryMarketplaceCredit, BigDataCorpError } = require('./bigdatacorp');

const CPF = '12345678901';
const CREDENTIALS = { accessToken: 'tok', tokenId: 'tid' };

const QUOD_DATASET = 'partner_quod_credit_risk_details_person';
const QUANTUM_DATASET = 'partner_quantum_score_person';

function okJsonResponse(body) {
    return {
        ok: true,
        status: 200,
        json: async () => body,
    };
}

function marketplaceBody({ quodData, quantumScore, quodCode = 0, quantumCode = 0 } = {}) {
    const resultEntry = { MatchKeys: `doc{${CPF}}` };
    if (quodData !== undefined && quodData !== null) resultEntry.QUODCreditRiskPerson = quodData;
    if (quantumScore !== undefined && quantumScore !== null) {
        resultEntry.OnlineQueries = [{
            Origin: 'Quantum',
            QueryRawHTMLResult: { CPF: '', Score: quantumScore, Error: '0' },
            QueryResultData: { Score: quantumScore },
            QueryDate: '2026-07-25T10:00:00.000-03:00',
        }];
    }
    return {
        Result: [resultEntry],
        Status: {
            [QUOD_DATASET]: [{ Code: quodCode, Message: quodCode === 0 ? 'OK' : 'ERRO' }],
            [QUANTUM_DATASET]: [{ Code: quantumCode, Message: quantumCode === 0 ? 'OK' : 'ERRO' }],
        },
        Evidences: {},
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('queryMarketplaceCredit', () => {
    it('consulta os dois datasets em uma chamada no endpoint /marketplace', async () => {
        const fetchMock = vi.fn(async () => okJsonResponse(marketplaceBody({
            quodData: { HasNegativeIndicator: false, TotalActiveNegativeAppointments: 0 },
            quantumScore: '606',
        })));
        vi.stubGlobal('fetch', fetchMock);

        const result = await queryMarketplaceCredit(CPF, CREDENTIALS);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/marketplace');
        expect(init.headers.AccessToken).toBe('tok');
        expect(init.headers.TokenId).toBe('tid');
        const body = JSON.parse(init.body);
        expect(body.q).toBe(`doc{${CPF}}`);
        expect(body.Datasets).toBe(`${QUOD_DATASET},${QUANTUM_DATASET}`);
        expect(body.Limit).toBe(1);

        expect(result.quodRisk.ok).toBe(true);
        expect(result.quodRisk.data.HasNegativeIndicator).toBe(false);
        expect(result.quantumScore.ok).toBe(true);
        expect(result.quantumScore.score).toBe('606');
        expect(typeof result.elapsedMs).toBe('number');
    });

    it('falha parcial: quod ok, quantum com erro de dataset', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => okJsonResponse(marketplaceBody({
            quodData: { HasNegativeIndicator: true },
            quantumScore: null,
            quantumCode: -1301,
        }))));

        const result = await queryMarketplaceCredit(CPF, CREDENTIALS);

        expect(result.quodRisk.ok).toBe(true);
        expect(result.quantumScore.ok).toBe(false);
        expect(result.quantumScore.statusCode).toBe(-1301);
    });

    it('status OK mas sem dados no Result → ok false nos dois', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => okJsonResponse({
            Result: [{ MatchKeys: `doc{${CPF}}` }],
            Status: {
                [QUOD_DATASET]: [{ Code: 0, Message: 'OK' }],
                [QUANTUM_DATASET]: [{ Code: 0, Message: 'OK' }],
            },
            Evidences: {},
        })));

        const result = await queryMarketplaceCredit(CPF, CREDENTIALS);

        expect(result.quodRisk.ok).toBe(false);
        expect(result.quantumScore.ok).toBe(false);
    });

    it('score Quantum vazio → quantumScore.ok false', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => okJsonResponse(marketplaceBody({
            quodData: { HasNegativeIndicator: false },
            quantumScore: '',
        }))));

        const result = await queryMarketplaceCredit(CPF, CREDENTIALS);

        expect(result.quodRisk.ok).toBe(true);
        expect(result.quantumScore.ok).toBe(false);
    });

    it('aceita Score numerico do Quantum (normaliza para string)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => okJsonResponse(marketplaceBody({
            quodData: { HasNegativeIndicator: false },
            quantumScore: 606,
        }))));

        const result = await queryMarketplaceCredit(CPF, CREDENTIALS);

        expect(result.quantumScore.ok).toBe(true);
        expect(result.quantumScore.score).toBe('606');
    });

    it('erro de input com Status flat → lança BigDataCorpError não-retryable', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => okJsonResponse({
            Status: { Code: -102, Message: 'Invalid dataset' },
        })));

        await expect(queryMarketplaceCredit(CPF, CREDENTIALS)).rejects.toThrow(BigDataCorpError);
    });

    it('HTTP 500 seguido de 200 → retry com sucesso', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
            .mockResolvedValueOnce(okJsonResponse(marketplaceBody({
                quodData: { HasNegativeIndicator: false },
                quantumScore: '710',
            })));
        vi.stubGlobal('fetch', fetchMock);

        const result = await queryMarketplaceCredit(CPF, CREDENTIALS);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.quantumScore.score).toBe('710');
    }, 15000);
});
