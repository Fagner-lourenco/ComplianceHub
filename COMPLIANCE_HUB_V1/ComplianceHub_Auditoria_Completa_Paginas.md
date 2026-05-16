# ComplianceHub — Auditoria Completa Página a Página

**Documento consolidado:** análise UX/UI, fluxo, segurança, dados, auditoria, performance e recomendações técnicas.  
**Gerado em:** 30/04/2026 23:23  
**Escopo:** todas as páginas analisadas no ciclo de revisão, incluindo decisão final sobre página interna de relatório.

---

## 0. Premissas do documento

Este Markdown consolida a análise realizada página a página. O foco é **diagnóstico e plano de correção**, não implementação. As recomendações estão organizadas por severidade:

- **P0:** risco crítico de segurança/integridade/exposição externa. Corrigir antes de qualquer uso real.
- **P1:** problema importante para produção, segurança, consistência ou confiança.
- **P2:** melhoria operacional/UX relevante, mas não necessariamente bloqueante.
- **P3:** acabamento visual, acessibilidade, microcopy, design premium e manutenção.

A análise considera a skill `frontend-design`, mas aplicada ao contexto do ComplianceHub: um SaaS de due diligence/compliance com relatório técnico, rastreabilidade, tenant isolation, RBAC e exposição pública controlada.

---

## 1. Mapa geral das páginas analisadas

| # | Página | Rota | Papel principal | Severidade dominante |
|---:|---|---|---|---|
| 1 | Portal Cliente — Solicitações | `/client/solicitacoes` | Página principal do cliente para acompanhar solicitações/dossiês | P0/P1 |
| 2 | Portal Cliente — Nova Solicitação | `/client/nova-solicitacao` | Tela de criação de nova solicitação de due diligence pelo cliente | P1/P2 |
| 3 | Portal Cliente — Equipe | `/client/equipe` | Tela do gestor cliente para criar usuários, alterar perfil, ativar/desativar e g | P1/P2 |
| 4 | Portal Cliente — Auditoria | `/client/auditoria` | Histórico de atividades visível ao cliente gestor | P1/P2 |
| 5 | Portal Cliente — Exportações | `/client/exportacoes` | Página para gerar CSV/HTML/PDF imprimível e registrar exportações de casos do te | P1/P2 |
| 6 | Portal Cliente — Relatórios Públicos | `/client/relatorios` | Central do cliente para listar, copiar, abrir e revogar links públicos de relató | P1/P2 |
| 7 | Perfil do Usuário | `/client/perfil e /ops/perfil` | Página compartilhada entre portal cliente e operacional para visualizar conta, e | P1/P2 |
| 8 | Portal Cliente — Dashboard | `/client/dashboard` | Porta de entrada executiva do cliente para acompanhar volume, status, risco, quo | P1/P2 |
| 9 | Portal Operacional — Fila de Trabalho | `/ops/fila` | Tela principal do analista para priorizar casos pendentes, assumir análise e abr | P0/P1 |
| 10 | Portal Operacional — Caso / Análise | `/ops/caso/:caseId` | Workbench operacional onde o analista revisa fontes, IA, homonímia, flags, rascu | P0/P1 |
| 11 | Portal Operacional — Todos os Casos / Arquivo de Casos | `/ops/casos` | Listagem geral/histórica de casos operacionais, diferente da fila de trabalho | P1/P2 |
| 12 | Portal Operacional — Gestão de Clientes | `/ops/clientes` | Tela operacional para visualizar clientes/tenants, criar gestor inicial e acessa | P0/P1 |
| 13 | Portal Operacional — Configurações do Tenant | `/ops/tenant-settings/:tenantId` | Tela administrativa para configurar fases de análise, limites de consulta, exced | P0/P1 |
| 14 | Portal Operacional — Auditoria | `/ops/auditoria` | Tela operacional de audit logs completos para investigação e rastreabilidade | P1/P2 |
| 15 | Portal Operacional — Métricas de IA | `/ops/metricas-ia` | Dashboard de métricas de IA, provedores, custos, tokens, cache, decisões do anal | P1/P2 |
| 16 | Portal Operacional — Relatórios Públicos | `/ops/relatorios` | Painel operacional para listar, auditar, abrir/copiar e revogar relatórios públi | P0/P1 |
| 17 | Portal Operacional — Saúde das APIs / Provedores | `/ops/saude` | Tela de observabilidade do circuit breaker e saúde dos provedores externos do pi | P1/P2 |
| 18 | Página Pública do Relatório | `/r/:token` | Superfície pública externa do produto: link anônimo/externo para visualizar rela | P0/P1 |
| 19 | Decisão Arquitetural — Página Interna de Relatório/Dossiê | `/client/relatorio/:caseId e /ops/relatorio/:caseId (proposto)` | Decisão tomada ao final da análise: manter o drawer lateral como prévia rápida e | P1/P2 |

---

## 2. Achados sistêmicos recorrentes

### 2.1 RBAC no frontend está melhor que no backend

Em várias telas, a rota usa `RequirePermission`, mas a Cloud Function correspondente valida apenas perfil operacional genérico ou perfil cliente genérico. Isso aparece em:

- Gestão de Clientes: `createOpsClientUser`.
- Configurações do Tenant: `updateTenantSettingsByAnalyst`.
- Caso/Análise: rerun de IA, rerun de enriquecimento, decisão IA, relatório público do analista.
- Relatórios públicos: listagem/revogação/criação por permissões muito amplas.
- Métricas IA e Saúde APIs: uso de `AUDIT_VIEW` para dados operacionais sensíveis.

**Diretriz consolidada:** toda Cloud Function sensível deve ter helper de permissão backend, não apenas rota protegida no React.

### 2.2 Muitos indicadores são calculados sobre dados carregados, não totais reais

Várias telas usam listeners limitados e filtros locais:

- Dashboard Cliente.
- Solicitações.
- Exportações.
- Todos os Casos.
- Auditoria.
- Métricas IA.
- Relatórios.

**Diretriz consolidada:** quando não houver paginação/agregados server-side, a UI deve dizer “registros carregados”, não “total”.

### 2.3 Relatório público é o fluxo mais crítico

O relatório público precisa ter ciclo de vida rígido:

```txt
DONE → pode gerar relatório.
Saiu de DONE → revoga relatório.
active=false → nunca renderiza como ativo.
expiresAt vencido → nunca renderiza conteúdo.
case.status != DONE → nunca renderiza como final.
abertura pública → deve ser auditável.
```

### 2.4 O relatório precisa de renderer canônico

A decisão final é criar um `ReportRenderer` reutilizável por:

```txt
PublicReportPage       → /r/:token
ClientReportPage       → /client/relatorio/:caseId
OpsReportPage          → /ops/relatorio/:caseId
Drawer de Solicitações → preview reduzido
```

### 2.5 Microcopy e acentuação precisam de revisão global

Muitas telas ainda têm textos sem acento, siglas placeholder e emojis estruturais. Em um produto de compliance, isso reduz confiança. Deve haver revisão PT-BR formal em todo portal.

---

## 3. Plano consolidado de correção por fases

### Fase 1 — Segurança e integridade P0/P1

1. Fechar RBAC backend nas callables sensíveis.
2. Corrigir Firestore Rules permissivas em `userProfiles`.
3. Corrigir ciclo de vida do relatório público.
4. Bloquear `active=false`, `expiresAt` vencido e `case.status != DONE` na página pública.
5. Corrigir tenantId de relatórios públicos pelo case, não pelo perfil.
6. Validar schema de tenant settings.
7. Proteger assunção de caso no backend.
8. Corrigir exposição de senha provisória em toasts.

### Fase 2 — Observabilidade e rastreabilidade

1. Adicionar actor/alvo/tenant/source/level nos logs visíveis.
2. Drawer de detalhe em auditoria e relatórios.
3. Auditoria de abertura/cópia/revogação de relatório público.
4. Ledger/agregados para IA e provedores.
5. Saúde APIs com Sem Dados, Stale, Circuito Aberto e Impacto.

### Fase 3 — Produto e UX

1. Criar página interna de relatório.
2. Drawer vira prévia rápida.
3. Dashboard orientado à ação.
4. Gestão de Clientes vira Console de Tenants.
5. Configurações do Tenant vira Console de Governança.
6. Fila vira War Room operacional.

### Fase 4 — Design premium e acessibilidade

1. Ícones reais ou numeração técnica, sem siglas placeholder.
2. Labels com `id/htmlFor`.
3. Forms semânticos.
4. Mobile first nas páginas públicas e relatórios.
5. Print/PDF como primeira classe.
6. Revisão completa de microcopy PT-BR.

---

# 4. Análise página a página

---

## 1. Portal Cliente — Solicitações

**Rota:** `/client/solicitacoes`

### 4.1.1 Função da página

Página principal do cliente para acompanhar solicitações/dossiês. Hoje ela funciona como lista de casos do tenant, com filtros, KPIs, drawer lateral de prévia, geração/abertura de relatório público, correção de dados e integração com quota. É a tela de trabalho diário do cliente.

### 4.1.2 Arquivos principais

- `src/portals/client/SolicitacoesPage.jsx`
- `src/portals/client/SolicitacoesPage.css`
- `src/hooks/useCases.js`
- `src/core/clientPortal.js`
- `src/core/firebase/firestoreService.js`
- `src/ui/components/Drawer/Drawer.jsx`
- `src/ui/components/QuotaBar/QuotaBar.jsx`

### 4.1.3 O que a página faz bem

- Usa `useCases(clientTenantId)` para escopo do tenant do cliente.
- Carrega `publicResult/latest` apenas quando o caso selecionado está concluído.
- Possui filtros por status, veredito e busca.
- Usa drawer lateral para prévia rápida do candidato/caso.
- Tem integração com geração de relatório público via backend (`saveClientPublicReport`).
- Possui fluxo de reenvio de correção quando o caso retorna para o cliente.
- Mostra quota quando configurada.

### 4.1.4 Achados, riscos e recomendações

### SOL-001 — Drawer não deve ser a experiência principal do relatório completo

**Severidade:** `P0`

**Diagnóstico:**

O drawer atual é útil para leitura rápida, mas não comunica peso institucional de um dossiê completo. Ele concentra resumo, status, publicResult, correção e ação de relatório em uma superfície estreita. Depois da decisão tomada, o desenho correto é manter o drawer como prévia e criar uma página interna de relatório/dossiê dentro do sistema.

**Evidência / referência no código:**

`SolicitacoesPage.jsx` abre o caso selecionado em estado local (`selectedCase`) e usa o componente `Drawer`. A abertura de relatório público acontece por `handleOpenReport`, que chama `saveClientPublicReport(selectedCase.id)` e abre `/r/:token`.

**Impacto:**

O cliente pode ler um dossiê complexo em um espaço inadequado. A experiência fica menos premium, pior para mobile, pior para impressão/PDF e mais frágil para decisões de compliance.

**Recomendação:**

Criar rota interna `/client/relatorio/:caseId` ou `/client/dossie/:caseId`. O drawer deve ter CTA “Abrir relatório completo”. A página interna deve usar o mesmo componente base do relatório público, mas com ações autenticadas.

**Testes de validação recomendados:**

Clicar no candidato abre drawer; clicar em “Abrir relatório completo” navega para a página interna. A página interna mostra status atual, veredito, validade do link público e ações do cliente.


### SOL-002 — Busca pode quebrar com campos ausentes

**Severidade:** `P1`

**Diagnóstico:**

A busca usa diretamente `candidateName.toLowerCase()`, `cpfMasked.includes()` e `id.toLowerCase()`. Documentos antigos, mocks incompletos ou casos parcialmente migrados podem não ter esses campos.

**Evidência / referência no código:**

`src/portals/client/SolicitacoesPage.jsx`: filtro local em `filteredCases` usa `caseData.candidateName.toLowerCase()`, `caseData.cpfMasked.includes(term)` e `caseData.id.toLowerCase()`.

**Impacto:**

Um único documento incompleto pode quebrar a tela inteira de solicitações do cliente.

**Recomendação:**

Normalizar antes de filtrar: `String(caseData.candidateName || '')`, `String(caseData.cpfMasked || '')`, `String(caseData.id || '')`.

**Testes de validação recomendados:**

Mockar caso sem `candidateName` e `cpfMasked`, digitar busca e verificar que a página não quebra.


### SOL-003 — Quota falha silenciosamente

**Severidade:** `P1`

**Diagnóstico:**

A chamada de quota usa `.catch(() => {})`. Se o consumo não carregar, o cliente não sabe se está sem limite, se ainda está carregando ou se houve erro.

**Evidência / referência no código:**

`SolicitacoesPage.jsx`: `callGetClientQuotaStatus().then(setQuota).catch(() => {})`.

**Impacto:**

O cliente pode tentar operar sem clareza sobre limites diários/mensais. A UX também perde transparência quando quota é parte comercial do SaaS.

**Recomendação:**

Adicionar `quotaLoading`, `quotaError` e estado visual: “Consumo indisponível no momento; limites seguem validados no servidor”.

**Testes de validação recomendados:**

Simular rejeição de `callGetClientQuotaStatus`; a página deve exibir alerta de quota indisponível.


### SOL-004 — Relatório público é aberto diretamente a partir da lista, mas deveria passar por página interna

**Severidade:** `P1`

**Diagnóstico:**

A ação atual abre `/r/:token`, que é superfície pública. Para usuário autenticado, o ideal é uma página interna por `caseId`, com opção de gerar/copiar link externo.

**Evidência / referência no código:**

`handleOpenReport`: em ambiente real chama `saveClientPublicReport(selectedCase.id)` e `window.open('/r/${token}')`.

**Impacto:**

Mistura UX autenticada com UX pública. A página pública tem expiração, token e regras externas; o cliente interno precisa de contexto, histórico e ações autenticadas.

**Recomendação:**

Criar `ClientReportPage`. O drawer deve oferecer “Abrir dossiê completo” e, nessa página, “Gerar/Copiar link público”.

**Testes de validação recomendados:**

Verificar que `/client/relatorio/:caseId` abre por permissão/tenant, sem depender de token público.


### SOL-005 — Filtros e contadores são locais e podem sugerir totalidade

**Severidade:** `P2`

**Diagnóstico:**

A lista deriva de `useCases`, que no app usa query limitada. Os filtros/busca são locais sobre documentos carregados.

**Evidência / referência no código:**

`useCases` → `subscribeToClientCases` → helper com limite padrão. `SolicitacoesPage.jsx` aplica filtros em memória.

**Impacto:**

Para tenants com muitos casos, busca e KPI podem representar apenas os casos carregados, sem aviso.

**Recomendação:**

Exibir “casos carregados” ou migrar listagem para paginação/server-side com busca por CPF/caseId/nome.

**Testes de validação recomendados:**

Com mais de 500 casos, UI não deve afirmar total absoluto sem nota de recorte.


### SOL-006 — Microcopy sem acento e símbolos reduzem acabamento

**Severidade:** `P2`

**Diagnóstico:**

A tela contém textos como `Concluido`, `Correcao solicitada`, `Aguardando informacoes`, `Em analise`.

**Evidência / referência no código:**

`getMacroProgress` e trechos de UI em `SolicitacoesPage.jsx`.

**Impacto:**

Tela central do cliente aparenta protótipo quando o texto não está finalizado em PT-BR.

**Recomendação:**

Revisar microcopy: “Concluído”, “Correção solicitada”, “Aguardando informações”, “Em análise”.

**Testes de validação recomendados:**

Checklist visual de PT-BR em todas as telas do portal cliente.


### 4.1.5 Direção de design recomendada

