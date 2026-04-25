const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const aiConfig = require('../ai/aiConfig');
const {
    AI_MODEL,
    AI_MAX_TOKENS,
    AI_CACHE_TTL_MS,
    AI_CIRCUIT_THRESHOLD,
    AI_CIRCUIT_COOLDOWN_MS,
    AI_GENERAL_SYSTEM_MESSAGE,
} = aiConfig;
const {
    formatOpenAiError,
    formatAiRuntimeError,
    sanitizeAiOutput,
} = require('../utils/stringUtils');

let _overrideDb = null;
function getDb() {
    return _overrideDb || getFirestore();
}
function _setDb(db) {
    _overrideDb = db;
}

async function runStructuredAiAnalysis({
    caseData,
    apiKey,
    prompt,
    systemMessage,
    cacheDocId,
    cacheKey,
    parser,
    skipCache = false,
    maxTokens = AI_MAX_TOKENS,
}) {
    if (Date.now() < aiConfig._aiCircuitOpenUntil) {
        console.warn('AI circuit breaker OPEN - skipping analysis.');
        return { error: 'Circuit breaker aberto. IA temporariamente desativada.', inputTokens: 0, outputTokens: 0 };
    }

    const inputEstimate = Math.ceil(prompt.length / 3.5);
    const caseRef = getDb().collection('cases').doc(caseData.id || caseData._caseId);

    if (!skipCache) {
        try {
            const cacheDoc = await caseRef.collection('aiCache').doc(cacheDocId).get();
            if (cacheDoc.exists) {
                const cached = cacheDoc.data();
                const cacheAge = Date.now() - (cached.cachedAt?.toMillis?.() || 0);
                if (cacheAge < AI_CACHE_TTL_MS && cached.cacheKey === cacheKey) {
                    console.log(`AI cache HIT (${cacheDocId}) for case ${caseData.id || caseData._caseId}`);
                    return {
                        analysis: cached.aiRawResponse,
                        structured: cached.aiStructured,
                        structuredOk: cached.aiStructuredOk,
                        inputTokens: cached.aiTokens?.input || 0,
                        outputTokens: cached.aiTokens?.output || 0,
                        model: cached.aiModel,
                        fromCache: true,
                    };
                }
            }
        } catch (cacheErr) {
            console.warn(`AI cache read failed (${cacheDocId}):`, cacheErr.message);
        }
    }

    let lastError = null;
    let shouldTripCircuit = false;
    for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30000);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    max_completion_tokens: maxTokens,
                    temperature: 0.1,
                    messages: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: prompt },
                    ],
                }),
                signal: controller.signal,
            });

            clearTimeout(timer);

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                lastError = formatOpenAiError(response.status, body);
                console.error(`AI analysis attempt ${attempt + 1} failed (${cacheDocId}): ${response.status} ${body}`);
                if (response.status === 429 || response.status >= 500) {
                    shouldTripCircuit = true;
                    continue;
                }
                return { error: lastError, inputTokens: inputEstimate, outputTokens: 0 };
            }

            const json = await response.json();
            const usage = json.usage || {};
            const rawContent = json.choices?.[0]?.message?.content || '';
            const sanitized = sanitizeAiOutput(rawContent);
            const parsed = parser(sanitized);

            const result = {
                analysis: sanitized,
                structured: parsed.structured,
                structuredOk: parsed.ok,
                inputTokens: usage.prompt_tokens || inputEstimate,
                outputTokens: usage.completion_tokens || Math.ceil(rawContent.length / 3.5),
                model: AI_MODEL,
                fromCache: false,
            };

            caseRef.collection('aiCache').doc(cacheDocId).set({
                aiRawResponse: result.analysis,
                aiStructured: result.structured || null,
                aiStructuredOk: result.structuredOk,
                aiModel: result.model,
                aiTokens: { input: result.inputTokens, output: result.outputTokens },
                cacheKey,
                cachedAt: FieldValue.serverTimestamp(),
            }).catch((err) => console.warn(`AI cache write failed (${cacheDocId}):`, err.message));

            return result;
        } catch (err) {
            lastError = formatAiRuntimeError(err);
            shouldTripCircuit = true;
            console.error(`AI analysis attempt ${attempt + 1} error (${cacheDocId}):`, err.message);
        }
    }

    if (shouldTripCircuit) {
        aiConfig._aiCircuitFailures++;
        if (aiConfig._aiCircuitFailures >= AI_CIRCUIT_THRESHOLD) {
            aiConfig._aiCircuitOpenUntil = Date.now() + AI_CIRCUIT_COOLDOWN_MS;
            console.error('AI circuit breaker OPENED after consecutive failures.');
        }
    }
    return { error: lastError, inputTokens: inputEstimate, outputTokens: 0 };
}

module.exports = { runStructuredAiAnalysis, _setDb };
