const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { computeMissingRequiredPhases } = require('./_shared/analysisConfig');

function createConcludeCaseByAnalystHandler(deps) {
    const {
        db,
        getOpsUserProfile,
        assertOpsCanAccessCase,
        canAssignCases,
        getTenantSettingsData,
        DEFAULT_ANALYSIS_CONFIG,
        pickConcludePayload,
        hasMeaningfulValue,
        validateConcludeFinalFlags,
        resolveNarrativeField,
        buildExecutiveSummaryFallback,
        buildExpandedKeyFindings,
        sanitizeNarrativesForFlags,
        calculateRiskScore,
        sanitizeStructuredList,
        buildSourceSummary,
        buildStatusSummary,
        buildNextSteps,
        buildTimelineEvents,
        buildReportSlug,
        calculateTurnaroundHours,
        buildSanitizedPublicResultSnapshot,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        getClientIp,
        notificationService,
        caseComm,
        canBypassIdentityGate,
        isIdentityGateBlocked,
        canRunFinalClassification,
    } = deps;

    return onCall(
        { region: 'southamerica-east1', timeoutSeconds: 120 , cors: true },
        async (request) => {
            const uid = request.auth?.uid;
            if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

            const profile = await getOpsUserProfile(uid);
            const caseId = String(request.data?.caseId || '').trim();
            const payload = request.data?.payload || {};
            if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

            const caseRef = db.collection('cases').doc(caseId);
            const caseDoc = await caseRef.get();
            if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
            const caseData = caseDoc.data() || {};

            assertOpsCanAccessCase(profile, caseData, caseId);

            // P2-015: Validate assignee — only assignee or manager can conclude
            if (caseData.assigneeId && caseData.assigneeId !== uid && !canAssignCases(profile)) {
                throw new HttpsError('permission-denied', 'Apenas o analista responsavel ou gestor pode concluir este caso.');
            }

            // P2-012: Validate enabledPhases against tenant configuration
            const tenantData = await getTenantSettingsData(caseData.tenantId);
            const tenantAnalysisConfig = tenantData?.analysisConfig || DEFAULT_ANALYSIS_CONFIG;
            const payloadEnabledPhases = Array.isArray(payload.enabledPhases) ? payload.enabledPhases : [];
            if (payloadEnabledPhases.length > 0) {
                // Fases automaticas (creditRestriction) nao sao exigidas: casos criados
                // antes do toggle do tenant nao as tem em enabledPhases
                const missingRequired = computeMissingRequiredPhases(tenantAnalysisConfig, payloadEnabledPhases);
                if (missingRequired.length > 0) {
                    throw new HttpsError('invalid-argument', `enabledPhases deve conter as fases obrigatorias configuradas: ${missingRequired.join(', ')}.`);
                }
            }

            const ALLOWED_CONCLUDE_STATUSES = ['PENDING', 'IN_PROGRESS', 'ANALYSIS_READY'];
            if (!ALLOWED_CONCLUDE_STATUSES.includes(caseData.status)) {
                throw new HttpsError('failed-precondition', `Caso nao pode ser concluido (status: ${caseData.status || 'desconhecido'}).`);
            }

            const readiness = typeof canRunFinalClassification === 'function'
                ? canRunFinalClassification(caseData)
                : { ok: true };
            if (!readiness.ok) {
                throw new HttpsError(
                    'failed-precondition',
                    `Pipeline de enriquecimento ainda nao esta pronto para conclusao (${readiness.reason || 'pendente'}).`,
                );
            }

            const updatePayload = pickConcludePayload(payload, { defaultAnalysisConfig: tenantAnalysisConfig });
            if (!updatePayload.assigneeId) {
                updatePayload.assigneeId = caseData.assigneeId || uid;
            }

            // Validate identity bypass authorization
            if (updatePayload.identityBypassed === true || payload.identityBypassed === true) {
                if (!canBypassIdentityGate(profile)) {
                    throw new HttpsError('permission-denied',
                        'Apenas supervisores ou administradores podem ignorar o gate de identidade.');
                }
                if (!isIdentityGateBlocked(caseData)) {
                    throw new HttpsError('failed-precondition',
                        'O gate de identidade nao esta bloqueado. Nao e necessario bypass.');
                }
                if (!hasMeaningfulValue(updatePayload.identityBypassJustification || payload.identityBypassJustification)) {
                    throw new HttpsError('invalid-argument',
                        'Justificativa obrigatoria ao ignorar o gate de identidade (identityBypassJustification).');
                }
            }

            // BUG-R4-006: Validate field dependencies — severity requires flag, notes require flag.
            const dependencyRules = [
                { field: 'criminalSeverity', requires: 'criminalFlag', message: 'Severidade criminal requer flag criminal.' },
                { field: 'laborSeverity', requires: 'laborFlag', message: 'Severidade trabalhista requer flag trabalhista.' },
                { field: 'criminalNotes', requires: 'criminalFlag', message: 'Notas criminal requerem flag criminal.' },
                { field: 'laborNotes', requires: 'laborFlag', message: 'Notas trabalhista requerem flag trabalhista.' },
                { field: 'warrantNotes', requires: 'warrantFlag', message: 'Notas de mandado requerem flag de mandado.' },
                { field: 'osintVectors', requires: 'osintLevel', message: 'Vetores OSINT requerem nivel OSINT.' },
                { field: 'socialReasons', requires: 'socialStatus', message: 'Razoes social requerem status social.' },
                { field: 'digitalVectors', requires: 'digitalFlag', message: 'Vetores digital requerem flag digital.' },
            ];
            for (const rule of dependencyRules) {
                if (hasMeaningfulValue(updatePayload[rule.field]) && !hasMeaningfulValue(updatePayload[rule.requires])) {
                    throw new HttpsError('invalid-argument', rule.message);
                }
            }

            // BUG-R4-007: analystComment is mandatory for all cases
            if (!hasMeaningfulValue(updatePayload.analystComment)) {
                throw new HttpsError('invalid-argument', 'Justificativa final (analystComment) é obrigatória para conclusão do caso.');
            }

            // Hard facts validation: block conclusion if any provider found active warrants but warrantFlag is unresolved
            // BUG-R4-005: Include BigDataCorp warrants in the validation.
            const juditActiveWarrants = caseData.juditActiveWarrantCount || 0;
            const bdcActiveWarrants = Array.isArray(caseData.bigdatacorpActiveWarrants)
                ? caseData.bigdatacorpActiveWarrants.filter((w) => w?.isActive !== false).length
                : 0;
            const totalActiveWarrants = juditActiveWarrants + bdcActiveWarrants;

            const effectiveWarrantFlag =
                updatePayload.warrantFlag ||
                caseData.reviewDraft?.warrantFlag ||
                caseData.warrantFlag ||
                null;

            if (
                totalActiveWarrants > 0 &&
                !['POSITIVE', 'INCONCLUSIVE'].includes(effectiveWarrantFlag)
            ) {
                throw new HttpsError(
                    'failed-precondition',
                    `Caso possui ${totalActiveWarrants} mandado(s) ativo(s). O campo Mandado de Prisao deve ser POSITIVO ou INCONCLUSIVO para concluir.`,
                );
            }

            // Validate execution penal consistency
            const hasPenalExecution =
                caseData.juditExecutionFlag === 'POSITIVE' ||
                Number(caseData.juditExecutionCount || 0) > 0;

            const effectiveCriminalFlag =
                updatePayload.criminalFlag ||
                caseData.reviewDraft?.criminalFlag ||
                caseData.criminalFlag ||
                null;

            if (
                hasPenalExecution &&
                !['POSITIVE', 'INCONCLUSIVE'].includes(effectiveCriminalFlag)
            ) {
                throw new HttpsError(
                    'failed-precondition',
                    'Caso possui execucao penal positiva. Revise o campo criminal antes de concluir.',
                );
            }

            const conclusionTimestamp = new Date();
            updatePayload.executiveSummary = resolveNarrativeField(caseData, payload, 'executiveSummary', {
                fallbackValue: () => buildExecutiveSummaryFallback({ ...caseData, ...updatePayload }),
            });
            updatePayload.keyFindings = resolveNarrativeField(caseData, payload, 'keyFindings', {
                fallbackValue: () => buildExpandedKeyFindings({ ...caseData, ...updatePayload }, updatePayload),
                defaultValue: [],
            });
            updatePayload.criminalNotes = resolveNarrativeField(caseData, payload, 'criminalNotes');
            updatePayload.laborNotes = resolveNarrativeField(caseData, payload, 'laborNotes');
            updatePayload.warrantNotes = resolveNarrativeField(caseData, payload, 'warrantNotes');
            updatePayload.osintNotes = resolveNarrativeField(caseData, payload, 'osintNotes');
            updatePayload.socialNotes = resolveNarrativeField(caseData, payload, 'socialNotes');
            updatePayload.digitalNotes = resolveNarrativeField(caseData, payload, 'digitalNotes');
            updatePayload.conflictNotes = resolveNarrativeField(caseData, payload, 'conflictNotes');
            updatePayload.analystComment = resolveNarrativeField(caseData, payload, 'analystComment', {
                prefillKey: 'finalJustification',
            });

            const narrativeConsistency = sanitizeNarrativesForFlags({ ...caseData, ...updatePayload }, {
                criminalNotes: updatePayload.criminalNotes,
                laborNotes: updatePayload.laborNotes,
                warrantNotes: updatePayload.warrantNotes,
            });
            updatePayload.criminalNotes = narrativeConsistency.narratives.criminalNotes;
            updatePayload.laborNotes = narrativeConsistency.narratives.laborNotes;
            updatePayload.warrantNotes = narrativeConsistency.narratives.warrantNotes;
            if (narrativeConsistency.warnings.length > 0) {
                updatePayload.narrativeConsistencyWarnings = narrativeConsistency.warnings;
            }

            // Flags/severity: prefer payload, fallback to reviewDraft for fields not sent
            const reviewDraft = caseData?.reviewDraft || {};
            const flagFields = [
                'criminalFlag', 'criminalSeverity', 'laborFlag', 'laborSeverity',
                'warrantFlag', 'osintLevel', 'socialStatus', 'digitalFlag',
                'conflictInterest', 'finalVerdict', 'riskLevel', 'riskScore',
            ];
            for (const ff of flagFields) {
                if (!hasMeaningfulValue(updatePayload[ff]) && hasMeaningfulValue(reviewDraft[ff])) {
                    updatePayload[ff] = reviewDraft[ff];
                }
            }
            validateConcludeFinalFlags(updatePayload);

            // Array fields: prefer payload, fallback to reviewDraft
            const arrayFlagFields = ['osintVectors', 'socialReasons', 'digitalVectors'];
            for (const af of arrayFlagFields) {
                if (!hasMeaningfulValue(updatePayload[af]) && hasMeaningfulValue(reviewDraft[af])) {
                    updatePayload[af] = reviewDraft[af];
                }
            }

            const finalNarrativeConsistency = sanitizeNarrativesForFlags({ ...caseData, ...updatePayload }, {
                criminalNotes: updatePayload.criminalNotes,
                laborNotes: updatePayload.laborNotes,
                warrantNotes: updatePayload.warrantNotes,
            });
            updatePayload.criminalNotes = finalNarrativeConsistency.narratives.criminalNotes;
            updatePayload.laborNotes = finalNarrativeConsistency.narratives.laborNotes;
            updatePayload.warrantNotes = finalNarrativeConsistency.narratives.warrantNotes;
            const allNarrativeWarnings = [
                ...(updatePayload.narrativeConsistencyWarnings || []),
                ...finalNarrativeConsistency.warnings,
            ];
            if (allNarrativeWarnings.length > 0) {
                updatePayload.narrativeConsistencyWarnings = allNarrativeWarnings;
            }

            // P02: Calcular riskScore + riskLevel + suggestedVerdict de forma atômica via módulo compartilhado.
            // Garante consistência: nunca mais riskScore=90 com riskLevel='GREEN'.
            {
                const riskInput = {
                    criminalFlag:     updatePayload.criminalFlag     || caseData.criminalFlag,
                    criminalSeverity: updatePayload.criminalSeverity || caseData.criminalSeverity,
                    laborFlag:        updatePayload.laborFlag        || caseData.laborFlag,
                    warrantFlag:      updatePayload.warrantFlag      || caseData.warrantFlag,
                    osintLevel:       updatePayload.osintLevel       || caseData.osintLevel,
                    socialStatus:     updatePayload.socialStatus     || caseData.socialStatus,
                    digitalFlag:      updatePayload.digitalFlag      || caseData.digitalFlag,
                    conflictInterest: updatePayload.conflictInterest || caseData.conflictInterest,
                    // Campos do pipeline (não editáveis pelo analista)
                    cpfPendingRegularization: caseData.cpfPendingRegularization === true,
                };
                const phases = caseData.enabledPhases || updatePayload.enabledPhases;
                const riskResult = calculateRiskScore(riskInput, phases);
                updatePayload.riskScore      = riskResult.riskScore;
                updatePayload.riskLevel      = riskResult.riskLevel;
                updatePayload.suggestedVerdict = riskResult.suggestedVerdict;
            }

            // P18: Set reportReady based on content validation
            const derivedCaseForPublish = { ...caseData, ...updatePayload, status: 'DONE' };
            updatePayload.sourceSummary = buildSourceSummary(derivedCaseForPublish);
            updatePayload.statusSummary = hasMeaningfulValue(updatePayload.statusSummary)
                ? updatePayload.statusSummary
                : buildStatusSummary(derivedCaseForPublish);
            updatePayload.nextSteps = Array.isArray(updatePayload.nextSteps) && updatePayload.nextSteps.length > 0
                ? sanitizeStructuredList(updatePayload.nextSteps, 6, 220)
                : buildNextSteps(derivedCaseForPublish);
            updatePayload.timelineEvents = buildTimelineEvents(derivedCaseForPublish, {
                concludedAtOverride: conclusionTimestamp,
            });
            updatePayload.reportSlug = hasMeaningfulValue(caseData.reportSlug)
                ? caseData.reportSlug
                : buildReportSlug(caseId, derivedCaseForPublish);
            const turnaroundHours = calculateTurnaroundHours(caseData, conclusionTimestamp);
            if (turnaroundHours != null) {
                updatePayload.turnaroundHours = turnaroundHours;
            }

            const hasMinContent = hasMeaningfulValue(updatePayload.finalVerdict) &&
                (
                    hasMeaningfulValue(updatePayload.executiveSummary)
                    || (Array.isArray(updatePayload.keyFindings) && updatePayload.keyFindings.length > 0)
                    || hasMeaningfulValue(updatePayload.analystComment)
                );
            updatePayload.reportReady = hasMinContent;

            // P3-002: Compute hasNotes server-side — never accept from client payload
            updatePayload.hasNotes = Boolean(
                updatePayload.analystComment || updatePayload.executiveSummary || caseData.clientNotes
            );

            const publicData = buildSanitizedPublicResultSnapshot(caseId, caseData, updatePayload, {
                concludedAtOverride: conclusionTimestamp,
            });
            const publicWritePayload = {
                ...publicData,
                publishedAt: FieldValue.serverTimestamp(),
                concludedAt: publicData.concludedAt || conclusionTimestamp,
            };
            const concludeBatch = db.batch();
            concludeBatch.update(caseRef, updatePayload);
            concludeBatch.set(caseRef.collection('publicResult').doc('latest'), publicWritePayload);
            await concludeBatch.commit();

            await writeAuditEvent({
                action: 'CASE_CONCLUDED',
                tenantId: caseData.tenantId || null,
                actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
                entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                related: { caseId },
                source: SOURCE.PORTAL_OPS,
                ip: getClientIp(request),
                detail: `Caso concluido para ${caseData.candidateName || caseId}`,
            });

                try {
                    const concludedCaseSnap = await caseRef.get();
                    if (concludedCaseSnap.exists) {
                        await notificationService.createCaseCompletedNotifications(caseId, concludedCaseSnap.data(), caseComm);
                    }
                } catch (err) {
                    console.warn('[notifications] failed to create case completed notifications', err);
                }

            return { success: true };
        },
    );
}

