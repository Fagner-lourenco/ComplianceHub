const { FieldValue } = require('firebase-admin/firestore');
const { getTenantSettingsData, loadEscavadorConfig } = require('./configLoader');
const { runAiHomonymAnalysis, runAiAnalysis, runAiPrefillAnalysis } = require('./aiService');
const {
    buildAiHomonymResetPayload,
    buildAiHomonymUpdatePayload,
    buildAiUpdatePayload,
    buildAiPrefillUpdatePayload,
} = require('../ai/aiPayloadBuilder');
const { buildHomonymAnalysisInput } = require('../helpers/aiHomonym');
const {
    AI_HOMONYM_CONTEXT_VERSION,
    AI_HOMONYM_PROMPT_VERSION,
    AI_PROMPT_VERSION,
    AI_MODEL,
    AI_PREFILL_PROMPT_VERSION,
} = require('../ai/aiConfig');
const { sanitizeAiPrefillStructured } = require('../ai/aiSanitizer');

function evaluateEscavadorNeed(juditResults, juditConfig) {
    const triggers = juditConfig.escalation?.triggerEscavador || ['criminal', 'warrant', 'execution', 'highProcessCount'];
    const threshold = juditConfig.escalation?.processCountThreshold || 5;

    if (triggers.includes('criminal') && juditResults.juditCriminalFlag === 'POSITIVE') return true;
    if (triggers.includes('warrant') && juditResults.juditWarrantFlag === 'POSITIVE') return true;
    if (triggers.includes('execution') && juditResults.juditExecutionFlag === 'POSITIVE') return true;
    if (triggers.includes('highProcessCount') && (juditResults.juditProcessTotal || 0) >= threshold) return true;

    return false;
}

function evaluateNegativePartialSafetyNet(caseData, autoClassification = {}) {
    const escavadorStatus = caseData.escavadorEnrichmentStatus;
    const escavadorAlreadyHandled = ['RUNNING', 'DONE', 'PARTIAL', 'FAILED', 'SKIPPED'].includes(escavadorStatus);
    const criminalFlag = autoClassification.criminalFlag;
    const reasons = [];

    if (!['NEGATIVE_PARTIAL', 'INCONCLUSIVE_LOW_COVERAGE'].includes(criminalFlag)) {
        return { eligible: false, reasons: [], action: 'NONE' };
    }

    if (escavadorAlreadyHandled) {
        return { eligible: false, reasons: [], action: 'NONE' };
    }

    if (autoClassification.coverageLevel === 'LOW_COVERAGE') {
        reasons.push('LOW_COVERAGE');
    }
    if (autoClassification.providerDivergence === 'HIGH') {
        reasons.push('HIGH_PROVIDER_DIVERGENCE');
    }
    if ((caseData.juditProcessTotal || 0) === 0) {
        reasons.push('JUDIT_ZERO_PROCESS');
    }
    if (caseData.juditNameSearchFlag === 'SKIPPED_HOMONYMS') {
        reasons.push('NAME_SEARCH_SKIPPED_HOMONYMS');
    }
    if (caseData.juditNameSearchFlag === 'FOUND') {
        reasons.push('NAME_SEARCH_ONLY_RESULT');
    }
    if (autoClassification.reviewRecommended) {
        reasons.push('MANUAL_REVIEW_RECOMMENDED');
    }

    return {
        eligible: reasons.length > 0,
        reasons,
        action: reasons.length > 0 ? 'RUN_ESCAVADOR' : 'NONE',
    };
}

