import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import LoginPage from './LoginPage';

const loginPageMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    login: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    authState: {
        loading: false,
        user: null,
        login: (...args) => loginPageMocks.login(...args),
    },
}));

vi.mock('../core/auth/useAuth', () => ({
    useAuth: () => loginPageMocks.authState,
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => loginPageMocks.navigate,
    };
});

vi.mock('firebase/auth', () => ({
    sendPasswordResetEmail: (...args) => loginPageMocks.sendPasswordResetEmail(...args),
}));

vi.mock('../core/firebase/config', () => ({
    auth: { currentUser: null },
}));

describe('LoginPage', () => {
    beforeEach(() => {
        loginPageMocks.navigate.mockReset();
        loginPageMocks.login.mockReset();
        loginPageMocks.sendPasswordResetEmail.mockReset();
    });

    it('mantem apenas o login real e os atalhos explicitos de demo', async () => {
        loginPageMocks.login.mockResolvedValue({ user: { uid: 'user-1' } });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        expect(screen.queryByText('Criar conta')).not.toBeInTheDocument();
        expect(screen.queryByText(/Nao tem conta/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Demo cliente' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Demo operacional' })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'maria@empresa.com' } });
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo123' } });
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

        expect(loginPageMocks.login).toHaveBeenCalledWith('maria@empresa.com', 'segredo123');
    });

    it('exibe o erro de autenticacao quando o login falha', async () => {
        loginPageMocks.login.mockRejectedValue({ code: 'auth/invalid-credential' });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'analista.rh@madero.com.br' } });
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '@Madero2026' } });
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

        expect(await screen.findByText('Email ou senha invalidos.')).toBeInTheDocument();
    });

    it('alterna para o modo de recuperacao de senha e envia o email', async () => {
        loginPageMocks.sendPasswordResetEmail.mockResolvedValue(undefined);

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }));

        expect(screen.getByRole('button', { name: /Enviar link de recuperacao/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Voltar ao login' })).toBeInTheDocument();
        expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Email da conta'), { target: { value: 'analista.rh@madero.com.br' } });
        fireEvent.click(screen.getByRole('button', { name: /Enviar link de recuperacao/ }));

        expect(await screen.findByText(/Link de recuperacao enviado/)).toBeInTheDocument();
        expect(loginPageMocks.sendPasswordResetEmail).toHaveBeenCalledWith(
            { currentUser: null },
            'analista.rh@madero.com.br',
        );
    });

    it('volta ao modo de login ao clicar em Voltar ao login', () => {
        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }));
        expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Voltar ao login' }));
        expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    });
});
