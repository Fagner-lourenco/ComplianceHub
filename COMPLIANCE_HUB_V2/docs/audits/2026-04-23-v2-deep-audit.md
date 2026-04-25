# Auditoria Profunda V2 - 2026-04-23

## Escopo

Auditoria e correcoes da V2 executavel em `COMPLIANCE_HUB_V2/app`, mantendo a V2 isolada no Firebase `compliance-hub-v2`.

Nao houve deploy e nao houve leitura/escrita no Firebase real. As validacoes sensiveis foram feitas por codigo local, testes unitarios e Firestore emulator.

## Baseline

Estado confirmado antes/ao longo da rodada:

- `npm run guard:firebase`: projeto V2 fixado em `compliance-hub-v2`.
- `npm run check:functions`: sintaxe das Functions valida.
- `npm run lint`: verde.
- `npm test`: verde antes da rodada, 69 arquivos / 907 testes.
- `npm run build`: verde.
- `npm run test:rules`: verde antes da rodada, 23 testes emulator.

## Correcoes aplicadas

### 1. Prefixo publico das Cloud Functions V2

Todos os exports deployaveis de `functions/index.js` foram padronizados com prefixo `v2`.

Renomes aplicados:

- `enrichJuditOnCase` -> `v2EnrichJuditOnCase`
- `enrichBigDataCorpOnCase` -> `v2EnrichBigDataCorpOnCase`
- `enrichJuditOnCorrection` -> `v2EnrichJuditOnCorrection`
- `enrichEscavadorOnCase` -> `v2EnrichEscavadorOnCase`
- `enrichDjenOnCase` -> `v2EnrichDjenOnCase`
- `syncClientCaseOnCreate` -> `v2SyncClientCaseOnCreate`
- `syncClientCaseOnUpdate` -> `v2SyncClientCaseOnUpdate`
- `syncClientCaseOnDelete` -> `v2SyncClientCaseOnDelete`
- `publishResultOnCaseDone` -> `v2PublishResultOnCaseDone`
- `markProductIntroSeen` -> `v2MarkProductIntroSeen`

Tambem foram corrigidos handlers de trigger que referenciavam `event` sem recebe-lo explicitamente.

Teste novo:

- `functions/index.exports.test.js`

O teste falha se algum export deployavel voltar sem prefixo `v2` ou se nomes que colidem com a V1 forem reintroduzidos.

### 2. Guard Firebase V2

Criado teste de contrato para confirmar que `.firebaserc`, `.env.local`, `firebase.json`, package scripts e guard permanecem apontando para `compliance-hub-v2`.

Teste novo:

- `guard-v2-project.test.js`

Observacao: o teste contem a string literal do projeto proibido apenas como valor de comparacao. Arquivos de configuracao e scripts continuam sem apontar para `compliance-hub-br`.

### 3. Firestore rules e tenant isolation

O Firestore emulator revelou um achado real:

- `exports` permitia leitura por qualquer analista, inclusive tenant-scoped, sem validar `tenantId`.

Correcao:

- `exports` agora usa `canReadTenantDoc(resource.data.tenantId)` para ops e mantem leitura cliente somente no proprio tenant.

A suite emulator foi ampliada para cobrir:

- `clientProjections`
- `clientCases`
- `tenantAuditLogs`
- `alerts`
- `quoteRequests`
- `decisions`
- `reportSnapshots`
- `moduleRuns`
- `subjects`
- `persons`
- `companies`
- `facts`
- `relationships`
- `timelineEvents`
- `providerDivergences`
- `providerRequests`
- `evidenceItems`
- `riskSignals`
- `usageMeters`
- `billingSettlements`
- `exports`
- `watchlists`
- `monitoringSubscriptions`
- `seniorReviewRequests`
- `rawSnapshots`
- `providerRecords`
- `publicReports`

Resultado: `npm run test:rules` passou com 27 testes emulator.

### 4. Frontend tenant-safe em historico de sujeito

Achado:

- `fetchSubjectHistory()` e `fetchSubjectDecisionHistory()` consultavam `cases`, `decisions` e `reportSnapshots` por `subjectId`/`caseId` sem filtro opcional de `tenantId`.

Risco:

- Em usuario ops tenant-scoped, a query poderia falhar se retornasse documentos de outro tenant ou criar leitura ampla desnecessaria em colecoes internas.

Correcao:

