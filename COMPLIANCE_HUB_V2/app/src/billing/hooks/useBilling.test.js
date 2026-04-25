import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useBilling } from './useBilling';

const mockTenant = { selectedTenantId: 'tenant-123' };

vi.mock('../../core/contexts/useTenant', () => ({
  useTenant: () => mockTenant,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
  callGetTenantBillingOverview: vi.fn(),
}));

import { callGetTenantBillingOverview } from '../../core/firebase/firestoreService';

describe('useBilling', () => {
  it('fetches billing overview', async () => {
    callGetTenantBillingOverview.mockResolvedValue({
      tenantName: 'Test',
      summary: { remainingCredits: 500, consumedCredits: 100 },
    });
    const { result } = renderHook(() => useBilling());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.overview.summary.remainingCredits).toBe(500);
  });

  it('handles error', async () => {
    callGetTenantBillingOverview.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useBilling());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeDefined();
  });
});
