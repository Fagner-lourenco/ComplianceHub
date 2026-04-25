'use strict';

const V2_PRODUCT_CATALOG_VERSION = 'v2-product-catalog-2026-04-22';

/**
 * Commercial metadata layered on top of PRODUCT_REGISTRY in v2Modules.cjs.
 * Keeps v2Modules lean (contract-only) while this module owns client-facing copy.
 */
const PRODUCT_CATALOG = {
    dossier_pf_basic: {
        productKey: 'dossier_pf_basic',
        commercialName: 'Dossie PF Essencial',
        subjectType: 'pf',
        shortDescription: 'Identificacao cadastral e decisao supervisionada para pessoa fisica.',
        pricingHint: 'Baseado em consumo (usageMeters).',
        minTier: 'basic',
    },
    dossier_pf_full: {
        productKey: 'dossier_pf_full',
        commercialName: 'Dossie PF Completo',
        subjectType: 'pf',
        shortDescription: 'Dossie completo PF com criminal, trabalhista, judicial e KYC.',
        pricingHint: 'Pacote completo.',
        minTier: 'professional',
    },
    dossier_pj: {
        productKey: 'dossier_pj',
        commercialName: 'Dossie PJ',
        subjectType: 'pj',
        shortDescription: 'Dossie empresarial com identificacao, processos e KYC corporativo.',
        pricingHint: 'Pacote empresa.',
        minTier: 'professional',
    },
    kyc_individual: {
        productKey: 'kyc_individual',
        commercialName: 'KYC Individual',
        subjectType: 'pf',
        shortDescription: 'Conheca seu cliente pessoa fisica: cadastral + sancoes + PEP + criminal.',
        pricingHint: 'Pacote onboarding.',
        minTier: 'professional',
    },
    kyb_business: {
        productKey: 'kyb_business',
        commercialName: 'KYB Empresa',
        subjectType: 'pj',
        shortDescription: 'Conheca seu cliente empresa: quadro societario, sancoes, processos.',
        pricingHint: 'Pacote corporativo.',
        minTier: 'professional',
    },
    kye_employee: {
        productKey: 'kye_employee',
        commercialName: 'Background Check Colaborador',
        subjectType: 'pf',
        shortDescription: 'Background check de contratacao para colaboradores.',
        pricingHint: 'Pacote RH.',
        minTier: 'basic',
    },
    kys_supplier: {
        productKey: 'kys_supplier',
        commercialName: 'Dossie Fornecedor',
        subjectType: 'pj',
        shortDescription: 'Verificacao de fornecedores com historico corporativo e PF dos socios.',
        pricingHint: 'Pacote compliance compras.',
        minTier: 'professional',
    },
    tpr_third_party: {
        productKey: 'tpr_third_party',
        commercialName: 'Terceiros em Compliance',
        subjectType: 'pj',
        shortDescription: 'Due diligence de terceiros com cross-check PF e PJ.',
        pricingHint: 'Pacote anticorrupcao.',
        minTier: 'premium',
    },
    reputational_risk: {
        productKey: 'reputational_risk',
        commercialName: 'Risco Reputacional',
        subjectType: 'pf',
        shortDescription: 'Analise OSINT/digital/social para risco reputacional.',
        pricingHint: 'Pacote avancado.',
        minTier: 'premium',
    },
    ongoing_monitoring: {
        productKey: 'ongoing_monitoring',
        commercialName: 'Monitoramento Continuo',
        subjectType: 'mixed',
        shortDescription: 'Reconsulta periodica com alertas em caso de mudancas.',
        pricingHint: 'Recorrente / mensal.',
        minTier: 'premium',
    },
    report_secure: {
        productKey: 'report_secure',
        commercialName: 'Relatorio Seguro',
        subjectType: 'mixed',
        shortDescription: 'Publicacao segura de relatorios V2 com link publico expirante.',
        pricingHint: 'Complementar.',
        minTier: 'basic',
    },
};

const TIER_ORDER = ['basic', 'standard', 'professional', 'premium'];

function _asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function normalizeEnabledProducts(enabledProducts) {
    if (!enabledProducts) return new Set();
    if (Array.isArray(enabledProducts)) {
        return new Set(enabledProducts.filter(Boolean).map(String));
    }
    if (typeof enabledProducts === 'object') {
        return new Set(
            Object.entries(enabledProducts)
                .filter(([, value]) => value === true || value === 'true')
                .map(([key]) => key),
        );
    }
    return new Set();
}

function tierIndex(tier) {
    const idx = TIER_ORDER.indexOf(String(tier || '').toLowerCase());
    return idx === -1 ? 0 : idx;
}

function listCatalog() {
    return Object.values(PRODUCT_CATALOG).map((entry) => ({ ...entry }));
}

function getProductMetadata(productKey) {
    return PRODUCT_CATALOG[productKey] ? { ...PRODUCT_CATALOG[productKey] } : null;
}

/**
 * Builds a client-facing catalog split into contracted/available/upsell buckets.
 *
 * - contracted: product explicitly in enabledProducts
 * - available: product below or at tenant tier BUT not explicitly enabled (legacy fallback or reco)
 * - upsell: everything else (premium tier products when tenant is basic, etc.)
 *
 * Callers pass resolved entitlements (post-fallback). If entitlements are null the caller
 * is on legacy settings → everything becomes upsell and `fallbackUsed=true`.
 */
function buildClientProductCatalog({ entitlements = null, fallbackUsed = false } = {}) {
    const contracted = [];
    const available = [];
    const upsell = [];

    const enabled = normalizeEnabledProducts(entitlements?.enabledProducts);
    const tenantTierIdx = tierIndex(entitlements?.tier);

    for (const product of listCatalog()) {
        const productTierIdx = tierIndex(product.minTier);

        if (enabled.has(product.productKey)) {
            contracted.push(product);
            continue;
        }

        if (!fallbackUsed && productTierIdx <= tenantTierIdx) {
            available.push(product);
            continue;
        }

        upsell.push(product);
    }

    return {
        contracted,
        available,
        upsell,
        fallbackUsed,
        tenantTier: entitlements?.tier || null,
        version: V2_PRODUCT_CATALOG_VERSION,
    };
}

module.exports = {
    V2_PRODUCT_CATALOG_VERSION,
    PRODUCT_CATALOG,
    TIER_ORDER,
    listCatalog,
    getProductMetadata,
    normalizeEnabledProducts,
    tierIndex,
    buildClientProductCatalog,
};
