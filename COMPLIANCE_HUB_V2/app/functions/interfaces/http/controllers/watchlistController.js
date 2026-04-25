/**
 * Controller: Watchlist REST API
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../../constants/collections');
const { resolveTenantEntitlements, isTenantFeatureEnabled, FEATURE_FLAGS } = require('../../../domain/v2EntitlementResolver');
const { applyPagination, buildPaginatedResponse } = require('../../../helpers/pagination');

const db = getFirestore();
const bootstrap = require('../../../bootstrap');

async function watchlistController(req, res) {
  const method = req.method;
  const path = req.routePath || '/';

  if (method === 'GET' && path === '/') {
    return await listWatchlists(req, res);
  }
  if (method === 'POST' && path === '/') {
    return await createWatchlist(req, res);
  }
  if (method === 'POST' && /^\/[^/]+\/pause$/.test(path)) {
    return await pauseWatchlist(req, res);
  }
  if (method === 'POST' && /^\/[^/]+\/resume$/.test(path)) {
    return await resumeWatchlist(req, res);
  }
  if (method === 'POST' && /^\/[^/]+\/run$/.test(path)) {
    return await runWatchlistNow(req, res);
  }
  if (method === 'DELETE' && /^\/[^/]+$/.test(path)) {
    return await deleteWatchlist(req, res);
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
  });
}

async function requireWatchlistFeature(req, res) {
  try {
    const tenantId = req.tenantId;
    const tenantSnap = await db.collection(COLLECTIONS.TENANT_ENTITLEMENTS).doc(tenantId).get();
    const entitlements = resolveTenantEntitlements(tenantSnap.exists ? tenantSnap.data() : {});
    if (!isTenantFeatureEnabled(entitlements, FEATURE_FLAGS.WATCHLIST_MONITORING)) {
      res.status(403).json({
        success: false,
        error: { code: 'NOT_ENTITLED', message: 'Monitoramento não disponível para este tenant.' },
      });
      return false;
    }
    return true;
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'ENTITLEMENT_CHECK_FAILED', message: err.message },
    });
    return false;
  }
}

async function listWatchlists(req, res) {
  if (!(await requireWatchlistFeature(req, res))) return;
  const tenantId = req.tenantId;
  const { cursor, limit = '20' } = req.query;

  let query = db.collection(COLLECTIONS.WATCHLISTS)
    .where('tenantId', '==', tenantId)
    .orderBy('createdAt', 'desc');

  const { query: paginatedQuery, limit: pageLimit } = applyPagination(query, {
    limit: parseInt(limit),
    cursor,
    orderField: 'createdAt',
    orderDirection: 'desc',
  });

  const snapshot = await paginatedQuery.get();
  const result = buildPaginatedResponse(snapshot, pageLimit, (doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  res.json({ success: true, data: { watchlists: result.items }, meta: result.meta });
}

async function createWatchlist(req, res) {
  if (!(await requireWatchlistFeature(req, res))) return;
  try {
    const result = await bootstrap.createWatchlist({
      auth: { token: { uid: req.uid } },
      data: { tenantId: req.tenantId, ...req.body },
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

async function pauseWatchlist(req, res) {
  if (!(await requireWatchlistFeature(req, res))) return;
  const watchlistId = req.routePath.split('/')[1];
  try {
    const result = await bootstrap.pauseWatchlist({
      auth: { token: { uid: req.uid } },
      data: { watchlistId },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

async function resumeWatchlist(req, res) {
  if (!(await requireWatchlistFeature(req, res))) return;
  const watchlistId = req.routePath.split('/')[1];
  try {
    const result = await bootstrap.resumeWatchlist({
      auth: { token: { uid: req.uid } },
      data: { watchlistId },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

async function runWatchlistNow(req, res) {
  if (!(await requireWatchlistFeature(req, res))) return;
  const watchlistId = req.routePath.split('/')[1];
  try {
    const result = await bootstrap.runWatchlistNow({
      auth: { token: { uid: req.uid } },
      data: { watchlistId },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

async function deleteWatchlist(req, res) {
  if (!(await requireWatchlistFeature(req, res))) return;
  const watchlistId = req.routePath.split('/')[1];
  try {
    const result = await bootstrap.deleteWatchlist({
      auth: { token: { uid: req.uid } },
      data: { watchlistId },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

module.exports = { watchlistController };
