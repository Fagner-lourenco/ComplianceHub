const fs = require('fs');
const lines = fs.readFileSync('functions/index.js', 'utf8').split('\n');

const funcs = [];
let name = null, start = 0, len = 0, depth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!name) {
    const m = line.match(/^(async\s+)?function\s+(\w+)/);
    if (m) { name = m[2]; start = i + 1; len = 1; depth = 0; }
    continue;
  }
  len++;
  for (let k = 0; k < line.length; k++) {
    const ch = line[k];
    if (ch === '{' || ch === '}') {
      const before = line.slice(0, k);
      const quotes = (before.match(/["\`']/g) || []).length;
      if (quotes % 2 === 0) {
        if (ch === '{') depth++;
        else depth--;
      }
    }
  }
  if (depth === 0 && len > 1) {
    funcs.push({ name, start, lines: len });
    name = null;
  }
}

funcs.sort((a, b) => b.lines - a.lines);
console.log('\n=== TOP 30 LONGEST FUNCTIONS ===');
funcs.slice(0, 30).forEach(f => {
  console.log(f.lines.toString().padStart(4) + ' lines | ' + f.name);
});

console.log('\n=== FUNCTIONS > 200 LINES ===');
funcs.filter(f => f.lines > 200).forEach(f => {
  console.log(f.lines.toString().padStart(4) + ' lines | ' + f.name);
});

console.log('\n=== FUNCTIONS > 100 LINES ===');
funcs.filter(f => f.lines > 100 && f.lines <= 200).forEach(f => {
  console.log(f.lines.toString().padStart(4) + ' lines | ' + f.name);
});

console.log('\n=== SUMMARY ===');
console.log('Total functions: ' + funcs.length);
console.log('> 200 lines: ' + funcs.filter(f => f.lines > 200).length);
console.log('> 100 lines: ' + funcs.filter(f => f.lines > 100).length);
console.log('> 50 lines: ' + funcs.filter(f => f.lines > 50).length);
console.log('Total lines in index.js: ' + lines.length);
