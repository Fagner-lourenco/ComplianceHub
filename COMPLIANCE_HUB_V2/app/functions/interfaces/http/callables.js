/**
 * HTTP Callable Functions Registry
 * All onCall exports organized by domain.
 *
 * Migration strategy: functions are imported from bootstrap (legacy monolith)
 * and re-exported here. Over time, each function will be moved into its own
 * file in application/ and imported directly.
 */

const bootstrap = require('../../bootstrap');

// ---------------------------------------------------------------------------
// Auth & User Management
// ---------------------------------------------------------------------------
exports.createOpsClientUser = bootstrap.createOpsClientUser;
exports.listTenantUsers = bootstrap.listTenantUsers;
exports.createTenantUser = bootstrap.createTenantUser;
exports.updateTenantUser = bootstrap.updateTenantUser;
exports.updateOwnProfile = bootstrap.updateOwnProfile;

// ---------------------------------------------------------------------------
// Dossier / Case Operations
// ---------------------------------------------------------------------------
exports.createClientSolicitation = bootstrap.createClientSolicitation;
exports.submitClientCorrection = bootstrap.submitClientCorrection;
exports.assignCaseToCurrentAnalyst = bootstrap.assignCaseToCurrentAnalyst;
exports.returnCaseToClient = bootstrap.returnCaseToClient;
exports.concludeCaseByAnalyst = bootstrap.concludeCaseByAnalyst;
exports.saveCaseDraftByAnalyst = bootstrap.saveCaseDraftByAnalyst;
exports.resolveProviderDivergenceByAnalyst = bootstrap.resolveProviderDivergenceByAnalyst;
exports.rerunEnrichmentPhase = bootstrap.rerunEnrichmentPhase;
exports.materializeV2Artifacts = bootstrap.materializeV2Artifacts;

// ---------------------------------------------------------------------------
// BDC / Enrichment Preview
// ---------------------------------------------------------------------------
exports.v2PreviewBigDataCorp = bootstrap.v2PreviewBigDataCorp;

// ---------------------------------------------------------------------------
// Product & Feature Flags
// ---------------------------------------------------------------------------
exports.v2MarkProductIntroSeen = bootstrap.v2MarkProductIntroSeen;
exports.v2GetFeatureFlags = bootstrap.v2GetFeatureFlags;
exports.getClientProductCatalog = bootstrap.getClientProductCatalog;

// ---------------------------------------------------------------------------
// Reports & Exports
// ---------------------------------------------------------------------------
exports.registerClientExport = bootstrap.registerClientExport;
exports.backfillClientCasesMirror = bootstrap.backfillClientCasesMirror;
exports.createAnalystPublicReport = bootstrap.createAnalystPublicReport;
exports.createClientPublicReport = bootstrap.createClientPublicReport;
exports.listClientPublicReports = bootstrap.listClientPublicReports;
exports.revokeClientPublicReport = bootstrap.revokeClientPublicReport;
exports.revokePublicReport = bootstrap.revokePublicReport;

// ---------------------------------------------------------------------------
// Tenant Settings & Entitlements
// ---------------------------------------------------------------------------
exports.updateTenantSettingsByAnalyst = bootstrap.updateTenantSettingsByAnalyst;
exports.getTenantEntitlementsByAnalyst = bootstrap.getTenantEntitlementsByAnalyst;
exports.updateTenantEntitlementsByAnalyst = bootstrap.updateTenantEntitlementsByAnalyst;

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
exports.getTenantBillingOverview = bootstrap.getTenantBillingOverview;
exports.closeTenantBillingPeriodByAnalyst = bootstrap.closeTenantBillingPeriodByAnalyst;
exports.getTenantBillingSettlement = bootstrap.getTenantBillingSettlement;
exports.getTenantBillingDrilldown = bootstrap.getTenantBillingDrilldown;
exports.exportTenantBillingDrilldown = bootstrap.exportTenantBillingDrilldown;

// ---------------------------------------------------------------------------
// Senior Review Queue
// ---------------------------------------------------------------------------
exports.getSeniorReviewQueue = bootstrap.getSeniorReviewQueue;
exports.resolveSeniorReviewRequest = bootstrap.resolveSeniorReviewRequest;

// ---------------------------------------------------------------------------
// AI / Analysis
// ---------------------------------------------------------------------------
exports.setAiDecisionByAnalyst = bootstrap.setAiDecisionByAnalyst;
exports.rerunAiAnalysis = bootstrap.rerunAiAnalysis;

// ---------------------------------------------------------------------------
// Monitoring & Watchlists
// ---------------------------------------------------------------------------
exports.createWatchlist = bootstrap.createWatchlist;
exports.pauseWatchlist = bootstrap.pauseWatchlist;
exports.resumeWatchlist = bootstrap.resumeWatchlist;
exports.deleteWatchlist = bootstrap.deleteWatchlist;
exports.runWatchlistNow = bootstrap.runWatchlistNow;
exports.markAlertAs = bootstrap.markAlertAs;

// ---------------------------------------------------------------------------
// System & Ops
// ---------------------------------------------------------------------------
exports.getSystemHealth = bootstrap.getSystemHealth;
exports.getClientQuotaStatus = bootstrap.getClientQuotaStatus;
exports.getOpsV2Metrics = bootstrap.getOpsV2Metrics;

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------
exports.createQuoteRequest = bootstrap.createQuoteRequest;
exports.resolveQuoteRequest = bootstrap.resolveQuoteRequest;