A página deve parecer um painel de acompanhamento de dossiês, não apenas uma lista. Estrutura recomendada: cabeçalho com contexto do tenant, KPIs honestos sobre recorte, lista com status e próxima ação, drawer como prévia rápida, e página interna de relatório para leitura completa. O drawer deve ser rápido; o relatório completo deve ser uma rota própria.

### 4.1.6 Prioridades de correção

- P0/P1: criar página interna de relatório e não depender do drawer para leitura completa.
- P1: tornar busca resiliente a campos ausentes.
- P1: tratar erro/loading de quota.
- P2: avisar recorte dos casos carregados ou implementar paginação.
- P3: revisar microcopy e reforçar design de dossiê.

### 4.1.7 Veredito

Tela funcional, mas precisa evoluir de lista+drawer para fluxo de dossiê interno. A decisão arquitetural final deve ser: drawer = prévia; página interna = relatório completo; `/r/:token` = publicação externa.

---

## 2. Portal Cliente — Nova Solicitação

**Rota:** `/client/nova-solicitacao`

### 4.2.1 Função da página

Tela de criação de nova solicitação de due diligence pelo cliente. Coleta dados de identidade, CPF, cargo/departamento, contato e perfis sociais, valida quota e chama backend para criar o caso.

### 4.2.2 Arquivos principais

- `src/portals/client/NovaSolicitacaoPage.jsx`
- `src/portals/client/NovaSolicitacaoPage.css`
- `src/portals/client/NovaSolicitacaoPage.test.jsx`
- `src/core/validators.js`
- `src/core/firebase/firestoreService.js`
- `functions/index.js`
- `src/ui/components/QuotaBar/QuotaBar.jsx`

### 4.2.3 O que a página faz bem

- Valida CPF no frontend.
- Confirma tenant antes de permitir envio.
- Bloqueia submissão quando quota sem excedência está atingida.
- Permite redes sociais principais e URLs extras.
- Chama backend para criação, preservando tenant pelo perfil autenticado.
- Tem fluxo mobile por etapas.

### 4.2.4 Achados, riscos e recomendações

### NOVA-001 — Quota também falha silenciosamente

**Severidade:** `P1`

**Diagnóstico:**

A tela carrega quota com `.catch(() => {})`. Quando a quota falha, o usuário não sabe se há limite, se houve erro ou se a conta é ilimitada.

**Evidência / referência no código:**

`NovaSolicitacaoPage.jsx`: `callGetClientQuotaStatus().then(setQuota).catch(() => {})`.

**Impacto:**

Pode haver tentativa de envio sem clareza operacional, embora o backend continue validando limites. A experiência fica confusa.

**Recomendação:**

Adicionar estado de quota indisponível e avisar que limites continuam validados no servidor.

**Testes de validação recomendados:**

Mockar erro de quota e verificar banner “consumo indisponível”.


### NOVA-002 — Modal de excedência pode ser confundido com autorização definitiva

**Severidade:** `P1`

**Diagnóstico:**

Quando quota está excedida mas a configuração permite excedência, a tela mostra confirmação. É necessário que a mensagem deixe claro que haverá excedente faturável/registrado e que o backend ainda pode bloquear.

**Evidência / referência no código:**

`handleSubmit` verifica `willExceedDaily` e `willExceedMonthly` e abre `showExceedModal`.

**Impacto:**

Se a microcopy for fraca, o usuário pode confirmar sem entender custo/limite.

**Recomendação:**

Modal deve explicar limite atingido, política de excedência, impacto comercial e que a ação será auditada.

**Testes de validação recomendados:**

Simular quota excedida com excedência permitida: submit abre modal, cancelar não chama backend, confirmar chama backend.


### NOVA-003 — Dados extras de redes sociais podem não aparecer na análise operacional

**Severidade:** `P1`

**Diagnóstico:**

A solicitação envia `otherSocialUrls`, mas na tela operacional de caso foi observado que a etapa de identificação renderiza apenas `socialProfiles` principais. Isso quebra fidelidade entre o que o cliente informou e o que o analista vê.

**Evidência / referência no código:**

`NovaSolicitacaoPage.jsx` envia `otherSocialUrls` no payload. `CasoPage.jsx` renderiza `SocialLinks profiles={caseData.socialProfiles || {}}`.

**Impacto:**

Fontes relevantes informadas pelo cliente podem ser ignoradas na análise OSINT/social.

**Recomendação:**

Padronizar exibição de `socialProfiles + otherSocialUrls` em CasoPage e no relatório.

**Testes de validação recomendados:**

Criar solicitação com URL extra GitHub/JusBrasil; abrir CasoPage e relatório; verificar que a URL aparece.


### NOVA-004 — Validação de URLs/handles precisa deixar claro o formato aceito

**Severidade:** `P2`

**Diagnóstico:**

A tela aceita URL ou @handle para redes, mas a microcopy precisa explicar isso por campo e validar de modo previsível.

**Evidência / referência no código:**

`validateUrl` é aplicado em instagram/facebook/linkedin/tiktok/twitter/youtube quando preenchidos.

**Impacto:**

Usuário pode não entender por que um handle é aceito em uma rede e rejeitado em outra.

**Recomendação:**

Adicionar placeholder e ajuda por campo: URL completa ou @usuario. Para LinkedIn, preferir URL completa.

**Testes de validação recomendados:**

Preencher URL inválida e handle válido; verificar mensagens por campo.


### NOVA-005 — Ausência de proteção contra saída com formulário preenchido

**Severidade:** `P2`

**Diagnóstico:**

Formulário de múltiplas etapas pode perder dados se o usuário navegar para fora antes de enviar.

**Evidência / referência no código:**

`NovaSolicitacaoPage.jsx` mantém estado em memória; há timer de redirecionamento após sucesso, mas não há `dirty state` para navegação antes do envio.

**Impacto:**

Perda de tempo e frustração, especialmente em mobile.

**Recomendação:**

Adicionar confirmação ao sair se houver campos preenchidos e submissão não concluída.

**Testes de validação recomendados:**

Preencher nome/CPF, clicar em outra rota; deve abrir confirmação de descarte.


### NOVA-006 — Microcopy sem acento e estado de sucesso pouco institucional

**Severidade:** `P3`

**Diagnóstico:**

Exemplos: `Solicitacao enviada`, `esta aguardando analise`, `Franquia em sincronizacao`.

**Evidência / referência no código:**

Textos em `NovaSolicitacaoPage.jsx`.

**Impacto:**

Tela de entrada de dossiê parece menos finalizada.

**Recomendação:**

Revisar PT-BR formal: “Solicitação enviada”, “está aguardando análise”, “Franquia em sincronização”.

**Testes de validação recomendados:**

Checklist visual de microcopy.


### 4.2.5 Direção de design recomendada

Deve ter estética de formulário sério de abertura de dossiê, com etapas claras: Identidade, Contexto, Contato, Fontes digitais, Revisão. A etapa final deve mostrar resumo do que será enviado e deixar claro tenant, quota e privacidade.

### 4.2.6 Prioridades de correção

- P1: tratar quota e excedência com estados claros.
- P1: garantir que `otherSocialUrls` apareça na análise e relatório.
- P2: proteger formulário preenchido contra saída.
- P2: melhorar microcopy de campos sociais.
- P3: polimento visual e PT-BR.

### 4.2.7 Veredito

Tela cumpre criação de caso, mas deve ficar mais clara sobre quota, excedência, redes extras e proteção de formulário. É uma tela de entrada de dado crítico; qualquer dado perdido ou ocultado afeta todo o dossiê.

---

## 3. Portal Cliente — Equipe

**Rota:** `/client/equipe`

### 4.3.1 Função da página

Tela do gestor cliente para criar usuários, alterar perfil, ativar/desativar e gerenciar a equipe do tenant.

### 4.3.2 Arquivos principais

- `src/portals/client/EquipePage.jsx`
- `src/portals/client/EquipePage.css`
- `src/core/rbac/permissions.js`
- `src/core/firebase/firestoreService.js`
- `functions/index.js`

### 4.3.3 O que a página faz bem

- Rota protegida por `USERS_MANAGE`.
- Backend valida `client_manager` nas funções principais.
- Backend confere tenant do usuário alvo antes de atualizar.
- Desativar usuário também desabilita Firebase Auth.
- Atualizar role atualiza custom claims.
- Eventos são auditados.

### 4.3.4 Achados, riscos e recomendações

### EQ-001 — Alteração de perfil acontece imediatamente sem confirmação

**Severidade:** `P1`

**Diagnóstico:**

Trocar `select` de perfil dispara atualização diretamente. Alterar `client_viewer` para `client_manager` é ação de permissão sensível.

**Evidência / referência no código:**

`EquipePage.jsx`: `onChange={(e) => handleRoleChange(u.uid, e.target.value)}`; backend atualiza `role` e custom claims.

**Impacto:**

Clique acidental pode conceder permissões de gestão, configuração, auditoria e equipe.

**Recomendação:**

Adicionar modal de confirmação com De/Para e impacto do perfil.

**Testes de validação recomendados:**

Alterar select não chama backend até confirmar; cancelar restaura valor visual.


### EQ-002 — Ativar/desativar usuário sem confirmação

**Severidade:** `P1`

**Diagnóstico:**

Botão desativar chama backend diretamente e backend faz `updateUser(... disabled: true)`.

**Evidência / referência no código:**

`EquipePage.jsx` chama `handleToggleStatus`; `functions/index.js` atualiza Firebase Auth disabled.

**Impacto:**

Bloqueio acidental de acesso do usuário.

**Recomendação:**

Modal de confirmação com nome, e-mail, tenant e motivo opcional.

**Testes de validação recomendados:**

Cancelar não chama callable; confirmar desativa e registra motivo em auditoria.


### EQ-003 — Senha provisória exposta em texto claro

**Severidade:** `P1`

**Diagnóstico:**

Senha é gerada no frontend, exibida no modal e no alerta de sucesso.

**Evidência / referência no código:**

`generatePassword()` em `EquipePage.jsx`; `setSuccessMsg` inclui senha.

**Impacto:**

Exposição visual de credencial, prints, shoulder surfing e compartilhamento inseguro.

**Recomendação:**

Preferir convite/reset por e-mail. Se mantiver MVP, ocultar por padrão, botão copiar, não mostrar no toast, orientar canal seguro.

**Testes de validação recomendados:**

Após criar usuário, toast não contém senha; senha some ao fechar modal.


### EQ-004 — Modal fecha ao clicar fora e perde dados

**Severidade:** `P2`

**Diagnóstico:**

Overlay fecha modal sem verificar se formulário foi preenchido.

**Evidência / referência no código:**

`equipe-modal-overlay` chama `setModalOpen(false)` no click fora.

**Impacto:**

Perda de dados digitados em criação de usuário.

**Recomendação:**

Criar `requestCloseModal` com confirmação se formulário estiver sujo.

**Testes de validação recomendados:**

Digitar nome, clicar fora, modal pede confirmação.


### EQ-005 — Perfis não são explicados

**Severidade:** `P2`

**Diagnóstico:**

A tela mostra Visualizador/Operador/Gestor sem listar permissões.

**Evidência / referência no código:**

`ROLE_LABELS` define apenas labels.

**Impacto:**

Gestor pode atribuir papel errado sem entender impacto.

**Recomendação:**

Adicionar matriz curta de permissões no modal e tooltip na tabela.

**Testes de validação recomendados:**

Abrir modal e verificar descrição de cada perfil.


### EQ-006 — Status desconhecido vira ativo

**Severidade:** `P2`

**Diagnóstico:**

A regra `status !== 'inactive'` trata qualquer status futuro como ativo.

**Evidência / referência no código:**

`activeCount = users.filter((u) => u.status !== 'inactive')`.

**Impacto:**

Estados como pending/suspended poderiam ser mostrados erroneamente como ativos.

**Recomendação:**

Criar enum visual explícito: active, inactive, pending, suspended, unknown.

**Testes de validação recomendados:**

Usuário com `pending` não conta como ativo.


### EQ-007 — Falta teste específico da página Equipe

**Severidade:** `P3`

**Diagnóstico:**

Fluxo sensível de usuários não tem teste dedicado.

**Evidência / referência no código:**

Não foi identificado `EquipePage.test.jsx`.

**Impacto:**

Regressões em criação/role/status podem passar despercebidas.

**Recomendação:**

Criar testes para listar, criar, role, status, self-user, erros e confirmações.

**Testes de validação recomendados:**

Suite cobre os cenários P1 acima.


### 4.3.5 Direção de design recomendada

A tela deveria parecer um painel de Identidade e Acesso, com responsabilidade e auditabilidade. Ações críticas devem ter confirmação rica. Visual sugerido: tabela com usuário, perfil, permissões resumidas, status, última atualização e ações; modal com explicação dos perfis.

### 4.3.6 Prioridades de correção

- P1: confirmação para alterar role e ativar/desativar.
- P1: substituir senha exposta por convite/reset.
- P2: proteger modal sujo e explicar perfis.
- P2: tratar status explicitamente.
- P3: criar testes e revisar microcopy.

### 4.3.7 Veredito

A página é funcional e tem boa base de tenant isolation, mas trata ações críticas como edições simples de tabela. Precisa de UX de controle de acesso auditável.

---

## 4. Portal Cliente — Auditoria

**Rota:** `/client/auditoria`

### 4.4.1 Função da página

Histórico de atividades visível ao cliente gestor. Usa a projeção `tenantAuditLogs` para mostrar eventos client-safe do próprio tenant.

### 4.4.2 Arquivos principais

- `src/portals/client/AuditoriaClientePage.jsx`
- `src/hooks/useTenantAuditLogs.js`
- `src/core/firebase/firestoreService.js`
- `functions/audit/writeAuditEvent.js`
- `firestore.rules`

### 4.4.3 O que a página faz bem

- Usa coleção separada `tenantAuditLogs`, não a auditoria bruta completa.
- Filtra por `tenantId` e Rules validam tenant.
- Escrita direta é bloqueada para cliente.
- Tem filtro por categoria e busca local.
- Usa catálogo de ações para labels amigáveis.

### 4.4.4 Achados, riscos e recomendações

### AUD-CLI-001 — Não mostra quem realizou a ação

**Severidade:** `P1`

**Diagnóstico:**

A projeção contém `actor`, mas a tabela exibe data, ação, categoria e descrição.

**Evidência / referência no código:**

`writeAuditEvent` projeta `actor.displayName/email`; `AuditoriaClientePage.jsx` não renderiza coluna Responsável.

**Impacto:**

Auditoria sem ator não responde “quem fez?”.

**Recomendação:**

Adicionar coluna Responsável e bloco equivalente no mobile.

**Testes de validação recomendados:**

Log com `actor.displayName` aparece na tabela.


### AUD-CLI-002 — Não mostra alvo/entidade do evento

**Severidade:** `P1`

**Diagnóstico:**

A projeção possui `entity`, mas a tela não mostra `entity.label/id`.

**Evidência / referência no código:**

`writeAuditEvent` salva `entity`; `AuditoriaClientePage.jsx` renderiza apenas `clientSummary || detail`.

**Impacto:**

O cliente vê ação genérica sem saber sobre qual caso/usuário/relatório.

**Recomendação:**

Adicionar coluna Alvo com entity label/id e tipo.

**Testes de validação recomendados:**

Log com `entity.label` renderiza o alvo.


### AUD-CLI-003 — Projeção client-safe ainda copia `detail` bruto

**Severidade:** `P1`

**Diagnóstico:**

Mesmo com `clientSummary`, o writer copia `detail` para `tenantAuditLogs`.

**Evidência / referência no código:**

`writeAuditEvent`: campos `summary`, `detail`, `metadata` na projeção de cliente.

**Impacto:**

Detalhe interno pode vazar para cliente se uma função registrar informação sensível.

