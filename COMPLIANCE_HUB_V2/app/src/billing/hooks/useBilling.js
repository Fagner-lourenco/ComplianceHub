import { useEffect, useState, useCallback } from 'react';
import { callGetTenantBillingOverview } from '../../core/firebase/firestoreService';
import { useTenant } from '../../core/contexts/useTenant';

export function useBilling() {
  const { selectedTenantId } = useTenant();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = useCallback(async () => {
    if (!selectedTenantId) {
      setOverview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await callGetTenantBillingOverview({ tenantId: selectedTenantId });
      setOverview(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return { overview, loading, error, refetch: fetchOverview };
}
