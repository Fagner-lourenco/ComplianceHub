/**
 * read-report-html.cjs
 * Reads the HTML content from a publicReport document and saves to file.
 * Usage: node scripts/read-report-html.cjs <reportToken>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const TOKEN_ID = process.argv[2] || '4CO7nMGxiqxKsOySsUEI';

const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function httpsRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getAccessToken() {
    const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const refreshToken = config.tokens.refresh_token;
    const postData = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: FIREBASE_CLI_CLIENT_ID,
        client_secret: FIREBASE_CLI_CLIENT_SECRET,
    }).toString();
    const res = await httpsRequest({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    }, postData);
    if (res.status !== 200) throw new Error('Token refresh failed: ' + JSON.stringify(res.body));
    return res.body.access_token;
}

async function main() {
    const token = await getAccessToken();
    const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/publicReports/${TOKEN_ID}`;
    
    const res = await httpsRequest({
        hostname: 'firestore.googleapis.com',
        path: `/v1/${docPath}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status !== 200) {
        console.error(`Failed to read report (HTTP ${res.status}):`, res.body);
        process.exit(1);
    }

    const fields = res.body.fields || {};
    
    // Show metadata
    console.log('=== Report Metadata ===');
    for (const [k, v] of Object.entries(fields)) {
        if (k === 'html') {
            const htmlVal = v.stringValue || '';
            console.log(`html: ${htmlVal.length} chars`);
        } else {
            const val = v.stringValue || v.booleanValue || v.timestampValue || JSON.stringify(v);
            console.log(`${k}: ${val}`);
        }
    }

    // Save HTML to file
    const html = fields.html?.stringValue || '';
    if (html) {
        const outPath = path.join(__dirname, '..', 'results', `report-${TOKEN_ID}.html`);
        fs.writeFileSync(outPath, html, 'utf-8');
        console.log(`\n✅ HTML saved to ${outPath} (${html.length} chars)`);
    } else {
        console.log('\n⚠️  No HTML content in report.');
    }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
