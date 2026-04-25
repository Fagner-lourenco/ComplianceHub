const fs = require('fs');
const path = require('path');
const https = require('https');

const PID = 'compliance-hub-br';
const CASES = [
    { id: '70KYcYKZYP255vwJ0fVk', name: 'Matheus' },
    { id: '90LHMip0ewLm7c6qFX0c', name: 'Diego' },
    { id: 'D2t01zp1Z7jufd5JjzA6', name: 'Andre' },
    { id: 'RNNJO5BC2nhgjXu7nQTe', name: 'Renan' },
    { id: 's3lT7jAvzooRxJGGyTk2', name: 'FranMadero' },
    { id: 'qurTsbgGlss6XGFOslZp', name: 'FranTech' },
];

const FIELDS = [
    'criminalFlag', 'criminalSeverity', 'criminalEvidenceQuality',
    'warrantFlag', 'laborFlag', 'finalVerdict',
    'djenCriminalFlag', 'djenCriminalCount', 'djenLaborFlag',
    'bigdatacorpCriminalFlag', 'bigdatacorpLaborFlag', 'bigdatacorpNamesakeCount',
    'bigdatacorpProcessTotal', 'escavadorCriminalCount', 'escavadorProcessTotal',
    'juditCriminalCount', 'juditProcessTotal',
    'pepFlag', 'sanctionFlag',
];

function httpsReq(opts, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(opts, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function fromFV(val) {
    if (!val) return undefined;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return Number(val.integerValue);
    if (val.doubleValue !== undefined) return val.doubleValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.nullValue !== undefined) return null;
    return JSON.stringify(val);
}

async function main() {
    const cfgPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    const tokenRes = await httpsReq({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cfg.tokens.refresh_token,
        client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
        client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    }).toString());
    const token = tokenRes.access_token;

    for (const c of CASES) {
        const docPath = `projects/${PID}/databases/(default)/documents/cases/${c.id}`;
        const mask = FIELDS.map(f => `mask.fieldPaths=${f}`).join('&');
        const res = await httpsReq({
            hostname: 'firestore.googleapis.com',
            path: `/v1/${docPath}?${mask}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const fields = res.fields || {};
        const vals = {};
        for (const [k, v] of Object.entries(fields)) {
            vals[k] = fromFV(v);
        }
        console.log(`\n=== ${c.name} (${c.id}) ===`);
        for (const f of FIELDS) {
            const v = vals[f];
            if (v !== undefined) console.log(`  ${f}: ${JSON.stringify(v)}`);
        }
        // Check fields that DON'T exist
        const missing = FIELDS.filter(f => vals[f] === undefined);
        if (missing.length > 0) console.log(`  [missing]: ${missing.join(', ')}`);
    }
}

main().catch(e => console.error(e));
