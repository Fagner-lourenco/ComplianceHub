import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useReports } from './useReports';

const mockTenant = { selectedTenantId: 'tenant-123' };

vi.mock('../../core/contexts/useTenant', () => ({
  useTenant: () => mockTenant,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
  fetchPublicReports: vi.fn(),
  savePublicReport: vi.fn(),
  revokePublicReport: vi.fn(),
}));

import { fetchPublicReports, revokePublicReport } from '../../core/firebase/firestoreService';

describe('useReports', () => {
  it('fetches reports', async () => {
    fetchPublicReports.mockResolvedValue([{ id: 'rep1', title: 'Relatório 1', status: 'published' }]);
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reports).toHaveLength(1);
  });

  it('revokes a report', async () => {
    fetchPublicReports.mockResolvedValue([{ id: 'rep1', title: 'Relatório 1' }]);
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchPublicReports.mockResolvedValue([]);
    await result.current.revoke('rep1');
    expect(revokePublicReport).toHaveBeenCalledWith('rep1', 'tenant-123');
    await waitFor(() => expect(result.current.reports).toHaveLength(0));
  });
});
