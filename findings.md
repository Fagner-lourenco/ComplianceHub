# Findings Ativos — Revisao Completa Frontend + Backend

> **Data:** 2026-06-01
> **Scope atual:** planejar revisao completa de todos os fluxos, funcionalidades, formularios, backend, frontend, Firestore e integracoes.

---

## Descobertas de Preparacao

| Item | Achado | Severidade | Proxima acao |
|------|--------|------------|--------------|
| Contexto anterior | `session-catchup.py` nao existe em `%USERPROFILE%\.opencode`, mas existe em `%USERPROFILE%\.config\opencode` | Baixa | Manter caminho real no processo local |
| Working tree | Ha muitas alteracoes acumuladas da refatoracao/auditoria, incluindo backend, frontend, docs, graphify e arquivos removidos | Alta | Antes de qualquer commit/deploy, revisar diff por grupos e garantir que nada sensivel entra |
| Backend tests | `functions` passou completo com 55 arquivos e 1215 testes | Positivo | Manter como baseline de backend |
| Frontend tests | `npm test` raiz falhava intermitentemente em `src/portals/ops/CasoPage.test.jsx`; causa provável era vazamento de estado de teste (`authState` mutável e `sessionStorage`) | Alta | Corrigido; `npm test` raiz passou 97 arquivos / 1554 testes em 2026-06-01 |
| Build/lint | `npm run lint`, `cd functions && npm run lint` e `npm run build` passaram | Positivo | Repetir apos qualquer correcao |
| Contrato FE/BE | 49 callables usados no frontend, 68 exports backend, 0 missing | Positivo | Repetir apos mudancas em `functions/index.js` ou `firestoreService.js` |
| Indices | `juditWebhookRequests(status ASC, createdAt ASC)` foi adicionado localmente e ainda precisa decisao/deploy | Medio | Fase 5: validar indices remotos e deploy sem `--force` se aprovado |
| Graphify | Relatorio aponta god nodes: `useAuth`, `callBackendFunction`, `extractErrorMessage`, `runAutoClassifyAndAi`, `CasoPage`, `runJuditEnrichmentPhase` | Medio | Usar esses hubs para navegar revisao de fluxos criticos |
| Pos-deploy export jobs | `listExportJobs` retornava 500 por falta de indice composto em `exportJobs(clientId ASC, tenantId ASC, createdAt DESC, __name__ DESC)` | Alta | Corrigido e deployado; indice remoto confirmado `READY` |
| Pos-deploy solicitacoes | `SolicitacoesPage` enviava `filters.status = ALL`; backend V1 interpretava como status literal e filtrava todos os casos | Alta | Corrigido em `matchesClientCaseFilters`; filtros `ALL`, `verdict` e `searchTerm` cobertos por teste |

---

## Areas de Maior Risco para Revisao

| Area | Por que e critica | Arquivos/fluxos iniciais |
|------|-------------------|--------------------------|
| `CasoPage` | Tela mais complexa, flakiness em testes, conclusao/devolucao/rerun/mensagens/preview | `src/portals/ops/CasoPage.jsx`, `CasoPage.test.jsx` |
| Pipeline de enriquecimento | Integra providers externos, gate de identidade, locks, statuses e auto-classificacao | `functions/modules/enrichmentPhases.js`, `enrichmentTriggers.js`, `autoClassification.js` |
| Relatorio publico | Privacidade e exposicao externa sem login | `reportEngine.js`, `exportJobsAndReports.js`, `PublicReportPage` |
| RBAC/claims | Pode gerar cross-tenant access ou escalada de privilegio | `tenantUserManagement.js`, `permissions.js`, `firestore.rules` |
| Export/PDF | Alto volume, Storage, dados sensiveis, jobs async | `exportJobsAndReports.js`, `pdfGeneration.js`, `ExportacoesPage` |
| Formularios cliente | Entrada inicial do fluxo e validacao CPF/nome/social | `NovaSolicitacaoPanel.jsx`, validators backend/client |

---

## Fase 0 — Inventario Frontend Inicial

| Categoria | Achado | Fonte |
|-----------|--------|-------|
| Rotas | Todas as rotas principais estao centralizadas em `src/App.jsx` usando `BrowserRouter`, `Routes`, `Route`, `Navigate` | `grep <Route path=` |
| Portais reais | `/client/*`, `/ops/*`, `/r/:token`, `/login`, `/` e fallback `*` | `src/App.jsx` |
| Rotas demo | `/demo/client/*`, `/demo/ops/*`, `/demo/r/:caseId` | `src/App.jsx` |
| Paginas detectadas | 21 arquivos `*Page.jsx` em `src/pages` e `src/portals` | `glob src/{pages,portals}/**/*Page.jsx` |
| Callables frontend | `firestoreService.js` concentra wrappers `call*`; busca inicial encontrou chamadas via `callBackendFunction` e `httpsCallable` | `grep callBackendFunction/httpsCallable` |
| Notifications | `notificationService.js` tambem usa `httpsCallable` para `markNotificationAsRead` e `markAllNotificationsAsRead` | `grep callBackendFunction/httpsCallable` |
| V2 nao adotado no frontend | `listOpsCasesV2` e `listClientCasesV2` existem no backend, mas os wrappers usados pelas telas ainda chamam `listOpsCases` e `listClientCases` | `firestoreService.js`, `functions/index.js` |

Paginas detectadas para cobertura manual:
- Public/login/perfil: `LoginPage`, `PerfilPage`, `PublicReportPage`.
- Ops: `FilaPage`, `CasoPage`, `CasosPage`, `ClientesPage`, `TenantSettingsPage`, `AuditoriaPage`, `MetricasIAPage`, `RelatoriosPage`, `SaudePage`, `EquipeOpsPage`.
- Cliente: `DashboardClientePage`, `SolicitacoesPage`, `ClientReportPage`, `NovaSolicitacaoPage`, `ExportacoesPage`, `RelatoriosClientePage`, `EquipePage`, `AuditoriaClientePage`.

---

## Fase 0 — Rotas e Backend Exports

### Rotas reais com permissao

