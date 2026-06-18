const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'functions', 'index.js');
let content = fs.readFileSync(filePath, 'utf-8');

// Remover definições dos handlers V2
const v2HandlersPattern = /async function listOpsCasesV2Handler\(request\) \{[\s\S]*?\n\}\s*\n\nexports\.listOpsCasesV2 = onCall\([\s\S]*?\n\);\s*\n\nasync function listClientCasesV2Handler\(request\) \{[\s\S]*?\n\}\s*\n\nexports\.listClientCasesV2 = onCall\([\s\S]*?\n\);/;

if (v2HandlersPattern.test(content)) {
  content = content.replace(v2HandlersPattern, `
exports.listOpsCasesV2 = createListOpsCasesV2Handler({
    db,
    getOpsUserProfile,
});

exports.listClientCasesV2 = createListClientCasesV2Handler({
    db,
    getClientUserProfile,
});
`);
  console.log('Substituído: listOpsCasesV2Handler + listClientCasesV2Handler');
} else {
  console.log('NÃO ENCONTRADO: handlers V2');
}

// Substituir outros exports
const replacements = [
  {
    name: 'listOpsCases',
    old: /exports\.listOpsCases = onCall\(\s*\{[\s\S]*?\n\s*\},\s*async \(request\) =\> \{[\s\S]*?\n\s*\},\s*\);/,
    new: `exports.listOpsCases = createListOpsCasesHandler({
    db,
    getOpsUserProfile,
});`
  },
  {
    name: 'listClientCases',
    old: /exports\.listClientCases = onCall\(\s*\{[\s\S]*?\n\s*\},\s*async \(request\) =\> \{[\s\S]*?\n\s*\},\s*\);/,
    new: `exports.listClientCases = createListClientCasesHandler({
    db,
    getClientUserProfile,
});`
  },
  {
    name: 'getOpsCaseMetrics',
    old: /exports\.getOpsCaseMetrics = onCall\(\s*\{[\s\S]*?\n\s*\},\s*async \(request\) =\> \{[\s\S]*?\n\s*\},\s*\);/,
    new: `exports.getOpsCaseMetrics = createGetOpsCaseMetricsHandler({
    db,
    getOpsUserProfile,
});`
  },
  {
    name: 'getClientDashboardMetrics',
    old: /exports\.getClientDashboardMetrics = onCall\(\s*\{[\s\S]*?\n\s*\},\s*async \(request\) =\> \{[\s\S]*?\n\s*\},\s*\);/,
    new: `exports.getClientDashboardMetrics = createGetClientDashboardMetricsHandler({
    db,
    getClientUserProfile,
});`
  },
  {
    name: 'assignCaseToCurrentAnalyst',
    old: /exports\.assignCaseToCurrentAnalyst = onCall\(\s*\{[\s\S]*?\n\s*\},\s*async \(request\) =\> \{[\s\S]*?\n\s*\},\s*\);/,
    new: `exports.assignCaseToCurrentAnalyst = createAssignCaseToCurrentAnalystHandler({
    db,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    writeAuditEvent,
    getClientIp,
    ACTOR_TYPE,
    SOURCE,
});`
  },
  {
    name: 'assignCaseToAnalyst',
    old: /exports\.assignCaseToAnalyst = onCall\(\s*\{[\s\S]*?\n\s*\},\s*async \(request\) =\> \{[\s\S]*?\n\s*\},\s*\);/,
    new: `exports.assignCaseToAnalyst = createAssignCaseToAnalystHandler({
    db,
    getOpsUserProfile,
    assertCanAssignCase,
    assertOpsCanAccessCase,
    writeAuditEvent,
    getClientIp,
    ACTOR_TYPE,
    SOURCE,
    OPS_ROLES,
});`
  },
  {
    name: 'unassignCase',
    old: /exports\.unassignCase = onCall\(\s*\{[\s\S]*?\n\s*\},\s*async \(request\) =\> \{[\s\S]*?\n\s*\},\s*\);/,
    new: `exports.unassignCase = createUnassignCaseHandler({
    db,
    getOpsUserProfile,
    assertCanAssignCase,
    assertOpsCanAccessCase,
    writeAuditEvent,
    getClientIp,
    ACTOR_TYPE,
    SOURCE,
});`
  },
  {
    name: 'returnCaseToClient',
    old: /exports\.returnCaseToClient = onCall\(\s*\{[\s\S]*?\n\s*\},\s*async \(request\) =\> \{[\s\S]*?\n\s*\},\s*\);/,
    new: `exports.returnCaseToClient = createReturnCaseToClientHandler({
    db,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    writeAuditEvent,
    getClientIp,
    ACTOR_TYPE,
    SOURCE,
});`
  },
  {
    name: 'rerunAiAnalysis',
    old: /exports\.rerunAiAnalysis = onCall\(\s*\{[\s\S]*?\n\s*\},\s*async \(request\) =\> \{[\s\S]*?\n\s*\},\s*\);/,
    new: `exports.rerunAiAnalysis = createRerunAiAnalysisHandler({
    db,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    rerunAiForCase,
});`
  },
  {
    name: 'rerunEnrichmentPhase',
    old: /exports\.rerunEnrichmentPhase = onCall\(\s*\{[\s\S]*?\n\s*\},\s*async \(request\) =\> \{[\s\S]*?\n\s*\},\s*\);/,
    new: `exports.rerunEnrichmentPhase = createRerunEnrichmentPhaseHandler({
    db,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    isDoneOrPartial,
    loadBigDataCorpConfig,
    loadFonteDataConfig,
    loadJuditConfig,
    loadEscavadorConfig,
    loadDjenConfig,
    runBigDataCorpEnrichmentPhase,
    runFonteDataEnrichmentPhase,
    runJuditEnrichmentPhase,
    runEscavadorEnrichmentPhase,
    runDjenEnrichmentPhase,
    acquirePhaseRun,
    maybeRunAutoClassifyAndAi,
    markPendingJuditRequestsStale,
    buildProviderRunIds,
    makeRunId,
    writeAuditEvent,
    getClientIp,
    ACTOR_TYPE,
    SOURCE,
});`
  },
];

for (const repl of replacements) {
  const before = content.length;
  content = content.replace(repl.old, repl.new);
  const after = content.length;
  if (before !== after) {
    console.log(`Substituído: ${repl.name} (${before - after} chars)`);
  } else {
    console.log(`NÃO ENCONTRADO: ${repl.name}`);
  }
}

// Atualizar __test
const testExportPattern = /exports\.__test = \{[\s\S]*?\n\};/;
const testExportMatch = content.match(testExportPattern);
if (testExportMatch) {
  let testExport = testExportMatch[0];
  
  // Adicionar funções do novo módulo ao __test
  const newEntries = `
    listOpsCasesV2Handler: async (request) => {
        const handler = createListOpsCasesV2Handler({ db, getOpsUserProfile });
        return handler(request);
    },
    listClientCasesV2Handler: async (request) => {
        const handler = createListClientCasesV2Handler({ db, getClientUserProfile });
        return handler(request);
    },
    enforceTenantSubmissionLimits,
    compensateTenantSubmissionLimit,`;
  
  // Inserir antes de _setDb
  testExport = testExport.replace(
    /_setDb\(mockDb\)/,
    newEntries.trim() + '\n    _setDb(mockDb)'
  );
  
  content = content.replace(testExportPattern, testExport);
  console.log('Atualizado: __test exports');
} else {
  console.log('NÃO ENCONTRADO: __test');
}

fs.writeFileSync(filePath, content);
console.log('Arquivo atualizado com sucesso!');
