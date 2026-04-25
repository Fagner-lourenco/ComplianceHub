import { useEffect, useState, useCallback, useRef } from 'react';
import { getDossier } from '../api/dossierApi';

const POLL_INTERVAL_MS = 10000;
const TERMINAL_STATUSES = new Set(['READY', 'PUBLISHED', 'ERROR', 'FAILED']);

export function useDossier(caseId, { poll = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isInitialLoadRef = useRef(true);

  const fetchDossier = useCallback(async ({ silent = false } = {}) => {
    if (!caseId) {
      setData(null);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await getDossier(caseId);
      setData(result?.data || result);
    } catch (err) {
      setError(err);
    } finally {
      if (!silent) setLoading(false);
      isInitialLoadRef.current = false;
    }
  }, [caseId]);

  useEffect(() => {
    isInitialLoadRef.current = true;
    fetchDossier();
  }, [fetchDossier]);

  useEffect(() => {
    if (!poll || !caseId) return undefined;
    if (data?.status && TERMINAL_STATUSES.has(data.status)) return undefined;
    const interval = setInterval(() => fetchDossier({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll, caseId, fetchDossier, data?.status]);

  return { data, loading, error, refetch: fetchDossier };
}
