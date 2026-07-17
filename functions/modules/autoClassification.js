/**
 * autoClassification.js — Módulo de auto-classificação e análise AI
 * Extraído do monolito index.js durante refatoração Phase C
 */

const { buildHomonymAnalysisInput } = require('../helpers/aiHomonym');
const { filterDjenComunicacoesByConfirmedProcess } = require('../helpers/reportHelpers');
const { classifyCriminalMateriality } = require('../helpers/criminalMateriality');
const { SAFE_NARRATIVE_TEXTS } = require('./reportEngine');
const { isAiEnabledForTenant: isAiEnabledForTenantHelper } = require('./_shared/aiEnabledHelper');

/* =========================================================
   LÓGICA PURA: Classificação automática
   ========================================================= */

function hasPendingJuditAsync(caseData = {}) {
    const count = Number(caseData.juditPendingAsyncCount || 0);
    const phases = Array.isArray(caseData.juditPendingAsyncPhases)
        ? caseData.juditPendingAsyncPhases.filter(Boolean)
        : [];
    return count > 0 || phases.length > 0;
}

function isProviderTerminalForPipeline(status) {
    return ['DONE', 'PARTIAL', 'FAILED', 'SKIPPED', 'BLOCKED'].includes(status);
}

function canRunFinalClassification(caseData = {}, { hasPendingJuditAsync: hasPendingJuditAsyncArg, isProviderTerminalForPipeline: isProviderTerminalForPipelineArg } = {}) {
    const hasPendingJuditAsyncFn = hasPendingJuditAsyncArg || hasPendingJuditAsync;
    const isProviderTerminalForPipelineFn = isProviderTerminalForPipelineArg || isProviderTerminalForPipeline;
    if (hasPendingJuditAsyncFn(caseData)) {
        return { ok: false, reason: 'judit_async_pending' };
    }

    if (!isProviderTerminalForPipelineFn(caseData.bigdatacorpEnrichmentStatus)) {
        return { ok: false, reason: `bigdatacorp_${caseData.bigdatacorpEnrichmentStatus || 'PENDING'}` };
    }

    if (!isProviderTerminalForPipelineFn(caseData.juditEnrichmentStatus)) {
        return { ok: false, reason: `judit_${caseData.juditEnrichmentStatus || 'PENDING'}` };
    }

    if (caseData.juditNeedsEscavador === true && !isProviderTerminalForPipelineFn(caseData.escavadorEnrichmentStatus)) {
        return { ok: false, reason: `escavador_${caseData.escavadorEnrichmentStatus || 'PENDING'}` };
    }

    // DJEN/DPJe must settle if it was started/pending, but SKIPPED/FAILED is fine
    if (caseData.djenEnrichmentStatus && !isProviderTerminalForPipelineFn(caseData.djenEnrichmentStatus)) {
        return { ok: false, reason: `djen_${caseData.djenEnrichmentStatus}` };
    }

    if (caseData.escavador2EnrichmentStatus && !isProviderTerminalForPipelineFn(caseData.escavador2EnrichmentStatus)) {
        return { ok: false, reason: `escavador2_${caseData.escavador2EnrichmentStatus}` };
    }

    return { ok: true, reason: 'ready' };
}

