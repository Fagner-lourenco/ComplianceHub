# Mapa arquitetural do Marble

## Visao geral

```txt
Frontend app-builder
  -> API Marble backend
  -> Usecases
  -> Repositories
  -> PostgreSQL
  -> Jobs/River/Redis
  -> Screening providers / data model / analytics
```

## Backend

Camadas confirmadas:

- API HTTP em `api/routes.go`.
- Dominio em `models`.
- Usecases em `usecases`.
- Persistencia em `repositories`.
- Jobs em `jobs`.
- Infra em `infra`.

Padrao importante: a regra de negocio nao fica concentrada em um arquivo unico. Isso e uma referencia forte para modularizar o ComplianceHub.

## Frontend

Confirmado no Marble frontend:

- Workspace com `packages/app-builder`, `packages/marble-api`, `packages/ui-design-system`.
- Rotas operacionais em `packages/app-builder/src/routes/_app/_builder`.
- Telas para `cases`, `client-detail`, `continuous-screening`, `data`, `detection`, `screening-search`, `settings`, `upload`, `user-scoring`, `analytics-legacy`.

## Case investigation UI

Confirmado:

- `CaseInvestigation`: historico/eventos do caso.
- `DecisionPanel`: detalhes de regras e screening da decisao.
- `PivotsPanel`: objetos pivot e exploracao.
- `DataModelExplorer`: navegacao por dados relacionados.
- `KycEnrichment`: enriquecimento sob demanda.
- `SnoozePanel`: silenciamento/adiamento de regras.

## Padroes arquiteturais relevantes

- Case management separado de decisioning.
- Data model separado dos casos.
- Screening separado das decisoes.
- Workflows acionados por decisoes.
- Audit/event trail como parte do dominio operacional.
- Frontend com workspace investigativo por caso e por entidade.

## O que o Marble nao resolve diretamente para ComplianceHub

Nao confirmado no Marble analisado:

- BigDataCorp como provider principal.
- Modelo brasileiro CPF/CNPJ/processos/mandados como dominio central.
- Relatorio publico comercial equivalente ao ComplianceHub.
- Portal cliente de solicitacoes com experiencia simples e white-label.

## Leitura estrategica

Marble e referencia para disciplina de plataforma: dominios separados, decisioning, screening, case management, data model e observabilidade. Mas nao deve ser copiado como produto final, porque o problema do ComplianceHub e investigativo brasileiro, nao apenas AML transaction monitoring.

