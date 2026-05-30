import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  // Constants
  AI_MODEL,
  AI_MAX_TOKENS,
  AI_CACHE_TTL_MS,
  AI_CIRCUIT_THRESHOLD,
  AI_CIRCUIT_COOLDOWN_MS,

  // Pure utilities
  compactErrorMessage,
  extractApiErrorMessage,
  formatOpenAiError,
  formatAiRuntimeError,
  isDoneOrPartial,
  computeSimpleHash,
  computeAiCacheKey,
  estimateAiCostUsd,
  getAiProvidersIncluded,
  maskCpfForAi,
  compactJuditRoleSummary,
  compactBigDataCorpProcessos,
  compactEscavadorProcessos,
  compactDjenComunicacoes,
  countItems,
  isNegativeFlag,
  isPositiveFlag,
  buildReviewSource,
  summarizeAxisCoverage,
  buildAxisReviewContext,
  hasCriminalLowRiskRoleOnly,
  isGenericCautionText,
  applyAxisReviewGuardrail,
  applyAiClassificationReviewGuardrails,

  // Prompt builders
  buildAiPrompt,
  buildAiHomonymPrompt,
  buildAiPrefillPrompt,
  buildAiClassificationReviewPrompt,
  buildAiClassificationReviewContext,

  // Payload builders
  buildAiUpdatePayload,
  buildAiHomonymUpdatePayload,
  buildAiPrefillUpdatePayload,
  buildAiClassificationReviewUpdatePayload,

  // Execution handlers
  runStructuredAiAnalysis,
  runAiAnalysis,
  runAiHomonymAnalysis,
  runAiPrefillAnalysis,
  runAiClassificationReviewAnalysis,
  recordAiCostLedger,
} = require('./aiOrchestrator');

describe('aiOrchestrator - Constants', () => {
  it('should export expected constants', () => {
    expect(AI_MODEL).toBeDefined();
    expect(AI_MAX_TOKENS).toBeDefined();
    expect(AI_CACHE_TTL_MS).toBeGreaterThan(0);
    expect(AI_CIRCUIT_THRESHOLD).toBeGreaterThan(0);
    expect(AI_CIRCUIT_COOLDOWN_MS).toBeGreaterThan(0);
  });
});