function computeAutoClassifySignature(caseData = {}, { computeSimpleHash } = {}) {
    const signatureFields = [
        'enrichmentGeneration',
        'bigdatacorpEnrichmentStatus',
        'bigdatacorpProcessTotal',
        'bigdatacorpCriminalCount',
        'bigdatacorpLaborCount',
        'bigdatacorpHasArrestWarrant',
        'bigdatacorpIsPep',
        'bigdatacorpIsSanctioned',
        'bigdatacorpWasSanctioned',
        'juditEnrichmentStatus',
        'juditProcessTotal',
        'juditCriminalCount',
        'juditActiveWarrantCount',
        'juditExecutionFlag',
        'juditNeedsEscavador',
        'escavadorEnrichmentStatus',
        'escavadorProcessTotal',
        'escavadorCriminalCount',
        'djenEnrichmentStatus',
        'djenCriminalFlag',
        'djenLaborFlag',
        'escavador2EnrichmentStatus',
        'escavador2ProcessTotal',
        'escavador2CriminalCount',
        'escavador2LaborCount',
        'escavador2NewFindingCount',
        'escavador2DuplicateCount',
        'escavador2HasNewMaterialRisk',
        'enrichmentStatus',
        'fontedataCriminalFlag',
        'fontedataWarrantFlag',
        'fontedataLaborFlag',
    ];
    const signature = {};
    for (const field of signatureFields) {
        const value = caseData[field];
        if (value !== undefined) signature[field] = value;
    }
    signature.juditPendingAsyncPhases = Array.isArray(caseData.juditPendingAsyncPhases)
        ? [...caseData.juditPendingAsyncPhases].sort()
        : [];
    signature.bigdatacorpActiveWarrants = Array.isArray(caseData.bigdatacorpActiveWarrants)
        ? caseData.bigdatacorpActiveWarrants.map((item) => item?.numero || item?.number || item?.id || item?.status || '').sort()
        : [];
    signature.escavador2NewFindingsDigest = (Array.isArray(caseData.escavador2Processos) ? caseData.escavador2Processos : [])
        .filter((item) => item?.isNewEscavador2Finding === true)
        .map((item) => ({
            cnj: item.numeroCnj || item.numeroCnjMascarado || null,
            criminal: item.isCriminal === true,
            labor: item.isLabor === true,
            defendant: item.isDefendant === true,
            plaintiff: item.isPlaintiff === true,
            victim: item.isVictim === true,
            witness: item.isWitness === true,
            materialRisk: item.isMaterialRisk === true,
            exactCpfMatch: item.hasExactCpfMatch === true,
            excludedCrimeType: item.isExcludedCrimeType || null,
        }))
        .sort((a, b) => String(a.cnj).localeCompare(String(b.cnj)));
    return computeSimpleHash(JSON.stringify(signature));
}

