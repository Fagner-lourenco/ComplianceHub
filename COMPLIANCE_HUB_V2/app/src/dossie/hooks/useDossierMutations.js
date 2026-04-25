import { useState, useCallback } from 'react';
import {
  patchDossier,
  processDossier,
  retrySource,
  approveDossier,
  rejectDossier,
} from '../api/dossierApi';

export function useDossierMutations(caseId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wrap = useCallback(
    async (fn) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn();
        return result;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const patch = useCallback(
    (payload) => wrap(() => patchDossier(caseId, payload)),
    [caseId, wrap]
  );

  const process = useCallback(() => wrap(() => processDossier(caseId)), [caseId, wrap]);

  const retry = useCallback(
    (sourceKey) => wrap(() => retrySource(caseId, sourceKey)),
    [caseId, wrap]
  );

  const approve = useCallback(() => wrap(() => approveDossier(caseId)), [caseId, wrap]);

  const reject = useCallback(
    (reason) => wrap(() => rejectDossier(caseId, reason)),
    [caseId, wrap]
  );

  return { patch, process, retry, approve, reject, loading, error };
}
