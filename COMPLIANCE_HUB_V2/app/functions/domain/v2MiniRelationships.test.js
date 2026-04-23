import { describe, it, expect } from 'vitest';
import {
    RELATIONSHIP_TYPES,
    RELATIONSHIP_CONFIDENCE,
    buildRelationshipId,
    deriveRelationshipsFromSubjects,
    deriveRelationshipsFromEvidence,
    buildRelationshipsForCase,
    summarizeRelationships,
    V2_MINI_RELATIONSHIPS_VERSION,
} from './v2MiniRelationships.cjs';

describe('buildRelationshipId', () => {
    it('produces stable id regardless of arg order', () => {
        const a = buildRelationshipId('id_A', 'id_B', 'co_occurrence');
        const b = buildRelationshipId('id_B', 'id_A', 'co_occurrence');
        expect(a).toBe(b);
    });

    it('includes type in id', () => {
        const id = buildRelationshipId('x', 'y', 'same_subject');
        expect(id).toContain('same_subject');
    });
});

describe('deriveRelationshipsFromSubjects', () => {
    it('returns empty for < 2 subjects', () => {
        expect(deriveRelationshipsFromSubjects([])).toEqual([]);
        expect(deriveRelationshipsFromSubjects([{ id: 'a', type: 'pf' }])).toEqual([]);
    });

    it('detects same_subject when docs match', () => {
        const subjects = [
            { id: 'a', type: 'pf', primaryDocument: { docValue: '12345678901' }, declaredName: 'Alice' },
            { id: 'b', type: 'pf', primaryDocument: { docValue: '12345678901' }, declaredName: 'Alice B' },
        ];
        const rels = deriveRelationshipsFromSubjects(subjects);
        expect(rels).toHaveLength(1);
        expect(rels[0].type).toBe(RELATIONSHIP_TYPES.SAME_SUBJECT);
        expect(rels[0].confidence).toBe(RELATIONSHIP_CONFIDENCE.EXACT);
    });

    it('detects company_person for pf+pj pair', () => {
        const subjects = [
            { id: 'pf1', type: 'pf', primaryDocument: { docValue: '11111111111' } },
            { id: 'pj1', type: 'pj', primaryDocument: { docValue: '22222222222222' } },
        ];
        const rels = deriveRelationshipsFromSubjects(subjects);
        expect(rels).toHaveLength(1);
        expect(rels[0].type).toBe(RELATIONSHIP_TYPES.COMPANY_PERSON);
    });

    it('detects person_company for pj+pf pair', () => {
        const subjects = [
            { id: 'pj1', type: 'pj', primaryDocument: { docValue: '22222222222222' } },
            { id: 'pf1', type: 'pf', primaryDocument: { docValue: '11111111111' } },
        ];
        const rels = deriveRelationshipsFromSubjects(subjects);
        expect(rels).toHaveLength(1);
        expect(rels[0].type).toBe(RELATIONSHIP_TYPES.PERSON_COMPANY);
    });

    it('defaults to co_occurrence for pf+pf with different docs', () => {
        const subjects = [
            { id: 'a', type: 'pf', primaryDocument: { docValue: '11111111111' } },
            { id: 'b', type: 'pf', primaryDocument: { docValue: '22222222222' } },
        ];
        const rels = deriveRelationshipsFromSubjects(subjects);
        expect(rels[0].type).toBe(RELATIONSHIP_TYPES.CO_OCCURRENCE);
        expect(rels[0].confidence).toBe(RELATIONSHIP_CONFIDENCE.MEDIUM);
    });

    it('skips pairs with missing ids', () => {
        const subjects = [
            { id: null, type: 'pf' },
            { id: 'b', type: 'pj' },
        ];
        expect(deriveRelationshipsFromSubjects(subjects)).toHaveLength(0);
    });

    it('attaches version and names', () => {
        const subjects = [
            { id: 'a', type: 'pf', declaredName: 'Alice', primaryDocument: { docValue: '111' } },
            { id: 'b', type: 'pf', declaredName: 'Bob', primaryDocument: { docValue: '222' } },
        ];
        const rel = deriveRelationshipsFromSubjects(subjects)[0];
        expect(rel.version).toBe(V2_MINI_RELATIONSHIPS_VERSION);
        expect(rel.fromName).toBe('Alice');
        expect(rel.toName).toBe('Bob');
    });

    it('produces N*(N-1)/2 pairs for N subjects', () => {
        const subjects = [
            { id: 'a', type: 'pf', primaryDocument: { docValue: '1' } },
            { id: 'b', type: 'pf', primaryDocument: { docValue: '2' } },
            { id: 'c', type: 'pj', primaryDocument: { docValue: '3' } },
        ];
        expect(deriveRelationshipsFromSubjects(subjects)).toHaveLength(3);
    });
});

