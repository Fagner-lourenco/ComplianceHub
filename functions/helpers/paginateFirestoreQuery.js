/**
 * Helper de cursor pagination para Firestore.
 *
 * Requisitos:
 * - Cursor composto com tie-breaker obrigatório por document ID (__name__)
 * - Encoder Base64 URL-safe
 * - Busca limit + 1 para calcular hasMore sem scan completo
 * - Sem acumulação em memória
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const MIN_LIMIT = 1;

function encodeCursor(cursorValues) {
    const json = JSON.stringify(cursorValues);
    return Buffer.from(json)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function decodeCursor(cursorString) {
    if (!cursorString || typeof cursorString !== 'string') {
        throw new Error('invalid-cursor');
    }
    let base64 = cursorString
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    // Adiciona padding necessário
    while (base64.length % 4 !== 0) {
        base64 += '=';
    }
    try {
        const json = Buffer.from(base64, 'base64').toString('utf8');
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed) || parsed.length < 2) {
            throw new Error('invalid-cursor');
        }
        return parsed;
    } catch {
        throw new Error('invalid-cursor');
    }
}

function normalizeLimit(limit) {
    if (limit === undefined || limit === null) return DEFAULT_LIMIT;
    const num = Number(limit);
    if (!Number.isFinite(num) || Number.isNaN(num)) return DEFAULT_LIMIT;
    if (num < MIN_LIMIT) return MIN_LIMIT;
    if (num > MAX_LIMIT) return MAX_LIMIT;
    return num;
}

/**
 * Pagina uma query do Firestore usando cursor composto.
 *
 * @param {FirebaseFirestore.Query} baseQuery - Query base do Firestore (já com where/orderBy)
 * @param {Object} options
 * @param {string|null} options.cursor - Cursor codificado (Base64 URL-safe)
 * @param {number} options.limit - Tamanho da página (default: 50, max: 500)
 * @param {string} options.cursorField - Campo principal do cursor (default: 'createdAt')
 * @param {'asc'|'desc'} options.cursorDir - Direção do cursor (default: 'desc')
 * @returns {Promise<{docs: Array, nextCursor: string|null, hasMore: boolean, pageSize: number}>}
 */
async function paginateFirestoreQuery(baseQuery, options = {}) {
    const pageSize = normalizeLimit(options.limit);
    const cursorField = String(options.cursorField || 'createdAt');

    let query = baseQuery;

    if (options.cursor) {
        const cursorValues = decodeCursor(options.cursor);
        // cursorValues = [fieldValue, docId]
        query = query.startAfter(...cursorValues);
    }

    query = query.limit(pageSize + 1);
    const snapshot = await query.get();
    const docs = snapshot.docs || [];

    const hasMore = docs.length > pageSize;
    const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;

    let nextCursor = null;
    if (hasMore && resultDocs.length > 0) {
        const lastDoc = resultDocs[resultDocs.length - 1];
        const fieldValue = lastDoc.get(cursorField);
        const docId = lastDoc.id;
        nextCursor = encodeCursor([fieldValue, docId]);
    }

    return {
        docs: resultDocs,
        nextCursor,
        hasMore,
        pageSize,
    };
}

module.exports = {
    paginateFirestoreQuery,
    encodeCursor,
    decodeCursor,
    normalizeLimit,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    MIN_LIMIT,
};
