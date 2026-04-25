# 04 — Client Bindings (Frontend ↔ Backend)

Inventário do que o frontend V2 consome. Base: [`app/src/core/firebase/firestoreService.js`](../../app/src/core/firebase/firestoreService.js) (1 381 linhas) + hooks em [`app/src/hooks/`](../../app/src/hooks) e [`app/src/dossie/hooks/`](../../app/src/dossie/hooks).

## A. Callables bindings (`httpsCallable`)

Todos resolvidos via `resolveV2FunctionName(name)` para suportar `v2*` vs legado.

### Gerenciais / Tenant

| Binding | Callable backend | Linha em `firestoreService.js` |
|---|---|---|
| `callCreateOpsClientUser(payload)` | `v2CreateOpsClientUser` | 1142 |
| `callListTenantUsers()` | `v2ListTenantUsers` | 1146 |
| `callCreateTenantUser(payload)` | `v2CreateTenantUser` | 1150 |
| `callUpdateTenantUser(payload)` | `v2UpdateTenantUser` | 1154 |
| `callUpdateOwnProfile(payload)` | `v2UpdateOwnProfile` | 1158 |

### Solicitações / Casos

| Binding | Callable | Linha |
|---|---|---|
| `callCreateClientSolicitation(payload)` | `v2CreateClientSolicitation` | 1126 |
| `callSubmitClientCorrection(payload)` | `v2SubmitClientCorrection` | 1134 |
| `callRegisterClientExport(payload)` | `v2RegisterClientExport` | 1138 |
| `callAssignCaseToCurrentAnalyst(payload)` | `v2AssignCaseToCurrentAnalyst` | 1162 |
| `callReturnCaseToClient(payload)` | `v2ReturnCaseToClient` | 1166 |
| `callConcludeCaseByAnalyst(payload)` | `v2ConcludeCaseByAnalyst` | 1170 |
| `callSaveCaseDraftByAnalyst(payload)` | `v2SaveCaseDraftByAnalyst` | 1178 |
| `callSetAiDecisionByAnalyst(payload)` | `v2SetAiDecisionByAnalyst` | 1182 |
| `callResolveProviderDivergenceByAnalyst(payload)` | `v2ResolveProviderDivergenceByAnalyst` | 1375 |
| `callMaterializeV2Artifacts(payload)` | `v2MaterializeV2Artifacts` | 1379 |
| `callRerunEnrichmentPhase(caseId, phase)` | `v2RerunEnrichmentPhase` | 1101 |
| `callRerunAiAnalysis(caseId)` | `v2RerunAiAnalysis` | 1109 |

### Tenant settings / entitlements

| Binding | Callable | Linha |
|---|---|---|
| `callUpdateTenantSettingsByAnalyst(payload)` | `v2UpdateTenantSettingsByAnalyst` | 1174 |
| `callGetTenantEntitlementsByAnalyst(payload)` | `v2GetTenantEntitlementsByAnalyst` | 1335 |
| `callUpdateTenantEntitlementsByAnalyst(payload)` | `v2UpdateTenantEntitlementsByAnalyst` | 1339 |

### Billing

| Binding | Callable | Linha |
|---|---|---|
| `callGetTenantBillingOverview(payload)` | `v2GetTenantBillingOverview` | 1343 |
| `callCloseTenantBillingPeriod(payload)` | `v2CloseTenantBillingPeriodByAnalyst` | 1347 |
| `callGetTenantBillingSettlement(payload)` | `v2GetTenantBillingSettlement` | 1351 |
| `callGetTenantBillingDrilldown(payload)` | `v2GetTenantBillingDrilldown` | 1355 |
| `callExportTenantBillingDrilldown(payload)` | `v2ExportTenantBillingDrilldown` | 1359 |

### Ops

| Binding | Callable | Linha |
|---|---|---|
| `callGetOpsV2Metrics(payload)` | `v2GetOpsV2Metrics` | 1363 |
| `callGetSystemHealth()` | `v2GetSystemHealth` | 1186 |

### Revisão sênior

