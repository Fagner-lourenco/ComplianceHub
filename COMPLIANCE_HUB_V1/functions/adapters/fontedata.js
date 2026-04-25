/**
 * FonteData API adapter.
 *
 * Uses Node 20 built-in `fetch` (undici under the hood) — no extra deps needed.
 * Every call captures X-Request-Id, X-Request-Cost and X-Balance-Remaining
 * from response headers for audit trail.
 */

const BASE_URL = process.env.FONTEDATA_BASE_URL || 'https://app.fontedata.com/api/v1/consulta';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * UF → TRT region code(s).
 * SP maps to both TRT-2 (Grande SP) and TRT-15 (Interior/Campinas).
 */
const UF_TO_TRT = {
    AC: ['14'], AL: ['19'], AM: ['11'], AP: ['08'],
    BA: ['05'], CE: ['07'], DF: ['10'], ES: ['17'],
    GO: ['18'], MA: ['16'], MG: ['03'], MS: ['24'],
    MT: ['23'], PA: ['08'], PB: ['13'], PE: ['06'],
    PI: ['22'], PR: ['09'], RJ: ['01'], RN: ['21'],
    RO: ['14'], RR: ['11'], RS: ['04'], SC: ['12'],
    SE: ['20'], SP: ['02', '15'], TO: ['10'],
};

class FonteDataError extends Error {
    constructor(message, statusCode, retryable) {
        super(message);
        this.name = 'FonteDataError';
        this.statusCode = statusCode;
        this.retryable = retryable;
    }
}

/**
 * Low-level HTTP call with timeout, retry on 429/5xx.
 * @param {string} endpoint  e.g. 'antecedentes-criminais'
 * @param {Record<string,string>} params  query string params
 * @param {string} apiKey
 * @returns {Promise<{ data: object, meta: { requestId: string, cost: string, balance: string } }>}
 */
