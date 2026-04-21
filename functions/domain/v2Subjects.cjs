'use strict';

const V2_SUBJECTS_VERSION = 'v2-subjects-2026-04-21';

const SUBJECT_TYPES = {
    PF: 'pf',
    PJ: 'pj',
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
    // Deterministic ID without crypto dependency — simple stable hash
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

function buildLastDossierSummary({ caseData = {}, moduleRunSummary = null, evidenceCount = 0, riskSignalCount = 0 }) {
    const highestSeverity = caseData.highestRiskSeverity || null;
    return {
        productKey: caseData.productKey || null,
        evidenceCount: moduleRunSummary?.evidenceCount ?? evidenceCount,
        riskSignalCount: moduleRunSummary?.riskSignalCount ?? riskSignalCount,
        highestSeverity,
        verdict: caseData.finalVerdict || caseData.verdict || null,
        updatedAt: null,
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
        linkedCaseIds: [caseId],
        status: 'active',
        lastDossierSummary: buildLastDossierSummary({ caseData, moduleRunSummary }),
        lastCheckedAt: null,
        version: V2_SUBJECTS_VERSION,
    };

    return { subject, subjectId };
}

function summarizeSubjectForCase(subject = {}) {
    if (!subject || !subject.id) return null;
    return {
        subjectId: subject.id,
        type: subject.type,
        declaredName: subject.declaredName,
        primaryDocument: subject.primaryDocument,
        lastDossierSummary: subject.lastDossierSummary || null,
        lastCheckedAt: subject.lastCheckedAt || null,
    };
}

module.exports = {
    V2_SUBJECTS_VERSION,
    SUBJECT_TYPES,
    inferSubjectType,
    inferPrimaryDocument,
    buildSubjectId,
    buildSubjectFromCase,
    summarizeSubjectForCase,
};
