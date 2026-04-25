# 03 — Firestore Model (Collections, Rules, Indexes)

Todas as coleções declaradas em [`COMPLIANCE_HUB_V2/app/firestore.rules`](../../app/firestore.rules) (332 linhas) + índices em [`firestore.indexes.json`](../../app/firestore.indexes.json).

## A. Roles reconhecidos (security rules)

| Role | Origem | Permite |
|---|---|---|
| `admin` | internal staff | leitura/escrita irrestrita dentro do tenant; `isGlobalAdmin()` se `tenantId==null` |
| `supervisor` | internal staff | leitura/escrita + fechamento de billing |
| `senior_analyst` | internal staff | `canReadRawEvidence()` + leitura `rawSnapshots`, `providerRecords` |
| `analyst` | internal staff | `isAnalyst()`, leitura projetada |
| `CLIENT`, `client_manager`, `client_operator`, `client_viewer` | tenant users | `isClient()`, somente dados do próprio tenant |

Custom claims injetadas pelo trigger de criação de user (`role`, `tenantId`) — caem para `getUserProfile()` quando ainda não propagadas.

## B. Coleções

Ordem: seguindo declaração em `firestore.rules`.

### 1. `userProfiles/{userId}`

- **Regra:** `firestore.rules:77`
- **Leitura:** dono do doc OU qualquer analyst.
- **Escrita:** via callables (`v2CreateOpsClientUser`, `v2CreateTenantUser`, `v2UpdateTenantUser`, `v2UpdateOwnProfile`).
- **Campos típicos:** `uid`, `email`, `displayName`, `role`, `tenantId`, `tenantName`, `status`, `lastLoginAt`.

### 2. `cases/{caseId}`

- **Regra:** `firestore.rules:86`
- **Subcoleções:** `publicResult/{docId}`, `aiCache/{docId}`.
- **Leitura:** analyst do tenant ou ops global.
- **Escrita:** via callables / triggers de enriquecimento.
- **Campos críticos:** `tenantId`, `status` (máquina em `v2CaseStatus.cjs`), `productKey`, `dossierPresetKey`, `dossierSchemaKey`, `subjectRef`, `candidateId`, `assigneeId`, `createdAt`, `updatedAt`, `juditStatus`, `bigDataCorp*`, `escavador*`, `djen*`, `fontedata*`, `aiResult`, `reviewGateState`, `decision`.

### 3. `clientCases/{caseId}`

- **Regra:** `firestore.rules:109`
- **Leitura:** client do mesmo tenant.
- **Escrita:** triggers `v2SyncClientCase*`.
- **Uso:** Projeção reduzida consumida pelo portal do cliente.

### 4. `clientProjections/{caseId}`

- **Regra:** `firestore.rules:117`
- **Build:** `buildClientProjectionContract` em `v2Core.cjs:441`.
- **Campos:** `productKey`, `subject`, `summaryCards`, `sections`, `disclaimers`, `createdAt`, `publishedAt`.

### 5. `clientCaseList/{caseId}`

- **Regra:** `firestore.rules:125`
- **Uso:** Read model enxuto para listagem `/cliente/dossies`.

### 6. `decisions/{decisionId}`

- **Regra:** `firestore.rules:134`
- **Campos:** `caseId`, `decision`, `rationale`, `decidedBy`, `decidedAt`, `warrantFlag`, `criminalFlag`.

### 7. `reportSnapshots/{snapshotId}`

- **Regra:** `firestore.rules:139`
- **Build:** `buildReportSnapshotFromV2` em `v2ReportSections.cjs:324`.
- **Campos:** `caseId`, `contentHash`, `sections`, `sectionContributions`, `riskSummary`, `keyFindings`, `renderContractVersion`, `createdAt`.

### 8. `moduleRuns/{moduleRunId}`

- **Regra:** `firestore.rules:144`
- **Build:** `buildModuleRunsForCase` em `v2Modules.cjs`.
- **Campos:** `caseId`, `tenantId`, `moduleKey`, `providerId`, `status`, `attempts`, `startedAt`, `completedAt`, `inputRef`, `outputRef`, `errorMessage`.

### 9. `subjects/{subjectId}`

- **Regra:** `firestore.rules:149`
- **Uso:** Identidade única de pessoa/empresa através de múltiplos casos.

