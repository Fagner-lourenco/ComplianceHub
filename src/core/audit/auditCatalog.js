/**
 * Frontend Audit Catalog — safe subset of the backend catalog for rendering.
 * Provides labels, colors, filter options and helpers for AuditoriaPage / AuditoriaClientePage.
 *
 * Never import summaryTemplate or backend-only metadata here.
 */

// ── Enums (mirror backend) ──────────────────────────────────────────────────

export const LEVEL = {
    AUDIT: 'AUDIT',
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    SYSTEM: 'SYSTEM',
    SECURITY: 'SECURITY',
};

export const CATEGORY = {
    CASE: 'CASE',
    REPORT_PUBLIC: 'REPORT_PUBLIC',
    EXPORT: 'EXPORT',
    TENANT_ADMIN: 'TENANT_ADMIN',
    PROFILE: 'PROFILE',
    SETTINGS: 'SETTINGS',
    AI: 'AI',
    PROCESSING: 'PROCESSING',
    INTEGRATION: 'INTEGRATION',
    SECURITY: 'SECURITY',
    SALES: 'SALES',
    MONITORING: 'MONITORING',
};

export const ENTITY_TYPE = {
    CASE: 'CASE',
    REPORT_PUBLIC: 'REPORT_PUBLIC',
    EXPORT: 'EXPORT',
    USER: 'USER',
    TENANT: 'TENANT',
    PROFILE: 'PROFILE',
    SETTINGS: 'SETTINGS',
    TENANT_ENTITLEMENTS: 'TENANT_ENTITLEMENTS',
    BILLING_SETTLEMENT: 'BILLING_SETTLEMENT',
    PROVIDER_DIVERGENCE: 'PROVIDER_DIVERGENCE',
    QUOTE_REQUEST: 'QUOTE_REQUEST',
    ALERT: 'ALERT',
    WATCHLIST: 'WATCHLIST',
};

export const ACTOR_TYPE = {
    OPS_USER: 'OPS_USER',
    CLIENT_USER: 'CLIENT_USER',
    SYSTEM: 'SYSTEM',
    PUBLIC_LINK: 'PUBLIC_LINK',
};

// ── Action Labels (complete — replaces partial ACTION_LABELS) ───────────────

