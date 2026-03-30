import { vi } from 'vitest';

const firestoreServiceMocks = vi.hoisted(() => ({
    getDocs: vi.fn(),
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
    onSnapshot: vi.fn(),
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

const { fetchCases, fetchClients, fetchExports } = await import('./firestoreService');

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
