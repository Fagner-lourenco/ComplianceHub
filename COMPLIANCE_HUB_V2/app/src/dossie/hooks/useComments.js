import { useEffect, useState, useCallback } from 'react';
import { createComment, getDossier } from '../api/dossierApi';

export function useComments({ caseId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchComments = useCallback(async () => {
    if (!caseId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Comments are returned as part of the dossier detail
      // If a dedicated endpoint exists, switch to it
      const result = await getDossier(caseId);
      const dossierComments = result?.data?.comments || result?.comments || [];
      setComments(dossierComments);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function addComment(text, { highlighted = false } = {}) {
    if (!caseId || !text?.trim()) return;
    await createComment(caseId, text.trim(), highlighted);
    await fetchComments();
  }

  return { comments, loading, error, addComment, refetch: fetchComments };
}
