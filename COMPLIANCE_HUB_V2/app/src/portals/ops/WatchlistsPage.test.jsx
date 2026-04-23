import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    subscribeToWatchlistsByTenant: vi.fn(),
    callPauseWatchlist: vi.fn(),
    callResumeWatchlist: vi.fn(),
    callDeleteWatchlist: vi.fn(),
    callRunWatchlistNow: vi.fn(),
    tenantValue: { selectedTenantId: 'tenant-1', selectedTenantLabel: 'Tenant 1' },
}));

vi.mock('../../core/firebase/firestoreService', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        subscribeToWatchlistsByTenant: (...args) => mocks.subscribeToWatchlistsByTenant(...args),
        callPauseWatchlist: (...args) => mocks.callPauseWatchlist(...args),
        callResumeWatchlist: (...args) => mocks.callResumeWatchlist(...args),
        callDeleteWatchlist: (...args) => mocks.callDeleteWatchlist(...args),
        callRunWatchlistNow: (...args) => mocks.callRunWatchlistNow(...args),
    };
});

vi.mock('../../core/contexts/useTenant', () => ({
    useTenant: () => mocks.tenantValue,
}));

vi.mock('../../core/contexts/tenantUtils', () => ({
    ALL_TENANTS_ID: '__ALL__',
}));

import WatchlistsPage from './WatchlistsPage';

function primeSubscription(watchlists) {
    mocks.subscribeToWatchlistsByTenant.mockImplementation((_tenantId, cb) => {
        cb(watchlists, null);
        return () => {};
    });
}

describe('WatchlistsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.tenantValue = { selectedTenantId: 'tenant-1', selectedTenantLabel: 'Tenant 1' };
    });

    it('shows message when no tenant is selected', () => {
        mocks.tenantValue = { selectedTenantId: '__ALL__', selectedTenantLabel: 'Todos' };
        render(<WatchlistsPage />);
        expect(screen.getByRole('heading', { name: /Selecione um tenant/i })).toBeTruthy();
        expect(mocks.subscribeToWatchlistsByTenant).not.toHaveBeenCalled();
    });

    it('renders active watchlists by default', () => {
        primeSubscription([
            { id: 'wl-1', subjectId: 'subj-1', modules: ['criminal'], intervalDays: 30, active: true, runCount: 2 },
            { id: 'wl-2', subjectId: 'subj-2', modules: ['labor'], intervalDays: 15, active: false },
        ]);
        render(<WatchlistsPage />);
        expect(screen.getByTestId('watchlist-wl-1')).toBeTruthy();
        expect(screen.queryByTestId('watchlist-wl-2')).toBeNull();
        expect(screen.getByTestId('watchlists-active-count').textContent).toBe('1');
    });

    it('switches filter to paused and shows inactive watchlists', () => {
        primeSubscription([
            { id: 'wl-1', subjectId: 'subj-1', active: true },
            { id: 'wl-2', subjectId: 'subj-2', active: false },
        ]);
        render(<WatchlistsPage />);
        fireEvent.click(screen.getByTestId('watchlists-filter-paused'));
        expect(screen.queryByTestId('watchlist-wl-1')).toBeNull();
        expect(screen.getByTestId('watchlist-wl-2')).toBeTruthy();
    });

    it('calls pause callable when clicking pause', async () => {
        primeSubscription([{ id: 'wl-1', subjectId: 'subj-1', active: true }]);
        mocks.callPauseWatchlist.mockResolvedValue({ success: true });
        render(<WatchlistsPage />);
        await act(async () => {
            fireEvent.click(screen.getByTestId('watchlist-pause-wl-1'));
        });
        expect(mocks.callPauseWatchlist).toHaveBeenCalledWith({ watchlistId: 'wl-1' });
    });

    it('calls resume callable when clicking reactivate', async () => {
        primeSubscription([{ id: 'wl-2', subjectId: 'subj-2', active: false }]);
        mocks.callResumeWatchlist.mockResolvedValue({ success: true });
        render(<WatchlistsPage />);
        fireEvent.click(screen.getByTestId('watchlists-filter-paused'));
        await act(async () => {
            fireEvent.click(screen.getByTestId('watchlist-resume-wl-2'));
        });
        expect(mocks.callResumeWatchlist).toHaveBeenCalledWith({ watchlistId: 'wl-2' });
    });

    it('calls manual run callable when clicking executar agora', async () => {
        primeSubscription([{ id: 'wl-run', subjectId: 'subj-run', active: true }]);
        mocks.callRunWatchlistNow.mockResolvedValue({ success: true, status: 'ok' });
        render(<WatchlistsPage />);
        await act(async () => {
            fireEvent.click(screen.getByTestId('watchlist-run-wl-run'));
        });
        expect(mocks.callRunWatchlistNow).toHaveBeenCalledWith({ watchlistId: 'wl-run' });
    });

    it('calls delete callable after confirm', async () => {
        primeSubscription([{ id: 'wl-3', subjectId: 'subj-3', active: true }]);
        mocks.callDeleteWatchlist.mockResolvedValue({ success: true });
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        render(<WatchlistsPage />);
        await act(async () => {
            fireEvent.click(screen.getByTestId('watchlist-delete-wl-3'));
        });
        expect(mocks.callDeleteWatchlist).toHaveBeenCalledWith({ watchlistId: 'wl-3' });
    });

    it('does not call delete callable when user cancels confirm', async () => {
        primeSubscription([{ id: 'wl-4', subjectId: 'subj-4', active: true }]);
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        render(<WatchlistsPage />);
        await act(async () => {
            fireEvent.click(screen.getByTestId('watchlist-delete-wl-4'));
        });
        expect(mocks.callDeleteWatchlist).not.toHaveBeenCalled();
    });

    it('renders empty state when tenant has no watchlists', () => {
        primeSubscription([]);
        render(<WatchlistsPage />);
        expect(screen.getByTestId('watchlists-empty')).toBeTruthy();
    });
});
