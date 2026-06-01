const admin = require('firebase-admin');
const serviceAccountPath = process.env.SERVICE_ACCOUNT_KEY_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPath) {
  throw new Error('Defina SERVICE_ACCOUNT_KEY_PATH ou GOOGLE_APPLICATION_CREDENTIALS para usar debug-case.js.');
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function getCase() {
  const caseId = 'qurTsbgGlss6XGFOslZp';
  const caseRef = db.collection('cases').doc(caseId);
  const caseSnap = await caseRef.get();
  
  if (!caseSnap.exists) {
    console.log('Caso nao encontrado');
    return;
  }
  
  const caseData = caseSnap.data();
  
  console.log('=== CASE DATA ===');
  console.log('criminalFlag:', caseData.criminalFlag);
  console.log('bigdatacorpCriminalFlag:', caseData.bigdatacorpCriminalFlag);
  console.log('bigdatacorpCriminalCount:', caseData.bigdatacorpCriminalCount);
  console.log('bigdatacorpDirectCriminalCount:', caseData.bigdatacorpDirectCriminalCount);
  console.log('bigdatacorpPossibleHomonymCriminalCount:', caseData.bigdatacorpPossibleHomonymCriminalCount);
  console.log('bigdatacorpProcessTotal:', caseData.bigdatacorpProcessTotal);
  console.log('djenCriminalFlag:', caseData.djenCriminalFlag);
  console.log('djenCriminalCount:', caseData.djenCriminalCount);
  console.log('djenComunicacoes length:', (caseData.djenComunicacoes || []).length);
  console.log('');
  
  // BDC processos
  const bdcProcessos = caseData.bigdatacorpProcessos || [];
  console.log('=== BDC PROCESSOS ===');
  console.log('Total:', bdcProcessos.length);
  bdcProcessos.forEach((p, i) => {
    console.log(`${i+1}. CNJ: ${p.numero}, isCriminal: ${p.isCriminal}, isDirectCpfMatch: ${p.isDirectCpfMatch}, courtType: ${p.courtType}, status: ${p.status}`);
  });
  console.log('');
  
  // DJEN comunicacoes
  const djenComunicacoes = caseData.djenComunicacoes || [];
  console.log('=== DJEN COMUNICACOES ===');
  console.log('Total:', djenComunicacoes.length);
  djenComunicacoes.forEach((c, i) => {
    console.log(`${i+1}. Processo: ${c.numeroProcesso}, area: ${c.area}, confirmationLevel: ${c.confirmationLevel}, score: ${c.probabilityScore}`);
  });
  console.log('');
  
  // criminalNotes
  console.log('=== CRIMINAL NOTES ===');
  console.log(caseData.criminalNotes || 'N/A');
  console.log('');
  
  // djenNotes
  console.log('=== DJEN NOTES ===');
  console.log(caseData.djenNotes || 'N/A');
}

getCase().catch(console.error);
