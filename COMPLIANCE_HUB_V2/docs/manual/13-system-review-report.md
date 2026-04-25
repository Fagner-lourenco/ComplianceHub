# 13 — System Review Report

> **Data:** 2026-04-24
> **Revisores:** Kimi Code CLI (subagente read-only + correção manual)
> **Escopo:** Revisão sistêmica do backend Compliance Hub V2 antes do handoff para frontend
> **Versão:** 1.0 (pós-correção)

---

## 1. Resumo Executivo

A revisão sistêmica identificou **6 gaps críticos** no backend V2. Todos os BLOCKERS foram resolvidos na sessão de 2026-04-24. O backend está agora **pronto para receber o frontend**.

| Categoria | Antes | Depois |
|-----------|-------|--------|
| BLOCKERS | 4 | 0 |
| WARNINGS | 6 | 4 |
| REST Rotas | 14 | 30+ |
| Decision Workflow | Não implementado | Implementado com review gate |
| Entitlement Enforcement | Não implementado | Implementado em createDossier |
| ProviderRecords | Não criado | Criado em todo trigger V2 |
| Trigger Duplicação | V1 + V2 ativos | V1 desativado |

---

## 2. Metodologia

A revisão foi conduzida em duas fases:

1. **Fase 1 — Read-only exploration:** Subagente especializado leu 15+ arquivos críticos e respondeu 6 perguntas estruturadas sobre arquitetura, governança, monetização e wiring.
2. **Fase 2 — Correção:** O agente principal implementou as correções identificadas, atualizou controllers, triggers, use cases e documentação.

Arquivos analisados:
- `functions/index.js`
- `functions/bootstrap.js` (estrutura de exports)
- `functions/interfaces/triggers/onCaseCreated.js`
- `functions/interfaces/triggers/index.js`
- `functions/interfaces/http/routes.js`
- `functions/interfaces/http/controllers/dossierController.js`
- `functions/interfaces/http/controllers/analysisController.js`
- `functions/application/dossier/createDossier.js`
- `functions/application/dossier/getDossierDetail.js`
- `functions/domain/v2EntitlementResolver.js`
- `functions/domain/v2ReviewGate.js`
- `functions/domain/v2ClientProjectionBuilder.js`
- `functions/domain/dossierSchema.js`
- `functions/constants/collections.js`
- `functions/interfaces/http/callables.js`

---

## 3. Findings Detalhados

### 3.1 GAP-1: Trigger Duplicação BDC (RESOLVIDO)

**Problema:** `enrichBigDataCorpOnCase` (bootstrap V1) e `enrichBigDataCorpOnCaseV2` (novo) estavam ambos registrados em `cases/{caseId}` `onDocumentCreated`. Risco de dupla execução.

**Causa raiz:** O `interfaces/triggers/index.js` importava e exportava o trigger legado do bootstrap, e o `index.js` principal também registrava o V2.

**Correção:** Comentado o export do trigger legado em `interfaces/triggers/index.js` com documentação de rollback.

**Arquivos modificados:**
- `functions/interfaces/triggers/index.js`

**Evidência:**
```javascript
// DISABLED: exports.enrichBigDataCorpOnCase = bootstrap.enrichBigDataCorpOnCase;
```

---

### 3.2 GAP-2: ProviderRecords Layer Missing (RESOLVIDO)

**Problema:** O trigger V2 criava `providerRequests`, `rawSnapshots`, `evidenceItems` e atualizava `moduleRuns`, mas pulava a criação de `providerRecords` — coleção declarada em `constants/collections.js` mas não utilizada.

**Causa raiz:** O pipeline V2 foi implementado sem a camada de ledger imutável.

**Correção:** Adicionada criação de `providerRecords` após cada `providerRequest` no `processDataset()` do trigger. O record vincula `tenantId`, `caseId`, `subjectId`, `moduleRunId`, `providerRequestId`, custo e status.

**Arquivos modificados:**
- `functions/interfaces/triggers/onCaseCreated.js`

