/**
 * Script: Health Check
 * Verifies backend integrity before deploy.
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  'index.js',
  'config/environment.js',
  'config/enrichmentDefaults.js',
  'config/featureFlags.js',
  'constants/collections.js',
  'constants/errors.js',
  'constants/roles.js',
  'domain/dossierSchema.js',
  'domain/v2CaseStatus.js',
  'domain/v2ScoreEngine.js',
  'domain/v2NormalizationRules.js',
  'adapters/bigdatacorp.js',
  'adapters/bigdatacorpCatalog.js',
  'adapters/bigdatacorpQueryBuilder.js',
  'application/dossier/createDossier.js',
  'application/dossier/processDossier.js',
  'application/dossier/getDossierDetail.js',
  'interfaces/http/routes.js',
  'interfaces/http/middleware/tenantResolver.js',
  'interfaces/http/middleware/errorHandler.js',
  'interfaces/triggers/onCaseCreated.js',
  'interfaces/triggers/onModuleRunUpdated.js',
];

const REQUIRED_ENV = [
  'BIGDATACORP_ACCESS_TOKEN',
  'BIGDATACORP_TOKEN_ID',
];

function checkFiles() {
  const missing = [];
  for (const file of REQUIRED_FILES) {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) {
      missing.push(file);
    }
  }
  return missing;
}

function checkEnv() {
  const missing = [];
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  return missing;
}

function checkSyntax() {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) continue;
    try {
      require('child_process').execSync(`node -c "${fullPath}"`, { stdio: 'pipe' });
    } catch (err) {
      errors.push(file);
    }
  }
  return errors;
}

function run() {
  console.log('=== Compliance Hub V2 — Health Check ===\n');

  const fileMissing = checkFiles();
  const envMissing = checkEnv();
  const syntaxErrors = checkSyntax();

  console.log(`Files: ${REQUIRED_FILES.length - fileMissing.length}/${REQUIRED_FILES.length} OK`);
  if (fileMissing.length) {
    console.log('  Missing:', fileMissing.join(', '));
  }

  console.log(`\nEnv: ${REQUIRED_ENV.length - envMissing.length}/${REQUIRED_ENV.length} OK`);
  if (envMissing.length) {
    console.log('  Missing:', envMissing.join(', '));
  }

  console.log(`\nSyntax: ${REQUIRED_FILES.length - syntaxErrors.length}/${REQUIRED_FILES.length} OK`);
  if (syntaxErrors.length) {
    console.log('  Errors:', syntaxErrors.join(', '));
  }

  const allOk = fileMissing.length === 0 && envMissing.length === 0 && syntaxErrors.length === 0;
  console.log(`\n=== ${allOk ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'} ===`);
  process.exit(allOk ? 0 : 1);
}

run();
