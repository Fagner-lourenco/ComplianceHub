/**
 * compare-prefill.cjs
 * Compares deterministicPrefill vs prefillNarratives (AI) for auditing.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
 *   node scripts/compare-prefill.cjs [--status DONE] [--max-count 50] [--case-id <id>] [--csv]
 *
 * Flags:
 *   --status <s>    Filter by case status (default: all with deterministicPrefill)
 *   --max-count N   Limit number of cases (default: 50)
 *   --case-id <id>  Analyze a single case
 *   --csv           Output CSV instead of table
 */

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const STATUS_FILTER = (() => {
    const idx = process.argv.indexOf('--status');
    return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
})();

const MAX_COUNT = (() => {
    const idx = process.argv.indexOf('--max-count');
    if (idx === -1 || !process.argv[idx + 1]) return 50;
    const n = parseInt(process.argv[idx + 1], 10);
    return Number.isFinite(n) && n > 0 ? n : 50;
})();

const SINGLE_CASE = (() => {
    const idx = process.argv.indexOf('--case-id');
    return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
})();

const CSV_MODE = process.argv.includes('--csv');

const NARRATIVE_FIELDS = ['executiveSummary', 'criminalNotes', 'laborNotes', 'warrantNotes', 'finalJustification'];

function countChars(val) {
    if (!val) return 0;
    return String(val).length;
}

function countCnjs(text) {
    if (!text) return 0;
    const matches = String(text).match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g);
    return matches ? matches.length : 0;
}

function countWarrantMentions(text) {
    if (!text) return 0;
    const str = String(text).toLowerCase();
    const matches = str.match(/mandado|warrant/gi);
    return matches ? matches.length : 0;
}

function extractMentionedItems(text) {
    if (!text) return new Set();
    const items = new Set();
    // CNJs
    const cnjs = String(text).match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [];
    cnjs.forEach((c) => items.add(c));
    // Flags mentioned
    for (const flag of ['POSITIVO', 'NEGATIVO', 'INCONCLUSIVO', 'NAO ENCONTRADO', 'POSITIVE', 'NEGATIVE']) {
        if (String(text).includes(flag)) items.add(flag);
    }
    return items;
}

function computeOmissions(detText, aiText) {
    const detItems = extractMentionedItems(detText);
    const aiItems = extractMentionedItems(aiText);

    const aiOmitted = [];
    const detOmitted = [];

    for (const item of detItems) {
        if (!aiItems.has(item)) aiOmitted.push(item);
    }
    for (const item of aiItems) {
        if (!detItems.has(item)) detOmitted.push(item);
    }

    return { aiOmitted, detOmitted };
}

function compareKeyFindings(detFindings, aiFindings) {
    const detSet = new Set((detFindings || []).map((f) => String(f).trim().toLowerCase()));
    const aiSet = new Set((aiFindings || []).map((f) => String(f).trim().toLowerCase()));

    const onlyInDet = [];
    const onlyInAi = [];

    for (const f of detFindings || []) {
        if (!aiSet.has(String(f).trim().toLowerCase())) onlyInDet.push(f);
    }
    for (const f of aiFindings || []) {
        if (!detSet.has(String(f).trim().toLowerCase())) onlyInAi.push(f);
    }

    return { onlyInDet, onlyInAi, detCount: (detFindings || []).length, aiCount: (aiFindings || []).length };
}

function computeAnalystDistance(fieldName, detValue, aiValue, caseData) {
    // For DONE cases: compare against final saved value
    const finalValue = caseData[fieldName];
    if (!finalValue) return { detDistance: null, aiDistance: null };

    const finalStr = Array.isArray(finalValue) ? finalValue.join(' ') : String(finalValue);
    const detStr = Array.isArray(detValue) ? detValue.join(' ') : String(detValue || '');
    const aiStr = Array.isArray(aiValue) ? aiValue.join(' ') : String(aiValue || '');

    // Simple character-level distance ratio
    const detDistance = finalStr.length > 0 ? Math.abs(finalStr.length - detStr.length) / finalStr.length : null;
    const aiDistance = finalStr.length > 0 ? Math.abs(finalStr.length - aiStr.length) / finalStr.length : null;

    // Content overlap: count shared CNJs
    const finalCnjs = new Set((finalStr.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || []));
    const detCnjs = new Set((detStr.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || []));
    const aiCnjs = new Set((aiStr.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || []));

    let detCnjOverlap = 0;
    let aiCnjOverlap = 0;
    for (const c of finalCnjs) {
        if (detCnjs.has(c)) detCnjOverlap++;
        if (aiCnjs.has(c)) aiCnjOverlap++;
    }

    return {
        detDistance: detDistance !== null ? detDistance.toFixed(2) : 'N/A',
        aiDistance: aiDistance !== null ? aiDistance.toFixed(2) : 'N/A',
        finalCnjCount: finalCnjs.size,
        detCnjOverlap,
        aiCnjOverlap,
    };
}

