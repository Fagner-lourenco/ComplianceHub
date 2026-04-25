/**
 * Constants: Errors
 * Standardized error codes and messages for Cloud Functions.
 * All HttpsError throws should reference these constants.
 */

const { HttpsError } = require('firebase-functions/v2/https');

// =============================================================================
// ERROR DEFINITIONS
// =============================================================================

const ERRORS = {
  // Authentication
  AUTH_REQUIRED: {
    code: 'unauthenticated',
    message: 'Autenticacao necessaria.',
  },
  LOGIN_REQUIRED: {
    code: 'unauthenticated',
    message: 'Login necessario.',
  },

  // Authorization — Generic
  PERMISSION_DENIED: {
    code: 'permission-denied',
    message: 'Permissao negada.',
  },
  ACCESS_DENIED_CASE: {
    code: 'permission-denied',
    message: 'Acesso negado ao caso.',
  },
  CASE_NOT_IN_TENANT: {
    code: 'permission-denied',
    message: 'Caso nao pertence ao seu tenant.',
  },
  CASE_OUTSIDE_TENANT: {
    code: 'permission-denied',
    message: 'Caso fora do tenant do cliente.',
  },
  ACCOUNT_DEACTIVATED: {
    code: 'permission-denied',
    message: 'Conta desativada. Contate o gestor da franquia.',
  },

  // Authorization — Role-specific
  MANAGERS_ONLY_USERS: {
    code: 'permission-denied',
    message: 'Apenas gestores podem listar usuarios da equipe.',
  },
  MANAGERS_ONLY_CREATE: {
    code: 'permission-denied',
    message: 'Apenas gestores podem criar usuarios.',
  },
  MANAGERS_ONLY_MODIFY: {
    code: 'permission-denied',
    message: 'Apenas gestores podem modificar usuarios.',
  },
  ANALYSTS_ONLY: {
    code: 'permission-denied',
    message: 'Apenas analistas podem acessar.',
  },
  ANALYSTS_ONLY_MATERIALIZE: {
    code: 'permission-denied',
    message: 'Apenas analistas podem materializar artefatos.',
  },
  ANALYSTS_ONLY_RERUN: {
    code: 'permission-denied',
    message: 'Apenas analistas podem re-executar fases do pipeline.',
  },
  ANALYSTS_ONLY_PREVIEW: {
    code: 'permission-denied',
    message: 'Apenas analistas e gestores podem executar preview.',
  },
  SUPERVISORS_ONLY_CONTRACT: {
    code: 'permission-denied',
    message: 'Apenas supervisores podem alterar contratos.',
  },
  SUPERVISORS_ONLY_BILLING: {
    code: 'permission-denied',
    message: 'Apenas supervisores podem fechar faturamento.',
  },
  SUPERVISORS_ONLY_QUOTES: {
    code: 'permission-denied',
    message: 'Apenas supervisores podem resolver cotacoes.',
  },
  SENIOR_ONLY_REVIEW: {
    code: 'permission-denied',
    message: 'Apenas senior/supervisor/admin pode resolver revisao senior.',
  },
  ADMIN_REQUIRED: {
    code: 'permission-denied',
    message: 'Requer permissao de admin.',
  },
  CROSS_TENANT_USER: {
    code: 'permission-denied',
    message: 'Voce nao pode gerenciar usuarios de outra franquia.',
  },
  CANNOT_REMOVE_SELF_MANAGER: {
    code: 'permission-denied',
    message: 'Voce nao pode remover seu proprio acesso de gestor.',
  },
  CANNOT_DEACTIVATE_SELF: {
    code: 'permission-denied',
    message: 'Voce nao pode desativar a si mesmo.',
  },
  USER_NOT_MANAGEABLE: {
    code: 'permission-denied',
    message: 'Este usuario nao pode ser gerenciado por aqui.',
  },
  CLIENT_PROFILE_MISSING: {
    code: 'permission-denied',
    message: 'Perfil do cliente nao encontrado.',
  },
  CLIENT_PROFILE_UNAUTHORIZED: {
    code: 'permission-denied',
    message: 'Perfil do cliente sem permissao para esta operacao.',
  },
  REPORT_NOT_IN_TENANT: {
    code: 'permission-denied',
    message: 'Relatorio nao pertence ao seu tenant.',
  },
  NO_CASE_PERMISSION: {
    code: 'permission-denied',
    message: 'Sem permissao para operar neste caso.',
  },
  NO_TENANT_PERMISSION: {
    code: 'permission-denied',
    message: 'Sem permissao para operar este tenant.',
  },
  NO_CONFIG_PERMISSION: {
    code: 'permission-denied',
    message: 'Sem permissao para configurar este tenant.',
  },
  NO_CONTRACT_READ: {
    code: 'permission-denied',
    message: 'Sem permissao para ler contrato deste tenant.',
  },
  NO_CONTRACT_WRITE: {
    code: 'permission-denied',
    message: 'Sem permissao para alterar contrato deste tenant.',
  },
  NO_BILLING_VIEW: {
    code: 'permission-denied',
    message: 'Sem permissao para ver consumo deste tenant.',
  },
  NO_BILLING_CLOSE: {
    code: 'permission-denied',
    message: 'Sem permissao para fechar faturamento deste tenant.',
  },
  NO_BILLING_EXPORT: {
    code: 'permission-denied',
    message: 'Sem permissao para exportar consumo deste tenant.',
  },
  NO_BILLING_SETTLEMENT_VIEW: {
    code: 'permission-denied',
    message: 'Sem permissao para ver fechamento deste tenant.',
  },
  NO_SENIOR_QUEUE_VIEW: {
    code: 'permission-denied',
    message: 'Sem permissao para ver fila senior deste tenant.',
  },
  NO_METRICS_VIEW: {
    code: 'permission-denied',
    message: 'Sem permissao para ver metricas deste tenant.',
  },
  NO_DIVERGENCE_RESOLVE: {
    code: 'permission-denied',
    message: 'Sem permissao para resolver divergencias de provider.',
  },
  NO_SENIOR_RESOLVE: {
    code: 'permission-denied',
    message: 'Sem permissao para resolver esta revisao senior.',
  },
  WATCHLIST_ANALYSTS_ONLY: {
    code: 'permission-denied',
    message: 'Somente analistas podem gerenciar watchlists.',
  },

  // Not Found
  CASE_NOT_FOUND: {
    code: 'not-found',
    message: 'Caso nao encontrado.',
  },
  USER_NOT_FOUND: {
    code: 'not-found',
    message: 'Usuario nao encontrado.',
  },
  PROFILE_NOT_FOUND: {
    code: 'not-found',
    message: 'Perfil nao encontrado.',
  },
  REPORT_NOT_FOUND: {
    code: 'not-found',
    message: 'Relatorio nao encontrado.',
  },
  DIVERGENCE_NOT_FOUND: {
    code: 'not-found',
    message: 'Divergencia nao encontrada.',
  },
  ALERT_NOT_FOUND: {
    code: 'not-found',
    message: 'Alerta nao encontrado.',
  },
  WATCHLIST_NOT_FOUND: {
    code: 'not-found',
    message: 'Watchlist nao encontrada.',
  },
  QUOTE_NOT_FOUND: {
    code: 'not-found',
    message: 'Cotacao nao encontrada.',
  },
  SENIOR_NOT_FOUND: {
    code: 'not-found',
    message: 'Pendencia senior nao encontrada.',
  },

  // Invalid Argument — Generic
  INVALID_ARGUMENT: {
    code: 'invalid-argument',
    message: 'Dados invalidos.',
  },

  // Invalid Argument — Specific fields
  CASE_ID_REQUIRED: {
    code: 'invalid-argument',
    message: 'caseId e obrigatorio.',
  },
  CASE_ID_MISSING: {
    code: 'invalid-argument',
    message: 'caseId ausente.',
  },
  TENANT_ID_REQUIRED: {
    code: 'invalid-argument',
    message: 'tenantId obrigatorio.',
  },
  PRODUCT_KEY_REQUIRED: {
    code: 'invalid-argument',
    message: 'productKey e obrigatorio.',
  },
  SUBJECT_ID_REQUIRED: {
    code: 'invalid-argument',
    message: 'subjectId obrigatorio.',
  },
  DIVERGENCE_ID_REQUIRED: {
    code: 'invalid-argument',
    message: 'divergenceId e caseId sao obrigatorios.',
  },
  WATCHLIST_ID_REQUIRED: {
    code: 'invalid-argument',
    message: 'watchlistId obrigatorio.',
  },
  ALERT_ID_REQUIRED: {
    code: 'invalid-argument',
    message: 'alertId obrigatorio.',
  },
  QUOTE_ID_REQUIRED: {
    code: 'invalid-argument',
    message: 'quoteId obrigatorio.',
  },
  REQUEST_ID_REQUIRED: {
    code: 'invalid-argument',
    message: 'requestId obrigatorio.',
  },
  USER_ID_REQUIRED: {
    code: 'invalid-argument',
    message: 'ID do usuario alvo e obrigatorio.',
  },

  // Invalid Argument — Data validation
  INVALID_CPF: {
    code: 'invalid-argument',
    message: 'CPF invalido.',
  },
  INVALID_CPF_RESUBMIT: {
    code: 'invalid-argument',
    message: 'CPF invalido para reenviar o caso.',
  },
  NAME_TOO_SHORT: {
    code: 'invalid-argument',
    message: 'Nome precisa ter pelo menos 2 caracteres.',
  },
  NAME_CPF_REQUIRED: {
    code: 'invalid-argument',
    message: 'Nome completo e CPF valido sao obrigatorios.',
  },
  EMAIL_PASSWORD_NAME_REQUIRED: {
    code: 'invalid-argument',
    message: 'Email, senha e nome sao obrigatorios.',
  },
  COMPANY_DATA_REQUIRED: {
    code: 'invalid-argument',
    message: 'Razao social e CNPJ valido sao obrigatorios para produtos PJ.',
  },
  MISSING_CLIENT_DATA: {
    code: 'invalid-argument',
    message: 'Dados obrigatorios ausentes para criar o cliente.',
  },
  MISSING_RESUBMIT_DATA: {
    code: 'invalid-argument',
    message: 'Dados obrigatorios ausentes para reenviar o caso.',
  },
  INVALID_ROLE_CLIENT: {
    code: 'invalid-argument',
    message: 'Role invalida para usuario cliente.',
  },
  INVALID_ROLE_OPTIONS: {
    code: 'invalid-argument',
    message: 'Role invalida. Use client_viewer, client_operator ou client_manager.',
  },
  INVALID_STATUS: {
    code: 'invalid-argument',
    message: 'Status invalido. Use active ou inactive.',
  },
  INVALID_DECISION: {
    code: 'invalid-argument',
    message: 'decision deve ser approved ou rejected.',
  },
  INVALID_STATUS_DECISION: {
    code: 'invalid-argument',
    message: 'status deve ser approved ou rejected.',
  },
  INVALID_PHASE: {
    code: 'invalid-argument',
    message: 'Fase invalida para rerun.',
  },
  INVALID_FORMAT: {
    code: 'invalid-argument',
    message: 'format deve ser csv ou json.',
  },
  INVALID_MONTH_KEY: {
    code: 'invalid-argument',
    message: 'monthKey deve estar no formato YYYY-MM.',
  },
  INVALID_TENANT_ID: {
    code: 'invalid-argument',
    message: 'Nao foi possivel gerar tenantId valido.',
  },
  INVALID_PRODUCT_KEY: {
    code: 'invalid-argument',
    message: (key) => `Produto desconhecido: ${key}`,
  },
  AI_DECISION_REQUIRED: {
    code: 'invalid-argument',
    message: 'caseId e aiDecision validos sao obrigatorios.',
  },
  CASE_REASON_REQUIRED: {
    code: 'invalid-argument',
    message: 'caseId e motivo sao obrigatorios.',
  },
  JUSTIFICATION_REQUIRED: {
    code: 'invalid-argument',
    message: 'Justificativa obrigatoria para rejeicao senior.',
  },
  HTML_REPORT_MISSING: {
    code: 'invalid-argument',
    message: 'HTML do relatorio ausente.',
  },
  HTML_REPORT_EMPTY: {
    code: 'invalid-argument',
    message: 'HTML do relatorio ficou vazio apos sanitizacao.',
  },
  TOKEN_MISSING: {
    code: 'invalid-argument',
    message: 'Token do relatorio ausente.',
  },
  EXPORT_SCOPE_REQUIRED: {
    code: 'invalid-argument',
    message: 'Tipo e escopo da exportacao sao obrigatorios.',
  },

  // Failed Precondition — Generic
  FAILED_PRECONDITION: {
    code: 'failed-precondition',
    message: 'Condicao necessaria nao atendida.',
  },

  // Failed Precondition — Case state
  CASE_NOT_DONE: {
    code: 'failed-precondition',
    message: 'Relatorio disponivel apenas para casos concluidos.',
  },
  CASE_NOT_DONE_PUBLIC: {
    code: 'failed-precondition',
    message: 'Relatorio publico so pode ser gerado para casos concluidos.',
  },
  CASE_ALREADY_CONCLUDED: {
    code: 'failed-precondition',
    message: 'Nao e possivel salvar rascunho em caso ja concluido.',
  },
  NO_RERUN_ON_CLOSED: {
    code: 'failed-precondition',
    message: 'Nao e permitido reexecutar enriquecimento em casos concluidos ou devolvidos.',
  },
  CORRECTION_ONLY: {
    code: 'failed-precondition',
    message: 'Apenas casos com correcao solicitada podem ser reenviados.',
  },

  // Failed Precondition — Tenant / Feature
  TENANT_NOT_IDENTIFIED: {
    code: 'failed-precondition',
    message: 'Tenant nao identificado.',
  },
  CLIENT_NO_TENANT: {
    code: 'failed-precondition',
    message: 'Cliente sem tenantId associado.',
  },
  CASE_NO_TENANT: {
    code: 'failed-precondition',
    message: 'Caso sem tenantId.',
  },
  CASE_CREATION_DISABLED: {
    code: 'failed-precondition',
    message: 'Criacao de casos nao habilitada para este tenant.',
  },
  PRODUCT_DISABLED: {
    code: 'failed-precondition',
    message: (key) => `Produto ${key} nao habilitado para este tenant.`,
  },
  BILLING_DASHBOARD_DISABLED: {
    code: 'failed-precondition',
    message: 'Dashboard de billing nao habilitado para este tenant.',
  },
  WATCHLIST_DISABLED: {
    code: 'failed-precondition',
    message: 'Monitoramento de watchlist nao habilitado para este tenant.',
  },

  // Failed Precondition — Provider
  JUDIT_DISABLED: {
    code: 'failed-precondition',
    message: 'Judit desabilitado para este tenant.',
  },
  ESCAVADOR_DISABLED: {
    code: 'failed-precondition',
    message: 'Escavador desabilitado para este tenant.',
  },
  FONTEDATA_DISABLED: {
    code: 'failed-precondition',
    message: 'FonteData desabilitado para este tenant.',
  },
  BIGDATACORP_DISABLED: {
    code: 'failed-precondition',
    message: 'BigDataCorp desabilitado para este tenant.',
  },
  DJEN_DISABLED: {
    code: 'failed-precondition',
    message: 'DJEN desabilitado para este tenant.',
  },
  BIGDATACORP_CREDENTIALS_MISSING: {
    code: 'failed-precondition',
    message: 'Credenciais BigDataCorp nao configuradas.',
  },

  // Failed Precondition — Pipeline state
  ENRICHMENT_INCOMPLETE: {
    code: 'failed-precondition',
    message: 'Enriquecimento (Judit ou FonteData) nao concluido.',
  },
  JUDIT_BEFORE_ESCAVADOR: {
    code: 'failed-precondition',
    message: 'Judit precisa estar concluido antes do rerun do Escavador.',
  },
  GATE_BLOCKED: {
    code: 'failed-precondition',
    message: 'FonteData bloqueou o caso no gate de identidade. Corrija os dados antes de tentar novamente.',
  },
  DIVERGENCE_MISMATCH: {
    code: 'failed-precondition',
    message: 'Divergencia nao pertence ao caso informado.',
  },

  // Resource Exhausted
  AI_RATE_LIMIT: {
    code: 'resource-exhausted',
    message: 'Aguarde 1 minuto entre execucoes de IA.',
  },
  AI_EXECUTION_LIMIT: {
    code: 'resource-exhausted',
    message: 'Limite de 3 execucoes de IA por caso atingido.',
  },

  // Internal
  OPENAI_KEY_MISSING: {
    code: 'internal',
    message: 'Chave OpenAI nao configurada.',
  },
  HTML_GENERATION_FAILED: {
    code: 'internal',
    message: 'Falha ao gerar HTML do relatorio.',
  },
  FONTEDATA_KEY_MISSING: {
    code: 'internal',
    message: 'FONTEDATA_API_KEY nao configurado para fallback.',
  },
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Throw a standardized HttpsError.
 * @param {string} key — Key in ERRORS object
 * @param {...any} args — Template arguments for dynamic messages
 */
function throwError(key, ...args) {
  const def = ERRORS[key];
  if (!def) {
    throw new HttpsError('internal', `Erro desconhecido: ${key}`);
  }
  const message = typeof def.message === 'function'
    ? def.message(...args)
    : def.message;
  throw new HttpsError(def.code, message);
}

/**
 * Create an error object without throwing (useful for batch validation).
 * @param {string} key
 * @param {...any} args
 * @returns {{code: string, message: string}}
 */
function makeError(key, ...args) {
  const def = ERRORS[key];
  if (!def) {
    return { code: 'internal', message: `Erro desconhecido: ${key}` };
  }
  const message = typeof def.message === 'function'
    ? def.message(...args)
    : def.message;
  return { code: def.code, message };
}

module.exports = {
  ERRORS,
  throwError,
  makeError,
};