describe('deriveRelationshipsFromEvidence', () => {
    it('returns empty when no items', () => {
        expect(deriveRelationshipsFromEvidence('case1', [])).toEqual([]);
    });

    it('extracts cnpj+cpf and produces company_person pairs', () => {
        const items = [
            { rawData: { cnpj: '12345678000195', cpf: '98765432100' } },
        ];
        const rels = deriveRelationshipsFromEvidence('case1', items);
        expect(rels.length).toBeGreaterThan(0);
        expect(rels[0].type).toBe(RELATIONSHIP_TYPES.COMPANY_PERSON);
        expect(rels[0].fromDocument.docType).toBe('cnpj');
        expect(rels[0].toDocument.docType).toBe('cpf');
        expect(rels[0].derivedFromCaseId).toBe('case1');
    });

    it('deduplicates same cnpj across multiple items', () => {
        const items = [
            { rawData: { cnpj: '12345678000195', cpf: '98765432100' } },
            { rawData: { cnpj: '12345678000195', extra: 'data' } },
        ];
        const rels = deriveRelationshipsFromEvidence('case1', items);
        const fromDocs = rels.map((r) => r.fromDocument.docValue);
        const unique = [...new Set(fromDocs)];
        expect(fromDocs.length).toBe(unique.length);
    });

    it('handles items with data field instead of rawData', () => {
        const items = [
            { data: { cnpj: '12345678000195', cpf: '98765432100' } },
        ];
        const rels = deriveRelationshipsFromEvidence('case1', items);
        expect(rels.length).toBeGreaterThan(0);
    });

    it('extracts document refs from summary text and preserves source item ids', () => {
        const items = [
            { id: 'ev_1', summary: 'Socio CPF 98765432100 vinculado ao CNPJ 12345678000195.' },
        ];
        const rels = deriveRelationshipsFromEvidence('case1', items);
        expect(rels).toHaveLength(1);
        expect(rels[0].sourceItemIds).toEqual(['ev_1']);
    });
});

describe('buildRelationshipsForCase', () => {
    it('produces Firestore-ready relationship documents without raw provider payload', () => {
        const rels = buildRelationshipsForCase({
            tenantId: 'tenant-a',
            caseId: 'case1',
            subjectId: 'subject1',
            productKey: 'dossier_pj',
            createdAt: '2026-04-21T00:00:00.000Z',
            evidenceItems: [
                { id: 'ev_1', summary: 'Socio CPF 98765432100 vinculado ao CNPJ 12345678000195.' },
            ],
        });

        expect(rels).toHaveLength(1);
        expect(rels[0]).toMatchObject({
            tenantId: 'tenant-a',
            caseId: 'case1',
            subjectId: 'subject1',
            productKey: 'dossier_pj',
            visibility: 'internal',
            status: 'auto_created',
            sourceKind: 'v2_mini_relationships',
        });
        expect(rels[0].rawData).toBeUndefined();
        expect(rels[0].data).toBeUndefined();
    });
});

describe('summarizeRelationships', () => {
    it('returns zeros for empty array', () => {
        const s = summarizeRelationships([]);
        expect(s.total).toBe(0);
        expect(s.hasExactMatches).toBe(false);
    });

    it('counts by type correctly', () => {
        const rels = [
            { type: RELATIONSHIP_TYPES.SAME_SUBJECT, confidence: RELATIONSHIP_CONFIDENCE.EXACT },
            { type: RELATIONSHIP_TYPES.CO_OCCURRENCE, confidence: RELATIONSHIP_CONFIDENCE.MEDIUM },
            { type: RELATIONSHIP_TYPES.CO_OCCURRENCE, confidence: RELATIONSHIP_CONFIDENCE.MEDIUM },
        ];
        const s = summarizeRelationships(rels);
        expect(s.total).toBe(3);
        expect(s.byType[RELATIONSHIP_TYPES.CO_OCCURRENCE]).toBe(2);
        expect(s.hasExactMatches).toBe(true);
    });
});
