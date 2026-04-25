'use strict';

const V2_SUBJECTS_VERSION = 'v2-subjects-2026-04-21';

const SUBJECT_TYPES = {
    PF: 'pf',
    PJ: 'pj',
};

// PJ legal structures
const PJ_LEGAL_TYPES = {
    LTDA: 'ltda',
    SA: 'sa',
    ME: 'me',
    MEI: 'mei',
    EI: 'ei',
    EIRELI: 'eireli',
    SLU: 'slu',
    OTHER: 'other',
};

function inferSubjectType(caseData = {}) {
    if (caseData.cnpj && !caseData.cpf) return SUBJECT_TYPES.PJ;
    const productKey = caseData.productKey || '';
    if (productKey === 'dossier_pj' || productKey === 'kyb_business') return SUBJECT_TYPES.PJ;
    return SUBJECT_TYPES.PF;
}

function inferPrimaryDocument(caseData = {}) {
    const cpf = String(caseData.cpf || caseData.candidateCpf || '').replace(/\D/g, '');
    if (cpf.length === 11) return { docType: 'cpf', docValue: cpf };
    const cnpj = String(caseData.cnpj || '').replace(/\D/g, '');
    if (cnpj.length === 14) return { docType: 'cnpj', docValue: cnpj };
    return { docType: null, docValue: null };
}

