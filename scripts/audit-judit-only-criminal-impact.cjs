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
    const fields = [
        'candidateName', 'cpf', 'status', 'finalVerdict', 'suggestedVerdict', 'riskScore', 'riskLevel',
        'criminalFlag', 'criminalSeverity', 'criminalNotes', 'laborFlag', 'laborNotes', 'warrantFlag', 'warrantNotes',
        'pepFlag', 'sanctionFlag', 'socialStatus', 'digitalFlag', 'conflictInterest', 'analystComment',
        'juditCriminalFlag', 'juditCriminalCount', 'juditNotes', 'juditRoleSummary', 'juditProcessTotal',
        'bigdatacorpCriminalFlag', 'bigdatacorpCriminalCount', 'bigdatacorpProcessTotal', 'bigdatacorpProcessNotes',
        'bigdatacorpLaborFlag', 'bigdatacorpLaborCount', 'bigdatacorpHasArrestWarrant', 'bigdatacorpActiveWarrants',
        'djenCriminalFlag', 'djenCriminalCount', 'djenNotes', 'enrichmentOriginalValues', 'prefillNarratives',
    ];
    const mask = fields.map((field) => `mask.fieldPaths=${encodeURIComponent(field)}`).join('&');
    const res = await request({
        hostname: 'firestore.googleapis.com',
        path: `/v1/projects/${PROJECT}/databases/(default)/documents/cases/${caseId}?${mask}`,
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status !== 200) throw new Error(`Firestore read failed for ${caseId}: ${JSON.stringify(res.body)}`);
    const data = {};
    for (const [key, value] of Object.entries(res.body.fields || {})) data[key] = decode(value);
    return { id: caseId, ...data };
}

function positive(value) {
    return value === 'POSITIVE' || value === true;
}

function otherPositiveSignals(item) {
    const signals = [];
    if (positive(item.laborFlag)) signals.push('trabalhista');
    if (positive(item.warrantFlag)) signals.push('mandado');
    if (positive(item.pepFlag)) signals.push('PEP');
    if (positive(item.sanctionFlag)) signals.push('sancao');
    if (positive(item.socialStatus)) signals.push('social');
    if (positive(item.digitalFlag)) signals.push('digital');
    if (positive(item.conflictInterest)) signals.push('conflito');
    return signals;
}

function classifyCounterfactual(item) {
    const signals = otherPositiveSignals(item);
    if (item.criminalFlag !== 'POSITIVE') {
        return {
            impact: 'NAO_MUDARIA_VEREDITO_CRIMINAL',
            rationale: 'O analista nao manteve criminal positivo no resultado final; sem Judit, a conclusao criminal provavelmente continuaria sem apontamento material.',
            otherSignals: signals,
        };
    }
    if (signals.length > 0) {
        return {
            impact: 'PODERIA_NAO_MUDAR_VEREDITO_FINAL',
            rationale: `O criminal final dependeu do Judit, mas havia outro(s) sinal(is) final(is): ${signals.join(', ')}. O veredito final poderia permanecer restritivo por outro eixo.`,
            otherSignals: signals,
        };
    }
    return {
        impact: 'PROVAVELMENTE_MUDARIA_VEREDITO_FINAL',
        rationale: 'O criminal final ficou positivo e nao ha outro eixo final positivo nos campos principais. Sem Judit, o caso provavelmente perderia o motivo material do veredito restritivo.',
        otherSignals: signals,
    };
}

function summarizeJuditProcesses(item) {
    return (item.juditRoleSummary || []).map((process) => ({
        cnj: process.code || null,
        area: process.area || null,
        state: process.state || null,
        city: process.city || null,
        county: process.county || null,
        tribunalAcronym: process.tribunalAcronym || null,
        distributionDate: process.distributionDate || null,
        lastStepDate: process.lastStepDate || null,
        role: process.personType || process.role || null,
        side: process.side || null,
        status: process.status || null,
        subjects: process.subjects || [],
        classifications: process.classifications || [],
        isCriminal: process.isCriminal === true,
        isDefendant: process.isDefendant === true,
        hasExactCpfMatch: process.hasExactCpfMatch === true,
        lastStep: process.lastStep || null,
    }));
}

function truncate(text, max = 700) {
    if (!text) return '';
    return String(text).length > max ? `${String(text).slice(0, max)}...` : String(text);
}

