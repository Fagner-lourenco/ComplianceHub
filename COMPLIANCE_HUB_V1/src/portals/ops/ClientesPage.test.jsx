import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

const clientesPageMocks = vi.hoisted(() => ({
    authState: {
        user: { uid: 'ops-1', email: 'fagner.alexandro.lourenco@gmail.com' },
    },
    tenantState: {
        selectedTenantId: 'all',
    },
    fetchClients: vi.fn(),
    callCreateOpsClientUser: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => clientesPageMocks.authState,
}));

vi.mock('../../core/contexts/useTenant', () => ({
    useTenant: () => clientesPageMocks.tenantState,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    fetchClients: (...args) => clientesPageMocks.fetchClients(...args),
    callCreateOpsClientUser: (...args) => clientesPageMocks.callCreateOpsClientUser(...args),
    DEFAULT_ANALYSIS_CONFIG: {
        criminal: { enabled: true }, labor: { enabled: true }, warrant: { enabled: true },
        osint: { enabled: true }, social: { enabled: true }, digital: { enabled: true },
        conflictInterest: { enabled: true },
    },
    ANALYSIS_PHASE_LABELS: {
        criminal: 'Criminal', labor: 'Trabalhista', warrant: 'Mandado de Prisao',
        osint: 'OSINT', social: 'Social', digital: 'Perfil Digital', conflictInterest: 'Conflito de Interesse',
    },
    getTenantSettings: vi.fn().mockResolvedValue({
        analysisConfig: {
            criminal: { enabled: true }, labor: { enabled: true }, warrant: { enabled: true },
            osint: { enabled: true }, social: { enabled: true }, digital: { enabled: true },
            conflictInterest: { enabled: true },
        },
    }),
    getEnabledPhases: (config) => Object.keys(config).filter((k) => config[k]?.enabled),
}));

const { default: ClientesPage } = await import('./ClientesPage');

describe('ClientesPage', () => {
    beforeEach(() => {
        clientesPageMocks.fetchClients.mockReset();
        clientesPageMocks.callCreateOpsClientUser.mockReset();
    });

    it('carrega e exibe a lista agrupada por tenant', async () => {
        clientesPageMocks.fetchClients.mockResolvedValue([
            {
                uid: 'client-1',
                tenantName: 'Madero Industria e Comercio S.A.',
                displayName: 'Joao (RH Madero)',
                email: 'analista.rh@madero.com.br',
                tenantId: 'madero-br',
                createdAt: '2026-03-25',
                role: 'client_manager',
                status: 'active',
            },
        ]);

        render(<MemoryRouter><ClientesPage /></MemoryRouter>);

        expect(document.querySelector('[aria-hidden="true"] .skeleton')).toBeInTheDocument();

        expect(await screen.findByText('Madero Industria e Comercio S.A.')).toBeInTheDocument();
        // Now grouped by tenant: shows user count instead of individual email
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(document.querySelector('[aria-hidden="true"] .skeleton')).not.toBeInTheDocument();
    });

    it('mostra mensagem clara quando a consulta de clientes falha', async () => {
        clientesPageMocks.fetchClients.mockRejectedValue(new Error('timeout'));

        render(<MemoryRouter><ClientesPage /></MemoryRouter>);

        await act(async () => {
            await Promise.resolve();
        });

        expect(await screen.findByRole('alert')).toHaveTextContent('Nao foi possivel carregar a lista de clientes agora. Tente novamente em alguns instantes.');
        expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    });

    it('nao expoe senha provisoria no toast de sucesso', async () => {
        clientesPageMocks.fetchClients.mockResolvedValue([]);
        clientesPageMocks.callCreateOpsClientUser.mockResolvedValue({ uid: 'new-user', tenantId: 'tenant-x' });

        render(<MemoryRouter><ClientesPage /></MemoryRouter>);

        await screen.findByText('Nenhum cliente encontrado.');

        fireEvent.click(screen.getByRole('button', { name: /Novo gestor/i }));

        const tenantNameInput = screen.getByPlaceholderText('Ex: Madero Industria S.A.');
        fireEvent.change(tenantNameInput, { target: { value: 'Nova Empresa' } });

        const displayNameInput = screen.getByPlaceholderText('Ex: Joao Silva (RH)');
        fireEvent.change(displayNameInput, { target: { value: 'Maria Gestora' } });

        const emailInput = screen.getByPlaceholderText('joao@empresa.com.br');
        fireEvent.change(emailInput, { target: { value: 'maria@nova.com' } });

        fireEvent.click(screen.getByRole('button', { name: /Criar gestor/i }));

        await vi.waitFor(() => {
            const toast = screen.queryByRole('status');
            if (!toast) return false;
            expect(toast.textContent).toContain('Gestor criado com sucesso');
            expect(toast.textContent).not.toContain('Senha provisoria');
            return true;
        });
    });
});
