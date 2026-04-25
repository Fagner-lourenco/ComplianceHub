import { vi } from 'vitest';

const firestoreServiceMocks = vi.hoisted(() => ({
    getDocs: vi.fn(),
    getFunctions: vi.fn(() => 'functions-instance'),
    httpsCallable: vi.fn(),
    onSnapshot: vi.fn(),
    currentUser: {
        getIdToken: vi.fn().mockResolvedValue('token-123'),
    },
}));

vi.mock('./config', () => ({
    auth: {
        app: {
            options: {
                projectId: 'demo-project',
            },
        },
        currentUser: firestoreServiceMocks.currentUser,
    },
    db: {},
    secondaryAuth: {},
}));

vi.mock('firebase/firestore', () => ({
    addDoc: vi.fn(),
    collection: vi.fn((_, collectionName) => ({ collectionName })),
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: (...args) => firestoreServiceMocks.getDocs(...args),
    limit: vi.fn((...args) => ({ kind: 'limit', args })),
    onSnapshot: (...args) => firestoreServiceMocks.onSnapshot(...args),
    orderBy: vi.fn((...args) => ({ kind: 'orderBy', args })),
    query: vi.fn((...args) => ({ kind: 'query', args })),
    serverTimestamp: vi.fn(() => 'server-ts'),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    where: vi.fn((...args) => ({ kind: 'where', args })),
}));

vi.mock('firebase/auth', () => ({
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
    getFunctions: (...args) => firestoreServiceMocks.getFunctions(...args),
    httpsCallable: (...args) => firestoreServiceMocks.httpsCallable(...args),
}));

const {
    fetchCases,
    fetchClients,
    fetchExports,
    fetchClientPublicReports,
    revokeClientPublicReport,
    subscribeToClientCases,
    subscribeToClientProjections,
    subscribeToRelationshipsForCase,
    subscribeToTimelineEventsForCase,
    subscribeToProviderDivergencesForCase,
    fetchSubjectHistory,
    fetchSubjectDecisionHistory,
    callMarkProductIntroSeen,
    callResolveProviderDivergenceByAnalyst,
    callGetTenantBillingOverview,
    callCloseTenantBillingPeriod,
    callGetTenantBillingSettlement,
    callGetTenantBillingDrilldown,
    callExportTenantBillingDrilldown,
    callGetOpsV2Metrics,
    callCreateWatchlist,
    callRunWatchlistNow,
} = await import('./firestoreService');

describe('firestoreService.fetchClients', () => {
    beforeEach(() => {
        firestoreServiceMocks.getDocs.mockReset();
        global.fetch = vi.fn();
    });

    it('mapeia os clientes retornados pelo SDK do Firestore', async () => {
        firestoreServiceMocks.getDocs.mockResolvedValue({
            docs: [
                {
                    id: 'uid-1',
                    data: () => ({
                        tenantName: 'Madero Industria e Comercio S.A.',
                        displayName: 'Analista RH',
                        email: 'analista.rh@madero.com.br',
                        tenantId: 'madero-br',
                        createdAt: {
                            toDate: () => new Date('2026-03-20T12:00:00.000Z'),
                        },
                    }),
                },
            ],
        });

        const clients = await fetchClients();

        expect(global.fetch).not.toHaveBeenCalled();
        expect(clients).toEqual([
            {
                uid: 'uid-1',
                tenantName: 'Madero Industria e Comercio S.A.',
                displayName: 'Analista RH',
                email: 'analista.rh@madero.com.br',
                tenantId: 'madero-br',
                createdAt: '2026-03-20',
            },
        ]);
    });

    it('usa o fallback REST quando a consulta do SDK falha', async () => {
        firestoreServiceMocks.getDocs.mockRejectedValue(new Error('sdk-timeout'));
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ([
                {
                    document: {
                        name: 'projects/demo-project/databases/(default)/documents/userProfiles/uid-2',
                        fields: {
                            tenantName: { stringValue: 'Madero Industria e Comercio S.A.' },
                            displayName: { stringValue: 'Analista RH' },
                            email: { stringValue: 'analista.rh@madero.com.br' },
                            tenantId: { stringValue: 'madero-br' },
                            createdAt: { timestampValue: '2026-03-21T15:00:00.000Z' },
                        },
                    },
                },
            ]),
        });

        const clients = await fetchClients();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(firestoreServiceMocks.currentUser.getIdToken).toHaveBeenCalledTimes(1);
        expect(clients).toEqual([
            {
                uid: 'uid-2',
                tenantName: 'Madero Industria e Comercio S.A.',
                displayName: 'Analista RH',
                email: 'analista.rh@madero.com.br',
                tenantId: 'madero-br',
                createdAt: '2026-03-21',
            },
        ]);
    });
});

