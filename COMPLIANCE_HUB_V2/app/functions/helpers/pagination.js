/**
 * Helper: Pagination
 * Cursor-based pagination helpers for Firestore queries.
 */

/**
 * Encode a Firestore document snapshot into a cursor string.
 * @param {object} doc — Firestore document snapshot
 * @returns {string} base64-encoded cursor
 */
function encodeCursor(doc) {
  if (!doc || !doc.exists) return null;
  const data = doc.data();
  const cursor = {
    id: doc.id,
    createdAt: data.createdAt?.toMillis?.() || data.createdAt || null,
  };
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

/**
 * Decode a cursor string back into pagination params.
 * @param {string} cursor
 * @returns {object|null} { id, createdAt }
 */
function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Apply pagination to a Firestore query.
 * @param {object} query — Firestore Query
 * @param {object} options
 * @param {number} options.limit — max items per page
 * @param {string|null} options.cursor — base64 cursor
 * @param {string} options.orderField — field to order by (default 'createdAt')
 * @param {string} options.orderDirection — 'asc' | 'desc' (default 'desc')
 * @returns {object} { query, limit }
 */
function applyPagination(query, options = {}) {
  const limit = Math.min(Math.max(options.limit || 20, 1), 100);
  const orderField = options.orderField || 'createdAt';
  const orderDirection = options.orderDirection || 'desc';

  let paginatedQuery = query.orderBy(orderField, orderDirection).limit(limit + 1);

  const cursor = decodeCursor(options.cursor);
  if (cursor && cursor.createdAt) {
    const startAfterValue = cursor.createdAt;
    paginatedQuery = paginatedQuery.startAfter(startAfterValue);
  }

  return { query: paginatedQuery, limit };
}

/**
 * Build paginated response from Firestore snapshot.
 * @param {object} snapshot — Firestore QuerySnapshot
 * @param {number} limit — original limit (without +1)
 * @param {Function} mapFn — (doc) => item
 * @returns {object} { items, meta: { hasMore, nextCursor, total } }
 */
function buildPaginatedResponse(snapshot, limit, mapFn) {
  const docs = snapshot.docs;
  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit).map(mapFn);

  let nextCursor = null;
  if (hasMore && docs.length > 0) {
    const lastDoc = docs[limit - 1];
    nextCursor = encodeCursor(lastDoc);
  }

  return {
    items,
    meta: {
      hasMore,
      nextCursor,
      perPage: limit,
      returned: items.length,
    },
  };
}

module.exports = { encodeCursor, decodeCursor, applyPagination, buildPaginatedResponse };
