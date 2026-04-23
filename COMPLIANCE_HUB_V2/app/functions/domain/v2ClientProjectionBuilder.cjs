'use strict';

const { getFirestore } = require('firebase-admin/firestore');

/** Lazy getter for Firestore */
let _db;
function db() {
    if (!_db) _db = getFirestore();
    return _db;
}

/**
 * Fields allowed in the client-safe list projection.
 * This MUST be kept minimal for security and performance.
 */
const SAFE_LIST_FIELDS = [
    'id',
    'tenantId',
    'subjectId',
    'candidateName',
    'cpfMasked',
    'candidatePosition',
    'status',
    'finalVerdict',
    'riskLevel',
    'riskScore',
    'priority',
    'createdAt',
    'updatedAt',
    'concludedAt',
    'reportReady',
    'hasEvidence',
    'hasNotes'
];

/**
 * Syncs a minimal, client-safe projection of a case to the 'clientCaseList' collection.
 * This prevents clients from reading internal fields in the 'cases' collection.
 */
async function syncClientCaseListProjection(caseId, caseData) {
    if (!caseId || !caseData) return;

    const tenantId = caseData.tenantId;
    if (!tenantId) return;

    const projection = {};
    
    // Whitelist only safe fields
    for (const field of SAFE_LIST_FIELDS) {
        if (caseData[field] !== undefined) {
            projection[field] = caseData[field];
        }
    }

    // Ensure ID is present
    projection.id = caseId;

    // Derived fields for UX
    projection.isDone = caseData.status === 'DONE';
    projection.reportReady = projection.isDone && caseData.reportReady !== false;

    // Persist to client-safe collection
    const projectionRef = db().collection('clientCaseList').doc(caseId);
    await projectionRef.set(projection, { merge: true });
}

module.exports = {
    syncClientCaseListProjection,
    SAFE_LIST_FIELDS,
};
