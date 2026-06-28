# ADR-011 — Escavador2 assíncrono com callback

Data: 2026-06-28

## Contexto

A API Escavador2 passou a recomendar o endpoint `/escavador2/consultar/async`, com Cloud Tasks e callback, porque consultas completas com `detalhar=true`, `movimentacoes=risk_only` e `documentos=risk_only` podem levar até 15 minutos. O fluxo síncrono do ComplianceHub tinha timeout local de 5 minutos e executava dentro de Cloud Functions, o que não é adequado para consultas longas e instáveis.

## Decisão

O ComplianceHub passa a enfileirar consultas Escavador2 via `/escavador2/consultar/async` e processar resultados por uma Cloud Function HTTP `escavador2Callback`. O caso permanece com `escavador2EnrichmentStatus = "RUNNING"` e `escavador2CallbackStatus = "QUEUED"` até receber callback `DONE`, `PARTIAL` ou `FAILED`.

## Consequências

- A classificação automática aguarda o Escavador2 terminalizar.
- Callbacks são autenticados com `X-Internal-Api-Key` e idempotentes via `escavador2Tasks/{caseId:generation}`, com `taskId` salvo apenas como metadado de auditoria quando existir.
- Callbacks stale são descartados por `enrichmentGeneration`.
- Falhas finais marcam `FAILED` e liberam a classificação, mantendo Escavador2 não-bloqueante.
- Raw payloads seguem internos e não são publicados em `publicResult` ou `clientCases`.

## Operação

Configurar `ESCAVADOR2_CALLBACK_URL` no ambiente das Functions com a URL pública da função `escavador2Callback` após deploy. No serviço Escavador2 Cloud Run, manter fila `escavador2-consultas` em `southamerica-east1`, com no máximo 3 dispatches/minuto e 2 concorrentes.
