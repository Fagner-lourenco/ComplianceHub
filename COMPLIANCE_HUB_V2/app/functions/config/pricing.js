/**
 * Config: Pricing
 * Centralizes all provider costs for transparency and easy adjustment.
 * All values in BRL unless suffixed with USD.
 */

// =============================================================================
// AI PRICING (USD per 1M tokens)
// =============================================================================

const AI_COST = {
  INPUT_PER_1M_TOKENS: 0.20,
  OUTPUT_PER_1M_TOKENS: 1.25,
};

/**
 * Estimate AI cost in USD.
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number}
 */
function estimateAiCostUsd(inputTokens, outputTokens) {
  return (
    (inputTokens / 1_000_000) * AI_COST.INPUT_PER_1M_TOKENS +
    (outputTokens / 1_000_000) * AI_COST.OUTPUT_PER_1M_TOKENS
  );
}

// =============================================================================
// PROVIDER PRICING (BRL)
// =============================================================================

const PROVIDER_COSTS = {
  // FonteData
  fonteData: {
    identity: 0.24,        // cadastro-pf-basica
    criminal: 1.65,        // processos-agrupada criminal detection
    warrant: 1.08,         // cnj-mandados-prisao
    labor: 0.54,           // trt-consulta per region
  },

  // Judit
  judit: {
    gate: 0.12,            // entity data lake
    lawsuitsSimple: 0.50,  // sync simples
    lawsuitsDetailed: 1.50,// datalake detalhada per 1k
    lawsuitsOnDemand: 6.00,// on_demand per 1k
    warrant: 1.00,         // mandado de prisao
    execution: 0.50,       // execucao criminal
    lawsuitsByName: 0.50,  // busca por nome
  },

  // BigDataCorp
  bigDataCorp: {
    basicData: 0.03,       // identity validation + gate
    processes: 0.07,       // lawsuits with CPF in Parties.Doc
    kyc: 0.05,             // PEP + sanctions
    occupation: 0.05,      // employment/profession history
  },

  // Escavador V2
  escavador: {
    baseBatch: 3.00,       // per 200 processos
    batchSize: 200,        // items per batch
  },
};

// =============================================================================
// COST CALCULATORS
// =============================================================================

/**
 * Calculate Escavador cost based on total processos.
 * @param {number} totalProcessos
 * @returns {number}
 */
function calculateEscavadorCost(totalProcessos) {
  const { baseBatch, batchSize } = PROVIDER_COSTS.escavador;
  return Math.max(1, Math.ceil(totalProcessos / batchSize)) * baseBatch;
}

/**
 * Calculate BigDataCorp cost based on enabled modules.
 * @param {object} modules — { basicData, processes, kyc, occupation }
 * @returns {number}
 */
function calculateBigDataCorpCost(modules = {}) {
  const costs = PROVIDER_COSTS.bigDataCorp;
  let total = 0;
  if (modules.basicData) total += costs.basicData;
  if (modules.processes) total += costs.processes;
  if (modules.kyc) total += costs.kyc;
  if (modules.occupation) total += costs.occupation;
  return total;
}

/**
 * Calculate Judit cost based on executed sources.
 * @param {object} sources — { gate, lawsuits, warrant, execution, lawsuits_by_name }
 * @param {object} filters — { useAsync }
 * @returns {number}
 */
function calculateJuditCost(sources = {}, filters = {}) {
  const costs = PROVIDER_COSTS.judit;
  let total = 0;

  if (sources.gate) total += costs.gate;
  if (sources.lawsuits) {
    total += filters.useAsync === true ? costs.lawsuitsDetailed : costs.lawsuitsSimple;
  }
  if (sources.warrant && sources.warrant.status !== 'SKIPPED_BDC_COVERED') {
    total += costs.warrant;
  }
  if (sources.execution) total += costs.execution;
  if (sources.lawsuits_by_name) total += costs.lawsuitsByName;

  return total;
}

module.exports = {
  AI_COST,
  PROVIDER_COSTS,
  estimateAiCostUsd,
  calculateEscavadorCost,
  calculateBigDataCorpCost,
  calculateJuditCost,
};
