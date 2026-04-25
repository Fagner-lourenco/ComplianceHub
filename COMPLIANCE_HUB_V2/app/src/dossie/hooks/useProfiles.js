import { useEffect, useState, useCallback } from 'react';
import { listProfiles, createProfile, deleteProfile } from '../api/profileApi';

export function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listProfiles();
      const presets = result.data?.presets || [];
      const custom = result.data?.custom || [];
      setProfiles([...presets, ...custom]);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const create = useCallback(
    async (payload) => {
      const result = await createProfile(payload);
      await fetchProfiles();
      return result;
    },
    [fetchProfiles]
  );

  const remove = useCallback(
    async (id) => {
      await deleteProfile(id);
      await fetchProfiles();
    },
    [fetchProfiles]
  );

  return { profiles, loading, error, create, remove, refetch: fetchProfiles };
}
