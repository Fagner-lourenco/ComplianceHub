/**
 * User-facing messages: errors, loading states, success, empty states.
 * All messages are human-friendly — no technical jargon.
 */

// ── Auth / Access States ────────────────────────────────────────────────────

export const ACCESS_MESSAGES = {
  identityConfirmed: 'Login confirmado',
  profileMissing: {
    title: 'Seu acesso ainda não foi liberado',
    body: 'Seu login foi confirmado, mas não encontramos um perfil de acesso para esta conta. Entre em contato com o administrador da sua empresa para liberar o acesso.',
  },
  profileError: {
    title: 'Falha ao sincronizar o perfil',
    body: 'Não foi possível carregar seus dados de acesso. Se o problema continuar, tente recarregar a página.',
  },
  profileDelayed: {
    title: 'Confirmando permissões e contexto',
    body: 'Estamos confirmando seus dados. Aguarde um momento.',
  },
  profileLoading: {
    title: 'Carregando perfil e empresas disponíveis',
    body: 'Confirmando suas informações de acesso...',
  },
  accessRestricted: {
    title: 'Acesso restrito',
    body: 'Seu perfil atual não possui permissão confirmada para acessar esta área do sistema.',
  },
  wrongTenant: {
    title: 'Empresa não vinculada',
    body: 'Sua conta não está vinculada a esta empresa. Entre em contato com o administrador.',
  },
};

// ── Loading States ──────────────────────────────────────────────────────────

export const LOADING_MESSAGES = {
  splash: 'Iniciando sistema seguro...',
  cases: 'Carregando solicitações...',
  caseDetail: 'Carregando detalhes...',
  users: 'Carregando usuários...',
  exports: 'Carregando arquivos...',
  reports: 'Carregando links...',
  audit: 'Carregando histórico...',
  settings: 'Carregando configurações...',
  health: 'Carregando status das integrações...',
  metrics: 'Carregando métricas...',
};

// ── Error Messages ──────────────────────────────────────────────────────────

export const ERROR_MESSAGES = {
  generic: 'Não foi possível carregar os dados agora. Tente novamente em alguns instantes.',
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
  permission: 'Você não tem permissão para acessar esta área.',
  notFound: 'Não encontramos o que você procura.',
  quotaExceeded: 'Você atingiu o limite de uso. Entre em contato com o suporte.',
  exportFailed: 'Não foi possível gerar o arquivo. Tente novamente.',
  reportFailed: 'Não foi possível carregar o relatório.',
  linkExpired: 'Este link não está mais disponível.',
  linkRevoked: 'Este link foi desativado.',
  caseNotFound: 'Não encontramos esta análise.',
  tenantNotLoaded: 'Empresa ainda não carregada',
  sessionSyncing: 'Estamos carregando seus dados de acesso',
};

// ── Success Messages ────────────────────────────────────────────────────────

export const SUCCESS_MESSAGES = {
  caseCreated: 'Solicitação enviada com sucesso. A análise foi criada e já está disponível para a equipe responsável.',
  caseCorrected: 'Solicitação corrigida e reenviada para análise.',
  caseConcluded: 'Análise concluída com sucesso.',
  exportCreated: 'Arquivo gerado com sucesso.',
  reportCreated: 'Link de relatório criado com sucesso.',
  reportRevoked: 'Link de acesso desativado.',
  userCreated: 'Usuário criado com sucesso.',
  userUpdated: 'Usuário atualizado com sucesso.',
  profileUpdated: 'Perfil atualizado com sucesso.',
  settingsSaved: 'Configurações salvas com sucesso.',
  passwordReset: 'Senha redefinida com sucesso.',
};

// ── Empty States ────────────────────────────────────────────────────────────

export const EMPTY_STATES = {
  cases: 'Nenhuma solicitação encontrada.',
  casesQueue: 'Nenhum caso na fila. Quando novas solicitações chegarem, elas aparecerão aqui.',
  exports: 'Nenhum arquivo gerado ainda.',
  reports: 'Nenhum link de relatório criado.',
  users: 'Nenhum usuário cadastrado.',
  audit: 'Nenhum registro encontrado.',
  clients: 'Nenhum cliente cadastrado.',
  notifications: 'Nenhuma notificação.',
};

// ── Confirmation Dialogs ────────────────────────────────────────────────────

export const CONFIRM_MESSAGES = {
  exceedQuota: {
    title: 'Confirmar envio acima do limite?',
    body: 'Este envio ultrapassa o limite mensal da sua empresa. Se continuar, ele será registrado para conferência posterior.',
  },
  revokeReport: {
    title: 'Desativar link de acesso',
    body: 'O link de acesso será desativado permanentemente. Esta ação não pode ser desfeita.',
  },
  blockUser: {
    title: 'Bloquear usuário',
    body: 'O acesso deste usuário será bloqueado no portal. Esta ação ficará registrada no histórico de segurança.',
  },
  deleteUser: {
    title: 'Remover usuário',
    body: 'Esta ação remove o acesso do usuário permanentemente.',
  },
  returnCase: {
    title: 'Devolver para correção',
    body: 'A solicitação será devolvida ao cliente para correção.',
  },
  discardDraft: {
    title: 'Descartar alterações',
    body: 'Existem alterações não salvas. Deseja descartá-las?',
  },
};

// ── Form Labels ─────────────────────────────────────────────────────────────

export const FORM_LABELS = {
  fullName: 'Nome completo',
  cpf: 'CPF',
  dateOfBirth: 'Data de nascimento',
  position: 'Cargo',
  department: 'Departamento',
  email: 'E-mail',
  phone: 'Telefone',
  company: 'Empresa',
  priority: 'Prioridade',
  notes: 'Observações',
  socialProfiles: 'Perfis públicos',
  socialProfilesHint: 'Links públicos ajudam a equipe a verificar informações disponíveis online.',
  internalNotes: 'Observações internas',
  internalNotesHint: 'Estas informações serão vistas apenas pela equipe responsável pela análise.',
  cpfHint: 'Usamos o CPF para localizar registros com mais precisão. Ele será exibido de forma protegida nas telas.',
};

// ── Action Buttons ──────────────────────────────────────────────────────────

export const ACTION_LABELS = {
  assume: 'Assumir análise',
  assign: 'Atribuir responsável',
  reassign: 'Alterar responsável',
  open: 'Abrir caso',
  viewDetails: 'Ver detalhes',
  viewReport: 'Abrir relatório',
  correct: 'Corrigir solicitação',
  submit: 'Enviar',
  save: 'Salvar',
  cancel: 'Cancelar',
  close: 'Fechar',
  back: 'Voltar',
  next: 'Próximo',
  previous: 'Anterior',
  reload: 'Recarregar',
  logout: 'Sair',
  generate: 'Gerar arquivo',
  export: 'Exportar',
  create: 'Criar',
  add: 'Adicionar',
  edit: 'Editar',
  delete: 'Remover',
  block: 'Bloquear',
  activate: 'Ativar',
  search: 'Buscar',
  filter: 'Filtrar',
  clearFilters: 'Limpar filtros',
};
