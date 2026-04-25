import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useTenantUsers } from './useTenantUsers';

vi.mock('../../core/firebase/firestoreService', () => ({
  callListTenantUsers: vi.fn(),
  callCreateTenantUser: vi.fn(),
  callUpdateTenantUser: vi.fn(),
}));

import { callListTenantUsers, callCreateTenantUser } from '../../core/firebase/firestoreService';

describe('useTenantUsers', () => {
  it('fetches users on mount', async () => {
    callListTenantUsers.mockResolvedValue({ users: [{ uid: '1', name: 'Ana', email: 'ana@test.com', role: 'analyst', status: 'active' }] });
    const { result } = renderHook(() => useTenantUsers());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].name).toBe('Ana');
  });

  it('handles fetch error', async () => {
    callListTenantUsers.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useTenantUsers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeDefined();
  });

  it('creates user and refreshes list', async () => {
    callListTenantUsers.mockResolvedValue({ users: [] });
    const { result } = renderHook(() => useTenantUsers());
    await waitFor(() => expect(result.current.loading).toBe(false));

    callListTenantUsers.mockResolvedValue({ users: [{ uid: '2', name: 'Bruno' }] });
    await result.current.createUser({ email: 'bruno@test.com', name: 'Bruno', role: 'analyst' });
    expect(callCreateTenantUser).toHaveBeenCalledWith({ email: 'bruno@test.com', name: 'Bruno', role: 'analyst' });
    await waitFor(() => expect(result.current.users).toHaveLength(1));
  });
});
