/**
 * Escavador API adapter.
 *
 * Uses Node 20 built-in `fetch` — no extra deps.
 * Auth: Bearer token in Authorization header.
 * Base URL: https://api.escavador.com/api/v2
 * Pagination: cursor-based via `links.next`.
 */

const BASE_URL = process.env.ESCAVADOR_BASE_URL || 'https://api.escavador.com/api/v2';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_PAGES = 5;

class EscavadorError extends Error {
    constructor(message, statusCode, retryable) {
        super(message);
        this.name = 'EscavadorError';
        this.statusCode = statusCode;
        this.retryable = retryable;
    }
}

/**
 * Low-level GET call with timeout + retry on 429/5xx.
 * @param {string} url  Full URL (may include cursor params)
 * @param {string} token  Bearer token
 * @returns {Promise<object>}  Parsed JSON body
 */
async function callGet(url, token) {
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                signal: controller.signal,
            });

            clearTimeout(timer);

            if (response.ok) {
                return await response.json();
            }

            if (response.status === 401 || response.status === 403) {
                throw new EscavadorError(
                    `Escavador auth error: ${response.status}`,
                    response.status,
                    false,
                );
            }

            if (response.status === 402) {
                throw new EscavadorError(
                    'Escavador saldo insuficiente',
                    402,
                    false,
                );
            }

            if (response.status === 404) {
                return null;
            }

            if (response.status === 429 || response.status >= 500) {
                lastError = new EscavadorError(
                    `Escavador ${response.status}`,
                    response.status,
                    true,
                );
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, backoff));
                continue;
            }

            const body = await response.text().catch(() => '');
            throw new EscavadorError(
                `Escavador error ${response.status}: ${body}`,
                response.status,
                false,
            );
        } catch (error) {
            clearTimeout(timer);
            if (error instanceof EscavadorError && !error.retryable) throw error;

            lastError = error;
            if (attempt < MAX_RETRIES - 1) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, backoff));
            }
        }
    }

    throw lastError || new Error('Escavador: max retries exceeded');
}

/**
 * Query processes by person (CPF or name).
 * GET /envolvido/processos?cpf_cnpj=XXX
 * Follows cursor pagination up to MAX_PAGES.
 * @param {string} cpf  11 digits, no formatting
 * @param {string} token  Bearer token
 * @param {{ limit?: number, incluirHomonimos?: boolean, tribunais?: string[], status?: string }} options
 * @returns {Promise<{ envolvido: object|null, items: object[], totalPages: number }>}
 */
async function queryProcessosByPerson(cpf, token, options = {}) {
    const url = new URL(`${BASE_URL}/envolvido/processos`);
    url.searchParams.set('cpf_cnpj', cpf);
    if (options.limit) url.searchParams.set('limit', String(options.limit));
    if (options.incluirHomonimos) url.searchParams.set('incluir_homonimos', '1');
    if (options.status) url.searchParams.set('status', options.status);
    if (Array.isArray(options.tribunais)) {
        for (const t of options.tribunais) {
            url.searchParams.append('tribunais[]', t);
        }
    }

    const allItems = [];
    let envolvido = null;
    let currentUrl = url.toString();
    let page = 0;

    while (currentUrl && page < MAX_PAGES) {
        const data = await callGet(currentUrl, token);
        if (!data) break;

        if (data.envolvido_encontrado) envolvido = data.envolvido_encontrado;
        if (Array.isArray(data.items)) allItems.push(...data.items);

        currentUrl = data.links?.next || null;
        page++;
    }

    return { envolvido, items: allItems, totalPages: page, truncated: Boolean(currentUrl) };
}

/**
 * Query a specific process by CNJ number.
 * GET /processos/numero_cnj/{numero}
 * @param {string} numeroCnj  Format: NNNNNNN-DD.AAAA.J.TT.OOOO
 * @param {string} token
 * @returns {Promise<object|null>}
 */
async function queryProcessoByCnj(numeroCnj, token) {
    const url = `${BASE_URL}/processos/numero_cnj/${encodeURIComponent(numeroCnj)}`;
    return callGet(url, token);
}

/**
 * Query movimentações of a process.
 * GET /processos/numero_cnj/{numero}/movimentacoes
 * @param {string} numeroCnj
 * @param {string} token
 * @param {{ limit?: number }} options  limit: 50, 100, or 500
 * @returns {Promise<{ items: object[], nextUrl: string|null }>}
 */
async function queryMovimentacoes(numeroCnj, token, options = {}) {
    const url = new URL(`${BASE_URL}/processos/numero_cnj/${encodeURIComponent(numeroCnj)}/movimentacoes`);
    if (options.limit) url.searchParams.set('limit', String(options.limit));

    const data = await callGet(url.toString(), token);
    if (!data) return { items: [], nextUrl: null };

    return {
        items: Array.isArray(data.items) ? data.items : [],
        nextUrl: data.links?.next || null,
    };
}

module.exports = {
    queryProcessosByPerson,
    queryProcessoByCnj,
    queryMovimentacoes,
    EscavadorError,
};
