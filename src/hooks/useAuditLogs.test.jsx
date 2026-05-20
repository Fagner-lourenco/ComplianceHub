import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
    subscribeToAuditLogs: vi.fn(() => () => {}),
}));

const authMocks = vi.hoisted(() => ({
    user: null,
    userProfile: null,
}));

vi.mock('../core/firebase/firestoreService', () => ({
    subscribeToAuditLogs: firestoreMocks.subscribeToAuditLogs,
}));

vi.mock('../core/auth/useAuth', () => ({
    useAuth: () => ({ user: authMocks.user, userProfile: authMocks.userProfile }),
}));

import { useAuditLogs } from './useAuditLogs';

function TestConsumer({ overrideTenantId }) {
    const { logs, loading, error } = useAuditLogs(overrideTenantId);
    return (
        <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="error">{error ? String(error) : 'null'}</span>
            <span data-testid="count">{logs.length}</span>
        </div>
    );
}

describe('useAuditLogs', () => {
    beforeEach(() => {
        authMocks.user = null;
        authMocks.userProfile = null;
        firestoreMocks.subscribeToAuditLogs.mockClear();
    });

    it('returns mock audit logs in demo mode (no user)', () => {
        render(<TestConsumer />);
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThan(0);
    });

    it('filters mock logs by tenantId in demo mode', () => {
        authMocks.userProfile = { tenantId: 'TEN-001', source: 'demo' };
        render(<TestConsumer />);
        const count = Number(screen.getByTestId('count').textContent);
        expect(count).toBeGreaterThan(0);
        // TEN-001 should have fewer logs than total
        expect(count).toBeLessThan(10);
    });

    it('subscribes to Firestore when user logged in', () => {
        authMocks.user = { uid: 'u1' };
        authMocks.userProfile = { role: 'analyst' };
        firestoreMocks.subscribeToAuditLogs.mockImplementation((tid, cb) => {
            cb([{ id: 'live-log' }], null);
            return () => {};
        });

        render(<TestConsumer overrideTenantId={null} />);
        expect(firestoreMocks.subscribeToAuditLogs).toHaveBeenCalled();
        expect(screen.getByTestId('count')).toHaveTextContent('1');
    });

    it('cleans up subscription on unmount', () => {
        const unsub = vi.fn();
        authMocks.user = { uid: 'u2' };
        authMocks.userProfile = { role: 'analyst' };
        firestoreMocks.subscribeToAuditLogs.mockReturnValue(unsub);

        const { unmount } = render(<TestConsumer overrideTenantId={null} />);
        unmount();
        expect(unsub).toHaveBeenCalled();
    });
});
