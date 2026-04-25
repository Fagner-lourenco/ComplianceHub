/**
 * Middleware: Error Handler
 * Standardizes error responses across all REST endpoints.
 */

/**
 * Map internal error codes to HTTP status codes.
 */
const ERROR_STATUS_MAP = {
  AUTH_REQUIRED: 401,
  PROFILE_NOT_FOUND: 404,
  TENANT_REQUIRED: 403,
  CASE_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  REPORT_NOT_FOUND: 404,
  WATCHLIST_NOT_FOUND: 404,
  QUOTE_NOT_FOUND: 404,
  SENIOR_NOT_FOUND: 404,
  INVALID_ARGUMENT: 400,
  INVALID_CPF: 400,
  INVALID_CNPJ: 400,
  INVALID_DOCUMENT: 400,
  CASE_ID_REQUIRED: 400,
  TENANT_ID_REQUIRED: 400,
  PERMISSION_DENIED: 403,
  CASE_NOT_IN_TENANT: 403,
  ACCESS_DENIED_CASE: 403,
  ADMIN_REQUIRED: 403,
  FAILED_PRECONDITION: 409,
  CASE_NOT_DONE: 409,
  CASE_ALREADY_CONCLUDED: 409,
  CORRECTION_ONLY: 409,
  TENANT_NOT_IDENTIFIED: 409,
  CASE_CREATION_DISABLED: 409,
  PRODUCT_DISABLED: 409,
  RESOURCE_EXHAUSTED: 429,
  AI_RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Generate a request ID for tracing.
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Express-style error handler for onRequest functions.
 */
function errorHandler(err, req, res) {
  const requestId = req.requestId || generateRequestId();
  const code = err.code || 'INTERNAL_ERROR';
  const status = ERROR_STATUS_MAP[code] || err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor.';

  // Log structured error
  console.error(JSON.stringify({
    severity: 'ERROR',
    requestId,
    code,
    status,
    message,
    path: req.path,
    method: req.method,
    tenantId: req.tenantId || null,
    uid: req.uid || null,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  }));

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      requestId,
      details: err.details || undefined,
    },
  });
}

module.exports = { errorHandler, generateRequestId };