async function main() {
    const base = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'results', 'audit-judit-bdc-confrontation.json'), 'utf8'));
    const target = base.cases.filter((item) => {
        const juditPositive = item.juditCriminalFlag === 'POSITIVE' || item.juditCriminalCount > 0;
        const bdcPositive = item.bdcCriminalFlag === 'POSITIVE' || item.bdcCriminalCount > 0;
        return juditPositive && !bdcPositive;
    });

    const token = await getToken();
    const detailed = [];
    for (const item of target) {
        const full = await getCase(token, item.id);
        const counterfactual = classifyCounterfactual(full);
        detailed.push({
            id: item.id,
            candidateName: full.candidateName,
            cpfMasked: item.cpf,
            finalVerdict: full.finalVerdict,
            suggestedVerdict: full.suggestedVerdict,
            riskScore: full.riskScore,
            riskLevel: full.riskLevel,
            finalFlags: {
                criminalFlag: full.criminalFlag,
                criminalSeverity: full.criminalSeverity,
                laborFlag: full.laborFlag,
                warrantFlag: full.warrantFlag,
                pepFlag: full.pepFlag,
                sanctionFlag: full.sanctionFlag,
                socialStatus: full.socialStatus,
                digitalFlag: full.digitalFlag,
                conflictInterest: full.conflictInterest,
            },
            providers: {
                juditCriminalFlag: full.juditCriminalFlag,
                juditCriminalCount: full.juditCriminalCount,
                juditProcessTotal: full.juditProcessTotal,
                bigdatacorpCriminalFlag: full.bigdatacorpCriminalFlag,
                bigdatacorpCriminalCount: full.bigdatacorpCriminalCount,
                bigdatacorpProcessTotal: full.bigdatacorpProcessTotal,
                djenCriminalFlag: full.djenCriminalFlag,
                djenCriminalCount: full.djenCriminalCount,
            },
            juditProcesses: summarizeJuditProcesses(full),
            counterfactual,
            notes: {
                criminalNotes: truncate(full.criminalNotes),
                analystComment: truncate(full.analystComment),
                juditNotes: truncate(full.juditNotes),
                bdcProcessNotes: truncate(full.bigdatacorpProcessNotes),
                djenNotes: truncate(full.djenNotes),
                enrichmentCriminalNotes: truncate(full.enrichmentOriginalValues?.criminalNotes),
            },
        });
    }

    const byImpact = detailed.reduce((acc, item) => {
        acc[item.counterfactual.impact] = (acc[item.counterfactual.impact] || 0) + 1;
        return acc;
    }, {});

    const report = { generatedAt: new Date().toISOString(), total: detailed.length, byImpact, cases: detailed };
    const jsonPath = path.join(process.cwd(), 'results', 'audit-judit-only-criminal-impact.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    const mdLines = [
        '# Auditoria Dos 15 Casos Criminais Judit-Only',
        '',
        `Gerado em: ${report.generatedAt}`,
        '',
        '## Resumo',
        '',
        `- Total analisado: ${detailed.length}`,
        `- Provavelmente mudaria o veredito final sem Judit: ${byImpact.PROVAVELMENTE_MUDARIA_VEREDITO_FINAL || 0}`,
        `- Poderia nao mudar por outro eixo positivo: ${byImpact.PODERIA_NAO_MUDAR_VEREDITO_FINAL || 0}`,
        `- Nao mudaria veredito criminal: ${byImpact.NAO_MUDARIA_VEREDITO_CRIMINAL || 0}`,
        '',
        '## Casos',
        '',
    ];

    for (const item of detailed) {
        mdLines.push(`### ${item.candidateName} (${item.id})`);
        mdLines.push(`- CPF: ${item.cpfMasked}`);
        mdLines.push(`- Veredito final: ${item.finalVerdict} | Score: ${item.riskScore} | Nivel: ${item.riskLevel}`);
        mdLines.push(`- Criminal final: ${item.finalFlags.criminalFlag} | Severidade: ${item.finalFlags.criminalSeverity || 'N/A'}`);
        mdLines.push(`- Outros sinais finais: ${item.counterfactual.otherSignals.length ? item.counterfactual.otherSignals.join(', ') : 'nenhum'}`);
        mdLines.push(`- Impacto sem Judit: ${item.counterfactual.impact}`);
        mdLines.push(`- Leitura: ${item.counterfactual.rationale}`);
        mdLines.push('- Processos Judit:');
        for (const process of item.juditProcesses) {
            mdLines.push(`  - ${process.cnj || 'sem CNJ'} | ${process.area || 'area N/A'} | papel ${process.role || 'N/A'} | lado ${process.side || 'N/A'} | criminal=${process.isCriminal} | reu=${process.isDefendant}`);
            if (process.classifications.length) mdLines.push(`    - Classe: ${process.classifications.join('; ')}`);
            if (process.subjects.length) mdLines.push(`    - Assuntos: ${process.subjects.join('; ')}`);
            if (process.lastStep) mdLines.push(`    - Ultimo andamento: ${process.lastStep}`);
        }
        mdLines.push(`- Nota criminal final: ${item.notes.criminalNotes || 'N/A'}`);
        mdLines.push('');
    }

    const mdPath = path.join(process.cwd(), 'docs', 'audits', 'audit-judit-only-criminal-impact.md');
    fs.writeFileSync(mdPath, mdLines.join('\n'));

    console.log(JSON.stringify({ jsonPath, mdPath, total: report.total, byImpact }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
