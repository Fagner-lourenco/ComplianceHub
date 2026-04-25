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
    });

    it('preserva o prefixo demo ao navegar no portal operacional demonstrativo', () => {
        render(
            <MemoryRouter initialEntries={['/demo/ops/fila']}>
                <Sidebar isOpen onClose={() => {}} />
                <LocationProbe />
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByRole('link', { name: /Todos os casos/i }));

        expect(screen.getByTestId('location')).toHaveTextContent('/demo/ops/casos');
    });
});
