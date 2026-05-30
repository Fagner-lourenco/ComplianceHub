const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'functions', 'index.js');
let content = fs.readFileSync(filePath, 'utf-8');

// Função para encontrar e substituir um export.onCall
function replaceHandler(name, newCode) {
  const pattern = new RegExp(
    `exports\\.${name}\\s*=\\s*onCall\\(\\s*\\{[^}]*\\}\\s*,\\s*async\\s*\\(request\\)\\s*=>\\s*\\{[\\s\\S]*?\\n\\s*\\}\\s*\\);`,
    'g'
  );
  
  const matches = content.match(pattern);
  if (!matches) {
    console.log(`NÃO ENCONTRADO: ${name}`);
    return;
  }
  
  content = content.replace(pattern, newCode);
  console.log(`Substituído: ${name} (${matches[0].length} chars)`);
}

replaceHandler(
  'getOpsCaseMetrics',
  `exports.getOpsCaseMetrics = createGetOpsCaseMetricsHandler({
    db,
    getOpsUserProfile,
});`
);

replaceHandler(
  'getClientDashboardMetrics',
  `exports.getClientDashboardMetrics = createGetClientDashboardMetricsHandler({
    db,
    getClientUserProfile,
});`
);

replaceHandler(
  'listOpsCases',
  `exports.listOpsCases = createListOpsCasesHandler({
    db,
    getOpsUserProfile,
});`
);

replaceHandler(
  'listClientCases',
  `exports.listClientCases = createListClientCasesHandler({
    db,
    getClientUserProfile,
});`
);

replaceHandler(
  'rerunAiAnalysis',
  `exports.rerunAiAnalysis = createRerunAiAnalysisHandler({
    db,
    getOpsUserProfile,
    assertOpsCanAccessCase,
    rerunAiForCase,
});`
);

replaceHandler(
  'rerunEnrichmentPhase',
  `exports.rerunEnrichmentPhase = createRerunEnrichmentPhaseHandler({
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
);

fs.writeFileSync(filePath, content);
console.log('Arquivo atualizado com sucesso!');
