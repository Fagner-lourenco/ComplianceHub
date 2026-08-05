# Graph Report - ComplianceHub  (2026-08-04)

## Corpus Check
- 305 files · ~456,495 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1533 nodes · 2635 edges · 197 communities (183 shown, 14 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 294 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `59865cc8`
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
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 97|Community 97]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 58 edges
2. `callBackendFunction()` - 49 edges
3. `extractErrorMessage()` - 37 edges
4. `CasoPage()` - 26 edges
5. `formatDateTimeBR()` - 20 edges
6. `buildCaseBody()` - 20 edges
7. `writeAuditEvent()` - 19 edges
8. `useTenant()` - 19 edges
9. `normalizeJuditLawsuits()` - 18 edges
10. `rerunAiForCase()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `buildCanonicalReportHtml()` --calls--> `buildCaseReportHtml()`  [INFERRED]
  functions/modules/exportJobsAndReports.js → src/core/reportBuilder.js
- `isClientMaterialCriminalProcess()` --calls--> `classifyCriminalMateriality()`  [INFERRED]
  functions/modules/clientVerdictPolicy.js → functions/helpers/criminalMateriality.js
- `isClientAttentionCriminalProcess()` --calls--> `classifyCriminalMateriality()`  [INFERRED]
  functions/modules/clientVerdictPolicy.js → functions/helpers/criminalMateriality.js
- `LoginPage()` --calls--> `useAuth()`  [INFERRED]
  src/pages/LoginPage.jsx → src/core/auth/useAuth.js
- `RelatoriosClientePage()` --calls--> `useAuth()`  [INFERRED]
  src/portals/client/RelatoriosClientePage.jsx → src/core/auth/useAuth.js

## Communities (197 total, 14 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (37): hasBenignNoProcessCoverage(), isFirestoreSentinel(), normalizeTenantSlug(), sanitizeAuditMetadataValue(), sanitizePublicStructuredValue(), sanitizeStructuredText(), normalizeKeyFindingsValue(), normalizeNarrativeValue() (+29 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (34): buildSearchText(), db(), interpolateTemplate(), stripUndefined(), writeAuditEvent(), buildPdfWatermarkCss(), escapeHtml(), injectPdfExportCss() (+26 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (45): adaptEscavador(), adaptJuditExecution(), adaptJuditLawsuits(), adaptJuditWarrants(), buildAndreCase(), buildCaseBase(), buildCaseWithBigDataCorpProcess(), buildCaseWithJuditRole() (+37 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (35): DashboardClientePage(), maskCpf(), NovaSolicitacaoPanel(), hasAnySocialProfile(), hasMeaningfulSocialAnalysis(), SolicitacoesPage(), buildCaseReportPath(), buildClientInternalReportPath() (+27 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (46): asDate(), classifyWarrantType(), dedupePartyNames(), detectCartaDeGuia(), extractSentenceDetails(), filterDjenComunicacoesByConfirmedProcess(), findLinkedCivilProcess(), firstMovementContent() (+38 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (34): enforceTenantSubmissionLimits(), createClientSolicitationHandler(), buildClientCasePayload(), buildResetPublishedCaseFields(), buildReviewDraftSeed(), clientPayloadChanged(), isAutoClassifyOnlyChange(), normalizeKeyFindingsValue() (+26 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (36): buildTenantCollectionQuery(), buildTenantStructuredQuery(), callRerunAiAnalysis(), callRerunEnrichmentPhase(), callRerunFullEnrichment(), createRestDocumentSnapshot(), decodeFirestoreFields(), decodeFirestoreValue() (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (21): asDate(), asIsoOrNull(), buildOpsMetricsFromCases(), buildProviderRunIds(), compareClientCases(), compareOpsCases(), computeUrgencyRank(), diffHoursBackend() (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (26): attemptJsonRepair(), looksLikeRawJsonOrTechnicalPayload(), parseAiClassificationReviewResponse(), parseAiHomonymResponse(), parseAiPrefillResponse(), parseAiResponse(), parseJsonSchemaResponse(), sanitizeAiClassificationReviewStructured() (+18 more)

### Community 9 - "Community 9"
Cohesion: 0.19
Nodes (28): asArray(), asObject(), asObjectArray(), boundedTextOrNull(), buildCompactRawResponse(), buildMinimalEscavador2Persistence(), collectProcessParties(), compactFetchSummary() (+20 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (25): subscribeToCaseAuditLogs(), subscribeToCaseDoc(), useAutoResize(), buildEscavador2InspectionData(), CasoPage(), createInitialForm(), formatFullCpf(), formatPendingJuditPhases() (+17 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (23): hasLowRiskRole(), buildProcessText(), getAssuntoText(), getClasseText(), hasCriminalIndicator(), hasIdentifiableClassOrSubject(), isExcludedCrimeType(), classifyCriminalMateriality() (+15 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (16): recordFailure(), recordSuccess(), buildStuckUpdatePayload(), parseWhen(), resolveStuckClock(), runEnrichmentWatchdogSweep(), selectStuckEnrichmentCases(), escavador2RunDocId() (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.1
Nodes (15): TenantProbe(), useTenant(), callAssignCaseToAnalyst(), callAssignCaseToCurrentAnalyst(), callCreateOpsClientUser(), callCreateOpsUser(), callListOpsUsers(), callUpdateOpsUser() (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (22): ClientReportPage(), shortToken(), EquipePage(), getStatusConfig(), callBackendFunction(), callConcludeCaseByAnalyst(), callCreateTenantUser(), callGetClientCaseById() (+14 more)

### Community 15 - "Community 15"
Cohesion: 0.1
Nodes (13): buildPrintableHtml(), esc(), ExportacoesPage(), normalizeJobStatus(), getMockExports(), callCancelExportJob(), callCreateExportJob(), callGetClientExportCases() (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (10): getActionBadgeStyle(), getActionFilterOptions(), getActionLabel(), getCategoryColor(), getCategoryFilterOptions(), getCategoryLabel(), AuditoriaClientePage(), getErrorMessage() (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.18
Nodes (23): badge(), buildBatchReportHtml(), buildCaseBody(), buildCaseReportHtml(), esc(), fieldHtml(), flagColor(), formatBirthAndAge() (+15 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (20): asArray(), buildEscavador2Process(), buildKnownProcess(), collectKnownProcesses(), collectSubjectTexts(), countUnmaskedPositions(), daysBetween(), deduplicateEscavador2Findings() (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (12): classifyError(), cleanMessage(), extractErrorMessage(), getUserFriendlyMessage(), isSafeForUser(), callGetClientGeoIp(), callUpdateTenantSettingsByAnalyst(), getTenantUsage() (+4 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (17): buildBigDataCorpProcessCandidates(), buildCandidateProfile(), buildCoverageAssessment(), buildEscavador2ProcessCandidates(), buildEscavadorProcessCandidates(), buildHardFacts(), buildHomonymAnalysisInput(), buildJuditProcessCandidates() (+9 more)

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (19): applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAiClassificationReviewPrompt(), buildAxisReviewContext(), buildReviewSource(), compactBigDataCorpProcessos(), compactDjenComunicacoes() (+11 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (11): AuthProvider(), AuthProbe(), useAuth(), DemoProviders(), NotificationProvider(), AccessState(), PortalHomeRedirect(), ProfileResolutionState() (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (13): CaseCommunicationPanel(), formatMessageDate(), formatDateTimeBR(), toDate(), callGetSystemHealth(), callMarkCaseCommunicationRead(), callSendCaseMessage(), generatePublicReportPdf() (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.2
Nodes (15): buildCandidateUfs(), getDjenGeoMatch(), isValidUf(), classifyArea(), cleanDestinatarioName(), computeProbabilityScore(), computeWordSimilarity(), determineConfirmation() (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (10): assertCanAccessCaseCommunication(), buildNotificationId(), createNotification(), createSystemCaseMessage(), resolveUserPortal(), sanitizeNotificationIdPart(), buildExpiredSystemMessageBody(), expireCaseInTransaction() (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (14): callBackendFunction(), markAllNotificationsAsRead(), markNotificationAsRead(), subscribeToMyNotifications(), subscribeToUnreadNotifications(), getAudioContext(), isAudioUnlocked(), isSoundEnabled() (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.21
Nodes (9): createCaseCompletedNotifications(), createNewSolicitationNotifications(), createSendCaseMessageHandler(), getRequestIp(), isPrivateOrLocalIp(), lookupIpLocation(), normalizeIp(), sanitizeGeoText() (+1 more)

### Community 29 - "Community 29"
Cohesion: 0.14
Nodes (13): getReportStatus(), isReportAvailable(), RelatoriosClientePage(), getMockPublicReports(), fetchClientPublicReports(), fetchOpsPublicReports(), revokeClientPublicReport(), revokePublicReport() (+5 more)

### Community 30 - "Community 30"
Cohesion: 0.12
Nodes (6): renderPage(), renderPage(), renderPage(), ErrorBoundary, renderSidebar(), renderModal()

### Community 31 - "Community 31"
Cohesion: 0.32
Nodes (14): callGet(), callPost(), checkRequestStatus(), fetchResponses(), formatCpf(), JuditError, pollRequest(), queryEntityDataLake() (+6 more)

### Community 32 - "Community 32"
Cohesion: 0.2
Nodes (11): createEnrichmentPhases(), evaluateNegativePartialSafetyNet(), extractKnownProcessNumbers(), makeBdcDeps(), makeCreditDeps(), makeDeps(), makeDjenDeps(), makeEscavador2Deps() (+3 more)

### Community 33 - "Community 33"
Cohesion: 0.15
Nodes (13): rerunAiForCase(), runAiClassificationReviewAnalysis(), runAiHomonymAnalysis(), buildAiClassificationReviewUpdatePayload(), buildAiHomonymResetPayload(), buildAiHomonymUpdatePayload(), buildAiUpdatePayload(), estimateAiCostUsd() (+5 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (14): buildAiHomonymPrompt(), buildAiPrefillPrompt(), buildAiPrompt(), compactErrorMessage(), computeAiCacheKey(), computeSimpleHash(), extractApiErrorMessage(), formatAiRuntimeError() (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.24
Nodes (11): createEnrichBigDataCorpOnCaseHandler(), createEnrichBigDataCorpOnCorrectionHandler(), createEnrichCreditOnCaseHandler(), createEnrichDjenOnCaseHandler(), createEnrichEscavador2OnCaseHandler(), createEnrichEscavadorOnCaseHandler(), createEnrichJuditOnCaseHandler(), createEnrichJuditOnCorrectionHandler() (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.36
Nodes (11): buildCreditRestrictionSummary(), buildDetails(), buildLawsuitAppointments(), buildNegativeAppointments(), deriveCreditRestrictionFlag(), describeAppointments(), formatBRL(), formatRefDate() (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.23
Nodes (8): subscribeToAuditLogs(), TestConsumer(), useAuditLogs(), useCandidates(), TestConsumer(), useCases(), AuditoriaPage(), isClientRole()

### Community 38 - "Community 38"
Cohesion: 0.31
Nodes (9): BigDataCorpError, buildCombinedDatasets(), callPost(), delay(), queryCombined(), queryKyc(), queryMarketplaceCredit(), queryProcesses() (+1 more)

### Community 39 - "Community 39"
Cohesion: 0.31
Nodes (9): callEndpoint(), FonteDataError, queryCriminal(), queryIdentity(), queryLabor(), queryProcessosAgrupada(), queryProcessosCompleta(), queryReceitaFederal() (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.33
Nodes (7): callUpdateOwnProfile(), Sidebar(), PerfilPage(), formatRoleLabel(), getPortal(), hasPermission(), isOpsRole()

### Community 41 - "Community 41"
Cohesion: 0.33
Nodes (8): TenantProvider(), canAccessAllTenants(), dedupeTenants(), getSelectedTenantLabel(), normalizeTenantEntry(), resolveSelectedTenantId(), resolveTenantOptions(), subscribeToTenantDirectory()

### Community 42 - "Community 42"
Cohesion: 0.35
Nodes (6): formatDuration(), getSlaColor(), getSlaDeadline(), getSlaStatus(), parseDate(), SlaBadge()

### Community 43 - "Community 43"
Cohesion: 0.27
Nodes (6): callGetOpsCaseMetrics(), fmtBRL(), fmtUSD(), MetricasIAPage(), pct(), QualityBar()

### Community 44 - "Community 44"
Cohesion: 0.42
Nodes (6): buildClientPortalPath(), buildOpsPortalPath(), getClientPortalBasePath(), getOpsPortalBasePath(), isDemoPortalPath(), normalizeLeaf()

### Community 45 - "Community 45"
Cohesion: 0.27
Nodes (10): applyClassificationReviewGuardrails(), buildDisplayReviewContext(), buildDisplayReviewSource(), buildFallbackClassificationReview(), countReviewItems(), hasCriminalLowRiskRoleOnlyForDisplay(), isNegativeReviewFlag(), isPositiveReviewFlag() (+2 more)

### Community 46 - "Community 46"
Cohesion: 0.27
Nodes (5): getOverallEnrichmentStatus(), callListOpsCases(), compareDemoOpsCases(), computeDemoUrgencyRank(), matchesDemoCase()

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (3): resolveTheme(), useTheme(), Topbar()

### Community 49 - "Community 49"
Cohesion: 0.39
Nodes (6): buildEscavador2AsyncPayload(), buildEscavador2Payload(), consultarEscavador2(), consultarEscavador2Async(), Escavador2Error, onlyDigits()

### Community 50 - "Community 50"
Cohesion: 0.32
Nodes (4): createBaseDeps(), createCircuitDeps(), createDb(), createDoc()

### Community 51 - "Community 51"
Cohesion: 0.32
Nodes (4): asIsoOrNull(), matchesClientCaseFilters(), matchesClientCaseSearch(), serializeClientCaseDocument()

### Community 52 - "Community 52"
Cohesion: 0.36
Nodes (5): formatDate(), NotificationBell(), timeAgo(), useNotifications(), NotificationToast()

### Community 53 - "Community 53"
Cohesion: 0.5
Nodes (6): isConfirmedMissingSnapshot(), isUnconfirmedMissingSnapshot(), createAuthFallbackProfile(), getAuthDisplayName(), mergeUserProfile(), normalizeString()

### Community 55 - "Community 55"
Cohesion: 0.43
Nodes (5): callGet(), DjenError, queryComunicacoesByName(), queryComunicacoesByProcesso(), queryTribunais()

### Community 56 - "Community 56"
Cohesion: 0.43
Nodes (5): callGet(), EscavadorError, queryMovimentacoes(), queryProcessoByCnj(), queryProcessosByPerson()

### Community 57 - "Community 57"
Cohesion: 0.52
Nodes (5): daysAgo(), makeBaseDeps(), makeCorrectionDeps(), makeDepsWithExistingCase(), makeMockDb()

### Community 59 - "Community 59"
Cohesion: 0.43
Nodes (5): getChecklistSessionKey(), readStoredState(), Harness(), useChecklistSession(), writeStoredState()

### Community 62 - "Community 62"
Cohesion: 0.47
Nodes (3): getProcessReviewTone(), normalizeReviewText(), ProcessInspectionModal()

### Community 63 - "Community 63"
Cohesion: 0.6
Nodes (3): hasPendingJuditAsync(), isJuditSettled(), isProviderTerminalForPipeline()

### Community 64 - "Community 64"
Cohesion: 0.7
Nodes (4): decodeCursor(), encodeCursor(), normalizeLimit(), paginateFirestoreQuery()

### Community 67 - "Community 67"
Cohesion: 0.7
Nodes (4): createDeps(), createMockDb(), createMockJuditApiKey(), createMockNormalize()

### Community 69 - "Community 69"
Cohesion: 0.5
Nodes (5): cleanOperationalList(), cleanOperationalText(), hasUsableClassificationReview(), looksLikeRawJsonOrTechnicalPayload(), sanitizeClassificationReviewForDisplay()

## Knowledge Gaps
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildCaseReportHtml()` connect `Community 18` to `Community 24`, `Community 0`, `Community 14`?**
  _High betweenness centrality (0.247) - this node is a cross-community bridge._
- **Why does `buildCanonicalReportHtml()` connect `Community 0` to `Community 18`?**
  _High betweenness centrality (0.245) - this node is a cross-community bridge._
- **Are the 31 inferred relationships involving `useAuth()` (e.g. with `AccessState()` and `ProfileResolutionState()`) actually correct?**
  _`useAuth()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `extractErrorMessage()` (e.g. with `getAuthErrorMessage()` and `getErrorMessage()`) actually correct?**
  _`extractErrorMessage()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `CasoPage()` (e.g. with `useAuth()` and `useAutoResize()`) actually correct?**
  _`CasoPage()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `formatDateTimeBR()` (e.g. with `PerfilPage()` and `PublicReportPage()`) actually correct?**
  _`formatDateTimeBR()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._