**Snippet da correção:**
```javascript
// Create provider record (ledger-level abstraction)
const recordRef = db.collection(COLLECTIONS.PROVIDER_RECORDS).doc();
await recordRef.set({
  tenantId,
  caseId,
  subjectId: caseData.subjectId,
  moduleRunId: runs[0].id,
  providerRequestId: reqRef.id,
  provider: 'bigdatacorp',
  endpoint,
  datasetKey,
  document: caseData.document,
  subjectType: caseData.subjectType,
  cost: /* ... */,
  currency: 'BRL',
  status: 'completed',
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

---

### 3.3 GAP-3: Entitlement Enforcement Missing (RESOLVIDO)

**Problema:** `createDossier` (REST e use case) não validava se o tenant possuía entitlements para criar dossiês, usar determinado preset, ou respeitar limites mensais.

**Causa raiz:** O `v2EntitlementResolver.js` existia e tinha testes, mas nunca foi importado nos controllers/use cases de criação.

**Correção:**
1. Importado `resolveTenantEntitlements`, `isTenantFeatureEnabled`, `FEATURE_FLAGS` no `dossierController.js` e `createDossier.js`.
2. Adicionada validação de `CASE_CREATION` feature flag.
3. Adicionada checagem de `maxCasesPerMonth` via query `count()` no Firestore.
4. Adicionada filtragem de `requestedSectionKeys` e `requestedMacroAreaKeys` por `enabledModules`.
5. Adicionada validação de `presetKey` contra `enabledProducts`.

**Arquivos modificados:**
- `functions/interfaces/http/controllers/dossierController.js`
- `functions/application/dossier/createDossier.js`

---

### 3.4 GAP-4: Decision Workflow Missing (RESOLVIDO)

**Problema:** `approveDossier` e `rejectDossier` apenas atualizavam o status do caso em `cases/{caseId}` sem criar registros em `decisions` e sem validar review gate.

**Causa raiz:** O `v2ReviewGate.js` e `v2ReviewPolicy.js` existiam com lógica de RBAC, mas não estavam integrados aos endpoints REST.

**Correção:**
1. Importado `resolveReviewGate` nos controllers `dossierController.js` e `analysisController.js`.
2. Em `approveDossier`: busca `moduleRuns` e `riskSignals`, executa `resolveReviewGate()`, verifica permissões RBAC, cria doc em `decisions`, depois atualiza o caso.
3. Em `rejectDossier`: cria doc em `decisions` do tipo `rejection` com razão.
4. Ambos os controllers (dossier e analysis) agora usam o mesmo fluxo.

**Arquivos modificados:**
- `functions/interfaces/http/controllers/dossierController.js`
- `functions/interfaces/http/controllers/analysisController.js`

**Snippet da correção (approve):**
```javascript
const gateResult = resolveReviewGate({
  moduleRuns,
  riskSignals,
  caseData,
  actorRole: profile.role || null,
});

if (!gateResult.allowed) {
  return res.status(403).json({
    success: false,
    error: {
      code: gateResult.denialReasonCode,
      message: gateResult.denialMessage,
      policy: gateResult.policyResult,
    },
  });
}

