#!/usr/bin/env node
'use strict';

/**
 * backfill-risk-consistency.cjs
 *
 * Corrige casos DONE onde riskScore e riskLevel estão inconsistentes entre si
 * (ex: riskScore=90 com riskLevel='GREEN'). Usa calculateRisk() do módulo
 * compartilhado para recalcular os valores derivados.
 *
 * PRESERVA: finalVerdict (veredito escolhido pelo analista), flags, notas e relatórios.
 * ATUALIZA: riskScore, riskLevel, suggestedVerdict, lastBackfillAt.
 *
 * Uso: node scripts/backfill-risk-consistency.cjs [--dry-run]
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const { calculateRisk, LEGACY_PHASES } = require(path.join(__dirname, '../functions/shared/riskCalculator'));

// ─── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const PROJECT_ID = 'compliance-hub-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const BASE_HOST = 'firestore.googleapis.com';
const DB_PATH = 'projects/' + PROJECT_ID + '/databases/(default)/documents';

// ─── HTTP helpers ────────────────────────────────────────────────────────────
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

// ─── Firestore value converters ───────────────────────────────────────────────
function toFV(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    return { stringValue: String(val) };
}

function fromFV(val) {
    if (!val) return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
    if (val.doubleValue !== undefined) return val.doubleValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.nullValue !== undefined) return null;
    if (val.arrayValue) {
        return (val.arrayValue.values || []).map(fromFV);
    }
    return null;
}

// ─── Firestore REST ───────────────────────────────────────────────────────────
async function listDoneCases(token) {
    const docs = [];
    let pageToken = null;
    do {
        const qs = 'pageSize=300' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
        const res = await httpsRequest({
            hostname: BASE_HOST,
            path: '/v1/' + DB_PATH + '/cases?' + qs,
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
        });
        if (res.status !== 200) throw new Error('Erro ao listar cases: ' + JSON.stringify(res.body));
        for (const d of (res.body.documents || [])) {
            if (fromFV(d.fields?.status) === 'DONE') docs.push(d);
        }
        pageToken = res.body.nextPageToken || null;
    } while (pageToken);
    return docs;
}

async function batchWrite(token, writes) {
    const body = JSON.stringify({ writes });
    return httpsRequest({
        hostname: BASE_HOST,
        path: '/v1/' + DB_PATH + ':batchWrite',
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n=== Backfill: Risk Consistency ===`);
    console.log(`Projeto:  ${PROJECT_ID}`);
    console.log(`Modo:     ${DRY_RUN ? 'DRY-RUN (nenhuma escrita)' : 'PRODUÇÃO (escrevendo)'}`);
    console.log(`Iniciado: ${new Date().toISOString()}\n`);

    const token = await getAccessToken();
    console.log('Token OK. Listando casos DONE...');

    const doneCases = await listDoneCases(token);
    console.log(`Total de casos DONE: ${doneCases.length}\n`);

    const allChanges = [];
    let modifiedCount = 0;
    let skippedCount = 0;
    const CHUNK = 400;

    for (let i = 0; i < doneCases.length; i += CHUNK) {
        const chunk = doneCases.slice(i, i + CHUNK);
        const writes = [];

        for (const doc of chunk) {
            const f = doc.fields || {};
            const caseId = doc.name.split('/').pop();

            // Reconstruir input para calculateRisk
            const riskInput = {
                criminalFlag:             fromFV(f.criminalFlag),
                criminalSeverity:         fromFV(f.criminalSeverity),
                laborFlag:                fromFV(f.laborFlag),
                warrantFlag:              fromFV(f.warrantFlag),
                osintLevel:               fromFV(f.osintLevel),
                socialStatus:             fromFV(f.socialStatus),
                digitalFlag:              fromFV(f.digitalFlag),
                conflictInterest:         fromFV(f.conflictInterest),
                cpfPendingRegularization: fromFV(f.cpfPendingRegularization) === true,
            };

            const enabledPhasesRaw = fromFV(f.enabledPhases);
            const enabledPhases = Array.isArray(enabledPhasesRaw) && enabledPhasesRaw.length > 0
                ? enabledPhasesRaw
                : LEGACY_PHASES;

            const calculated = calculateRisk(riskInput, enabledPhases);
            const storedScore = fromFV(f.riskScore);
            const storedLevel = fromFV(f.riskLevel) || 'GREEN';

            // Verificar inconsistência
            if (storedScore === calculated.riskScore && storedLevel === calculated.riskLevel) {
                skippedCount++;
                continue;
            }

            const change = {
                caseId,
                candidateName: fromFV(f.candidateName) || '(sem nome)',
                finalVerdict:  fromFV(f.finalVerdict),
                old: { riskScore: storedScore, riskLevel: storedLevel },
                new: { riskScore: calculated.riskScore, riskLevel: calculated.riskLevel, suggestedVerdict: calculated.suggestedVerdict },
            };
            allChanges.push(change);
            modifiedCount++;

            console.log(`  ${caseId} | ${change.candidateName}`
                + ` | score ${change.old.riskScore} → ${change.new.riskScore}`
                + ` | level ${change.old.riskLevel} → ${change.new.riskLevel}`
                + ` | verdict MANTIDO: ${change.finalVerdict}`);

            if (!DRY_RUN) {
                writes.push({
                    update: {
                        name: DB_PATH + '/cases/' + caseId,
                        fields: {
                            riskScore:        toFV(calculated.riskScore),
                            riskLevel:        toFV(calculated.riskLevel),
                            suggestedVerdict: toFV(calculated.suggestedVerdict),
                            lastBackfillAt:   toFV(new Date().toISOString()),
                        },
                    },
                    updateMask: { fieldPaths: ['riskScore', 'riskLevel', 'suggestedVerdict', 'lastBackfillAt'] },
                });
            }
        }

        if (!DRY_RUN && writes.length > 0) {
            const res = await batchWrite(token, writes);
            if (res.status !== 200) {
                console.error(`\n[ERRO] Batch ${Math.floor(i / CHUNK) + 1}:`, JSON.stringify(res.body).slice(0, 300));
            } else {
                console.log(`\n  Batch ${Math.floor(i / CHUNK) + 1}: ${writes.length} documentos atualizados.`);
            }
        }

        await sleep(700);
    }

    // ─── Resultado ────────────────────────────────────────────────────────────
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Escaneados: ${doneCases.length}`);
    console.log(`Corrigidos: ${modifiedCount}${DRY_RUN ? ' (dry-run)' : ''}`);
    console.log(`Sem mudança: ${skippedCount}`);
    console.log(`Concluído:  ${new Date().toISOString()}`);

    if (allChanges.length > 0) {
        const logPath = path.join(__dirname, `backfill-risk-log-${Date.now()}${DRY_RUN ? '-dry' : ''}.json`);
        fs.writeFileSync(logPath, JSON.stringify({
            runAt: new Date().toISOString(), dryRun: DRY_RUN, projectId: PROJECT_ID,
            scanned: doneCases.length, modified: modifiedCount, cases: allChanges,
        }, null, 2));
        console.log(`\nLog salvo em: ${logPath}`);
        console.log('Para reverter: node scripts/rollback-backfill.cjs <caminho_do_log>');
    }
}

main().catch((err) => { console.error('\n[ERRO FATAL]', err.message); process.exit(1); });