### 10. `persons/{personId}`

- **Regra:** `firestore.rules:154`
- **Uso:** PF canônica deduplicada.

### 11. `companies/{companyId}`

- **Regra:** `firestore.rules:159`
- **Uso:** PJ canônica deduplicada.

### 12. `facts/{factId}`

- **Regra:** `firestore.rules:164`
- **Uso:** Afirmações normalizadas com origem/confiança.

### 13. `relationships/{relationshipId}`

- **Regra:** `firestore.rules:169`
- **Uso:** Grafo pessoa↔pessoa, pessoa↔empresa.

### 14. `timelineEvents/{eventId}`

- **Regra:** `firestore.rules:174`
- **Build:** `buildTimelineEventsForCase` em `v2Timeline.cjs:106`.
- **Campos:** `caseId`, `tenantId`, `kind`, `actor`, `subjectRef`, `occurredAt`, `metadata`.

### 15. `providerDivergences/{divergenceId}`

- **Regra:** `firestore.rules:179`
- **Uso:** Registra quando dois provedores retornam dados conflitantes; resolvido via `v2ResolveProviderDivergenceByAnalyst`.

### 16. `providerRequests/{requestId}`

- **Regra:** `firestore.rules:184`
- **Leitura:** apenas `canReadRawEvidence` (senior+).
- **Uso:** Ledger de cada chamada externa (provider, requestId, status, latencyMs, cost).

### 17. `rawSnapshots/{snapshotId}`

- **Regra:** `firestore.rules:189`
- **Leitura:** senior+ apenas.
- **Uso:** Payload cru do provedor (às vezes via Storage ref).

### 18. `providerRecords/{recordId}`

- **Regra:** `firestore.rules:194`
- **Leitura:** senior+ apenas.
- **Uso:** Registros estruturados extraídos do raw (ex: `snap.payload.processes[i]` → `providerRecord`).

### 19. `evidenceItems/{evidenceId}`

- **Regra:** `firestore.rules:199`
- **Leitura:** analyst.
- **Build:** `v2OperationalArtifactBuilder.cjs`.
- **Campos:** `caseId`, `moduleKey`, `sourceKey`, `renderType`, `payload`, `confidence`, `highlights`.

### 20. `riskSignals/{signalId}`

- **Regra:** `firestore.rules:204`
- **Uso:** Sinais de risco derivados de evidências (score/severity).

### 21. `usageMeters/{usageMeterId}`

- **Regra:** `firestore.rules:209`
- **Build:** `v2UsageMeters.cjs`.
- **Campos:** `tenantId`, `monthKey`, `providerId`, `dataset`, `unitCost`, `units`, `totalCost`.

### 22. `candidates/{candidateId}`

- **Regra:** `firestore.rules:215`
- **Uso:** Dados cadastrais declarados pelo cliente (nome, contato, redes sociais).

### 23. `auditLogs/{logId}` (global)

- **Regra:** `firestore.rules:222`
- **Leitura:** admin only.

### 24. `tenantAuditLogs/{logId}`

- **Regra:** `firestore.rules:228`
- **Leitura:** analyst do tenant.

### 25. `tenantSettings/{tenantId}`

- **Regra:** `firestore.rules:237`
- **Leitura:** analyst do tenant.
- **Escrita:** via `v2UpdateTenantSettingsByAnalyst`.
- **Campos:** `analysisConfig`, `submissionLimits`, `contactInfo`, `branding`.

### 26. `tenantEntitlements/{tenantId}`

- **Regra:** `firestore.rules:246`
- **Campos:** `tier`, `enabledProducts: { [productKey]: bool }`, `enabledFeatures`, `maxCasesPerMonth`, `maxReprocessCount`.

### 27. `tenantConfigs/{tenantId}`

- **Regra:** `firestore.rules:251`
- **Uso:** Config credentials por tenant (FonteData key, Escavador token override, etc.).

### 28. `exports/{exportId}`

- **Regra:** `firestore.rules:257`
- **Criação:** via `v2RegisterClientExport`.

### 29. `publicReports/{token}`

- **Regra:** `firestore.rules:265`
- **Leitura:** aberta (token é pseudo-secret).
- **Campos:** `caseId`, `html`, `meta`, `revokedAt`, `createdBy`, `expiresAt?`.

