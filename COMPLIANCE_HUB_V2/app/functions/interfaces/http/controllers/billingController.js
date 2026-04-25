/**
 * Controller: Billing REST API
 * Wraps legacy bootstrap billing functions as REST endpoints.
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../../constants/collections');
const { resolveTenantEntitlements, isTenantFeatureEnabled, FEATURE_FLAGS } = require('../../../domain/v2EntitlementResolver');

const db = getFirestore();
const bootstrap = require('../../../bootstrap');

async function billingController(req, res) {
  const method = req.method;
  const path = req.routePath || '/';

  if (method === 'GET' && path === '/') {
    return await getBillingOverview(req, res);
  }
  if (method === 'GET' && path === '/settlement') {
    return await getBillingSettlement(req, res);
  }
  if (method === 'GET' && path === '/drilldown') {
    return await getBillingDrilldown(req, res);
  }
  if (method === 'POST' && path === '/close-period') {
    return await closeBillingPeriod(req, res);
  }

  return res.status(405).json({
    success: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
  });
}

async function requireBillingFeature(req, res) {
  try {
    const tenantId = req.tenantId;
    const tenantSnap = await db.collection(COLLECTIONS.TENANT_ENTITLEMENTS).doc(tenantId).get();
    const entitlements = resolveTenantEntitlements(tenantSnap.exists ? tenantSnap.data() : {});
    if (!isTenantFeatureEnabled(entitlements, FEATURE_FLAGS.BILLING_DASHBOARD)) {
      res.status(403).json({
        success: false,
        error: { code: 'NOT_ENTITLED', message: 'Billing não disponível para este tenant.' },
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

async function getBillingOverview(req, res) {
  if (!(await requireBillingFeature(req, res))) return;
  try {
    const result = await bootstrap.getTenantBillingOverview({
      auth: { token: { uid: req.uid } },
      data: { tenantId: req.tenantId },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: err.code || 'INTERNAL_ERROR', message: err.message } });
  }
}

async function getBillingSettlement(req, res) {
  if (!(await requireBillingFeature(req, res))) return;
  try {
    const result = await bootstrap.getTenantBillingSettlement({
      auth: { token: { uid: req.uid } },
      data: { tenantId: req.tenantId, period: req.query.period },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: err.code || 'INTERNAL_ERROR', message: err.message } });
  }
}

async function getBillingDrilldown(req, res) {
  if (!(await requireBillingFeature(req, res))) return;
  try {
    const result = await bootstrap.getTenantBillingDrilldown({
      auth: { token: { uid: req.uid } },
      data: { tenantId: req.tenantId, period: req.query.period },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: err.code || 'INTERNAL_ERROR', message: err.message } });
  }
}

async function closeBillingPeriod(req, res) {
  if (!(await requireBillingFeature(req, res))) return;
  try {
    const result = await bootstrap.closeTenantBillingPeriodByAnalyst({
      auth: { token: { uid: req.uid } },
      data: { tenantId: req.tenantId, period: req.body.period },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: err.code || 'INTERNAL_ERROR', message: err.message } });
  }
}

module.exports = { billingController };
