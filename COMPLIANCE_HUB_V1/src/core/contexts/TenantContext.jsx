import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { subscribeToTenantDirectory } from '../firebase/firestoreService';
import { TenantContext } from './tenant-context';
import {
    ALL_TENANTS_ID,
    canAccessAllTenants,
    getSelectedTenantLabel,
    resolveSelectedTenantId,
    resolveTenantOptions,
    SELECTED_TENANT_STORAGE_KEY,
} from './tenantUtils';

function getStoredTenantId() {
    if (typeof window === 'undefined') {
        return ALL_TENANTS_ID;
    }

    return window.localStorage.getItem(SELECTED_TENANT_STORAGE_KEY) || ALL_TENANTS_ID;
}

export function TenantProvider({ children }) {
    const { user, userProfile } = useAuth();
    const [selectedTenantId, setSelectedTenantId] = useState(getStoredTenantId);
    const [tenantDirectoryState, setTenantDirectoryState] = useState({
        scopeKey: null,
        tenants: [],
        error: null,
    });

    const needsTenantDirectory = Boolean(user && canAccessAllTenants(userProfile?.role));
    const directoryScopeKey = needsTenantDirectory ? user.uid : null;

    useEffect(() => {
        if (!needsTenantDirectory || !directoryScopeKey) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            setTenantDirectoryState((currentState) => (
                currentState.scopeKey === directoryScopeKey && currentState.tenants.length > 0
                    ? currentState
                    : {
                        scopeKey: directoryScopeKey,
                        tenants: [],
                        error: new Error('Tenant directory subscription timeout.'),
                    }
            ));
        }, 10_000);

        const unsubscribe = subscribeToTenantDirectory((tenants, error) => {
            window.clearTimeout(timeoutId);
            setTenantDirectoryState({
                scopeKey: directoryScopeKey,
                tenants,
                error,
            });
        });

        return () => {
            window.clearTimeout(timeoutId);
            unsubscribe();
        };
    }, [directoryScopeKey, needsTenantDirectory]);

    const tenantDirectory = useMemo(() => (
        tenantDirectoryState.scopeKey === directoryScopeKey
            ? tenantDirectoryState.tenants
            : []
    ), [directoryScopeKey, tenantDirectoryState.scopeKey, tenantDirectoryState.tenants]);

    const tenantStatus = useMemo(() => {
        if (!userProfile?.role) {
            return 'idle';
        }

        if (!needsTenantDirectory) {
            return 'ready';
        }

        if (tenantDirectoryState.scopeKey !== directoryScopeKey) {
            return 'loading';
        }

        return tenantDirectoryState.error ? 'error' : 'ready';
    }, [
        directoryScopeKey,
        needsTenantDirectory,
        tenantDirectoryState.error,
        tenantDirectoryState.scopeKey,
        userProfile?.role,
    ]);

    const tenants = useMemo(() => resolveTenantOptions(userProfile, tenantDirectory), [tenantDirectory, userProfile]);

    const storedTenantId = typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(SELECTED_TENANT_STORAGE_KEY);

    const expectedSelectedTenantId = useMemo(() => resolveSelectedTenantId({
        role: userProfile?.role,
        availableTenants: tenants,
        currentTenantId: selectedTenantId,
        storedTenantId,
    }), [selectedTenantId, storedTenantId, tenants, userProfile?.role]);

    const syncSelectedTenantId = useEffectEvent((tenantId) => {
        setSelectedTenantId((currentTenantId) => (
            currentTenantId === tenantId ? currentTenantId : tenantId
        ));
    });

    useEffect(() => {
        if (expectedSelectedTenantId !== selectedTenantId) {
            syncSelectedTenantId(expectedSelectedTenantId);
        }
    }, [expectedSelectedTenantId, selectedTenantId]);

    const persistSelectedTenant = useEffectEvent((tenantId) => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!canAccessAllTenants(userProfile?.role) || !tenantId) {
            window.localStorage.removeItem(SELECTED_TENANT_STORAGE_KEY);
            return;
        }

        window.localStorage.setItem(SELECTED_TENANT_STORAGE_KEY, tenantId);
    });

    useEffect(() => {
        persistSelectedTenant(selectedTenantId);
    }, [selectedTenantId]);

    const selectedTenant = useMemo(() => (
        selectedTenantId === ALL_TENANTS_ID
            ? null
            : tenants.find((tenant) => tenant.id === selectedTenantId) || null
    ), [selectedTenantId, tenants]);

    const selectTenant = (nextTenantId) => {
        if (!canAccessAllTenants(userProfile?.role)) {
            return;
        }

        if (nextTenantId === ALL_TENANTS_ID) {
            setSelectedTenantId(ALL_TENANTS_ID);
            return;
        }

        if (tenants.some((tenant) => tenant.id === nextTenantId)) {
            setSelectedTenantId(nextTenantId);
        }
    };

    const value = {
        canAccessAllTenants: canAccessAllTenants(userProfile?.role),
        canSelectTenant: canAccessAllTenants(userProfile?.role) && tenants.length > 1,
        selectedTenantId,
        selectedTenant,
        selectedTenantLabel: getSelectedTenantLabel({
            role: userProfile?.role,
            selectedTenantId,
            selectedTenant,
            userProfile,
            tenantStatus,
        }),
        setSelectedTenantId: selectTenant,
        tenantStatus,
        tenants,
    };

    return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
