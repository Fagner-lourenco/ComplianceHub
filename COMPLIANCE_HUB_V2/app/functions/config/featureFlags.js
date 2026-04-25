/**
 * Config: Feature Flags
 * Runtime feature toggles.
 */

const { ENV } = require('./environment');

const FEATURES = {
  // Core
  CASE_CREATION: ENV.enableAutoProcess,
  BDC_FIRST: ENV.enableBdcFirst,
  SCORE_ENGINE: ENV.enableScoreEngine,

  // Providers
  ENABLE_JUDIT: true,
  ENABLE_ESCAVADOR: true,
  ENABLE_FONTEDATA: true,
  ENABLE_BIGDATACORP: true,
  ENABLE_DJEN: true,

  // Features
  REPORT_EXPORT_PDF: true,
  EVIDENCE_ITEMS: true,
  RISK_SIGNALS: true,
  TIMELINE_VIEW: true,
  WATCHLIST_MONITORING: true,
  CLIENT_PORTAL: true,
  BILLING_DASHBOARD: true,
  SENIOR_REVIEW_QUEUE: true,
  AI_ANALYSIS: true,
  PUBLIC_REPORTS: true,

  // Cache
  CACHE_PROVIDER_LEDGER: ENV.enableCache,
  CACHE_MEMORY: ENV.enableCache,
};

function isEnabled(featureKey) {
  return FEATURES[featureKey] === true;
}

function requireFeature(featureKey) {
  if (!isEnabled(featureKey)) {
    const error = new Error(`Feature ${featureKey} is disabled.`);
    error.code = 'FEATURE_DISABLED';
    throw error;
  }
}

module.exports = { FEATURES, isEnabled, requireFeature };
