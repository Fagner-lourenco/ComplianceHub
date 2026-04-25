# Auditoria Forense Completa do ComplianceHub

Data da auditoria: 2026-04-05.  
Escopo: frontend React/Vite, Cloud Functions Firebase, Firestore, RBAC, multi-tenant, providers, IA, portal operacional, portal cliente, publicacao de resultados e relatorios publicos.

## 1. Inventario do sistema auditado

Paginas e rotas reais:
- Portal cliente em `src/App.jsx`: `/client/dashboard`, `/client/solicitacoes`, `/client/nova-solicitacao`, `/client/exportacoes`, `/client/equipe`, `/client/perfil`.
- Portal operacional em `src/App.jsx`: `/ops/fila`, `/ops/caso/:caseId`, `/ops/casos`, `/ops/clientes`, `/ops/auditoria`, `/ops/metricas-ia`, `/ops/relatorios`, `/ops/saude`, `/ops/perfil`.
- Relatorio publico em `src/App.jsx`: `/r/:token` e demo `/demo/r/:caseId`.
- Superficies criticas revisadas: `CasoPage`, `FilaPage`, `CasosPage`, `ClientesPage`, `MetricasIAPage`, `RelatoriosPage`, `SaudePage`, `SolicitacoesPage`, `NovaSolicitacaoPage`, `DashboardClientePage`, `ExportacoesPage`, `EquipePage`, `PerfilPage`, `PublicReportPage`.

Funcoes e fluxos backend criticos:
- Solicitacao/correcao: `createClientSolicitation`, `submitClientCorrection`.
- Enriquecimento: `enrichJuditOnCase`, `enrichJuditOnCorrection`, `enrichEscavadorOnCase`, `juditWebhook`, `juditAsyncFallback`, `rerunEnrichmentPhase`, `rerunAiAnalysis`.
- IA: `runAiAnalysisAndPersist`, `setAiDecisionByAnalyst`, cache `cases/{caseId}/aiCache`.
- Conclusao/publicacao: `concludeCaseByAnalyst`, `publishResultOnCaseDone`, `syncClientCaseOnCreate/Update/Delete`, `createAnalystPublicReport`, `createClientPublicReport`.
- Gestao de usuarios: `createOpsClientUser`, `listTenantUsers`, `createTenantUser`, `updateTenantUser`, `updateOwnProfile`.
- Observabilidade: `getSystemHealth`, `functions/helpers/circuitBreaker.js`.

Colecoes e contratos:
- `cases`: documento canonico operacional.
- `clientCases`: espelho sanitizado para cliente.
- `cases/{caseId}/publicResult/latest`: resultado final sanitizado.
- `publicReports/{token}`: HTML compartilhavel com `expiresAt`, `active`, `tenantId`, `caseId`, `candidateName`.
- `tenantSettings`, `userProfiles`, `auditLogs`, `exports`, `systemHealth`.

Validacoes executadas:
- `npm run build`: passou.
- `npm test -- --run`: passou com `16` arquivos e `51` testes.
- `npm run lint`: falhou com `95` erros. Parte e configuracao ESLint para Node ausente em `functions`, mas tambem revelou erros funcionais reais: `DEFAULT_ANALYSIS_CONFIG` indefinido em `functions/index.js` e `setDoc` indefinido em `src/core/firebase/firestoreService.js`.

## 2. Mapa do fluxo ponta a ponta

- Solicitacao: `NovaSolicitacaoPage` chama `callCreateClientSolicitation`; `createClientSolicitation` cria `candidates/{id}` e `cases/{id}` (`functions/index.js:3348-3431`); `syncClientCaseOnCreate` espelha em `clientCases/{caseId}` (`functions/index.js:2955-2962`).
- Enriquecimento: o caso nasce com enrichment `PENDING` (`functions/index.js:3416-3421`); Judit roda por trigger, pode acionar Escavador, e salva flags, cobertura, divergencia, qualidade de evidencia, IA e custos.
- Revisao operacional: `CasoPage` assina `cases/{caseId}`, mostra providers, IA, cobertura, homonimia, rascunho e conclusao.
- Conclusao: `CasoPage` chama `concludeCaseByAnalyst`; o backend grava flags, score, veredito, `processHighlights`, `warrantFindings`, `keyFindings`, `executiveSummary` e `status = DONE`.
- Publicacao: `publishResultOnCaseDone` grava `publicResult/latest`; `syncClientCaseOnUpdate` grava `clientCases` com merge; relatorio publico grava `publicReports/{token}`.
- Cliente: `SolicitacoesPage` le `clientCases`; se `DONE`, busca `publicResult/latest`; se ha `publicReportToken`, abre `/r/{token}`; se nao, gera HTML no frontend e chama `createClientPublicReport`.
- Expiracao: `publicReports` usa TTL de 14 dias; regras publicas exigem `expiresAt` futuro e `active != false`, exceto para analistas.

## 3. Problemas encontrados

### [AUD-001] `DEFAULT_ANALYSIS_CONFIG` esta indefinido em Cloud Functions
**Severidade:** Critico  
**Area:** backend / onboarding / solicitacao / tenant  
**Onde foi encontrado:** `functions/index.js`, `createOpsClientUser`, `createClientSolicitation`  
**Evidencia concreta:** `npm run lint` acusa `DEFAULT_ANALYSIS_CONFIG is not defined`; o backend define `DEFAULT_ENRICHMENT_CONFIG`, `DEFAULT_ESCAVADOR_CONFIG` e `DEFAULT_JUDIT_CONFIG`, mas nao define `DEFAULT_ANALYSIS_CONFIG` (`functions/index.js:84-115`). O identificador e usado em `functions/index.js:3067`, `functions/index.js:3332` e `functions/index.js:3385`.  
**Descricao detalhada:** criar tenant novo tenta gravar `analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG }` quando `tenantSettings` ainda nao existe. Criar solicitacao tambem usa esse default quando `tenantData.analysisConfig` esta ausente.  
**Contexto funcional:** onboarding de novo tenant e solicitacao de cliente sem configuracao completa.  
**Impacto real:** `createOpsClientUser` pode falhar ao criar tenant novo; `createClientSolicitation` pode falhar para tenant sem `analysisConfig`, bloqueando entrada de casos.  
**Risco de regressao:** Sim, porque definir o default altera quais fases rodam quando o tenant nao tem configuracao.  
**Correcao sugerida:** definir `DEFAULT_ANALYSIS_CONFIG` no backend equivalente ao frontend ou centralizar contrato em modulo compartilhado. Adicionar teste de callable para tenant sem settings.  
**Ordem recomendada:** corrigir agora.

