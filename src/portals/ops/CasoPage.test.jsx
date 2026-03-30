import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const casoPageMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    authState: {
        user: { uid: 'ops-1', email: 'fagner.alexandro.lourenco@gmail.com' },
        userProfile: { role: 'admin' },
    },
    getCase: vi.fn(),
    updateCase: vi.fn(),
    logAuditEvent: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => casoPageMocks.authState,
}));

vi.mock('../../core/firebase/firestoreService', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getCase: (...args) => casoPageMocks.getCase(...args),
        updateCase: (...args) => casoPageMocks.updateCase(...args),
        logAuditEvent: (...args) => casoPageMocks.logAuditEvent(...args),
    };
});

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => casoPageMocks.navigate,
        useParams: () => ({ caseId: 'CASE-999' }),
    };
});

const { default: CasoPage } = await import('./CasoPage');

describe('CasoPage', () => {
    beforeEach(() => {
        casoPageMocks.getCase.mockReset();
        casoPageMocks.updateCase.mockReset();
        casoPageMocks.logAuditEvent.mockReset();
    });

    it('nao exibe caso mock quando a rota real nao existe', async () => {
        casoPageMocks.getCase.mockResolvedValue(null);

        render(<CasoPage />);

        expect(await screen.findByText('Caso indisponivel')).toBeInTheDocument();
        expect(screen.getByText('Caso nao encontrado no ambiente real.')).toBeInTheDocument();
        expect(screen.queryByText('Ana Paula Oliveira')).not.toBeInTheDocument();
        expect(screen.queryByText('TechCorp Inc.')).not.toBeInTheDocument();
    });
});
