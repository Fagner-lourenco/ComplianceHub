import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const casosPageMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    tenantState: { selectedTenantId: 'all' },
    callListOpsCases: vi.fn(),
}));

vi.mock('../../core/contexts/useTenant', () => ({
    useTenant: () => casosPageMocks.tenantState,
}));

vi.mock('../../hooks/useCases', () => ({
    useCases: () => ({ cases: [], loading: false, error: null }),
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    callListOpsCases: (...args) => casosPageMocks.callListOpsCases(...args),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => casosPageMocks.navigate,
        useLocation: () => ({ pathname: '/ops/casos', search: '', hash: '', state: null, key: 'default' }),
    };
});

const { default: CasosPage } = await import('./CasosPage');

describe('CasosPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        casosPageMocks.tenantState = { selectedTenantId: 'all' };
        casosPageMocks.callListOpsCases.mockResolvedValue({
            cases: [
                {
                    id: 'case-1',
                    tenantName: 'Tenant A',
                    candidateName: 'Ana Silva',
                    cpf: '12345678901',
                    cpfMasked: '***.456.789-**',
                    candidatePosition: 'Analista',
                    createdAt: '2026-05-01T00:00:00.000Z',
                    status: 'DONE',
                    criminalFlag: 'NEGATIVE',
                    finalVerdict: 'FIT',
                    riskLevel: 'LOW',
                },
            ],
            total: 1200,
            totalPages: 24,
            stats: { total: 1200, done: 900, pending: 250, inProgress: 40, corrections: 10, red: 33, fit: 850, attention: 45, notRecommended: 5 },
            meta: { source: 'server', scannedRecords: 1200 },
        });
    });

    it('usa listagem operacional server-side para exibir totais acima de 500', async () => {
        render(<CasosPage />);

        await waitFor(() => {
            expect(casosPageMocks.callListOpsCases).toHaveBeenCalledWith(expect.objectContaining({
                page: 1,
                pageSize: 50,
                tenantId: null,
            }));
        });

        expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
        expect(screen.getByText('1200')).toBeInTheDocument();
        expect(screen.getByText(/Mostrando 1 de 1200 casos/i)).toBeInTheDocument();
    });
});