### [AUD-002] Relatorio publico antigo permanece ativo quando um caso volta para correcao
**Severidade:** Critico  
**Area:** relatorio / seguranca / publicacao / fluxo de conclusao  
**Onde foi encontrado:** `functions/index.js`, `src/pages/PublicReportPage.jsx`, `firestore.rules`  
**Evidencia concreta:** `returnCaseToClient` apenas muda `status` para `CORRECTION_NEEDED` e grava motivo/notas (`functions/index.js:3895-3901`). `submitClientCorrection` volta o caso para `PENDING` e limpa parte dos campos, mas nao limpa `publicReportToken`, nao desativa `publicReports` e nao apaga `publicResult/latest` (`functions/index.js:3484-3540`). `publishResultOnCaseDone` so escreve quando `after.status === DONE` (`functions/index.js:2983-3009`). `PublicReportPage` so valida expiracao, nao status atual do caso (`src/pages/PublicReportPage.jsx:80-91`).  
**Descricao detalhada:** depois que um relatorio publico e gerado para um caso `DONE`, se o caso for devolvido para correcao ou reenviado, o link publico antigo continua ativo ate expirar ou ser revogado manualmente.  
**Contexto funcional:** conclusao -> relatorio publico -> devolucao para correcao -> reprocessamento.  
**Impacto real:** terceiros com link podem acessar parecer antigo enquanto o caso esta oficialmente em correcao/reanalise.  
**Risco de regressao:** Sim, pois e preciso preservar historico sem manter publicacao ativa.  
**Correcao sugerida:** ao sair de `DONE`, revogar `publicReports/{publicReportToken}`, limpar `publicReportToken` do caso e do espelho, marcar `reportReady: false`, e sobrescrever/remover `publicResult/latest`. Registrar audit log.  
**Ordem recomendada:** corrigir agora.

### [AUD-003] Cliente pode gerar relatorio publico oficial a partir de HTML enviado pelo proprio cliente
**Severidade:** Critico  
**Area:** seguranca / relatorio / integridade / RBAC  
**Onde foi encontrado:** `src/portals/client/SolicitacoesPage.jsx`, `src/core/firebase/firestoreService.js`, `functions/index.js`  
**Evidencia concreta:** `SolicitacoesPage` gera HTML local e chama `saveClientPublicReport(html, selectedCase.id)` (`src/portals/client/SolicitacoesPage.jsx:131-132`). `saveClientPublicReport` envia `{ html, caseId }` (`src/core/firebase/firestoreService.js:670-675`). `createClientPublicReport` aceita `rawHtml`, valida tenant/status, sanitiza tags ativas e grava o HTML recebido (`functions/index.js:3693-3749`). `getClientUserProfile` permite `CLIENT_VIEW_ROLES`, incluindo `client_viewer` (`functions/index.js:4184`, `functions/index.js:4202`).  
**Descricao detalhada:** o backend nao reconstroi o relatorio a partir do caso canonico. Um cliente autenticado do mesmo tenant pode chamar a callable com HTML textual alterado e obter um token oficial.  
**Contexto funcional:** cliente abre relatorio quando o caso esta `DONE` e ainda nao existe token.  
**Impacto real:** risco de falsificacao de parecer, score, veredito e narrativa em um link com aparencia oficial.  
**Risco de regressao:** Sim, porque corrigir muda o contrato da callable.  
**Correcao sugerida:** `createClientPublicReport` deve receber apenas `caseId`, buscar `caseData/publicResult` no backend, reconstruir HTML server-side ou armazenar snapshot estruturado assinado.  
**Ordem recomendada:** corrigir agora.

### [AUD-004] `clientCases` pode manter resultado antigo por causa de `merge: true`
**Severidade:** Alto  
**Area:** frontend / backend / clientCases / publicacao  
**Onde foi encontrado:** `functions/index.js`, `src/core/clientPortal.js`, `src/portals/client/SolicitacoesPage.jsx`  
**Evidencia concreta:** quando o caso nao esta `DONE`, `buildClientCasePayload` remove campos de resultado da lista a sincronizar (`functions/index.js:2922-2925`), mas `writeClientCaseMirror` faz `set(..., { merge: true })` (`functions/index.js:2951-2952`). Isso nao deleta campos antigos. A UI monta `selectedCaseView` para qualquer status (`src/core/clientPortal.js:164-181`) e o drawer exibe grade de risco/resumo/apontamentos sem gate geral por `DONE` (`src/portals/client/SolicitacoesPage.jsx:179-186`).  
**Descricao detalhada:** se um caso ja concluido voltar para `CORRECTION_NEEDED` ou `PENDING`, o espelho pode preservar resultado antigo.  
**Contexto funcional:** reabertura de caso ou correcao pelo cliente.  
**Impacto real:** cliente pode ver score/veredito/apontamentos antigos em partes do drawer, mesmo com status nao concluido.  
**Risco de regressao:** Sim. Trocar merge por overwrite pode remover campos auxiliares; precisa de delecoes explicitas ou payload completo.  
**Correcao sugerida:** quando `status !== DONE`, deletar explicitamente campos de resultado no espelho ou substituir o documento `clientCases` por payload completo sanitizado.  
**Ordem recomendada:** corrigir agora.