| Rota | Componente | Guarda/Permissao |
|------|------------|------------------|
| `/login` | `LoginPage` | Publica |
| `/` | `PortalHomeRedirect` | `RequireAuth` |
| `/client/dashboard` | `DashboardClientePage` | `CASE_READ` |
| `/client/solicitacoes` | `SolicitacoesPage` | `CASE_READ` |
| `/client/relatorio/:caseId` | `ClientReportPage` | `CASE_READ` |
| `/client/nova-solicitacao` | `NovaSolicitacaoPage` | `CASE_CREATE_REQUEST` |
| `/client/exportacoes` | `ExportacoesPage` | `CASE_EXPORT` |
| `/client/relatorios` | `RelatoriosClientePage` | `REPORT_PUBLIC_MANAGE` |
| `/client/equipe` | `EquipePage` | `USERS_MANAGE` |
| `/client/auditoria` | `AuditoriaClientePage` | `TENANT_AUDIT_VIEW` |
| `/client/perfil` | `PerfilPage` | Portal client autenticado |
| `/ops/fila` | `FilaPage` | `CASE_READ` |
| `/ops/caso/:caseId` | `CasoPage` | `CASE_WRITE` |
| `/ops/casos` | `CasosPage` | `CASE_READ` |
| `/ops/clientes` | `ClientesPage` | `USERS_MANAGE` |
| `/ops/tenant-settings/:tenantId` | `TenantSettingsPage` | `SETTINGS_MANAGE` |
| `/ops/auditoria` | `AuditoriaPage` | `AUDIT_VIEW` |
| `/ops/metricas-ia` | `MetricasIAPage` | `AUDIT_VIEW` |
| `/ops/relatorios` | `RelatoriosPage` | `REPORT_PUBLIC_VIEW` |
| `/ops/saude` | `SaudePage` | `AUDIT_VIEW` |
| `/ops/equipe` | `EquipeOpsPage` | `USERS_MANAGE` |
| `/ops/perfil` | `PerfilPage` | Portal ops autenticado |
| `/r/:token` | `PublicReportPage` | Publica/token |
| `/demo/r/:caseId` | `PublicReportPage` | Demo |

### Rotas demo

`/demo/client/*` replica dashboard, solicitacoes, relatorio, nova solicitacao, exportacoes, relatorios, equipe, auditoria e perfil. `/demo/ops/*` replica fila, caso, casos, auditoria, relatorios, saude, equipe e perfil. Essas rotas usam `DemoProviders`, sem `RequireAuth` real.

### Backend exports carregaveis

`functions/index.js` carrega 68 exports publicos (excluindo `__test`). Grupos detectados:
- Cases/listagens/assignments: `listOpsCases`, `listClientCases`, `listOpsCasesV2`, `listClientCasesV2`, `getClientCaseById`, `assignCaseToAnalyst`, `assignCaseToCurrentAnalyst`, `unassignCase`, `rerunEnrichmentPhase`, `rerunAiAnalysis`.
- Cliente/solicitacao/quota: `createClientSolicitation`, `submitClientCorrection`, `getClientQuotaStatus`, `getClientDashboardMetrics`, `registerClientExport`.
- Conclusao/review/settings: `concludeCaseByAnalyst`, `returnCaseToClient`, `saveCaseDraftByAnalyst`, `setAiDecisionByAnalyst`, `updateTenantSettingsByAnalyst`.
- Relatorios/publicacao/PDF: `createAnalystPublicReport`, `createClientPublicReport`, `listClientPublicReports`, `listOpsPublicReports`, `revokeClientPublicReport`, `revokePublicReport`, `getPublicReportView`, `getClientCaseReportHtml`, `getOpsCaseReportHtml`, `getOpsCaseReportPreview`, `generateClientCasePdf`, `generatePublicReportPdf`.
- Export jobs: `createExportJob`, `getExportJobStatus`, `listExportJobs`, `cancelExportJob`, `processExportJob`, `getClientExportCases`.
- Usuarios/claims: `createOpsClientUser`, `createTenantUser`, `updateTenantUser`, `listTenantUsers`, `createOpsUser`, `updateOpsUser`, `listOpsUsers`, `updateOwnProfile`, `repairAllClaims`, `syncUserClaims`.
- Notificacoes/mensagens: `sendCaseMessage`, `markCaseCommunicationRead`, `markNotificationAsRead`, `markAllNotificationsAsRead`.
- Pipeline/triggers/webhook: `enrichJuditOnCase`, `enrichBigDataCorpOnCase`, `enrichBigDataCorpOnCorrection`, `enrichJuditOnCorrection`, `enrichEscavadorOnCase`, `enrichDjenOnCase`, `juditWebhook`, `juditAsyncFallback`, `publishResultOnCaseDone`, `syncClientCaseOnCreate`, `syncClientCaseOnUpdate`, `syncClientCaseOnDelete`.
- Sistema: `getSystemHealth`, `getOpsCaseMetrics`, `backfillClientCasesMirror`, `getClientGeoIp`.

### Callables usados pelo frontend

Frontend usa 49 chamadas backend diretas:
- Relatorios/publicacao/PDF: `revokePublicReport`, `listClientPublicReports`, `revokeClientPublicReport`, `createAnalystPublicReport`, `createClientPublicReport`, `getClientCaseReportHtml`, `getOpsCaseReportHtml`, `getOpsCaseReportPreview`, `getPublicReportView`, `listOpsPublicReports`, `generateClientCasePdf`, `generatePublicReportPdf`.
- Casos/solicitacoes: `createClientSolicitation`, `submitClientCorrection`, `assignCaseToCurrentAnalyst`, `assignCaseToAnalyst`, `unassignCase`, `returnCaseToClient`, `concludeCaseByAnalyst`, `saveCaseDraftByAnalyst`, `setAiDecisionByAnalyst`, `rerunEnrichmentPhase`.
- Listagens/metricas/export: `getOpsCaseMetrics`, `getClientDashboardMetrics`, `listClientCases`, `listOpsCases`, `getClientExportCases`, `createExportJob`, `getExportJobStatus`, `listExportJobs`, `cancelExportJob`, `registerClientExport`, `getClientCaseById`.
- Usuarios/config/perfil: `createOpsClientUser`, `listTenantUsers`, `createTenantUser`, `updateTenantUser`, `updateOwnProfile`, `listOpsUsers`, `createOpsUser`, `updateOpsUser`, `updateTenantSettingsByAnalyst`.
- Sistema/notificacoes/mensagens: `getClientGeoIp`, `getSystemHealth`, `getClientQuotaStatus`, `sendCaseMessage`, `markCaseCommunicationRead`, `markNotificationAsRead`, `markAllNotificationsAsRead`.

### Triggers e endpoints backend por tipo

