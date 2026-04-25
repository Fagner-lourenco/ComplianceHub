/**
 * Repository: Tenants
 * Abstracts all Firestore access for tenant-related collections.
 */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../constants/collections');

const db = getFirestore();

// =============================================================================
// TENANT SETTINGS
// =============================================================================

async function getSettings(tenantId) {
  const snap = await db.collection(COLLECTIONS.TENANT_SETTINGS).doc(tenantId).get();
  return { exists: snap.exists, data: snap.exists ? snap.data() : null };
}

async function updateSettings(tenantId, data) {
  await db.collection(COLLECTIONS.TENANT_SETTINGS).doc(tenantId).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function setSettings(tenantId, data, opts = {}) {
  await db.collection(COLLECTIONS.TENANT_SETTINGS).doc(tenantId).set(
    {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    },
    opts
  );
}

// =============================================================================
// TENANT ENTITLEMENTS
// =============================================================================

async function getEntitlements(tenantId) {
  const snap = await db.collection(COLLECTIONS.TENANT_ENTITLEMENTS).doc(tenantId).get();
  return { exists: snap.exists, data: snap.exists ? snap.data() : null };
}

async function updateEntitlements(tenantId, data) {
  await db.collection(COLLECTIONS.TENANT_ENTITLEMENTS).doc(tenantId).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// =============================================================================
// TENANT USAGE
// =============================================================================

async function getUsage(tenantId) {
  const snap = await db.collection(COLLECTIONS.TENANT_USAGE).doc(tenantId).get();
  return { exists: snap.exists, data: snap.exists ? snap.data() : null };
}

async function updateUsage(tenantId, data) {
  await db.collection(COLLECTIONS.TENANT_USAGE).doc(tenantId).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// =============================================================================
// USER PROFILES (scoped by tenant)
// =============================================================================

async function getUserProfile(uid) {
  const snap = await db.collection(COLLECTIONS.USER_PROFILES).doc(uid).get();
  return { exists: snap.exists, data: snap.exists ? snap.data() : null };
}

async function findUsersByTenant(tenantId, opts = {}) {
  let query = db.collection(COLLECTIONS.USER_PROFILES).where('tenantId', '==', tenantId);
  if (opts.limit) query = query.limit(opts.limit);
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

module.exports = {
  // Settings
  getSettings,
  updateSettings,
  setSettings,

  // Entitlements
  getEntitlements,
  updateEntitlements,

  // Usage
  getUsage,
  updateUsage,

  // Users
  getUserProfile,
  findUsersByTenant,
};
