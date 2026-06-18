/**
 * check-frontend-backend-contract.cjs — Script standalone CLI
 *
 * Extrai callables do frontend e compara com backend exports.
 * Uso: node check-frontend-backend-contract.cjs
 * Exit code 1 se houver missing exports.
 */
const { readdirSync, readFileSync, statSync } = require('fs');
const path = require('path');

function walk(dir, files = []) {
    for (const item of readdirSync(dir)) {
        const full = path.join(dir, item);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            if (!['node_modules', 'dist', 'build', '.git'].includes(item)) walk(full, files);
        } else if (/\.(js|jsx|ts|tsx)$/.test(item)) {
            files.push(full);
        }
    }
    return files;
}

function extractFrontendCallables() {
    const names = new Set();
    const patterns = [
        /callBackendFunction\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g,
        /httpsCallable\s*\([^,]+,\s*['"]([A-Za-z0-9_]+)['"]/g,
    ];

    for (const file of walk('src')) {
        const text = readFileSync(file, 'utf-8');
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text))) names.add(match[1]);
        }
    }
    return names;
}

// Frontend
const feNames = extractFrontendCallables();

// Backend
const idx = require('./functions/index.js');
const beNames = new Set(Object.keys(idx).filter((k) => k !== '__test'));

const missing = [...feNames].filter((n) => !beNames.has(n));
const extra = [...beNames].filter((n) => !feNames.has(n) && !['processExportJob'].includes(n));

console.log('Frontend callables: ' + feNames.size);
console.log('Backend exports:    ' + beNames.size);
console.log('Missing in backend: ' + missing.length);
console.log('Extra (not in FE):  ' + extra.length);

if (missing.length > 0) {
    console.error('\nMISSING_IN_BACKEND:');
    missing.forEach((m) => console.error('  ' + m));
    process.exit(1);
}

console.log('\nOK — todos callables do frontend existem no backend.');