- As funcoes aceitam `tenantId` opcional.
- `CasoPage` passa `caseData.tenantId`.
- As queries adicionam `where('tenantId', '==', tenantId)` quando disponivel.

Testes:

- `src/core/firebase/firestoreService.test.js` cobre historico de subject com tenant.

### 5. Contratos e imports de dominio

Verificado:

- Imports antigos removidos nao aparecem mais:
  - `v2FreshnessPolicy.cjs`
  - `v2ReviewPolicy.cjs`
  - `v2OperationalArtifacts.cjs`
- Imports atuais usam:
  - `v2FreshnessPolicyResolver.cjs`
  - `v2ReviewPolicyResolver.cjs`
  - `v2OperationalArtifactBuilder.cjs`

### 6. Publicacao, decision, divergencias, senior gate e premium

Verificado no codigo:

- `v2ConcludeCaseByAnalyst` valida auth, perfil, tenant e bloqueios de `moduleRuns`.
- Divergencia com `blocksPublication=true` bloqueia conclusao.
- `resolveReviewGate()` bloqueia conclusao quando senior review e exigido.
- `materializeV2PublicationArtifacts()` exige `moduleRunState` sem bloqueios e cria `Decision`, `ReportSnapshot`, `ClientProjection` e `PublicReport` de forma consistente.
- Billing V2 usa `usageMeters` com `dayKey` e `monthKey`.
- Watchlists usam pipeline real via `processSingleWatchlist`, caso fantasma com `billingCountable=false`, diff de `riskSignals`, persistencia de `alerts` e circuit breaker por falhas consecutivas.

## Validacoes executadas durante a rodada

Comandos focados ja executados:

```powershell
npm --prefix app run test -- functions/index.exports.test.js guard-v2-project.test.js src/core/firebase/firestoreService.test.js
npm run test:rules
node --check app\functions\index.js
```

Resultados:

- 3 arquivos focados / 33 testes passando.
- Firestore rules emulator: 27 testes passando.
- `node --check app\functions\index.js`: sucesso.

Validacao completa final:

```powershell
npm run guard:firebase
npm run check:functions
npm run lint
npm test
npm run build
npm run test:rules
```

Resultados finais:

- `npm run guard:firebase`: sucesso.
- `npm run check:functions`: sucesso.
- `npm run lint`: sucesso.
- `npm test`: 76 arquivos / 965 testes passando.
- `npm run build`: sucesso.
- `npm run test:rules`: 27 testes emulator passando.

Smoke local:

- Servidor Vite temporario em `http://127.0.0.1:5175/`.
- Rotas checadas por Playwright:
  - `/`
  - `/demo/client`
  - `/demo/ops`
  - `/demo/r/CASE-001`
- Resultado: todas carregaram com body nao vazio e sem erro critico de console.

Observacao sobre emulator:

- O Firestore emulator imprime warnings/stack traces para operacoes negadas por `assertFails`. Isso e esperado; o criterio de sucesso e o exit code do comando e a suite verde.

## Riscos remanescentes

- Nao houve deploy. Se houver Functions antigas sem prefixo ja publicadas no projeto V2, elas permanecem no ambiente remoto ate uma operacao explicita de deploy/delete. Este ciclo apenas corrige o codigo local e os contratos de teste.
- Smoke visual basico com Playwright foi executado para as rotas principais. Rotas autenticadas reais ainda dependem de sessao/perfil e devem ser validadas com fixture de auth em ciclo proprio, se necessario.
- A auditoria nao acessou Firebase real; qualquer divergencia de dados em producao deve ser tratada em ciclo proprio com plano de leitura segura ou export controlado.

## Comandos finais recomendados

Rodar sempre a partir de `COMPLIANCE_HUB_V2`:

```powershell
npm run guard:firebase
npm run check:functions
npm run lint
npm test
npm run build
npm run test:rules
npm run dev -- --port 5175
```

Smoke local recomendado:

- `http://127.0.0.1:5175/`
- `http://127.0.0.1:5175/demo/client`
- `http://127.0.0.1:5175/demo/ops`
- `http://127.0.0.1:5175/demo/r/CASE-001`
- rotas de produtos, alertas, cotacoes, watchlists, tenant settings e cockpit.

## Confirmacoes

- V1 nao foi alterada nesta auditoria.
- V2 continua apontando para `compliance-hub-v2`.
- Nenhum deploy foi executado.
- Nenhuma leitura/escrita foi feita no Firebase real.
