# Inventario profundo do Marble

## Repositorios analisados

- `modelos/marble`: repositorio principal.
- `modelos/marble-backend`: backend clonado por HTTPS por causa de submodule SSH.
- `modelos/marble-frontend`: frontend clonado por HTTPS por causa de submodule SSH.

## Proposta de produto

Confirmado no README e no codigo: Marble e uma plataforma de decisioning/risk/AML com foco em transaction monitoring, screening, continuous monitoring, investigation suite, reporting, audit trail e controle operacional.

Inferencia arquitetural: Marble esta mais proximo de um motor de decisao e operacao de alertas do que de uma plataforma de due diligence brasileira com relatorios comerciais.

## Stack backend

Confirmado em `modelos/marble-backend/go.mod`:

- Go.
- Gin para HTTP.
- PostgreSQL/pgx.
- Redis.
- River queue.
- OpenTelemetry.
- Prometheus.
- Sentry.
- BigQuery.
- Firebase.

Isso indica arquitetura backend mais industrializada para API, filas, metricas, observabilidade e persistencia relacional.

## Estrutura backend

Confirmado:

- `api`: rotas HTTP.
- `cmd`: comandos/entradas.
- `dto`: DTOs.
- `infra`: infraestrutura.
- `jobs`: jobs/filas.
- `models`: modelos de dominio.
- `repositories`: acesso a dados.
- `usecases`: regras de aplicacao.
- `pubapi`: API publica.
- `integration_test`: testes de integracao.

Inferencia: Marble tem separacao de responsabilidades superior ao ComplianceHub atual, especialmente entre models, usecases, repositories e api.

## Dominios centrais confirmados

Confirmado em `models`:

- `Case`.
- `CaseEvent`.
- `Decision`.
- `DataModel`.
- `Table`.
- `Field`.
- `Screening`.
- `ScreeningMatch`.
- `Workflow`.
- `AuditEvent`.
- `WebhookEvent`.

## Rotas e capacidades

Confirmado em `api/routes.go`:

- Decisions: `/decisions`.
- Client data related cases: `/client_data/:object_type/:object_id/cases`.
- Client360: `/client360/tables`, `/client360/search`.
- Screenings: `/screenings`.
- Continuous screenings: `/continuous-screenings`.
- Analytics: `/analytics`.
- Cases: `/cases`.
- Inboxes: `/inboxes`.
- Data model: `/data-model`.
- Webhooks: `/webhooks`.
- Workflows: `/workflows`.

## Decisioning

Confirmado:

- `usecases/decision_usecase.go:CreateAllDecisions`.
- `usecases/evaluate_scenario/evaluate_scenario.go`.
- `MAX_CONCURRENT_RULE_EXECUTIONS`.
- Execucao de screening integrada a avaliacao de scenario.
- Persistencia de decisions e acionamento de workflows.

Valor para ComplianceHub V2: separar decisao de caso. Um caso pode conter uma ou mais decisoes, cada decisao com regra, evidencia, score e explicacao.

## Case management

Confirmado:

- `models/case.go` define caso com decisoes, eventos, inbox, assigned user, status, outcome, tags, arquivos e review level.
- `usecases/case_usecase.go` contem listagem, adicao de decisoes ao caso, revisao de decisoes e outros fluxos.

Valor para ComplianceHub V2: trazer conceitos de inbox, eventos, outcome, tags e revisao estruturada.

## Data model e Client360

Confirmado:

- `models/data_model.go` modela `DataModel`, `Table`, `Field`, links, navigation options e pivots.
- `api/routes.go` expoe `/client360` e `/data-model`.
- Frontend tem `DataModelExplorer`, `ClientDetailPage`, `PivotsPanel`.

Valor para V2: inspirar o dossie por entidade e navegacao por relacionamentos.

Alerta: copiar um data model generico demais pode ser overengineering para a V2. O ComplianceHub precisa primeiro de um modelo canonico brasileiro e investigativo.

## Screening e monitoramento continuo

Confirmado:

- `models/screening.go`.
- Rotas `/screenings` e `/continuous-screenings`.
- `usecases/continuous_screening/usecase.go`.

Valor para V2/V3: watchlists, screening recorrente e alertas de mudanca. Para V2, deve entrar apenas a fundacao; monitoramento continuo pleno pode ficar para V3.

