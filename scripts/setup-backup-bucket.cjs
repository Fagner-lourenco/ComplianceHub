/**
 * setup-backup-bucket.cjs
 * Script one-time para configurar o bucket de backups do ComplianceHub.
 * 
 * Operacoes:
 * 1. Criar bucket GCS "backups-compliance-hub-br" em southamerica-east1
 * 2. Configurar lifecycle policy (auto-delete apos 7 dias)
 * 3. Conceder permissoes IAM para a service account do Cloud Functions
 *    - roles/datastore.importExportAdmin no projeto (export Firestore)
 *    - roles/storage.objectAdmin no bucket (escrita Auth JSON)
 * 
 * Uso: node scripts/setup-backup-bucket.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const PROJECT_NUMBER = '852520453042';
const BUCKET_NAME = 'backups-compliance-hub-br';
const BUCKET_LOCATION = 'southamerica-east1';

const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function httpsRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getAccessToken() {
    const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
    if (!fs.existsSync(configPath)) {
        throw new Error('Firebase CLI config nao encontrado. Execute "firebase login" primeiro.');
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const refreshToken = config.tokens.refresh_token;
    if (!refreshToken) throw new Error('Refresh token nao encontrado no config do Firebase CLI.');
    
    const postData = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: FIREBASE_CLI_CLIENT_ID,
        client_secret: FIREBASE_CLI_CLIENT_SECRET,
    }).toString();
    
    const res = await httpsRequest({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
    }, postData);
    
    if (res.status !== 200) throw new Error('Token refresh failed: ' + JSON.stringify(res.body));
    return res.body.access_token;
}

async function createBucket(token) {
    console.log(`[1/4] Criando bucket gs://${BUCKET_NAME}...`);
    
    const body = JSON.stringify({
        name: BUCKET_NAME,
        location: BUCKET_LOCATION,
        storageClass: 'STANDARD',
    });
    
    const res = await httpsRequest({
        hostname: 'storage.googleapis.com',
        path: `/storage/v1/b?project=${PROJECT_ID}&predefinedDefaultObjectAcl=private`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    
    if (res.status === 409) {
        console.log(`   Bucket ja existe — ok.`);
        return true;
    }
    if (res.status !== 200) {
        console.error(`   ERRO ao criar bucket (HTTP ${res.status}):`, res.body);
        return false;
    }
    console.log(`   Bucket criado com sucesso.`);
    return true;
}

async function setLifecycle(token) {
    console.log(`[2/4] Configurando lifecycle (auto-delete 7 dias)...`);
    
    const body = JSON.stringify({
        lifecycle: {
            rule: [{
                action: { type: 'Delete' },
                condition: { age: 7 },
            }],
        },
    });
    
    const res = await httpsRequest({
        hostname: 'storage.googleapis.com',
        path: `/storage/v1/b/${BUCKET_NAME}?fields=lifecycle`,
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    
    if (res.status !== 200) {
        console.error(`   ERRO ao configurar lifecycle (HTTP ${res.status}):`, res.body);
        return false;
    }
    console.log(`   Lifecycle configurado: objetos >7 dias serao deletados.`);
    return true;
}

async function addProjectIamBinding(token) {
    console.log(`[3/4] Adicionando datastore.importExportAdmin no projeto...`);
    
    // Get current IAM policy
    const resGet = await httpsRequest({
        hostname: 'cloudresourcemanager.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}:getIamPolicy`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    }, JSON.stringify({}));
    
    if (resGet.status !== 200) {
        console.error(`   ERRO ao obter policy do projeto (HTTP ${resGet.status}):`, resGet.body);
        return false;
    }
    
    const policy = resGet.body;
    const role = 'roles/datastore.importExportAdmin';
    const member = `serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com`;
    
    // Check if already bound
    const existingBinding = (policy.bindings || []).find(b => b.role === role);
    if (existingBinding?.members?.includes(member)) {
        console.log(`   Binding ja existe — ok.`);
        return true;
    }
    
    // Add binding
    if (existingBinding) {
        existingBinding.members.push(member);
    } else {
        policy.bindings = [...(policy.bindings || []), { role, members: [member] }];
    }
    
    const body = JSON.stringify({ policy });
    const resSet = await httpsRequest({
        hostname: 'cloudresourcemanager.googleapis.com',
        path: `/v1/projects/${PROJECT_ID}:setIamPolicy`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    
    if (resSet.status !== 200) {
        console.error(`   ERRO ao atualizar policy do projeto (HTTP ${resSet.status}):`, resSet.body);
        return false;
    }
    console.log(`   Permissao concedida: ${role} -> ${member}`);
    return true;
}

async function addBucketIamBinding(token) {
    console.log(`[4/4] Adicionando storage.objectAdmin no bucket...`);
    
    // Get current IAM policy
    const resGet = await httpsRequest({
        hostname: 'storage.googleapis.com',
        path: `/storage/v1/b/${BUCKET_NAME}/iam`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    
    if (resGet.status !== 200) {
        console.error(`   ERRO ao obter policy do bucket (HTTP ${resGet.status}):`, resGet.body);
        return false;
    }
    
    const policy = resGet.body;
    const role = 'roles/storage.objectAdmin';
    const member = `serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com`;
    
    // Check if already bound
    const existingBinding = (policy.bindings || []).find(b => b.role === role);
    if (existingBinding?.members?.includes(member)) {
        console.log(`   Binding ja existe — ok.`);
        return true;
    }
    
    // Add binding
    if (existingBinding) {
        existingBinding.members.push(member);
    } else {
        policy.bindings = [...(policy.bindings || []), { role, members: [member] }];
    }
    
    const body = JSON.stringify({ bindings: policy.bindings, version: policy.version });
    const resSet = await httpsRequest({
        hostname: 'storage.googleapis.com',
        path: `/storage/v1/b/${BUCKET_NAME}/iam`,
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
    }, body);
    
    if (resSet.status !== 200) {
        console.error(`   ERRO ao atualizar policy do bucket (HTTP ${resSet.status}):`, resSet.body);
        return false;
    }
    console.log(`   Permissao concedida: ${role} -> ${member}`);
    return true;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  SETUP BUCKET DE BACKUP — ComplianceHub');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Projeto:  ${PROJECT_ID}`);
    console.log(`  Bucket:   gs://${BUCKET_NAME}`);
    console.log(`  Regiao:   ${BUCKET_LOCATION}`);
    console.log(`  Lifecycle: delete apos 7 dias`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    const token = await getAccessToken();
    console.log('Token OAuth obtido.\n');
    
    const results = { bucket: false, lifecycle: false, projectIam: false, bucketIam: false };
    
    results.bucket = await createBucket(token);
    if (!results.bucket) {
        console.log('\n❌ Falha ao criar bucket. Abortando.');
        process.exit(1);
    }
    
    // Pequena pausa para propagacao
    await new Promise(r => setTimeout(r, 2000));
    
    results.lifecycle = await setLifecycle(token);
    results.projectIam = await addProjectIamBinding(token);
    results.bucketIam = await addBucketIamBinding(token);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  RESULTADO');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Bucket:            ${results.bucket ? '✅ OK' : '❌ FALHOU'}`);
    console.log(`  Lifecycle (7 dias): ${results.lifecycle ? '✅ OK' : '❌ FALHOU'}`);
    console.log(`  IAM project:        ${results.projectIam ? '✅ OK' : '❌ FALHOU'}`);
    console.log(`  IAM bucket:         ${results.bucketIam ? '✅ OK' : '❌ FALHOU'}`);
    console.log('═══════════════════════════════════════════════════════');
    
    const allOk = results.bucket && results.lifecycle && results.projectIam && results.bucketIam;
    if (allOk) {
        console.log('\n✅ Setup concluido com sucesso!');
        console.log('   Bucket pronto para receber backups.');
    } else {
        console.log('\n⚠️  Setup parcial — verifique os erros acima.');
    }
}

main().catch(err => {
    console.error('\n❌ Erro fatal:', err.message);
    console.error(err.stack);
    process.exit(1);
});
