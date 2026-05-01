import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import NovaSolicitacaoPage from './NovaSolicitacaoPage';

const solicitationMocks = vi.hoisted(() => ({
    authState: {
        user: { uid: 'client-1', email: 'cliente@empresa.com' },
        userProfile: {
            displayName: 'Cliente',
            email: 'cliente@empresa.com',
            role: 'client_manager',
            tenantId: null,
            tenantName: null,
        },
    },
}));

const firestoreMocks = vi.hoisted(() => ({
    callCreateClientSolicitation: vi.fn().mockResolvedValue({ success: true, caseId: 'c-1' }),
    callGetClientQuotaStatus: vi.fn().mockResolvedValue({ hasLimits: false }),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => solicitationMocks.authState,
}));

vi.mock('../../core/firebase/firestoreService', () => firestoreMocks);

function renderPage() {
    return render(
        <MemoryRouter initialEntries={['/client/nova']}>
            <NovaSolicitacaoPage />
        </MemoryRouter>,
    );
}

describe('NovaSolicitacaoPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset to default state (no tenant)
        solicitationMocks.authState.userProfile = {
            displayName: 'Cliente',
            email: 'cliente@empresa.com',
            role: 'client_manager',
            tenantId: null,
            tenantName: null,
        };
        firestoreMocks.callGetClientQuotaStatus.mockResolvedValue({ hasLimits: false });
        firestoreMocks.callCreateClientSolicitation.mockResolvedValue({ success: true, caseId: 'c-1' });
    });

    it('bloqueia o envio quando a franquia ainda nao foi confirmada', () => {
        renderPage();

        expect(screen.getByText(/franquia não confirmada/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enviar solicitação' })).toBeDisabled();
    });

    it('renderiza formulario com campos obrigatorios (nome e CPF)', () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';
        solicitationMocks.authState.userProfile.tenantName = 'Empresa Teste';
        renderPage();

        expect(screen.getByPlaceholderText('Conforme consta no documento de identidade')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('000.000.000-00')).toBeInTheDocument();
    });

    it('botao desabilitado quando CPF eh invalido (repeticao)', () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';
        renderPage();

        const nomeInput = screen.getByPlaceholderText('Conforme consta no documento de identidade');
        const cpfInput = screen.getByPlaceholderText('000.000.000-00');

        fireEvent.change(nomeInput, { target: { value: 'Joao Silva' } });
        fireEvent.change(cpfInput, { target: { value: '111.111.111-11' } });

        expect(screen.getByRole('button', { name: 'Enviar solicitação' })).toBeDisabled();
        expect(firestoreMocks.callCreateClientSolicitation).not.toHaveBeenCalled();
    });

    it('chama createClientSolicitation com CPF valido e redireciona', async () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';
        renderPage();

        fireEvent.change(screen.getByPlaceholderText('Conforme consta no documento de identidade'), { target: { value: 'Maria Santos' } });
        fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '529.982.247-25' } });

        fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

        await waitFor(() => {
            expect(firestoreMocks.callCreateClientSolicitation).toHaveBeenCalledTimes(1);
        });

        expect(firestoreMocks.callCreateClientSolicitation).toHaveBeenCalledWith(
            expect.objectContaining({
                fullName: 'Maria Santos',
                cpf: '529.982.247-25',
            }),
        );

        // Deve mostrar tela de sucesso
        expect(await screen.findByText(/Solicitação enviada com sucesso/i)).toBeInTheDocument();
    });

    it('mostra quota bloqueada quando limite diario atingido sem allowExceedance', async () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';
        firestoreMocks.callGetClientQuotaStatus.mockResolvedValue({
            hasLimits: true,
            dailyLimit: 5,
            dailyCount: 5,
            monthlyLimit: 100,
            monthlyCount: 20,
            allowDailyExceedance: false,
            allowMonthlyExceedance: false,
        });

        renderPage();

        await waitFor(() => {
            expect(screen.getByText(/Limite atingido/i)).toBeInTheDocument();
        });

        // Botao deve estar desabilitado
        expect(screen.getByRole('button', { name: 'Enviar solicitação' })).toBeDisabled();
    });

    it('mostra erro retornado pelo backend ao criar solicitacao', async () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';
        firestoreMocks.callCreateClientSolicitation.mockRejectedValue({
            code: 'invalid-argument',
            message: 'CPF ja cadastrado para esta franquia.',
        });

        renderPage();

        fireEvent.change(screen.getByPlaceholderText('Conforme consta no documento de identidade'), { target: { value: 'Pedro Alves' } });
        fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '529.982.247-25' } });

        fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

        await waitFor(() => {
            expect(screen.getByText(/CPF ja cadastrado/i)).toBeInTheDocument();
        });
    });

    it('mostra aviso quando a quota esta indisponivel', async () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';
        firestoreMocks.callGetClientQuotaStatus.mockRejectedValue(new Error('quota offline'));

        renderPage();

        expect(await screen.findByText(/Consumo temporariamente indisponivel/i)).toBeInTheDocument();
        expect(screen.getByText(/limites continuam sendo validados no servidor/i)).toBeInTheDocument();
    });

    it('confirma excedencia antes de chamar o backend', async () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';
        solicitationMocks.authState.userProfile.tenantName = 'Empresa Teste';
        firestoreMocks.callGetClientQuotaStatus.mockResolvedValue({
            hasLimits: true,
            dailyLimit: 5,
            dailyCount: 5,
            monthlyLimit: 100,
            monthlyCount: 20,
            allowDailyExceedance: true,
            allowMonthlyExceedance: false,
        });

        renderPage();

        await screen.findByText(/Atenção/i);

        fireEvent.change(screen.getByPlaceholderText('Conforme consta no documento de identidade'), { target: { value: 'Maria Santos' } });
        fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '529.982.247-25' } });

        fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

        expect(await screen.findByText('Confirmar envio excedente?')).toBeInTheDocument();
        expect(firestoreMocks.callCreateClientSolicitation).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Confirmar envio excedente' }));

        await waitFor(() => {
            expect(firestoreMocks.callCreateClientSolicitation).toHaveBeenCalledTimes(1);
        });
    });

    it('abre modal de descarte ao cancelar com formulario preenchido', () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';

        renderPage();

        fireEvent.change(screen.getByPlaceholderText('Conforme consta no documento de identidade'), { target: { value: 'Maria Santos' } });
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(screen.getByText('Descartar preenchimento?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continuar preenchendo' })).toBeInTheDocument();
    });
});