### [AUD-005] Processos em segredo de justica do Escavador podem entrar no relatorio
**Severidade:** Alto  
**Area:** provider / relatorio / privacidade / normalizer  
**Onde foi encontrado:** `functions/normalizers/escavador.js`, `functions/index.js`, `src/core/reportBuilder.js`  
**Evidencia concreta:** o normalizer do Escavador preserva `segredoJustica` (`functions/normalizers/escavador.js:83`). `buildProcessHighlights` filtra segredo apenas para Judit com `secrecyLevel` (`functions/index.js:3924-3926`), mas no loop do Escavador nao verifica `p.segredoJustica`; inclui processo se criminal ou ativo (`functions/index.js:3940-3955`). O report renderiza numero/classificacao/status (`src/core/reportBuilder.js:108-115`).  
**Descricao detalhada:** a protecao existente para segredo de justica e assimetrica: Judit e filtrado, Escavador nao.  
**Contexto funcional:** Escavador retorna processo criminal/ativo com `segredo_justica`.  
**Impacto real:** risco de expor em relatorio publico dados processuais sensiveis.  
**Risco de regressao:** Sim. Filtrar pode reduzir evidencias visiveis; detalhe deve permanecer interno e virar sumario publico seguro.  
**Correcao sugerida:** excluir `segredoJustica` de `processHighlights` publicos ou renderizar apenas apontamento agregado sem numero/tribunal/classificacao.  
**Ordem recomendada:** corrigir agora.

### [AUD-006] Decisao do analista sobre IA nao e respeitada na publicacao dos apontamentos
**Severidade:** Alto  
**Area:** IA / relatorio / fluxo operacional  
**Onde foi encontrado:** `src/portals/ops/CasoPage.jsx`, `functions/index.js`, `src/core/reportBuilder.js`  
**Evidencia concreta:** `CasoPage` permite marcar a decisao da IA como aceita, ajustada ou ignorada (`src/portals/ops/CasoPage.jsx:1346`, `src/portals/ops/CasoPage.jsx:1353`, `src/portals/ops/CasoPage.jsx:1356`). O backend salva `aiDecision` em `setAiDecisionByAnalyst` (`functions/index.js:4138-4160`). Na conclusao, `buildKeyFindings` inclui `caseData.aiStructured?.evidencias` sem consultar `caseData.aiDecision` (`functions/index.js:3997-4008`). `keyFindings` e campo publicado (`functions/index.js:2881`) e renderizado no relatorio (`src/core/reportBuilder.js:228`).  
**Descricao detalhada:** o analista pode rejeitar a IA na UI, mas evidencias da IA continuam podendo virar apontamentos publicados.  
**Contexto funcional:** revisao operacional de caso com IA estruturada e decisao manual `IGNORED`.  
**Impacto real:** risco de publicar conclusoes que o analista decidiu nao usar, criando incoerencia entre revisao interna e resultado final.  
**Risco de regressao:** Sim, porque alterar a regra pode reduzir conteudo automatico em casos antigos.  
**Correcao sugerida:** `buildKeyFindings` e `buildExecutiveSummary` devem respeitar `aiDecision`; se `IGNORED`, nao usar IA automaticamente; se `ADJUSTED`, exigir versao revisada ou anotacao do analista.  
**Ordem recomendada:** corrigir agora.

### [AUD-007] Tela de equipe do cliente le formato de resposta errado e tende a listar zero usuarios
**Severidade:** Alto  
**Area:** frontend / RBAC / gestao de usuarios  
**Onde foi encontrado:** `src/portals/client/EquipePage.jsx`, `src/core/firebase/firestoreService.js`  
**Evidencia concreta:** `callBackendFunction` retorna diretamente `result.data` (`src/core/firebase/firestoreService.js:724-729`). `callListTenantUsers` retorna esse valor (`src/core/firebase/firestoreService.js:748-749`). `EquipePage` tenta ler `res?.data?.users` (`src/portals/client/EquipePage.jsx:50-51`), mas a callable `listTenantUsers` retorna `{ users }` no nivel raiz.  
**Descricao detalhada:** a tela espera uma camada `data` que o service ja removeu.  
**Contexto funcional:** gestor do cliente abre `/client/equipe`.  
**Impacto real:** a lista de usuarios aparece vazia mesmo quando o backend retornou usuarios corretamente. Isso quebra administracao de tenant pelo cliente.  
**Risco de regressao:** Baixo. A mudanca e local e deve trocar para `res?.users ?? []`.  
**Correcao sugerida:** ajustar `EquipePage` para consumir `res.users`; adicionar teste de tela com mock de `callListTenantUsers`.  
**Ordem recomendada:** corrigir agora.

### [AUD-008] Permissao de UI para usuario legado `CLIENT` nao bate com autorizacao server-side de gestao de equipe
**Severidade:** Medio  
**Area:** RBAC / frontend / backend / tenant  
**Onde foi encontrado:** `src/core/rbac/permissions.js`, `src/App.jsx`, `src/ui/layouts/Sidebar.jsx`, `functions/index.js`  
**Evidencia concreta:** `ROLES.LEGACY_CLIENT` tem `PERMISSIONS.USERS_MANAGE` (`src/core/rbac/permissions.js:41-45`). A rota `/client/equipe` exige `USERS_MANAGE` (`src/App.jsx:337-339`) e a sidebar mostra `Equipe` com essa permissao (`src/ui/layouts/Sidebar.jsx:12`). No backend, `listTenantUsers`, `createTenantUser` e `updateTenantUser` exigem `callerProfile.role === 'client_manager'` (`functions/index.js:3101`, `functions/index.js:3134`, `functions/index.js:3189`).  
**Descricao detalhada:** um usuario legado `CLIENT` pode ver a entrada de equipe na UI, mas as callables recusam as acoes.  
**Contexto funcional:** migracao/uso de roles antigos no portal do cliente.  
**Impacto real:** experiencia quebrada e erro de permissao para quem a UI apresentou como autorizado.  
**Risco de regressao:** Medio. Alterar `LEGACY_CLIENT` pode afetar tenants antigos.  
**Correcao sugerida:** alinhar role legado com server-side: ou mapear `CLIENT` para `client_manager` em migracao, ou remover `USERS_MANAGE` da role legada e esconder a UI.  
**Ordem recomendada:** corrigir em seguida.

