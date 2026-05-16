/**
 * Promove um usuario para admin global (tenantId null = acesso a todas as franquias).
 * 
 * Uso: node scripts/promote-to-admin.cjs <email>
 * Ex:  node scripts/promote-to-admin.cjs analista@compliancehub.com
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');

const targetEmail = process.argv[2];
if (!targetEmail) {
    console.error('Uso: node scripts/promote-to-admin.cjs <email>');
    process.exit(1);
}

// ── Credenciais (Firebase CLI) ────────────────────────────────────────────────

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
                console.log(`Credenciais carregadas de: ${p}`);
                return tmpFile;
            }
        }
    }
    console.error('Firebase CLI credentials nao encontradas. Execute "firebase login" primeiro.');
    return null;
}

function cleanup(tmpAdcFile) {
    if (!tmpAdcFile) return;
    try { fs.unlinkSync(tmpAdcFile); } catch (err) { /* ignore */ }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function promoteToAdmin() {
    const tmpAdcFile = setupCredentials();
    if (!tmpAdcFile) process.exit(1);

    admin.initializeApp({ projectId: 'compliance-hub-br' });
    const db = admin.firestore();
    const auth = admin.auth();

    try {
        // 1. Encontrar usuario por email
        console.log(`\nBuscando usuario: ${targetEmail}`);
        const userRecord = await auth.getUserByEmail(targetEmail);
        const uid = userRecord.uid;
        console.log(`UID encontrado: ${uid}`);
        console.log(`Claims atuais: ${JSON.stringify(userRecord.customClaims || {})}`);

        // 2. Atualizar userProfiles
        const profileRef = db.collection('userProfiles').doc(uid);
        const profileDoc = await profileRef.get();
        
        if (!profileDoc.exists) {
            console.error(`ERRO: userProfiles/${uid} nao encontrado.`);
            cleanup(tmpAdcFile);
            process.exit(1);
        }

        const currentProfile = profileDoc.data();
        console.log(`\nPerfil atual:`);
        console.log(`  role:     ${currentProfile.role}`);
        console.log(`  tenantId: ${currentProfile.tenantId}`);
        console.log(`  tenantName: ${currentProfile.tenantName}`);

        await profileRef.update({
            role: 'admin',
            tenantId: admin.firestore.FieldValue.delete(),
            tenantName: admin.firestore.FieldValue.delete(),
        });
        console.log(`\nPerfil atualizado: role=admin, tenantId removido`);

        // 3. Atualizar custom claims
        await auth.setCustomUserClaims(uid, { role: 'admin', tenantId: null });
        console.log(`Custom claims atualizadas: { role: 'admin', tenantId: null }`);

        console.log(`\nPronto! ${targetEmail} agora e admin global com acesso a todas as franquias.`);
        console.log(`O usuario deve fazer logout/login para receber as novas claims.`);
    } catch (err) {
        console.error('Erro:', err.message);
        process.exitCode = 1;
    } finally {
        cleanup(tmpAdcFile);
    }
}

promoteToAdmin();
