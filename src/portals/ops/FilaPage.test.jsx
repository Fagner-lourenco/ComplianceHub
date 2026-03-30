import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const filaPageMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    authState: {
        user: { uid: 'analyst-7', email: 'analyst@hub.br' },
        userProfile: { role: 'analyst' },
    },
    tenantState: {
        selectedTenantId: 'all',
    },
    casesState: {
        cases: [],
        loading: false,
        error: null,
    },
    updateCase: vi.fn(),
    logAuditEvent: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => filaPageMocks.authState,
}));

vi.mock('../../core/contexts/useTenant', () => ({
    useTenant: () => filaPageMocks.tenantState,
}));

vi.mock('../../hooks/useCases', () => ({
    useCases: () => filaPageMocks.casesState,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    updateCase: (...args) => filaPageMocks.updateCase(...args),
    logAuditEvent: (...args) => filaPageMocks.logAuditEvent(...args),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => filaPageMocks.navigate,
    };
});

const { default: FilaPage } = await import('./FilaPage');

describe('FilaPage', () => {
    beforeEach(() => {
        filaPageMocks.navigate.mockReset();
        filaPageMocks.updateCase.mockReset();
        filaPageMocks.logAuditEvent.mockReset();
    });

    it('filtra "Meus casos" pelo uid do usuario autenticado, nao por string fixa', () => {
        filaPageMocks.casesState = {
            cases: [
                {
                    id: 'C1',
                    candidateName: 'Alice',
                    tenantName: 'Tenant A',
                    candidatePosition: 'Dev',
                    createdAt: '2026-01-01',
                    priority: 'NORMAL',
                    status: 'IN_PROGRESS',
                    criminalFlag: 'CLEAR',
                    riskLevel: 'LOW',
                    assigneeId: 'analyst-7',
                },
                {
                    id: 'C2',
                    candidateName: 'Bob',
                    tenantName: 'Tenant B',
                    candidatePosition: 'QA',
                    createdAt: '2026-01-02',
                    priority: 'HIGH',
                    status: 'PENDING',
                    criminalFlag: 'CLEAR',
                    riskLevel: 'MEDIUM',
                    assigneeId: 'other-user',
                },
            ],
            loading: false,
            error: null,
        };

        render(<FilaPage />);

        // Select "Meus casos"
        const selects = screen.getAllByRole('combobox');
        const assignmentSelect = selects[1];
        fireEvent.change(assignmentSelect, { target: { value: 'MINE' } });

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    });

    it('chama updateCase e logAuditEvent ao clicar em Assumir', async () => {
        filaPageMocks.updateCase.mockResolvedValue(undefined);
        filaPageMocks.logAuditEvent.mockResolvedValue(undefined);
        filaPageMocks.casesState = {
            cases: [
                {
                    id: 'C3',
                    candidateName: 'Carlos',
                    tenantName: 'Tenant C',
                    tenantId: 'tenant-c',
                    candidatePosition: 'Eng',
                    createdAt: '2026-02-01',
                    priority: 'NORMAL',
                    status: 'PENDING',
                    criminalFlag: 'CLEAR',
                    riskLevel: 'LOW',
                    assigneeId: null,
                },
            ],
            loading: false,
            error: null,
        };

        render(<FilaPage />);

        const assumeButton = screen.getByRole('button', { name: 'Assumir' });
        fireEvent.click(assumeButton);

        await vi.waitFor(() => {
            expect(filaPageMocks.updateCase).toHaveBeenCalledWith('C3', {
                assigneeId: 'analyst-7',
                status: 'IN_PROGRESS',
            });
        });

        expect(filaPageMocks.logAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'analyst-7',
                action: 'CASE_ASSIGNED',
                target: 'C3',
            }),
        );
    });

    it('nao mostra botao Assumir quando caso ja tem assigneeId', () => {
        filaPageMocks.casesState = {
            cases: [
                {
                    id: 'C4',
                    candidateName: 'Diana',
                    tenantName: 'Tenant D',
                    candidatePosition: 'PM',
                    createdAt: '2026-03-01',
                    priority: 'HIGH',
                    status: 'IN_PROGRESS',
                    criminalFlag: 'FLAGGED',
                    riskLevel: 'HIGH',
                    assigneeId: 'analyst-7',
                },
            ],
            loading: false,
            error: null,
        };

        render(<FilaPage />);

        expect(screen.queryByRole('button', { name: 'Assumir' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Abrir' })).toBeInTheDocument();
    });
});
