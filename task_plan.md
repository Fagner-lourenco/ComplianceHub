# Plano: Reforçar controle de IA desabilitada + UX adaptativa

> Data: 2026-06-18
> Escopo: backend Firebase Functions + frontend React (CasoPage / EnrichmentPipeline)
> Branch: main
> Deploy: Firebase Functions + Vercel

---

## Goal

Garantir que, quando a IA estiver desabilitada no tenant (`enrichmentConfig.ai.enabled === false`):
1. Nenhuma chamada OpenAI ocorra, **nem por rerun manual** (`rerunAiAnalysis`, `rerunEnrichmentPhase` para `ai`).
2. O budget mensal (`monthlyBudgetUsd`) também bloqueie reruns manuais.
3. A UI do CasoPage refiltre a aba Revisão e o pipeline para refletir o estado real.

---

## Phases

### Phase 1 — Backend: helper central de controle de IA
- [ ] Criar `functions/modules/_shared/aiEnabledHelper.js` com:
  - `isAiEnabledForTenant(tenantId, db)` — retorna `{ enabled, reason }`.
  - Reutiliza a lógica de budget mensal do `autoClassification.js`.
- [ ] Adicionar testes unitários para o helper.

### Phase 2 — Backend: aplicar helper nos entry points de IA
- [ ] Refatorar `functions/modules/autoClassification.js` para usar o helper.
- [ ] Adicionar verificação em `functions/index.js` → `rerunAiForCase`.
- [ ] Adicionar verificação em `functions/modules/caseQueriesAssignments.js` → handlers de rerun.
- [ ] Adicionar testes de regressão para cada entry point.

### Phase 3 — Frontend: adaptar CasoPage e EnrichmentPipeline
- [ ] Carregar `enrichmentConfig` em `src/portals/ops/CasoPage.jsx`.
- [ ] Ajustar `EnrichmentPipeline.jsx` para receber prop `aiEnabled`:
  - Status inicial `SKIPPED` quando IA desabilitada.
  - Desabilitar retry de `ai` quando desabilitada.
- [ ] Ajustar aba Revisão / section "Análise assistida" no CasoPage:
  - Exibir hint quando IA desabilitada.
  - Renomear subtítulo para modo determinístico quando aplicável.
- [ ] Adicionar labels centralizados em `src/core/copy/labels.js` ou `messages.js`.
- [ ] Adicionar/atualizar testes de frontend.

### Phase 4 — Validação
- [ ] `cd functions && npm test` passando.
- [ ] `npm test` (frontend) passando.
- [ ] `npm run build` passando.
- [ ] `npm run lint` e `cd functions && npm run lint` zerados.

### Phase 5 — Deploy
- [ ] `firebase deploy --only functions`
- [ ] `npm run build && vercel --prod --yes`
- [ ] Verificar URLs de produção.

---

## Decisions

- **Opção B (completa)** escolhida pelo usuário.
- Criar helper central para evitar duplicação do controle de budget/toggle.
- Manter `aiStatus = 'SKIPPED'` e `aiError` como contrato existente.
- Não remover aba Revisão, apenas adaptar seu conteúdo com hint de fallback.

---

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
