/**
 * Navigation labels, page titles, and menu items.
 */

// ── Sidebar Navigation ──────────────────────────────────────────────────────

export const CLIENT_NAV = [
  { to: '/client/dashboard', icon: 'home', label: 'Início', permission: 'case.read' },
  { to: '/client/solicitacoes', icon: 'fileText', label: 'Minhas solicitações', permission: 'case.read' },
  { to: '/client/exportacoes', icon: 'download', label: 'Arquivos gerados', permission: 'case.export' },
  { to: '/client/relatorios', icon: 'link', label: 'Links compartilhados', permission: 'case.export' },
  { to: '/client/equipe', icon: 'users', label: 'Usuários', permission: 'users.manage' },
  { to: '/client/auditoria', icon: 'clock', label: 'Histórico', permission: 'tenant_audit.view' },
];

export const OPS_NAV = [
  { to: '/ops/fila', icon: 'inbox', label: 'Fila de análise', permission: 'case.read' },
  { to: '/ops/casos', icon: 'folder', label: 'Casos', permission: 'case.read' },
  { to: '/ops/clientes', icon: 'building', label: 'Clientes', permission: 'users.manage' },
  { to: '/ops/equipe', icon: 'users', label: 'Equipe interna', permission: 'users.manage' },
  { to: '/ops/auditoria', icon: 'clock', label: 'Histórico', permission: 'audit.view' },
  { to: '/ops/metricas-ia', icon: 'barChart', label: 'Qualidade da análise', permission: 'audit.view' },
  { to: '/ops/relatorios', icon: 'share', label: 'Relatórios compartilhados', permission: 'report_public.view' },
  { to: '/ops/saude', icon: 'activity', label: 'Integrações', permission: 'audit.view' },
];

// ── Page Titles ─────────────────────────────────────────────────────────────

export const PAGE_TITLES = {
  // Client portal
  'client/dashboard': 'Acompanhamento das solicitações',
  'client/solicitacoes': 'Minhas solicitações',
  'client/nova-solicitacao': 'Nova análise',
  'client/exportacoes': 'Arquivos gerados',
  'client/relatorios': 'Links de relatório',
  'client/equipe': 'Usuários',
  'client/auditoria': 'Histórico de atividades',
  'client/perfil': 'Meu perfil',

  // Ops portal
  'ops/fila': 'Fila de análise',
  'ops/casos': 'Casos',
  'ops/clientes': 'Clientes',
  'ops/equipe': 'Equipe interna',
  'ops/auditoria': 'Histórico de atividades',
  'ops/metricas-ia': 'Qualidade da análise',
  'ops/relatorios': 'Relatórios compartilhados',
  'ops/saude': 'Integrações',
  'ops/tenant-settings': 'Configurações da empresa',
  'ops/perfil': 'Meu perfil',
};

// ── Context / Tenant Labels ─────────────────────────────────────────────────

export const CONTEXT_LABELS = {
  OPS: {
    sidebarContextLabel: 'Empresa selecionada',
    topbarContextLabel: 'Empresa selecionada',
    allTenantsOption: 'Todas as empresas',
    loadingStatus: 'Carregando empresas disponíveis',
    syncStatus: 'Usando a última empresa carregada',
    dataContextHint: 'Os dados exibidos pertencem à empresa selecionada',
  },
  CLIENT: {
    sidebarContextLabel: 'Empresa vinculada',
    topbarContextLabel: 'Empresa atual',
  },
};

// ── Icon SVGs (lightweight inline) ──────────────────────────────────────────

export const ICONS = {
  home: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  fileText: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  ),
  download: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  ),
  link: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  inbox: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
  ),
  folder: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
  ),
  building: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><line x1="9" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="15" y2="12"/><line x1="9" y1="8" x2="9" y2="8"/><line x1="15" y1="8" x2="15" y2="8"/><line x1="9" y1="16" x2="9" y2="16"/><line x1="15" y1="16" x2="15" y2="16"/></svg>
  ),
  barChart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
  ),
  share: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  ),
  activity: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  ),
};
