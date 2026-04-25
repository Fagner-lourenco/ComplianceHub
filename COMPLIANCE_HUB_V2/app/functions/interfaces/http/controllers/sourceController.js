/**
 * Controller: Source REST API
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../../constants/collections');
const { BDC_DATASETS } = require('../../../adapters/bigdatacorpCatalog');

const db = getFirestore();

async function sourceController(req, res) {
  const method = req.method;
  const path = req.routePath || '/';

  if (method === 'GET' && path === '/') {
    return await listSources(req, res);
  }
  if (method === 'GET' && /^\/[^/]+$/.test(path)) {
    return await getSourceDetail(req, res);
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
  });
}

async function listSources(req, res) {
  const { subjectType } = req.query;

  const sources = Object.values(BDC_DATASETS)
    .filter(ds => !subjectType || ds.applicableTo.includes(subjectType))
    .map(ds => ({
      key: ds.key,
      name: ds.key,
      description: ds.description,
      cost: typeof ds.cost === 'object' ? ds.cost : { default: ds.cost },
      applicableTo: ds.applicableTo,
      hasPagination: ds.pagination || false,
    }));

  res.json({ success: true, data: { sources } });
}

async function getSourceDetail(req, res) {
  const sourceKey = req.routePath.split('/')[1];
  const ds = BDC_DATASETS[sourceKey];

  if (!ds) {
    return res.status(404).json({
      success: false,
      error: { code: 'SOURCE_NOT_FOUND', message: 'Fonte não encontrada.' },
    });
  }

  res.json({
    success: true,
    data: {
      key: ds.key,
      description: ds.description,
      endpoint: ds.endpoint,
      cost: ds.cost,
      applicableTo: ds.applicableTo,
      fields: ds.fields || [],
      pagination: ds.pagination || false,
      maxLimit: ds.maxLimit || null,
      freshnessHours: ds.freshnessHours || 24,
    },
  });
}

module.exports = { sourceController };