**Recomendação:**

Separar `internalDetail` e `clientDetail`; não copiar `detail` bruto por padrão.

**Testes de validação recomendados:**

Evento clientVisible com detail interno não persiste detail bruto em `tenantAuditLogs`.


### AUD-CLI-004 — Busca só cobre registros carregados

**Severidade:** `P2`

**Diagnóstico:**

A query limita logs e a busca é local.

**Evidência / referência no código:**

`subscribeToTenantAuditLogs` usa `limit`; `AuditoriaClientePage` filtra em memória.

**Impacto:**

Cliente pode buscar evento antigo e receber “não encontrado”.

**Recomendação:**

Adicionar aviso de recorte ou paginação/cursor e filtro por período.

**Testes de validação recomendados:**

Com 200+ logs, UI mostra “busca nos registros carregados” ou carrega mais.


### AUD-CLI-005 — Mocks usam categorias minúsculas e filtro real usa maiúsculas

**Severidade:** `P2`

**Diagnóstico:**

No modo demo, categorias `case/export/user` não batem com catálogo `CASE/EXPORT/TENANT_ADMIN`.

**Evidência / referência no código:**

`useTenantAuditLogs.js` mocks; `auditCatalog.js` categorias.

**Impacto:**

Filtro demo parece quebrado.

**Recomendação:**

Padronizar mocks ao contrato real.

**Testes de validação recomendados:**

Modo demo + filtro CASE retorna logs.


### AUD-CLI-006 — Mensagem de erro e microcopy precisam PT-BR formal

**Severidade:** `P3`

**Diagnóstico:**

Erros como “Missing permissions” podem aparecer brutos; textos sem acento existem.

**Evidência / referência no código:**

`extractErrorMessage`; textos de `AuditoriaClientePage.jsx`.

**Impacto:**

Menor confiança em tela de auditoria.

**Recomendação:**

Mapear erros de permissão e revisar PT-BR.

**Testes de validação recomendados:**

Erro Firestore de permissão vira mensagem clara em PT-BR.


### 4.4.5 Direção de design recomendada

A tela deve parecer uma trilha auditável/ledger do cliente. Recomenda-se layout de timeline ou tabela com Data, Responsável, Ação, Alvo, Detalhe, ID do evento, e filtros por período/categoria/ação.

### 4.4.6 Prioridades de correção

- P1: mostrar ator e alvo.
- P1: não projetar detalhe interno bruto.
- P2: paginação/período/recorte.
- P3: PT-BR e visual de ledger.

### 4.4.7 Veredito

Boa arquitetura por usar `tenantAuditLogs`, mas a experiência ainda é incompleta: auditoria precisa responder quem, o quê, sobre qual alvo e quando.

---

## 5. Portal Cliente — Exportações

**Rota:** `/client/exportacoes`

### 4.5.1 Função da página

Página para gerar CSV/HTML/PDF imprimível e registrar exportações de casos do tenant.

### 4.5.2 Arquivos principais

- `src/portals/client/ExportacoesPage.jsx`
- `src/portals/client/ExportacoesPage.css`
- `src/portals/client/ExportacoesPage.test.jsx`
- `src/hooks/useCases.js`
- `src/core/reportBuilder.js`
- `functions/index.js`
- `firestore.rules`

### 4.5.3 O que a página faz bem

- Gera CSV com proteção contra CSV Injection.
- Registra exportação via Cloud Function.
- Escrita direta em `exports` é bloqueada nas Rules.
- Cria auditoria `EXPORT_CREATED`.
- Tem teste garantindo que histórico real não usa mock.

### 4.5.4 Achados, riscos e recomendações

### EXP-001 — “Todos os casos” exporta apenas casos carregados

**Severidade:** `P1`

**Diagnóstico:**

A página usa `useCases()` e filtra em memória. A query de casos é limitada.

**Evidência / referência no código:**

`ExportacoesPage.jsx` usa `const { cases } = useCases()`; filtros operam sobre `filteredCases`.

**Impacto:**

Cliente acredita estar exportando todos os casos, mas pode receber só os mais recentes carregados.

**Recomendação:**

MVP: renomear para “casos carregados”. Produto: exportação server-side paginada por tenant/filtros.

**Testes de validação recomendados:**

Tenant com 501 casos não pode gerar exportação “todos” silenciosamente com 500.


### EXP-002 — Ignora loading/erro dos casos

**Severidade:** `P1`

**Diagnóstico:**

A página usa `cases`, mas não renderiza `loading`/`error` de `useCases`.

**Evidência / referência no código:**

`ExportacoesPage.jsx`: `const { cases } = useCases();`.

**Impacto:**

Usuário não sabe se não há registros ou se a leitura falhou.

**Recomendação:**

Desestruturar `loading` e `error` e mostrar estados claros.

**Testes de validação recomendados:**

Mockar erro de `useCases`; tela mostra mensagem e bloqueia exportação.


### EXP-003 — PDF não é PDF real

**Severidade:** `P1`

**Diagnóstico:**

Tipo `PDF` gera HTML com botão de imprimir/salvar, não arquivo `.pdf` real.

**Evidência / referência no código:**

`buildPdfHtml` + `openHtmlBlob`; botão `window.print()` no HTML.

**Impacto:**

Rótulo “PDF” induz expectativa errada.

**Recomendação:**

Renomear para “Imprimir / salvar PDF” ou gerar PDF real no backend.

**Testes de validação recomendados:**

Se formato exibido for PDF, arquivo real `.pdf` é gerado; caso contrário, UI informa prévia imprimível.


### EXP-004 — Backend confia em metadados enviados pelo frontend

**Severidade:** `P1`

**Diagnóstico:**

`registerClientExport` aceita `type`, `scope`, `records`, `artifactMode` sem validar enum nem calcular registros.

**Evidência / referência no código:**

`functions/index.js` cria doc `exports` com `String(type)`, `String(scope)`, `Number(records)`.

**Impacto:**

Histórico não é prova forte do que foi exportado.

**Recomendação:**

Frontend deve enviar filtros; backend calcula escopo, registros, arquivo/hash e valida enums.

**Testes de validação recomendados:**

Chamada com `type=QUALQUER` deve ser rejeitada.


### EXP-005 — Arquivo é gerado antes do registro/auditoria

**Severidade:** `P1`

**Diagnóstico:**

CSV/HTML é entregue ao usuário e só depois `registerClientExport` é chamado.

**Evidência / referência no código:**

Ordem de execução em `ExportacoesPage.jsx`: gera blob/window.open; depois chama callable.

**Impacto:**

Se registro falhar, arquivo saiu sem histórico/auditoria.

**Recomendação:**

Gerar no backend ou registrar REQUESTED antes e READY depois; no MVP, mensagem específica se histórico falhar após arquivo.

**Testes de validação recomendados:**

Mockar falha da callable e verificar aviso “arquivo gerado, histórico não registrado”.


### EXP-006 — Histórico não permite reabrir artefato real

**Severidade:** `P2`

**Diagnóstico:**

Histórico mostra “Baixado/Aberto”, mas não armazena arquivo para re-download.

**Evidência / referência no código:**

`ExportacoesPage.jsx` só mostra texto para histórico real; botão Abrir é demo.

**Impacto:**

Usuário pode esperar recuperar o arquivo pelo histórico.

**Recomendação:**

Indicar “gerado localmente — não armazenado” ou armazenar artefato seguro.

**Testes de validação recomendados:**

Histórico real deve mostrar “não armazenado” quando não há artefato.


### EXP-007 — Filtro de data não valida intervalo inválido

**Severidade:** `P2`

**Diagnóstico:**

`dateFrom > dateTo` gera lista vazia, não erro.

**Evidência / referência no código:**

Filtros por data em `ExportacoesPage.jsx`.

**Impacto:**

Usuário interpreta como ausência de registros.

**Recomendação:**

Bloquear e mostrar “data inicial não pode ser posterior à final”.

**Testes de validação recomendados:**

Intervalo inválido não chama backend/exportação.


### EXP-008 — Casos pendentes podem gerar CSV com campos vazios ambíguos

**Severidade:** `P2`

**Diagnóstico:**

Exportar `ALL` ou `PENDING` inclui campos analíticos vazios, que podem ser interpretados como negativo/sem ocorrência.

**Evidência / referência no código:**

Headers incluem flags e veredito mesmo para casos pendentes.

**Impacto:**

Risco de interpretação errada de campos não processados.

**Recomendação:**

Adicionar coluna “cobertura/resultado disponível” e aviso de casos pendentes.

**Testes de validação recomendados:**

Exportar com caso PENDING mostra aviso e coluna de cobertura.


### EXP-009 — Histórico não mostra quem gerou

**Severidade:** `P2`

**Diagnóstico:**

`exports` registra tenant, type, scope, records, artifactMode, status e createdAt, mas não `createdBy`.

**Evidência / referência no código:**

`registerClientExport` grava doc sem ator; ator vai apenas para audit log.

**Impacto:**

A própria tela de exportações não responde quem exportou.

**Recomendação:**

Adicionar `createdByUid/email/name` no documento ou cruzar auditoria.

**Testes de validação recomendados:**

Após exportar, histórico mostra “Gerado por”.


### 4.5.5 Direção de design recomendada

A página deve parecer um “pacote controlado de evidências”, com resumo do que será incluído, dados sensíveis, status de armazenamento, escopo real e histórico auditável.

### 4.5.6 Prioridades de correção

- P1: corrigir escopo carregado vs total real.
- P1: validar/gerar exportação no backend.
- P1: corrigir rótulo PDF.
- P2: histórico com ator, artefato e cobertura.
- P3: acessibilidade e microcopy.

### 4.5.7 Veredito

Boa base para MVP, mas integridade auditável ainda fraca porque o arquivo é client-side e o backend registra metadados declarados pelo próprio frontend.

---

## 6. Portal Cliente — Relatórios Públicos

**Rota:** `/client/relatorios`

### 4.6.1 Função da página

Central do cliente para listar, copiar, abrir e revogar links públicos de relatórios do próprio tenant.

### 4.6.2 Arquivos principais

- `src/portals/client/RelatoriosClientePage.jsx`
- `src/pages/PublicReportPage.jsx`
- `src/core/firebase/firestoreService.js`
- `functions/index.js`
- `firestore.rules`

### 4.6.3 O que a página faz bem

- Listagem via Cloud Function filtrada por tenant.
- Revogação valida tenant no backend.
- Tabela mostra token parcial, candidato, caso, criação, expiração e status.
- Página pública valida expiração e usa sandbox/sanitização.

### 4.6.4 Achados, riscos e recomendações

### REL-CLI-001 — Permissão usa `CASE_EXPORT`, mas link público é mais sensível

**Severidade:** `P1`

**Diagnóstico:**

A rota usa permissão de exportação. Gerenciar link externo deve ter permissão própria.

**Evidência / referência no código:**

`/client/relatorios` protegido por `CASE_EXPORT`; `client_viewer` também tem `CASE_EXPORT`.

**Impacto:**

Visualizador pode acessar gestão de links públicos se a regra não for refinada.

**Recomendação:**

Criar `REPORT_PUBLIC_MANAGE`/`REPORT_PUBLIC_VIEW` e validar backend.

**Testes de validação recomendados:**

client_viewer não acessa ou vê apenas leitura, conforme regra definida.


### REL-CLI-002 — Backend lista/cria relatórios sem permissão específica

**Severidade:** `P1`

**Diagnóstico:**

`listClientPublicReports` e `createClientPublicReport` validam autenticação/tenant, mas não role específica além de ser cliente.

**Evidência / referência no código:**

Cloud Functions usam `getClientUserProfile(uid)` e tenant do caso.

**Impacto:**

Qualquer usuário cliente do tenant pode potencialmente listar/criar links públicos via chamada direta.

**Recomendação:**

Criar helper `assertClientCanManagePublicReports` e aplicar em list/create/revoke.

**Testes de validação recomendados:**

client_viewer chama callable e recebe `permission-denied` se não autorizado.


### REL-CLI-003 — Lista limitada a 200 sem paginação

**Severidade:** `P1`

**Diagnóstico:**

Backend usa `.limit(200)` e busca local no frontend.

**Evidência / referência no código:**

`listClientPublicReports` consulta `publicReports` por tenant, orderBy createdAt, limit 200.

**Impacto:**

Relatórios antigos podem não ser encontrados.

**Recomendação:**

Adicionar paginação/cursor e aviso “200 mais recentes”.

**Testes de validação recomendados:**

Com 201 relatórios, botão carregar mais aparece.


### REL-CLI-004 — Copiar/abrir link público não é auditado

**Severidade:** `P1`

**Diagnóstico:**

Copiar e abrir são ações frontend sem backend.

**Evidência / referência no código:**

`handleCopy` usa `navigator.clipboard`; `handleOpen` usa `window.open`.

**Impacto:**

Ações de risco não ficam rastreadas.

**Recomendação:**

Criar eventos `PUBLIC_REPORT_LINK_COPIED` e `OPENED_FROM_PORTAL` com validação tenant.

**Testes de validação recomendados:**

Copiar link registra audit log.


### REL-CLI-005 — Confirmação de revogação usa `window.confirm` simples

**Severidade:** `P2`

**Diagnóstico:**

Revogar link público é ação crítica, mas confirmação não mostra candidato/caso/token/impacto.

**Evidência / referência no código:**

`window.confirm('Desativar este relatorio...')`.

**Impacto:**

Pode haver revogação equivocada.

**Recomendação:**

Usar modal rico com candidato, caso, token parcial e aviso de auditoria.

**Testes de validação recomendados:**

Cancelar não chama backend; confirmar chama revoke.


### REL-CLI-006 — Frontend não recalcula expiração se status vier incompleto

**Severidade:** `P2`

**Diagnóstico:**

`getReportStatus` confia em `status`/`active` e não recalcula sempre por `expiresAt`.

**Evidência / referência no código:**

Função local em `RelatoriosClientePage.jsx`.

**Impacto:**

Dados antigos/cache podem aparecer como ativos.

**Recomendação:**

Regra local: active=false → revogado; expiresAt vencido → expirado; senão ativo.

**Testes de validação recomendados:**

Relatório com expiresAt ontem e status vazio aparece expirado.


### REL-CLI-007 — TTL longo/variável precisa ser claro

**Severidade:** `P2`

**Diagnóstico:**

Houve divergência de políticas de TTL ao longo do projeto. UI deve mostrar validade e risco de link público.

**Evidência / referência no código:**

Criação de public report define expiresAt no backend.

**Impacto:**

Usuário pode compartilhar link achando que expira em prazo diferente.

**Recomendação:**

Centralizar `PUBLIC_REPORT_TTL_DAYS` e exibir validade no fluxo.

**Testes de validação recomendados:**

Criação cliente/ops usa mesma TTL e UI mostra data.


### 4.6.5 Direção de design recomendada

Tela deve ser “Central de compartilhamento controlado”, com aviso de que links ativos são públicos para quem possui URL, cards de ativos/expiram/revogados e tabela com relatório, tenant, criado por, status e ações.

### 4.6.6 Prioridades de correção

- P1: permissão própria e validação backend.
- P1: paginação/recorte.
- P2: auditoria de copiar/abrir.
- P2: modal rico de revogação.
- P3: microcopy e rebaixar token como detalhe.

### 4.6.7 Veredito

Tecnicamente no caminho certo, mas link público é compartilhamento externo sensível. Precisa de RBAC próprio, auditoria e UX de risco.

---

## 7. Perfil do Usuário

**Rota:** `/client/perfil e /ops/perfil`

### 4.7.1 Função da página

Página compartilhada entre portal cliente e operacional para visualizar conta, editar nome e redefinir senha.

### 4.7.2 Arquivos principais

