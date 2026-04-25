/**
 * Controller: Senior Review Queue REST API
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../../constants/collections');
const { applyPagination, buildPaginatedResponse } = require('../../../helpers/pagination');

const db = getFirestore();
const bootstrap = require('../../../bootstrap');

async function seniorReviewController(req, res) {
  const method = req.method;
  const path = req.routePath || '/';

  if (method === 'GET' && path === '/') {
    return await listQueue(req, res);
  }
  if (method === 'POST' && /^\/[^/]+\/resolve$/.test(path)) {
    return await resolveRequest(req, res);
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
  });
}

async function listQueue(req, res) {
  const tenantId = req.tenantId;
  const { status, cursor, limit = '20' } = req.query;

  let query = db.collection(COLLECTIONS.SENIOR_REVIEW_REQUESTS)
    .where('tenantId', '==', tenantId)
    .orderBy('createdAt', 'desc');

  if (status) query = query.where('status', '==', status);

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

  res.json({ success: true, data: { requests: result.items }, meta: result.meta });
}

async function resolveRequest(req, res) {
  const requestId = req.routePath.split('/')[1];
  const body = req.body || {};

  try {
    const result = await bootstrap.resolveSeniorReviewRequest({
      auth: { token: { uid: req.uid } },
      data: { requestId, resolution: body.resolution, notes: body.notes },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

module.exports = { seniorReviewController };
