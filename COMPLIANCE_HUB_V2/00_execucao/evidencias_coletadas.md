# Evidencias coletadas

Este arquivo consolida os pontos de evidencia mais relevantes usados nos documentos.

## ComplianceHub local

### Produto, rotas e portais

- `src/App.jsx`: define rotas autenticadas para portal cliente, portal operacional e relatorio publico.
- `src/App.jsx:RequirePortal`: restringe usuario ao portal correto.
- `src/App.jsx:RequirePermission`: aplica RBAC por permissao.
- `src/core/rbac/permissions.js`: define roles, permissoes e `getPortal`.

### Backend e funcoes serverless

- `functions/index.js:createClientSolicitation`: cria solicitacao/caso a partir do portal cliente.
- `functions/index.js:enrichJuditOnCase`: enriquecimento Judit.
- `functions/index.js:enrichBigDataCorpOnCase`: enriquecimento BigDataCorp.
- `functions/index.js:enrichEscavadorOnCase`: enriquecimento Escavador.
- `functions/index.js:enrichDjenOnCase`: enriquecimento DJEN.
- `functions/index.js:concludeCaseByAnalyst`: conclusao revisada pelo analista.
- `functions/index.js:buildSanitizedPublicResultSnapshot`: montagem do snapshot seguro.
- `functions/index.js:syncPublicResultLatest`: sincronizacao de `publicResult/latest`.
- `functions/index.js:publishResultOnCaseDone`: trigger de consistencia apos conclusao.
- `functions/index.js:createAnalystPublicReport`: criacao de relatorio por analista.
- `functions/index.js:createClientPublicReport`: criacao de relatorio pelo cliente.
- `functions/index.js:buildCanonicalReportHtml`: HTML canonico do relatorio.

### Contratos e projecoes

- `functions/index.js:PUBLIC_RESULT_FIELDS`: whitelist backend de resultado publico.
- `functions/index.js:CLIENT_CASE_FIELDS`: whitelist backend do espelho cliente.
- `src/core/clientPortal.js:PUBLIC_RESULT_FIELDS`: duplicacao frontend do contrato.
- `src/core/clientPortal.js:sanitizeCaseForClient`: sanitizacao para cliente.
- `src/core/clientPortal.js:resolveClientCaseView`: visao consolidada do cliente.
- `src/core/clientPortal.js:getReportAvailability`: disponibilidade do relatorio.

### Portal cliente e relatorio

- `src/portals/client/SolicitacoesPage.jsx:handleOpenReport`: fluxo do botao de abrir relatorio.
- `src/portals/client/SolicitacoesPage.jsx`: drawer com detalhes, riscos, resumo, timeline e relatorio.
- `src/portals/client/RelatoriosClientePage.jsx`: listagem e abertura de relatorios publicos.
- `src/pages/PublicReportPage.jsx`: busca `publicReports/{token}` e renderiza HTML em `iframe`.

### Revisao humana

- `src/portals/ops/CasoPage.jsx`: tela principal de revisao e conclusao.
- `src/portals/ops/CasoPage.jsx`: usa `reviewDraft`, `prefillNarratives`, `aiStructured`, `riskScore`, `finalVerdict`.
- `functions/index.js:ALLOWED_CONCLUDE_FIELDS`: campos aceitos na conclusao.
- `functions/index.js:ALLOWED_DRAFT_FIELDS`: campos aceitos no draft.
- `functions/index.js:resolveNarrativeField`: resolve narrativas entre payload, draft, prefill e case.

### Providers e normalizacao

- `functions/adapters/bigdatacorp.js`: adapter BigDataCorp com chamadas, retry/backoff e datasets.
- `functions/normalizers/bigdatacorp.js`: normaliza basic data, processos, KYC e profissao com `_source`.
- `functions/adapters/judit.js`: adapter Judit.
- `functions/adapters/escavador.js`: adapter Escavador.
- `functions/adapters/fontedata.js`: adapter FonteData.
- `functions/adapters/djen.js`: adapter DJEN.

### Auditoria

- `functions/audit/auditCatalog.js`: catalogo backend de eventos.
- `functions/audit/writeAuditEvent.js`: grava `auditLogs` e projeta `tenantAuditLogs`.
- `src/core/audit/auditCatalog.js`: catalogo seguro frontend.
- `src/portals/ops/AuditoriaPage.jsx`: auditoria operacional.
- `src/portals/client/AuditoriaClientePage.jsx`: auditoria cliente.

