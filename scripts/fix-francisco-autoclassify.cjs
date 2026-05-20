/**
 * fix-francisco-autoclassify.cjs
 * Re-aplica classificacao automatica de mandado para o caso de Francisco.
 * Usa Firestore REST API (mesmo padrao do fix-francisco-warrant.cjs).
 * Usage: node scripts/fix-francisco-autoclassify.cjs
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

function toFV(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(toFV) } };
    if (typeof val === 'object') {
        const fields = {};
        for (const [k, v] of Object.entries(val)) fields[k] = toFV(v);
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

function fromFV(val) {
    if (!val) return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return parseInt(val.integerValue);
    if (val.doubleValue !== undefined) return val.doubleValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.timestampValue !== undefined) return val.timestampValue;
    if (val.nullValue !== undefined) return null;
    if (val.arrayValue) return (val.arrayValue.values || []).map(fromFV);
    if (val.mapValue) {
        const obj = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = fromFV(v);
        return obj;
    }
    return null;
}

const BASE_HOST = 'firestore.googleapis.com';
const DOC_PATH = 'projects/' + PROJECT_ID + '/databases/(default)/documents/cases/' + CASE_ID;

async function main() {
    console.log('=== Fix Francisco Auto-Classify ===\n');
    const token = await getAccessToken();
    console.log('Token OK. Lendo caso...');

    const getRes = await httpsRequest({
        hostname: BASE_HOST,
        path: '/v1/' + DOC_PATH,
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token },
    });
    if (getRes.status !== 200) { console.error('Erro ao ler caso:', getRes.body); process.exit(1); }

    const fields = getRes.body.fields || {};
    const juditWarrantFlag = fromFV(fields.juditWarrantFlag);
    const juditActiveWarrantCount = fromFV(fields.juditActiveWarrantCount) || 0;
    const juditWarrantCount = fromFV(fields.juditWarrantCount) || 0;
    const juditWarrantNotes = fromFV(fields.juditWarrantNotes) || '';
    const fontedataWarrantFlag = fromFV(fields.fontedataWarrantFlag);
    const juditEnrichmentStatus = fromFV(fields.juditEnrichmentStatus);
    const enrichmentSourcesWarrantError = (fromFV(fields.enrichmentSources) || {}).warrant?.error || null;
    const juditSourcesWarrantError = (fromFV(fields.juditSources) || {}).warrant?.error || null;
    const existingEOV = fromFV(fields.enrichmentOriginalValues) || {};

    console.log('Estado atual:');
    console.log('  juditWarrantFlag:', juditWarrantFlag, '| active:', juditActiveWarrantCount);
    console.log('  warrantFlag:', fromFV(fields.warrantFlag));
    console.log('  enrichmentOriginalValues.warrantFlag:', existingEOV.warrantFlag);
    console.log();

    const isPositive = juditWarrantFlag === 'POSITIVE' || fontedataWarrantFlag === 'POSITIVE';
    const isInconclusive = juditWarrantFlag === 'INCONCLUSIVE';
    const isFailed = (juditEnrichmentStatus === 'FAILED' && juditSourcesWarrantError) || !!enrichmentSourcesWarrantError;

    let newFlag, noteParts = [];
    if (isPositive) {
        newFlag = 'POSITIVE';
        const parts = [];
        if (juditActiveWarrantCount > 0) parts.push(juditActiveWarrantCount + ' mandado(s) ativo(s) via Judit');
        if (fontedataWarrantFlag === 'POSITIVE') parts.push('detectado via FonteData');
        noteParts.push('Mandado POSITIVO: ' + parts.join(', ') + '.');
        if (juditWarrantNotes) noteParts.push(juditWarrantNotes);
    } else if (isInconclusive) {
        newFlag = 'INCONCLUSIVE';
        noteParts.push('Mandado INCONCLUSIVO: ' + juditWarrantCount + ' mandado(s) encontrado(s), mas nenhum com status pendente.');
        if (juditWarrantNotes) noteParts.push(juditWarrantNotes);
    } else if (isFailed) {
        newFlag = 'NOT_FOUND';
        noteParts.push('Mandado NAO ENCONTRADO: consulta Judit falhou.');
    } else {
        newFlag = 'NEGATIVE';
        noteParts.push('Nenhum mandado de prisao encontrado.');
    }
    const newNotes = noteParts.join('\n');

    console.log('Novos valores:');
    console.log('  warrantFlag:', newFlag);
    console.log('  warrantNotes:', newNotes);
    console.log();

    const newEOV = Object.assign({}, existingEOV, { warrantFlag: newFlag, warrantNotes: newNotes });
    const updateFields = {
        warrantFlag: toFV(newFlag),
        warrantNotes: toFV(newNotes),
        enrichmentOriginalValues: toFV(newEOV),
        updatedAt: { timestampValue: new Date().toISOString() },
    };
    const updateMask = Object.keys(updateFields).map(f => 'updateMask.fieldPaths=' + f).join('&');
    const body = JSON.stringify({ fields: updateFields });

    const patchRes = await httpsRequest({
        hostname: BASE_HOST,
        path: '/v1/' + DOC_PATH + '?' + updateMask,
        method: 'PATCH',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);

    if (patchRes.status !== 200) { console.error('Patch falhou:', JSON.stringify(patchRes.body, null, 2)); process.exit(1); }

    console.log('SUCESSO!');
    console.log('  warrantFlag =', newFlag);
    console.log('  warrantNotes =', newNotes);
    console.log('  enrichmentOriginalValues.warrantFlag =', newFlag);
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
