# Graph Report - ComplianceHub  (2026-05-15)

## Corpus Check
- 188 files · ~315,428 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 909 nodes · 1682 edges · 125 communities (120 shown, 5 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 175 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f27c5be7`
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
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 50|Community 50]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 58 edges
2. `extractErrorMessage()` - 37 edges
3. `callBackendFunction()` - 37 edges
4. `runJuditEnrichmentPhase()` - 21 edges
5. `runAutoClassifyAndAi()` - 21 edges
6. `buildCaseBody()` - 21 edges
7. `useCases()` - 20 edges
8. `useTenant()` - 19 edges
9. `buildSanitizedPublicResultSnapshot()` - 14 edges
10. `rerunAiForCase()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `buildCanonicalReportHtml()` --calls--> `buildCaseReportHtml()`  [INFERRED]
  functions/index.js → src/core/reportBuilder.js
- `normalizeDjenComunicacoes()` --calls--> `getDjenGeoMatch()`  [INFERRED]
  functions/normalizers/djen.js → functions/helpers/tribunalMap.js
- `LoginPage()` --calls--> `useAuth()`  [INFERRED]
  src/pages/LoginPage.jsx → src/core/auth/useAuth.js
- `RelatoriosClientePage()` --calls--> `useAuth()`  [INFERRED]
  src/portals/client/RelatoriosClientePage.jsx → src/core/auth/useAuth.js
- `CaseCommunicationPanel()` --calls--> `useAuth()`  [INFERRED]
  src/ui/components/CaseCommunication/CaseCommunicationPanel.jsx → src/core/auth/useAuth.js

## Communities (125 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (42): DashboardClientePage(), getMacroProgress(), hasAnySocialProfile(), hasMeaningfulSocialAnalysis(), SolicitacoesPage(), formatDuration(), getSlaColor(), getSlaDeadline() (+34 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (43): AuthProvider(), AuthProbe(), useAuth(), TenantProvider(), TenantProbe(), canAccessAllTenants(), dedupeTenants(), getSelectedTenantLabel() (+35 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (32): applyCascadeReset(), applyDeleteFields(), assertCanAssignCase(), assertOpsManager(), buildExecutiveSummary(), buildExecutiveSummaryFallback(), buildExpandedKeyFindings(), buildKeyFindings() (+24 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (46): callEndpoint(), FonteDataError, queryCriminal(), queryIdentity(), queryLabor(), queryProcessosAgrupada(), queryProcessosCompleta(), queryReceitaFederal() (+38 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (34): adaptEscavador(), adaptJuditExecution(), adaptJuditLawsuits(), adaptJuditWarrants(), buildAndreCase(), buildCaseBase(), buildDiegoCase(), buildDiegoJuditOnlyCase() (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (29): buildPrintableHtml(), esc(), ExportacoesPage(), badge(), buildBatchReportHtml(), buildCaseBody(), buildCaseReportHtml(), esc() (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (30): buildTenantStructuredQuery(), callRerunAiAnalysis(), callRerunEnrichmentPhase(), callRerunFullEnrichment(), createRestDocumentSnapshot(), decodeFirestoreFields(), decodeFirestoreValue(), fetchAuditLogs() (+22 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (26): acquireAutoClassifyRun(), buildAiHomonymPrompt(), buildAiHomonymResetPayload(), buildAiHomonymUpdatePayload(), buildAiPrefillUpdatePayload(), buildAiPrompt(), buildAiUpdatePayload(), buildResetPublishedCaseFields() (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (10): getActionBadgeStyle(), getActionFilterOptions(), getActionLabel(), getCategoryColor(), getCategoryFilterOptions(), getCategoryLabel(), AuditoriaClientePage(), getErrorMessage() (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (18): computeAutoClassification(), buildBigDataCorpProcessCandidates(), buildCandidateProfile(), buildCoverageAssessment(), buildEscavadorProcessCandidates(), buildHardFacts(), buildHomonymAnalysisInput(), buildJuditProcessCandidates() (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (19): callGet(), DjenError, queryComunicacoesByName(), queryComunicacoesByProcesso(), queryTribunais(), extractKnownProcessNumbers(), runDjenEnrichmentPhase(), classifyArea() (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (17): callAssignCaseToAnalyst(), callBackendFunction(), callCreateOpsUser(), callListOpsUsers(), callSaveCaseDraftByAnalyst(), callSetAiDecisionByAnalyst(), callUnassignCase(), callUpdateOpsUser() (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (17): getOverallEnrichmentStatus(), callConcludeCaseByAnalyst(), callReturnCaseToClient(), getOpsCaseReportHtml(), subscribeToCaseAuditLogs(), subscribeToCaseDoc(), CasoPage(), createInitialForm() (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.19
Nodes (16): buildCaseReportPath(), buildClientInternalReportPath(), countCasesByMonth(), countCompletedCasesByMonth(), diffHours(), getAttentionReasons(), getCaseTimeline(), getClientDashboardMetrics() (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.24
Nodes (14): callBackendFunction(), markAllNotificationsAsRead(), markNotificationAsRead(), subscribeToMyNotifications(), subscribeToUnreadNotifications(), getAudioContext(), isAudioUnlocked(), isSoundEnabled() (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.32
Nodes (17): buildDetCriminalNotes(), buildDeterministicPrefill(), buildDetExecutiveSummary(), buildDetFinalJustification(), buildDetKeyFindings(), buildDetLaborNotes(), buildDetWarrantNotes(), classifyWarrantType() (+9 more)

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (9): maskCpf(), NovaSolicitacaoPanel(), validateCpf(), validateUrl(), FilterPanelMobile(), callCreateClientSolicitation(), getEnabledPhases(), useMediaQuery() (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (16): buildAiPrefillPrompt(), buildCanonicalReportHtml(), buildProcessHighlights(), buildReportSlug(), buildSanitizedPublicResultSnapshot(), buildSourceSummary(), buildStatusSummary(), buildTimelineEvents() (+8 more)

### Community 18 - "Community 18"
Cohesion: 0.19
Nodes (13): buildClientCasePayload(), enforceTenantSubmissionLimits(), formatDateKey(), formatMonthKey(), getClientQuotaStatusInner(), getClientUserProfile(), getTenantSettingsData(), loadBigDataCorpConfig() (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.21
Nodes (12): buildNextSteps(), normalizeKeyFindingsValue(), normalizeNarrativeValue(), pickConcludePayload(), pickDraftPayload(), sanitizeAiHomonymStructured(), sanitizeAiPrefillStructured(), sanitizeAiStructured() (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.32
Nodes (8): ClientReportPage(), shortToken(), buildClientPortalPath(), buildOpsPortalPath(), getClientPortalBasePath(), getOpsPortalBasePath(), isDemoPortalPath(), normalizeLeaf()

### Community 21 - "Community 21"
Cohesion: 0.17
Nodes (4): renderPage(), renderPage(), renderPage(), ErrorBoundary

### Community 22 - "Community 22"
Cohesion: 0.24
Nodes (7): fetchOpsPublicReports(), fetchPublicReports(), revokePublicReport(), getReportCandidateName(), getReportStatus(), isExpired(), RevokeModal()

### Community 23 - "Community 23"
Cohesion: 0.36
Nodes (7): BigDataCorpError, buildCombinedDatasets(), callPost(), delay(), queryCombined(), queryKyc(), queryProcesses()

### Community 24 - "Community 24"
Cohesion: 0.25
Nodes (3): resolveTheme(), useTheme(), Topbar()

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (8): compactErrorMessage(), extractApiErrorMessage(), fixLatinMojibake(), formatAiRuntimeError(), formatOpenAiError(), normalizeUnicodeToAscii(), runStructuredAiAnalysis(), sanitizeAiOutput()

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (6): isConfirmedMissingSnapshot(), isUnconfirmedMissingSnapshot(), createAuthFallbackProfile(), getAuthDisplayName(), mergeUserProfile(), normalizeString()

### Community 27 - "Community 27"
Cohesion: 0.29
Nodes (5): getReportStatus(), isReportAvailable(), RelatoriosClientePage(), fetchClientPublicReports(), revokeClientPublicReport()

### Community 28 - "Community 28"
Cohesion: 0.48
Nodes (5): buildSearchText(), db(), interpolateTemplate(), stripUndefined(), writeAuditEvent()

### Community 29 - "Community 29"
Cohesion: 0.43
Nodes (5): callGet(), EscavadorError, queryMovimentacoes(), queryProcessoByCnj(), queryProcessosByPerson()

### Community 30 - "Community 30"
Cohesion: 0.29
Nodes (4): CaseCommunicationPanel(), callMarkCaseCommunicationRead(), callSendCaseMessage(), subscribeToCaseMessages()

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (5): EquipePage(), getStatusConfig(), callCreateTenantUser(), callListTenantUsers(), callUpdateTenantUser()

### Community 32 - "Community 32"
Cohesion: 0.38
Nodes (3): NotificationBell(), useNotifications(), NotificationToast()

### Community 35 - "Community 35"
Cohesion: 0.4
Nodes (5): buildTenantCollectionQuery(), subscribeToCandidates(), subscribeToCases(), subscribeToClientCases(), subscribeToExports()

### Community 36 - "Community 36"
Cohesion: 0.6
Nodes (5): asDate(), calculateTurnaroundHours(), getPublicReportViewInner(), resolvePublicReportStatus(), serializeManagedPublicReport()

### Community 37 - "Community 37"
Cohesion: 0.6
Nodes (4): buildPdfWatermarkCss(), escapeHtml(), injectPdfExportCss(), injectPublicVerificationBanner()

### Community 38 - "Community 38"
Cohesion: 0.7
Nodes (4): classifyRole(), getRoleScoreImpact(), isHighRiskRole(), isLowRiskRole()

### Community 39 - "Community 39"
Cohesion: 0.7
Nodes (4): classifyRole(), getRoleScoreImpact(), isHighRiskRole(), isLowRiskRole()

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildCaseReportHtml()` connect `Community 5` to `Community 17`, `Community 11`?**
  _High betweenness centrality (0.318) - this node is a cross-community bridge._
- **Why does `buildCanonicalReportHtml()` connect `Community 17` to `Community 2`, `Community 5`?**
  _High betweenness centrality (0.303) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 1` to `Community 0`, `Community 35`, `Community 5`, `Community 8`, `Community 11`, `Community 12`, `Community 14`, `Community 16`, `Community 20`, `Community 22`, `Community 27`, `Community 30`, `Community 31`?**
  _High betweenness centrality (0.177) - this node is a cross-community bridge._
- **Are the 31 inferred relationships involving `useAuth()` (e.g. with `AccessState()` and `ProfileResolutionState()`) actually correct?**
  _`useAuth()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `extractErrorMessage()` (e.g. with `getAuthErrorMessage()` and `getErrorMessage()`) actually correct?**
  _`extractErrorMessage()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `runJuditEnrichmentPhase()` (e.g. with `checkCircuit()` and `queryEntityDataLake()`) actually correct?**
  _`runJuditEnrichmentPhase()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `runAutoClassifyAndAi()` (e.g. with `buildHomonymAnalysisInput()` and `writeAuditEvent()`) actually correct?**
  _`runAutoClassifyAndAi()` has 2 INFERRED edges - model-reasoned connections that need verification._