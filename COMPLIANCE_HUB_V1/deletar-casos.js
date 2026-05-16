/**
 * Script para deletar casos específicos do Firestore
 *
 * INSTRUÇÕES:
 * 1. Certifique-se de que o arquivo de service account está em:
 *    functions/compliance-hub-br-firebase-adminsdk.json
 *    (ou ajuste o caminho abaixo)
 *
 * 2. Execute: node deletar-casos.js
 */

/* global require, process */

const admin = require('firebase-admin');

// Ajuste o caminho conforme necessário
const SERVICE_ACCOUNT_PATH = './functions/compliance-hub-br-firebase-adminsdk.json';

// IDs dos casos a serem deletados
const CASE_IDS = [
  'xWNTyjA3wM6DcJV8IPkx',
  '9AVhQEoH0stuhuRQfybg',
  'pNdArfG2NzVHd8Y7yksO',
  'TQmNZ2yTLPU16kaMeUb3'
];

async function main() {
  try {
    // Initialize Firebase Admin
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    const db = admin.firestore();
    const batch = db.batch();

    console.log('Deletando casos...\n');

    for (const caseId of CASE_IDS) {
      try {
        // Verificar se o caso existe
        const caseRef = db.collection('cases').doc(caseId);
        const caseDoc = await caseRef.get();
        
        if (!caseDoc.exists) {
          console.log(`⚠️  Caso ${caseId} não encontrado em /cases`);
        } else {
          const data = caseDoc.data();
          console.log(`📝 Caso ${caseId}:`, {
            status: data.status,
            candidateName: data.candidateName,
            tenantId: data.tenantId,
            createdAt: data.createdAt?.toDate?.() || data.createdAt
          });
          
          // Deletar o caso
          batch.delete(caseRef);
          console.log(`   ✅ Adicionado ao batch para deleção`);
        }

        // Também tentar deletar do clientCases (mirror)
        const clientCaseRef = db.collection('clientCases').doc(caseId);
        const clientCaseDoc = await clientCaseRef.get();
        if (clientCaseDoc.exists) {
          batch.delete(clientCaseRef);
          console.log(`   ✅ Mirror em /clientCases também será deletado`);
        }

      } catch (error) {
        console.error(`❌ Erro ao processar ${caseId}:`, error.message);
      }
    }

    // Commit do batch
    console.log('\nExecutando batch delete...');
    await batch.commit();
    console.log('\n✅ Casos deletados com sucesso!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.log('\nVerifique se:');
    console.log('1. O arquivo de service account existe no caminho especificado');
    console.log('2. Você tem permissões para deletar documentos no Firestore');
    process.exit(1);
  }
}

main();
