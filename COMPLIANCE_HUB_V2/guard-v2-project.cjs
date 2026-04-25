const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const expectedProjectId = 'compliance-hub-v2';

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function parseEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    values[key] = value;
  }
  return values;
}

function fail(message) {
  console.error(`[V2 Firebase guard] ${message}`);
  process.exit(1);
}

const firebaseRc = JSON.parse(readText('app/.firebaserc'));
const defaultProject = firebaseRc?.projects?.default;
if (defaultProject !== expectedProjectId) {
  fail(`app/.firebaserc default=${defaultProject || '(missing)'}; expected ${expectedProjectId}.`);
}

const envValues = parseEnv(readText('app/.env.local'));
const envProject = envValues.VITE_FIREBASE_PROJECT_ID;
if (envProject !== expectedProjectId) {
  fail(`app/.env.local VITE_FIREBASE_PROJECT_ID=${envProject || '(missing)'}; expected ${expectedProjectId}.`);
}

const forbiddenProjectId = ['compliance', 'hub', 'br'].join('-');
const checkedValues = [
  defaultProject,
  envValues.VITE_FIREBASE_AUTH_DOMAIN,
  envValues.VITE_FIREBASE_PROJECT_ID,
  envValues.VITE_FIREBASE_STORAGE_BUCKET,
];

if (checkedValues.some((value) => String(value || '').includes(forbiddenProjectId))) {
  fail(`found forbidden V1 project identifier ${forbiddenProjectId} in Firebase project routing config.`);
}

console.log(`[V2 Firebase guard] OK: project is pinned to ${expectedProjectId}.`);
