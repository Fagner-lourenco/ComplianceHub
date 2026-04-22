import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Topbar from './Topbar';

const topbarMocks = vi.hoisted(() => ({
    authState: {
        profileStatus: 'ready',
        userProfile: {
            displayName: 'Maria Silva',
            email: 'maria@empresa.com',
            role: 'admin',
        },
    },
    tenantState: {
        canSelectTenant: true,
        selectedTenantId: 'TEN-001',
        selectedTenantLabel: 'TechCorp',
        setSelectedTenantId: vi.fn(),
        tenantStatus: 'ready',
        tenants: [{ id: 'TEN-001', name: 'TechCorp' }],
    },
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => topbarMocks.authState,
}));

vi.mock('../../core/contexts/useTenant', () => ({
    useTenant: () => topbarMocks.tenantState,
}));

describe('Topbar', () => {
    it('mostra usuario logado, email, papel e franquia em contexto', () => {
        render(
            <MemoryRouter initialEntries={['/ops/fila']}>
                <Topbar title="Portal Operacional" onMenuClick={() => {}} />
            </MemoryRouter>,
        );

        expect(screen.getByText('Maria Silva')).toBeInTheDocument();
        expect(screen.getByText('maria@empresa.com')).toBeInTheDocument();
        expect(screen.getByText('Administrador')).toBeInTheDocument();
        expect(screen.getByDisplayValue('TechCorp')).toBeInTheDocument();
        expect(screen.getByText('Franquia em contexto')).toBeInTheDocument();
        expect(screen.getByText('Perfil confirmado')).toBeInTheDocument();
    });
});
