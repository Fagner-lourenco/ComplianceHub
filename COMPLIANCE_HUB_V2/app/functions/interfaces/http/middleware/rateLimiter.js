/**
 * Middleware: Rate Limiter
 * Simple in-memory rate limiting per tenant and per user.
 * Future: replace with Redis / Memorystore for distributed rate limiting.
 */

// In-memory store: { key: { count, resetAt } }
const rateStore = new Map();

const DEFAULT_LIMITS = {
  tenant: { max: 100, windowMs: 60_000 },      // 100 req/min per tenant
  user: { max: 30, windowMs: 60_000 },         // 30 req/min per user
  dossierCreation: { max: 50, windowMs: 3_600_000 }, // 50/hour per tenant
};

function getWindowKey(windowMs) {
  return Math.floor(Date.now() / windowMs);
}

function checkLimit(key, config) {
  const now = Date.now();
  const windowKey = getWindowKey(config.windowMs);
  const storeKey = `${key}:${windowKey}`;

  const entry = rateStore.get(storeKey);
  if (!entry) {
    rateStore.set(storeKey, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.max - 1 };
  }

  if (entry.count >= config.max) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true, remaining: config.max - entry.count };
}

/**
 * Rate limit middleware factory.
 * @param {string} type — 'tenant' | 'user' | 'dossierCreation'
 */
function rateLimit(type = 'tenant') {
  const config = DEFAULT_LIMITS[type];
  return async (req, res, next) => {
    const key = type === 'user' ? req.uid : req.tenantId;
    if (!key) {
      return next();
    }

    const result = checkLimit(key, config);
    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Limite de requisições excedido. Tente novamente em breve.',
          retryAfterMs: result.retryAfterMs,
        },
      });
    }

    res.setHeader('X-RateLimit-Remaining', result.remaining);
    return next();
  };
}

module.exports = { rateLimit };
