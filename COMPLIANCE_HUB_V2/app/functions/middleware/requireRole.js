/**
 * Middleware: requireRole
 * Wraps callable handlers to enforce role-based authorization.
 * Must be used AFTER requireAuth (req._uid must be set).
 */

const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../constants/collections');
const { ROLES, canManageUsers, canManageBilling, canResolveSeniorReview, canOperateCases } = require('../constants/roles');
const { ERRORS, throwError } = require('../constants/errors');

const db = getFirestore();

/**
 * Load user profile and attach to request.
 * @param {object} req
 * @returns {Promise<object>} profile
 */
async function loadProfile(req) {
  if (req._profile) return req._profile;
  const uid = req._uid || req.auth?.uid;
  if (!uid) throwError('AUTH_REQUIRED');

  const snap = await db.collection(COLLECTIONS.USER_PROFILES).doc(uid).get();
  if (!snap.exists) {
    throwError('PROFILE_NOT_FOUND');
  }
  const profile = snap.data();
  req._profile = profile;
  return profile;
}

/**
 * Require one or more specific roles.
 * @param {string|string[]} allowedRoles
 * @returns {Function} decorator
 */
function requireRole(allowedRoles) {
  const allowed = new Set(Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]);
  return (handler) => {
    return async (req) => {
      const profile = await loadProfile(req);
      if (!allowed.has(profile.role)) {
        throwError('PERMISSION_DENIED');
      }
      return handler(req);
    };
  };
}

/**
 * Require that the user belongs to the specified tenant (or is global admin).
 * @param {Function} getTenantId — (req) => tenantId string
 */
function requireTenantAccess(getTenantId) {
  return (handler) => {
    return async (req) => {
      const profile = await loadProfile(req);
      const tenantId = getTenantId(req);
      const isGlobalAdmin = profile.role === ROLES.ADMIN && !profile.tenantId;

      if (!isGlobalAdmin && profile.tenantId !== tenantId) {
        throwError('CASE_NOT_IN_TENANT');
      }
      req._tenantId = tenantId;
      return handler(req);
    };
  };
}

/**
 * Require that the user can access a specific case.
 * @param {Function} getCaseId — (req) => caseId string
 */
function requireCaseAccess(getCaseId) {
  return (handler) => {
    return async (req) => {
      const profile = await loadProfile(req);
      const caseId = getCaseId(req);
      const caseSnap = await db.collection(COLLECTIONS.CASES).doc(caseId).get();

      if (!caseSnap.exists) {
        throwError('CASE_NOT_FOUND');
      }
      const caseData = caseSnap.data();
      const isGlobalAdmin = profile.role === ROLES.ADMIN && !profile.tenantId;

      if (!isGlobalAdmin && caseData.tenantId !== profile.tenantId) {
        throwError('CASE_NOT_IN_TENANT');
      }
      req._caseId = caseId;
      req._caseData = caseData;
      return handler(req);
    };
  };
}

/**
 * Require manager role (supervisor or admin).
 */
function requireManager(handler) {
  return async (req) => {
    const profile = await loadProfile(req);
    if (!canManageUsers(profile.role)) {
      throwError('MANAGERS_ONLY_USERS');
    }
    return handler(req);
  };
}

/**
 * Require billing manager role.
 */
function requireBillingManager(handler) {
  return async (req) => {
    const profile = await loadProfile(req);
    if (!canManageBilling(profile.role)) {
      throwError('SUPERVISORS_ONLY_BILLING');
    }
    return handler(req);
  };
}

/**
 * Require analyst or above.
 */
function requireAnalyst(handler) {
  return async (req) => {
    const profile = await loadProfile(req);
    if (!canOperateCases(profile.role)) {
      throwError('ANALYSTS_ONLY');
    }
    return handler(req);
  };
}

/**
 * Require senior reviewer or above.
 */
function requireSeniorReviewer(handler) {
  return async (req) => {
    const profile = await loadProfile(req);
    if (!canResolveSeniorReview(profile.role)) {
      throwError('SENIOR_ONLY_REVIEW');
    }
    return handler(req);
  };
}

module.exports = {
  loadProfile,
  requireRole,
  requireTenantAccess,
  requireCaseAccess,
  requireManager,
  requireBillingManager,
  requireAnalyst,
  requireSeniorReviewer,
};
