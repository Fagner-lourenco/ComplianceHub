# Graph Report - ComplianceHub  (2026-05-29)

## Corpus Check
- 191 files · ~252,059 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1061 nodes · 1995 edges · 144 communities (138 shown, 6 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 184 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b8968706`
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
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 64|Community 64]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 58 edges
2. `callBackendFunction()` - 42 edges
3. `extractErrorMessage()` - 37 edges
4. `runAutoClassifyAndAi()` - 25 edges
5. `CasoPage()` - 24 edges
6. `runJuditEnrichmentPhase()` - 21 edges
7. `buildCaseBody()` - 21 edges
8. `useCases()` - 20 edges
9. `rerunAiForCase()` - 19 edges
10. `useTenant()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `buildCanonicalReportHtml()` --calls--> `buildCaseReportHtml()`  [INFERRED]
  functions/index.js → src/core/reportBuilder.js
- `runEscavadorEnrichmentPhase()` --calls--> `getEscavadorTribunais()`  [INFERRED]
  functions/index.js → functions/helpers/tribunalMap.js
- `runJuditEnrichmentPhase()` --calls--> `getJuditTribunais()`  [INFERRED]
  functions/index.js → functions/helpers/tribunalMap.js
- `getAuthErrorMessage()` --calls--> `extractErrorMessage()`  [INFERRED]
  src/pages/LoginPage.jsx → src/core/errorUtils.js
- `RelatoriosClientePage()` --calls--> `useAuth()`  [INFERRED]
  src/portals/client/RelatoriosClientePage.jsx → src/core/auth/useAuth.js

## Communities (144 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (55): applyCascadeReset(), applyDeleteFields(), assertCanAssignCase(), assertOpsManager(), buildExecutiveSummary(), buildExecutiveSummaryFallback(), buildExpandedKeyFindings(), buildKeyFindings() (+47 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (49): formatDuration(), getSlaColor(), getSlaDeadline(), getSlaStatus(), parseDate(), getOverallEnrichmentStatus(), calculateRisk(), subscribeToCaseAuditLogs() (+41 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (46): callEndpoint(), FonteDataError, queryCriminal(), queryIdentity(), queryLabor(), queryProcessosAgrupada(), queryProcessosCompleta(), queryReceitaFederal() (+38 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (42): adaptEscavador(), adaptJuditExecution(), adaptJuditLawsuits(), adaptJuditWarrants(), buildAndreCase(), buildCaseBase(), buildCaseWithBigDataCorpProcess(), buildCaseWithJuditRole() (+34 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (31): buildTenantStructuredQuery(), callRerunAiAnalysis(), callRerunEnrichmentPhase(), callRerunFullEnrichment(), createRestDocumentSnapshot(), decodeFirestoreFields(), decodeFirestoreValue(), fetchAuditLogs() (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (32): acquireAutoClassifyRun(), buildAiClassificationReviewUpdatePayload(), buildAiHomonymPrompt(), buildAiHomonymResetPayload(), buildAiHomonymUpdatePayload(), buildAiPrefillUpdatePayload(), buildAiPrompt(), buildAiUpdatePayload() (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (24): callGet(), DjenError, queryComunicacoesByName(), queryComunicacoesByProcesso(), queryTribunais(), extractKnownProcessNumbers(), runDjenEnrichmentPhase(), buildCandidateUfs() (+16 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (27): buildDetCriminalNotes(), buildDeterministicPrefill(), buildDetExecutiveSummary(), buildDetFinalJustification(), buildDetKeyFindings(), buildDetLaborNotes(), buildDetWarrantNotes(), classifyWarrantType() (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (24): badge(), buildBatchReportHtml(), buildCaseBody(), buildCaseReportHtml(), esc(), fieldHtml(), flagColor(), formatBirthAndAge() (+16 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (10): getActionBadgeStyle(), getActionFilterOptions(), getActionLabel(), getCategoryColor(), getCategoryFilterOptions(), getCategoryLabel(), AuditoriaClientePage(), getErrorMessage() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (13): DashboardClientePage(), formatDate(), formatDateTimeBR(), toDate(), callAssignCaseToAnalyst(), callAssignCaseToCurrentAnalyst(), callGetClientDashboardMetrics(), callGetClientQuotaStatus() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (14): AuthProvider(), AuthProbe(), useAuth(), DemoProviders(), callGetClientGeoIp(), NotificationProvider(), getAuthErrorMessage(), LoginPage() (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.1
Nodes (19): callBackendFunction(), callConcludeCaseByAnalyst(), callCreateOpsUser(), callGetClientCaseById(), callListClientCases(), callListOpsUsers(), callReturnCaseToClient(), callSaveCaseDraftByAnalyst() (+11 more)

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (16): buildBigDataCorpProcessCandidates(), buildCandidateProfile(), buildCoverageAssessment(), buildEscavadorProcessCandidates(), buildHardFacts(), buildHomonymAnalysisInput(), buildJuditProcessCandidates(), dedupCandidatesByCnj() (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.2
Nodes (15): buildCaseReportPath(), countCasesByMonth(), countCompletedCasesByMonth(), diffHours(), getAttentionReasons(), getCaseTimeline(), getClientDashboardMetrics(), getReportAvailability() (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.24
Nodes (14): callBackendFunction(), markAllNotificationsAsRead(), markNotificationAsRead(), subscribeToMyNotifications(), subscribeToUnreadNotifications(), getAudioContext(), isAudioUnlocked(), isSoundEnabled() (+6 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (17): buildAiPrefillPrompt(), buildCanonicalReportHtml(), buildProcessHighlights(), buildReportSlug(), buildSanitizedPublicResultSnapshot(), buildSourceSummary(), buildStatusSummary(), buildTimelineEvents() (+9 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (17): applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAiClassificationReviewPrompt(), buildAxisReviewContext(), buildReviewSource(), compactBigDataCorpProcessos(), compactDjenComunicacoes() (+9 more)

### Community 18 - "Community 18"
Cohesion: 0.17
Nodes (17): buildNextSteps(), buildResetPublishedCaseFields(), buildReviewDraftSeed(), extractFallbackAiClassificationReviewResponse(), looksLikeRawJsonOrTechnicalPayload(), normalizeKeyFindingsValue(), normalizeNarrativeValue(), pickConcludePayload() (+9 more)

### Community 19 - "Community 19"
Cohesion: 0.17
Nodes (9): maskCpf(), NovaSolicitacaoPanel(), validateCpf(), validateUrl(), FilterPanelMobile(), callCreateClientSolicitation(), getEnabledPhases(), useMediaQuery() (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.16
Nodes (15): buildClientVerdictPolicy(), classifyClientCriminalCategory(), dedupePartyNames(), getProcessParties(), getProcessRoleText(), inferStatusFromLastStep(), isActiveLaborParty(), isCandidateActiveLaborProcess() (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (14): buildClientCasePayload(), enforceTenantSubmissionLimits(), formatDateKey(), formatMonthKey(), getClientQuotaStatusInner(), getClientUserProfile(), getTenantSettingsData(), loadBigDataCorpConfig() (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (5): buildPrintableHtml(), esc(), ExportacoesPage(), getMockExports(), callRegisterClientExport()

### Community 23 - "Community 23"
Cohesion: 0.23
Nodes (7): ClientReportPage(), shortToken(), classifyError(), cleanMessage(), extractErrorMessage(), getUserFriendlyMessage(), isSafeForUser()

### Community 24 - "Community 24"
Cohesion: 0.19
Nodes (8): callUpdateTenantSettingsByAnalyst(), getTenantSettings(), getTenantUsage(), handleSave(), validateLimits(), getZone(), QuotaBar(), QuotaSummaryCard()

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (7): TenantProbe(), useTenant(), callCreateOpsClientUser(), ClientesPage(), EquipeOpsPage(), getStatusConfig(), RelatoriosPage()

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (4): renderPage(), renderPage(), renderPage(), ErrorBoundary

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (6): callGetOpsCaseMetrics(), fmtBRL(), fmtUSD(), MetricasIAPage(), pct(), QualityBar()

### Community 28 - "Community 28"
Cohesion: 0.35
Nodes (8): TenantProvider(), canAccessAllTenants(), dedupeTenants(), getSelectedTenantLabel(), normalizeTenantEntry(), resolveSelectedTenantId(), resolveTenantOptions(), subscribeToTenantDirectory()

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (8): getMacroProgress(), hasAnySocialProfile(), hasMeaningfulSocialAnalysis(), SolicitacoesPage(), getCaseStats(), buildClientInternalReportPath(), callSubmitClientCorrection(), useClientCasesQuery()

### Community 30 - "Community 30"
Cohesion: 0.38
Nodes (6): Sidebar(), PerfilPage(), formatRoleLabel(), getPortal(), hasPermission(), isOpsRole()

### Community 31 - "Community 31"
Cohesion: 0.24
Nodes (7): fetchOpsPublicReports(), fetchPublicReports(), revokePublicReport(), getReportCandidateName(), getReportStatus(), isExpired(), RevokeModal()

### Community 32 - "Community 32"
Cohesion: 0.42
Nodes (6): buildClientPortalPath(), buildOpsPortalPath(), getClientPortalBasePath(), getOpsPortalBasePath(), isDemoPortalPath(), normalizeLeaf()

### Community 33 - "Community 33"
Cohesion: 0.28
Nodes (9): asDate(), asIsoOrNull(), calculateTurnaroundHours(), diffHoursBackend(), getMetricCaseDate(), getPublicReportViewInner(), resolvePublicReportStatus(), serializeClientCaseDocument() (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.36
Nodes (7): BigDataCorpError, buildCombinedDatasets(), callPost(), delay(), queryCombined(), queryKyc(), queryProcesses()

### Community 35 - "Community 35"
Cohesion: 0.25
Nodes (3): resolveTheme(), useTheme(), Topbar()

### Community 36 - "Community 36"
Cohesion: 0.5
Nodes (6): isConfirmedMissingSnapshot(), isUnconfirmedMissingSnapshot(), createAuthFallbackProfile(), getAuthDisplayName(), mergeUserProfile(), normalizeString()

### Community 37 - "Community 37"
Cohesion: 0.36
Nodes (5): TestConsumer(), useAuditLogs(), useCandidates(), AuditoriaPage(), isClientRole()

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (5): getReportStatus(), isReportAvailable(), RelatoriosClientePage(), fetchClientPublicReports(), revokeClientPublicReport()

### Community 39 - "Community 39"
Cohesion: 0.48
Nodes (5): buildSearchText(), db(), interpolateTemplate(), stripUndefined(), writeAuditEvent()

### Community 40 - "Community 40"
Cohesion: 0.43
Nodes (5): callGet(), EscavadorError, queryMovimentacoes(), queryProcessoByCnj(), queryProcessosByPerson()

### Community 41 - "Community 41"
Cohesion: 0.29
Nodes (4): CaseCommunicationPanel(), callMarkCaseCommunicationRead(), callSendCaseMessage(), subscribeToCaseMessages()

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (6): buildTenantCollectionQuery(), subscribeToAuditLogs(), subscribeToCandidates(), subscribeToCases(), subscribeToClientCases(), subscribeToExports()

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (5): EquipePage(), getStatusConfig(), callCreateTenantUser(), callListTenantUsers(), callUpdateTenantUser()

### Community 44 - "Community 44"
Cohesion: 0.38
Nodes (3): NotificationBell(), useNotifications(), NotificationToast()

### Community 46 - "Community 46"
Cohesion: 0.6
Nodes (5): classifyRole(), getRoleScoreImpact(), isHighRiskRole(), isLowRiskRole(), normalizeLegalText()

### Community 48 - "Community 48"
Cohesion: 0.33
Nodes (4): generatePublicReportPdf(), getPublicReport(), getPublicReportView(), triggerPdfDownload()

### Community 49 - "Community 49"
Cohesion: 0.6
Nodes (4): buildPdfWatermarkCss(), escapeHtml(), injectPdfExportCss(), injectPublicVerificationBanner()

### Community 50 - "Community 50"
Cohesion: 0.7
Nodes (4): classifyRole(), getRoleScoreImpact(), isHighRiskRole(), isLowRiskRole()

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildCaseReportHtml()` connect `Community 8` to `Community 48`, `Community 16`, `Community 12`?**
  _High betweenness centrality (0.371) - this node is a cross-community bridge._
- **Why does `buildCanonicalReportHtml()` connect `Community 16` to `Community 0`, `Community 8`?**
  _High betweenness centrality (0.349) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 11` to `Community 1`, `Community 9`, `Community 10`, `Community 12`, `Community 15`, `Community 19`, `Community 22`, `Community 23`, `Community 25`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 37`, `Community 38`, `Community 41`, `Community 42`, `Community 43`, `Community 51`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Are the 31 inferred relationships involving `useAuth()` (e.g. with `AccessState()` and `ProfileResolutionState()`) actually correct?**
  _`useAuth()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `extractErrorMessage()` (e.g. with `getAuthErrorMessage()` and `getErrorMessage()`) actually correct?**
  _`extractErrorMessage()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `runAutoClassifyAndAi()` (e.g. with `buildHomonymAnalysisInput()` and `writeAuditEvent()`) actually correct?**
  _`runAutoClassifyAndAi()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `CasoPage()` (e.g. with `useAuth()` and `useAutoResize()`) actually correct?**
  _`CasoPage()` has 8 INFERRED edges - model-reasoned connections that need verification._