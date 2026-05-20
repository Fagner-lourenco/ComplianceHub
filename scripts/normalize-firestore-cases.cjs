/**
 * normalize-firestore-cases.cjs
 * Migra dados existentes no Firestore normalizando caracteres Unicode problematicos.
 * 
 * Caracteres convertidos:
 * - Smart quotes (", ", ', ') → ", '
 * - Em-dash (—) → --
 * - En-dash (–) → -
 * - Ellipsis (…) → ...
 * - Non-breaking space ( ) → espaço regular
 * 
 * Campos verificados:
 * - executiveSummary, keyFindings, criminalNotes, laborNotes, warrantNotes
 * - analystComment, finalJustification, processHighlights, warrantFindings
 * - prefillNarratives.* (executiveSummary, keyFindings, etc.)
 * - reviewDraft.* (mesmos campos)
 * - aiStructured.resumo, aiStructured.evidencias
 * 
 * Uso: node scripts/normalize-firestore-cases.cjs [--dry-run] [--tenant-id=<id>]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'compliance-hub-br';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

// Configuração
const DRY_RUN = process.argv.includes('--dry-run');
const TENANT_FILTER = process.argv.find(arg => arg.startsWith('--tenant-id='))?.split('=')[1];
const BATCH_SIZE = 50;

function httpsRequest(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getAccessToken() {
    const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const refreshToken = config.tokens.refresh_token;
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

function fromFirestoreValue(v) {
    if (!v) return null;
    if (v.stringValue !== undefined) return v.stringValue;
    if (v.integerValue !== undefined) return Number(v.integerValue);
    if (v.doubleValue !== undefined) return v.doubleValue;
    if (v.booleanValue !== undefined) return v.booleanValue;
    if (v.timestampValue !== undefined) return v.timestampValue;
    if (v.nullValue !== undefined) return null;
    if (v.arrayValue) return (v.arrayValue.values || []).map(fromFirestoreValue);
    if (v.mapValue) {
        const obj = {};
        for (const [k, val] of Object.entries(v.mapValue.fields || {})) obj[k] = fromFirestoreValue(val);
        return obj;
    }
    return JSON.stringify(v);
}

function toFirestoreValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'string') return { stringValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
    if (typeof v === 'object') {
        const fields = {};
        for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val);
        return { mapValue: { fields } };
    }
    return { stringValue: String(v) };
}

// Normalizacao Unicode → ASCII (mesma logica do backend)
function normalizeUnicodeToAscii(text) {
    if (!text || typeof text !== 'string') return text;
    return text
        .replace(/[\u2018\u2019]/g, "'")   // smart single quotes → apostrophe
        .replace(/[\u201C\u201D]/g, '"')   // smart double quotes → straight quotes
        .replace(/\u2014/g, '--')           // em-dash → double hyphen
        .replace(/\u2013/g, '-')            // en-dash → hyphen
        .replace(/\u2026/g, '...')          // ellipsis → three dots
        .replace(/\u00A0/g, ' ');           // non-breaking space → regular space
}

// Verifica se texto contem caracteres Unicode problematicos
function hasUnicodeToNormalize(text) {
    if (!text || typeof text !== 'string') return false;
    return /[\u2018\u2019\u201C\u201D\u2014\u2013\u2026\u00A0]/.test(text);
}

// Campos textuais a verificar no nivel raiz do case
const ROOT_TEXT_FIELDS = [
    'executiveSummary',
    'criminalNotes',
    'laborNotes',
    'warrantNotes',
    'analystComment',
    'finalJustification',
    'processHighlights',
    'warrantFindings',
];

// Campos textuais dentro de objetos aninhados
const NESTED_PATHS = [
    { path: ['prefillNarratives'], fields: ['executiveSummary', 'keyFindings', 'criminalNotes', 'laborNotes', 'warrantNotes', 'finalJustification'] },
    { path: ['reviewDraft'], fields: ['executiveSummary', 'keyFindings', 'criminalNotes', 'laborNotes', 'warrantNotes', 'analystComment', 'finalJustification'] },
    { path: ['aiStructured'], fields: ['resumo', 'justificativa', 'recomendacao'] },
];

// Normaliza um objeto case retornando { updated, changed, changes }
function normalizeCase(caseData) {
    const updated = JSON.parse(JSON.stringify(caseData));
    let changed = false;
    const changes = [];

    // Campos raiz
    for (const field of ROOT_TEXT_FIELDS) {
        if (field === 'keyFindings') {
            // keyFindings é array de strings
            if (Array.isArray(updated[field])) {
                const original = JSON.stringify(updated[field]);
                updated[field] = updated[field].map(item => {
                    if (typeof item === 'string' && hasUnicodeToNormalize(item)) {
                        return normalizeUnicodeToAscii(item);
                    }
                    return item;
                });
                if (JSON.stringify(updated[field]) !== original) {
                    changed = true;
                    changes.push(`${field}[array]`);
                }
            }
        } else if (typeof updated[field] === 'string' && hasUnicodeToNormalize(updated[field])) {
            const original = updated[field];
            updated[field] = normalizeUnicodeToAscii(updated[field]);
            changed = true;
            changes.push(`${field}: "${original.substring(0, 50)}..." → "${updated[field].substring(0, 50)}..."`);
        }
    }

    // Campos aninhados
    for (const { path: nestedPath, fields } of NESTED_PATHS) {
        let current = updated;
        for (const key of nestedPath) {
            if (!current || typeof current !== 'object') break;
            current = current[key];
        }
        
        if (current && typeof current === 'object') {
            for (const field of fields) {
                if (field === 'keyFindings' || field === 'evidencias') {
                    if (Array.isArray(current[field])) {
                        const original = JSON.stringify(current[field]);
                        current[field] = current[field].map(item => {
                            if (typeof item === 'string' && hasUnicodeToNormalize(item)) {
                                return normalizeUnicodeToAscii(item);
                            }
                            return item;
                        });
                        if (JSON.stringify(current[field]) !== original) {
                            changed = true;
                            changes.push(`${nestedPath.join('.')}.${field}[array]`);
                        }
                    }
                } else if (typeof current[field] === 'string' && hasUnicodeToNormalize(current[field])) {
                    const original = current[field];
                    current[field] = normalizeUnicodeToAscii(current[field]);
                    changed = true;
                    changes.push(`${nestedPath.join('.')}.${field}: "${original.substring(0, 50)}..."`);
                }
            }
        }
    }

    return { updated, changed, changes };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  NORMALIZACAO UNICODE - FIRESTORE MIGRATION');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Modo: ${DRY_RUN ? 'DRY RUN (simulacao)' : 'LIVE (atualizacao real)'}`);
    console.log(`  Tenant filter: ${TENANT_FILTER || 'todos'}`);
    console.log(`  Batch size: ${BATCH_SIZE}`);
    console.log('═══════════════════════════════════════════════════════\n');

    const token = await getAccessToken();
    
    let nextPageToken = null;
    let totalCases = 0;
    let casesToUpdate = 0;
    let totalChanges = 0;
    let updatedCount = 0;

    do {
        // Construir URL com filtro de tenant se especificado
        let url = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/cases?pageSize=${BATCH_SIZE}`;
        if (nextPageToken) url += `&pageToken=${encodeURIComponent(nextPageToken)}`;

        const res = await httpsRequest({
            hostname: 'firestore.googleapis.com',
            path: url,
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status !== 200) {
            console.error('Failed to fetch cases:', res.body);
            process.exit(1);
        }

        const docs = res.body.documents || [];
        nextPageToken = res.body.nextPageToken || null;

        for (const doc of docs) {
            totalCases++;
            const id = doc.name.split('/').pop();
            const fields = doc.fields || {};
            
            // Converter para objeto plano
            const caseData = {};
            for (const [k, v] of Object.entries(fields)) caseData[k] = fromFirestoreValue(v);
            
            // Filtrar por tenant se necessario
            if (TENANT_FILTER && caseData.tenantId !== TENANT_FILTER) continue;
            
            // Normalizar
            const { updated, changed, changes } = normalizeCase(caseData);
            
            if (changed) {
                casesToUpdate++;
                totalChanges += changes.length;
                
                console.log(`\n📌 Case ${id} (tenant: ${caseData.tenantId || '?'})`);
                console.log(`   Candidato: ${caseData.candidateName || '?'}`);
                console.log(`   Status: ${caseData.status || '?'}`);
                for (const change of changes) {
                    console.log(`   ✏️  ${change}`);
                }
                
                if (!DRY_RUN) {
                    // Atualizar no Firestore
                    const updateFields = {};
                    const fieldPaths = []; // Caminhos para updateMask (apenas campos raiz)
                    
                    for (const field of ROOT_TEXT_FIELDS) {
                        if (updated[field] !== caseData[field]) {
                            updateFields[field] = toFirestoreValue(updated[field]);
                            fieldPaths.push(field);
                        }
                    }
                    
                    // Atualizar campos aninhados (enviar objeto completo, nao subcampos)
                    for (const { path: nestedPath } of NESTED_PATHS) {
                        const originalNested = nestedPath.reduce((obj, key) => obj?.[key], caseData);
                        const updatedNested = nestedPath.reduce((obj, key) => obj?.[key], updated);
                        
                        if (updatedNested && JSON.stringify(originalNested) !== JSON.stringify(updatedNested)) {
                            // Enviar o objeto aninhado completo
                            let target = updateFields;
                            for (let i = 0; i < nestedPath.length - 1; i++) {
                                if (!target[nestedPath[i]]) {
                                    target[nestedPath[i]] = toFirestoreValue({});
                                }
                                target = target[nestedPath[i]].mapValue.fields;
                            }
                            target[nestedPath[nestedPath.length - 1]] = toFirestoreValue(updatedNested);
                            
                            // No updateMask, usar apenas o caminho do pai (sem subcampos)
                            fieldPaths.push(nestedPath.join('.'));
                        }
                    }
                    
                    // Fazer PATCH no documento (sem updateMask - Firestore infere do payload)
                    const patchBody = JSON.stringify({ fields: updateFields });
                    const patchRes = await httpsRequest({
                        hostname: 'firestore.googleapis.com',
                        path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/cases/${id}`,
                        method: 'PATCH',
                        headers: { 
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    }, patchBody);
                    
                    if (patchRes.status === 200) {
                        console.log(`   ✅ Atualizado com sucesso`);
                        updatedCount++;
                    } else {
                        console.error(`   ❌ Erro ao atualizar:`, patchRes.body);
                    }
                    
                    // Rate limiting - pequeno delay
                    await new Promise(r => setTimeout(r, 100));
                }
            }
        }
        
        console.log(`\n📊 Progresso: ${totalCases} casos processados...`);
        
    } while (nextPageToken);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  RESUMO');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Total de casos analisados: ${totalCases}`);
    console.log(`  Casos com caracteres Unicode: ${casesToUpdate}`);
    console.log(`  Total de campos normalizados: ${totalChanges}`);
    if (!DRY_RUN) {
        console.log(`  Casos atualizados no Firestore: ${updatedCount}`);
    }
    console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => { 
    console.error('\n❌ Erro:', err.message); 
    console.error(err.stack);
    process.exit(1); 
});
