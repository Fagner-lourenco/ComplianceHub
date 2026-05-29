const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT = 'compliance-hub-br';
const CID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function decode(value) {
    if (!value) return null;
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return Number(value.integerValue);
    if (value.doubleValue !== undefined) return value.doubleValue;
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.timestampValue !== undefined) return value.timestampValue;
    if (value.nullValue !== undefined) return null;
    if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
    if (value.mapValue) {
        const out = {};
        for (const [key, nested] of Object.entries(value.mapValue.fields || {})) {
            out[key] = decode(nested);
        }
        return out;
    }
    return value;
}

async function getToken() {
    const tokenPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
    const cfg = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cfg.tokens.refresh_token,
        client_id: CID,
        client_secret: CS,
    }).toString();
    const res = await request({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    if (res.status !== 200) throw new Error(`OAuth failed: ${JSON.stringify(res.body)}`);
    return res.body.access_token;
}

async function getCase(token, caseId) {
    const mask = 'mask.fieldPaths=cpf';
    const res = await request({
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${PROJECT}/databases/(default)/documents/cases/${caseId}?${mask}`,
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) throw new Error(`Firestore read failed for ${caseId}: ${JSON.stringify(res.body)}`);
    const data = {};
    for (const [key, value] of Object.entries(res.body.fields || {})) data[key] = decode(value);
    return data.cpf || 'N/A';
}

async function main() {
    const r = JSON.parse(fs.readFileSync('results/audit-judit-only-criminal-impact.json', 'utf8'));
    const token = await getToken();
    
    for (const c of r.cases) {
        const cpf = await getCase(token, c.id);
        c.cpf = cpf;
    }
    
    // Save updated report with full CPFs
    fs.writeFileSync('results/audit-judit-only-criminal-impact-full-cpf.json', JSON.stringify(r, null, 2));
    
    // Generate plain text list
    const lines = [];
    lines.push('LISTA DE CASOS JUDIT CRIMINAL POSITIVO / BIGDATACORP NEGATIVO');
    lines.push('');
    let n = 1;
    for (const c of r.cases) {
        lines.push('---');
        lines.push(n + '. ' + c.candidateName);
        lines.push('   CPF: ' + c.cpf);
        lines.push('   Case ID: ' + c.id);
        lines.push('   Veredito final: ' + c.finalVerdict);
        lines.push('   Flag criminal final: ' + c.finalFlags.criminalFlag);
        lines.push('   BDC criminal: ' + c.providers.bigdatacorpCriminalFlag + ' (count ' + c.providers.bigdatacorpCriminalCount + ')');
        lines.push('   Judit criminal: ' + c.providers.juditCriminalFlag + ' (count ' + c.providers.juditCriminalCount + ')');
        for (const p of c.juditProcesses) {
            lines.push('   CNJ: ' + p.cnj);
            lines.push('   Tribunal: ' + p.tribunalAcronym + ', UF: ' + p.state);
            lines.push('   Cidade: ' + p.city + ', Comarca: ' + p.county);
            lines.push('   Data distribuicao: ' + (p.distributionDate || 'N/A'));
            lines.push('   Classe: ' + ((p.classifications || []).join(' / ') || 'N/A'));
            lines.push('   Assunto: ' + ((p.subjects || []).join(' / ') || 'N/A'));
            lines.push('   Papel: ' + p.role + ', Lado: ' + p.side);
            lines.push('   Status: ' + (p.status || 'N/A'));
            lines.push('   Ultimo andamento: ' + (p.lastStep || 'N/A'));
            lines.push('   CPF exato: ' + (p.hasExactCpfMatch ? 'SIM' : 'N/A'));
            lines.push('');
        }
        n++;
    }
    lines.push('---');
    lines.push('FIM DA LISTA');
    const txt = lines.join('\n');
    fs.writeFileSync('results/lista-casos-bdc-nao-detectou.txt', txt);
    console.log('Arquivo salvo: results/lista-casos-bdc-nao-detectou.txt');
    console.log('CPFs atualizados: ' + r.cases.filter(c => c.cpf !== 'N/A').length + ' de ' + r.cases.length);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
