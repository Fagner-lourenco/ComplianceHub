/**
 * One-time migration script: Fix tenant enrichmentConfig in Firestore.
 *
 * Problem: UI previously had wrong defaults (judit.enabled=false, execution=false,
 * escavador.incluirHomonimos=false). Tenants that saved config via UI inherited
 * those broken values into Firestore, overriding the correct backend defaults.
 *
 * Fixes applied per tenant:
 *   1. judit.enabled:                   false/undefined → true
 *   2. judit.phases.entity:             false/undefined → true  (gate R$0.12 — always on)
 *   3. judit.phases.execution:          false/undefined → true  (R$0.50)
 *   4. judit.phases.lawsuits:           undefined       → true  (R$0.50 sync)
 *   5. judit.phases.warrant:            undefined       → true  (R$1.00)
 *   6. judit.filters.useAsync:          undefined       → false (sync datalake default)
 *   7. escavador.filters.incluirHomonimos: false        → true  (critical for non-indexed CPFs)
 *
 * Usage:  cd functions && node fix-tenant-configs.js
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
                // Write a temporary ADC file in authorized_user format
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
admin.initializeApp({ projectId: 'compliance-hub-br' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function fixTenantConfigs() {
    const snapshot = await db.collection('tenantSettings').get();
    console.log(`\n🔍 Found ${snapshot.size} tenant setting(s) to audit.\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const doc of snapshot.docs) {
        const tenantId = doc.id;
        const data = doc.data();
        const ec = data.enrichmentConfig;

        if (!ec) {
            console.log(`  [${tenantId}] ⏭  No enrichmentConfig — skipping.`);
            skippedCount++;
            continue;
        }

        const fixes = {};
        const notes = [];

        // --- Judit fixes ---

        // 1. judit.enabled
        if (ec.judit?.enabled !== true) {
            fixes['enrichmentConfig.judit.enabled'] = true;
            notes.push(`judit.enabled: ${ec.judit?.enabled} → true`);
        }

        // 2. judit.phases.entity (gate — always on when Judit enabled)
        if (ec.judit?.phases?.entity !== true) {
            fixes['enrichmentConfig.judit.phases.entity'] = true;
            notes.push(`judit.phases.entity: ${ec.judit?.phases?.entity} → true`);
        }

        // 3. judit.phases.execution
        if (ec.judit?.phases?.execution !== true) {
            fixes['enrichmentConfig.judit.phases.execution'] = true;
            notes.push(`judit.phases.execution: ${ec.judit?.phases?.execution} → true`);
        }

        // 4. judit.phases.lawsuits
        if (ec.judit?.phases?.lawsuits === undefined) {
            fixes['enrichmentConfig.judit.phases.lawsuits'] = true;
            notes.push(`judit.phases.lawsuits: undefined → true`);
        }

        // 5. judit.phases.warrant
        if (ec.judit?.phases?.warrant === undefined) {
            fixes['enrichmentConfig.judit.phases.warrant'] = true;
            notes.push(`judit.phases.warrant: undefined → true`);
        }

        // 6. judit.filters.useAsync (must be explicitly false — sync datalake default)
        if (ec.judit?.filters?.useAsync === undefined) {
            fixes['enrichmentConfig.judit.filters.useAsync'] = false;
            notes.push(`judit.filters.useAsync: undefined → false`);
        }

        // --- Escavador fixes ---

        // 7. escavador.filters.incluirHomonimos (MUST be true — critical for non-indexed CPFs)
        if (ec.escavador?.filters?.incluirHomonimos === false) {
            fixes['enrichmentConfig.escavador.filters.incluirHomonimos'] = true;
            notes.push(`escavador.filters.incluirHomonimos: false → true`);
        }

        // --- Apply ---

        if (Object.keys(fixes).length === 0) {
            console.log(`  [${tenantId}] ✅ Config OK — no fixes needed.`);
            continue;
        }

        // Add migration metadata
        fixes['enrichmentConfig._migrationApplied'] = 'judit-first-defaults-v1';
        fixes['enrichmentConfig._migrationAt'] = FieldValue.serverTimestamp();

        await doc.ref.update(fixes);
        fixedCount++;
        console.log(`  [${tenantId}] 🔧 FIXED (${notes.length} change${notes.length > 1 ? 's' : ''}):`);
        notes.forEach((n) => console.log(`      • ${n}`));
    }

    console.log(`\n✅ Done. Fixed: ${fixedCount} | OK: ${snapshot.size - fixedCount - skippedCount} | Skipped: ${skippedCount} | Total: ${snapshot.size}\n`);
}

fixTenantConfigs()
    .then(() => {
        if (tmpAdcFile) try { require('fs').unlinkSync(tmpAdcFile); } catch {}
        process.exit(0);
    })
    .catch((err) => {
        if (tmpAdcFile) try { require('fs').unlinkSync(tmpAdcFile); } catch {}
        console.error('\n❌ Script failed:', err.message || err);
        process.exit(1);
    });
