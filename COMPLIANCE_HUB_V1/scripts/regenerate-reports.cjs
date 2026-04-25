/**
 * regenerate-reports.cjs
 * Regenera o HTML de todos os publicReports vinculados a cases DONE
 * usando o reportBuilder.cjs atualizado.
 * Também atualiza publicResult/latest para cada case DONE.
 *
 * Usage:
 *   node scripts/regenerate-reports.cjs              (dry-run por padrao)
 *   node scripts/regenerate-reports.cjs --confirm     (aplica as alteracoes)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { buildCaseReportHtml, REPORT_BUILD_VERSION } = require('../functions/reportBuilder.cjs');

const DRY_RUN = !process.argv.includes('--confirm');
const PROJECT_ID = 'compliance-hub-br';
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

async function listDocuments(token, collectionPath) {
    const docs = [];
    let pageToken = '';
    do {
        const qs = pageToken ? `?pageToken=${pageToken}&pageSize=100` : '?pageSize=100';
        const res = await httpsRequest({
            hostname: BASE_HOST,
            path: `/v1/${BASE_PATH}/${collectionPath}${qs}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status !== 200) throw new Error(`List ${collectionPath} failed: ${JSON.stringify(res.body)}`);
        if (res.body.documents) docs.push(...res.body.documents);
        pageToken = res.body.nextPageToken || '';
    } while (pageToken);
    return docs;
}

async function getDocument(token, docPath) {
    const res = await httpsRequest({
        hostname: BASE_HOST,
        path: `/v1/${docPath}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return null;
    if (res.status !== 200) throw new Error(`Get ${docPath} failed: ${JSON.stringify(res.body)}`);
    return res.body;
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

function parseFirestoreValue(v) {
    if (!v) return null;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.timestampValue !== undefined) return v.timestampValue;
    if (v.nullValue !== undefined) return null;
    if (v.arrayValue) return (v.arrayValue.values || []).map(parseFirestoreValue);
    if (v.mapValue) return parseFirestoreFields(v.mapValue.fields || {});
    return null;
}

function parseFirestoreFields(fields) {
    const result = {};
    for (const [key, value] of Object.entries(fields || {})) {
        result[key] = parseFirestoreValue(value);
    }
    return result;
}

async function main() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  REGENERACAO DE RELATORIOS - ComplianceHub`);
    console.log(`  Modo: ${DRY_RUN ? 'DRY-RUN (use --confirm para aplicar)' : 'EXECUTANDO ALTERACOES'}`);
    console.log(`${'='.repeat(60)}\n`);

    const accessToken = await getAccessToken();
    console.log('✅ Token obtido.\n');

    // 1. List all cases
    const caseDocs = await listDocuments(accessToken, 'cases');
    console.log(`📂 ${caseDocs.length} cases encontrados.\n`);

    const doneCases = caseDocs.filter(doc => {
        const status = doc.fields?.status?.stringValue;
        return status === 'DONE';
    });
    console.log(`✅ ${doneCases.length} cases com status DONE.\n`);

    let regenerated = 0;
    let publicResultsUpdated = 0;
    let errors = 0;

    for (const caseDoc of doneCases) {
        const caseId = caseDoc.name.split('/').pop();
        const caseData = parseFirestoreFields(caseDoc.fields || {});
        const candidateName = caseData.candidateName || '(sem nome)';
        console.log(`\n📋 Case: ${caseId} — ${candidateName}`);

        // Read candidate data if available
        let candidateData = {};
        if (caseData.candidateId) {
            const candDocPath = `${BASE_PATH}/candidates/${caseData.candidateId}`;
            const candDoc = await getDocument(accessToken, candDocPath);
            if (candDoc) candidateData = parseFirestoreFields(candDoc.fields || {});
        }

        // Build timeline
        let timelineEvents = caseData.timelineEvents;
        if (!Array.isArray(timelineEvents) || timelineEvents.length === 0) {
            timelineEvents = [
                caseData.createdAt && { type: 'created', title: 'Solicitacao enviada', at: typeof caseData.createdAt === 'string' ? caseData.createdAt : '' },
                caseData.analysisStartedAt && { type: 'analysis_started', title: 'Processamento iniciado', at: typeof caseData.analysisStartedAt === 'string' ? caseData.analysisStartedAt : '' },
                caseData.concludedAt && { type: 'concluded', title: 'Analise concluida', at: typeof caseData.concludedAt === 'string' ? caseData.concludedAt : '' },
            ].filter(Boolean);
        }

        // Compute sourceSummary
        let sourceSummary = caseData.sourceSummary;
        if (!sourceSummary) {
            const sources = Object.entries(caseData.enrichmentSources || {})
                .map(([phase, sourceData]) => {
                    if (typeof sourceData === 'object' && sourceData?.source) return `${phase}: ${sourceData.source}`;
                    return null;
                })
                .filter(Boolean);
            sourceSummary = sources.length > 0 ? sources.join(' | ') : 'Fontes automatizadas e revisao analitica.';
        }

        // Merge all data for the report builder
        const reportData = {
            ...candidateData,
            ...caseData,
            id: caseId,
            tenantName: caseData.tenantName || '',
            timelineEvents,
            sourceSummary,
            statusSummary: caseData.statusSummary || 'Analise concluida e pronta para consulta e compartilhamento.',
        };

        // Generate fresh HTML
        const html = buildCaseReportHtml(reportData);
        if (!html || !html.trim()) {
            console.log(`   ⚠️ HTML vazio gerado — pulando`);
            errors++;
            continue;
        }

        const htmlSize = Buffer.byteLength(html, 'utf-8');
        console.log(`   📄 HTML gerado: ${(htmlSize / 1024).toFixed(1)} KB`);
        console.log(`   📊 Dados: riskScore=${caseData.riskScore || 0}, verdict=${caseData.finalVerdict || '—'}, phases=${caseData.enabledPhases?.length || 0}`);
        console.log(`   📝 Seções: exec=${!!caseData.executiveSummary}, findings=${(caseData.keyFindings || []).length}, highlights=${(caseData.processHighlights || []).length}, warrants=${(caseData.warrantFindings || []).length}`);

        // Update publicReport if it exists
        const reportToken = caseData.publicReportToken;
        if (reportToken) {
            const reportDocPath = `${BASE_PATH}/publicReports/${reportToken}`;
            const reportDoc = await getDocument(accessToken, reportDocPath);
            if (reportDoc) {
                if (DRY_RUN) {
                    console.log(`   🔄 [DRY-RUN] Atualizaria publicReports/${reportToken}`);
                } else {
                    await patchDocument(accessToken, reportDocPath, {
                        html: { stringValue: html },
                        createdAt: { timestampValue: new Date().toISOString() },
                        reportBuildVersion: { integerValue: String(REPORT_BUILD_VERSION) },
                    }, ['html', 'createdAt', 'reportBuildVersion']);
                    console.log(`   ✅ publicReports/${reportToken} regenerado (v${REPORT_BUILD_VERSION})`);
                }
                regenerated++;
            } else {
                console.log(`   ⚠️ publicReports/${reportToken} nao encontrado`);
            }
        } else {
            console.log(`   ℹ️ sem publicReportToken — nada para regenerar`);
        }

        // Ensure publicResult/latest exists and is fresh
        const prDocPath = `${BASE_PATH}/cases/${caseId}/publicResult/latest`;
        const PUBLIC_RESULT_FIELDS = [
            'candidateName', 'cpfMasked', 'candidatePosition', 'hiringUf', 'tenantId', 'createdAt',
            'criminalFlag', 'criminalSeverity', 'criminalNotes',
            'laborFlag', 'laborSeverity', 'laborNotes',
            'warrantFlag', 'warrantNotes',
            'osintLevel', 'osintVectors', 'osintNotes',
            'socialStatus', 'socialReasons', 'socialNotes',
            'digitalFlag', 'digitalVectors', 'digitalNotes',
            'conflictInterest', 'conflictNotes',
            'riskScore', 'riskLevel', 'finalVerdict', 'analystComment',
            'enabledPhases', 'processHighlights', 'warrantFindings',
            'keyFindings', 'executiveSummary', 'publicReportToken',
        ];

        const prFields = {};
        for (const field of PUBLIC_RESULT_FIELDS) {
            const val = caseData[field];
            if (val === undefined || val === null || val === '') continue;
            if (typeof val === 'string') prFields[field] = { stringValue: val };
            else if (typeof val === 'number') {
                prFields[field] = Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
            } else if (typeof val === 'boolean') prFields[field] = { booleanValue: val };
            else if (Array.isArray(val)) {
                prFields[field] = {
                    arrayValue: {
                        values: val.map(item => {
                            if (typeof item === 'string') return { stringValue: item };
                            if (typeof item === 'object' && item !== null) {
                                const mapFields = {};
                                for (const [k, v] of Object.entries(item)) {
                                    if (v === null || v === undefined) continue;
                                    if (typeof v === 'string') mapFields[k] = { stringValue: v };
                                    else if (typeof v === 'number') mapFields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
                                    else if (typeof v === 'boolean') mapFields[k] = { booleanValue: v };
                                    else if (Array.isArray(v)) {
                                        mapFields[k] = {
                                            arrayValue: {
                                                values: v.map(sub => {
                                                    if (typeof sub === 'string') return { stringValue: sub };
                                                    if (typeof sub === 'object' && sub !== null) {
                                                        const subFields = {};
                                                        for (const [sk, sv] of Object.entries(sub)) {
                                                            if (sv === null || sv === undefined) continue;
                                                            if (typeof sv === 'string') subFields[sk] = { stringValue: sv };
                                                            else if (typeof sv === 'number') subFields[sk] = Number.isInteger(sv) ? { integerValue: String(sv) } : { doubleValue: sv };
                                                            else if (typeof sv === 'boolean') subFields[sk] = { booleanValue: sv };
                                                        }
                                                        return { mapValue: { fields: subFields } };
                                                    }
                                                    return { stringValue: String(sub) };
                                                }),
                                            },
                                        };
                                    }
                                }
                                return { mapValue: { fields: mapFields } };
                            }
                            return { stringValue: String(item) };
                        }),
                    },
                };
            }
        }
        prFields.publishedAt = { timestampValue: new Date().toISOString() };

        if (Object.keys(prFields).length > 1) {
            if (DRY_RUN) {
                console.log(`   🔄 [DRY-RUN] Atualizaria publicResult/latest (${Object.keys(prFields).length} campos)`);
            } else {
                await patchDocument(accessToken, prDocPath, prFields, Object.keys(prFields));
                console.log(`   ✅ publicResult/latest atualizado (${Object.keys(prFields).length} campos)`);
            }
            publicResultsUpdated++;
        }

        // Clean stale correction/draft fields from clientCases when DONE
        const staleFields = ['correctionReason', 'correctionNotes', 'correctionRequestedAt', 'correctionRequestedBy', 'reviewDraft', 'draftSavedAt'];
        const clientCaseDocPath = `${BASE_PATH}/clientCases/${caseId}`;
        const clientCaseDoc = await getDocument(accessToken, clientCaseDocPath);
        if (clientCaseDoc) {
            const clientData = parseFirestoreFields(clientCaseDoc.fields || {});
            const fieldsToDelete = staleFields.filter(f => clientData[f] !== undefined && clientData[f] !== null);
            if (fieldsToDelete.length > 0) {
                if (DRY_RUN) {
                    console.log(`   🔄 [DRY-RUN] Deletaria ${fieldsToDelete.length} campos stale de clientCases: ${fieldsToDelete.join(', ')}`);
                } else {
                    // Firestore REST API: set fields with null transforms to delete
                    const cleanFields = {};
                    for (const f of fieldsToDelete) cleanFields[f] = { nullValue: null };
                    await patchDocument(accessToken, clientCaseDocPath, cleanFields, fieldsToDelete);
                    console.log(`   ✅ clientCases: ${fieldsToDelete.length} campos stale limpos`);
                }
            }
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  RESUMO`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  Cases DONE: ${doneCases.length}`);
    console.log(`  Reports regenerados: ${regenerated}`);
    console.log(`  publicResult atualizados: ${publicResultsUpdated}`);
    console.log(`  Erros: ${errors}`);
    if (DRY_RUN) console.log(`\n  ⚠️ DRY-RUN: nenhuma alteracao aplicada. Use --confirm para executar.`);
    console.log('');
}

main().catch(err => {
    console.error('\n❌ Erro fatal:', err.message);
    process.exit(1);
});