### 30. `systemHealth/{providerId}`

- **Regra:** `firestore.rules:279`
- **Escrita:** background jobs.
- **Campos:** `status`, `latencyMs`, `lastOkAt`, `lastErrorAt`.

### 31. `tenantUsage/{tenantId}`

- **Regra:** `firestore.rules:285`
- **Uso:** Agregação diária de uso por tenant.

### 32. `billingSettlements/{settlementId}`

- **Regra:** `firestore.rules:293`
- **Criação:** via `v2CloseTenantBillingPeriodByAnalyst` ou `v2ScheduledBillingClosureJob`.
- **Formato `settlementId`:** `billing_{tenantId}_{YYYY-MM}`.

### 33. `billingEntries/{entryId}`

- **Regra:** `firestore.rules:298`
- **Uso:** Linha-a-linha do billing (pode substituir `usageMeters` em billing novo).

### 34. `watchlists/{watchlistId}`

- **Regra:** `firestore.rules:303`
- **Operações:** `v2CreateWatchlist`, `v2PauseWatchlist`, `v2ResumeWatchlist`, `v2DeleteWatchlist`, `v2RunWatchlistNow`.

### 35. `seniorReviewRequests/{requestId}`

- **Regra:** `firestore.rules:308`
- **Operações:** `v2GetSeniorReviewQueue`, `v2ResolveSeniorReviewRequest`.

### 36. `quoteRequests/{quoteId}`

- **Regra:** `firestore.rules:313`
- **Operações:** `v2CreateQuoteRequest`, `v2ResolveQuoteRequest`.

### 37. `monitoringSubscriptions/{subscriptionId}`

- **Regra:** `firestore.rules:321`
- **Uso:** Assinatura de notificações por sujeito/caso.

### 38. `alerts/{alertId}`

- **Regra:** `firestore.rules:326`
- **Operações:** leitura por subscriber; `v2MarkAlertAs`.

---

## C. Indexes (`firestore.indexes.json`)

Principais índices compostos (consultar arquivo para lista completa).

| Coleção | Campos | Motivo |
|---|---|---|
| `cases` | `tenantId` + `status` + `updatedAt desc` | Lista de casos ops |
| `cases` | `tenantId` + `assigneeId` + `status` | Fila do analyst |
| `clientCases` | `tenantId` + `createdAt desc` | Lista do cliente |
| `usageMeters` | `tenantId` + `monthKey` + `providerId` | Billing overview |
| `billingEntries` | `tenantId` + `monthKey` | Billing close |
| `providerRequests` | `caseId` + `providerId` + `createdAt` | Drill-down ledger |
| `timelineEvents` | `caseId` + `occurredAt desc` | Timeline do caso |
| `seniorReviewRequests` | `status` + `createdAt desc` | Fila sênior |
| `alerts` | `tenantId` + `status` + `createdAt desc` | Inbox de alertas |

## D. Conclusões relevantes da auditoria 2026-04-23

Do audit [`2026-04-23-backend-dossie-flow-audit.md`](../audits/2026-04-23-backend-dossie-flow-audit.md):

**Coleções novas propostas (ainda não implementadas):**

- `dossierSchemas/{schemaKey_version}`
- `dossierPresets/{presetKey_version}`
- `tenantDossierPolicies/{tenantId}`
- `sourceRows` (ou projeção em `providerRequests`)
- `detailEntries`
- `analyticsBlocks`
- `commentThreads`
- `approvalState`
- `exportJobs`
- `judicialProcesses` (modelo processual canônico)

**Campos novos propostos em coleções existentes:**

- `moduleRuns`: `sectionGroupKey`, `sectionKey`, `sourceRowKeys`, `uiVisibility`, `responsivePriority`
- `evidenceItems`: `renderType`, `detailPayload`, `sourceBlockKey`, `desktopSummary`, `mobileSummary`, `isPrimaryForSource`
- `reportSnapshots`: `dossierSchemaKey`, `dossierPresetKey`, `configurationHash`, `sectionGroups`, `sourceRows`, `detailEntries`, `analyticsBlocks`, `responsiveRenderHints`
- `clientProjections`: `listProjection` + `dossierProjection` como camadas separadas
- `cases`: `dossierSchemaKey`, `dossierPresetKey`, `customDossierConfig`, `configurationHash`