function buildSubjectId(tenantId, docType, docValue) {
    if (!tenantId || !docType || !docValue) return null;
    const raw = `${tenantId}:${docType}:${docValue}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const chr = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    const absHash = Math.abs(hash).toString(16).padStart(8, '0');
    return `subj_${docType}_${absHash}`;
}

function stableHash(value) {
    const raw = String(value || '');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const chr = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

function buildLastDossierSummary({ caseData = {}, moduleRunSummary = null, evidenceCount = 0, riskSignalCount = 0 }) {
    const highestSeverity = caseData.highestRiskSeverity || null;
    return {
        caseId: null,
        productKey: caseData.productKey || null,
        evidenceCount: moduleRunSummary?.evidenceCount ?? evidenceCount,
        riskSignalCount: moduleRunSummary?.riskSignalCount ?? riskSignalCount,
        highestSeverity,
        verdict: caseData.finalVerdict || caseData.verdict || null,
        updatedAt: null,
    };
}

function buildPFProfile(caseData = {}) {
    return {
        birthDate: caseData.birthDate || caseData.dataNascimento || null,
        motherName: caseData.motherName || caseData.nomeMae || null,
        nationality: caseData.nationality || 'BR',
        knownNames: caseData.candidateName ? [caseData.candidateName] : [],
    };
}

function buildPJProfile(caseData = {}) {
    const rawCnpj = String(caseData.cnpj || '').replace(/\D/g, '');
    return {
        tradeName: caseData.tradeName || caseData.nomeFantasia || null,
        legalName: caseData.legalName || caseData.razaoSocial || caseData.candidateName || null,
        legalType: caseData.legalType || null,
        cnpjBase: rawCnpj.length >= 8 ? rawCnpj.slice(0, 8) : null,
        openingDate: caseData.openingDate || caseData.dataAbertura || null,
        jurisdiction: caseData.jurisdiction || 'BR',
        knownNames: [caseData.candidateName, caseData.legalName, caseData.tradeName].filter(Boolean),
    };
}

function buildSubjectFromCase({ caseId, caseData = {}, moduleRunSummary = null } = {}) {
    if (!caseId) throw new Error('v2Subjects: caseId is required');

    const tenantId = caseData.tenantId || null;
    const type = inferSubjectType(caseData);
    const { docType, docValue } = inferPrimaryDocument(caseData);

    const subjectId = buildSubjectId(tenantId, docType, docValue) || `subj_case_${caseId}`;

    const subject = {
        id: subjectId,
        tenantId,
        type,
        primaryDocument: docType && docValue ? { docType, docValue } : null,
        declaredName: caseData.candidateName || caseData.name || null,
        canonicalEntityId: null,
        createdFromCaseId: caseId,
        // NOTE: linkedCaseIds must NOT be used directly for merge writes to Firestore —
        // use buildSubjectUpdatePayload which returns arrayUnion sentinel instead.
        linkedCaseIds: [caseId],
        status: 'active',
        pfProfile: type === SUBJECT_TYPES.PF ? buildPFProfile(caseData) : null,
        pjProfile: type === SUBJECT_TYPES.PJ ? buildPJProfile(caseData) : null,
        lastDossierSummary: buildLastDossierSummary({ caseData, moduleRunSummary }),
        lastCheckedAt: null,
        version: V2_SUBJECTS_VERSION,
    };

    return { subject, subjectId };
}

// Returns a Firestore-safe update payload that accumulates linkedCaseIds via arrayUnion.
// The arrayUnionSentinel param accepts FieldValue.arrayUnion(caseId) from the caller.
function buildSubjectUpdatePayload({ subject, caseId, arrayUnionSentinel = null, serverTimestamp = null } = {}) {
    if (!subject) throw new Error('v2Subjects.buildSubjectUpdatePayload: subject required');

    const payload = {
        tenantId: subject.tenantId,
        type: subject.type,
        primaryDocument: subject.primaryDocument,
        declaredName: subject.declaredName,
        status: subject.status,
        pfProfile: subject.pfProfile,
        pjProfile: subject.pjProfile,
        lastDossierSummary: {
            ...subject.lastDossierSummary,
            caseId,
            updatedAt: serverTimestamp || new Date().toISOString(),
        },
        lastCheckedAt: serverTimestamp || new Date().toISOString(),
        updatedAt: serverTimestamp || new Date().toISOString(),
        version: subject.version,
    };

    // arrayUnion prevents overwriting linkedCaseIds on re-runs
    if (arrayUnionSentinel !== null) {
        payload.linkedCaseIds = arrayUnionSentinel;
    }

    return payload;
}

function summarizeSubjectForCase(subject = {}) {
    if (!subject || !subject.id) return null;
    return {
        subjectId: subject.id,
        type: subject.type,
        declaredName: subject.declaredName,
        primaryDocument: subject.primaryDocument,
        pfProfile: subject.pfProfile || null,
        pjProfile: subject.pjProfile || null,
        lastDossierSummary: subject.lastDossierSummary || null,
        lastCheckedAt: subject.lastCheckedAt || null,
        linkedCaseCount: Array.isArray(subject.linkedCaseIds) ? subject.linkedCaseIds.length : null,
    };
}

// Merges known names into pfProfile.knownNames or pjProfile.knownNames (dedup).
function enrichSubjectWithAliases(subject, aliases = []) {
    if (!subject || !aliases.length) return subject;
    const profile = subject.type === SUBJECT_TYPES.PF ? 'pfProfile' : 'pjProfile';
    if (!subject[profile]) return subject;
    const existing = subject[profile].knownNames || [];
    const merged = [...new Set([...existing, ...aliases.filter(Boolean)])];
    return {
        ...subject,
        [profile]: { ...subject[profile], knownNames: merged },
    };
}

function buildFactId(caseId, kind) {
    const safeCaseId = String(caseId || 'case').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
    const safeKind = String(kind || 'fact').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
    return `fact_${safeCaseId}_${safeKind}`;
}

function buildCanonicalDossierArtifacts({ subject = null, caseId = null, evidenceItems = [], riskSignals = [] } = {}) {
    if (!subject?.id || !subject.tenantId || !caseId) {
        return { entity: null, entityCollection: null, subjectPatch: {}, facts: [] };
    }

    const docType = subject.primaryDocument?.docType || null;
    const docValue = subject.primaryDocument?.docValue || null;
    const evidenceIds = [...new Set((evidenceItems || []).map((item) => item.id).filter(Boolean))];
    const signalIds = [...new Set((riskSignals || []).map((signal) => signal.id).filter(Boolean))];
    const baseEntity = {
        tenantId: subject.tenantId,
        subjectId: subject.id,
        sourceCaseId: caseId,
        declaredName: subject.declaredName || null,
        sourceEvidenceIds: evidenceIds,
        sourceSignalIds: signalIds,
        status: 'active',
        version: V2_SUBJECTS_VERSION,
    };

    let entity = null;
    let entityCollection = null;
    let subjectPatch = {};
    const facts = [];

    if (subject.type === SUBJECT_TYPES.PF && docType === 'cpf' && docValue) {
        const personId = `person_cpf_${stableHash(`${subject.tenantId}:${docValue}`)}`;
        entityCollection = 'persons';
        entity = {
            id: personId,
            ...baseEntity,
            cpf: docValue,
            name: subject.declaredName || null,
            birthDate: subject.pfProfile?.birthDate || null,
            motherName: subject.pfProfile?.motherName || null,
            nationality: subject.pfProfile?.nationality || 'BR',
            knownNames: subject.pfProfile?.knownNames || [],
        };
        subjectPatch = {
            canonicalEntityId: personId,
            canonicalPersonId: personId,
        };
        facts.push({
            id: buildFactId(caseId, 'identity_pf'),
            tenantId: subject.tenantId,
            subjectId: subject.id,
            entityId: personId,
            caseId,
            kind: 'identity_pf',
            value: {
                cpf: docValue,
                name: subject.declaredName || null,
                birthDate: entity.birthDate,
                motherName: entity.motherName,
            },
            confidence: 'high',
            evidenceIds,
            status: 'active',
            version: V2_SUBJECTS_VERSION,
        });
    }

    if (subject.type === SUBJECT_TYPES.PJ && docType === 'cnpj' && docValue) {
        const companyId = `company_cnpj_${stableHash(`${subject.tenantId}:${docValue}`)}`;
        entityCollection = 'companies';
        entity = {
            id: companyId,
            ...baseEntity,
            cnpj: docValue,
            legalName: subject.pjProfile?.legalName || subject.declaredName || null,
            tradeName: subject.pjProfile?.tradeName || null,
            legalType: subject.pjProfile?.legalType || null,
            cnpjBase: subject.pjProfile?.cnpjBase || null,
            openingDate: subject.pjProfile?.openingDate || null,
            jurisdiction: subject.pjProfile?.jurisdiction || 'BR',
            knownNames: subject.pjProfile?.knownNames || [],
        };
        subjectPatch = {
            canonicalEntityId: companyId,
            canonicalCompanyId: companyId,
        };
        facts.push({
            id: buildFactId(caseId, 'identity_pj'),
            tenantId: subject.tenantId,
            subjectId: subject.id,
            entityId: companyId,
            caseId,
            kind: 'identity_pj',
            value: {
                cnpj: docValue,
                legalName: entity.legalName,
                tradeName: entity.tradeName,
                openingDate: entity.openingDate,
            },
            confidence: 'high',
            evidenceIds,
            status: 'active',
            version: V2_SUBJECTS_VERSION,
        });
    }

    if (signalIds.length > 0) {
        facts.push({
            id: buildFactId(caseId, 'risk_summary'),
            tenantId: subject.tenantId,
            subjectId: subject.id,
            entityId: entity?.id || null,
            caseId,
            kind: 'risk_summary',
            value: {
                riskSignalCount: signalIds.length,
                highOrCriticalCount: (riskSignals || []).filter((signal) => ['high', 'critical'].includes(signal.severity)).length,
            },
            confidence: 'medium',
            evidenceIds,
            signalIds,
            status: 'active',
            version: V2_SUBJECTS_VERSION,
        });
    }

    return { entity, entityCollection, subjectPatch, facts };
}

module.exports = {
    V2_SUBJECTS_VERSION,
    SUBJECT_TYPES,
    PJ_LEGAL_TYPES,
    inferSubjectType,
    inferPrimaryDocument,
    buildSubjectId,
    buildPFProfile,
    buildPJProfile,
    buildSubjectFromCase,
    buildSubjectUpdatePayload,
    summarizeSubjectForCase,
    enrichSubjectWithAliases,
    buildCanonicalDossierArtifacts,
};
