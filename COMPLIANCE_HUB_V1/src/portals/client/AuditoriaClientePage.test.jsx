import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import AuditoriaClientePage from './AuditoriaClientePage';

const auditoriaMocks = vi.hoisted(() => ({
    authState: {
        userProfile: {
            tenantId: 'tenant-1',
            tenantName: 'Empresa Teste',
        },
    },
    auditState: {
        logs: [
            {
                id: 'log-1',
                eventId: 'audit-event-1',
                timestamp: '2026-04-30 10:30:00',
                action: 'SOLICITATION_CREATED',
                category: 'CASE',
                actor: { displayName: 'Carla Mendes', email: 'carla@empresa.com' },
                entity: { type: 'CASE', id: 'case-1', label: 'João Silva' },
                clientSummary: 'Nova solicitação criada para João Silva',
                searchText: 'carla joao silva case-1 solicitacao',
            },
            {
                id: 'log-2',
                eventId: 'audit-event-2',
                timestamp: '2026-04-29 09:00:00',
                action: 'EXPORT_CREATED',
                category: 'EXPORT',
                actor: { displayName: 'Ana Souza', email: 'ana@empresa.com' },
                entity: { type: 'EXPORT', id: 'exp-1', label: 'Exportação CSV' },
                clientSummary: 'Exportação CSV gerada',
                searchText: 'ana exportacao csv exp-1',
            },
        ],
        loading: false,
        error: null,
    },
    useTenantAuditLogs: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => auditoriaMocks.authState,
}));

vi.mock('../../hooks/useTenantAuditLogs', () => ({
    useTenantAuditLogs: (...args) => auditoriaMocks.useTenantAuditLogs(...args),
}));

describe('AuditoriaClientePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auditoriaMocks.auditState = {
            logs: [
                {
                    id: 'log-1',
                    eventId: 'audit-event-1',
                    timestamp: '2026-04-30 10:30:00',
                    action: 'SOLICITATION_CREATED',
                    category: 'CASE',
                    actor: { displayName: 'Carla Mendes', email: 'carla@empresa.com' },
                    entity: { type: 'CASE', id: 'case-1', label: 'João Silva' },
                    clientSummary: 'Nova solicitação criada para João Silva',
                    searchText: 'carla joao silva case-1 solicitacao',
                },
                {
                    id: 'log-2',
                    eventId: 'audit-event-2',
                    timestamp: '2026-04-29 09:00:00',
                    action: 'EXPORT_CREATED',
                    category: 'EXPORT',
                    actor: { displayName: 'Ana Souza', email: 'ana@empresa.com' },
                    entity: { type: 'EXPORT', id: 'exp-1', label: 'Exportação CSV' },
                    clientSummary: 'Exportação CSV gerada',
                    searchText: 'ana exportacao csv exp-1',
                },
            ],
            loading: false,
            error: null,
        };
        auditoriaMocks.useTenantAuditLogs.mockImplementation(() => auditoriaMocks.auditState);
    });

    it('mostra responsavel, alvo e ID do evento na tabela', () => {
        render(<AuditoriaClientePage />);

        expect(screen.getByRole('table', { name: /histórico de atividades da empresa/i })).toBeInTheDocument();
        expect(screen.getAllByText('Carla Mendes')[0]).toBeInTheDocument();
        expect(screen.getAllByText('João Silva')[0]).toBeInTheDocument();
        expect(screen.getAllByText('audit-event-1')[0]).toBeInTheDocument();
    });

    it('avisa que busca e filtros usam somente registros carregados', () => {
        render(<AuditoriaClientePage />);

        expect(screen.getByText(/200 eventos mais recentes carregados/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/buscar nos registros carregados/i)).toBeInTheDocument();
    });

    it('busca por responsavel e alvo nos registros carregados', () => {
        render(<AuditoriaClientePage />);

        fireEvent.change(screen.getByLabelText(/buscar nos registros de auditoria carregados/i), { target: { value: 'João' } });

        expect(screen.getAllByText('João Silva')[0]).toBeInTheDocument();
        expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
    });

    it('envia categoria real em maiusculas para o hook', () => {
        render(<AuditoriaClientePage />);

        fireEvent.change(screen.getByLabelText(/categoria/i), { target: { value: 'CASE' } });

        expect(auditoriaMocks.useTenantAuditLogs).toHaveBeenLastCalledWith('tenant-1', 'CASE');
    });

    it('mapeia erro de permissao para PT-BR formal', () => {
        auditoriaMocks.auditState = { logs: [], loading: false, error: { code: 'permission-denied', message: 'Missing permissions' } };

        render(<AuditoriaClientePage />);

        expect(screen.getByText(/Você não tem permissão para visualizar o histórico desta empresa/i)).toBeInTheDocument();
    });
});
