# Plano de Execução — Dossiê para Produção
## ComplianceHub V2 | Evolução MVP → Produção

**Data:** 2026-04-25
**Baseado em:** Auditoria completa de backend, frontend e integração BDC

---

## Sumário Executivo

O módulo de dossiê está funcional como MVP mas possui **bugs críticos** que impedem operação em produção:

- **BDC Integration:** Apenas 4 de 40 datasets funcionam (PF-only). PJ está completamente quebrado.
- **Backend REST:** Controller duplica lógica da Application Layer; formato de resposta inconsistente.
- **Frontend:** Tabs não navegam, conclusão não sincroniza, perfis customizados não são encontrados.

Este plano organiza a correção em **5 fases sequenciais**, priorizando o que desbloqueia o resto.

---

## Fase 1: Foundation — Corrigir BDC Adapter + Trigger (CRÍTICO)

**Objetivo:** Fazer as chamadas BDC funcionarem corretamente para PF e PJ.

| # | Tarefa | Arquivo | Severidade |
|---|--------|---------|------------|
| 1.1 | Exportar `callPost` no `module.exports` de `bigdatacorp.js` | `adapters/bigdatacorp.js` | CRITICAL |
| 1.2 | Alterar `queryCombined` para aceitar `endpoint` param | `adapters/bigdatacorp.js` | CRITICAL |
| 1.3 | Passar `endpoint` correto no trigger para PJ | `interfaces/triggers/onCaseCreated.js` | CRITICAL |
| 1.4 | Corrigir key duplicada `collections`/`collections_pj` | `adapters/bigdatacorpCatalog.js` | CRITICAL |
| 1.5 | Substituir `capitalizeFirst` por mapeamento explícito de chaves BDC | `interfaces/triggers/onCaseCreated.js` | CRITICAL |
| 1.6 | Alinhar `SECTION_REGISTRY.occupation.sourceKeys` → `bigdatacorp_occupation_data` | `domain/dossierSchema.js` | CRITICAL |
| 1.7 | Remover `occupation_data` do combined quando `subjectType === 'pj'` | `interfaces/triggers/onCaseCreated.js` | WARNING |
| 1.8 | Remover `owners_lawsuits` do preset `juridico` PF | `adapters/bigdatacorpCatalog.js` | WARNING |

**Deploy:** Sim, após todas as correções da Fase 1.

---

## Fase 2: Expandir Schema — Conectar Mais Datasets BDC

**Objetivo:** Aumentar de 4 para ~15 datasets funcionais, cobrindo os principais presets.

| # | Tarefa | Arquivo | Status |
|---|--------|---------|--------|
| 2.1 | Criar section `relationships` no `SECTION_REGISTRY` | `domain/dossierSchema.js` | NOVO |
| 2.2 | Criar section `financial_data` no `SECTION_REGISTRY` | `domain/dossierSchema.js` | NOVO |
| 2.3 | Criar section `collections` no `SECTION_REGISTRY` | `domain/dossierSchema.js` | NOVO |
| 2.4 | Criar section `government_debtors` no `SECTION_REGISTRY` | `domain/dossierSchema.js` | NOVO |
| 2.5 | Criar section `online_presence` no `SECTION_REGISTRY` | `domain/dossierSchema.js` | NOVO |
| 2.6 | Conectar normalizadores órfãos ao switch do trigger | `interfaces/triggers/onCaseCreated.js` | CONECTAR |
| 2.7 | Sincronizar `PRESET_DATASET_MAP` com `SECTION_REGISTRY` | `adapters/bigdatacorpCatalog.js` + `domain/dossierSchema.js` | ALINHAR |
| 2.8 | Adicionar `COMMENTS` a `constants/collections.js` | `constants/collections.js` | PADRONIZAR |

**Datasets alvo desta fase:** `basic_data`, `processes`, `kyc`, `occupation_data`, `relationships`, `financial_data`, `collections`, `government_debtors`, `online_presence`.

---

## Fase 3: Frontend — Correções de Bugs CRÍTICOS

