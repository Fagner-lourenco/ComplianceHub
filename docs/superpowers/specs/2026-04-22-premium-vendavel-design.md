# Premium Vendavel — Design consolidado (2026-04-22)

Consolida 5 sub-projetos para elevar o ComplianceHub V2 de "operacional" para "vendavel + premium" sem reescrever V1, sem inventar premium sem fluxo real, sem infra pesada.

Ordem de execucao: **B → D → C → E → A**. Cada sub-projeto encerra com `npm run test && npm run lint && npm run build` verde e commit proprio.

---

## B — Catalogo de produtos + wizard entitlement-aware

**Objetivo**: transformar o portal cliente em superficie de venda. Cliente ve o que tem contratado, o que pode contratar, e abre casos escolhendo o produto explicitamente.

**Arquitetura**
- Callable novo `getClientProductCatalog(request)`:
  - Consulta `tenantEntitlements/{tenantId}` (com fallback para `tenantSettings`).
  - Cruza com `PRODUCT_REGISTRY` do `functions/domain/v2Modules.cjs` (exportar novo registry caso nao exista).
  - Retorna `{ tenantId, contracted: Product[], available: Product[], upsell: Product[] }`.
- Wrapper front: `callGetClientProductCatalog` em `firestoreService.js`.
- Pagina nova: `src/portals/client/ProdutosPage.jsx`:
  - Tres secoes: "Meus produtos" (contracted), "Disponiveis agora" (enabledProducts true), "Upgrade" (registry menos contracted). CTA por card.
- `NovaSolicitacaoPage.jsx`:
  - Novo Step 0 "Escolher produto" consumindo `callGetClientProductCatalog`. Produto selecionado vai pra state `form.productKey` e muda renderizacao dos steps seguintes (PF vs PJ — ligar com D).
  - Produto upsell → abre modal "Solicitar proposta" (parte de E), nao cria caso.
- Route nova `/cliente/produtos` registrada no router cliente.

**Dados**
- Nenhuma coleção nova neste sub-projeto.
- `cases.productKey` ja existe no schema legado; backend `createClientSolicitation` deve validar que productKey esta em `enabledProducts`.

**RBAC/rules**: sem mudanca. Callables respeitam autenticacao client existente.

**Testes**
- Unit `ProdutosPage.test.jsx`: render 3 secoes com dados mock.
- Unit `NovaSolicitacaoPage.test.jsx` (atualizar): Step 0 seleciona produto, wizard adapta.
- Unit `v2ProductCatalog.test.js`: builder de catalog a partir de registry + entitlements.
- Backend `firestoreService.test.js`: wrapper callable.

**Definition of done**
- Route `/cliente/produtos` renderiza.
- Wizard nao permite criar caso sem produto.
- Produto upsell nunca cria caso.
- Tests + lint + build verdes.

---

## D — Dossier PJ wizard

**Objetivo**: hoje wizard so PF (CPF). Adicionar caminho PJ (CNPJ) quando `productKey === 'dossier_pj'`.

**Arquitetura**
- Componentes novos: `PJFormSteps.jsx` (empresa: razaoSocial, nomeFantasia, CNPJ com DV, UF sede, dataAbertura opcional).
- `NovaSolicitacaoPage.jsx` bifurca Step 1-3 baseado em `form.productKey`. PF usa flow atual, PJ usa `PJFormSteps`.
- Validador `validateCnpj` em `src/core/validators.js` (digits + DV algorithm oficial).
- Backend `createClientSolicitation`: aceita campos PJ quando product.type === 'pj'. Usa `v2SubjectManager.resolveSubject({ taxId: cnpj, taxIdType: 'cnpj' })` — ja suporta via ciclo anterior.

**Dados**
- `cases` recebe campos PJ: `cnpj`, `legalName`, `tradeName`, `openingDate?`, `jurisdiction='BR'`.
- `subjects.pjProfile` ja existe em `v2Subjects.buildPJProfile`.

**Testes**
- Unit `validateCnpj`: DV valido/invalido/mascarado.
- Unit `PJFormSteps`: render + validacao.
- Unit `NovaSolicitacaoPage`: PF vs PJ flow.

**Definition of done**
- Wizard cria caso PJ end-to-end.
- `subjects/{id}` criado com `pjProfile` populado.

---

## C — Alerts inbox cliente

**Objetivo**: quando watchlist (A) dispara alert, cliente ve no portal e pode marcar acionado/ignorado.

**Arquitetura**
- Coleção `alerts` (ja em rules). Escrita so backend. Schema: `{ id, tenantId, subjectId, caseId?, kind, severity, state, createdAt, message, actionedAt?, actionedBy? }`.
- Rule update: cliente mesmo-tenant pode atualizar `state` (read/actioned/dismissed). Callable auditavel `markAlertAs`.
- Pagina nova: `src/portals/client/AlertasClientePage.jsx` com subscription por tenantId.
- Dashboard cliente: KPI `alertsUnread` adicionado em `getClientDashboardMetrics`.
- Route nova `/cliente/alertas`.

**Dados**
- `alerts` colecao (ja tem rule read). Adicionar rule update limitada a `state`/`actionedAt`/`actionedBy` por client mesmo tenant.

**RBAC/rules**
- Escrita via callable server-side (preferida) OU rule granular field-level (aceitavel se Firestore suporta — validar).

**Testes**
- Unit `AlertasClientePage`: render + mark action.
- Unit `markAlertAs` callable.