function createUpdateTenantSettingsByAnalystHandler(deps) {
    const {
        db,
        getOpsUserProfile,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        getClientIp,
    } = deps;

    return onCall(
        { region: 'southamerica-east1', timeoutSeconds: 60 , cors: true },
        async (request) => {
            const uid = request.auth?.uid;
            if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

            const profile = await getOpsUserProfile(uid);

            // BUG-R2-004: Only admins can update tenant settings. Analysts are read-only.
            if (profile.role !== 'admin' && profile.role !== 'owner') {
                throw new HttpsError('permission-denied', 'Apenas administradores podem alterar configuracoes do tenant.');
            }

            const tenantId = String(request.data?.tenantId || '').trim();
            const analysisConfig = request.data?.analysisConfig || {};
            const limits = request.data?.limits || {};
            const enrichmentConfig = request.data?.enrichmentConfig;

            if (!tenantId) throw new HttpsError('invalid-argument', 'tenantId obrigatorio.');

            // TENANT-SET-002: Validate tenant exists before updating
            const tenantExists = await db.collection('tenantSettings').doc(tenantId).get();
            if (!tenantExists.exists) {
                throw new HttpsError('not-found', `Tenant "${tenantId}" nao encontrado.`);
            }

            // TENANT-SET-004: Validate limits schema
            if (limits.dailyLimit !== null && limits.dailyLimit !== undefined) {
                const daily = Number(limits.dailyLimit);
                if (Number.isNaN(daily) || daily < 0 || !Number.isFinite(daily)) {
                    throw new HttpsError('invalid-argument', 'Limite diario invalido.');
                }
            }
            if (limits.monthlyLimit !== null && limits.monthlyLimit !== undefined) {
                const monthly = Number(limits.monthlyLimit);
                if (Number.isNaN(monthly) || monthly < 0 || !Number.isFinite(monthly)) {
                    throw new HttpsError('invalid-argument', 'Limite mensal invalido.');
                }
            }

            const payload = {
                analysisConfig,
                updatedAt: FieldValue.serverTimestamp(),
                dailyLimit: limits.dailyLimit ?? null,
                monthlyLimit: limits.monthlyLimit ?? null,
                allowDailyExceedance: limits.allowDailyExceedance !== false,
                allowMonthlyExceedance: limits.allowMonthlyExceedance === true,
            };
            if (enrichmentConfig !== undefined) {
                payload.enrichmentConfig = enrichmentConfig;
            }
            if (limits.slaHours !== null && limits.slaHours !== undefined) {
                const sla = Number(limits.slaHours);
                if (Number.isNaN(sla) || sla < 1 || !Number.isFinite(sla)) {
                    throw new HttpsError('invalid-argument', 'SLA invalido. Deve ser um numero positivo de horas.');
                }
                payload.slaHours = sla;
            }

            await db.collection('tenantSettings').doc(tenantId).set(payload, { merge: true });

            await writeAuditEvent({
                action: 'TENANT_CONFIG_UPDATED',
                tenantId,
                actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
                entity: { type: 'SETTINGS', id: tenantId, label: tenantId },
                source: SOURCE.PORTAL_OPS,
                ip: getClientIp(request),
                detail: `Configuracoes atualizadas para ${tenantId}`,
                templateVars: { tenantId },
            });

            return { success: true };
        },
    );
}

