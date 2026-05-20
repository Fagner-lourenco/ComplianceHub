import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../core/auth/useAuth';
import { subscribeToCandidates } from '../core/firebase/firestoreService';
import { isClientRole } from '../core/rbac/permissions';

const LIVE_QUERY_TIMEOUT_MS = 10_000;
const EMPTY_CANDIDATES = [];

/**
 * Hook that provides real-time candidates from Firestore.
 * Falls back to empty array in demo mode (no mock candidates).
 *
 * @param {string|null|undefined} overrideTenantId - Force a specific tenantId.
 *   null = all tenants (ops portal). undefined = use userProfile.tenantId.
 * @returns {{ candidates: Array, loading: boolean, error: string|null }}
 */
export function useCandidates(overrideTenantId) {
    const { user, userProfile } = useAuth();
    const [liveState, setLiveState] = useState({
        candidates: [],
        error: null,
        scopeKey: null,
    });

    const tenantId = overrideTenantId === undefined
        ? (userProfile?.tenantId || null)
        : overrideTenantId;
    const scopeKey = user ? `${user.uid}:${tenantId ?? 'all'}` : 'demo';
    const waitingForClientTenant = Boolean(
        user
        && overrideTenantId === undefined
        && isClientRole(userProfile?.role)
        && !userProfile?.tenantId,
    );
    const demoResult = useMemo(() => ({ candidates: EMPTY_CANDIDATES, loading: false, error: null }), []);
    const waitingResult = useMemo(() => ({ candidates: EMPTY_CANDIDATES, loading: true, error: null }), []);
    const clientRoleResult = useMemo(() => ({ candidates: EMPTY_CANDIDATES, loading: false, error: null }), []);
    const liveResult = useMemo(() => {
        const isCurrentScope = liveState.scopeKey === scopeKey;
        return {
            candidates: isCurrentScope ? liveState.candidates : EMPTY_CANDIDATES,
            loading: !isCurrentScope,
            error: isCurrentScope ? liveState.error : null,
        };
    }, [liveState.candidates, liveState.error, liveState.scopeKey, scopeKey]);

    useEffect(() => {
        if (!user || waitingForClientTenant || isClientRole(userProfile?.role)) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            setLiveState((currentState) => (
                currentState.scopeKey === scopeKey
                    ? currentState
                    : {
                        candidates: [],
                        error: new Error('Firestore candidates subscription timeout.'),
                        scopeKey,
                    }
            ));
        }, LIVE_QUERY_TIMEOUT_MS);

        const unsubscribe = subscribeToCandidates(tenantId, (data, error) => {
            window.clearTimeout(timeoutId);
            setLiveState({
                candidates: data,
                error: error || null,
                scopeKey,
            });
        });

        return () => {
            window.clearTimeout(timeoutId);
            unsubscribe();
        };
    }, [scopeKey, tenantId, user, userProfile?.role, waitingForClientTenant]);

    if (!user) {
        return demoResult;
    }

    if (waitingForClientTenant) {
        return waitingResult;
    }

    if (isClientRole(userProfile?.role)) {
        return clientRoleResult;
    }

    return liveResult;
}