**Objetivo:** Tornar o fluxo de dossie funcional e robusto no frontend.

| # | Tarefa | Arquivo |
|---|--------|---------|
| 3.1 | Corrigir `selectedPreset` para buscar também em custom profiles | `dossie/pages/DossierCreatePage.jsx` |
| 3.2 | Normalizar `title` vs `name` no hook `useProfiles` | `dossie/hooks/useProfiles.js` |
| 3.3 | Implementar `onClick` no botão "Buscar" + filtros de período | `dossie/pages/DossierListPage.jsx` |
| 3.4 | Sincronizar `conclusionText` com backend via `useEffect` | `dossie/pages/DossierDetailPage.jsx` |
| 3.5 | Corrigir payload PATCH para `{ analysis: { conclusive } }` | `dossie/pages/DossierDetailPage.jsx` |
| 3.6 | Tornar Macro Tabs interativas (estado ativo + filtragem) | `dossie/pages/DossierDetailPage.jsx` |
| 3.7 | Corrigir `useDossierList` para aceitar mock + real | `dossie/hooks/useDossierList.js` |
| 3.8 | Extrair componentes: `OverviewCard`, `MacroTabs`, `SourceSection`, `DetailGroup` | Novos arquivos em `dossie/components/` |

---

## Fase 4: Score Engine + Risk Signals

**Objetivo:** Calcular score de risco automaticamente após enriquecimento.

| # | Tarefa | Arquivo |
|---|--------|---------|
| 4.1 | Implementar `v2ScoreEngine.js` com regras de extração de sinais | `domain/v2ScoreEngine.js` |
| 4.2 | Criar coleção `riskSignals` e integrar ao trigger | `interfaces/triggers/onCaseCreated.js` |
| 4.3 | Calcular score após todos moduleRuns completos | `interfaces/triggers/onCaseCreated.js` |
| 4.4 | Retornar score no detalhe do dossie | `interfaces/http/controllers/dossierController.js` |
| 4.5 | Renderizar score e sinais no frontend | `dossie/pages/DossierDetailPage.jsx` |

---

## Fase 5: Refatoração — Controller → Use Cases

**Objetivo:** Eliminar duplicação e tornar o backend sustentável.

| # | Tarefa | Arquivo |
|---|--------|---------|
| 5.1 | Refatorar `dossierController` para delegar a use cases | `interfaces/http/controllers/dossierController.js` |
| 5.2 | Consolidar `analysisController` com `dossierController` | `interfaces/http/controllers/analysisController.js` |
| 5.3 | Adicionar validação `validateCreateDossier` no controller | `interfaces/http/controllers/dossierController.js` |
| 5.4 | Corrigir `findOrCreateSubject` para atualizar `caseIds` | `interfaces/http/controllers/dossierController.js` |
| 5.5 | Corrigir `processDossier` para resetar runs falhos | `interfaces/http/controllers/dossierController.js` |
| 5.6 | Padronizar nomes de campos entre list e detail | `interfaces/http/controllers/dossierController.js` |

---

## Checklist de Deploy por Fase

- [ ] Fase 1: Deploy `apiV1` + testar criação PF e PJ
- [ ] Fase 2: Deploy `apiV1` + testar presets `financeiro`, `pld`, `juridico`
- [ ] Fase 3: Build frontend + testar fluxo completo (create → detail → conclude)
- [ ] Fase 4: Deploy functions + testar score em casos com processos/KYC
- [ ] Fase 5: Deploy + testes de regressão

---

## Métricas de Sucesso

| Métrica | MVP Atual | Alvo Produção |
|---------|-----------|---------------|
| Datasets BDC funcionais | 4 | 15+ |
| Presets que geram moduleRuns | 2 (compliance, rh) | 7 (todos) |
| PF vs PJ | PF apenas | Ambos |
| Frontend: tabs navegáveis | Não | Sim |
| Frontend: conclusão sincronizada | Não | Sim |
| Score automático | Não | Sim |
| Relatório auditável | Parcial | Completo |

---

*Gerado automaticamente após auditoria completa em 2026-04-25.*