- Firestore `cases/{caseId}`: `enrichJuditOnCase`, `enrichBigDataCorpOnCase`, `enrichBigDataCorpOnCorrection`, `enrichJuditOnCorrection`, `enrichEscavadorOnCase`, `enrichDjenOnCase`, `syncClientCaseOnCreate`, `syncClientCaseOnUpdate`, `syncClientCaseOnDelete`, `publishResultOnCaseDone`.
- Judit async/webhook: `juditWebhook`, `juditAsyncFallback` via factories em `juditWebhookAndFallback.js`.
- Mensagens: `sendCaseMessage`, `markCaseCommunicationRead` estao exportados pelo `functions/index.js` via `notificationService`, enquanto `functions/caseCommunication.js` tambem define handlers/funcoes auxiliares.
- Nao foi encontrado scheduler explicito exportado em `functions/index.js` nesta rodada; `processExportJob` esta registrado como callable, nao trigger.

### Colecoes Firestore mapeadas

| Colecao/subcolecao | Uso principal | Acesso direto frontend | Rules atuais |
|--------------------|---------------|------------------------|--------------|
| `userProfiles` | Perfis, roles, tenants, diretorio de usuarios | Sim, leitura para clientes/equipe/diretorio | Read proprio/ops; writes bloqueados ao cliente |
| `cases` | Documento bruto operacional e pipeline | Sim para ops e detalhe de caso | Read ops tenant/admin; writes bloqueados |
| `cases/{caseId}/publicResult/latest` | Snapshot sanitizado publicado | Sim para cliente/ops | Read auth tenant/ops; writes bloqueados |
| `clientCases` | Espelho sanitizado cliente | Via subscriptions/listagens backend; direct read permitido por rules | Read cliente tenant/ops; writes bloqueados |
| `candidates` | Candidatos internos | Backend e ops | Read ops; writes bloqueados |
| `auditLogs` | Auditoria completa ops | Sim para ops | Read ops tenant/admin; writes bloqueados |
| `tenantAuditLogs` | Auditoria projetada cliente | Sim | Read cliente tenant/ops; writes bloqueados |
| `tenantSettings` | Configuracao de tenant/provider/quota | Sim leitura | Read tenant/ops; writes bloqueados |
| `tenantUsage` | Contadores de quota | Sim leitura | Read tenant/ops; writes bloqueados |
| `exports` | Registro legado/local de exportacao | Sim leitura | Read tenant/ops; writes bloqueados |
| `exportJobs` | Exportacao async | Backend/callables | Nao ha regra direta especifica; acesso deve ser via callables/Admin SDK |
| `publicReports` | Tokens publicos/share links | Frontend ainda tem `getPublicReport`/`fetchPublicReports`, mas rules bloqueiam direct read | Direct read/write bloqueado |
| `systemHealth` | Circuit breaker/provider health | Backend e ops | Read ops; writes bloqueados |
| `notifications` | Alertas por usuario | Sim por `recipientUid` | Read proprio; writes bloqueados |
| `caseMessages` | Comunicacao cliente/ops | Sim por case/tenant | Read tenant/ops/client; writes bloqueados |
| `juditWebhookRequests` | Mapeamento request async Judit | Backend | Sem regra direta; acesso via Admin SDK |
| `systemLocks` | Locks operacionais/backfill | Backend | Sem regra direta; acesso via Admin SDK |
| `aiCostLedger` | Ledger de custo OpenAI | Backend | Sem regra direta; acesso via Admin SDK |

Achados novos da Fase 0:
- `fetchPublicReports()` e `getPublicReport()` em `firestoreService.js` fazem leitura direta de `publicReports`, mas `firestore.rules` bloqueia `publicReports` completamente. Busca de uso nas telas atuais encontrou `RelatoriosPage`, `RelatoriosClientePage` e `PublicReportPage` usando callables (`fetchOpsPublicReports`, `fetchClientPublicReports`, `getPublicReportView`), entao as leituras diretas parecem legado. Nao remover sem autorizacao de Phase D.
- `exportJobs`, `juditWebhookRequests`, `systemLocks` e `aiCostLedger` nao aparecem nas rules. Isso e aceitavel se forem Admin-SDK-only, mas deve ser explicitado/testado na Fase 5 para evitar confusao operacional.
- `processExportJob` e callable; se a intencao futura era worker automatico, hoje depende de invocacao/polling/controlador existente. Revisar fluxo em `ExportacoesPage` na Fase 1.

---

## Fase 2 — Formularios e Validadores

| Item | Achado/acao | Severidade | Status |
|------|-------------|------------|--------|
| Social URL no frontend | `validateUrl()` aceitava `@usuario`, mas `createClientSolicitationHandler` rejeita qualquer rede social sem `http://` ou `https://` | Medio | Corrigido em `src/core/validators.js` e mensagens/placeholders de `NovaSolicitacaoPanel.jsx` |
| Regressao frontend | Adicionado teste para rejeitar `@maria` antes de chamar `createClientSolicitation` | Positivo | `npm test -- src/portals/client/NovaSolicitacaoPage.test.jsx` passou: 11 tests |
| Validador isolado | `validateUrl()` agora aceita somente URL `http:`/`https:` completa ou vazio opcional | Positivo | `npm test -- src/core/validators.test.js` passou: 11 tests |
| NovaSolicitacao: comprimento de campos | `validate()` frontend não validava: `fullName` min 3 / max 200, `position` max 100, `department` max 100; backend rejeita todos; erro genérico para o usuário | Medio | Corrigido: validação adicionada com mensagens específicas e spans de erro; 14 testes passando |
| NovaSolicitacao: spans de erro faltantes | Campos `position` e `department` não tinham `<span>` de erro no template — validação silenciosa | Medio | Corrigido: spans adicionados com `role="alert"` |
| Textos remanescentes | `SolicitacoesPage.jsx` ainda informava `LinkedIn/Instagram (URL ou @)` e `NovaSolicitacaoPanel.jsx` ainda tinha placeholder `URL completa ou @handle` | Medio | Corrigido para URL completa; grep por `URL ou @`, `@handle` e `URL completa ou @` nao encontrou JSX remanescente |
| OPS stats keys desalinhadas | `buildOpsCaseStats` em `functions/modules/caseManager/caseFilters.js` retornava `waitingInfo`/`correctionNeeded`, mas `FilaPage.jsx` no frontend lia `stats.waiting`/`stats.corrections` — KPIs "Aguardando Info" e "Correcao Pendente" ficariam `undefined`/zerados com dados reais de producao | Alta | Corrigido: backend renomeado para `waiting`/`corrections`; 109 testes passando (caseFilters 15 + caseQueriesAssignments 90 + FilaPage 4) |

