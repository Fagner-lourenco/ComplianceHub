import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const {
    paginateFirestoreQuery,
    encodeCursor,
    decodeCursor,
    normalizeLimit,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    MIN_LIMIT,
} = require('./paginateFirestoreQuery');

describe('paginateFirestoreQuery helpers', () => {
    describe('encodeCursor / decodeCursor', () => {
        it('round-trip: encode e decode preservam valores', () => {
            const original = ['2024-01-01T00:00:00.000Z', 'doc123'];
            const encoded = encodeCursor(original);
            expect(typeof encoded).toBe('string');
            // Base64 URL-safe: sem +, /, ou =
            expect(encoded).not.toMatch(/[+/=]/);
            const decoded = decodeCursor(encoded);
            expect(decoded).toEqual(original);
        });

        it('round-trip com timestamp e document ID', () => {
            const now = new Date().toISOString();
            const original = [now, 'case_abc_123'];
            const encoded = encodeCursor(original);
            const decoded = decodeCursor(encoded);
            expect(decoded).toEqual(original);
        });

        it('round-trip com null field value', () => {
            const original = [null, 'doc_456'];
            const encoded = encodeCursor(original);
            const decoded = decodeCursor(encoded);
            expect(decoded).toEqual(original);
        });

        it('decodeCursor rejeita string vazia', () => {
            expect(() => decodeCursor('')).toThrow('invalid-cursor');
        });

        it('decodeCursor rejeita null', () => {
            expect(() => decodeCursor(null)).toThrow('invalid-cursor');
        });

        it('decodeCursor rejeita cursor malformado', () => {
            expect(() => decodeCursor('not-valid-base64!!!')).toThrow('invalid-cursor');
        });

        it('decodeCursor rejeita JSON que não é array', () => {
            const encoded = encodeCursor({ not: 'array' });
            expect(() => decodeCursor(encoded)).toThrow('invalid-cursor');
        });

        it('decodeCursor rejeita array com menos de 2 elementos', () => {
            const encoded = encodeCursor(['only-one']);
            expect(() => decodeCursor(encoded)).toThrow('invalid-cursor');
        });
    });

    describe('normalizeLimit', () => {
        it('retorna DEFAULT_LIMIT quando não informado', () => {
            expect(normalizeLimit()).toBe(DEFAULT_LIMIT);
            expect(normalizeLimit(null)).toBe(DEFAULT_LIMIT);
            expect(normalizeLimit(undefined)).toBe(DEFAULT_LIMIT);
        });

        it('retorna valor dentro do range', () => {
            expect(normalizeLimit(10)).toBe(10);
            expect(normalizeLimit(100)).toBe(100);
            expect(normalizeLimit(500)).toBe(500);
        });

        it('limita ao mínimo quando abaixo de 1', () => {
            expect(normalizeLimit(0)).toBe(MIN_LIMIT);
            expect(normalizeLimit(-5)).toBe(MIN_LIMIT);
        });

        it('limita ao máximo quando acima do permitido', () => {
            expect(normalizeLimit(501)).toBe(MAX_LIMIT);
            expect(normalizeLimit(1000)).toBe(MAX_LIMIT);
        });

        it('converte string numérica', () => {
            expect(normalizeLimit('100')).toBe(100);
        });
    });

    describe('paginateFirestoreQuery', () => {
        // Mock de query do Firestore
        function createMockQuery(docs) {
            let limitVal = null;
            let startAfterVals = null;

            return {
                limit(n) {
                    limitVal = n;
                    return this;
                },
                startAfter(...values) {
                    startAfterVals = values;
                    return this;
                },
                async get() {
                    return {
                        docs: docs.slice(0, limitVal),
                        empty: docs.length === 0,
                    };
                },
                _limitVal: () => limitVal,
                _startAfterVals: () => startAfterVals,
            };
        }

        function createMockDoc(overrides = {}) {
            const data = {
                id: overrides.id || 'doc1',
                createdAt: overrides.createdAt || '2024-01-01T00:00:00.000Z',
                ...overrides.data,
            };
            return {
                id: data.id,
                get(field) {
                    return data[field];
                },
                data: () => data,
            };
        }

        it('primeira página sem cursor retorna docs e nextCursor', async () => {
            const docs = [
                createMockDoc({ id: 'doc1', createdAt: '2024-01-03T00:00:00.000Z' }),
                createMockDoc({ id: 'doc2', createdAt: '2024-01-02T00:00:00.000Z' }),
                createMockDoc({ id: 'doc3', createdAt: '2024-01-01T00:00:00.000Z' }),
            ];
            const query = createMockQuery(docs);

            const result = await paginateFirestoreQuery(query, { limit: 2 });

            expect(result.docs).toHaveLength(2);
            expect(result.hasMore).toBe(true);
            expect(result.nextCursor).not.toBeNull();
            expect(result.pageSize).toBe(2);
            // Verifica que buscou limit + 1
            expect(query._limitVal()).toBe(3);
        });

        it('última página retorna hasMore=false e nextCursor=null', async () => {
            const docs = [
                createMockDoc({ id: 'doc1', createdAt: '2024-01-01T00:00:00.000Z' }),
            ];
            const query = createMockQuery(docs);

            const result = await paginateFirestoreQuery(query, { limit: 2 });

            expect(result.docs).toHaveLength(1);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeNull();
        });

        it('página vazia retorna hasMore=false e nextCursor=null', async () => {
            const query = createMockQuery([]);

            const result = await paginateFirestoreQuery(query, { limit: 10 });

            expect(result.docs).toHaveLength(0);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeNull();
        });

        it('segunda página com cursor funciona corretamente', async () => {
            const docs = [
                createMockDoc({ id: 'doc1', createdAt: '2024-01-03T00:00:00.000Z' }),
                createMockDoc({ id: 'doc2', createdAt: '2024-01-02T00:00:00.000Z' }),
                createMockDoc({ id: 'doc3', createdAt: '2024-01-01T00:00:00.000Z' }),
            ];
            const query = createMockQuery(docs);

            // Primeira página
            const page1 = await paginateFirestoreQuery(query, { limit: 1 });
            expect(page1.hasMore).toBe(true);
            expect(page1.docs[0].id).toBe('doc1');

            // Segunda página
            const query2 = createMockQuery(docs.slice(1));
            const page2 = await paginateFirestoreQuery(query2, { limit: 1, cursor: page1.nextCursor });
            expect(page2.docs[0].id).toBe('doc2');
            expect(page2.hasMore).toBe(true);
        });

        it('cursor inválido lança erro', async () => {
            const query = createMockQuery([]);
            await expect(paginateFirestoreQuery(query, { cursor: 'invalid!!!' }))
                .rejects.toThrow('invalid-cursor');
        });

        it('timestamps iguais usam document ID como tie-breaker no cursor', async () => {
            const sameTimestamp = '2024-01-01T00:00:00.000Z';
            const docs = [
                createMockDoc({ id: 'doc_a', createdAt: sameTimestamp }),
                createMockDoc({ id: 'doc_b', createdAt: sameTimestamp }),
                createMockDoc({ id: 'doc_c', createdAt: sameTimestamp }),
            ];
            const query = createMockQuery(docs);

            const result = await paginateFirestoreQuery(query, { limit: 2 });
            expect(result.docs).toHaveLength(2);
            expect(result.nextCursor).not.toBeNull();

            // O cursor deve conter [timestamp, docId]
            const decoded = decodeCursor(result.nextCursor);
            expect(decoded).toEqual([sameTimestamp, 'doc_b']);
        });

        it('não duplica documentos entre páginas', async () => {
            const docs = [
                createMockDoc({ id: 'doc1', createdAt: '2024-01-03T00:00:00.000Z' }),
                createMockDoc({ id: 'doc2', createdAt: '2024-01-02T00:00:00.000Z' }),
                createMockDoc({ id: 'doc3', createdAt: '2024-01-01T00:00:00.000Z' }),
            ];
            const allIds = [];

            // Página 1
            const q1 = createMockQuery(docs);
            const p1 = await paginateFirestoreQuery(q1, { limit: 1 });
            allIds.push(...p1.docs.map((d) => d.id));

            // Página 2
            const q2 = createMockQuery(docs.slice(1));
            const p2 = await paginateFirestoreQuery(q2, { limit: 1, cursor: p1.nextCursor });
            allIds.push(...p2.docs.map((d) => d.id));

            // Página 3
            const q3 = createMockQuery(docs.slice(2));
            const p3 = await paginateFirestoreQuery(q3, { limit: 1, cursor: p2.nextCursor });
            allIds.push(...p3.docs.map((d) => d.id));

            const uniqueIds = [...new Set(allIds)];
            expect(uniqueIds).toEqual(allIds);
            expect(uniqueIds).toEqual(['doc1', 'doc2', 'doc3']);
        });

        it('não omite documentos entre páginas', async () => {
            const docs = [
                createMockDoc({ id: 'doc1', createdAt: '2024-01-03T00:00:00.000Z' }),
                createMockDoc({ id: 'doc2', createdAt: '2024-01-02T00:00:00.000Z' }),
                createMockDoc({ id: 'doc3', createdAt: '2024-01-01T00:00:00.000Z' }),
            ];
            const allIds = [];

            const q1 = createMockQuery(docs);
            const p1 = await paginateFirestoreQuery(q1, { limit: 1 });
            allIds.push(...p1.docs.map((d) => d.id));

            const q2 = createMockQuery(docs.slice(1));
            const p2 = await paginateFirestoreQuery(q2, { limit: 1, cursor: p1.nextCursor });
            allIds.push(...p2.docs.map((d) => d.id));

            const q3 = createMockQuery(docs.slice(2));
            const p3 = await paginateFirestoreQuery(q3, { limit: 1, cursor: p2.nextCursor });
            allIds.push(...p3.docs.map((d) => d.id));

            expect(allIds).toContain('doc1');
            expect(allIds).toContain('doc2');
            expect(allIds).toContain('doc3');
        });
    });
});