describe('firestoreService ordered collection fetchers', () => {
    beforeEach(() => {
        firestoreServiceMocks.getDocs.mockReset();
        firestoreServiceMocks.getFunctions.mockClear();
        firestoreServiceMocks.httpsCallable.mockReset();
        global.fetch = vi.fn();
    });

    it('mapeia casos vazios pelo SDK sem cair em erro', async () => {
        firestoreServiceMocks.getDocs.mockResolvedValue({
            docs: [],
        });

        const cases = await fetchCases('madero-br');

        expect(cases).toEqual([]);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('usa o fallback REST para exportacoes vazias quando o SDK falha', async () => {
        firestoreServiceMocks.getDocs.mockRejectedValue(new Error('sdk-timeout'));
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ([]),
        });

        const exports = await fetchExports('madero-br');

        expect(exports).toEqual([]);
        expect(global.fetch).toHaveBeenCalled();
        expect(firestoreServiceMocks.currentUser.getIdToken).toHaveBeenCalled();
    });
});

describe('firestoreService public report callables', () => {
    beforeEach(() => {
        firestoreServiceMocks.getFunctions.mockClear();
        firestoreServiceMocks.httpsCallable.mockReset();
    });

    it('lista relatorios publicos do cliente via callable backend segura', async () => {
        const callableMock = vi.fn().mockResolvedValue({
            data: {
                reports: [
                    { token: 'rep-123', candidateName: 'Francisco Taciano de Sousa', status: 'ACTIVE' },
                ],
            },
        });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        const reports = await fetchClientPublicReports();

        expect(firestoreServiceMocks.getFunctions).toHaveBeenCalledWith(undefined, 'southamerica-east1');
        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2ListClientPublicReports');
        expect(callableMock).toHaveBeenCalledWith({});
        expect(reports).toEqual([
            { token: 'rep-123', candidateName: 'Francisco Taciano de Sousa', status: 'ACTIVE' },
        ]);
    });

    it('revoga relatorio publico do cliente via callable backend segura', async () => {
        const callableMock = vi.fn().mockResolvedValue({ data: { success: true } });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        await revokeClientPublicReport('rep-321');

        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2RevokeClientPublicReport');
        expect(callableMock).toHaveBeenCalledWith({ token: 'rep-321' });
    });
});

describe('firestoreService product onboarding callables', () => {
    beforeEach(() => {
        firestoreServiceMocks.httpsCallable.mockReset();
    });

    it('chama callable backend V2 para marcar intro de produto como vista', async () => {
        const callableMock = vi.fn().mockResolvedValue({
            data: { success: true, productKey: 'dossier_pf_full' },
        });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        const payload = { productKey: 'dossier_pf_full' };
        const result = await callMarkProductIntroSeen(payload);

        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2MarkProductIntroSeen');
        expect(callableMock).toHaveBeenCalledWith(payload);
        expect(result.success).toBe(true);
    });
});

