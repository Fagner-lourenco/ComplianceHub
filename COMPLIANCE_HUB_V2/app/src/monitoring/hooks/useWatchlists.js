import { useEffect, useState } from 'react';
import { callCreateWatchlist, callPauseWatchlist, callResumeWatchlist, callDeleteWatchlist } from '../../core/firebase/firestoreService';
import { subscribeToWatchlistsByTenant } from '../../core/firebase/firestoreService';
import { useTenant } from '../../core/contexts/useTenant';

export function useWatchlists() {
  const { selectedTenantId } = useTenant();
  const [watchlists, setWatchlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState(null);

  useEffect(() => {
    if (!selectedTenantId) {
      setWatchlists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeToWatchlistsByTenant(selectedTenantId, (data) => {
      setWatchlists(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedTenantId]);

  async function createWatchlistItem(payload) {
    await callCreateWatchlist({ tenantId: selectedTenantId, ...payload });
  }

  async function pause(id) {
    await callPauseWatchlist({ tenantId: selectedTenantId, watchlistId: id });
  }

  async function resume(id) {
    await callResumeWatchlist({ tenantId: selectedTenantId, watchlistId: id });
  }

  async function remove(id) {
    await callDeleteWatchlist({ tenantId: selectedTenantId, watchlistId: id });
  }

  return { watchlists, loading, error, createWatchlistItem, pause, resume, remove };
}