export const ACTION_LABELS = {
    // Case lifecycle
    SOLICITATION_CREATED: { label: 'Nova solicitação', category: CATEGORY.CASE },
    CASE_ASSIGNED: { label: 'Caso atribuído', category: CATEGORY.CASE },
    CASE_RETURNED: { label: 'Caso devolvido', category: CATEGORY.CASE },
    CASE_CORRECTED: { label: 'Caso corrigido', category: CATEGORY.CASE },
    CASE_CONCLUDED: { label: 'Caso concluído', category: CATEGORY.CASE },
    CASE_DRAFT_SAVED: { label: 'Rascunho salvo', category: CATEGORY.CASE },
    PROVIDER_DIVERGENCE_RESOLVED: { label: 'Divergencia resolvida', category: CATEGORY.CASE },
    SENIOR_REVIEW_REQUESTED: { label: 'Revisao senior solicitada', category: CATEGORY.CASE },
    SENIOR_REVIEW_APPROVED: { label: 'Revisao senior aprovada', category: CATEGORY.CASE },
    SENIOR_REVIEW_REJECTED: { label: 'Revisao senior rejeitada', category: CATEGORY.CASE },

    // Public reports
    PUBLIC_REPORT_CREATED: { label: 'Relatório público gerado', category: CATEGORY.REPORT_PUBLIC },
    PUBLIC_REPORT_REVOKED: { label: 'Relatório público revogado', category: CATEGORY.REPORT_PUBLIC },
    CLIENT_PUBLIC_REPORT_CREATED: { label: 'Relatório público (cliente)', category: CATEGORY.REPORT_PUBLIC },
    CLIENT_PUBLIC_REPORT_REVOKED: { label: 'Relatório revogado (cliente)', category: CATEGORY.REPORT_PUBLIC },

    // Export
    EXPORT_CREATED: { label: 'Exportação criada', category: CATEGORY.EXPORT },

    // Tenant admin
    USER_CREATED: { label: 'Usuário criado', category: CATEGORY.TENANT_ADMIN },
    TENANT_USER_CREATED: { label: 'Usuário tenant criado', category: CATEGORY.TENANT_ADMIN },
    TENANT_USER_UPDATED: { label: 'Usuário tenant atualizado', category: CATEGORY.TENANT_ADMIN },

    // Profile
    OWN_PROFILE_UPDATED: { label: 'Perfil atualizado', category: CATEGORY.PROFILE },

    // Settings
    TENANT_CONFIG_UPDATED: { label: 'Config atualizada', category: CATEGORY.SETTINGS },
    TENANT_ENTITLEMENTS_UPDATED: { label: 'Entitlements contratuais atualizados', category: CATEGORY.SETTINGS },
    TENANT_BILLING_PERIOD_CLOSED: { label: 'Fechamento de consumo V2', category: CATEGORY.SETTINGS },
    BILLING_DRILLDOWN_EXPORTED: { label: 'Drilldown de consumo exportado', category: CATEGORY.SETTINGS },

    // AI
    AI_ANALYSIS_RUN: { label: 'Análise IA', category: CATEGORY.AI },
    AI_HOMONYM_ANALYSIS_RUN: { label: 'Análise homônimos (IA)', category: CATEGORY.AI },
    AI_RERUN: { label: 'IA re-executada', category: CATEGORY.AI },
    AI_DECISION_SET: { label: 'Decisão IA registrada', category: CATEGORY.AI },

    // Processing
    ENRICHMENT_PHASE_RERUN: { label: 'Enriquecimento re-executado', category: CATEGORY.PROCESSING },
    ENRICHMENT_AUTO_TRIGGERED: { label: 'Enriquecimento automático', category: CATEGORY.PROCESSING },

    // Quota / limits
    DAILY_LIMIT_EXCEEDED: { label: 'Limite diario excedido', category: CATEGORY.SETTINGS },
    MONTHLY_LIMIT_EXCEEDED: { label: 'Limite mensal excedido', category: CATEGORY.SETTINGS },
    SUBMISSION_BLOCKED_DAILY: { label: 'Bloqueio diario', category: CATEGORY.SETTINGS },
    SUBMISSION_BLOCKED_MONTHLY: { label: 'Bloqueio mensal', category: CATEGORY.SETTINGS },

    // Sales / quotes
    QUOTE_REQUESTED: { label: 'Cotacao solicitada', category: CATEGORY.SALES },
    QUOTE_APPROVED: { label: 'Cotacao aprovada', category: CATEGORY.SALES },
    QUOTE_REJECTED: { label: 'Cotacao rejeitada', category: CATEGORY.SALES },

    // Monitoring / alerts
    ALERT_STATE_CHANGED: { label: 'Alerta atualizado', category: CATEGORY.MONITORING },
    WATCHLIST_CREATED: { label: 'Watchlist criada', category: CATEGORY.MONITORING },
    WATCHLIST_PAUSED: { label: 'Watchlist pausada', category: CATEGORY.MONITORING },
    WATCHLIST_RESUMED: { label: 'Watchlist reativada', category: CATEGORY.MONITORING },
    WATCHLIST_DELETED: { label: 'Watchlist removida', category: CATEGORY.MONITORING },
    WATCHLIST_RUN_NOW: { label: 'Watchlist executada manualmente', category: CATEGORY.MONITORING },
    WATCHLIST_AUTOPAUSED: { label: 'Watchlist auto-pausada', category: CATEGORY.MONITORING },
};

// ── Level rendering ─────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
    [LEVEL.AUDIT]: { label: 'Auditoria', color: 'var(--blue-600)', bg: 'var(--blue-50)' },
    [LEVEL.INFO]: { label: 'Informação', color: 'var(--gray-600)', bg: 'var(--gray-100)' },
    [LEVEL.WARNING]: { label: 'Alerta', color: 'var(--yellow-700)', bg: 'var(--yellow-50)' },
    [LEVEL.ERROR]: { label: 'Erro', color: 'var(--red-600)', bg: 'var(--red-50)' },
    [LEVEL.SYSTEM]: { label: 'Sistema', color: 'var(--purple-600)', bg: 'var(--purple-50)' },
    [LEVEL.SECURITY]: { label: 'Segurança', color: 'var(--red-700)', bg: 'var(--red-100)' },
};