### [AUD-009] Relatorio publico criado pelo analista perde `tenantId` recebido da UI
**Severidade:** Medio  
**Area:** relatorio / auditoria / tenant / operacional  
**Onde foi encontrado:** `src/portals/ops/CasoPage.jsx`, `functions/index.js`, `src/portals/ops/RelatoriosPage.jsx`, `src/core/firebase/firestoreService.js`  
**Evidencia concreta:** `CasoPage` envia `tenantId` dentro de `meta` ao gerar relatorio (`src/portals/ops/CasoPage.jsx:749`). `sanitizePublicReportMeta` so preserva `type` e `candidateName` (`functions/index.js:4245-4249`). `createAnalystPublicReport` grava `tenantId: profile.tenantId || null` (`functions/index.js:3655`), e o audit log desse relatorio usa `tenantId: null` (`functions/index.js:3670-3677`). `RelatoriosPage` filtra relatorios por tenant (`src/portals/ops/RelatoriosPage.jsx:34`) e `fetchPublicReports` aplica `where('tenantId', '==', tenantId)` (`src/core/firebase/firestoreService.js:618-621`).  
**Descricao detalhada:** para analistas ops que nao tenham `tenantId` no proprio perfil, relatorios criados a partir de casos podem ficar sem tenant mesmo quando a UI tinha o tenant do caso.  
**Contexto funcional:** analista gera link publico a partir de `CasoPage` e depois consulta em `RelatoriosPage`.  
**Impacto real:** relatorios podem sumir de filtros por tenant e logs ficam menos auditaveis.  
**Risco de regressao:** Sim. E preciso validar que o analista tem direito ao case antes de aceitar `caseData.tenantId`.  
**Correcao sugerida:** no backend, buscar o caso quando `caseId` existir e usar `caseData.tenantId` como fonte canonica; registrar audit log com esse tenant.  
**Ordem recomendada:** corrigir em seguida.

### [AUD-010] `RelatoriosPage` busca `candidateName` em `meta`, mas o backend grava no topo do documento
**Severidade:** Medio  
**Area:** frontend / relatorio / operacional  
**Onde foi encontrado:** `src/portals/ops/RelatoriosPage.jsx`, `functions/index.js`  
**Evidencia concreta:** `RelatoriosPage` filtra por `(r.meta?.candidateName || '')` (`src/portals/ops/RelatoriosPage.jsx:44`) e renderiza `report.meta?.candidateName` (`src/portals/ops/RelatoriosPage.jsx:124`). `createAnalystPublicReport` espalha `...meta` no documento, gravando `candidateName` no topo (`functions/index.js:3658`). `createClientPublicReport` tambem grava `candidateName` top-level (`functions/index.js:3748`).  
**Descricao detalhada:** a tela operacional de relatorios le um caminho que nao corresponde ao shape persistido.  
**Contexto funcional:** analista tenta localizar ou revisar relatorios gerados.  
**Impacto real:** coluna de candidato e busca por candidato podem aparecer vazias mesmo com dados gravados.  
**Risco de regressao:** Baixo. Ajuste de leitura pode manter fallback para `report.meta?.candidateName`.  
**Correcao sugerida:** usar `report.candidateName || report.meta?.candidateName`; adicionar teste de renderizacao com documento real de `publicReports`.  
**Ordem recomendada:** corrigir em seguida.

### [AUD-011] Relatorios publicos criados pelo cliente e revogacoes nao entram na auditoria
**Severidade:** Alto  
**Area:** auditoria / relatorio / seguranca  
**Onde foi encontrado:** `functions/index.js`, `src/core/firebase/firestoreService.js`, `src/portals/ops/RelatoriosPage.jsx`  
**Evidencia concreta:** `createAnalystPublicReport` grava `auditLogs` (`functions/index.js:3670-3678`). `createClientPublicReport` cria/reusa `publicReports`, atualiza o caso e retorna token, mas nao grava audit log no trecho auditado (`functions/index.js:3687-3756`). A revogacao operacional chama `revokePublicReport`, que faz apenas `updateDoc(ref, { active: false })` no frontend (`src/core/firebase/firestoreService.js:626-628`), disparado por `RelatoriosPage` (`src/portals/ops/RelatoriosPage.jsx:49-56`).  
**Descricao detalhada:** eventos sensiveis de compartilhamento e revogacao de relatorio nao ficam rastreaveis em `auditLogs`.  
**Contexto funcional:** cliente gera link publico; ops revoga link.  
**Impacto real:** trilha de auditoria incompleta para um artefato sensivel do produto.  
**Risco de regressao:** Medio. A revogacao deve migrar para callable server-side para registrar usuario/tenant de forma confiavel.  
**Correcao sugerida:** criar callable `revokePublicReport` server-side com validacao RBAC e audit log; adicionar audit log em `createClientPublicReport`, inclusive quando reusa token existente.  
**Ordem recomendada:** corrigir agora.

### [AUD-012] `PublicReportPage` nao bloqueia relatorio `active: false` para usuarios autenticados ops
**Severidade:** Medio  
**Area:** seguranca / relatorio / UX operacional  
**Onde foi encontrado:** `firestore.rules`, `src/pages/PublicReportPage.jsx`  
**Evidencia concreta:** as regras permitem leitura de `publicReports` por analista autenticado mesmo sem checar `active`/expiracao, e so exigem `active != false` no ramo publico (`firestore.rules:135-142`). `PublicReportPage` valida expiracao (`src/pages/PublicReportPage.jsx:81-91`), mas nao valida `report.active`.  
**Descricao detalhada:** um relatorio revogado continua abrindo para usuarios ops autenticados se acessarem o token diretamente.  
**Contexto funcional:** ops revoga link e depois abre `/r/{token}` em sessao autenticada.  
**Impacto real:** ambiguidade operacional; a tela nao comunica que o link foi revogado. Para publico anonimo a regra bloqueia, mas para ops o comportamento visual e enganoso.  
**Risco de regressao:** Baixo. Pode-se manter acesso administrativo, mas com estado claro de revogado.  
**Correcao sugerida:** `PublicReportPage` deve tratar `active === false` como revogado, ou renderizar banner administrativo sem exibir como link valido.  
**Ordem recomendada:** corrigir em seguida.