- `src/pages/PerfilPage.jsx`
- `src/pages/PerfilPage.css`
- `src/core/auth/AuthContext.jsx`
- `functions/index.js`

### 4.7.3 O que a página faz bem

- Permite editar apenas displayName.
- Atualização passa por Cloud Function.
- Backend atualiza userProfiles e Firebase Auth.
- Senha usa reautenticação antes de updatePassword.

### 4.7.4 Achados, riscos e recomendações

### PERF-001 — Auditoria registra sempre como portal cliente

**Severidade:** `P1`

**Diagnóstico:**

Mesmo componente é usado no ops, mas `updateOwnProfile` grava `ACTOR_TYPE.CLIENT_USER` e `SOURCE.PORTAL_CLIENT`.

**Evidência / referência no código:**

Cloud Function `updateOwnProfile` em `functions/index.js`.

**Impacto:**

Analista operacional alterando perfil gera trilha incorreta.

**Recomendação:**

Determinar actor/source pelo role: client_* → PORTAL_CLIENT; ops → PORTAL_OPS.

**Testes de validação recomendados:**

Analyst atualiza nome e audit log registra OPS_USER/PORTAL_OPS.


### PERF-002 — Redefinir senha aparece para conta sem provider password

**Severidade:** `P1`

**Diagnóstico:**

O formulário sempre usa `EmailAuthProvider`, mas usuários Google/SSO podem não ter senha local.

**Evidência / referência no código:**

`PerfilPage.jsx` usa `EmailAuthProvider.credential(user.email, currentPw)`.

**Impacto:**

Fluxo falha e confunde usuários de login externo.

**Recomendação:**

Verificar `user.providerData`; mostrar formulário apenas se provider `password` existir.

**Testes de validação recomendados:**

Usuário google.com vê mensagem de login externo, não campos de senha.


### PERF-003 — Campos de senha sem `autoComplete`

**Severidade:** `P1`

**Diagnóstico:**

Gerenciadores de senha perdem contexto.

**Evidência / referência no código:**

Inputs password em `PerfilPage.jsx`.

**Impacto:**

UX de segurança pior e preenchimento incorreto.

**Recomendação:**

Adicionar `current-password` e `new-password`.

**Testes de validação recomendados:**

Testes verificam autoComplete correto.


### PERF-004 — Nome sem limite máximo

**Severidade:** `P2`

**Diagnóstico:**

Frontend/backend validam mínimo, mas não máximo.

**Evidência / referência no código:**

Validação de `displayName` em `PerfilPage.jsx` e `updateOwnProfile`.

**Impacto:**

Nome enorme pode quebrar topbar/sidebar/auditoria.

**Recomendação:**

Definir 2–80 caracteres no frontend e backend.

**Testes de validação recomendados:**

81 caracteres rejeitado.


### PERF-005 — Formulários sem semântica de `<form>` e labels associados

**Severidade:** `P2`

**Diagnóstico:**

Inputs não possuem `id/htmlFor` e ações são por click.

**Evidência / referência no código:**

Markup de PerfilPage.

**Impacto:**

Acessibilidade e testes piores.

**Recomendação:**

Usar `<form onSubmit>` e labels associados.

**Testes de validação recomendados:**

Enter envia; `getByLabelText` encontra campos.


### PERF-006 — Último acesso usa `lastSignInTime`

**Severidade:** `P2`

**Diagnóstico:**

Rótulo sugere atividade real, mas valor é último login Firebase.

**Evidência / referência no código:**

`user.metadata.lastSignInTime`.

**Impacto:**

Pode ser interpretado como atividade do sistema.

**Recomendação:**

Renomear para “Último login” e explicar base.

**Testes de validação recomendados:**

Tela mostra “Último login”.


### 4.7.5 Direção de design recomendada

Reformular como “Identidade operacional e segurança de acesso”, mostrando status da conta, método de login, portal, tenant e permissões resumidas.

### 4.7.6 Prioridades de correção

- P1: corrigir auditoria cliente/ops.
- P1: provider password.
- P1: autocomplete.
- P2: limite de nome, labels e forms.
- P3: status da conta e microcopy.

### 4.7.7 Veredito

Funcional, mas básica. Precisa comunicar identidade operacional, método de login e contexto de tenant/papel com mais clareza.

---

## 8. Portal Cliente — Dashboard

**Rota:** `/client/dashboard`

### 4.8.1 Função da página

Porta de entrada executiva do cliente para acompanhar volume, status, risco, quota e evolução dos dossiês.

### 4.8.2 Arquivos principais

- `src/portals/client/DashboardClientePage.jsx`
- `src/core/clientPortal.js`
- `src/hooks/useCases.js`
- `src/ui/components/KpiCard/KpiCard.jsx`
- `src/ui/components/QuotaBar/QuotaBar.jsx`

### 4.8.3 O que a página faz bem

- Usa `clientCases` sanitizado.
- Mostra KPIs úteis.
- Exibe quota quando configurada.
- Mostra vereditos, evolução mensal, motivos de atenção e casos recentes.

### 4.8.4 Achados, riscos e recomendações

### DASH-001 — `/client` redireciona para Solicitações, mas sidebar põe Dashboard primeiro

**Severidade:** `P1`

**Diagnóstico:**

Inconsistência de navegação inicial.

**Evidência / referência no código:**

`App.jsx`: index client → `solicitacoes`; Sidebar lista Dashboard primeiro.

**Impacto:**

Usuário não cai na tela executiva esperada.

**Recomendação:**

Decidir entrada; recomendado `/client` → dashboard.

**Testes de validação recomendados:**

Acessar `/client` redireciona para `/client/dashboard`.


### DASH-002 — KPIs são sobre casos carregados, não total real

**Severidade:** `P1`

**Diagnóstico:**

`metrics.total = cases.length` e `cases` vem de query limitada.

**Evidência / referência no código:**

`getClientDashboardMetrics(cases)` e `subscribeToClientCases`.

**Impacto:**

Dashboard pode mostrar 500 como total real quando tenant tem mais.

**Recomendação:**

Avisar recorte ou criar agregados por tenant.

**Testes de validação recomendados:**

Com 501 casos, UI não afirma total absoluto.


### DASH-003 — “Concluídos no período” não aplica período

**Severidade:** `P1`

**Diagnóstico:**

Label diz período, mas métrica conta todos `DONE` carregados.

**Evidência / referência no código:**

`doneCases = cases.filter(status === DONE)`.

**Impacto:**

Métrica enganosa.

**Recomendação:**

Renomear para “Concluídos” ou calcular mês/período real.

**Testes de validação recomendados:**

Label com período exige filtro correspondente.


### DASH-004 — KPIs são botões sem ação ou com ação inconsistente

**Severidade:** `P1`

**Diagnóstico:**

`KpiCard` renderiza `<button>`, mas alguns usos não passam onClick.

**Evidência / referência no código:**

`KpiCard.jsx`; Dashboard usa cards sem onClick.

**Impacto:**

Acessibilidade e expectativa quebrada.

**Recomendação:**

Cards não clicáveis devem ser `<div>`; preferir navegar para Solicitações filtradas.

**Testes de validação recomendados:**

Clicar Pendentes navega/filtra ou card não é botão.


### DASH-005 — Não destaca ações necessárias

**Severidade:** `P2`

**Diagnóstico:**

Correções aparecem como KPI condicional, mas não há bloco de próxima ação.

**Evidência / referência no código:**

`metrics.corrections` renderiza KpiCard apenas se > 0.

**Impacto:**

Cliente não sabe o que fazer agora.

**Recomendação:**

Adicionar seção “Ação necessária” com CTA para casos em correção/aguardando info.

**Testes de validação recomendados:**

Com correções >0, bloco de ação aparece.


### DASH-006 — Quota falha silenciosamente

**Severidade:** `P2`

**Diagnóstico:**

Erro de `callGetClientQuotaStatus` é ignorado.

**Evidência / referência no código:**

`.catch(() => {})` em DashboardClientePage.

**Impacto:**

Sem distinguir sem limite/carregando/erro.

**Recomendação:**

Adicionar loading/error de quota.

**Testes de validação recomendados:**

Falha mostra aviso.


### DASH-007 — Tempo médio usa fallback `updatedAt` sem explicar

**Severidade:** `P2`

**Diagnóstico:**

Métrica pode ser distorcida se `concludedAt` ausente.

**Evidência / referência no código:**

`clientPortal.js` calcula diff com `concludedAt || updatedAt`.

**Impacto:**

Tempo médio executivo pode ficar errado.

**Recomendação:**

Usar `turnaroundHours` persistido ou apenas `concludedAt` real; tooltip de base.

**Testes de validação recomendados:**

Caso DONE sem concludedAt não entra ou sinaliza dado incompleto.


### 4.8.5 Direção de design recomendada

Reorganizar como Command Center executivo de risco: ação necessária primeiro, indicadores principais, risco/veredito, quota, evolução e últimos dossiês com link.

### 4.8.6 Prioridades de correção

- P1: alinhar rota inicial.
- P1: corrigir recorte dos KPIs.
- P1: corrigir rótulos de período e cards clicáveis.
- P2: ação necessária e quota.
- P3: microcopy, ícones e estética executiva.

### 4.8.7 Veredito

Boa base, mas precisa orientar decisão, não apenas mostrar números. A pergunta principal deve ser: o que exige ação do cliente agora?

---

## 9. Portal Operacional — Fila de Trabalho

**Rota:** `/ops/fila`

### 4.9.1 Função da página

Tela principal do analista para priorizar casos pendentes, assumir análise e abrir caso.

### 4.9.2 Arquivos principais

- `src/portals/ops/FilaPage.jsx`
- `src/hooks/useCases.js`
- `src/core/firebase/firestoreService.js`
- `functions/index.js`
- `src/ui/components/KpiCard/KpiCard.jsx`

### 4.9.3 O que a página faz bem

- Respeita tenant selecionado.
- Tem visão Todas as franquias.
- Filtra status/atribuição/data.
- Mostra KPIs, prioridade, enriquecimento, risco e score.
- Permite assunção individual e em massa.
- Tem testes básicos de filtro e assumir.

### 4.9.4 Achados, riscos e recomendações

### FILA-001 — Backend de assumir caso é permissivo demais

**Severidade:** `P0`

**Diagnóstico:**

`assignCaseToCurrentAnalyst` atualiza assignee e status IN_PROGRESS sem validar estado, assignee atual, tenant ou status operacional inativo.

**Evidência / referência no código:**

`functions/index.js`: callable `assignCaseToCurrentAnalyst` faz `caseRef.update({ assigneeId: uid, status: 'IN_PROGRESS' })`.

**Impacto:**

Pode reabrir/alterar casos DONE, CORRECTION_NEEDED, WAITING_INFO ou de tenant indevido via chamada direta.

**Recomendação:**

Criar `assertOpsCanOperateCase`; permitir apenas estados assumíveis e sem assignee; validar tenant e status do usuário.

**Testes de validação recomendados:**

DONE/CORRECTION_NEEDED/IN_PROGRESS de outro usuário retornam `failed-precondition`/`permission-denied`.


### FILA-002 — Selecionar todos inclui casos não assumíveis

**Severidade:** `P1`

**Diagnóstico:**

`toggleAll` seleciona toda `queue`, que inclui qualquer status != DONE.

**Evidência / referência no código:**

`FilaPage.jsx`: queue remove DONE; toggleAll usa `queue.map(c => c.id)`.

**Impacto:**

Bulk assign pode tentar assumir correções/aguardando cliente/casos de outro responsável.

**Recomendação:**

Criar `isAssignableCase`; checkbox desabilitado e tooltip para não assumíveis.

**Testes de validação recomendados:**

Selecionar todos pega só PENDING sem responsável.


### FILA-003 — Bulk assign sequencial e sem detalhes de falha

**Severidade:** `P1`

**Diagnóstico:**

Loop `for await` chama callable uma a uma e só conta falhas.

**Evidência / referência no código:**

`FilaPage.jsx`: `for (const id of ids) await callAssignCaseToCurrentAnalyst(...)`.

**Impacto:**

Lento e opaco; analista não sabe quais falharam.

**Recomendação:**

Criar callable batch com retorno por caso ou concorrência limitada com detalhes.

**Testes de validação recomendados:**

Resposta informa atribuídos/bloqueados/falhas com motivo.


### FILA-004 — Usuário operacional inativo pode passar em helper

**Severidade:** `P1`

**Diagnóstico:**

`getOpsUserProfile` valida role operacional, mas não `status === inactive`.

**Evidência / referência no código:**

`functions/index.js`: `getOpsUserProfile(uid)`.

**Impacto:**

Conta inativa pode continuar chamando funções se sessão/token persistir.

**Recomendação:**

Bloquear `profile.status === 'inactive'` em helper ops.

**Testes de validação recomendados:**

Analyst inactive recebe `permission-denied`.


### FILA-005 — Prioridade ausente quebra `toLowerCase`

**Severidade:** `P2`

**Diagnóstico:**

`currentCase.priority.toLowerCase()` assume campo presente.

**Evidência / referência no código:**

`FilaPage.jsx` mobile/desktop priority chip.

**Impacto:**

Documento incompleto quebra a fila.

**Recomendação:**

Helper `getPriorityView` com fallback Normal/Não definida.

**Testes de validação recomendados:**

Caso sem priority não quebra.


### FILA-006 — Score ausente pode parecer baixo risco

**Severidade:** `P2`

**Diagnóstico:**

`ScoreBar` recebe `riskScore` indefinido. Ausente não deve ser 0.

**Evidência / referência no código:**

`FilaPage.jsx` passa `<ScoreBar score={currentCase.riskScore} />`.

**Impacto:**

Analista interpreta pendência como baixo risco.

**Recomendação:**

Mostrar “Pendente/—/Inconclusivo” conforme status de enriquecimento.

**Testes de validação recomendados:**

Sem riskScore + RUNNING mostra Pendente.


### FILA-007 — Estado vazio e data inválida são genéricos

**Severidade:** `P2`

**Diagnóstico:**

Intervalo inválido ou filtro sem resultado mostram “Nenhum caso pendente”.

**Evidência / referência no código:**

Filtros data e empty state em `FilaPage.jsx`.

**Impacto:**

Usuário confunde erro de filtro com fila vazia.

**Recomendação:**

Validar data e mensagens por contexto.

**Testes de validação recomendados:**

Data inicial > final mostra erro específico.


### 4.9.5 Direção de design recomendada

Transformar em War Room operacional: cabeçalho próprio, KPIs gerais, lista filtrada com próxima ação, status de enriquecimento legível e seleção apenas de casos assumíveis.

### 4.9.6 Prioridades de correção

- P0/P1: backend validar assunção.
- P1: seleção em massa segura.
- P1: usuário ops inativo.
- P2: prioridades/scores resilientes, estados vazios.
- P3: legenda e estética de fila priorizada.

### 4.9.7 Veredito

Funcional, mas a ação de assumir caso altera estado operacional; precisa de validação forte no backend e UI de fila priorizada.

---

## 10. Portal Operacional — Caso / Análise

**Rota:** `/ops/caso/:caseId`

### 4.10.1 Função da página

Workbench operacional onde o analista revisa fontes, IA, homonímia, flags, rascunho, devolução ao cliente, conclusão e geração de relatório público.

### 4.10.2 Arquivos principais

- `src/portals/ops/CasoPage.jsx`
- `src/portals/ops/CasoPage.test.jsx`
- `src/ui/components/EnrichmentPipeline/EnrichmentPipeline.jsx`
- `src/core/firebase/firestoreService.js`
- `functions/index.js`
- `functions/reportBuilder.cjs`

### 4.10.3 O que a página faz bem

