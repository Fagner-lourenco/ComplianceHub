# Achados tecnicos do Ballerine

## ACH-BL-001: Projeto open source em reconstrucao

Confirmado no README: o reposititorio open source esta em major rebuild e nao ativamente suportado.

Risco: usar como base direta aumenta risco de dependencia e retrabalho.

Recomendacao: usar como referencia, nao como fundacao.

## ACH-BL-002: Workflow runtime e ponto forte

Confirmado:

- `WorkflowDefinition`.
- `WorkflowRuntimeData`.
- `WorkflowService`.
- Eventos e transicoes.
- Locks em runtime data.
- Emissao de eventos de estado e contexto.

Relevancia: ComplianceHub precisa de workflow mais formal para revisao, pendencias, aprovacao, republicacao, contestacao e reanalise.

## ACH-BL-003: Collection flow e documentos sao muito relevantes

Confirmado:

- `apps/kyb-app`.
- `collection-flow.api.ts`.
- `DocumentField`.
- `useRevisionFields`.
- `PluginsRunner`.

Relevancia: a V2 pode melhorar a experiencia de cliente para enviar dados, documentos e respostas, sem expor complexidade investigativa.

## ACH-BL-004: Entidade Business/EndUser e bom paralelo para PF/PJ

Confirmado:

- `EndUser`.
- `Business`.
- relacao `EndUsersOnBusinesses`.

Relevancia: ComplianceHub precisa de `Person` e `Company` como entidades canonicas, com relacionamento societario e operacional.

## ACH-BL-005: Alertas e transaction monitoring sao uteis, mas nao para o MVP V2

Confirmado:

- `AlertDefinition`.
- `Alert`.
- `TransactionRecord`.
- `alert-queue.service.ts`.

Recomendacao: inspirar watchlists/monitoramento futuro. Para V2, criar apenas `RiskSignal` e `Alert` simples.

## ACH-BL-006: SDKs e plugin system podem ser overengineering

Confirmado:

- `sdks/web-ui-sdk`.
- `sdks/workflow-browser-sdk`.
- `sdks/workflow-node-sdk`.
- `packages/workflow-core`.

Recomendacao: nao criar SDK publico na V2. Criar primeiro contratos internos estaveis.

