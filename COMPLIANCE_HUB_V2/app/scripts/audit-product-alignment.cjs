/**
 * Script de auditoria: verifica alinhamento frontend-backend para todos os produtos.
 */
const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');

function extractObjectEntries(filePath, objectName, keyProp, valueProp) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const startIdx = content.indexOf(`const ${objectName}`);
    if (startIdx === -1) throw new Error(`${objectName} not found`);
    let braceDepth = 0;
    let inString = false;
    let stringChar = '';
    let blockStart = -1;
    for (let i = startIdx; i < content.length; i++) {
        const ch = content[i];
        if (inString) {
            if (ch === '\\') { i++; continue; }
            if (ch === stringChar) inString = false;
            continue;
        }
        if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
        if (ch === '/' && content[i+1] === '/') { while (i < content.length && content[i] !== '\n') i++; continue; }
        if (ch === '{') {
            braceDepth++;
            if (braceDepth === 1) blockStart = i;
        } else if (ch === '}') {
            braceDepth--;
            if (braceDepth === 0) {
                const block = content.slice(blockStart + 1, i);
                return parseTopLevelKeys(block, keyProp, valueProp);
            }
        }
    }
    return {};
}

function parseTopLevelKeys(block, keyProp, valueProp) {
    const result = {};
    const lines = block.split('\n');
    let currentKey = null;
    let currentArray = [];
    let inArray = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;
        const keyMatch = trimmed.match(/^(\w+):\s*\{/);
        if (keyMatch) {
            currentKey = keyMatch[1];
            currentArray = [];
            inArray = false;
            continue;
        }
        if (currentKey && trimmed.includes(`${valueProp}:`) && trimmed.includes('[')) {
            inArray = true;
        }
        if (inArray) {
            const items = trimmed.match(/['"](\w+)['"]/g);
            if (items) {
                currentArray.push(...items.map(s => s.replace(/['"]/g, '')));
            }
            if (trimmed.includes(']')) {
                result[currentKey] = currentArray;
                inArray = false;
            }
        }
    }
    return result;
}

function extractLabels(filePath, objectName) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const startIdx = content.indexOf(`const ${objectName}`);
    if (startIdx === -1) throw new Error(`${objectName} not found`);
    let braceDepth = 0;
    let inString = false;
    let stringChar = '';
    for (let i = startIdx; i < content.length; i++) {
        const ch = content[i];
        if (inString) {
            if (ch === '\\') { i++; continue; }
            if (ch === stringChar) inString = false;
            continue;
        }
        if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
        if (ch === '{') braceDepth++;
        else if (ch === '}') {
            braceDepth--;
            if (braceDepth === 0) {
                const block = content.slice(startIdx, i + 1);
                const labels = {};
                const regex = /(\w+):\s*['"]([^'"]+)['"]/g;
                let m;
                while ((m = regex.exec(block)) !== null) labels[m[1]] = m[2];
                return labels;
            }
        }
    }
    return {};
}

function runAudit() {
    const frontendModules = extractObjectEntries(
        path.join(appDir, 'src/core/productPipelines.js'),
        'PRODUCT_PIPELINES',
        'productKey',
        'modules'
    );
    const backendModules = extractObjectEntries(
        path.join(appDir, 'functions/domain/v2Modules.cjs'),
        'PRODUCT_REGISTRY',
        'productKey',
        'requiredModules'
    );
    const frontendLabels = extractLabels(path.join(appDir, 'src/core/productLabels.js'), 'PRODUCT_LABELS');
    const backendLabels = extractLabels(path.join(appDir, 'functions/domain/v2Core.cjs'), 'PRODUCT_LABELS');

    const allKeys = new Set([...Object.keys(frontendModules), ...Object.keys(backendModules)]);
    const issues = [];

    for (const key of allKeys) {
        const feMods = frontendModules[key];
        const beMods = backendModules[key];
        const feLabel = frontendLabels[key];
        const beLabel = backendLabels[key];

        if (feMods === undefined) {
            issues.push(`[${key}] Faltando no frontend PRODUCT_PIPELINES`);
            continue;
        }
        if (beMods === undefined) {
            issues.push(`[${key}] Faltando no backend PRODUCT_REGISTRY`);
            continue;
        }

        const missingInBackend = feMods.filter(m => !beMods.includes(m));
        if (missingInBackend.length) {
            issues.push(`[${key}] Módulos do frontend faltando no backend: ${missingInBackend.join(', ')}`);
        }

        if (feLabel !== beLabel) {
            issues.push(`[${key}] Label mismatch: frontend="${feLabel}" backend="${beLabel}"`);
        }
    }

    if (issues.length === 0) {
        console.log('✅ Auditoria passou: todos os 11 produtos estão alinhados frontend/backend.');
    } else {
        console.log(`❌ ${issues.length} issues encontradas:`);
        issues.forEach(i => console.log('  - ' + i));
        process.exit(1);
    }
}

runAudit();