---

## Fase 6 — Segurança, Privacidade e Compliance

| Item | Achado | Severidade | Detalhe |
|------|--------|------------|---------|
| CSP/headers | `vercel.json`: CSP bem configurado (sem wildcard `*` em connect-src, sem `eval`), HSTS com preload, XFO DENY, nosniff, referrer, permissions. `unsafe-inline` em script-src necessário para scripts inline de PDF/impressão | ✅ Positivo | `connect-src` restrito a domínios Firebase + `ipapi.co` |
| Secrets locais | `.env.local` e `users.json` cobertos por `.gitignore` (padrões `*.local`, `.env.*`, `users.json`) | ✅ Positivo | Não serão commitados |
| `results/` | 50+ arquivos com dados de APIs externas (Judit, BigDataCorp, Escavador, DJEN) — podem conter CPFs, nomes e dados processuais reais. Está em `.gitignore` mas existe em disco | ⚠️ Alta | Auditoria necessária antes de deploy; limpar ou confirmar que são dados de teste |
| Logs com PII | 4 `console.log` expõem CPF completo em texto plano: BigDataCorp, Escavador, Judit (datalake), Judit (name search). 2 expõem `candidateName` | ⚠️ Alta | Visível no Cloud Logging; deveria usar CPF mascarado |
| HTML sanitization | `_shared/sanitizers.js` remove `<script>`, `on*` handlers, `javascript:`. Frontend `PublicReportPage` adiciona `stripActiveContent` com DOMParser (defesa em profundidade) | ✅ Positivo | Sanitização dupla backend + frontend |
| RBAC | 8 roles, 10 permissões. `owner`/`admin` acesso total; `supervisor` gerencia analistas; `analyst` analisa casos; `client_manager` gerencia tenant | ✅ Positivo | Verificado em Fase 1/Fase 3 |
| Auto-promoção | `firestore.rules:65` bloqueia writes em `userProfiles` — roles só via Cloud Functions | ✅ Positivo | Backend `updateOpsUserLogic` também rejeita `owner` |
| Cross-tenant | Rules verificam `isSameTenant()` em todas as coleções; handlers backend usam `profile.tenantId` para scoping | ✅ Positivo | Verificado em Fase 1/Fase 3/Fase 5 |

| Item | Achado | Severidade | Detalhe |
|------|--------|------------|---------|
| Rules — 15 coleções | Todas protegidas: writes bloqueados, reads com tenant isolation ou recipientUid | ✅ Positivo | `userProfiles` previne auto-promoção; `publicReports` bloqueia tudo (callables only); `notifications` usa `recipientUid == uid` |
| Rules — coleções Admin-SDK-only | `exportJobs`, `juditWebhookRequests`, `systemLocks`, `aiCostLedger` sem regras explícitas — acessíveis apenas via Admin SDK | ✅ Positivo | Padrão esperado; sem regra = acesso negado pelo Firestore |
| Teste de rules | `firestore.rules.test.js` (45 linhas) cobre contrato estrutural (5 testes) mas não cobre `systemHealth`, `notifications`, `caseMessages`, `aiCache`, `userProfiles` | ⚠️ Médio | Falta cobertura funcional (emulador); testes estruturais garantem que regras existem mas não que funcionam |
| Índices remotos vs locais | 26 remotos, 26 locais. 2 extras remotos: `auditLogs: target/timestamp/__name__` e `auditLogs: tenantId/timestamp/__name__` — usam campo `timestamp` legado em vez de `occurredAt` | Baixa | Índices legados podem ser deletados; código atual usa `occurredAt` |
| Índice local pendente | `juditWebhookRequests: status ASC, createdAt ASC` existe no arquivo local mas NÃO está deployado (não aparece nos remotos) | Média | Necessário para o fallback Judit; deploy pendente de decisão |
| PUBLIC_RESULT_FIELDS (frontend) | `clientPortal.js:3-15` ainda inclui `tenantId`, `requestedBy*`, `bigdatacorpMotherName` — backend `reportEngine.js:431-463` já removeu esses campos | Baixa | Usado apenas como fallback em `sanitizeCaseForClient`; público não expõe; deriva de sincronização |
| Hot document `tenantUsage/{tenantId}` | Usa transação Firestore com contagem atômica por tenant; 800/dia ≈ <1/min — bem abaixo do limite de ~1 write/s por doc | ✅ Positivo | Sem risco na escala atual; transação garante atomicidade com retry |

| Componente | Achado/Status | Severidade | Detalhe |
|------------|---------------|------------|---------|
| Gate de identidade (BigDataCorp) | Reprovacao real → CORRECTION_NEEDED automatico; erro tecnico → FAILED sem devolucao | ✅ Positivo | `returnCaseForIdentityGateBlock` usado corretamente |
| Gate de identidade (FonteData) | Gate BLOCKED sem auto-devolucao ao cliente — caso fica em PENDING com BLOCKED, analista precisa agir manualmente | ⚠️ Medio | Inconsistente com BigDataCorp; FonteData e condicional, impacto limitado |
| BigDataCorp trigger | On-create: lock → config → gate → fases → autoClassify; on-correction: CORRECTION_NEEDED→PENDING guard | ✅ Positivo | Catch block nao rethrow — terminal FAILED |
| Judit trigger | Guard espera BigDataCorp settled; lock → config → runJuditEnrichmentPhase | ✅ Positivo | Error = FAILED com cleanup de async phases |
| Escavador trigger | Condicional via `juditNeedsEscavador`; guard BDC settled → verifica needsEscavador → lock → run | ✅ Positivo | Config-driven |
| DJEN trigger | Condicional por config; on-create e on-update guards | ✅ Positivo | Filtros por processo/nome |
| AutoClassify/AI | `canRunFinalClassification` verifica readiness de todos providers + Judit async; `runAutoClassifyAndAi` usa lock atomico; budget via `aiCostLedger` com fallback O(n) | ✅ Positivo | Safety net para casos negative/partial |
| `publishResultOnCaseDone` | Trigger on status→DONE; min content check; already-up-to-date guard; revoke on leaving DONE | ✅ Positivo | `syncPublicResultLatest` garante privacidade |
| Chain BDC→Judit→Escavador→DJEN→AutoClassify | BDC on-create dispara trigger Judit; Judit completed dispara Escavador; DJEN roda condicional; ultimo provider terminal → `maybeRunAutoClassifyAndAi` | ✅ Positivo | Cada elo da chain tem guard e lock independente |

