/**
 * Rate limiter usando Firestore como store.
 *
 * Usa janela deslizante com runTransaction para atomicidade.
 * Ideal para proteger endpoints contra reexecução acidental
 * ou abuso de callables administrativos.
 *
 * @example
 *   await checkRateLimit(uid, { windowMs: 60000, maxRequests: 5, key: 'backfill' });
 */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 10;
const COLLECTION = 'rateLimits';

// Para testes: permite injetar um mock de db
let _testDb = null;

function _setTestDb(mockDb) {
    _testDb = mockDb;
}

function _getDb() {
    return _testDb || getFirestore();
}

/**
 * Verifica se o identificador excedeu o limite de requisições na janela de tempo.
 *
 * @param {string} identifier - UID do usuário ou outro identificador único
 * @param {Object} options
 * @param {number} [options.windowMs=60000] - Janela de tempo em milissegundos
 * @param {number} [options.maxRequests=10] - Máximo de requisições permitidas na janela
 * @param {string} [options.key='default'] - Chave de contexto para diferentes limites por identificador
 * @throws {Error} com code: 'resource-exhausted' se limite excedido
 */
async function checkRateLimit(identifier, { windowMs = DEFAULT_WINDOW_MS, maxRequests = DEFAULT_MAX_REQUESTS, key = 'default' } = {}) {
    if (!identifier || typeof identifier !== 'string') {
        throw new Error('checkRateLimit: identifier é obrigatório e deve ser string');
    }

    const db = _getDb();
    const docId = `${identifier}:${key}`;
    const ref = db.collection(COLLECTION).doc(docId);
    const now = Date.now();
    const windowStart = now - windowMs;

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};
        const requests = Array.isArray(data.requests) ? data.requests : [];

        // Filtrar apenas requisições dentro da janela
        const recent = requests.filter((ts) => ts > windowStart);

        if (recent.length >= maxRequests) {
            const err = new Error('RATE_LIMIT_EXCEEDED');
            err.code = 'resource-exhausted';
            throw err;
        }

        recent.push(now);
        tx.set(ref, { requests: recent, updatedAt: FieldValue.serverTimestamp() });
    });
}

module.exports = { checkRateLimit, _setTestDb };
