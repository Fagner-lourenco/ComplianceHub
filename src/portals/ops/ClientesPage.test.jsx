import { act, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const clientesPageMocks = vi.hoisted(() => ({
    authState: {
        user: { uid: 'ops-1', email: 'fagner.alexandro.lourenco@gmail.com' },
    },
    tenantState: {
        selectedTenantId: 'all',
    },
    fetchClients: vi.fn(),
    createClientUser: vi.fn(),
    logAuditEvent: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => clientesPageMocks.authState,
}));

vi.mock('../../core/contexts/useTenant', () => ({
    useTenant: () => clientesPageMocks.tenantState,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    fetchClients: (...args) => clientesPageMocks.fetchClients(...args),
    createClientUser: (...args) => clientesPageMocks.createClientUser(...args),
    logAuditEvent: (...args) => clientesPageMocks.logAuditEvent(...args),
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
    updateTenantSettings: vi.fn().mockResolvedValue(),
    getEnabledPhases: (config) => Object.keys(config).filter((k) => config[k]?.enabled),
}));

const { default: ClientesPage } = await import('./ClientesPage');

describe('ClientesPage', () => {
    beforeEach(() => {
        clientesPageMocks.fetchClients.mockReset();
        clientesPageMocks.createClientUser.mockReset();
        clientesPageMocks.logAuditEvent.mockReset();
    });

    it('carrega e exibe a lista real de clientes', async () => {
        clientesPageMocks.fetchClients.mockResolvedValue([
            {
                uid: 'client-1',
                tenantName: 'Madero Industria e Comercio S.A.',
                displayName: 'Joao (RH Madero)',
                email: 'analista.rh@madero.com.br',
                tenantId: 'madero-br',
                createdAt: '2026-03-25',
            },
        ]);

        render(<ClientesPage />);

        expect(screen.getByText('Carregando...')).toBeInTheDocument();

        expect(await screen.findByText('analista.rh@madero.com.br')).toBeInTheDocument();
        expect(screen.getByText('Madero Industria e Comercio S.A.')).toBeInTheDocument();
        expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    });

    it('mostra mensagem clara quando a consulta de clientes falha', async () => {
        clientesPageMocks.fetchClients.mockRejectedValue(new Error('timeout'));

        render(<ClientesPage />);

        await act(async () => {
            await Promise.resolve();
        });

        expect(await screen.findByRole('alert')).toHaveTextContent('Nao foi possivel carregar a lista de clientes agora. Tente novamente em alguns instantes.');
        expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
    });
});
