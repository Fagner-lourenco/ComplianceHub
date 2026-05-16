/**
 * Risk / verdict / classification labels by audience.
 */

// ── Criminal / General risk ─────────────────────────────────────────────────
export const CRISK_LABELS = {
  CLIENT: {
    NEGATIVE: { label: 'Sem apontamento', icon: 'OK', color: 'green' },
    NEGATIVE_PARTIAL: { label: 'Parcial', icon: '!', color: 'yellow' },
    POSITIVE: { label: 'Com apontamento', icon: '!', color: 'red' },
    INCONCLUSIVE: { label: 'Inconclusivo', icon: '?', color: 'blue' },
    INCONCLUSIVE_HOMONYM: { label: 'Precisa de revisão manual', icon: '?', color: 'yellow' },
    INCONCLUSIVE_LOW_COVERAGE: { label: 'Cobertura insuficiente', icon: '?', color: 'yellow' },
    NOT_FOUND: { label: 'Não encontrado', icon: '-', color: 'gray' },
  },
  OPS: {
    NEGATIVE: { label: 'Negativo', icon: 'OK', color: 'green' },
    NEGATIVE_PARTIAL: { label: 'Negativo parcial', icon: '!', color: 'yellow' },
    POSITIVE: { label: 'Positivo', icon: '!', color: 'red' },
    INCONCLUSIVE: { label: 'Inconclusivo', icon: '?', color: 'blue' },
    INCONCLUSIVE_HOMONYM: { label: 'Inconclusivo por homônimo', icon: '?', color: 'yellow' },
    INCONCLUSIVE_LOW_COVERAGE: { label: 'Inconclusivo por cobertura', icon: '?', color: 'yellow' },
    NOT_FOUND: { label: 'Não encontrado', icon: '-', color: 'gray' },
  },
};

// ── Coverage ────────────────────────────────────────────────────────────────
export const COVERAGE_LABELS = {
  HIGH_COVERAGE: { label: 'Cobertura alta', icon: 'OK', color: 'green' },
  PARTIAL_COVERAGE: { label: 'Cobertura parcial', icon: '!', color: 'yellow' },
  LOW_COVERAGE: { label: 'Cobertura reduzida', icon: '?', color: 'gray' },
};

// ── OSINT / Severity ────────────────────────────────────────────────────────
export const SEVERITY_LABELS = {
  CLIENT: {
    LOW: { label: 'Baixo', icon: 'OK', color: 'green' },
    MEDIUM: { label: 'Médio', icon: '!', color: 'yellow' },
    HIGH: { label: 'Alto', icon: '!', color: 'red' },
    UNKNOWN: { label: 'N/A', icon: '?', color: 'gray' },
  },
  OPS: {
    LOW: { label: 'Baixo', icon: 'OK', color: 'green' },
    MEDIUM: { label: 'Médio', icon: '!', color: 'yellow' },
    HIGH: { label: 'Alto', icon: '!', color: 'red' },
    UNKNOWN: { label: 'N/A', icon: '?', color: 'gray' },
  },
};

// ── Social ──────────────────────────────────────────────────────────────────
export const SOCIAL_LABELS = {
  APPROVED: { label: 'Aprovado', icon: 'OK', color: 'green' },
  NEUTRAL: { label: 'Neutro', icon: '-', color: 'gray' },
  CONCERN: { label: 'Atenção', icon: '!', color: 'yellow' },
  CONTRAINDICATED: { label: 'Contraindicado', icon: '!', color: 'red' },
};

// ── Digital ─────────────────────────────────────────────────────────────────
export const DIGITAL_LABELS = {
  CLIENT: {
    CLEAN: { label: 'Limpo', icon: 'OK', color: 'green' },
    ALERT: { label: 'Alerta', icon: '!', color: 'yellow' },
    CRITICAL: { label: 'Crítico', icon: '!', color: 'red' },
    NOT_CHECKED: { label: 'Não verificado', icon: '?', color: 'gray' },
  },
  OPS: {
    CLEAN: { label: 'Limpo', icon: 'OK', color: 'green' },
    ALERT: { label: 'Alerta', icon: '!', color: 'yellow' },
    CRITICAL: { label: 'Crítico', icon: '!', color: 'red' },
    NOT_CHECKED: { label: 'Não verificado', icon: '?', color: 'gray' },
  },
};

