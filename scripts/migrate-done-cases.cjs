/**
 * migrate-done-cases.js
 * One-time migration: Backfill publicResult/latest for all historical DONE cases.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
 *   node scripts/migrate-done-cases.js [--dry-run] [--max-count 100]
 *
 * Flags:
 *   --dry-run       Only logs what would be migrated, writes nothing.
 *   --max-count N   Limit the number of cases to process (useful for staged rollout).
 *
 * Idempotent: skips cases that already have publicResult/latest.
 */

const admin = require('firebase-admin');
const readline = require('readline');

admin.initializeApp();
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_COUNT = (() => {
    const idx = process.argv.indexOf('--max-count');
    if (idx === -1 || !process.argv[idx + 1]) return Infinity;
    const n = parseInt(process.argv[idx + 1], 10);
    return Number.isFinite(n) && n > 0 ? n : Infinity;
})();

const BATCH_SIZE = 50;
const BATCH_PAUSE_MS = 500;

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
    'enabledPhases',
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function askConfirmation(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

async function migrate() {
    console.log(`Migration: Backfill publicResult for DONE cases ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`);
    if (MAX_COUNT < Infinity) console.log(`Max count: ${MAX_COUNT}`);

    // Safety confirmation for live runs
    if (!DRY_RUN) {
        const answer = await askConfirmation(
            '\n⚠️  This will WRITE to Firestore production data.\n' +
            '   Run with --dry-run first to preview changes.\n' +
            '   Type "yes" to proceed: '
        );
        if (answer !== 'yes') {
            console.log('Aborted by user.');
            process.exit(0);
        }
    }

    const snapshot = await db.collection('cases')
        .where('status', '==', 'DONE')
        .get();

    console.log(`Found ${snapshot.size} DONE cases.`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    let processed = 0;

    for (const doc of snapshot.docs) {
        if (processed >= MAX_COUNT) {
            console.log(`Reached --max-count limit (${MAX_COUNT}). Stopping.`);
            break;
        }

        const caseId = doc.id;
        const data = doc.data();

        // Defense-in-depth: recheck status even though query already filters
        if (data.status !== 'DONE') {
            console.warn(`  SKIP case ${caseId}: status is "${data.status}", not DONE (inconsistent).`);
            skipped++;
            processed++;
            continue;
        }

        try {
            const publicRef = db.collection('cases').doc(caseId).collection('publicResult').doc('latest');
            const existing = await publicRef.get();

            if (existing.exists) {
                skipped++;
                processed++;
                continue;
            }

            const publicData = {};
            for (const field of PUBLIC_RESULT_FIELDS) {
                if (data[field] !== undefined && data[field] !== null) {
                    publicData[field] = data[field];
                }
            }

            // Validate minimum required fields
            if (!publicData.candidateName && !publicData.cpfMasked) {
                console.warn(`  SKIP case ${caseId} (tenant: ${data.tenantId || '?'}): no candidateName or cpfMasked — empty data.`);
                skipped++;
                processed++;
                continue;
            }

            publicData.publishedAt = admin.firestore.FieldValue.serverTimestamp();
            publicData.concludedAt = data.updatedAt || admin.firestore.FieldValue.serverTimestamp();
            publicData.migratedAt = admin.firestore.FieldValue.serverTimestamp();

            if (DRY_RUN) {
                console.log(`  [DRY] Would migrate case ${caseId} (tenant: ${data.tenantId || '?'}, ${Object.keys(publicData).length} fields)`);
            } else {
                await publicRef.set(publicData);
                console.log(`  Migrated case ${caseId} (tenant: ${data.tenantId || '?'}, ${Object.keys(publicData).length} fields)`);
            }
            migrated++;
        } catch (err) {
            errors++;
            console.error(`  ERROR on case ${caseId} (tenant: ${data.tenantId || '?'}):`, err.message);
        }

        processed++;

        // Pause between batches to avoid Firestore rate limits
        if (processed % BATCH_SIZE === 0) {
            console.log(`  ... processed ${processed}, pausing ${BATCH_PAUSE_MS}ms ...`);
            await sleep(BATCH_PAUSE_MS);
        }
    }

    console.log(`\nDone. Processed: ${processed}, Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);
    process.exit(errors > 0 ? 1 : 0);
}

migrate();
