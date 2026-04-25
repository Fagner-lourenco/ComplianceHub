/**
 * Controller: Report & Export REST API
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../../constants/collections');
const { applyPagination, buildPaginatedResponse } = require('../../../helpers/pagination');

const db = getFirestore();
const bootstrap = require('../../../bootstrap');

async function reportController(req, res) {
  const method = req.method;
  const path = req.routePath || '/';

  if (method === 'POST' && path === '/export') {
    return await registerExport(req, res);
  }
  if (method === 'POST' && path === '/public') {
    return await createPublicReport(req, res);
  }
  if (method === 'GET' && path === '/public') {
    return await listPublicReports(req, res);
  }
  if (method === 'POST' && /^\/public\/[^/]+\/revoke$/.test(path)) {
    return await revokePublicReport(req, res);
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
  });
}

async function registerExport(req, res) {
  const body = req.body || {};
  try {
    const result = await bootstrap.registerClientExport({
      auth: { token: { uid: req.uid } },
      data: { tenantId: req.tenantId, caseId: body.caseId, format: body.format },
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

async function createPublicReport(req, res) {
  const body = req.body || {};
  try {
    const result = await bootstrap.createAnalystPublicReport({
      auth: { token: { uid: req.uid } },
      data: { tenantId: req.tenantId, caseId: body.caseId, ...body },
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

async function listPublicReports(req, res) {
  const tenantId = req.tenantId;
  const { cursor, limit = '20' } = req.query;

  let query = db.collection(COLLECTIONS.PUBLIC_REPORTS)
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

  res.json({ success: true, data: { reports: result.items }, meta: result.meta });
}

async function revokePublicReport(req, res) {
  const reportId = req.routePath.split('/')[2];
  try {
    const result = await bootstrap.revokePublicReport({
      auth: { token: { uid: req.uid } },
      data: { reportId },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

module.exports = { reportController };
