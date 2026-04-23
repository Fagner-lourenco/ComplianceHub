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
    });

    it('bloqueia o envio quando a franquia ainda nao foi confirmada', () => {
        renderPage();

        expect(screen.getByText(/franquia do seu perfil ainda nao foi confirmada/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enviar Solicitacao' })).toBeDisabled();
    });

    it('renderiza formulario com campos obrigatorios (nome e CPF)', () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';
        solicitationMocks.authState.userProfile.tenantName = 'Empresa Teste';
        renderPage();

        expect(screen.getByPlaceholderText('Nome completo do candidato')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('000.000.000-00')).toBeInTheDocument();
    });

    it('botao desabilitado quando CPF eh invalido (repeticao)', () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';
        renderPage();

        const nomeInput = screen.getByPlaceholderText('Nome completo do candidato');
        const cpfInput = screen.getByPlaceholderText('000.000.000-00');

        fireEvent.change(nomeInput, { target: { value: 'Joao Silva' } });
        fireEvent.change(cpfInput, { target: { value: '111.111.111-11' } });

        expect(screen.getByRole('button', { name: 'Enviar Solicitacao' })).toBeDisabled();
        expect(firestoreMocks.callCreateClientSolicitation).not.toHaveBeenCalled();
    });

    it('chama createClientSolicitation com CPF valido e redireciona', async () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';
        renderPage();

        fireEvent.change(screen.getByPlaceholderText('Nome completo do candidato'), { target: { value: 'Maria Santos' } });
        fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '529.982.247-25' } });

        fireEvent.click(screen.getByRole('button', { name: 'Enviar Solicitacao' }));

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
        expect(await screen.findByText('Solicitacao enviada')).toBeInTheDocument();
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
        expect(screen.getByRole('button', { name: 'Enviar Solicitacao' })).toBeDisabled();
    });

    it('mostra erro retornado pelo backend ao criar solicitacao', async () => {
        solicitationMocks.authState.userProfile.tenantId = 'tenant-1';
        firestoreMocks.callCreateClientSolicitation.mockRejectedValue({
            code: 'invalid-argument',
            message: 'CPF ja cadastrado para esta franquia.',
        });

        renderPage();

        fireEvent.change(screen.getByPlaceholderText('Nome completo do candidato'), { target: { value: 'Pedro Alves' } });
        fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '529.982.247-25' } });

        fireEvent.click(screen.getByRole('button', { name: 'Enviar Solicitacao' }));

        await waitFor(() => {
            expect(screen.getByText(/CPF ja cadastrado/i)).toBeInTheDocument();
        });
    });
});
