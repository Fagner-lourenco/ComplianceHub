# Achados tecnicos do Marble

## ACH-MB-001: Separacao clara de backend por camadas

Confirmado:

- `models`.
- `usecases`.
- `repositories`.
- `api`.
- `jobs`.

Relevancia: e exatamente o tipo de separacao que o ComplianceHub precisa para sair de `functions/index.js` monolitico.

## ACH-MB-002: Case e Decision sao dominios separados

Confirmado:

- `models/case.go`.
- `models/decision.go`.
- `usecases/case_usecase.go`.
- `usecases/decision_usecase.go`.

Relevancia: ComplianceHub hoje mistura conclusao, resultado, score e relatorio no caso. V2 deve separar `InvestigationCase` de `Decision`.

## ACH-MB-003: Rules/screening geram explicabilidade

Confirmado:

- `usecases/evaluate_scenario/evaluate_scenario.go` executa regras e screening.
- `DecisionPanel` no frontend mostra regras/screening.

Relevancia: ComplianceHub V2 precisa explicar cada score e veredito, nao apenas gravar `riskScore`.

## ACH-MB-004: Data model e pivots sao muito poderosos

Confirmado:

- `models/data_model.go`.
- `DataModelExplorer`.
- `PivotsPanel`.
- `ClientDetailPage`.

Risco: copiar isso integralmente geraria overengineering.

Recomendacao: adaptar para modelo canonico fixo inicialmente, com extensibilidade futura.

## ACH-MB-005: Continuous screening e uma referencia para V3

Confirmado:

- Rotas e usecases de `continuous-screenings`.

Relevancia: watchlists e monitoramento continuo sao objetivos futuros do ComplianceHub, mas dependem primeiro de entidade canonica e evidence store.

## ACH-MB-006: Marble nao e uma base direta para ComplianceHub

Confirmado/inferido:

- Foco do Marble e AML/decisioning/screening.
- BigDataCorp e investigacao brasileira nao foram confirmadas.

Recomendacao: usar como referencia arquitetural, nao como fundacao de codigo.

