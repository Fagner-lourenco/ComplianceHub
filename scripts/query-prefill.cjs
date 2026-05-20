const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const CASES = [
    { id: '70KYcYKZYP255vwJ0fVk', n: 'Matheus' },
    { id: '90LHMip0ewLm7c6qFX0c', n: 'Diego' },
    { id: 'D2t01zp1Z7jufd5JjzA6', n: 'Andre' },
    { id: 'RNNJO5BC2nhgjXu7nQTe', n: 'Renan' },
    { id: 's3lT7jAvzooRxJGGyTk2', n: 'Fran/madero' },
    { id: 'qurTsbgGlss6XGFOslZp', n: 'Fran/tech' },
];

const CID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function httpsReq(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getToken() {
    const cfgPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    const postData = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cfg.tokens.refresh_token,
        client_id: CID,
        client_secret: CS,
    }).toString();
    const res = await httpsReq({
        hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    }, postData);
    return res.access_token;
}

function deep(v) {
    if (!v) return null;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.nullValue !== undefined) return null;
    if (v.arrayValue) return (v.arrayValue.values || []).map(deep);
    if (v.mapValue) {
        const o = {};
        for (const [k, vv] of Object.entries(v.mapValue.fields || {})) o[k] = deep(vv);
        return o;
    }
    return null;
}

async function main() {
    const token = await getToken();
    const FIELDS = ['candidateName', 'prefillNarratives', 'deterministicPrefill'];

    for (const c of CASES) {
        const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/cases/${c.id}`;
        const maskParams = FIELDS.map(f => `mask.fieldPaths=${f}`).join('&');
        const res = await httpsReq({
            hostname: 'firestore.googleapis.com',
            path: `/v1/${docPath}?${maskParams}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        const f = res.fields || {};
        const name = deep(f.candidateName);
        const pn = deep(f.prefillNarratives) || {};
        const dp = deep(f.deterministicPrefill) || {};

        console.log('');
        console.log(`========== ${c.n} (${name}) ==========`);

        // Show the 6 report narrative fields
        const NARRATIVE_KEYS = ['executiveSummary', 'criminalNotes', 'warrantNotes', 'laborNotes', 'finalJustification'];
        for (const k of NARRATIVE_KEYS) {
            const val = pn[k] || dp[k] || '(vazio)';
            console.log(`[${k}]:`);
            console.log(val);
            console.log('');
        }

        // keyFindings
        const kf = pn.keyFindings || dp.keyFindings || [];
        if (kf.length) {
            console.log('[keyFindings]:');
            kf.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));
            console.log('');
        }

        // metadata
        const meta = pn.metadata || dp.metadata || {};
        if (meta.source) {
            console.log(`[metadata]: source=${meta.source} version=${meta.deterministicVersion || meta.version || '?'}`);
        }
    }
}

main().catch(console.error);
