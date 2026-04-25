/**
 * Middleware: requireAuth
 * Wraps callable handlers to enforce authentication.
 */

const { HttpsError } = require('firebase-functions/v2/https');
const { ERRORS, throwError } = require('../constants/errors');

/**
 * Wrap a callable handler to require authentication.
 * Injects `uid` and `auth` into the request context.
 * @param {Function} handler — async (req) => result
 * @returns {Function}
 */
function requireAuth(handler) {
  return async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
      throwError('AUTH_REQUIRED');
    }
    // Attach uid for downstream use
    req._uid = uid;
    return handler(req);
  };
}

/**
 * Require authentication and optionally verify token claims.
 * @param {Function} handler
 * @param {object} opts — { checkEmailVerified: boolean }
 */
function requireAuthWithClaims(handler, opts = {}) {
  return async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
      throwError('AUTH_REQUIRED');
    }
    if (opts.checkEmailVerified && !req.auth.token.email_verified) {
      throw new HttpsError('failed-precondition', 'Email nao verificado.');
    }
    req._uid = uid;
    return handler(req);
  };
}

module.exports = {
  requireAuth,
  requireAuthWithClaims,
};
