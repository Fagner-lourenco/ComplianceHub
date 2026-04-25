# 01 — V2 Backend Surface (Firebase Functions)

Superfície completa exportada por [`COMPLIANCE_HUB_V2/app/functions/index.js`](../../app/functions/index.js) (10 700+ linhas). Todas as funções são deployadas em `southamerica-east1` salvo onde indicado.

## Runtime base

| Item | Valor |
|---|---|
| Plataforma | Firebase Functions Gen2 (`firebase-functions/v2`) |
| Região padrão | `southamerica-east1` |
| Imports `onCall` / `onRequest` | `firebase-functions/v2/https` |
| Imports `onSchedule` | `firebase-functions/v2/scheduler` |
| Imports `onDocumentCreated/Updated/Deleted` | `firebase-functions/v2/firestore` |
| AI model usado | `gpt-5.4-nano` (OpenAI) |
| Custo input/output AI | USD 0,20 / 1,25 por M tokens (anotado em `AI_COST_INPUT` / `AI_COST_OUTPUT`) |

## Secrets (Firebase params)

Definidos via `defineSecret` em `index.js:208-213`:

| Secret | Uso |
|---|---|
| `FONTEDATA_API_KEY` | FonteData (antecedentes, mandados, receita federal, TRTs) |
| `OPENAI_API_KEY` | Análise AI + homônimos + prefill |
| `ESCAVADOR_API_TOKEN` | Escavador (processos por pessoa/CNJ) |
| `JUDIT_API_KEY` | Judit sync/async + entidade datalake |
| `BIGDATACORP_ACCESS_TOKEN` | BigDataCorp auth header `AccessToken` |
| `BIGDATACORP_TOKEN_ID` | BigDataCorp auth header `TokenId` |

---

## A. Firestore Triggers

Funções acionadas por escrita em documentos do Firestore.

### A.1 v2EnrichJuditOnCase

