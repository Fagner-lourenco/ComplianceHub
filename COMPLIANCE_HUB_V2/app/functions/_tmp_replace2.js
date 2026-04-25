const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');
const lines = content.split('\n');

let start = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Generate a hash key for AI cache')) {
        let j = i - 1;
        while (j > 0 && (lines[j].trim() === '' || lines[j].includes('*') || lines[j].includes('/'))) j--;
        start = j + 1;
        break;
    }
}

let end = -1;
let inFunc = false;
let depth = 0;
for (let i = start; i < lines.length; i++) {
    if (lines[i].startsWith('function computeAiCacheKey')) {
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

console.log('Start', start+1, 'End', end);
const before = lines.slice(0, start).join('\n');
const after = lines.slice(end).join('\n');
const replacement = "const { computeSimpleHash, computeAiCacheKey } = require('./services/aiCache');\n";
content = before + '\n' + replacement + '\n' + after;
fs.writeFileSync('index.js', content, 'utf8');
console.log('Done. Lines:', content.split('\n').length);
