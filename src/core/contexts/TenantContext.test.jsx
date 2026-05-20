import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { TenantProvider } from './TenantContext';
import { useTenant } from './useTenant';
import { ALL_TENANTS_ID, SELECTED_TENANT_STORAGE_KEY } from './tenantUtils';

const tenantMocks = vi.hoisted(() => ({
    authState: {
        user: null,
        userProfile: null,
    },
    fetchTenantDirectory: vi.fn(),
    subscribeToTenantDirectory: vi.fn(),
    directoryCallback: null,
}));

vi.mock('../auth/useAuth', () => ({
    useAuth: () => tenantMocks.authState,
}));

vi.mock('../firebase/firestoreService', () => ({
    fetchTenantDirectory: (...args) => tenantMocks.fetchTenantDirectory(...args),
    subscribeToTenantDirectory: (...args) => tenantMocks.subscribeToTenantDirectory(...args),
}));

tenantMocks.subscribeToTenantDirectory.mockImplementation((callback) => {
    tenantMocks.directoryCallback = callback;
    return () => {};
});

function TenantProbe() {
    const {
        canSelectTenant,
        selectedTenantId,
        selectedTenantLabel,
        setSelectedTenantId,
    } = useTenant();

    return (
        <div>
            <div data-testid="selected-id">{selectedTenantId ?? 'null'}</div>
            <div data-testid="selected-label">{selectedTenantLabel}</div>
            <div data-testid="can-select">{String(canSelectTenant)}</div>
            <button type="button" onClick={() => setSelectedTenantId('TEN-001')}>Selecionar TEN-001</button>
            <button type="button" onClick={() => setSelectedTenantId(ALL_TENANTS_ID)}>Selecionar all</button>
        </div>
    );
}

describe('TenantProvider', () => {
    beforeEach(() => {
        tenantMocks.directoryCallback = null;
        tenantMocks.fetchTenantDirectory.mockReset();
        tenantMocks.fetchTenantDirectory.mockResolvedValue([]);
        tenantMocks.subscribeToTenantDirectory.mockClear();
    });

    it('seleciona automaticamente a unica franquia do cliente', () => {
        tenantMocks.authState = {
            user: { uid: 'client-1' },
            userProfile: {
                role: 'client_manager',
                tenantId: 'madero-br',
                tenantName: 'Madero',
            },
        };

        render(
            <TenantProvider>
                <TenantProbe />
            </TenantProvider>,
        );

        expect(screen.getByTestId('selected-id')).toHaveTextContent('madero-br');
        expect(screen.getByTestId('selected-label')).toHaveTextContent('Madero');
        expect(screen.getByTestId('can-select')).toHaveTextContent('false');
        expect(tenantMocks.subscribeToTenantDirectory).not.toHaveBeenCalled();
    });

    it('seleciona automaticamente a unica franquia disponivel para o operador', async () => {
        tenantMocks.authState = {
            user: { uid: 'ops-single' },
            userProfile: {
                role: 'admin',
                displayName: 'Operador',
            },
        };

        render(
            <TenantProvider>
                <TenantProbe />
            </TenantProvider>,
        );

        await act(async () => {
            tenantMocks.directoryCallback([
                { id: 'TEN-001', name: 'TechCorp' },
            ], null);
        });

        expect(screen.getByTestId('selected-id')).toHaveTextContent('TEN-001');
        expect(screen.getByTestId('selected-label')).toHaveTextContent('TechCorp');
        expect(screen.getByTestId('can-select')).toHaveTextContent('false');
    });

    it('restaura a franquia salva localmente quando o operador tem varias opcoes', async () => {
        window.localStorage.setItem(SELECTED_TENANT_STORAGE_KEY, 'TEN-002');
        tenantMocks.authState = {
            user: { uid: 'ops-1' },
            userProfile: {
                role: 'admin',
                displayName: 'Operador',
            },
        };

        render(
            <TenantProvider>
                <TenantProbe />
            </TenantProvider>,
        );

        await act(async () => {
            tenantMocks.directoryCallback([
                { id: 'TEN-001', name: 'TechCorp' },
                { id: 'TEN-002', name: 'Banco Atlantico' },
            ], null);
        });

        expect(screen.getByTestId('selected-id')).toHaveTextContent('TEN-002');
        expect(screen.getByTestId('selected-label')).toHaveTextContent('Banco Atlantico');
        expect(screen.getByTestId('can-select')).toHaveTextContent('true');
    });

    it('persiste a troca manual de franquia para UX', async () => {
        tenantMocks.authState = {
            user: { uid: 'ops-2' },
            userProfile: {
                role: 'admin',
            },
        };

        render(
            <TenantProvider>
                <TenantProbe />
            </TenantProvider>,
        );

        await act(async () => {
            tenantMocks.directoryCallback([
                { id: 'TEN-001', name: 'TechCorp' },
                { id: 'TEN-002', name: 'Banco Atlantico' },
            ], null);
        });

        fireEvent.click(screen.getByRole('button', { name: 'Selecionar TEN-001' }));

        expect(screen.getByTestId('selected-id')).toHaveTextContent('TEN-001');
        expect(screen.getByTestId('selected-label')).toHaveTextContent('TechCorp');
        expect(window.localStorage.getItem(SELECTED_TENANT_STORAGE_KEY)).toBe('TEN-001');
    });

    it('corrige automaticamente o tenant salvo quando ele nao existe mais no perfil real', async () => {
        window.localStorage.setItem(SELECTED_TENANT_STORAGE_KEY, 'TEN-999');
        tenantMocks.authState = {
            user: { uid: 'ops-3' },
            userProfile: {
                role: 'admin',
            },
        };

        render(
            <TenantProvider>
                <TenantProbe />
            </TenantProvider>,
        );

        await act(async () => {
            tenantMocks.directoryCallback([
                { id: 'TEN-001', name: 'TechCorp' },
                { id: 'TEN-002', name: 'Banco Atlantico' },
            ], null);
        });

        expect(screen.getByTestId('selected-id')).toHaveTextContent(ALL_TENANTS_ID);
        expect(screen.getByTestId('selected-label')).toHaveTextContent('Todas as franquias');
    });
});
