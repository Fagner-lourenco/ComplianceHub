import { useEffect, useState, useCallback } from 'react';
import { getTenantSettings, callUpdateTenantSettingsByAnalyst } from '../../core/firebase/firestoreService';
import { useTenant } from '../../core/contexts/useTenant';

export function useTenantSettings() {
  const { selectedTenantId } = useTenant();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!selectedTenantId) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getTenantSettings(selectedTenantId);
      setSettings(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function saveSettings(payload) {
    setSaving(true);
    try {
      await callUpdateTenantSettingsByAnalyst({ tenantId: selectedTenantId, ...payload });
      await fetchSettings();
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return { settings, loading, error, saving, refetch: fetchSettings, saveSettings };
}