| Callable | Auth | Tenant isolation | Input validation | Audit log | Rate limit | Testes | Achados |
|----------|------|-----------------|------------------|-----------|------------|--------|---------|
| `assignCaseToCurrentAnalyst` | ✅ | ✅ | ✅ (transaction) | ✅ | ❌ | ⚠️ indireto | Sem testes de handler |
| `assignCaseToAnalyst` | ✅ | ✅ (target tenant match) | ✅ (role, status, transaction) | ✅ | ❌ | ⚠️ indireto | Boa validacao cross-tenant |
| `unassignCase` | ✅ | ✅ | ✅ (status, has assignee) | ✅ | ❌ | ⚠️ indireto | Reverte para PENDING se sem draft |
| `rerunEnrichmentPhase` | ✅ | ✅ | ✅ (phase, scope, status) | ✅ | ❌ | ⚠️ indireto | 540s timeout, secrects, lock-based |
| `rerunAiAnalysis` | ✅ | ✅ | ✅ | delegado | ❌ | ⚠️ indireto | Thin wrapper |
| `sendCaseMessage` | ✅ | ✅ (assertCanAccess) | ✅ (body sanitized) | ✅ | ✅ | ✅ dedicado | Corrigido: fonte de verdade em `notificationService`, rate limit 20/min por uid e audit `CASE_MESSAGE_SENT` sem corpo da mensagem |
| `markCaseCommunicationRead` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ sem testes | Aceitavel sem audit |
| `markNotificationAsRead` | ✅ | ✅ (recipientUid) | ✅ | ❌ | ❌ | ❌ nao verificado | Simples, sem risco |
| `markAllNotificationsAsRead` | ✅ | N/A (own UID) | ✅ (batch) | ❌ | ❌ | ❌ nao verificado | Simples, sem risco |

| Fluxo | Achado/acao | Severidade | Status |
|-------|-------------|------------|--------|
| FilaPage stats | `buildOpsCaseStats` retornava `waitingInfo`/`correctionNeeded`, mas frontend lia `stats.waiting`/`stats.corrections` | Alta | Corrigido: backend renomeado para `waiting`/`corrections` |
| CasoPage contratos | `concludeCaseByAnalyst`, `returnCaseToClient`, `saveCaseDraftByAnalyst`, `setAiDecisionByAnalyst` e reruns alinhados entre payloads frontend e backend | Positivo | Revisados, sem desalinhamentos |
| RelatoriosPage (ops) | `fetchOpsPublicReports` → `listOpsPublicReports` com scope por tenant; `revokePublicReport` com verificação de tenant; `serializeManagedPublicReport` expõe `tenantId` apenas para visão OPS autenticada | Positivo | Contratos alinhados |
| RelatoriosClientePage | `fetchClientPublicReports` → `listClientPublicReports` força `tenantId` do profile, não aceita do request; `revokeClientPublicReport` valida tenant ownership | Positivo | Tenant isolation confirmada |
| SaudePage | `getSystemHealthLogic` não incluía `owner` nas roles permitidas (`['analyst', 'supervisor', 'admin']`) | Baixa | Corrigido: `owner` permitido e coberto por teste unitário |
| Auditoria ops/cliente | `subscribeToAuditLogs` e `subscribeToTenantAuditLogs` com `where('tenantId')` garantem isolamento por tenant | Positivo | Revisado |
| Equipe ops | `MANAGEABLE_ROLES` não inclui `owner`; backend `updateOpsUserLogic` tem defesa em profundidade | Positivo | RBAC confirmado |
| createRevokePublicReportHandler | Verificação de tenant na linha 1002 pula se `reportTenantId` é nulo; defesa em profundidade ausente | Baixa | Todos reports têm tenantId; risco residual mínimo |

| Fluxo | Achado/acao | Severidade | Status |
|-------|-------------|------------|--------|
| Exportacao async cliente | `ExportacoesPage.jsx` criava `createExportJob` e iniciava polling, mas nao chamava `processExportJob`; como `processExportJob` e callable, o job podia ficar pendente sem worker automatico | Alta | Corrigido: frontend chama `callProcessExportJob(jobId)` apos criar o job |
| Exportacao async cliente | `scopeCode` era enviado dentro de `filters`, mas `createExportJobHandler` le `request.data.scopeCode`; escopo `DONE/PENDING/RED` podia virar `ALL` no job async | Alta | Corrigido: `scopeCode` enviado no topo do payload e mantido tambem nos filtros |
| Exportacao async cliente | Backend retorna status de job como objeto plano `{ jobId, status, ... }`, mas UI esperava `result.job` e usava `job.id` para cancelamento | Media | Corrigido: UI aceita `result.job || result`, usa `jobId || id` e normaliza status lower-case |
| Teste exportacao | Faltava regressao garantindo que o job async e processado apos criacao | Positivo | `ExportacoesPage.test.jsx` cobre `createExportJob`, `processExportJob` e `getExportJobStatus` |

---

## Fase 7/Fechamento — Resultado Final Automatizado

| Item | Resultado | Severidade | Status |
|------|-----------|------------|--------|
| `CasoPage.test.jsx` flakey | O teste compartilhava `authState.userProfile` mutável e `sessionStorage` entre cenários com o mesmo `caseId`; isso podia contaminar a suíte completa quando a ordem/tempo variava | Alta | Corrigido com reset no `beforeEach`; teste focado passou 18/18 e suíte raiz passou 97/97 |
| Logs com PII | Logs de CPF em providers foram mascarados com `maskCpf`; logs com `candidateName` em busca por nome foram trocados por `nameLength` | Alta | Corrigido e coberto por testes de sanitização/enrichment |
| `sendCaseMessage` | Handler tinha duplicidade histórica e não registrava audit/rate limit | Média | Corrigido: `notificationService` é fonte de verdade; audit sem corpo; rate limit 20/min |
| Validação automatizada final | Contrato FE/BE, lint raiz, build, suíte raiz, lint functions, suíte functions e Playwright focado passaram | Positivo | Pronto para revisão humana de diff e decisão de deploy |
| Validação manual/staging | Fluxos autenticados reais não foram executados nesta rodada | Média | Pendente antes de deploy de produção |
| Índice Judit fallback | `juditWebhookRequests(status ASC, createdAt ASC)` está local e ainda não deployado | Média | Requer deploy de índices sem `--force` quando aprovado |
| Índices remotos legados | 2 índices `auditLogs.timestamp` existem remotamente e não estão no arquivo local | Baixa | Decisão futura; não remover com `--force` nesta rodada |
| `results/` | Fora do escopo por decisão do usuário | Alta | Não auditado/não limpo nesta rodada |