| Binding | Callable | Linha |
|---|---|---|
| `callGetSeniorReviewQueue(payload)` | `v2GetSeniorReviewQueue` | 1367 |
| `callResolveSeniorReviewRequest(payload)` | `v2ResolveSeniorReviewRequest` | 1371 |

### Quote / Catalog / Alert

| Binding | Callable | Linha |
|---|---|---|
| `callGetClientQuotaStatus()` | `v2GetClientQuotaStatus` | 1190 |
| `callGetClientProductCatalog()` | `v2GetClientProductCatalog` | 1194 |
| `callMarkAlertAs(payload)` | `v2MarkAlertAs` | 1198 |
| `callCreateQuoteRequest(payload)` | `v2CreateQuoteRequest` | 1202 |
| `callResolveQuoteRequest(payload)` | `v2ResolveQuoteRequest` | 1206 |

### Watchlists

| Binding | Callable | Linha |
|---|---|---|
| `callCreateWatchlist(payload)` | `v2CreateWatchlist` | 1210 |
| `callPauseWatchlist(payload)` | `v2PauseWatchlist` | 1214 |
| `callResumeWatchlist(payload)` | `v2ResumeWatchlist` | 1218 |
| `callDeleteWatchlist(payload)` | `v2DeleteWatchlist` | 1222 |
| `callRunWatchlistNow(payload)` | `v2RunWatchlistNow` | 1226 |

### Onboarding / Backfill

| Binding | Callable | Linha |
|---|---|---|
| `callMarkProductIntroSeen(payload)` | `v2MarkProductIntroSeen` | 1130 |
| Direct `httpsCallable(functions, 'v2GetFeatureFlags')` | `v2GetFeatureFlags` | `useFeatureFlag.js:15` |
| Direct `httpsCallable(functions, 'v2CreateClientSolicitation')` | `v2CreateClientSolicitation` | `useDossierCreate.js:13` |

---

## B. Subscriptions (Firestore onSnapshot)

| Binding | Coleção | Linha |
|---|---|---|
| `subscribeToTenantDirectory(cb)` | `tenantSettings` | 402 |
| `subscribeToCases(tenantId, cb)` | `cases` filtrada por tenant | 496 |
| `subscribeToClientCases(tenantId, cb)` | `clientCases` | 508 |
| `subscribeToClientProjections(tenantId, cb)` | `clientProjections` | 567 |
| `subscribeToCaseDoc(caseId, cb)` | `cases/{caseId}` | 644 |
| `subscribeToModuleRunsForCase(caseId, cb, tenantId?)` | `moduleRuns` por caseId | 664 |
| `subscribeToEvidenceItemsForCase(caseId, cb, tenantId?)` | `evidenceItems` | 694 |
| `subscribeToRiskSignalsForCase(caseId, cb, tenantId?)` | `riskSignals` | 711 |
| `subscribeToSubjectForCase(subjectId, cb)` | `subjects/{subjectId}` | 729 |
| `subscribeToRelationshipsForCase(caseId, cb, tenantId?)` | `relationships` | 743 |
| `subscribeToTimelineEventsForCase(caseId, cb, limit?, tenantId?)` | `timelineEvents` | 765 |
| `subscribeToProviderDivergencesForCase(caseId, cb, limit?, tenantId?)` | `providerDivergences` | 797 |
| `subscribeToCandidates(tenantId, cb)` | `candidates` | 841 |
| `subscribeToAuditLogs(tenantId, cb)` | `auditLogs` | 868 |
| `subscribeToCaseAuditLogs(caseId, cb)` | `auditLogs` por caseId | 891 |
| `subscribeToTenantAuditLogs(tenantId, cb, opts?)` | `tenantAuditLogs` | 909 |
| `subscribeToExports(tenantId, cb)` | `exports` | 959 |
| `subscribeToCasePublicResult(caseId, cb)` | `cases/{caseId}/publicResult` | 1077 |
| `subscribeToAlertsByTenant(tenantId, cb)` | `alerts` | 1230 |
| `subscribeToQuoteRequestsByTenant(tenantId, cb)` | `quoteRequests` | 1265 |
| `subscribeToQuoteRequestsForAllTenants(cb)` | `quoteRequests` (admin) | 1301 |
| `subscribeToWatchlistsByTenant(tenantId, cb)` | `watchlists` | 1316 |

