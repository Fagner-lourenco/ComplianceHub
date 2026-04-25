/**
 * Config: Environment Variables
 * Typed, validated environment configuration.
 */

function getEnv(key, defaultValue = undefined, required = false) {
  const value = process.env[key];
  if (value === undefined && required) {
    throw new Error(`Environment variable ${key} is required.`);
  }
  return value !== undefined ? value : defaultValue;
}

function getEnvBool(key, defaultValue = false) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

function getEnvInt(key, defaultValue = 0) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

const ENV = {
  // Firebase
  projectId: getEnv('GCLOUD_PROJECT', 'compliance-hub-v2'),
  region: getEnv('FUNCTIONS_REGION', 'southamerica-east1'),

  // BigDataCorp
  bdcBaseUrl: getEnv('BIGDATACORP_BASE_URL', 'https://plataforma.bigdatacorp.com.br'),
  bdcAccessToken: getEnv('BIGDATACORP_ACCESS_TOKEN', '', true),
  bdcTokenId: getEnv('BIGDATACORP_TOKEN_ID', '', true),

  // Judit
  juditBaseUrl: getEnv('JUDIT_BASE_URL', ''),
  juditApiKey: getEnv('JUDIT_API_KEY', ''),

  // Escavador
  escavadorBaseUrl: getEnv('ESCAVADOR_BASE_URL', ''),
  escavadorApiKey: getEnv('ESCAVADOR_API_KEY', ''),

  // FonteData
  fontedataApiKey: getEnv('FONTEDATA_API_KEY', ''),

  // OpenAI
  openaiApiKey: getEnv('OPENAI_API_KEY', ''),
  openaiModel: getEnv('OPENAI_MODEL', 'gpt-4o-mini'),

  // Feature flags
  enableBdcFirst: getEnvBool('ENABLE_BDC_FIRST', true),
  enableCache: getEnvBool('ENABLE_CACHE', true),
  enableScoreEngine: getEnvBool('ENABLE_SCORE_ENGINE', true),
  enableAutoProcess: getEnvBool('ENABLE_AUTO_PROCESS', true),

  // Rate limits
  tenantRateLimit: getEnvInt('TENANT_RATE_LIMIT', 100),
  userRateLimit: getEnvInt('USER_RATE_LIMIT', 30),
  dossierCreationLimit: getEnvInt('DOSSIER_CREATION_LIMIT', 50),

  // Misc
  nodeEnv: getEnv('NODE_ENV', 'development'),
  functionsEmulator: getEnvBool('FUNCTIONS_EMULATOR', false),
};

module.exports = { ENV, getEnv, getEnvBool, getEnvInt };
