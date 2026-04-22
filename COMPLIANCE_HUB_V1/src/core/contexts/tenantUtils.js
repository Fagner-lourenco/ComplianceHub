import { isClientRole, isOpsRole, ROLES } from '../rbac/permissions';

export const ALL_TENANTS_ID = 'all';
export const SELECTED_TENANT_STORAGE_KEY = 'ch_selected_tenant_id';

const tenantNameCollator = new Intl.Collator('pt-BR', {
    numeric: true,
    sensitivity: 'base',
});

function normalizeTenantEntry(tenant) {
    if (!tenant?.id) {
        return null;
    }

    return {
        id: String(tenant.id),
        name: String(tenant.name || tenant.id),
    };
}

export function canAccessAllTenants(role) {
    return isOpsRole(role) || role === ROLES.ADMIN;
}

export function dedupeTenants(tenants) {
    const tenantMap = new Map();

    for (const tenant of tenants) {
        const normalizedTenant = normalizeTenantEntry(tenant);

        if (!normalizedTenant) {
            continue;
        }

        const current = tenantMap.get(normalizedTenant.id);

        if (!current || current.name === current.id) {
            tenantMap.set(normalizedTenant.id, normalizedTenant);
        }
    }

    return [...tenantMap.values()].sort((left, right) => tenantNameCollator.compare(left.name, right.name));
}

export function resolveTenantOptions(userProfile, tenantDirectory = []) {
    if (!userProfile?.role) {
        return [];
    }

    if (isClientRole(userProfile.role)) {
        if (!userProfile.tenantId) {
            return [];
        }

        return [{
            id: userProfile.tenantId,
            name: userProfile.tenantName || userProfile.tenantId,
        }];
    }

    return dedupeTenants([
        userProfile.tenantId
            ? { id: userProfile.tenantId, name: userProfile.tenantName || userProfile.tenantId }
            : null,
        ...tenantDirectory,
    ]);
}

export function resolveSelectedTenantId({
    role,
    availableTenants,
    currentTenantId,
    storedTenantId,
}) {
    if (!availableTenants.length) {
        if (!canAccessAllTenants(role)) {
            return null;
        }

        return currentTenantId || storedTenantId || ALL_TENANTS_ID;
    }

    if (!canAccessAllTenants(role)) {
        return availableTenants[0].id;
    }

    if (availableTenants.length === 1) {
        return availableTenants[0].id;
    }

    const availableTenantIds = new Set(availableTenants.map((tenant) => tenant.id));

    if (currentTenantId === ALL_TENANTS_ID) {
        return ALL_TENANTS_ID;
    }

    if (currentTenantId && availableTenantIds.has(currentTenantId)) {
        return currentTenantId;
    }

    if (storedTenantId === ALL_TENANTS_ID) {
        return ALL_TENANTS_ID;
    }

    if (storedTenantId && availableTenantIds.has(storedTenantId)) {
        return storedTenantId;
    }

    return ALL_TENANTS_ID;
}

export function getSelectedTenantLabel({
    role,
    selectedTenantId,
    selectedTenant,
    userProfile,
    tenantStatus,
}) {
    if (!role) {
        return 'Contexto em validacao';
    }

    if (!canAccessAllTenants(role)) {
        return selectedTenant?.name || userProfile?.tenantName || 'Franquia nao vinculada';
    }

    if (selectedTenantId === ALL_TENANTS_ID) {
        return 'Todas as franquias';
    }

    if (selectedTenant) {
        return selectedTenant.name;
    }

    if (tenantStatus === 'loading') {
        return 'Validando franquia';
    }

    return 'Franquia indisponivel';
}
