import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    authState: {
        user: { uid: 'ops-1', email: 'ops@hub.br' },
        userProfile: { role: 'admin', source: 'ops' },
    },
    tenantState: {
        selectedTenantId: 'all',
    },
    fetchOpsPublicReports: vi.fn(),
    revokePublicReport: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => mocks.authState,
}));

vi.mock('../../core/contexts/useTenant', () => ({
    useTenant: () => mocks.tenantState,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    fetchOpsPublicReports: (...args) => mocks.fetchOpsPublicReports(...args),
    revokePublicReport: (...args) => mocks.revokePublicReport(...args),
}));

const { default: RelatoriosPage } = await import('./RelatoriosPage');

const MOCK_REPORTS = [
    {
        id: 'report-token-001',
        candidateName: 'João Silva',
        tenantId: 'tenant-a',
        createdAt: { seconds: 1700000000 },
        expiresAt: { seconds: 1900000000 },
        active: true,
        caseId: 'case-1',
    },
    {
        id: 'report-token-002',
        candidateName: 'Maria Souza',
        tenantId: 'tenant-b',
        createdAt: { seconds: 1600000000 },
        expiresAt: { seconds: 1600000100 },
        active: true,
        caseId: 'case-2',
    },
    {
        id: 'report-token-003',
        candidateName: 'Pedro Lima',
        tenantId: 'tenant-a',
        createdAt: { seconds: 1700000000 },
        expiresAt: { seconds: 1900000000 },
        active: false,
        caseId: 'case-3',
    },
];

describe('RelatoriosPage (ops)', () => {
    beforeEach(() => {
        mocks.fetchOpsPublicReports.mockReset();
        mocks.revokePublicReport.mockReset();
        mocks.authState = {
            user: { uid: 'ops-1', email: 'ops@hub.br' },
            userProfile: { role: 'admin', source: 'ops' },
        };
        mocks.tenantState = { selectedTenantId: 'all' };
    });

    it('renderiza lista de relatórios com status correto', async () => {
        mocks.fetchOpsPublicReports.mockResolvedValue(MOCK_REPORTS);
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());
        expect(screen.getByText('Maria Souza')).toBeInTheDocument();
        expect(screen.getByText('Pedro Lima')).toBeInTheDocument();
    });

    it('mostra contadores de ativos, expirados e revogados', async () => {
        mocks.fetchOpsPublicReports.mockResolvedValue(MOCK_REPORTS);
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText(/1 ativo\(s\)/)).toBeInTheDocument());
        expect(screen.getByText(/1 exp\./)).toBeInTheDocument();
        expect(screen.getByText(/1 rev\./)).toBeInTheDocument();
    });

    it('mostra erro quando fetch falha', async () => {
        mocks.fetchOpsPublicReports.mockRejectedValue(new Error('timeout'));
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText(/Não foi possível carregar/)).toBeInTheDocument());
    });

    it('abre modal de confirmação ao clicar em Desativar', async () => {
        mocks.fetchOpsPublicReports.mockResolvedValue([MOCK_REPORTS[0]]);
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());

        const deactivateBtn = screen.getByRole('button', { name: /Desativar/i });
        fireEvent.click(deactivateBtn);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/será desativado permanentemente/)).toBeInTheDocument();
        expect(screen.getByText(/será auditada/)).toBeInTheDocument();
    });

    it('revoga relatório após confirmação no modal', async () => {
        mocks.fetchOpsPublicReports.mockResolvedValue([MOCK_REPORTS[0]]);
        mocks.revokePublicReport.mockResolvedValue({ success: true });
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /Desativar/i }));
        fireEvent.click(screen.getByRole('button', { name: /Confirmar revogação/i }));

        await waitFor(() => expect(mocks.revokePublicReport).toHaveBeenCalledWith('report-token-001'));
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/desativado com sucesso/));
    });

    it('fecha modal ao clicar em Cancelar', async () => {
        mocks.fetchOpsPublicReports.mockResolvedValue([MOCK_REPORTS[0]]);
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /Desativar/i }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('busca por candidato filtra resultados', async () => {
        mocks.fetchOpsPublicReports.mockResolvedValue(MOCK_REPORTS);
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());

        const searchInput = screen.getByLabelText(/Buscar relatórios/i);
        fireEvent.change(searchInput, { target: { value: 'Maria' } });

        await waitFor(() => expect(screen.queryByText('João Silva')).not.toBeInTheDocument());
        expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    });

    it('busca por link filtra resultados', async () => {
        mocks.fetchOpsPublicReports.mockResolvedValue(MOCK_REPORTS);
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());

        const searchInput = screen.getByLabelText(/Buscar relatórios/i);
        fireEvent.change(searchInput, { target: { value: 'token-002' } });

        await waitFor(() => expect(screen.queryByText('João Silva')).not.toBeInTheDocument());
        expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    });

    it('não mostra ações para relatório revogado', async () => {
        mocks.fetchOpsPublicReports.mockResolvedValue([MOCK_REPORTS[2]]);
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText('Pedro Lima')).toBeInTheDocument());
        expect(screen.queryByRole('button', { name: /Desativar/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Visualizar/i })).not.toBeInTheDocument();
    });

    it('mostra empresa na tabela', async () => {
        mocks.fetchOpsPublicReports.mockResolvedValue([MOCK_REPORTS[0]]);
        render(<RelatoriosPage />);

        await waitFor(() => expect(screen.getByText('tenant-a')).toBeInTheDocument());
    });
});
