# Mapeamento Backend ↔ Frontend — Domínio de Dossiê V2

> Este documento garante que nenhuma capacidade do backend seja esquecida na nova UI.

---

## Legenda

- **🟢 Implementado** — já existe contrato backend e componente frontend pronto
- **🟡 Stub/Parcial** — estrutura frontend criada, aguardando contrato backend final
- **🔴 Não implementado** — ainda não existe no frontend; prioridade definida

---

## 1. Autenticação e Infraestrutura

| Backend | Frontend | Status | Notas |
|---|---|---|---|
| Firebase Auth (`core/auth/AuthContext.jsx`) | `shared/layouts/AuthLayout.jsx` | 🟢 | Login com email/senha funcional |
| TenantContext (`core/contexts/TenantContext.jsx`) | Providers em `App.jsx` | 🟢 | Injetado globalmente |
| RBAC / Permissions (`core/rbac/permissions.js`) | `App.jsx` route guards | 🟢 | `RequireAuth`, `PortalRedirect` |
| Firestore Service (`core/firebase/firestoreService.js`) | Hooks do domínio | 🟢 | Reutilizado sem alterações |
| Firebase Functions (`core/firebase/config.js` → `functions`) | `useDossierCreate.js` | 🟢 | Export adicionado ao config |

---

## 2. Listagem / Histórico de Dossiês

| Capacidade Backend | Coleção/Callable | Componente Frontend | Status |
|---|---|---|---|
| Listagem filtrável | `clientCaseList` (Firestore) | `DossierListPage.jsx` | 🟡 | Usa mock data; hook `useDossierList.js` pronto para Firestore |
| Filtros por período | Query params | `DossierListPage.jsx` | 🟡 | UI pronta, lógica de filtro pending |
| Filtros por responsável | `requestedByName` | `DossierListPage.jsx` | 🟡 | UI pronta |
| Filtros por status | `status` / `lifecycleStatus` | `DossierListPage.jsx` | 🟡 | Tabs visuais prontas |
| Progresso percentual | `moduleRuns` / `sourceExecutionSummary` | `DossierListPage.jsx` | 🟡 | Barra visual com mock |
| Colunas operacionais | `clientProjections` enriquecido | `DossierListPage.jsx` | 🟡 | Estrutura de tabela pronta |
| CTA "Criar novo dossiê" | — | `DossierListPage.jsx` | 🟢 | Navegação funcional |

---

## 3. Criação de Dossiê

| Capacidade Backend | Contrato | Componente Frontend | Status |
|---|---|---|---|
| Stepper 4 etapas | — | `DossierCreatePage.jsx` | 🟢 | Perfil → Critérios → Tag → Parâmetros |
| Toggle PF/PJ | `subjectKind` | `DossierCreatePage.jsx` | 🟢 | Estado local funcional |
| Perfis padronizados | `dossierPresets` (futuro) | `DossierCreatePage.jsx` | 🟡 | Mock com 7 perfis; aguarda backend |
| Preview de perfil (drawer) | `dossierPresets` preview | `ProfileSidePanel.jsx` | 🔴 | Não criado ainda — Fase 3 |
| Critérios CPF/CNPJ + upload | `criteria` | `DossierCreatePage.jsx` | 🟡 | Etapa 2 esqueletica |
| Tags | `tagIds` | `DossierCreatePage.jsx` | 🟡 | Etapa 3 esqueletica |
| Parâmetros por fonte | `searchParameters` | `DossierCreatePage.jsx` | 🟡 | Etapa 4 esqueletica |
| Auto-processamento | `autoProcess` | `DossierCreatePage.jsx` | 🟡 | Checkbox presente |
| Submissão | `v2CreateClientSolicitation` (callable) | `useDossierCreate.js` | 🟡 | Hook pronto, não integrado à página ainda |
| Perfil personalizado | `customDossierConfig` | `CustomProfilePage.jsx` | 🟢 | Criação de perfil funcional com mock |

---

## 4. Visão do Dossiê (Analítico + Detalhado)