function analyzeCase(caseId, caseData) {
    const det = caseData.deterministicPrefill || {};
    const ai = caseData.prefillNarratives || {};
    const isDone = caseData.status === 'DONE';

    const report = {
        caseId,
        candidateName: caseData.candidateName || 'N/A',
        status: caseData.status || 'N/A',
        criminalFlag: caseData.criminalFlag || 'N/A',
        warrantFlag: caseData.warrantFlag || 'N/A',
        laborFlag: caseData.laborFlag || 'N/A',
        detVersion: det.metadata?.version || 'N/A',
        detIsComplex: det.metadata?.isComplex || false,
        detTriggers: (det.metadata?.triggersActive || []).join(', ') || 'none',
        aiOk: ai.metadata?.ok || false,
        fields: {},
    };

    // Compare narrative fields
    for (const field of NARRATIVE_FIELDS) {
        const detVal = det[field];
        const aiVal = ai[field];
        const omissions = computeOmissions(detVal, aiVal);
        const analystDist = isDone ? computeAnalystDistance(field, detVal, aiVal, caseData) : null;

        report.fields[field] = {
            detChars: countChars(detVal),
            aiChars: countChars(aiVal),
            detCnjs: countCnjs(detVal),
            aiCnjs: countCnjs(aiVal),
            detWarrants: countWarrantMentions(detVal),
            aiWarrants: countWarrantMentions(aiVal),
            aiOmitted: omissions.aiOmitted,
            detOmitted: omissions.detOmitted,
            ...(analystDist || {}),
        };
    }

    // Compare keyFindings
    const kfComparison = compareKeyFindings(det.keyFindings, ai.keyFindings);
    report.fields.keyFindings = {
        detCount: kfComparison.detCount,
        aiCount: kfComparison.aiCount,
        onlyInDet: kfComparison.onlyInDet,
        onlyInAi: kfComparison.onlyInAi,
    };

    return report;
}

function printReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log(`Case: ${report.caseId} | ${report.candidateName}`);
    console.log(`Status: ${report.status} | Criminal: ${report.criminalFlag} | Warrant: ${report.warrantFlag} | Labor: ${report.laborFlag}`);
    console.log(`Det version: ${report.detVersion} | Complex: ${report.detIsComplex} | Triggers: ${report.detTriggers}`);
    console.log(`AI OK: ${report.aiOk}`);
    console.log('-'.repeat(80));

    for (const [field, data] of Object.entries(report.fields)) {
        if (field === 'keyFindings') {
            console.log(`\n  [keyFindings]`);
            console.log(`    Det count: ${data.detCount}  |  AI count: ${data.aiCount}`);
            if (data.onlyInDet.length > 0) {
                console.log(`    Only in DET (${data.onlyInDet.length}):`);
                data.onlyInDet.forEach((f) => console.log(`      - ${f}`));
            }
            if (data.onlyInAi.length > 0) {
                console.log(`    Only in AI (${data.onlyInAi.length}):`);
                data.onlyInAi.forEach((f) => console.log(`      - ${f}`));
            }
            continue;
        }

        console.log(`\n  [${field}]`);
        console.log(`    Chars:    Det=${data.detChars}  AI=${data.aiChars}  (delta=${data.detChars - data.aiChars})`);
        console.log(`    CNJs:     Det=${data.detCnjs}  AI=${data.aiCnjs}`);
        console.log(`    Warrants: Det=${data.detWarrants}  AI=${data.aiWarrants}`);

        if (data.aiOmitted.length > 0) {
            console.log(`    AI OMITTED (present in Det, missing in AI): ${data.aiOmitted.join(', ')}`);
        }
        if (data.detOmitted.length > 0) {
            console.log(`    Det OMITTED (present in AI, missing in Det): ${data.detOmitted.join(', ')}`);
        }

        if (data.detDistance !== undefined && data.detDistance !== null) {
            console.log(`    Analyst distance: Det=${data.detDistance}  AI=${data.aiDistance}  (final CNJs: ${data.finalCnjCount}, det overlap: ${data.detCnjOverlap}, ai overlap: ${data.aiCnjOverlap})`);
        }
    }
}

