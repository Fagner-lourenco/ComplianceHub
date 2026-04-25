/**
 * Infrastructure: Firestore Client
 * Centralized, pre-configured Firestore instance.
 */

const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

// Configure Firestore settings (optional tuning)
db.settings({
  ignoreUndefinedProperties: true,
});

module.exports = { db };
