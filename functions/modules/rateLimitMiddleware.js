/**
 * rateLimitMiddleware.js — Middleware de rate limiting para Cloud Functions.
 *
 * Aplica checkRateLimit a todos os callables onCall de forma transparente.
 * O rate limiter persiste estado via Firestore (collection: rateLimits).
 */

const { checkRateLimit } = require('../helpers/rateLimiter');

function withRateLimit(options = {}) {
    const { maxRequests = 10, windowMs = 60000, key = 'default' } = options;

    return (handler) => {
        return async (request) => {
            const uid = request.auth?.uid;
            if (uid) {
                await checkRateLimit(uid, { maxRequests, windowMs, key });
            }
            return handler(request);
        };
    };
}

module.exports = { withRateLimit };