describe('aiOrchestrator - Pure Utilities', () => {
  describe('isDoneOrPartial', () => {
    it('returns true for DONE and PARTIAL', () => {
      expect(isDoneOrPartial('DONE')).toBe(true);
      expect(isDoneOrPartial('PARTIAL')).toBe(true);
    });

    it('returns false for other statuses', () => {
      expect(isDoneOrPartial('PENDING')).toBe(false);
      expect(isDoneOrPartial('RUNNING')).toBe(false);
      expect(isDoneOrPartial('FAILED')).toBe(false);
      expect(isDoneOrPartial(null)).toBe(false);
      expect(isDoneOrPartial(undefined)).toBe(false);
    });
  });

  describe('computeSimpleHash', () => {
    it('returns consistent hash for same input', () => {
      const hash1 = computeSimpleHash('test string');
      const hash2 = computeSimpleHash('test string');
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
    });

    it('returns different hash for different inputs', () => {
      const hash1 = computeSimpleHash('test A');
      const hash2 = computeSimpleHash('test B');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('computeAiCacheKey', () => {
    it('computes cache key from case data and prompt', () => {
      const caseData = { id: 'case-123', tenantId: 'tenant-1' };
      const prompt = 'test prompt';
      const key = computeAiCacheKey(caseData, prompt);
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('produces different keys for different options', () => {
      const key1 = computeAiCacheKey({ id: '1' }, { prompt: 'prompt A' });
      const key2 = computeAiCacheKey({ id: '1' }, { prompt: 'prompt B' });
      expect(key1).not.toBe(key2);
    });
  });

  describe('maskCpfForAi', () => {
    it('masks CPF correctly', () => {
      expect(maskCpfForAi('12345678901')).toBe('123.***.***-01');
    });

    it('returns fallback for invalid CPF', () => {
      expect(maskCpfForAi(null, 'N/A')).toBe('N/A');
      expect(maskCpfForAi('123', 'INVALID')).toBe('INVALID');
    });
  });

  describe('countItems', () => {
    it('counts arrays', () => {
      expect(countItems([1, 2, 3])).toBe(3);
    });

    it('counts objects with length as NaN', () => {
      expect(countItems({ length: 5 })).toBe(NaN);
    });

    it('returns 0 for null/undefined', () => {
      expect(countItems(null)).toBe(0);
      expect(countItems(undefined)).toBe(0);
    });
  });

  describe('isNegativeFlag', () => {
    it('identifies negative flags', () => {
      expect(isNegativeFlag('NEGATIVE')).toBe(true);
      expect(isNegativeFlag('NOT_FOUND')).toBe(true);
    });

    it('rejects non-negative flags', () => {
      expect(isNegativeFlag('POSITIVE')).toBe(false);
      expect(isNegativeFlag('HIGH_RISK')).toBe(false);
    });
  });

  describe('isPositiveFlag', () => {
    it('identifies positive flags', () => {
      expect(isPositiveFlag('POSITIVE')).toBe(true);
    });

    it('rejects non-positive flags', () => {
      expect(isPositiveFlag('NEGATIVE')).toBe(false);
      expect(isPositiveFlag('LOW_RISK')).toBe(false);
    });
  });

  describe('hasCriminalLowRiskRoleOnly', () => {
    it('returns true when only victim/witness roles', () => {
      const caseData = {
        juditRoleSummary: [{ area: 'criminal', isVictim: true }],
      };
      expect(hasCriminalLowRiskRoleOnly(caseData)).toBe(true);
    });

    it('returns false when defendant roles present', () => {
      const caseData = {
        juditRoleSummary: [{ area: 'criminal', isDefendant: true }],
      };
      expect(hasCriminalLowRiskRoleOnly(caseData)).toBe(false);
    });
  });

  describe('isGenericCautionText', () => {
    it('identifies generic caution text', () => {
      expect(isGenericCautionText('cobertura parcial')).toBe(true);
      expect(isGenericCautionText('dados insuficientes')).toBe(true);
    });

    it('rejects specific text', () => {
      expect(isGenericCautionText('Processo trabalhista encontrado')).toBe(false);
    });
  });

  describe('compactJuditRoleSummary', () => {
    it('compacts role summary items', () => {
      const items = [
        { area: 'criminal', isDefendant: true, tribunalAcronym: 'TJSP' },
      ];
      const result = compactJuditRoleSummary(items);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].area).toBe('criminal');
      expect(result[0].isDefendant).toBe(true);
    });

    it('handles empty array', () => {
      expect(compactJuditRoleSummary([])).toEqual([]);
    });
  });

  describe('compactBigDataCorpProcessos', () => {
    it('compacts BigDataCorp processos', () => {
      const items = [
        { numero: '123', tribunal: 'TJSP', situacao: 'Ativo' },
      ];
      const result = compactBigDataCorpProcessos(items);
      expect(Array.isArray(result)).toBe(true);
    });

    it('handles empty array', () => {
      expect(compactBigDataCorpProcessos([])).toEqual([]);
    });
  });

  describe('compactEscavadorProcessos', () => {
    it('compacts Escavador processos', () => {
      const items = [
        { numero: '456', tribunal: 'TJRJ' },
      ];
      const result = compactEscavadorProcessos(items);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('compactDjenComunicacoes', () => {
    it('compacts DJEN comunicacoes', () => {
      const items = [
        { numero: '789', tipo: 'Intimação' },
      ];
      const result = compactDjenComunicacoes(items);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('estimateAiCostUsd', () => {
    it('estimates cost for given tokens', () => {
      const cost = estimateAiCostUsd(1000, 500);
      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThan(0);
    });

    it('handles zero tokens', () => {
      expect(estimateAiCostUsd(0, 0)).toBe(0);
    });
  });

  describe('getAiProvidersIncluded', () => {
    it('returns providers with DONE status', () => {
      const caseData = {
        enrichmentStatus: 'DONE',
        escavadorEnrichmentStatus: 'PARTIAL',
        juditEnrichmentStatus: 'PENDING',
        bigdatacorpEnrichmentStatus: 'DONE',
      };
      const providers = getAiProvidersIncluded(caseData);
      expect(providers).toContain('FonteData');
      expect(providers).toContain('Escavador');
      expect(providers).toContain('BigDataCorp');
      expect(providers).not.toContain('Judit');
    });

    it('returns empty array when no providers done', () => {
      const caseData = {
        enrichmentStatus: 'PENDING',
        escavadorEnrichmentStatus: 'PENDING',
      };
      expect(getAiProvidersIncluded(caseData)).toEqual([]);
    });
  });
});

describe('aiOrchestrator - Error Handling', () => {
  describe('compactErrorMessage', () => {
    it('truncates long messages', () => {
      const longMessage = 'a'.repeat(500);
      const result = compactErrorMessage(longMessage);
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it('returns empty string for null', () => {
      expect(compactErrorMessage(null)).toBe('');
    });
  });

  describe('extractApiErrorMessage', () => {
    it('extracts message from JSON error string', () => {
      const error = JSON.stringify({ error: { message: 'API error' }, code: 500 });
      expect(extractApiErrorMessage(error)).toBe('API error');
    });

    it('returns string as-is', () => {
      expect(extractApiErrorMessage('simple error')).toBe('simple error');
    });

    it('returns empty string for null', () => {
      expect(extractApiErrorMessage(null)).toBe('');
    });
  });

  describe('formatOpenAiError', () => {
    it('formats OpenAI error with status and body', () => {
      const bodyText = JSON.stringify({ error: { message: 'Rate limited' } });
      const result = formatOpenAiError(429, bodyText);
      expect(result).toContain('IA indisponivel temporariamente por limite de taxa');
    });
  });

  describe('formatAiRuntimeError', () => {
    it('formats runtime error', () => {
      const error = new Error('Runtime error');
      const result = formatAiRuntimeError(error);
      expect(result).toContain('Runtime error');
    });
  });
});

describe('aiOrchestrator - Review & Guardrails', () => {
  describe('buildReviewSource', () => {
    it('builds review source object', () => {
      const source = buildReviewSource('FonteData', 'DONE', 5);
      expect(source.name).toBe('FonteData');
      expect(source.status).toBe('DONE');
      expect(source.findingCount).toBe(5);
    });
  });

  describe('summarizeAxisCoverage', () => {
    it('summarizes coverage from sources', () => {
      const sources = [
        buildReviewSource('FonteData', 'DONE', 3),
        buildReviewSource('Judit', 'DONE', 2),
      ];
      const summary = summarizeAxisCoverage(sources);
      expect(summary.sourceCoverageStatus).toBe('COMPLETE');
      expect(summary.queriedSources).toContain('FonteData');
      expect(summary.queriedSources).toContain('Judit');
    });

    it('handles empty sources', () => {
      const summary = summarizeAxisCoverage([]);
      expect(summary.sourceCoverageStatus).toBe('UNKNOWN');
      expect(summary.queriedSources).toEqual([]);
    });
  });

  describe('buildAxisReviewContext', () => {
    it('builds context for axis review', () => {
      const context = buildAxisReviewContext('labor', 'NEGATIVE', [], {});
      expect(context.axis).toBe('labor');
      expect(context.autoFlag).toBe('NEGATIVE');
    });
  });

  describe('applyAxisReviewGuardrail', () => {
    it('applies guardrail to context', () => {
      const context = { axis: 'labor', autoFlag: 'NEGATIVE' };
      const result = applyAxisReviewGuardrail('labor', context);
      expect(result).toBeDefined();
    });
  });

  describe('applyAiClassificationReviewGuardrails', () => {
    it('applies guardrails to review', () => {
      const review = { axis: 'labor', flag: 'NEGATIVE' };
      const caseData = {};
      const result = applyAiClassificationReviewGuardrails(review, caseData);
      expect(result).toBeDefined();
    });
  });
});

describe('aiOrchestrator - Prompt Builders', () => {
  describe('buildAiPrompt', () => {
    it('builds AI prompt from case data', () => {
      const caseData = {
        name: 'Test Case',
        cpf: '12345678901',
      };
      const prompt = buildAiPrompt(caseData);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('buildAiHomonymPrompt', () => {
    it('builds homonym prompt', () => {
      const homonymInput = {
        candidates: [],
        name: 'Test',
        cpf: '12345678901',
      };
      const prompt = buildAiHomonymPrompt(homonymInput);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('buildAiPrefillPrompt', () => {
    it('builds prefill prompt', () => {
      const caseData = {
        name: 'Test',
        cpf: '12345678901',
      };
      const prompt = buildAiPrefillPrompt(caseData);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('buildAiClassificationReviewPrompt', () => {
    it('builds classification review prompt', () => {
      const caseData = {
        name: 'Test',
        cpf: '12345678901',
      };
      const prompt = buildAiClassificationReviewPrompt(caseData);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('buildAiClassificationReviewContext', () => {
    it('builds review context', () => {
      const caseData = {
        name: 'Test',
        cpf: '12345678901',
      };
      const context = buildAiClassificationReviewContext(caseData);
      expect(context).toBeDefined();
    });
  });
});

describe('aiOrchestrator - Payload Builders', () => {
  describe('buildAiUpdatePayload', () => {
    it('builds update payload from AI result', () => {
      const caseData = { id: 'case-123', enrichmentStatus: 'DONE' };
      const aiResult = {
        analysis: 'test',
        structured: { classification: 'NEGATIVE' },
        structuredOk: true,
        inputTokens: 100,
        outputTokens: 50,
      };
      const payload = buildAiUpdatePayload(caseData, aiResult);
      expect(payload).toBeDefined();
      expect(payload.aiStatus).toBe('DONE');
      expect(payload.aiProvidersIncluded).toContain('FonteData');
    });

    it('handles options', () => {
      const caseData = { id: 'case-123', enrichmentStatus: 'DONE' };
      const aiResult = { analysis: 'test', structuredOk: true };
      const payload = buildAiUpdatePayload(caseData, aiResult, { aiRunCount: 2 });
      expect(payload.aiRunCount).toBe(2);
    });
  });

  describe('buildAiHomonymUpdatePayload', () => {
    it('builds homonym update payload', () => {
      const caseData = { id: 'case-123' };
      const homonymInput = { needsAnalysis: true, ambiguityReasons: ['test'] };
      const aiResult = { 
        analysis: 'test',
        structured: { decision: 'LIKELY_MATCH', confidence: 'HIGH' },
        structuredOk: true 
      };
      const payload = buildAiHomonymUpdatePayload(caseData, homonymInput, aiResult);
      expect(payload).toBeDefined();
      expect(payload.aiHomonymDecision).toBe('LIKELY_MATCH');
      expect(payload.aiHomonymTriggered).toBe(true);
    });
  });

  describe('buildAiPrefillUpdatePayload', () => {
    it('builds prefill update payload', () => {
      const aiResult = { 
        analysis: 'test',
        structured: { executiveSummary: 'Test summary' },
        structuredOk: true 
      };
      const payload = buildAiPrefillUpdatePayload(aiResult);
      expect(payload).toBeDefined();
      expect(payload.prefillNarratives).toBeDefined();
      expect(payload.prefillNarratives.executiveSummary).toBe('Test summary');
      expect(payload.prefillNarratives.metadata.ok).toBe(true);
    });
  });

  describe('buildAiClassificationReviewUpdatePayload', () => {
    it('builds classification review update payload', () => {
      const aiResult = { 
        analysis: 'test',
        structured: { summary: 'Review completed' },
        structuredOk: true 
      };
      const payload = buildAiClassificationReviewUpdatePayload(aiResult);
      expect(payload).toBeDefined();
      expect(payload.aiClassificationReviewOk).toBe(true);
    });

    it('handles options', () => {
      const aiResult = { analysis: 'test', structuredOk: true };
      const payload = buildAiClassificationReviewUpdatePayload(aiResult, { aiRunCount: 2 });
      expect(payload.aiRunCount).toBe(2);
    });
  });
});

describe('aiOrchestrator - Execution Handlers', () => {
  describe('runStructuredAiAnalysis', () => {
    it('should be a function', () => {
      expect(typeof runStructuredAiAnalysis).toBe('function');
    });
  });

  describe('runAiAnalysis', () => {
    it('should be a function', () => {
      expect(typeof runAiAnalysis).toBe('function');
    });
  });

  describe('runAiHomonymAnalysis', () => {
    it('should be a function', () => {
      expect(typeof runAiHomonymAnalysis).toBe('function');
    });
  });

  describe('runAiPrefillAnalysis', () => {
    it('should be a function', () => {
      expect(typeof runAiPrefillAnalysis).toBe('function');
    });
  });

  describe('runAiClassificationReviewAnalysis', () => {
    it('should be a function', () => {
      expect(typeof runAiClassificationReviewAnalysis).toBe('function');
    });
  });

  describe('recordAiCostLedger', () => {
    it('should be a function', () => {
      expect(typeof recordAiCostLedger).toBe('function');
    });
  });
});
