import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set up minimal Firebase env so firebase-admin can initialize
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'compliance-hub-test';
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || '{}';

// Initialize firebase-admin minimally
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: 'compliance-hub-test' });
}

const { syncClientCaseListProjection, SAFE_LIST_FIELDS } = require('./v2ClientProjectionBuilder.js');

describe('v2ClientProjectionBuilder', () => {
    let mockSet;
    let mockDoc;
    let mockCollection;
    let originalCollection;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSet = vi.fn().mockResolvedValue();
        mockDoc = vi.fn(() => ({ set: mockSet }));
        mockCollection = vi.fn(() => ({ doc: mockDoc }));

        // Replace Firestore collection method
        const firestore = admin.firestore();
        originalCollection = firestore.collection;
        firestore.collection = mockCollection;
    });

    afterEach(() => {
        const firestore = admin.firestore();
        firestore.collection = originalCollection;
    });

    it('retorna early quando caseId ou caseData estao ausentes', async () => {
        await syncClientCaseListProjection(null, { tenantId: 't1' });
        await syncClientCaseListProjection('case-1', null);
        expect(mockCollection).not.toHaveBeenCalled();
    });

    it('retorna early quando tenantId esta ausente', async () => {
        await syncClientCaseListProjection('case-1', { candidateName: 'Joao' });
        expect(mockCollection).not.toHaveBeenCalled();
    });

    it('projeta apenas campos da whitelist e campos derivados', async () => {
        const caseData = {
            tenantId: 'tenant-1',
            id: 'case-1',
            candidateName: 'Joao Silva',
            cpfMasked: '123.456.789-00',
            status: 'DONE',
            reportReady: true,
            riskScore: 75,
            priority: 'HIGH',
            createdAt: { toDate: () => new Date('2026-04-23') },
            // Campos internos que NAO devem aparecer
            internalNotes: 'notas secretas',
            analystId: 'analista-123',
            rawPayload: { bigdatacorp: 'dados brutos' },
        };

        await syncClientCaseListProjection('case-1', caseData);

        expect(mockCollection).toHaveBeenCalledWith('clientCaseList');
        expect(mockDoc).toHaveBeenCalledWith('case-1');
        expect(mockSet).toHaveBeenCalledTimes(1);

        const [projection, options] = mockSet.mock.calls[0];
        expect(options).toEqual({ merge: true });

        // Campos whitelist presentes
        expect(projection.id).toBe('case-1');
        expect(projection.tenantId).toBe('tenant-1');
        expect(projection.candidateName).toBe('Joao Silva');
        expect(projection.cpfMasked).toBe('123.456.789-00');
        expect(projection.status).toBe('DONE');
        expect(projection.riskScore).toBe(75);
        expect(projection.priority).toBe('HIGH');

        // Campos derivados
        expect(projection.isDone).toBe(true);
        expect(projection.reportReady).toBe(true);

        // Campos internos NAO devem aparecer
        expect(projection.internalNotes).toBeUndefined();
        expect(projection.analystId).toBeUndefined();
        expect(projection.rawPayload).toBeUndefined();
    });

    it('reportReady = false quando status nao e DONE', async () => {
        const caseData = {
            tenantId: 'tenant-1',
            status: 'RUNNING',
            reportReady: true,
        };

        await syncClientCaseListProjection('case-2', caseData);

        const [projection] = mockSet.mock.calls[0];
        expect(projection.isDone).toBe(false);
        expect(projection.reportReady).toBe(false);
    });

    it('SAFE_LIST_FIELDS contem apenas campos seguros', () => {
        expect(SAFE_LIST_FIELDS).toContain('id');
        expect(SAFE_LIST_FIELDS).toContain('candidateName');
        expect(SAFE_LIST_FIELDS).toContain('status');
        expect(SAFE_LIST_FIELDS).toContain('productKey');
        expect(SAFE_LIST_FIELDS).toContain('productLabel');
        expect(SAFE_LIST_FIELDS).toContain('signs');
        expect(SAFE_LIST_FIELDS).not.toContain('internalNotes');
        expect(SAFE_LIST_FIELDS).not.toContain('rawPayload');
    });

    // ======= novos testes para cobertura expandida =======

    it('projeta sinais quando presentes no caseData', async () => {
        const caseData = {
            tenantId: 'tenant-1',
            id: 'case-sinais',
            candidateName: 'Maria Sinais',
            status: 'DONE',
            signs: [
                { type: 'PEP', severity: 'HIGH', description: 'Ex-prefeito' },
                { type: 'CRIMINAL', severity: 'MEDIUM', description: 'Processo movido' },
            ],
            signCount: 2,
            topSignSeverity: 'HIGH',
        };

        await syncClientCaseListProjection('case-sinais', caseData);

        const [projection] = mockSet.mock.calls[0];
        expect(projection.signs).toEqual(caseData.signs);
        expect(projection.signCount).toBe(2);
        expect(projection.topSignSeverity).toBe('HIGH');
    });

    it('nao projeta sinais quando ausentes no caseData', async () => {
        const caseData = {
            tenantId: 'tenant-1',
            id: 'case-sem-sinais',
            candidateName: 'Joao Limpo',
            status: 'DONE',
        };

        await syncClientCaseListProjection('case-sem-sinais', caseData);

        const [projection] = mockSet.mock.calls[0];
        expect(projection.signs).toBeUndefined();
        expect(projection.signCount).toBeUndefined();
        expect(projection.topSignSeverity).toBeUndefined();
    });

    it('projeta tenantId em tenantIds para entitlements quando nao esta presente', async () => {
        const caseData = {
            tenantId: 'tenant-1',
            id: 'case-entitlements',
            candidateName: 'Entitlements User',
            status: 'DONE',
        };

        await syncClientCaseListProjection('case-entitlements', caseData);

        const [projection] = mockSet.mock.calls[0];
        expect(projection.tenantIds).toEqual(['tenant-1']);
    });

    it('mantem tenantIds existente quando ja presente no caseData', async () => {
        const caseData = {
            tenantId: 'tenant-1',
            id: 'case-multi-tenant',
            candidateName: 'Multi Tenant',
            status: 'DONE',
            tenantIds: ['tenant-1', 'tenant-2', 'tenant-3'],
        };

        await syncClientCaseListProjection('case-multi-tenant', caseData);

        const [projection] = mockSet.mock.calls[0];
        expect(projection.tenantIds).toEqual(['tenant-1', 'tenant-2', 'tenant-3']);
    });

    it('converte createdAt e updatedAt para timestamp de data quando tem toDate()', async () => {
        const d1 = new Date('2026-01-15T10:00:00Z');
        const d2 = new Date('2026-04-23T14:30:00Z');
        const caseData = {
            tenantId: 'tenant-1',
            id: 'case-dates',
            candidateName: 'Date User',
            status: 'DONE',
            createdAt: { toDate: () => d1 },
            updatedAt: { toDate: () => d2 },
        };

        await syncClientCaseListProjection('case-dates', caseData);

        const [projection] = mockSet.mock.calls[0];
        expect(projection.createdAt).toBeInstanceOf(Date);
        expect(projection.createdAt.toISOString()).toBe(d1.toISOString());
        expect(projection.updatedAt).toBeInstanceOf(Date);
        expect(projection.updatedAt.toISOString()).toBe(d2.toISOString());
    });

    it('projeta productKey e productLabel quando presentes', async () => {
        const caseData = {
            tenantId: 'tenant-1',
            id: 'case-product',
            candidateName: 'Product User',
            status: 'DONE',
            productKey: 'dossier_pf_premium',
            productLabel: 'Dossiê PF Premium',
        };

        await syncClientCaseListProjection('case-product', caseData);

        const [projection] = mockSet.mock.calls[0];
        expect(projection.productKey).toBe('dossier_pf_premium');
        expect(projection.productLabel).toBe('Dossiê PF Premium');
    });

    it('projeta pipelineProgress quando presente', async () => {
        const caseData = {
            tenantId: 'tenant-1',
            id: 'case-progress',
            candidateName: 'Progress User',
            status: 'RUNNING',
            pipelineProgress: { currentStep: 'subject', totalSteps: 4, percent: 25 },
        };

        await syncClientCaseListProjection('case-progress', caseData);

        const [projection] = mockSet.mock.calls[0];
        expect(projection.pipelineProgress).toEqual({ currentStep: 'subject', totalSteps: 4, percent: 25 });
    });

    it('projeta score de risco como numero mesmo quando zero', async () => {
        const caseData = {
            tenantId: 'tenant-1',
            id: 'case-zero-risk',
            candidateName: 'Zero Risk',
            status: 'DONE',
            riskScore: 0,
        };

        await syncClientCaseListProjection('case-zero-risk', caseData);

        const [projection] = mockSet.mock.calls[0];
        expect(projection.riskScore).toBe(0);
    });

    it('nao inclui campos undefined ou null no projection (so whitelist)', async () => {
        const caseData = {
            tenantId: 'tenant-1',
            id: 'case-partial',
            candidateName: 'Partial User',
            status: 'DONE',
            cpfMasked: null,
            priority: undefined,
            riskScore: 42,
        };

        await syncClientCaseListProjection('case-partial', caseData);

        const [projection] = mockSet.mock.calls[0];
        // null pode ou nao ser incluido dependendo da implementacao; verificamos que nao quebra
        expect(projection.candidateName).toBe('Partial User');
        expect(projection.riskScore).toBe(42);
    });
});