function computeAutoClassification(caseData, {
    buildHomonymAnalysisInput: buildHomonymAnalysisInputArg,
    filterDjenComunicacoesByConfirmedProcess: filterDjenComunicacoesByConfirmedProcessArg,
    SAFE_NARRATIVE_TEXTS: safeNarrativeTextsArg,
} = {}) {
    const buildHomonymAnalysisInputFn = buildHomonymAnalysisInputArg || buildHomonymAnalysisInput;
    const filterDjenComunicacoesByConfirmedProcessFn = filterDjenComunicacoesByConfirmedProcessArg || filterDjenComunicacoesByConfirmedProcess;
    const SAFE_NARRATIVE_TEXTS_FN = safeNarrativeTextsArg || SAFE_NARRATIVE_TEXTS;
    const result = {};
    const enrichmentOriginalValues = caseData.enrichmentOriginalValues || {};
    const criminalNotes = [];
    const warrantNotes = [];
    const laborNotes = [];
    const escavadorFailed = caseData.escavadorEnrichmentStatus === 'FAILED';
    const juditFailed = caseData.juditEnrichmentStatus === 'FAILED';
    const fontedataFailed = caseData.enrichmentStatus === 'FAILED';
    const bigdatacorpDone = caseData.bigdatacorpEnrichmentStatus === 'DONE' || caseData.bigdatacorpEnrichmentStatus === 'PARTIAL';
    const bigdatacorpHasKycData = bigdatacorpDone || (
        caseData.bigdatacorpEnrichmentStatus === 'BLOCKED' &&
        (
            caseData.bigdatacorpIsPep === true ||
            caseData.bigdatacorpIsSanctioned === true ||
            caseData.bigdatacorpWasSanctioned === true
        )
    );
    const fontedataCriminal = caseData.fontedataCriminalFlag === 'POSITIVE';
    const fontedataLabor = caseData.fontedataLaborFlag === 'POSITIVE';
    const fontedataWarrant = caseData.fontedataWarrantFlag === 'POSITIVE';
    const bigdatacorpCriminalSignal = bigdatacorpDone && caseData.bigdatacorpCriminalFlag === 'POSITIVE';
    const bigdatacorpLaborSignal = bigdatacorpDone && caseData.bigdatacorpLaborFlag === 'POSITIVE';
    const djenDone = caseData.djenEnrichmentStatus === 'DONE';
    const djenConfirmedCriminalItems = djenDone ? filterDjenComunicacoesByConfirmedProcessFn(caseData, 'criminal') : [];
    const djenConfirmedLaborItems = djenDone ? filterDjenComunicacoesByConfirmedProcessFn(caseData, 'labor') : [];
    const djenCriminalStrong = caseData.djenCriminalFlag === 'POSITIVE' && djenConfirmedCriminalItems.length > 0;
    const djenCriminalWeak = false;
    const djenLaborStrong = (caseData.djenLaborFlag === true || caseData.djenLaborFlag === 'POSITIVE') && djenConfirmedLaborItems.length > 0;
    const djenLaborWeak = false;
    const pushUnique = (list, message) => {
        if (message && !list.includes(message)) list.push(message);
    };
    const escavador2Done = ['DONE', 'PARTIAL'].includes(caseData.escavador2EnrichmentStatus);
    const escavador2Processos = Array.isArray(caseData.escavador2Processos) ? caseData.escavador2Processos : [];
    const escavador2NewProcesses = escavador2Done ? escavador2Processos.filter((p) => p.isNewEscavador2Finding === true) : [];

    const escavador2NewCriminalCount = escavador2NewProcesses.filter((p) => p.isCriminal === true).length;
    const escavador2NewMaterialCriminalCount = escavador2NewProcesses.filter((p) => classifyCriminalMateriality(p).isMaterial).length;
    const escavador2NewLaborCount = escavador2NewProcesses.filter((p) => p.isLabor === true).length;
    const escavador2NewPlaintiffLaborCount = escavador2NewProcesses.filter((p) =>
        p.isLabor === true && p.isPlaintiff === true && p.hasExactCpfMatch === true
    ).length;

    if (escavador2NewMaterialCriminalCount > 0) {
        pushUnique(criminalNotes, `Nova consulta processual identificou ${escavador2NewMaterialCriminalCount} processo(s) criminal(is) material(is) nao identificado(s) pelos demais provedores.`);
    } else if (escavador2NewCriminalCount > 0) {
        pushUnique(criminalNotes, `Nova consulta processual identificou ${escavador2NewCriminalCount} processo(s) criminal(is) novo(s), sem papel material confirmatorio.`);
    }
    if (escavador2NewLaborCount > 0) {
        pushUnique(laborNotes, `Nova consulta processual identificou ${escavador2NewLaborCount} processo(s) trabalhista(s) ativo(s) nao identificado(s) pelos demais provedores.`);
    }
    const namesakeCount = caseData.bigdatacorpNamesakeCount || 0;
    const bigdatacorpPep = bigdatacorpHasKycData && caseData.bigdatacorpIsPep === true;
    const bigdatacorpSanctioned = bigdatacorpHasKycData && caseData.bigdatacorpIsSanctioned === true;
    const bigdatacorpWasSanctioned = bigdatacorpHasKycData && caseData.bigdatacorpWasSanctioned === true;
    const juditExecutionPositive = caseData.juditExecutionFlag === 'POSITIVE';
    const homonymInput = buildHomonymAnalysisInputFn(caseData);
    const coverage = homonymInput.providerCoverage || {};
    const overallCoverage = coverage.overall || {};
    const coverageReasonCodes = overallCoverage.reasons || [];
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

    const relevantCriminalCandidates = dedupedReferenceCandidates.filter((candidate) => {
        if (!candidate.isCriminal) return false;
        // CPF divergente = comprovadamente de homonimo; nao pode puxar POSITIVO.
        if (candidate.evidenceStrength === 'DISCARDED_DIFFERENT_CPF') return false;
        return classifyCriminalMateriality(candidate).isMaterial;
    });
    const attentionCriminalCandidates = dedupedReferenceCandidates.filter((candidate) => {
        if (!candidate.isCriminal) return false;
        // CPF divergente = comprovadamente de homonimo; nao pode puxar INCONCLUSIVE.
        if (candidate.evidenceStrength === 'DISCARDED_DIFFERENT_CPF') return false;
        const materiality = classifyCriminalMateriality(candidate);
        return materiality.requiresAttention === true && materiality.isMaterial !== true;
    });
    const relevantLaborCandidates = dedupedReferenceCandidates.filter(
        (candidate) => isLaborCandidate(candidate) && !candidate.lowRiskRole && candidate.roleClassification?.category === 'PLAINTIFF',
    );
    const defendantLaborCandidates = dedupedReferenceCandidates.filter(
        (candidate) => isLaborCandidate(candidate) && candidate.roleClassification?.category === 'DEFENDANT',
    );
    const lowRiskReferenceCandidates = referenceCandidates.filter(
        (candidate) => candidate.hasExactCpfMatch && (candidate.lowRiskRole || isProtectedByLowRisk(candidate)),
    );
    const lowRiskLaborCandidates = referenceCandidates.filter(
        (candidate) => isLaborCandidate(candidate) && (candidate.lowRiskRole || candidate.roleClassification?.category === 'DEFENDANT' || isProtectedByLowRisk(candidate)),
    );
    const weakCriminalCandidates = ambiguousCandidates.filter((candidate) => candidate.isCriminal);
    const weakLaborCandidates = ambiguousCandidates.filter((candidate) => isLaborCandidate(candidate));
    const hasBigDataCorpProcessDetails = Array.isArray(caseData.bigdatacorpProcessos) && caseData.bigdatacorpProcessos.length > 0;
    const bigdatacorpCriminal = bigdatacorpCriminalSignal && (
        !hasBigDataCorpProcessDetails || relevantCriminalCandidates.some((candidate) => candidate.source === 'BigDataCorp')
    );
    const bigdatacorpLabor = bigdatacorpLaborSignal && (
        !hasBigDataCorpProcessDetails || relevantLaborCandidates.some((candidate) => candidate.source === 'BigDataCorp')
    );
    const strongCriminalSources = [...new Set([
        ...(fontedataCriminal ? ['FonteData'] : []),
        ...(bigdatacorpCriminal ? ['BigDataCorp'] : []),
        ...(djenCriminalStrong ? ['DJEN'] : []),
        ...(escavador2NewMaterialCriminalCount > 0 ? ['Escavador2'] : []),
        ...relevantCriminalCandidates.map((candidate) => candidate.source),
        ...(hardFacts.has('ACTIVE_WARRANT') ? ['Judit/Warrant'] : []),
        ...(hardFacts.has('PENAL_EXECUTION') ? ['Judit/Execution'] : []),
        ...(bigdatacorpSanctioned ? ['BigDataCorp/KYC'] : []),
    ])];
    const strongCriminalCount = relevantCriminalCandidates.length
        + (hardFacts.has('ACTIVE_WARRANT') ? 1 : 0)
        + (hardFacts.has('PENAL_EXECUTION') ? 1 : 0)
        + (fontedataCriminal ? 1 : 0)
        + (djenCriminalStrong ? 1 : 0)
        + escavador2NewMaterialCriminalCount;
    const hasStrongCriminalEvidence = strongCriminalCount > 0;
    const hasWeakCriminalEvidence = weakCriminalCandidates.length > 0 || djenCriminalWeak;
    const hasLowRiskOnly = lowRiskReferenceCandidates.length > 0
        && relevantCriminalCandidates.length === 0
        && !fontedataCriminal
        && !bigdatacorpCriminal
        && !hardFacts.has('ACTIVE_WARRANT')
        && !hardFacts.has('PENAL_EXECUTION');
    const onlyNoProcessEvidenceReturned = coverageReasonCodes.length > 0
        && coverageReasonCodes.every((code) => code === 'NO_PROCESS_EVIDENCE_RETURNED');
    const providerFailureReducesCoverage = coverageReasonCodes.includes('PROVIDER_FAILURE_REDUCES_COVERAGE')
        || caseData.bigdatacorpEnrichmentStatus === 'FAILED';
    const providerPendingReducesCoverage = [
        caseData.juditEnrichmentStatus,
        caseData.escavadorEnrichmentStatus,
        caseData.bigdatacorpEnrichmentStatus,
    ].some((status) => status === 'PENDING' || status === 'RUNNING');

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
        result.criminalFlag = 'INCONCLUSIVE';
        result.criminalEvidenceQuality = 'WEAK_NAME_ONLY';
        pushUnique(criminalNotes, `Criminal INCONCLUSIVO por homonimia: ${weakCriminalCandidates.length} achado(s) dependem de nome, identidade fraca ou geografia inconsistente.`);
        if (djenCriminalWeak) {
            pushUnique(criminalNotes, `DJEN: ${caseData.djenCriminalCount || 0} comunicacao(oes) no Diario de Justica Eletronico desconsiderada(s) como evidencia forte — nome com ${namesakeCount} homonimos no Brasil.`);
        }
        ambiguityNotes.forEach((note) => pushUnique(criminalNotes, note));
    } else if (attentionCriminalCandidates.length > 0) {
        result.criminalFlag = 'INCONCLUSIVE';
        result.criminalEvidenceQuality = 'NEUTRAL_ROLE_REVIEW';
        pushUnique(criminalNotes, `Criminal INCONCLUSIVO: ${attentionCriminalCandidates.length} achado(s) criminal(is) com CPF confirmado exigem revisao do papel processual antes da conclusao.`);
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
        && !onlyNoProcessEvidenceReturned
        && (result.providerDivergence === 'HIGH' || coverageNotes.length > 0)
    ) {
        result.criminalFlag = 'INCONCLUSIVE';
        result.criminalEvidenceQuality = 'LOW_COVERAGE_ONLY';
        pushUnique(criminalNotes, 'Criminal INCONCLUSIVO por baixa cobertura: as fontes nao sustentam leitura negativa forte nem evidenciam fato penal confirmatorio.');
        coverageNotes.forEach((note) => pushUnique(criminalNotes, note));
    } else if (onlyNoProcessEvidenceReturned && !providerFailureReducesCoverage && !providerPendingReducesCoverage && result.providerDivergence === 'NONE') {
        result.criminalFlag = 'NEGATIVE';
        result.criminalEvidenceQuality = 'CONFIRMED_NEGATIVE';
        pushUnique(criminalNotes, 'Criminal SEM APONTAMENTO: as fontes concluidas nao retornaram processos criminais aproveitaveis para o CPF/candidato.');
    } else if (
        escavadorFailed
        || juditFailed
        || fontedataFailed
        || providerFailureReducesCoverage
        || providerPendingReducesCoverage
        || result.coverageLevel !== 'HIGH_COVERAGE'
        || result.providerDivergence !== 'NONE'
    ) {
        result.criminalFlag = 'NEGATIVE';
        result.criminalEvidenceQuality = 'NEGATIVE_WITH_PARTIAL_COVERAGE';
        pushUnique(criminalNotes, 'Criminal SEM APONTAMENTO: nao houve indicio penal confirmado; a cobertura das fontes nao foi plena.');
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

    if (fontedataLabor || bigdatacorpLabor || djenLaborStrong || relevantLaborCandidates.length > 0 || escavador2NewPlaintiffLaborCount > 0) {
        result.laborFlag = 'POSITIVE';
        const sources = [];
        if (fontedataLabor) sources.push('FonteData TRT');
        if (bigdatacorpLabor) sources.push('BigDataCorp');
        if (djenLaborStrong) sources.push('DJEN (forte)');
        if (escavador2NewPlaintiffLaborCount > 0) sources.push('Escavador2');
        if (relevantLaborCandidates.some((candidate) => candidate.source === 'Escavador')) sources.push('Escavador');
        if (relevantLaborCandidates.some((candidate) => candidate.source === 'Judit')) sources.push('Judit');
        if (relevantLaborCandidates.some((candidate) => candidate.source === 'BigDataCorp')) sources.push('BigDataCorp');
        pushUnique(laborNotes, `Trabalhista POSITIVO confirmado por: ${sources.join(', ') || 'processos identificados'}.`);
    } else if (djenLaborWeak) {
        result.laborFlag = 'INCONCLUSIVE';
        pushUnique(laborNotes, 'Achados trabalhistas no DJEN/DPJe dependem de nome comum sem confirmacao forte de identidade. Revisao manual recomendada.');
    } else if (lowRiskLaborCandidates.length > 0) {
        result.laborFlag = 'NEGATIVE';
        const defendantCount = defendantLaborCandidates.length;
        if (defendantCount > 0) {
            pushUnique(laborNotes, `Processos trabalhistas encontrados como REU/RECLAMADO (${defendantCount}) — baixo risco para contratacao (foi processado, nao processou). Nenhum apontamento como autor/reclamante.`);
        } else {
            pushUnique(laborNotes, 'Processos trabalhistas encontrados apenas em papel de baixo risco, como testemunha; nao ha apontamento trabalhista relevante contra o candidato.');
        }
    } else if (weakLaborCandidates.length > 0) {
        result.laborFlag = 'INCONCLUSIVE';
        pushUnique(laborNotes, 'Achados trabalhistas dependem de match fraco ou nome e permanecem inconclusivos.');
    } else if (laborSourceFailed && relevantLaborCandidates.length === 0) {
        result.laborFlag = 'NOT_FOUND';
        pushUnique(laborNotes, 'Trabalhista NAO ENCONTRADO: consulta FonteData TRT falhou.');
    } else {
        result.laborFlag = 'NEGATIVE';
        pushUnique(laborNotes, SAFE_NARRATIVE_TEXTS_FN.laborNegative);
    }

    result.reviewRecommended = hasWeakCriminalEvidence
        || ['WEAK_NAME_ONLY', 'LOW_COVERAGE_ONLY', 'NEUTRAL_ROLE_REVIEW'].includes(result.criminalEvidenceQuality)
        || result.providerDivergence === 'HIGH';

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

    // P2-011: CPF pendente de regularizacao — atencao cadastral, nao bloqueio
    const cpfPending = caseData.enrichmentGateResult?.cpfPendingRegularization === true
        || caseData.bigdatacorpGateResult?.cpfPendingRegularization === true
        || caseData.juditGateResult?.cpfPendingRegularization === true;
    if (cpfPending) {
        result.cpfPendingRegularization = true;
        result.cpfPendingNotes = 'CPF com situacao cadastral pendente de regularizacao na Receita Federal.';
        pushUnique(criminalNotes, result.cpfPendingNotes);
        result.criminalNotes = criminalNotes.join('\n');
        result.enrichmentOriginalValues.criminalNotes = result.criminalNotes;
        result.enrichmentOriginalValues.cpfPendingRegularization = true;
        result.enrichmentOriginalValues.cpfPendingNotes = result.cpfPendingNotes;
    }

    return result;
}