- Assina caso em tempo real.
- Preserva campos editados contra updates assíncronos.
- Mostra pipeline, provedores, IA, homonímia e checklist.
- Tem rascunho e testes de preservação/prefill.
- Salva publicResult/latest ao concluir.

### 4.10.4 Achados, riscos e recomendações

### CASO-001 — Ações críticas não validam tenant em algumas callables

**Severidade:** `P0`

**Diagnóstico:**

Decisão IA, rerun de IA, rerun de enriquecimento e relatório público do analista podem operar sem validação robusta de tenant do caso.

**Evidência / referência no código:**

Callables `setAiDecisionByAnalyst`, `rerunAiAnalysis`, `rerunEnrichmentPhase`, `createAnalystPublicReport` em `functions/index.js`.

**Impacto:**

Operador com caseId de outro tenant pode alterar IA/reprocessar/gerar link público.

**Recomendação:**

Criar `assertOpsCanOperateCase(profile, caseData)` e aplicar em todas as funções.

**Testes de validação recomendados:**

Analyst tenant A chamando case tenant B recebe `permission-denied`.


### CASO-002 — Relatório público do analista deve usar tenant do caso

**Severidade:** `P0`

**Diagnóstico:**

Gerar relatório público precisa usar `caseData.tenantId`, não `profile.tenantId` ou meta do frontend.

**Evidência / referência no código:**

Fluxo `createAnalystPublicReport` e chamada em `CasoPage.jsx`.

**Impacto:**

Relatório pode ficar sem tenant correto ou aparecer no tenant errado.

**Recomendação:**

Buscar case, validar acesso e persistir `tenantId = caseData.tenantId`.

**Testes de validação recomendados:**

Analista sem tenant fixo gera relatório e publicReport fica com tenant do case.


### CASO-003 — Editar em DONE/CORRECTION_NEEDED continua possível na UI

**Severidade:** `P1`

**Diagnóstico:**

Campos e botões continuam editáveis; backend bloqueia alguns saves em DONE, mas CORRECTION_NEEDED pode aceitar rascunho.

**Evidência / referência no código:**

Textareas/botões em `CasoPage.jsx`; `saveCaseDraftByAnalyst` bloqueia DONE apenas.

**Impacto:**

Analista edita estado que deveria ser leitura/aguardo, causando ambiguidade.

**Recomendação:**

Criar `canEditCase` por status e modo leitura para DONE/CORRECTION_NEEDED/WAITING_INFO conforme regra.

**Testes de validação recomendados:**

DONE: campos disabled e banner modo leitura; CORRECTION_NEEDED: aguardando cliente.


### CASO-004 — Botão voltar perde rascunho sujo

**Severidade:** `P1`

**Diagnóstico:**

`beforeunload` protege aba, mas navegação interna `Voltar` não salva nem confirma.

**Evidência / referência no código:**

`beforeunload` effect e botão `navigate('/ops/fila')`.

**Impacto:**

Perda de trabalho do analista.

**Recomendação:**

Adicionar `requestLeaveCase`: salvar e sair/sair sem salvar/continuar.

**Testes de validação recomendados:**

Editar campo, clicar Voltar, modal aparece.


### CASO-005 — Não existe botão visível de salvar rascunho

**Severidade:** `P1`

**Diagnóstico:**

Autosave ocorre em troca de etapa/Ctrl+S, mas o usuário não tem ação clara.

**Evidência / referência no código:**

`saveDraft()` em effects/atalhos.

**Impacto:**

Baixa confiança no salvamento.

**Recomendação:**

Adicionar botão Salvar rascunho + último salvamento + estados salvo/salvando/falha.

**Testes de validação recomendados:**

Editar campo habilita botão; clicar salva e limpa dirty.


### CASO-006 — Aceitar IA altera score que não é usado na conclusão

**Severidade:** `P1`

**Diagnóstico:**

`setForm` inclui `riskScore`, mas payload final usa `calculateRisk(form)` que recalcula por flags.

**Evidência / referência no código:**

`CasoPage.jsx`: aceitar IA e `handleConclude`.

**Impacto:**

Botão promete aceitar score/veredito, mas score pode ser ignorado.

**Recomendação:**

Renomear para aplicar veredito sugerido ou tornar score aceito fonte explícita.

**Testes de validação recomendados:**

Teste define regra: score aceito entra no payload ou UI não promete isso.


### CASO-007 — Mandados BDC exibidos podem não bloquear flag negativa

**Severidade:** `P1`

**Diagnóstico:**

Tela mostra mandados BigDataCorp, mas validação backend citada bloqueia Judit active warrants.

**Evidência / referência no código:**

Blocos de BDC warrants em `CasoPage.jsx`; validação de conclusão em `functions/index.js`.

**Impacto:**

Fonte exibida e regra final divergem.

**Recomendação:**

Unificar evidência ativa de mandado por Judit+BDC+FonteData ou explicitar que BDC exige revisão não bloqueante.

**Testes de validação recomendados:**

BDC active warrant + warrantFlag NEGATIVE bloqueia ou exige justificativa.


### CASO-008 — Checklist mistura bloqueante e aviso

**Severidade:** `P2`

**Diagnóstico:**

Itens graves são `warn` com `ok: true`, enquanto backend pode bloquear.

**Evidência / referência no código:**

Checklist em `CasoPage.jsx` e validação backend.

**Impacto:**

UI diz que pode concluir; backend rejeita depois.

**Recomendação:**

Separar bloqueante/alerta/informativo e refletir backend.

**Testes de validação recomendados:**

Mandado ativo + flag negativa desabilita concluir antes do backend.


### CASO-009 — Reexecutar fonte não invalida derivados de modo explícito

**Severidade:** `P2`

**Diagnóstico:**

Rerun pode deixar IA, classificação, rascunho e publicResult desatualizados.

**Evidência / referência no código:**

`handleRetryPhase`; funções rerun no backend.

**Impacto:**

Analista pode concluir com derivados antigos.

**Recomendação:**

Marcar `aiStale`, `classificationStale`, `draftNeedsReview` e bloquear conclusão até revisão.

**Testes de validação recomendados:**

Rerun Judit novo resultado exige revisão/novo cálculo.


### CASO-010 — Componente monolítico muito grande

**Severidade:** `P2`

**Diagnóstico:**

`CasoPage.jsx` concentra centenas/milhares de linhas e responsabilidades.

**Evidência / referência no código:**

Arquivo `src/portals/ops/CasoPage.jsx`.

**Impacto:**

Manutenção e testes ficam caros e frágeis.

**Recomendação:**

Extrair componentes puros: Header, Pipeline, AiPanel, EvidencePanel, ReviewStepper, ConclusionPanel, Timeline, Modals.

**Testes de validação recomendados:**

Smoke tests antes/depois garantem payload de conclusão igual.


### 4.10.5 Direção de design recomendada

Transformar em Workbench de dossiê técnico: topo fixo com identidade/status/ações, coluna esquerda com fontes/pipeline, centro com revisão, coluna direita com checklist/risco/veredito e salvar/concluir.

### 4.10.6 Prioridades de correção

- P0: tenant isolation em callables críticas.
- P0: relatório público usa tenant do case.
- P1: modo leitura, rascunho, IA score, mandados.
- P2: invalidar derivados e checklist.
- P3: refatorar e redesenhar workbench.

### 4.10.7 Veredito

É a tela mais poderosa e mais crítica. A base é forte, mas precisa fechar autorização backend e reduzir ambiguidade operacional antes de produção.

---

## 11. Portal Operacional — Todos os Casos / Arquivo de Casos

**Rota:** `/ops/casos`

### 4.11.1 Função da página

Listagem geral/histórica de casos operacionais, diferente da fila de trabalho. Deve servir para consulta, busca, supervisão e arquivo operacional.

### 4.11.2 Arquivos principais

- `src/portals/ops/CasosPage.jsx`
- `src/portals/ops/CasosPage.css`
- `src/hooks/useCases.js`
- `src/core/caseUtils.js`
- `src/core/enrichmentStatus.js`

### 4.11.3 O que a página faz bem

- Rota ativa.
- Respeita tenant selecionado.
- Filtra status, risco, veredito, enriquecimento, data e busca.
- Mostra concluídos e não só fila ativa.
- Tem mobile cards.

### 4.11.4 Achados, riscos e recomendações

### CASOS-001 — Função da página não está clara

**Severidade:** `P1`

**Diagnóstico:**

A tela parece duplicação da Fila porque não tem cabeçalho explicando que é arquivo/histórico.

**Evidência / referência no código:**

`CasosPage.jsx` começa direto em KPIs.

**Impacto:**

Usuário acha que a tela está desativada ou redundante.

**Recomendação:**

Adicionar hero: “Arquivo de Casos / Base operacional de dossiês”.

**Testes de validação recomendados:**

Tela explica diferença: Fila = ação; Casos = consulta.


### CASOS-002 — Botão Abrir leva para rota com `CASE_WRITE`

**Severidade:** `P1`

**Diagnóstico:**

`/ops/casos` exige `CASE_READ`, mas botão navega para `/ops/caso/:caseId`, que exige `CASE_WRITE`.

**Evidência / referência no código:**

Rota `casos` e rota `caso/:caseId` em App; botão em `CasosPage.jsx`.

**Impacto:**

Usuário read-only vê ação que falha depois.

**Recomendação:**

Ocultar/desabilitar ou criar modo leitura do caso.

**Testes de validação recomendados:**

Usuário CASE_READ sem CASE_WRITE não vê botão ativo.


### CASOS-003 — Inconsistência risco RED/HIGH

**Severidade:** `P1`

**Diagnóstico:**

KPI Alertas conta `riskLevel === RED`, mas filtro usa `HIGH/MEDIUM/LOW`.

**Evidência / referência no código:**

`getCaseStats` vs opções de filtro em `CasosPage.jsx`.

**Impacto:**

KPI e filtro podem não bater.

**Recomendação:**

Padronizar enum `HIGH/MEDIUM/LOW` ou normalizar legado `RED→HIGH`.

**Testes de validação recomendados:**

Caso HIGH é contado e filtrado corretamente.


### CASOS-004 — Busca pode quebrar com campos ausentes

**Severidade:** `P1`

**Diagnóstico:**

Busca usa `candidateName.toLowerCase()` e `cpfMasked` sem fallback.

**Evidência / referência no código:**

Filtro de busca em `CasosPage.jsx`.

**Impacto:**

Documento incompleto derruba tela.

**Recomendação:**

Normalizar strings antes de buscar.

**Testes de validação recomendados:**

Caso sem nome/CPF não quebra.


### CASOS-005 — KPI Total não limpa todos os filtros

**Severidade:** `P2`

**Diagnóstico:**

Total só altera status, mantendo busca/risco/veredito/data.

**Evidência / referência no código:**

KpiCard Total chama `setStatusFilter('ALL')`.

**Impacto:**

Usuário espera ver todos, mas filtros continuam ativos.

**Recomendação:**

Criar `clearAllFilters()`.

**Testes de validação recomendados:**

Aplicar risco e clicar Total limpa risco/busca/data.


### CASOS-006 — Lista sugere todos, mas usa casos carregados

**Severidade:** `P2`

**Diagnóstico:**

`useCases` usa query limitada e filtros são locais.

**Evidência / referência no código:**

`subscribeToCases` via helper com limit padrão.

**Impacto:**

Página chamada Todos os Casos pode mostrar só recorte.

**Recomendação:**

Renomear contador para “casos carregados” ou implementar paginação/server-side.

**Testes de validação recomendados:**

UI informa recorte quando há limite.


### CASOS-007 — Falta teste próprio

**Severidade:** `P2`

**Diagnóstico:**

Não há `CasosPage.test.jsx` cobrindo filtros combinados.

**Evidência / referência no código:**

Arquivos de teste existentes não cobrem a página.

**Impacto:**

Regressões em filtros de risco/veredito/busca passam.

**Recomendação:**

Criar suite dedicada.

**Testes de validação recomendados:**

Testes cobrem filtros, busca resiliente, KPI total e alertas.


### 4.11.5 Direção de design recomendada

Reposicionar visualmente como Arquivo de Casos, com cabeçalho próprio, aviso de escopo carregado, filtros poderosos e botão limpar filtros.

### 4.11.6 Prioridades de correção

- P1: RED/HIGH, botão read-only, busca resiliente.
- P2: limpar filtros, data inválida, recorte.
- P3: cabeçalho e testes.

### 4.11.7 Veredito

A página está ativa, mas precisa de identidade própria e consistência de contratos. Manter como arquivo operacional é uma boa decisão.

---

## 12. Portal Operacional — Gestão de Clientes

**Rota:** `/ops/clientes`

### 4.12.1 Função da página

Tela operacional para visualizar clientes/tenants, criar gestor inicial e acessar configurações.

### 4.12.2 Arquivos principais

- `src/portals/ops/ClientesPage.jsx`
- `src/core/firebase/firestoreService.js`
- `functions/index.js`
- `firestore.rules`

### 4.12.3 O que a página faz bem

- Rota protegida por `USERS_MANAGE` no frontend.
- Criação passa por Cloud Function.
- Lista clientes e carrega configurações por tenant.
- Botão Configurar leva ao tenant settings.
- Tem testes básicos de carregamento/erro.

### 4.12.4 Achados, riscos e recomendações

### CLI-OPS-001 — Backend permite criar cliente para qualquer role operacional

**Severidade:** `P0`

**Diagnóstico:**

`createOpsClientUser` chama `getOpsUserProfile`, que aceita analyst/supervisor/admin.

**Evidência / referência no código:**

`functions/index.js`: `createOpsClientUser`; helper `getOpsUserProfile`.

**Impacto:**

Analyst pode chamar callable e criar tenant/cliente/gestor via chamada direta.

**Recomendação:**

Validar `USERS_MANAGE` no backend ou role admin/supervisor conforme regra.

**Testes de validação recomendados:**

analyst recebe permission-denied; supervisor/admin conforme política.


### CLI-OPS-002 — Rules permitem escrita direta em userProfiles por analyst

**Severidade:** `P0`

**Diagnóstico:**

`isAnalyst()` inclui analyst/supervisor/admin e permite create/update/delete em `userProfiles`.

**Evidência / referência no código:**

`firestore.rules`: `allow create, update, delete: if isAuthenticated() && isAnalyst()`.

**Impacto:**

Escalação/alteração de roles/tenant via Firestore direto.

**Recomendação:**

Bloquear escrita direta; gerenciar perfis somente por Cloud Functions.

**Testes de validação recomendados:**

Emulador nega update direto de userProfiles para analyst/admin web.


### CLI-OPS-003 — Tela mistura tenant e usuário cliente

**Severidade:** `P1`

**Diagnóstico:**

`fetchClients` lista `userProfiles` com roles cliente, então múltiplos usuários do mesmo tenant viram múltiplas linhas de “cliente”.

**Evidência / referência no código:**

`fetchClients()` consulta userProfiles role in CLIENT_ROLES.

**Impacto:**

Gestão de clientes não representa empresas/tenants, mas usuários.

**Recomendação:**

Transformar em Console de Tenants: uma linha por tenant com usuários/gestores/status/limites.

**Testes de validação recomendados:**

Dois usuários do mesmo tenant aparecem como uma empresa com contador 2.


### CLI-OPS-004 — Senha provisória exposta no toast

**Severidade:** `P1`

**Diagnóstico:**

Senha gerada no frontend aparece em campo e mensagem de sucesso.

**Evidência / referência no código:**

`ClientesPage.jsx`: `generatePassword` e `setSuccessMessage` com senha.

**Impacto:**

Exposição de credencial.

**Recomendação:**

Preferir convite/reset; se MVP, não mostrar senha no toast, ocultar por padrão e botão copiar.

