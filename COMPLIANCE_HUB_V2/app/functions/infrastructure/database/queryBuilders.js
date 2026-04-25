/**
 * Infrastructure: Query Builders
 * Reusable Firestore query builders for common patterns.
 */

const { db } = require('./firestore');

/**
 * Build a tenant-scoped query with optional filters.
 * @param {string} collection
 * @param {string} tenantId
 * @param {object} [filters]
 * @returns {object} Firestore Query
 */
function buildTenantQuery(collection, tenantId, filters = {}) {
  let query = db.collection(collection).where('tenantId', '==', tenantId);

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      query = query.where(key, '==', value);
    }
  }

  return query;
}

/**
 * Build a case-scoped query.
 * @param {string} collection
 * @param {string} caseId
 * @returns {object}
 */
function buildCaseQuery(collection, caseId) {
  return db.collection(collection).where('caseId', '==', caseId);
}

module.exports = { buildTenantQuery, buildCaseQuery };