// ── Conflict ────────────────────────────────────────────────────────────────
export const CONFLICT_LABELS = {
  YES: { label: 'Sim', icon: '!', color: 'red' },
  NO: { label: 'Não', icon: 'OK', color: 'green' },
  UNKNOWN: { label: 'Desconhecido', icon: '?', color: 'gray' },
};

// ── Verdict (final decision) ────────────────────────────────────────────────
export const VERDICT_LABELS = {
  CLIENT: {
    FIT: { label: 'Apto', icon: 'OK', color: 'green' },
    ATTENTION: { label: 'Atenção', icon: '!', color: 'yellow' },
    NOT_RECOMMENDED: { label: 'Não recomendado', icon: '!', color: 'red' },
    PENDING: { label: 'Pendente', icon: '...', color: 'gray' },
    INCONCLUSIVE: { label: 'Inconclusivo', icon: '?', color: 'blue' },
  },
  OPS: {
    FIT: { label: 'Apto', icon: 'OK', color: 'green' },
    ATTENTION: { label: 'Atenção', icon: '!', color: 'yellow' },
    NOT_RECOMMENDED: { label: 'Não recomendado', icon: '!', color: 'red' },
    PENDING: { label: 'Pendente', icon: '...', color: 'gray' },
    INCONCLUSIVE: { label: 'Inconclusivo', icon: '?', color: 'blue' },
  },
};

// ── Risk Level ──────────────────────────────────────────────────────────────
export const RISK_LEVEL_LABELS = {
  CLIENT: {
    GREEN: { label: 'Baixo', icon: 'OK', color: 'green' },
    YELLOW: { label: 'Médio', icon: '!', color: 'yellow' },
    RED: { label: 'Alto', icon: '!', color: 'red' },
  },
  OPS: {
    GREEN: { label: 'Verde', icon: 'OK', color: 'green' },
    YELLOW: { label: 'Amarelo', icon: '!', color: 'yellow' },
    RED: { label: 'Vermelho', icon: '!', color: 'red' },
  },
};

/**
 * Unified risk config lookup.
 * Maps a value + category to the correct label config.
 */
export function getRiskConfig(value, category = 'criminal', audience = 'client') {
  const a = audience === 'ops' ? 'OPS' : 'CLIENT';

  switch (category) {
  case 'criminal':
  case 'general':
    return CRISK_LABELS[a][value] || { label: value || '-', icon: '?', color: 'gray' };
  case 'coverage':
    return COVERAGE_LABELS[value] || { label: value || '-', icon: '?', color: 'gray' };
  case 'severity':
  case 'osint':
    return SEVERITY_LABELS[a][value] || { label: value || '-', icon: '?', color: 'gray' };
  case 'social':
    return SOCIAL_LABELS[value] || { label: value || '-', icon: '?', color: 'gray' };
  case 'digital':
    return DIGITAL_LABELS[a][value] || { label: value || '-', icon: '?', color: 'gray' };
  case 'conflict':
    return CONFLICT_LABELS[value] || { label: value || '-', icon: '?', color: 'gray' };
  case 'verdict':
    return VERDICT_LABELS[a][value] || { label: value || '-', icon: '?', color: 'gray' };
  case 'riskLevel':
    return RISK_LEVEL_LABELS[a][value] || { label: value || '-', icon: '?', color: 'gray' };
  default:
    return { label: value || '-', icon: '?', color: 'gray' };
  }
}

/**
 * Get just the label text for a risk value.
 */
export function getRiskLabel(value, category = 'criminal', audience = 'client') {
  return getRiskConfig(value, category, audience).label;
}
