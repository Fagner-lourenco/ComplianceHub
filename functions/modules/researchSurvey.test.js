import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSubmitResearchResponseHandler, sanitizeAnswers } = require('./researchSurvey');

function makeRes() {
    const res = {
        statusCode: null,
        body: null,
        headers: {},
        set: vi.fn((k, v) => { res.headers[k] = v; return res; }),
        status: vi.fn((code) => { res.statusCode = code; return res; }),
        json: vi.fn((payload) => { res.body = payload; return res; }),
        send: vi.fn((payload) => { res.body = payload; return res; }),
    };
    return res;
}

function makeDeps({ addImpl, verifyImpl } = {}) {
    const add = vi.fn(addImpl || (() => Promise.resolve({ id: 'resp1' })));
    return {
        deps: {
            db: { collection: vi.fn(() => ({ add })) },
            FieldValue: { serverTimestamp: vi.fn(() => 'ts') },
            auth: verifyImpl ? { verifyIdToken: vi.fn(verifyImpl) } : null,
            logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
        },
        add,
    };
}

const req = (over = {}) => ({
    method: 'POST',
    body: { surveyVersion: 'CH-RH-UX-2026.09-V3', answers: { daily_volume: '4_7' } },
    get: vi.fn((h) => (h === 'User-Agent' ? 'jest' : '')),
    ...over,
});

describe('sanitizeAnswers', () => {
    it('aceita os tres tipos do formulario: single, multi e texto livre', () => {
        expect(sanitizeAnswers({
            daily_volume: '4_7',
            candidate_source: ['ats', 'spreadsheet'],
            comentario: '  texto com espaco  ',
        })).toEqual({
            daily_volume: '4_7',
            candidate_source: ['ats', 'spreadsheet'],
            comentario: 'texto com espaco',
        });
    });

    it('descarta forma inesperada em vez de gravar como veio', () => {
        const out = sanitizeAnswers({ objeto: { a: 1 }, nulo: null, vazio: '   ' });
        expect(out).toEqual({});
    });

    it('limita tamanho de texto livre e de lista', () => {
        const out = sanitizeAnswers({
            longo: 'x'.repeat(9000),
            lista: Array.from({ length: 200 }, (_, i) => `item${i}`),
        });
        expect(out.longo.length).toBe(4000);
        expect(out.lista).toHaveLength(50);
    });

    it('tolera entrada que nao e objeto', () => {
        expect(sanitizeAnswers(null)).toEqual({});
        expect(sanitizeAnswers([1, 2])).toEqual({});
    });
});

describe('submitResearchResponse', () => {
    it('grava resposta anonima quando nao ha token — o link publico precisa funcionar', async () => {
        const { deps, add } = makeDeps();
        const res = makeRes();
        await createSubmitResearchResponseHandler(deps)(req(), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ ok: true, id: 'resp1' });
        expect(add).toHaveBeenCalledWith(expect.objectContaining({
            surveyVersion: 'CH-RH-UX-2026.09-V3',
            uid: null,
            anonima: true,
            totalRespostas: 1,
        }));
    });

    it('identifica o usuario quando o convite vem de dentro do app', async () => {
        const { deps, add } = makeDeps({ verifyImpl: () => Promise.resolve({ uid: 'u1', tenantId: 't1' }) });
        const res = makeRes();
        await createSubmitResearchResponseHandler(deps)(req({
            get: vi.fn((h) => (h === 'Authorization' ? 'Bearer tok' : 'jest')),
        }), res);

        expect(add).toHaveBeenCalledWith(expect.objectContaining({ uid: 'u1', tenantId: 't1', anonima: false }));
    });

    it('token invalido nao derruba a resposta: grava como anonima', async () => {
        const { deps, add } = makeDeps({ verifyImpl: () => Promise.reject(new Error('expirado')) });
        const res = makeRes();
        await createSubmitResearchResponseHandler(deps)(req({
            get: vi.fn((h) => (h === 'Authorization' ? 'Bearer velho' : 'jest')),
        }), res);

        expect(res.statusCode).toBe(200);
        expect(add).toHaveBeenCalledWith(expect.objectContaining({ anonima: true, uid: null }));
    });

    it('guarda a origem do convite para separar quem respondeu de qual link', async () => {
        const { deps, add } = makeDeps();
        const res = makeRes();
        await createSubmitResearchResponseHandler(deps)(req({
            body: { surveyVersion: 'v3', origem: 'convite-rh-madero', answers: { q: 'a' } },
        }), res);
        expect(add).toHaveBeenCalledWith(expect.objectContaining({ origem: 'convite-rh-madero' }));
    });

    it('recusa envio sem nenhuma resposta', async () => {
        const { deps, add } = makeDeps();
        const res = makeRes();
        await createSubmitResearchResponseHandler(deps)(req({ body: { answers: {} } }), res);
        expect(res.statusCode).toBe(400);
        expect(add).not.toHaveBeenCalled();
    });

    it('responde ao preflight do navegador', async () => {
        const { deps } = makeDeps();
        const res = makeRes();
        await createSubmitResearchResponseHandler(deps)(req({ method: 'OPTIONS' }), res);
        expect(res.statusCode).toBe(204);
        expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
    });

    it('recusa metodo diferente de POST', async () => {
        const { deps } = makeDeps();
        const res = makeRes();
        await createSubmitResearchResponseHandler(deps)(req({ method: 'GET' }), res);
        expect(res.statusCode).toBe(405);
    });

    it('recusa payload gigante', async () => {
        const { deps } = makeDeps();
        const res = makeRes();
        await createSubmitResearchResponseHandler(deps)(req({
            body: { answers: { grande: 'x'.repeat(300 * 1024) } },
        }), res);
        expect(res.statusCode).toBe(413);
    });

    it('falha de escrita vira 500 sem vazar detalhe interno', async () => {
        const { deps } = makeDeps({ addImpl: () => Promise.reject(new Error('firestore fora')) });
        const res = makeRes();
        await createSubmitResearchResponseHandler(deps)(req(), res);
        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: 'internal_error' });
        expect(JSON.stringify(res.body)).not.toMatch(/firestore fora/);
    });

    it('marca envio parcial para medir abandono', async () => {
        const { deps, add } = makeDeps();
        const res = makeRes();
        await createSubmitResearchResponseHandler(deps)(req({
            body: { answers: { q: 'a' }, parcial: true, duracaoSegundos: 42.7 },
        }), res);
        expect(add).toHaveBeenCalledWith(expect.objectContaining({ parcial: true, duracaoSegundos: 43 }));
    });

    it('grava os campos que o formulario realmente envia', async () => {
        // O payload vem de ComplianceHub_Pesquisa_RH_FINAL_PUBLICACAO.html:
        // durationSeconds/respondentId/startedAt/viewportCategory/locale.
        const { deps, add } = makeDeps();
        const res = makeRes();
        await createSubmitResearchResponseHandler(deps)(req({
            body: {
                surveyVersion: 'CH-RH-UX-2026.09-V3',
                respondentId: 'r-123',
                startedAt: '2026-09-05T10:00:00.000Z',
                submittedAt: '2026-09-05T10:08:00.000Z',
                durationSeconds: 480.4,
                viewportCategory: 'desktop',
                locale: 'pt-BR',
                answers: { daily_volume: '4_7' },
            },
        }), res);
        expect(add).toHaveBeenCalledWith(expect.objectContaining({
            respondentId: 'r-123',
            iniciadoEm: '2026-09-05T10:00:00.000Z',
            viewport: 'desktop',
            locale: 'pt-BR',
            duracaoSegundos: 480,
        }));
    });
});
