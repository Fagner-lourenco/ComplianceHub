const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');

// Check if wrappers already exist
if (content.includes('enrichmentService = require')) {
    console.log('Already has service imports');
    process.exit(0);
}

// Add service imports after the last require at the top of the file
const lines = content.split('\n');
let lastRequireLine = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('const ') && lines[i].includes('require(')) {
        lastRequireLine = i;
    }
    if (lines[i].trim().startsWith('const escavadorApiToken') || lines[i].trim().startsWith('const db =')) {
        break;
    }
}

const imports = [
    "const {",
    "    formatDateKey,",
    "    formatMonthKey,",
    "    previousMonthKey,",
    "    asDate,",
    "} = require('./utils/dateUtils');",
    "const {",
    "    normalizeNameForGate,",
    "    computeNameSimilarity,",
    "    sanitizeAiOutput,",
    "    compactErrorMessage,",
    "    extractApiErrorMessage,",
    "    formatOpenAiError,",
    "    formatAiRuntimeError,",
    "    isStringArray,",
    "    stripUndefined,",
    "} = require('./utils/stringUtils');",
    "const {",
    "    isDoneOrPartial,",
    "    isSettledProviderStatus,",
    "    getAiProvidersIncluded,",
    "} = require('./utils/statusUtils');",
    "const {",
    "    AI_MODEL,",
    "    AI_MAX_TOKENS,",
    "    AI_MAX_TOKENS_PREFILL,",
    "    AI_PROMPT_VERSION,",
    "    AI_HOMONYM_PROMPT_VERSION,",
    "    AI_HOMONYM_CONTEXT_VERSION,",
    "    AI_PREFILL_PROMPT_VERSION,",
    "    AI_CACHE_TTL_MS,",
    "    AI_COST_INPUT,",
    "    AI_COST_OUTPUT,",
    "    AI_CIRCUIT_THRESHOLD,",
    "    AI_CIRCUIT_COOLDOWN_MS,",
    "    estimateAiCostUsd,",
    "    AI_JSON_SCHEMA,",
    "    AI_HOMONYM_JSON_SCHEMA,",
    "    AI_PREFILL_JSON_SCHEMA,",
    "    AI_SYSTEM_MESSAGE,",
    "    AI_GENERAL_SYSTEM_MESSAGE,",
    "    AI_HOMONYM_SYSTEM_MESSAGE,",
    "    AI_PREFILL_SYSTEM_MESSAGE,",
    "} = require('./ai/aiConfig');",
    "const {",
    "    sanitizeStructuredList,",
    "    sanitizeStructuredText,",
    "    sanitizeProcessAssessments,",
    "    sanitizeAiStructured,",
    "    sanitizeAiHomonymStructured,",
    "    sanitizeAiPrefillStructured,",
    "} = require('./ai/aiSanitizer');",
    "const {",
    "    parseJsonSchemaResponse,",
    "} = require('./ai/aiParser');",
    "const {",
    "    buildAiUpdatePayload,",
    "    buildAiHomonymResetPayload,",
    "    buildAiHomonymUpdatePayload,",
    "    buildAiPrefillUpdatePayload,",
    "} = require('./ai/aiPayloadBuilder');",
    "const {",
    "    DEFAULT_ENRICHMENT_CONFIG,",
    "    DEFAULT_ESCAVADOR_CONFIG,",
    "    DEFAULT_JUDIT_CONFIG,",
    "    DEFAULT_BIGDATACORP_CONFIG,",
    "    DEFAULT_DJEN_CONFIG,",
    "    DEFAULT_ANALYSIS_CONFIG,",
    "    getTenantSettingsData,",
    "    getTenantEntitlementsData,",
    "    loadFonteDataConfig,",
    "    loadEscavadorConfig,",
    "    loadJuditConfig,",
    "    loadBigDataCorpConfig,",
    "    loadDjenConfig,",
    "    buildJuditCallbackUrl,",
    "    registerJuditWebhookRequest,",
    "} = require('./services/configLoader');",
    "const { computeSimpleHash, computeAiCacheKey } = require('./services/aiCache');",
    "const { runStructuredAiAnalysis } = require('./services/aiService');",
    "const autoClassificationService = require('./services/autoClassificationService');",
    "const deterministicPrefillService = require('./services/deterministicPrefillService');",
    "const {",
    "    normCnj,",
    "    formatCnj,",
    "    formatDateBR,",
    "    classifyWarrantType,",
    "    detectCartaDeGuia,",
    "    findLinkedCivilProcess,",
    "    extractSentenceDetails,",
    "    formatProcessBlock,",
    "    selectTopProcessos,",
    "} = require('./utils/processUtils');",
];

lines.splice(lastRequireLine + 1, 0, ...imports);
content = lines.join('\n');
fs.writeFileSync('index.js', content, 'utf8');
console.log('Added imports to index.js');
console.log('New length:', lines.length);