---

# Findings — Refatoração do Monolito ComplianceHub

> **Data:** 2026-05-31 (atualizado)
> **Versão anterior:** 2026-05-29
> **Scope:** Arquitetura, Escalabilidade, Modularização, Duplicação de Código
> **Método:** Análise estática de código + graphify + trace de dependências + quantificação de impacto

---

## Executive Summary (ATUALIZADO 2026-05-31)

O monolito `functions/index.js` foi reduzido de **13.366 linhas** para **1.782 linhas** (−87%) via extração de **28 módulos** com factories e wrappers de dependência. **1.202 testes backend** (53 arquivos) e **1.525 testes frontend** (93 arquivos) passando. Lint 0 erros. Nenhum deploy realizado.

### Duplicações entre módulos identificadas e tratadas

| Duplicata | Arquivos | Status |
|-----------|----------|--------|
| `sanitizeAiOutput` + `sanitizeStructuredList` + `sanitizeStructuredText` | `aiParsers.js` → `_shared/sanitizers.js` | ✅ Resolvido |
| `asDate` + `resolvePublicReportStatus` + `serializeManagedPublicReport` | `exportJobsAndReports.js` → `reportEngine.js` / `helpers/normalize.js` | ✅ Resolvido |
| `normalizeTenantSlug` | `tenantUserManagement.js` → `helpers/normalize.js` | ✅ Resolvido |
| `hasMeaningfulValue` | `reportEngine.js` vs `helpers/normalize.js` | ⚠️ NÃO resolvido — implementações diferentes (objetos) |
| `hasPendingJuditAsync` + `isProviderTerminalForPipeline` | `autoClassification.js` vs `helpers/enrichmentStatus.js` | ⚠️ NÃO resolvido — fallbacks no factory |

### Código morto identificado (removido após autorização em 2026-06-01)

| Item | Arquivo | Linhas |
|------|---------|--------|
| 4 factories stale | `concludeCaseAndSettings.js` | Removidas |
| Registry não usado | `modules/index.js` | Removido |
| Duplicatas de auth | `modules/_shared/index.js` | Removido |
| Thin re-exporter | `modules/caseManager/index.js` | Removido |
| Exports órfãos | `helpers/enrichmentStatus.js` | Removidos |

---

## Discovery 1: Listagens com Paginação Interna + Acumulação em Memória (CRÍTICO)

### Localização
- **Arquivo:** `functions/index.js`
- **Funções:** `listOpsCases`, `listClientCases`, `getClientExportCases`, `fetchTenantCaseDocuments`

### Código problemático
```javascript
// fetchTenantCaseDocuments (linha ~10870)
// Usa startAfter internamente para buscar páginas de 500 docs,
// mas acumula TODOS os documentos em um array `docs` antes de retornar
while (scannedRecords < maxDocs) {
    let q = db.collection(collectionId);
    if (tenantId) q = q.where('tenantId', '==', tenantId);
    q = q.orderBy('createdAt', 'desc');
    if (lastDoc) q = q.startAfter(lastDoc);
    q = q.limit(Math.min(CASE_QUERY_PAGE_SIZE, maxDocs - scannedRecords));
    const snap = await q.get();
    // ... docs.push(...currentDocs.map(...))
}
```

```javascript
// listOpsCases (linha ~10920)
const { docs, pageCount, scannedRecords, capped } = await fetchTenantCaseDocuments({
    collectionId: 'cases', tenantId, fields: OPS_CASE_LIST_FIELDS,
});
const serialized = docs.map((docData) => serializeClientCaseDocument(docData));
const allMatches = serialized.filter((caseData) => matchesOpsCaseFilters(caseData, filters, { queueOnly, assigneeUid }));
allMatches.sort((left, right) => compareOpsCases(left, right, sortField, sortDir));
const start = (page - 1) * pageSize;
const pageCases = allMatches.slice(start, start + pageSize);
```

```javascript
// listClientCases (linha ~10980)
// Também pagina internamente com startAfter, mas acumula matches em memória
while (true) {
    let q = db.collection('clientCases')
        .where('tenantId', '==', profile.tenantId)
        .orderBy('createdAt', 'desc')
        .limit(CASE_QUERY_PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    // ... docs.forEach(...) → allMatches.push(serialized)
}
allMatches.sort((left, right) => compareClientCases(left, right, sortField, sortDir));
const pageCases = allMatches.slice(start, start + pageSize);
```

```javascript
// getClientExportCases (linha ~11032)
const { docs, pageCount, scannedRecords, capped } = await fetchTenantCaseDocuments({
    collectionId: 'clientCases', tenantId: profile.tenantId,
});
const cases = docs
    .map((docData) => serializeClientCaseDocument(docData))
    .filter((caseData) => matchesClientCaseFilters(caseData, filters))
    .filter((caseData) => (scopeCode === 'RED' ? caseData.riskLevel === 'RED' || caseData.riskLevel === 'HIGH' : true));
```

### Problema Real
O problema **não é ausência absoluta de `startAfter`**. O problema real é que:

1. **`fetchTenantCaseDocuments`** usa `startAfter` para buscar dados em batches de 500, mas **acumula todos os documentos em memória** antes de retornar. Para um tenant com 50.000 casos:
   - **Memória:** 50.000 × 2KB = **100 MB** de payload
   - **Tempo:** 100 páginas × 100ms = **10 segundos** de I/O
   - **Risco:** OOM kill (limite 1GiB) ou timeout de 120s

2. **`listOpsCases`** e **`listClientCases`** filtram e ordenam **em memória** (`matches*CaseFilters`, `compare*Cases`), depois fazem `slice((page-1)*pageSize, page*pageSize)`. Isso não é cursor pagination real — é "offset pagination falsa" que ainda requer carregar todos os docs.

3. **`getClientExportCases`** carrega **todos** os casos filtrados em uma callable (120s timeout), pior cenário.

