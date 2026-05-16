/**
 * Repair custom claims for all users in userProfiles.
 * Uses Firebase CLI credentials (same pattern as fix-tenant-configs.js).
 *
 * Usage: cd functions && node repair-all-claims.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Build Application Default Credentials from Firebase CLI's stored refresh_token
function setupCredentials() {
    const configPaths = [
        path.join(process.env.USERPROFILE || process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json'),
        path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json'),
    ];
    for (const p of configPaths) {
        if (fs.existsSync(p)) {
            const data = JSON.parse(fs.readFileSync(p, 'utf8'));
            if (data.tokens?.refresh_token) {
                const adcPayload = {
                    type: 'authorized_user',
                    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
                    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
                    refresh_token: data.tokens.refresh_token,
                };
                const tmpFile = path.join(os.tmpdir(), `firebase-adc-${Date.now()}.json`);
                fs.writeFileSync(tmpFile, JSON.stringify(adcPayload));
                process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpFile;
                console.log(`Using Firebase CLI credentials from ${p}`);
                return tmpFile;
            }
        }
    }
    return null;
}

const tmpAdcFile = setupCredentials();
function cleanupTmpAdcFile() {
    if (!tmpAdcFile) return;
    try {
        fs.unlinkSync(tmpAdcFile);
    } catch (err) {
        console.warn('Nao foi possivel remover arquivo ADC temporario:', err.message || err);
    }
}

admin.initializeApp({ projectId: 'compliance-hub-br' });
const db = admin.firestore();
const auth = admin.auth();

async function repairAllClaims() {
    const snapshot = await db.collection('userProfiles').get();
    console.log(`\nFound ${snapshot.size} user profiles.\n`);

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
    cleanupTmpAdcFile();
    process.exit(0);
}

repairAllClaims().catch((err) => {
    console.error('Fatal error:', err);
    cleanupTmpAdcFile();
    process.exit(1);
});
