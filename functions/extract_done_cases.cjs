const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'compliance-hub-br'
});

const db = admin.firestore();

async function extractDoneCases() {
  console.log('Querying Firestore for DONE cases...');
  
  const snapshot = await db.collection('cases')
    .where('status', '==', 'DONE')
    .limit(500)
    .get();
  
  console.log(`Found ${snapshot.size} cases with status=DONE`);
  
  const results = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const deterministicPrefill = data.deterministicPrefill || {};
    
    const caseRecord = {
      caseId: doc.id,
      candidateName: data.candidateName || null,
      candidateCpf: data.candidateCpf || null,
      createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt || null,
      updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : data.updatedAt || null,
      tenantId: data.tenantId || null,
      status: data.status || null,
      
      // Top-level flags
      laborFlag: data.laborFlag ?? null,
      criminalFlag: data.criminalFlag ?? null,
      warrantFlag: data.warrantFlag ?? null,
      riskScore: data.riskScore ?? null,
      riskLevel: data.riskLevel || null,
      
      // DeterministicPrefill fields
      executiveSummary: deterministicPrefill.executiveSummary || null,
      keyFindings: deterministicPrefill.keyFindings || null,
      criminalNotes: deterministicPrefill.criminalNotes || null,
      laborNotes: deterministicPrefill.laborNotes || null,
      warrantNotes: deterministicPrefill.warrantNotes || null,
      finalJustification: deterministicPrefill.finalJustification || null,
      nextSteps: deterministicPrefill.nextSteps || null,
    };
    
    results.push(caseRecord);
  });
  
  // Save to JSON
  const outputPath = 'C:\\Users\\Analista\\AppData\\Local\\Temp\\opencode\\all_concluded_cases.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  
  console.log(`\nSaved ${results.length} cases to ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
  
  // Summary stats
  const withExecutiveSummary = results.filter(r => r.executiveSummary).length;
  const withKeyFindings = results.filter(r => r.keyFindings && r.keyFindings.length > 0).length;
  const withCriminalNotes = results.filter(r => r.criminalNotes).length;
  const withLaborNotes = results.filter(r => r.laborNotes).length;
  const withWarrantNotes = results.filter(r => r.warrantNotes).length;
  const withFinalJustification = results.filter(r => r.finalJustification).length;
  const withNextSteps = results.filter(r => r.nextSteps).length;
  
  console.log('\n--- Field Coverage ---');
  console.log(`executiveSummary: ${withExecutiveSummary}/${results.length} (${((withExecutiveSummary/results.length)*100).toFixed(1)}%)`);
  console.log(`keyFindings: ${withKeyFindings}/${results.length} (${((withKeyFindings/results.length)*100).toFixed(1)}%)`);
  console.log(`criminalNotes: ${withCriminalNotes}/${results.length} (${((withCriminalNotes/results.length)*100).toFixed(1)}%)`);
  console.log(`laborNotes: ${withLaborNotes}/${results.length} (${((withLaborNotes/results.length)*100).toFixed(1)}%)`);
  console.log(`warrantNotes: ${withWarrantNotes}/${results.length} (${((withWarrantNotes/results.length)*100).toFixed(1)}%)`);
  console.log(`finalJustification: ${withFinalJustification}/${results.length} (${((withFinalJustification/results.length)*100).toFixed(1)}%)`);
  console.log(`nextSteps: ${withNextSteps}/${results.length} (${((withNextSteps/results.length)*100).toFixed(1)}%)`);
  
  return results.length;
}

extractDoneCases()
  .then(count => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
