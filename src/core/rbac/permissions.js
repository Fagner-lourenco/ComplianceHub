/*  RBAC — Role-Based Access Control for ComplianceHub  */

export const ROLES = {
    CLIENT_VIEWER: 'client_viewer',
    CLIENT_MANAGER: 'client_manager',
    ANALYST: 'analyst',
    SUPERVISOR: 'supervisor',
    ADMIN: 'admin',
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
    // Settings
    SETTINGS_MANAGE: 'settings.manage',
};

const ROLE_PERMISSIONS = {
    [ROLES.CLIENT_VIEWER]: [
        PERMISSIONS.CASE_READ,
        PERMISSIONS.CASE_EXPORT,
    ],
    [ROLES.CLIENT_MANAGER]: [
        PERMISSIONS.CASE_READ,
        PERMISSIONS.CASE_CREATE_REQUEST,
        PERMISSIONS.CASE_EXPORT,
        PERMISSIONS.USERS_MANAGE,
        PERMISSIONS.SETTINGS_MANAGE,
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
    if ([ROLES.CLIENT_VIEWER, ROLES.CLIENT_MANAGER].includes(role)) return 'client';
    if ([ROLES.ANALYST, ROLES.SUPERVISOR].includes(role)) return 'ops';
    if (role === ROLES.ADMIN) return 'admin';
    return 'client';
}

export function isClientRole(role) {
    return [ROLES.CLIENT_VIEWER, ROLES.CLIENT_MANAGER].includes(role);
}

export function isOpsRole(role) {
    return [ROLES.ANALYST, ROLES.SUPERVISOR].includes(role);
}
