const UF_REGION_MAP = {
    AC: 'NORTH', AL: 'NORTHEAST', AP: 'NORTH', AM: 'NORTH', BA: 'NORTHEAST',
    CE: 'NORTHEAST', DF: 'MIDWEST', ES: 'SOUTHEAST', GO: 'MIDWEST', MA: 'NORTHEAST',
    MT: 'MIDWEST', MS: 'MIDWEST', MG: 'SOUTHEAST', PA: 'NORTH', PB: 'NORTHEAST',
    PR: 'SOUTH', PE: 'NORTHEAST', PI: 'NORTHEAST', RJ: 'SOUTHEAST', RN: 'NORTHEAST',
    RS: 'SOUTH', RO: 'NORTH', RR: 'NORTH', SC: 'SOUTH', SP: 'SOUTHEAST',
    SE: 'NORTHEAST', TO: 'NORTH',
};

const LOW_RISK_ROLE_REGEX = /testemunha|informante/i;

// BUG-10 fix: Use the best available cpfsComNome signal from all providers.
// When Escavador didn't run, escavadorCpfsComEsseNome is 0, but Judit gate
// may have produced juditIdentity.cpfsComNome from the entity data lake.
function getCpfsComNome(caseData) {
    return Math.max(
        caseData.escavadorCpfsComEsseNome || 0,
        caseData.juditIdentity?.cpfsComNome || 0,
    );
}

