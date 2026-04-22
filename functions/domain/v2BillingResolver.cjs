'use strict';

// Internal cost and commercial label per moduleKey
const BILLING_UNITS = {
    identity: { internalCostBrl: 0.30, commercialUnitLabel: 'Consulta de identidade' },
    identity_pf: { internalCostBrl: 0.30, commercialUnitLabel: 'Identificacao PF' },
    identity_pj: { internalCostBrl: 0.85, commercialUnitLabel: 'Identificacao PJ' },
    criminal: { internalCostBrl: 0.50, commercialUnitLabel: 'Analise criminal' },
    labor: { internalCostBrl: 0.40, commercialUnitLabel: 'Analise trabalhista' },
    warrant: { internalCostBrl: 0.20, commercialUnitLabel: 'Consulta de mandados' },
    warrants: { internalCostBrl: 0.20, commercialUnitLabel: 'Mandados e alertas' },
    judicial: { internalCostBrl: 0.50, commercialUnitLabel: 'Consulta judicial' },
    kyc: { internalCostBrl: 0.15, commercialUnitLabel: 'KYC/listas' },
    kyb: { internalCostBrl: 0.90, commercialUnitLabel: 'KYB (Know Your Business)' },
    kye: { internalCostBrl: 0.50, commercialUnitLabel: 'KYE (Know Your Employee)' },
    kys: { internalCostBrl: 1.10, commercialUnitLabel: 'KYS (Know Your Supplier)' },
    tpr: { internalCostBrl: 1.10, commercialUnitLabel: 'TPR (Third Party Risk)' },
    osint: { internalCostBrl: 0.60, commercialUnitLabel: 'Inteligencia OSINT' },
    social: { internalCostBrl: 0.25, commercialUnitLabel: 'Consulta social' },
    digital: { internalCostBrl: 0.35, commercialUnitLabel: 'Perfil digital' },
    credit: { internalCostBrl: 0.80, commercialUnitLabel: 'Consulta de crédito' },
    sanctions: { internalCostBrl: 0.15, commercialUnitLabel: 'Consulta de sanções' },
    pep: { internalCostBrl: 0.15, commercialUnitLabel: 'Consulta PEP' },
    watchlist: { internalCostBrl: 0.10, commercialUnitLabel: 'Watchlist (mensal)' },
    relationship_graph: { internalCostBrl: 1.50, commercialUnitLabel: 'Grafo de relacionamentos' },
    adverse_media: { internalCostBrl: 0.45, commercialUnitLabel: 'Mídia adversa' },
};

// Commercial presets: each defines which modules are included + margin
const COMMERCIAL_PRESETS = {
    start: {
        label: 'Start',
        modules: ['identity', 'criminal', 'warrant'],
        marginMultiplier: 2.5,
    },
    professional: {
        label: 'Professional',
        modules: ['identity', 'criminal', 'labor', 'warrant', 'osint', 'social'],
        marginMultiplier: 2.2,
    },
    investigative: {
        label: 'Investigative',
        modules: ['identity', 'criminal', 'labor', 'warrant', 'osint', 'social', 'digital', 'sanctions', 'pep'],
        marginMultiplier: 2.0,
    },
    premium: {
        label: 'Premium',
        modules: ['identity', 'criminal', 'labor', 'warrant', 'osint', 'social', 'digital', 'credit', 'sanctions', 'pep', 'adverse_media'],
        marginMultiplier: 1.8,
    },
};

function buildBillingEntry(moduleKey, { quantity = 1, executedAt = null } = {}) {
    const unit = BILLING_UNITS[moduleKey];
    if (!unit) return null;

    const internalCostBrl = parseFloat((unit.internalCostBrl * quantity).toFixed(4));
    return {
        moduleKey,
        quantity,
        internalCostBrl,
        commercialUnitLabel: unit.commercialUnitLabel,
        executedAt: executedAt || new Date().toISOString(),
    };
}

