import { act, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';

const authMocks = vi.hoisted(() => ({
    authObserver: null,
    profileObserver: null,
    profileErrorObserver: null,
}));

vi.mock('../firebase/config', () => ({
    auth: {
        app: {
            options: {
                projectId: 'demo-project',
            },
        },
    },
    db: {},
}));

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: vi.fn((_, callback) => {
        authMocks.authObserver = callback;
        return () => {};
    }),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn((_, collectionName, id) => ({ collectionName, id })),
    getDoc: vi.fn(),
    onSnapshot: vi.fn((_, optionsOrObserver, nextOrError, maybeError) => {
        if (typeof optionsOrObserver === 'function') {
            authMocks.profileObserver = optionsOrObserver;
            authMocks.profileErrorObserver = nextOrError;
        } else {
            authMocks.profileObserver = nextOrError;
            authMocks.profileErrorObserver = maybeError;
        }

        return () => {};
    }),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(() => 'server-ts'),
}));

function AuthProbe() {
    const { loading, profileStatus, userProfile } = useAuth();

    return (
        <pre data-testid="payload">
            {JSON.stringify({
                loading,
                profileStatus,
                userProfile,
            })}
        </pre>
    );
}

function readPayload() {
    return JSON.parse(screen.getByTestId('payload').textContent);
}

describe('AuthProvider', () => {
    const firebaseUser = {
        uid: 'user-1',
        email: 'maria@empresa.com',
        displayName: 'Maria Silva',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('token-123'),
    };

    beforeEach(() => {
        authMocks.authObserver = null;
        authMocks.profileObserver = null;
        authMocks.profileErrorObserver = null;
        global.fetch = vi.fn();
    });

    it('exibe displayName e email do Firebase Auth imediatamente', async () => {
        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        );

        await act(async () => {
            authMocks.authObserver(firebaseUser);
        });

        const payload = readPayload();
        expect(payload.loading).toBe(false);
        expect(payload.profileStatus).toBe('loading');
        expect(payload.userProfile.displayName).toBe('Maria Silva');
        expect(payload.userProfile.email).toBe('maria@empresa.com');
        expect(payload.userProfile.source).toBe('auth');
        expect(payload.userProfile.role).toBeNull();
    });

    it('mantem o fallback do Auth enquanto o perfil do Firestore nao respondeu', async () => {
        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        );

        await act(async () => {
            authMocks.authObserver({
                ...firebaseUser,
                displayName: null,
                email: 'fallback@empresa.com',
            });
        });

        const payload = readPayload();
        expect(payload.profileStatus).toBe('loading');
        expect(payload.userProfile.displayName).toBe('fallback');
        expect(payload.userProfile.email).toBe('fallback@empresa.com');
        expect(authMocks.profileObserver).toBeTypeOf('function');
    });

    it('corrige automaticamente o perfil quando cache e servidor divergem', async () => {
        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        );

        await act(async () => {
            authMocks.authObserver(firebaseUser);
        });

        await act(async () => {
            authMocks.profileObserver({
                exists: () => true,
                data: () => ({
                    displayName: 'Maria Cache',
                    role: 'admin',
                    tenantId: 'TEN-001',
                    tenantName: 'TechCorp',
                }),
                metadata: { fromCache: true },
            });
        });

        let payload = readPayload();
        expect(payload.profileStatus).toBe('cached');
        expect(payload.userProfile.role).toBe('admin');
        expect(payload.userProfile.tenantName).toBe('TechCorp');
        expect(payload.userProfile.source).toBe('cache');

        await act(async () => {
            authMocks.profileObserver({
                exists: () => true,
                data: () => ({
                    displayName: 'Maria Server',
                    role: 'client_manager',
                    tenantId: 'TEN-002',
                    tenantName: 'Banco Atlantico',
                }),
                metadata: { fromCache: false },
            });
        });

        payload = readPayload();
        expect(payload.profileStatus).toBe('ready');
        expect(payload.userProfile.displayName).toBe('Maria Server');
        expect(payload.userProfile.role).toBe('client_manager');
        expect(payload.userProfile.tenantName).toBe('Banco Atlantico');
        expect(payload.userProfile.source).toBe('server');
    });

    it('preserva a identidade basica quando o Firestore oscila ou falha', async () => {
        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        );

        await act(async () => {
            authMocks.authObserver({
                uid: 'user-2',
                email: 'oscilacao@empresa.com',
                displayName: 'Rede Instavel',
                photoURL: null,
            });
        });

        await act(async () => {
            authMocks.profileErrorObserver(new Error('offline'));
        });

        const payload = readPayload();
        expect(payload.profileStatus).toBe('error');
        expect(payload.userProfile.displayName).toBe('Rede Instavel');
        expect(payload.userProfile.email).toBe('oscilacao@empresa.com');
        expect(payload.userProfile.role).toBeNull();
    });

    it('nao marca o perfil como ausente quando o cache ainda nao confirmou o servidor', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        );

        await act(async () => {
            authMocks.authObserver(firebaseUser);
        });

        await act(async () => {
            authMocks.profileObserver({
                exists: () => false,
                data: () => undefined,
                metadata: { fromCache: true },
            });
        });

        const payload = readPayload();
        expect(payload.profileStatus).toBe('loading');
        expect(payload.userProfile.displayName).toBe('Maria Silva');
        expect(payload.userProfile.email).toBe('maria@empresa.com');
        expect(payload.userProfile.role).toBeNull();
        expect(warnSpy).not.toHaveBeenCalledWith('User profile document not found in userProfiles.');

        warnSpy.mockRestore();
    });

    it('resolve o perfil via onSnapshot quando o cache confirma o servidor', async () => {
        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        );

        await act(async () => {
            authMocks.authObserver(firebaseUser);
        });

        await act(async () => {
            authMocks.profileObserver({
                exists: () => true,
                data: () => ({
                    displayName: 'Maria Rescue',
                    role: 'admin',
                    tenantId: 'TEN-001',
                    tenantName: 'TechCorp',
                }),
                metadata: { fromCache: false },
            });
        });

        const payload = readPayload();
        expect(payload.profileStatus).toBe('ready');
        expect(payload.userProfile.displayName).toBe('Maria Rescue');
        expect(payload.userProfile.role).toBe('admin');
        expect(payload.userProfile.tenantName).toBe('TechCorp');
        expect(payload.userProfile.source).toBe('server');
    });

    it('mantem fallback quando onSnapshot retorna cache sem perfil', async () => {
        render(
            <AuthProvider>
                <AuthProbe />
            </AuthProvider>,
        );

        await act(async () => {
            authMocks.authObserver(firebaseUser);
        });

        await act(async () => {
            authMocks.profileObserver({
                exists: () => false,
                data: () => undefined,
                metadata: { fromCache: true },
            });
        });

        const payload = readPayload();
        expect(payload.profileStatus).toBe('loading');
        expect(payload.userProfile.displayName).toBe('Maria Silva');
        expect(payload.userProfile.email).toBe('maria@empresa.com');
    });
});