### Callers afetados
1. `listOpsCases` — carrega todos os cases do tenant via `fetchTenantCaseDocuments`, filtra/sorta em memória
2. `listClientCases` — mesmo padrão, com paginação interna até `CLIENT_CASE_SEARCH_SCAN_LIMIT = 10000`
3. `getClientExportCases` — carrega todos para export (pior cenário)
4. `getOpsCaseMetrics` / `getClientDashboardMetrics` — agregação em tempo real

### Solução proposta
Implementar **cursor pagination real** por Firestore:
- Queries com `orderBy` + `startAfter` + `limit` que **não acumulam** em memória
- Índices compostos para cada combinação de filtros
- Retorno: `{ results, nextCursor }` — nunca carregar tudo em memória
- **Tie-breaker obrigatório por `__name__` (document ID)** para evitar duplicatas/omissões quando timestamps são iguais
- **Buscar `limit + 1`** para calcular `hasMore` sem necessidade de `total`

---

## Discovery 2: Export Síncrono (CRÍTICO)

### Localização
- **Arquivo:** `functions/index.js:11032`
- **Função:** `getClientExportCases`
- **Frontend:** `src/portals/client/ExportacoesPage.jsx`

### Código problemático
```javascript
// Backend: retorna TUDO numa callable
const { docs, pageCount, scannedRecords, capped } = await fetchTenantCaseDocuments({
    collectionId: 'clientCases', tenantId: profile.tenantId,
});
const cases = docs.map(...).filter(...).filter(...);
return { cases, total: cases.length, pendingCount, meta: { scannedRecords, pageCount, capped } };

// Frontend: asyncPool(5) chamando getCasePublicResult para cada caso
```

### Impacto
- **Backend:** 120s timeout em callable — quebra com >2.000 casos
- **Frontend:** UI congela durante processamento
- **Browser:** múltiplas requisições paralelas = memory leak, throttling

### Solução proposta
**Export assíncrono com Cloud Storage (Phase B):**
1. Frontend chama `createExportJob(filters, format)`
2. Backend cria doc em `exportJobs` com status `pending`
3. Trigger `onCreate` dispara worker que processa em background
4. Worker pagina cases (500/batch), formata, upload para Storage
5. Frontend faz polling a cada 3s via `getExportJobStatus(jobId)`
6. Quando `done`, frontend recebe URL signed para download

**Nota:** Phase A não implementa export assíncrono. Apenas documenta a necessidade.

---

## Discovery 3: Monolito 13.556 Linhas (ALTO)

### Localização
- **Arquivo:** `functions/index.js`

### Métricas (detectadas por busca estática)
| Métrica | Valor |
|---------|-------|
| Linhas de código | **13.556** |
| Callables (`onCall`) | **47** |
| Triggers Firestore diretos (`onDocument*`) | **10** |
| `onRequest` | **1** |
| `onSchedule` | **1** |
| Total exports detectados | **~59** |
| Funções internas | ~300 |
| Nós graphify | 1.110 |
| Edges graphify | 2.062 |

### Problemas
1. **Testabilidade:** Impossível testar uma função sem carregar todo o arquivo
2. **Code review:** PRs de 500+ linhas são impossíveis de revisar efetivamente
3. **Hot reload:** Qualquer mudança recompila todo o monolito (30-60s)
4. **Deploy:** Uma function quebra = todo o backend quebra
5. **Onboarding:** Novo dev leva dias para entender o fluxo

### Solução proposta
**Extração em módulos coesos (Phase C):**
```
functions/modules/
├── caseManager/         # CRUD cases, listagem, busca
├── enrichmentPipeline/  # Judit, Escavador, BigDataCorp, DJEN, IA
├── reportEngine/        # HTML, PDF, publicação
├── userManager/         # Auth, roles, claims
├── clientPortal/        # clientCases, quotas, export
├── auditManager/        # Logs, eventos, rastreabilidade
└── notificationManager/ # Notificações, push
```

**Nota:** Phase A não cria `functions/modules/*`. Modularização é exclusiva da Phase C.

---

## Discovery 4: Enriquecimento Sem Backpressure (ALTO)

### Localização
- **Arquivo:** `functions/index.js`
- **Adapters:** `functions/adapters/judit.js`, `escavador.js`, `bigdatacorp.js`, `djen.js`

### Código problemático
```javascript
// Cada trigger de enriquecimento dispara imediatamente
exports.enrichJuditOnCase = onDocumentUpdated(..., async (event) => {
    // ... chama Judit API sem fila, sem rate limit, sem retry backoff
});
```

### Impacto
- Judit falha → trigger falha → case fica preso
- 100 casos criados ao mesmo tempo = 100 chamadas paralelas à Judit
- Sem circuit breaker por provedor (apenas global)
- Sem fila para retry em caso de rate limit

### Solução proposta (Fase F — fora do escopo inicial)
1. **Cloud Tasks por provedor:** cada enriquecimento vira uma task na fila
2. **Rate limiting:** max 5 tasks/min por provedor
3. **Retry com backoff:** exponential backoff, max 5 tentativas
4. **Dead letter queue:** tasks que falham 5x vão para DLQ para análise

**Imediato (este plano):**
- Adicionar `maxInstances: 10` por trigger de enriquecimento
- Reforçar circuit breaker existente

---

## Discovery 5: Candidatos a Auditoria de Código Morto (MÉDIO)

### Localização
- **Arquivo:** `functions/audit/auditCatalog.js`
- **Arquivo:** `functions/index.js` (funções não chamadas)

### Candidatos identificados
```javascript
// auditCatalog.js — exports usados internamente
exports.ENTITY_TYPE = { /* ... */ };
exports.ACTOR_TYPE = { /* ... */ };
exports.getActionConfig = (action) => { /* ... */ };
```

### Status
**NÃO CONFIRMADO COMO REMOVÍVEL.** Verificação via `grep` simples não é suficiente:
- `ENTITY_TYPE`, `ACTOR_TYPE`, `getActionConfig` são usados **internamente** em `writeAuditEvent.js` (que os importa do `auditCatalog.js`)
- Remoção requer análise semântica do fluxo de auditoria, não apenas busca textual

### Classificação
| Candidato | Status | Rationale |
|-----------|--------|-----------|
| `ENTITY_TYPE` | NÃO CONFIRMADO | Pode ser usado internamente em `writeAuditEvent` |
| `ACTOR_TYPE` | NÃO CONFIRMADO | Pode ser usado internamente em `writeAuditEvent` |
| `getActionConfig` | NÃO CONFIRMADO | Pode ser usado internamente em `writeAuditEvent` |
| Funções órfãs em `index.js` | CANDIDATOS | Requer análise profunda de dependências |

