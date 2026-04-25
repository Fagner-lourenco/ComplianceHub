/**
 * Constants: Firestore Collection Names
 * Centralizes all collection names to prevent typos and ease migrations.
 */

const COLLECTIONS = {
  CASES: 'cases',
  CLIENT_CASES: 'clientCases',
  CLIENT_CASE_LIST: 'clientCaseList',
  CLIENT_PROJECTIONS: 'clientProjections',
  CANDIDATES: 'candidates',
  SUBJECTS: 'subjects',
  RELATIONSHIPS: 'relationships',
  MODULE_RUNS: 'moduleRuns',
  EVIDENCE_ITEMS: 'evidenceItems',
  RISK_SIGNALS: 'riskSignals',
  TIMELINE_EVENTS: 'timelineEvents',
  PROVIDER_DIVERGENCES: 'providerDivergences',
  PROVIDER_RECORDS: 'providerRecords',
  PROVIDER_REQUESTS: 'providerRequests',
  RAW_SNAPSHOTS: 'rawSnapshots',
  REPORT_SNAPSHOTS: 'reportSnapshots',
  PUBLIC_REPORTS: 'publicReports',
  DECISIONS: 'decisions',

  // Tenant & User
  TENANT_SETTINGS: 'tenantSettings',
  TENANT_ENTITLEMENTS: 'tenantEntitlements',
  TENANT_USAGE: 'tenantUsage',
  USER_PROFILES: 'userProfiles',

  // Billing
  BILLING_ENTRIES: 'billingEntries',
  BILLING_SETTLEMENTS: 'billingSettlements',
  USAGE_METERS: 'usageMeters',

  // Monitoring & Alerts
  WATCHLISTS: 'watchlists',
  ALERTS: 'alerts',

  // Ops
  SENIOR_REVIEW_REQUESTS: 'seniorReviewRequests',
  QUOTE_REQUESTS: 'quoteRequests',
  EXPORTS: 'exports',

  // Webhooks
  JUDIT_WEBHOOK_REQUESTS: 'juditWebhookRequests',
};

module.exports = { COLLECTIONS };
