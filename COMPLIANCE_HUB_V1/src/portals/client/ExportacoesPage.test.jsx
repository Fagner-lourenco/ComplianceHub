import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        loading: false,
        error: null,
        cases: [
            {
                id: 'case-1',
                candidateName: 'João Silva',
                cpfMasked: '***.123.456-**',
                status: 'DONE',
                createdAt: '2026-04-20',
                riskLevel: 'GREEN',
                finalVerdict: 'FIT',
            },
            {
                id: 'case-2',
                candidateName: 'Maria Lima',
                cpfMasked: '***.987.654-**',
                status: 'PENDING',
                createdAt: '2026-04-21',
            },
        ],
    },
    subscribeToExports: vi.fn(),
    callRegisterClientExport: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => exportacoesPageMocks.authState,
}));

vi.mock('../../hooks/useCases', () => ({
    useCases: () => exportacoesPageMocks.casesState,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    subscribeToExports: (...args) => exportacoesPageMocks.subscribeToExports(...args),
    callRegisterClientExport: (...args) => exportacoesPageMocks.callRegisterClientExport(...args),
}));

exportacoesPageMocks.subscribeToExports.mockImplementation((tenantId, callback) => {
    callback([], null);
    return () => {};
});

const { default: ExportacoesPage } = await import('./ExportacoesPage');

describe('ExportacoesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        exportacoesPageMocks.authState.user = { uid: 'client-1', email: 'analista.rh@madero.com.br' };
        exportacoesPageMocks.authState.userProfile = {
            uid: 'client-1',
            tenantId: 'madero-br',
            tenantName: 'Madero Industria e Comercio S.A.',
            role: 'client_manager',
            source: 'server',
        };
        exportacoesPageMocks.casesState = {
            loading: false,
            error: null,
            cases: [
                {
                    id: 'case-1',
                    candidateName: 'João Silva',
                    cpfMasked: '***.123.456-**',
                    status: 'DONE',
                    createdAt: '2026-04-20',
                    riskLevel: 'GREEN',
                    finalVerdict: 'FIT',
                },
                {
                    id: 'case-2',
                    candidateName: 'Maria Lima',
                    cpfMasked: '***.987.654-**',
                    status: 'PENDING',
                    createdAt: '2026-04-21',
                },
            ],
        };
        exportacoesPageMocks.callRegisterClientExport.mockResolvedValue({ exportId: 'exp-1' });
        global.URL.createObjectURL = vi.fn(() => 'blob:export');
        global.URL.revokeObjectURL = vi.fn();
        window.open = vi.fn();
    });

    it('usa historico real vazio em vez de mock no portal do cliente', async () => {
        render(<ExportacoesPage />);

        expect(await screen.findByText('Nenhuma exportação registrada.')).toBeInTheDocument();
        expect(screen.queryByText('EXP-001')).not.toBeInTheDocument();
        expect(exportacoesPageMocks.subscribeToExports).toHaveBeenCalledWith('madero-br', expect.any(Function));
    });

    it('mostra que o escopo usa casos carregados e renomeia PDF para imprimivel', () => {
        render(<ExportacoesPage />);

        expect(screen.getAllByText(/Casos carregados/i).length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: /Página para impressão/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^PDF$/i })).not.toBeInTheDocument();
    });

    it('bloqueia exportacao quando casos estao em erro', () => {
        exportacoesPageMocks.casesState = { loading: false, error: new Error('permission-denied'), cases: [] };

        render(<ExportacoesPage />);

        expect(screen.getByRole('button', { name: /Registrar e gerar/i })).toBeDisabled();
        expect(screen.getByText(/Não foi possível carregar as solicitações|exportação foi bloqueada/i)).toBeInTheDocument();
    });

    it('bloqueia intervalo de data invalido sem chamar backend', () => {
        render(<ExportacoesPage />);

        fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-04-30' } });
        fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-04-01' } });

        expect(screen.getByText(/data inicial não pode ser posterior/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Registrar e gerar/i })).toBeDisabled();
        expect(exportacoesPageMocks.callRegisterClientExport).not.toHaveBeenCalled();
    });

    it('registra a exportacao antes de entregar o arquivo local', async () => {
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        render(<ExportacoesPage />);

        fireEvent.click(screen.getByRole('button', { name: /Registrar e gerar/i }));

        await waitFor(() => {
            expect(exportacoesPageMocks.callRegisterClientExport).toHaveBeenCalledTimes(1);
        });
        expect(exportacoesPageMocks.callRegisterClientExport).toHaveBeenCalledWith(expect.objectContaining({
            type: 'CSV',
            scopeCode: 'ALL',
            records: 2,
            artifactMode: 'download',
            containsPending: true,
        }));
        await waitFor(() => expect(clickSpy).toHaveBeenCalled());
        clickSpy.mockRestore();
    });

    it('avisa quando historico real nao possui artefato armazenado', async () => {
        exportacoesPageMocks.subscribeToExports.mockImplementationOnce((tenantId, callback) => {
            callback([{
                id: 'exp-real-1',
                type: 'CSV',
                scope: 'Casos carregados',
                records: 2,
                status: 'READY',
                createdAt: '2026-04-30',
                createdByEmail: 'analista.rh@madero.com.br',
                artifactMode: 'download',
            }], null);
            return () => {};
        });

        render(<ExportacoesPage />);

        expect(await screen.findByText(/Gerado localmente - não armazenado/i)).toBeInTheDocument();
        expect(screen.getByText('analista.rh@madero.com.br')).toBeInTheDocument();
    });
});