describe('firestoreService.subscribeToClientCases V2', () => {
    beforeEach(() => {
        firestoreServiceMocks.onSnapshot.mockReset();
    });

    it('prioriza clientProjections quando projections existem', () => {
        const unsubscribeLegacy = vi.fn();
        const unsubscribeProjection = vi.fn();
        firestoreServiceMocks.onSnapshot
            .mockImplementationOnce((queryRef, onNext) => {
                onNext({
                    docs: [
                        { id: 'case-legacy', data: () => ({ tenantId: 'tenant-1', candidateName: 'Legado', createdAt: '2026-04-20' }) },
                    ],
                });
                return unsubscribeLegacy;
            })
            .mockImplementationOnce((queryRef, onNext) => {
                onNext({
                    docs: [
                        { id: 'case-v2', data: () => ({ tenantId: 'tenant-1', candidateName: 'Projection', createdAt: '2026-04-21' }) },
                    ],
                });
                return unsubscribeProjection;
            });

        const callback = vi.fn();
        const unsubscribe = subscribeToClientCases('tenant-1', callback);

        expect(callback).toHaveBeenCalledWith([
            expect.objectContaining({
                id: 'case-v2',
                candidateName: 'Projection',
                clientDataSource: 'clientProjections',
                legacyFallbackUsed: false,
            }),
        ], null);
        expect(callback).not.toHaveBeenCalledWith([
            expect.objectContaining({ id: 'case-legacy' }),
        ], null);

        unsubscribe();
        expect(unsubscribeLegacy).toHaveBeenCalled();
        expect(unsubscribeProjection).toHaveBeenCalled();
    });

    it('usa clientCases apenas como fallback quando nao ha clientProjections', () => {
        firestoreServiceMocks.onSnapshot
            .mockImplementationOnce((queryRef, onNext) => {
                onNext({
                    docs: [
                        { id: 'case-legacy', data: () => ({ tenantId: 'tenant-1', candidateName: 'Legado', createdAt: '2026-04-20' }) },
                    ],
                });
                return vi.fn();
            })
            .mockImplementationOnce((queryRef, onNext) => {
                onNext({ docs: [] });
                return vi.fn();
            });

        const callback = vi.fn();
        subscribeToClientCases('tenant-1', callback);

        expect(callback).toHaveBeenCalledWith([
            expect.objectContaining({
                id: 'case-legacy',
                candidateName: 'Legado',
                clientDataSource: 'legacyFallback:clientCaseList',
                legacyFallbackUsed: true,
                legacyFallbackSource: 'clientCaseList',
            }),
        ], null);
    });

    it('subscribeToClientProjections le apenas clientProjections', () => {
        firestoreServiceMocks.onSnapshot.mockImplementation((queryRef, onNext) => {
            onNext({
                docs: [
                    { id: 'case-v2', data: () => ({ tenantId: 'tenant-1', candidateName: 'Projection', createdAt: '2026-04-21' }) },
                ],
            });
            return vi.fn();
        });

        const callback = vi.fn();
        subscribeToClientProjections('tenant-1', callback);

        expect(callback).toHaveBeenCalledWith([
            expect.objectContaining({ id: 'case-v2', clientDataSource: 'clientProjections' }),
        ], null);
        expect(firestoreServiceMocks.onSnapshot).toHaveBeenCalledTimes(1);
    });
});

describe('firestoreService.subscribeToRelationshipsForCase', () => {
    beforeEach(() => {
        firestoreServiceMocks.onSnapshot.mockReset();
    });

    it('emite relacionamentos do caso ordenados por confianca', () => {
        const unsubscribe = vi.fn();
        firestoreServiceMocks.onSnapshot.mockImplementation((queryRef, onNext) => {
            onNext({
                docs: [
                    { id: 'rel-medium', data: () => ({ caseId: 'case-1', type: 'company_person', confidence: 'medium' }) },
                    { id: 'rel-exact', data: () => ({ caseId: 'case-1', type: 'same_subject', confidence: 'exact' }) },
                ],
            });
            return unsubscribe;
        });

        const callback = vi.fn();
        const result = subscribeToRelationshipsForCase('case-1', callback);

        expect(result).toBe(unsubscribe);
        expect(callback).toHaveBeenCalledWith([
            { id: 'rel-exact', caseId: 'case-1', type: 'same_subject', confidence: 'exact' },
            { id: 'rel-medium', caseId: 'case-1', type: 'company_person', confidence: 'medium' },
        ], null);
    });

    it('retorna lista vazia sem consultar Firestore quando caseId esta ausente', () => {
        const callback = vi.fn();
        const result = subscribeToRelationshipsForCase('', callback);

        expect(typeof result).toBe('function');
        expect(callback).toHaveBeenCalledWith([], null);
        expect(firestoreServiceMocks.onSnapshot).not.toHaveBeenCalled();
    });
});

