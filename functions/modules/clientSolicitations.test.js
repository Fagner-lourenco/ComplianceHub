/**
 * clientSolicitations.test.js — Testes unitários para handlers de solicitação e correção
 */

const { HttpsError } = require('firebase-functions/v2/https');
const {
    createClientSolicitationHandler,
    submitClientCorrectionHandler,
} = require('./clientSolicitations');

/* =========================================================
   Mocks comuns
   ========================================================= */

const VALID_CPF = '11144477735';
const VALID_CPF_2 = '52998224725';

function makeMockDb(overrides = {}) {
    const docs = new Map();
    const docRefs = new Map();
    const batchOps = [];

    const mockDoc = (id, initialData = null) => {
        if (docRefs.has(id)) return docRefs.get(id);
        let currentData = initialData;
        const ref = {
            id,
            set: vi.fn((payload) => {
                currentData = payload;
                docs.set(id, payload);
                batchOps.push({ type: 'set', id, payload });
            }),
            update: vi.fn((payload) => {
                const existing = docs.get(id) || {};
                currentData = { ...existing, ...payload };
                docs.set(id, currentData);
                batchOps.push({ type: 'update', id, payload });
            }),
            get: vi.fn(() => Promise.resolve({ exists: currentData !== null, data: () => currentData, id })),
        };
        docRefs.set(id, ref);
        return ref;
    };

    const db = {
        collection: vi.fn((col) => ({
            doc: vi.fn((id) => {
                const key = `${col}/${id}`;
                if (!docs.has(key) && overrides[key]) {
                    docs.set(key, overrides[key]);
                    return mockDoc(key, overrides[key]);
                }
                return mockDoc(key, docs.get(key) || null);
            }),
        })),
        batch: vi.fn(() => ({
            set: vi.fn((ref, payload) => ref.set(payload)),
            update: vi.fn((ref, payload) => ref.update(payload)),
            commit: vi.fn(() => Promise.resolve()),
        })),
    };

    return { db, docs, docRefs, batchOps };
}

const mockFieldValue = {
    serverTimestamp: vi.fn(() => 'timestamp'),
    delete: vi.fn(() => 'deleted'),
    increment: vi.fn((n) => ({ _methodName: 'FieldValue.increment', n })),
};

function makeBaseDeps(overrides = {}) {
    const { db } = makeMockDb(overrides.docs || {});
    return {
        db,
        FieldValue: mockFieldValue,
        Timestamp: mockFieldValue.serverTimestamp,
        getClientUserProfile: vi.fn(() => Promise.resolve({
            tenantId: 'tenant-1',
            tenantName: 'Tenant Test',
            email: 'client@example.com',
            displayName: 'Client User',
            role: 'client_manager',
        })),
        getTenantSettingsData: vi.fn(() => Promise.resolve({
            analysisConfig: {},
            slaHours: 48,
        })),
        assertClientManager: vi.fn(),
        writeAuditEvent: vi.fn(() => Promise.resolve()),
        ACTOR_TYPE: { CLIENT_USER: 'CLIENT_USER' },
        SOURCE: { PORTAL_CLIENT: 'PORTAL_CLIENT' },
        notificationService: {
            createNewSolicitationNotifications: vi.fn(() => Promise.resolve()),
        },
        enforceTenantSubmissionLimits: vi.fn(() => Promise.resolve({ dailyCount: 1, monthlyCount: 1, exceeded: false })),
        compensateTenantSubmissionLimit: vi.fn(() => Promise.resolve()),
        getClientIp: vi.fn(() => '127.0.0.1'),
        getOpsUserProfile: vi.fn(),
        caseComm: {},
        ...overrides,
    };
}

/* =========================================================
   createClientSolicitationHandler
   ========================================================= */

