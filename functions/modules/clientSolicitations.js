/**
 * clientSolicitations.js — Handlers para criação de solicitações e correções pelo portal do cliente
 * Extraído do monolito index.js
 */

const { HttpsError } = require('firebase-functions/v2/https');
const {
    validateCpfDigits,
    sanitizeCpf,
    maskCpf,
    formatRequestedBy,
} = require('./_shared/sanitizers');
const { formatDateKey, formatMonthKey } = require('./utilityHelpers');
const { DEFAULT_ANALYSIS_CONFIG } = require('./_shared/analysisConfig');
const {
    buildResetPublishedCaseFields,
    revokeCasePublicationArtifacts,
} = require('./publishAndSync');
const caseCommunication = require('../caseCommunication');

/* =========================================================
   Factory: createClientSolicitationHandler
   ========================================================= */
function createClientSolicitationHandler(deps) {
    const {
        db,
        FieldValue,
        getClientUserProfile,
        getTenantSettingsData,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        notificationService,
        enforceTenantSubmissionLimits,
        compensateTenantSubmissionLimit,
        getClientIp,
        caseComm,
    } = deps;

    return async function (request) {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid, { requireRequester: true });
        const {
            fullName,
            cpf,
            dateOfBirth = '',
            position = '',
            department = '',
            hiringUf = '',
            candidateResidenceUf = '',
            email = '',
            phone = '',
            priority = 'NORMAL',
            digitalProfileNotes = '',
            socialProfiles = {},
            otherSocialUrls = [],
        } = request.data || {};

        const candidateName = String(fullName || '').trim();
        const cpfDigits = sanitizeCpf(cpf);
        if (candidateName.length < 3 || cpfDigits.length !== 11 || !validateCpfDigits(cpfDigits)) {
            throw new HttpsError('invalid-argument', 'Nome completo deve ter no minimo 3 caracteres e CPF valido e obrigatorio.');
        }

        // P2-003: Normaliza campos textuais (trim)
        const trimmedPosition = String(position || '').trim();
        const trimmedDepartment = String(department || '').trim();
        const trimmedEmail = String(email || '').trim();
        const trimmedPhone = String(phone || '').trim();
        const trimmedDob = String(dateOfBirth || '').trim();
        const trimmedHiringUf = String(hiringUf || '').trim().toUpperCase();
        const trimmedResidenceUf = String(candidateResidenceUf || '').trim().toUpperCase();
        const trimmedNotes = String(digitalProfileNotes || '').trim().slice(0, 500);
        const trimmedSocialProfiles = {
            instagram: String(socialProfiles?.instagram || '').trim(),
            facebook: String(socialProfiles?.facebook || '').trim(),
            linkedin: String(socialProfiles?.linkedin || '').trim(),
            tiktok: String(socialProfiles?.tiktok || '').trim(),
            twitter: String(socialProfiles?.twitter || '').trim(),
            youtube: String(socialProfiles?.youtube || '').trim(),
        };

        // Validate UF fields
        const VALID_UFS = new Set(['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']);
        const hiringUfClean = trimmedHiringUf;
        const residenceUfClean = trimmedResidenceUf;
        if (hiringUfClean && !VALID_UFS.has(hiringUfClean)) {
            throw new HttpsError('invalid-argument', `UF de local de trabalho invalida: ${hiringUf}`);
        }
        if (!VALID_UFS.has(residenceUfClean)) {
            throw new HttpsError('invalid-argument', `UF de residencia invalida: ${candidateResidenceUf}`);
        }

        // P1-001: Validate field lengths
        if (candidateName.length > 200) {
            throw new HttpsError('invalid-argument', 'Nome completo deve ter no maximo 200 caracteres.');
        }
        if (trimmedPosition.length > 100) {
            throw new HttpsError('invalid-argument', 'Cargo deve ter no maximo 100 caracteres.');
        }
        if (trimmedDepartment.length > 100) {
            throw new HttpsError('invalid-argument', 'Departamento deve ter no maximo 100 caracteres.');
        }
        if (trimmedNotes.length > 500) {
            throw new HttpsError('invalid-argument', 'Notas devem ter no maximo 500 caracteres.');
        }

        // P1-002: Validate email format
        if (trimmedEmail) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(trimmedEmail)) {
                throw new HttpsError('invalid-argument', 'Formato de e-mail invalido.');
            }
        }

        // P1-003: Validate date of birth format
        if (trimmedDob && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDob)) {
            throw new HttpsError('invalid-argument', 'Data de nascimento deve estar no formato AAAA-MM-DD.');
        }

        // P1-004: Validate social profile URLs
        const urlRegex = /^https?:\/\/.+/;
        for (const [key, url] of Object.entries(trimmedSocialProfiles)) {
            if (url && !urlRegex.test(String(url))) {
                throw new HttpsError('invalid-argument', `URL invalida para ${key}: deve comecar com http:// ou https://`);
            }
        }

        const tenantId = profile.tenantId;
        const tenantName = profile.tenantName || tenantId;
        const tenantData = await getTenantSettingsData(tenantId);
        const analysisConfig = tenantData?.analysisConfig || DEFAULT_ANALYSIS_CONFIG;
        const enabledPhases = Object.entries(analysisConfig)
            .filter(([, value]) => value?.enabled)
            .map(([key]) => key);
        // Fallback: apenas fases habilitadas por padrao (exclui automaticas default-OFF)
        const effectiveEnabledPhases = enabledPhases.length > 0
            ? enabledPhases
            : Object.entries(DEFAULT_ANALYSIS_CONFIG)
                .filter(([, value]) => value?.enabled)
                .map(([key]) => key);
        const creditPhaseEnabled = effectiveEnabledPhases.includes('creditRestriction');
        const tenantSlaHours = Number(tenantData?.slaHours ?? 48);
        const safeSlaHours = Number.isFinite(tenantSlaHours) && tenantSlaHours >= 1 ? tenantSlaHours : 48;

        await enforceTenantSubmissionLimits(tenantId, tenantData || {}, {
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid },
            ip: getClientIp(request),
        });

        const now = new Date();
        const createdDateKey = formatDateKey(now);
        const createdMonthKey = formatMonthKey(now);
        const candidateRef = db.collection('candidates').doc();
        const caseRef = db.collection('cases').doc();

        const batch = db.batch();

        batch.set(candidateRef, {
            tenantId,
            tenantName,
            candidateName,
            cpf: cpfDigits,
            cpfMasked: maskCpf(cpfDigits),
            candidatePosition: trimmedPosition,
            department: trimmedDepartment,
            dateOfBirth: trimmedDob,
            candidateResidenceUf: trimmedResidenceUf,
            email: trimmedEmail,
            phone: trimmedPhone,
            instagram: trimmedSocialProfiles.instagram,
            facebook: trimmedSocialProfiles.facebook,
            linkedin: trimmedSocialProfiles.linkedin,
            tiktok: trimmedSocialProfiles.tiktok,
            twitter: trimmedSocialProfiles.twitter,
            youtube: trimmedSocialProfiles.youtube,
            otherSocialUrls: (Array.isArray(otherSocialUrls) ? otherSocialUrls : [])
                .filter(item => item && typeof item === 'object')
                .map(item => ({
                    label: String(item.label || '').trim().slice(0, 50),
                    url: String(item.url || '').trim().slice(0, 500),
                }))
                .slice(0, 20),
            digitalProfileNotes: trimmedNotes,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        batch.set(caseRef, {
            tenantId,
            tenantName,
            candidateId: candidateRef.id,
            candidateName,
            candidatePosition: trimmedPosition,
            department: trimmedDepartment,
            cpf: cpfDigits,
            cpfMasked: maskCpf(cpfDigits),
            hiringUf: trimmedHiringUf,
            candidateResidenceUf: trimmedResidenceUf,
            priority: priority === 'HIGH' ? 'HIGH' : 'NORMAL',
            requestedBy: formatRequestedBy(profile, uid),
            requestedByName: profile.displayName || null,
            requestedByEmail: profile.email || null,
            enabledPhases: effectiveEnabledPhases,
            socialProfiles: trimmedSocialProfiles,
            otherSocialUrls: (Array.isArray(otherSocialUrls) ? otherSocialUrls : [])
                .filter(item => item && typeof item === 'object')
                .map(item => ({
                    label: String(item.label || '').trim().slice(0, 50),
                    url: String(item.url || '').trim().slice(0, 500),
                }))
                .slice(0, 20),
            dateOfBirth: trimmedDob,
            email: trimmedEmail,
            phone: trimmedPhone,
            clientSubmissionNotes: trimmedNotes,
            status: 'PENDING',
            assigneeId: null,
            slaHours: safeSlaHours,
            criminalFlag: null,
            laborFlag: null,
            laborSeverity: null,
            laborNotes: '',
            warrantFlag: null,
            warrantNotes: '',
            osintLevel: null,
            socialStatus: null,
            digitalFlag: null,
            conflictInterest: null,
            finalVerdict: 'PENDING',
            riskLevel: null,
            riskScore: 0,
            hasNotes: false,
            hasEvidence: false,
            enrichmentStatus: 'PENDING',
            bigdatacorpEnrichmentStatus: 'PENDING',
            juditEnrichmentStatus: 'PENDING',
            escavadorEnrichmentStatus: 'PENDING',
            escavador2EnrichmentStatus: 'PENDING',
            escavador2Error: null,
            djenEnrichmentStatus: 'PENDING',
            // Fase automatica de credito: status so existe quando habilitada no tenant
            // (presenca do campo e o que trava canRunFinalClassification ate settlar)
            ...(creditPhaseEnabled ? { creditEnrichmentStatus: 'PENDING', creditError: null } : {}),
            enrichmentSources: {},
            enrichmentIdentity: null,
            enrichmentGateResult: null,
            enrichedAt: null,
            enrichmentOriginalValues: {},
            aiAnalysis: null,
            aiStatus: null,
            aiCostUsd: null,
            aiModel: null,
            aiTokens: null,
            aiError: null,
            createdDateKey,
            createdMonthKey,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        try {
            await batch.commit();
        } catch (batchErr) {
            await compensateTenantSubmissionLimit(tenantId);
            throw batchErr;
        }

        await writeAuditEvent({
            action: 'SOLICITATION_CREATED',
            tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: caseRef.id, label: candidateName },
            related: { caseId: caseRef.id },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `Nova solicitacao criada para ${candidateName}`,
        });

        try {
            const caseSnapshot = await caseRef.get();
            if (caseSnapshot.exists) {
                await notificationService.createNewSolicitationNotifications(caseRef.id, caseSnapshot.data(), caseComm);
            }
        } catch (err) {
            console.warn('[notifications] failed to create new solicitation notifications', err);
        }

        return {
            caseId: caseRef.id,
            candidateId: candidateRef.id,
        };
    };
}

/* =========================================================
   Factory: submitClientCorrectionHandler
   ========================================================= */
function submitClientCorrectionHandler(deps) {
    const {
        db,
        FieldValue,
        getClientUserProfile,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        getClientIp,
    } = deps;

    return async function (request) {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

        const profile = await getClientUserProfile(uid, { requireRequester: true });
        const {
            caseId,
            candidateName,
            cpf,
            linkedin = '',
            instagram = '',
            facebook = '',
            twitter = '',
            tiktok = '',
            youtube = '',
            otherSocialUrls = [],
        } = request.data || {};
        if (!caseId || !candidateName || !cpf) {
            throw new HttpsError('invalid-argument', 'Dados obrigatorios ausentes para reenviar o caso.');
        }

        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        if (!caseDoc.exists) throw new HttpsError('not-found', 'Caso nao encontrado.');

        const caseData = caseDoc.data() || {};
        if (caseData.tenantId !== profile.tenantId) {
            throw new HttpsError('permission-denied', 'Caso fora do tenant do cliente.');
        }
        if (caseData.status !== 'CORRECTION_NEEDED') {
            throw new HttpsError('failed-precondition', 'Apenas casos com correcao solicitada podem ser reenviados.');
        }

        const cpfDigits = sanitizeCpf(cpf);
        if (cpfDigits.length !== 11 || !validateCpfDigits(cpfDigits)) {
            throw new HttpsError('invalid-argument', 'CPF invalido para reenviar o caso.');
        }

        const corrections = Array.isArray(caseData.corrections) ? caseData.corrections : [];
        const batch = db.batch();

        // AUD-002: Revoke public report when case is corrected/resubmitted
        if (caseData.publicReportToken || caseData.status === 'DONE') {
            await revokeCasePublicationArtifacts(caseId, caseData, db);
        }

        batch.update(caseRef, {
            candidateName: String(candidateName).trim(),
            cpf: cpfDigits,
            cpfMasked: maskCpf(cpfDigits),
            socialProfiles: {
                ...(caseData.socialProfiles || {}),
                linkedin: String(linkedin || ''),
                instagram: String(instagram || ''),
                facebook: String(facebook || ''),
                twitter: String(twitter || ''),
                tiktok: String(tiktok || ''),
                youtube: String(youtube || ''),
            },
            otherSocialUrls: Array.isArray(otherSocialUrls) ? otherSocialUrls : (caseData.otherSocialUrls || []),
            status: 'PENDING',
            // Increment enrichment generation to invalidate stale async callbacks.
            enrichmentGeneration: FieldValue.increment(1),
            // BUG-2 fix: Reset enrichment statuses so the pipeline can re-run.
            // BUG-R1-001 fix: Also reset BigDataCorp so the new CPF/name gets a fresh gate.
            bigdatacorpEnrichmentStatus: 'PENDING',
            bigdatacorpError: null,
            bigdatacorpGateResult: FieldValue.delete(),
            bigdatacorpName: FieldValue.delete(),
            bigdatacorpBirthDate: FieldValue.delete(),
            bigdatacorpCpfStatus: FieldValue.delete(),
            bigdatacorpHasDeathRecord: FieldValue.delete(),
            bigdatacorpProcessTotal: FieldValue.delete(),
            bigdatacorpProcessos: FieldValue.delete(),
            bigdatacorpCriminalFlag: FieldValue.delete(),
            bigdatacorpCriminalCount: FieldValue.delete(),
            bigdatacorpLaborFlag: FieldValue.delete(),
            bigdatacorpLaborCount: FieldValue.delete(),
            bigdatacorpIsPep: FieldValue.delete(),
            bigdatacorpPepLevel: FieldValue.delete(),
            bigdatacorpPepDetails: FieldValue.delete(),
            bigdatacorpIsSanctioned: FieldValue.delete(),
            bigdatacorpWasSanctioned: FieldValue.delete(),
            bigdatacorpHasArrestWarrant: FieldValue.delete(),
            bigdatacorpSanctionCount: FieldValue.delete(),
            bigdatacorpSanctionTypes: FieldValue.delete(),
            bigdatacorpSanctionSources: FieldValue.delete(),
            bigdatacorpSanctionDetails: FieldValue.delete(),
            bigdatacorpActiveWarrants: FieldValue.delete(),
            bigdatacorpProfessionNotes: FieldValue.delete(),
            bigdatacorpKycNotes: FieldValue.delete(),
            bigdatacorpProcessNotes: FieldValue.delete(),
            bigdatacorpNameUniqueness: FieldValue.delete(),
            bigdatacorpSources: FieldValue.delete(),
            bigdatacorpCostBRL: FieldValue.delete(),
            bigdatacorpElapsedMs: FieldValue.delete(),
            bigdatacorpQueryDate: FieldValue.delete(),
            bigdatacorpEnrichedAt: FieldValue.delete(),
            // BUG-R3-005 fix: Reset DJEN so the new CPF/name gets fresh comunicações.
            djenEnrichmentStatus: 'PENDING',
            djenError: null,
            djenComunicacoes: FieldValue.delete(),
            djenSources: FieldValue.delete(),
            djenCostBRL: FieldValue.delete(),
            djenElapsedMs: FieldValue.delete(),
            djenQueryDate: FieldValue.delete(),
            djenEnrichedAt: FieldValue.delete(),
            // Reset downstream providers
            juditEnrichmentStatus: 'PENDING',
            juditError: null,
            juditIdentity: FieldValue.delete(),
            juditGateResult: FieldValue.delete(),
            juditPrimaryUf: FieldValue.delete(),
            juditAllUfs: FieldValue.delete(),
            juditHasLawsuits: FieldValue.delete(),
            juditProcessTotal: FieldValue.delete(),
            juditRoleSummary: FieldValue.delete(),
            juditProcessos: FieldValue.delete(),
            juditCriminalFlag: FieldValue.delete(),
            juditCriminalCount: FieldValue.delete(),
            juditWarrantFlag: FieldValue.delete(),
            juditWarrantNotes: FieldValue.delete(),
            juditWarrants: FieldValue.delete(),
            juditActiveWarrantCount: FieldValue.delete(),
            juditExecutionFlag: FieldValue.delete(),
            juditExecutionCount: FieldValue.delete(),
            juditExecutions: FieldValue.delete(),
            juditExecutionNotes: FieldValue.delete(),
            juditNameSearchFlag: FieldValue.delete(),
            juditNameSearchProcessTotal: FieldValue.delete(),
            juditNameSearchCriminalCount: FieldValue.delete(),
            juditNameSearchCpfsComNome: FieldValue.delete(),
            juditNeedsEscavador: FieldValue.delete(),
            juditNeedsEscavadorReason: FieldValue.delete(),
            juditPendingAsyncPhases: FieldValue.delete(),
            juditPendingAsyncCount: FieldValue.delete(),
            juditRequestIds: FieldValue.delete(),
            juditSources: FieldValue.delete(),
            juditRawPayloads: FieldValue.delete(),
            juditCostBRL: FieldValue.delete(),
            juditEnrichedAt: FieldValue.delete(),
            escavadorEnrichmentStatus: 'PENDING',
            escavadorError: null,
            escavadorProcessTotal: FieldValue.delete(),
            escavadorProcessos: FieldValue.delete(),
            escavadorCriminalFlag: FieldValue.delete(),
            escavadorCriminalCount: FieldValue.delete(),
            escavadorLaborFlag: FieldValue.delete(),
            escavadorLaborCount: FieldValue.delete(),
            escavadorNotes: FieldValue.delete(),
            escavadorCpfsComEsseNome: FieldValue.delete(),
            escavadorSources: FieldValue.delete(),
            escavadorEnrichedAt: FieldValue.delete(),
            escavador2EnrichmentStatus: 'PENDING',
            escavador2Error: null,
            escavador2TaskId: FieldValue.delete(),
            escavador2CallbackStatus: FieldValue.delete(),
            escavador2DedupeDateToleranceDays: FieldValue.delete(),
            escavador2Notes: FieldValue.delete(),
            escavador2ApiStatus: FieldValue.delete(),
            escavador2ProcessTotal: FieldValue.delete(),
            escavador2Processos: FieldValue.delete(),
            escavador2CriminalFlag: FieldValue.delete(),
            escavador2CriminalCount: FieldValue.delete(),
            escavador2LaborFlag: FieldValue.delete(),
            escavador2LaborCount: FieldValue.delete(),
            escavador2MaterialRiskCount: FieldValue.delete(),
            escavador2CnjMaskedCount: FieldValue.delete(),
            escavador2CnjExtractedCount: FieldValue.delete(),
            escavador2DuplicateCount: FieldValue.delete(),
            escavador2NewFindingCount: FieldValue.delete(),
            escavador2HasNewMaterialRisk: FieldValue.delete(),
            escavador2PartialErrors: FieldValue.delete(),
            escavador2Stats: FieldValue.delete(),
            escavador2Sources: FieldValue.delete(),
            escavador2RawPayloads: FieldValue.delete(),
            escavador2CostBRL: FieldValue.delete(),
            escavador2EnrichedAt: FieldValue.delete(),
            // Reset da fase automatica de credito (so quando habilitada no caso).
            // Flag/score/summary/details ja sao removidos pelo buildResetPublishedCaseFields
            // (RESULT_ONLY_FIELDS); aqui resetamos status + campos fora da whitelist.
            ...(Array.isArray(caseData.enabledPhases) && caseData.enabledPhases.includes('creditRestriction') ? {
                creditEnrichmentStatus: 'PENDING',
                creditError: null,
                creditSkippedReason: FieldValue.delete(),
                creditSources: FieldValue.delete(),
                creditCostBRL: FieldValue.delete(),
                creditElapsedMs: FieldValue.delete(),
                creditQueryDate: FieldValue.delete(),
                creditEnrichedAt: FieldValue.delete(),
            } : {}),
            enrichmentStatus: 'PENDING',
            enrichmentError: null,
            enrichmentSources: {},
            enrichmentIdentity: FieldValue.delete(),
            enrichmentGateResult: FieldValue.delete(),
            enrichmentOriginalValues: {},
            enrichedAt: FieldValue.delete(),
            // Clear stale classification and AI data so they don't bleed into re-analysis
            autoClassifiedAt: FieldValue.delete(),
            autoClassifySignature: FieldValue.delete(),
            autoClassifyLock: FieldValue.delete(),
            autoClassifyRerunRequested: FieldValue.delete(),
            criminalFlag: FieldValue.delete(),
            criminalSeverity: FieldValue.delete(),
            criminalEvidenceQuality: FieldValue.delete(),
            criminalNotes: FieldValue.delete(),
            warrantFlag: FieldValue.delete(),
            warrantNotes: FieldValue.delete(),
            laborFlag: FieldValue.delete(),
            laborNotes: FieldValue.delete(),
            coverageLevel: FieldValue.delete(),
            providerDivergence: FieldValue.delete(),
            reviewRecommended: FieldValue.delete(),
            aiRawResponse: FieldValue.delete(),
            aiAnalysis: FieldValue.delete(),
            aiStatus: FieldValue.delete(),
            aiStructured: FieldValue.delete(),
            aiStructuredOk: FieldValue.delete(),
            aiCostUsd: FieldValue.delete(),
            aiTokens: FieldValue.delete(),
            aiExecutedAt: FieldValue.delete(),
            aiProvidersIncluded: FieldValue.delete(),
            aiPromptVersion: FieldValue.delete(),
            aiFromCache: FieldValue.delete(),
            aiError: FieldValue.delete(),
            aiHomonymStructured: FieldValue.delete(),
            aiHomonymStructuredOk: FieldValue.delete(),
            aiHomonymRawResponse: FieldValue.delete(),
            aiHomonymTriggered: FieldValue.delete(),
            aiHomonymDecision: FieldValue.delete(),
            aiHomonymConfidence: FieldValue.delete(),
            aiHomonymRisk: FieldValue.delete(),
            aiHomonymRecommendedAction: FieldValue.delete(),
            aiHomonymCostUsd: FieldValue.delete(),
            aiHomonymTokens: FieldValue.delete(),
            aiHomonymExecutedAt: FieldValue.delete(),
            aiHomonymError: FieldValue.delete(),
            prefillNarratives: FieldValue.delete(),
            deterministicPrefill: FieldValue.delete(),
            negativePartialSafetyNetEligible: FieldValue.delete(),
            negativePartialSafetyNetReasons: FieldValue.delete(),
            negativePartialSafetyNetAction: FieldValue.delete(),
            negativePartialSafetyNetTriggered: FieldValue.delete(),
            riskScore: FieldValue.delete(),
            riskLevel: FieldValue.delete(),
            finalVerdict: FieldValue.delete(),
            ...buildResetPublishedCaseFields(caseData, {
                preserveReviewDraft: true,
            }),
            correctedAt: FieldValue.serverTimestamp(),
            correctedBy: {
                uid,
                email: profile.email || null,
                displayName: profile.displayName || null,
            },
            corrections: [
                ...corrections,
                {
                    submittedAt: new Date().toISOString(),
                    submittedBy: profile.email || uid,
                },
            ],
            updatedAt: FieldValue.serverTimestamp(),
        });

        // AUD-016: Sync corrected data to candidates/{candidateId}
        if (caseData.candidateId) {
            const candidateRef = db.collection('candidates').doc(caseData.candidateId);
            batch.update(candidateRef, {
                candidateName: String(candidateName).trim(),
                cpf: cpfDigits,
                cpfMasked: maskCpf(cpfDigits),
                linkedin: String(linkedin || ''),
                instagram: String(instagram || ''),
                facebook: String(facebook || ''),
                twitter: String(twitter || ''),
                tiktok: String(tiktok || ''),
                youtube: String(youtube || ''),
                otherSocialUrls: Array.isArray(otherSocialUrls) ? otherSocialUrls : (caseData.otherSocialUrls || []),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }

        await batch.commit();

        await writeAuditEvent({
            action: 'CASE_CORRECTED',
            tenantId: profile.tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: profile.email || uid },
            entity: { type: 'CASE', id: caseId, label: String(candidateName).trim() },
            related: { caseId },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
        });

        // Criar mensagem automatica na comunicacao
        try {
            await caseCommunication.createSystemCaseMessage({
                caseId,
                tenantId: caseData.tenantId,
                db,
                systemType: 'CORRECTION_SUBMITTED',
                body: 'O cliente corrigiu os dados e reenviou a analise.',
            });
        } catch (err) {
            console.warn('[communication] failed to create system message for correction submitted', err);
        }

        return { success: true };
    };
}

module.exports = {
    createClientSolicitationHandler,
    submitClientCorrectionHandler,
};
