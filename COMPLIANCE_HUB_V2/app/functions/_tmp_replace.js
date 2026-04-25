const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');
const lines = content.split('\n');

let start = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const DEFAULT_ENRICHMENT_CONFIG = {')) {
        let j = i;
        while (j > 0 && (lines[j-1].trim() === '' || lines[j-1].includes('====') || lines[j-1].includes('*'))) j--;
        start = j;
        break;
    }
}

let end = -1;
let inFunc = false;
let depth = 0;
for (let i = start; i < lines.length; i++) {
    if (lines[i].startsWith('async function registerJuditWebhookRequest')) {
        inFunc = true;
        depth = 0;
    }
    if (inFunc) {
        for (const ch of lines[i]) {
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
        }
        if (depth <= 0) {
            end = i + 1;
            break;
        }
    }
}

console.log('Start line:', start + 1, 'End line:', end);

const replacement = `const {
    DEFAULT_ENRICHMENT_CONFIG,
    DEFAULT_ESCAVADOR_CONFIG,
    DEFAULT_JUDIT_CONFIG,
    DEFAULT_BIGDATACORP_CONFIG,
    DEFAULT_DJEN_CONFIG,
    DEFAULT_ANALYSIS_CONFIG,
    getTenantSettingsData,
    getTenantEntitlementsData,
    loadFonteDataConfig,
    loadEscavadorConfig,
    loadJuditConfig,
    loadBigDataCorpConfig,
    loadDjenConfig,
    buildJuditCallbackUrl,
    registerJuditWebhookRequest,
} = require('./services/configLoader');
`;

const before = lines.slice(0, start).join('\n');
const after = lines.slice(end).join('\n');
content = before + '\n' + replacement + '\n' + after;
fs.writeFileSync('index.js', content, 'utf8');
console.log('Removed lines ' + (start+1) + '-' + end + ', added import. New line count:', content.split('\n').length);
