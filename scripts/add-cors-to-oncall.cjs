const fs = require('fs');
const path = 'D:/ComplianceHub/COMPLIANCE_HUB_V1/functions/index.js';
let content = fs.readFileSync(path, 'utf8');

// Find onCall( options objects without 'cors'
let i = 0;
const patches = [];

while (true) {
  const onCallIdx = content.indexOf('onCall(', i);
  if (onCallIdx === -1) break;

  // Find opening { of options
  let optsStart = content.indexOf('{', onCallIdx);
  if (optsStart === -1) { i = onCallIdx + 6; continue; }

  // Make sure options start is right after onCall( (within reasonable chars)
  const between = content.substring(onCallIdx + 7, optsStart).trim();
  if (between.length > 200) { i = onCallIdx + 6; continue; }
  // Must not be onRequest
  if (content.substring(onCallIdx - 10, onCallIdx).includes('onRequest')) { i = onCallIdx + 6; continue; }

  // Find matching closing } of options (simple brace counting)
  let depth = 0;
  let optsEnd = -1;
  for (let j = optsStart; j < content.length; j++) {
    if (content[j] === '{') depth++;
    else if (content[j] === '}') { depth--; if (depth === 0) { optsEnd = j; break; } }
  }
  if (optsEnd === -1) { i = onCallIdx + 6; continue; }

  const optsStr = content.substring(optsStart, optsEnd + 1);

  // Check if cors is already present
  if (/'cors'|"cors"|cors\s*:/.test(optsStr)) {
    i = optsEnd + 1;
    continue;
  }

  // Add cors: true before the closing }
  const newOpts = optsStr.slice(0, -1) + ', cors: true }';
  patches.push({ start: optsStart, end: optsEnd + 1, old: optsStr, new: newOpts });
  i = optsEnd + 1;
}

console.log('Found ' + patches.length + ' onCall functions without cors');

// Apply changes in reverse order to preserve offsets
for (const p of patches.reverse()) {
  content = content.substring(0, p.start) + p.new + content.substring(p.end);
}

fs.writeFileSync(path, content);
console.log('Done! ' + patches.length + ' functions updated.');
