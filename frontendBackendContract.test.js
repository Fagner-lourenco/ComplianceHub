/**
 * frontendBackendContract.test.js — Teste de contrato automatizado
 *
 * Extrai todos os callBackendFunction('nome') do frontend e
 * compara com exports.* do backend. Falha se algum callable
 * chamado pelo frontend nao existir no backend.
 *
 * Executar da raiz do projeto:
 *   node node_modules/vitest/vitest.mjs run frontendBackendContract.test.js
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

function walk(dir, files = []) {
    for (const item of readdirSync(dir)) {
        const full = resolve(dir, item);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            if (!['node_modules', 'dist', 'build', '.git'].includes(item)) walk(full, files);
        } else if (/\.(js|jsx|ts|tsx)$/.test(item)) {
            files.push(full);
        }
    }
    return files;
}

// ── Extrai nomes do frontend ──
function extractFrontendCallables() {
    const names = new Set();
    const patterns = [
        /callBackendFunction\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g,
        /httpsCallable\s*\([^,]+,\s*['"]([A-Za-z0-9_]+)['"]/g,
    ];

    for (const filePath of walk(resolve(__dirname, 'src'))) {
        const content = readFileSync(filePath, 'utf-8');
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content))) names.add(match[1]);
        }
    }
    return names;
}

// ── Extrai exports do backend ──
function extractBackendExports() {
    const index = require('./functions/index.js');
    return new Set(Object.keys(index).filter((k) => k !== '__test'));
}

describe('Contrato frontend-backend', () => {
    const frontendCallables = extractFrontendCallables();
    const backendExports = extractBackendExports();

    it('frontend tem callables definidos', () => {
        expect(frontendCallables.size).toBeGreaterThan(30);
    });

    it('backend tem exports definidos', () => {
        expect(backendExports.size).toBeGreaterThan(50);
    });

    it('TODO callable do frontend existe no backend', () => {
        const missing = [...frontendCallables].filter((name) => !backendExports.has(name));
        if (missing.length > 0) {
            console.error('MISSING_IN_BACKEND:');
            missing.forEach((m) => console.error('  ' + m));
        }
        expect(missing).toEqual([]);
    });
});
