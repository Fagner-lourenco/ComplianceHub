'use strict';

const V2_MINI_RELATIONSHIPS_VERSION = 'v2-mini-rel-2026-04-21';

const RELATIONSHIP_TYPES = {
    SAME_SUBJECT: 'same_subject',       // same CPF/CNPJ in multiple cases
    COMPANY_PERSON: 'company_person',   // CPF linked to a CNPJ (person in company)
    PERSON_COMPANY: 'person_company',   // CNPJ linked to CPF (company with person)
    CO_OCCURRENCE: 'co_occurrence',     // two subjects appear in same case context
};

const RELATIONSHIP_CONFIDENCE = {
    EXACT: 'exact',       // document match
    HIGH: 'high',         // name + partial document
    MEDIUM: 'medium',     // name only or inferred
};

function buildRelationshipId(fromId, toId, type) {
    const sorted = [fromId, toId].sort();
    return `rel_${type}_${sorted[0]}_${sorted[1]}`;
}

function asText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return '';
    }
}

function collectDocumentRefsFromItem(item = {}) {
    const searchable = [
        item.rawData,
        item.data,
        item.normalized,
        item.sourceRefs,
        item.summary,
        item.reason,
        item.value,
    ].map(asText).join(' ');

    const cnpjs = new Set(searchable.match(/\b\d{14}\b/g) || []);
    const cpfs = new Set(searchable.match(/\b\d{11}\b/g) || []);

    return {
        cnpjs,
        cpfs,
        sourceId: item.id || item.providerRecordId || item.evidenceId || null,
    };
}

// Derives relationships from an array of subjects that share a case context.
function deriveRelationshipsFromSubjects(subjects = []) {
    if (!subjects || subjects.length < 2) return [];

    const relationships = [];
    for (let i = 0; i < subjects.length; i++) {
        for (let j = i + 1; j < subjects.length; j++) {
            const a = subjects[i];
            const b = subjects[j];
            if (!a.id || !b.id) continue;

            const aIsPF = a.type === 'pf';
            const bIsPJ = b.type === 'pj';
            const aIsPJ = a.type === 'pj';
            const bIsPF = b.type === 'pf';

            const docA = a.primaryDocument?.docValue;
            const docB = b.primaryDocument?.docValue;
            const exactDocMatch = docA && docB && docA === docB;

            let type = RELATIONSHIP_TYPES.CO_OCCURRENCE;
            let confidence = RELATIONSHIP_CONFIDENCE.MEDIUM;

            if (exactDocMatch) {
                type = RELATIONSHIP_TYPES.SAME_SUBJECT;
                confidence = RELATIONSHIP_CONFIDENCE.EXACT;
            } else if (aIsPF && bIsPJ) {
                type = RELATIONSHIP_TYPES.COMPANY_PERSON;
                confidence = RELATIONSHIP_CONFIDENCE.MEDIUM;
            } else if (aIsPJ && bIsPF) {
                type = RELATIONSHIP_TYPES.PERSON_COMPANY;
                confidence = RELATIONSHIP_CONFIDENCE.MEDIUM;
            }

            relationships.push({
                id: buildRelationshipId(a.id, b.id, type),
                fromSubjectId: a.id,
                toSubjectId: b.id,
                fromName: a.declaredName || null,
                toName: b.declaredName || null,
                fromType: a.type,
                toType: b.type,
                type,
                confidence,
                version: V2_MINI_RELATIONSHIPS_VERSION,
            });
        }
    }
    return relationships;
}

// Derives relationships from evidence items that reference other entities.
function deriveRelationshipsFromEvidence(caseId, evidenceItems = []) {
    if (!evidenceItems.length) return [];

    const cnpjRefs = new Map();
    const cpfRefs = new Map();

    const addRef = (target, value, sourceId) => {
        if (!target.has(value)) target.set(value, new Set());
        if (sourceId) target.get(value).add(sourceId);
    };

    for (const item of evidenceItems) {
        const { cnpjs, cpfs, sourceId } = collectDocumentRefsFromItem(item);
        cnpjs.forEach((value) => addRef(cnpjRefs, value, sourceId));
        cpfs.forEach((value) => addRef(cpfRefs, value, sourceId));
    }

    const relationships = [];
    for (const [cnpj, cnpjSourceIds] of cnpjRefs.entries()) {
        for (const [cpf, cpfSourceIds] of cpfRefs.entries()) {
            relationships.push({
                id: buildRelationshipId(`cnpj_${cnpj}`, `cpf_${cpf}`, RELATIONSHIP_TYPES.COMPANY_PERSON),
                fromSubjectId: null,
                toSubjectId: null,
                fromDocument: { docType: 'cnpj', docValue: cnpj },
                toDocument: { docType: 'cpf', docValue: cpf },
                type: RELATIONSHIP_TYPES.COMPANY_PERSON,
                confidence: RELATIONSHIP_CONFIDENCE.MEDIUM,
                derivedFromCaseId: caseId,
                sourceItemIds: [...new Set([...cnpjSourceIds, ...cpfSourceIds])],
                version: V2_MINI_RELATIONSHIPS_VERSION,
            });
        }
    }
    return relationships;
}

function buildRelationshipsForCase({
    tenantId = null,
    caseId = null,
    subjectId = null,
    productKey = null,
    evidenceItems = [],
    providerRecords = [],
    createdAt = null,
} = {}) {
    if (!caseId) return [];
    const sourceItems = [
        ...evidenceItems,
        ...providerRecords,
    ];
    return deriveRelationshipsFromEvidence(caseId, sourceItems).map((relationship) => ({
        ...relationship,
        tenantId,
        caseId,
        subjectId,
        productKey,
        visibility: 'internal',
        status: 'auto_created',
        sourceKind: 'v2_mini_relationships',
        createdAt,
        updatedAt: createdAt,
    }));
}

function summarizeRelationships(relationships = []) {
    const byType = {};
    for (const rel of relationships) {
        byType[rel.type] = (byType[rel.type] || 0) + 1;
    }
    return {
        total: relationships.length,
        byType,
        hasExactMatches: relationships.some((r) => r.confidence === RELATIONSHIP_CONFIDENCE.EXACT),
    };
}

module.exports = {
    V2_MINI_RELATIONSHIPS_VERSION,
    RELATIONSHIP_TYPES,
    RELATIONSHIP_CONFIDENCE,
    buildRelationshipId,
    deriveRelationshipsFromSubjects,
    deriveRelationshipsFromEvidence,
    buildRelationshipsForCase,
    summarizeRelationships,
};
