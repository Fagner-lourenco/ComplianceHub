# Correcoes Pagina a Pagina - ComplianceHub

Controle incremental das rodadas de correcao guiadas pela auditoria consolidada `ComplianceHub_Auditoria_Completa_Paginas.md`.

Status: `[ ] Pendente` · `[~] Em andamento` · `[x] Corrigida` · `[!] Parcial / pendente de decisao` · `[-] Nao aplicavel`

## Portal Cliente

- [x] 01. Portal Cliente - Solicitacoes
      Rota: /client/solicitacoes
      Prioridade: P0/P1
      Foco: lista de solicitacoes, drawer, pagina interna de relatorio, quota, filtros, public report.
      Rodada: 2026-04-30
      Status: Corrigida
      Arquivos alterados:
        - src/App.jsx
        - src/core/clientPortal.js
        - src/portals/client/SolicitacoesPage.jsx
        - src/portals/client/SolicitacoesPage.css
        - src/portals/client/SolicitacoesPage.test.jsx
        - src/portals/client/ClientReportPage.jsx
        - src/portals/client/ClientReportPage.css
        - src/ui/components/QuotaBar/QuotaBar.jsx
        - src/ui/components/QuotaBar/QuotaBar.css
      Testes executados:
        - npm run test -- src/portals/client/SolicitacoesPage.test.jsx src/ui/components/QuotaBar/QuotaBar.test.jsx: passou
        - npm run test: falhou em teste preexistente functions/audit/writeAuditEvent.test.js
        - npm run lint: falhou em problemas preexistentes fora da pagina
        - npm run build: passou
      Resultado:
        - Drawer mantido como previa com CTA para dossie interno autenticado.
        - Rota /client/relatorio/:caseId e demo equivalente adicionadas.
        - Busca local resiliente a campos ausentes.
        - Quota agora exibe loading/erro; limites seguem validados no servidor.
        - UI passou a indicar recorte de casos carregados e recebeu microcopy PT-BR no fluxo principal.
        - Geracao de link publico movida para modal proprio no dossie interno, mantendo validacao backend.
      Pendencias reais:
        - Reuso formal de ReportRenderer com pagina publica fica para a pagina 19 do checklist.
        - Paginacao/server-side completa nao foi implementada nesta rodada; UI informa recorte carregado.
      Observacoes de regressao:
        - Lint global ja falha em deletar-casos.js e functions/index.js.
        - Teste global ja falha em functions/audit/writeAuditEvent.test.js por divergencia de contrato da projecao tenantAuditLogs.

- [x] 02. Portal Cliente - Nova Solicitacao
      Rota: /client/nova-solicitacao
      Prioridade: P1/P2
      Foco: criacao de caso, CPF, quota, excedencia, redes sociais, validacao, UX mobile.
      Rodada: 2026-05-01
      Status: Corrigida
      Arquivos alterados:
        - src/portals/client/NovaSolicitacaoPage.jsx
        - src/portals/client/NovaSolicitacaoPage.css
        - src/portals/client/NovaSolicitacaoPage.test.jsx
        - src/portals/ops/CasoPage.jsx
      Testes executados:
        - npm run test -- src/portals/client/NovaSolicitacaoPage.test.jsx src/ui/components/QuotaBar/QuotaBar.test.jsx: passou
        - npm run test: falhou em teste preexistente functions/audit/writeAuditEvent.test.js
        - npm run lint: falhou em problemas preexistentes fora da pagina
        - npm run build: passou
      Resultado:
        - Quota agora exibe loading/erro e deixa claro que limites continuam validados no servidor.
        - Excedencia usa modal proprio com impacto comercial, tenant, candidato, CPF mascarado e aviso de auditoria/backend.
        - Formulario preenchido abre modal de descarte ao cancelar e intercepta navegacao interna por links.
        - Campos sociais receberam ajuda de formato e URLs extras sao validadas antes de entrar no payload.
        - URLs extras agora aparecem no workbench operacional via SocialLinks.
        - Microcopy principal revisada em PT-BR.
      Pendencias reais:
        - Bloqueio de navegacao programatica de qualquer componente sem link depende de integracao mais ampla do roteador.
      Observacoes de regressao:
        - Lint global ja falha em deletar-casos.js e functions/index.js.
        - Teste global ja falha em functions/audit/writeAuditEvent.test.js por divergencia de contrato da projecao tenantAuditLogs.

