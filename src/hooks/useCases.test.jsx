import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
    subscribeToCases: vi.fn(() => () => {}),
    subscribeToClientCases: vi.fn(() => () => {}),
}));

const authMocks = vi.hoisted(() => ({
    user: null,
    userProfile: null,
}));

vi.mock('../core/firebase/firestoreService', () => ({
    subscribeToCases: firestoreMocks.subscribeToCases,
    subscribeToClientCases: firestoreMocks.subscribeToClientCases,
}));

vi.mock('../core/auth/useAuth', () => ({
    useAuth: () => ({ user: authMocks.user, userProfile: authMocks.userProfile }),
}));

vi.mock('../data/mockData', () => ({
    MOCK_CASES: [
        { id: 'CASE-001', tenantId: 'TEN-001', candidateName: 'Alice' },
        { id: 'CASE-002', tenantId: 'TEN-002', candidateName: 'Bob' },
        { id: 'CASE-003', tenantId: 'TEN-001', candidateName: 'Charlie' },
    ],
}));

import { useCases } from './useCases';

function TestConsumer({ overrideTenantId }) {
    const { cases, loading, error } = useCases(overrideTenantId);
    return (
        <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="error">{error ? error.message || String(error) : 'null'}</span>
            <span data-testid="count">{cases.length}</span>
            <span data-testid="names">{cases.map((c) => c.candidateName).join(',')}</span>
        </div>
    );
}

describe('useCases', () => {
    beforeEach(() => {
        authMocks.user = null;
        authMocks.userProfile = null;
        firestoreMocks.subscribeToCases.mockClear();
        firestoreMocks.subscribeToClientCases.mockClear();
    });

    it('returns all MOCK_CASES in demo mode (no user)', () => {
        render(<TestConsumer />);
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        expect(screen.getByTestId('count')).toHaveTextContent('3');
        expect(screen.getByTestId('error')).toHaveTextContent('null');
    });

    it('filters MOCK_CASES by tenantId in demo mode', () => {
        authMocks.userProfile = { tenantId: 'TEN-001', source: 'demo' };
        render(<TestConsumer />);
        expect(screen.getByTestId('count')).toHaveTextContent('2');
        expect(screen.getByTestId('names')).toHaveTextContent('Alice,Charlie');
    });

    it('returns all tenants when overrideTenantId is null in demo mode', () => {
        render(<TestConsumer overrideTenantId={null} />);
        expect(screen.getByTestId('count')).toHaveTextContent('3');
    });

    it('subscribes to Firestore when user is logged in', () => {
        authMocks.user = { uid: 'u1' };
        authMocks.userProfile = { role: 'analyst', tenantId: null };
        firestoreMocks.subscribeToCases.mockImplementation((tenantId, callback) => {
            callback([{ id: 'live-1', candidateName: 'Live' }], null);
            return () => {};
        });

        render(<TestConsumer overrideTenantId={null} />);
        expect(firestoreMocks.subscribeToCases).toHaveBeenCalledWith(null, expect.any(Function));
        expect(screen.getByTestId('count')).toHaveTextContent('1');
        expect(screen.getByTestId('names')).toHaveTextContent('Live');
    });

    it('uses subscribeToClientCases for client roles', () => {
        authMocks.user = { uid: 'c1' };
        authMocks.userProfile = { role: 'client_manager', tenantId: 'TEN-001' };
        firestoreMocks.subscribeToClientCases.mockImplementation((tenantId, callback) => {
            callback([{ id: 'client-1', candidateName: 'ClientCase' }], null);
            return () => {};
        });

        render(<TestConsumer />);
        expect(firestoreMocks.subscribeToClientCases).toHaveBeenCalledWith('TEN-001', expect.any(Function));
        expect(screen.getByTestId('names')).toHaveTextContent('ClientCase');
    });

    it('returns loading=true while waiting for client tenant', () => {
        authMocks.user = { uid: 'c2' };
        authMocks.userProfile = { role: 'client_viewer', tenantId: null };

        render(<TestConsumer />);
        expect(screen.getByTestId('loading')).toHaveTextContent('true');
        expect(screen.getByTestId('count')).toHaveTextContent('0');
    });

    it('cleans up subscription on unmount', () => {
        const unsub = vi.fn();
        authMocks.user = { uid: 'u2' };
        authMocks.userProfile = { role: 'analyst', tenantId: null };
        firestoreMocks.subscribeToCases.mockReturnValue(unsub);

        const { unmount } = render(<TestConsumer overrideTenantId={null} />);
        unmount();
        expect(unsub).toHaveBeenCalled();
    });

    it('returns empty cases for __skip__ tenantId', () => {
        authMocks.user = { uid: 'u3' };
        authMocks.userProfile = { role: 'analyst' };

        render(<TestConsumer overrideTenantId="__skip__" />);
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        expect(screen.getByTestId('count')).toHaveTextContent('0');
    });
});