describe('createClientSolicitationHandler', () => {
    it('cria solicitacao com sucesso (happy path)', async () => {
        const deps = makeBaseDeps();
        const handler = createClientSolicitationHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: {
                fullName: 'Joao Silva',
                cpf: VALID_CPF,
                dateOfBirth: '1990-01-01',
                position: 'Analista',
                department: 'TI',
                hiringUf: 'SP',
                candidateResidenceUf: 'RJ',
                email: 'joao@example.com',
                phone: '11999999999',
                priority: 'NORMAL',
                digitalProfileNotes: 'Notas',
                socialProfiles: { linkedin: 'https://linkedin.com/in/joao' },
                otherSocialUrls: [{ label: 'Blog', url: 'https://blog.com' }],
            },
        };

        const result = await handler(request);

        expect(result.caseId).toBeTruthy();
        expect(result.candidateId).toBeTruthy();
        const caseRef = deps.db.collection('cases').doc();
        const createdCase = (await caseRef.get()).data();
        expect(createdCase.escavador2EnrichmentStatus).toBe('PENDING');
        expect(createdCase.escavador2Error).toBeNull();
        expect(deps.writeAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'SOLICITATION_CREATED' })
        );
        expect(deps.notificationService.createNewSolicitationNotifications).toHaveBeenCalled();
    });

    it('inicializa creditEnrichmentStatus PENDING quando fase habilitada no tenant', async () => {
        const deps = makeBaseDeps({
            getTenantSettingsData: vi.fn(() => Promise.resolve({
                analysisConfig: { criminal: { enabled: true }, creditRestriction: { enabled: true } },
                slaHours: 48,
            })),
        });
        const handler = createClientSolicitationHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { fullName: 'Joao Silva', cpf: VALID_CPF, candidateResidenceUf: 'RJ' },
        };

        await handler(request);

        const caseRef = deps.db.collection('cases').doc();
        const createdCase = (await caseRef.get()).data();
        expect(createdCase.enabledPhases).toContain('creditRestriction');
        expect(createdCase.creditEnrichmentStatus).toBe('PENDING');
        expect(createdCase.creditError).toBeNull();
    });

    it('nao inicializa creditEnrichmentStatus quando fase nao habilitada (inclusive fallback)', async () => {
        const deps = makeBaseDeps();
        const handler = createClientSolicitationHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { fullName: 'Joao Silva', cpf: VALID_CPF, candidateResidenceUf: 'RJ' },
        };

        await handler(request);

        const caseRef = deps.db.collection('cases').doc();
        const createdCase = (await caseRef.get()).data();
        expect(createdCase.enabledPhases).not.toContain('creditRestriction');
        expect(createdCase.creditEnrichmentStatus).toBeUndefined();
    });

    it('rejeita quando nao ha autenticacao', async () => {
        const deps = makeBaseDeps();
        const handler = createClientSolicitationHandler(deps);
        const request = { auth: null, data: {} };

        await expect(handler(request)).rejects.toThrow('Autenticacao necessaria.');
    });

    it('rejeita role invalida', async () => {
        const deps = makeBaseDeps();
        deps.getClientUserProfile = vi.fn(() =>
            Promise.reject(new Error('permission-denied'))
        );
        const handler = createClientSolicitationHandler(deps);
        const request = { auth: { uid: 'user-1' }, data: {} };

        await expect(handler(request)).rejects.toThrow('permission-denied');
    });

    it('rejeita payload invalido (nome curto)', async () => {
        const deps = makeBaseDeps();
        const handler = createClientSolicitationHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { fullName: 'Jo', cpf: VALID_CPF, candidateResidenceUf: 'RJ' },
        };

        await expect(handler(request)).rejects.toThrow('Nome completo deve ter no minimo 3 caracteres');
    });

    it('rejeita CPF invalido', async () => {
        const deps = makeBaseDeps();
        const handler = createClientSolicitationHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { fullName: 'Joao Silva', cpf: '00000000000', candidateResidenceUf: 'RJ' },
        };

        await expect(handler(request)).rejects.toThrow('CPF valido e obrigatorio');
    });

    it('rejeita quando quota diaria excedida', async () => {
        const deps = makeBaseDeps();
        deps.enforceTenantSubmissionLimits = vi.fn(() =>
            Promise.reject(new Error('resource-exhausted'))
        );
        const handler = createClientSolicitationHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { fullName: 'Joao Silva', cpf: VALID_CPF, candidateResidenceUf: 'RJ' },
        };

        await expect(handler(request)).rejects.toThrow('resource-exhausted');
    });

    it('compensa quota quando batch commit falha', async () => {
        const { db } = makeMockDb();
        db.batch = vi.fn(() => ({
            set: vi.fn(),
            update: vi.fn(),
            commit: vi.fn(() => Promise.reject(new Error('commit fail'))),
        }));

        const deps = makeBaseDeps({ db });
        const handler = createClientSolicitationHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { fullName: 'Joao Silva', cpf: VALID_CPF, candidateResidenceUf: 'RJ' },
        };

        await expect(handler(request)).rejects.toThrow('commit fail');
        expect(deps.compensateTenantSubmissionLimit).toHaveBeenCalledWith('tenant-1');
    });

    it('rejeita UF de residencia invalida', async () => {
        const deps = makeBaseDeps();
        const handler = createClientSolicitationHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: {
                fullName: 'Joao Silva',
                cpf: VALID_CPF,
                candidateResidenceUf: 'XX',
            },
        };

        await expect(handler(request)).rejects.toThrow('UF de residencia invalida');
    });
});

