import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const alertasMocks = vi.hoisted(() => ({
    subscribeToAlertsByTenant: vi.fn(),
    callMarkAlertAs: vi.fn(),
    userProfile: { tenantId: 'tenant-alpha', role: 'client_operator' },
}));

vi.mock('../../core/firebase/firestoreService', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        subscribeToAlertsByTenant: (...args) => alertasMocks.subscribeToAlertsByTenant(...args),
        callMarkAlertAs: (...args) => alertasMocks.callMarkAlertAs(...args),
    };
});

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => ({ userProfile: alertasMocks.userProfile }),
}));

const { default: AlertasClientePage } = await import('./AlertasClientePage');

function sampleAlerts() {
    return [
        {
            id: 'alert-1', tenantId: 'tenant-alpha', kind: 'watchlist_finding', severity: 'high',
            state: 'unread', message: 'Novo processo judicial detectado.', createdAt: '2026-04-22T10:00:00Z',
            caseId: 'case-001', subjectId: 'subj-1',
        },
        {
            id: 'alert-2', tenantId: 'tenant-alpha', kind: 'watchlist_finding', severity: 'medium',
            state: 'read', message: 'Mudanca em dados cadastrais.', createdAt: '2026-04-21T12:00:00Z',
            caseId: null, subjectId: 'subj-2',
        },
        {
            id: 'alert-3', tenantId: 'tenant-alpha', kind: 'monitoring_error', severity: 'info',
            state: 'actioned', message: 'Watchlist pausada.', createdAt: '2026-04-20T08:00:00Z',
            caseId: null, subjectId: null,
        },
    ];
}

describe('AlertasClientePage', () => {
    beforeEach(() => {
        alertasMocks.subscribeToAlertsByTenant.mockReset();
        alertasMocks.callMarkAlertAs.mockReset();
    });

    it('renderiza lista de alertas com contagem correta', async () => {
        alertasMocks.subscribeToAlertsByTenant.mockImplementation((tenantId, cb) => {
            cb(sampleAlerts(), null);
            return () => {};
        });

        render(<AlertasClientePage />);

        await waitFor(() => {
            expect(screen.getByTestId('alertas-unread-count')).toHaveTextContent('1');
        });
        expect(screen.getByTestId('alerta-alert-1')).toBeInTheDocument();
        expect(screen.getByTestId('alerta-alert-2')).toBeInTheDocument();
        expect(screen.getByTestId('alerta-alert-3')).toBeInTheDocument();
    });

    it('filtra por estado unread', async () => {
        alertasMocks.subscribeToAlertsByTenant.mockImplementation((tenantId, cb) => {
            cb(sampleAlerts(), null);
            return () => {};
        });

        render(<AlertasClientePage />);

        await waitFor(() => {
            expect(screen.getByTestId('alerta-alert-1')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('alertas-filter-unread'));

        expect(screen.getByTestId('alerta-alert-1')).toBeInTheDocument();
        expect(screen.queryByTestId('alerta-alert-2')).not.toBeInTheDocument();
        expect(screen.queryByTestId('alerta-alert-3')).not.toBeInTheDocument();
    });

    it('marca alerta como lido chamando callable com state correto', async () => {
        alertasMocks.subscribeToAlertsByTenant.mockImplementation((tenantId, cb) => {
            cb(sampleAlerts(), null);
            return () => {};
        });
        alertasMocks.callMarkAlertAs.mockResolvedValue({ success: true });

        render(<AlertasClientePage />);

        await waitFor(() => {
            expect(screen.getByTestId('alerta-mark-read-alert-1')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('alerta-mark-read-alert-1'));

        await waitFor(() => {
            expect(alertasMocks.callMarkAlertAs).toHaveBeenCalledWith({
                alertId: 'alert-1',
                state: 'read',
            });
        });
    });

    it('exibe empty state quando nao ha alertas', async () => {
        alertasMocks.subscribeToAlertsByTenant.mockImplementation((tenantId, cb) => {
            cb([], null);
            return () => {};
        });

        render(<AlertasClientePage />);

        await waitFor(() => {
            expect(screen.getByTestId('alertas-empty')).toBeInTheDocument();
        });
    });

    it('exibe erro quando subscription falha', async () => {
        alertasMocks.subscribeToAlertsByTenant.mockImplementation((tenantId, cb) => {
            cb([], new Error('permission_denied'));
            return () => {};
        });

        render(<AlertasClientePage />);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });
});