function printCsv(reports) {
    const headers = [
        'caseId', 'candidateName', 'status', 'criminalFlag', 'warrantFlag', 'laborFlag',
        'detIsComplex', 'detTriggers', 'aiOk',
    ];
    for (const field of [...NARRATIVE_FIELDS, 'keyFindings']) {
        if (field === 'keyFindings') {
            headers.push('kf_detCount', 'kf_aiCount', 'kf_onlyInDetCount', 'kf_onlyInAiCount');
        } else {
            headers.push(`${field}_detChars`, `${field}_aiChars`, `${field}_detCnjs`, `${field}_aiCnjs`,
                `${field}_aiOmittedCount`, `${field}_detOmittedCount`);
        }
    }
    console.log(headers.join(','));

    for (const r of reports) {
        const row = [
            r.caseId, `"${r.candidateName}"`, r.status, r.criminalFlag, r.warrantFlag, r.laborFlag,
            r.detIsComplex, `"${r.detTriggers}"`, r.aiOk,
        ];
        for (const field of [...NARRATIVE_FIELDS, 'keyFindings']) {
            const d = r.fields[field] || {};
            if (field === 'keyFindings') {
                row.push(d.detCount || 0, d.aiCount || 0, (d.onlyInDet || []).length, (d.onlyInAi || []).length);
            } else {
                row.push(d.detChars || 0, d.aiChars || 0, d.detCnjs || 0, d.aiCnjs || 0,
                    (d.aiOmitted || []).length, (d.detOmitted || []).length);
            }
        }
        console.log(row.join(','));
    }
}

function printSummary(reports) {
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total cases analyzed: ${reports.length}`);

    const complexCount = reports.filter((r) => r.detIsComplex).length;
    console.log(`Complex cases: ${complexCount} (${((complexCount / reports.length) * 100).toFixed(0)}%)`);

    const aiOkCount = reports.filter((r) => r.aiOk).length;
    console.log(`AI prefill OK: ${aiOkCount}/${reports.length}`);

    // Aggregate omissions
    let totalAiOmissions = 0;
    let totalDetOmissions = 0;
    for (const r of reports) {
        for (const field of NARRATIVE_FIELDS) {
            const d = r.fields[field] || {};
            totalAiOmissions += (d.aiOmitted || []).length;
            totalDetOmissions += (d.detOmitted || []).length;
        }
    }
    console.log(`Total AI omissions (items in Det missing from AI): ${totalAiOmissions}`);
    console.log(`Total Det omissions (items in AI missing from Det): ${totalDetOmissions}`);

    // Chars comparison per field
    for (const field of [...NARRATIVE_FIELDS, 'keyFindings']) {
        let detTotal = 0;
        let aiTotal = 0;
        for (const r of reports) {
            const d = r.fields[field] || {};
            if (field === 'keyFindings') {
                detTotal += d.detCount || 0;
                aiTotal += d.aiCount || 0;
            } else {
                detTotal += d.detChars || 0;
                aiTotal += d.aiChars || 0;
            }
        }
        const metric = field === 'keyFindings' ? 'items' : 'chars';
        const avg = (v) => reports.length > 0 ? (v / reports.length).toFixed(0) : 0;
        console.log(`  ${field}: Det avg=${avg(detTotal)} ${metric}, AI avg=${avg(aiTotal)} ${metric}`);
    }

    // Trigger frequency
    const triggerCounts = {};
    for (const r of reports) {
        for (const t of (r.detTriggers || '').split(', ').filter(Boolean)) {
            if (t === 'none') continue;
            triggerCounts[t] = (triggerCounts[t] || 0) + 1;
        }
    }
    if (Object.keys(triggerCounts).length > 0) {
        console.log('\nComplexity trigger frequency:');
        for (const [trigger, count] of Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])) {
            console.log(`  ${trigger}: ${count}/${reports.length}`);
        }
    }
}

async function main() {
    console.log('ComplianceHub — Deterministic vs AI Prefill Comparison');
    console.log('='.repeat(80));

    let snapshot;

    if (SINGLE_CASE) {
        const doc = await db.collection('cases').doc(SINGLE_CASE).get();
        if (!doc.exists) {
            console.error(`Case ${SINGLE_CASE} not found.`);
            process.exit(1);
        }
        snapshot = { docs: [doc], size: 1 };
    } else {
        let query = db.collection('cases')
            .where('deterministicPrefill.metadata.source', '==', 'deterministic')
            .limit(MAX_COUNT);

        if (STATUS_FILTER) {
            query = db.collection('cases')
                .where('deterministicPrefill.metadata.source', '==', 'deterministic')
                .where('status', '==', STATUS_FILTER)
                .limit(MAX_COUNT);
        }

        snapshot = await query.get();
    }

    if (snapshot.size === 0) {
        console.log('No cases with deterministicPrefill found.');
        console.log('Tip: cases will have deterministicPrefill after running through the updated pipeline.');
        process.exit(0);
    }

    console.log(`Found ${snapshot.size} case(s) to analyze.\n`);

    const reports = [];

    for (const doc of snapshot.docs) {
        const caseData = doc.data();
        if (!caseData.deterministicPrefill) continue;
        const report = analyzeCase(doc.id, caseData);
        reports.push(report);

        if (!CSV_MODE) {
            printReport(report);
        }
    }

    if (CSV_MODE) {
        printCsv(reports);
    } else {
        printSummary(reports);
    }

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
