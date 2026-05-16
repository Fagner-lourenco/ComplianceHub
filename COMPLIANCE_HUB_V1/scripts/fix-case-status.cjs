/**
 * Script simples para atualizar o status do caso PauZPeOeg4ZkEYILcWZS
 * de PENDING para IN_PROGRESS via Firestore REST API.
 * Uso: node scripts/fix-case-status.cjs
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const CASE_ID = 'PauZPeOeg4ZkEYILcWZS';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const BASE = 'firestore.googleapis.com';

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
        hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    }, postData);
    if (res.status !== 200) throw new Error('Token refresh failed');
    return res.body.access_token;
}

function toFirestoreValue(v) {
    if (v === null || v === undefined) return { nullValue: 'NULL_VALUE' };
    if (typeof v === 'string') return { stringValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
    if (typeof v === 'object') {
        const fields = {};
        for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val);
        return { mapValue: { fields } };
    }
    return { stringValue: String(v) };
}

async function patchDocument(token, docPath, fieldsObj) {
    const fields = {};
    const maskParts = [];
    for (const [k, v] of Object.entries(fieldsObj)) {
        fields[k] = toFirestoreValue(v);
        maskParts.push(`updateMask.fieldPaths=${encodeURIComponent(k)}`);
    }
    const body = JSON.stringify({ fields });
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}?${maskParts.join('&')}`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, body);
    if (res.status !== 200) throw new Error(`Patch failed (${res.status}): ${JSON.stringify(res.body)}`);
    return res.body;
}

async function getDocument(token, docPath) {
    const res = await httpsRequest({
        hostname: BASE,
        path: `/v1/${docPath}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) throw new Error(`Get failed (${res.status}): ${JSON.stringify(res.body)}`);
    return res.body;
}

function fromFirestoreValue(v) {
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.timestampValue !== undefined) return v.timestampValue;
    if (v.nullValue !== undefined) return null;
    if (v.arrayValue) return (v.arrayValue.values || []).map(fromFirestoreValue);
    if (v.mapValue) {
        const obj = {};
        for (const [k, val] of Object.entries(v.mapValue.fields || {})) {
            obj[k] = fromFirestoreValue(val);
        }
        return obj;
    }
    return v;
}

async function main() {
    const token = await getAccessToken();
    console.log('Token obtido.');

    const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/cases/${CASE_ID}`;

    // Ler estado atual
    const doc = await getDocument(token, docPath);
    const fields = doc.fields || {};
    const currentStatus = fromFirestoreValue(fields.status);
    const currentTenantId = fromFirestoreValue(fields.tenantId);

    console.log(`Status atual: ${currentStatus}`);
    console.log(`Tenant ID: ${currentTenantId}`);
    console.log('');

    if (currentStatus === 'IN_PROGRESS') {
        console.log('Caso ja esta IN_PROGRESS. Nada a fazer.');
        return;
    }

    if (currentStatus !== 'PENDING') {
        console.log(`Status atual (${currentStatus}) nao e PENDING. Deseja continuar mesmo assim?`);
        console.log('Use --force para forcar.');
        if (!process.argv.includes('--force')) return;
    }

    // Atualizar status
    const patch = {
        status: 'IN_PROGRESS',
        updatedAt: new Date(),
    };
    console.log('Atualizando status para IN_PROGRESS...');
    await patchDocument(token, docPath, patch);
    console.log('OK! Caso atualizado para IN_PROGRESS.');

    console.log('');
    console.log('Agora voce pode:');
    console.log('1. Recarregar a pagina do caso no portal OPS');
    console.log('2. Clicar em "Concluir caso"');
}
main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
