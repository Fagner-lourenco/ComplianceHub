/**
 * fieldConstants.js — Constantes de campos compartilhadas entre backend modules
 * Extraído do monolito index.js
 */

const IDENTITY_FIELDS = [
    'candidateName', 'cpfMasked', 'candidatePosition', 'hiringUf', 'tenantId', 'createdAt',
    'requestedBy', 'requestedByName', 'requestedByEmail',
    'slaHours',

    // Validação cadastral BigDataCorp
    'bigdatacorpName',
    'bigdatacorpCpfStatus',
    'bigdatacorpBirthDate',
    'bigdatacorpAge',
    'bigdatacorpGender',
    'bigdatacorpMotherName',
    'bigdatacorpHasDeathRecord',
];

const RESULT_ONLY_FIELDS = [
    'criminalFlag', 'criminalSeverity', 'criminalNotes',
    'laborFlag', 'laborSeverity', 'laborNotes',
    'warrantFlag', 'warrantNotes',
    'osintLevel', 'osintVectors', 'osintNotes',
    'socialStatus', 'socialReasons', 'socialNotes',
    'digitalFlag', 'digitalVectors', 'digitalNotes',
    'conflictInterest', 'conflictNotes',
    // Fase automatica de credito (indicativo apenas — nunca custos/fontes/erros)
    'creditRestrictionFlag', 'creditQuantumScore', 'creditRestrictionSummary', 'creditRestrictionDetails',
    'riskScore', 'riskLevel', 'suggestedVerdict', 'finalVerdict', 'analystComment',
    'enabledPhases',
    'keyFindings',
    'executiveSummary',
    'publicReportToken',
    'cpfPendingRegularization',
    'cpfPendingNotes',
];

const CLIENT_SAFE_PUBLICATION_FIELDS = [
    'statusSummary',
    'sourceSummary',
    'nextSteps',
    'timelineEvents',
    'socialProfiles',
    'reportReady',
    'reportSlug',
    'concludedAt',
    'turnaroundHours',
];

const PUBLIC_RESULT_FIELDS = [...IDENTITY_FIELDS, ...RESULT_ONLY_FIELDS, ...CLIENT_SAFE_PUBLICATION_FIELDS];

const CLIENT_CASE_PRIVATE_FIELDS = [
    'cpf',
];

const CLIENT_CASE_FIELDS = [
    ...PUBLIC_RESULT_FIELDS,
    ...CLIENT_CASE_PRIVATE_FIELDS,
    'candidateId',
    'tenantName',
    'status',
    'priority',
    'createdDateKey',
    'createdMonthKey',
    'concludedAt',
    'updatedAt',
    'correctedAt',
    // executiveSummary, keyFindings already in PUBLIC_RESULT_FIELDS
    'statusSummary',
    'sourceSummary',
    'nextSteps',
    'clientNotes',
    'hasNotes',
    'hasEvidence',
];

const ALLOWED_CONCLUDE_FIELDS = new Set([
    'assigneeId',
    'executiveSummary',
    'criminalFlag',
    'criminalSeverity',
    'criminalNotes',
    'laborFlag',
    'laborSeverity',
    'laborNotes',
    'warrantFlag',
    'warrantNotes',
    'osintLevel',
    'osintVectors',
    'osintNotes',
    'socialStatus',
    'socialReasons',
    'socialNotes',
    'digitalFlag',
    'digitalVectors',
    'digitalNotes',
    'conflictInterest',
    'conflictNotes',
    'finalVerdict',
    'keyFindings',
    'analystComment',
    'enabledPhases',
    'clientVerdictOverride',
    'identityBypassed',
    'identityBypassJustification',
]);

const ALLOWED_DRAFT_FIELDS = new Set([
    'executiveSummary',
    'criminalFlag',
    'criminalSeverity',
    'criminalNotes',
    'laborFlag',
    'laborSeverity',
    'laborNotes',
    'warrantFlag',
    'warrantNotes',
    'osintLevel',
    'osintVectors',
    'osintNotes',
    'socialStatus',
    'socialReasons',
    'socialNotes',
    'digitalFlag',
    'digitalVectors',
    'digitalNotes',
    'conflictInterest',
    'conflictNotes',
    'finalVerdict',
    'keyFindings',
    'analystComment',
    'riskLevel',
    'riskScore',
]);

const REVIEW_DRAFT_ARRAY_FIELDS = new Set([
    'keyFindings',
    'osintVectors',
    'socialReasons',
    'digitalVectors',
]);

module.exports = {
    IDENTITY_FIELDS,
    RESULT_ONLY_FIELDS,
    CLIENT_SAFE_PUBLICATION_FIELDS,
    PUBLIC_RESULT_FIELDS,
    CLIENT_CASE_PRIVATE_FIELDS,
    CLIENT_CASE_FIELDS,
    ALLOWED_CONCLUDE_FIELDS,
    ALLOWED_DRAFT_FIELDS,
    REVIEW_DRAFT_ARRAY_FIELDS,
};
