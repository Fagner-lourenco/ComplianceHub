import { useEffect, useState, useCallback } from 'react';
import { listDossiers } from '../api/dossierApi';

const POLL_INTERVAL_MS = 8000;

export function useDossierList({ filters = {}, poll = true } = {}) {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filterKey = JSON.stringify(filters);

  const fetchList = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await listDossiers({
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      });
      setRows(result.data?.dossiers || []);
      setPagination((prev) => ({
        ...prev,
        total: result.meta?.total || 0,
      }));
    } catch (err) {
      setError(err);
    } finally {
      if (!silent) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, filterKey]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!poll) return undefined;
    const interval = setInterval(() => fetchList({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll, fetchList]);

  const setPage = useCallback((page) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  return {
    rows,
    loading,
    error,
    pagination,
    setPage,
    setLimit,
    refetch: fetchList,
  };
}
