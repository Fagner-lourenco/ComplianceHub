/**
 * Middleware: Tenant Resolver
 * Injects tenantId into request context from authenticated user profile.
 * For onRequest (REST), reads from Authorization Bearer token.
 * For onCall, reads from req.auth.token.
 */

const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../../constants/collections');

const auth = getAuth();
const db = getFirestore();

/**
 * Extract and verify Bearer token from Authorization header.
 * @param {object} req
 * @returns {Promise<string|null>} uid
 */
async function extractUidFromHeader(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  console.log('[tenantResolver] authHeader present:', !!authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[tenantResolver] no Bearer token found');
    return null;
  }
  const token = authHeader.split('Bearer ')[1];
  console.log('[tenantResolver] token length:', token?.length);
  try {
    const decoded = await auth.verifyIdToken(token);
    console.log('[tenantResolver] token decoded, uid:', decoded.uid);
    return decoded.uid;
  } catch (err) {
    console.error('[tenantResolver] verifyIdToken failed:', err.message);
    return null;
  }
}

/**
 * Resolve tenantId from user profile.
 * @param {string} uid
 * @returns {Promise<{tenantId: string, role: string, profile: object}>}
 */
async function resolveTenantFromProfile(uid) {
  const ref = db.collection(COLLECTIONS.USER_PROFILES).doc(uid);
  let snap = await ref.get();

  // Auto-provision missing profiles (dev/test fallback)
  if (!snap.exists) {
    try {
      const userRecord = await auth.getUser(uid);
      const defaultProfile = {
        email: userRecord.email || '',
        displayName: userRecord.displayName || '',
        role: 'admin',
        tenantId: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await ref.set(defaultProfile);
      snap = await ref.get();
      console.log('[tenantResolver] auto-provisioned profile for uid:', uid);
    } catch (provisionErr) {
      console.error('[tenantResolver] auto-provision failed:', provisionErr.message);
      const error = new Error('Perfil não encontrado.');
      error.code = 'PROFILE_NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }
  }

  const profile = snap.data();
  // Admins can access without a tenant bound (multi-tenant oversight)
  if (!profile.tenantId && profile.role !== 'admin') {
    const error = new Error('Tenant não identificado.');
    error.code = 'TENANT_REQUIRED';
    error.statusCode = 403;
    throw error;
  }

  // Sync custom claims so Firestore rules can read role/tenantId without get()
  try {
    const currentClaims = (await auth.getUser(uid)).customClaims || {};
    if (currentClaims.role !== profile.role || currentClaims.tenantId !== profile.tenantId) {
      await auth.setCustomUserClaims(uid, {
        ...currentClaims,
        role: profile.role,
        tenantId: profile.tenantId || null,
      });
      console.log('[tenantResolver] synced custom claims for uid:', uid);
    }
  } catch (claimsErr) {
    console.warn('[tenantResolver] failed to sync custom claims:', claimsErr.message);
  }

  return {
    tenantId: profile.tenantId || 'all',
    role: profile.role || 'analyst',
    profile,
  };
}

/**
 * Express-style middleware for onRequest functions.
 * Attaches req.tenantId, req.userRole, req.userProfile.
 */
async function tenantResolver(req, res, next) {
  try {
    const uid = await extractUidFromHeader(req);
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'Autenticação necessária.' },
      });
    }

    const { tenantId, role, profile } = await resolveTenantFromProfile(uid);
    req.uid = uid;
    req.tenantId = tenantId;
    req.userRole = role;
    req.userProfile = profile;

    return next();
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

module.exports = { tenantResolver, resolveTenantFromProfile, extractUidFromHeader };
