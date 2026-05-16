/**
 * General UI labels and terminology by audience.
 * Centralizes the product vocabulary to ensure consistency.
 */

// ── Core Concepts ───────────────────────────────────────────────────────────

export const CONCEPTS = {
  CLIENT: {
    case: 'solicitação',
    casePlural: 'solicitações',
    analysis: 'análise',
    analysisPlural: 'análises',
    tenant: 'empresa',
    tenantPlural: 'empresas',
    report: 'relatório',
    reportPublic: 'link de relatório',
    export: 'arquivo',
    exportPlural: 'arquivos',
    user: 'usuário',
    userPlural: 'usuários',
    team: 'equipe',
    audit: 'histórico de atividades',
    dashboard: 'acompanhamento',
    queue: 'fila de análise',
    settings: 'configurações',
    health: 'integrações',
    metrics: 'qualidade da análise',
  },
  OPS: {
    case: 'caso',
    casePlural: 'casos',
    analysis: 'análise',
    analysisPlural: 'análises',
    tenant: 'empresa',
    tenantPlural: 'empresas',
    report: 'relatório',
    reportPublic: 'relatório compartilhado',
    export: 'exportação',
    exportPlural: 'exportações',
    user: 'usuário',
    userPlural: 'usuários',
    team: 'equipe interna',
    audit: 'histórico de atividades',
    dashboard: 'painel',
    queue: 'fila de análise',
    settings: 'configurações da empresa',
    health: 'integrações',
    metrics: 'qualidade da análise',
  },
};

// ── Technical → Human translations ──────────────────────────────────────────

export const TECH_TO_HUMAN = {
  CLIENT: {
    // Technical term → Human-friendly label
    tenant: 'empresa',
    pipeline: 'etapas da análise',
    dueDiligence: 'análise cadastral e de risco',
    enrichment: 'consulta automática',
    provider: 'fonte de dados',
    score: 'nível de atenção',
    verdict: 'resultado',
    token: 'link de acesso',
    sla: 'prazo combinado',
    osint: 'perfis públicos',
    ia: 'análise automática',
    api: 'integração',
    audit: 'histórico de atividades',
    case: 'solicitação',
    firebaseAuth: 'login',
    firestore: '',
    userProfiles: '',
    circuitBreaker: 'proteção contra instabilidade',
    gate: 'confirmação de identidade',
    payload: 'dados enviados',
    cache: 'memória temporária',
    json: 'dados',
  },
  OPS: {
    tenant: 'empresa',
    pipeline: 'etapas da análise',
    dueDiligence: 'análise cadastral',
    enrichment: 'consulta automática',
    provider: 'fonte de dados',
    score: 'pontuação de risco',
    verdict: 'decisão',
    token: 'link',
    sla: 'prazo / SLA',
    osint: 'perfis públicos',
    ia: 'análise automática / IA',
    api: 'integração / API',
    audit: 'auditoria / histórico',
    case: 'caso / solicitação',
    firebaseAuth: 'Firebase Auth',
    firestore: 'Firestore',
    userProfiles: 'userProfiles',
    circuitBreaker: 'circuit breaker',
    gate: 'gate de identidade',
    payload: 'payload',
    cache: 'cache',
    json: 'JSON',
  },
};

// ── Analysis Phase Labels ───────────────────────────────────────────────────

export const PHASE_LABELS = {
  CLIENT: {
    criminal: 'Antecedentes criminais',
    labor: 'Processos trabalhistas',
    warrant: 'Mandados de prisão',
    osint: 'Perfis públicos',
    social: 'Análise social',
    digital: 'Perfil digital',
    conflictInterest: 'Conflito de interesse',
  },
  OPS: {
    criminal: 'Análise criminal',
    labor: 'Trabalhista',
    warrant: 'Mandado de prisão',
    osint: 'Perfis públicos',
    social: 'Social',
    digital: 'Perfil digital',
    conflictInterest: 'Conflito de interesse',
  },
};

// ── Provider Names (always technical, but can be hidden in client view) ─────

export const PROVIDER_NAMES = {
  bigdatacorp: 'BigDataCorp',
  judit: 'Judit',
  escavador: 'Escavador',
  fontedata: 'FonteData',
  djen: 'DJEN',
  openai: 'OpenAI',
};

// ── Role Labels ─────────────────────────────────────────────────────────────

export const ROLE_LABELS = {
  CLIENT: {
    client_viewer: 'Apenas acompanha',
    client_operator: 'Cria solicitações',
    client_manager: 'Gerencia equipe e solicitações',
    legacy_client: 'Cliente',
  },
  OPS: {
    analyst: 'Analista',
    supervisor: 'Supervisor',
    admin: 'Administrador',
    owner: 'Proprietário',
  },
};

export const ROLE_DESCRIPTIONS = {
  CLIENT: {
    client_viewer: 'Pode visualizar solicitações e relatórios, sem criar novos pedidos ou alterar usuários.',
    client_operator: 'Pode abrir novos pedidos de análise e acompanhar resultados.',
    client_manager: 'Pode gerenciar usuários, solicitações e configurações da empresa.',
  },
  OPS: {
    analyst: 'Analisa casos, salva rascunhos e conclui verificações.',
    supervisor: 'Gerencia analistas, atribui casos e acompanha métricas.',
    admin: 'Acesso total: gestão de empresas, equipe, configurações e auditoria.',
    owner: 'Acesso total ao sistema.',
  },
};

// ── Helper: get label for audience ──────────────────────────────────────────

export function getConcept(key, audience = 'client') {
  const a = audience === 'ops' ? 'OPS' : 'CLIENT';
  return CONCEPTS[a][key] || key;
}

export function getTechLabel(techTerm, audience = 'client') {
  const a = audience === 'ops' ? 'OPS' : 'CLIENT';
  return TECH_TO_HUMAN[a][techTerm] || techTerm;
}

export function getPhaseLabel(phase, audience = 'client') {
  const a = audience === 'ops' ? 'OPS' : 'CLIENT';
  return PHASE_LABELS[a][phase] || phase;
}

export function getRoleLabel(role, audience = 'client') {
  const a = audience === 'ops' ? 'OPS' : 'CLIENT';
  return ROLE_LABELS[a][role] || role;
}

export function getRoleDescription(role, audience = 'client') {
  const a = audience === 'ops' ? 'OPS' : 'CLIENT';
  return ROLE_DESCRIPTIONS[a][role] || '';
}
