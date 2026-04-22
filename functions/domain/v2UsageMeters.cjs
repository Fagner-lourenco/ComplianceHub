'use strict';

const V2_USAGE_METERS_VERSION = 'v2-usage-meters-2026-04-21';

// Providers that are commercially billable to the tenant
const COMMERCIAL_BILLABLE_PROVIDERS = new Set([
    'bigdatacorp', 'judit', 'escavador', 'djen', 'serasa',
]);

// Internal providers — incur cost but not commercially billed to tenant
const INTERNAL_PROVIDERS = new Set([
    'fontedata', 'openai', 'anthropic', 'internal',
]);

// Modules that are internal capabilities — don't generate module execution meters
const INTERNAL_CAPABILITY_MODULES = new Set(['decision', 'report_secure']);

const EXECUTED_STATUSES = new Set([
    'completed_no_findings',
    'completed_with_findings',
    'skipped_reuse',
    'skipped_policy',
]);

function normalizeDate(value = new Date()) {
    if (value && typeof value.toDate === 'function') return value.toDate();
    if (value && typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const date = value instanceof Date ? value : new Date(value || Date.now());
    return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildTimeKeys(value = new Date()) {
    const date = normalizeDate(value);
    const iso = date.toISOString();
    return {
        meteredAt: iso,
        dayKey: iso.slice(0, 10),
        monthKey: iso.slice(0, 7),
    };
}

function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

// Builds a usage meter for a single provider API call (idempotent by providerRequest.id)
function buildUsageMeterFromProviderRequest({
    providerRequest,
    caseId,
    tenantId = null,
    subjectId = null,
    productKey = null,
    entitlementId = null,
    meteredAt = new Date(),
} = {}) {
    if (!providerRequest?.id || !caseId) return null;

    const provider = providerRequest.provider || 'unknown';
    const commercialBillable = COMMERCIAL_BILLABLE_PROVIDERS.has(provider);
    const internalCost = INTERNAL_PROVIDERS.has(provider);
    const meterId = `meter_pr_${providerRequest.id}`;
    const timeKeys = buildTimeKeys(
        providerRequest.finishedAt || providerRequest.startedAt || providerRequest.createdAt || meteredAt,
    );

    return {
        id: meterId,
        tenantId,
        caseId,
        subjectId,
        productKey,
        moduleKey: providerRequest.moduleKey || null,
        providerRequestId: providerRequest.id,
        provider,
        unit: 'provider_api_call',
        quantity: 1,
        commercialBillable,
        internalCost,
        entitlementId,
        status: 'recorded',
        ...timeKeys,
        version: V2_USAGE_METERS_VERSION,
    };
}

// Builds a usage meter for a single module execution (idempotent by caseId+moduleKey)
function buildUsageMeterFromModuleRun({
    moduleRun,
    caseId,
    tenantId = null,
    subjectId = null,
    productKey = null,
    entitlementId = null,
    meteredAt = new Date(),
} = {}) {
    if (!moduleRun?.moduleKey || !caseId) return null;
    if (INTERNAL_CAPABILITY_MODULES.has(moduleRun.moduleKey)) return null;
    if (!EXECUTED_STATUSES.has(moduleRun.status)) return null;

    const reuseNoCharge = moduleRun.status === 'skipped_reuse';
    const meterId = `meter_mr_${caseId}_${moduleRun.moduleKey}`;
    const timeKeys = buildTimeKeys(
        moduleRun.completedAt || moduleRun.finishedAt || moduleRun.updatedAt || moduleRun.createdAt || meteredAt,
    );

    return {
        id: meterId,
        tenantId,
        caseId,
        subjectId,
        productKey,
        moduleKey: moduleRun.moduleKey,
        providerRequestId: null,
        provider: null,
        unit: 'module_execution',
        quantity: 1,
        commercialBillable: !reuseNoCharge && moduleRun.entitled !== false,
        internalCost: false,
        entitlementId,
        status: reuseNoCharge ? 'no_charge_reuse' : 'recorded',
        ...timeKeys,
        version: V2_USAGE_METERS_VERSION,
    };
}

// Main builder — idempotent by design (stable IDs prevent duplicates on re-run)
function buildUsageMetersForCase({
    caseId,
    tenantId = null,
    subjectId = null,
    productKey = null,
    moduleRuns = [],
    providerRequests = [],
    entitlementId = null,
    meteredAt = new Date(),
} = {}) {
    if (!caseId) return [];

    const meters = [];
    const seenIds = new Set();

    for (const providerRequest of asArray(providerRequests)) {
        const meter = buildUsageMeterFromProviderRequest({
            providerRequest, caseId, tenantId, subjectId, productKey, entitlementId, meteredAt,
        });
        if (meter && !seenIds.has(meter.id)) {
            meters.push(meter);
            seenIds.add(meter.id);
        }
    }

    for (const moduleRun of asArray(moduleRuns)) {
        const meter = buildUsageMeterFromModuleRun({
            moduleRun, caseId, tenantId, subjectId, productKey, entitlementId, meteredAt,
        });
        if (meter && !seenIds.has(meter.id)) {
            meters.push(meter);
            seenIds.add(meter.id);
        }
    }

    return meters;
}

// Returns meter IDs grouped by moduleKey — used to enrich moduleRuns.usageMeterIds
function groupMeterIdsByModule(usageMeters = []) {
    return asArray(usageMeters).reduce((acc, meter) => {
        if (!meter.moduleKey || !meter.id) return acc;
        if (!acc[meter.moduleKey]) acc[meter.moduleKey] = [];
        acc[meter.moduleKey].push(meter.id);
        return acc;
    }, {});
}

module.exports = {
    V2_USAGE_METERS_VERSION,
    COMMERCIAL_BILLABLE_PROVIDERS,
    INTERNAL_PROVIDERS,
    buildTimeKeys,
    buildUsageMeterFromProviderRequest,
    buildUsageMeterFromModuleRun,
    buildUsageMetersForCase,
    groupMeterIdsByModule,
};
