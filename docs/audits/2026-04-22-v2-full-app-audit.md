# Auditoria Full App ComplianceHub V2 - 2026-04-22

## Escopo auditado

- Backend: `functions/index.js`, `functions/domain/*.cjs`, `functions/audit/*`, callables premium e scheduled jobs.
- Frontend cliente: produtos, nova solicitacao PF/PJ, alertas, dashboard, solicitacoes e relatorios.
- Frontend ops: caso, tenant settings, metricas, cotacoes, watchlists, auditoria, router/sidebar.
- Seguranca: `firestore.rules`, RBAC, tenant isolation, public reports, raw data, alerts, quoteRequests e watchlists.
- Qualidade: testes, lint, build, `node --check` e `git diff --check`.

## Estado confirmado

- Ciclo `PREMIUM-VENDAVEL (2026-04-22)` esta registrado no plano mestre.
- Catalogo de produtos, wizard PF/PJ, alertas cliente, cotacoes/upsell, watchlists ops e monitoring engine existem no codigo real.
- Rotas `/ops/cotacoes`, `/ops/watchlists`, pagina de produtos e inbox de alertas cliente estao registradas.
- `watchlists`, `alerts` e `quoteRequests` possuem regras Firestore basicas e callables backend.
- `npm test`, `npm run lint`, `node --check functions/index.js` e `npm run build` estavam verdes antes deste ciclo.

## Achados corrigidos neste ciclo

### MEDIO - Watchlist nao podia ser executada sob demanda

- Evidencia: `scheduledMonitoringJob` chamava `processWatchlists`, mas nao havia callable `runWatchlistNow` nem botao em `WatchlistsPage`.
- Impacto: ops dependia exclusivamente do schedule para validar uma watchlist ou investigar alerta recente.
- Correcao: criado callable `runWatchlistNow`, service frontend e acao "Executar agora" em `WatchlistsPage`.

### MEDIO - Caso concluido nao tinha entrada operacional para watchlist

- Evidencia: `callCreateWatchlist` existia, mas `CasoPage` nao expunha acao contextual apos conclusao/publicacao.
- Impacto: monitoramento premium dependia de criacao indireta, reduzindo aderencia operacional.
- Correcao: adicionado painel "Monitoramento continuo" no caso, visivel apenas quando o caso esta concluido/publicado, tem `subjectId`, permissao ops e entitlement/capability de monitoramento.

### BAIXO - Plano mestre tinha blank line excedente no EOF

- Evidencia: `git diff --check` falhava em `PLANO_EXECUCAO_V2_MASTER.md`.
- Correcao: o plano foi regravado com novo ciclo e sem linha em branco excedente no fim.

## Achados corrigidos apos a rodada inicial

### ALTO - Suite emulator real de Firestore rules foi criada

- Criado `npm run test:rules` com Firebase Emulator + `@firebase/rules-unit-testing`.
- Cobertura real: tenant isolation, client-safe projections, alerts, quoteRequests, raw access senior-only, backend-owned writes e public report token lifecycle.

### MEDIO - Raw payload Storage foi ligado ao pipeline para payload grande

- Criado `v2RawPayloadStorage.cjs`.
- `materializeModuleRunsForCase` agora externaliza payload grande em Cloud Storage via Admin SDK antes de gravar `rawSnapshots`.
- `rawSnapshots` passam a carregar `retentionPolicy` e `visibility` explicitos.

### MEDIO - Senior review queue dedicada foi materializada no backend

- Criado contrato `seniorReviewRequests` com request idempotente por caso.
- `concludeCaseByAnalyst` passa a registrar pendencia quando `ReviewGate` exige senior e o ator nao tem aprovacao.
- Criados callables `getSeniorReviewQueue` e `resolveSeniorReviewRequest` para approve/reject auditavel.
- `getOpsV2Metrics` agora inclui fila senior dedicada como fonte primaria de pendencias.

### MEDIO - Billing drilldown/export foi fechado no backend

- Criado `v2BillingDrilldown.cjs`.
- Criados callables `getTenantBillingDrilldown` e `exportTenantBillingDrilldown`.
- A leitura usa `usageMeters` como fonte atomizada e settlement apenas como contexto/materializacao.
- Custo interno e retornado apenas para roles com `BILLING_VIEW_INTERNAL_COST`.

### MEDIO - Portal cliente fallback audit aplicado em helpers/services

- `clientCaseList`, `clientCases` e `publicResult/latest` ainda aparecem como compatibilidade.
- `subscribeToClientCases` e `fetchClientCases` agora marcam fallback com `legacyFallbackUsed` e `legacyFallbackSource`.
- `resolveClientCaseView` nao usa mais `caseData.reportReady` para liberar estado visual de relatorio pronto.
- A abertura de relatorio segue dependente de `ClientProjection.reportAvailability.status === 'ready'` com token valido.

## Validacao deste ciclo

- `npm run test -- functions/audit/auditCatalog.test.js src/core/firebase/firestoreService.test.js src/portals/ops/WatchlistsPage.test.jsx src/portals/ops/CasoPage.test.jsx`: 4 arquivos, 137 testes passando.
- `npm run test -- functions/domain/v2SeniorReviewQueue.test.js functions/domain/v2BillingDrilldown.test.js functions/audit/auditCatalog.test.js src/core/firebase/firestoreService.test.js src/core/clientPortal.test.js firestore.rules.test.js`: 6 arquivos, 162 testes passando.
- `npm test`: 65 arquivos, 867 testes passando.
- `npm run test:rules`: 1 arquivo, 23 testes emulator passando.
- `npm run lint`: 0 erros.
- `node --check functions/index.js`: OK.
- `npm run build`: OK.
- `git diff --check`: sem erro material; apenas avisos CRLF esperados no Windows.
- `npm audit --omit=dev`: 0 vulnerabilidades de producao.

## Proxima ordem recomendada

1. Planejar UI/UX pass com referencias visuais do usuario.
2. Implementar telas/painel visual para fila senior e drilldown de billing sem alterar contratos backend.
3. Criar commits logicos ou PR de estabilizacao antes de nova frente grande.
