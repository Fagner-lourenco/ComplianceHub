# Graph Report - ComplianceHub  (2026-06-12)

## Corpus Check
- 276 files · ~341,057 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1667 nodes · 3102 edges · 71 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 372 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7d1956b9`
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
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 91|Community 91]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 58 edges
2. `callBackendFunction()` - 49 edges
3. `extractErrorMessage()` - 37 edges
4. `runAutoClassifyAndAi()` - 36 edges
5. `rerunAiForCase()` - 29 edges
6. `CasoPage()` - 26 edges
7. `runJuditEnrichmentPhase()` - 23 edges
8. `buildCaseBody()` - 22 edges
9. `writeAuditEvent()` - 20 edges
10. `formatDateTimeBR()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `buildCanonicalReportHtml()` --calls--> `buildCaseReportHtml()`  [INFERRED]
  functions/index.js → src/core/reportBuilder.js
- `buildCanonicalReportHtml()` --calls--> `buildCaseReportHtml()`  [INFERRED]
  functions/modules/exportJobsAndReports.js → src/core/reportBuilder.js
- `runEscavadorEnrichmentPhase()` --calls--> `getEscavadorTribunais()`  [INFERRED]
  functions/index.js → functions/helpers/tribunalMap.js
- `runJuditEnrichmentPhase()` --calls--> `getJuditTribunais()`  [INFERRED]
  functions/index.js → functions/helpers/tribunalMap.js
- `timeAgo()` --calls--> `formatDate()`  [INFERRED]
  src/ui/components/NotificationBell/NotificationBell.jsx → src/core/formatDate.js

## Communities (200 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (55): applyCascadeReset(), applyDeleteFields(), assertCanAssignCase(), assertOpsManager(), backfillClientCasesMirrorInner(), buildExecutiveSummary(), buildExecutiveSummaryFallback(), buildExpandedKeyFindings() (+47 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (52): formatDuration(), getSlaColor(), getSlaDeadline(), getSlaStatus(), parseDate(), getOverallEnrichmentStatus(), calculateRisk(), subscribeToCaseAuditLogs() (+44 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (52): maybeRunAutoClassifyAndAi(), adaptEscavador(), adaptJuditExecution(), adaptJuditLawsuits(), adaptJuditWarrants(), buildAndreCase(), buildCaseBase(), buildCaseWithBigDataCorpProcess() (+44 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (42): clientPayloadChanged(), enforceTenantSubmissionLimits(), formatDateKey(), formatMonthKey(), getClientQuotaStatusInner(), getClientUserProfile(), revokeCasePublicationArtifacts(), writeClientCaseMirror() (+34 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (49): callGet(), EscavadorError, queryMovimentacoes(), queryProcessoByCnj(), queryProcessosByPerson(), callEndpoint(), FonteDataError, queryCriminal() (+41 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (35): buildSearchText(), db(), interpolateTemplate(), stripUndefined(), writeAuditEvent(), normalizeTenantSlug(), buildPdfWatermarkCss(), escapeHtml() (+27 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (49): buildAiPrompt(), buildClientVerdictPolicy(), asDate(), classifyWarrantType(), dedupePartyNames(), detectCartaDeGuia(), extractSentenceDetails(), filterDjenComunicacoesByConfirmedProcess() (+41 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (36): attemptJsonRepair(), fixLatinMojibake(), isStringArray(), looksLikeRawJsonOrTechnicalPayload(), normalizeUnicodeToAscii(), parseAiClassificationReviewResponse(), parseAiHomonymResponse(), parseAiPrefillResponse() (+28 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (34): callGet(), DjenError, queryComunicacoesByName(), queryComunicacoesByProcesso(), queryTribunais(), extractKnownProcessNumbers(), runDjenEnrichmentPhase(), buildCandidateUfs() (+26 more)

