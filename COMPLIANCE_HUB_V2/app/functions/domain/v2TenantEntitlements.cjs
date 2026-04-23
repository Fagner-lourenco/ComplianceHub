'use strict';

const V2_TENANT_ENTITLEMENTS_VERSION = 'v2-tenant-entitlements-2026-04-21';

const ALLOWED_TIERS = new Set(['basic', 'standard', 'professional', 'premium']);
const ALLOWED_STATUS = new Set(['active', 'inactive', 'suspended']);
const MAP_FIELDS = new Set([
    'enabledProducts',
    'enabledModules',
    'enabledCapabilities',
    'featureOverrides',
    'policyOverrides',
    'billingOverrides',
    'reportOverrides',
]);
const SCALAR_FIELDS = new Set([
    'contractId',
    'presetKey',
    'tier',
    'billingModel',
    'maxCasesPerMonth',
    'effectiveFrom',
    'effectiveTo',
    'status',
]);

function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stripUndefined(value) {
    if (Array.isArray(value)) {
        return value.map(stripUndefined).filter((item) => item !== undefined);
    }

    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value)
                .map(([key, item]) => [key, stripUndefined(item)])
                .filter(([, item]) => item !== undefined),
        );
    }

    return value === undefined ? undefined : value;
}

function sanitizeMap(value) {
    if (!isPlainObject(value)) return undefined;
    const sanitized = stripUndefined(value);
    return Object.keys(sanitized).length > 0 ? sanitized : {};
}

function normalizeTier(value) {
    const tier = String(value || '').trim().toLowerCase();
    return ALLOWED_TIERS.has(tier) ? tier : undefined;
}

function normalizeStatus(value) {
    const status = String(value || '').trim().toLowerCase();
    return ALLOWED_STATUS.has(status) ? status : undefined;
}

function sanitizeTenantEntitlementPayload(rawPayload = {}) {
    const raw = isPlainObject(rawPayload) ? rawPayload : {};
    const sanitized = {};

    for (const field of MAP_FIELDS) {
        const mapped = sanitizeMap(raw[field]);
        if (mapped !== undefined) sanitized[field] = mapped;
    }

    if (typeof raw.contractId === 'string' && raw.contractId.trim()) sanitized.contractId = raw.contractId.trim();
    if (typeof raw.presetKey === 'string' && raw.presetKey.trim()) sanitized.presetKey = raw.presetKey.trim();
    if (typeof raw.billingModel === 'string' && raw.billingModel.trim()) sanitized.billingModel = raw.billingModel.trim();
    if (raw.maxCasesPerMonth !== undefined && raw.maxCasesPerMonth !== null && Number.isFinite(Number(raw.maxCasesPerMonth))) {
        sanitized.maxCasesPerMonth = Number(raw.maxCasesPerMonth);
    }
    if (typeof raw.effectiveFrom === 'string' && raw.effectiveFrom.trim()) sanitized.effectiveFrom = raw.effectiveFrom.trim();
    if (typeof raw.effectiveTo === 'string' && raw.effectiveTo.trim()) sanitized.effectiveTo = raw.effectiveTo.trim();

    const tier = normalizeTier(raw.tier);
    if (tier) sanitized.tier = tier;

    const status = normalizeStatus(raw.status);
    if (status) sanitized.status = status;

    return sanitized;
}

function buildTenantEntitlementAuditDiff(before = {}, patch = {}) {
    const safeBefore = isPlainObject(before) ? before : {};
    const safePatch = isPlainObject(patch) ? patch : {};
    const changedFields = [];
    const beforeDiff = {};
    const afterDiff = {};

    [...MAP_FIELDS, ...SCALAR_FIELDS].forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(safePatch, field)) return;
        const beforeValue = safeBefore[field] ?? null;
        const afterValue = safePatch[field] ?? null;
        if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) return;
        changedFields.push(field);
        beforeDiff[field] = beforeValue;
        afterDiff[field] = afterValue;
    });

    return {
        changedFields,
        before: beforeDiff,
        after: afterDiff,
    };
}

module.exports = {
    V2_TENANT_ENTITLEMENTS_VERSION,
    sanitizeTenantEntitlementPayload,
    buildTenantEntitlementAuditDiff,
};
