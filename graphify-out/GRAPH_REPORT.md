# Graph Report - ComplianceHub  (2026-06-01)

## Corpus Check
- 269 files · ~324,665 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1622 nodes · 3010 edges · 199 communities (192 shown, 7 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 367 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `848383e2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 91|Community 91]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 58 edges
2. `callBackendFunction()` - 49 edges
3. `extractErrorMessage()` - 37 edges
4. `runAutoClassifyAndAi()` - 36 edges
5. `rerunAiForCase()` - 29 edges
6. `CasoPage()` - 25 edges
7. `runJuditEnrichmentPhase()` - 23 edges
8. `buildCaseBody()` - 21 edges
9. `writeAuditEvent()` - 20 edges
10. `useCases()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `buildCanonicalReportHtml()` --calls--> `buildCaseReportHtml()`  [INFERRED]
  functions/index.js → src/core/reportBuilder.js
- `buildCanonicalReportHtml()` --calls--> `buildCaseReportHtml()`  [INFERRED]
  functions/modules/exportJobsAndReports.js → src/core/reportBuilder.js
- `runEscavadorEnrichmentPhase()` --calls--> `getEscavadorTribunais()`  [INFERRED]
  functions/index.js → functions/helpers/tribunalMap.js
- `runJuditEnrichmentPhase()` --calls--> `getJuditTribunais()`  [INFERRED]
  functions/index.js → functions/helpers/tribunalMap.js
- `PublicReportPage()` --calls--> `formatDateTimeBR()`  [INFERRED]
  src/pages/PublicReportPage.jsx → src/core/formatDate.js

## Communities (199 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (54): formatDuration(), getSlaColor(), getSlaDeadline(), getSlaStatus(), parseDate(), getOverallEnrichmentStatus(), formatDate(), formatDateTimeBR() (+46 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (46): applyCascadeReset(), applyDeleteFields(), assertCanAssignCase(), assertOpsManager(), backfillClientCasesMirrorInner(), buildExecutiveSummary(), buildExecutiveSummaryFallback(), buildExpandedKeyFindings() (+38 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (51): adaptEscavador(), adaptJuditExecution(), adaptJuditLawsuits(), adaptJuditWarrants(), buildAndreCase(), buildCaseBase(), buildCaseWithBigDataCorpProcess(), buildCaseWithJuditRole() (+43 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (38): buildSearchText(), db(), interpolateTemplate(), stripUndefined(), writeAuditEvent(), buildPdfWatermarkCss(), escapeHtml(), injectPdfExportCss() (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (50): callGet(), EscavadorError, queryMovimentacoes(), queryProcessoByCnj(), queryProcessosByPerson(), callEndpoint(), FonteDataError, queryCriminal() (+42 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (36): buildClientCasePayload(), clientPayloadChanged(), enforceTenantSubmissionLimits(), formatDateKey(), formatMonthKey(), getClientQuotaStatusInner(), getClientUserProfile(), writeClientCaseMirror() (+28 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (48): buildAiPrompt(), asDate(), classifyWarrantType(), dedupePartyNames(), detectCartaDeGuia(), extractSentenceDetails(), filterDjenComunicacoesByConfirmedProcess(), findLinkedCivilProcess() (+40 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (35): fixLatinMojibake(), isStringArray(), looksLikeRawJsonOrTechnicalPayload(), normalizeUnicodeToAscii(), parseAiClassificationReviewResponse(), parseAiHomonymResponse(), parseAiPrefillResponse(), parseAiResponse() (+27 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (40): callBackendFunction(), callConcludeCaseByAnalyst(), callCreateClientSolicitation(), callCreateOpsClientUser(), callGetClientCaseById(), callGetClientDashboardMetrics(), callGetClientExportCases(), callGetClientGeoIp() (+32 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (33): callGet(), DjenError, queryComunicacoesByName(), queryComunicacoesByProcesso(), queryTribunais(), extractKnownProcessNumbers(), runDjenEnrichmentPhase(), buildCandidateUfs() (+25 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (19): asDate(), asIsoOrNull(), buildOpsMetricsFromCases(), buildProviderRunIds(), compareClientCases(), compareOpsCases(), diffHoursBackend(), getMetricCaseDate() (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (34): acquireAutoClassifyRun(), buildAiClassificationReviewUpdatePayload(), buildAiHomonymPrompt(), buildAiHomonymResetPayload(), buildAiHomonymUpdatePayload(), buildAiPrefillUpdatePayload(), buildAiUpdatePayload(), buildSafeNarrativeReplacement() (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (30): applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAiClassificationReviewPrompt(), buildAiHomonymPrompt(), buildAiPrefillPrompt(), buildAiPrompt(), buildAxisReviewContext() (+22 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (17): AuthProvider(), AuthProbe(), useAuth(), DemoProviders(), Sidebar(), NotificationProvider(), PerfilPage(), formatRoleLabel() (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.1
Nodes (30): buildAiPrefillPrompt(), buildNextSteps(), buildProcessHighlights(), buildReportSlug(), buildResetPublishedCaseFields(), buildReviewDraftSeed(), buildSanitizedPublicResultSnapshot(), buildStatusSummary() (+22 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (27): buildDetCriminalNotes(), buildDeterministicPrefill(), buildDetExecutiveSummary(), buildDetFinalJustification(), buildDetKeyFindings(), buildDetLaborNotes(), buildDetWarrantNotes(), classifyWarrantType() (+19 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (24): badge(), buildBatchReportHtml(), buildCaseBody(), buildCaseReportHtml(), esc(), fieldHtml(), flagColor(), formatBirthAndAge() (+16 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (10): getActionBadgeStyle(), getActionFilterOptions(), getActionLabel(), getCategoryColor(), getCategoryFilterOptions(), getCategoryLabel(), AuditoriaClientePage(), getErrorMessage() (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (11): buildPrintableHtml(), esc(), ExportacoesPage(), normalizeJobStatus(), getMockExports(), callCancelExportJob(), callCreateExportJob(), callGetExportJobStatus() (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.16
Nodes (20): hasBenignNoProcessCoverage(), buildCanonicalReportHtml(), buildExecutiveSummary(), buildExecutiveSummaryFallback(), buildExpandedKeyFindings(), buildKeyFindings(), buildNextSteps(), buildSafeNarrativeReplacement() (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (13): getMacroProgress(), hasAnySocialProfile(), hasMeaningfulSocialAnalysis(), SolicitacoesPage(), getCaseStats(), getTenantSettings(), getTenantUsage(), useClientCasesQuery() (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (16): buildBigDataCorpProcessCandidates(), buildCandidateProfile(), buildCoverageAssessment(), buildEscavadorProcessCandidates(), buildHardFacts(), buildHomonymAnalysisInput(), buildJuditProcessCandidates(), dedupCandidatesByCnj() (+8 more)

### Community 22 - "Community 22"
Cohesion: 0.12
Nodes (4): asDate(), getPublicReportViewInner(), resolvePublicReportStatus(), serializeManagedPublicReport()

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (15): TenantProvider(), canAccessAllTenants(), dedupeTenants(), getSelectedTenantLabel(), normalizeTenantEntry(), resolveSelectedTenantId(), resolveTenantOptions(), subscribeToAuditLogs() (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.19
Nodes (16): buildCaseReportPath(), buildClientInternalReportPath(), countCasesByMonth(), countCompletedCasesByMonth(), diffHours(), getAttentionReasons(), getCaseTimeline(), getClientDashboardMetrics() (+8 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (9): TenantProbe(), useTenant(), fetchPublicReports(), ClientesPage(), getReportCandidateName(), getReportStatus(), isExpired(), RelatoriosPage() (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.16
Nodes (8): classifyError(), cleanMessage(), extractErrorMessage(), getUserFriendlyMessage(), isSafeForUser(), SaudePage(), getAuthErrorMessage(), LoginPage()

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (14): callBackendFunction(), markAllNotificationsAsRead(), markNotificationAsRead(), subscribeToMyNotifications(), subscribeToUnreadNotifications(), getAudioContext(), isAudioUnlocked(), isSoundEnabled() (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.21
Nodes (9): createCaseCompletedNotifications(), createNewSolicitationNotifications(), createSendCaseMessageHandler(), getRequestIp(), isPrivateOrLocalIp(), lookupIpLocation(), normalizeIp(), sanitizeGeoText() (+1 more)

### Community 29 - "Community 29"
Cohesion: 0.13
Nodes (17): asDate(), asIsoOrNull(), compareClientCases(), compareOpsCases(), diffHoursBackend(), getMetricCaseDate(), getOverallEnrichmentStatusBackend(), getPublicReportViewInner() (+9 more)

### Community 30 - "Community 30"
Cohesion: 0.13
Nodes (17): applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAiClassificationReviewPrompt(), buildAxisReviewContext(), buildReviewSource(), compactBigDataCorpProcessos(), compactDjenComunicacoes() (+9 more)

### Community 31 - "Community 31"
Cohesion: 0.18
Nodes (8): maskCpf(), NovaSolicitacaoPanel(), validateCpf(), validateUrl(), FilterPanelMobile(), getEnabledPhases(), useMediaQuery(), MobileDataCardList()

### Community 32 - "Community 32"
Cohesion: 0.17
Nodes (8): ClientReportPage(), shortToken(), DashboardClientePage(), TestConsumer(), useCases(), useOpsCasesQuery(), CasosPage(), FilaPage()

### Community 33 - "Community 33"
Cohesion: 0.3
Nodes (13): buildConcludeUpdatePayload(), createConcludeCaseByAnalystHandler(), createSaveCaseDraftByAnalystHandler(), createSetAiDecisionByAnalystHandler(), createUpdateTenantSettingsByAnalystHandler(), normalizeKeyFindingsValue(), normalizeNarrativeValue(), pickConcludePayload() (+5 more)

### Community 34 - "Community 34"
Cohesion: 0.16
Nodes (15): buildClientVerdictPolicy(), classifyClientCriminalCategory(), dedupePartyNames(), getProcessParties(), getProcessRoleText(), inferStatusFromLastStep(), isActiveLaborParty(), isCandidateActiveLaborProcess() (+7 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (14): buildTenantStructuredQuery(), fetchAuditLogs(), fetchCandidates(), fetchCases(), fetchClientCases(), fetchClients(), fetchExports(), fetchOrderedCollection() (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.27
Nodes (10): isConfirmedMissingSnapshot(), isUnconfirmedMissingSnapshot(), createAuthFallbackProfile(), getAuthDisplayName(), mergeUserProfile(), normalizeString(), createRestDocumentSnapshot(), decodeFirestoreFields() (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.17
Nodes (4): renderPage(), renderPage(), renderPage(), ErrorBoundary

### Community 38 - "Community 38"
Cohesion: 0.2
Nodes (8): canRunFinalClassification(), computeAutoClassification(), hasPendingJuditAsync(), isJuditSettled(), isProviderTerminalForPipeline(), classifyAndMerge(), canRunFinalClassification(), computeAutoClassification()

### Community 39 - "Community 39"
Cohesion: 0.22
Nodes (6): isFirestoreSentinel(), normalizeTenantSlug(), sanitizeAuditMetadataValue(), sanitizePublicStructuredValue(), sanitizeStructuredText(), buildReportSlug()

### Community 40 - "Community 40"
Cohesion: 0.2
Nodes (7): callAssignCaseToAnalyst(), callAssignCaseToCurrentAnalyst(), callCreateOpsUser(), callListOpsUsers(), callUpdateOpsUser(), EquipeOpsPage(), getStatusConfig()

### Community 41 - "Community 41"
Cohesion: 0.18
Nodes (11): buildCanonicalReportHtml(), buildSourceSummary(), computeAutoClassifySignature(), computePublicSnapshotHash(), computeSimpleHash(), hasPublicReportMinimumContent(), prepareCanonicalReport(), sanitizePublicReportHtml() (+3 more)

### Community 42 - "Community 42"
Cohesion: 0.27
Nodes (5): assertCanAccessCaseCommunication(), buildNotificationId(), createNotification(), resolveUserPortal(), sanitizeNotificationIdPart()

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (8): createEnrichBigDataCorpOnCaseHandler(), createEnrichBigDataCorpOnCorrectionHandler(), createEnrichDjenOnCaseHandler(), createEnrichEscavadorOnCaseHandler(), createEnrichJuditOnCaseHandler(), createEnrichJuditOnCorrectionHandler(), makeDeps(), makeMockDb()

### Community 44 - "Community 44"
Cohesion: 0.24
Nodes (7): canBypassIdentityGate(), isIdentityGateBlocked(), validateConcludePayload(), canAssignCases(), compareClientCases(), compareOpsCases(), getMetricCaseDate()

### Community 45 - "Community 45"
Cohesion: 0.42
Nodes (6): buildClientPortalPath(), buildOpsPortalPath(), getClientPortalBasePath(), getOpsPortalBasePath(), isDemoPortalPath(), normalizeLeaf()

### Community 46 - "Community 46"
Cohesion: 0.27
Nodes (5): fmtBRL(), fmtUSD(), MetricasIAPage(), pct(), QualityBar()

### Community 47 - "Community 47"
Cohesion: 0.36
Nodes (7): BigDataCorpError, buildCombinedDatasets(), callPost(), delay(), queryCombined(), queryKyc(), queryProcesses()

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (3): resolveTheme(), useTheme(), Topbar()

### Community 49 - "Community 49"
Cohesion: 0.22
Nodes (9): fixLatinMojibake(), normalizeUnicodeToAscii(), parseAiClassificationReviewResponse(), parseAiHomonymResponse(), parseAiPrefillResponse(), parseAiResponse(), parseJsonSchemaResponse(), sanitizeAiOutput() (+1 more)

### Community 51 - "Community 51"
Cohesion: 0.29
Nodes (5): generatePublicReportPdf(), getPublicReport(), getPublicReportView(), triggerPdfDownload(), PublicReportPage()

### Community 52 - "Community 52"
Cohesion: 0.29
Nodes (4): CaseCommunicationPanel(), callMarkCaseCommunicationRead(), callSendCaseMessage(), subscribeToCaseMessages()

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (5): EquipePage(), getStatusConfig(), callCreateTenantUser(), callListTenantUsers(), callUpdateTenantUser()

### Community 54 - "Community 54"
Cohesion: 0.38
Nodes (3): NotificationBell(), useNotifications(), NotificationToast()

### Community 56 - "Community 56"
Cohesion: 0.4
Nodes (6): revokeCasePublicationArtifacts(), syncPublicResultLatest(), prepareCanonicalReport(), publishResultOnCaseDoneLogic(), computePublicSnapshotHash(), hasPublicReportMinimumContent()

### Community 58 - "Community 58"
Cohesion: 0.4
Nodes (3): getReportStatus(), isReportAvailable(), RelatoriosClientePage()

### Community 59 - "Community 59"
Cohesion: 0.4
Nodes (6): isStringArray(), validateAiClassificationReviewSchema(), validateAiHomonymSchema(), validateAiPrefillSchema(), validateAiSchema(), validateClassificationReviewAxis()

### Community 60 - "Community 60"
Cohesion: 0.6
Nodes (3): hasPendingJuditAsync(), isJuditSettled(), isProviderTerminalForPipeline()

### Community 61 - "Community 61"
Cohesion: 0.7
Nodes (4): decodeCursor(), encodeCursor(), normalizeLimit(), paginateFirestoreQuery()

### Community 64 - "Community 64"
Cohesion: 0.7
Nodes (4): createDeps(), createMockDb(), createMockJuditApiKey(), createMockNormalize()

### Community 66 - "Community 66"
Cohesion: 0.5
Nodes (4): buildTenantCollectionQuery(), subscribeToCases(), subscribeToClientCases(), subscribeToExports()

### Community 67 - "Community 67"
Cohesion: 0.4
Nodes (5): formatFirestoreDate(), formatFirestoreTimestamp(), mapCandidateDocument(), mapCaseDocument(), mapClientProfile()

### Community 68 - "Community 68"
Cohesion: 0.7
Nodes (4): classifyRole(), getRoleScoreImpact(), isHighRiskRole(), isLowRiskRole()

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (3): makeBaseDeps(), makeCorrectionDeps(), makeMockDb()

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildCaseReportHtml()` connect `Community 16` to `Community 8`, `Community 19`, `Community 51`, `Community 41`?**
  _High betweenness centrality (0.296) - this node is a cross-community bridge._
- **Why does `buildCanonicalReportHtml()` connect `Community 41` to `Community 16`, `Community 1`?**
  _High betweenness centrality (0.262) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 13` to `Community 32`, `Community 0`, `Community 66`, `Community 58`, `Community 8`, `Community 40`, `Community 17`, `Community 18`, `Community 20`, `Community 53`, `Community 52`, `Community 23`, `Community 25`, `Community 26`, `Community 27`, `Community 31`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Are the 31 inferred relationships involving `useAuth()` (e.g. with `AccessState()` and `ProfileResolutionState()`) actually correct?**
  _`useAuth()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `extractErrorMessage()` (e.g. with `getAuthErrorMessage()` and `getErrorMessage()`) actually correct?**
  _`extractErrorMessage()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `runAutoClassifyAndAi()` (e.g. with `writeAuditEvent()` and `buildHomonymAnalysisInput()`) actually correct?**
  _`runAutoClassifyAndAi()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `rerunAiForCase()` (e.g. with `buildHomonymAnalysisInput()` and `buildAiHomonymResetPayload()`) actually correct?**
  _`rerunAiForCase()` has 12 INFERRED edges - model-reasoned connections that need verification._