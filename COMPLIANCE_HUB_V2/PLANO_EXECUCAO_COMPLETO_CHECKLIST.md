# Plano de Execução Completo — ComplianceHub V2
## Checklist de Implementação Item a Item

**Data de criação:** 2026-04-23  
**Meta:** Aplicativo V2 pronto para produção (seguro, testado, integrado)  
**Total estimado de itens:** 42

---

## 📋 ÍNDICE DE WAVES

- [Wave 1 — Segurança & Integridade (5 itens)](#wave-1)
- [Wave 2 — BigDataCorp Integration (7 itens)](#wave-2)
- [Wave 3 — Arquitetura V2 Mínima (6 itens)](#wave-3)
- [Wave 4 — Testes & Qualidade (8 itens)](#wave-4)
- [Wave 5 — UX & Polimento (5 itens)](#wave-5)
- [Wave 6 — Deploy & Validação Final (6 itens)](#wave-6)

---

## <a name="wave-1"></a>🔴 WAVE 1 — Segurança & Integridade (Deployável)
> **Objetivo:** Eliminar bugs críticos que bloqueiam deploy em produção.

### Item 1.1 — Remover `exports.__test` da produção
- [ ] Criar `functions/__test-helpers.js` separado
- [ ] Mover `_setDb`, `_setWriteAuditEvent` e helpers de teste para o novo arquivo
- [ ] Condicionar export de `__test` em `index.js`: `if (process.env.FUNCTIONS_EMULATOR === 'true')`
- [ ] Atualizar testes que usam `mod.__test` para importar do novo arquivo
- [ ] **Teste:** `node -e "console.log(Object.keys(require('./functions/index.js')))"` não deve listar `__test`
- [ ] **Teste:** Suite completa continua passando

### Item 1.2 — Validar `productKey` em `markProductIntroSeen`
- [ ] Adicionar validação contra `PRODUCT_REGISTRY` no callable `v2MarkProductIntroSeen`
- [ ] Rejeitar com `invalid-argument` se `productKey` não estiver no catálogo
- [ ] Sanitizar a chave antes de usar como path no Firestore
- [ ] **Teste:** Enviar `productKey: 'injected/../../admin'` → deve rejeitar
- [ ] **Teste:** Enviar `productKey: 'dossier_pf_full'` → deve aceitar

### Item 1.3 — Corrigir rotas do ProductHub/Pipeline no portal `/client`
- [ ] Adicionar `/client/hub` no `App.jsx` (portal cliente real, não só `/demo/client`)
- [ ] Adicionar `/client/pipeline/:productKey` no `App.jsx`
- [ ] Verificar que `ProductHubPage` navega corretamente para `/client/pipeline/...`
- [ ] Verificar que Sidebar link "Centro de produtos" aponta para `/client/hub`
- [ ] **Teste:** Navegar de `/client/hub` → clicar em produto → chegar em `/client/pipeline/dossier_pf_full`

### Item 1.4 — Fixar `ongoing_monitoring` step 'config'
- [ ] Alterar `ongoing_monitoring.steps` em `productPipelines.js`: `'config'` → `'subject'`
- [ ] OU criar `ConfigStep` component básico e mapear em `STEP_COMPONENTS`
- [ ] **Teste:** Selecionar produto `ongoing_monitoring` no pipeline não quebra com "Passo desconhecido"

### Item 1.5 — Fazer `createClientSolicitation` respeitar `requestedModuleKeys`
- [ ] Alterar `inferRequestedModuleKeys` em `v2Core.cjs` para priorizar `request.data.requestedModuleKeys`
- [ ] Validar módulos contra `productContract.requiredModules` + `productContract.optionalModules`
- [ ] Rejeitar módulos não-contratados com erro claro
- [ ] Remover fallback hardcoded `['identity_pf', 'criminal', 'labor', 'warrants']`
- [ ] **Teste:** Frontend seleciona apenas `identity_pf` + `kyc` → backend executa só esses
- [ ] **Teste:** Frontend seleciona módulo não-contratado → backend rejeita com erro
- [ ] **Teste:** Suite completa passa

---

## <a name="wave-2"></a>🟠 WAVE 2 — BigDataCorp Integration (Phase 3)
> **Objetivo:** BDC como fonte principal, com ledger, snapshots e evidence pipeline completos.

### Item 2.1 — Wiring do trigger BDC com Provider Ledger + Raw Snapshot
- [ ] Modificar `v2EnrichBigDataCorpOnCase` para chamar `createProviderRequest` antes de consultar BDC
- [ ] Chamar `createRawSnapshot` com o payload retornado
- [ ] Chamar `resolveProviderRequest` com status/custo após resposta
- [ ] Vincular `rawSnapshotId` ao `ProviderRequest`
- [ ] **Teste:** Criar caso → verificar `providerRequests/{id}` criado com status 'completed'
- [ ] **Teste:** Verificar `rawSnapshots/{id}` criado com payload hash

### Item 2.2 — Evidence Pipeline (BDC → ProviderRecord → EvidenceItem)
- [ ] Criar `functions/domain/v2ProviderRecord.cjs` (normalização → registro imutável)
- [ ] Criar função `materializeProviderRecords(snapshotId, normalizedData)`
- [ ] Modificar `v2EnrichBigDataCorpOnCase` para gerar `ProviderRecord`s após normalização
- [ ] Modificar `v2EnrichBigDataCorpOnCase` para gerar `EvidenceItem`s a partir dos records
- [ ] **Teste:** Criar caso → verificar `evidenceItems` com source='bigdatacorp'
- [ ] **Teste:** Evidence items têm `providerRequestId` e `rawSnapshotId` vinculados

### Item 2.3 — Freshness/Reuse Logic no BDC Flow
- [ ] Integrar `findReusableProviderRequest` no trigger BDC
- [ ] Se snapshot reutilizado: chamar `markProviderRequestReused`
- [ ] Pular consulta BDC se freshness válida
- [ ] **Teste:** Criar caso #1 → consulta BDC real → criar caso #2 (mesmo CPF, < 24h) → reutiliza snapshot
- [ ] **Teste:** Caso #2 tem `providerRequest` com status='reused' e `reusedSnapshotId`

### Item 2.4 — Callable `v2PreviewBigDataCorp` (Preview Interno Ops)
- [ ] Criar callable `v2PreviewBigDataCorp` em `index.js`
- [ ] Só acessível por roles `analyst`, `seniorAnalyst`, `opsManager`, `admin`
- [ ] Recebe `cpf` + `datasets` + `tenantId`
- [ ] Retorna normalização sem criar case/evidence (preview puro)
- [ ] Registrar em `auditEvents` como `provider.preview_executed`
- [ ] **Teste:** Analyst chama callable com CPF válido → retorna dados normalizados
- [ ] **Teste:** ClientUser chama callable → rejeita com `permission-denied`

### Item 2.5 — Testes para Adapter BDC ✅
- [x] Criar `functions/adapters/bigdatacorp.test.js`
- [x] Testar `queryCombined` com mock fetch
- [x] Testar retry em 429/5xx
- [x] Testar `BigDataCorpError` com `retryable` flag
- [x] Testar timeout
- [x] **Meta:** 8 testes passando

### Item 2.6 — Testes para Normalizer BDC ✅
- [x] Criar `functions/normalizers/bigdatacorp.test.js`
- [x] Testar `normalizeBigDataCorpBasicData` com sample payload V1
- [x] Testar `normalizeBigDataCorpProcesses` — contagem, flags criminal/labor
- [x] Testar `normalizeBigDataCorpKyc` — PEP, sanctions com MatchRate ≥ 90
- [x] Testar `normalizeBigDataCorpProfession` — job, employer, income
- [x] **Meta:** 10 testes passando

### Item 2.7 — Testes de Integração E2E para BDC Flow ✅
- [x] Criar teste que simula caso completo: case created → trigger → providerRequest → rawSnapshot → evidenceItems
- [x] Mockar adapter para não bater na API real
- [x] Verificar que `moduleRuns` é materializado após completion
- [x] **Meta:** 5 testes de integração passando (CPF invalid, happy path DONE, gate BLOCKED, adapter FAILED, snapshot REUSED)

---

## <a name="wave-3"></a>🟡 WAVE 3 — Arquitetura V2 Mínima
> **Objetivo:** Materializar conceitos-chave da V2 que estão só no papel.

### Item 3.1 — Materializar `effectiveModuleKeys` e `moduleRuns` ✅
- [x] Criar função `resolveEffectiveModuleKeys(caseDoc)` que combina:
  - `requestedModuleKeys` do payload
  - `productContract.requiredModules`
  - `tenantEntitlements.enabledModules`
- [x] Persistir `effectiveModuleKeys` no doc `cases/{caseId}`
- [x] Garantir que cada módulo em `effectiveModuleKeys` gera um `moduleRun`
- [x] **Teste:** Produto com módulos obrigatórios + opcionais selecionados → `effectiveModuleKeys` correto
- [x] **Teste:** Módulo não-contratado não aparece em `effectiveModuleKeys`

### Item 3.2 — Máquina de Estados V2 Básica ✅
- [x] Definir enum `CASE_STATUS_V2`: `received` → `enriching` → `review_ready` → `in_review` → `decision_approved` → `published`
- [x] Criar função `transitionCaseStatus(caseId, event)` com validação de transições válidas
- [x] Mapear estados legado para V2:
  - `PENDING` → `received`
  - `RUNNING` → `enriching`
  - `DONE` → `published` (se já tem decision)
- [x] **Teste:** Transição `received` → `enriching` → `review_ready` funciona
- [x] **Teste:** Transição inválida (`received` → `published`) rejeita

### Item 3.3 — Feature Flags Mínimas ✅
- [x] Adicionar campo `featureFlags` em `tenantConfigs/{tenantId}` (via `resolveTenantEntitlements`)
- [x] Criar helper `isFeatureEnabled(flagName, tenantId)` em backend (`isTenantFeatureEnabled`)
- [x] Criar hook `useFeatureFlag(flagName)` no frontend
- [x] Flags iniciais: `CASE_CREATION`, `REPORT_EXPORT_PDF`, `EVIDENCE_ITEMS`, `RISK_SIGNALS`, `TIMELINE_VIEW`, `WATCHLIST_MONITORING`, etc.
- [x] Callable `v2GetFeatureFlags` para ops ler flags do tenant
- [x] **Teste:** Hook retorna empty flags sem tenant
- [x] **Teste:** Suite de entitlements valida tier-based flags

### Item 3.4 — ProviderRecords Collection ✅
- [x] Criar schema `providerRecords/{recordId}` com todos os campos requeridos
- [x] Modificar trigger BDC para escrever em `providerRecords` com campo `normalizedData`
- [x] **Teste:** ProviderRecord criado com hash do raw snapshot vinculado (validado em `index.bigdatacorp.test.js`)

### Item 3.5 — Freshness Policy Resolver Ativo ✅
- [x] Integrar `v2FreshnessPolicyResolver.cjs` no fluxo de `createClientSolicitation`
- [x] Resolver freshness por módulo e persistir `moduleFreshnessPolicies` no caso
- [x] Usar `getFreshnessPolicy` para TTL por moduleKey (removido status de "dead code")
- [x] **Teste:** Freshness policy TTL já testado em `v2FreshnessPolicyResolver.test.js` (14 testes)

### Item 3.6 — Entitlement Resolver Ativo ✅
- [x] Integrar `v2EntitlementResolver.cjs` em `createClientSolicitation`
- [x] Substituir validação inline de entitlement pelo resolver centralizado (`resolveTenantEntitlements` + `isTenantFeatureEnabled`)
- [x] Feature-gate `CASE_CREATION` ativado no callable
- [x] **Teste:** `v2EntitlementResolver.test.js` cobre resolve, tier, overrides (18 testes)

---

## <a name="wave-4"></a>🟢 WAVE 4 — Testes & Qualidade
> **Objetivo:** Cobertura mínima nos gaps críticos, meta: 1000+ testes.

### Item 4.1 — Testes dos 4 Slots Principais do Case Engine
- [ ] `ModuleRunsSlot.test.jsx` — renderiza runs, contagem, estado vazio
- [ ] `RiskSignalsSlot.test.jsx` — renderiza sinais, ordenação por severidade
- [ ] `EvidenceSlot.test.jsx` — agrupa por módulo, badges de severidade
- [ ] `V2RiskSummarySlot.test.jsx` — resumo com/sem sinais
- [ ] **Meta:** 8+ testes passando

### Item 4.2 — Testes do CaseEngine Shell
- [ ] `CaseEngine.test.jsx` — renderiza com dados mock, slots resolvidos
- [ ] Testar que `slotRegistry.resolveSlotsForProduct` é usado
- [ ] **Meta:** 3+ testes passando

### Item 4.3 — Fixar Testes Silenciosamente Skipped
- [ ] Refatorar `enforceTenantSubmissionLimits.test.js` — remover `describe.skip` fallback
- [ ] Refatorar `getClientQuotaStatus.test.js` — usar `beforeAll` com `expect(mod).toBeDefined()`
- [ ] **Teste:** Se módulo falha a inicialização, testes falham explicitamente (não somem)
- [ ] **Meta:** 37 testes recuperados

### Item 4.4 — Testes do `v2ClientProjectionBuilder.cjs`
- [ ] Criar `functions/domain/v2ClientProjectionBuilder.test.js`
- [ ] Testar projection limpa (sem sinais, sem entitlements)
- [ ] Testar projection com sinais de risco
- [ ] Testar projection filtra campos internos (raw, custo, provider name)
- [ ] **Meta:** 5+ testes passando

### Item 4.5 — Testes de Páginas Principais (Frontend)
- [ ] `ProductHubPage.test.jsx` — renderiza produtos, navegação
- [ ] `SolicitacoesPage.test.jsx` — lista casos, filtros, empty state
- [ ] `DashboardClientePage.test.jsx` — KPIs, quotas, cards
- [ ] **Meta:** 6+ testes passando

### Item 4.6 — Testes de UI Components
- [ ] `EmptyState.test.jsx`
- [ ] `ErrorBoundary.test.jsx`
- [ ] `Modal.test.jsx`
- [ ] `StatusBadge.test.jsx`
- [ ] **Meta:** 8+ testes passando

### Item 4.7 — Testes Backend Adapters/Normalizers
- [ ] `functions/adapters/escavador.test.js` — se existir adapter
- [ ] `functions/normalizers/escavador.test.js`
- [ ] `functions/normalizers/judit.test.js`
- [ ] `functions/normalizers/phases.test.js`
- [ ] **Meta:** 10+ testes passando

### Item 4.8 — Suite Completa & Métricas
- [ ] Rodar `npx vitest run` → confirmar 1000+ testes passando
- [ ] Rodar `npm run lint` → confirmar 0 erros, 0 warnings
- [ ] Rodar `npm run build` → confirmar < 3s
- [ ] Rodar `node --check functions/index.js` → sucesso

---

## <a name="wave-5"></a>🔵 WAVE 5 — UX & Polimento
> **Objetivo:** Experiência fluida e consistente em todos os portais.

### Item 5.1 — Slot Registry com Scoping Real por Produto
- [ ] Modificar `resolveSlotsForProduct(productKey)` para usar `requiredFor` baseado no produto
- [ ] `watchlist` só para `ongoing_monitoring`
- [ ] `relationships` só para PJ/societário
- [ ] `timeline` para todos os dossies
- [ ] **Teste:** `resolveSlotsForProduct('dossier_pf_full')` não retorna `watchlist`

### Item 5.2 — WatchlistSlot Funcional no CaseViewPage
- [ ] Adicionar estado `watchlistState` em `CaseViewPage.jsx`
- [ ] Passar handlers `onCreate`, `creating`, `message`, `error` para `CaseEngine`
- [ ] Integrar com callable `createWatchlist`
- [ ] **Teste:** Botão "Adicionar à watchlist" abre modal e cria watchlist

### Item 5.3 — CasoPage (Ops) Usar CaseEngine Gradualmente
- [ ] Criar feature flag `v2CaseEngineInOps`
- [ ] Quando flag ativa, renderizar CaseEngine em vez de painéis monolíticos
- [ ] Manter lógica de conclusão/decisão existente (não quebrar)
- [ ] **Teste:** Com flag ligada, CasoPage renderiza CaseEngine com slots
- [ ] **Teste:** Com flag desligada, CasoPage mantém comportamento atual

### Item 5.4 — Onboarding Visual Básico
- [ ] Criar `ProductIntroStep` com checklist de progresso
- [ ] Adicionar dicas contextuais no pipeline (tooltips nos campos)
- [ ] **Teste:** Primeira visita ao hub mostra introdução; segunda visita pula

### Item 5.5 — Consistência Mobile & Acessibilidade
- [ ] Verificar que todos os novos componentes têm `aria-label`/`role`
- [ ] Verificar contraste WCAG AA nos novos slots
- [ ] Verificar que pipeline funciona em viewport 375px
- [ ] **Teste:** Lighthouse acessibilidade ≥ 90

---

## <a name="wave-6"></a>🏁 WAVE 6 — Deploy & Validação Final
> **Objetivo:** Aplicativo 100% validado e pronto para deploy.

### Item 6.1 — Validação de Segurança
- [ ] Confirmar: `exports.__test` NÃO aparece em produção
- [ ] Confirmar: `markProductIntroSeen` rejeita productKey inválido
- [ ] Confirmar: nenhum callable expõe raw snapshot ou custo interno
- [ ] Confirmar: cliente só lê projections, nunca `cases`/`evidenceItems` internos

### Item 6.2 — Validação de Fluxo End-to-End
- [ ] Fluxo cliente: Hub → Pipeline → Selecionar módulos → Submit → CaseView (sem 404)
- [ ] Fluxo ops: Fila → Assumir caso → CasoPage → Concluir → Publicar relatório
- [ ] Fluxo BDC: Case criado → ProviderRequest → RawSnapshot → Evidence → Decision
- [ ] Fluxo senior: Caso com mandado → SeniorReviewQueue → Aprovar/Rejeitar

### Item 6.3 — Validação de Módulos Opcionais
- [ ] Selecionar/desmarcar módulos no frontend REALMENTE altera execução no backend
- [ ] Módulo não-contratado → rejeição clara
- [ ] Módulo obrigatório falhou → bloqueia publicação

### Item 6.4 — Validação de Reuso/Freshness
- [ ] Snapshot reutilizado quando dentro da janela de freshness
- [ ] Nova consulta quando freshness expirada
- [ ] Billing reflete reuse (não cobra 2x)

### Item 6.5 — Validação de Relatório
- [ ] Relatório publicado só após decision aprovada
- [ ] Relatório não contém raw data, custo interno, ou nomes de provider
- [ ] Token público funciona e expira conforme policy

### Item 6.6 — Checklist Final de Go-Live
- [ ] `npm run lint` — 0 erros, 0 warnings
- [ ] `npx vitest run` — 1000+ testes passando
- [ ] `npm run build` — sucesso em < 3s
- [ ] `node --check functions/index.js` — sucesso
- [ ] `npm run test:rules` — 23+ testes do emulator passando (se aplicável)
- [ ] Firebase deploy preview — sem erros
- [ ] Documentação de deploy atualizada

---

## 📊 RESUMO DAS MÉTRICAS

| Wave | Itens | Complexidade | Tempo Estimado |
|------|-------|--------------|----------------|
| 1 — Segurança | 5 | Média | ~2h |
| 2 — BigDataCorp | 7 | Alta | ~6h |
| 3 — Arquitetura V2 | 6 | Alta | ~5h |
| 4 — Testes | 8 | Média | ~4h |
| 5 — UX | 5 | Média | ~3h |
| 6 — Deploy | 6 | Baixa | ~2h |
| **TOTAL** | **37** | | **~22h** |

---

## 🎯 PRÓXIMO PASSO

Aguardando aprovação do usuário para iniciar a **Wave 1 — Item 1.1** (Remover `exports.__test` da produção).
