/**
 * Call repairAllClaims Cloud Function.
 * Requires being logged in as admin.
 */

const https = require('https');

const REGION = 'southamerica-east1';
const PROJECT_ID = 'compliance-hub-br';
const FUNCTION_NAME = 'repairAllClaims';

// This requires an ID token from Firebase Auth — run in browser console instead
console.log(`
To repair all claims, run this in the browser console while logged in as admin:

(async () => {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(undefined, '${REGION}');
  const repair = httpsCallable(functions, '${FUNCTION_NAME}');
  const result = await repair({});
  console.log('Result:', result.data);
})();
`);
