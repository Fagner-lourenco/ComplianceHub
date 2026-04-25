'use strict';

const { BILLING_UNITS } = require('./v2BillingResolver.js');

const V2_BILLING_DRILLDOWN_VERSION = 'v2-billing-drilldown-2026-04-22';

function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function roundMoney(value) {
    return Number(Number(value || 0).toFixed(4));
}

function getQuantity(meter) {
    const quantity = Number(meter?.quantity || 1);
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function getInternalCost(meter) {
    const unit = BILLING_UNITS[meter?.moduleKey] || { internalCostBrl: 0 };
    if (typeof meter?.internalCostBrl === 'number') return roundMoney(meter.internalCostBrl);
    if (meter?.internalCost === true || meter?.unit === 'provider_api_call') {
        return roundMoney(unit.internalCostBrl * getQuantity(meter));
    }
    return 0;
}

function addGroup(groups, key, meter, includeInternalCost) {
    const groupKey = key || 'unknown';
    if (!groups[groupKey]) {
        groups[groupKey] = {
            key: groupKey,
            quantity: 0,
            meters: 0,
            commercialBillableQuantity: 0,
            internalCostBrl: includeInternalCost ? 0 : undefined,
        };
    }
    const quantity = getQuantity(meter);
    groups[groupKey].quantity += quantity;
    groups[groupKey].meters += 1;
    if (meter?.commercialBillable === true) groups[groupKey].commercialBillableQuantity += quantity;
    if (includeInternalCost) {
        groups[groupKey].internalCostBrl = roundMoney(groups[groupKey].internalCostBrl + getInternalCost(meter));
    }
}

function buildBillingDrilldown({ usageMeters = [], settlement = null, includeInternalCost = false } = {}) {
    const meters = asArray(usageMeters);
    const byModule = {};
    const byProduct = {};
    const byCase = {};
    const byProviderRequest = {};

    let totalQuantity = 0;
    let commercialBillableQuantity = 0;
    let totalInternalCostBrl = 0;

    const items = meters.map((meter) => {
        const quantity = getQuantity(meter);
        const internalCostBrl = getInternalCost(meter);
        totalQuantity += quantity;
        if (meter.commercialBillable === true) commercialBillableQuantity += quantity;
        totalInternalCostBrl = roundMoney(totalInternalCostBrl + internalCostBrl);

        addGroup(byModule, meter.moduleKey, meter, includeInternalCost);
        addGroup(byProduct, meter.productKey, meter, includeInternalCost);
        addGroup(byCase, meter.caseId, meter, includeInternalCost);
        if (meter.providerRequestId) addGroup(byProviderRequest, meter.providerRequestId, meter, includeInternalCost);

        const item = {
            id: meter.id || null,
            tenantId: meter.tenantId || null,
            monthKey: meter.monthKey || null,
            caseId: meter.caseId || null,
            subjectId: meter.subjectId || null,
            productKey: meter.productKey || null,
            moduleKey: meter.moduleKey || null,
            providerRequestId: meter.providerRequestId || null,
            provider: meter.provider || null,
            unit: meter.unit || null,
            quantity,
            commercialBillable: meter.commercialBillable === true,
            internalCost: meter.internalCost === true,
            meteredAt: meter.meteredAt || null,
            status: meter.status || null,
        };
        if (includeInternalCost) item.internalCostBrl = internalCostBrl;
        return item;
    });

    const totals = {
        meters: meters.length,
        totalQuantity,
        commercialBillableQuantity,
    };
    if (includeInternalCost) totals.totalInternalCostBrl = totalInternalCostBrl;

    return {
        version: V2_BILLING_DRILLDOWN_VERSION,
        source: 'usageMeters',
        settlementId: settlement?.id || settlement?.settlementId || null,
        settlementStatus: settlement?.status || null,
        totals,
        byModule: Object.values(byModule),
        byProduct: Object.values(byProduct),
        byCase: Object.values(byCase),
        byProviderRequest: Object.values(byProviderRequest),
        items,
        internalCostVisible: includeInternalCost === true,
    };
}

function escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (!/[",\n\r]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
}

function buildBillingDrilldownExport({ drilldown, format = 'csv' } = {}) {
    if (!drilldown) return null;
    if (format === 'json') {
        return {
            format: 'json',
            mimeType: 'application/json',
            content: JSON.stringify(drilldown, null, 2),
        };
    }

    const includeCost = drilldown.internalCostVisible === true;
    const headers = [
        'id', 'monthKey', 'caseId', 'subjectId', 'productKey', 'moduleKey',
        'providerRequestId', 'provider', 'unit', 'quantity', 'commercialBillable',
        'internalCost', 'meteredAt', 'status',
    ];
    if (includeCost) headers.push('internalCostBrl');

    const rows = [
        headers.join(','),
        ...asArray(drilldown.items).map((item) => headers.map((header) => escapeCsv(item[header])).join(',')),
    ];

    return {
        format: 'csv',
        mimeType: 'text/csv',
        content: rows.join('\n'),
    };
}

module.exports = {
    V2_BILLING_DRILLDOWN_VERSION,
    buildBillingDrilldown,
    buildBillingDrilldownExport,
};