describe('firestoreService V2 timeline/divergence subscriptions', () => {
    beforeEach(() => {
        firestoreServiceMocks.onSnapshot.mockReset();
    });

    it('ordena eventos de timeline por prioridade operacional', () => {
        const unsubscribe = vi.fn();
        firestoreServiceMocks.onSnapshot.mockImplementation((queryRef, onNext) => {
            onNext({
                docs: [
                    { id: 'ev-module', data: () => ({ caseId: 'case-1', eventType: 'module_run_completed', severity: null }) },
                    { id: 'ev-risk', data: () => ({ caseId: 'case-1', eventType: 'risk_signal_raised', severity: 'critical' }) },
                    { id: 'ev-report', data: () => ({ caseId: 'case-1', eventType: 'report_generated', severity: null }) },
                ],
            });
            return unsubscribe;
        });

        const callback = vi.fn();
        subscribeToTimelineEventsForCase('case-1', callback);

        expect(callback).toHaveBeenCalledWith([
            { id: 'ev-risk', caseId: 'case-1', eventType: 'risk_signal_raised', severity: 'critical' },
            { id: 'ev-report', caseId: 'case-1', eventType: 'report_generated', severity: null },
            { id: 'ev-module', caseId: 'case-1', eventType: 'module_run_completed', severity: null },
        ], null);
    });

    it('ordena divergencias bloqueantes antes das demais', () => {
        const unsubscribe = vi.fn();
        firestoreServiceMocks.onSnapshot.mockImplementation((queryRef, onNext) => {
            onNext({
                docs: [
                    { id: 'div-medium', data: () => ({ caseId: 'case-1', severity: 'medium', blocksPublication: false }) },
                    { id: 'div-critical', data: () => ({ caseId: 'case-1', severity: 'critical', blocksPublication: true }) },
                ],
            });
            return unsubscribe;
        });

        const callback = vi.fn();
        subscribeToProviderDivergencesForCase('case-1', callback);

        expect(callback).toHaveBeenCalledWith([
            { id: 'div-critical', caseId: 'case-1', severity: 'critical', blocksPublication: true },
            { id: 'div-medium', caseId: 'case-1', severity: 'medium', blocksPublication: false },
        ], null);
    });
});

describe('firestoreService.callResolveProviderDivergenceByAnalyst', () => {
    beforeEach(() => {
        firestoreServiceMocks.httpsCallable.mockReset();
    });

    it('chama callable backend de resolucao de divergencia com payload recebido', async () => {
        const callableMock = vi.fn().mockResolvedValue({ data: { success: true } });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        const payload = {
            caseId: 'case-1',
            divergenceId: 'div-1',
            status: 'resolved',
            resolution: 'Fonte validada manualmente.',
        };
        const result = await callResolveProviderDivergenceByAnalyst(payload);

        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2ResolveProviderDivergenceByAnalyst');
        expect(callableMock).toHaveBeenCalledWith(payload);
        expect(result).toEqual({ success: true });
    });
});