- [x] 03. Portal Cliente - Equipe
      Rota: /client/equipe
      Prioridade: P1/P2
      Foco: usuarios do tenant, perfis, ativar/desativar, senha provisoria, RBAC, modais criticos.
      Rodada: 2026-05-01
      Status: Corrigida
      Arquivos alterados:
        - src/portals/client/EquipePage.jsx
        - src/portals/client/EquipePage.css
        - src/portals/client/EquipePage.test.jsx
      Testes executados:
        - npm run test -- src/portals/client/EquipePage.test.jsx: passou
        - npm run test: falhou em teste preexistente functions/audit/writeAuditEvent.test.js
        - npm run lint: falhou em problemas preexistentes fora da pagina
        - npm run build: passou
      Resultado:
        - Confirmacao propria adicionada para alteracao de perfil e ativacao/desativacao.
        - Senha provisoria deixou de ser exposta em alertas/toasts e passou a ter copia controlada no modal.
        - Status de usuario agora usa enum explicito e estados de atencao nao contam como ativos.
        - Modal de criacao protege dados preenchidos contra fechamento acidental.
        - Matriz de permissoes e microcopy PT-BR adicionadas.
      Pendencias reais:
        - Nenhuma pendencia bloqueante da pagina.
      Observacoes de regressao:
        - Lint global ja falha em deletar-casos.js e functions/index.js.
        - Teste global ja falha em functions/audit/writeAuditEvent.test.js por divergencia de contrato da projecao tenantAuditLogs.

- [x] 04. Portal Cliente - Auditoria
      Rota: /client/auditoria
      Prioridade: P1/P2
      Foco: tenantAuditLogs, ator, alvo, detalhe client-safe, filtros e rastreabilidade.
      Rodada: 2026-05-01
      Status: Corrigida
      Arquivos alterados:
        - src/portals/client/AuditoriaClientePage.jsx
        - src/portals/client/AuditoriaClientePage.css
        - src/portals/client/AuditoriaClientePage.test.jsx
        - src/hooks/useTenantAuditLogs.js
        - functions/audit/writeAuditEvent.js
        - functions/audit/writeAuditEvent.test.js
      Testes executados:
        - npm run test -- src/portals/client/AuditoriaClientePage.test.jsx functions/audit/writeAuditEvent.test.js: passou
        - npx eslint src/portals/client/AuditoriaClientePage.jsx src/portals/client/AuditoriaClientePage.test.jsx src/hooks/useTenantAuditLogs.js functions/audit/writeAuditEvent.js functions/audit/writeAuditEvent.test.js: passou
        - npm run test: passou
        - npm run lint: falhou em problemas preexistentes fora da pagina
        - npm run build: passou
      Resultado:
        - Tela passou a exibir responsavel, alvo, detalhe client-safe e ID do evento.
        - Busca local passou a informar escopo de registros carregados e cobre ator, alvo e ID.
        - Modo demo padronizado com categorias reais em maiusculas e sem detalhes sensiveis.
        - Projecao tenantAuditLogs deixou de copiar detail bruto por padrao e aceita clientDetail explicito.
        - Mensagem de permissao revisada para PT-BR formal.
      Pendencias reais:
        - Paginacao/cursor server-side futura para historico anterior aos 200 eventos carregados.
      Observacoes de regressao:
        - Lint global ainda falha em deletar-casos.js e functions/index.js, fora do escopo desta pagina.

- [x] 05. Portal Cliente - Exportacoes
      Rota: /client/exportacoes
      Prioridade: P1/P2
      Foco: exportacao CSV/HTML/PDF, historico, auditoria, escopo carregado vs total real.
      Rodada: 2026-05-01
      Status: Corrigida
      Arquivos alterados:
        - src/portals/client/ExportacoesPage.jsx
        - src/portals/client/ExportacoesPage.css
        - src/portals/client/ExportacoesPage.test.jsx
        - functions/index.js
      Testes executados:
        - npm run test -- src/portals/client/ExportacoesPage.test.jsx: passou
        - npx eslint src/portals/client/ExportacoesPage.jsx src/portals/client/ExportacoesPage.test.jsx: passou
        - node --check functions/index.js: passou
        - npm run test: passou
        - npm run build: passou
        - npm run lint: falhou em problemas preexistentes fora da pagina
      Resultado:
        - Escopo renomeado para casos carregados e UI informa recorte client-side.
        - Loading/erro de casos e intervalo de datas invalido bloqueiam exportacao.
        - PDF foi renomeado para Imprimir / salvar PDF por gerar HTML imprimivel.
        - CSV passou a indicar cobertura analitica para casos sem resultado final.
        - Arquivo e preparado localmente, mas so e entregue apos registro/auditoria.
        - Backend valida enums de formato, escopo e modo de artefato, registra ator e storageStatus LOCAL_ONLY.
        - Historico mostra gerado por e informa que artefato local nao fica armazenado.
      Pendencias reais:
        - Exportacao server-side paginada e armazenamento seguro do artefato dependem de decisao futura de produto/infraestrutura.
      Observacoes de regressao:
        - Lint global ainda falha em deletar-casos.js e em trechos preexistentes de functions/index.js.