**Testes de validação recomendados:**

Toast de sucesso não contém senha.


### CLI-OPS-005 — Colisão de tenantId ao criar nova empresa

**Severidade:** `P1`

**Diagnóstico:**

Slug gerado de tenantName pode bater com tenant existente e anexar usuário sem confirmação.

**Evidência / referência no código:**

`createOpsClientUser`: `tenantId = requestedTenantId || normalizeTenantSlug(tenantName)`.

**Impacto:**

Pode misturar cliente novo em tenant existente.

**Recomendação:**

Se requestedTenantId ausente e tenantId já existe, rejeitar e pedir seleção explícita.

**Testes de validação recomendados:**

tenantSettings/tech-corp existente + nova empresa Tech Corp retorna erro.


### CLI-OPS-006 — Falha de tenantSettings vira todas as fases ativas

**Severidade:** `P1`

**Diagnóstico:**

Catch de `getTenantSettings` usa `DEFAULT_ANALYSIS_CONFIG`, exibindo config como ativa.

**Evidência / referência no código:**

`ClientesPage.jsx`: catch define configs[tid] = DEFAULT_ANALYSIS_CONFIG.

**Impacto:**

Operador vê configuração enganosa.

**Recomendação:**

Diferenciar erro de configuração inexistente; erro mostra “configuração indisponível”.

**Testes de validação recomendados:**

Falha de settings não mostra todas as fases ativas.


### CLI-OPS-007 — Modal não aproveita tenant selecionado

**Severidade:** `P2`

**Diagnóstico:**

Mesmo com selectedTenantId ativo, modal abre vazio/novo tenant.

**Evidência / referência no código:**

`handleOpenModal` reseta `existingTenantId`.

**Impacto:**

Risco de criar novo tenant por engano.

**Recomendação:**

Preselecionar tenant atual e alterar texto para “Adicionar gestor ao tenant”.

**Testes de validação recomendados:**

Com tenant selecionado, modal abre com tenant preenchido.


### CLI-OPS-008 — Timeout local não cancela callable

**Severidade:** `P2`

**Diagnóstico:**

`Promise.race` mostra erro após 15s, mas backend pode concluir depois.

**Evidência / referência no código:**

`ClientesPage.jsx` cria timeout local.

**Impacto:**

Operador pode tentar novamente e causar confusão/duplicidade.

**Recomendação:**

Mensagem: “pode estar em andamento; recarregue antes de tentar novamente”.

**Testes de validação recomendados:**

Timeout mostra botão recarregar lista.


### 4.12.5 Direção de design recomendada

Redesenhar como Console de Tenants: empresa, status, usuários, gestores, fases, limites, última solicitação, ações Configurar/Equipe/Casos.

### 4.12.6 Prioridades de correção

- P0: RBAC backend e Rules.
- P1: entidade tenant vs usuário, senha, colisão, config indisponível.
- P2: contexto tenant, validações, timeout.
- P3: layout console e microcopy.

### 4.12.7 Veredito

Funcional, mas mistura conceitos e tem riscos de RBAC severos. Deve virar gestão de tenants com backend fechado.

---

## 13. Portal Operacional — Configurações do Tenant

**Rota:** `/ops/tenant-settings/:tenantId`

### 4.13.1 Função da página

Tela administrativa para configurar fases de análise, limites de consulta, excedência, provedores e IA por tenant.

### 4.13.2 Arquivos principais

- `src/portals/ops/TenantSettingsPage.jsx`
- `src/core/firebase/firestoreService.js`
- `functions/index.js`
- `firestore.rules`

### 4.13.3 O que a página faz bem

- Rota frontend exige `SETTINGS_MANAGE`.
- Escrita direta em tenantSettings bloqueada nas Rules.
- Configuração passa por Cloud Function.
- Separa fases, limites e enriquecimento.
- Registra auditoria de alteração.

### 4.13.4 Achados, riscos e recomendações

### TENANT-SET-001 — Backend aceita qualquer role operacional

**Severidade:** `P0`

**Diagnóstico:**

`updateTenantSettingsByAnalyst` usa `getOpsUserProfile`, aceitando analyst/supervisor/admin.

**Evidência / referência no código:**

Cloud Function `updateTenantSettingsByAnalyst`.

**Impacto:**

Analyst pode alterar provedores, limites e IA por chamada direta.

**Recomendação:**

Validar `SETTINGS_MANAGE`/admin no backend.

**Testes de validação recomendados:**

analyst recebe permission-denied.


### TENANT-SET-002 — Backend salva tenantId arbitrário

**Severidade:** `P0`

**Diagnóstico:**

Callable faz `.set(..., { merge: true })` em qualquer `tenantId` recebido.

**Evidência / referência no código:**

`tenantSettings/{tenantId}` sem validar existência formal.

**Impacto:**

Configurações fantasma e poluição operacional.

**Recomendação:**

Validar tenant contra coleção canônica `tenants` ou userProfiles/tenantSettings existente.

**Testes de validação recomendados:**

tenantId inexistente retorna not-found/failed-precondition.


### TENANT-SET-003 — Erro ao carregar config mostra defaults e permite salvar

**Severidade:** `P0`

**Diagnóstico:**

Catch define defaults e botão salvar continua ativo.

**Evidência / referência no código:**

`TenantSettingsPage.jsx`: catch `setPhases(DEFAULT)` e renderiza botão salvar.

**Impacto:**

Erro temporário pode sobrescrever configuração real com defaults.

**Recomendação:**

Se erro de carregamento, bloquear salvar e mostrar Recarregar.

**Testes de validação recomendados:**

getTenantSettings rejeita → salvar desabilitado.


### TENANT-SET-004 — Payload não é validado no backend

**Severidade:** `P1`

**Diagnóstico:**

analysisConfig, limits e enrichmentConfig são gravados como recebidos.

**Evidência / referência no código:**

`updateTenantSettingsByAnalyst` monta payload sem schema validation.

**Impacto:**

Valores inválidos quebram pipeline/custos/gates.

**Recomendação:**

Validar schema completo e ranges; rejeitar chaves/valores inválidos.

**Testes de validação recomendados:**

dailyLimit negativo, minNameSimilarity > 1 e analysisConfig string são rejeitados.


### TENANT-SET-005 — Limite inválido vira ilimitado

**Severidade:** `P1`

**Diagnóstico:**

Frontend converte NaN/negativo para null, e null significa sem limite.

**Evidência / referência no código:**

`rawDaily !== null && (isNaN || <0) ? null : rawDaily`.

**Impacto:**

Erro de digitação pode remover limite.

**Recomendação:**

Campo vazio = ilimitado; inválido/negativo = erro e bloqueia salvar.

**Testes de validação recomendados:**

dailyLimit=-1 não chama backend.


### TENANT-SET-006 — minNameSimilarity pode virar 0

**Severidade:** `P1`

**Diagnóstico:**

Limpar campo gera `parseFloat('') || 0`.

**Evidência / referência no código:**

Input gate em `TenantSettingsPage.jsx`.

**Impacto:**

Gate de identidade praticamente desativado.

**Recomendação:**

Não converter inválido para zero; validar 0–1 ou mínimo operacional.

**Testes de validação recomendados:**

Campo vazio mostra erro/restaura 0.7.


### TENANT-SET-007 — Texto diz providers paralelos, mas backend é sequencial

**Severidade:** `P2`

**Diagnóstico:**

UI informa que providers rodam em paralelo, mas pipeline é BDC → Judit → Escavador/DJEN.

**Evidência / referência no código:**

Texto da seção Pipeline; comentários/fluxos backend.

**Impacto:**

Operador entende dependências erradas.

**Recomendação:**

Corrigir microcopy para sequência real.

**Testes de validação recomendados:**

Texto descreve BDC primeiro, Judit depois, dependentes após Judit.


### TENANT-SET-008 — Sem confirmação para mudanças críticas

**Severidade:** `P2`

**Diagnóstico:**

Salvar desativa/ativa provedores, excedência e IA sem revisão de impacto.

**Evidência / referência no código:**

Botão Salvar chama direto `handleSave`.

**Impacto:**

Configuração pode aumentar custo ou reduzir cobertura por engano.

**Recomendação:**

Modal de revisão para mudanças críticas.

**Testes de validação recomendados:**

Desativar BDC abre confirmação crítica.


### 4.13.5 Direção de design recomendada

Reposicionar como Console de Governança do Tenant: cobertura do dossiê, limites/cobrança, pipeline de fontes, IA, impacto, riscos e última alteração.

### 4.13.6 Prioridades de correção

- P0: RBAC backend, tenantId válido, erro não salva default.
- P1: schema, limites, minNameSimilarity.
- P2: microcopy do pipeline, confirmação crítica, dirty state.
- P3: layout governança e acessibilidade.

### 4.13.7 Veredito

Uma das telas mais sensíveis: altera custo, cobertura, provedores e risco. Precisa de validação backend forte e UX de impacto.

---

## 14. Portal Operacional — Auditoria

**Rota:** `/ops/auditoria`

### 4.14.1 Função da página

Tela operacional de audit logs completos para investigação e rastreabilidade.

### 4.14.2 Arquivos principais

- `src/portals/ops/AuditoriaPage.jsx`
- `src/hooks/useAuditLogs.js`
- `src/core/firebase/firestoreService.js`
- `src/core/audit/auditCatalog.js`
- `functions/audit/writeAuditEvent.js`

### 4.14.3 O que a página faz bem

- Rota protegida por `AUDIT_VIEW`.
- Usa `auditLogs` operacional completo.
- Respeita tenant selecionado.
- Tem filtros por categoria/ação e busca.
- Mostra usuário, ação, alvo, detalhe e IP.

### 4.14.4 Achados, riscos e recomendações

### AUD-OPS-001 — Não mostra tenant no contexto global

**Severidade:** `P1`

**Diagnóstico:**

Em Todas as franquias, eventos não exibem tenant na tabela.

**Evidência / referência no código:**

`AuditoriaPage.jsx` colunas não incluem tenantId.

**Impacto:**

Investigação multi-tenant fica frágil.

**Recomendação:**

Adicionar coluna Tenant ou cabeçalho de contexto e campo no drawer.

**Testes de validação recomendados:**

Log com tenantId aparece quando contexto é global.


### AUD-OPS-002 — Ordena por `timestamp` legado

**Severidade:** `P1`

**Diagnóstico:**

Mapper usa `occurredAt || timestamp`, mas query ordena por `timestamp`.

**Evidência / referência no código:**

`subscribeToAuditLogs` usa `orderBy('timestamp')`.

**Impacto:**

Eventos v2 com occurredAt podem ordenar errado.

**Recomendação:**

Padronizar `occurredAt` e backfill legado.

**Testes de validação recomendados:**

Evento com occurredAt recente aparece no topo.


### AUD-OPS-003 — Busca/filtros locais em 500 logs

**Severidade:** `P1`

**Diagnóstico:**

Query limitada e filtros em memória.

**Evidência / referência no código:**

`DEFAULT_QUERY_LIMIT`; filtros em `AuditoriaPage.jsx`.

**Impacto:**

Auditoria antiga não é encontrada.

**Recomendação:**

Implementar período/paginação server-side ou aviso de recorte.

**Testes de validação recomendados:**

UI mostra “logs carregados” se sem server-side.


### AUD-OPS-004 — IP bruto visível para todos com AUDIT_VIEW

**Severidade:** `P1`

**Diagnóstico:**

Analyst/supervisor/admin podem ver IP completo.

**Evidência / referência no código:**

Rota `AUDIT_VIEW`; coluna IP em `AuditoriaPage.jsx`.

**Impacto:**

IP é dado sensível e pode exigir granularidade.

**Recomendação:**

Criar `AUDIT_SENSITIVE_VIEW`; mascarar IP para perfis sem permissão.

**Testes de validação recomendados:**

Analyst vê IP mascarado; admin vê completo.


### AUD-OPS-005 — Falta filtro por período, nível e origem

**Severidade:** `P2`

**Diagnóstico:**

Audit writer grava `level` e `source`, mas página não mostra/filtra.

**Evidência / referência no código:**

Campos em `writeAuditEvent`; tabela da página não inclui level/source.

**Impacto:**

Investigação perde prioridade e origem.

**Recomendação:**

Adicionar filtros por período/level/source e badges.

**Testes de validação recomendados:**

Log SECURITY/source PORTAL_CLIENT aparece e filtra.


### AUD-OPS-006 — Sem drawer de detalhe do evento

**Severidade:** `P2`

**Diagnóstico:**

Tabela trunca detalhes e não mostra metadata/related completos.

**Evidência / referência no código:**

`data-table__td--truncate` para detail.

**Impacto:**

Evento auditável perde verificabilidade.

**Recomendação:**

Criar drawer com ID, actor, entity, related, metadata, source, level, IP.

**Testes de validação recomendados:**

Clicar linha abre drawer com campos estruturados.


### AUD-OPS-007 — Sem exportação controlada da auditoria

**Severidade:** `P2`

**Diagnóstico:**

Não há ação para exportar logs filtrados.

**Evidência / referência no código:**

Ausente na UI.

**Impacto:**

Incidentes/compliance podem precisar anexar trilha.

**Recomendação:**

Criar exportação backend auditada e mascarada conforme permissão.

**Testes de validação recomendados:**

Exportar gera `AUDIT_EXPORT_CREATED`.


### 4.14.5 Direção de design recomendada

Transformar em ledger técnico/forense de eventos: resumo, filtros por período/tenant/nível/origem, tabela com tenant e drawer detalhado.

### 4.14.6 Prioridades de correção

- P1: tenant, occurredAt, recorte/paginação, IP.
- P2: level/source/drawer/related/exportação.
- P3: microcopy, ícones e testes.

### 4.14.7 Veredito

Boa base de audit logs, mas ainda é lista de logs. Precisa virar ferramenta de investigação com detalhe estruturado.

---

## 15. Portal Operacional — Métricas de IA

**Rota:** `/ops/metricas-ia`

### 4.15.1 Função da página

Dashboard de métricas de IA, provedores, custos, tokens, cache, decisões do analista e resumo por franquia.

### 4.15.2 Arquivos principais

- `src/portals/ops/MetricasIAPage.jsx`
- `src/hooks/useCases.js`
- `functions/index.js`

### 4.15.3 O que a página faz bem

- Respeita tenant selecionado.
- Mostra períodos.
- Exibe provedores, FonteData, IA, custos, tokens, cache, erros e decisões.
- Resumo por franquia no contexto global.

### 4.15.4 Achados, riscos e recomendações

### MIA-001 — Permissão `AUDIT_VIEW` ampla para custo/IA

**Severidade:** `P1`

**Diagnóstico:**

Analyst também possui AUDIT_VIEW e pode ver custos globais/resumo por franquia.

**Evidência / referência no código:**

Rota `/ops/metricas-ia` protegida por AUDIT_VIEW.

**Impacto:**

Dados financeiros/operacionais sensíveis ficam amplos.

**Recomendação:**

Criar `AI_METRICS_VIEW` ou `OPS_METRICS_VIEW` com granularidade.

**Testes de validação recomendados:**

analyst não vê custos globais; admin vê completo.


### MIA-002 — Métricas calculadas sobre casos carregados

**Severidade:** `P1`

**Diagnóstico:**

A página usa `useCases` e calcula em memória até limite de query.

**Evidência / referência no código:**

`MetricasIAPage.jsx`: `const { cases } = useCases(tenantOverride)`.

**Impacto:**

Métricas parecem consolidadas, mas são parciais.

**Recomendação:**

Criar ledger/agregados de IA/provedores por tenant/mês; no MVP avisar recorte.

**Testes de validação recomendados:**

UI mostra base: X casos carregados, Y execuções.


