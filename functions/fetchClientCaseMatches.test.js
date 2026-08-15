/**
 * Varredura do portal cliente (listClientCases e fallback do V2).
 *
 * Incidente 2026-08-14: a varredura lia ate 10k docs do tenant a cada chamada,
 * mesmo com filtro de status fixado. Empurrar a igualdade para a query usa os
 * indices compostos que ja existem (tenantId+status+createdAt e
 * tenantId+finalVerdict+createdAt) e le so a fatia necessaria.
 */
import { readFileSync } from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { fetchClientCaseMatches, buildClientCaseStats, CLIENT_CASE_LIST_RUNTIME, OPS_CASE_LIST_RUNTIME } = require('./modules/caseQueriesAssignments');

function makeDoc(id, data) {
    return { id, data: () => data, get: (field) => data[field] };
}

function buildMockDb(docsByQuery) {
    const queries = [];

    function makeChain(state) {
        return {
            where(field, _op, value) {
                return makeChain({ ...state, wheres: [...state.wheres, { field, value }] });
            },
            orderBy(field, dir) {
                return makeChain({ ...state, orderBy: { field, dir } });
            },
            startAfter(...values) {
                return makeChain({ ...state, startAfter: values });
            },
            limit(n) {
                const finalState = { ...state, limit: n };
                return {
                    get: vi.fn(async () => {
                        queries.push(finalState);
                        return { docs: docsByQuery(finalState) };
                    }),
                };
            },
        };
    }

    return {
        queries,
        collection: vi.fn(() => makeChain({ wheres: [], orderBy: null, startAfter: null })),
    };
}

describe('fetchClientCaseMatches', () => {
    let docs;

    beforeEach(() => {
        docs = [
            makeDoc('c1', { tenantId: 'ten-1', status: 'DONE', finalVerdict: 'FIT', candidateName: 'Ana', createdAt: '2026-08-10T00:00:00.000Z' }),
            makeDoc('c2', { tenantId: 'ten-1', status: 'PENDING', finalVerdict: 'PENDING', candidateName: 'Bruno', createdAt: '2026-08-09T00:00:00.000Z' }),
        ];
    });

    it('empurra o filtro de status para a query', async () => {
        const db = buildMockDb(() => [docs[0]]);

        await fetchClientCaseMatches({ db, tenantId: 'ten-1', filters: { status: 'DONE', verdict: 'ALL' } });

        expect(db.queries).toHaveLength(1);
        expect(db.queries[0].wheres).toEqual([
            { field: 'tenantId', value: 'ten-1' },
            { field: 'status', value: 'DONE' },
        ]);
    });

    it('empurra o veredito quando o status esta em ALL', async () => {
        const db = buildMockDb(() => [docs[0]]);

        await fetchClientCaseMatches({ db, tenantId: 'ten-1', filters: { status: 'ALL', verdict: 'FIT' } });

        expect(db.queries[0].wheres).toEqual([
            { field: 'tenantId', value: 'ten-1' },
            { field: 'finalVerdict', value: 'FIT' },
        ]);
    });

    it('nao combina status e veredito na query (nao ha indice composto)', async () => {
        const db = buildMockDb(() => [docs[0]]);

        const { matches } = await fetchClientCaseMatches({
            db,
            tenantId: 'ten-1',
            filters: { status: 'DONE', verdict: 'FIT' },
        });

        expect(db.queries[0].wheres).toEqual([
            { field: 'tenantId', value: 'ten-1' },
            { field: 'status', value: 'DONE' },
        ]);
        // o veredito continua sendo aplicado em memoria
        expect(matches.map((c) => c.id)).toEqual(['c1']);
    });

    it('sem filtros, varre so por tenant e filtra em memoria', async () => {
        const db = buildMockDb(() => docs);

        const { matches, scannedRecords, capped } = await fetchClientCaseMatches({
            db,
            tenantId: 'ten-1',
            filters: { status: 'ALL', verdict: 'ALL', searchTerm: 'bruno' },
        });

        expect(db.queries[0].wheres).toEqual([{ field: 'tenantId', value: 'ten-1' }]);
        expect(matches.map((c) => c.id)).toEqual(['c2']);
        expect(scannedRecords).toBe(2);
        expect(capped).toBe(false);
    });

    it('respeita o teto de varredura em vez de paginar sem fim', async () => {
        const page = Array.from({ length: 500 }, (_, i) => makeDoc(`x${i}`, {
            tenantId: 'ten-1', status: 'DONE', createdAt: '2026-08-10T00:00:00.000Z',
        }));
        const db = buildMockDb(() => page);

        const { scannedRecords, capped, pageCount } = await fetchClientCaseMatches({
            db,
            tenantId: 'ten-1',
            filters: {},
            scanLimit: 1000,
        });

        expect(capped).toBe(true);
        expect(scannedRecords).toBe(1000);
        expect(pageCount).toBe(2);
    });
});