const decisionRef = db.collection(COLLECTIONS.DECISIONS).doc();
await decisionRef.set({
  tenantId, caseId, type: 'approval',
  decidedBy: uid, decidedByName: profile.name || '',
  decidedByRole: profile.role || '',
  policySummary: gateResult.policyResult,
  /* ... */
});
```

---

### 3.5 GAP-5: REST API Surface Incompleto (RESOLVIDO)

**Problema:** Apenas 14 rotas REST estavam implementadas (dossiers, sources, profiles). Billing, senior review, watchlists, reports e AI analysis só existiam como Firebase Callables no bootstrap.

**Causa raiz:** Foco inicial foi no core de dossiês. Outros domínios foram deixados como callables legados.

**Correção:** Criados 5 novos controllers REST que embrulham (wrapper) as funções do bootstrap.js:

1. **`billingController.js`** — 4 rotas: overview, settlement, drilldown, close-period
2. **`seniorReviewController.js`** — 2 rotas: list queue, resolve request
3. **`watchlistController.js`** — 6 rotas: list, create, pause, resume, run, delete
4. **`reportController.js`** — 4 rotas: export, create public, list public, revoke public
5. Atualizado **`analysisController.js`** — 4 rotas: comments, update, approve, reject

Todos os novos controllers incluem:
- Validação de entitlements (billing, watchlists)
- Paginação padronizada via `pagination.js`
- Error handling consistente

**Arquivos criados/modificados:**
- `functions/interfaces/http/routes.js` (adicionados 5 novos mounts)
- `functions/interfaces/http/controllers/billingController.js` (novo)
- `functions/interfaces/http/controllers/seniorReviewController.js` (novo)
- `functions/interfaces/http/controllers/watchlistController.js` (novo)
- `functions/interfaces/http/controllers/reportController.js` (novo)
- `functions/interfaces/http/controllers/analysisController.js` (atualizado com Decision)

---

### 3.6 GAP-6: syncClientCaseListProjection Não Utilizado (RESOLVIDO)

**Problema:** O `v2ClientProjectionBuilder.js` exportava `syncClientCaseListProjection` para manter uma coleção client-safe (`clientCaseList`), mas nunca era chamado.

**Causa raiz:** O trigger V2 atualizava `cases/{caseId}` diretamente para `READY`, mas não sincronizava a projeção client-safe.

**Correção:** Adicionada chamada a `syncClientCaseListProjection` no final de `checkCompletion()` no `onCaseCreated.js`, quando o caso transiciona para `READY`.

**Arquivos modificados:**
- `functions/interfaces/triggers/onCaseCreated.js`

---

## 4. Estado do Bootstrap.js

**Tamanho:** 10.631 linhas (preservado intencionalmente)

**Função atual:** Entry point legado que concentra ~40 callables, 9 triggers, webhooks e scheduled jobs.

**Estratégia de migração:**
- O `index.js` importa o bootstrap via `require('./bootstrap')` e re-exporta tudo via registries modulares (`callables.js`, `triggers/index.js`, etc.)
- Novo código V2 é importado diretamente em `index.js` (ex: `enrichBigDataCorpOnCaseV2`)
- O bootstrap NÃO será refatorado agora — o custo/benefício não justifica antes do frontend
- Quando um callable legado precisar de manutenção, ele será extraído para `application/` ou `domain/` na ocasião

**Risco aceitável:** Médio. O bootstrap é estável e testado em produção. A duplicação de triggers BDC foi resolvida.

---

## 5. Testes — Recomendações

| Tipo | Quantidade | Status | Recomendação |
|------|------------|--------|--------------|
| Unitários | 63 arquivos, 1050+ casos | ✅ Passando | Manter cobertura >80% |
| Integração REST | 0 | 🔴 Não existe | **Criar antes do deploy** — usar `supertest` + Firebase Emulator |
| E2E Trigger | 0 | 🔴 Não existe | **Criar antes do deploy** — testar pipeline BDC com dados mock |
| Review Gate | Testes unitários existem | ✅ | `v2ReviewGate.test.js`, `v2ReviewPolicy.test.js` |
| Entitlement Resolver | Testes unitários existem | ✅ | `v2EntitlementResolver.test.js` |

**Próximos testes prioritários:**
1. `dossierController.test.js` — testar createDossier com entitlements válidos/inválidos
2. `approveDossier.test.js` — testar review gate allow/deny
3. `onCaseCreated.test.js` — testar providerRecord creation + client projection sync
4. `routes.integration.test.js` — testar todos os 30+ endpoints REST

---

## 6. Handoff Checklist

| Item | Status | Responsável |
|------|--------|-------------|
| Backend compilando | ✅ | Kimi CLI |
| Testes unitários passando | ✅ | Kimi CLI |
| BLOCKERS resolvidos | ✅ | Kimi CLI |
| REST API documentada | ✅ | Este documento + `12-backend-scope-confirmation.md` |
| Firebase Emulator config | ⚠️ | Verificar `firebase.json` emulators |
| Variáveis de ambiente | ⚠️ | Confirmar `BIGDATACORP_ACCESS_TOKEN`, `BIGDATACORP_TOKEN_ID` |
| Firestore indexes deploy | ⚠️ | `firebase deploy --only firestore:indexes` |
| Cloud Functions deploy | ⚠️ | `firebase deploy --only functions` |

---

## 7. Apêndice — Mapeamento de Rotas REST

```
GET    /api/v1/dossiers                    → listDossiers
POST   /api/v1/dossiers                    → createDossier
GET    /api/v1/dossiers/:id                → getDossierDetail
POST   /api/v1/dossiers/:id/process        → processDossier
POST   /api/v1/dossiers/:id/retry-source   → retrySource
PATCH  /api/v1/dossiers/:id                → patchDossier
POST   /api/v1/dossiers/:id/comments       → createComment
POST   /api/v1/dossiers/:id/approve        → approveDossier
POST   /api/v1/dossiers/:id/reject         → rejectDossier

GET    /api/v1/sources                     → listSources
GET    /api/v1/sources/:key                → getSourceDetail

GET    /api/v1/profiles                    → listProfiles
POST   /api/v1/profiles                    → createProfile
DELETE /api/v1/profiles/:id                → deleteProfile

POST   /api/v1/analysis/:id/comments       → createComment
PATCH  /api/v1/analysis/:id                → updateAnalysis
POST   /api/v1/analysis/:id/approve        → approveDossier
POST   /api/v1/analysis/:id/reject         → rejectDossier

GET    /api/v1/billing                     → getBillingOverview
GET    /api/v1/billing/settlement          → getBillingSettlement
GET    /api/v1/billing/drilldown           → getBillingDrilldown
POST   /api/v1/billing/close-period        → closeBillingPeriod

GET    /api/v1/senior-review               → listQueue
POST   /api/v1/senior-review/:id/resolve   → resolveRequest

GET    /api/v1/watchlists                  → listWatchlists
POST   /api/v1/watchlists                  → createWatchlist
POST   /api/v1/watchlists/:id/pause        → pauseWatchlist
POST   /api/v1/watchlists/:id/resume       → resumeWatchlist
POST   /api/v1/watchlists/:id/run          → runWatchlistNow
DELETE /api/v1/watchlists/:id              → deleteWatchlist

POST   /api/v1/reports/export              → registerExport
POST   /api/v1/reports/public              → createPublicReport
GET    /api/v1/reports/public              → listPublicReports
POST   /api/v1/reports/public/:id/revoke   → revokePublicReport
```

---

*Fim do relatório. Backend V2 validado e corrigido. Pronto para handoff frontend.*
