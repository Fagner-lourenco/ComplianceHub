# Mapa arquitetural do Ballerine

## Visao geral

```txt
apps/backoffice-v2
apps/kyb-app
apps/workflows-dashboard
  -> services/workflows-service
  -> Prisma/Postgres
  -> BullMQ/Redis
  -> workflow-core / rules-engine
  -> providers/plugins
  -> documents/files
```

## Backoffice

O backoffice e organizado em dominios:

- alerts.
- assessments.
- business-reports.
- collection-flow.
- customer.
- documents.
- entities.
- individuals.
- merchant monitoring.
- notes.
- transactions.
- workflow definitions.
- workflows.

Isso demonstra uma arquitetura de dominio mais modular do que o ComplianceHub atual.

## Workflow service

O `workflows-service` concentra:

- Auth.
- Business.
- End user.
- Workflow.
- Workflow definition.
- Collection flow.
- Documents.
- Providers.
- Rule engine.
- Transaction.
- Alerts.
- Webhooks.

## Workflow runtime

O fluxo central parece ser:

```txt
WorkflowDefinition
  -> WorkflowRuntimeData
  -> context
  -> event
  -> rule engine
  -> transition
  -> logs/hooks
  -> backoffice/manual review
```

Isso e muito relevante para a V2 quando o ComplianceHub precisar orquestrar revisao, pendencias, coleta adicional e conclusao.

## Collection flow

O app KYB usa endpoints `collection-flow` para:

- Buscar configuracao.
- Sincronizar contexto.
- Criar usuario.
- Obter dados de negocio.
- Submeter finalizacao.
- Listar documentos.
- Enviar arquivos.

Essa parte e uma referencia para melhorar o fluxo de correcao/pendencia do cliente no ComplianceHub.

## Complexidade

Ballerine e muito mais complexo que o necessario para o primeiro desenho da V2 do ComplianceHub.

Riscos se copiar:

- Monorepo pesado.
- SDKs antes da hora.
- Plugin system generico cedo demais.
- Workflow runtime complexo antes de modelo de evidencias.
- Dependencia em Postgres/Redis/BullMQ/NestJS sem migracao planejada.

