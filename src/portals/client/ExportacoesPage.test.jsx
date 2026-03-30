import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const exportacoesPageMocks = vi.hoisted(() => ({
    authState: {
        user: { uid: 'client-1', email: 'analista.rh@madero.com.br' },
        userProfile: {
            uid: 'client-1',
            tenantId: 'madero-br',
            tenantName: 'Madero Industria e Comercio S.A.',
            role: 'client_manager',
            source: 'server',
        },
    },
    casesState: {
        cases: [],
    },
    subscribeToExports: vi.fn(),
    createExport: vi.fn(),
    logAuditEvent: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => exportacoesPageMocks.authState,
}));

vi.mock('../../hooks/useCases', () => ({
    useCases: () => exportacoesPageMocks.casesState,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    subscribeToExports: (...args) => exportacoesPageMocks.subscribeToExports(...args),
    createExport: (...args) => exportacoesPageMocks.createExport(...args),
    logAuditEvent: (...args) => exportacoesPageMocks.logAuditEvent(...args),
}));

exportacoesPageMocks.subscribeToExports.mockImplementation((tenantId, callback) => {
    callback([], null);
    return () => {};
});

const { default: ExportacoesPage } = await import('./ExportacoesPage');

describe('ExportacoesPage', () => {
    beforeEach(() => {
        exportacoesPageMocks.subscribeToExports.mockClear();
        exportacoesPageMocks.createExport.mockReset();
        exportacoesPageMocks.logAuditEvent.mockReset();
    });

    it('usa historico real vazio em vez de mock no portal do cliente', async () => {
        render(<ExportacoesPage />);

        expect(await screen.findByText('Nenhuma exportacao registrada.')).toBeInTheDocument();
        expect(screen.queryByText('EXP-001')).not.toBeInTheDocument();
        expect(exportacoesPageMocks.subscribeToExports).toHaveBeenCalledWith('madero-br', expect.any(Function));
    });
});
