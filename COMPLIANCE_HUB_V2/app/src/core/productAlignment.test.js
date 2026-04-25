import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = process.cwd();

function read(relativePath) {
    return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function extractObjectBlock(content, objectName) {
    const startIdx = content.indexOf(`const ${objectName}`);
    if (startIdx === -1) throw new Error(`${objectName} not found`);
    let depth = 0;
    for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') {
            depth--;
            if (depth === 0) return content.slice(startIdx, i + 1);
        }
    }
    return null;
}

function extractProductBlockFromObject(objectBlock, productKey) {
    const regex = new RegExp(`\\b${productKey}\\s*:\\s*\\{`);
    const match = regex.exec(objectBlock);
    if (!match) return null;
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < objectBlock.length && depth > 0) {
        if (objectBlock[i] === '{') depth++;
        else if (objectBlock[i] === '}') depth--;
        i++;
    }
    return objectBlock.slice(match.index, i);
}

function extractArrayFromBlock(block, propName) {
    const regex = new RegExp(`${propName}\\s*:\\s*\\[(.*?)\\]`);
    const match = block.match(regex);
    if (!match) return [];
    return match[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
}

function extractLabels(content, objectName) {
    const block = extractObjectBlock(content, objectName);
    if (!block) return {};
    const labels = {};
    const regex = /(\w+):\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = regex.exec(block)) !== null) labels[m[1]] = m[2];
    return labels;
}

describe('Product alignment frontend ↔ backend', () => {
    const pipelinesSrc = read('src/core/productPipelines.js');
    const registrySrc = read('functions/domain/v2Modules.js');
    const frontendLabelsSrc = read('src/core/productLabels.js');
    const backendLabelsSrc = read('functions/domain/v2Core.js');

    const pipelinesBlock = extractObjectBlock(pipelinesSrc, 'PRODUCT_PIPELINES');
    const registryBlock = extractObjectBlock(registrySrc, 'PRODUCT_REGISTRY');

    const productKeys = [
        'dossier_pf_basic',
        'dossier_pf_full',
        'dossier_pj',
        'kyc_individual',
        'kyb_business',
        'kye_employee',
        'kys_supplier',
        'tpr_third_party',
        'reputational_risk',
        'ongoing_monitoring',
        'report_secure',
    ];

    const frontendLabels = extractLabels(frontendLabelsSrc, 'PRODUCT_LABELS');
    const backendLabels = extractLabels(backendLabelsSrc, 'PRODUCT_LABELS');

    it.each(productKeys)('backend contains all frontend modules for %s', (key) => {
        const feBlock = extractProductBlockFromObject(pipelinesBlock, key);
        const beBlock = extractProductBlockFromObject(registryBlock, key);
        expect(feBlock).toBeTruthy();
        expect(beBlock).toBeTruthy();

        const feModules = extractArrayFromBlock(feBlock, 'modules');
        const beModules = [
            ...extractArrayFromBlock(beBlock, 'requiredModules'),
            ...extractArrayFromBlock(beBlock, 'optionalModules'),
        ];

        // Backend must support all frontend modules (frontend is the UX contract)
        for (const mod of feModules) {
            expect(beModules).toContain(mod);
        }
    });

    it.each(productKeys)('labels match for %s', (key) => {
        const feLabel = frontendLabels[key];
        const beLabel = backendLabels[key];
        // If backend has a label, it must match frontend
        if (beLabel !== undefined) {
            expect(feLabel).toBe(beLabel);
        }
    });

    it('frontend and backend have the same 11 products', () => {
        expect(productKeys).toHaveLength(11);
        for (const key of productKeys) {
            expect(extractProductBlockFromObject(pipelinesBlock, key)).toBeTruthy();
            expect(extractProductBlockFromObject(registryBlock, key)).toBeTruthy();
        }
    });
});
