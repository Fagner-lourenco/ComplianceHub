/**
 * Routes: REST API V1 Router
 * Dispatches onRequest calls to the appropriate controller.
 */

const { dossierController } = require('./controllers/dossierController');
const { sourceController } = require('./controllers/sourceController');
const { profileController } = require('./controllers/profileController');
const { analysisController } = require('./controllers/analysisController');
const { billingController } = require('./controllers/billingController');
const { seniorReviewController } = require('./controllers/seniorReviewController');
const { watchlistController } = require('./controllers/watchlistController');
const { reportController } = require('./controllers/reportController');

/**
 * Main router dispatcher.
 * @param {object} req
 * @param {object} res
 */
async function router(req, res) {
  const basePath = req.path || req.url?.split('?')[0] || '/';

  if (basePath.startsWith('/dossiers')) {
    req.routePath = basePath.replace('/dossiers', '') || '/';
    return dossierController(req, res);
  }

  if (basePath.startsWith('/sources')) {
    req.routePath = basePath.replace('/sources', '') || '/';
    return sourceController(req, res);
  }

  if (basePath.startsWith('/profiles')) {
    req.routePath = basePath.replace('/profiles', '') || '/';
    return profileController(req, res);
  }

  if (basePath.startsWith('/analysis')) {
    req.routePath = basePath.replace('/analysis', '') || '/';
    return analysisController(req, res);
  }

  if (basePath.startsWith('/billing')) {
    req.routePath = basePath.replace('/billing', '') || '/';
    return billingController(req, res);
  }

  if (basePath.startsWith('/senior-review')) {
    req.routePath = basePath.replace('/senior-review', '') || '/';
    return seniorReviewController(req, res);
  }

  if (basePath.startsWith('/watchlists')) {
    req.routePath = basePath.replace('/watchlists', '') || '/';
    return watchlistController(req, res);
  }

  if (basePath.startsWith('/reports')) {
    req.routePath = basePath.replace('/reports', '') || '/';
    return reportController(req, res);
  }

  res.status(404).json({
    success: false,
    error: { code: 'ROUTE_NOT_FOUND', message: 'Rota não encontrada.' },
  });
}

module.exports = { router };
