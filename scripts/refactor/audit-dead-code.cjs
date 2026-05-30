const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', '..', 'functions', 'index.js');
const content = fs.readFileSync(indexPath, 'utf8');

// Find all function declarations
const functionMatches = content.matchAll(/function\s+(\w+)\s*\(/g);
const functions = [];
for (const match of functionMatches) {
    functions.push(match[1]);
}

console.log('Total functions found:', functions.length);

// Check which functions might be unused (only defined, never called)
const potentiallyUnused = [];
functions.forEach(fn => {
    // Escape special regex characters
    const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\b' + escaped + '\\s*\\(', 'g');
    const calls = content.match(regex);
    if (!calls || calls.length === 1) {
        potentiallyUnused.push(fn);
    }
});

console.log('\nPotentially unused functions (' + potentiallyUnused.length + '):');
potentiallyUnused.slice(0, 30).forEach(fn => console.log('  - ' + fn));

if (potentiallyUnused.length > 30) {
    console.log('  ... and ' + (potentiallyUnused.length - 30) + ' more');
}

// Also check exports
const exportMatches = content.matchAll(/exports\.(\w+)\s*=/g);
const exports_ = [];
for (const match of exportMatches) {
    exports_.push(match[1]);
}
console.log('\nTotal exports found:', exports_.length);