// ── Category rendering ──────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
    [CATEGORY.CASE]: { label: 'Caso', color: 'var(--blue-600)', bg: 'var(--blue-50)' },
    [CATEGORY.REPORT_PUBLIC]: { label: 'Relatório público', color: 'var(--green-600)', bg: 'var(--green-50)' },
    [CATEGORY.EXPORT]: { label: 'Exportação', color: 'var(--teal-600)', bg: 'var(--teal-50)' },
    [CATEGORY.TENANT_ADMIN]: { label: 'Administração', color: 'var(--brand-600)', bg: 'var(--brand-50)' },
    [CATEGORY.PROFILE]: { label: 'Perfil', color: 'var(--gray-600)', bg: 'var(--gray-100)' },
    [CATEGORY.SETTINGS]: { label: 'Configurações', color: 'var(--brand-600)', bg: 'var(--brand-50)' },
    [CATEGORY.AI]: { label: 'Inteligência artificial', color: 'var(--purple-600)', bg: 'var(--purple-50)' },
    [CATEGORY.PROCESSING]: { label: 'Processamento', color: 'var(--gray-600)', bg: 'var(--gray-100)' },
    [CATEGORY.INTEGRATION]: { label: 'Integração', color: 'var(--orange-600)', bg: 'var(--orange-50)' },
    [CATEGORY.SECURITY]: { label: 'Segurança', color: 'var(--red-700)', bg: 'var(--red-100)' },
    [CATEGORY.SALES]: { label: 'Vendas', color: 'var(--green-600)', bg: 'var(--green-50)' },
    [CATEGORY.MONITORING]: { label: 'Monitoramento', color: 'var(--blue-600)', bg: 'var(--blue-50)' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const FALLBACK_ACTION = { label: 'Evento', category: null };
const FALLBACK_LEVEL = { label: 'Desconhecido', color: 'var(--gray-500)', bg: 'var(--gray-100)' };
const FALLBACK_CATEGORY = { label: 'Outros', color: 'var(--gray-500)', bg: 'var(--gray-100)' };

export function getActionLabel(action) {
    return (ACTION_LABELS[action] || FALLBACK_ACTION).label;
}

export function getActionConfig(action) {
    return ACTION_LABELS[action] || FALLBACK_ACTION;
}

export function getLevelConfig(level) {
    return LEVEL_CONFIG[level] || FALLBACK_LEVEL;
}

export function getLevelLabel(level) {
    return (LEVEL_CONFIG[level] || FALLBACK_LEVEL).label;
}

export function getLevelColor(level) {
    const cfg = LEVEL_CONFIG[level] || FALLBACK_LEVEL;
    return { color: cfg.color, bg: cfg.bg };
}

export function getCategoryConfig(category) {
    return CATEGORY_CONFIG[category] || FALLBACK_CATEGORY;
}

export function getCategoryLabel(category) {
    return (CATEGORY_CONFIG[category] || FALLBACK_CATEGORY).label;
}

export function getCategoryColor(category) {
    const cfg = CATEGORY_CONFIG[category] || FALLBACK_CATEGORY;
    return { color: cfg.color, bg: cfg.bg };
}

/**
 * Returns action options for filter select — grouped by category.
 * Each entry: { value, label, category }
 */
export function getActionFilterOptions() {
    return Object.entries(ACTION_LABELS).map(([action, cfg]) => ({
        value: action,
        label: cfg.label,
        category: cfg.category,
    }));
}

/**
 * Returns category options for filter select.
 */
export function getCategoryFilterOptions() {
    return Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => ({
        value: cat,
        label: cfg.label,
    }));
}

/**
 * Returns level options for filter select.
 */
export function getLevelFilterOptions() {
    return Object.entries(LEVEL_CONFIG).map(([lvl, cfg]) => ({
        value: lvl,
        label: cfg.label,
    }));
}

/**
 * Derive action badge styling for a legacy or v2 log entry.
 * Compatible with both old ACTION_LABELS-style rendering and new catalog.
 */
export function getActionBadgeStyle(action) {
    const actionCfg = ACTION_LABELS[action];
    if (!actionCfg) {
        return { color: 'var(--gray-600)', bg: 'var(--gray-100)' };
    }
    const catCfg = CATEGORY_CONFIG[actionCfg.category];
    return catCfg
        ? { color: catCfg.color, bg: catCfg.bg }
        : { color: 'var(--gray-600)', bg: 'var(--gray-100)' };
}
