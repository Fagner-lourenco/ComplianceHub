const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/portals/ops/CasoPage.test.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let inCallback = false;
let braceDepth = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('callback({')) {
        inCallback = true;
        braceDepth = 1;
        continue;
    }
    if (inCallback) {
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        braceDepth += openBraces - closeBraces;
        if (braceDepth === 0) {
            inCallback = false;
        }
        if (line.includes("status: '") && !lines.slice(i, Math.min(i+5, lines.length)).some(l => l.includes('productKey'))) {
            const indent = line.match(/^(\s*)/)[1];
            lines.splice(i+1, 0, indent + "productKey: 'dossier_pf_basic',");
            i++;
        }
    }
}

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Fixed CasoPage.test.jsx');