### Community 9 - "Community 9"
Cohesion: 0.1
Nodes (36): buildTenantCollectionQuery(), buildTenantStructuredQuery(), callRerunAiAnalysis(), callRerunEnrichmentPhase(), callRerunFullEnrichment(), createRestDocumentSnapshot(), decodeFirestoreFields(), decodeFirestoreValue() (+28 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (19): asDate(), asIsoOrNull(), buildOpsMetricsFromCases(), buildProviderRunIds(), compareClientCases(), compareOpsCases(), diffHoursBackend(), getMetricCaseDate() (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.1
Nodes (22): AuthProvider(), AuthProbe(), useAuth(), DemoProviders(), subscribeToAuditLogs(), TestConsumer(), useAuditLogs(), useCandidates() (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (17): TenantProbe(), useTenant(), getCaseStats(), callAssignCaseToAnalyst(), callAssignCaseToCurrentAnalyst(), callGetOpsCaseMetrics(), TestConsumer(), useCases() (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (31): applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAiClassificationReviewPrompt(), buildAiHomonymPrompt(), buildAiPrefillPrompt(), buildAiPrompt(), buildAxisReviewContext() (+23 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (28): ClientReportPage(), shortToken(), EquipePage(), getStatusConfig(), callBackendFunction(), callConcludeCaseByAnalyst(), callCreateClientSolicitation(), callCreateTenantUser() (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (28): acquireAutoClassifyRun(), buildAiClassificationReviewUpdatePayload(), buildAiHomonymResetPayload(), buildAiHomonymUpdatePayload(), buildAiPrefillUpdatePayload(), buildAiUpdatePayload(), buildSafeNarrativeReplacement(), estimateAiCostUsd() (+20 more)

### Community 16 - "Community 16"
Cohesion: 0.1
Nodes (15): classifyError(), cleanMessage(), extractErrorMessage(), getUserFriendlyMessage(), isSafeForUser(), callCreateOpsUser(), callGetClientGeoIp(), callGetSystemHealth() (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (25): badge(), buildBatchReportHtml(), buildCaseBody(), buildCaseReportHtml(), esc(), fieldHtml(), flagColor(), formatBirthAndAge() (+17 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (17): CaseCommunicationPanel(), formatMessageDate(), getMacroProgress(), hasAnySocialProfile(), hasMeaningfulSocialAnalysis(), SolicitacoesPage(), formatDate(), formatDateTimeBR() (+9 more)

### Community 19 - "Community 19"
Cohesion: 0.1
Nodes (13): buildPrintableHtml(), esc(), ExportacoesPage(), normalizeJobStatus(), getMockExports(), callCancelExportJob(), callCreateExportJob(), callGetClientExportCases() (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.2
Nodes (25): buildDetCriminalNotes(), buildDeterministicPrefill(), buildDetExecutiveSummary(), buildDetFinalJustification(), buildDetKeyFindings(), buildDetLaborNotes(), buildDetWarrantNotes(), classifyWarrantType() (+17 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (10): getActionBadgeStyle(), getActionFilterOptions(), getActionLabel(), getCategoryColor(), getCategoryFilterOptions(), getCategoryLabel(), AuditoriaClientePage(), getErrorMessage() (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.11
Nodes (24): buildAiPrefillPrompt(), buildCanonicalReportHtml(), buildProcessHighlights(), buildReportSlug(), buildResetPublishedCaseFields(), buildReviewDraftSeed(), buildSanitizedPublicResultSnapshot(), buildSourceSummary() (+16 more)

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (17): buildBigDataCorpProcessCandidates(), buildCandidateProfile(), buildCoverageAssessment(), buildEscavador2ProcessCandidates(), buildEscavadorProcessCandidates(), buildHardFacts(), buildHomonymAnalysisInput(), buildJuditProcessCandidates() (+9 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (5): asDate(), buildCanonicalReportHtml(), getPublicReportViewInner(), resolvePublicReportStatus(), serializeManagedPublicReport()

### Community 25 - "Community 25"
Cohesion: 0.19
Nodes (16): buildCaseReportPath(), buildClientInternalReportPath(), countCasesByMonth(), countCompletedCasesByMonth(), diffHours(), getAttentionReasons(), getCaseTimeline(), getClientDashboardMetrics() (+8 more)

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (16): buildConcludeUpdatePayload(), buildNextSteps(), buildReportSlug(), buildSafeNarrativeReplacement(), buildSanitizedPublicResultSnapshot(), buildSourceSummary(), buildStatusSummary(), buildTimelineEvents() (+8 more)

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (14): callBackendFunction(), markAllNotificationsAsRead(), markNotificationAsRead(), subscribeToMyNotifications(), subscribeToUnreadNotifications(), getAudioContext(), isAudioUnlocked(), isSoundEnabled() (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.13
Nodes (17): applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAiClassificationReviewPrompt(), buildAxisReviewContext(), buildReviewSource(), compactBigDataCorpProcessos(), compactDjenComunicacoes() (+9 more)

### Community 29 - "Community 29"
Cohesion: 0.21
Nodes (9): createCaseCompletedNotifications(), createNewSolicitationNotifications(), createSendCaseMessageHandler(), getRequestIp(), isPrivateOrLocalIp(), lookupIpLocation(), normalizeIp(), sanitizeGeoText() (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (8): maskCpf(), NovaSolicitacaoPanel(), validateCpf(), validateUrl(), FilterPanelMobile(), getEnabledPhases(), useMediaQuery(), MobileDataCardList()

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (15): buildAiHomonymPrompt(), compactErrorMessage(), computeAiCacheKey(), computeAutoClassifySignature(), computePublicSnapshotHash(), computeSimpleHash(), extractApiErrorMessage(), formatAiRuntimeError() (+7 more)

### Community 32 - "Community 32"
Cohesion: 0.28
Nodes (13): asArray(), buildEscavador2Process(), buildKnownProcess(), collectKnownProcesses(), daysBetween(), deduplicateEscavador2Findings(), firstValue(), hasMetadataMatch() (+5 more)

### Community 33 - "Community 33"
Cohesion: 0.28
Nodes (13): createConcludeCaseByAnalystHandler(), createSaveCaseDraftByAnalystHandler(), createSetAiDecisionByAnalystHandler(), createUpdateTenantSettingsByAnalystHandler(), normalizeKeyFindingsValue(), normalizeNarrativeValue(), pickConcludePayload(), pickDraftPayload() (+5 more)

### Community 34 - "Community 34"
Cohesion: 0.16
Nodes (14): classifyClientCriminalCategory(), dedupePartyNames(), getProcessParties(), getProcessRoleText(), inferStatusFromLastStep(), isActiveLaborParty(), isCandidateActiveLaborProcess(), isClientMaterialCriminalProcess() (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (7): callCreateOpsClientUser(), callUpdateTenantSettingsByAnalyst(), getTenantSettings(), getTenantUsage(), ClientesPage(), handleSave(), validateLimits()

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (13): asDate(), asIsoOrNull(), buildClientCasePayload(), calculateTurnaroundHours(), diffHoursBackend(), getMetricCaseDate(), getPublicReportViewInner(), maskCpf() (+5 more)

### Community 37 - "Community 37"
Cohesion: 0.2
Nodes (8): canRunFinalClassification(), computeAutoClassification(), hasPendingJuditAsync(), isJuditSettled(), isProviderTerminalForPipeline(), classifyAndMerge(), canRunFinalClassification(), computeAutoClassification()

### Community 38 - "Community 38"
Cohesion: 0.27
Nodes (12): buildNextSteps(), extractFallbackAiClassificationReviewResponse(), looksLikeRawJsonOrTechnicalPayload(), sanitizeAiClassificationReviewStructured(), sanitizeAiHomonymStructured(), sanitizeAiPrefillStructured(), sanitizeAiStructured(), sanitizeClassificationReviewAxis() (+4 more)

### Community 39 - "Community 39"
Cohesion: 0.17
Nodes (4): renderPage(), renderPage(), renderPage(), ErrorBoundary

### Community 40 - "Community 40"
Cohesion: 0.31
Nodes (9): createEnrichBigDataCorpOnCaseHandler(), createEnrichBigDataCorpOnCorrectionHandler(), createEnrichDjenOnCaseHandler(), createEnrichEscavador2OnCaseHandler(), createEnrichEscavadorOnCaseHandler(), createEnrichJuditOnCaseHandler(), createEnrichJuditOnCorrectionHandler(), makeDeps() (+1 more)

### Community 41 - "Community 41"
Cohesion: 0.35
Nodes (8): TenantProvider(), canAccessAllTenants(), dedupeTenants(), getSelectedTenantLabel(), normalizeTenantEntry(), resolveSelectedTenantId(), resolveTenantOptions(), subscribeToTenantDirectory()

### Community 42 - "Community 42"
Cohesion: 0.27
Nodes (5): assertCanAccessCaseCommunication(), buildNotificationId(), createNotification(), resolveUserPortal(), sanitizeNotificationIdPart()

### Community 43 - "Community 43"
Cohesion: 0.24
Nodes (7): canBypassIdentityGate(), isIdentityGateBlocked(), validateConcludePayload(), canAssignCases(), compareClientCases(), compareOpsCases(), getMetricCaseDate()

### Community 44 - "Community 44"
Cohesion: 0.24
Nodes (7): fetchOpsPublicReports(), fetchPublicReports(), revokePublicReport(), getReportCandidateName(), getReportStatus(), isExpired(), RevokeModal()

### Community 45 - "Community 45"
Cohesion: 0.42
Nodes (6): buildClientPortalPath(), buildOpsPortalPath(), getClientPortalBasePath(), getOpsPortalBasePath(), isDemoPortalPath(), normalizeLeaf()

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (9): compareClientCases(), compareOpsCases(), getOverallEnrichmentStatusBackend(), getSlaStateBackend(), matchesClientCaseFilters(), matchesClientCaseSearch(), matchesOpsCaseFilters(), matchesOpsCaseSearch() (+1 more)

### Community 47 - "Community 47"
Cohesion: 0.36
Nodes (7): BigDataCorpError, buildCombinedDatasets(), callPost(), delay(), queryCombined(), queryKyc(), queryProcesses()

### Community 48 - "Community 48"
Cohesion: 0.28
Nodes (4): isFirestoreSentinel(), sanitizeAuditMetadataValue(), sanitizePublicStructuredValue(), sanitizeStructuredText()

### Community 49 - "Community 49"
Cohesion: 0.25
Nodes (6): DashboardClientePage(), callGetClientDashboardMetrics(), callGetClientQuotaStatus(), getZone(), QuotaBar(), QuotaSummaryCard()

### Community 50 - "Community 50"
Cohesion: 0.25
Nodes (3): resolveTheme(), useTheme(), Topbar()

### Community 51 - "Community 51"
Cohesion: 0.46
Nodes (6): asArray(), asObject(), mapProcess(), normalizeArea(), normalizeEscavador2Response(), positiveFlag()

### Community 52 - "Community 52"
Cohesion: 0.29
Nodes (5): getReportStatus(), isReportAvailable(), RelatoriosClientePage(), fetchClientPublicReports(), revokeClientPublicReport()

### Community 53 - "Community 53"
Cohesion: 0.5
Nodes (6): isConfirmedMissingSnapshot(), isUnconfirmedMissingSnapshot(), createAuthFallbackProfile(), getAuthDisplayName(), mergeUserProfile(), normalizeString()

### Community 55 - "Community 55"
Cohesion: 0.38
Nodes (4): NotificationBell(), timeAgo(), useNotifications(), NotificationToast()

### Community 56 - "Community 56"
Cohesion: 0.47
Nodes (4): buildEscavador2Payload(), consultarEscavador2(), Escavador2Error, onlyDigits()

### Community 59 - "Community 59"
Cohesion: 0.6
Nodes (3): hasPendingJuditAsync(), isJuditSettled(), isProviderTerminalForPipeline()

### Community 60 - "Community 60"
Cohesion: 0.7
Nodes (4): decodeCursor(), encodeCursor(), normalizeLimit(), paginateFirestoreQuery()

### Community 62 - "Community 62"
Cohesion: 0.4
Nodes (5): hasBenignNoProcessCoverage(), buildExecutiveSummary(), buildExecutiveSummaryFallback(), buildExpandedKeyFindings(), buildKeyFindings()

### Community 64 - "Community 64"
Cohesion: 0.7
Nodes (4): createDeps(), createMockDb(), createMockJuditApiKey(), createMockNormalize()

### Community 66 - "Community 66"
Cohesion: 0.7
Nodes (4): classifyRole(), getRoleScoreImpact(), isHighRiskRole(), isLowRiskRole()

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (3): makeBaseDeps(), makeCorrectionDeps(), makeMockDb()

### Community 83 - "Community 83"
Cohesion: 0.67
Nodes (3): prepareCanonicalReport(), computePublicSnapshotHash(), hasPublicReportMinimumContent()

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildCaseReportHtml()` connect `Community 17` to `Community 24`, `Community 14`, `Community 22`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Why does `buildCanonicalReportHtml()` connect `Community 22` to `Community 0`, `Community 17`?**
  _High betweenness centrality (0.235) - this node is a cross-community bridge._
- **Why does `writeAuditEvent()` connect `Community 5` to `Community 3`, `Community 4`, `Community 15`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Are the 31 inferred relationships involving `useAuth()` (e.g. with `AccessState()` and `ProfileResolutionState()`) actually correct?**
  _`useAuth()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `extractErrorMessage()` (e.g. with `getAuthErrorMessage()` and `getErrorMessage()`) actually correct?**
  _`extractErrorMessage()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `runAutoClassifyAndAi()` (e.g. with `writeAuditEvent()` and `buildHomonymAnalysisInput()`) actually correct?**
  _`runAutoClassifyAndAi()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `rerunAiForCase()` (e.g. with `buildHomonymAnalysisInput()` and `buildAiHomonymResetPayload()`) actually correct?**
  _`rerunAiForCase()` has 12 INFERRED edges - model-reasoned connections that need verification._