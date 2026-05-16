/**
 * Script to repair custom claims for all users in userProfiles.
 * Run: node scripts/repair-all-claims.cjs
 */

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ projectId: 'compliance-hub-br' });

const db = getFirestore();
const auth = getAuth();

async function repairAllClaims() {
    const snapshot = await db.collection('userProfiles').get();
    console.log(`Found ${snapshot.size} user profiles.`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const uid = doc.id;

        if (!data.role || !data.tenantId) {
            console.log(`  SKIP ${uid}: missing role (${data.role}) or tenantId (${data.tenantId})`);
            skipped++;
            continue;
        }

        try {
            await auth.setCustomUserClaims(uid, {
                role: data.role,
                tenantId: data.tenantId,
            });
            console.log(`  FIXED ${uid}: role=${data.role}, tenantId=${data.tenantId}`);
            fixed++;
        } catch (err) {
            console.error(`  ERROR ${uid}:`, err.message);
            errors++;
        }
    }

    console.log(`\nDone! Fixed: ${fixed}, Skipped: ${skipped}, Errors: ${errors}`);
    process.exit(0);
}

repairAllClaims().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
