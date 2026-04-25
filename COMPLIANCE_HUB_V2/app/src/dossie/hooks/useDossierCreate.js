import { useState } from 'react';
import { createDossier } from '../api/dossierApi';

export function useDossierCreate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function create(payload) {
    setLoading(true);
    setError(null);
    try {
      const result = await createDossier(payload);
      setLoading(false);
      return result.data || result;
    } catch (err) {
      setError(err);
      setLoading(false);
      throw err;
    }
  }

  return { create, loading, error };
}
