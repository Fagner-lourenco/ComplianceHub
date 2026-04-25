import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useWatchlists } from './useWatchlists';

const mockTenant = { selectedTenantId: 'tenant-123' };

vi.mock('../../core/contexts/useTenant', () => ({
  useTenant: () => mockTenant,
}));

const mockUnsubscribe = vi.fn();

vi.mock('../../core/firebase/firestoreService', () => ({
  subscribeToWatchlistsByTenant: vi.fn((_, cb) => {
    cb([
      { id: 'wl1', name: 'VIP', subjectId: '123', status: 'active' },
    ]);
    return mockUnsubscribe;
  }),
  callCreateWatchlist: vi.fn(),
  callPauseWatchlist: vi.fn(),
  callResumeWatchlist: vi.fn(),
  callDeleteWatchlist: vi.fn(),
}));

import { callPauseWatchlist } from '../../core/firebase/firestoreService';

describe('useWatchlists', () => {
  it('subscribes to watchlists', async () => {
    const { result } = renderHook(() => useWatchlists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.watchlists).toHaveLength(1);
    expect(result.current.watchlists[0].name).toBe('VIP');
  });

  it('pauses a watchlist', async () => {
    const { result } = renderHook(() => useWatchlists());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.pause('wl1');
    expect(callPauseWatchlist).toHaveBeenCalledWith({ tenantId: 'tenant-123', watchlistId: 'wl1' });
  });
});