describe('CLIENT_CASE_LIST_RUNTIME', () => {
    it('define teto de instancias para a varredura de tenant', () => {
        expect(CLIENT_CASE_LIST_RUNTIME.maxInstances).toBe(10);
        expect(CLIENT_CASE_LIST_RUNTIME.region).toBe('southamerica-east1');
        expect(CLIENT_CASE_LIST_RUNTIME.timeoutSeconds).toBe(120);
    });

    it('e usado no registro da V1 e da V2 (o teto nao pode valer so num caminho)', () => {
        // Em 2026-08-14 o teto foi aplicado so na V1 porque cada registro repetia
        // as opcoes na mao. Esta asercao e sobre a fonte para que o drift volte a
        // aparecer como teste vermelho, nao como maxScale=20 em producao.
        const index = readFileSync(require.resolve('./index.js'), 'utf8');
        const modulo = readFileSync(require.resolve('./modules/caseQueriesAssignments.js'), 'utf8');

        expect(index).toMatch(/exports\.listClientCasesV2 = onCall\(\s*(?:\/\/[^\n]*\n\s*)*\{\s*\.\.\.caseQueriesAssignments\.CLIENT_CASE_LIST_RUNTIME/);
        expect(modulo).toMatch(/return onCall\(\s*(?:\/\/[^\n]*\n\s*)*\{\s*\.\.\.CLIENT_CASE_LIST_RUNTIME/);
    });

    it('vale tambem para as duas rotas do OPS, que varrem `cases` do mesmo jeito', () => {
        const index = readFileSync(require.resolve('./index.js'), 'utf8');
        const modulo = readFileSync(require.resolve('./modules/caseQueriesAssignments.js'), 'utf8');

        expect(OPS_CASE_LIST_RUNTIME.maxInstances).toBe(10);
        expect(index).toMatch(/exports\.listOpsCasesV2 = onCall\(\s*(?:\/\/[^\n]*\n\s*)*\{\s*\.\.\.caseQueriesAssignments\.OPS_CASE_LIST_RUNTIME/);
        expect(modulo).toMatch(/return onCall\(\s*(?:\/\/[^\n]*\n\s*)*\{\s*\.\.\.OPS_CASE_LIST_RUNTIME/);
    });

    it('nenhuma das quatro listagens registra opcoes de runtime na mao', () => {
        // A regressao de 2026-08-15 (maxScale=20 na V2 do cliente) nasceu de um
        // literal repetido. Se algum registro voltar a escrever region/timeout na
        // mao, o teto some sem ninguem perceber ate a proxima rajada.
        const index = readFileSync(require.resolve('./index.js'), 'utf8');
        const registrosComLiteral = index.match(
            /exports\.list(?:Ops|Client)Cases(?:V2)? = onCall\(\s*(?:\/\/[^\n]*\n\s*)*\{\s*region:/g,
        );

        expect(registrosComLiteral).toBeNull();
    });
});

describe('buildClientCaseStats', () => {
    it('conta status e nao recomendados', () => {
        const stats = buildClientCaseStats([
            { status: 'DONE', finalVerdict: 'NOT_RECOMMENDED' },
            { status: 'PENDING', finalVerdict: 'PENDING' },
            { status: 'CORRECTION_NEEDED', finalVerdict: 'PENDING' },
        ]);

        expect(stats).toEqual({
            total: 3, done: 1, pending: 1, inProgress: 0, waiting: 0, corrections: 1, notRecommended: 1,
        });
    });
});
