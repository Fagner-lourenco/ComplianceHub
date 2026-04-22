import { useMemo, useState } from 'react';
import { AuthContext } from '../core/auth/auth-context';
import { TenantContext } from '../core/contexts/tenant-context';
import { ALL_TENANTS_ID } from '../core/contexts/tenantUtils';

const DEMO_TENANTS = [
    { id: 'TEN-001', name: 'TechCorp Inc.' },
    { id: 'TEN-002', name: 'Banco Atlantico' },
];

const DEMO_PROFILES = {
    client: {
        uid: 'demo-client',
        displayName: 'Joao Demo',
        email: 'cliente.demo@techcorp.com',
        role: 'client_manager',
        tenantId: 'TEN-001',
        tenantName: 'TechCorp Inc.',
        source: 'demo',
    },
    ops: {
        uid: 'demo-ops',
        displayName: 'Operacao Demo',
        email: 'ops.demo@compliancehub.com',
        role: 'admin',
        tenantId: null,
        tenantName: null,
        source: 'demo',
    },
};

export function DemoProviders({ mode, children }) {
    const [selectedTenantId, setSelectedTenantId] = useState(
        mode === 'ops' ? ALL_TENANTS_ID : DEMO_PROFILES.client.tenantId,
    );

    const userProfile = DEMO_PROFILES[mode];

    const authValue = useMemo(() => ({
        user: null,
        userProfile,
        loading: false,
        profileStatus: 'ready',
        profileError: null,
        hasResolvedProfile: true,
        login: async () => ({ user: null }),
        logout: async () => {},
        refreshProfile: async () => userProfile,
    }), [userProfile]);

    const tenantValue = useMemo(() => {
        if (mode !== 'ops') {
            return {
                canAccessAllTenants: false,
                canSelectTenant: false,
                selectedTenantId: DEMO_PROFILES.client.tenantId,
                selectedTenant: DEMO_TENANTS[0],
                selectedTenantLabel: DEMO_PROFILES.client.tenantName,
                setSelectedTenantId: () => {},
                tenantStatus: 'ready',
                tenants: [DEMO_TENANTS[0]],
            };
        }

        const selectedTenant = selectedTenantId === ALL_TENANTS_ID
            ? null
            : DEMO_TENANTS.find((tenant) => tenant.id === selectedTenantId) || null;

        return {
            canAccessAllTenants: true,
            canSelectTenant: true,
            selectedTenantId,
            selectedTenant,
            selectedTenantLabel: selectedTenant ? selectedTenant.name : 'Todas as franquias',
            setSelectedTenantId: (nextTenantId) => {
                if (nextTenantId === ALL_TENANTS_ID || DEMO_TENANTS.some((tenant) => tenant.id === nextTenantId)) {
                    setSelectedTenantId(nextTenantId);
                }
            },
            tenantStatus: 'ready',
            tenants: DEMO_TENANTS,
        };
    }, [mode, selectedTenantId]);

    return (
        <AuthContext.Provider value={authValue}>
            <TenantContext.Provider value={tenantValue}>
                {children}
            </TenantContext.Provider>
        </AuthContext.Provider>
    );
}