### MIA-003 — Período usa `createdAt`, não `aiExecutedAt`

**Severidade:** `P1`

**Diagnóstico:**

Filtro temporal de IA usa data de criação do caso.

**Evidência / referência no código:**

`pc = cases.filter(c => c.createdAt >= cutoff)`.

**Impacto:**

Reexecuções recentes em casos antigos ficam fora; casos novos sem IA entram.

**Recomendação:**

Para IA, filtrar por `aiExecutedAt`; para provedores, usar timestamp da fase.

**Testes de validação recomendados:**

Caso criado há 60 dias e aiExecutedAt hoje entra nos 7 dias.


### MIA-004 — PENDING conta como chamada de provider

**Severidade:** `P1`

**Diagnóstico:**

Qualquer status não vazio e diferente de SKIPPED incrementa calls.

**Evidência / referência no código:**

Loop providers em `MetricasIAPage.jsx`.

**Impacto:**

Infla chamadas e taxa de sucesso.

**Recomendação:**

Separar PENDING, RUNNING, DONE, PARTIAL, FAILED, BLOCKED, SKIPPED.

**Testes de validação recomendados:**

PENDING não incrementa chamadas executadas.


### MIA-005 — Erros de IA sem resposta não entram em chamadas

**Severidade:** `P1`

**Diagnóstico:**

`aiCases` exige raw/structured; `aiError` fica fora do total de chamadas.

**Evidência / referência no código:**

`aiCases = pc.filter(c => c.aiRawResponse || c.aiStructured)`.

**Impacto:**

Taxa de erro fica subestimada.

**Recomendação:**

Criar “tentativas” = aiExecutedAt/aiError/raw/structured; respostas úteis separadas.

**Testes de validação recomendados:**

Caso com aiError conta como tentativa e erro.


### MIA-006 — Custo/tokens de homonímia inconsistentes

**Severidade:** `P1`

**Diagnóstico:**

Custo soma `aiHomonymCostUsd`, mas tokens somam apenas `aiTokens`.

**Evidência / referência no código:**

Reducers de custo/tokens em `MetricasIAPage.jsx`.

**Impacto:**

Custo por token fica incoerente.

**Recomendação:**

Separar IA geral, IA homonímia e total.

**Testes de validação recomendados:**

Tokens totais incluem `aiHomonymTokens` ou UI declara escopo parcial.


### MIA-007 — Custo representa último estado do case, não ledger acumulado

**Severidade:** `P1`

**Diagnóstico:**

`aiCostUsd` no case pode ser sobrescrito por reruns; métricas somam estado atual.

**Evidência / referência no código:**

`buildAiUpdatePayload` e soma em `MetricasIAPage`.

**Impacto:**

Custo real acumulado pode ser subestimado.

**Recomendação:**

Criar `aiUsageEvents` e agregados mensais.

**Testes de validação recomendados:**

Três execuções no mesmo caso somam três eventos.


### MIA-008 — BRL + USD chamado de consolidado

**Severidade:** `P2`

**Diagnóstico:**

Tabela mostra `R$ X + $ Y` como Custos Consolidados.

**Evidência / referência no código:**

Tabela por franquia em `MetricasIAPage.jsx`.

**Impacto:**

Moedas diferentes não são total consolidado.

**Recomendação:**

Renomear para “Custos por moeda” ou converter com taxa explícita.

**Testes de validação recomendados:**

UI não chama BRL+USD de consolidado.


### MIA-009 — Sem drilldown

**Severidade:** `P2`

**Diagnóstico:**

Cards de erro/custo/falha não abrem os casos que compõem a métrica.

**Evidência / referência no código:**

KPIs/cards estáticos.

**Impacto:**

Operador não sabe o que investigar.

**Recomendação:**

Clicar em erro/custo alto abre drawer/lista de casos.

**Testes de validação recomendados:**

Card Erros IA mostra casos com aiError.


### 4.15.5 Direção de design recomendada

Reorganizar como Console de Observabilidade de IA: saúde, custo/orçamento, provedores, qualidade, intervenção humana e drilldown de casos.

### 4.15.6 Prioridades de correção

- P1: permissão própria, recorte/agregado, aiExecutedAt, chamadas/erros/custo.
- P2: orçamento, drilldown, qualidade, testes.
- P3: título, ícones, estética observabilidade.

### 4.15.7 Veredito

Útil, mas ainda não confiável como métrica operacional consolidada. Precisa de ledger/agregados reais.

---

## 16. Portal Operacional — Relatórios Públicos

**Rota:** `/ops/relatorios`

### 4.16.1 Função da página

Painel operacional para listar, auditar, abrir/copiar e revogar relatórios públicos gerados.

### 4.16.2 Arquivos principais

- `src/portals/ops/RelatoriosPage.jsx`
- `src/pages/PublicReportPage.jsx`
- `src/core/firebase/firestoreService.js`
- `functions/index.js`
- `firestore.rules`

### 4.16.3 O que a página faz bem

- Rota operacional existe.
- Lista publicReports.
- Permite localizar tokens/relatórios.
- Conecta operação com a superfície pública `/r/:token`.

### 4.16.4 Achados, riscos e recomendações

### REL-OPS-001 — Permissão deveria ser própria, não AUDIT_VIEW

**Severidade:** `P1`

**Diagnóstico:**

Gerenciar links públicos não é apenas ver auditoria.

**Evidência / referência no código:**

Rota/Sidebar usam permissão operacional ampla.

**Impacto:**

Analista pode ter acesso indevido a publicação externa.

**Recomendação:**

Criar `REPORT_PUBLIC_VIEW/REVOKE/MANAGE`.

**Testes de validação recomendados:**

Sem permissão específica, rota/ação de revogar bloqueia.


### REL-OPS-002 — Revogação precisa ser server-side e auditada

**Severidade:** `P0`

**Diagnóstico:**

Revogar relatório público por update direto do frontend enfraquece RBAC/auditoria.

**Evidência / referência no código:**

Fluxo de `revokePublicReport`/RelatoriosPage conforme auditoria anterior.

**Impacto:**

Não há garantia de quem revogou, motivo, IP e tenant.

**Recomendação:**

Cloud Function `revokePublicReport({token, reason})` valida permissão, tenant/case, grava revokedAt/by/reason e audit log.

**Testes de validação recomendados:**

Revogar cria auditLogs e muda active=false.


### REL-OPS-003 — candidateName pode ser lido no caminho errado

**Severidade:** `P1`

**Diagnóstico:**

Se tela usa `meta.candidateName`, mas doc persiste `candidateName` top-level, candidato aparece vazio.

**Evidência / referência no código:**

Shape `publicReports` e leitura em RelatoriosPage.

**Impacto:**

Busca/renderização falham.

**Recomendação:**

Helper `getReportCandidateName(report)` com fallback top-level/meta/snapshot.

**Testes de validação recomendados:**

candidateName top-level é exibido e buscável.


### REL-OPS-004 — Relatório gerado por analista precisa usar tenant do case

**Severidade:** `P0`

**Diagnóstico:**

Se usar tenant do perfil/meta, relatório pode ficar sem tenant correto.

**Evidência / referência no código:**

Fluxo `createAnalystPublicReport` e `CasoPage`.

**Impacto:**

Relatório some de filtros ou aparece errado.

**Recomendação:**

Buscar case e usar `caseData.tenantId` como fonte canônica.

**Testes de validação recomendados:**

Analista global gera relatório e publicReport tenantId = case tenant.


### REL-OPS-005 — Revogado pode continuar abrindo

**Severidade:** `P0`

**Diagnóstico:**

Se `PublicReportPage` não bloqueia `active=false`, ops autenticado pode ver conteúdo como ativo.

**Evidência / referência no código:**

Rules permitem ops ler; PublicReportPage precisa validar active.

**Impacto:**

Tabela diz revogado mas página parece ativa.

**Recomendação:**

PublicReportPage bloqueia active=false e mostra estado revogado; preview admin separado.

**Testes de validação recomendados:**

active=false nunca renderiza relatório normal.


### REL-OPS-006 — Relatório ativo de caso reaberto/fora de DONE

**Severidade:** `P0`

**Diagnóstico:**

Relatório antigo pode continuar ativo quando caso volta à correção.

**Evidência / referência no código:**

Ciclo publicReport/case status.

**Impacto:**

Exposição externa de resultado obsoleto.

**Recomendação:**

Detectar status != DONE, alertar e revogar automaticamente/CTA revogar.

**Testes de validação recomendados:**

Relatório ativo + case CORRECTION_NEEDED aparece como obsoleto crítico.


### REL-OPS-007 — Falta tenant, origem, criado/revogado por

**Severidade:** `P2`

**Diagnóstico:**

Tabela precisa mostrar rastreabilidade operacional.

**Evidência / referência no código:**

Campos publicReports/auditLogs relacionados.

**Impacto:**

Suporte não sabe dono/origem do link.

**Recomendação:**

Mostrar tenant, createdBy/source, revokedBy/revokedAt; drawer de detalhe.

**Testes de validação recomendados:**

Linha global mostra tenant e origem.


### 4.16.5 Direção de design recomendada

Reposicionar como Central Operacional de Publicação Externa, com cards Ativos/Expirados/Revogados/Obsoletos/Expiram em breve, filtros por tenant/status/período e drawer de detalhe.

### 4.16.6 Prioridades de correção

- P0: revogação backend, tenant do case, active=false, case != DONE.
- P1: permissões próprias, candidateName, auditoria.
- P2: drawer, tenant/origem, paginação.
- P3: mobile cards e microcopy de risco.

### 4.16.7 Veredito

Muito sensível porque controla links externos. Deve ser tratada como painel de publicação externa, não tabela de tokens.

---

## 17. Portal Operacional — Saúde das APIs / Provedores

**Rota:** `/ops/saude`

### 4.17.1 Função da página

Tela de observabilidade do circuit breaker e saúde dos provedores externos do pipeline.

### 4.17.2 Arquivos principais

- `src/portals/ops/SaudePage.jsx`
- `functions/helpers/circuitBreaker.js`
- `functions/index.js`
- `src/core/firebase/firestoreService.js`

### 4.17.3 O que a página faz bem

- Chama backend `getSystemHealth`.
- Mostra provedores conhecidos.
- Exibe falhas, último sucesso/falha, bloqueio e erro.
- Tem botão Atualizar e modo demo.

### 4.17.4 Achados, riscos e recomendações

### SAUDE-001 — Sem telemetria aparece saudável

**Severidade:** `P1`

**Diagnóstico:**

Provider ausente em `providers` vira objeto só com id e status healthy.

**Evidência / referência no código:**

`SaudePage.jsx`: `KNOWN_PROVIDERS.map(id => ({ id, ...(providers[id] || {}) }))`; `getStatus` retorna healthy por default.

**Impacto:**

Ausência de dado é mostrada como saúde.

**Recomendação:**

Criar status `SEM_DADOS`/`UNKNOWN`.

**Testes de validação recomendados:**

providers={} mostra Judit sem dados, não saudável.


### SAUDE-002 — Texto promete tempo real sem polling/listener

**Severidade:** `P1`

**Diagnóstico:**

A tela carrega no mount e botão atualizar, mas diz status em tempo real.

**Evidência / referência no código:**

`SaudePage.jsx`: `useEffect(() => load(), [load])`.

**Impacto:**

Promessa de atualização automática é falsa.

**Recomendação:**

Corrigir texto ou implementar polling/onSnapshot.

**Testes de validação recomendados:**

Sem polling, texto não contém “tempo real”.


### SAUDE-003 — recordSuccess/recordFailure podem não ser aguardados

**Severidade:** `P1`

**Diagnóstico:**

Se telemetria é gravada sem await, Cloud Function pode terminar antes de persistir `systemHealth`.

**Evidência / referência no código:**

Chamadas a helpers de circuit breaker no backend.

**Impacto:**

SaudePage mostra dados atrasados/falsos.

**Recomendação:**

Aguardar gravação ou usar fila/ledger confiável.

**Testes de validação recomendados:**

Falha de provider incrementa failCount antes da função finalizar.


### SAUDE-004 — Sem status stale/desatualizado

**Severidade:** `P1`

**Diagnóstico:**

Último sucesso antigo com failCount 0 vira saudável.

**Evidência / referência no código:**

`getStatus` considera apenas disabledUntil e failCount.

**Impacto:**

Telemetria velha parece saúde atual.

**Recomendação:**

Criar status “Desatualizado” por idade da última atualização.

**Testes de validação recomendados:**

lastSuccess 10 dias atrás = Desatualizado.


### SAUDE-005 — lastError pode expor mensagem bruta

**Severidade:** `P1`

**Diagnóstico:**

Tela renderiza `Último erro: {p.lastError}` para todos com acesso.

**Evidência / referência no código:**

`SaudePage.jsx` card error.

**Impacto:**

Pode expor URL, payload, credencial indireta ou erro interno.

**Recomendação:**

Separar código/mensagem segura/detalhe raw só admin.

**Testes de validação recomendados:**

Supervisor vê mensagem resumida; admin pode abrir detalhe.


### SAUDE-006 — Não mostra impacto operacional

**Severidade:** `P2`

**Diagnóstico:**

Card não explica o que Judit/OpenAI/BDC afetam no pipeline.

**Evidência / referência no código:**

Cards atuais mostram só status técnico.

**Impacto:**

Operador não sabe se um provedor degradado bloqueia mandados, IA, DJEN etc.

**Recomendação:**

Adicionar bloco Impacto por provedor.

**Testes de validação recomendados:**

Card Judit mostra processos/mandados/DJEN/Escavador afetados.


### SAUDE-007 — Não diferencia circuito aberto de indisponível

**Severidade:** `P2`

**Diagnóstico:**

disabledUntil futuro vira `down`, sem explicar circuit breaker.

**Evidência / referência no código:**

`getStatus`.

**Impacto:**

Perde semântica de proteção temporária.

**Recomendação:**

Status: Circuito aberto, Degradado, Indisponível, Sem dados, Desatualizado, Saudável.

**Testes de validação recomendados:**

disabledUntil futuro mostra “Circuito aberto” e tempo restante.


### 4.17.5 Direção de design recomendada

Transformar em Console de Observabilidade do Pipeline: resumo geral, alertas críticos, cards por provedor com impacto, última atualização, eventos recentes e ações restritas.

### 4.17.6 Prioridades de correção

- P1: sem dados, tempo real, telemetria confiável, stale, lastError.
- P2: impacto, circuito aberto, timeline e testes.
- P3: design status room e ícones consistentes.

### 4.17.7 Veredito

Útil como painel básico, mas precisa tratar ausência/idade de telemetria e impacto para virar observabilidade confiável.

---

## 18. Página Pública do Relatório

**Rota:** `/r/:token`

### 4.18.1 Função da página

Superfície pública externa do produto: link anônimo/externo para visualizar relatório de due diligence. É a página de maior risco e maior valor institucional.

### 4.18.2 Arquivos principais

- `src/pages/PublicReportPage.jsx`
- `src/pages/PublicReportPage.css`
- `src/core/reportBuilder.js`
- `functions/reportBuilder.cjs`
- `functions/index.js`
- `firestore.rules`
- `publicReports/{token}`
- `cases/{caseId}/publicResult/latest`

### 4.18.3 O que a página faz bem

- Usa token público, não caseId.
- Documentos têm active e expiresAt.
- Rules públicas exigem active e expiração para anônimo.
- Renderização isolada em iframe srcDoc com sandbox.
- Há sanitização/remoção de conteúdo ativo.
- Separada dos portais autenticados.

### 4.18.4 Achados, riscos e recomendações

### PUB-001 — Relatório antigo pode continuar ativo quando caso volta para correção

**Severidade:** `P0`