### [AUD-013] Conclusao nao persiste `concludedAt` nem `turnaroundHours`, enfraquecendo timeline e metricas
**Severidade:** Medio  
**Area:** backend / metricas / clientCases / relatorio  
**Onde foi encontrado:** `functions/index.js`, `src/core/clientPortal.js`, `src/core/firebase/firestoreService.js`, `src/portals/ops/MetricasIAPage.jsx`  
**Evidencia concreta:** `CLIENT_CASE_FIELDS` inclui `concludedAt` e `turnaroundHours` (`functions/index.js:2896`, `functions/index.js:2916`), mas `pickConcludePayload` seta `status = 'DONE'` e `updatedAt = FieldValue.serverTimestamp()` sem `concludedAt` ou `turnaroundHours` (`functions/index.js:3813-3825`). `publishResultOnCaseDone` cria `publicData.concludedAt` apenas para `publicResult/latest` (`functions/index.js:3003`). `clientPortal` espera `concludedAt` para timeline e metricas (`src/core/clientPortal.js:117-118`, `src/core/clientPortal.js:152-157`, `src/core/clientPortal.js:272-277`). `mapCaseDocument` formata apenas `createdAt`, nao `updatedAt` (`src/core/firebase/firestoreService.js:117-124`), enquanto `MetricasIAPage` usa `new Date(c.updatedAt)` como fallback (`src/portals/ops/MetricasIAPage.jsx:30-37`).  
**Descricao detalhada:** a data canonica de conclusao nao e gravada no caso principal, e metricas dependem de fallback instavel.  
**Contexto funcional:** dashboard cliente, metricas de IA e timeline de caso concluido.  
**Impacto real:** SLA/tempo medio podem ficar errados, vazios ou dependentes de ultima atualizacao em vez de conclusao real.  
**Risco de regressao:** Medio. Adicionar campos historicos exige cuidado com casos antigos.  
**Correcao sugerida:** gravar `concludedAt` em `concludeCaseByAnalyst`, calcular `turnaroundHours` com base em `createdAt`, formatar `updatedAt/concludedAt` no mapper e fazer backfill progressivo.  
**Ordem recomendada:** corrigir em seguida.

### [AUD-014] Indices declarados nao cobrem consultas novas de `publicReports` e orcamento de IA
**Severidade:** Medio  
**Area:** infraestrutura / Firestore / operacional  
**Onde foi encontrado:** `src/core/firebase/firestoreService.js`, `functions/index.js`, `firestore.indexes.json`  
**Evidencia concreta:** `fetchPublicReports` consulta `publicReports` com `where('tenantId', '==', tenantId)` + `orderBy('createdAt', 'desc')` (`src/core/firebase/firestoreService.js:618-621`). `firestore.indexes.json` declara indices para `cases`, `candidates`, `clientCases`, `auditLogs` e `exports`, mas nao para `publicReports`. O controle de budget de IA consulta `cases` por `tenantId` e `aiExecutedAt >= monthStart` (`functions/index.js:2433-2434`), e tambem nao ha indice declarado para essa combinacao.  
**Descricao detalhada:** consultas compostas usadas por telas/funcoes recentes nao estao refletidas no arquivo de indices.  
**Contexto funcional:** tela operacional de relatorios e limite mensal de IA por tenant.  
**Impacto real:** risco de erro de indice em producao ou dependencia de indices criados manualmente fora do repositorio.  
**Risco de regressao:** Baixo. Adicionar indice e aditivo, mas exige deploy de Firestore indexes.  
**Correcao sugerida:** adicionar indices de `publicReports(tenantId, createdAt desc)` e validar no emulador/console se `cases(tenantId, aiExecutedAt asc)` e necessario para a query de budget.  
**Ordem recomendada:** corrigir em seguida.

### [AUD-015] Status `inactive` do usuario nao e aplicado nas regras Firestore nem no guard de rotas do frontend
**Severidade:** Medio  
**Area:** seguranca / RBAC / tenant  
**Onde foi encontrado:** `functions/index.js`, `firestore.rules`, `src/App.jsx`, `src/core/auth/AuthContext.jsx`  
**Evidencia concreta:** `updateTenantUser` grava `status` e chama `getAuth().updateUser(... disabled: true/false)` (`functions/index.js:3225-3234`). As callables de cliente bloqueiam perfil `inactive` em `getClientUserProfile` (`functions/index.js:4209-4211`). Ja as regras Firestore definem `isClient()` por role e tenant, sem checar `status` (`firestore.rules:32-34`, `firestore.rules:84-90`, `firestore.rules:112-120`). O guard de rota usa `hasPermission(userProfile?.role, permission)`, sem bloquear `status` (`src/App.jsx:258-272`). `AuthContext` carrega `profileData`, incluindo campos do documento, mas nao aplica bloqueio de status no cliente (`src/core/auth/AuthContext.jsx:56-105`).  
**Descricao detalhada:** o backend callable bloqueia inativos, mas leitura direta via Firestore e navegacao do app dependem de Auth desabilitado/refresh de sessao, nao de regra explicita de status.  
**Contexto funcional:** gestor inativa usuario de tenant que ainda tem sessao autenticada aberta.  
**Impacto real:** risco de janela de acesso a dados espelhados ate a sessao/token refletir o disable do Firebase Auth.  
**Risco de regressao:** Medio. Alterar regras exige validar todos os perfis legados.  
**Correcao sugerida:** incluir `status == 'active'` em regras via `userProfiles/{uid}` ou custom claims; bloquear rotas no frontend quando `userProfile.status === 'inactive'`; forcar refresh/logout apos update de status quando aplicavel.  
**Ordem recomendada:** corrigir em seguida.

### [AUD-016] Correcao do cliente atualiza `cases`, mas nao sincroniza `candidates`
**Severidade:** Medio  
**Area:** backend / persistencia / fluxo de correcao  
**Onde foi encontrado:** `functions/index.js`, `src/core/firebase/firestoreService.js`  
**Evidencia concreta:** `createClientSolicitation` cria os dois documentos: `candidates/{id}` e `cases/{id}` (`functions/index.js:3342-3374`). `submitClientCorrection` atualiza apenas `caseRef` dentro do batch (`functions/index.js:3484-3540`). O app ainda possui assinatura/listagem de `candidates` em `subscribeToCandidates` e `fetchCandidates` (`src/core/firebase/firestoreService.js:553-570`).  
**Descricao detalhada:** dados cadastrais corrigidos ficam atualizados no caso, mas o documento canonico/auxiliar de candidato criado na solicitacao inicial permanece antigo.  
**Contexto funcional:** cliente corrige nome/CPF/perfis apos devolucao.  
**Impacto real:** qualquer fluxo futuro ou tela que volte a usar `candidates` vera dados desatualizados.  
**Risco de regressao:** Baixo a medio. E preciso confirmar se `candidates` ainda e fonte operacional ativa ou legado.  
**Correcao sugerida:** se `candidates` continuar no modelo, `submitClientCorrection` deve atualizar `candidates/{candidateId}`; se for legado, remover services/indices/colecao da superficie do produto para reduzir ambiguidade.  
**Ordem recomendada:** corrigir depois, apos decidir a fonte canonica.

