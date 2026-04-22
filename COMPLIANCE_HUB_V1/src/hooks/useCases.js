import { useEffect, useState } from 'react';
import { useAuth } from '../core/auth/useAuth';
import { subscribeToCases, subscribeToClientCases } from '../core/firebase/firestoreService';
import { isClientRole } from '../core/rbac/permissions';
import { MOCK_CASES } from '../data/mockData';

const LIVE_QUERY_TIMEOUT_MS = 10_000;

/**
 * Hook that provides real-time cases from Firestore.
 * Falls back to MOCK_CASES when user is not authenticated (demo mode).
 *
 * @param {string|null|undefined} overrideTenantId - Force a specific tenantId.
 *   null = all tenants (ops portal). undefined = use userProfile.tenantId.
 * @returns {{ cases: Array, loading: boolean, error: string|null }}
 */
export function useCases(overrideTenantId) {
    const { user, userProfile } = useAuth();
    const [liveState, setLiveState] = useState({
        cases: [],
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

    useEffect(() => {
        if (!user || waitingForClientTenant || tenantId === '__skip__') {
            return undefined;
        }

        const subscribe = isClientRole(userProfile?.role)
            ? subscribeToClientCases
            : subscribeToCases;

        const timeoutId = window.setTimeout(() => {
            setLiveState((currentState) => (
                currentState.scopeKey === scopeKey
                    ? currentState
                    : {
                        cases: [],
                        error: new Error('Firestore cases subscription timeout.'),
                        scopeKey,
                    }
            ));
        }, LIVE_QUERY_TIMEOUT_MS);

        const unsubscribe = subscribe(tenantId, (data, error) => {
            window.clearTimeout(timeoutId);
            setLiveState({
                cases: data,
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
        const demoTenantId = overrideTenantId === undefined
            ? (userProfile?.tenantId || null)
            : overrideTenantId;
        const demoCases = demoTenantId
            ? MOCK_CASES.filter((currentCase) => currentCase.tenantId === demoTenantId)
            : MOCK_CASES;

        return { cases: demoCases, loading: false, error: null };
    }

    if (waitingForClientTenant) {
        return { cases: [], loading: true, error: null };
    }

    if (tenantId === '__skip__') {
        return { cases: [], loading: false, error: null };
    }

    return {
        cases: liveState.scopeKey === scopeKey ? liveState.cases : [],
        loading: liveState.scopeKey !== scopeKey,
        error: liveState.scopeKey === scopeKey ? liveState.error : null,
    };
}
