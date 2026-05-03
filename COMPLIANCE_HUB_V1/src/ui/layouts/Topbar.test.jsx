import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Topbar from './Topbar';

const topbarMocks = vi.hoisted(() => ({
    authState: {
        profileStatus: 'ready',
        userProfile: {
            displayName: 'Maria Silva',
            email: 'maria@empresa.com',
            role: 'admin',
        },
    },
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => topbarMocks.authState,
}));

describe('Topbar', () => {
    it('mostra badge do portal operacional e controles de acao', () => {
        render(
            <MemoryRouter initialEntries={['/ops/fila']}>
                <Topbar onMenuClick={() => {}} />
            </MemoryRouter>,
        );

        expect(screen.getByText('Painel operacional')).toBeInTheDocument();
        expect(screen.getByLabelText('Notificações')).toBeInTheDocument();
        expect(screen.getByLabelText('Alternar tema')).toBeInTheDocument();
    });

    it('mostra badge do portal do cliente em rota client', () => {
        render(
            <MemoryRouter initialEntries={['/client/solicitacoes']}>
                <Topbar onMenuClick={() => {}} />
            </MemoryRouter>,
        );

        expect(screen.getByText('Portal do cliente')).toBeInTheDocument();
    });
});