/* =========================================================
   submitClientCorrectionHandler
   ========================================================= */

describe('submitClientCorrectionHandler', () => {
    function makeCorrectionDeps(caseData = {}) {
        const { db } = makeMockDb({
            'cases/case-1': {
                tenantId: 'tenant-1',
                status: 'CORRECTION_NEEDED',
                candidateId: 'candidate-1',
                candidateName: 'Joao Silva',
                cpf: VALID_CPF,
                socialProfiles: {},
                otherSocialUrls: [],
                corrections: [],
                ...caseData,
            },
            'candidates/candidate-1': {
                candidateName: 'Joao Silva',
                cpf: VALID_CPF,
            },
        });
        return makeBaseDeps({ db });
    }

    it('corrige caso com sucesso (happy path)', async () => {
        const deps = makeCorrectionDeps();
        const handler = submitClientCorrectionHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: {
                caseId: 'case-1',
                candidateName: 'Joao Silva Corrigido',
                cpf: VALID_CPF,
                linkedin: 'https://linkedin.com/in/joao2',
            },
        };

        const result = await handler(request);
        expect(result.success).toBe(true);
    });

    it('rejeita quando caso nao existe', async () => {
        const { db } = makeMockDb();
        const deps = makeBaseDeps({ db });
        const handler = submitClientCorrectionHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { caseId: 'case-ghost', candidateName: 'Joao', cpf: VALID_CPF },
        };

        await expect(handler(request)).rejects.toThrow('Caso nao encontrado.');
    });

    it('rejeita quando tenant nao coincide', async () => {
        const deps = makeCorrectionDeps({ tenantId: 'tenant-2' });
        const handler = submitClientCorrectionHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { caseId: 'case-1', candidateName: 'Joao', cpf: VALID_CPF },
        };

        await expect(handler(request)).rejects.toThrow('Caso fora do tenant do cliente.');
    });

    it('rejeita quando status nao é CORRECTION_NEEDED', async () => {
        const deps = makeCorrectionDeps({ status: 'PENDING' });
        const handler = submitClientCorrectionHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { caseId: 'case-1', candidateName: 'Joao', cpf: VALID_CPF },
        };

        await expect(handler(request)).rejects.toThrow('Apenas casos com correcao solicitada podem ser reenviados.');
    });

    it('reseta credit ao corrigir quando fase habilitada no caso', async () => {
        const deps = makeCorrectionDeps({
            enabledPhases: ['criminal', 'creditRestriction'],
            creditEnrichmentStatus: 'SKIPPED',
        });
        const handler = submitClientCorrectionHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { caseId: 'case-1', candidateName: 'Joao', cpf: VALID_CPF },
        };

        await handler(request);

        const caseRef = deps.db.collection('cases').doc('case-1');
        const payload = caseRef.update.mock.calls[0][0];
        expect(payload.creditEnrichmentStatus).toBe('PENDING');
        expect(payload.creditError).toBeNull();
        expect(payload.creditRestrictionFlag).toBe('deleted');
        expect(payload.creditQuantumScore).toBe('deleted');
    });

    it('nao reseta credit quando fase nao habilitada no caso', async () => {
        const deps = makeCorrectionDeps({ enabledPhases: ['criminal'] });
        const handler = submitClientCorrectionHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { caseId: 'case-1', candidateName: 'Joao', cpf: VALID_CPF },
        };

        await handler(request);

        const caseRef = deps.db.collection('cases').doc('case-1');
        const payload = caseRef.update.mock.calls[0][0];
        expect(payload.creditEnrichmentStatus).toBeUndefined();
    });

    it('reseta providers ao corrigir', async () => {
        const deps = makeCorrectionDeps();
        const handler = submitClientCorrectionHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { caseId: 'case-1', candidateName: 'Joao', cpf: VALID_CPF },
        };

        await handler(request);

        const caseRef = deps.db.collection('cases').doc('case-1');
        const updateCall = caseRef.update.mock.calls[0];
        const payload = updateCall[0];
        expect(payload.bigdatacorpEnrichmentStatus).toBe('PENDING');
        expect(payload.juditEnrichmentStatus).toBe('PENDING');
        expect(payload.escavadorEnrichmentStatus).toBe('PENDING');
        expect(payload.escavador2EnrichmentStatus).toBe('PENDING');
        expect(payload.escavador2Error).toBeNull();
        expect(payload.djenEnrichmentStatus).toBe('PENDING');
        expect(payload.enrichmentStatus).toBe('PENDING');
        expect(payload.status).toBe('PENDING');
        expect(payload.enrichmentGeneration).toEqual(expect.objectContaining({ _methodName: 'FieldValue.increment' }));
        const deletedEscavador2Fields = [
            'escavador2ApiStatus',
            'escavador2ProcessTotal',
            'escavador2Processos',
            'escavador2CriminalFlag',
            'escavador2CriminalCount',
            'escavador2LaborFlag',
            'escavador2LaborCount',
            'escavador2MaterialRiskCount',
            'escavador2CnjMaskedCount',
            'escavador2CnjExtractedCount',
            'escavador2DuplicateCount',
            'escavador2NewFindingCount',
            'escavador2HasNewMaterialRisk',
            'escavador2PartialErrors',
            'escavador2Stats',
            'escavador2Sources',
            'escavador2RawPayloads',
            'escavador2CostBRL',
            'escavador2EnrichedAt',
        ];
        for (const field of deletedEscavador2Fields) {
            expect(payload[field], `expected ${field} to be deleted`).toBe('deleted');
        }
    });

    it('cria registro de auditoria CASE_CORRECTED', async () => {
        const deps = makeCorrectionDeps();
        const handler = submitClientCorrectionHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { caseId: 'case-1', candidateName: 'Joao', cpf: VALID_CPF },
        };

        await handler(request);
        expect(deps.writeAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'CASE_CORRECTED' })
        );
    });

    it('cria mensagem de sistema na comunicacao', async () => {
        const deps = makeCorrectionDeps();
        const handler = submitClientCorrectionHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { caseId: 'case-1', candidateName: 'Joao', cpf: VALID_CPF },
        };

        await handler(request);
        expect(deps.writeAuditEvent).toHaveBeenCalled();
    });

    it('rejeita CPF invalido na correcao', async () => {
        const deps = makeCorrectionDeps();
        const handler = submitClientCorrectionHandler(deps);
        const request = {
            auth: { uid: 'user-1' },
            data: { caseId: 'case-1', candidateName: 'Joao', cpf: '00000000000' },
        };

        await expect(handler(request)).rejects.toThrow('CPF invalido para reenviar o caso.');
    });

    it('rejeita quando nao ha autenticacao', async () => {
        const deps = makeCorrectionDeps();
        const handler = submitClientCorrectionHandler(deps);
        const request = { auth: null, data: { caseId: 'case-1', candidateName: 'Joao', cpf: VALID_CPF } };

        await expect(handler(request)).rejects.toThrow('Autenticacao necessaria.');
    });
});
