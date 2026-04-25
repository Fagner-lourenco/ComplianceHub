/**
 * Constants: Roles & Permissions
 * Centralizes role definitions and permission checks.
 */

// =============================================================================
// ROLE DEFINITIONS
// =============================================================================

const ROLES = {
  // Client-side roles
  CLIENT_VIEWER: 'client_viewer',
  CLIENT_OPERATOR: 'client_operator',
  CLIENT_MANAGER: 'client_manager',

  // Ops-side roles
  ANALYST: 'analyst',
  SENIOR_ANALYST: 'senior_analyst',
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin',
};

// =============================================================================
// ROLE SETS
// =============================================================================

const CLIENT_ROLES = new Set([
  ROLES.CLIENT_VIEWER,
  ROLES.CLIENT_OPERATOR,
  ROLES.CLIENT_MANAGER,
]);

const OPS_ROLES = new Set([
  ROLES.ANALYST,
  ROLES.SENIOR_ANALYST,
  ROLES.SUPERVISOR,
  ROLES.ADMIN,
]);

const MANAGEMENT_ROLES = new Set([
  ROLES.SUPERVISOR,
  ROLES.ADMIN,
]);

const SENIOR_REVIEW_ROLES = new Set([
  ROLES.SENIOR_ANALYST,
  ROLES.SUPERVISOR,
  ROLES.ADMIN,
]);

const ANALYST_AND_ABOVE = new Set([
  ROLES.ANALYST,
  ROLES.SENIOR_ANALYST,
  ROLES.SUPERVISOR,
  ROLES.ADMIN,
]);

// =============================================================================
// PERMISSION HELPERS
// =============================================================================

/**
 * Check if a role is a client role.
 */
function isClientRole(role) {
  return CLIENT_ROLES.has(role);
}

/**
 * Check if a role is an ops role.
 */
function isOpsRole(role) {
  return OPS_ROLES.has(role);
}

/**
 * Check if role can manage users (create/list/modify).
 */
function canManageUsers(role) {
  return role === ROLES.SUPERVISOR || role === ROLES.ADMIN;
}

/**
 * Check if role can manage billing.
 */
function canManageBilling(role) {
  return role === ROLES.SUPERVISOR || role === ROLES.ADMIN;
}

/**
 * Check if role can resolve senior reviews.
 */
function canResolveSeniorReview(role) {
  return SENIOR_REVIEW_ROLES.has(role);
}

/**
 * Check if role can operate cases (analyst+).
 */
function canOperateCases(role) {
  return ANALYST_AND_ABOVE.has(role);
}

/**
 * Check if role can preview/run enrichment.
 */
function canRunEnrichment(role) {
  return ANALYST_AND_ABOVE.has(role);
}

/**
 * Check if role can materialize artifacts.
 */
function canMaterializeArtifacts(role) {
  return ANALYST_AND_ABOVE.has(role);
}

/**
 * Check if role can manage watchlists.
 */
function canManageWatchlists(role) {
  return ANALYST_AND_ABOVE.has(role);
}

/**
 * Check if a user belongs to a tenant (or is global admin).
 */
function belongsToTenant(profile, tenantId) {
  if (!profile) return false;
  const isGlobalAdmin = profile.role === ROLES.ADMIN && !profile.tenantId;
  return isGlobalAdmin || profile.tenantId === tenantId;
}

/**
 * Check if user can access a specific case.
 */
function canAccessCase(profile, caseData) {
  if (!profile || !caseData) return false;
  if (isClientRole(profile.role)) {
    return caseData.tenantId === profile.tenantId;
  }
  return belongsToTenant(profile, caseData.tenantId);
}

module.exports = {
  ROLES,
  CLIENT_ROLES,
  OPS_ROLES,
  MANAGEMENT_ROLES,
  SENIOR_REVIEW_ROLES,
  ANALYST_AND_ABOVE,
  isClientRole,
  isOpsRole,
  canManageUsers,
  canManageBilling,
  canResolveSeniorReview,
  canOperateCases,
  canRunEnrichment,
  canMaterializeArtifacts,
  canManageWatchlists,
  belongsToTenant,
  canAccessCase,
};
