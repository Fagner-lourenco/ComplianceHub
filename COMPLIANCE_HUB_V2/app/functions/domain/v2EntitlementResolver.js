'use strict';

const V2_ENTITLEMENT_RESOLVER_VERSION = 'v2-entitlement-resolver-2026-04-21';

// Tier order — higher index = more capabilities
const TIER_ORDER = ['basic', 'standard', 'professional', 'premium'];

// Feature flags controlled by tenant entitlements / tier
const FEATURE_FLAGS = {
    // Core
    CASE_CREATION: 'case_creation',
    REPORT_EXPORT_PDF: 'report_export_pdf',
    // Analytical
    EVIDENCE_ITEMS: 'evidence_items',
    RISK_SIGNALS: 'risk_signals',
    TIMELINE_VIEW: 'timeline_view',
    // Premium features (scaffolded — not yet wired to heavy infrastructure)
    WATCHLIST_MONITORING: 'watchlist_monitoring',
    ALERT_SUBSCRIPTIONS: 'alert_subscriptions',
    RELATIONSHIP_GRAPH: 'relationship_graph',
    ONGOING_MONITORING: 'ongoing_monitoring',
    // Ops-internal
    BILLING_DASHBOARD: 'billing_dashboard',
    AUDIT_EXPORT: 'audit_export',
};

// Which features are available per tier (minimum tier to unlock)
const FEATURE_MIN_TIER = {
    [FEATURE_FLAGS.CASE_CREATION]: 'basic',
    [FEATURE_FLAGS.REPORT_EXPORT_PDF]: 'basic',
    [FEATURE_FLAGS.EVIDENCE_ITEMS]: 'standard',
    [FEATURE_FLAGS.RISK_SIGNALS]: 'standard',
    [FEATURE_FLAGS.TIMELINE_VIEW]: 'standard',
    [FEATURE_FLAGS.WATCHLIST_MONITORING]: 'premium',
    [FEATURE_FLAGS.ALERT_SUBSCRIPTIONS]: 'premium',
    [FEATURE_FLAGS.RELATIONSHIP_GRAPH]: 'premium',
    [FEATURE_FLAGS.ONGOING_MONITORING]: 'premium',
    [FEATURE_FLAGS.BILLING_DASHBOARD]: 'professional',
    [FEATURE_FLAGS.AUDIT_EXPORT]: 'professional',
};

function normalizeTier(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return TIER_ORDER.includes(normalized) ? normalized : null;
}

function pickTier(...values) {
    for (const value of values) {
        const tier = normalizeTier(value);
        if (tier) return tier;
    }
    return 'basic';
}

function compareTier(tierA, tierB) {
    return TIER_ORDER.indexOf(normalizeTier(tierA) || 'basic')
        - TIER_ORDER.indexOf(normalizeTier(tierB) || 'basic');
}

function looksLikeLegacyTenantSettings(value) {
    return Boolean(value && typeof value === 'object' && (
        value.analysisConfig
        || value.enrichmentConfig
        || value.dailyLimit !== undefined
        || value.monthlyLimit !== undefined
    ));
}

function looksLikeEntitlementsDoc(value) {
    return Boolean(value && typeof value === 'object' && (
        value.enabledModules
        || value.modules
        || value.enabledProducts
        || value.products
        || value.enabledCapabilities
        || value.featureOverrides
        || value.billingOverrides
        || value.policyOverrides
        || value.tier
        || value.entitlementId
        || value.contractId
    ));
}

/**
 * Normalizes a raw Firestore tenant document into a structured entitlements object.
 * Falls back gracefully when fields are missing.
 */
function resolveTenantEntitlements(tenantDoc = {}) {
    const safeTenantDoc = tenantDoc && typeof tenantDoc === 'object' ? tenantDoc : {};
    const settings = safeTenantDoc.settings
        || safeTenantDoc.tenantSettings
        || (looksLikeLegacyTenantSettings(safeTenantDoc) ? safeTenantDoc : {});
    const contractDoc = safeTenantDoc.contract || safeTenantDoc.tenantContract || {};
    const rawEntitlements = safeTenantDoc.entitlements
        || safeTenantDoc.tenantEntitlements
        || (looksLikeEntitlementsDoc(safeTenantDoc) ? safeTenantDoc : {});

    // Tier resolution: contract > entitlements > settings > default
    const tier = pickTier(contractDoc.tier, rawEntitlements.tier, settings.tier);

    // Module entitlements: prefer entitlements doc, fallback to settings.analysisConfig
    const enabledModules = rawEntitlements.enabledModules
        || rawEntitlements.modules
        || settings.analysisConfig?.enabledModules
        || settings.analysisConfig
        || null;

    const enabledProducts = rawEntitlements.enabledProducts
        || rawEntitlements.products
        || null;

    // Explicit feature overrides (per-tenant toggles that override tier defaults)
    const featureOverrides = rawEntitlements.featureOverrides
        || contractDoc.featureOverrides
        || {};

    // Billing
    const billingModel = contractDoc.billingModel
        || rawEntitlements.billingModel
        || 'per_case';

    const maxCasesPerMonth = contractDoc.maxCasesPerMonth
        || rawEntitlements.maxCasesPerMonth
        || null;

    const entitlementId = rawEntitlements.entitlementId
        || contractDoc.contractId
        || (safeTenantDoc.tenantId ? `tenantEntitlements/${safeTenantDoc.tenantId}` : null);

    return {
        tier,
        entitlementId,
        enabledModules,
        enabledProducts,
        featureOverrides,
        billingModel,
        maxCasesPerMonth,
        resolverVersion: V2_ENTITLEMENT_RESOLVER_VERSION,
    };
}

/**
 * Returns true if a feature flag is enabled for the given resolved entitlements.
 * Explicit overrides take precedence over tier-based defaults.
 */
function isTenantFeatureEnabled(resolvedEntitlements = {}, featureKey) {
    if (!FEATURE_FLAGS[featureKey] && !Object.values(FEATURE_FLAGS).includes(featureKey)) {
        return false;
    }
    const flagValue = FEATURE_FLAGS[featureKey] || featureKey;
    const overrides = resolvedEntitlements.featureOverrides || {};
    if (overrides[flagValue] === true) return true;
    if (overrides[flagValue] === false) return false;

    const tier = normalizeTier(resolvedEntitlements.tier) || 'basic';
    const minTier = FEATURE_MIN_TIER[flagValue] || 'basic';
    return compareTier(tier, minTier) >= 0;
}

/**
 * Returns the effective tier string for a tenant.
 */
function getEffectiveTier(tenantDoc = {}) {
    return resolveTenantEntitlements(tenantDoc).tier;
}

/**
 * Returns a map of all feature flags with their resolved enabled state.
 */
function resolveAllFeatureFlags(resolvedEntitlements = {}) {
    return Object.fromEntries(
        Object.values(FEATURE_FLAGS).map((flag) => [
            flag,
            isTenantFeatureEnabled(resolvedEntitlements, flag),
        ])
    );
}

module.exports = {
    V2_ENTITLEMENT_RESOLVER_VERSION,
    FEATURE_FLAGS,
    FEATURE_MIN_TIER,
    TIER_ORDER,
    resolveTenantEntitlements,
    isTenantFeatureEnabled,
    getEffectiveTier,
    resolveAllFeatureFlags,
};
