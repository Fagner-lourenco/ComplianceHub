/**
 * audit-madero-narratives.cjs
 *
 * Read-only consistency audit for Madero classifications and generated text fields.
 * Redacts identity fields and never writes to Firestore.
 *
 * Usage:
 *   node scripts/audit-madero-narratives.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const TENANT_ID = 'madero-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function httpsRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
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
    const postData = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: config.tokens.refresh_token,
        client_id: FIREBASE_CLI_CLIENT_ID,
        client_secret: FIREBASE_CLI_CLIENT_SECRET,
    }).toString();
    const res = await httpsRequest({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
        },
    }, postData);
    if (res.status !== 200) throw new Error('Token refresh failed: ' + JSON.stringify(res.body));
    return res.body.access_token;
}

function fromFirestoreValue(value) {
    if (!value) return null;
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return Number(value.integerValue);
    if (value.doubleValue !== undefined) return value.doubleValue;
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.timestampValue !== undefined) return value.timestampValue;
    if (value.nullValue !== undefined) return null;
    if (value.arrayValue) return (value.arrayValue.values || []).map(fromFirestoreValue);
    if (value.mapValue) {
        const result = {};
        for (const [key, child] of Object.entries(value.mapValue.fields || {})) {
            result[key] = fromFirestoreValue(child);
        }
        return result;
    }
    return null;
}

function fromFirestoreDocument(doc) {
    const result = { id: doc.name.split('/').pop() };
    for (const [key, value] of Object.entries(doc.fields || {})) {
        result[key] = fromFirestoreValue(value);
    }
    return result;
}

async function listTenantCases(token) {
    const body = JSON.stringify({
        structuredQuery: {
            from: [{ collectionId: 'cases' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'tenantId' },
                    op: 'EQUAL',
                    value: { stringValue: TENANT_ID },
                },
            },
            limit: 300,
        },
    });

    const res = await httpsRequest({
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);

    if (res.status !== 200) throw new Error('Erro ao listar cases: ' + JSON.stringify(res.body));
    return (res.body || []).filter((entry) => entry.document).map((entry) => fromFirestoreDocument(entry.document));
}

async function getPublicResultLatest(token, caseId) {
    const res = await httpsRequest({
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/cases/${caseId}/publicResult/latest`,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token },
    });
    if (res.status === 404) return null;
    if (res.status !== 200) throw new Error(`Erro ao buscar publicResult/${caseId}: ` + JSON.stringify(res.body));
    return fromFirestoreDocument(res.body);
}

function asText(value) {
    return JSON.stringify(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function hasAny(value, patterns) {
    const text = asText(value);
    return patterns.some((pattern) => pattern.test(text));
}

function countBy(items, field) {
    return items.reduce((acc, item) => {
        const key = item[field] || '(empty)';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

function textFields(caseData) {
    return {
        criminalNotes: caseData.criminalNotes,
        laborNotes: caseData.laborNotes,
        warrantNotes: caseData.warrantNotes,
        executiveSummary: caseData.executiveSummary,
        keyFindings: caseData.keyFindings,
        analystComment: caseData.analystComment,
        reviewDraft: caseData.reviewDraft,
        deterministicPrefill: caseData.deterministicPrefill,
        prefillNarratives: caseData.prefillNarratives,
    };
}

function publicTextFields(caseData) {
    return {
        criminalNotes: caseData.criminalNotes,
        laborNotes: caseData.laborNotes,
        warrantNotes: caseData.warrantNotes,
        executiveSummary: caseData.executiveSummary,
        keyFindings: caseData.keyFindings,
        analystComment: caseData.analystComment,
    };
}

function inspectCase(caseData, options = {}) {
    const fields = options.publicOnly ? publicTextFields(caseData) : textFields(caseData);
    const issues = [];

    const inconclusivePatterns = [/inconclusiv/, /baixa cobertura/, /cobertura insuficiente/, /validacao manual por cobertura/, /verificacao manual/];
    const cleanPatterns = [/nenhum processo criminal identificado/, /sem apontamento/, /nao houve indicio penal confirmado/, /nao apresenta restric/];
    const criminalPositivePatterns = [/criminal positivo/, /apontamento\(s\) criminal/, /execucao penal positiva/, /mandado ativo/];
    const laborPositivePatterns = [/trabalhista positivo/, /processo\(s\) trabalhista/, /reclamante/, /acao trabalhista/];
    const warrantPositivePatterns = [/mandado ativo/, /mandado detectado/, /pendente de cumprimento/, /prisao pendente/, /warrant positive/];

    if (caseData.criminalFlag === 'NEGATIVE' && hasAny(fields, inconclusivePatterns)) {
        issues.push('NEGATIVE_WITH_INCONCLUSIVE_TEXT');
    }
    if (caseData.criminalFlag === 'NEGATIVE' && hasAny(fields.criminalNotes, criminalPositivePatterns)) {
        issues.push('NEGATIVE_WITH_CRIMINAL_POSITIVE_TEXT');
    }
    if (caseData.criminalFlag === 'POSITIVE' && !hasAny(fields, criminalPositivePatterns)) {
        issues.push('POSITIVE_WITHOUT_CRIMINAL_CONTEXT_TEXT');
    }
    if (caseData.criminalFlag === 'NEGATIVE' && !hasAny(fields.criminalNotes || fields.prefillNarratives?.criminalNotes || fields.deterministicPrefill?.criminalNotes, cleanPatterns)) {
        issues.push('NEGATIVE_WITHOUT_CLEAR_CLEAN_CRIMINAL_NOTE');
    }
    if (caseData.laborFlag === 'NEGATIVE' && hasAny(fields.laborNotes, laborPositivePatterns)) {
        issues.push('NEGATIVE_LABOR_WITH_POSITIVE_TEXT');
    }
    if (caseData.laborFlag === 'POSITIVE' && !hasAny(fields, laborPositivePatterns)) {
        issues.push('POSITIVE_LABOR_WITHOUT_CONTEXT_TEXT');
    }
    if (caseData.warrantFlag === 'NEGATIVE' && hasAny(fields.warrantNotes, warrantPositivePatterns)) {
        issues.push('NEGATIVE_WARRANT_WITH_POSITIVE_TEXT');
    }
    if (caseData.warrantFlag === 'POSITIVE' && !hasAny(fields, warrantPositivePatterns)) {
        issues.push('POSITIVE_WARRANT_WITHOUT_CONTEXT_TEXT');
    }
    if (caseData.finalVerdict === 'FIT' && ['POSITIVE', 'INCONCLUSIVE'].includes(caseData.criminalFlag)) {
        issues.push('FIT_WITH_CRIMINAL_RISK_FLAG');
    }
    if (caseData.finalVerdict === 'FIT' && caseData.warrantFlag === 'POSITIVE') {
        issues.push('FIT_WITH_POSITIVE_WARRANT');
    }
    if (caseData.status === 'DONE' && !caseData.executiveSummary && !caseData.analystComment) {
        issues.push('DONE_WITHOUT_EXECUTIVE_OR_FINAL_COMMENT');
    }

    return issues;
}

function summarizeCase(caseData, issues) {
    return {
        id: caseData.id,
        status: caseData.status,
        finalVerdict: caseData.finalVerdict || '',
        criminalFlag: caseData.criminalFlag || '',
        criminalQuality: caseData.criminalEvidenceQuality || '',
        laborFlag: caseData.laborFlag || '',
        warrantFlag: caseData.warrantFlag || '',
        coverage: caseData.coverageLevel || '',
        issues: issues.join(', '),
    };
}

async function main() {
    console.log(`Auditando textos/classificacoes ${TENANT_ID} [read-only]...`);
    const token = await getAccessToken();
    const cases = await listTenantCases(token);
    const inspections = cases.map((caseData) => ({ caseData, issues: inspectCase(caseData) }));
    const withIssues = inspections.filter((item) => item.issues.length > 0);

    console.log('\nDistribuicoes');
    console.log('status:', countBy(cases, 'status'));
    console.log('finalVerdict:', countBy(cases, 'finalVerdict'));
    console.log('criminalFlag:', countBy(cases, 'criminalFlag'));
    console.log('criminalEvidenceQuality:', countBy(cases, 'criminalEvidenceQuality'));
    console.log('laborFlag:', countBy(cases, 'laborFlag'));
    console.log('warrantFlag:', countBy(cases, 'warrantFlag'));

    console.log('\nProblemas por tipo');
    const issueCounts = {};
    for (const item of withIssues) {
        for (const issue of item.issues) issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    }
    console.log(issueCounts);

    console.log('\nCasos com inconsistencias textuais/classificacao');
    console.table(withIssues.map((item) => summarizeCase(item.caseData, item.issues)));

    const publicSnapshots = [];
    for (const caseData of cases.filter((item) => item.status === 'DONE')) {
        const publicResult = await getPublicResultLatest(token, caseData.id);
        if (!publicResult) {
            publicSnapshots.push({ caseData: { ...caseData, publicMissing: true }, issues: ['PUBLIC_RESULT_MISSING'] });
            continue;
        }
        publicSnapshots.push({
            caseData: {
                ...caseData,
                ...publicResult,
                id: caseData.id,
                status: caseData.status,
            },
            issues: inspectCase({ ...caseData, ...publicResult }, { publicOnly: true }),
        });
    }

    const publicIssues = publicSnapshots.filter((item) => item.issues.length > 0);
    const publicIssueCounts = {};
    for (const item of publicIssues) {
        for (const issue of item.issues) publicIssueCounts[issue] = (publicIssueCounts[issue] || 0) + 1;
    }

    console.log('\nPublicResult/latest client-visible issues por tipo');
    console.log(publicIssueCounts);
    console.log('\nPublicResult/latest client-visible casos com inconsistencias');
    console.table(publicIssues.map((item) => summarizeCase(item.caseData, item.issues)));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
