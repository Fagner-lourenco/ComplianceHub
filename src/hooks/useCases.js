import { useState, useEffect } from 'react';
import { useAuth } from '../core/auth/AuthContext';
import { subscribeToCases } from '../core/firebase/firestoreService';
import { MOCK_CASES } from '../data/mockData';

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
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Demo mode — no real user, use mocks
        if (!user) {
            setCases(MOCK_CASES);
            setLoading(false);
            return;
        }

        // Determine tenantId:
        // - overrideTenantId === null → all tenants (ops)
        // - overrideTenantId === undefined → use profile tenantId (client)
        // - overrideTenantId === 'TEN-001' → specific tenant
        const tenantId = overrideTenantId === undefined
            ? (userProfile?.tenantId || null)
            : overrideTenantId;

        setLoading(true);
        setError(null);

        const unsubscribe = subscribeToCases(tenantId, (data) => {
            setCases(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, userProfile?.tenantId, overrideTenantId]);

    return { cases, loading, error };
}
