/**
 * reactivate-reports.cjs
 * Reativa todos os publicReports: active=true, expiresAt=hoje+15 dias.
 * Também sincroniza publicReportToken nos cases correspondentes.
 * Usage: node scripts/reactivate-reports.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const TTL_DAYS = 15;
const EXPIRES_AT = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

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

const BASE_HOST = 'firestore.googleapis.com';
const BASE_PATH = `projects/${PROJECT_ID}/databases/(default)/documents`;

async function listDocuments(token, collection) {
    const docs = [];
    let pageToken = '';
    do {
        const qs = pageToken ? `?pageToken=${pageToken}&pageSize=100` : '?pageSize=100';
        const res = await httpsRequest({
            hostname: BASE_HOST,
            path: `/v1/${BASE_PATH}/${collection}${qs}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status !== 200) throw new Error(`List ${collection} failed: ${JSON.stringify(res.body)}`);
        if (res.body.documents) docs.push(...res.body.documents);
        pageToken = res.body.nextPageToken || '';
    } while (pageToken);
    return docs;
}

async function patchDocument(token, docPath, fields, updateMask) {
    const maskQs = updateMask.map(f => `updateMask.fieldPaths=${f}`).join('&');
    const body = JSON.stringify({ fields });
    const res = await httpsRequest({
        hostname: BASE_HOST,
        path: `/v1/${docPath}?${maskQs}`,
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    if (res.status !== 200) throw new Error(`Patch ${docPath} failed: ${JSON.stringify(res.body)}`);
    return res.body;
}

function getStringValue(field) {
    if (!field) return null;
    return field.stringValue || null;
}

async function main() {
    console.log(`\n🔄 Reativando publicReports — expiresAt: ${EXPIRES_AT.toISOString()} (${TTL_DAYS} dias)\n`);

    const token = await getAccessToken();
    console.log('✅ Token obtido.\n');

    // 1. List all publicReports
    const reports = await listDocuments(token, 'publicReports');
    console.log(`📄 ${reports.length} publicReports encontrados.\n`);

    if (reports.length === 0) {
        console.log('Nenhum relatório para atualizar.');
        return;
    }

    const expiresAtValue = { timestampValue: EXPIRES_AT.toISOString() };

    // 2. Update each report: active=true, expiresAt=new date
    for (const doc of reports) {
        const docName = doc.name; // full path
        const docId = docName.split('/').pop();
        const caseId = getStringValue(doc.fields?.caseId);
        const candidate = getStringValue(doc.fields?.candidateName) || '(sem nome)';

        console.log(`  📝 ${docId} — caso: ${caseId || '(sem caso)'} — ${candidate}`);

        await patchDocument(token, docName, {
            active: { booleanValue: true },
            expiresAt: expiresAtValue,
        }, ['active', 'expiresAt']);

        console.log(`     ✅ active=true, expiresAt=${EXPIRES_AT.toISOString()}`);

        // 3. If linked to a case, ensure case.publicReportToken points to this report
        if (caseId) {
            const casePath = `${BASE_PATH}/cases/${caseId}`;
            try {
                await patchDocument(token, casePath, {
                    publicReportToken: { stringValue: docId },
                }, ['publicReportToken']);
                console.log(`     🔗 case.publicReportToken = ${docId}`);
            } catch (err) {
                console.log(`     ⚠️  Falha ao atualizar case ${caseId}: ${err.message}`);
            }
        }
    }

    console.log(`\n✅ Concluído: ${reports.length} relatórios reativados.\n`);
    console.log('🔗 Links públicos:');
    for (const doc of reports) {
        const docId = doc.name.split('/').pop();
        console.log(`   https://compliance-hub-hazel.vercel.app/r/${docId}`);
    }
    console.log('');
}

main().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
