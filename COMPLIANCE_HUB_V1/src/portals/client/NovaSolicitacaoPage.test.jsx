import { render, screen } from '@testing-library/react';
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

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => solicitationMocks.authState,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    callCreateClientSolicitation: vi.fn(),
}));

describe('NovaSolicitacaoPage', () => {
    it('bloqueia o envio quando a franquia ainda nao foi confirmada', () => {
        render(
            <MemoryRouter>
                <NovaSolicitacaoPage />
            </MemoryRouter>,
        );

        expect(screen.getByText(/franquia do seu perfil ainda nao foi confirmada/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enviar Solicitacao' })).toBeDisabled();
    });
});
