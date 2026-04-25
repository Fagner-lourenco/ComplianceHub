'use strict';

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

/** Lazy getter for Firestore */
let _db;
function db() {
    if (!_db) _db = getFirestore();
    return _db;
}

const { buildSubjectFromCase, buildSubjectUpdatePayload } = require('./v2Subjects.js');

/**
 * Normalizes a taxId string (digits only) and classifies it as CPF (11), CNPJ (14), or unknown.
 * Explicit taxIdType ('cpf' | 'cnpj') takes precedence when provided by the caller.
 */
function classifyTaxId(taxId, explicitType = null) {
    const digits = String(taxId || '').replace(/\D/g, '');
    if (explicitType === 'cpf' || explicitType === 'cnpj') {
        return { docType: explicitType, digits };
    }
    if (digits.length === 11) return { docType: 'cpf', digits };
    if (digits.length === 14) return { docType: 'cnpj', digits };
    return { docType: null, digits };
}

/**
 * Resolves a subject by taxId and tenantId.
 * Uses v2Subjects for canonical data building.
 *
 * Accepts either CPF (11 digits, PF) or CNPJ (14 digits, PJ). The caller may pass
 * `taxIdType` ('cpf' | 'cnpj') explicitly; otherwise it is inferred from digit length.
 */
async function resolveSubject({
    tenantId,
    taxId,
    taxIdType = null,
    name,
    caseId,
    caseData = {},
}) {
    if (!tenantId || !taxId) {
        throw new Error('resolveSubject: tenantId and taxId are required.');
    }

    const { docType, digits } = classifyTaxId(taxId, taxIdType);
    if (!docType) {
        throw new Error('resolveSubject: taxId must be a valid CPF (11) or CNPJ (14) digit string.');
    }

    const { subject, subjectId } = buildSubjectFromCase({
        caseId,
        caseData: {
            ...caseData,
            tenantId,
            candidateName: name || caseData.candidateName,
            ...(docType === 'cnpj'
                ? { cnpj: digits, cpf: null, productKey: caseData.productKey || 'dossier_pj' }
                : { cpf: digits }),
        }
    });

    const subjectRef = db().collection('subjects').doc(subjectId);
    const now = FieldValue.serverTimestamp();

    try {
        await db().runTransaction(async (transaction) => {
            const doc = await transaction.get(subjectRef);

            if (doc.exists) {
                const payload = buildSubjectUpdatePayload({
                    subject: doc.data(),
                    caseId,
                    arrayUnionSentinel: FieldValue.arrayUnion(caseId),
                    serverTimestamp: now,
                });
                transaction.update(subjectRef, payload);
            } else {
                transaction.set(subjectRef, {
                    ...subject,
                    createdAt: now,
                    updatedAt: now,
                });
            }
        });

        return subjectId;
    } catch (error) {
        console.error(`Error resolving subject ${subjectId}:`, error);
        throw error;
    }
}

/**
 * Updates a subject's risk profile based on a concluded case.
 */
async function updateSubjectRiskProfile(subjectId, { verdict, score, flags = [] }) {
    if (!subjectId) return;
    
    const subjectRef = db().collection('subjects').doc(subjectId);
    await subjectRef.update({
        'riskProfile.lastVerdict': verdict,
        'riskProfile.lastScore': score,
        'riskProfile.flags': FieldValue.arrayUnion(...flags),
        updatedAt: FieldValue.serverTimestamp(),
    }).catch(err => console.warn(`Failed to update risk profile for subject ${subjectId}:`, err.message));
}

module.exports = {
    resolveSubject,
    updateSubjectRiskProfile,
    classifyTaxId,
};
