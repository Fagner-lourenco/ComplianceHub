const fs = require('fs');
const path = require('path');

function findJsFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
            files.push(...findJsFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.test.js'))) {
            files.push(fullPath);
        }
    }
    return files;
}

function findCjsFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
            files.push(...findCjsFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.cjs')) {
            files.push(fullPath);
        }
    }
    return files;
}

// Step 1: Rename .cjs files to .js
const cjsFiles = findCjsFiles('.');
const renameMap = new Map();
for (const cjsFile of cjsFiles) {
    const jsFile = cjsFile.replace(/\.cjs$/, '.js');
    fs.renameSync(cjsFile, jsFile);
    renameMap.set(path.basename(cjsFile), path.basename(jsFile));
    console.log('Renamed:', path.basename(cjsFile), '->', path.basename(jsFile));
}

// Step 2: Update imports in all .js files
const jsFiles = findJsFiles('.');
let updatedCount = 0;
for (const jsFile of jsFiles) {
    let content = fs.readFileSync(jsFile, 'utf8');
    const original = content;
    // Replace require('.../something.js') with require('.../something.js')
    // Use a regex that preserves the path structure
    content = content.replace(/require\(['"](.+?)\.cjs['"]\)/g, "require('$1.js')");
    if (content !== original) {
        fs.writeFileSync(jsFile, content, 'utf8');
        updatedCount++;
        console.log('Updated imports:', jsFile);
    }
}

console.log('\nDone. Renamed', cjsFiles.length, 'files. Updated', updatedCount, 'files.');