### [AUD-017] Formulario de correcao do cliente cobre menos campos que a solicitacao inicial
**Severidade:** Medio  
**Area:** UX / cliente / backend / fluxo de correcao  
**Onde foi encontrado:** `functions/index.js`, `src/portals/client/SolicitacoesPage.jsx`  
**Evidencia concreta:** `createClientSolicitation` aceita e grava `dateOfBirth`, `position`, `department`, `hiringUf`, `email`, `phone`, `digitalProfileNotes`, `socialProfiles` com varias redes e `otherSocialUrls` (`functions/index.js:3311-3320`, `functions/index.js:3354-3366`, `functions/index.js:3376-3398`). `submitClientCorrection` aceita apenas `caseId`, `candidateName`, `cpf`, `linkedin` e `instagram` (`functions/index.js:3458-3460`). A UI de correcao mostra so nome, CPF, LinkedIn e Instagram (`src/portals/client/SolicitacoesPage.jsx:244-280`).  
**Descricao detalhada:** se o erro estiver em cargo, UF, data, email, telefone, outras redes ou observacoes, o cliente nao consegue corrigir pelo fluxo oficial.  
**Contexto funcional:** analista devolve caso para correcao de dados incompletos ou inconsistentes.  
**Impacto real:** retrabalho por canal externo e risco de o caso voltar com informacao ainda incompleta.  
**Risco de regressao:** Medio. Ampliar payload altera o contrato de correcao e reprocessamento.  
**Correcao sugerida:** tornar o motivo de correcao estruturado e permitir campos editaveis por secao, espelhando a solicitacao original; registrar diff da correcao no historico.  
**Ordem recomendada:** corrigir em seguida.

### [AUD-018] Configuracao ESLint mistura browser/module com Cloud Functions CommonJS e mascara erros reais
**Severidade:** Medio  
**Area:** qualidade / CI / backend  
**Onde foi encontrado:** `eslint.config.js`, `functions/index.js`, `src/core/firebase/firestoreService.js`  
**Evidencia concreta:** `eslint.config.js` aplica `globals.browser` e `sourceType: 'module'` para `**/*.{js,jsx}` (`eslint.config.js:10-22`). `npm run lint` falhou com `95` erros, muitos por `require`, `exports`, `module`, `process` e `__dirname` em `functions`, mas tambem capturou erros reais como `DEFAULT_ANALYSIS_CONFIG` indefinido em `functions/index.js` e `setDoc` indefinido em `src/core/firebase/firestoreService.js`.  
**Descricao detalhada:** a configuracao atual cria muito ruido e reduz a confianca no lint como barreira de regressao.  
**Contexto funcional:** validacao tecnica antes de deploy.  
**Impacto real:** erros criticos podem ser ignorados como "ruido de lint", e CI pode ficar impraticavel.  
**Risco de regressao:** Baixo. Separar overrides e uma mudanca de ferramenta, nao de runtime.  
**Correcao sugerida:** adicionar override Node/CommonJS para `functions/**/*.js`; manter `no-undef` ativo; corrigir erros reais restantes.  
**Ordem recomendada:** corrigir agora.

### [AUD-019] `updateTenantSettings` usa `setDoc` sem importar, embora hoje pareca funcao legado nao chamada
**Severidade:** Baixo  
**Area:** frontend / Firebase service / configuracao  
**Onde foi encontrado:** `src/core/firebase/firestoreService.js`  
**Evidencia concreta:** a importacao de Firestore inclui `collection`, `doc`, `getDoc`, `getDocs`, `limit`, `onSnapshot`, `orderBy`, `query`, `serverTimestamp`, `updateDoc` e `where`, mas nao `setDoc` (`src/core/firebase/firestoreService.js:1-13`). `updateTenantSettings` chama `setDoc` (`src/core/firebase/firestoreService.js:399-408`). Busca por `updateTenantSettings(` encontrou apenas a definicao, sem chamada no repo.  
**Descricao detalhada:** a funcao quebraria se fosse reativada, mas atualmente aparenta estar sem uso direto.  
**Contexto funcional:** configuracao de tenant por frontend legado.  
**Impacto real:** baixo no fluxo atual; alto se alguem reutilizar a funcao em nova tela.  
**Risco de regressao:** Baixo. Importar `setDoc` ou remover a funcao e seguro, desde que confirmado sem uso externo.  
**Correcao sugerida:** importar `setDoc` ou remover `updateTenantSettings` em favor da callable `updateTenantSettingsByAnalyst`.  
**Ordem recomendada:** corrigir depois.

### [AUD-020] Nao ha subsistema de notificacoes para eventos criticos de caso e relatorio
**Severidade:** Baixo  
**Area:** notificacoes / cliente / operacao  
**Onde foi encontrado:** `functions/index.js`, `src`  
**Evidencia concreta:** busca por `notification`, `notify`, `sendMail`, `mail` e termos de email dentro de `functions` e `src` encontrou apenas logs/auditoria, autenticacao/reset de senha e campos de email; nao encontrou envio de notificacao para `CASE_RETURNED`, `CASE_CONCLUDED`, `reportReady` ou token de relatorio. Os eventos existem como audit logs (`functions/index.js:3908`, `functions/index.js:4055`) e campo `reportReady` existe no espelho (`functions/index.js:2912`, `functions/index.js:2937`).  
**Descricao detalhada:** o produto registra eventos, mas nao notifica o cliente/operacao quando ha correcao solicitada, conclusao ou relatorio pronto.  
**Contexto funcional:** cliente precisa acompanhar mudancas de status pelo portal.  
**Impacto real:** maior tempo de ciclo e dependencia de acompanhamento manual.  
**Risco de regressao:** Medio. Notificacoes exigem opt-in, templates, controle de tenant e idempotencia.  
**Correcao sugerida:** criar modulo de notificacoes transacionais server-side com eventos `CASE_RETURNED`, `CASE_CONCLUDED`, `PUBLIC_REPORT_CREATED`, preferencias por tenant e audit log de entrega.  
**Ordem recomendada:** corrigir depois.

