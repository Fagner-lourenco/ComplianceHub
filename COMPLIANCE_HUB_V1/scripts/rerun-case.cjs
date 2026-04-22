/**
 * rerun-case.js
 * Re-triggers the full enrichment pipeline for a specific case.
 *
 * Since enrichFonteDataOnCase uses onDocumentCreated, the only way
 * to re-trigger is to delete the document and recreate it with clean fields.
 * The original caseId is preserved.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
 *   node scripts/rerun-case.js <caseId> [--confirm]
 */

const admin = require('firebase-admin');
const readline = require('readline');

admin.initializeApp();
const db = admin.firestore();

// Fields that are set by enrichment pipeline — will be stripped on recreate
const ENRICHMENT_FIELDS = [
    // FonteData
    'enrichmentStatus', 'enrichmentError', 'enrichmentCompletedAt',
    'gateStatus', 'gateSituacao', 'gateNameFromRF', 'gateNameSimilarity',
    'identitySource', 'identityData',
    'criminalFlag', 'criminalSeverity', 'criminalNotes', 'criminalHits', 'criminalProcesses',
    'warrantFlag', 'warrantNotes', 'warrantHits', 'warrantData',
    'laborFlag', 'laborSeverity', 'laborNotes', 'laborHits', 'laborProcesses',
    'escalated', 'escalationTriggers', 'escalationData',
    'enrichmentCostBRL', 'enrichmentProviderCalls',
    // Escavador
    'escavadorEnrichmentStatus', 'escavadorEnrichmentError', 'escavadorCompletedAt',
    'escavadorProcesses', 'escavadorProcessCount', 'escavadorCostBRL',
    'escavadorFilteredTribunais', 'escavadorQueryMode',
    // Judit
    'juditEnrichmentStatus', 'juditEnrichmentError', 'juditCompletedAt',
    'juditLawsuits', 'juditLawsuitCount', 'juditWarrants', 'juditWarrantCount',
    'juditExecution', 'juditExecutionCount', 'juditCostBRL',
    'juditFilteredTribunais', 'juditRequestIds',
    // AI
    'aiRawResponse', 'aiStructured', 'aiStructuredOk', 'aiModel', 'aiPromptVersion',
    'aiExecutedAt', 'aiRunCount', 'aiCostUSD', 'aiTokensIn', 'aiTokensOut',
    'aiProvidersIncluded', 'aiCacheKey', 'aiCacheHit', 'aiDecision',
    // Aggregated scores
    'riskScore', 'riskLevel', 'finalVerdict', 'analystComment',
    'osintLevel', 'osintVectors', 'osintNotes',
    'socialStatus', 'socialReasons', 'socialNotes',
    'digitalFlag', 'digitalVectors', 'digitalNotes',
    'conflictInterest', 'conflictNotes',
    // Status artifacts
    'status',
];

// Fields to preserve (case identity + tenant)
const PRESERVE_FIELDS = [
    'candidateName', 'cpf', 'cpfMasked', 'candidatePosition', 'hiringUf',
    'tenantId', 'createdBy', 'createdAt', 'requestedBy',
    'enabledPhases', 'notes',
];

function askConfirmation(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

async function main() {
    const caseId = process.argv[2];
    const autoConfirm = process.argv.includes('--confirm');

    if (!caseId) {
        console.error('Usage: node scripts/rerun-case.js <caseId> [--confirm]');
        process.exit(1);
    }

    const caseRef = db.collection('cases').doc(caseId);
    const caseDoc = await caseRef.get();

    if (!caseDoc.exists) {
        console.error(`Case ${caseId} not found.`);
        process.exit(1);
    }

    const original = caseDoc.data();
    console.log(`\nCase found:`);
    console.log(`  ID:       ${caseId}`);
    console.log(`  Name:     ${original.candidateName || '?'}`);
    console.log(`  CPF:      ${original.cpfMasked || original.cpf || '?'}`);
    console.log(`  Tenant:   ${original.tenantId || '?'}`);
    console.log(`  Status:   ${original.status || '?'}`);
    console.log(`  FD:       ${original.enrichmentStatus || 'none'}`);
    console.log(`  Escav:    ${original.escavadorEnrichmentStatus || 'none'}`);
    console.log(`  Judit:    ${original.juditEnrichmentStatus || 'none'}`);
    console.log(`  AI:       ${original.aiStructuredOk ? 'OK' : 'none'}`);

    if (!autoConfirm) {
        const answer = await askConfirmation(
            '\n⚠️  This will DELETE and RECREATE this case to re-trigger the full pipeline.\n' +
            '   All enrichment data will be lost. Case identity fields are preserved.\n' +
            '   Type "yes" to proceed: '
        );
        if (answer !== 'yes') {
            console.log('Aborted.');
            process.exit(0);
        }
    }

    // Build clean document: keep identity fields, reset everything else
    const cleanData = {};
    for (const field of PRESERVE_FIELDS) {
        if (original[field] !== undefined) {
            cleanData[field] = original[field];
        }
    }
    // Also preserve any custom fields not in either list
    // (but exclude enrichment fields)
    const enrichSet = new Set(ENRICHMENT_FIELDS);
    const preserveSet = new Set(PRESERVE_FIELDS);
    for (const [key, value] of Object.entries(original)) {
        if (!enrichSet.has(key) && !preserveSet.has(key)) {
            cleanData[key] = value;
        }
    }

    // Reset status to PENDING with fresh timestamp
    cleanData.status = 'PENDING';
    cleanData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    // Keep original createdAt if present, else set new one
    if (!cleanData.createdAt) {
        cleanData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    // Step 1: Delete publicResult subcollection if exists
    try {
        const publicSnap = await caseRef.collection('publicResult').get();
        for (const doc of publicSnap.docs) {
            await doc.ref.delete();
        }
        if (publicSnap.size > 0) console.log(`  Deleted ${publicSnap.size} publicResult doc(s).`);
    } catch (err) {
        console.warn(`  Warning: could not clean publicResult subcollection:`, err.message);
    }

    // Step 2: Delete aiCache subcollection if exists
    try {
        const cacheSnap = await caseRef.collection('aiCache').get();
        for (const doc of cacheSnap.docs) {
            await doc.ref.delete();
        }
        if (cacheSnap.size > 0) console.log(`  Deleted ${cacheSnap.size} aiCache doc(s).`);
    } catch (err) {
        console.warn(`  Warning: could not clean aiCache subcollection:`, err.message);
    }

    // Step 3: Delete original document
    await caseRef.delete();
    console.log(`  Deleted case ${caseId}.`);

    // Step 4: Recreate with same ID → triggers onDocumentCreated
    await caseRef.set(cleanData);
    console.log(`  Recreated case ${caseId} with clean data.`);
    console.log(`\n✅ Pipeline re-triggered. FonteData → Escavador → Judit → AI will run automatically.`);

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
