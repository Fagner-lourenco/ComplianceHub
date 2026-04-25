/**
 * DJEN (Diário de Justiça Eletrônico Nacional) API adapter.
 *
 * Uses Node 20 built-in `fetch` — no extra deps.
 * Auth: NONE — public API, no credentials required.
 * Base URL: https://comunicaapi.pje.jus.br/api/v1
 * Rate limit: x-ratelimit-limit / x-ratelimit-remaining headers.
 * Cost: FREE.
 *
 * Endpoints:
 *   - GET /comunicacao          — search by nomeParte, numeroProcesso, etc.
 *   - GET /comunicacao/tribunal — list available tribunals
 *
 * Pagination: itensPorPagina (5 or 100), pagina (1-based).
 * Cap: 10,000 results on text/name searches.
 */

const BASE_URL = process.env.DJEN_BASE_URL || 'https://comunicaapi.pje.jus.br/api/v1';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_PAGES = 3;
const INTER_REQUEST_DELAY_MS = 500;
const RATE_LIMIT_SAFETY_BUFFER = 2;

class DjenError extends Error {
    constructor(message, statusCode, retryable) {
        super(message);
        this.name = 'DjenError';
        this.statusCode = statusCode;
        this.retryable = retryable;
    }
}

/**
 * Low-level GET with timeout + retry on 429/5xx.
 * @param {string} path  e.g. '/comunicacao'
 * @param {object} params  Query string parameters
 * @returns {Promise<object>}  Parsed JSON body
 */
async function callGet(path, params = {}) {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
        if (value != null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    }

    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
            });

            clearTimeout(timer);

            if (response.ok) {
                const json = await response.json();

                // Proactive rate limit check — pause before hitting 429
                const remaining = parseInt(response.headers.get('x-ratelimit-remaining'), 10);
                const limit = parseInt(response.headers.get('x-ratelimit-limit'), 10);
                if (!isNaN(remaining) && remaining <= RATE_LIMIT_SAFETY_BUFFER) {
                    const waitMs = remaining === 0 ? 60000 : 5000;
                    await new Promise((resolve) => setTimeout(resolve, waitMs));
                }
                json._rateLimit = { remaining: isNaN(remaining) ? null : remaining, limit: isNaN(limit) ? null : limit };

                return json;
            }

            if (response.status === 404) {
                return { status: 'success', count: 0, items: [] };
            }

            if (response.status === 429 || response.status >= 500) {
                lastError = new DjenError(
                    `DJEN ${response.status} on ${path}`,
                    response.status,
                    true,
                );
                const backoff = response.status === 429
                    ? 60000  // Rate limit: wait 60s
                    : INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, backoff));
                continue;
            }

            const body = await response.text().catch(() => '');
            throw new DjenError(
                `DJEN error ${response.status} on ${path}: ${body}`,
                response.status,
                false,
            );
        } catch (error) {
            clearTimeout(timer);
            if (error instanceof DjenError && !error.retryable) throw error;

            lastError = error;
            if (attempt < MAX_RETRIES - 1) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, backoff));
            }
        }
    }

    throw lastError || new DjenError('DJEN: max retries exceeded', 0, false);
}

/**
 * Query comunicações by party name.
 * Automatically paginates up to maxPages (default 3 = 300 items).
 * @param {string} nomeParte  Full name of the person to search
 * @param {object} options
 * @param {number} [options.maxPages=3]  Max pages to fetch (100 items each)
 * @param {string} [options.siglaTribunal]  Filter by tribunal (e.g. 'TJMG')
 * @param {string} [options.dataDisponibilizacaoInicio]  Start date (dd/MM/yyyy)
 * @param {string} [options.dataDisponibilizacaoFim]  End date (dd/MM/yyyy)
 * @returns {Promise<{ count: number, items: object[], _request: object }>}
 */
async function queryComunicacoesByName(nomeParte, options = {}) {
    const maxPages = options.maxPages || MAX_PAGES;
    const startTime = Date.now();

    const params = {
        nomeParte,
        itensPorPagina: 100,
        pagina: 1,
    };
    if (options.siglaTribunal) params.siglaTribunal = options.siglaTribunal;
    if (options.dataDisponibilizacaoInicio) params.dataDisponibilizacaoInicio = options.dataDisponibilizacaoInicio;
    if (options.dataDisponibilizacaoFim) params.dataDisponibilizacaoFim = options.dataDisponibilizacaoFim;

    const allItems = [];
    let totalCount = 0;
    let page = 0;
    let lastRateLimit = null;

    while (page < maxPages) {
        params.pagina = page + 1;
        const data = await callGet('/comunicacao', params);
        lastRateLimit = data._rateLimit || null;

        if (page === 0) {
            totalCount = data.count || 0;
        }

        if (Array.isArray(data.items)) {
            allItems.push(...data.items);
        }

        // Stop if no more items or we've fetched all
        if (!data.items?.length || allItems.length >= totalCount) break;

        page++;

        // Delay between pages to respect rate limits
        if (page < maxPages) {
            await new Promise((resolve) => setTimeout(resolve, INTER_REQUEST_DELAY_MS));
        }
    }

    return {
        count: totalCount,
        items: allItems,
        _rateLimit: lastRateLimit,
        _request: {
            endpoint: '/comunicacao',
            params: { nomeParte, siglaTribunal: options.siglaTribunal || null },
            pages: page + 1,
            duration: Date.now() - startTime,
        },
    };
}

/**
 * Query comunicações by CNJ process number.
 * Paginates automatically when results exceed 100 items.
 * @param {string} numeroProcesso  CNJ number (digits only, no mask)
 * @returns {Promise<{ count: number, items: object[], _request: object }>}
 */
async function queryComunicacoesByProcesso(numeroProcesso) {
    const startTime = Date.now();

    const allItems = [];
    let totalCount = 0;
    let page = 0;
    let lastRateLimit = null;
    const maxPages = 5; // Safety cap — 500 items max per process

    while (page < maxPages) {
        const data = await callGet('/comunicacao', {
            numeroProcesso,
            itensPorPagina: 100,
            pagina: page + 1,
        });
        lastRateLimit = data._rateLimit || null;

        if (page === 0) {
            totalCount = data.count || 0;
        }

        if (Array.isArray(data.items)) {
            allItems.push(...data.items);
        }

        if (!data.items?.length || allItems.length >= totalCount) break;

        page++;

        if (page < maxPages) {
            await new Promise((resolve) => setTimeout(resolve, INTER_REQUEST_DELAY_MS));
        }
    }

    return {
        count: totalCount,
        items: allItems,
        _rateLimit: lastRateLimit,
        _request: {
            endpoint: '/comunicacao',
            params: { numeroProcesso },
            pages: page + 1,
            duration: Date.now() - startTime,
        },
    };
}

/**
 * List available tribunals.
 * @returns {Promise<{ tribunais: object[] }>}
 */
async function queryTribunais() {
    const data = await callGet('/comunicacao/tribunal');
    return { tribunais: Array.isArray(data) ? data : [] };
}

module.exports = {
    queryComunicacoesByName,
    queryComunicacoesByProcesso,
    queryTribunais,
    DjenError,
    // Exported for testing
    _callGet: callGet,
    BASE_URL,
};
