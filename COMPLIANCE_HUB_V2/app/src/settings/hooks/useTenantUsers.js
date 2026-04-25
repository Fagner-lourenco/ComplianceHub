import { useEffect, useState, useCallback } from 'react';
import { callListTenantUsers, callCreateTenantUser, callUpdateTenantUser } from '../../core/firebase/firestoreService';

export function useTenantUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callListTenantUsers();
      setUsers(result.users || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function createUser(payload) {
    await callCreateTenantUser(payload);
    await fetchUsers();
  }

  async function updateUser(payload) {
    await callUpdateTenantUser(payload);
    await fetchUsers();
  }

  return { users, loading, error, refetch: fetchUsers, createUser, updateUser };
}