**Definition of done**
- Cliente ve unread; marca actioned; dashboard KPI atualiza.

---

## E — Sales/upsell flow

**Objetivo**: cliente pede proposta para produto nao-contratado; ops aprova e contrata.

**Arquitetura**
- Coleção nova `quoteRequests/{id}` com schema: `{ tenantId, productKey, requestedBy, requestedAt, notes, status: 'pending'|'approved'|'rejected', reviewedBy?, reviewedAt?, responseNotes? }`.
- Callable `createQuoteRequest({ productKey, notes })` — client-facing.
- Callable `resolveQuoteRequest({ quoteId, decision, notes, addProduct? })` — ops-facing. Se `decision='approved'` e `addProduct=true`, chama `updateTenantEntitlementsByAnalyst` adicionando product.
- Pagina ops nova `src/portals/ops/CotacoesPage.jsx`. Route `/ops/cotacoes`.
- Pagina cliente: modal em ProdutosPage abre form "solicitar proposta".
- Audit: `QUOTE_REQUESTED`, `QUOTE_APPROVED`, `QUOTE_REJECTED`.
- Firestore rule: `quoteRequests` read mesmo-tenant (client+ops), create false (via callable), update/delete false.

**Testes**
- Unit `createQuoteRequest` + `resolveQuoteRequest`.
- Unit `CotacoesPage`: lista + approve flow.
- Unit modal ProdutosPage.

**Definition of done**
- Cliente solicita. Ops aprova. Produto aparece como contratado.

---

## A — Watchlist/monitoring real (premium real)

**Objetivo**: transformar stub `processSingleWatchlist` em reconsulta real + emissao de alertas.

**Arquitetura**
- `v2MonitoringEngine.processSingleWatchlist` passa a:
  1. Buscar subject + ultimo `reportSnapshot`/`moduleRuns` do subject.
  2. Criar caso "phantom" de monitoring (coleção `cases` com `source='watchlist'`, `parentSubjectId`, `status='RUNNING'`).
  3. Disparar pipeline enrichment reusado (mesma `materializeModuleRunsForCase`) limitado aos `modules` da watchlist.
  4. Rodar diff engine (`v2MonitoringDiff.cjs` novo): compara novo `riskSignals` vs ultimos por subject. Signals novos ou escalados geram `alerts/{id}` com `kind='watchlist_finding'`, `severity` herdada, `message` derivada.
  5. Atualizar watchlist: `lastRunAt`, `nextRunAt`, `runCount`, `lastAlertAt?`.
- Callables: `createWatchlist({ subjectId, modules, intervalDays })`, `pauseWatchlist`, `resumeWatchlist`, `deleteWatchlist`.
- Pagina ops nova `src/portals/ops/WatchlistsPage.jsx`.
- Route `/ops/watchlists`.

**Dados**
- `watchlists` (ja em rules, ja tem schema inicial em v2MonitoringEngine.addToWatchlist).
- `alerts` gerados — C consome.
- `cases` reaproveitado com flag `source='watchlist'`.

**Circuit breaker**
- Se provider/enrichment falha 3x seguidas para mesma watchlist → pause automatico. Evento audit `WATCHLIST_AUTOPAUSED`.

**Testes**
- Unit diff engine (novo riskSignal vs antigo → alert emitido).
- Unit `createWatchlist` callable.
- Unit `processSingleWatchlist` mock pipeline.
- Integration: watchlist → run → alert.

**Definition of done**
- Scheduled job processa watchlists ativas.
- Alerts persistidos aparecem em AlertasClientePage (C).
- UI ops cria/pausa watchlists.

---

## Riscos transversais e mitigacoes

- **Ordem importa**: B desbloqueia D/C/E/A (produto eh primeiro cidadao). D liga PF/PJ em wizard. C consome alerts de A. E escreve em `tenantEntitlements` via callable ja existente. A eh o ultimo pois depende de mais superficie.
- **Entitlements fallback**: tenants sem `tenantEntitlements` doc: B/E tratam via `legacyTenantSettingsFallback` ja presente.
- **Quota/limites**: monitoring job precisa respeitar `maxCasesPerMonth` se configurado; phantom cases devem contar separado (flag `billingCountable=false` em `usageMeters` quando `source='watchlist'`).
- **Performance**: monitoring batch ja tem `limit(100)`. OK.
- **Rules**: novas coleções (`quoteRequests`) precisam rule. Alerts update rule (C) exige cuidado — preferir callable.

## Estrutura de commits

Um commit por sub-projeto, mensagem estilo Conventional Commits:

- `feat(portal-cliente): catalogo de produtos + wizard entitlement-aware (sub-projeto B)`
- `feat(portal-cliente): dossier PJ wizard (sub-projeto D)`
- `feat(portal-cliente): alerts inbox cliente (sub-projeto C)`
- `feat(portal-ops): sales/upsell flow com quoteRequests (sub-projeto E)`
- `feat(premium): watchlist/monitoring real com diff engine (sub-projeto A)`

## Done-done checklist final

- [ ] 5 sub-projetos implementados
- [ ] Cada um com testes passando localmente
- [ ] `npm run test`: verde
- [ ] `npm run lint`: 0 erros
- [ ] `npm run build`: sucesso
- [ ] Rules atualizadas onde necessario (`quoteRequests`)
- [ ] Plano mestre atualizado com ciclo PREMIUM-VENDAVEL
- [ ] Memory `project_v2_cockpit_status.md` atualizado