/* =========================================================
   HANDLERS: Locking, scheduling e execução com AI
   ========================================================= */

function createAutoClassificationHandlers(deps) {
    const {
        db,
        FieldValue,
        canRunFinalClassification: canRunFinalClassificationFn,
        computeAutoClassifySignature: computeAutoClassifySignatureFn,
        computeAutoClassification: computeAutoClassificationFn,
        asDate,
        isAiEnabledForTenant,
        loadEscavadorConfig,
        evaluateNegativePartialSafetyNet,
        buildHomonymAnalysisInput,
        buildAiHomonymResetPayload,
        runAiHomonymAnalysis,
        buildAiHomonymUpdatePayload,
        runAiClassificationReviewAnalysis,
        buildAiClassificationReviewUpdatePayload,
        getAiProvidersIncluded,
        writeAuditEvent,
        ACTOR_TYPE,
        SOURCE,
        AI_MODEL,
        AI_PROMPT_VERSION,
        AI_HOMONYM_CONTEXT_VERSION,
        AI_HOMONYM_PROMPT_VERSION,
        AI_CLASSIFICATION_REVIEW_PROMPT_VERSION,
        AI_PREFILL_PROMPT_VERSION,
        openaiApiKey,
        buildDeterministicPrefill,
        sanitizeAiPrefillStructured,
        sanitizeNarrativesForFlags,
        recordAiCostLedger,
    } = deps;

    const isAiEnabledForTenantFn = isAiEnabledForTenant || isAiEnabledForTenantHelper;

    async function acquireAutoClassifyRun(caseRef, caseId) {
        const owner = `${caseId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return db.runTransaction(async (tx) => {
            const snap = await tx.get(caseRef);
            if (!snap.exists) return { acquired: false, owner, caseData: null, reason: 'missing_case' };
            const caseData = snap.data() || {};
            const lock = caseData.autoClassifyLock || null;
            const lockExpiresAt = asDate(lock?.expiresAt);
            if (lockExpiresAt && lockExpiresAt.getTime() > Date.now()) {
                tx.update(caseRef, {
                    autoClassifyRerunRequested: true,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                return { acquired: false, owner, caseData, reason: 'locked' };
            }
            const signature = computeAutoClassifySignatureFn(caseData);
            if (caseData.autoClassifySignature === signature && caseData.autoClassifiedAt) {
                return { acquired: false, owner, caseData, reason: 'already_current' };
            }
            tx.update(caseRef, {
                autoClassifyLock: {
                    owner,
                    startedAt: new Date(),
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                    signature,
                },
                updatedAt: FieldValue.serverTimestamp(),
            });
            return { acquired: true, owner, signature, caseData, reason: null };
        });
    }

    async function releaseAutoClassifyRun(caseRef, owner) {
        try {
            return await db.runTransaction(async (tx) => {
                const snap = await tx.get(caseRef);
                if (!snap.exists) return false;
                const data = snap.data() || {};
                const currentOwner = data.autoClassifyLock?.owner;
                if (currentOwner === owner) {
                    const rerunRequested = data.autoClassifyRerunRequested === true;
                    tx.update(caseRef, {
                        autoClassifyLock: FieldValue.delete(),
                        autoClassifyRerunRequested: FieldValue.delete(),
                    });
                    return rerunRequested;
                }
                return false;
            });
        } catch (err) {
            console.warn('[AutoClassify]: failed to release lock:', err.message);
            return false;
        }
    }

    async function runAutoClassifyAndAi(caseRef, caseId, freshData) {
        const lock = await acquireAutoClassifyRun(caseRef, caseId);
        if (!lock.acquired) {
            console.log(`Case ${caseId} [AutoClassify]: skipped (${lock.reason || 'not_acquired'}).`);
            return { skipped: true, reason: lock.reason || 'not_acquired' };
        }
        freshData = lock.caseData || freshData || {};

        try {
            const autoClassification = computeAutoClassificationFn(freshData);
            const updatePayload = {};

            if (Object.keys(autoClassification).length > 0) {
                Object.assign(updatePayload, autoClassification);
                console.log(`Case ${caseId} [AutoClassify]: criminal=${autoClassification.criminalFlag}, warrant=${autoClassification.warrantFlag}, labor=${autoClassification.laborFlag}`);
            }

            const tenantId = freshData.tenantId;
            let aiEnabled = false;
            let aiDisabledReason = null;
            if (tenantId) {
                try {
                    const aiCheck = await isAiEnabledForTenantFn(tenantId, db);
                    aiEnabled = aiCheck.enabled;
                    aiDisabledReason = aiCheck.reason || null;
                    if (!aiEnabled && aiDisabledReason) {
                        updatePayload.aiError = aiDisabledReason;
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
                            autoClassifySignature: lock.signature || computeAutoClassifySignatureFn(freshData),
                            autoClassifiedAt: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp(),
                        });

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
                            const homonymResult = await runAiHomonymAnalysis(caseDataForAi, homonymInput, aiKey, {}, db);
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

                            await writeAuditEvent({
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

                        const reviewResult = await runAiClassificationReviewAnalysis(caseDataForAi, aiKey, {}, db);
                        Object.assign(updatePayload, buildAiClassificationReviewUpdatePayload(reviewResult));
                        updatePayload.aiProvidersIncluded = getAiProvidersIncluded({ ...freshData, ...autoClassification });
                        Object.assign(caseDataForAi, {
                            aiClassificationReview: reviewResult.structured || null,
                            aiClassificationReviewOk: reviewResult.structuredOk || false,
                        });
                        console.log(`Case ${caseId} [AI_CLASSIFICATION_REVIEW]: ${reviewResult.error ? 'ERROR' : 'OK'} (${reviewResult.fromCache ? 'cached' : 'fresh'}, $${(updatePayload.aiClassificationReviewCostUsd || 0).toFixed(4)}, structured=${reviewResult.structuredOk})`);

                        await writeAuditEvent({
                            action: 'AI_ANALYSIS_RUN',
                            tenantId,
                            actor: { type: ACTOR_TYPE.SYSTEM, id: 'system', email: 'cloud-function' },
                            entity: { type: 'CASE', id: caseId, label: freshData.candidateName || caseId },
                            related: { caseId },
                            source: SOURCE.CLOUD_FUNCTION,
                            metadata: {
                                model: reviewResult.model,
                                tokens: updatePayload.aiClassificationReviewTokens,
                                cost: updatePayload.aiClassificationReviewCostUsd,
                                structuredOk: reviewResult.structuredOk,
                                promptVersion: AI_CLASSIFICATION_REVIEW_PROMPT_VERSION,
                                fromCache: !!reviewResult.fromCache,
                            },
                            templateVars: { candidateName: freshData.candidateName || caseId },
                        }).catch((auditErr) => console.warn('Audit log write failed:', auditErr.message));
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
                    updatePayload.aiStatus = 'FAILED';
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
                updatePayload.aiStatus = 'SKIPPED';
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
                const consistency = sanitizeNarrativesForFlags({ ...caseDataForAi, ...updatePayload }, sanitized);
                const mergedPrefill = {
                    ...consistency.narratives,
                    metadata: {
                        ...(currentPrefill.metadata || {}),
                        source: 'deterministic',
                        deterministicVersion: detPrefill.metadata.version,
                        mergedAt: new Date().toISOString(),
                        narrativeWarnings: consistency.warnings,
                    },
                };
                if (consistency.warnings.length > 0) updatePayload.narrativeConsistencyWarnings = consistency.warnings;
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
                    autoClassifySignature: lock.signature || computeAutoClassifySignatureFn(freshData),
                    autoClassifiedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                await recordAiCostLedger(tenantId, updatePayload, db).catch((err) => {
                    console.warn(`Case ${caseId} [AI Ledger]: failed to record cost:`, err.message);
                });
            }
            return { success: true };
        } catch (unexpectedErr) {
            console.error(`Case ${caseId} [AutoClassify]: unexpected error:`, unexpectedErr.message);
            try {
                await caseRef.update({
                    aiStatus: 'FAILED',
                    aiError: unexpectedErr.message,
                    autoClassifySignature: lock.signature || computeAutoClassifySignatureFn(freshData),
                    autoClassifiedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
            } catch (updateErr) {
                console.error(`Case ${caseId} [AutoClassify]: failed to persist error state:`, updateErr.message);
            }
            throw unexpectedErr;
        } finally {
            const shouldRerun = await releaseAutoClassifyRun(caseRef, lock.owner);
            if (shouldRerun) {
                console.log(`Case ${caseId} [AutoClassify]: rerun requested while locked. Reprocessing latest state.`);
                const latestDoc = await caseRef.get();
                if (latestDoc.exists) {
                    await runAutoClassifyAndAi(caseRef, caseId, latestDoc.data() || {});
                }
            }
        }
    }

    async function maybeRunAutoClassifyAndAi(caseRef, caseId, sourceLabel, options = {}) {
        if (options.skipAutoClassify === true) {
            console.log(`Case ${caseId} [AutoClassify via ${sourceLabel}]: skipped by option.`);
            return { ran: false, reason: 'skipAutoClassify' };
        }

        const freshDoc = await caseRef.get();
        if (!freshDoc.exists) return { ran: false, reason: 'case_missing' };

        const freshData = freshDoc.data() || {};
        const readiness = canRunFinalClassificationFn(freshData);

        if (!readiness.ok) {
            console.log(`Case ${caseId} [AutoClassify via ${sourceLabel}]: deferred — ${readiness.reason}.`);
            return { ran: false, reason: readiness.reason };
        }

        await runAutoClassifyAndAi(caseRef, caseId, freshData);
        return { ran: true, reason: 'ready' };
    }

    return {
        maybeRunAutoClassifyAndAi,
        runAutoClassifyAndAi,
        acquireAutoClassifyRun,
        releaseAutoClassifyRun,
    };
}

module.exports = {
    canRunFinalClassification,
    computeAutoClassifySignature,
    computeAutoClassification,
    createAutoClassificationHandlers,
};
