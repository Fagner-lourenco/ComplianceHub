const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');
const lines = content.split('\n');

let start = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('async function runStructuredAiAnalysis')) {
        start = i;
        break;
    }
}

let depth = 0, started = false, end = start;
for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) {
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') depth--;
    }
    if (started && depth <= 0) { end = i; break; }
}

console.log('Removed lines', start+1, '-', end+1);
const before = lines.slice(0, start).join('\n');
const after = lines.slice(end+1).join('\n');
const replacement = "const { runStructuredAiAnalysis } = require('./services/aiService');\n";
content = before + '\n' + replacement + '\n' + after;
fs.writeFileSync('index.js', content, 'utf8');
console.log('New line count:', content.split('\n').length);
