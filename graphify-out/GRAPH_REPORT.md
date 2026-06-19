# Graph Report - ComplianceHub  (2026-06-18)

## Corpus Check
- 283 files · ~363,194 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1704 nodes · 3174 edges · 86 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 386 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8b171307`
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
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 106|Community 106]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 58 edges
2. `callBackendFunction()` - 49 edges
3. `extractErrorMessage()` - 37 edges
4. `runAutoClassifyAndAi()` - 36 edges
5. `rerunAiForCase()` - 30 edges
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

## Communities (218 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (51): applyCascadeReset(), applyDeleteFields(), assertCanAssignCase(), assertOpsManager(), backfillClientCasesMirrorInner(), buildExecutiveSummary(), buildExecutiveSummaryFallback(), buildExpandedKeyFindings() (+43 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (54): callGet(), EscavadorError, queryMovimentacoes(), queryProcessoByCnj(), queryProcessosByPerson(), callEndpoint(), FonteDataError, queryCriminal() (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (38): buildSearchText(), db(), interpolateTemplate(), stripUndefined(), writeAuditEvent(), normalizeTenantSlug(), buildPdfWatermarkCss(), escapeHtml() (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (43): buildClientCasePayload(), clientPayloadChanged(), enforceTenantSubmissionLimits(), formatDateKey(), formatMonthKey(), getClientQuotaStatusInner(), getClientUserProfile(), revokeCasePublicationArtifacts() (+35 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (48): buildAiPrompt(), buildClientVerdictPolicy(), asDate(), classifyWarrantType(), dedupePartyNames(), detectCartaDeGuia(), extractSentenceDetails(), filterDjenComunicacoesByConfirmedProcess() (+40 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (41): adaptEscavador(), adaptJuditExecution(), adaptJuditLawsuits(), adaptJuditWarrants(), buildAndreCase(), buildCaseBase(), buildCaseWithBigDataCorpProcess(), buildCaseWithJuditRole() (+33 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (36): attemptJsonRepair(), fixLatinMojibake(), isStringArray(), looksLikeRawJsonOrTechnicalPayload(), normalizeUnicodeToAscii(), parseAiClassificationReviewResponse(), parseAiHomonymResponse(), parseAiPrefillResponse() (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (39): callAssignCaseToAnalyst(), callAssignCaseToCurrentAnalyst(), callBackendFunction(), callConcludeCaseByAnalyst(), callCreateClientSolicitation(), callCreateOpsClientUser(), callGetClientCaseById(), callGetClientDashboardMetrics() (+31 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (39): acquireAutoClassifyRun(), buildAiClassificationReviewUpdatePayload(), buildAiHomonymPrompt(), buildAiHomonymResetPayload(), buildAiHomonymUpdatePayload(), buildAiPrefillUpdatePayload(), buildAiUpdatePayload(), buildSafeNarrativeReplacement() (+31 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (34): callGet(), DjenError, queryComunicacoesByName(), queryComunicacoesByProcesso(), queryTribunais(), extractKnownProcessNumbers(), runDjenEnrichmentPhase(), buildCandidateUfs() (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (19): asDate(), asIsoOrNull(), buildOpsMetricsFromCases(), buildProviderRunIds(), compareClientCases(), compareOpsCases(), diffHoursBackend(), getMetricCaseDate() (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (31): applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAiClassificationReviewPrompt(), buildAiHomonymPrompt(), buildAiPrefillPrompt(), buildAiPrompt(), buildAxisReviewContext() (+23 more)

### Community 12 - "Community 12"
Cohesion: 0.1
Nodes (17): AuthProvider(), AuthProbe(), useAuth(), DemoProviders(), Sidebar(), NotificationProvider(), SaudePage(), formatRoleLabel() (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.1
Nodes (22): subscribeToCaseAuditLogs(), subscribeToCaseDoc(), useAutoResize(), CasoPage(), createInitialForm(), formatFullCpf(), formatPendingJuditPhases(), getAiHomonymActionLabel() (+14 more)

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (27): buildDetCriminalNotes(), buildDeterministicPrefill(), buildDetExecutiveSummary(), buildDetFinalJustification(), buildDetKeyFindings(), buildDetLaborNotes(), buildDetWarrantNotes(), classifyWarrantType() (+19 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (25): badge(), buildBatchReportHtml(), buildCaseBody(), buildCaseReportHtml(), esc(), fieldHtml(), flagColor(), formatBirthAndAge() (+17 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (22): hasLowRiskRole(), buildProcessText(), getAssuntoText(), getClasseText(), hasCriminalIndicator(), hasIdentifiableClassOrSubject(), isExcludedCrimeType(), isMaterialCriminalProcess() (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.1
Nodes (13): buildPrintableHtml(), esc(), ExportacoesPage(), normalizeJobStatus(), getMockExports(), callCancelExportJob(), callCreateExportJob(), callGetClientExportCases() (+5 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (10): getActionBadgeStyle(), getActionFilterOptions(), getActionLabel(), getCategoryColor(), getCategoryFilterOptions(), getCategoryLabel(), AuditoriaClientePage(), getErrorMessage() (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.1
Nodes (7): asDate(), buildCanonicalReportHtml(), getPublicReportViewInner(), prepareCanonicalReport(), resolvePublicReportStatus(), serializeManagedPublicReport(), computePublicSnapshotHash()

### Community 20 - "Community 20"
Cohesion: 0.18
Nodes (17): buildBigDataCorpProcessCandidates(), buildCandidateProfile(), buildCoverageAssessment(), buildEscavador2ProcessCandidates(), buildEscavadorProcessCandidates(), buildHardFacts(), buildHomonymAnalysisInput(), buildJuditProcessCandidates() (+9 more)

### Community 21 - "Community 21"
Cohesion: 0.21
Nodes (20): asArray(), buildEscavador2Process(), buildKnownProcess(), collectKnownProcesses(), collectSubjectTexts(), countUnmaskedPositions(), daysBetween(), deduplicateEscavador2Findings() (+12 more)

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (17): DashboardClientePage(), buildCaseReportPath(), buildClientInternalReportPath(), countCasesByMonth(), countCompletedCasesByMonth(), diffHours(), getAttentionReasons(), getCaseTimeline() (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (11): maskCpf(), NovaSolicitacaoPanel(), validateCpf(), validateUrl(), FilterPanelMobile(), getEnabledPhases(), useMediaQuery(), MobileDataCardList() (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (18): buildAiPrefillPrompt(), buildCanonicalReportHtml(), buildProcessHighlights(), buildReportSlug(), buildSanitizedPublicResultSnapshot(), buildSourceSummary(), buildStatusSummary(), buildTimelineEvents() (+10 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (18): asDate(), asIsoOrNull(), calculateTurnaroundHours(), compareClientCases(), compareOpsCases(), diffHoursBackend(), getMetricCaseDate(), getOverallEnrichmentStatusBackend() (+10 more)

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (16): buildConcludeUpdatePayload(), buildNextSteps(), buildReportSlug(), buildSafeNarrativeReplacement(), buildSanitizedPublicResultSnapshot(), buildSourceSummary(), buildStatusSummary(), buildTimelineEvents() (+8 more)

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (14): callBackendFunction(), markAllNotificationsAsRead(), markNotificationAsRead(), subscribeToMyNotifications(), subscribeToUnreadNotifications(), getAudioContext(), isAudioUnlocked(), isSoundEnabled() (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.13
Nodes (13): canRunFinalClassification(), computeAutoClassification(), computeAutoClassifySignature(), computePublicSnapshotHash(), computeSimpleHash(), hasPendingJuditAsync(), isJuditSettled(), isProviderTerminalForPipeline() (+5 more)

### Community 29 - "Community 29"
Cohesion: 0.13
Nodes (17): applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAiClassificationReviewPrompt(), buildAxisReviewContext(), buildReviewSource(), compactBigDataCorpProcessos(), compactDjenComunicacoes() (+9 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (17): buildNextSteps(), buildResetPublishedCaseFields(), buildReviewDraftSeed(), extractFallbackAiClassificationReviewResponse(), looksLikeRawJsonOrTechnicalPayload(), normalizeKeyFindingsValue(), normalizeNarrativeValue(), pickConcludePayload() (+9 more)

### Community 31 - "Community 31"
Cohesion: 0.21
Nodes (9): createCaseCompletedNotifications(), createNewSolicitationNotifications(), createSendCaseMessageHandler(), getRequestIp(), isPrivateOrLocalIp(), lookupIpLocation(), normalizeIp(), sanitizeGeoText() (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.17
Nodes (9): CaseCommunicationPanel(), formatMessageDate(), formatDate(), formatDateTimeBR(), toDate(), getPublicReport(), subscribeToCaseMessages(), PerfilPage() (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.17
Nodes (6): TenantProbe(), useTenant(), useOpsCasesQuery(), CasosPage(), ClientesPage(), FilaPage()

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (10): ClientReportPage(), shortToken(), getMacroProgress(), hasAnySocialProfile(), hasMeaningfulSocialAnalysis(), SolicitacoesPage(), getCaseStats(), TestConsumer() (+2 more)

### Community 35 - "Community 35"
Cohesion: 0.28
Nodes (13): createConcludeCaseByAnalystHandler(), createSaveCaseDraftByAnalystHandler(), createSetAiDecisionByAnalystHandler(), createUpdateTenantSettingsByAnalystHandler(), normalizeKeyFindingsValue(), normalizeNarrativeValue(), pickConcludePayload(), pickDraftPayload() (+5 more)

### Community 36 - "Community 36"
Cohesion: 0.16
Nodes (14): classifyClientCriminalCategory(), dedupePartyNames(), getProcessParties(), getProcessRoleText(), inferStatusFromLastStep(), isActiveLaborParty(), isCandidateActiveLaborProcess(), isClientMaterialCriminalProcess() (+6 more)

### Community 37 - "Community 37"
Cohesion: 0.22
Nodes (7): classifyError(), cleanMessage(), extractErrorMessage(), getUserFriendlyMessage(), isSafeForUser(), getAuthErrorMessage(), LoginPage()

### Community 38 - "Community 38"
Cohesion: 0.18
Nodes (13): buildTenantStructuredQuery(), fetchAuditLogs(), fetchCandidates(), fetchCases(), fetchClientCases(), fetchClients(), fetchExports(), fetchOrderedCollection() (+5 more)

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
Cohesion: 0.35
Nodes (6): formatDuration(), getSlaColor(), getSlaDeadline(), getSlaStatus(), parseDate(), SlaBadge()

### Community 43 - "Community 43"
Cohesion: 0.27
Nodes (5): assertCanAccessCaseCommunication(), buildNotificationId(), createNotification(), resolveUserPortal(), sanitizeNotificationIdPart()

### Community 44 - "Community 44"
Cohesion: 0.24
Nodes (7): canBypassIdentityGate(), isIdentityGateBlocked(), validateConcludePayload(), canAssignCases(), compareClientCases(), compareOpsCases(), getMetricCaseDate()

### Community 45 - "Community 45"
Cohesion: 0.27
Nodes (7): subscribeToAuditLogs(), subscribeToCandidates(), TestConsumer(), useAuditLogs(), useCandidates(), AuditoriaPage(), isClientRole()

### Community 46 - "Community 46"
Cohesion: 0.27
Nodes (5): fmtBRL(), fmtUSD(), MetricasIAPage(), pct(), QualityBar()

### Community 47 - "Community 47"
Cohesion: 0.42
Nodes (6): buildClientPortalPath(), buildOpsPortalPath(), getClientPortalBasePath(), getOpsPortalBasePath(), isDemoPortalPath(), normalizeLeaf()

### Community 48 - "Community 48"
Cohesion: 0.27
Nodes (10): applyClassificationReviewGuardrails(), buildDisplayReviewContext(), buildDisplayReviewSource(), buildFallbackClassificationReview(), countReviewItems(), hasCriminalLowRiskRoleOnlyForDisplay(), isNegativeReviewFlag(), isPositiveReviewFlag() (+2 more)

### Community 49 - "Community 49"
Cohesion: 0.2
Nodes (10): createRestDocumentSnapshot(), decodeFirestoreFields(), decodeFirestoreValue(), formatFirestoreDate(), formatFirestoreTimestamp(), getCase(), getFirestoreDocumentViaRest(), mapCandidateDocument() (+2 more)

### Community 50 - "Community 50"
Cohesion: 0.36
Nodes (7): BigDataCorpError, buildCombinedDatasets(), callPost(), delay(), queryCombined(), queryKyc(), queryProcesses()

### Community 51 - "Community 51"
Cohesion: 0.28
Nodes (4): isFirestoreSentinel(), sanitizeAuditMetadataValue(), sanitizePublicStructuredValue(), sanitizeStructuredText()

### Community 52 - "Community 52"
Cohesion: 0.28
Nodes (6): fetchPublicReports(), getReportCandidateName(), getReportStatus(), isExpired(), RelatoriosPage(), RevokeModal()

### Community 53 - "Community 53"
Cohesion: 0.25
Nodes (3): resolveTheme(), useTheme(), Topbar()

### Community 54 - "Community 54"
Cohesion: 0.32
Nodes (4): asIsoOrNull(), matchesClientCaseFilters(), matchesClientCaseSearch(), serializeClientCaseDocument()

### Community 55 - "Community 55"
Cohesion: 0.5
Nodes (6): isConfirmedMissingSnapshot(), isUnconfirmedMissingSnapshot(), createAuthFallbackProfile(), getAuthDisplayName(), mergeUserProfile(), normalizeString()

### Community 56 - "Community 56"
Cohesion: 0.32
Nodes (5): callUpdateTenantSettingsByAnalyst(), getTenantSettings(), getTenantUsage(), handleSave(), validateLimits()

### Community 58 - "Community 58"
Cohesion: 0.43
Nodes (5): getChecklistSessionKey(), readStoredState(), Harness(), useChecklistSession(), writeStoredState()

### Community 59 - "Community 59"
Cohesion: 0.33
Nodes (5): EquipePage(), getStatusConfig(), callCreateTenantUser(), callListTenantUsers(), callUpdateTenantUser()

### Community 60 - "Community 60"
Cohesion: 0.33
Nodes (5): callCreateOpsUser(), callListOpsUsers(), callUpdateOpsUser(), EquipeOpsPage(), getStatusConfig()

### Community 61 - "Community 61"
Cohesion: 0.38
Nodes (4): NotificationBell(), timeAgo(), useNotifications(), NotificationToast()

### Community 62 - "Community 62"
Cohesion: 0.4
Nodes (6): isStringArray(), validateAiClassificationReviewSchema(), validateAiHomonymSchema(), validateAiPrefillSchema(), validateAiSchema(), validateClassificationReviewAxis()

### Community 63 - "Community 63"
Cohesion: 0.47
Nodes (4): buildEscavador2Payload(), consultarEscavador2(), Escavador2Error, onlyDigits()

### Community 65 - "Community 65"
Cohesion: 0.4
Nodes (3): getReportStatus(), isReportAvailable(), RelatoriosClientePage()

### Community 68 - "Community 68"
Cohesion: 0.6
Nodes (3): hasPendingJuditAsync(), isJuditSettled(), isProviderTerminalForPipeline()

### Community 69 - "Community 69"
Cohesion: 0.7
Nodes (4): decodeCursor(), encodeCursor(), normalizeLimit(), paginateFirestoreQuery()

### Community 70 - "Community 70"
Cohesion: 0.4
Nodes (5): hasBenignNoProcessCoverage(), buildExecutiveSummary(), buildExecutiveSummaryFallback(), buildExpandedKeyFindings(), buildKeyFindings()

### Community 72 - "Community 72"
Cohesion: 0.7
Nodes (4): createDeps(), createMockDb(), createMockJuditApiKey(), createMockNormalize()

### Community 74 - "Community 74"
Cohesion: 0.5
Nodes (5): cleanOperationalList(), cleanOperationalText(), hasUsableClassificationReview(), looksLikeRawJsonOrTechnicalPayload(), sanitizeClassificationReviewForDisplay()

### Community 75 - "Community 75"
Cohesion: 0.5
Nodes (4): buildTenantCollectionQuery(), subscribeToCases(), subscribeToClientCases(), subscribeToExports()

### Community 76 - "Community 76"
Cohesion: 0.7
Nodes (4): classifyRole(), getRoleScoreImpact(), isHighRiskRole(), isLowRiskRole()

### Community 84 - "Community 84"
Cohesion: 1.0
Nodes (3): makeBaseDeps(), makeCorrectionDeps(), makeMockDb()

### Community 86 - "Community 86"
Cohesion: 0.5
Nodes (4): callRerunAiAnalysis(), callRerunEnrichmentPhase(), callRerunFullEnrichment(), loadFirebaseFunctionsModule()

### Community 102 - "Community 102"
Cohesion: 0.67
Nodes (3): buildEscavador2InspectionData(), isEscavador2CriminalProcess(), isEscavador2LaborProcess()

## Knowledge Gaps
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildCaseReportHtml()` connect `Community 15` to `Community 32`, `Community 24`, `Community 19`, `Community 7`?**
  _High betweenness centrality (0.298) - this node is a cross-community bridge._
- **Why does `buildCanonicalReportHtml()` connect `Community 24` to `Community 0`, `Community 15`?**
  _High betweenness centrality (0.266) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 12` to `Community 32`, `Community 65`, `Community 34`, `Community 33`, `Community 37`, `Community 7`, `Community 41`, `Community 59`, `Community 75`, `Community 45`, `Community 13`, `Community 17`, `Community 18`, `Community 52`, `Community 22`, `Community 23`, `Community 27`, `Community 60`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Are the 31 inferred relationships involving `useAuth()` (e.g. with `AccessState()` and `ProfileResolutionState()`) actually correct?**
  _`useAuth()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `extractErrorMessage()` (e.g. with `getAuthErrorMessage()` and `getErrorMessage()`) actually correct?**
  _`extractErrorMessage()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `runAutoClassifyAndAi()` (e.g. with `writeAuditEvent()` and `buildHomonymAnalysisInput()`) actually correct?**
  _`runAutoClassifyAndAi()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `rerunAiForCase()` (e.g. with `isAiEnabledForTenant()` and `buildHomonymAnalysisInput()`) actually correct?**
  _`rerunAiForCase()` has 13 INFERRED edges - model-reasoned connections that need verification._