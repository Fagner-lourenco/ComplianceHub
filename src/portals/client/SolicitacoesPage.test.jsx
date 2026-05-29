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
            {
                id: 'case-001',
                tenantId: 'tenant-1',
                candidateName: 'Ana Paula Silva',
                cpf: '27144599845',
                cpfMasked: '***.***.***-45',
                status: 'DONE',
                createdAt: '2026-04-30',
                finalVerdict: 'FIT',
                riskScore: 10,
            },
            {
                id: 'case-002',
                tenantId: 'tenant-1',
                candidateName: 'Carlos Eduardo Santos',
                cpf: '18432165412',
                cpfMasked: '***.***.***-12',
                status: 'DONE',
                createdAt: '2026-04-30',
                finalVerdict: 'ATTENTION',
                riskScore: 45,
            },
        ],
    },
    quotaStatus: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => solicitacoesMocks.authState,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    ANALYSIS_PHASE_LABELS: {},
    callSubmitClientCorrection: vi.fn(),
    callGetClientQuotaStatus: (...args) => solicitacoesMocks.quotaStatus(...args),
    callListClientCases: vi.fn((payload = {}) => {
        const filters = payload.filters || {};
        let cases = [...solicitacoesMocks.casesState.cases];
        if (filters.status && filters.status !== 'ALL') cases = cases.filter((caseData) => caseData.status === filters.status);
        if (filters.verdict && filters.verdict !== 'ALL') cases = cases.filter((caseData) => caseData.finalVerdict === filters.verdict);
        if (filters.searchTerm) {
            const term = String(filters.searchTerm).toLowerCase();
            const digits = term.replace(/\D/g, '');
            cases = cases.filter((caseData) => {
                const name = String(caseData.candidateName || '').toLowerCase();
                const cpf = String(caseData.cpf || '').replace(/\D/g, '');
                return name.includes(term) || (digits.length >= 3 && cpf.includes(digits));
            });
        }
        return Promise.resolve({
            cases,
            total: cases.length,
            totalPages: 1,
            stats: cases.reduce((acc, caseData) => {
                acc.total += 1;
                if (caseData.status === 'DONE') acc.done += 1;
                if (caseData.status === 'PENDING') acc.pending += 1;
                if (caseData.status === 'CORRECTION_NEEDED') acc.corrections += 1;
                if (caseData.finalVerdict === 'NOT_RECOMMENDED') acc.notRecommended += 1;
                return acc;
            }, { total: 0, done: 0, pending: 0, inProgress: 0, waiting: 0, corrections: 0, notRecommended: 0 }),
            meta: { source: 'server' },
        });
    }),
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

        // Documento antigo sem nome/CPF nao deve aparecer em buscas por nome
        fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: 'case-sem-campos' } });
        await waitFor(() => {
            expect(screen.queryByText('case-sem-campos')).not.toBeInTheDocument();
        });

        // Mas a tabela continua renderizando normalmente
        expect(await screen.findByRole('table', { name: /solicitações de análise cadastral/i })).toBeInTheDocument();
    });

    it('filtra por nome completo ou parcial', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: 'Ana Paula' } });
        await waitFor(() => {
            expect(screen.getByText('Ana Paula Silva')).toBeInTheDocument();
            expect(screen.queryByText('Carlos Eduardo Santos')).not.toBeInTheDocument();
        });
    });

    it('filtra por CPF completo (11 digitos)', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: '27144599845' } });
        await waitFor(() => {
            expect(screen.getByText('Ana Paula Silva')).toBeInTheDocument();
            expect(screen.queryByText('Carlos Eduardo Santos')).not.toBeInTheDocument();
        });
    });

    it('filtra por trecho do CPF (3 digitos)', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: '445' } });
        await waitFor(() => {
            expect(screen.getByText('Ana Paula Silva')).toBeInTheDocument();
            expect(screen.queryByText('Carlos Eduardo Santos')).not.toBeInTheDocument();
        });
    });

    it('filtra por CPF formatado (com pontos e traco)', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: '271.445.998-45' } });
        await waitFor(() => {
            expect(screen.getByText('Ana Paula Silva')).toBeInTheDocument();
            expect(screen.queryByText('Carlos Eduardo Santos')).not.toBeInTheDocument();
        });
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