describe('firestoreService.callGetTenantBillingOverview', () => {
    beforeEach(() => {
        firestoreServiceMocks.httpsCallable.mockReset();
    });

    it('chama callable backend de billing overview V2', async () => {
        const callableMock = vi.fn().mockResolvedValue({
            data: { tenantId: 'tenant-1', source: 'usageMeters', overview: { totalQuantity: 2 } },
        });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        const payload = { tenantId: 'tenant-1', monthKey: '2026-04' };
        const result = await callGetTenantBillingOverview(payload);

        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2GetTenantBillingOverview');
        expect(callableMock).toHaveBeenCalledWith(payload);
        expect(result.source).toBe('usageMeters');
    });
});

describe('firestoreService billing V2 callables', () => {
    beforeEach(() => {
        firestoreServiceMocks.httpsCallable.mockReset();
    });

    it('chama callable backend para fechar periodo de billing', async () => {
        const callableMock = vi.fn().mockResolvedValue({
            data: { success: true, settlementId: 'billing_tenant-1_2026-04' },
        });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        const payload = { tenantId: 'tenant-1', monthKey: '2026-04' };
        const result = await callCloseTenantBillingPeriod(payload);

        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2CloseTenantBillingPeriodByAnalyst');
        expect(callableMock).toHaveBeenCalledWith(payload);
        expect(result.success).toBe(true);
    });

    it('chama callable backend para ler settlement de billing', async () => {
        const callableMock = vi.fn().mockResolvedValue({
            data: { tenantId: 'tenant-1', settlement: { status: 'PENDING_REVIEW' } },
        });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        const payload = { tenantId: 'tenant-1', monthKey: '2026-04' };
        const result = await callGetTenantBillingSettlement(payload);

        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2GetTenantBillingSettlement');
        expect(callableMock).toHaveBeenCalledWith(payload);
        expect(result.settlement.status).toBe('PENDING_REVIEW');
    });

    it('chama callable backend para drilldown de billing', async () => {
        const callableMock = vi.fn().mockResolvedValue({
            data: { tenantId: 'tenant-1', drilldown: { totals: { meters: 2 } } },
        });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        const payload = { tenantId: 'tenant-1', monthKey: '2026-04' };
        const result = await callGetTenantBillingDrilldown(payload);

        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2GetTenantBillingDrilldown');
        expect(callableMock).toHaveBeenCalledWith(payload);
        expect(result.drilldown.totals.meters).toBe(2);
    });

    it('chama callable backend para exportar drilldown de billing', async () => {
        const callableMock = vi.fn().mockResolvedValue({
            data: { success: true, format: 'csv', content: 'id,moduleKey' },
        });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        const payload = { tenantId: 'tenant-1', monthKey: '2026-04', format: 'csv' };
        const result = await callExportTenantBillingDrilldown(payload);

        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2ExportTenantBillingDrilldown');
        expect(callableMock).toHaveBeenCalledWith(payload);
        expect(result.format).toBe('csv');
    });

    it('chama callable backend para metricas operacionais V2', async () => {
        const callableMock = vi.fn().mockResolvedValue({
            data: { source: 'v2Collections', counts: { usageMeters: 2 } },
        });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        const payload = { monthKey: '2026-04' };
        const result = await callGetOpsV2Metrics(payload);

        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2GetOpsV2Metrics');
        expect(callableMock).toHaveBeenCalledWith(payload);
        expect(result.source).toBe('v2Collections');
    });
});

describe('firestoreService watchlist callables', () => {
    beforeEach(() => {
        firestoreServiceMocks.httpsCallable.mockReset();
    });

    it('chama callable backend para criar watchlist', async () => {
        const callableMock = vi.fn().mockResolvedValue({
            data: { success: true, watchlistId: 'wl_subj-1' },
        });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        const payload = { subjectId: 'subj-1', tenantId: 'tenant-1', modules: ['criminal'], intervalDays: 30 };
        const result = await callCreateWatchlist(payload);

        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2CreateWatchlist');
        expect(callableMock).toHaveBeenCalledWith(payload);
        expect(result.watchlistId).toBe('wl_subj-1');
    });

    it('chama callable backend para executar watchlist sob demanda', async () => {
        const callableMock = vi.fn().mockResolvedValue({
            data: { success: true, watchlistId: 'wl_subj-1', status: 'ok', alertsCreated: 1 },
        });
        firestoreServiceMocks.httpsCallable.mockReturnValue(callableMock);

        const payload = { watchlistId: 'wl_subj-1' };
        const result = await callRunWatchlistNow(payload);

        expect(firestoreServiceMocks.httpsCallable).toHaveBeenCalledWith('functions-instance', 'v2RunWatchlistNow');
        expect(callableMock).toHaveBeenCalledWith(payload);
        expect(result.alertsCreated).toBe(1);
    });
});