async function callEndpoint(endpoint, params, apiKey) {
    const url = new URL(`${BASE_URL}/${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
        if (value) url.searchParams.set(key, value);
    }

    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'X-API-Key': apiKey },
                signal: controller.signal,
            });

            clearTimeout(timer);

            const meta = {
                requestId: response.headers.get('x-request-id') || '',
                cost: response.headers.get('x-request-cost') || '',
                balance: response.headers.get('x-balance-remaining') || '',
            };

            if (response.ok) {
                const data = await response.json();
                return { data, meta };
            }

            // Non-retryable errors
            if (response.status === 401 || response.status === 403) {
                throw new FonteDataError(
                    `FonteData auth error on ${endpoint}: ${response.status}`,
                    response.status,
                    false,
                );
            }

            if (response.status === 402) {
                throw new FonteDataError(
                    `FonteData insufficient balance on ${endpoint}`,
                    402,
                    false,
                );
            }

            // Retryable errors
            if (response.status === 429 || response.status >= 500) {
                lastError = new FonteDataError(
                    `FonteData ${response.status} on ${endpoint}`,
                    response.status,
                    true,
                );
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, backoff));
                continue;
            }

            // Any other error — not retryable
            const body = await response.text().catch(() => '');
            throw new FonteDataError(
                `FonteData error ${response.status} on ${endpoint}: ${body}`,
                response.status,
                false,
            );
        } catch (error) {
            clearTimeout(timer);
            if (error instanceof FonteDataError && !error.retryable) throw error;

            lastError = error;
            if (attempt < MAX_RETRIES - 1) {
                const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, backoff));
            }
        }
    }

    throw lastError || new Error(`FonteData: max retries exceeded for ${endpoint}`);
}

/**
 * @deprecated Endpoint `antecedentes-criminais` returns 400 consistently.
 * Use `queryProcessosAgrupada` for criminal detection instead.
 */
async function queryCriminal(cpf, apiKey) {
    return callEndpoint('antecedentes-criminais', { cpf }, apiKey);
}

/**
 * Query arrest warrants (cnj-mandados-prisao).
 * @param {string} cpf
 * @param {string} apiKey
 */
async function queryWarrant(cpf, apiKey) {
    return callEndpoint('cnj-mandados-prisao', { cpf }, apiKey);
}

/**
 * Query labor court records (trt-consulta).
 * Converts UF to numeric TRT region code(s). SP queries both TRT-2 and TRT-15.
 * @param {string} cpf  11 digits, no formatting
 * @param {string} apiKey
 * @param {string|null} uf  Optional UF filter (e.g. 'SP', 'RJ')
 * @returns {Promise<{ data: object, meta: object }|{ data: object, meta: object }[]>}
 */
async function queryLabor(cpf, apiKey, uf = null) {
    if (!uf) {
        return callEndpoint('trt-consulta', { cpf }, apiKey);
    }

    const codes = UF_TO_TRT[uf.toUpperCase()];
    if (!codes || codes.length === 0) {
        return callEndpoint('trt-consulta', { cpf }, apiKey);
    }

    if (codes.length === 1) {
        return callEndpoint('trt-consulta', { cpf, regiao: codes[0] }, apiKey);
    }

    // Multiple TRT regions (SP → TRT-2 + TRT-15): query all in parallel
    const results = await Promise.allSettled(
        codes.map((code) => callEndpoint('trt-consulta', { cpf, regiao: code }, apiKey)),
    );

    // Merge results: combine processos arrays, keep all metas
    const merged = { processos: [], possuiProcesso: false };
    const metas = [];
    for (const r of results) {
        if (r.status === 'fulfilled') {
            const d = r.value.data;
            metas.push(r.value.meta);
            if (d.possuiProcesso) merged.possuiProcesso = true;
            if (Array.isArray(d.processos)) merged.processos.push(...d.processos);
        }
    }
    // If all failed, throw the first error
    if (metas.length === 0) {
        const firstErr = results.find((r) => r.status === 'rejected');
        throw firstErr ? firstErr.reason : new Error('All TRT queries failed');
    }

    return {
        data: merged,
        meta: {
            requestId: metas.map((m) => m.requestId).join(';'),
            cost: metas.reduce((sum, m) => sum + (parseFloat(m.cost) || 0), 0).toString(),
            balance: metas[metas.length - 1]?.balance || '',
            regions: codes,
        },
    };
}

/**
 * Query basic personal registration (cadastro-pf-basica). R$ 0,24
 * Returns: nome, sexo, dataNascimento, nomeMae, telefones[], enderecos[], emails[], rendaEstimada
 * NOTE: Does NOT contain situacaoCadastral — use queryReceitaFederal for CPF status.
 * @param {string} cpf
 * @param {string} apiKey
 */
async function queryIdentity(cpf, apiKey) {
    return callEndpoint('cadastro-pf-basica', { cpf }, apiKey);
}

/**
 * Query Receita Federal CPF status (receita-federal-pf). R$ 0,54
 * Returns: nomePessoaFisica, situacaoCadastral ("REGULAR"), dataNascimento, possuiObito, etc.
 * This is the GATE endpoint — only this one has situacaoCadastral.
 * @param {string} cpf
 * @param {string} apiKey
 */
async function queryReceitaFederal(cpf, apiKey) {
    return callEndpoint('receita-federal-pf', { cpf }, apiKey);
}

/**
 * Query grouped lawsuit summary (processos-agrupada). R$ 1,65
 * Returns: segmentos[], tribunais[], areasDireito[], totalProcessos, distribuicaoPorAno[]
 * Used for criminal detection (check segmentos for "Criminal"/"Penal") + civil overview.
 * @param {string} cpf
 * @param {string} apiKey
 */
async function queryProcessosAgrupada(cpf, apiKey) {
    return callEndpoint('processos-agrupada', { cpf }, apiKey);
}

/**
 * Query full lawsuit details (processos-completa). R$ 4,95
 * Returns per-process details: partes, assuntos, valor, status, etc.
 * Only used in escalation (high-risk triggers).
 * @param {string} cpf
 * @param {string} apiKey
 */
async function queryProcessosCompleta(cpf, apiKey) {
    return callEndpoint('processos-completa', { cpf }, apiKey);
}

module.exports = {
    queryCriminal,
    queryWarrant,
    queryLabor,
    queryIdentity,
    queryReceitaFederal,
    queryProcessosAgrupada,
    queryProcessosCompleta,
    FonteDataError,
    UF_TO_TRT,
};