---

## C. One-shot fetches (`get` / `getDocs`)

| Binding | Coleção | Linha |
|---|---|---|
| `getFirestoreDocumentViaRest(col, id, msg)` | qualquer | 241 |
| `fetchClients()` | `tenantSettings` | 359 |
| `getTenantSettings(tenantId)` | `tenantSettings/{tenantId}` | 417 |
| `getTenantUsage(tenantId)` | `tenantUsage/{tenantId}` | 438 |
| `fetchTenantDirectory()` | `tenantSettings` all | 458 |
| `fetchCases(tenantId)` | `cases` | 590 |
| `fetchClientCases(tenantId)` | `clientCases` | 601 |
| `getCase(caseId)` | `cases/{caseId}` | 617 |
| `fetchModuleRunsForCase(caseId, tenantId?)` | `moduleRuns` | 682 |
| `fetchSubjectHistory(subjectId, currentCaseId, limit, tenantId?)` | `cases` cruzado | 820 |
| `fetchCandidates(tenantId)` | `candidates` | 853 |
| `fetchAuditLogs(tenantId)` | `auditLogs` | 880 |
| `fetchPublicReports(tenantId)` | `publicReports` | 934 |
| `revokePublicReport(token)` | `publicReports/{token}` | 942 |
| `fetchClientPublicReports()` | `publicReports` cliente | 946 |
| `revokeClientPublicReport(token)` | idem cliente | 951 |
| `fetchExports(tenantId)` | `exports` | 971 |
| `savePublicReport(html, meta)` | criação | 986 |
| `saveClientPublicReport(caseId)` | criação cliente | 994 |
| `getPublicReport(token)` | leitura pública | 1002 |
| `getClientProjection(caseId)` | `clientProjections/{caseId}` | 1008 |
| `fetchSubjectDecisionHistory(subjectId, currentCaseId, limit, tenantId?)` | `decisions` + `cases` | 1019 |
| `getCasePublicResult(caseId)` | subcoleção | 1091 |

---

## D. Helpers correlatos

| Arquivo | Função |
|---|---|
| `enrichmentStatus.js` | Mapa de status de fases (`judit`, `escavador`, `djen`, `bigdatacorp`) |
| `v2RiskResolver.js` | Resolve `riskLevel` a partir de sinais |
| `clientPortal.js` | Helpers do portal cliente |
| `productLabels.js` | Labels PT-BR de `productKey` (fonte única de verdade UX) |
| `productPipelines.js` | Pipelines de processamento por produto |
| `productAnalytics.js` | Métricas por produto |
| `reportBuilder.js` | Construção client-side de relatório (legado) |
| `errorUtils.js` | Normalização de erros `HttpsError` |
| `validators.js` | CPF/CNPJ/email client-side |
| `analysisProgress.js` | Progresso global baseado em `enabledPhases` |
| `caseUtils.js` | Helpers diversos de caso |
| `portalPaths.js` | Rotas React Router do portal |
| `formatDate.js` | Formatação date PT-BR + timezone |

---

## E. Hooks V2

Em `app/src/hooks/`:

- `useFeatureFlag()` — chama `v2GetFeatureFlags`
- `useAuth()`, `useTenantId()`, `useUserProfile()` — consumo do Firebase Auth + `userProfiles`
- `useTenantSettings()`, `useTenantEntitlements()` — leitura de docs do tenant
- `useCases()`, `useClientCases()` — subscriptions às listas

Em `app/src/dossie/hooks/`:

- `useDossierCreate()` — chama `v2CreateClientSolicitation`
- `useDossierList()`, `useDossierDetail()` — subscriptions ao caso + projeções
- `useDossierProgress()` — agrega `moduleRuns` → percentual