describe('firestoreService.fetchSubjectHistory', () => {
    beforeEach(() => {
        firestoreServiceMocks.getDocs.mockReset();
    });

    it('monta historico de casos por subject respeitando tenant quando informado', async () => {
        firestoreServiceMocks.getDocs.mockResolvedValue({
            docs: [
                { id: 'case-current', data: () => ({ subjectId: 'subj-1', tenantId: 'tenant-1' }) },
                { id: 'case-old', data: () => ({ subjectId: 'subj-1', tenantId: 'tenant-1' }) },
            ],
        });

        const history = await fetchSubjectHistory('subj-1', 'case-current', 5, 'tenant-1');

        expect(history).toEqual([
            expect.objectContaining({ id: 'case-old', tenantId: 'tenant-1' }),
        ]);
        expect(firestoreServiceMocks.getDocs).toHaveBeenCalledTimes(1);
    });

    it('retorna vazio sem subjectId no historico de casos', async () => {
        await expect(fetchSubjectHistory('', 'case-current', 5, 'tenant-1')).resolves.toEqual([]);
        expect(firestoreServiceMocks.getDocs).not.toHaveBeenCalled();
    });
});

describe('firestoreService.fetchSubjectDecisionHistory', () => {
    beforeEach(() => {
        firestoreServiceMocks.getDocs.mockReset();
    });

    it('monta comparativo historico por subject usando decisions e reportSnapshots', async () => {
        firestoreServiceMocks.getDocs
            .mockResolvedValueOnce({
                docs: [
                    {
                        id: 'dec-current',
                        data: () => ({ caseId: 'case-current', subjectId: 'subj-1', riskScore: 90, verdict: 'NOT_RECOMMENDED' }),
                    },
                    {
                        id: 'dec-2',
                        data: () => ({ caseId: 'case-2', subjectId: 'subj-1', productKey: 'dossier_pf_full', riskScore: 72, verdict: 'ATTENTION', approvedAt: '2026-04-20' }),
                    },
                    {
                        id: 'dec-1',
                        data: () => ({ caseId: 'case-1', subjectId: 'subj-1', productKey: 'dossier_pf_basic', riskScore: 40, verdict: 'FIT', approvedAt: '2026-03-20' }),
                    },
                ],
            })
            .mockResolvedValueOnce({
                docs: [
                    { id: 'snap-2', data: () => ({ caseId: 'case-2', status: 'ready', reportModuleKeys: ['identity_pf', 'criminal'] }) },
                ],
            })
            .mockResolvedValueOnce({
                docs: [
                    { id: 'snap-1', data: () => ({ caseId: 'case-1', status: 'ready', reportModuleKeys: ['identity_pf'] }) },
                ],
            });

        const history = await fetchSubjectDecisionHistory('subj-1', 'case-current', 5, 'tenant-1');

        expect(history).toHaveLength(2);
        expect(history[0]).toEqual(expect.objectContaining({
            id: 'dec-2',
            caseId: 'case-2',
            reportSnapshotId: 'snap-2',
            riskScore: 72,
            scoreDeltaFromPrevious: 32,
        }));
        expect(history[1].scoreDeltaFromPrevious).toBeNull();
    });

    it('retorna vazio sem subjectId', async () => {
        await expect(fetchSubjectDecisionHistory('', 'case-1')).resolves.toEqual([]);
        expect(firestoreServiceMocks.getDocs).not.toHaveBeenCalled();
    });
});
