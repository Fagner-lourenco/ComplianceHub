const fs = require('fs');
const path = require('path');
const text = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');

const exportedFuncs = [];
// Match exports.X = onDocumentUpdated({...}, async (event) => { ... })
// or exports.X = onCall(..., async (req) => { ... })
const exportRe = /exports\.(\w+)\s*=\s*\w+\(/g;
let m;
while ((m = exportRe.exec(text)) !== null) {
  const name = m[1];
  const startIdx = m.index;
  let parenDepth = 0;
  let braceDepth = 0;
  let inString = false;
  let stringChar = null;
  let i = startIdx;
  let foundFirstBrace = false;

  while (i < text.length) {
    const ch = text[i];
    if (!inString) {
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true;
        stringChar = ch;
      } else if (ch === '(') {
        parenDepth++;
      } else if (ch === ')') {
        parenDepth--;
      } else if (ch === '{') {
        braceDepth++;
        foundFirstBrace = true;
      } else if (ch === '}') {
        braceDepth--;
        if (foundFirstBrace && braceDepth === 0 && parenDepth === 0) {
          const body = text.slice(startIdx, i + 1);
          const bodyLines = body.split('\n').length;
          exportedFuncs.push({name, lines: bodyLines});
          break;
        }
      }
    } else {
      if (ch === stringChar && text[i-1] !== '\\') {
        inString = false;
        stringChar = null;
      }
    }
    i++;
  }
}

exportedFuncs.sort((a,b) => b.lines - a.lines);
console.log('=== EXPORTED FUNCTIONS BY SIZE ===');
exportedFuncs.forEach(e => console.log(e.lines.toString().padStart(4) + ' lines | ' + e.name));
console.log('\n=== SUMMARY ===');
console.log('Total exports: ' + exportedFuncs.length);
console.log('> 500 lines: ' + exportedFuncs.filter(e => e.lines > 500).length);
console.log('> 300 lines: ' + exportedFuncs.filter(e => e.lines > 300).length);
console.log('> 200 lines: ' + exportedFuncs.filter(e => e.lines > 200).length);
console.log('> 100 lines: ' + exportedFuncs.filter(e => e.lines > 100).length);