**Diagnóstico:**

Quando caso sai de DONE para CORRECTION_NEEDED/PENDING, link antigo pode continuar ativo se não for revogado automaticamente.

**Evidência / referência no código:**

Fluxos `returnCaseToClient`, `submitClientCorrection`, `publicReports`, `publicResult/latest`.

**Impacto:**

Exposição externa de relatório final obsoleto enquanto caso está em reanálise.

**Recomendação:**

Ao sair de DONE: active=false, revokedAt/by/reason, limpar publicReportToken, reportReady=false, publicResult em revisão e audit log.

**Testes de validação recomendados:**

Caso DONE gera link; returnCaseToClient; `/r/:token` mostra indisponível/revogado.


### PUB-002 — PublicReportPage deve bloquear `active=false` sempre

**Severidade:** `P0`

**Diagnóstico:**

Mesmo que Rules permitam ops ler docs, a página não pode renderizar revogado como relatório ativo.

**Evidência / referência no código:**

`PublicReportPage.jsx` validações de token/report.

**Impacto:**

Revogado parece válido para usuário autenticado ou em preview.

**Recomendação:**

Antes de renderizar HTML, se active=false mostrar tela de revogado. Preview admin separado e sinalizado.

**Testes de validação recomendados:**

active=false nunca renderiza conteúdo normal.


### PUB-003 — Deve bloquear se case.status atual não for DONE

**Severidade:** `P0`

**Diagnóstico:**

Token ativo e não expirado não basta; relatório só vale se caso vinculado continua finalizado.

**Evidência / referência no código:**

publicReports contém caseId/tenantId; case atual pode mudar.

**Impacto:**

Relatório público diverge do estado atual do caso.

**Recomendação:**

Backend/endpoint deve validar case.status DONE e tenantId consistente.

**Testes de validação recomendados:**

case.status=CORRECTION_NEEDED + active report → página mostra “em revisão”.


### PUB-004 — HTML salvo não deve ser a fonte canônica principal

**Severidade:** `P1`

**Diagnóstico:**

Hoje o relatório público é HTML compartilhável renderizado via iframe. Isso dificulta versionamento, auditoria e segurança.

**Evidência / referência no código:**

`publicReports/{token}` com HTML; `PublicReportPage.jsx` iframe srcDoc.

**Impacto:**

Layout/conteúdo podem divergir, sanitização vira última linha de defesa.

**Recomendação:**

Persistir `publicResultSnapshot` canônico JSON, `reportVersion` e `hash`; renderizar com `ReportRenderer` React. HTML apenas cache/snapshot opcional.

**Testes de validação recomendados:**

Com snapshot canônico, página renderiza sem depender de HTML livre.


### PUB-005 — Abertura pública não é auditada

**Severidade:** `P1`

**Diagnóstico:**

Leitura pública direta pelo Firestore/cliente não registra visualização.

**Evidência / referência no código:**

Fluxo `/r/:token` atual.

**Impacto:**

Não há rastreabilidade de acesso externo ao link.

**Recomendação:**

Criar endpoint/callable `getPublicReportByToken` que valida e registra `PUBLIC_REPORT_VIEWED` com IP mascarado/user-agent resumido.

**Testes de validação recomendados:**

Abrir link válido cria evento auditável.


### PUB-006 — TTL precisa ser centralizado e visível

**Severidade:** `P1`

**Diagnóstico:**

Políticas diferentes apareceram ao longo do projeto. A página deve mostrar validade claramente.

**Evidência / referência no código:**

Criação de publicReports e expiresAt.

**Impacto:**

Usuário não sabe até quando o link vale.

**Recomendação:**

Constante/config `PUBLIC_REPORT_TTL_DAYS` única ou por tenant; exibir data no topo.

**Testes de validação recomendados:**

create client/ops usam mesma TTL; topo mostra validade.


### PUB-007 — Estados públicos precisam mensagens específicas

**Severidade:** `P1`

**Diagnóstico:**

Token não encontrado, expirado, revogado, caso em revisão, erro temporário e token inválido não podem ter erro genérico.

**Evidência / referência no código:**

Tratamento de erro em `PublicReportPage.jsx`.

**Impacto:**

Usuário externo perde confiança ou recebe detalhe técnico.

**Recomendação:**

Criar estados públicos institucionais com mensagens claras sem stack trace.

**Testes de validação recomendados:**

Cada estado técnico mapeia para tela específica.


### PUB-008 — Mobile deve ser cenário principal

**Severidade:** `P1`

**Diagnóstico:**

Link será aberto por WhatsApp/e-mail/celular. Tabelas e metadados precisam virar cards/listas.

**Evidência / referência no código:**

`PublicReportPage.css` e report HTML/renderer.

**Impacto:**

Scroll horizontal ou cortes quebram experiência externa.

**Recomendação:**

Header compacto, veredito em card, achados em acordeões, botões 44px, sem overflow.

**Testes de validação recomendados:**

Viewport iPhone sem scroll horizontal e sem cortar tokens/tabelas.


### PUB-009 — Impressão/PDF não é primeira classe

**Severidade:** `P2`

**Diagnóstico:**

Relatório será salvo/imprimido. Sem CSS print, iframe pode cortar e botões podem sair no PDF.

**Evidência / referência no código:**

`PublicReportPage.css` e HTML do relatório.

**Impacto:**

PDF ruim prejudica entrega oficial.

**Recomendação:**

Adicionar `@media print`, page breaks, rodapé, ocultar ações; futuro PDF server-side.

**Testes de validação recomendados:**

Print preview contém título, veredito, validade, rodapé e sem botões.


### PUB-010 — Falta verificação de autenticidade

**Severidade:** `P2`

**Diagnóstico:**

Página pública deveria exibir ID/token parcial, versão, validade e hash do snapshot.

**Evidência / referência no código:**

publicReports e reportBuilder.

**Impacto:**

PDF/print perde verificabilidade.

**Recomendação:**

Adicionar bloco de verificação: ID, token parcial, emissão, validade, versão, hash.

**Testes de validação recomendados:**

Todo relatório ativo mostra bloco de verificação.


### 4.18.5 Direção de design recomendada

A página deve ser um documento técnico público verificável: topo institucional com status/validade, bloco de identificação, decisão, fontes/cobertura, achados, rastreabilidade e rodapé de confidencialidade. Deve compartilhar `ReportRenderer` com páginas internas, mas com casca pública e regras públicas.

### 4.18.6 Prioridades de correção

- P0: revogar ao sair de DONE; bloquear active=false; bloquear case.status != DONE; revogação backend/auditada.
- P1: TTL central, snapshot canônico, auditoria de abertura, estados públicos e mobile.
- P2: print/PDF, hash/autenticidade, versão e métricas de abertura.

### 4.18.7 Veredito

É a superfície que o mundo externo entende como verdade oficial do dossiê. Antes do design fino, corrigir ciclo de vida: DONE gera; saiu de DONE revoga; active=false/expirado/case != DONE nunca renderiza como final.

---

## 19. Decisão Arquitetural — Página Interna de Relatório/Dossiê

**Rota:** `/client/relatorio/:caseId e /ops/relatorio/:caseId (proposto)`

### 4.19.1 Função da página

Decisão tomada ao final da análise: manter o drawer lateral como prévia rápida e criar uma página interna de relatório/dossiê dentro do sistema, visualmente alinhada à página pública, mas com regras autenticadas e ações internas.

### 4.19.2 Arquivos principais

- `src/portals/client/SolicitacoesPage.jsx`
- `src/pages/PublicReportPage.jsx`
- `src/core/reportBuilder.js`
- `novo: src/pages/ReportRenderer.jsx`
- `novo: src/portals/client/ClientReportPage.jsx`
- `novo: src/portals/ops/OpsReportPage.jsx`

### 4.19.3 O que a página faz bem

- Drawer atual é útil como prévia.
- Página pública já define direção visual do relatório.
- Relatórios internos podem usar caseId e permissão/tenant, sem token público.
- Reuso de renderer reduz divergência entre público, cliente e ops.

### 4.19.4 Achados, riscos e recomendações

### ADR-REL-001 — Criar `ReportRenderer` compartilhado

**Severidade:** `P1`

**Diagnóstico:**

O conteúdo do relatório não deve ser duplicado em drawer, página interna e pública.

**Evidência / referência no código:**

Hoje há reportBuilder/PublicReportPage e drawer em Solicitações.

**Impacto:**

Divergência visual e de conteúdo entre versões.

**Recomendação:**

Criar componente base `ReportRenderer({ mode, snapshot, actions })`.

**Testes de validação recomendados:**

Public, client e ops renderizam o mesmo snapshot com cascas diferentes.


### ADR-REL-002 — Drawer continua como prévia, não como relatório final

**Severidade:** `P1`

**Diagnóstico:**

Drawer é rápido, mas estreito e inadequado para dossiê completo.

**Evidência / referência no código:**

`SolicitacoesPage` abre `Drawer` ao selecionar candidato.

**Impacto:**

Experiência menos premium e pior para mobile/impressão.

**Recomendação:**

Drawer mostra resumo e CTA “Abrir relatório completo”.

**Testes de validação recomendados:**

Clique no candidato abre drawer; CTA navega para página interna.


### ADR-REL-003 — Página interna usa caseId, página pública usa token

**Severidade:** `P1`

**Diagnóstico:**

Usuário autenticado deve abrir por permissão/tenant; link externo deve abrir por token/TTL/revogação.

**Evidência / referência no código:**

Fluxos `/client/solicitacoes` e `/r/:token`.

**Impacto:**

Misturar token público na UX interna confunde expiração e compartilhamento.

**Recomendação:**

Criar `/client/relatorio/:caseId`; `/ops/relatorio/:caseId`; manter `/r/:token` só público.

**Testes de validação recomendados:**

Usuário cliente sem tenant do case recebe acesso negado; token público respeita TTL.


### ADR-REL-004 — OpsReportPage deve ter painel técnico adicional

**Severidade:** `P2`

**Diagnóstico:**

Ops precisa ver fontes, auditoria, IA e estado de publicação; público não deve ver isso.

**Evidência / referência no código:**

CasoPage já concentra dados técnicos.

**Impacto:**

Relatório interno ops pode virar uma página de verificação e suporte.

**Recomendação:**

Ops report com abas: Relatório, Fontes, Auditoria, Publicação.

**Testes de validação recomendados:**

Analista abre relatório interno e vê estado do publicReport e auditoria relacionada.


### 4.19.5 Direção de design recomendada

Arquitetura visual de três níveis: Drawer = preview rápido; Página interna = dossiê autenticado completo; Página pública = versão externa verificável. Todas compartilham o mesmo renderer/payload canônico para evitar divergência.

### 4.19.6 Prioridades de correção

- P1: criar ReportRenderer e ClientReportPage.
- P1: mover CTA do drawer para página interna.
- P1: manter `/r/:token` apenas para compartilhamento externo.
- P2: OpsReportPage com auditoria/fontes/publicação.
- P3: PDF/print comum para renderer.

### 4.19.7 Veredito

Decisão correta para um SaaS premium de compliance. O drawer continua útil, mas o relatório oficial precisa de página própria.

---

# 5. Backlog consolidado P0/P1

## 5.1 P0 — Bloqueadores críticos

- Relatório público antigo não pode continuar ativo quando caso volta para correção.
- `PublicReportPage` deve bloquear `active=false` e `case.status != DONE`.
- Revogação de relatório público deve ser backend + audit log.
- Relatório público gerado por analista deve usar `tenantId` do case.
- Assunção de caso deve validar tenant, estado, assignee e usuário ativo no backend.
- `createOpsClientUser` deve validar permissão backend, não apenas role operacional.
- Firestore Rules devem bloquear escrita direta em `userProfiles` por cliente/analyst web.
- `updateTenantSettingsByAnalyst` deve validar permissão backend, tenantId existente e schema.
- Erro ao carregar Tenant Settings não pode permitir salvar defaults.

## 5.2 P1 — Produção segura

- Criar permissões específicas para: métricas IA, saúde providers, relatórios públicos, audit sensitive.
- Substituir senha provisória exposta por convite/reset ou fluxo oculto/copiável sem toast.
- Paginação/agregados ou avisos de recorte em telas com filtros locais.
- Auditoria deve mostrar actor, alvo, tenant, source e level.
- Criar página interna de relatório/dossiê.
- Criar `ReportRenderer` canônico.
- Criar ledger/agregados de IA e provedores.
- Corrigir enum de risco `RED/HIGH`.
- Corrigir score ausente e campos ausentes que quebram telas.

---

# 6. Recomendação final de arquitetura de relatório

## 6.1 Camadas recomendadas

```txt
Drawer de Solicitações
  finalidade: prévia rápida
  entrada: selectedCase
  ações: abrir relatório completo, copiar link se existir

ClientReportPage
  rota: /client/relatorio/:caseId
  finalidade: leitura completa autenticada pelo cliente
  entrada: caseId + tenant permission
  ações: gerar/copiar link público, imprimir, ver status

OpsReportPage
  rota: /ops/relatorio/:caseId
  finalidade: relatório interno técnico + suporte
  entrada: caseId + ops permission
  ações: revisar fontes, ver auditoria, gerar/revogar público

PublicReportPage
  rota: /r/:token
  finalidade: publicação externa
  entrada: token público
  regras: active, expiresAt, case.status DONE, auditoria de view
```

## 6.2 Componente base

```txt
ReportRenderer
  props:
    mode: public | client | ops | print
    snapshot: publicResultSnapshot
    statusContext
    actions
```

## 6.3 Regra de ouro

```txt
O conteúdo do relatório deve vir de um snapshot canônico versionado,
não de HTML livre como fonte primária.
```

---

# 7. Checklist de aceite para a próxima rodada de implementação

- [ ] Nenhuma Cloud Function sensível depende apenas de proteção frontend.
- [ ] Página pública não renderiza relatório revogado, expirado ou de caso não DONE.
- [ ] Relatórios públicos são revogados automaticamente quando caso sai de DONE.
- [ ] Relatório interno existe e usa renderer compartilhado.
- [ ] Drawer de Solicitações vira prévia com CTA para relatório completo.
- [ ] Auditoria operacional tem tenant, actor, target, source, level e drawer.
- [ ] Métricas IA usam ledger/agregados ou avisam claramente o recorte.
- [ ] Saúde APIs tem Sem Dados, Stale e Circuito Aberto.
- [ ] Configurações do Tenant validam schema no backend.
- [ ] Gestão de Clientes representa tenants, não apenas usuários.
- [ ] Todas as telas críticas têm testes específicos.
- [ ] Microcopy PT-BR revisada.
- [ ] Mobile da página pública e relatório interno validado.
- [ ] Print/PDF validado.

---

# 8. Conclusão executiva

O ComplianceHub já possui boa base funcional: portais separados, tenant context, coleção sanitizada para cliente, pipeline de provedores, auditoria, public reports, quota, IA e telas operacionais. O principal salto agora é transformar a aplicação de um MVP funcional em um produto premium de compliance.

As prioridades não devem começar por estética fina. A ordem correta é:

```txt
1. Segurança e tenant isolation.
2. Ciclo de vida do relatório público.
3. Fonte canônica do relatório.
4. Auditoria e rastreabilidade.
5. Páginas internas de relatório.
6. Observabilidade e agregados reais.
7. Design premium, mobile e PDF.
```

A decisão mais importante tomada nesta revisão é correta:

```txt
Drawer = prévia.
Página interna = relatório completo autenticado.
/r/:token = publicação externa verificável.
```

Essa arquitetura preserva velocidade de uso, aumenta confiança institucional e reduz o risco de divergência entre o que o cliente vê dentro do sistema e o que terceiros recebem por link público.
