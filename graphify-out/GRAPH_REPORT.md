# Graph Report - ComplianceHub  (2026-06-02)

## Corpus Check
- 270 files · ~325,742 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1630 nodes · 3036 edges · 200 communities (192 shown, 8 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 372 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c751115a`
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
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 93|Community 93]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 58 edges
2. `callBackendFunction()` - 49 edges
3. `extractErrorMessage()` - 37 edges
4. `runAutoClassifyAndAi()` - 36 edges
5. `rerunAiForCase()` - 29 edges
6. `CasoPage()` - 26 edges
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
- `LoginPage()` --calls--> `useAuth()`  [INFERRED]
  src/pages/LoginPage.jsx → src/core/auth/useAuth.js

## Communities (200 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (55): applyCascadeReset(), applyDeleteFields(), assertCanAssignCase(), assertOpsManager(), backfillClientCasesMirrorInner(), buildAiClassificationReviewPrompt(), buildExecutiveSummary(), buildExecutiveSummaryFallback() (+47 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (52): formatDuration(), getSlaColor(), getSlaDeadline(), getSlaStatus(), parseDate(), getOverallEnrichmentStatus(), calculateRisk(), subscribeToCaseAuditLogs() (+44 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (52): callGet(), EscavadorError, queryMovimentacoes(), queryProcessoByCnj(), queryProcessosByPerson(), callEndpoint(), FonteDataError, queryCriminal() (+44 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (37): buildSearchText(), db(), interpolateTemplate(), stripUndefined(), writeAuditEvent(), buildPdfWatermarkCss(), escapeHtml(), injectPdfExportCss() (+29 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (49): adaptEscavador(), adaptJuditExecution(), adaptJuditLawsuits(), adaptJuditWarrants(), buildAndreCase(), buildCaseBase(), buildCaseWithBigDataCorpProcess(), buildCaseWithJuditRole() (+41 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (48): buildClientVerdictPolicy(), asDate(), classifyWarrantType(), dedupePartyNames(), detectCartaDeGuia(), extractSentenceDetails(), filterDjenComunicacoesByConfirmedProcess(), findLinkedCivilProcess() (+40 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (36): attemptJsonRepair(), fixLatinMojibake(), isStringArray(), looksLikeRawJsonOrTechnicalPayload(), normalizeUnicodeToAscii(), parseAiClassificationReviewResponse(), parseAiHomonymResponse(), parseAiPrefillResponse() (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (25): clientPayloadChanged(), revokeCasePublicationArtifacts(), writeClientCaseMirror(), enforceTenantSubmissionLimits(), buildClientCasePayload(), buildResetPublishedCaseFields(), buildReviewDraftSeed(), clientPayloadChanged() (+17 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (39): callBackendFunction(), callConcludeCaseByAnalyst(), callCreateClientSolicitation(), callCreateOpsClientUser(), callGetClientCaseById(), callGetClientDashboardMetrics(), callGetClientExportCases(), callGetClientGeoIp() (+31 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (33): callGet(), DjenError, queryComunicacoesByName(), queryComunicacoesByProcesso(), queryTribunais(), extractKnownProcessNumbers(), runDjenEnrichmentPhase(), buildCandidateUfs() (+25 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (38): acquireAutoClassifyRun(), buildAiClassificationReviewUpdatePayload(), buildAiHomonymPrompt(), buildAiHomonymResetPayload(), buildAiHomonymUpdatePayload(), buildAiPrefillUpdatePayload(), buildAiUpdatePayload(), buildSafeNarrativeReplacement() (+30 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (19): asDate(), asIsoOrNull(), buildOpsMetricsFromCases(), buildProviderRunIds(), compareClientCases(), compareOpsCases(), diffHoursBackend(), getMetricCaseDate() (+11 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (33): computeAutoClassifySignature(), applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAiClassificationReviewPrompt(), buildAiHomonymPrompt(), buildAiPrefillPrompt(), buildAiPrompt() (+25 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (17): AuthProvider(), AuthProbe(), useAuth(), DemoProviders(), Sidebar(), NotificationProvider(), PerfilPage(), formatRoleLabel() (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (19): computeAutoClassification(), buildBigDataCorpProcessCandidates(), buildCandidateProfile(), buildCoverageAssessment(), buildEscavadorProcessCandidates(), buildHardFacts(), buildHomonymAnalysisInput(), buildJuditProcessCandidates() (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (28): buildAiPrompt(), buildDetCriminalNotes(), buildDeterministicPrefill(), buildDetExecutiveSummary(), buildDetFinalJustification(), buildDetKeyFindings(), buildDetLaborNotes(), buildDetWarrantNotes() (+20 more)

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
Cohesion: 0.12
Nodes (13): maskCpf(), NovaSolicitacaoPanel(), validateCpf(), validateUrl(), callUpdateTenantSettingsByAnalyst(), getEnabledPhases(), getTenantSettings(), getTenantUsage() (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (4): asDate(), getPublicReportViewInner(), resolvePublicReportStatus(), serializeManagedPublicReport()

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (18): normalizeTenantSlug(), buildConcludeUpdatePayload(), buildCanonicalReportHtml(), buildNextSteps(), buildReportSlug(), buildSafeNarrativeReplacement(), buildSanitizedPublicResultSnapshot(), buildSourceSummary() (+10 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (11): getMacroProgress(), hasAnySocialProfile(), hasMeaningfulSocialAnalysis(), SolicitacoesPage(), getCaseStats(), formatDate(), useClientCasesQuery(), NotificationBell() (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (20): buildAiPrefillPrompt(), buildCanonicalReportHtml(), buildProcessHighlights(), buildReportSlug(), buildSanitizedPublicResultSnapshot(), buildSourceSummary(), buildStatusSummary(), buildTimelineEvents() (+12 more)

### Community 24 - "Community 24"
Cohesion: 0.21
Nodes (16): createConcludeCaseByAnalystHandler(), createSaveCaseDraftByAnalystHandler(), createSetAiDecisionByAnalystHandler(), createUpdateTenantSettingsByAnalystHandler(), normalizeKeyFindingsValue(), normalizeNarrativeValue(), pickConcludePayload(), pickDraftPayload() (+8 more)

### Community 25 - "Community 25"
Cohesion: 0.24
Nodes (14): callBackendFunction(), markAllNotificationsAsRead(), markNotificationAsRead(), subscribeToMyNotifications(), subscribeToUnreadNotifications(), getAudioContext(), isAudioUnlocked(), isSoundEnabled() (+6 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (9): TenantProbe(), useTenant(), fetchPublicReports(), ClientesPage(), getReportCandidateName(), getReportStatus(), isExpired(), RelatoriosPage() (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (8): classifyError(), cleanMessage(), extractErrorMessage(), getUserFriendlyMessage(), isSafeForUser(), SaudePage(), getAuthErrorMessage(), LoginPage()

### Community 28 - "Community 28"
Cohesion: 0.2
Nodes (15): buildCaseReportPath(), buildClientInternalReportPath(), countCasesByMonth(), countCompletedCasesByMonth(), diffHours(), getAttentionReasons(), getCaseTimeline(), getClientDashboardMetrics() (+7 more)

### Community 29 - "Community 29"
Cohesion: 0.21
Nodes (9): createCaseCompletedNotifications(), createNewSolicitationNotifications(), createSendCaseMessageHandler(), getRequestIp(), isPrivateOrLocalIp(), lookupIpLocation(), normalizeIp(), sanitizeGeoText() (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.14
Nodes (12): CaseCommunicationPanel(), formatMessageDate(), formatDateTimeBR(), toDate(), callMarkCaseCommunicationRead(), callSendCaseMessage(), generatePublicReportPdf(), getPublicReport() (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (17): buildNextSteps(), buildResetPublishedCaseFields(), buildReviewDraftSeed(), extractFallbackAiClassificationReviewResponse(), looksLikeRawJsonOrTechnicalPayload(), normalizeKeyFindingsValue(), normalizeNarrativeValue(), pickConcludePayload() (+9 more)

### Community 32 - "Community 32"
Cohesion: 0.17
Nodes (8): ClientReportPage(), shortToken(), DashboardClientePage(), TestConsumer(), useCases(), useOpsCasesQuery(), CasosPage(), FilaPage()

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (14): buildClientCasePayload(), enforceTenantSubmissionLimits(), formatDateKey(), formatMonthKey(), getClientQuotaStatusInner(), getClientUserProfile(), getTenantSettingsData(), loadBigDataCorpConfig() (+6 more)

### Community 34 - "Community 34"
Cohesion: 0.16
Nodes (14): classifyClientCriminalCategory(), dedupePartyNames(), getProcessParties(), getProcessRoleText(), inferStatusFromLastStep(), isActiveLaborParty(), isCandidateActiveLaborProcess(), isClientMaterialCriminalProcess() (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (13): buildTenantStructuredQuery(), fetchAuditLogs(), fetchCandidates(), fetchCases(), fetchClientCases(), fetchClients(), fetchExports(), fetchOrderedCollection() (+5 more)

### Community 36 - "Community 36"
Cohesion: 0.17
Nodes (4): renderPage(), renderPage(), renderPage(), ErrorBoundary

### Community 37 - "Community 37"
Cohesion: 0.2
Nodes (7): callAssignCaseToAnalyst(), callAssignCaseToCurrentAnalyst(), callCreateOpsUser(), callListOpsUsers(), callUpdateOpsUser(), EquipeOpsPage(), getStatusConfig()

### Community 38 - "Community 38"
Cohesion: 0.35
Nodes (8): TenantProvider(), canAccessAllTenants(), dedupeTenants(), getSelectedTenantLabel(), normalizeTenantEntry(), resolveSelectedTenantId(), resolveTenantOptions(), subscribeToTenantDirectory()

### Community 39 - "Community 39"
Cohesion: 0.22
Nodes (11): applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAxisReviewContext(), buildReviewSource(), countItems(), hasCriminalLowRiskRoleOnly(), isGenericCautionText() (+3 more)

### Community 40 - "Community 40"
Cohesion: 0.27
Nodes (5): assertCanAccessCaseCommunication(), buildNotificationId(), createNotification(), resolveUserPortal(), sanitizeNotificationIdPart()

### Community 41 - "Community 41"
Cohesion: 0.24
Nodes (7): canBypassIdentityGate(), isIdentityGateBlocked(), validateConcludePayload(), canAssignCases(), compareClientCases(), compareOpsCases(), getMetricCaseDate()

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (8): createEnrichBigDataCorpOnCaseHandler(), createEnrichBigDataCorpOnCorrectionHandler(), createEnrichDjenOnCaseHandler(), createEnrichEscavadorOnCaseHandler(), createEnrichJuditOnCaseHandler(), createEnrichJuditOnCorrectionHandler(), makeDeps(), makeMockDb()

### Community 43 - "Community 43"
Cohesion: 0.2
Nodes (10): createRestDocumentSnapshot(), decodeFirestoreFields(), decodeFirestoreValue(), formatFirestoreDate(), formatFirestoreTimestamp(), getCase(), getFirestoreDocumentViaRest(), mapCandidateDocument() (+2 more)

### Community 44 - "Community 44"
Cohesion: 0.42
Nodes (6): buildClientPortalPath(), buildOpsPortalPath(), getClientPortalBasePath(), getOpsPortalBasePath(), isDemoPortalPath(), normalizeLeaf()

### Community 45 - "Community 45"
Cohesion: 0.27
Nodes (5): fmtBRL(), fmtUSD(), MetricasIAPage(), pct(), QualityBar()

### Community 46 - "Community 46"
Cohesion: 0.44
Nodes (8): _getDb(), getTenantSettingsData(), loadBigDataCorpConfig(), loadDjenConfig(), loadEscavadorConfig(), loadFonteDataConfig(), loadJuditConfig(), _setDb()

### Community 47 - "Community 47"
Cohesion: 0.36
Nodes (7): BigDataCorpError, buildCombinedDatasets(), callPost(), delay(), queryCombined(), queryKyc(), queryProcesses()

### Community 48 - "Community 48"
Cohesion: 0.28
Nodes (4): isFirestoreSentinel(), sanitizeAuditMetadataValue(), sanitizePublicStructuredValue(), sanitizeStructuredText()

### Community 49 - "Community 49"
Cohesion: 0.31
Nodes (6): subscribeToAuditLogs(), TestConsumer(), useAuditLogs(), useCandidates(), AuditoriaPage(), isClientRole()

### Community 50 - "Community 50"
Cohesion: 0.25
Nodes (3): resolveTheme(), useTheme(), Topbar()

### Community 51 - "Community 51"
Cohesion: 0.28
Nodes (9): asDate(), asIsoOrNull(), calculateTurnaroundHours(), diffHoursBackend(), getMetricCaseDate(), getPublicReportViewInner(), resolvePublicReportStatus(), serializeClientCaseDocument() (+1 more)

### Community 52 - "Community 52"
Cohesion: 0.22
Nodes (9): fixLatinMojibake(), normalizeUnicodeToAscii(), parseAiClassificationReviewResponse(), parseAiHomonymResponse(), parseAiPrefillResponse(), parseAiResponse(), parseJsonSchemaResponse(), sanitizeAiOutput() (+1 more)

### Community 53 - "Community 53"
Cohesion: 0.5
Nodes (6): isConfirmedMissingSnapshot(), isUnconfirmedMissingSnapshot(), createAuthFallbackProfile(), getAuthDisplayName(), mergeUserProfile(), normalizeString()

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (5): EquipePage(), getStatusConfig(), callCreateTenantUser(), callListTenantUsers(), callUpdateTenantUser()

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (4): getReportStatus(), isReportAvailable(), RelatoriosClientePage(), getMockPublicReports()

### Community 58 - "Community 58"
Cohesion: 0.4
Nodes (5): buildTenantCollectionQuery(), subscribeToCandidates(), subscribeToCases(), subscribeToClientCases(), subscribeToExports()

### Community 60 - "Community 60"
Cohesion: 0.47
Nodes (3): FilterPanelMobile(), useMediaQuery(), MobileDataCardList()

### Community 61 - "Community 61"
Cohesion: 0.6
Nodes (3): hasPendingJuditAsync(), isJuditSettled(), isProviderTerminalForPipeline()

### Community 62 - "Community 62"
Cohesion: 0.7
Nodes (4): decodeCursor(), encodeCursor(), normalizeLimit(), paginateFirestoreQuery()

### Community 64 - "Community 64"
Cohesion: 0.4
Nodes (5): hasBenignNoProcessCoverage(), buildExecutiveSummary(), buildExecutiveSummaryFallback(), buildExpandedKeyFindings(), buildKeyFindings()

### Community 66 - "Community 66"
Cohesion: 0.7
Nodes (4): createDeps(), createMockDb(), createMockJuditApiKey(), createMockNormalize()

### Community 68 - "Community 68"
Cohesion: 0.6
Nodes (5): canRunFinalClassification(), hasPendingJuditAsync(), isJuditSettled(), isProviderTerminalForPipeline(), canRunFinalClassification()

### Community 69 - "Community 69"
Cohesion: 0.7
Nodes (4): classifyRole(), getRoleScoreImpact(), isHighRiskRole(), isLowRiskRole()

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (3): makeBaseDeps(), makeCorrectionDeps(), makeMockDb()

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildCaseReportHtml()` connect `Community 16` to `Community 8`, `Community 21`, `Community 30`, `Community 23`?**
  _High betweenness centrality (0.292) - this node is a cross-community bridge._
- **Why does `buildCanonicalReportHtml()` connect `Community 23` to `Community 0`, `Community 16`?**
  _High betweenness centrality (0.262) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 13` to `Community 32`, `Community 1`, `Community 26`, `Community 37`, `Community 38`, `Community 8`, `Community 17`, `Community 49`, `Community 18`, `Community 19`, `Community 22`, `Community 55`, `Community 56`, `Community 25`, `Community 58`, `Community 27`, `Community 30`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Are the 31 inferred relationships involving `useAuth()` (e.g. with `AccessState()` and `ProfileResolutionState()`) actually correct?**
  _`useAuth()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `extractErrorMessage()` (e.g. with `getAuthErrorMessage()` and `getErrorMessage()`) actually correct?**
  _`extractErrorMessage()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `runAutoClassifyAndAi()` (e.g. with `writeAuditEvent()` and `buildHomonymAnalysisInput()`) actually correct?**
  _`runAutoClassifyAndAi()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `rerunAiForCase()` (e.g. with `buildHomonymAnalysisInput()` and `buildAiHomonymResetPayload()`) actually correct?**
  _`rerunAiForCase()` has 12 INFERRED edges - model-reasoned connections that need verification._