- **Tipo:** `onDocumentUpdated`
- **Path:** `cases/{caseId}`
- **Arquivo:** [`index.js:3498`](../../app/functions/index.js#L3498)
- **Função:** Dispara enriquecimento Judit (lawsuits + warrants) quando caso transiciona para um estado elegível.
- **Produz:** `providerRequests`, `rawSnapshots`, `evidenceItems`, `riskSignals`, atualiza `cases.juditStatus`.

### A.2 v2EnrichBigDataCorpOnCase

- **Tipo:** `onDocumentCreated`
- **Path:** `cases/{caseId}`
- **Arquivo:** [`index.js:3566`](../../app/functions/index.js#L3566)
- **Função:** Enriquece caso imediatamente após criação com datasets BigDataCorp (`basic_data`, `processes`, `kyc`, `occupation_data`).
- **Produz:** `providerRequests`, `rawSnapshots`, `providerRecords`, normaliza em `cases.bigDataCorp*`.

### A.3 v2EnrichJuditOnCorrection

- **Tipo:** `onDocumentUpdated`
- **Path:** `cases/{caseId}`
- **Arquivo:** [`index.js:3625`](../../app/functions/index.js#L3625)
- **Função:** Re-enriquece Judit após cliente submeter correção de identidade.

### A.4 v2EnrichEscavadorOnCase

- **Tipo:** `onDocumentUpdated`
- **Path:** `cases/{caseId}`
- **Arquivo:** [`index.js:3673`](../../app/functions/index.js#L3673)
- **Função:** Enriquece com processos Escavador quando Judit termina ou gate específico é alcançado.

### A.5 v2EnrichDjenOnCase

- **Tipo:** `onDocumentUpdated`
- **Path:** `cases/{caseId}`
- **Arquivo:** [`index.js:3777`](../../app/functions/index.js#L3777)
- **Função:** Enriquece com comunicações processuais do Diário de Justiça Eletrônico Nacional (PJE).

### A.6 v2SyncClientCaseOnCreate / OnUpdate / OnDelete

- **Tipo:** `onDocumentCreated` / `onDocumentUpdated` / `onDocumentDeleted`
- **Path:** `cases/{caseId}`
- **Arquivos:** [`index.js:4777`, `4788`, `4799`](../../app/functions/index.js)
- **Função:** Mantém `clientCases/{caseId}` sincronizado com projeção reduzida para cliente.

### A.7 v2PublishResultOnCaseDone

- **Tipo:** `onDocumentUpdated`
- **Path:** `cases/{caseId}`
- **Arquivo:** [`index.js:4808`](../../app/functions/index.js#L4808)
- **Função:** Quando `status == DONE`, materializa `reportSnapshots`, `clientProjections`, `publicResult` e artefatos de publicação.

---

## B. Callables (HTTPS onCall)

Todas autenticadas via Firebase Auth. Agrupadas por área.

### B.1 Usuários & Tenants

#### v2CreateOpsClientUser

- **Arquivo:** [`index.js:4846`](../../app/functions/index.js#L4846)
- **Auth:** Ops admin.
- **Input:** `{ email, password, displayName, tenantName, tenantId?, role='client_manager' }`
- **Retorna:** `{ success, uid, tenantId }`
- **Efeitos:** Cria user em Firebase Auth + `userProfiles/{uid}` + provisiona tenant se novo.

#### v2ListTenantUsers

- **Arquivo:** [`index.js:4929`](../../app/functions/index.js#L4929)
- **Auth:** Qualquer user autenticado (retorna apenas users do próprio tenant ou todos se ops).
- **Input:** `{}`
- **Retorna:** `{ users: [{ uid, email, displayName, role, status }] }`

#### v2CreateTenantUser

- **Arquivo:** [`index.js:4962`](../../app/functions/index.js#L4962)
- **Auth:** Client manager ou ops.
- **Input:** `{ email, password, displayName, role='client_viewer' }`
- **Retorna:** `{ success, uid }`

#### v2UpdateTenantUser

- **Arquivo:** [`index.js:5022`](../../app/functions/index.js#L5022)
- **Auth:** Client manager ou ops.
- **Input:** `{ targetUid, role?, status?, displayName? }`
- **Retorna:** `{ success }`

#### v2UpdateOwnProfile

- **Arquivo:** [`index.js:5117`](../../app/functions/index.js#L5117)
- **Auth:** Qualquer user autenticado.
- **Input:** `{ displayName }`
- **Retorna:** `{ success }`

### B.2 Casos / Solicitações (criação + correção + export)

#### v2CreateClientSolicitation

- **Arquivo:** [`index.js:5156`](../../app/functions/index.js#L5156) (330+ linhas)
- **Auth:** Client user (qualquer role client).
- **Input completo:**
  ```ts
  {
    fullName?, legalName?, tradeName?, cpf?, cnpj?,
    productKey,                      // obrigatório, ex: 'due_diligence_pf'
    dossierPresetKey?,               // ex: 'financeiro_pf' (audit: preset versionado)
    dossierSchemaKey?,               // ex: 'pf_schema_v1'
    dossierTag?, dossierTags?: [],
    dossierParameters?: {},          // parâmetros por área (autoMarkRelevant etc.)
    requestedSectionKeys?: [],
    requestedMacroAreaKeys?: [],
    requestedSourceKeys?: [],
    requestedModuleKeys?: [],
    configurationSource?: 'preset'|'custom'|'hybrid',
    customProfileName?, customProfileDescription?,
    autoProcess?, createAndProcessAutomatically?,
    dateOfBirth?, position?, department?, hiringUf?,
    email?, phone?, priority?='NORMAL',
    digitalProfileNotes?,
    socialProfiles?: { instagram, facebook, linkedin, tiktok, twitter, youtube },
    otherSocialUrls?: []
  }
  ```
- **Validações:** `PRODUCT_REGISTRY[productKey]` deve existir. Entitlement `CASE_CREATION` + produto habilitado. Sujeito PF → CPF 11 dígitos; PJ → CNPJ 14 dígitos + legalName.
- **Retorna:** `{ success, caseId, candidateId }`
- **Efeitos:** Cria `candidates/{candidateId}` + `cases/{caseId}` em batch. Dispara trigger `v2EnrichBigDataCorpOnCase` em seguida.

#### v2SubmitClientCorrection

- **Arquivo:** [`index.js:5487`](../../app/functions/index.js#L5487)
- **Auth:** Client user (owner do caso).
- **Input:** `{ caseId, candidateName, cpf, linkedin='', instagram='' }`
- **Retorna:** `{ success }`
- **Efeitos:** Atualiza `cases.correctionSubmitted=true`, dispara `v2EnrichJuditOnCorrection`.

#### v2RegisterClientExport

- **Arquivo:** [`index.js:5613`](../../app/functions/index.js#L5613)
- **Auth:** Client user.
- **Input:** `{ type, scope, records=0, artifactMode='download' }`
- **Retorna:** `{ success, exportId }`
- **Efeitos:** Cria `exports/{exportId}` + `usageMeters` do uso (para billing).

#### v2BackfillClientCasesMirror

- **Arquivo:** [`index.js:5654`](../../app/functions/index.js#L5654)
- **Auth:** Ops admin.
- **Input:** `{ tenantId? }`
- **Retorna:** `{ scanned, updated }`
- **Efeitos:** Re-sincroniza `clientCases` para todos os `cases` do tenant (útil após mudança de projeção).

### B.3 Relatórios públicos

#### v2CreateAnalystPublicReport

- **Arquivo:** [`index.js:5685`](../../app/functions/index.js#L5685)
- **Auth:** Analyst ou ops admin.
- **Input:** `{ caseId, html?, meta? }`
- **Retorna:** `{ token, url, publicReportId }`
- **Efeitos:** Cria `publicReports/{token}` + URL `/public/{token}`.

#### v2CreateClientPublicReport

- **Arquivo:** [`index.js:5802`](../../app/functions/index.js#L5802)
- **Auth:** Client user.
- **Input:** `{ caseId }`
- **Retorna:** `{ token, url }`
- **Efeitos:** Cria relatório público via projeção cliente.

#### v2ListClientPublicReports / v2RevokeClientPublicReport / v2RevokePublicReport

- **Arquivos:** [`index.js:5892`, `5911`, `5968`](../../app/functions/index.js)
- **Função:** Listar / revogar tokens públicos. `v2RevokePublicReport` é ops-only; `v2RevokeClientPublicReport` é do cliente dono.

### B.4 Fluxo de análise (ops / analyst)

#### v2AssignCaseToCurrentAnalyst

- **Arquivo:** [`index.js:6171`](../../app/functions/index.js#L6171)
- **Auth:** Analyst.
- **Input:** `{ caseId }`
- **Retorna:** `{ success }`

#### v2ReturnCaseToClient

- **Arquivo:** [`index.js:6215`](../../app/functions/index.js#L6215)
- **Auth:** Analyst.
- **Input:** `{ caseId, reason?, suggestedCorrection? }`
- **Retorna:** `{ success }`

#### v2ConcludeCaseByAnalyst

- **Arquivo:** [`index.js:8035`](../../app/functions/index.js#L8035)
- **Auth:** Analyst assinalado (ou global admin).
- **Input:** `{ caseId, payload: { decision, warrantFlag, criminalFlag, executiveSummary, keyFindings, criminalNotes, laborNotes, warrantNotes, osintNotes, socialNotes, digitalNotes, ... } }`
- **Validações:** Se `juditActiveWarrantCount > 0`, `warrantFlag` deve ser `POSITIVE` ou `INCONCLUSIVE`. Caso `DONE` é idempotente.
- **Retorna:** `{ success, message? }`
- **Efeitos:** Marca `status=DONE`, dispara `v2PublishResultOnCaseDone`.

#### v2ResolveProviderDivergenceByAnalyst

- **Arquivo:** [`index.js:8254`](../../app/functions/index.js#L8254)
- **Auth:** Analyst.
- **Input:** `{ divergenceId, resolution, notes? }`
- **Retorna:** `{ success }`

#### v2SaveCaseDraftByAnalyst

- **Arquivo:** [`index.js:8922`](../../app/functions/index.js#L8922)
- **Auth:** Analyst.
- **Input:** `{ caseId, draft: {...} }`
- **Retorna:** `{ success }`

#### v2SetAiDecisionByAnalyst

- **Arquivo:** [`index.js:8964`](../../app/functions/index.js#L8964)
- **Auth:** Analyst.
- **Input:** `{ caseId, aiDecision, override? }`
- **Retorna:** `{ success }`

#### v2RerunAiAnalysis

- **Arquivo:** [`index.js:9454`](../../app/functions/index.js#L9454)
- **Auth:** Analyst.
- **Input:** `{ caseId }`
- **Retorna:** `{ success }`
- **Efeitos:** Invalida cache AI e reprocessa (`gpt-5.4-nano`).

#### v2RerunEnrichmentPhase

- **Arquivo:** [`index.js:9475`](../../app/functions/index.js#L9475)
- **Auth:** Analyst.
- **Input:** `{ caseId, phase }` onde `phase ∈ {judit|bigdatacorp|escavador|djen|fontedata}`
- **Retorna:** `{ success }`

### B.5 Tenants (configuração + entitlements + billing)

#### v2UpdateTenantSettingsByAnalyst

- **Arquivo:** [`index.js:8367`](../../app/functions/index.js#L8367)
- **Auth:** Supervisor ou admin.
- **Input:** `{ tenantId, settings: {...} }`
- **Retorna:** `{ success }`

#### v2GetTenantEntitlementsByAnalyst

- **Arquivo:** [`index.js:8413`](../../app/functions/index.js#L8413)
- **Auth:** Analyst com permissão.
- **Input:** `{ tenantId }`
- **Retorna:** `{ entitlements, resolved }`

#### v2UpdateTenantEntitlementsByAnalyst

- **Arquivo:** [`index.js:8448`](../../app/functions/index.js#L8448)
- **Auth:** Admin.
- **Input:** `{ tenantId, entitlements: {...} }`
- **Retorna:** `{ success }`

#### v2GetTenantBillingOverview

- **Arquivo:** [`index.js:8496`](../../app/functions/index.js#L8496)
- **Auth:** Ops com permissão para o tenant.
- **Input:** `{ tenantId, monthKey? }` (default: mês corrente, formato `YYYY-MM`)
- **Retorna:** `{ tenantId, monthKey, overview, source, fallbackUsed, usageMeterCount, billingEntryCount, limitApplied }`
- **Leitura:** `usageMeters` + `billingEntries` (até 500 cada).

#### v2GetFeatureFlags

- **Arquivo:** [`index.js:8544`](../../app/functions/index.js#L8544)
- **Auth:** Ops.
- **Input:** `{ tenantId }`
- **Retorna:** `{ tenantId, flags, tier, resolverVersion }`

#### v2CloseTenantBillingPeriodByAnalyst

- **Arquivo:** [`index.js:8570`](../../app/functions/index.js#L8570)
- **Auth:** Supervisor ou admin apenas.
- **Input:** `{ tenantId, monthKey }`
- **Retorna:** `{ success, settlementId, summary }`
- **Efeitos:** Cria `billingSettlements/billing_{tenantId}_{monthKey}`, grava audit event `TENANT_BILLING_PERIOD_CLOSED`.

#### v2GetTenantBillingSettlement

- **Arquivo:** [`index.js:8611`](../../app/functions/index.js#L8611)
- **Input:** `{ tenantId, monthKey }`
- **Retorna:** `{ tenantId, monthKey, settlementId, settlement|null }`

#### v2GetTenantBillingDrilldown

- **Arquivo:** [`index.js:8639`](../../app/functions/index.js#L8639)
- **Input:** `{ tenantId, monthKey }`
- **Retorna:** `{ tenantId, monthKey, drilldown, source, usageMeterCount, limitApplied }`
- **Observação:** Apenas users com `V2_PERMISSIONS.BILLING_VIEW_INTERNAL_COST` veem custo interno.

#### v2ExportTenantBillingDrilldown

- **Arquivo:** [`index.js:8680`](../../app/functions/index.js#L8680)
- **Input:** `{ tenantId, monthKey, format: 'csv'|'json' }`
- **Retorna:** `{ success, artifactRef|payload }`

### B.6 Fila de Revisão Sênior

#### v2GetSeniorReviewQueue

- **Arquivo:** [`index.js:8746`](../../app/functions/index.js#L8746)
- **Auth:** Senior analyst ou admin.
- **Input:** `{ tenantId?, limit? }`
- **Retorna:** `{ requests: [{ id, caseId, reason, createdAt, priority }] }`

#### v2ResolveSeniorReviewRequest

- **Arquivo:** [`index.js:8776`](../../app/functions/index.js#L8776)
- **Auth:** Senior analyst.
- **Input:** `{ requestId, resolution, notes? }`
- **Retorna:** `{ success }`

### B.7 Ops Metrics / Health

#### v2GetOpsV2Metrics

- **Arquivo:** [`index.js:8844`](../../app/functions/index.js#L8844)
- **Auth:** Ops.
- **Input:** `{ filters?: {} }`
- **Retorna:** `{ metrics: {...}, buckets: {...} }`

#### v2GetSystemHealth

- **Arquivo:** [`index.js:10131`](../../app/functions/index.js#L10131)
- **Auth:** Ops.
- **Input:** `{}`
- **Retorna:** `{ providers: [{ providerId, status, latencyMs, lastOkAt, lastErrorAt }] }`
- **Leitura:** `systemHealth/{providerId}`

### B.8 Previews (simular chamadas externas)

#### v2PreviewBigDataCorp

- **Arquivo:** [`index.js:10163`](../../app/functions/index.js#L10163)
- **Auth:** Ops.
- **Input:** `{ cpf, datasets='basic_data,processes,kyc,occupation_data', tenantId? }`
- **Retorna:** `{ raw, basicData, processes, kycData, professionData, elapsedMs }`
- **Utilidade:** Testar credenciais/fluxo BigDataCorp sem criar caso.

### B.9 Quotas / Quote requests / Catalog

#### v2GetClientQuotaStatus

- **Arquivo:** [`index.js:10231`](../../app/functions/index.js#L10231)
- **Auth:** Client user.
- **Retorna:** `{ quota, used, remaining, resetAt }`

#### v2CreateQuoteRequest / v2ResolveQuoteRequest

- **Arquivos:** [`index.js:10241`, `10280`](../../app/functions/index.js)
- **Função:** Cliente pede cotação; ops resolve com proposta.

#### v2GetClientProductCatalog

- **Arquivo:** [`index.js:10394`](../../app/functions/index.js#L10394)
- **Auth:** Client user.
- **Input:** `{ caseId? }` (para projetar catálogo contextual)
- **Retorna:** `{ products: [...], presets: [...] }`

### B.10 Alertas

#### v2MarkAlertAs

- **Arquivo:** [`index.js:10344`](../../app/functions/index.js#L10344)
- **Input:** `{ alertId, status: 'read'|'dismissed' }`
- **Retorna:** `{ success }`

### B.11 Watchlists & Monitoramento

#### v2CreateWatchlist / v2PauseWatchlist / v2ResumeWatchlist / v2DeleteWatchlist / v2RunWatchlistNow

- **Arquivos:** [`index.js:10463-10547`](../../app/functions/index.js)
- **Input `Create`:** `{ name, subjects: [], cadence, config }`
- **Input outras:** `{ watchlistId }`
- **Retorno:** `{ success, watchlistId? }`

### B.12 Artefatos V2

#### v2MaterializeV2Artifacts

- **Arquivo:** [`index.js:10429`](../../app/functions/index.js#L10429)
- **Auth:** Ops ou analyst do caso.
- **Input:** `{ caseId }`
- **Retorna:** `{ success, artifacts: {...} }`
- **Efeitos:** Re-materializa `moduleRuns`, `evidenceItems`, `riskSignals`, `reportSnapshot`, `clientProjection`.

### B.13 Onboarding

#### v2MarkProductIntroSeen

- **Arquivo:** [`index.js:10666`](../../app/functions/index.js#L10666)
- **Input:** `{ productKey }`
- **Retorna:** `{ success }`

---

## C. HTTP Endpoints (onRequest)

### C.1 v2JuditWebhook

- **Arquivo:** [`index.js:9636`](../../app/functions/index.js#L9636)
- **Método:** POST
- **Função:** Recebe callback async da Judit quando request termina.
- **Body:** Payload Judit `{ request_id, status, responses: [...] }`
- **Efeitos:** Atualiza `providerRequests`, dispara processing da resposta.

---

## D. Schedulers (onSchedule)

### D.1 v2JuditAsyncFallback

- **Arquivo:** [`index.js:9826`](../../app/functions/index.js#L9826)
- **Cron:** `every 10 minutes`
- **Função:** Polling fallback para requests Judit async cujo webhook falhou.

### D.2 v2ScheduledMonitoringJob

- **Arquivo:** [`index.js:10611`](../../app/functions/index.js#L10611)
- **Cron:** `00 03 * * *` (03:00 AM UTC diário)
- **Função:** Executa watchlists agendadas + dispara alertas/diffs.

### D.3 v2ScheduledBillingClosureJob

- **Arquivo:** [`index.js:10630`](../../app/functions/index.js#L10630)
- **Cron:** `30 02 1 * *` (dia 1 de cada mês, 02:30 AM UTC)
- **Função:** Fecha automaticamente faturamento do mês anterior para todos os tenants.

---

## E. Dependências de Domínio (`functions/domain/*.cjs`)

Módulos de lógica interna importados por `index.js`. Não são callables, mas compõem a superfície de comportamento.

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `dossierSchema.cjs` | 828 | `MACRO_AREAS`, `SECTION_REGISTRY`, `DOSSIER_SCHEMA_REGISTRY`, `buildDossierProjection`, resolvers de schema. **Base da arquitetura schema-driven (audit 2026-04-23).** |
| `v2Modules.cjs` | 834 | `PRODUCT_REGISTRY`, `PROVIDER_SOURCE_SPECS`, `resolveCaseEntitlements`, `buildModuleRunsForCase` |
| `v2OperationalArtifactBuilder.cjs` | 631 | Constrói `evidenceItems`, `riskSignals`, `providerRecords` a partir de rawSnapshots |
| `v2Core.cjs` | 564 | Helpers núcleo + `buildClientProjectionContract` |
| `v2ReportSections.cjs` | 406 | `buildReportSnapshotFromV2`, `buildSectionsFromV2` (legado; audit pede integração com `dossierSchema`) |
| `v2Subjects.cjs` | 330 | Sujeitos, deduplicação, histórico |
| `v2MonitoringEngine.cjs` | 297 | Engine de watchlists + diff |
| `v2Timeline.cjs` | 249 | `buildTimelineEventsForCase` |
| `v2ProductCatalog.cjs` | 204 | `PRODUCT_CATALOG` comercial |
| `v2MiniRelationships.cjs` | 193 | Grafo de relacionamentos |
| `v2BillingResolver.cjs` | 190 | Resolver preços/tier/features |
| `v2EntitlementResolver.cjs` | 189 | `resolveTenantEntitlements`, flags |
| `v2UsageMeters.cjs` | 185 | Contabilização de uso |
| `v2CaseStatus.cjs` | 159 | Máquina de estados do caso |
| `v2BillingDrilldown.cjs` | 157 | `buildBillingDrilldown` |
| `v2ProviderLedger.cjs` | 152 | Ledger de requests externos |
| `v2ReviewPolicyResolver.cjs` | 136 | Política de revisão sênior |
| `v2Rbac.cjs` | 129 | RBAC `V2_PERMISSIONS`, `hasV2Permission` |
| `v2SeniorReviewQueue.cjs` | 119 | Fila de revisão |
| `v2TenantEntitlements.cjs` | 118 | Entitlements por tenant |
| `v2SubjectManager.cjs` | 115 | Criação/merge de sujeitos |
| `v2RawSnapshot.cjs` | 114 | Armazenar payloads crus |
| `v2RawPayloadStorage.cjs` | 108 | Storage adapter para raw payloads |
| `v2MonitoringDiff.cjs` | 92 | Diff entre snapshots de monitoramento |
| `v2ReviewGate.cjs` | 90 | Portão de revisão pré-conclusão |
| `v2ClientProjectionBuilder.cjs` | 78 | Monta projeção cliente |
| `v2BillingEngine.cjs` | 58 | Close/summarize billing |
| `v2FreshnessPolicyResolver.cjs` | 59 | TTL/staleness de datasets |
| `v2ProviderDivergences.cjs` | 52 | Divergências entre provedores |

---

## F. Adapters externos (`functions/adapters/*.js`)

Detalhado em [`02-external-providers.md`](./02-external-providers.md).

| Arquivo | Provedor |
|---|---|
| `bigdatacorp.js` | BigDataCorp (POST /pessoas com datasets) |
| `judit.js` | Judit sync + async + entity datalake |
| `escavador.js` | Escavador v2 |
| `fontedata.js` | FonteData (antecedentes, mandados, TRT, receita) |
| `djen.js` | DJEN / PJE ComunicaAPI |

## G. Normalizers (`functions/normalizers/*.js`)

Converte payloads crus em estrutura canônica interna.

| Arquivo | Saída |
|---|---|
| `bigdatacorp.js` | `normalizeBigDataCorpBasicData`, `normalizeBigDataCorpProcesses`, `normalizeBigDataCorpKyc`, `normalizeBigDataCorpProfession` |
| `judit.js` | Processos + warrants normalizados |
| `escavador.js` | Processos unificados por CNJ |
| `djen.js` | Comunicações processuais tipadas (criminal/trabalhista/cível) |
| `phases.js` | Ordem de execução das fases de enriquecimento |

---

## H. Helpers

| Arquivo | Propósito |
|---|---|
| `helpers/aiHomonym.js` | Prompt/validação AI para desambiguação de homônimos |
| `helpers/aiCalibration.js` | Calibração de thresholds de confiança |
| `helpers/tribunalMap.js` | Mapa UF → tribunal (TRT/TJ/TRF) |
| `helpers/textNormalize.js` | Normalização de nomes/strings |
| `helpers/circuitBreaker.js` | Circuit breaker para AI e providers |

---

## I. Constantes AI

Em `index.js:403-550`:

| Constante | Valor |
|---|---|
| `AI_MODEL` | `gpt-5.4-nano` |
| `AI_MAX_TOKENS` | 1200 |
| `AI_MAX_TOKENS_PREFILL` | 2400 |
| `AI_PROMPT_VERSION` | `v3-evidence-based` |
| `AI_HOMONYM_PROMPT_VERSION` | `v1-homonym-dedicated` |
| `AI_PREFILL_PROMPT_VERSION` | `v1-report-prefill` |
| `AI_CACHE_TTL_MS` | 24h |
| `AI_COST_INPUT` | USD 0,20 / M tokens |
| `AI_COST_OUTPUT` | USD 1,25 / M tokens |
| `AI_CIRCUIT_THRESHOLD` | 3 falhas |
| `AI_CIRCUIT_COOLDOWN_MS` | 10 min |

---

## J. Audit Catalog

Import de [`functions/audit/auditCatalog.js`](../../app/functions/audit/auditCatalog.js).

| Export | Valores |
|---|---|
| `ACTOR_TYPE` | `OPS_USER`, `CLIENT_USER`, `SYSTEM` |
| `SOURCE` | `PORTAL_OPS`, `PORTAL_CLIENT`, `API`, `SCHEDULER`, `WEBHOOK` |

Ações auditáveis emitem `auditLogs/{logId}` ou `tenantAuditLogs/{logId}` com `templateVars` para reconstrução de mensagem legível.
