/*  RBAC — Role-Based Access Control for ComplianceHub  */

export const ROLES = {
    LEGACY_CLIENT: 'CLIENT',
    CLIENT_VIEWER: 'client_viewer',
    CLIENT_OPERATOR: 'client_operator',
    CLIENT_MANAGER: 'client_manager',
    ANALYST: 'analyst',
    SUPERVISOR: 'supervisor',
    ADMIN: 'admin',
};

export const CLIENT_ROLES = [ROLES.LEGACY_CLIENT, ROLES.CLIENT_VIEWER, ROLES.CLIENT_OPERATOR, ROLES.CLIENT_MANAGER];
export const OPS_ROLES = [ROLES.ANALYST, ROLES.SUPERVISOR, ROLES.ADMIN];

const ROLE_LABELS = {
    [ROLES.LEGACY_CLIENT]: 'Cliente',
    [ROLES.CLIENT_VIEWER]: 'Visualizador',
    [ROLES.CLIENT_OPERATOR]: 'Operador',
    [ROLES.CLIENT_MANAGER]: 'Gestor',
    [ROLES.ANALYST]: 'Analista',
    [ROLES.SUPERVISOR]: 'Supervisor',
    [ROLES.ADMIN]: 'Administrador',
};

export const PERMISSIONS = {
    // Due Diligence
    CASE_READ: 'case.read',
    CASE_WRITE: 'case.write',
    CASE_CREATE_REQUEST: 'case.create_request',
    CASE_EXPORT: 'case.export',
    // Users
    USERS_MANAGE: 'users.manage',
    // Audit
    AUDIT_VIEW: 'audit.view',
    TENANT_AUDIT_VIEW: 'tenant_audit.view',
    // Settings
    SETTINGS_MANAGE: 'settings.manage',
};

const ROLE_PERMISSIONS = {
    [ROLES.LEGACY_CLIENT]: [
        PERMISSIONS.CASE_READ,
        PERMISSIONS.CASE_CREATE_REQUEST,
        PERMISSIONS.CASE_EXPORT,
    ],
    [ROLES.CLIENT_VIEWER]: [
        PERMISSIONS.CASE_READ,
        PERMISSIONS.CASE_EXPORT,
    ],
    [ROLES.CLIENT_OPERATOR]: [
        PERMISSIONS.CASE_READ,
        PERMISSIONS.CASE_CREATE_REQUEST,
        PERMISSIONS.CASE_EXPORT,
    ],
    [ROLES.CLIENT_MANAGER]: [
        PERMISSIONS.CASE_READ,
        PERMISSIONS.CASE_CREATE_REQUEST,
        PERMISSIONS.CASE_EXPORT,
        PERMISSIONS.USERS_MANAGE,
        PERMISSIONS.SETTINGS_MANAGE,
        PERMISSIONS.TENANT_AUDIT_VIEW,
    ],
    [ROLES.ANALYST]: [
        PERMISSIONS.CASE_READ,
        PERMISSIONS.CASE_WRITE,
        PERMISSIONS.CASE_EXPORT,
        PERMISSIONS.AUDIT_VIEW,
    ],
    [ROLES.SUPERVISOR]: [
        PERMISSIONS.CASE_READ,
        PERMISSIONS.CASE_WRITE,
        PERMISSIONS.CASE_EXPORT,
        PERMISSIONS.AUDIT_VIEW,
        PERMISSIONS.USERS_MANAGE,
    ],
    [ROLES.ADMIN]: Object.values(PERMISSIONS), // All permissions
};

export function hasPermission(role, permission) {
    const perms = ROLE_PERMISSIONS[role];
    if (!perms) return false;
    return perms.includes(permission);
}

export function getPortal(role) {
    if (CLIENT_ROLES.includes(role)) return 'client';
    if (OPS_ROLES.includes(role)) return 'ops';
    return null;
}

export function isClientRole(role) {
    return CLIENT_ROLES.includes(role);
}

export function isOpsRole(role) {
    return OPS_ROLES.includes(role);
}

export function formatRoleLabel(role) {
    return ROLE_LABELS[role] || 'Permissoes em sincronizacao';
}
