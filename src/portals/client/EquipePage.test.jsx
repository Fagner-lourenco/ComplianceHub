import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const equipeMocks = vi.hoisted(() => ({
    authState: {
        user: { uid: 'manager-1', email: 'gestor@empresa.com' },
        userProfile: {
            uid: 'manager-1',
            tenantId: 'tenant-1',
            tenantName: 'Empresa Teste',
            role: 'client_manager',
            source: 'server',
        },
    },
    callListTenantUsers: vi.fn(),
    callCreateTenantUser: vi.fn(),
    callUpdateTenantUser: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => equipeMocks.authState,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    callListTenantUsers: (...args) => equipeMocks.callListTenantUsers(...args),
    callCreateTenantUser: (...args) => equipeMocks.callCreateTenantUser(...args),
    callUpdateTenantUser: (...args) => equipeMocks.callUpdateTenantUser(...args),
}));

const { default: EquipePage } = await import('./EquipePage');

const users = [
    {
        uid: 'manager-1',
        displayName: 'Gestora Principal',
        email: 'gestor@empresa.com',
        role: 'client_manager',
        status: 'active',
    },
    {
        uid: 'operator-1',
        displayName: 'Operador Cliente',
        email: 'operador@empresa.com',
        role: 'client_operator',
        status: 'active',
    },
    {
        uid: 'pending-1',
        displayName: 'Convite Pendente',
        email: 'pendente@empresa.com',
        role: 'client_viewer',
        status: 'pending',
    },
];

function renderPage() {
    return render(<EquipePage />);
}

describe('EquipePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        equipeMocks.callListTenantUsers.mockResolvedValue({ users });
        equipeMocks.callCreateTenantUser.mockResolvedValue({ uid: 'new-user' });
        equipeMocks.callUpdateTenantUser.mockResolvedValue({ success: true });
    });

    it('lista usuarios e nao conta status pending como ativo', async () => {
        renderPage();

        expect(await screen.findByText('Operador Cliente')).toBeInTheDocument();
        expect(screen.getByText('Pendente')).toBeInTheDocument();
        expect(screen.getByText('Atenção')).toBeInTheDocument();
    });

    it('exige confirmacao antes de alterar perfil', async () => {
        renderPage();

        await screen.findByText('Operador Cliente');
        fireEvent.change(screen.getByDisplayValue('Operador'), { target: { value: 'client_manager' } });

        expect(screen.getByText('Alterar perfil de acesso?')).toBeInTheDocument();
        expect(equipeMocks.callUpdateTenantUser).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));

        await waitFor(() => {
            expect(equipeMocks.callUpdateTenantUser).toHaveBeenCalledWith({
                targetUid: 'operator-1',
                role: 'client_manager',
            });
        });
    });

    it('exige confirmacao antes de desativar usuario', async () => {
        renderPage();

        await screen.findByText('Operador Cliente');
        fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));

        expect(screen.getByText('Desativar usuário?')).toBeInTheDocument();
        expect(equipeMocks.callUpdateTenantUser).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Desativar usuário' }));

        await waitFor(() => {
            expect(equipeMocks.callUpdateTenantUser).toHaveBeenCalledWith({
                targetUid: 'operator-1',
                status: 'inactive',
            });
        });
    });

    it('explica perfis e nao expoe senha provisoria no alerta de sucesso', async () => {
        renderPage();

        fireEvent.click(await screen.findByRole('button', { name: 'Adicionar usuário' }));
        expect(screen.getByText(/Gerencia solicitações, usuários/i)).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Ex: Maria da Silva'), { target: { value: 'Nova Pessoa' } });
        fireEvent.change(screen.getByPlaceholderText('email@empresa.com'), { target: { value: 'nova@empresa.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Criar usuário' }));

        expect(await screen.findByText(/Usuário criado com sucesso/i)).toBeInTheDocument();
        expect(screen.queryByText(/Senha provisoria:/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Senha provisória:/i)).not.toBeInTheDocument();
    });

    it('protege fechamento do modal com formulario preenchido', async () => {
        renderPage();

        fireEvent.click(await screen.findByRole('button', { name: 'Adicionar usuário' }));
        fireEvent.change(screen.getByPlaceholderText('Ex: Maria da Silva'), { target: { value: 'Rascunho' } });
        fireEvent.click(screen.getByRole('button', { name: 'X' }));

        expect(screen.getByText('Descartar usuário em criação?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continuar editando' })).toBeInTheDocument();
    });
});