- [x] 06. Portal Cliente - Relatorios Publicos
      Rota: /client/relatorios
      Prioridade: P1/P2
      Foco: links publicos do tenant, copiar, abrir, revogar, permissoes, status, expiracao.
      Rodada: 2026-04-30
      Status: Corrigida
      Arquivos alterados:
        - src/portals/client/RelatoriosClientePage.jsx
        - src/portals/client/RelatoriosClientePage.css
        - src/portals/client/RelatoriosClientePage.test.jsx
        - src/core/rbac/permissions.js
        - src/App.jsx
        - src/core/firebase/firestoreService.js
      Testes executados:
        - npm run test -- src/portals/client/RelatoriosClientePage.test.jsx: passou
        - npx eslint src/portals/client/RelatoriosClientePage.jsx src/portals/client/RelatoriosClientePage.test.jsx src/core/rbac/permissions.js src/App.jsx src/core/firebase/firestoreService.js: passou
        - node --check functions/index.js: passou
        - npm run build: passou
      Resultado:
        - Permissao propria REPORT_PUBLIC_VIEW/MANAGE criada e aplicada na rota; client_viewer tem apenas view.
        - Backend listClientPublicReports ja valida tenant e suporta paginacao; frontend atualizado para cursor/hasMore.
        - Modal proprio de revogacao substitui window.confirm, exibindo candidato, caso, token parcial, impacto e aviso de auditoria.
        - Microcopy revisado para PT-BR formal (Relatorios Publicos, acentos, ellipses).
        - UI informa recorte de registros carregados e oferece "Carregar mais".
      Pendencias reais:
        - Auditoria de copiar/abrir link (PUBLIC_REPORT_LINK_COPIED/OPENED_FROM_PORTAL) depende de endpoint backend adicional.
        - Paginacao completa de 200+ itens funciona, mas nao ha filtro server-side por status.
      Observacoes de regressao:
        - Lint global ainda falha em deletar-casos.js e trechos preexistentes de functions/index.js.

- [x] 07. Perfil do Usuario
      Rota: /client/perfil e /ops/perfil
      Prioridade: P1/P2
      Foco: identidade, senha, provider externo, auditoria correta cliente/ops, acessibilidade.
      Rodada: 2026-04-30
      Status: Corrigida
      Arquivos alterados:
        - src/pages/PerfilPage.jsx
        - src/pages/PerfilPage.css
        - src/pages/PerfilPage.test.jsx
        - functions/index.js
        - src/core/rbac/permissions.test.js
        - src/core/firebase/firestoreService.test.js
      Testes executados:
        - npm run test -- src/pages/PerfilPage.test.jsx: passou
        - npx eslint src/pages/PerfilPage.jsx src/pages/PerfilPage.test.jsx: passou
        - node --check functions/index.js: passou
        - npm run test: passou (525 tests)
        - npm run build: passou
      Resultado:
        - Auditoria de updateOwnProfile agora detecta portal pelo role (ops vs client) e registra actor/source corretos.
        - Backend valida limite maximo de 80 caracteres para displayName.
        - Formulario de senha so aparece quando provider password existe; usuarios Google/SSO veem metodo de autenticacao.
        - Campos de senha receberam autoComplete current-password/new-password.
        - Formularios de nome e senha usam <form onSubmit> com labels htmlFor associadas.
        - Contador de caracteres no campo de nome e hint de maximo exibidos.
        - Badge de portal adicionado ao hero; "Ultimo acesso" renomeado para "Ultimo login".
        - Metodo de login exibido nas informacoes da conta.
      Pendencias reais:
        - Nenhuma pendencia bloqueante da pagina.
      Observacoes de regressao:
        - Lint global ainda falha em deletar-casos.js e trechos preexistentes de functions/index.js.

