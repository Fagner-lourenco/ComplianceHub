import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../core/auth/useAuth';
import { subscribeToCases, subscribeToClientCases } from '../core/firebase/firestoreService';
import { isClientRole } from '../core/rbac/permissions';
import { MOCK_CASES } from '../data/mockData';

const LIVE_QUERY_TIMEOUT_MS = 10_000;
const EMPTY_CASES = [];

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

    const demoTenantId = overrideTenantId === undefined
        ? (userProfile?.tenantId || null)
        : overrideTenantId;
    const demoCases = useMemo(() => (
        demoTenantId
            ? MOCK_CASES.filter((currentCase) => currentCase.tenantId === demoTenantId)
            : MOCK_CASES
    ), [demoTenantId]);
    const demoResult = useMemo(() => ({ cases: demoCases, loading: false, error: null }), [demoCases]);
    const waitingResult = useMemo(() => ({ cases: EMPTY_CASES, loading: true, error: null }), []);
    const skippedResult = useMemo(() => ({ cases: EMPTY_CASES, loading: false, error: null }), []);
    const liveResult = useMemo(() => {
        const isCurrentScope = liveState.scopeKey === scopeKey;
        return {
            cases: isCurrentScope ? liveState.cases : EMPTY_CASES,
            loading: !isCurrentScope,
            error: isCurrentScope ? liveState.error : null,
        };
    }, [liveState.cases, liveState.error, liveState.scopeKey, scopeKey]);

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
        return demoResult;
    }

    if (waitingForClientTenant) {
        return waitingResult;
    }

    if (tenantId === '__skip__') {
        return skippedResult;
    }

    return liveResult;
}
