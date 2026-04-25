import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useTenantSettings } from './useTenantSettings';

const mockTenant = { selectedTenantId: 'tenant-123' };

vi.mock('../../core/contexts/useTenant', () => ({
  useTenant: () => mockTenant,
}));

vi.mock('../../core/firebase/firestoreService', () => ({
  getTenantSettings: vi.fn(),
  callUpdateTenantSettingsByAnalyst: vi.fn(),
}));

import { getTenantSettings, callUpdateTenantSettingsByAnalyst } from '../../core/firebase/firestoreService';

describe('useTenantSettings', () => {
  it('fetches settings on mount', async () => {
    getTenantSettings.mockResolvedValue({ tenantName: 'Test Tenant', dailyLimit: 100 });
    const { result } = renderHook(() => useTenantSettings());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.tenantName).toBe('Test Tenant');
  });

  it('saves settings and refreshes', async () => {
    getTenantSettings.mockResolvedValue({ tenantName: 'Old' });
    const { result } = renderHook(() => useTenantSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    getTenantSettings.mockResolvedValue({ tenantName: 'New' });
    await result.current.saveSettings({ tenantName: 'New' });
    expect(callUpdateTenantSettingsByAnalyst).toHaveBeenCalledWith({ tenantId: 'tenant-123', tenantName: 'New' });
    await waitFor(() => expect(result.current.settings.tenantName).toBe('New'));
  });
});
