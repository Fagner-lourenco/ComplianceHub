/**
 * BigDataCorp API adapter.
 *
 * Uses Node 20 built-in `fetch` — no extra deps.
 * Auth: dual-header JWT (AccessToken + TokenId).
 * Base URL: https://plataforma.bigdatacorp.com.br
 * Method: POST (all endpoints).
 *
 * Datasets supported:
 *   - basic_data (R$0.03) — identity validation
 *   - processes (R$0.07) — lawsuits with CPF in Parties.Doc
 *   - kyc (R$0.05) — PEP + sanctions (Interpol, FBI, OFAC, etc.)
 *   - occupation_data (R$0.05) — employment/profession history
 *
 * Cost per combined query: R$0.20
 */

const BASE_URL = process.env.BIGDATACORP_BASE_URL || 'https://plataforma.bigdatacorp.com.br';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = 25000;

class BigDataCorpError extends Error {
    constructor(message, statusCode, retryable, datasetStatus) {
        super(message);
        this.name = 'BigDataCorpError';
        this.statusCode = statusCode;
        this.retryable = retryable;
        this.datasetStatus = datasetStatus || null;
    }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Low-level POST call with timeout + retry on 429/5xx.
 * BigDataCorp uses response-body status codes (negative = error), NOT HTTP status.
 *
 * @param {string} path  e.g. '/pessoas'
 * @param {object} body  JSON body
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @returns {Promise<object>}  Parsed JSON body
 */
async function callPost(path, body, credentials) {
    const url = `${BASE_URL}${path}`;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'AccessToken': credentials.accessToken,
                    'TokenId': credentials.tokenId,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timer);

            // HTTP-level errors
            if (response.status === 401 || response.status === 403) {
                throw new BigDataCorpError(
                    `BigDataCorp auth error: ${response.status}`,
                    response.status,
                    false,
                );
            }
            if (response.status === 429) {
                lastError = new BigDataCorpError(
                    `BigDataCorp rate limited (429)`,
                    429,
                    true,
                );
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await delay(backoff);
                continue;
            }
            if (response.status >= 500) {
                lastError = new BigDataCorpError(
                    `BigDataCorp server error: ${response.status}`,
                    response.status,
                    true,
                );
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await delay(backoff);
                continue;
            }

            if (!response.ok) {
                throw new BigDataCorpError(
                    `BigDataCorp HTTP error: ${response.status}`,
                    response.status,
                    false,
                );
            }

            const data = await response.json();

            // Check response-body Status (BigDataCorp uses negative codes for errors)
            const status = data?.Status;
            if (status && typeof status === 'object') {
                const statusCode = status.Code ?? status.code ?? 0;
                if (statusCode < 0) {
                    // -1000 to -1199: auth errors (non-retryable)
                    if (statusCode <= -1000 && statusCode > -1200) {
                        throw new BigDataCorpError(
                            `BigDataCorp auth error in response: ${statusCode} - ${status.Message || ''}`,
                            statusCode,
                            false,
                            status,
                        );
                    }
                    // -1200 to -1999: internal/server errors (retryable)
                    if (statusCode <= -1200 && statusCode > -2000) {
                        lastError = new BigDataCorpError(
                            `BigDataCorp internal error: ${statusCode} - ${status.Message || ''}`,
                            statusCode,
                            true,
                            status,
                        );
                        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                        await delay(backoff);
                        continue;
                    }
                    // -100 to -999: input/validation errors (non-retryable)
                    throw new BigDataCorpError(
                        `BigDataCorp input error: ${statusCode} - ${status.Message || ''}`,
                        statusCode,
                        false,
                        status,
                    );
                }
            }

            return data;
        } catch (error) {
            clearTimeout(timer);
            if (error instanceof BigDataCorpError && !error.retryable) throw error;
            if (error.name === 'AbortError') {
                lastError = new BigDataCorpError(
                    `BigDataCorp request timeout (${REQUEST_TIMEOUT_MS}ms)`,
                    0,
                    true,
                );
            } else if (!(error instanceof BigDataCorpError)) {
                lastError = new BigDataCorpError(
                    `BigDataCorp network error: ${error.message}`,
                    0,
                    true,
                );
            } else {
                lastError = error;
            }
            if (attempt < MAX_RETRIES - 1) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await delay(backoff);
            }
        }
    }

    throw lastError;
}

/**
 * Query all 4 datasets in a single POST call.
 * Combined query reduces latency vs separate calls.
 *
 * @param {string} cpf  11 digits (no formatting)
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @param {object} [options]
 * @param {number} [options.processLimit=100]  Max processes to return
 * @returns {Promise<{ raw: object, basicData: object|null, processes: object|null, kycData: object|null, professionData: object|null, elapsedMs: number }>}
 */
async function queryCombined(cpf, credentials, options = {}) {
    const processLimit = options.processLimit || 100;
    const startMs = Date.now();

    const body = {
        q: `doc{${cpf}} returnupdates{false}`,
        Datasets: `basic_data,processes.limit(${processLimit}),kyc,occupation_data`,
        Limit: 1,
    };

    const data = await callPost('/pessoas', body, credentials);
    const elapsedMs = Date.now() - startMs;

    // Extract results from the first (and only) result entry
    const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;

    return {
        raw: data,
        basicData: resultEntry?.BasicData || null,
        processes: resultEntry?.Processes || null,
        kycData: resultEntry?.KycData || null,
        professionData: resultEntry?.ProfessionData || null,
        elapsedMs,
    };
}

/**
 * Query only processes dataset (for pagination or standalone use).
 *
 * @param {string} cpf
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @param {object} [options]
 * @param {number} [options.limit=100]
 * @param {number} [options.offset=0]  Page offset (next)
 * @returns {Promise<{ raw: object, processes: object|null, elapsedMs: number }>}
 */
async function queryProcesses(cpf, credentials, options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    const startMs = Date.now();

    let datasetStr = `processes.limit(${limit})`;
    if (offset > 0) {
        datasetStr = `processes.limit(${limit}).next(${offset})`;
    }

    const body = {
        q: `doc{${cpf}} returnupdates{false}`,
        Datasets: datasetStr,
        Limit: 1,
    };

    const data = await callPost('/pessoas', body, credentials);
    const elapsedMs = Date.now() - startMs;
    const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;

    return {
        raw: data,
        processes: resultEntry?.Processes || null,
        elapsedMs,
    };
}

/**
 * Query only KYC dataset (standalone for PEP/sanctions check).
 *
 * @param {string} cpf
 * @param {{ accessToken: string, tokenId: string }} credentials
 * @returns {Promise<{ raw: object, kycData: object|null, elapsedMs: number }>}
 */
async function queryKyc(cpf, credentials) {
    const startMs = Date.now();

    const body = {
        q: `doc{${cpf}}`,
        Datasets: 'kyc',
        Limit: 1,
    };

    const data = await callPost('/pessoas', body, credentials);
    const elapsedMs = Date.now() - startMs;
    const resultEntry = Array.isArray(data?.Result) ? data.Result[0] : null;

    return {
        raw: data,
        kycData: resultEntry?.KycData || null,
        elapsedMs,
    };
}

module.exports = {
    queryCombined,
    queryProcesses,
    queryKyc,
    BigDataCorpError,
};