function createSaveCaseDraftByAnalystHandler(deps) {
    const {
        db,
        getOpsUserProfile,
        assertOpsCanAccessCase,
        pickDraftPayload,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        getClientIp,
    } = deps;

    return onCall(
        { region: 'southamerica-east1', timeoutSeconds: 60 , cors: true },
        async (request) => {
            const uid = request.auth?.uid;
            if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

            const profile = await getOpsUserProfile(uid);
            const caseId = String(request.data?.caseId || '').trim();
            const payload = request.data?.payload || {};
            if (!caseId) throw new HttpsError('invalid-argument', 'caseId obrigatorio.');

            const caseRef = db.collection('cases').doc(caseId);
            const caseDoc = await caseRef.get();
            if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
            const caseData = caseDoc.data() || {};

            assertOpsCanAccessCase(profile, caseData, caseId);

            if (['DONE', 'CORRECTION_NEEDED', 'WAITING_INFO'].includes(caseData.status)) {
                throw new HttpsError('failed-precondition', 'Nao e possivel salvar rascunho neste status do caso.');
            }
            if (
                caseData.assigneeId &&
                caseData.assigneeId !== uid &&
                !['supervisor', 'admin', 'owner'].includes(profile.role)
            ) {
                throw new HttpsError('permission-denied', 'Caso atribuido a outro analista. Assuma ou redistribua o caso antes de salvar rascunho.');
            }

            const updatePayload = pickDraftPayload(payload, caseData.reviewDraft || {});
            await caseRef.update(updatePayload);

            await writeAuditEvent({
                action: 'CASE_DRAFT_SAVED',
                tenantId: caseData.tenantId || null,
                actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
                entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                related: { caseId },
                source: SOURCE.PORTAL_OPS,
                ip: getClientIp(request),
                detail: `Rascunho salvo para ${caseData.candidateName || caseId}`,
            });

            return { success: true };
        },
    );
}