| Capacidade Backend | Contrato | Componente Frontend | Status |
|---|---|---|---|
| Alternância Analítico/Detalhado | `supportedModes` no schema | `DossierDetailPage.jsx` | 🟢 | Toggle funcional |
| Card-resumo do dossiê | `clientProjections` / `headerContext` | `DossierOverviewCard.jsx` | 🟡 | Componente inline na página; mock data |
| Navegação por macroáreas | `dossierSchema.cjs` → `resolveMacroAreas` | `MacroAreaTabs.jsx` | 🟡 | Inline na página; hardcoded por ora |
| Métricas analíticas | `analyticsBlocks.metrics` | `AnalyticsBlocks.jsx` | 🟡 | Inline na página; mock data |
| Gráficos (bar chart, donuts) | `analyticsBlocks.series` / `distributions` | `AnalyticsBlocks.jsx` | 🟡 | Placeholder visual funcional |
| Filtros analíticos | `filterMetadata` + `facetCounts` | `FilterPanel.jsx` | 🟡 | Sidebar placeholder |
| Seções por fonte (analítico) | `sourceRows` | `SourceSection.jsx` | 🔴 | Não criado ainda — Fase 4 |
| Cards detalhados expansíveis | `detailEntries` | `DetailEntryCard.jsx` | 🟡 | Inline na página; mock data |
| Tabelas em cards | `detailEntries` com `entryType=table` | `DetailEntryCard.jsx` | 🟢 | DataTable reutilizável |
| Texto corrido / certidão | `detailEntries` com `entryType=paragraph` | `DetailEntryCard.jsx` | 🟢 | Renderização funcional |
| Lista de processos | `detailEntries` com `entryType=process_list` | `ProcessList.jsx` | 🟡 | Inline na página |
| Detalhe profundo de processo | `judicialProcesses` / `process_detail` | `ProcessDetail.jsx` | 🔴 | Não criado ainda — Fase 5 |
| PDF / document links | `detailEntries` com `entryType=document_link` | `DetailEntryCard.jsx` | 🔴 | Não criado ainda |
| Drawers de fontes com/sem resultado | `sourceRows` + `sourceResultSummary` | `SourceDrawer.jsx` | 🔴 | Não criado ainda |

---

## 5. Comentários e Aprovação

| Capacidade Backend | Contrato | Componente Frontend | Status |
|---|---|---|---|
| Comentários por escopo | `commentThreads` (nova coleção) | `CommentThread.jsx` | 🟡 | Inline na página; stub de UI |
| Análise conclusiva do dossiê | `dossierAnalysisDraft` / `dossierAnalysisFinal` | `AnalysisBoxes.jsx` | 🟡 | Textarea + botões presentes |
| Comentários finais | `commentThreads` scope=dossier | `AnalysisBoxes.jsx` | 🟡 | Textarea presente |
| Aprovar / Reprovar | `approvalState` (nova coleção) | `AnalysisBoxes.jsx` | 🟡 | Botões presentes, não integrados |
| Marcar como relevante | `commentRelevance` | `AnalysisBoxes.jsx` | 🟡 | Botão presente |
| Review gate | `v2ReviewGate.cjs` | — | 🔴 | Não integrado ao frontend |

---

## 6. Progresso e Reprocessamento

| Capacidade Backend | Contrato | Componente Frontend | Status |
|---|---|---|---|
| Progresso por fonte | `moduleRuns` + `providerRequests` | `ProgressDrawer.jsx` | 🔴 | Não criado ainda — Fase 5 |
| Reprocessamento | Callable de reprocess | `ProgressDrawer.jsx` | 🔴 | Não criado ainda |
| Estados: Iniciar / Na fila / Processando | `lifecycleStatus` | `DossierListPage.jsx` | 🟡 | Badge visual pronto |

---

## 7. Exportação

| Capacidade Backend | Contrato | Componente Frontend | Status |
|---|---|---|---|
| Exportar dossiê | `exportJobs` (nova coleção) | `DossierDetailPage.jsx` | 🟡 | Botão "Exportar" presente no header |
| Publicação HTML / token | `publicReports` (existente) | — | 🔴 | Não migrada da UI antiga ainda |

---

## 8. Responsividade

| Capacidade Backend | Contrato | Componente Frontend | Status |
|---|---|---|---|
| Prioridade mobile | `responsiveRenderHints.mobilePriority` | `renderHints.js` | 🟡 | Parser criado, não aplicado ainda |
| Campos de card compacto | `responsiveRenderHints.mobileCardFields` | `DataTable.jsx` | 🔴 | Não aplicado ainda |
| Ocultação condicional | `responsiveRenderHints.hideOnSmallScreens` | — | 🔴 | Não aplicado ainda |

---

## Prioridade de próximas implementações

1. **Fase 3 (atual):** `ProfileSidePanel.jsx`, integrar `useDossierCreate` na página de criação
2. **Fase 4:** `SourceSection.jsx`, `AnalyticsBlocks.jsx` standalone, `FilterPanel.jsx` real
3. **Fase 5:** `ProcessDetail.jsx`, `SourceDrawer.jsx`, `ProgressDrawer.jsx`, `CommentThread.jsx` integrado
4. **Fase 6:** Integrar todos os hooks ao Firestore/callables reais, remover mocks
