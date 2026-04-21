/**
 * Judit API adapter.
 *
 * Uses Node 20 built-in `fetch` — no extra deps.
 * Auth: header `api-key` (NOT Bearer, NOT Authorization).
 * Rate limit: 180 req/min — retry on 429.
 *
 * Flow types:
 *   - Sync datalake: POST https://lawsuits.production.judit.io/lawsuits → immediate
 *   - Async:         POST https://requests.prod.judit.io/requests → poll → GET /responses
 *   - Entity:        POST https://lawsuits.prod.judit.io/requests/create (synchronous, R$0.12)
 *
 * Pricing (tier 1 / lowest volume):
 *   - Dados cadastrais Data Lake: R$0.12   | On Demand: R$0.15
 *   - Historica simples (contador): R$0.50
 *   - Historica sintetica: R$0.75
 *   - Historica Data Lake: R$1.50/1000 processos
 *   - Historica On Demand: R$6.00/1000 processos
 *   - Mandado de prisao: R$1.00
 *   - Execucao criminal: R$0.50
 *   - Consulta real-time por CNJ: R$0.25
 *
 * Supports optional callback_url in async POST body. If set, Judit sends
 * incremental results to that URL, ending with a request_completed event.
 *
 * cache_ttl_in_days: reuse cached extraction if within X days (default: 7).
 */

const SYNC_BASE_URL = process.env.JUDIT_SYNC_BASE_URL || 'https://lawsuits.production.judit.io';
const ASYNC_BASE_URL = process.env.JUDIT_ASYNC_BASE_URL || 'https://requests.prod.judit.io';
const ENTITY_BASE_URL = process.env.JUDIT_ENTITY_BASE_URL || 'https://lawsuits.prod.judit.io';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_WAIT_MS = 8 * 60 * 1000;
const DEFAULT_CACHE_TTL_DAYS = 7;

class JuditError extends Error {
    constructor(message, statusCode, retryable) {
        super(message);
        this.name = 'JuditError';
        this.statusCode = statusCode;
        this.retryable = retryable;
    }
}

/**
 * Format CPF as XXX.XXX.XXX-XX (Judit expects formatted CPF).
 * @param {string} cpf  11 digits, no formatting
 * @returns {string}
 */
function formatCpf(cpf) {
    const clean = (cpf || '').replace(/\D/g, '');
    if (clean.length !== 11) return cpf;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

/**
 * Low-level POST with timeout + retry on 429/5xx.
 * @param {string} baseUrl
 * @param {string} path
 * @param {object} body
 * @param {string} apiKey
 * @returns {Promise<object>}
 */
async function callPost(baseUrl, path, body, apiKey) {
    const url = `${baseUrl}${path}`;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timer);

            if (response.ok) {
                return await response.json();
            }

            if (response.status === 401 || response.status === 403) {
                throw new JuditError(
                    `Judit auth error: ${response.status}`,
                    response.status,
                    false,
                );
            }

            if (response.status === 402) {
                throw new JuditError(
                    'Judit saldo insuficiente',
                    402,
                    false,
                );
            }

            if (response.status === 429 || response.status >= 500) {
                lastError = new JuditError(
                    `Judit ${response.status} on ${path}`,
                    response.status,
                    true,
                );
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, backoff));
                continue;
            }

            const text = await response.text().catch(() => '');
            throw new JuditError(
                `Judit error ${response.status} on ${path}: ${text}`,
                response.status,
                false,
            );
        } catch (error) {
            clearTimeout(timer);
            if (error instanceof JuditError && !error.retryable) throw error;

            lastError = error;
            if (attempt < MAX_RETRIES - 1) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, backoff));
            }
        }
    }

    throw lastError || new Error('Judit: max retries exceeded');
}

/**
 * Low-level GET with timeout + retry.
 * @param {string} url
 * @param {string} apiKey
 * @returns {Promise<object>}
 */
async function callGet(url, apiKey) {
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'api-key': apiKey },
                signal: controller.signal,
            });

            clearTimeout(timer);

            if (response.ok) {
                return await response.json();
            }

            if (response.status === 429 || response.status >= 500) {
                lastError = new JuditError(
                    `Judit ${response.status}`,
                    response.status,
                    true,
                );
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, backoff));
                continue;
            }

            const text = await response.text().catch(() => '');
            throw new JuditError(
                `Judit GET error ${response.status}: ${text}`,
                response.status,
                false,
            );
        } catch (error) {
            clearTimeout(timer);
            if (error instanceof JuditError && !error.retryable) throw error;

            lastError = error;
            if (attempt < MAX_RETRIES - 1) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, backoff));
            }
        }
    }

    throw lastError || new Error('Judit GET: max retries exceeded');
}

