import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const dashboardMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    quotaStatus: vi.fn(),
    metrics: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => dashboardMocks.navigate };
});

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => ({
        user: { uid: 'user-1', email: 'teste@exemplo.com' },
        userProfile: { uid: 'user-1', tenantId: 'tenant-1', role: 'client_manager', displayName: 'Teste' },
    }),
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    callGetClientDashboardMetrics: (...args) => dashboardMocks.metrics(...args),
    callGetClientQuotaStatus: (...args) => dashboardMocks.quotaStatus(...args),
}));

const { default: DashboardClientePage } = await import('./DashboardClientePage');

function metric(overrides = {}) {
    return {
        total: 5,
        done: 1,
        inProgress: 2,
        pending: 1,
        corrections: 1,
        waitingInfo: 1,
        completionRate: 20,
        avgTurnaroundHours: null,
        verdicts: { FIT: 1, ATTENTION: 0, NOT_RECOMMENDED: 0 },
        months: [],
        maxMonthCount: 1,
        topFlags: [],
        recentCompletedCases: [],
        ...overrides,
    };
}

function wrap(ui) {
    return <MemoryRouter>{ui}</MemoryRouter>;
}

describe('DashboardClientePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dashboardMocks.quotaStatus.mockResolvedValue({
            hasLimits: true,
            dailyCount: 5,
            dailyLimit: 10,
            monthlyCount: 20,
            monthlyLimit: 50,
            allowDailyExceedance: false,
            allowMonthlyExceedance: true,
        });
        dashboardMocks.metrics.mockResolvedValue(metric());
    });

    it('renderiza loading inicial', () => {
        dashboardMocks.metrics.mockReturnValue(new Promise(() => {}));
        render(wrap(<DashboardClientePage />));
        const skeletons = document.querySelectorAll('.dashboard-cliente__kpis .skeleton');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renderiza erro de métricas', async () => {
        dashboardMocks.metrics.mockRejectedValue(new Error('Falha'));
        render(wrap(<DashboardClientePage />));
        expect(await screen.findByText(/Não foi possível carregar os dados agora/i)).toBeInTheDocument();
    });

    it('renderiza KPIs com valores do servidor', async () => {
        dashboardMocks.metrics.mockResolvedValue(metric({ total: 650, done: 520 }));
        render(wrap(<DashboardClientePage />));
        await screen.findByRole('heading', { name: 'Início' });
        expect(screen.getByText('650')).toBeInTheDocument();
        expect(screen.getAllByText('520').length).toBeGreaterThanOrEqual(1);
    });

    it('exibe secao de acoes necessarias quando ha correcoes', async () => {
        render(wrap(<DashboardClientePage />));
        await screen.findByText('Ações necessárias');
        expect(screen.getAllByText('Aguardando correção').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Aguardando informações')).toBeInTheDocument();
    });

    it('nao exibe secao de acoes quando nao ha pendencias', async () => {
        dashboardMocks.metrics.mockResolvedValue(metric({ corrections: 0, waitingInfo: 0 }));
        render(wrap(<DashboardClientePage />));
        await screen.findByRole('heading', { name: 'Início' });
        expect(screen.queryByText('Ações necessárias')).not.toBeInTheDocument();
    });

    it('navega para solicitacoes ao clicar em acao', async () => {
        render(wrap(<DashboardClientePage />));
        await screen.findByText('Ações necessárias');
        fireEvent.click(screen.getAllByRole('button', { name: /Ver solicitações/i })[0]);
        expect(dashboardMocks.navigate).toHaveBeenCalledWith('/client/solicitacoes?filter=correction');
    });

    it('exibe aviso de métrica server-side', async () => {
        render(wrap(<DashboardClientePage />));
        await waitFor(() => {
            expect(screen.getByText(/solicitação\(ões\) considerada\(s\)/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/Indicadores calculados no servidor/i)).toBeInTheDocument();
    });

    it('exibe quota quando disponivel', async () => {
        render(wrap(<DashboardClientePage />));
        await screen.findByText('Consumo de Consultas');
        expect(screen.getByText('5/10')).toBeInTheDocument();
        expect(screen.getByText('20/50')).toBeInTheDocument();
    });
});
