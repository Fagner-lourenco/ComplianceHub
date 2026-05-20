import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardClientePage from './DashboardClientePage';
import { useCases } from '../../hooks/useCases';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => ({
        user: { uid: 'user-1', email: 'teste@exemplo.com' },
        userProfile: { uid: 'user-1', tenantId: 'tenant-1', role: 'client_manager', displayName: 'Teste' },
    }),
}));

vi.mock('../../hooks/useCases');

vi.mock('../../core/firebase/firestoreService', () => ({
    callGetClientQuotaStatus: vi.fn(() => Promise.resolve({
        hasLimits: true,
        dailyCount: 5,
        dailyLimit: 10,
        monthlyCount: 20,
        monthlyLimit: 50,
        allowDailyExceedance: false,
        allowMonthlyExceedance: true,
    })),
}));

function wrap(ui) {
    return <MemoryRouter>{ui}</MemoryRouter>;
}

describe('DashboardClientePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renderiza loading inicial', async () => {
        useCases.mockReturnValue({ cases: [], loading: true, error: null });
        render(wrap(<DashboardClientePage />));
        // PageShell does not forward ARIA props; check that KPI skeleton cards are present
        const skeletons = document.querySelectorAll('.dashboard-cliente__kpis .skeleton');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renderiza erro de casos', () => {
        useCases.mockReturnValue({ cases: [], loading: false, error: new Error('Falha') });
        render(wrap(<DashboardClientePage />));
        expect(screen.getByText(/Não foi possível carregar os dados agora/i)).toBeInTheDocument();
    });

    it('renderiza KPIs com valores corretos', async () => {
        useCases.mockReturnValue({
            cases: [
                { id: '1', status: 'DONE', finalVerdict: 'FIT', createdAt: '2024-06-01', concludedAt: '2024-06-02', candidateName: 'A' },
                { id: '2', status: 'IN_PROGRESS', createdAt: '2024-06-01', candidateName: 'B' },
                { id: '3', status: 'PENDING', createdAt: '2024-06-01', candidateName: 'C' },
                { id: '4', status: 'CORRECTION_NEEDED', createdAt: '2024-06-01', candidateName: 'D' },
                { id: '5', status: 'WAITING_INFO', createdAt: '2024-06-01', candidateName: 'E' },
            ],
            loading: false,
            error: null,
        });
        render(wrap(<DashboardClientePage />));
        await screen.findByRole('heading', { name: 'Início' });
        const totalCards = screen.getAllByLabelText(/:/i);
        expect(totalCards.length).toBeGreaterThanOrEqual(5);
    });

    it('exibe secao de acoes necessarias quando ha correcoes', async () => {
        useCases.mockReturnValue({
            cases: [
                { id: '1', status: 'CORRECTION_NEEDED', createdAt: '2024-06-01', candidateName: 'A' },
                { id: '2', status: 'WAITING_INFO', createdAt: '2024-06-01', candidateName: 'B' },
            ],
            loading: false,
            error: null,
        });
        render(wrap(<DashboardClientePage />));
        await screen.findByText('Ações necessárias');
        expect(screen.getAllByText('Aguardando correção').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Aguardando informações')).toBeInTheDocument();
    });

    it('nao exibe secao de acoes quando nao ha pendencias', async () => {
        useCases.mockReturnValue({
            cases: [
                { id: '1', status: 'DONE', finalVerdict: 'FIT', createdAt: '2024-06-01', concludedAt: '2024-06-02', candidateName: 'A' },
            ],
            loading: false,
            error: null,
        });
        render(wrap(<DashboardClientePage />));
        await screen.findByRole('heading', { name: 'Início' });
        expect(screen.queryByText('Ações necessárias')).not.toBeInTheDocument();
    });

    it('navega para solicitacoes ao clicar em acao', async () => {
        useCases.mockReturnValue({
            cases: [
                { id: '1', status: 'CORRECTION_NEEDED', createdAt: '2024-06-01', candidateName: 'A' },
            ],
            loading: false,
            error: null,
        });
        render(wrap(<DashboardClientePage />));
        await screen.findByText('Ações necessárias');
        fireEvent.click(screen.getByRole('button', { name: /Ver solicitações/i }));
        expect(mockNavigate).toHaveBeenCalledWith('/client/solicitacoes?filter=correction');
    });

    it('exibe aviso de recorte honesto', async () => {
        useCases.mockReturnValue({
            cases: [
                { id: '1', status: 'DONE', finalVerdict: 'FIT', createdAt: '2024-06-01', concludedAt: '2024-06-02', candidateName: 'A' },
            ],
            loading: false,
            error: null,
        });
        render(wrap(<DashboardClientePage />));
        await waitFor(() => {
            expect(screen.getByText(/solicitação\(ões\) carregada\(s\)/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/indicadores refletem apenas os registros disponíveis/i)).toBeInTheDocument();
    });

    it('KpiCards sem onClick renderizam como div', async () => {
        useCases.mockReturnValue({
            cases: [
                { id: '1', status: 'DONE', finalVerdict: 'FIT', createdAt: '2024-06-01', concludedAt: '2024-06-02', candidateName: 'A' },
            ],
            loading: false,
            error: null,
        });
        render(wrap(<DashboardClientePage />));
        await screen.findByRole('heading', { name: 'Início' });
        const cards = screen.getAllByLabelText(/:/i);
        cards.forEach((card) => {
            expect(card.tagName.toLowerCase()).toBe('div');
        });
    });

    it('exibe quota quando disponivel', async () => {
        useCases.mockReturnValue({
            cases: [
                { id: '1', status: 'DONE', finalVerdict: 'FIT', createdAt: '2024-06-01', concludedAt: '2024-06-02', candidateName: 'A' },
            ],
            loading: false,
            error: null,
        });
        render(wrap(<DashboardClientePage />));
        await screen.findByText('Consumo de Consultas');
        expect(screen.getByText('5/10')).toBeInTheDocument();
        expect(screen.getByText('20/50')).toBeInTheDocument();
    });
});
