/**
 * AI update payload builders for Firestore.
 */

const { FieldValue } = require('firebase-admin/firestore');
const {
    AI_MODEL,
    AI_PROMPT_VERSION,
    AI_HOMONYM_CONTEXT_VERSION,
    AI_PREFILL_PROMPT_VERSION,
    estimateAiCostUsd,
} = require('./aiConfig');
const { getAiProvidersIncluded } = require('../utils/statusUtils');
const { stripUndefined } = require('../utils/stringUtils');

function buildAiUpdatePayload(caseData, aiResult, options = {}) {
    const payload = {
        aiModel: aiResult.model || AI_MODEL,
        aiPromptVersion: AI_PROMPT_VERSION,
        aiExecutedAt: FieldValue.serverTimestamp(),
        aiProvidersIncluded: getAiProvidersIncluded(caseData),
        aiFromCache: !!aiResult.fromCache,
        aiError: aiResult.error || null,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (options.aiRunCount !== undefined) {
        payload.aiRunCount = options.aiRunCount;
    }

    if (Object.prototype.hasOwnProperty.call(aiResult, 'analysis')) {
        payload.aiRawResponse = aiResult.analysis || null;
        payload.aiStructured = aiResult.structured || null;
        payload.aiStructuredOk = aiResult.structuredOk || false;
    }

    const costUsd = estimateAiCostUsd(aiResult.inputTokens || 0, aiResult.outputTokens || 0);
    payload.aiCostUsd = parseFloat(costUsd.toFixed(6));
    payload.aiTokens = { input: aiResult.inputTokens || 0, output: aiResult.outputTokens || 0 };
    return stripUndefined(payload);
}

function buildAiHomonymResetPayload(homonymInput = null) {
    return {
        aiHomonymTriggered: false,
        aiHomonymContextVersion: AI_HOMONYM_CONTEXT_VERSION,
        aiHomonymAmbiguityReasons: homonymInput?.ambiguityReasons || [],
        aiHomonymHardFacts: homonymInput?.hardFacts || [],
        aiHomonymStructured: FieldValue.delete(),
        aiHomonymStructuredOk: FieldValue.delete(),
        aiHomonymRawResponse: FieldValue.delete(),
        aiHomonymDecision: FieldValue.delete(),
        aiHomonymConfidence: FieldValue.delete(),
        aiHomonymRisk: FieldValue.delete(),
        aiHomonymRecommendedAction: FieldValue.delete(),
        aiHomonymCostUsd: FieldValue.delete(),
        aiHomonymTokens: FieldValue.delete(),
        aiHomonymExecutedAt: FieldValue.delete(),
        aiHomonymError: FieldValue.delete(),
        aiHomonymFromCache: FieldValue.delete(),
    };
}

function buildAiHomonymUpdatePayload(caseData, homonymInput, aiResult) {
    const payload = {
        aiHomonymTriggered: !!homonymInput?.needsAnalysis,
        aiHomonymContextVersion: AI_HOMONYM_CONTEXT_VERSION,
        aiHomonymAmbiguityReasons: homonymInput?.ambiguityReasons || [],
        aiHomonymHardFacts: homonymInput?.hardFacts || [],
        aiHomonymExecutedAt: FieldValue.serverTimestamp(),
        aiHomonymFromCache: !!aiResult?.fromCache,
        aiHomonymError: aiResult?.error || null,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (Object.prototype.hasOwnProperty.call(aiResult || {}, 'analysis')) {
        payload.aiHomonymRawResponse = aiResult.analysis || null;
        payload.aiHomonymStructured = aiResult.structured || null;
        payload.aiHomonymStructuredOk = aiResult.structuredOk || false;
    }

    if (aiResult?.structuredOk && aiResult?.structured) {
        payload.aiHomonymDecision = aiResult.structured.decision || null;
        payload.aiHomonymConfidence = aiResult.structured.confidence || null;
        payload.aiHomonymRisk = aiResult.structured.homonymRisk || null;
        payload.aiHomonymRecommendedAction = aiResult.structured.recommendedAction || null;
    } else {
        payload.aiHomonymDecision = 'UNCERTAIN';
        payload.aiHomonymConfidence = 'LOW';
        payload.aiHomonymRisk = homonymInput?.needsAnalysis ? 'MEDIUM' : null;
        payload.aiHomonymRecommendedAction = homonymInput?.needsAnalysis ? 'MANUAL_REVIEW' : null;
    }

    const costUsd = estimateAiCostUsd(aiResult?.inputTokens || 0, aiResult?.outputTokens || 0);
    payload.aiHomonymCostUsd = parseFloat(costUsd.toFixed(6));
    payload.aiHomonymTokens = { input: aiResult?.inputTokens || 0, output: aiResult?.outputTokens || 0 };
    return stripUndefined(payload);
}

function buildAiPrefillUpdatePayload(aiResult) {
    const metadata = {
        model: aiResult?.model || AI_MODEL,
        promptVersion: AI_PREFILL_PROMPT_VERSION,
        executedAt: new Date().toISOString(),
        ok: Boolean(aiResult?.structuredOk && aiResult?.structured),
        fromCache: !!aiResult?.fromCache,
        error: aiResult?.error || null,
    };

    return stripUndefined({
        prefillNarratives: {
            ...(aiResult?.structured || {}),
            metadata,
        },
        updatedAt: FieldValue.serverTimestamp(),
    });
}

module.exports = {
    buildAiUpdatePayload,
    buildAiHomonymResetPayload,
    buildAiHomonymUpdatePayload,
    buildAiPrefillUpdatePayload,
};