/**
 * Check the current status of an async request without polling.
 * @param {string} requestId
 * @param {string} apiKey
 * @returns {Promise<string>}  The current status ('pending', 'completed', 'failed', etc.)
 */
async function checkRequestStatus(requestId, apiKey) {
    const data = await callGet(`${ASYNC_BASE_URL}/requests/${requestId}`, apiKey);
    return data.status || data.request_status || 'unknown';
}

/**
 * Poll a Judit async request until completed.
 * @param {string} requestId
 * @param {string} apiKey
 * @returns {Promise<string>}  The final status
 */
async function pollRequest(requestId, apiKey, options = {}) {
    const pollIntervalMs = options.pollIntervalMs || POLL_INTERVAL_MS;
    const maxWaitMs = options.maxWaitMs || POLL_MAX_WAIT_MS;
    const startedAt = Date.now();
    let attempts = 0;

    while (Date.now() - startedAt < maxWaitMs) {
        attempts++;
        const data = await callGet(`${ASYNC_BASE_URL}/requests/${requestId}`, apiKey);
        const status = data.status || data.request_status;

        if (status === 'completed' || status === 'done') return status;
        if (status === 'failed' || status === 'error') {
            throw new JuditError(`Judit request ${requestId} failed: ${status}`, 0, false);
        }
        if (status === 'cancelled') {
            throw new JuditError(`Judit request ${requestId} was cancelled by provider`, 0, false);
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new JuditError(
        `Judit request ${requestId} ainda em processamento apos ${Math.round(maxWaitMs / 1000)}s`,
        408,
        true,
    );
}

/**
 * Fetch all responses for a completed async request.
 * @param {string} requestId
 * @param {string} apiKey
 * @returns {Promise<object[]>}  Array of response objects
 */
async function fetchResponses(requestId, apiKey) {
    const url = `${ASYNC_BASE_URL}/responses?request_id=${requestId}&page=1&page_size=100`;
    const data = await callGet(url, apiKey);

    const items = Array.isArray(data.page_data) ? data.page_data : [];
    const allPages = data.all_pages_count || 1;

    // Fetch remaining pages if any
    for (let page = 2; page <= Math.min(allPages, 10); page++) {
        const nextUrl = `${ASYNC_BASE_URL}/responses?request_id=${requestId}&page=${page}&page_size=100`;
        const nextData = await callGet(nextUrl, apiKey);
        if (Array.isArray(nextData.page_data)) items.push(...nextData.page_data);
    }

    return items;
}

/**
 * Query lawsuits via sync datalake / hot storage (immediate response).
 * DEFAULT strategy — cheapest and fastest path (R$0.50 consulta historica simples).
 * POST https://lawsuits.production.judit.io/lawsuits
 * Always sends process_status: true for phase/status fields.
 * @param {string} cpf  11 digits
 * @param {string} apiKey
 * @param {{ searchType?: string, searchKey?: string }} options
 * @returns {Promise<{ hasLawsuits: boolean, requestId: string, responseData: object[], _raw: object }>}
 */
async function queryLawsuitsSync(cpf, apiKey, options = {}) {
    const searchType = options.searchType || 'cpf';
    const searchKey = options.searchKey || formatCpf(cpf);

    const body = {
        search: {
            search_type: searchType,
            search_key: searchKey,
        },
        process_status: true,
    };

    const data = await callPost(SYNC_BASE_URL, '/lawsuits', body, apiKey);
    const lawsuits = Array.isArray(data.response_data)
        ? data.response_data
        : Array.isArray(data.lawsuits)
            ? data.lawsuits
            : [];

    return {
        hasLawsuits: data.has_lawsuits || false,
        requestId: data.request_id || null,
        responseData: lawsuits,
        _raw: data,
        _request: { url: `${SYNC_BASE_URL}/lawsuits`, body },
    };
}

/**
 * Query lawsuits via sync datalake by name (supplement when CPF yields 0).
 * Same endpoint as queryLawsuitsSync but with search_type='name'.
 * @param {string} fullName
 * @param {string} apiKey
 * @returns {Promise<{ hasLawsuits: boolean, requestId: string, responseData: object[], searchType: string, _raw: object }>}
 */
async function queryLawsuitsSyncByName(fullName, apiKey) {
    const result = await queryLawsuitsSync(null, apiKey, {
        searchType: 'name',
        searchKey: fullName.trim(),
    });
    return { ...result, searchType: 'name' };
}

/**
 * Query lawsuits via async flow with full filter support (REAL-TIME / ON-DEMAND).
 * ⚠️  EXCEPTION ONLY — disabled by default. Use only when explicitly triggered.
 * Cost: R$1.50/1k (datalake) or R$6.00/1k (on_demand). Prefer queryLawsuitsSync (R$0.50) for normal flow.
 * POST https://requests.prod.judit.io/requests → poll → GET /responses
 * @param {string} cpf  11 digits
 * @param {string} apiKey
 * @param {{ tribunals?: string[], side?: string, onDemand?: boolean, cacheTtlDays?: number, webhookUrl?: string }} options
 * @returns {Promise<{ hasLawsuits: boolean, requestId: string, responseData: object[], _raw: object }>}
 */
async function queryLawsuitsAsync(cpf, apiKey, options = {}) {
    const body = {
        search: {
            search_type: 'cpf',
            search_key: formatCpf(cpf),
            response_type: 'lawsuits',
        },
    };

    if (options.onDemand) body.search.on_demand = true;

    const cacheTtl = options.cacheTtlDays ?? DEFAULT_CACHE_TTL_DAYS;
    if (cacheTtl > 0) body.search.cache_ttl_in_days = cacheTtl;

    const filter = {};
    if (Array.isArray(options.tribunals) && options.tribunals.length > 0) {
        filter.tribunals = { keys: options.tribunals, not_equal: false };
    }
    if (options.side) filter.side = options.side;
    if (Object.keys(filter).length > 0) {
        body.search.search_params = { filter };
    }

    const callbackUrl = options.callbackUrl || options.webhookUrl;
    if (callbackUrl) body.callback_url = callbackUrl;

    const createResult = await callPost(ASYNC_BASE_URL, '/requests', body, apiKey);

    const requestId = createResult.request_id;
    if (!requestId) throw new JuditError('Judit lawsuits async: no request_id returned', 0, false);

    // If webhook is set, return immediately with requestId (no polling)
    if (callbackUrl) {
        return { hasLawsuits: false, requestId, responseData: [], webhookPending: true, _raw: createResult, _request: { url: `${ASYNC_BASE_URL}/requests`, body } };
    }

    await pollRequest(requestId, apiKey);
    const items = await fetchResponses(requestId, apiKey);

    return {
        hasLawsuits: items.length > 0,
        requestId,
        responseData: items,
        _raw: { createResult, responseCount: items.length },
        _request: { url: `${ASYNC_BASE_URL}/requests`, body },
    };
}

/**
 * Query warrants via async flow (create → poll → fetch).
 * @param {string} cpf  11 digits
 * @param {string} apiKey
 * @param {{ tribunals?: string[], onDemand?: boolean, cacheTtlDays?: number, webhookUrl?: string }} options
 * @returns {Promise<object[]>}  Array of warrant response objects
 */
async function queryWarrantAsync(cpf, apiKey, options = {}) {
    const body = {
        search: {
            search_type: 'cpf',
            search_key: formatCpf(cpf),
            response_type: 'warrant',
        },
    };

    if (options.onDemand) body.search.on_demand = true;

    const cacheTtl = options.cacheTtlDays ?? DEFAULT_CACHE_TTL_DAYS;
    if (cacheTtl > 0) body.search.cache_ttl_in_days = cacheTtl;

    if (Array.isArray(options.tribunals) && options.tribunals.length > 0) {
        body.search.search_params = {
            filter: { tribunals: { keys: options.tribunals, not_equal: false } },
        };
    }

    const callbackUrl = options.callbackUrl || options.webhookUrl;
    if (callbackUrl) body.callback_url = callbackUrl;

    const createResult = await callPost(ASYNC_BASE_URL, '/requests', body, apiKey);

    const requestId = createResult.request_id;
    if (!requestId) throw new JuditError('Judit warrant: no request_id returned', 0, false);

    if (callbackUrl) {
        return { requestId, webhookPending: true, responseData: [], _raw: createResult, _request: { url: `${ASYNC_BASE_URL}/requests`, body } };
    }

    await pollRequest(requestId, apiKey);
    const items = await fetchResponses(requestId, apiKey);
    return { requestId, responseData: items, _raw: { createResult, responseCount: items.length }, _request: { url: `${ASYNC_BASE_URL}/requests`, body } };
}

/**
 * Query executions via async flow.
 * @param {string} cpf  11 digits
 * @param {string} apiKey
 * @param {{ tribunals?: string[], cacheTtlDays?: number, webhookUrl?: string }} options
 * @returns {Promise<object[]>}
 */
async function queryExecutionAsync(cpf, apiKey, options = {}) {
    const body = {
        search: {
            search_type: 'cpf',
            search_key: formatCpf(cpf),
            response_type: 'execution',
        },
    };

    const cacheTtl = options.cacheTtlDays ?? DEFAULT_CACHE_TTL_DAYS;
    if (cacheTtl > 0) body.search.cache_ttl_in_days = cacheTtl;

    if (Array.isArray(options.tribunals) && options.tribunals.length > 0) {
        body.search.search_params = {
            filter: { tribunals: { keys: options.tribunals, not_equal: false } },
        };
    }

    const callbackUrl = options.callbackUrl || options.webhookUrl;
    if (callbackUrl) body.callback_url = callbackUrl;

    const createResult = await callPost(ASYNC_BASE_URL, '/requests', body, apiKey);

    const requestId = createResult.request_id;
    if (!requestId) throw new JuditError('Judit execution: no request_id returned', 0, false);

    if (callbackUrl) {
        return { requestId, webhookPending: true, responseData: [], _raw: createResult, _request: { url: `${ASYNC_BASE_URL}/requests`, body } };
    }

    await pollRequest(requestId, apiKey);
    const items = await fetchResponses(requestId, apiKey);
    return { requestId, responseData: items, _raw: { createResult, responseCount: items.length }, _request: { url: `${ASYNC_BASE_URL}/requests`, body } };
}

/**
 * Query entity data from Judit Data Lake (synchronous, R$0.12).
 * Returns person cadastral data: name, CPF status, addresses, parents, birth date.
 * Used as the PRIMARY gate to validate CPF + extract identity + UFs.
 * @param {string} cpf  11 digits
 * @param {string} apiKey
 * @returns {Promise<{ hasLawsuits: boolean, requestId: string, responseData: object[] }>}
 */
async function queryEntityDataLake(cpf, apiKey) {
    const body = {
        search: {
            search_type: 'cpf',
            search_key: formatCpf(cpf),
            response_type: 'entity',
        },
    };

    const data = await callPost(ENTITY_BASE_URL, '/requests/create', body, apiKey);

    return {
        hasLawsuits: data.has_lawsuits || false,
        requestId: data.request_id || null,
        responseData: Array.isArray(data.response_data) ? data.response_data : [],
        _raw: data,
        _request: { url: `${ENTITY_BASE_URL}/requests/create`, body },
    };
}

/**
 * Query lawsuits by exact full name (async flow).
 * Used as supplementary search when CPF yields 0 results.
 * WARNING: Common names return many homonyms — only use when the name is rare enough.
 * @param {string} fullName  Candidate full name
 * @param {string} apiKey
 * @param {{ tribunals?: string[], cacheTtlDays?: number }} options
 * @returns {Promise<{ hasLawsuits: boolean, requestId: string, responseData: object[], searchType: string }>}
 */
async function queryLawsuitsByNameAsync(fullName, apiKey, options = {}) {
    const body = {
        search: {
            search_type: 'name',
            search_key: fullName.trim(),
            response_type: 'lawsuits',
        },
    };

    const cacheTtl = options.cacheTtlDays ?? DEFAULT_CACHE_TTL_DAYS;
    if (cacheTtl > 0) body.search.cache_ttl_in_days = cacheTtl;

    if (Array.isArray(options.tribunals) && options.tribunals.length > 0) {
        body.search.search_params = {
            filter: { tribunals: { keys: options.tribunals, not_equal: false } },
        };
    }

    const createResult = await callPost(ASYNC_BASE_URL, '/requests', body, apiKey);

    const requestId = createResult.request_id;
    if (!requestId) throw new JuditError('Judit lawsuits by name: no request_id returned', 0, false);

    await pollRequest(requestId, apiKey);
    const items = await fetchResponses(requestId, apiKey);

    return {
        hasLawsuits: items.length > 0,
        requestId,
        responseData: items,
        searchType: 'name',
        _raw: { createResult, responseCount: items.length },
        _request: { url: `${ASYNC_BASE_URL}/requests`, body },
    };
}

module.exports = {
    queryLawsuitsSync,
    queryLawsuitsSyncByName,
    queryLawsuitsAsync,
    queryWarrantAsync,
    queryExecutionAsync,
    queryEntityDataLake,
    queryLawsuitsByNameAsync,
    formatCpf,
    JuditError,
    // Expose for webhook handler
    fetchResponses,
    checkRequestStatus,
    ASYNC_BASE_URL,
};
