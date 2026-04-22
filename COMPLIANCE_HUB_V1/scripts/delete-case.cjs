/**
 * delete-case.cjs
 * Exclui permanentemente um caso do Firestore (documento + subcoleções).
 * Usage: node scripts/delete-case.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const CASE_ID = 'o70PElyraor9PXdDrKoX';
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
const CASE_DOC_PATH = `projects/${PROJECT_ID}/databases/(default)/documents/cases/${CASE_ID}`;
const CASE_COLLECTIONS_PATH = `projects/${PROJECT_ID}/databases/(default)/documents/cases/${CASE_ID}:listCollectionIds`;

async function listSubcollections(token) {
    const body = JSON.stringify({});
    const res = await httpsRequest({
        hostname: BASE_HOST,
        path: `/v1/${CASE_DOC_PATH}:listCollectionIds`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    if (res.status === 404) return [];
    if (res.status !== 200) return [];
    return res.body.collectionIds || [];
}

async function listDocsInCollection(token, collectionPath) {
    const res = await httpsRequest({
        hostname: BASE_HOST,
        path: `/v1/${collectionPath}?pageSize=300`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.status !== 200) return [];
    return (res.body.documents || []).map(d => d.name);
}

async function deleteDoc(token, docPath) {
    const res = await httpsRequest({
        hostname: BASE_HOST,
        path: `/v1/${docPath}`,
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    return res.status;
}

async function main() {
    console.log('=== Delete Case ===');
    console.log(`Case ID: ${CASE_ID}\n`);

    const token = await getAccessToken();
    console.log('Token OK.\n');

    // 1. Verificar que o caso existe e mostrar nome
    const getRes = await httpsRequest({
        hostname: BASE_HOST,
        path: `/v1/${CASE_DOC_PATH}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (getRes.status === 404) {
        console.log('Caso não encontrado. Nada a excluir.');
        process.exit(0);
    }
    if (getRes.status !== 200) {
        console.error('Erro ao ler caso:', getRes.body);
        process.exit(1);
    }
    const fields = getRes.body.fields || {};
    const name = fields.candidateName?.stringValue || '(sem nome)';
    const cpf = fields.cpfMasked?.stringValue || fields.cpf?.stringValue || '(sem cpf)';
    console.log(`Candidato: ${name} | CPF: ${cpf}`);

    // 2. Excluir subcoleções
    const subcollections = await listSubcollections(token);
    if (subcollections.length > 0) {
        console.log(`\nSubcoleções encontradas: ${subcollections.join(', ')}`);
        for (const colId of subcollections) {
            const colPath = `projects/${PROJECT_ID}/databases/(default)/documents/cases/${CASE_ID}/${colId}`;
            const docs = await listDocsInCollection(token, colPath);
            for (const docName of docs) {
                const status = await deleteDoc(token, docName);
                console.log(`  Deletado sub-doc: ${docName.split('/').pop()} (HTTP ${status})`);
            }
        }
    } else {
        console.log('Sem subcoleções.');
    }

    // 3. Excluir o documento principal
    console.log('\nExcluindo documento principal...');
    const delStatus = await deleteDoc(token, CASE_DOC_PATH);
    if (delStatus !== 200) {
        console.error(`Falha na exclusão (HTTP ${delStatus})`);
        process.exit(1);
    }

    console.log(`\n✅ Caso "${name}" (${CASE_ID}) excluído com sucesso.`);
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
