/**
 * Infrastructure: Firestore Transaction Helpers
 */

const { db } = require('./firestore');

/**
 * Safely increment a counter in a transaction.
 * @param {object} transaction
 * @param {object} docRef
 * @param {string} field
 * @param {number} [incrementBy=1]
 */
function incrementInTransaction(transaction, docRef, field, incrementBy = 1) {
  transaction.update(docRef, {
    [field]: require('firebase-admin/firestore').FieldValue.increment(incrementBy),
  });
}

/**
 * Create a document only if it doesn't exist.
 * @param {object} transaction
 * @param {object} docRef
 * @param {object} data
 */
function createIfNotExists(transaction, docRef, data) {
  const snap = transaction.get(docRef);
  if (!snap.exists) {
    transaction.set(docRef, data);
  }
}

module.exports = { incrementInTransaction, createIfNotExists };
