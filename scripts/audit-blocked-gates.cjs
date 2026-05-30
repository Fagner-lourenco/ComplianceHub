/**
 * audit-blocked-gates.cjs
 * Varre o Firestore via REST API para encontrar casos concluídos que tiveram o gate bloqueado.
 * 
 * Uso: node scripts/audit-blocked-gates.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const BATCH_SIZE = 100;

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
    if (!fs.existsSync(configPath)) {
        throw new Error(`Firebase CLI config file not found at: ${configPath}. Please login using 'firebase login' first.`);
    }
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

function fromFirestoreValue(v) {
    if (!v) return null;
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
    return JSON.stringify(v);
}

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  AUDITORIA DE CASOS CONCLUÍDOS COM GATE BLOQUEADO  ');
    console.log('═══════════════════════════════════════════════════════');
    
    console.log('Obtendo token de acesso do Firebase CLI...');
    const token = await getAccessToken();
    console.log('Token de acesso obtido com sucesso.\n');

    let nextPageToken = null;
    let totalCases = 0;
    let matchingCases = [];

    do {
        let url = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/cases?pageSize=${BATCH_SIZE}`;
        if (nextPageToken) url += `&pageToken=${encodeURIComponent(nextPageToken)}`;

        const res = await httpsRequest({
            hostname: 'firestore.googleapis.com',
            path: url,
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status !== 200) {
            console.error('Falha ao buscar casos:', res.body);
            process.exit(1);
        }

        const docs = res.body.documents || [];
        nextPageToken = res.body.nextPageToken || null;

        for (const doc of docs) {
            totalCases++;
            const id = doc.name.split('/').pop();
            const fields = doc.fields || {};
            
            const caseData = {};
            for (const [k, v] of Object.entries(fields)) caseData[k] = fromFirestoreValue(v);

            // Filtro 1: Casos concluídos
            if (caseData.status !== 'DONE') continue;

            // Filtro 2: Identificar se algum gate falhou/bloqueou
            const bdcGatePassed = caseData.bigdatacorpGateResult?.passed;
            const juditGatePassed = caseData.juditGateResult?.passed;
            const fallbackGatePassed = caseData.enrichmentGateResult?.passed;

            const isBdcBlocked = caseData.bigdatacorpEnrichmentStatus === 'BLOCKED' || bdcGatePassed === false;
            const isJuditBlocked = caseData.juditEnrichmentStatus === 'BLOCKED' || juditGatePassed === false;
            const isFallbackBlocked = caseData.enrichmentStatus === 'BLOCKED' || fallbackGatePassed === false;

            const isGateBlocked = isBdcBlocked || isJuditBlocked || isFallbackBlocked;

            if (isGateBlocked) {
                // Determinar o motivo do bloqueio para relatar
                let blockReason = [];
                if (isBdcBlocked) {
                    blockReason.push(`BigDataCorp (Gate Passed: ${bdcGatePassed}, Status: ${caseData.bigdatacorpEnrichmentStatus}, Erro: ${caseData.bigdatacorpError || 'N/A'})`);
                }
                if (isJuditBlocked) {
                    blockReason.push(`Judit (Gate Passed: ${juditGatePassed}, Status: ${caseData.juditEnrichmentStatus}, Erro: ${caseData.juditError || 'N/A'})`);
                }
                if (isFallbackBlocked) {
                    blockReason.push(`FonteData Fallback (Gate Passed: ${fallbackGatePassed}, Status: ${caseData.enrichmentStatus}, Erro: ${caseData.enrichmentError || 'N/A'})`);
                }

                matchingCases.push({
                    caseId: id,
                    candidateName: caseData.candidateName || 'N/A',
                    cpf: caseData.cpf || 'N/A',
                    cpfMasked: caseData.cpfMasked || 'N/A',
                    tenantName: caseData.tenantName || 'N/A',
                    tenantId: caseData.tenantId || 'N/A',
                    finalVerdict: caseData.finalVerdict || 'N/A',
                    riskLevel: caseData.riskLevel || 'N/A',
                    concludedAt: caseData.concludedAt || 'N/A',
                    requestedBy: caseData.requestedBy || 'N/A',
                    blockReason: blockReason.join(' | ')
                });

                console.log(`🚩 Encontrado: ID ${id} | ${caseData.candidateName} | CPF ${caseData.cpfMasked || caseData.cpf} | ${caseData.tenantName}`);
                console.log(`   Motivo: ${blockReason.join(' | ')}`);
                console.log(`   Veredito: ${caseData.finalVerdict} | Risco: ${caseData.riskLevel} | Concluído em: ${caseData.concludedAt}\n`);
            }
        }

        console.log(`Processed ${totalCases} cases...`);

    } while (nextPageToken);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  RESULTADOS DA AUDITORIA');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Total de casos varridos: ${totalCases}`);
    console.log(`  Casos concluídos com gate bloqueado: ${matchingCases.length}`);

    // Salvar resultados na pasta de results
    const resultsDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    const outputPath = path.join(resultsDir, 'blocked_gate_concluded_cases.json');
    fs.writeFileSync(outputPath, JSON.stringify(matchingCases, null, 2));
    console.log(`  Relatório detalhado salvo em: ${outputPath}`);
    console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => {
    console.error('\n❌ Erro durante a auditoria:', err.message);
    console.error(err.stack);
    process.exit(1);
});
