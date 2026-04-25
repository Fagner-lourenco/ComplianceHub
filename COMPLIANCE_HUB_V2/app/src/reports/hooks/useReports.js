import { useEffect, useState, useCallback } from 'react';
import { fetchPublicReports, savePublicReport, revokePublicReport } from '../../core/firebase/firestoreService';
import { useTenant } from '../../core/contexts/useTenant';

export function useReports() {
  const { selectedTenantId } = useTenant();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReports = useCallback(async () => {
    if (!selectedTenantId) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPublicReports(selectedTenantId);
      setReports(data || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  async function createReport(html, meta) {
    await savePublicReport(html, { tenantId: selectedTenantId, ...meta });
    await fetchReports();
  }

  async function revoke(reportId) {
    await revokePublicReport(reportId, selectedTenantId);
    await fetchReports();
  }

  return { reports, loading, error, refetch: fetchReports, createReport, revoke };
}
