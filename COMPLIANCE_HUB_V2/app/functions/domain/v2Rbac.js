'use strict';

const ROLES = {
    LEGACY_CLIENT: 'CLIENT',
    CLIENT_VIEWER: 'client_viewer',
    CLIENT_OPERATOR: 'client_operator',
    CLIENT_MANAGER: 'client_manager',
    ANALYST: 'analyst',
    SENIOR_ANALYST: 'senior_analyst',
    SUPERVISOR: 'supervisor',
    ADMIN: 'admin',
};

const PERMISSIONS = {
    CASE_READ: 'case.read',
    CASE_WRITE: 'case.write',
    CASE_CREATE_REQUEST: 'case.create_request',
    CASE_EXPORT: 'case.export',
    CASE_REOPEN: 'case.reopen',
    DECISION_APPROVE: 'decision.approve',
    REPORT_PUBLISH: 'report.publish',
    REPORT_REVOKE: 'report.revoke',
    EVIDENCE_RAW_READ: 'evidence.raw_read',
    USERS_MANAGE: 'users.manage',
    AUDIT_VIEW: 'audit.view',
    TENANT_AUDIT_VIEW: 'tenant_audit.view',
    SETTINGS_MANAGE: 'settings.manage',
    BILLING_VIEW_INTERNAL_COST: 'billing.view_internal_cost',
    ENTITLEMENT_MANAGE: 'entitlement.manage',
    PROVIDER_DIVERGENCE_RESOLVE: 'provider_divergence.resolve',
};

const CLIENT_ROLES = [
    ROLES.LEGACY_CLIENT,
    ROLES.CLIENT_VIEWER,
    ROLES.CLIENT_OPERATOR,
    ROLES.CLIENT_MANAGER,
];

const OPS_ROLES = [
    ROLES.ANALYST,
    ROLES.SENIOR_ANALYST,
    ROLES.SUPERVISOR,
    ROLES.ADMIN,
];

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
        PERMISSIONS.DECISION_APPROVE,
        PERMISSIONS.PROVIDER_DIVERGENCE_RESOLVE,
    ],
    [ROLES.SENIOR_ANALYST]: [
        PERMISSIONS.CASE_READ,
        PERMISSIONS.CASE_WRITE,
        PERMISSIONS.CASE_EXPORT,
        PERMISSIONS.CASE_REOPEN,
        PERMISSIONS.AUDIT_VIEW,
        PERMISSIONS.EVIDENCE_RAW_READ,
        PERMISSIONS.DECISION_APPROVE,
        PERMISSIONS.REPORT_PUBLISH,
        PERMISSIONS.REPORT_REVOKE,
        PERMISSIONS.PROVIDER_DIVERGENCE_RESOLVE,
    ],
    [ROLES.SUPERVISOR]: [
        PERMISSIONS.CASE_READ,
        PERMISSIONS.CASE_WRITE,
        PERMISSIONS.CASE_EXPORT,
        PERMISSIONS.CASE_REOPEN,
        PERMISSIONS.AUDIT_VIEW,
        PERMISSIONS.EVIDENCE_RAW_READ,
        PERMISSIONS.DECISION_APPROVE,
        PERMISSIONS.REPORT_PUBLISH,
        PERMISSIONS.REPORT_REVOKE,
        PERMISSIONS.USERS_MANAGE,
        PERMISSIONS.BILLING_VIEW_INTERNAL_COST,
        PERMISSIONS.PROVIDER_DIVERGENCE_RESOLVE,
    ],
    [ROLES.ADMIN]: Object.values(PERMISSIONS),
};

function hasPermission(role, permission) {
    const permissions = ROLE_PERMISSIONS[role];
    if (!permissions) return false;
    return permissions.includes(permission);
}

function isOpsRole(role) {
    return OPS_ROLES.includes(role);
}

function isClientRole(role) {
    return CLIENT_ROLES.includes(role);
}

module.exports = {
    CLIENT_ROLES,
    OPS_ROLES,
    PERMISSIONS,
    ROLES,
    hasPermission,
    isClientRole,
    isOpsRole,
};
