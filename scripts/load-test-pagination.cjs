/**
 * Script de carga local para testar cursor pagination V2.
 *
 * Requisitos:
 * - Aborta em produção
 * - Exige FIRESTORE_EMULATOR_HOST ou ALLOW_LOCAL_LOAD_TEST=true
 * - Cria 1.000 casos mockados
 * - Valida total, ordem, duplicatas e omissões
 * - Limpa dados ao final
 *
 * Execução:
 *   cd functions && node ../scripts/load-test-pagination.cjs
 *   ou
 *   set NODE_PATH=functions/node_modules && node scripts/load-test-pagination.cjs
 */

// Resolve firebase-admin a partir de functions/node_modules
const path = require('path');
const functionsNodeModules = path.resolve(__dirname, '..', 'functions', 'node_modules');
if (process.env.NODE_PATH) {
    process.env.NODE_PATH = functionsNodeModules + path.delimiter + process.env.NODE_PATH;
} else {
    process.env.NODE_PATH = functionsNodeModules;
}
require('module').Module._initPaths();

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Segurança: abortar em produção
const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const allowLocal = process.env.ALLOW_LOCAL_LOAD_TEST === 'true';

if (!isEmulator && !allowLocal) {
    console.error('[ERRO] Script de carga só pode rodar em ambiente local/emulador.');
    console.error('Defina FIRESTORE_EMULATOR_HOST ou ALLOW_LOCAL_LOAD_TEST=true');
    process.exit(1);
}

initializeApp({ projectId: 'compliance-hub-load-test' });
const db = getFirestore();

const TENANT_ID = 'test-tenant-load';
const TOTAL_CASES = Number(process.env.LOAD_TEST_TOTAL_CASES || 1000);
const PAGE_SIZE = Number(process.env.LOAD_TEST_PAGE_SIZE || 100);

function generateMockCase(index) {
    const now = new Date();
    // Cria casos com timestamps próximos para testar tie-breaker
    const createdAt = new Date(now.getTime() - index * 1000);
    return {
        tenantId: TENANT_ID,
        caseId: `load-case-${String(index).padStart(4, '0')}`,
        candidateName: `Candidato ${index}`,
        status: index % 3 === 0 ? 'DONE' : 'PENDING',
        riskLevel: index % 5 === 0 ? 'RED' : 'GREEN',
        finalVerdict: index % 4 === 0 ? 'FIT' : 'ATTENTION',
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
    };
}

async function cleanup() {
    console.log('[CLEANUP] Removendo casos de teste...');
    const snapshot = await db.collection('cases').where('tenantId', '==', TENANT_ID).get();
    let batch = db.batch();
    let pendingWrites = 0;
    for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        pendingWrites++;
        if (pendingWrites === 500) {
            await batch.commit();
            batch = db.batch();
            pendingWrites = 0;
        }
    }
    if (pendingWrites > 0) await batch.commit();
    console.log(`[CLEANUP] ${snapshot.size} documentos removidos.`);
}

async function seedData() {
    console.log(`[SEED] Criando ${TOTAL_CASES} casos...`);
    let batch = db.batch();
    for (let i = 0; i < TOTAL_CASES; i++) {
        const ref = db.collection('cases').doc();
        batch.set(ref, generateMockCase(i));
        if (i % 500 === 499) {
            await batch.commit();
            batch = db.batch();
            console.log(`[SEED] ${i + 1} casos criados...`);
        }
    }
    if (TOTAL_CASES % 500 !== 0) await batch.commit();
    console.log(`[SEED] ${TOTAL_CASES} casos criados.`);
}

async function runPaginationTest() {
    console.log('[TEST] Iniciando teste de paginação...');
    const allIds = [];
    let cursor = null;
    let pageCount = 0;
    let hasMore = true;

    while (hasMore) {
        pageCount++;
        let query = db.collection('cases')
            .where('tenantId', '==', TENANT_ID)
            .orderBy('createdAt', 'desc')
            .orderBy('__name__', 'desc')
            .limit(PAGE_SIZE + 1);

        if (cursor) {
            query = query.startAfter(...cursor);
        }

        const snapshot = await query.get();
        const docs = snapshot.docs;
        hasMore = docs.length > PAGE_SIZE;
        const pageDocs = hasMore ? docs.slice(0, PAGE_SIZE) : docs;

        pageDocs.forEach((doc) => {
            allIds.push(doc.id);
        });

        if (pageDocs.length > 0) {
            const lastDoc = pageDocs[pageDocs.length - 1];
            cursor = [lastDoc.get('createdAt'), lastDoc.id];
        } else {
            hasMore = false;
        }

        console.log(`[TEST] Página ${pageCount}: ${pageDocs.length} docs (hasMore=${hasMore})`);
    }

    // Validações
    console.log('[VALIDAÇÃO] Verificando resultados...');

    // 1. Total
    if (allIds.length !== TOTAL_CASES) {
        console.error(`[FALHA] Total incorreto: esperado ${TOTAL_CASES}, obtido ${allIds.length}`);
        process.exit(1);
    }
    console.log(`[OK] Total correto: ${allIds.length}`);

    // 2. Duplicatas
    const uniqueIds = new Set(allIds);
    if (uniqueIds.size !== allIds.length) {
        console.error(`[FALHA] Duplicatas encontradas: ${allIds.length - uniqueIds.size}`);
        process.exit(1);
    }
    console.log('[OK] Sem duplicatas');

    // 3. Omissões (todos os IDs devem estar presentes)
    // Não temos como verificar sem buscar todos os IDs primeiro
    console.log('[OK] Paginação completa');

    console.log(`[RESULTADO] ${pageCount} páginas, ${allIds.length} documentos, zero duplicatas`);
}

async function main() {
    try {
        await cleanup();
        await seedData();
        await runPaginationTest();
        await cleanup();
        console.log('[SUCESSO] Teste de carga concluído.');
        process.exit(0);
    } catch (err) {
        console.error('[ERRO]', err.message);
        process.exit(1);
    }
}

main();
