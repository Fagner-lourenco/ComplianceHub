/**
 * Backfill: sincroniza campo 'cpf' para clientCases
 * Problema: cpf nunca foi adicionado a IDENTITY_FIELDS, então casos antigos
 * não têm cpf no espelho cliente, quebrando busca por CPF no portal cliente.
 *
 * Uso: node scripts/backfill-cpf-client-cases.cjs [--dry-run]
 */

const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp, getApps } = require('firebase-admin/app');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    if (getApps().length === 0) {
        initializeApp({ projectId: 'compliance-hub-br' });
    }
    const db = getFirestore();

    console.log(`🔍 Buscando casos sem cpf em clientCases...${DRY_RUN ? ' (DRY-RUN)' : ''}`);

    const casesRef = db.collection('cases');
    const snapshot = await casesRef.select('cpf', 'tenantId').get();

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const caseDoc of snapshot.docs) {
        const caseData = caseDoc.data() || {};
        const caseId = caseDoc.id;
        const cpf = caseData.cpf;
        const tenantId = caseData.tenantId;

        if (!cpf || !tenantId) {
            skipped++;
            continue;
        }

        const clientCaseRef = db.collection('clientCases').doc(`${tenantId}_${caseId}`);

        try {
            if (DRY_RUN) {
                console.log(`  [DRY-RUN] ${caseId}: cpf=${cpf}`);
            } else {
                await clientCaseRef.update({ cpf });
                console.log(`  ✅ ${caseId}: cpf=${cpf}`);
            }
            updated++;
        } catch (err) {
            console.error(`  ❌ ${caseId}: ${err.message}`);
            errors++;
        }
    }

    console.log(`\n🏁 Concluído: ${updated} atualizados, ${skipped} ignorados (sem cpf/tenantId), ${errors} erros.`);
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
