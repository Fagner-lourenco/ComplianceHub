/**
 * Central Audit Event Catalog — single source of truth for all audit actions.
 *
 * Every action that enters auditLogs MUST be registered here.
 * The frontend mirrors a safe subset via src/core/audit/auditCatalog.js.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

const LEVEL = {
    AUDIT: 'AUDIT',
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    SYSTEM: 'SYSTEM',
    SECURITY: 'SECURITY',
};

const CATEGORY = {
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

const ENTITY_TYPE = {
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

const ACTOR_TYPE = {
    OPS_USER: 'OPS_USER',
    CLIENT_USER: 'CLIENT_USER',
    SYSTEM: 'SYSTEM',
    PUBLIC_LINK: 'PUBLIC_LINK',
};

const SOURCE = {
    PORTAL_OPS: 'portal_ops',
    PORTAL_CLIENT: 'portal_client',
    CLOUD_FUNCTION: 'cloud_function',
    PUBLIC_REPORT: 'public_report',
    SYSTEM: 'system',
};

// ── Action Catalog ───────────────────────────────────────────────────────────
// Each entry defines metadata for rendering, filtering and projection.
//   clientVisible: whether the event is projected to tenantAuditLogs

const AUDIT_ACTIONS = {
    // ─── Case lifecycle ──────────────────────────────────────────────────────
    SOLICITATION_CREATED: {
        category: CATEGORY.CASE,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: true,
        summaryTemplate: 'Nova solicitação criada para {candidateName}',
        clientSummaryTemplate: 'Nova solicitação criada para {candidateName}',
    },
    CASE_ASSIGNED: {
        category: CATEGORY.CASE,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: false,
        summaryTemplate: 'Caso assumido por {actorName}',
    },
    CASE_RETURNED: {
        category: CATEGORY.CASE,
        level: LEVEL.WARNING,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: true,
        summaryTemplate: 'Caso devolvido ao cliente — {reason}',
        clientSummaryTemplate: 'Caso devolvido para correção — {reason}',
    },
    CASE_CORRECTED: {
        category: CATEGORY.CASE,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: true,
        summaryTemplate: 'Caso corrigido e reenviado pelo cliente',
        clientSummaryTemplate: 'Caso corrigido e reenviado',
    },
    CASE_CONCLUDED: {
        category: CATEGORY.CASE,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: true,
        summaryTemplate: 'Caso concluído para {candidateName} — {verdict}',
        clientSummaryTemplate: 'Análise concluída para {candidateName}',
    },
    CASE_DRAFT_SAVED: {
        category: CATEGORY.CASE,
        level: LEVEL.INFO,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: false,
        summaryTemplate: 'Rascunho salvo para {candidateName}',
    },
    PROVIDER_DIVERGENCE_RESOLVED: {
        category: CATEGORY.CASE,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.PROVIDER_DIVERGENCE,
        clientVisible: false,
        summaryTemplate: 'Divergencia de provider resolvida para o caso {caseId} - {status}',
    },
    SENIOR_REVIEW_REQUESTED: {
        category: CATEGORY.CASE,
        level: LEVEL.WARNING,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: false,
        summaryTemplate: 'Revisao senior solicitada para o caso {caseId}',
    },
    SENIOR_REVIEW_APPROVED: {
        category: CATEGORY.CASE,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: false,
        summaryTemplate: 'Revisao senior aprovada para o caso {caseId}',
    },
    SENIOR_REVIEW_REJECTED: {
        category: CATEGORY.CASE,
        level: LEVEL.WARNING,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: false,
        summaryTemplate: 'Revisao senior rejeitada para o caso {caseId}',
    },

    // ─── Public reports ──────────────────────────────────────────────────────
    PUBLIC_REPORT_CREATED: {
        category: CATEGORY.REPORT_PUBLIC,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.REPORT_PUBLIC,
        clientVisible: true,
        summaryTemplate: 'Relatório público gerado para {candidateName}',
        clientSummaryTemplate: 'Relatório público gerado para {candidateName}',
    },
    PUBLIC_REPORT_REVOKED: {
        category: CATEGORY.REPORT_PUBLIC,
        level: LEVEL.WARNING,
        entityType: ENTITY_TYPE.REPORT_PUBLIC,
        clientVisible: true,
        summaryTemplate: 'Relatório público revogado — {candidateName}',
        clientSummaryTemplate: 'Relatório público desativado',
    },
    CLIENT_PUBLIC_REPORT_CREATED: {
        category: CATEGORY.REPORT_PUBLIC,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.REPORT_PUBLIC,
        clientVisible: true,
        summaryTemplate: 'Relatório público gerado pelo cliente para {candidateName}',
        clientSummaryTemplate: 'Relatório público gerado para {candidateName}',
    },
    CLIENT_PUBLIC_REPORT_REVOKED: {
        category: CATEGORY.REPORT_PUBLIC,
        level: LEVEL.WARNING,
        entityType: ENTITY_TYPE.REPORT_PUBLIC,
        clientVisible: true,
        summaryTemplate: 'Relatório público revogado pelo cliente — {candidateName}',
        clientSummaryTemplate: 'Relatório público desativado — {candidateName}',
    },

    // ─── Exports ─────────────────────────────────────────────────────────────
    EXPORT_CREATED: {
        category: CATEGORY.EXPORT,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.EXPORT,
        clientVisible: true,
        summaryTemplate: 'Exportação {format} criada — {records} registro(s)',
        clientSummaryTemplate: 'Exportação criada — {records} registro(s)',
    },

    // ─── Tenant admin ────────────────────────────────────────────────────────
    USER_CREATED: {
        category: CATEGORY.TENANT_ADMIN,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.USER,
        clientVisible: false,
        summaryTemplate: 'Usuário ops criado para tenant {tenantName}',
    },
    TENANT_USER_CREATED: {
        category: CATEGORY.TENANT_ADMIN,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.USER,
        clientVisible: true,
        summaryTemplate: 'Usuário {targetEmail} criado na franquia',
        clientSummaryTemplate: 'Novo usuário criado na franquia',
    },
    TENANT_USER_UPDATED: {
        category: CATEGORY.TENANT_ADMIN,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.USER,
        clientVisible: true,
        summaryTemplate: 'Usuário {targetEmail} atualizado — {changes}',
        clientSummaryTemplate: 'Usuário atualizado na franquia',
    },

    // ─── Profile ─────────────────────────────────────────────────────────────
    OWN_PROFILE_UPDATED: {
        category: CATEGORY.PROFILE,
        level: LEVEL.INFO,
        entityType: ENTITY_TYPE.PROFILE,
        clientVisible: true,
        summaryTemplate: 'Perfil atualizado por {actorName}',
        clientSummaryTemplate: 'Perfil atualizado',
    },

    // ─── Settings ────────────────────────────────────────────────────────────
    TENANT_ENTITLEMENTS_UPDATED: {
        category: CATEGORY.SETTINGS,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.TENANT_ENTITLEMENTS,
        clientVisible: false,
        summaryTemplate: 'Entitlements contratuais do tenant {tenantId} atualizados',
        clientSummaryTemplate: null,
    },
    TENANT_BILLING_PERIOD_CLOSED: {
        category: CATEGORY.SETTINGS,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.BILLING_SETTLEMENT,
        clientVisible: false,
        summaryTemplate: 'Fechamento de consumo V2 do tenant {tenantId} gerado para {monthKey}',
        clientSummaryTemplate: null,
    },
    BILLING_DRILLDOWN_EXPORTED: {
        category: CATEGORY.SETTINGS,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.BILLING_SETTLEMENT,
        clientVisible: false,
        summaryTemplate: 'Drilldown de consumo V2 do tenant {tenantId} exportado para {monthKey}',
        clientSummaryTemplate: null,
    },
    TENANT_CONFIG_UPDATED: {
        category: CATEGORY.SETTINGS,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.SETTINGS,
        clientVisible: true,
        summaryTemplate: 'Configurações do tenant {tenantId} atualizadas',
        clientSummaryTemplate: 'Configurações da franquia atualizadas',
    },

    // ─── AI ──────────────────────────────────────────────────────────────────
    AI_ANALYSIS_RUN: {
        category: CATEGORY.AI,
        level: LEVEL.SYSTEM,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: false,
        summaryTemplate: 'Análise de IA executada para {candidateName}',
    },
    AI_HOMONYM_ANALYSIS_RUN: {
        category: CATEGORY.AI,
        level: LEVEL.SYSTEM,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: false,
        summaryTemplate: 'Análise de homônimos (IA) executada para {candidateName}',
    },
    AI_RERUN: {
        category: CATEGORY.AI,
        level: LEVEL.INFO,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: false,
        summaryTemplate: 'IA re-executada para {candidateName}',
    },
    AI_DECISION_SET: {
        category: CATEGORY.AI,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: false,
        summaryTemplate: 'Decisão da IA registrada — {decision} para {candidateName}',
    },

    // ─── Processing / enrichment ─────────────────────────────────────────────
    ENRICHMENT_PHASE_RERUN: {
        category: CATEGORY.PROCESSING,
        level: LEVEL.INFO,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: false,
        summaryTemplate: 'Fase {phase} de enriquecimento re-executada para {candidateName}',
    },
    ENRICHMENT_AUTO_TRIGGERED: {
        category: CATEGORY.PROCESSING,
        level: LEVEL.INFO,
        entityType: ENTITY_TYPE.CASE,
        clientVisible: false,
        summaryTemplate: 'Enriquecimento automatico {phase} executado para {candidateName} — {status}',
    },

    // ─── Quota / limits ──────────────────────────────────────────────────────
    DAILY_LIMIT_EXCEEDED: {
        category: CATEGORY.SETTINGS,
        level: LEVEL.WARNING,
        entityType: ENTITY_TYPE.TENANT,
        clientVisible: true,
        summaryTemplate: 'Limite diario excedido ({dailyCount}/{dailyLimit}) — consulta registrada como excedente do dia',
    },
    MONTHLY_LIMIT_EXCEEDED: {
        category: CATEGORY.SETTINGS,
        level: LEVEL.WARNING,
        entityType: ENTITY_TYPE.TENANT,
        clientVisible: true,
        summaryTemplate: 'Limite mensal excedido ({monthlyCount}/{monthlyLimit}) — consulta faturavel no proximo ciclo',
    },
    SUBMISSION_BLOCKED_DAILY: {
        category: CATEGORY.SETTINGS,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.TENANT,
        clientVisible: true,
        summaryTemplate: 'Submissao bloqueada — limite diario de {dailyLimit} consultas atingido',
    },
    SUBMISSION_BLOCKED_MONTHLY: {
        category: CATEGORY.SETTINGS,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.TENANT,
        clientVisible: true,
        summaryTemplate: 'Submissao bloqueada — limite mensal de {monthlyLimit} consultas atingido',
    },

    // ─── Sales / quotes ──────────────────────────────────────────────────────
    QUOTE_REQUESTED: {
        category: CATEGORY.SALES,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.QUOTE_REQUEST,
        clientVisible: true,
        summaryTemplate: 'Cotacao solicitada para produto {productKey}',
        clientSummaryTemplate: 'Cotacao solicitada para produto {productKey}',
    },
    QUOTE_APPROVED: {
        category: CATEGORY.SALES,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.QUOTE_REQUEST,
        clientVisible: true,
        summaryTemplate: 'Cotacao aprovada — produto {productKey}',
        clientSummaryTemplate: 'Cotacao aprovada — produto {productKey}',
    },
    QUOTE_REJECTED: {
        category: CATEGORY.SALES,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.QUOTE_REQUEST,
        clientVisible: true,
        summaryTemplate: 'Cotacao rejeitada — produto {productKey}',
        clientSummaryTemplate: 'Cotacao rejeitada — produto {productKey}',
    },

    // ─── Alerts ──────────────────────────────────────────────────────────────
    ALERT_STATE_CHANGED: {
        category: CATEGORY.MONITORING,
        level: LEVEL.INFO,
        entityType: ENTITY_TYPE.ALERT,
        clientVisible: true,
        summaryTemplate: 'Alerta {alertId} atualizado para {state}',
        clientSummaryTemplate: 'Alerta atualizado — {state}',
    },

    // ─── Watchlists / monitoring ─────────────────────────────────────────────
    WATCHLIST_CREATED: {
        category: CATEGORY.MONITORING,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.WATCHLIST,
        clientVisible: false,
        summaryTemplate: 'Watchlist criada para subject {subjectId}',
    },
    WATCHLIST_PAUSED: {
        category: CATEGORY.MONITORING,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.WATCHLIST,
        clientVisible: false,
        summaryTemplate: 'Watchlist pausada para subject {subjectId}',
    },
    WATCHLIST_RESUMED: {
        category: CATEGORY.MONITORING,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.WATCHLIST,
        clientVisible: false,
        summaryTemplate: 'Watchlist reativada para subject {subjectId}',
    },
    WATCHLIST_DELETED: {
        category: CATEGORY.MONITORING,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.WATCHLIST,
        clientVisible: false,
        summaryTemplate: 'Watchlist removida para subject {subjectId}',
    },
    WATCHLIST_RUN_NOW: {
        category: CATEGORY.MONITORING,
        level: LEVEL.AUDIT,
        entityType: ENTITY_TYPE.WATCHLIST,
        clientVisible: false,
        summaryTemplate: 'Watchlist executada manualmente para subject {subjectId}',
    },
    WATCHLIST_AUTOPAUSED: {
        category: CATEGORY.MONITORING,
        level: LEVEL.WARNING,
        entityType: ENTITY_TYPE.WATCHLIST,
        clientVisible: false,
        summaryTemplate: 'Watchlist auto-pausada apos falhas consecutivas',
    },
};

module.exports = {
    LEVEL,
    CATEGORY,
    ENTITY_TYPE,
    ACTOR_TYPE,
    SOURCE,
    AUDIT_ACTIONS,
};