### [AUD-021] Auditoria responsiva aponta overflow horizontal em telas densas
**Severidade:** Medio  
**Area:** UX / responsividade / portal cliente / portal operacional  
**Onde foi encontrado:** `results/responsive-audit-1.json`, `src/portals/client/SolicitacoesPage.css`, `src/portals/ops/CasoPage.css`  
**Evidencia concreta:** `results/responsive-audit-1.json` registra overflow em `/demo/client/solicitacoes` de `616px` desktop, `1156px` tablet e `1466px` mobile; `/demo/ops/fila` de `112px`, `652px` e `827px`; `/demo/ops/casos` de `205px`, `745px` e `1142px`; `/demo/ops/caso/CASE-002` de `308px` tablet. `SolicitacoesPage.css` usa tabela com wrapper `overflow-x: auto` e tabela `min-width: 1320px` (`src/portals/client/SolicitacoesPage.css:166-173`). `CasoPage.css` tambem tem areas com `overflow-x: auto` (`src/portals/ops/CasoPage.css:56`, `src/portals/ops/CasoPage.css:932`).  
**Descricao detalhada:** ha overflow horizontal intencional em tabelas, mas os numeros da auditoria mostram que em mobile/tablet o deslocamento e grande, especialmente na tela de solicitacoes e filas operacionais.  
**Contexto funcional:** operador/cliente em tablet ou mobile tentando revisar casos e tabelas.  
**Impacto real:** perda de produtividade, botoes/colunas escondidos e leitura cansativa em telas pequenas.  
**Risco de regressao:** Medio. Transformar tabelas em cards responsivos altera densidade e testes visuais.  
**Correcao sugerida:** para mobile/tablet, trocar tabelas principais por cards resumidos com acoes fixas; manter tabela larga apenas no desktop. Priorizar `SolicitacoesPage`, `FilaPage` e `CasosPage`.  
**Ordem recomendada:** corrigir em seguida.

## 4. Incompatibilidades e desalinhamentos estruturais

Backend x frontend:
- `EquipePage` espera `res.data.users`, mas `callBackendFunction` ja retorna `result.data`; impacto direto no modulo de equipe (`AUD-007`).
- `RelatoriosPage` le `report.meta.candidateName`, mas `publicReports` grava `candidateName` no topo (`AUD-010`).
- `updateTenantSettings` frontend chama `setDoc` sem import, mas a configuracao ativa parece ter migrado para callable (`AUD-019`).

UI x persistencia:
- UI permite decisao `IGNORED` para IA, mas persistencia/publicacao continuam usando `aiStructured.evidencias` e `aiStructured.resumo` (`AUD-006`).
- UI de correcao do cliente exibe apenas quatro campos, embora a solicitacao inicial grave muito mais campos relevantes (`AUD-017`).
- Inativacao de usuario existe como `status`, mas guards de rota e regras Firestore nao aplicam esse campo diretamente (`AUD-015`).

Conclusao x publicacao:
- Ao sair de `DONE`, nao ha revogacao automatica de `publicReportToken`, `publicReports` ou `publicResult/latest` (`AUD-002`).
- `clientCases` usa `merge: true` e pode preservar resultado antigo quando o payload novo omite campos por status nao concluido (`AUD-004`).
- `concludeCaseByAnalyst` nao grava `concludedAt` e `turnaroundHours`, embora esses campos estejam previstos no espelho e consumidos por metricas/timeline (`AUD-013`).

Provider x normalizer:
- Escavador preserva `segredoJustica`, mas o builder de `processHighlights` nao filtra esse campo como faz com Judit (`AUD-005`).
- Ha protecao parcial para segredo em Judit (`secrecyLevel`) e ausencia de regra equivalente para Escavador; isso cria assimetria de privacidade entre fontes (`AUD-005`).

IA x relatorio:
- `aiDecision` e salvo mas nao governa `keyFindings` nem `executiveSummary` (`AUD-006`).
- A IA pode gerar evidencias e resumo que entram automaticamente no relatorio sem trilha clara de aceite/ajuste/rejeicao no artefato publico (`AUD-006`).

caseData x clientCases:
- `clientCases` e um espelho sanitizado, mas `merge: true` impede limpeza automatica de campos de resultado antigos (`AUD-004`).
- Campos `concludedAt` e `turnaroundHours` estao previstos para `clientCases`, mas nao nascem no caso principal no momento da conclusao (`AUD-013`).

publicResult x relatorio publico:
- `publicResult/latest` pode ficar ativo/legivel no app enquanto relatorio publico antigo continua disponivel apos reabertura (`AUD-002`).
- `createClientPublicReport` aceita HTML vindo do cliente, em vez de montar o relatorio a partir do snapshot canonico (`AUD-003`).

RBAC x UI:
- `LEGACY_CLIENT` recebe permissao de gestao de usuarios na UI, mas callables exigem exatamente `client_manager` (`AUD-008`).
- Firestore rules protegem por role/tenant, mas nao por `status: inactive` (`AUD-015`).

## 5. Lacunas do relatorio final

- O sistema sabe a decisao do analista sobre a IA (`aiDecision`), mas o relatorio nao respeita essa decisao ao montar `keyFindings` e `executiveSummary` (`AUD-006`).
- O sistema sabe que processos Escavador podem estar em segredo de justica (`segredoJustica`), mas o relatorio publico pode receber esses processos se forem ativos/criminais (`AUD-005`).
- O sistema sabe que um caso deixou de estar `DONE`, mas o relatorio publico antigo nao e revogado automaticamente e pode permanecer acessivel (`AUD-002`).
- O sistema sabe campos ricos da solicitacao inicial, como cargo, departamento, UF, data de nascimento, email, telefone, notas e redes adicionais, mas o fluxo de correcao e pobre e so corrige nome, CPF, LinkedIn e Instagram (`AUD-017`).
- O sistema sabe quando o caso e concluido por transicao de status, mas nao grava `concludedAt`/`turnaroundHours` no caso principal, empobrecendo metricas e timeline (`AUD-013`).
- O sistema sabe que um relatorio foi criado por cliente, mas nao registra esse evento em `auditLogs` (`AUD-011`).
- O cliente consegue gerar um link de relatorio com HTML enviado pelo proprio frontend, quando o correto seria o backend gerar o artefato a partir de `caseData` e `publicResult` (`AUD-003`).
- O relatorio operacional de `RelatoriosPage` pode nao mostrar candidato porque a UI le `meta.candidateName` enquanto o backend grava `candidateName` no topo (`AUD-010`).