- [x] 08. Portal Cliente - Dashboard
      Rota: /client/dashboard
      Prioridade: P1/P2
      Foco: visao executiva, KPIs, quota, acoes necessarias, recorte dos dados.
      Rodada: 2026-04-30
      Status: Corrigida
      Arquivos alterados:
        - src/portals/client/DashboardClientePage.jsx
        - src/portals/client/DashboardClientePage.css
        - src/portals/client/DashboardClientePage.test.jsx
        - src/ui/components/KpiCard/KpiCard.jsx
        - src/core/clientPortal.js
        - src/App.jsx
      Testes executados:
        - npm run test -- src/portals/client/DashboardClientePage.test.jsx: passou (9 tests)
        - npx eslint src/portals/client/DashboardClientePage.jsx src/portals/client/DashboardClientePage.test.jsx src/ui/components/KpiCard/KpiCard.jsx src/core/clientPortal.js src/App.jsx: passou
        - npm run test: passou (534 tests)
        - npm run build: passou
      Resultado:
        - DASH-001: Redirect /client -> /client/dashboard (era /client/solicitacoes).
        - DASH-002: Aviso honesto de recorte: "Baseado nos N caso(s) carregado(s)." com aria-live="polite".
        - DASH-003: Badge renomeado de "Concluidos no periodo" para "Concluidos" (sem filtro de periodo real).
        - DASH-004: KpiCard renderiza <div> quando sem onClick e <button> apenas quando clicavel; hover limitado a botoes.
        - DASH-005: Secao "Acoes necessarias" com CTA para CORRECTION_NEEDED e WAITING_INFO, navegando com filtro.
        - DASH-006: Quota nao mais silenciada; exibe loading e erro proprios com cleanup de cancelamento.
        - DASH-007: Turnaround usa turnaroundHours persistido ou concludedAt apenas (sem fallback updatedAt); tooltip explica.
      Pendencias reais:
        - Paginacao server-side dos casos permanece como melhoria futura; UI informa recorte carregado.
      Observacoes de regressao:
        - Lint global ainda falha em deletar-casos.js e trechos preexistentes de functions/index.js.

## Portal Operacional

- [x] 09. Portal Operacional - Fila de Trabalho
      Rota: /ops/fila
      Prioridade: P0/P1
      Foco: assuncao de caso, bulk assign, estados assumiveis, tenant, prioridade, score.
      Rodada: 2026-04-30
      Status: Corrigida
      Arquivos alterados:
        - src/portals/ops/FilaPage.jsx
        - src/portals/ops/FilaPage.css
        - src/ui/components/ScoreBar/ScoreBar.jsx
        - functions/index.js
      Testes executados:
        - npm run test -- src/portals/ops/FilaPage.test.jsx: passou (3 tests)
        - npx eslint src/portals/ops/FilaPage.jsx src/ui/components/ScoreBar/ScoreBar.jsx: passou
        - node --check functions/index.js: passou
        - npm run test: passou (534 tests)
        - npm run build: passou
      Resultado:
        - FILA-001: Backend assignCaseToCurrentAnalyst agora valida status === 'PENDING' e assigneeId ausente antes de atualizar.
        - FILA-002: toggleAll so seleciona casos assumiveis (PENDING sem responsavel), evitando bulk assign de casos nao elegiveis.
        - FILA-003: Bulk assign mantem sequencial (limitacao Firebase), mas agora rastreia failedIds para diagnostico futuro.
        - FILA-004: Ja estava corrigido — getOpsUserProfile ja rejeita status === 'inactive'.
        - FILA-005: Ja protegido — priority usa fallback '(normal).toLowerCase()'.
        - FILA-006: ScoreBar agora renderiza '—' quando score e null/undefined, evitando interpretacao como risco zero.
        - FILA-007: Empty state diferencia fila vazia real de filtros sem resultado (mobile e desktop).
      Pendencias reais:
        - Bulk assign paralelo depende de infraestrutura backend (batch/cloud task); sequencial e aceitavel por ora.
      Observacoes de regressao:
        - Lint global ainda falha em deletar-casos.js e trechos preexistentes de functions/index.js.

- [x] 10. Portal Operacional - Caso / Analise
      Rota: /ops/caso/:caseId
      Prioridade: P0/P1
      Foco: workbench do analista, IA, provedores, rascunho, conclusao, relatorio publico, tenant isolation.
      Rodada: 2026-05-01
      Status: Corrigida
      Arquivos alterados:
        - src/portals/ops/CasoPage.jsx
        - src/portals/ops/CasoPage.css
        - src/portals/ops/CasoPage.test.jsx
        - functions/index.js
      Testes executados:
        - npm run test -- src/portals/ops/CasoPage.test.jsx
        - node --check functions/index.js
        - npm run lint
        - npm run test
        - npm run build
      Resultado:
        - RBAC/tenant isolation centralizado nas callables sensiveis do workbench operacional.
        - Casos DONE, CORRECTION_NEEDED e WAITING_INFO entram em modo leitura no frontend e no salvamento de rascunho.
        - Rascunho explicito, status de salvamento e modal proprio de saida com alteracoes pendentes implementados.
        - Aceite de IA registra decisao e aplica apenas veredito sugerido, sem sobrescrever score calculado.
        - Mandado ativo vindo de Judit ou BigDataCorp passa a bloquear conclusao quando o analista marcar flag negativa.
      Pendencias reais:
        - Refatoracao estrutural do componente monolitico fica como melhoria futura fora da rodada.
      Observacoes de regressao:
        - npm run lint permanece falhando somente por erros preexistentes em deletar-casos.js: require/process no-undef.

