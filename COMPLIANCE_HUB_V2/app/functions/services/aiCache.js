/**
 * AI cache key generation utilities.
 */

const {
    AI_PROMPT_VERSION,
    AI_HOMONYM_CONTEXT_VERSION,
} = require('../ai/aiConfig');

function computeSimpleHash(value) {
    const crypto = require('crypto');
    const input = String(value || '');
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function computeAiCacheKey(caseData, options = {}) {
    const { kind = 'general', context = null, prompt = null } = options;

    if (kind === 'homonym') {
        const serializedContext = JSON.stringify({
            version: AI_HOMONYM_CONTEXT_VERSION,
            context: context || null,
        });
        return `ai_homonym_${computeSimpleHash(serializedContext)}`;
    }

    const promptPayload = JSON.stringify({
        version: AI_PROMPT_VERSION,
        prompt: prompt || '',
    });
    return `ai_${computeSimpleHash(promptPayload)}`;
}

module.exports = { computeSimpleHash, computeAiCacheKey };