## 6. Bugs de UX/UI

- `AUD-007`: tela de equipe tende a mostrar lista vazia por contrato de resposta errado. Impacto: gestor nao consegue administrar usuarios mesmo com permissao correta.
- `AUD-008`: usuario legado `CLIENT` pode ver rota/entrada de equipe que o backend vai negar. Impacto: erro de permissao evitavel e baixa confianca no portal.
- `AUD-017`: correcao do cliente e estreita demais para o formulario original. Impacto: cliente nao corrige varios dados que podem ter causado a pendencia.
- `AUD-021`: auditoria responsiva mostra overflow expressivo nas telas densas. Impacto: uso em tablet/mobile fica muito dependente de scroll horizontal.
- `AUD-012`: relatorio revogado nao e sinalizado como revogado para ops autenticado na pagina publica. Impacto: estado visual pode induzir operador a achar que o link segue valido.
- Achado adicional de qualidade: `npm run lint` sinaliza regra React Compiler em `src/portals/ops/MetricasIAPage.jsx:53` por uso de `Date.now()` durante renderizacao e em `src/ui/components/Drawer/Drawer.jsx:29` por `setActiveTab(0)` em effect. Nao classifiquei como bug funcional porque build e testes passaram, mas vale ajustar junto da limpeza de lint (`AUD-018`).

## 7. Riscos de seguranca / tenant / permissao

- Critico: cliente autenticado pode enviar HTML proprio para criar relatorio publico oficial se o caso for do seu tenant e estiver `DONE` (`AUD-003`).
- Critico: relatorio publico antigo pode continuar ativo apos retorno para correcao/reanalise (`AUD-002`).
- Alto: processos Escavador com `segredoJustica` podem vazar para o relatorio publico (`AUD-005`).
- Alto: criacao de relatorio pelo cliente e revogacao nao deixam trilha completa em `auditLogs` (`AUD-011`).
- Medio: `status: inactive` nao e aplicado diretamente por regras Firestore e guards de rota (`AUD-015`).
- Medio: `LEGACY_CLIENT` tem permissao visual mais ampla do que a autorizacao server-side de gestao de equipe (`AUD-008`).
- Medio: ausencia de indices versionados para consultas novas pode gerar falha operacional em runtime dependendo do ambiente Firestore (`AUD-014`).

## 8. Plano de correcao priorizado

Corrigir agora:
- `AUD-001`: definir `DEFAULT_ANALYSIS_CONFIG` no backend e testar tenant sem settings.
- `AUD-002`: revogar relatorios/publicResult quando caso sai de `DONE`.
- `AUD-003`: mover geracao de relatorio publico do cliente para backend canonico, sem HTML fornecido pelo cliente.
- `AUD-004`: limpar campos de resultado em `clientCases` quando status nao for `DONE`.
- `AUD-005`: filtrar `segredoJustica` do Escavador no builder publico.
- `AUD-006`: respeitar `aiDecision` em `keyFindings` e `executiveSummary`.
- `AUD-007`: corrigir `EquipePage` para ler `res.users`.
- `AUD-011`: auditar criacao/reuso/revogacao de relatorios publicos.
- `AUD-018`: separar ESLint Node/CommonJS para functions e corrigir erros reais.

Corrigir em seguida:
- `AUD-008`: alinhar role legado `CLIENT` com `client_manager` ou remover UI de gestao para legado.
- `AUD-009`: usar `caseData.tenantId` no relatorio publico criado por analista quando houver `caseId`.
- `AUD-010`: corrigir `RelatoriosPage` para ler `candidateName` top-level com fallback.
- `AUD-012`: tratar `active === false` em `PublicReportPage`.
- `AUD-013`: persistir `concludedAt` e `turnaroundHours`; ajustar mappers e metricas.
- `AUD-014`: adicionar/validar indices Firestore de `publicReports` e budget de IA.
- `AUD-015`: aplicar `status: inactive` em regras/guards ou custom claims.
- `AUD-017`: ampliar fluxo de correcao com campos estruturados.
- `AUD-021`: redesenhar tabelas densas em mobile/tablet.

Corrigir depois:
- `AUD-016`: decidir se `candidates` continua fonte ativa e sincronizar correcao ou remover legado.
- `AUD-019`: importar `setDoc` ou remover funcao legado `updateTenantSettings`.
- `AUD-020`: criar subsistema de notificacoes transacionais por evento e tenant.

Nao priorizar agora:
- Redesign visual amplo fora das telas com overflow comprovado. A prioridade deve ser seguranca/publicacao/contratos antes de estetica.
- Reescrita de arquitetura geral. Os problemas encontrados sao corrigiveis incrementalmente no stack atual.
- Migracao de banco completa. Antes, resolver contratos de campos e trilha de auditoria.

## 9. Pontos que exigem validacao adicional

- Validar em ambiente Firebase real se os indices ausentes ja foram criados manualmente fora de `firestore.indexes.json`. O repositorio nao versiona `publicReports(tenantId, createdAt)` nem `cases(tenantId, aiExecutedAt)`.
- Validar politica juridica/produto para processos em segredo: a recomendacao tecnica e nao publicar detalhe sensivel, mas o formato final precisa de decisao de compliance.
- Validar migracao de roles legadas antes de alterar `LEGACY_CLIENT`, porque tenants antigos podem depender desse papel.
- Validar se `candidates` ainda e colecao funcional ou apenas legado; o fluxo atual cria documentos nela, mas as rotas ativas de `src/App.jsx` nao incluem `CandidatosPage`.
- Validar com dados reais se existem casos `DONE` reabertos com `publicReportToken` ativo; a vulnerabilidade e demonstrada pelo fluxo de codigo, mas a frequencia depende do historico de uso.
- Validar em browser real apos correcoes responsivas; a auditoria usou artefatos existentes em `results/responsive-audit-1.json` e evidencias CSS, nao uma nova sessao interativa neste turno.