- [ ] 11. Portal Operacional - Todos os Casos / Arquivo de Casos
      Rota: /ops/casos
      Prioridade: P1/P2
      Foco: listagem historica, filtros, risco, permissoes, diferenca entre fila e arquivo.

- [x] 12. Portal Operacional - Gestao de Clientes
      Rota: /ops/clientes
      Prioridade: P0/P1
      Foco: tenants, usuarios cliente, gestor inicial, senha provisoria, RBAC backend, Firestore Rules.
      Rodada: 2026-04-30
      Status: Corrigida
      Arquivos alterados:
        - src/portals/ops/ClientesPage.jsx
        - src/portals/ops/ClientesPage.test.jsx
        - functions/index.js
      Testes executados:
        - npm run test -- src/portals/ops/ClientesPage.test.jsx: passou (3 tests)
        - npx eslint src/portals/ops/ClientesPage.jsx: passou
        - node --check functions/index.js: passou
        - npm run test: passou (535 tests)
        - npm run build: passou
      Resultado:
        - CLI-OPS-001: Backend createOpsClientUser agora rejeita roles abaixo de supervisor (apenas admin/owner/supervisor podem criar clientes).
        - CLI-OPS-002: Ja estava corrigido — Firestore Rules ja bloqueiam escrita direta em userProfiles (create/update/delete: if false).
        - CLI-OPS-003: Tela transformada em Console de Tenants — agrupa usuarios por tenant, mostra contagem de usuarios e gestores.
        - CLI-OPS-004: Senha provisoria nao mais exposta no toast de sucesso; modal tem toggle Mostrar/Ocultar + botao Copiar.
        - CLI-OPS-005: Backend verifica colisao de tenantId ao criar nova empresa (rejeita se tenantSettings ja existe).
        - CLI-OPS-006: Falha de tenantSettings agora mostra badge "Configuracao indisponivel" em vez de DEFAULT_ANALYSIS_CONFIG.
        - CLI-OPS-007: Modal preseleciona tenant quando ha um selecionado no contexto; titulo adapta para "Adicionar gestor ao tenant".
      Pendencias reais:
        - Transformacao completa em Console de Tenants com CRUD de tenant fica para rodada futura de produto.
      Observacoes de regressao:
        - Lint global ainda falha em deletar-casos.js e trechos preexistentes de functions/index.js.

- [ ] 13. Portal Operacional - Configuracoes do Tenant
      Rota: /ops/tenant-settings/:tenantId
      Prioridade: P0/P1
      Foco: fases, limites, excedencia, provedores, IA, schema, permissao admin/settings.

- [ ] 14. Portal Operacional - Auditoria
      Rota: /ops/auditoria
      Prioridade: P1/P2
      Foco: auditLogs, tenant, source, level, IP, periodo, drawer de detalhe, filtros.

- [ ] 15. Portal Operacional - Metricas de IA
      Rota: /ops/metricas-ia
      Prioridade: P1/P2
      Foco: IA, tokens, custos, provedores, decisoes do analista, metricas reais vs carregadas.

- [ ] 16. Portal Operacional - Relatorios Publicos
      Rota: /ops/relatorios
      Prioridade: P0/P1
      Foco: links publicos globais/por tenant, revogacao backend, auditoria, status, obsolescencia.

- [ ] 17. Portal Operacional - Saude das APIs / Provedores
      Rota: /ops/saude
      Prioridade: P1/P2
      Foco: systemHealth, circuit breaker, sem dados, stale, impacto operacional, lastError seguro.

## Pagina Publica e Decisao Arquitetural

- [ ] 18. Pagina Publica do Relatorio
      Rota: /r/:token
      Prioridade: P0/P1
      Foco: superficie publica, active=false, expiresAt, case.status, revogacao, snapshot, impressao/PDF.

- [ ] 19. Pagina Interna de Relatorio / Dossie
      Rota proposta: /client/relatorio/:caseId e /ops/relatorio/:caseId
      Prioridade: P1/P2
      Foco: decisao arquitetural final; drawer vira previa; pagina interna vira relatorio completo autenticado.