function summarizeTenantUsage(billingEntries = []) {
    const byModule = {};
    let totalInternalCostBrl = 0;
    let totalQuantity = 0;

    for (const entry of billingEntries) {
        if (!entry || !entry.moduleKey) continue;
        const key = entry.moduleKey;
        if (!byModule[key]) {
            byModule[key] = { moduleKey: key, quantity: 0, internalCostBrl: 0, commercialUnitLabel: entry.commercialUnitLabel || key };
        }
        byModule[key].quantity += entry.quantity || 1;
        byModule[key].internalCostBrl = parseFloat((byModule[key].internalCostBrl + (entry.internalCostBrl || 0)).toFixed(4));
        totalInternalCostBrl = parseFloat((totalInternalCostBrl + (entry.internalCostBrl || 0)).toFixed(4));
        totalQuantity += entry.quantity || 1;
    }

    return {
        byModule: Object.values(byModule),
        totalInternalCostBrl,
        totalQuantity,
        entryCount: billingEntries.length,
    };
}

function summarizeUsageMeters(usageMeters = []) {
    const byModule = {};
    let totalQuantity = 0;
    let commercialBillableQuantity = 0;
    let internalCostQuantity = 0;
    let totalInternalCostBrl = 0;

    for (const meter of usageMeters) {
        if (!meter || !meter.moduleKey) continue;
        const key = meter.moduleKey;
        const quantity = Number(meter.quantity || 1);
        const unit = BILLING_UNITS[key] || { internalCostBrl: 0, commercialUnitLabel: key };
        if (!byModule[key]) {
            byModule[key] = {
                moduleKey: key,
                quantity: 0,
                commercialBillableQuantity: 0,
                internalCostQuantity: 0,
                internalCostBrl: 0,
                commercialUnitLabel: unit.commercialUnitLabel,
            };
        }

        byModule[key].quantity += quantity;
        totalQuantity += quantity;

        if (meter.commercialBillable === true) {
            byModule[key].commercialBillableQuantity += quantity;
            commercialBillableQuantity += quantity;
        }
        if (meter.internalCost === true || meter.unit === 'provider_api_call') {
            const cost = parseFloat((unit.internalCostBrl * quantity).toFixed(4));
            byModule[key].internalCostQuantity += quantity;
            byModule[key].internalCostBrl = parseFloat((byModule[key].internalCostBrl + cost).toFixed(4));
            internalCostQuantity += quantity;
            totalInternalCostBrl = parseFloat((totalInternalCostBrl + cost).toFixed(4));
        }
    }

    return {
        byModule: Object.values(byModule),
        totalInternalCostBrl,
        totalQuantity,
        commercialBillableQuantity,
        internalCostQuantity,
        entryCount: usageMeters.length,
        source: 'usageMeters',
    };
}

function summarizeBillingOverview({ usageMeters = [], billingEntries = [] } = {}) {
    if (Array.isArray(usageMeters) && usageMeters.length > 0) {
        return {
            ...summarizeUsageMeters(usageMeters),
            source: 'usageMeters',
            fallbackUsed: false,
        };
    }

    return {
        ...summarizeTenantUsage(billingEntries),
        source: 'billingEntries',
        fallbackUsed: true,
    };
}

function resolveCommercialPreset(presetKey) {
    const preset = COMMERCIAL_PRESETS[presetKey];
    if (!preset) return null;

    const moduleCosts = preset.modules.map((moduleKey) => {
        const unit = BILLING_UNITS[moduleKey] || { internalCostBrl: 0, commercialUnitLabel: moduleKey };
        const commercialCostBrl = parseFloat((unit.internalCostBrl * preset.marginMultiplier).toFixed(4));
        return { moduleKey, commercialUnitLabel: unit.commercialUnitLabel, internalCostBrl: unit.internalCostBrl, commercialCostBrl };
    });

    const totalInternalCostBrl = parseFloat(moduleCosts.reduce((acc, m) => acc + m.internalCostBrl, 0).toFixed(4));
    const totalCommercialCostBrl = parseFloat(moduleCosts.reduce((acc, m) => acc + m.commercialCostBrl, 0).toFixed(4));

    return {
        presetKey,
        label: preset.label,
        modules: preset.modules,
        marginMultiplier: preset.marginMultiplier,
        moduleCosts,
        totalInternalCostBrl,
        totalCommercialCostBrl,
    };
}

module.exports = {
    BILLING_UNITS,
    COMMERCIAL_PRESETS,
    buildBillingEntry,
    summarizeTenantUsage,
    summarizeUsageMeters,
    summarizeBillingOverview,
    resolveCommercialPreset,
};