function uniqStrings(values = []) {
    return [...new Set(
        values
            .map((value) => (value == null ? null : String(value).trim()))
            .filter(Boolean),
    )];
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function getRegionByUf(uf) {
    return UF_REGION_MAP[String(uf || '').trim().toUpperCase()] || null;
}

function extractDddPrefixes(values = []) {
    return uniqStrings(values.map((value) => {
        const match = String(value || '').match(/\(?(\d{2})\)?/);
        return match ? match[1] : null;
    }));
}

function parseAddressCityUf(address) {
    const text = String(address || '').trim();
    const match = text.match(/,\s*([^,]+),\s*([A-Z]{2})(?:,\s*\d{5}-?\d{3})?\s*$/i);
    if (!match) return { city: null, uf: null };

    return {
        city: normalizeText(match[1]),
        uf: match[2].toUpperCase(),
    };
}

function hasLowRiskRole(value) {
    return LOW_RISK_ROLE_REGEX.test(String(value || ''));
}

function buildCandidateProfile(caseData = {}) {
    const contact = caseData.enrichmentContact || {};
    const juditIdentity = caseData.juditIdentity || {};
    const structuredAddresses = Array.isArray(juditIdentity.addresses) ? juditIdentity.addresses : [];
    const flatAddresses = Array.isArray(contact.addresses) ? contact.addresses : [];

    const allUfs = uniqStrings([
        ...(caseData.juditAllUfs || []),
        ...(caseData.enrichmentAllUfs || []),
        caseData.juditPrimaryUf,
        caseData.enrichmentPrimaryUf,
        contact.primaryUf,
        caseData.hiringUf,
        ...structuredAddresses.map((address) => address?.state || null),
        ...flatAddresses.map((address) => parseAddressCityUf(address).uf),
    ].map((uf) => String(uf || '').toUpperCase()));

    const cities = uniqStrings([
        ...structuredAddresses.map((address) => normalizeText(address?.city || '')),
        ...flatAddresses.map((address) => parseAddressCityUf(address).city),
    ]);

    const phoneValues = [
        ...(Array.isArray(contact.phones) ? contact.phones : []),
        ...((Array.isArray(juditIdentity.contacts) ? juditIdentity.contacts : []).map((item) => item?.value)),
    ];

    return {
        hiringUf: String(caseData.hiringUf || '').toUpperCase() || null,
        primaryUf: allUfs[0] || null,
        allUfs,
        cities,
        dddPrefixes: extractDddPrefixes(phoneValues),
        birthDateAvailable: Boolean(contact.birthDate || juditIdentity.birthDate),
        cpfConfirmedInProvider: Boolean(
            (caseData.juditRoleSummary || []).some((item) => item?.hasExactCpfMatch)
            || (caseData.escavadorProcessos || []).some((item) => item?.hasExactCpfMatch),
        ),
    };
}

function getGeoConsistencyBucket(candidateProfile, processUf, processCity) {
    const normalizedUf = String(processUf || '').trim().toUpperCase() || null;
    const normalizedCity = normalizeText(processCity || '');

    if (!normalizedUf && !normalizedCity) return 'UNKNOWN';

    const candidateCities = candidateProfile.cities || [];
    const candidateUfs = candidateProfile.allUfs || [];

    if (normalizedCity && normalizedUf && candidateCities.includes(normalizedCity) && candidateUfs.includes(normalizedUf)) {
        return 'SAME_CITY';
    }
    if (normalizedUf && candidateUfs.includes(normalizedUf)) {
        return 'SAME_UF';
    }

    const candidateRegions = uniqStrings(candidateUfs.map(getRegionByUf));
    const processRegion = getRegionByUf(normalizedUf);
    if (processRegion && candidateRegions.includes(processRegion)) {
        return 'SAME_REGION';
    }
    if (processRegion && candidateRegions.length > 0) {
        return 'DISTANT_REGION';
    }
    return 'UNKNOWN';
}

function resolveEvidenceOrigin(source, hasExactCpfMatch, viaNameOnly, matchStrength) {
    if (hasExactCpfMatch) return 'CPF';
    if (source === 'Judit' && viaNameOnly) return 'NAME_SUPPLEMENT';
    if (source === 'Escavador' && matchStrength === 'NAME_UNIQUE') return 'NAME_EXACT_UNIQUE';
    if (viaNameOnly) return 'NAME_ONLY';
    return 'WEAK_IDENTITY';
}

function resolveEvidenceStrength({ hasExactCpfMatch, hasDivergentCpf, lowRiskRole, geoConsistency, matchStrength, cpfsComEsseNome }) {
    if (hasDivergentCpf) {
        return 'DISCARDED_DIFFERENT_CPF';
    }
    if (hasExactCpfMatch) {
        return lowRiskRole ? 'EXACT_CPF_LOW_RISK_ROLE' : 'HARD_FACT';
    }
    if (matchStrength === 'NAME_UNIQUE' && (cpfsComEsseNome || 0) <= 1 && geoConsistency !== 'DISTANT_REGION') {
        return 'PARTIAL_MATCH';
    }
    return 'WEAK_MATCH';
}

function resolveAnalysisScope(evidenceStrength) {
    if (evidenceStrength === 'HARD_FACT' || evidenceStrength === 'EXACT_CPF_LOW_RISK_ROLE' || evidenceStrength === 'DISCARDED_DIFFERENT_CPF') {
        return 'REFERENCE_ONLY';
    }
    return 'AMBIGUOUS_REVIEW';
}

function buildEscavadorProcessCandidates(caseData, candidateProfile) {
    const cpfsComEsseNome = getCpfsComNome(caseData);
    const processes = Array.isArray(caseData.escavadorProcessos) ? caseData.escavadorProcessos : [];

    return processes.map((processo) => {
        const hasExactCpfMatch = processo.hasExactCpfMatch === true;
        const hasDivergentCpf = processo.hasDivergentCpf === true;
        const viaNameOnly = !hasExactCpfMatch && !hasDivergentCpf;
        const geoConsistency = getGeoConsistencyBucket(candidateProfile, processo.processUf, processo.processCity);
        const lowRiskRole = hasLowRiskRole(processo.tipoNormalizado || processo.tipo || processo.polo);
        const matchStrength = hasExactCpfMatch
            ? 'EXACT_CPF'
            : hasDivergentCpf
                ? 'DIVERGENT_CPF'
                : processo.matchDocumentoPor === 'NOME_EXATO_UNICO'
                    ? 'NAME_UNIQUE'
                    : processo.matchDocumentoPor
                        ? String(processo.matchDocumentoPor).toUpperCase()
                        : 'UNKNOWN';
        const evidenceOrigin = resolveEvidenceOrigin('Escavador', hasExactCpfMatch, viaNameOnly, matchStrength);
        const evidenceStrength = resolveEvidenceStrength({
            hasExactCpfMatch,
            hasDivergentCpf,
            lowRiskRole,
            geoConsistency,
            matchStrength,
            cpfsComEsseNome,
        });
        const analysisScope = resolveAnalysisScope(evidenceStrength);
        const homonymRiskSignals = [];

        if (hasDivergentCpf) homonymRiskSignals.push('DIVERGENT_CPF_CONFIRMED');
        if (cpfsComEsseNome > 1) homonymRiskSignals.push(`ESCAVADOR_CPFS_COM_NOME_${cpfsComEsseNome}`);
        if (viaNameOnly) homonymRiskSignals.push('NO_EXACT_CPF_MATCH');
        if (processo.matchDocumentoPor) homonymRiskSignals.push(`MATCH_${String(processo.matchDocumentoPor).toUpperCase()}`);
        if (geoConsistency === 'DISTANT_REGION') homonymRiskSignals.push('DISTANT_GEOGRAPHY');
        if (lowRiskRole) homonymRiskSignals.push('LOW_RISK_ROLE');

        return {
            source: 'Escavador',
            sourceKey: 'escavador',
            cnj: processo.numeroCnj || null,
            area: processo.area || null,
            isCriminal: /penal|crim/i.test(processo.area || ''),
            tribunal: processo.tribunalSigla || null,
            processUf: processo.processUf || null,
            processCity: processo.processCity || null,
            hasExactCpfMatch,
            hasDivergentCpf,
            matchedRole: processo.tipoNormalizado || processo.tipo || processo.polo || null,
            lowRiskRole,
            matchStrength,
            evidenceOrigin,
            evidenceStrength,
            analysisScope,
            geoConsistency,
            identityConsistency: hasExactCpfMatch ? 'HIGH' : hasDivergentCpf ? 'NONE' : matchStrength === 'NAME_UNIQUE' ? 'MEDIUM' : 'LOW',
            viaNameOnly,
            homonymRiskSignals,
        };
    });
}

function buildJuditProcessCandidates(caseData, candidateProfile) {
    const usedNameSupplement = caseData.juditNameSearchFlag === 'FOUND'
        && ((caseData.juditRawPayloads?.lawsuits?.responseCount || 0) === 0);
    const summary = Array.isArray(caseData.juditRoleSummary) ? caseData.juditRoleSummary : [];

    return summary.map((processo) => {
        const hasExactCpfMatch = processo.hasExactCpfMatch === true;
        const hasDivergentCpf = processo.hasDivergentCpf === true;
        const viaNameOnly = usedNameSupplement && !hasExactCpfMatch && !hasDivergentCpf;
        const geoConsistency = getGeoConsistencyBucket(candidateProfile, processo.state, processo.city);
        const lowRiskRole = hasLowRiskRole(processo.personType || processo.side);
        const matchStrength = hasExactCpfMatch
            ? 'EXACT_CPF'
            : hasDivergentCpf
                ? 'DIVERGENT_CPF'
                : viaNameOnly ? 'NAME_SUPPLEMENT' : 'UNKNOWN';
        const evidenceOrigin = resolveEvidenceOrigin('Judit', hasExactCpfMatch, viaNameOnly, matchStrength);
        const evidenceStrength = resolveEvidenceStrength({
            hasExactCpfMatch,
            hasDivergentCpf,
            lowRiskRole,
            geoConsistency,
            matchStrength,
            cpfsComEsseNome: getCpfsComNome(caseData),
        });
        const analysisScope = resolveAnalysisScope(evidenceStrength);
        const homonymRiskSignals = [];

        if (hasDivergentCpf) homonymRiskSignals.push('DIVERGENT_CPF_CONFIRMED');
        if (processo.isPossibleHomonym) homonymRiskSignals.push('JUDIT_POSSIBLE_HOMONYM');
        if (viaNameOnly) homonymRiskSignals.push('JUDIT_NAME_SUPPLEMENT');
        if (!hasExactCpfMatch && !hasDivergentCpf) homonymRiskSignals.push('NO_EXACT_CPF_MATCH');
        if (geoConsistency === 'DISTANT_REGION') homonymRiskSignals.push('DISTANT_GEOGRAPHY');
        if (lowRiskRole) homonymRiskSignals.push('LOW_RISK_ROLE');

        return {
            source: 'Judit',
            sourceKey: 'judit',
            cnj: processo.code || null,
            area: processo.area || null,
            isCriminal: processo.isCriminal === true,
            tribunal: processo.tribunalAcronym || null,
            processUf: processo.state || null,
            processCity: processo.city || null,
            hasExactCpfMatch,
            hasDivergentCpf,
            matchedRole: processo.personType || processo.side || null,
            lowRiskRole,
            matchStrength,
            evidenceOrigin,
            evidenceStrength,
            analysisScope,
            geoConsistency,
            identityConsistency: hasExactCpfMatch ? 'HIGH' : hasDivergentCpf ? 'NONE' : viaNameOnly ? 'LOW' : 'UNKNOWN',
            viaNameOnly,
            homonymRiskSignals,
        };
    });
}

function buildHardFacts(caseData, processCandidates) {
    const hardFacts = [];
    if ((caseData.juditActiveWarrantCount || 0) > 0) hardFacts.push('ACTIVE_WARRANT');
    if (caseData.juditExecutionFlag === 'POSITIVE') hardFacts.push('PENAL_EXECUTION');
    if (processCandidates.some((item) => item.source === 'Judit' && item.hasExactCpfMatch && !item.lowRiskRole)) {
        hardFacts.push('JUDIT_EXACT_CPF_MATCH');
    }
    if (processCandidates.some((item) => item.source === 'Escavador' && item.hasExactCpfMatch && !item.lowRiskRole)) {
        hardFacts.push('ESCAVADOR_EXACT_CPF_MATCH');
    }
    if (
        processCandidates.some((item) => item.hasExactCpfMatch && item.lowRiskRole)
        && !hardFacts.includes('JUDIT_EXACT_CPF_MATCH')
        && !hardFacts.includes('ESCAVADOR_EXACT_CPF_MATCH')
    ) {
        hardFacts.push('LOW_RISK_EXACT_ROLE');
    }
    return hardFacts;
}

function scoreProcessCandidate(candidate) {
    let score = 0;
    if (candidate.hasExactCpfMatch) score += 100;
    if (candidate.isCriminal) score += 40;
    if (!candidate.lowRiskRole) score += 20;
    if (candidate.geoConsistency === 'SAME_CITY') score += 15;
    if (candidate.geoConsistency === 'SAME_UF') score += 10;
    if (candidate.geoConsistency === 'DISTANT_REGION') score -= 10;
    if (candidate.analysisScope === 'AMBIGUOUS_REVIEW') score += 5;
    return score;
}

function prioritizeProcessCandidates(candidates = []) {
    return [...candidates].sort((left, right) => {
        const scoreDiff = scoreProcessCandidate(right) - scoreProcessCandidate(left);
        if (scoreDiff !== 0) return scoreDiff;

        const leftCnj = String(left.cnj || '');
        const rightCnj = String(right.cnj || '');
        return leftCnj.localeCompare(rightCnj);
    });
}

function buildCoverageAssessment(caseData, processCandidates, hardFacts) {
    const juditTotal = caseData.juditProcessTotal || 0;
    const escavadorTotal = caseData.escavadorProcessTotal || 0;
    const juditExact = processCandidates.filter((item) => item.source === 'Judit' && item.hasExactCpfMatch && !item.lowRiskRole);
    const escavadorExact = processCandidates.filter((item) => item.source === 'Escavador' && item.hasExactCpfMatch && !item.lowRiskRole);
    const weakCandidates = processCandidates.filter((item) => item.analysisScope === 'AMBIGUOUS_REVIEW');
    const exactMatchSources = uniqStrings(processCandidates
        .filter((item) => item.hasExactCpfMatch && !item.lowRiskRole)
        .map((item) => item.source.toUpperCase()));

    const reasons = [];
    let providerDivergence = 'NONE';

    if (juditTotal === 0 && escavadorTotal > 0) {
        providerDivergence = 'HIGH';
        reasons.push('JUDIT_ZERO_ESCAVADOR_FOUND');
    } else if (juditTotal > 0 && escavadorTotal === 0) {
        providerDivergence = 'HIGH';
        reasons.push('ESCAVADOR_ZERO_JUDIT_FOUND');
    } else if (juditTotal > 0 && escavadorTotal > 0 && Math.abs(juditTotal - escavadorTotal) >= 5) {
        providerDivergence = 'MEDIUM';
        reasons.push('PROCESS_COUNT_DIVERGENCE');
    }

    if (weakCandidates.length > 0 && exactMatchSources.length === 0) {
        reasons.push('ONLY_WEAK_EVIDENCE');
    }
    if (weakCandidates.length > 0 && exactMatchSources.length > 0) {
        reasons.push('MIXED_STRONG_AND_WEAK_EVIDENCE');
    }
    if (caseData.juditEnrichmentStatus === 'FAILED' || caseData.escavadorEnrichmentStatus === 'FAILED') {
        reasons.push('PROVIDER_FAILURE_REDUCES_COVERAGE');
    }
    if (juditTotal === 0 && escavadorTotal === 0 && exactMatchSources.length === 0) {
        reasons.push('NO_PROCESS_EVIDENCE_RETURNED');
    }

    let overallLevel = 'LOW_COVERAGE';
    if (
        hardFacts.includes('ACTIVE_WARRANT')
        || hardFacts.includes('PENAL_EXECUTION')
        || exactMatchSources.length >= 2
        || (exactMatchSources.length >= 1 && weakCandidates.length === 0 && providerDivergence !== 'HIGH')
    ) {
        overallLevel = 'HIGH_COVERAGE';
    } else if (exactMatchSources.length >= 1) {
        overallLevel = 'PARTIAL_COVERAGE';
    } else if (weakCandidates.length > 0) {
        overallLevel = 'LOW_COVERAGE';
    } else if (juditTotal > 0 || escavadorTotal > 0) {
        overallLevel = 'PARTIAL_COVERAGE';
    }

    const juditConfidence = (
        (caseData.juditActiveWarrantCount || 0) > 0
        || caseData.juditExecutionFlag === 'POSITIVE'
        || juditExact.length > 0
    )
        ? 'HIGH_COVERAGE'
        : juditTotal > 0
            ? 'PARTIAL_COVERAGE'
            : 'LOW_COVERAGE';

    const escavadorConfidence = escavadorExact.length > 0
        ? 'HIGH_COVERAGE'
        : escavadorTotal > 0
            ? 'PARTIAL_COVERAGE'
            : 'LOW_COVERAGE';

    const fontedataConfidence = ['DONE', 'PARTIAL'].includes(caseData.enrichmentStatus)
        ? 'PARTIAL_COVERAGE'
        : 'LOW_COVERAGE';

    return {
        judit: {
            total: juditTotal,
            criminal: caseData.juditCriminalCount || 0,
            warrant: caseData.juditActiveWarrantCount || 0,
            execution: caseData.juditExecutionCount || 0,
            confidence: juditConfidence,
        },
        escavador: {
            total: escavadorTotal,
            criminal: caseData.escavadorCriminalCount || 0,
            cpfsComEsseNome: caseData.escavadorCpfsComEsseNome || 0,
            confidence: escavadorConfidence,
        },
        fontedata: {
            active: Boolean(caseData.enrichmentStatus),
            criminal: caseData.fontedataCriminalFlag || null,
            warrant: caseData.fontedataWarrantFlag || null,
            labor: caseData.fontedataLaborFlag || null,
            confidence: fontedataConfidence,
        },
        overall: {
            level: overallLevel,
            providerDivergence,
            exactMatchSources,
            weakMatchCount: weakCandidates.length,
            reasons,
        },
    };
}

function buildHomonymAnalysisInput(caseData = {}) {
    const candidateProfile = buildCandidateProfile(caseData);
    const processCandidates = prioritizeProcessCandidates([
        ...buildJuditProcessCandidates(caseData, candidateProfile),
        ...buildEscavadorProcessCandidates(caseData, candidateProfile),
    ]);

    const hardFacts = buildHardFacts(caseData, processCandidates);
    const providerCoverage = buildCoverageAssessment(caseData, processCandidates, hardFacts);
    const ambiguousCandidates = processCandidates.filter((item) => item.analysisScope === 'AMBIGUOUS_REVIEW');
    const referenceCandidates = processCandidates.filter((item) => item.analysisScope === 'REFERENCE_ONLY');
    const ambiguityReasons = [];
    const cpfsComEsseNome = getCpfsComNome(caseData);

    if (cpfsComEsseNome > 1) {
        ambiguityReasons.push(cpfsComEsseNome >= 10 ? 'COMMON_NAME_HIGH_POLLUTION' : 'MULTIPLE_CPFS_SAME_NAME');
    }
    if (ambiguousCandidates.some((item) => item.viaNameOnly)) ambiguityReasons.push('NAME_BASED_MATCH_PRESENT');
    if (ambiguousCandidates.some((item) => item.geoConsistency === 'DISTANT_REGION')) ambiguityReasons.push('DISTANT_GEOGRAPHY_WITHOUT_IDENTITY_LINK');
    if (ambiguousCandidates.some((item) => item.isCriminal)) ambiguityReasons.push('CRIMINAL_WEAK_MATCH');
    if (caseData.juditNameSearchFlag === 'FOUND' && ambiguousCandidates.length > 0) ambiguityReasons.push('JUDIT_NAME_SUPPLEMENT_USED');
    if (providerCoverage.overall.providerDivergence === 'HIGH' && ambiguousCandidates.length > 0) {
        ambiguityReasons.push('PROVIDER_DIVERGENCE_WITH_WEAK_MATCH');
    }
    if (providerCoverage.overall.level === 'LOW_COVERAGE' && ambiguousCandidates.length > 0) {
        ambiguityReasons.push('LOW_PROVIDER_COVERAGE');
    }
    if ((candidateProfile.allUfs || []).length === 0 && ambiguousCandidates.length > 0) {
        ambiguityReasons.push('LIMITED_GEO_PROFILE');
    }

    return {
        needsAnalysis: ambiguousCandidates.length > 0,
        analysisTarget: 'AMBIGUOUS_EVIDENCE_ONLY',
        candidateProfile,
        providerCoverage,
        processCandidates,
        ambiguousCandidates,
        referenceCandidates,
        ambiguityReasons,
        hardFacts,
        ambiguousProcessCount: ambiguousCandidates.length,
        referenceProcessCount: referenceCandidates.length,
    };
}

module.exports = {
    buildCandidateProfile,
    getGeoConsistencyBucket,
    buildCoverageAssessment,
    buildHomonymAnalysisInput,
    getRegionByUf,
    prioritizeProcessCandidates,
};