### Regras Firestore

- `firestore.rules`: restringe `cases`, `publicResult`, `clientCases`, `publicReports`, `auditLogs`, `tenantAuditLogs`.

## Marble

### Estrutura e stack

- `modelos/marble/.gitmodules`: submodules `api` e `front` via SSH.
- `modelos/marble-backend/go.mod`: Go, Gin, pgx/Postgres, Redis, River queue, OpenTelemetry, Prometheus, Sentry, BigQuery, Firebase.
- `modelos/marble-backend/api/routes.go`: rotas de decisions, client360, screenings, continuous-screenings, cases, inboxes, data-model, webhooks e workflows.

### Dominio

- `modelos/marble-backend/models/case.go:Case`: caso com decisions, events, inbox, status, outcome, tags e arquivos.
- `modelos/marble-backend/models/decision.go:Decision`: decisao com score, scenario, rules e screenings.
- `modelos/marble-backend/models/data_model.go:DataModel`: data model, tables, fields, links e pivots.
- `modelos/marble-backend/models/screening.go:Screening`: screening e matches.
- `modelos/marble-backend/models/workflows.go:Workflow`: workflow rules, conditions e actions.
- `modelos/marble-backend/models/audit.go:AuditEvent`: eventos de auditoria.

### Usecases

- `modelos/marble-backend/usecases/decision_usecase.go:CreateAllDecisions`: cria decisoes a partir de cenarios.
- `modelos/marble-backend/usecases/evaluate_scenario/evaluate_scenario.go`: avalia regras e screening.
- `modelos/marble-backend/usecases/case_usecase.go`: listagem, revisao e relacao de decisoes com casos.
- `modelos/marble-backend/usecases/continuous_screening/usecase.go`: monitoramento continuo.

### Frontend

- `modelos/marble-frontend/packages/app-builder/src/routes/_app/_builder`: rotas de cases, client-detail, continuous-screening, data, detection, screening-search, settings e user-scoring.
- `modelos/marble-frontend/packages/app-builder/src/components/CaseManager`: componentes de case manager.
- `DataModelExplorer`, `PivotsPanel`, `DecisionPanel`, `CaseInvestigation`, `KycEnrichment`.

## Ballerine

### Estrutura e produto

- `modelos/ballerine/README.md`: declara foco em KYC, KYB, underwriting, transaction monitoring, workflow engine, plugins, manual review e collection flows.
- `modelos/ballerine/README.md`: informa major rebuild e suporte OSS limitado.
- `modelos/ballerine/pnpm-workspace.yaml`: monorepo com `apps`, `packages`, `sdks`, `services`.
- `modelos/ballerine/package.json`: scripts de KYC/KYB manual review e build de workflow/rules/sdk.

### Backend

- `modelos/ballerine/services/workflows-service/package.json`: NestJS, Prisma, BullMQ, ioredis, OpenTelemetry, Sentry.
- `modelos/ballerine/services/workflows-service/src/app.module.ts`: PrismaModule, EventEmitterModule, ScheduleModule, QueueModule, SentryModule.
- `modelos/ballerine/services/workflows-service/prisma/schema.prisma`: `EndUser`, `Business`, `WorkflowDefinition`, `WorkflowRuntimeData`, `Alert`, `Document`, `WorkflowLog`.

### Workflow

- `modelos/ballerine/services/workflows-service/src/workflow/workflow.service.ts:WorkflowService`: runtime central.
- `WorkflowService.event`: processa eventos.
- `findByIdAndLock`: trava runtime para transicao segura.
- Emite `workflow.context.changed` e `workflow.state.changed`.

### Frontend/backoffice

- `modelos/ballerine/apps/backoffice-v2/src/router.tsx`: merchant monitoring, KYB/ownership, case management, entities e transaction monitoring.
- `modelos/ballerine/apps/kyb-app`: collection flow para KYB.
- `modelos/ballerine/apps/kyb-app/src/domains/collection-flow/collection-flow.api.ts`: endpoints de collection-flow.
- `packages/workflow-core/src/lib/workflow-runner.ts`: uso de XState.
- `packages/ui`: dynamic forms e document fields.

