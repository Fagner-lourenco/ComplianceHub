import { render, screen } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import { vi } from 'vitest';

const appTestMocks = vi.hoisted(() => ({
    authState: {
        loading: false,
        user: null,
        userProfile: null,
        profileStatus: 'idle',
        logout: vi.fn(),
    },
}));

vi.mock('./core/auth/AuthContext', () => ({
    AuthProvider: ({ children }) => children,
}));

vi.mock('./core/contexts/TenantContext', () => ({
    TenantProvider: ({ children }) => children,
}));

vi.mock('./core/auth/useAuth', () => ({
    useAuth: () => appTestMocks.authState,
}));

vi.mock('./demo/DemoProviders', () => ({
    DemoProviders: ({ children }) => children,
}));

vi.mock('./ui/layouts/AppLayout', () => ({
    default: ({ title }) => (
        <div>
            <div data-testid="layout-title">{title}</div>
            <Outlet />
        </div>
    ),
}));

vi.mock('./pages/LoginPage', () => ({
    default: () => <div>LOGIN_PAGE</div>,
}));

vi.mock('./portals/ops/FilaPage', () => ({
    default: () => <div>OPS_FILA</div>,
}));

vi.mock('./portals/ops/CasosPage', () => ({
    default: () => <div>OPS_CASOS</div>,
}));

vi.mock('./portals/ops/CasoPage', () => ({
    default: () => <div>OPS_CASO</div>,
}));

vi.mock('./portals/ops/AuditoriaPage', () => ({
    default: () => <div>OPS_AUDITORIA</div>,
}));

vi.mock('./portals/ops/ClientesPage', () => ({
    default: () => <div>OPS_CLIENTES</div>,
}));

vi.mock('./portals/client/SolicitacoesPage', () => ({
    default: () => <div>CLIENT_SOLICITACOES</div>,
}));

vi.mock('./portals/client/NovaSolicitacaoPage', () => ({
    default: () => <div>CLIENT_NOVA</div>,
}));

vi.mock('./portals/client/CandidatosPage', () => ({
    default: () => <div>CLIENT_CANDIDATOS</div>,
}));

vi.mock('./portals/client/ExportacoesPage', () => ({
    default: () => <div>CLIENT_EXPORTACOES</div>,
}));

const { default: App } = await import('./App');

describe('App routing guards', () => {
    beforeEach(() => {
        appTestMocks.authState = {
            loading: false,
            user: null,
            userProfile: null,
            profileStatus: 'idle',
            logout: vi.fn(),
        };
    });

    it('redireciona rota protegida para o login quando nao ha sessao', async () => {
        window.history.replaceState({}, '', '/ops/casos');

        render(<App />);

        expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument();
    });

    it('redireciona acesso cruzado de admin para o portal operacional', async () => {
        appTestMocks.authState = {
            loading: false,
            user: { uid: 'ops-1' },
            userProfile: {
                uid: 'ops-1',
                role: 'admin',
                displayName: 'Fagner Lourenco',
                email: 'fagner.alexandro.lourenco@gmail.com',
            },
            profileStatus: 'ready',
            logout: vi.fn(),
        };
        window.history.replaceState({}, '', '/client/solicitacoes');

        render(<App />);

        expect(await screen.findByText('OPS_FILA')).toBeInTheDocument();
        expect(screen.getByTestId('layout-title')).toHaveTextContent('Portal Operacional');
    });

    it('mantem o estado seguro quando o perfil ainda nao foi confirmado', async () => {
        appTestMocks.authState = {
            loading: false,
            user: { uid: 'user-1', email: 'analista.rh@madero.com.br' },
            userProfile: {
                uid: 'user-1',
                displayName: 'analista.rh',
                email: 'analista.rh@madero.com.br',
                role: null,
            },
            profileStatus: 'delayed',
            logout: vi.fn(),
        };
        window.history.replaceState({}, '', '/');

        render(<App />);

        expect(await screen.findByText('Confirmando permissoes e contexto')).toBeInTheDocument();
        expect(screen.getByText('Identidade confirmada no Firebase Auth')).toBeInTheDocument();
    });
});
