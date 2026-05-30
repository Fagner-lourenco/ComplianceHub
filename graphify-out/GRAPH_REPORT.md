# Graph Report - ComplianceHub  (2026-05-30)

## Corpus Check
- 259 files · ~348,013 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1550 nodes · 2792 edges · 185 communities (178 shown, 7 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 230 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d6cabf75`
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
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 88|Community 88]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 58 edges
2. `callBackendFunction()` - 48 edges
3. `extractErrorMessage()` - 37 edges
4. `runAutoClassifyAndAi()` - 26 edges
5. `CasoPage()` - 25 edges
6. `runJuditEnrichmentPhase()` - 22 edges
7. `buildCaseBody()` - 21 edges
8. `useCases()` - 20 edges
9. `rerunAiForCase()` - 19 edges
10. `useTenant()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `buildCanonicalReportHtml()` --calls--> `buildCaseReportHtml()`  [INFERRED]
  functions/modules/exportJobsAndReports.js → src/core/reportBuilder.js
- `buildCanonicalReportHtml()` --calls--> `buildCaseReportHtml()`  [INFERRED]
  functions/index.js → src/core/reportBuilder.js
- `runEscavadorEnrichmentPhase()` --calls--> `getEscavadorTribunais()`  [INFERRED]
  functions/index.js → functions/helpers/tribunalMap.js
- `runJuditEnrichmentPhase()` --calls--> `getJuditTribunais()`  [INFERRED]
  functions/index.js → functions/helpers/tribunalMap.js
- `enforceTenantSubmissionLimits()` --calls--> `writeAuditEvent()`  [INFERRED]
  functions/modules/caseQueriesAssignments.js → functions/audit/writeAuditEvent.js

## Communities (185 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (49): applyCascadeReset(), applyDeleteFields(), assertCanAssignCase(), assertOpsManager(), backfillClientCasesMirrorInner(), buildExecutiveSummary(), buildExecutiveSummaryFallback(), buildExpandedKeyFindings() (+41 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (54): formatDuration(), getSlaColor(), getSlaDeadline(), getSlaStatus(), parseDate(), getOverallEnrichmentStatus(), formatDate(), formatDateTimeBR() (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (51): maybeRunAutoClassifyAndAi(), adaptEscavador(), adaptJuditExecution(), adaptJuditLawsuits(), adaptJuditWarrants(), buildAndreCase(), buildCaseBase(), buildCaseWithBigDataCorpProcess() (+43 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (49): callGet(), EscavadorError, queryMovimentacoes(), queryProcessoByCnj(), queryProcessosByPerson(), callEndpoint(), FonteDataError, queryCriminal() (+41 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (34): buildSearchText(), db(), interpolateTemplate(), stripUndefined(), writeAuditEvent(), buildPdfWatermarkCss(), escapeHtml(), injectPdfExportCss() (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (37): applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAiClassificationReviewPrompt(), buildAiClassificationReviewUpdatePayload(), buildAiHomonymPrompt(), buildAiHomonymUpdatePayload(), buildAiPrefillPrompt() (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (20): asDate(), asIsoOrNull(), buildOpsMetricsFromCases(), buildProviderRunIds(), compareClientCases(), compareOpsCases(), diffHoursBackend(), enforceTenantSubmissionLimits() (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (35): buildTenantCollectionQuery(), buildTenantStructuredQuery(), callRerunAiAnalysis(), callRerunEnrichmentPhase(), callRerunFullEnrichment(), createRestDocumentSnapshot(), decodeFirestoreFields(), decodeFirestoreValue() (+27 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (37): acquireAutoClassifyRun(), buildAiClassificationReviewUpdatePayload(), buildAiHomonymPrompt(), buildAiHomonymResetPayload(), buildAiHomonymUpdatePayload(), buildAiPrefillUpdatePayload(), buildAiPrompt(), buildAiUpdatePayload() (+29 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (25): fixLatinMojibake(), isStringArray(), looksLikeRawJsonOrTechnicalPayload(), normalizeUnicodeToAscii(), parseAiClassificationReviewResponse(), parseAiHomonymResponse(), parseAiPrefillResponse(), parseAiResponse() (+17 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (26): asDate(), dedupePartyNames(), detectCartaDeGuia(), filterDjenComunicacoesByConfirmedProcess(), findLinkedCivilProcess(), firstMovementContent(), formatCnj(), formatDateBR() (+18 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (24): callGet(), DjenError, queryComunicacoesByName(), queryComunicacoesByProcesso(), queryTribunais(), extractKnownProcessNumbers(), runDjenEnrichmentPhase(), buildCandidateUfs() (+16 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (27): buildDetCriminalNotes(), buildDeterministicPrefill(), buildDetExecutiveSummary(), buildDetFinalJustification(), buildDetKeyFindings(), buildDetLaborNotes(), buildDetWarrantNotes(), classifyWarrantType() (+19 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (24): badge(), buildBatchReportHtml(), buildCaseBody(), buildCaseReportHtml(), esc(), fieldHtml(), flagColor(), formatBirthAndAge() (+16 more)

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (21): canBypassIdentityGate(), isIdentityGateBlocked(), buildConcludeUpdatePayload(), createConcludeCaseByAnalystHandler(), createSaveCaseDraftByAnalystHandler(), createSetAiDecisionByAnalystHandler(), createUpdateTenantSettingsByAnalystHandler(), normalizeKeyFindingsValue() (+13 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (17): DashboardClientePage(), getMacroProgress(), hasAnySocialProfile(), hasMeaningfulSocialAnalysis(), SolicitacoesPage(), classifyError(), cleanMessage(), extractErrorMessage() (+9 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (10): getActionBadgeStyle(), getActionFilterOptions(), getActionLabel(), getCategoryColor(), getCategoryFilterOptions(), getCategoryLabel(), AuditoriaClientePage(), getErrorMessage() (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (21): EquipePage(), getStatusConfig(), callBackendFunction(), callConcludeCaseByAnalyst(), callCreateClientSolicitation(), callCreateTenantUser(), callGetSystemHealth(), callListClientCases() (+13 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (23): buildAiPrefillPrompt(), buildCanonicalReportHtml(), buildProcessHighlights(), buildReportSlug(), buildResetPublishedCaseFields(), buildReviewDraftSeed(), buildSanitizedPublicResultSnapshot(), buildSourceSummary() (+15 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (5): asDate(), buildCanonicalReportHtml(), getPublicReportViewInner(), resolvePublicReportStatus(), serializeManagedPublicReport()

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (19): buildExecutiveSummary(), buildExecutiveSummaryFallback(), buildExpandedKeyFindings(), buildKeyFindings(), buildNextSteps(), buildReportSlug(), buildSafeNarrativeReplacement(), buildSanitizedPublicResultSnapshot() (+11 more)

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (11): buildPrintableHtml(), esc(), ExportacoesPage(), getMockExports(), callCancelExportJob(), callCreateExportJob(), callGetClientExportCases(), callGetExportJobStatus() (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (16): buildBigDataCorpProcessCandidates(), buildCandidateProfile(), buildCoverageAssessment(), buildEscavadorProcessCandidates(), buildHardFacts(), buildHomonymAnalysisInput(), buildJuditProcessCandidates(), dedupCandidatesByCnj() (+8 more)

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (11): maskCpf(), NovaSolicitacaoPanel(), validateCpf(), validateUrl(), FilterPanelMobile(), getEnabledPhases(), useMediaQuery(), MobileDataCardList() (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (11): AuthProvider(), AuthProbe(), useAuth(), DemoProviders(), NotificationProvider(), AccessState(), PortalHomeRedirect(), ProfileResolutionState() (+3 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (9): getCaseStats(), callAssignCaseToAnalyst(), callAssignCaseToCurrentAnalyst(), callListOpsUsers(), TestConsumer(), useCases(), useOpsCasesQuery(), CasosPage() (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.19
Nodes (16): buildCaseReportPath(), buildClientInternalReportPath(), countCasesByMonth(), countCompletedCasesByMonth(), diffHours(), getAttentionReasons(), getCaseTimeline(), getClientDashboardMetrics() (+8 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (18): applyAiClassificationReviewGuardrails(), applyAxisReviewGuardrail(), buildAiClassificationReviewContext(), buildAiClassificationReviewPrompt(), buildAxisReviewContext(), buildReviewSource(), compactBigDataCorpProcessos(), compactDjenComunicacoes() (+10 more)

### Community 28 - "Community 28"
Cohesion: 0.16
Nodes (6): getClientQuotaStatusInner(), getSystemHealthLogic(), computeNameSimilarity(), formatDateKey(), formatMonthKey(), normalizeNameForGate()

### Community 29 - "Community 29"
Cohesion: 0.24
Nodes (14): callBackendFunction(), markAllNotificationsAsRead(), markNotificationAsRead(), subscribeToMyNotifications(), subscribeToUnreadNotifications(), getAudioContext(), isAudioUnlocked(), isSoundEnabled() (+6 more)

### Community 30 - "Community 30"
Cohesion: 0.22
Nodes (11): revokeCasePublicationArtifacts(), buildClientCasePayload(), clientPayloadChanged(), isAutoClassifyOnlyChange(), publishResultOnCaseDoneLogic(), sanitizeCpf(), shouldSkipClientCaseMirrorSync(), syncClientCaseOnCreateLogic() (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.19
Nodes (16): buildNextSteps(), extractFallbackAiClassificationReviewResponse(), looksLikeRawJsonOrTechnicalPayload(), normalizeKeyFindingsValue(), normalizeNarrativeValue(), pickConcludePayload(), pickDraftPayload(), sanitizeAiClassificationReviewStructured() (+8 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (8): TenantProbe(), useTenant(), callCreateOpsClientUser(), callCreateOpsUser(), callUpdateOpsUser(), ClientesPage(), EquipeOpsPage(), getStatusConfig()

### Community 33 - "Community 33"
Cohesion: 0.16
Nodes (15): buildClientVerdictPolicy(), classifyClientCriminalCategory(), dedupePartyNames(), getProcessParties(), getProcessRoleText(), inferStatusFromLastStep(), isActiveLaborParty(), isCandidateActiveLaborProcess() (+7 more)

### Community 34 - "Community 34"
Cohesion: 0.23
Nodes (7): createCaseCompletedNotifications(), createNewSolicitationNotifications(), getRequestIp(), isPrivateOrLocalIp(), lookupIpLocation(), normalizeIp(), sanitizeGeoText()

### Community 35 - "Community 35"
Cohesion: 0.21
Nodes (10): fixLatinMojibake(), isStringArray(), maskCpf(), normalizeUnicodeToAscii(), sanitizeAiOutput(), sanitizeCpf(), sanitizeStructuredText(), stripInvalidControlChars() (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.14
Nodes (12): ClientReportPage(), shortToken(), callGetClientCaseById(), generateClientCasePdf(), generatePublicReportPdf(), getCasePublicResult(), getClientCaseReportHtml(), getPublicReport() (+4 more)

### Community 37 - "Community 37"
Cohesion: 0.26
Nodes (10): createEnrichmentPhases(), evaluateEscavadorNeed(), evaluateNegativePartialSafetyNet(), extractKnownProcessNumbers(), makeBdcDeps(), makeDeps(), makeDjenDeps(), makeEscavadorDeps() (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.17
Nodes (4): renderPage(), renderPage(), renderPage(), ErrorBoundary

### Community 39 - "Community 39"
Cohesion: 0.35
Nodes (8): TenantProvider(), canAccessAllTenants(), dedupeTenants(), getSelectedTenantLabel(), normalizeTenantEntry(), resolveSelectedTenantId(), resolveTenantOptions(), subscribeToTenantDirectory()

### Community 40 - "Community 40"
Cohesion: 0.24
Nodes (6): callGetOpsCaseMetrics(), fmtBRL(), fmtUSD(), MetricasIAPage(), pct(), QualityBar()

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (8): fetchOpsPublicReports(), fetchPublicReports(), revokePublicReport(), getReportCandidateName(), getReportStatus(), isExpired(), RelatoriosPage(), RevokeModal()

### Community 42 - "Community 42"
Cohesion: 0.27
Nodes (5): assertCanAccessCaseCommunication(), buildNotificationId(), createNotification(), resolveUserPortal(), sanitizeNotificationIdPart()

### Community 43 - "Community 43"
Cohesion: 0.27
Nodes (10): buildClientCasePayload(), clientPayloadChanged(), enforceTenantSubmissionLimits(), formatDateKey(), formatMonthKey(), getClientQuotaStatusInner(), getClientUserProfile(), maskCpf() (+2 more)

### Community 44 - "Community 44"
Cohesion: 0.44
Nodes (8): _getDb(), getTenantSettingsData(), loadBigDataCorpConfig(), loadDjenConfig(), loadEscavadorConfig(), loadFonteDataConfig(), loadJuditConfig(), _setDb()

### Community 45 - "Community 45"
Cohesion: 0.24
Nodes (4): isFirestoreSentinel(), sanitizeAuditMetadataValue(), sanitizePublicStructuredValue(), sanitizeStructuredText()

### Community 46 - "Community 46"
Cohesion: 0.36
Nodes (8): buildDetCriminalNotes(), buildDeterministicPrefill(), buildDetExecutiveSummary(), buildDetFinalJustification(), buildDetKeyFindings(), buildDetLaborNotes(), buildDetWarrantNotes(), evaluateComplexityTriggers()

### Community 47 - "Community 47"
Cohesion: 0.42
Nodes (6): buildClientPortalPath(), buildOpsPortalPath(), getClientPortalBasePath(), getOpsPortalBasePath(), isDemoPortalPath(), normalizeLeaf()

### Community 48 - "Community 48"
Cohesion: 0.27
Nodes (7): subscribeToAuditLogs(), subscribeToCandidates(), TestConsumer(), useAuditLogs(), useCandidates(), AuditoriaPage(), isClientRole()

### Community 49 - "Community 49"
Cohesion: 0.38
Nodes (6): Sidebar(), PerfilPage(), formatRoleLabel(), getPortal(), hasPermission(), isOpsRole()

### Community 50 - "Community 50"
Cohesion: 0.22
Nodes (9): fixLatinMojibake(), normalizeUnicodeToAscii(), parseAiClassificationReviewResponse(), parseAiHomonymResponse(), parseAiPrefillResponse(), parseAiResponse(), parseJsonSchemaResponse(), sanitizeAiOutput() (+1 more)

### Community 51 - "Community 51"
Cohesion: 0.28
Nodes (9): asDate(), asIsoOrNull(), calculateTurnaroundHours(), diffHoursBackend(), getMetricCaseDate(), getPublicReportViewInner(), resolvePublicReportStatus(), serializeClientCaseDocument() (+1 more)

### Community 52 - "Community 52"
Cohesion: 0.28
Nodes (5): canRunFinalClassification(), hasPendingJuditAsync(), isJuditSettled(), isProviderTerminalForPipeline(), canRunFinalClassification()

### Community 53 - "Community 53"
Cohesion: 0.36
Nodes (7): BigDataCorpError, buildCombinedDatasets(), callPost(), delay(), queryCombined(), queryKyc(), queryProcesses()

### Community 54 - "Community 54"
Cohesion: 0.25
Nodes (3): resolveTheme(), useTheme(), Topbar()

### Community 55 - "Community 55"
Cohesion: 0.5
Nodes (6): isConfirmedMissingSnapshot(), isUnconfirmedMissingSnapshot(), createAuthFallbackProfile(), getAuthDisplayName(), mergeUserProfile(), normalizeString()

### Community 56 - "Community 56"
Cohesion: 0.32
Nodes (5): callUpdateTenantSettingsByAnalyst(), getTenantSettings(), getTenantUsage(), handleSave(), validateLimits()

### Community 58 - "Community 58"
Cohesion: 0.29
Nodes (4): CaseCommunicationPanel(), callMarkCaseCommunicationRead(), callSendCaseMessage(), subscribeToCaseMessages()

### Community 59 - "Community 59"
Cohesion: 0.38
Nodes (3): NotificationBell(), useNotifications(), NotificationToast()

### Community 61 - "Community 61"
Cohesion: 0.4
Nodes (3): getReportStatus(), isReportAvailable(), RelatoriosClientePage()

### Community 63 - "Community 63"
Cohesion: 0.7
Nodes (4): decodeCursor(), encodeCursor(), normalizeLimit(), paginateFirestoreQuery()

### Community 65 - "Community 65"
Cohesion: 0.7
Nodes (4): createDeps(), createMockDb(), createMockJuditApiKey(), createMockNormalize()

### Community 66 - "Community 66"
Cohesion: 0.7
Nodes (4): classifyRole(), getRoleScoreImpact(), isHighRiskRole(), isLowRiskRole()

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildCaseReportHtml()` connect `Community 13` to `Community 18`, `Community 19`, `Community 36`?**
  _High betweenness centrality (0.283) - this node is a cross-community bridge._
- **Why does `buildCanonicalReportHtml()` connect `Community 18` to `Community 0`, `Community 13`?**
  _High betweenness centrality (0.273) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 24` to `Community 32`, `Community 1`, `Community 36`, `Community 7`, `Community 39`, `Community 41`, `Community 73`, `Community 15`, `Community 48`, `Community 16`, `Community 49`, `Community 17`, `Community 61`, `Community 21`, `Community 23`, `Community 25`, `Community 58`, `Community 29`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Are the 31 inferred relationships involving `useAuth()` (e.g. with `AccessState()` and `ProfileResolutionState()`) actually correct?**
  _`useAuth()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `extractErrorMessage()` (e.g. with `getAuthErrorMessage()` and `getErrorMessage()`) actually correct?**
  _`extractErrorMessage()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `runAutoClassifyAndAi()` (e.g. with `loadEscavadorConfig()` and `buildHomonymAnalysisInput()`) actually correct?**
  _`runAutoClassifyAndAi()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `CasoPage()` (e.g. with `useAuth()` and `useAutoResize()`) actually correct?**
  _`CasoPage()` has 9 INFERRED edges - model-reasoned connections that need verification._