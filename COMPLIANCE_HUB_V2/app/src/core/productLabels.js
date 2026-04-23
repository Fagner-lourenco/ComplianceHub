/**
 * Single source of truth for commercial-facing product/module/capability labels.
 *
 * Drift between `CasoPage.PRODUCT_KEY_LABELS`, `TenantSettingsPage.CONTRACT_PRODUCTS`
 * and backend `PRODUCT_CATALOG.commercialName` was causing inconsistent product
 * naming across ops vs client surfaces. This module consolidates the mapping.
 */

export const PRODUCT_LABELS = {
    dossier_pf_basic: 'Dossie PF Essencial',
    dossier_pf_full: 'Dossie PF Completo',
    dossier_pj: 'Dossie PJ',
    report_secure: 'Relatorio Seguro',
    kyc_individual: 'KYC Individual',
    kyb_business: 'KYB Empresa',
    kye_employee: 'KYE Colaborador',
    kys_supplier: 'KYS Fornecedor',
    tpr_third_party: 'TPR Terceiro',
    reputational_risk: 'Risco Reputacional',
    ongoing_monitoring: 'Monitoramento Continuo',
};

export const MODULE_LABELS = {
    identity_pf: 'Identificacao PF',
    identity_pj: 'Identificacao PJ',
    criminal: 'Criminal',
    labor: 'Trabalhista',
    warrants: 'Mandados',
    judicial: 'Judicial',
    kyc: 'KYC e Listas',
    osint: 'OSINT',
    sanctions: 'Sancoes',
    media: 'Midia',
    address: 'Endereco',
    relationship: 'Relacionamentos',
};

export const CAPABILITY_LABELS = {
    report_public_link: 'Link publico seguro',
    evidence_viewer: 'Visualizador de evidencias',
    billing_dashboard: 'Dashboard de consumo',
    senior_review: 'Revisao senior',
    watchlist_monitoring: 'Monitoramento Premium',
    provider_divergence: 'Resolucao de divergencias',
};

export function getProductLabel(productKey) {
    if (!productKey) return '';
    return PRODUCT_LABELS[productKey] || productKey;
}

export function getModuleLabel(moduleKey) {
    if (!moduleKey) return '';
    return MODULE_LABELS[moduleKey] || moduleKey;
}

export function getCapabilityLabel(capabilityKey) {
    if (!capabilityKey) return '';
    return CAPABILITY_LABELS[capabilityKey] || capabilityKey;
}

export function listContractProducts() {
    return Object.entries(PRODUCT_LABELS).map(([key, label]) => ({ key, label }));
}

export function listContractModules() {
    return Object.entries(MODULE_LABELS).map(([key, label]) => ({ key, label }));
}

export function listContractCapabilities() {
    return Object.entries(CAPABILITY_LABELS).map(([key, label]) => ({ key, label }));
}
