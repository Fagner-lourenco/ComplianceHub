/**
 * backupWorker.js
 * Cloud Function que executa backup diario do Firestore e Firebase Auth.
 * 
 * Agenda: todo dia as 02:00 (horario de Brasilia), cron: 0 2 * * *
 * Output: gs://backups-compliance-hub-br/firestore/<data>/ e .../auth/<data>/
 * Retencao: lifecycle do bucket apaga objetos com >7 dias.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'compliance-hub-br';
const BUCKET_NAME = 'backups-compliance-hub-br';

async function exportFirestore(dateStr) {
    const token = await admin.app().options.credential.getAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            outputUriPrefix: `gs://${BUCKET_NAME}/firestore/${dateStr}`,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Firestore export API retornou HTTP ${response.status}: ${text}`);
    }

    const result = await response.json();
    console.log(`[backupDaily] Firestore export iniciado: ${result.name}`);
    return result.name;
}

async function exportAuth(dateStr) {
    const allUsers = [];
    let pageToken;

    do {
        const result = await admin.auth().listUsers(1000, pageToken);
        allUsers.push(...result.users.map(u => ({
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            phoneNumber: u.phoneNumber,
            disabled: u.disabled,
            emailVerified: u.emailVerified,
            providerData: (u.providerData || []).map(p => ({
                providerId: p.providerId,
                uid: p.uid,
                email: p.email,
                displayName: p.displayName,
                phoneNumber: p.phoneNumber,
                photoURL: p.photoURL,
            })),
            customClaims: u.customClaims || null,
            createdAt: u.metadata.creationTime,
            lastSignInAt: u.metadata.lastSignInTime,
            lastRefreshAt: u.metadata.lastRefreshTime,
        })));
        pageToken = result.pageToken;
    } while (pageToken);

    const bucket = admin.storage().bucket(BUCKET_NAME);
    const file = bucket.file(`auth/${dateStr}/users.json`);
    await file.save(JSON.stringify(allUsers, null, 2), {
        contentType: 'application/json',
        gzip: true,
    });

    console.log(`[backupDaily] Auth export: ${allUsers.length} usuarios salvos`);
    return allUsers.length;
}

function createBackupWorkerHandler() {
    return onSchedule(
        {
            schedule: '0 2 * * *',
            timeZone: 'America/Sao_Paulo',
            region: 'southamerica-east1',
            timeoutSeconds: 300,
            memory: '512MiB',
        },
        async () => {
            const dateStr = new Date().toISOString().split('T')[0];
            console.log(`[backupDaily] Iniciando backup diario para ${dateStr}`);

            let firestoreOk = false;
            let authOk = false;

            try {
                const opName = await exportFirestore(dateStr);
                firestoreOk = true;
                console.log(`[backupDaily] Firestore: OK — operacao ${opName.split('/').pop()}`);
            } catch (err) {
                console.error(`[backupDaily] Firestore: ERRO —`, err.message);
            }

            try {
                const count = await exportAuth(dateStr);
                authOk = true;
                console.log(`[backupDaily] Auth: OK — ${count} usuarios`);
            } catch (err) {
                console.error(`[backupDaily] Auth: ERRO —`, err.message);
            }

            const status = firestoreOk && authOk ? 'COMPLETO' : 'PARCIAL';
            console.log(`[backupDaily] Backup ${dateStr} ${status} | Firestore=${firestoreOk ? 'OK' : 'FALHOU'} | Auth=${authOk ? 'OK' : 'FALHOU'}`);
        },
    );
}

module.exports = { createBackupWorkerHandler };