function createSetAiDecisionByAnalystHandler(deps) {
    const {
        db,
        getOpsUserProfile,
        assertOpsCanAccessCase,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        getClientIp,
    } = deps;

    return onCall(
        { region: 'southamerica-east1', timeoutSeconds: 60 , cors: true },
        async (request) => {
            const uid = request.auth?.uid;
            if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

            const profile = await getOpsUserProfile(uid);
            const caseId = String(request.data?.caseId || '').trim();
            const decision = String(request.data?.decision || '').trim();
            const allowedDecisions = new Set(['ACCEPTED', 'ADJUSTED', 'IGNORED']);

            if (!caseId || !allowedDecisions.has(decision)) {
                throw new HttpsError('invalid-argument', 'caseId e aiDecision validos sao obrigatorios.');
            }

            const caseRef = db.collection('cases').doc(caseId);
            const caseDoc = await caseRef.get();
            if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');
            const caseData = caseDoc.data() || {};
            assertOpsCanAccessCase(profile, caseData, caseId);

            // BUG-R4-002: When accepting AI suggestion, also persist the score and verdict.
            const updateFields = {
                aiDecision: decision,
                updatedAt: FieldValue.serverTimestamp(),
            };
            if (decision === 'ACCEPTED' && caseData.aiStructured) {
                const ai = caseData.aiStructured;
                if (typeof ai.sugestaoScore === 'number') {
                    updateFields.aiAcceptedScore = ai.sugestaoScore;
                }
                if (ai.sugestaoVeredito) {
                    updateFields.aiAcceptedVeredito = ai.sugestaoVeredito;
                }
            }
            await caseRef.update(updateFields);

            await writeAuditEvent({
                action: 'AI_DECISION_SET',
                tenantId: caseData.tenantId || null,
                actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: profile.email || uid },
                entity: { type: 'CASE', id: caseId, label: caseData.candidateName || caseId },
                related: { caseId },
                source: SOURCE.PORTAL_OPS,
                ip: getClientIp(request),
                detail: `Decisao IA atualizada para ${decision} em ${caseData.candidateName || caseId}`,
                templateVars: { decision },
            });

            return { success: true };
        },
    );
}

module.exports = {
    createConcludeCaseByAnalystHandler,
    createUpdateTenantSettingsByAnalystHandler,
    createSaveCaseDraftByAnalystHandler,
    createSetAiDecisionByAnalystHandler,
};
