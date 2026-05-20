/**
 * patch-madero-cases.cjs
 * Preenche campos faltantes nos 5 casos Madero com base no relatório consolidado.
 * Também vincula publicReports órfãos aos seus cases e cria publicResult/latest.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const BASE = 'firestore.googleapis.com';
const BASE_PATH = `projects/${PROJECT_ID}/databases/(default)/documents`;

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
    if (res.status !== 200) throw new Error(`Patch ${docPath} failed (${res.status}): ${JSON.stringify(res.body)}`);
    return res.body;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Data extracted from consolidated report
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CONCLUDED_AT = '2026-03-30T19:21:48.752Z'; // from report createdAt

const CASES = [
    {
        id: 's3lT7jAvzooRxJGGyTk2',
        name: 'FRANCISCO TACIANO DE SOUSA',
        // Already has token aipIvywg5E5L2XxEVOOK
        orphanReportToken: null,
        patch: {
            concludedAt: new Date(CONCLUDED_AT),
            updatedAt: new Date(CONCLUDED_AT),
            enabledPhases: ['criminal', 'labor', 'warrant'],
            executiveSummary: 'Candidato com múltiplos registros criminais confirmados (6 processos penais e 3 procedimentos), incluindo violência doméstica, contravenções penais e porte de arma branca. Mandado de prisão pendente de cumprimento. Sem histórico trabalhista.',
            keyFindings: [
                'Mandado de prisão pendente nº 204723-54.2022.8.06.0167.01.0003-26',
                '6 processos criminais confirmados incluindo violência doméstica',
                'Procedimentos por art. 140 CP, art. 147 CP, Lei Maria da Penha',
                'Sem processos trabalhistas'
            ],
        }
    },
    {
        id: '70KYcYKZYP255vwJ0fVk',
        name: 'MATHEUS GONCALVES DOS SANTOS',
        orphanReportToken: '6wDysLMHpOsuU8HCyTzq',
        patch: {
            concludedAt: new Date(CONCLUDED_AT),
            updatedAt: new Date(CONCLUDED_AT),
            publicReportToken: '6wDysLMHpOsuU8HCyTzq',
            enabledPhases: ['criminal', 'labor', 'warrant'],
            executiveSummary: 'Registro criminal confirmado por art. 129 (violência doméstica) no Estado de São Paulo. Histórico trabalhista com múltiplos vínculos formais e processos compatíveis. Sem mandados de prisão pendentes.',
            keyFindings: [
                'Registro criminal confirmado: art. 129, violência doméstica (SP)',
                'Múltiplos vínculos formais: Madero, Striker SP, Jaguafrangos, Avenorte, LP Guizilim',
                'Processos trabalhistas compatíveis com perfil do candidato',
                'Sem mandados de prisão pendentes'
            ],
        }
    },
    {
        id: 'RNNJO5BC2nhgjXu7nQTe',
        name: 'RENAN GUIMARAES DE SOUSA AUGUSTO',
        orphanReportToken: 'fzR7cYSs5Rp96frP0FgY',
        patch: {
            concludedAt: new Date(CONCLUDED_AT),
            updatedAt: new Date(CONCLUDED_AT),
            publicReportToken: 'fzR7cYSs5Rp96frP0FgY',
            enabledPhases: ['criminal', 'labor', 'warrant'],
            executiveSummary: 'Anotação criminal de elevada gravidade: art. 121 §2º VI c/c art. 14 II do CP (Lei Maria da Penha). Processo trabalhista identificado nº 0101976-21.2016.5.01.0007. Sem mandados de prisão pendentes.',
            keyFindings: [
                'Anotação criminal grave: art. 121 §2º VI c/c art. 14 II CP (tentativa de homicídio qualificado)',
                'Contexto de Lei Maria da Penha (nº 11.340/2006)',
                'Processo trabalhista nº 0101976-21.2016.5.01.0007 (salário/diferença salarial)',
                'Sem mandados de prisão pendentes'
            ],
        }
    },
    {
        id: '90LHMip0ewLm7c6qFX0c',
        name: 'DIEGO EMANUEL ALVES DE SOUZA',
        orphanReportToken: 'lKwb4BZNoQFsHr1ZyxxM',
        patch: {
            concludedAt: new Date(CONCLUDED_AT),
            updatedAt: new Date(CONCLUDED_AT),
            publicReportToken: 'lKwb4BZNoQFsHr1ZyxxM',
            enabledPhases: ['criminal', 'labor', 'warrant'],
            executiveSummary: 'Nenhuma restrição identificada. Sem anotações criminais, processos trabalhistas ou mandados de prisão.',
            keyFindings: [
                'Sem anotações criminais',
                'Sem processos trabalhistas',
                'Sem mandados de prisão'
            ],
        }
    },
    {
        id: 'D2t01zp1Z7jufd5JjzA6',
        name: 'ANDRE LUIZ CRUZ DOS SANTOS',
        // Already has token 35TezdtCRX8R0ut1AVis
        orphanReportToken: null,
        patch: {
            concludedAt: new Date(CONCLUDED_AT),
            updatedAt: new Date(CONCLUDED_AT),
            enabledPhases: ['criminal', 'labor', 'warrant'],
            executiveSummary: 'Múltiplos registros criminais incluindo execução penal, violência doméstica e feitos criminais no TJSP. Condenação confirmada (arts. 129 §9º e 147 CP). Processos trabalhistas com baixa probabilidade de vinculação (homônimos na BA). Mandados de prisão já cumpridos.',
            keyFindings: [
                'Condenação penal confirmada: arts. 129 §9º e 147 CP (violência doméstica)',
                'Múltiplos processos criminais no TJSP incluindo execução penal',
                'Processo CNJ 1502667-52.2017.8.26.0562: suspenso (art. 366 CPP)',
                'Mandados de prisão já cumpridos, compatíveis com condenações'
            ],
        }
    },
];

// PUBLIC_RESULT_FIELDS — used for publicResult/latest subcollection
const PUBLIC_RESULT_IDENTITY = ['candidateName', 'cpfMasked', 'candidatePosition', 'hiringUf', 'tenantId', 'createdAt'];
const PUBLIC_RESULT_FIELDS = [
    'criminalFlag', 'criminalSeverity', 'criminalNotes',
    'laborFlag', 'laborSeverity', 'laborNotes',
    'warrantFlag', 'warrantNotes',
    'riskScore', 'riskLevel', 'finalVerdict',
    'analystComment', 'enabledPhases',
    'keyFindings', 'executiveSummary', 'publicReportToken',
];

function fromFirestoreValue(v) {
    if (!v) return undefined;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.timestampValue !== undefined) return v.timestampValue;
    if (v.nullValue !== undefined) return null;
    if (v.arrayValue) return (v.arrayValue.values || []).map(fromFirestoreValue);
    if (v.mapValue) {
        const obj = {};
        for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = fromFirestoreValue(val);
        return obj;
    }
    return undefined;
}

async function main() {
    console.log('\n🔧 Patching 5 Madero cases with report data...\n');
    const token = await getAccessToken();
    console.log('✅ Token obtained.\n');

    for (const c of CASES) {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📌 ${c.name} (${c.id})`);

        // 1. Patch the case document
        const casePath = `${BASE_PATH}/cases/${c.id}`;
        await patchDocument(token, casePath, c.patch);
        console.log(`   ✅ Case patched (${Object.keys(c.patch).length} fields)`);

        // 2. Link orphan publicReport to this case
        if (c.orphanReportToken) {
            const reportPath = `${BASE_PATH}/publicReports/${c.orphanReportToken}`;
            await patchDocument(token, reportPath, { caseId: c.id });
            console.log(`   🔗 publicReport ${c.orphanReportToken} → caseId=${c.id}`);
        }

        // 3. Read updated case and build publicResult/latest
        const getRes = await httpsRequest({
            hostname: BASE,
            path: `/v1/${casePath}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (getRes.status !== 200) {
            console.log(`   ⚠️  Failed to read case for publicResult: ${getRes.status}`);
            continue;
        }
        const caseFields = getRes.body.fields || {};
        const allFields = [...PUBLIC_RESULT_IDENTITY, ...PUBLIC_RESULT_FIELDS];
        const publicResultData = {};
        for (const field of allFields) {
            const val = fromFirestoreValue(caseFields[field]);
            if (val !== undefined && val !== null && val !== '') {
                publicResultData[field] = val;
            }
        }
        publicResultData.publishedAt = new Date(CONCLUDED_AT);
        publicResultData.concludedAt = new Date(CONCLUDED_AT);
        publicResultData.status = 'DONE';

        const prPath = `${BASE_PATH}/cases/${c.id}/publicResult/latest`;
        const prFields = {};
        const prMask = [];
        for (const [k, v] of Object.entries(publicResultData)) {
            prFields[k] = toFirestoreValue(v);
            prMask.push(`updateMask.fieldPaths=${encodeURIComponent(k)}`);
        }
        const prBody = JSON.stringify({ fields: prFields });
        const prRes = await httpsRequest({
            hostname: BASE,
            path: `/v1/${prPath}?${prMask.join('&')}`,
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(prBody) },
        }, prBody);
        if (prRes.status === 200) {
            console.log(`   📄 publicResult/latest created (${Object.keys(publicResultData).length} fields)`);
        } else {
            console.log(`   ⚠️  publicResult/latest failed: ${prRes.status}`);
        }

        console.log('');
    }

    console.log('✅ All 5 Madero cases patched successfully.\n');
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
