#!/usr/bin/env node
'use strict';
/**
 * rollback-backfill.cjs
 * Reverte os valores alterados por backfill-risk-consistency.cjs
 * usando o log JSON gerado pelo script de backfill.
 *
 * Uso: node scripts/rollback-backfill.cjs <caminho_do_log.json>
 */

const fs = require('node:fs');
const { initializeApp, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const logFile = process.argv[2];
if (!logFile) { console.error('Uso: node scripts/rollback-backfill.cjs <log.json>'); process.exit(1); }
const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));

try { getApp(); } catch {
    initializeApp({ projectId: log.projectId || 'compliance-hub-br' });
}
const db = getFirestore();

async function runRollback() {
    console.log(`Revertendo ${log.cases.length} casos do log ${logFile}...`);
    let count = 0;
    const CHUNK = 400;
    for (let i = 0; i < log.cases.length; i += CHUNK) {
        const batch = db.batch();
        const chunk = log.cases.slice(i, i + CHUNK);
        for (const c of chunk) {
            const ref = db.collection('cases').doc(c.caseId);
            batch.update(ref, {
                riskScore:        c.old.riskScore,
                riskLevel:        c.old.riskLevel,
                suggestedVerdict: c.old.suggestedVerdict || null,
            });
            count++;
        }
        await batch.commit();
        console.log(`  ${count} casos revertidos...`);
        await new Promise((r) => setTimeout(r, 600));
    }
    console.log(`Rollback concluído: ${count} casos revertidos.`);
}
runRollback().catch((e) => { console.error(e); process.exit(1); });
