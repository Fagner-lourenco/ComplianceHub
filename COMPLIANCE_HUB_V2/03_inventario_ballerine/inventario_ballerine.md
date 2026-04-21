# Inventario profundo do Ballerine

## Proposta de produto

Confirmado no README e package.json:

- Ballerine se descreve como Open-Source Rules & Workflow Engine for User Identity and Risk Decisioning.
- Atua em KYC, KYB, underwriting, transaction monitoring, plugin system, manual review back office e collection flows.
- O README informa que o reposititorio open source esta em major rebuild e nao esta ativamente suportado.

Impacto: e boa referencia conceitual e de UX/workflow, mas nao deve ser adotado como base direta sem cautela.

## Estrutura monorepo

Confirmado em `pnpm-workspace.yaml`:

- `apps/*`
- `packages/*`
- `sdks/*`
- `services/*`

Confirmado por diretorios:

- Apps: `backoffice-v2`, `kyb-app`, `workflows-dashboard`.
- Services: `workflows-service`, `files-service`, `websocket-service`.
- Packages: `workflow-core`, `rules-engine`, `ui`, `blocks`, `common`, `react-pdf-toolkit`.
- SDKs: `web-ui-sdk`, `workflow-browser-sdk`, `workflow-node-sdk`.

## Backend principal

Confirmado:

- `services/workflows-service`.
- NestJS.
- Prisma.
- BullMQ/ioredis.
- EventEmitter.
- Schedule.
- Sentry.
- OpenTelemetry/Prometheus.

Evidencias:

- `services/workflows-service/package.json`.
- `services/workflows-service/src/app.module.ts`.

## Schema principal

Confirmado em `services/workflows-service/prisma/schema.prisma`:

- `EndUser`.
- `Business`.
- `WorkflowDefinition`.
- `WorkflowRuntimeData`.
- `Customer`.
- `Project`.
- `TransactionRecord`.
- `AlertDefinition`.
- `Alert`.
- `BusinessReport`.
- `Document`.
- `DocumentFile`.
- `WorkflowLog`.
- `Note`.

## Workflow runtime

Confirmado:

- `services/workflows-service/src/workflow/workflow.service.ts`.
- Uso de `createWorkflow`.
- Lock de runtime data com `findByIdAndLock`.
- Eventos de workflow.
- Transicao de estado.
- Emissao de `workflow.context.changed` e `workflow.state.changed`.
- Decisoes de documentos no contexto.

Valor para ComplianceHub: referencia forte para transformar revisao/conclusao em workflow rastreavel.

## Backoffice

Confirmado em `apps/backoffice-v2/src/router.tsx`:

- Merchant monitoring.
- KYB and ownership.
- Case management.
- Entities.
- Transaction monitoring alerts.
- Document page.

Valor para ComplianceHub: referencia de backoffice por entidades, documentos e casos.

## Collection flow e KYB app

Confirmado:

- `apps/kyb-app`.
- Endpoints `collection-flow`.
- UI dinamica.
- Document fields.
- Plugins runner.
- Revision fields.
- Workflow browser SDK.

Valor: bom modelo para coleta/correcao de dados pelo cliente e fluxos KYB.

## Alertas e transaction monitoring

Confirmado:

- `AlertDefinition`.
- `Alert`.
- `alert-queue.service.ts`.
- `transaction-monitoring-alerts`.
- `transaction.service.ts`.

Valor para ComplianceHub: alertas e monitoramento podem inspirar V3, mas nao devem dominar a V2 se o foco inicial for due diligence investigativa.

