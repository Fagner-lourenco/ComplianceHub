import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PerfilPage from './PerfilPage';

const mockRefreshProfile = vi.fn();

let mockUser = null;
let mockProfile = null;

function createMockUser(overrides = {}) {
    return {
        email: 'usuario@exemplo.com',
        metadata: {
            creationTime: '2024-01-15T10:00:00Z',
            lastSignInTime: '2024-06-20T14:30:00Z',
        },
        providerData: [{ providerId: 'password' }],
        ...overrides,
    };
}

function createMockProfile(overrides = {}) {
    return {
        displayName: 'Joao Silva',
        email: 'usuario@exemplo.com',
        role: 'client_manager',
        tenantName: 'Franquia Alpha',
        ...overrides,
    };
}

vi.mock('../core/auth/useAuth', () => ({
    useAuth: () => ({
        user: mockUser,
        userProfile: mockProfile,
        refreshProfile: mockRefreshProfile,
    }),
}));

vi.mock('../core/firebase/firestoreService', () => ({
    callUpdateOwnProfile: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('firebase/auth', () => ({
    EmailAuthProvider: {
        credential: vi.fn(() => ({ type: 'credential' })),
    },
    reauthenticateWithCredential: vi.fn(() => Promise.resolve()),
    updatePassword: vi.fn(() => Promise.resolve()),
}));

describe('PerfilPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUser = createMockUser();
        mockProfile = createMockProfile();
    });

    it('renderiza informacoes de identidade', () => {
        render(<PerfilPage />);
        expect(screen.getByText('Joao Silva')).toBeInTheDocument();
        expect(screen.getByText('usuario@exemplo.com')).toBeInTheDocument();
        expect(screen.getAllByText('Gestor').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Franquia Alpha').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Portal do cliente')).toBeInTheDocument();
    });

    it('renderiza iniciais do nome no avatar', () => {
        render(<PerfilPage />);
        expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('exibe informacoes da conta corretamente', () => {
        render(<PerfilPage />);
        expect(screen.getByText('Perfil de acesso')).toBeInTheDocument();
        expect(screen.getByText('Franquia')).toBeInTheDocument();
        expect(screen.getByText('Conta criada em')).toBeInTheDocument();
        expect(screen.getByText('Ultimo login')).toBeInTheDocument();
        expect(screen.getByText('Método de login')).toBeInTheDocument();
    });

    it('permite editar nome com formulario semantico', async () => {
        render(<PerfilPage />);
        fireEvent.click(screen.getByRole('button', { name: /Editar nome/i }));

        const nameInput = screen.getByLabelText(/Nome completo/i);
        expect(nameInput).toBeInTheDocument();
        expect(nameInput).not.toHaveAttribute('readOnly');

        fireEvent.change(nameInput, { target: { value: 'Maria Souza' } });
        expect(screen.getByText('11/80 caracteres')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));

        await waitFor(() => {
            expect(screen.getByText('Nome atualizado com sucesso.')).toBeInTheDocument();
        });
    });

    it('rejeita nome com menos de 2 caracteres', async () => {
        const { callUpdateOwnProfile } = await import('../core/firebase/firestoreService');
        render(<PerfilPage />);
        fireEvent.click(screen.getByRole('button', { name: /Editar nome/i }));

        const nameInput = screen.getByLabelText(/Nome completo/i);
        fireEvent.change(nameInput, { target: { value: 'A' } });
        fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));

        await waitFor(() => {
            expect(screen.getByText(/ao menos 2 caracteres/i)).toBeInTheDocument();
        });
        expect(callUpdateOwnProfile).not.toHaveBeenCalled();
    });

    it('rejeita nome com mais de 80 caracteres no frontend', async () => {
        const { callUpdateOwnProfile } = await import('../core/firebase/firestoreService');
        render(<PerfilPage />);
        fireEvent.click(screen.getByRole('button', { name: /Editar nome/i }));

        const nameInput = screen.getByLabelText(/Nome completo/i);
        const longName = 'A'.repeat(81);
        fireEvent.change(nameInput, { target: { value: longName } });
        fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));

        await waitFor(() => {
            expect(screen.getByText(/no máximo 80 caracteres/i)).toBeInTheDocument();
        });
        expect(callUpdateOwnProfile).not.toHaveBeenCalled();
    });

    it('input de nome respeita maxLength de 80', () => {
        render(<PerfilPage />);
        fireEvent.click(screen.getByRole('button', { name: /Editar nome/i }));
        const nameInput = screen.getByLabelText(/Nome completo/i);
        expect(nameInput).toHaveAttribute('maxLength', '80');
    });

    it('formulario de senha possui autoComplete correto', () => {
        render(<PerfilPage />);
        expect(screen.getByLabelText(/^Senha atual$/i)).toHaveAttribute('autoComplete', 'current-password');
        expect(screen.getByLabelText(/^Nova senha$/i)).toHaveAttribute('autoComplete', 'new-password');
        expect(screen.getByLabelText(/^Confirmar nova senha$/i)).toHaveAttribute('autoComplete', 'new-password');
    });

    it('formulario de senha eh submetido via onSubmit', async () => {
        const { reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
        render(<PerfilPage />);

        fireEvent.change(screen.getByLabelText(/^Senha atual$/i), { target: { value: 'senhaAtual123' } });
        fireEvent.change(screen.getByLabelText(/^Nova senha$/i), { target: { value: 'novaSenha456' } });
        fireEvent.change(screen.getByLabelText(/^Confirmar nova senha$/i), { target: { value: 'novaSenha456' } });

        const form = screen.getByLabelText(/^Senha atual$/i).closest('form');
        fireEvent.submit(form);

        await waitFor(() => {
            expect(reauthenticateWithCredential).toHaveBeenCalled();
            expect(updatePassword).toHaveBeenCalled();
        });
    });

    it('valida senha minima de 8 caracteres', async () => {
        render(<PerfilPage />);

        fireEvent.change(screen.getByLabelText(/^Senha atual$/i), { target: { value: 'senhaAtual123' } });
        fireEvent.change(screen.getByLabelText(/^Nova senha$/i), { target: { value: '123' } });
        fireEvent.change(screen.getByLabelText(/^Confirmar nova senha$/i), { target: { value: '123' } });

        const form = screen.getByLabelText(/^Senha atual$/i).closest('form');
        fireEvent.submit(form);

        await waitFor(() => {
            expect(screen.getByText(/ao menos 8 caracteres/i)).toBeInTheDocument();
        });
    });

    it('valida coincidencia de senhas', async () => {
        render(<PerfilPage />);

        fireEvent.change(screen.getByLabelText(/^Senha atual$/i), { target: { value: 'senhaAtual123' } });
        fireEvent.change(screen.getByLabelText(/^Nova senha$/i), { target: { value: 'novaSenha456' } });
        fireEvent.change(screen.getByLabelText(/^Confirmar nova senha$/i), { target: { value: 'outraSenha789' } });

        const form = screen.getByLabelText(/^Senha atual$/i).closest('form');
        fireEvent.submit(form);

        await waitFor(() => {
            expect(screen.getByText(/não coincidem/i)).toBeInTheDocument();
        });
    });

    it('nao exibe formulario de senha para usuario Google/SSO', () => {
        mockUser = createMockUser({ providerData: [{ providerId: 'google.com' }] });
        render(<PerfilPage />);
        expect(screen.queryByLabelText(/^Senha atual$/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^Nova senha$/i)).not.toBeInTheDocument();
        expect(screen.getAllByText('Google').length).toBeGreaterThanOrEqual(1);
    });

    it('exibe metodo de login combinado quando ha password + google', () => {
        mockUser = createMockUser({ providerData: [{ providerId: 'password' }, { providerId: 'google.com' }] });
        render(<PerfilPage />);
        expect(screen.getByText('Senha + Google')).toBeInTheDocument();
    });

    it('exibe badge de portal operacional para role analyst', () => {
        mockProfile = createMockProfile({ role: 'analyst' });
        render(<PerfilPage />);
        expect(screen.getByText('Painel operacional')).toBeInTheDocument();
        expect(screen.getAllByText('Analista').length).toBeGreaterThanOrEqual(1);
    });
});
