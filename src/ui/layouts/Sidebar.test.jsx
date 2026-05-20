import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import Sidebar from './Sidebar';

const sidebarMocks = vi.hoisted(() => ({
    logout: vi.fn(),
    authState: {
        logout: (...args) => sidebarMocks.logout(...args),
        userProfile: {
            displayName: 'Operacao Demo',
            email: 'ops.demo@compliancehub.com',
            role: 'admin',
        },
    },
    tenantState: {
        selectedTenantLabel: 'Todas as franquias',
    },
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => sidebarMocks.authState,
}));

vi.mock('../../core/contexts/useTenant', () => ({
    useTenant: () => sidebarMocks.tenantState,
}));

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}</div>;
}

describe('Sidebar', () => {
    beforeEach(() => {
        sidebarMocks.logout.mockReset();
        sidebarMocks.authState = {
            logout: (...args) => sidebarMocks.logout(...args),
            userProfile: {
                displayName: 'Operacao Demo',
                email: 'ops.demo@compliancehub.com',
                role: 'admin',
            },
        };
    });

    it('preserva o prefixo demo ao navegar no portal operacional demonstrativo', () => {
        render(
            <MemoryRouter initialEntries={['/demo/ops/fila']}>
                <Sidebar isOpen onClose={() => {}} />
                <LocationProbe />
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByRole('link', { name: /Casos/i }));

        expect(screen.getByTestId('location')).toHaveTextContent('/demo/ops/casos');
    });

    it('exibe a navegacao de relatorios no portal cliente para gestor', () => {
        sidebarMocks.authState = {
            logout: (...args) => sidebarMocks.logout(...args),
            userProfile: {
                displayName: 'Analista RH',
                email: 'analista.rh@madero.com.br',
                role: 'client_manager',
                tenantName: 'Madero Industria e Comercio S.A.',
            },
        };

        render(
            <MemoryRouter initialEntries={['/client/solicitacoes']}>
                <Sidebar isOpen onClose={() => {}} />
                <LocationProbe />
            </MemoryRouter>,
        );

        expect(screen.getByRole('link', { name: /Links compartilhados/i })).toBeInTheDocument();
    });

    it('oculta exportacoes e links compartilhados para operador do cliente', () => {
        sidebarMocks.authState = {
            logout: (...args) => sidebarMocks.logout(...args),
            userProfile: {
                displayName: 'Operador RH',
                email: 'operador.rh@madero.com.br',
                role: 'client_operator',
                tenantName: 'Madero Industria e Comercio S.A.',
            },
        };

        render(
            <MemoryRouter initialEntries={['/client/solicitacoes']}>
                <Sidebar isOpen onClose={() => {}} />
                <LocationProbe />
            </MemoryRouter>,
        );

        expect(screen.queryByRole('link', { name: /Arquivos gerados/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Links compartilhados/i })).not.toBeInTheDocument();
    });
});