async function runAutoClassifyAndAi(caseRef, caseId, freshData, deps = {}) {
    const {
        openaiApiKey,
        db,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        buildDeterministicPrefill,
    } = deps;
    const autoClassification = computeAutoClassification(freshData);
    const updatePayload = {};

    if (Object.keys(autoClassification).length > 0) {
        Object.assign(updatePayload, autoClassification);
        console.log(`Case ${caseId} [AutoClassify]: criminal=${autoClassification.criminalFlag}, warrant=${autoClassification.warrantFlag}, labor=${autoClassification.laborFlag}`);
    }

    const tenantId = freshData.tenantId;
    let aiEnabled = false;
    let tenantData = null;
    if (tenantId) {
        try {
            tenantData = await getTenantSettingsData(tenantId);
            if (tenantData) {
                aiEnabled = tenantData.enrichmentConfig?.ai?.enabled === true;

                if (aiEnabled && tenantData.enrichmentConfig?.ai?.monthlyBudgetUsd) {
                    const budget = tenantData.enrichmentConfig.ai.monthlyBudgetUsd;
                    const now = new Date();
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    const costSnapshot = await db.collection('cases')
                        .where('tenantId', '==', tenantId)
                        .where('aiExecutedAt', '>=', monthStart)
                        .select('aiCostUsd', 'aiHomonymCostUsd')
                        .get();
                    let totalCost = 0;
                    costSnapshot.forEach((docSnap) => {
                        totalCost += (docSnap.data().aiCostUsd || 0) + (docSnap.data().aiHomonymCostUsd || 0);
                    });
                    if (totalCost >= budget) {
                        console.warn(`Case ${caseId}: AI budget exceeded ($${totalCost.toFixed(4)} >= $${budget}). Skipping AI.`);
                        updatePayload.aiError = `Budget mensal excedido ($${totalCost.toFixed(4)}/$${budget})`;
                        aiEnabled = false;
                    }
                }
            }
        } catch (err) {
            console.warn(`Case ${caseId}: tenant AI config read failed:`, err.message);
        }
    }

    const safetyNet = evaluateNegativePartialSafetyNet(freshData, autoClassification);
    updatePayload.negativePartialSafetyNetEligible = safetyNet.eligible;
    updatePayload.negativePartialSafetyNetReasons = safetyNet.reasons;
    updatePayload.negativePartialSafetyNetAction = safetyNet.action;
    updatePayload.negativePartialSafetyNetTriggered = false;

    if (tenantId && safetyNet.eligible && !freshData.juditNeedsEscavador) {
        try {
            const escavadorConfig = await loadEscavadorConfig(tenantId);
            if (escavadorConfig.enabled) {
                updatePayload.negativePartialSafetyNetTriggered = true;
                updatePayload.juditNeedsEscavador = true;
                updatePayload.juditNeedsEscavadorReason = 'negative_partial_safety_net';
                updatePayload.aiError = null;

                await caseRef.update({
                    ...updatePayload,
                    autoClassifiedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                await materializeModuleRunsFromCaseRef(caseRef, caseId, freshData);

                console.log(`Case ${caseId} [SafetyNet]: Escavador triggered for ${autoClassification.criminalFlag}. Reasons: ${safetyNet.reasons.join(', ')}`);
                return;
            }
        } catch (err) {
            console.warn(`Case ${caseId} [SafetyNet]: failed to load Escavador config:`, err.message);
        }
    }

    const caseDataForAi = { ...freshData, ...autoClassification, _caseId: caseId };
    const homonymInput = buildHomonymAnalysisInput(caseDataForAi);

    if (homonymInput.needsAnalysis) {
        updatePayload.aiHomonymTriggered = true;
        updatePayload.aiHomonymContextVersion = AI_HOMONYM_CONTEXT_VERSION;
        updatePayload.aiHomonymAmbiguityReasons = homonymInput.ambiguityReasons;
        updatePayload.aiHomonymHardFacts = homonymInput.hardFacts;
        updatePayload.aiHomonymDecision = 'UNCERTAIN';
        updatePayload.aiHomonymConfidence = 'LOW';
        updatePayload.aiHomonymRisk = 'MEDIUM';
        updatePayload.aiHomonymRecommendedAction = 'MANUAL_REVIEW';
    } else {
        Object.assign(updatePayload, buildAiHomonymResetPayload(homonymInput));
    }

    if (aiEnabled) {
        try {
            const aiKey = openaiApiKey.value();
            if (aiKey) {
                if (homonymInput.needsAnalysis) {
                    const homonymResult = await runAiHomonymAnalysis(caseDataForAi, homonymInput, aiKey);
                    Object.assign(updatePayload, buildAiHomonymUpdatePayload(caseDataForAi, homonymInput, homonymResult));
                    Object.assign(caseDataForAi, {
                        aiHomonymTriggered: true,
                        aiHomonymStructured: homonymResult.structured || null,
                        aiHomonymStructuredOk: homonymResult.structuredOk || false,
                        aiHomonymDecision: homonymResult.structured?.decision || null,
                        aiHomonymConfidence: homonymResult.structured?.confidence || null,
                        aiHomonymRisk: homonymResult.structured?.homonymRisk || null,
                        aiHomonymRecommendedAction: homonymResult.structured?.recommendedAction || null,
                    });

                    console.log(`Case ${caseId} [AI_HOMONYM]: ${homonymResult.error ? 'ERROR' : 'OK'} (${homonymResult.fromCache ? 'cached' : 'fresh'}, $${(updatePayload.aiHomonymCostUsd || 0).toFixed(4)}, structured=${homonymResult.structuredOk})`);

                    writeAuditEvent({
                        action: 'AI_HOMONYM_ANALYSIS_RUN',
                        tenantId,
                        actor: { type: ACTOR_TYPE.SYSTEM, id: 'system', email: 'cloud-function' },
                        entity: { type: 'CASE', id: caseId, label: freshData.candidateName || caseId },
                        related: { caseId },
                        source: SOURCE.CLOUD_FUNCTION,
                        metadata: {
                            model: homonymResult.model,
                            tokens: updatePayload.aiHomonymTokens,
                            cost: updatePayload.aiHomonymCostUsd,
                            structuredOk: homonymResult.structuredOk,
                            promptVersion: AI_HOMONYM_PROMPT_VERSION,
                            contextVersion: AI_HOMONYM_CONTEXT_VERSION,
                            decision: homonymResult.structured?.decision || null,
                            confidence: homonymResult.structured?.confidence || null,
                            fromCache: !!homonymResult.fromCache,
                        },
                        templateVars: { candidateName: freshData.candidateName || caseId },
                    }).catch((auditErr) => console.warn('Audit log write failed:', auditErr.message));
                }

                const aiResult = await runAiAnalysis(caseDataForAi, aiKey);
                Object.assign(updatePayload, buildAiUpdatePayload({ ...freshData, ...autoClassification }, aiResult));
                Object.assign(caseDataForAi, {
                    aiStructured: aiResult.structured || null,
                    aiStructuredOk: aiResult.structuredOk || false,
                });
                console.log(`Case ${caseId} [AI]: ${aiResult.error ? 'ERROR' : 'OK'} (${aiResult.fromCache ? 'cached' : 'fresh'}, $${(updatePayload.aiCostUsd || 0).toFixed(4)}, structured=${aiResult.structuredOk})`);

                writeAuditEvent({
                    action: 'AI_ANALYSIS_RUN',
                    tenantId,
                    actor: { type: ACTOR_TYPE.SYSTEM, id: 'system', email: 'cloud-function' },
                    entity: { type: 'CASE', id: caseId, label: freshData.candidateName || caseId },
                    related: { caseId },
                    source: SOURCE.CLOUD_FUNCTION,
                    metadata: {
                        model: aiResult.model,
                        tokens: updatePayload.aiTokens,
                        cost: updatePayload.aiCostUsd,
                        structuredOk: aiResult.structuredOk,
                        promptVersion: AI_PROMPT_VERSION,
                        fromCache: !!aiResult.fromCache,
                    },
                    templateVars: { candidateName: freshData.candidateName || caseId },
                }).catch((auditErr) => console.warn('Audit log write failed:', auditErr.message));

                // P08: Only run prefill if AI general analysis succeeded
                if (aiResult.structuredOk && !aiResult.error) {
                    const prefillResult = await runAiPrefillAnalysis(caseDataForAi, aiKey);
                    Object.assign(updatePayload, buildAiPrefillUpdatePayload(prefillResult));
                    console.log(`Case ${caseId} [AI_PREFILL]: ${prefillResult.error ? 'ERROR' : 'OK'} (${prefillResult.fromCache ? 'cached' : 'fresh'}, structured=${prefillResult.structuredOk})`);
                } else {
                    console.log(`Case ${caseId} [AI_PREFILL]: Skipped — AI general analysis failed or not structured.`);
                    updatePayload.prefillNarratives = {
                        metadata: {
                            model: AI_MODEL,
                            promptVersion: AI_PREFILL_PROMPT_VERSION,
                            executedAt: new Date().toISOString(),
                            ok: false,
                            fromCache: false,
                            error: 'Skipped: AI general analysis failed.',
                        },
                    };
                }
            } else if (homonymInput.needsAnalysis) {
                updatePayload.aiHomonymError = 'Chave OpenAI nao configurada.';
            }
        } catch (aiErr) {
            console.error(`Case ${caseId} [AI]: error:`, aiErr.message);
            updatePayload.aiError = aiErr.message;
            updatePayload.prefillNarratives = {
                metadata: {
                    model: AI_MODEL,
                    promptVersion: AI_PREFILL_PROMPT_VERSION,
                    executedAt: new Date().toISOString(),
                    ok: false,
                    fromCache: false,
                    error: aiErr.message,
                },
            };
            if (homonymInput.needsAnalysis && !updatePayload.aiHomonymError) {
                updatePayload.aiHomonymError = aiErr.message;
            }
        }
    } else {
        if (homonymInput.needsAnalysis && !updatePayload.aiHomonymError) {
            updatePayload.aiHomonymError = updatePayload.aiError || 'IA desabilitada para este tenant.';
        }
        updatePayload.prefillNarratives = {
            metadata: {
                model: AI_MODEL,
                promptVersion: AI_PREFILL_PROMPT_VERSION,
                executedAt: new Date().toISOString(),
                ok: false,
                fromCache: false,
                error: updatePayload.aiError || 'IA desabilitada para este tenant.',
            },
        };
    }

    // Deterministic prefill: generate rich content for all narrative fields
    try {
        const detPrefill = buildDeterministicPrefill(caseDataForAi);
        updatePayload.deterministicPrefill = detPrefill;
        console.log(`Case ${caseId} [DET_PREFILL]: OK (complex=${detPrefill.metadata.isComplex}, triggers=${detPrefill.metadata.triggersActive.length}, keyFindings=${detPrefill.keyFindings.length})`);

        // Merge deterministic into prefillNarratives:
        // v5: ALL 6 fields are deterministic (zero AI narratives)
        const currentPrefill = updatePayload.prefillNarratives || {};
        const aiOk = currentPrefill.metadata?.ok === true;
        const sanitized = sanitizeAiPrefillStructured({
            criminalNotes: detPrefill.criminalNotes,
            laborNotes: detPrefill.laborNotes,
            warrantNotes: detPrefill.warrantNotes,
            keyFindings: detPrefill.keyFindings,
            executiveSummary: detPrefill.executiveSummary,
            finalJustification: detPrefill.finalJustification,
        });
        const mergedPrefill = {
            ...sanitized,
            metadata: {
                ...(currentPrefill.metadata || {}),
                source: 'deterministic',
                deterministicVersion: detPrefill.metadata.version,
                mergedAt: new Date().toISOString(),
            },
        };
        updatePayload.prefillNarratives = mergedPrefill;
        console.log(`Case ${caseId} [PREFILL_MERGE]: source=${mergedPrefill.metadata.source}, aiOk=${aiOk}`);
    } catch (detErr) {
        console.error(`Case ${caseId} [DET_PREFILL]: error:`, detErr.message);
        updatePayload.deterministicPrefill = {
            metadata: {
                source: 'deterministic',
                version: 'v5-deterministic-prefill',
                generatedAt: new Date().toISOString(),
                error: detErr.message,
                triggersActive: [],
                isComplex: false,
            },
        };
    }

    if (Object.keys(updatePayload).length > 0) {
        await caseRef.update({
            ...updatePayload,
            autoClassifiedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        await materializeModuleRunsFromCaseRef(caseRef, caseId, freshData);
    }
}

function computeAutoClassification(caseData) {
    const result = {};
    const enrichmentOriginalValues = caseData.enrichmentOriginalValues || {};
    const criminalNotes = [];
    const warrantNotes = [];
    const laborNotes = [];
    const escavadorFailed = caseData.escavadorEnrichmentStatus === 'FAILED';
    const juditFailed = caseData.juditEnrichmentStatus === 'FAILED';
    const fontedataFailed = caseData.enrichmentStatus === 'FAILED';
    const bigdatacorpDone = caseData.bigdatacorpEnrichmentStatus === 'DONE' || caseData.bigdatacorpEnrichmentStatus === 'PARTIAL';
    const fontedataCriminal = caseData.fontedataCriminalFlag === 'POSITIVE';
    const fontedataLabor = caseData.fontedataLaborFlag === 'POSITIVE';
    const fontedataWarrant = caseData.fontedataWarrantFlag === 'POSITIVE';
    const bigdatacorpCriminal = bigdatacorpDone && caseData.bigdatacorpCriminalFlag === 'POSITIVE';
    const bigdatacorpLabor = bigdatacorpDone && caseData.bigdatacorpLaborFlag === 'POSITIVE';
    const djenDone = caseData.djenEnrichmentStatus === 'DONE';
    const djenCriminal = djenDone && caseData.djenCriminalFlag === 'POSITIVE';
    const djenLabor = djenDone && caseData.djenLaborFlag === true;
    // DJEN searches by name only — unreliable as strong evidence for common names
    const namesakeCount = caseData.bigdatacorpNamesakeCount || 0;
    const djenReliableAsStrongEvidence = namesakeCount <= 10;
    const djenCriminalStrong = djenCriminal && djenReliableAsStrongEvidence;
    const djenCriminalWeak = djenCriminal && !djenReliableAsStrongEvidence;
    const bigdatacorpPep = bigdatacorpDone && caseData.bigdatacorpIsPep === true;
    const bigdatacorpSanctioned = bigdatacorpDone && caseData.bigdatacorpIsSanctioned === true;
    const bigdatacorpWasSanctioned = bigdatacorpDone && caseData.bigdatacorpWasSanctioned === true;
    const juditExecutionPositive = caseData.juditExecutionFlag === 'POSITIVE';
    const homonymInput = buildHomonymAnalysisInput(caseData);
    const coverage = homonymInput.providerCoverage || {};
    const overallCoverage = coverage.overall || {};
    const referenceCandidates = homonymInput.referenceCandidates || [];
    const ambiguousCandidates = homonymInput.ambiguousCandidates || [];
    const hardFacts = new Set(homonymInput.hardFacts || []);
    const coverageReasonLabels = {
        JUDIT_ZERO_ESCAVADOR_FOUND: 'Judit sem retorno processual enquanto Escavador encontrou registros.',
        ESCAVADOR_ZERO_JUDIT_FOUND: 'Escavador sem retorno enquanto Judit encontrou registros.',
        ESCAVADOR_ZERO_BDC_COMPENSATES: 'Escavador sem retorno, porem BigDataCorp confirmou processos — divergencia reduzida.',
        PROCESS_COUNT_DIVERGENCE: 'Quantidade de processos diverge entre os providers.',
        ONLY_WEAK_EVIDENCE: 'Ha apenas evidencias fracas por nome ou identidade parcial.',
        MIXED_STRONG_AND_WEAK_EVIDENCE: 'Ha mistura de evidencia forte com ruido por nome/homonimo.',
        PROVIDER_FAILURE_REDUCES_COVERAGE: 'Falha de provider reduziu a cobertura disponivel.',
        NO_PROCESS_EVIDENCE_RETURNED: 'Nenhum provider retornou processo aproveitavel.',
    };
    const ambiguityReasonLabels = {
        COMMON_NAME_HIGH_POLLUTION: 'Nome muito comum com alta poluicao de CPFs associados.',
        MULTIPLE_CPFS_SAME_NAME: 'Ha multiplos CPFs com o mesmo nome nas fontes consultadas.',
        NAME_BASED_MATCH_PRESENT: 'Parte dos achados veio apenas por nome.',
        DISTANT_GEOGRAPHY_WITHOUT_IDENTITY_LINK: 'Ha processos em geografia distante sem elo identitario forte.',
        CRIMINAL_WEAK_MATCH: 'Existem achados criminais sustentados apenas por match fraco.',
        JUDIT_NAME_SUPPLEMENT_USED: 'A Judit precisou usar suplemento por nome.',
        PROVIDER_DIVERGENCE_WITH_WEAK_MATCH: 'Providers divergem e os achados dependem de evidencia fraca.',
        LOW_PROVIDER_COVERAGE: 'A cobertura geral das fontes ficou reduzida.',
        LIMITED_GEO_PROFILE: 'O perfil geografico do candidato e insuficiente para validar os achados.',
    };
    const coverageNotes = [...new Set((overallCoverage.reasons || []).map((code) => coverageReasonLabels[code] || code))];
    const ambiguityNotes = [...new Set((homonymInput.ambiguityReasons || []).map((code) => ambiguityReasonLabels[code] || code))];

    const pushUnique = (list, message) => {
        if (message && !list.includes(message)) list.push(message);
    };
    const isLaborCandidate = (candidate) => {
        const area = candidate?.area || '';
        // courtType "Trabalh*" is definitive
        if (/trabalh/i.test(candidate?.courtType || '')) return true;
        // "Direito Processual Civil e do Trabalho" is procedural law, NOT a labor case
        if (/processual\s+civil/i.test(area)) return false;
        return /trabalh/i.test(area);
    };
    const protectedLowRiskCnjs = new Set(
        referenceCandidates
            .filter((candidate) => candidate.hasExactCpfMatch && candidate.lowRiskRole && candidate.cnj)
            .map((candidate) => candidate.cnj),
    );
    const isProtectedByLowRisk = (candidate) => Boolean(candidate?.cnj && protectedLowRiskCnjs.has(candidate.cnj));
    const normalizedReferenceCandidates = referenceCandidates.filter(
        (candidate) => !(candidate.hasExactCpfMatch && !candidate.lowRiskRole && isProtectedByLowRisk(candidate)),
    );

    // BUG-9 fix: Deduplicate cross-provider candidates by CNJ.
    // The same lawsuit may appear in both Judit and Escavador; without dedup,
    // strongCriminalCount double-counts it, potentially inflating severity.
    const EVIDENCE_STRENGTH_ORDER = ['HARD_FACT', 'EXACT_CPF_LOW_RISK_ROLE', 'PARTIAL_MATCH', 'WEAK_MATCH', 'DISCARDED_DIFFERENT_CPF'];
    const dedupByCnj = (candidates) => {
        const byCnj = new Map();
        for (const candidate of candidates) {
            const cnj = candidate.cnj;
            if (!cnj) { byCnj.set(`__no_cnj_${byCnj.size}`, candidate); continue; }
            const existing = byCnj.get(cnj);
            if (!existing) { byCnj.set(cnj, candidate); continue; }
            const existingRank = EVIDENCE_STRENGTH_ORDER.indexOf(existing.evidenceStrength);
            const newRank = EVIDENCE_STRENGTH_ORDER.indexOf(candidate.evidenceStrength);
            if (newRank >= 0 && (existingRank < 0 || newRank < existingRank)) {
                byCnj.set(cnj, candidate);
            }
        }
        return [...byCnj.values()];
    };
    const dedupedReferenceCandidates = dedupByCnj(normalizedReferenceCandidates);

    const relevantCriminalCandidates = dedupedReferenceCandidates.filter(
        (candidate) => candidate.isCriminal && !candidate.lowRiskRole,
    );
    const relevantLaborCandidates = dedupedReferenceCandidates.filter(
        (candidate) => isLaborCandidate(candidate) && !candidate.lowRiskRole,
    );
    const lowRiskReferenceCandidates = referenceCandidates.filter(
        (candidate) => candidate.hasExactCpfMatch && (candidate.lowRiskRole || isProtectedByLowRisk(candidate)),
    );
    const lowRiskLaborCandidates = referenceCandidates.filter(
        (candidate) => isLaborCandidate(candidate) && (candidate.lowRiskRole || isProtectedByLowRisk(candidate)),
    );
    const weakCriminalCandidates = ambiguousCandidates.filter((candidate) => candidate.isCriminal);
    const weakLaborCandidates = ambiguousCandidates.filter((candidate) => isLaborCandidate(candidate));
    const strongCriminalSources = [...new Set([
        ...(fontedataCriminal ? ['FonteData'] : []),
        ...(bigdatacorpCriminal ? ['BigDataCorp'] : []),
        ...(djenCriminalStrong ? ['DJEN'] : []),
        ...relevantCriminalCandidates.map((candidate) => candidate.source),
        ...(hardFacts.has('ACTIVE_WARRANT') ? ['Judit/Warrant'] : []),
        ...(hardFacts.has('PENAL_EXECUTION') ? ['Judit/Execution'] : []),
        ...(bigdatacorpSanctioned ? ['BigDataCorp/KYC'] : []),
    ])];
    const strongCriminalCount = relevantCriminalCandidates.length
        + (hardFacts.has('ACTIVE_WARRANT') ? 1 : 0)
        + (hardFacts.has('PENAL_EXECUTION') ? 1 : 0)
        + (fontedataCriminal ? 1 : 0)
        + (djenCriminalStrong ? 1 : 0);
    const hasStrongCriminalEvidence = strongCriminalCount > 0;
    const hasWeakCriminalEvidence = weakCriminalCandidates.length > 0 || djenCriminalWeak;
    const hasLowRiskOnly = lowRiskReferenceCandidates.length > 0
        && relevantCriminalCandidates.length === 0
        && !fontedataCriminal
        && !bigdatacorpCriminal
        && !hardFacts.has('ACTIVE_WARRANT')
        && !hardFacts.has('PENAL_EXECUTION');

    result.coverageLevel = overallCoverage.level || 'LOW_COVERAGE';
    result.coverageNotes = coverageNotes;
    result.providerDivergence = overallCoverage.providerDivergence || 'NONE';
    result.ambiguityNotes = ambiguityNotes;

    if (hasStrongCriminalEvidence) {
        result.criminalFlag = 'POSITIVE';
        result.criminalEvidenceQuality = hasWeakCriminalEvidence ? 'MIXED_STRONG_AND_WEAK' : 'HARD_FACT';
        pushUnique(
            criminalNotes,
            `Criminal POSITIVO: evidencia forte confirmada por ${strongCriminalSources.join(', ')}.`,
        );
        if (hardFacts.has('ACTIVE_WARRANT')) {
            const warrantParts = [];
            if ((caseData.juditActiveWarrantCount || 0) > 0) warrantParts.push(`${caseData.juditActiveWarrantCount} via Judit`);
            const bdcW = Array.isArray(caseData.bigdatacorpActiveWarrants) ? caseData.bigdatacorpActiveWarrants.length : 0;
            if (bdcW > 0) warrantParts.push(`${bdcW} via BigDataCorp`);
            if (caseData.bigdatacorpHasArrestWarrant && bdcW === 0) warrantParts.push('detectado via BigDataCorp');
            pushUnique(criminalNotes, `Mandado ativo confirmado (${warrantParts.join(', ') || 'fonte nao especificada'}).`);
        }
        if (hardFacts.has('PENAL_EXECUTION')) {
            pushUnique(criminalNotes, `Execucao penal positiva confirmada via Judit (${caseData.juditExecutionCount || 0}).`);
        }
        if (hasWeakCriminalEvidence) {
            pushUnique(criminalNotes, `Achados adicionais por nome/match fraco (${weakCriminalCandidates.length}) foram separados como evidencia ambigua e nao rebaixam o fato duro.`);
        }
        if (djenCriminalStrong) {
            pushUnique(criminalNotes, `DJEN: ${caseData.djenCriminalCount || 0} comunicacao(oes) criminal(is) confirmada(s) no Diario de Justica Eletronico.`);
        }
    } else if (hasWeakCriminalEvidence) {
        result.criminalFlag = 'INCONCLUSIVE_HOMONYM';
        result.criminalEvidenceQuality = 'WEAK_NAME_ONLY';
        pushUnique(criminalNotes, `Criminal INCONCLUSIVO por homonimia: ${weakCriminalCandidates.length} achado(s) dependem de nome, identidade fraca ou geografia inconsistente.`);
        if (djenCriminalWeak) {
            pushUnique(criminalNotes, `DJEN: ${caseData.djenCriminalCount || 0} comunicacao(oes) no Diario de Justica Eletronico desconsiderada(s) como evidencia forte — nome com ${namesakeCount} homonimos no Brasil.`);
        }
        ambiguityNotes.forEach((note) => pushUnique(criminalNotes, note));
    } else if (escavadorFailed && juditFailed && fontedataFailed) {
        result.criminalFlag = 'NOT_FOUND';
        result.criminalEvidenceQuality = 'NO_PROVIDER_RESPONSE';
        pushUnique(criminalNotes, 'Criminal NAO ENCONTRADO: todas as fontes falharam e nao houve resposta aproveitavel.');
    } else if (hasLowRiskOnly) {
        result.criminalFlag = 'NEGATIVE';
        result.criminalEvidenceQuality = 'LOW_RISK_ROLE_ONLY';
        pushUnique(criminalNotes, 'Nao ha evidencia criminal relevante; os matches exatos encontrados aparecem apenas em papel de baixo risco, como testemunha/informante.');
    } else if (
        result.coverageLevel === 'LOW_COVERAGE'
        && (result.providerDivergence === 'HIGH' || coverageNotes.length > 0)
    ) {
        result.criminalFlag = 'INCONCLUSIVE_LOW_COVERAGE';
        result.criminalEvidenceQuality = 'LOW_COVERAGE_ONLY';
        pushUnique(criminalNotes, 'Criminal INCONCLUSIVO por baixa cobertura: as fontes nao sustentam leitura negativa forte nem evidenciam fato penal confirmatorio.');
        coverageNotes.forEach((note) => pushUnique(criminalNotes, note));
    } else if (
        escavadorFailed
        || juditFailed
        || fontedataFailed
        || result.coverageLevel !== 'HIGH_COVERAGE'
        || result.providerDivergence !== 'NONE'
    ) {
        result.criminalFlag = 'NEGATIVE_PARTIAL';
        result.criminalEvidenceQuality = 'NEGATIVE_WITH_PARTIAL_COVERAGE';
        pushUnique(criminalNotes, 'Criminal NEGATIVO com cobertura parcial: nao houve indicio penal confirmado, mas a cobertura das fontes nao foi plena.');
        coverageNotes.forEach((note) => pushUnique(criminalNotes, note));
    } else {
        result.criminalFlag = 'NEGATIVE';
        result.criminalEvidenceQuality = 'CONFIRMED_NEGATIVE';
        pushUnique(criminalNotes, 'Nenhum processo criminal/penal relevante foi detectado nas fontes com cobertura satisfatoria.');
    }

    if (result.criminalFlag === 'POSITIVE') {
        if (hardFacts.has('ACTIVE_WARRANT') || hardFacts.has('PENAL_EXECUTION') || strongCriminalCount >= 3) {
            result.criminalSeverity = 'HIGH';
        } else if (strongCriminalCount >= 2 || hasWeakCriminalEvidence) {
            result.criminalSeverity = 'MEDIUM';
        } else {
            result.criminalSeverity = 'LOW';
        }
    }

    const juditWarrantPositive = caseData.juditWarrantFlag === 'POSITIVE';
    const juditWarrantInconclusive = caseData.juditWarrantFlag === 'INCONCLUSIVE';
    const juditActiveWarrants = caseData.juditActiveWarrantCount || 0;
    const juditTotalWarrants = caseData.juditWarrantCount || 0;
    const juditWarrantStatus = caseData.juditSources?.warrant?.status;
    const warrantSourceFailed = caseData.juditSources?.warrant?.error
        || juditWarrantStatus === 'TIMEOUT' || juditWarrantStatus === 'CANCELLED' || juditWarrantStatus === 'FAILED' || juditWarrantStatus === 'ERROR'
        || caseData.enrichmentSources?.warrant?.error;

    const bigdatacorpWarrants = Array.isArray(caseData.bigdatacorpActiveWarrants) ? caseData.bigdatacorpActiveWarrants : [];
    const bigdatacorpHasWarrant = bigdatacorpWarrants.length > 0 || caseData.bigdatacorpHasArrestWarrant === true;

    if (juditWarrantPositive || fontedataWarrant || bigdatacorpHasWarrant) {
        result.warrantFlag = 'POSITIVE';
        const parts = [];
        if (juditActiveWarrants > 0) parts.push(`${juditActiveWarrants} mandado(s) ativo(s) via Judit`);
        if (fontedataWarrant) parts.push('detectado via FonteData');
        if (bigdatacorpWarrants.length > 0) parts.push(`${bigdatacorpWarrants.length} mandado(s) via BigDataCorp`);
        pushUnique(warrantNotes, `Mandado POSITIVO: ${parts.join(', ')}.`);
        if (juditActiveWarrants > 0 && bigdatacorpWarrants.length > 0) {
            pushUnique(warrantNotes, 'Nota: mandados Judit e BigDataCorp podem ter sobreposicao (mesmo mandado em ambas as fontes).');
        }
        if (caseData.juditWarrantNotes && !/aguardando callback/i.test(caseData.juditWarrantNotes)) pushUnique(warrantNotes, caseData.juditWarrantNotes);
    } else if (juditWarrantInconclusive) {
        result.warrantFlag = 'INCONCLUSIVE';
        pushUnique(warrantNotes, `Mandado INCONCLUSIVO: ${juditTotalWarrants} mandado(s) encontrado(s), mas nenhum com status pendente.`);
        if (caseData.juditWarrantNotes && !/aguardando callback/i.test(caseData.juditWarrantNotes)) pushUnique(warrantNotes, caseData.juditWarrantNotes);
    } else if (warrantSourceFailed) {
        result.warrantFlag = 'NOT_FOUND';
        pushUnique(warrantNotes, 'Mandado NAO ENCONTRADO: consulta Judit falhou.');
    } else {
        result.warrantFlag = 'NEGATIVE';
        pushUnique(warrantNotes, 'Nenhum mandado de prisao encontrado.');
    }

    const laborSourceFailed = fontedataFailed && caseData.enrichmentSources?.labor?.error;

    if (fontedataLabor || bigdatacorpLabor || djenLabor || relevantLaborCandidates.length > 0) {
        result.laborFlag = 'POSITIVE';
        const sources = [];
        if (fontedataLabor) sources.push('FonteData TRT');
        if (bigdatacorpLabor) sources.push('BigDataCorp');
        if (djenLabor) sources.push('DJEN');
        if (relevantLaborCandidates.some((candidate) => candidate.source === 'Escavador')) sources.push('Escavador');
        if (relevantLaborCandidates.some((candidate) => candidate.source === 'Judit')) sources.push('Judit');
        if (relevantLaborCandidates.some((candidate) => candidate.source === 'BigDataCorp')) sources.push('BigDataCorp');
        pushUnique(laborNotes, `Trabalhista POSITIVO confirmado por: ${sources.join(', ') || 'processos identificados'}.`);
    } else if (lowRiskLaborCandidates.length > 0) {
        result.laborFlag = 'NEGATIVE';
        pushUnique(laborNotes, 'Processos trabalhistas encontrados apenas em papel de baixo risco, como testemunha; nao ha apontamento trabalhista relevante contra o candidato.');
    } else if (weakLaborCandidates.length > 0) {
        result.laborFlag = 'INCONCLUSIVE';
        pushUnique(laborNotes, 'Achados trabalhistas dependem de match fraco ou nome e permanecem inconclusivos.');
    } else if (laborSourceFailed && relevantLaborCandidates.length === 0) {
        result.laborFlag = 'NOT_FOUND';
        pushUnique(laborNotes, 'Trabalhista NAO ENCONTRADO: consulta FonteData TRT falhou.');
    } else {
        result.laborFlag = 'NEGATIVE';
        pushUnique(laborNotes, 'Nenhum processo trabalhista relevante detectado.');
    }

    result.reviewRecommended = [
        'INCONCLUSIVE_HOMONYM',
        'INCONCLUSIVE_LOW_COVERAGE',
    ].includes(result.criminalFlag) || hasWeakCriminalEvidence;

    // BigDataCorp KYC: PEP and Sanctions as NEW classification dimensions
    if (bigdatacorpPep) {
        result.pepFlag = 'POSITIVE';
        result.pepLevel = caseData.bigdatacorpPepLevel || null;
        result.pepNotes = caseData.bigdatacorpKycNotes || 'PEP detectado via BigDataCorp KYC.';
        result.reviewRecommended = true;
    } else if (bigdatacorpDone) {
        result.pepFlag = 'NEGATIVE';
    }

    if (bigdatacorpSanctioned) {
        result.sanctionFlag = 'POSITIVE';
        result.sanctionSources = caseData.bigdatacorpSanctionSources || [];
        result.sanctionTypes = caseData.bigdatacorpSanctionTypes || [];
        result.sanctionNotes = caseData.bigdatacorpKycNotes || 'Sancao ativa detectada via BigDataCorp KYC.';
        result.reviewRecommended = true;
        // Sanctions with terrorism/corruption/slavery are critical
        if (caseData.bigdatacorpHasTerrorism || caseData.bigdatacorpHasCorruption || caseData.bigdatacorpHasSlaveryCrime) {
            pushUnique(criminalNotes, 'ALERTA CRITICO BigDataCorp KYC: sancao ativa com vinculo a terrorismo, corrupcao ou trabalho escravo.');
        }
        pushUnique(criminalNotes, `Sancao ativa detectada via BigDataCorp KYC: fontes ${(caseData.bigdatacorpSanctionSources || []).join(', ')}.`);
    } else if (bigdatacorpWasSanctioned) {
        result.sanctionFlag = 'HISTORICAL';
        result.sanctionSources = caseData.bigdatacorpSanctionSources || [];
        result.sanctionNotes = 'Historico de sancao detectado (nao ativa) via BigDataCorp KYC.';
        pushUnique(criminalNotes, 'Historico de sancao (nao ativa) detectado via BigDataCorp KYC.');
    } else if (bigdatacorpDone) {
        result.sanctionFlag = 'NEGATIVE';
    }

    result.criminalNotes = criminalNotes.join('\n');
    result.warrantNotes = warrantNotes.join('\n');
    result.laborNotes = laborNotes.join('\n');

    result.enrichmentOriginalValues = {
        ...enrichmentOriginalValues,
        criminalFlag: result.criminalFlag,
        warrantFlag: result.warrantFlag,
        laborFlag: result.laborFlag,
        pepFlag: result.pepFlag || null,
        sanctionFlag: result.sanctionFlag || null,
        coverageLevel: result.coverageLevel,
        coverageNotes: result.coverageNotes,
        providerDivergence: result.providerDivergence,
        ambiguityNotes: result.ambiguityNotes,
        criminalEvidenceQuality: result.criminalEvidenceQuality,
        reviewRecommended: result.reviewRecommended,
        criminalNotes: result.criminalNotes,
        warrantNotes: result.warrantNotes,
        laborNotes: result.laborNotes,
    };
    if (result.criminalSeverity) {
        result.enrichmentOriginalValues.criminalSeverity = result.criminalSeverity;
    }

    if (juditExecutionPositive) {
        result.criminalNotes += `${result.criminalNotes ? '\n' : ''}Execucao penal detectada via Judit (${caseData.juditExecutionCount || 0}).`;
        if (caseData.juditExecutionNotes) result.criminalNotes += `\n${caseData.juditExecutionNotes}`;
        if (result.criminalFlag !== 'POSITIVE') result.criminalFlag = 'POSITIVE';
        if (!result.criminalSeverity) {
            result.criminalSeverity = 'MEDIUM';
        }
        result.enrichmentOriginalValues.criminalFlag = result.criminalFlag;
        result.enrichmentOriginalValues.criminalSeverity = result.criminalSeverity;
        result.enrichmentOriginalValues.criminalNotes = result.criminalNotes;
    }

    return result;
}

module.exports = {
    evaluateEscavadorNeed,
    evaluateNegativePartialSafetyNet,
    runAutoClassifyAndAi,
    computeAutoClassification,
};