### Solução proposta
1. Auditar cada export do monolito com análise semântica (não apenas grep)
2. Cruzar com referências em frontend + outros módulos
3. Classificar em:
   - **REMOVÍVEL COM SEGURANÇA** — nenhuma referência, testes cobrem ausência
   - **PROVAVELMENTE REMOVÍVEL, MAS PRECISA TESTE** — referências indiretas ou dinâmicas
   - **NÃO CONFIRMADO** — requer análise manual
   - **NÃO REMOVER** — usado em fluxo crítico

**Nota:** Remoção de código morto fica **fora da Phase A**. É responsabilidade da Phase D, após modularização.

---

## Correção de Escopo da Phase A

A Phase A foi **restringida e corrigida** para ser uma fase de baseline + documentação + V2 side-by-side, **sem**:

- ❌ Modularização (não criar `functions/modules/*`)
- ❌ Remoção de código morto
- ❌ Export assíncrono
- ❌ Deploy de índices (apenas planejamento)
- ❌ Remoção de índices existentes
- ❌ Alteração de callables V1 existentes

A Phase A **deve**:
- ✅ Criar V2 side-by-side, preservando V1 intacta
- ✅ Evitar scan completo silencioso (não carregar tudo em memória)
- ✅ Usar cursor composto com tie-breaker por document ID
- ✅ Documentar contratos e migration path
- ✅ Planejar índices necessários (sem deploy)
- ✅ Testar em emulador/local (sem alterar dados reais)

---

## Métricas de Impacto Esperado (Pós-Refatoração)

| Métrica | Valor Atual | Target | Melhoria |
|---------|-------------|--------|----------|
| Tamanho do monolito | 13.556 linhas | < 500 linhas | **96% redução** |
| Tempo de listagem (10k docs) | 10s+ / OOM | < 2s | **5x+** |
| Export (50k casos) | Timeout 120s | < 5 min (async) | **Infinito** |
| Cold start PDF | 10-20s | < 3s (warm) | **3-6x** |
| Invocações trigger por caso | ~12 | ~4 | **3x** |
| Testes isolados por módulo | 0 | 100+ | **Novo** |
| Tempo de build functions | 30-60s | < 5s | **6-12x** |

---

## Referências Cruzadas

| Descoberta | Arquivos Relacionados | Testes Necessários |
|------------|----------------------|-------------------|
| Cursor pagination | `firestoreService.js`, `index.js`, `firestore.indexes.json` | `paginateFirestoreQuery.test.js`, `listOpsCasesV2.test.js` |
| Export async | `ExportacoesPage.jsx`, `index.js` | `exportManager.test.js`, `exportWorker.test.js` |
| Modularização | `index.js`, `modules/*` | Testes por módulo (7 módulos) |
| Backpressure | `adapters/*.js`, `index.js` | Testes de carga, circuit breaker |
| Código morto | `auditCatalog.js`, `index.js` | Análise semântica + testes de regressão |

---

## Riscos Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Regressão em callable durante extração | Alta | Alto | Testes de contrato, branch `pre-refactor` |
| Índice Firestore não propagado a tempo | Média | Alto | Deploy índices 24h antes, validar no console |
| Worker de export excede timeout (9min) | Média | Médio | Paginação interna, progresso parcial, retry |
| Frontend não adapta a paginação | Baixa | Alto | Manter V1 operante, migration path documentado |
| Módulo circular (A importa B, B importa A) | Baixa | Alto | Contratos claros, shared layer |
| Filtros textuais/search não indexáveis | Alta | Médio | Rejeitar em V2 ou cair para V1 com flag explícita |
| `stats`/`total` exatos exigem scan completo | Média | Médio | Não retornar `total` em V2; usar contadores aproximados |

---

## Notas Técnicas

- **Firestore Cursor:** `startAfter` requer que o campo de ordenação seja único ou composto. **Obrigatório usar `__name__` (document ID) como tie-breaker**.
- **Cursor Encoder:** Base64 URL-safe do array `[fieldValue, docId]` para evitar parsing ambíguo.
- **Limit + 1:** Buscar `limit + 1` docs para calcular `hasMore` sem necessidade de contagem total.
- **Storage Bucket:** Usar bucket padrão do Firebase (`{projectId}.firebasestorage.app`) ou criar `exports.{projectId}.firebasestorage.app`.
- **TTL:** Firestore TTL é eventual (pode levar 72h). Para garantia imediata, usar Cloud Scheduler.
- **maxInstances:** Firebase Functions Gen2 suporta `maxInstances` por function. Recomendado: 10 para enriquecimento, 100 para callables.
- **Circuit Breaker:** Já existe em `functions/helpers/circuitBreaker.js`. Precisa ser movido para `modules/_shared/` (Phase C).
- **Auditoria:** Subscriptions de auditLogs usam `occurredAt` (não `createdAt`). Índices de auditoria existentes usam `occurredAt`.
- **Índices:** Não remover índices nesta fase. Adicionar apenas estritamente necessários.

---

> **Atualizado em:** 2026-05-31
> **Próxima revisão:** Após Phase D (remoção de código morto)

---

## Discovery 6: 72 Funções Duplicadas Inline vs Módulos (RESOLVIDO)

### Localização
- **Arquivo:** `functions/index.js`
- **Análise:** 2026-05-31

### Resumo
72 funções estavam definidas inline no `index.js` com duplicatas idênticas já extraídas em módulos. Todas tinham chamadores ativos. Foram extraídas em 5 rodadas de agentes paralelos.

### Categorias extraídas
| Categoria | Funções | Módulo destino |
|-----------|---------|---------------|
| reportHelpers | 27 | `helpers/reportHelpers.js` |
| deterministicPrefill | 8 | `modules/deterministicPrefill.js` |
| concludeCase/reportEngine/publish | 14 | `concludeCaseAndSettings`, `reportEngine`, `publishAndSync` |
| normalize/utility/aiOrch | 8 | `helpers/normalize`, `utilityHelpers`, `aiOrchestrator` |
| caseManager/export/various | 15 | `caseQueriesAssignments`, `exportJobsAndReports`, vários |
| **Total** | **72** | — |

### Resultado
- `index.js`: 13.366 → 7.864 linhas (-41,2%)
- Todas as chamadas redirecionadas para imports dos módulos
- Testes: 2.725 passando (1.524 frontend + 1.201 backend)
- Lint: 0 erros
