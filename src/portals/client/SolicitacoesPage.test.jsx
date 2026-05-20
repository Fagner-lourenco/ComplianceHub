import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

const solicitacoesMocks = vi.hoisted(() => ({
    authState: {
        user: { uid: 'client-1', email: 'cliente@empresa.com' },
        userProfile: {
            uid: 'client-1',
            tenantId: 'tenant-1',
            tenantName: 'Empresa Teste',
            role: 'client_manager',
            source: 'server',
        },
    },
    casesState: {
        loading: false,
        error: null,
        cases: [
            {
                id: 'case-sem-campos',
                tenantId: 'tenant-1',
                status: 'PENDING',
                createdAt: '2026-04-30',
            },
        ],
    },
    quotaStatus: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => solicitacoesMocks.authState,
}));

vi.mock('../../hooks/useCases', () => ({
    useCases: () => solicitacoesMocks.casesState,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    ANALYSIS_PHASE_LABELS: {},
    callSubmitClientCorrection: vi.fn(),
    callGetClientQuotaStatus: (...args) => solicitacoesMocks.quotaStatus(...args),
    getCasePublicResult: vi.fn(),
    getEnabledPhases: () => [],
    getTenantSettings: vi.fn().mockResolvedValue({ analysisConfig: {} }),
}));

const { default: SolicitacoesPage } = await import('./SolicitacoesPage');

function renderPage() {
    return render(
        <MemoryRouter initialEntries={['/client/solicitacoes']}>
            <SolicitacoesPage />
        </MemoryRouter>,
    );
}

describe('SolicitacoesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        solicitacoesMocks.quotaStatus.mockResolvedValue({ hasLimits: false });
    });

    it('mantem a busca funcional quando documentos antigos nao possuem nome ou CPF', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: 'case-sem-campos' } });

        expect(await screen.findByRole('table', { name: /solicitações de análise cadastral/i })).toBeInTheDocument();
    });

    it('exibe aviso quando a quota nao pode ser carregada', async () => {
        solicitacoesMocks.quotaStatus.mockRejectedValue(new Error('quota indisponivel'));

        renderPage();

        await waitFor(() => {
            expect(screen.getByText(/Consumo temporariamente indisponivel/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/limites continuam sendo validados no servidor/i)).toBeInTheDocument();
    });
});
