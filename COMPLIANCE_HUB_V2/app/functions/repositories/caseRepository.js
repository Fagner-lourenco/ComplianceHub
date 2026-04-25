/**
 * Repository: Cases
 * Abstracts all Firestore access for the 'cases' collection.
 * All case CRUD operations should go through this module.
 */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../constants/collections');

const db = getFirestore();
const CASES = COLLECTIONS.CASES;

// =============================================================================
// READ OPERATIONS
// =============================================================================

/**
 * Get a case document by ID.
 * @param {string} caseId
 * @returns {Promise<{id: string, exists: boolean, data: object|null}>}
 */
async function findById(caseId) {
  const snap = await db.collection(CASES).doc(caseId).get();
  return {
    id: caseId,
    exists: snap.exists,
    data: snap.exists ? snap.data() : null,
  };
}

/**
 * Get a case document reference (for transactions/batches).
 * @param {string} caseId
 * @returns {FirebaseFirestore.DocumentReference}
 */
function docRef(caseId) {
  return db.collection(CASES).doc(caseId);
}

/**
 * Get raw snapshot (for advanced use cases).
 * @param {string} caseId
 * @returns {Promise<FirebaseFirestore.DocumentSnapshot>}
 */
async function getSnapshot(caseId) {
  return db.collection(CASES).doc(caseId).get();
}

/**
 * List cases by tenant with optional filters.
 * @param {string} tenantId
 * @param {object} opts — { status, limit, orderBy, startAfter }
 * @returns {Promise<Array<{id: string, data: object}>>}
 */
async function findByTenant(tenantId, opts = {}) {
  let query = db.collection(CASES).where('tenantId', '==', tenantId);

  if (opts.status) {
    query = query.where('status', '==', opts.status);
  }
  if (opts.orderBy) {
    query = query.orderBy(opts.orderBy, opts.orderDirection || 'desc');
  }
  if (opts.limit) {
    query = query.limit(opts.limit);
  }
  if (opts.startAfter) {
    query = query.startAfter(opts.startAfter);
  }

  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

/**
 * Find cases assigned to a specific analyst.
 * @param {string} analystId
 * @param {object} opts — { status, limit }
 */
async function findByAssignee(analystId, opts = {}) {
  let query = db.collection(CASES).where('assigneeId', '==', analystId);

  if (opts.status) {
    query = query.where('status', '==', opts.status);
  }
  if (opts.limit) {
    query = query.limit(opts.limit);
  }

  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

/**
 * Find cases by subject ID.
 * @param {string} subjectId
 */
async function findBySubject(subjectId) {
  const snap = await db.collection(CASES).where('subjectId', '==', subjectId).get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

// =============================================================================
// WRITE OPERATIONS
// =============================================================================

/**
 * Create a new case document.
 * @param {string|null} caseId — null for auto-generated ID
 * @param {object} data
 * @returns {Promise<string>} — The document ID
 */
async function create(caseId, data) {
  const ref = caseId ? db.collection(CASES).doc(caseId) : db.collection(CASES).doc();
  await ref.set({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Update a case document (full merge).
 * @param {string} caseId
 * @param {object} data
 */
async function update(caseId, data) {
  await db.collection(CASES).doc(caseId).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Update a case document with merge option.
 * @param {string} caseId
 * @param {object} data
 */
async function setMerge(caseId, data) {
  await db.collection(CASES).doc(caseId).set(
    {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Update within a transaction.
 * @param {FirebaseFirestore.Transaction} t
 * @param {string} caseId
 * @param {object} data
 */
function updateInTransaction(t, caseId, data) {
  t.update(db.collection(CASES).doc(caseId), {
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Set within a transaction.
 * @param {FirebaseFirestore.Transaction} t
 * @param {string} caseId
 * @param {object} data
 * @param {object} opts — { merge: boolean }
 */
function setInTransaction(t, caseId, data, opts = {}) {
  t.set(
    db.collection(CASES).doc(caseId),
    {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    },
    opts
  );
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Add an update operation to a batch.
 * @param {FirebaseFirestore.WriteBatch} batch
 * @param {string} caseId
 * @param {object} data
 */
function batchUpdate(batch, caseId, data) {
  batch.update(db.collection(CASES).doc(caseId), {
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Add a set operation to a batch.
 * @param {FirebaseFirestore.WriteBatch} batch
 * @param {string} caseId
 * @param {object} data
 * @param {object} opts — { merge: boolean }
 */
function batchSet(batch, caseId, data, opts = {}) {
  batch.set(
    db.collection(CASES).doc(caseId),
    {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    },
    opts
  );
}

// =============================================================================
// SUBCOLLECTIONS
// =============================================================================

/**
 * Get the publicResult subcollection document.
 * @param {string} caseId
 * @returns {FirebaseFirestore.DocumentReference}
 */
function publicResultRef(caseId) {
  return db.collection(CASES).doc(caseId).collection('publicResult').doc('latest');
}

/**
 * Get public result data.
 * @param {string} caseId
 */
async function getPublicResult(caseId) {
  const snap = await publicResultRef(caseId).get();
  return { exists: snap.exists, data: snap.exists ? snap.data() : null };
}

/**
 * Set public result data.
 * @param {string} caseId
 * @param {object} data
 */
async function setPublicResult(caseId, data) {
  await publicResultRef(caseId).set({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// =============================================================================
// COUNTERS / AGGREGATES
// =============================================================================

/**
 * Count cases by status for a tenant.
 * @param {string} tenantId
 * @param {string} status
 */
async function countByStatus(tenantId, status) {
  const snap = await db
    .collection(CASES)
    .where('tenantId', '==', tenantId)
    .where('status', '==', status)
    .count()
    .get();
  return snap.data().count;
}

module.exports = {
  // Read
  findById,
  docRef,
  getSnapshot,
  findByTenant,
  findByAssignee,
  findBySubject,

  // Write
  create,
  update,
  setMerge,
  updateInTransaction,
  setInTransaction,

  // Batch
  batchUpdate,
  batchSet,

  // Subcollections
  publicResultRef,
  getPublicResult,
  setPublicResult,

  // Aggregates
  countByStatus,
};
