/**
 * UF → Tribunal code mapping for Escavador and Judit APIs.
 *
 * Escavador uses: TJSP, TRT-2, TRT-15 (with hyphen)
 * Judit uses:     TJSP, TRT1, TRT2   (no hyphen, number = region)
 *
 * Sources: Escavador GET /tribunais?estados[]=XX (free endpoint, tested 2026-04-02)
 *          Judit response field `tribunal_acronym` from live results
 */

const ESCAVADOR_TRIBUNAIS = {
    AC: ['TJAC', 'TRT-14'],
    AL: ['TJAL', 'TRT-19'],
    AM: ['TJAM', 'TRT-11'],
    AP: ['TJAP', 'TRT-8'],
    BA: ['TJBA', 'TRT-5'],
    CE: ['TJCE', 'TRT-7'],
    DF: ['TJDFT', 'TRT-10'],
    ES: ['TJES', 'TRT-17'],
    GO: ['TJGO', 'TRT-18'],
    MA: ['TJMA', 'TRT-16'],
    MG: ['TJMG', 'TRT-3'],
    MS: ['TJMS', 'TRT-24'],
    MT: ['TJMT', 'TRT-23'],
    PA: ['TJPA', 'TRT-8'],
    PB: ['TJPB', 'TRT-13'],
    PE: ['TJPE', 'TRT-6'],
    PI: ['TJPI', 'TRT-22'],
    PR: ['TJPR', 'TRT-9'],
    RJ: ['TJRJ', 'TRT-1'],
    RN: ['TJRN', 'TRT-21'],
    RO: ['TJRO', 'TRT-14'],
    RR: ['TJRR', 'TRT-11'],
    RS: ['TJRS', 'TRT-4'],
    SC: ['TJSC', 'TRT-12'],
    SE: ['TJSE', 'TRT-20'],
    SP: ['TJSP', 'TRT-2', 'TRT-15'],
    TO: ['TJTO', 'TRT-10'],
};

const JUDIT_TRIBUNAIS = {
    AC: ['TJAC', 'TRT14'],
    AL: ['TJAL', 'TRT19'],
    AM: ['TJAM', 'TRT11'],
    AP: ['TJAP', 'TRT8'],
    BA: ['TJBA', 'TRT5'],
    CE: ['TJCE', 'TRT7'],
    DF: ['TJDF', 'TRT10'],
    ES: ['TJES', 'TRT17'],
    GO: ['TJGO', 'TRT18'],
    MA: ['TJMA', 'TRT16'],
    MG: ['TJMG', 'TRT3'],
    MS: ['TJMS', 'TRT24'],
    MT: ['TJMT', 'TRT23'],
    PA: ['TJPA', 'TRT8'],
    PB: ['TJPB', 'TRT13'],
    PE: ['TJPE', 'TRT6'],
    PI: ['TJPI', 'TRT22'],
    PR: ['TJPR', 'TRT9'],
    RJ: ['TJRJ', 'TRT1'],
    RN: ['TJRN', 'TRT21'],
    RO: ['TJRO', 'TRT14'],
    RR: ['TJRR', 'TRT11'],
    RS: ['TJRS', 'TRT4'],
    SC: ['TJSC', 'TRT12'],
    SE: ['TJSE', 'TRT20'],
    SP: ['TJSP', 'TRT2', 'TRT15'],
    TO: ['TJTO', 'TRT10'],
};

/**
 * Get Escavador tribunal codes for one or more UFs.
 * @param {string|string[]} ufs  Single UF or array of UFs
 * @returns {string[]}  Unique tribunal codes (empty if no mapping)
 */
function getEscavadorTribunais(ufs) {
    const arr = Array.isArray(ufs) ? ufs : [ufs];
    const set = new Set();
    for (const uf of arr) {
        const codes = ESCAVADOR_TRIBUNAIS[uf?.toUpperCase()];
        if (codes) codes.forEach((c) => set.add(c));
    }
    return [...set];
}

/**
 * Get Judit tribunal codes for one or more UFs.
 * @param {string|string[]} ufs  Single UF or array of UFs
 * @returns {string[]}  Unique tribunal codes (empty if no mapping)
 */
function getJuditTribunais(ufs) {
    const arr = Array.isArray(ufs) ? ufs : [ufs];
    const set = new Set();
    for (const uf of arr) {
        const codes = JUDIT_TRIBUNAIS[uf?.toUpperCase()];
        if (codes) codes.forEach((c) => set.add(c));
    }
    return [...set];
}

/**
 * Reverse mapping: DJEN tribunal sigla → UFs it covers.
 * Used for geo-tagging DJEN comunicações against candidate location.
 * null = national tribunal (no geographic restriction).
 */
const DJEN_TRIBUNAL_TO_UFS = {
    // Tribunais de Justiça Estaduais
    TJAC: ['AC'], TJAL: ['AL'], TJAM: ['AM'], TJAP: ['AP'], TJBA: ['BA'],
    TJCE: ['CE'], TJDFT: ['DF'], TJES: ['ES'], TJGO: ['GO'], TJMA: ['MA'],
    TJMG: ['MG'], TJMS: ['MS'], TJMT: ['MT'], TJPA: ['PA'], TJPB: ['PB'],
    TJPE: ['PE'], TJPI: ['PI'], TJPR: ['PR'], TJRJ: ['RJ'], TJRN: ['RN'],
    TJRO: ['RO'], TJRR: ['RR'], TJRS: ['RS'], TJSC: ['SC'], TJSE: ['SE'],
    TJSP: ['SP'], TJTO: ['TO'], TJDF: ['DF'],
    // TRTs (Tribunais Regionais do Trabalho)
    TRT1: ['RJ'], TRT2: ['SP'], TRT3: ['MG'], TRT4: ['RS'], TRT5: ['BA'],
    TRT6: ['PE'], TRT7: ['CE'], TRT8: ['PA', 'AP'], TRT9: ['PR'], TRT10: ['DF', 'TO'],
    TRT11: ['AM', 'RR'], TRT12: ['SC'], TRT13: ['PB'], TRT14: ['RO', 'AC'],
    TRT15: ['SP'], TRT16: ['MA'], TRT17: ['ES'], TRT18: ['GO'], TRT19: ['AL'],
    TRT20: ['SE'], TRT21: ['RN'], TRT22: ['PI'], TRT23: ['MT'], TRT24: ['MS'],
    // TRFs (Tribunais Regionais Federais)
    TRF1: ['AC', 'AM', 'AP', 'BA', 'DF', 'GO', 'MA', 'MG', 'MT', 'PA', 'PI', 'RO', 'RR', 'TO'],
    TRF2: ['RJ', 'ES'],
    TRF3: ['MS', 'SP'],
    TRF4: ['PR', 'RS', 'SC'],
    TRF5: ['AL', 'CE', 'PB', 'PE', 'RN', 'SE'],
    TRF6: ['MG'],
    // Tribunais Superiores — nacionais (null = sem restrição geográfica)
    STJ: null, STF: null, TST: null, TSE: null, STM: null,
};

/**
 * Determine if a DJEN tribunal matches the candidate's known UFs.
 * @param {string} siglaTribunal  e.g. 'TJMG', 'TRT8', 'STJ'
 * @param {string[]} candidateUfs  UFs where the candidate lives/works (e.g. ['MG', 'SP'])
 * @returns {boolean|null}  true=match, false=no match, null=national tribunal or unknown
 */
function getDjenGeoMatch(siglaTribunal, candidateUfs) {
    if (!siglaTribunal || !candidateUfs || candidateUfs.length === 0) return null;

    const sigla = siglaTribunal.toUpperCase();
    if (!(sigla in DJEN_TRIBUNAL_TO_UFS)) return null;

    const tribunalUfs = DJEN_TRIBUNAL_TO_UFS[sigla];
    if (tribunalUfs === null) return null; // National tribunal

    const candidateSet = new Set(candidateUfs.map((u) => u.toUpperCase()));
    return tribunalUfs.some((uf) => candidateSet.has(uf));
}

/**
 * Mapeamento de região fiscal para UFs (usado no BigDataCorp).
 */
const FISCAL_REGION_TO_UFS = {
    NORTE: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
    NORDESTE: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
    'CENTRO-OESTE': ['DF', 'GO', 'MT', 'MS'],
    SUDESTE: ['ES', 'MG', 'RJ', 'SP'],
    SUL: ['PR', 'RS', 'SC'],
};

/**
 * Build a comprehensive list of candidate UFs from all available data sources.
 * Sources (in priority order):
 *   1. bigdatacorpFiscalRegion → mapped to UFs
 *   2. hiringUf (from client form)
 *   3. UFs from BDC process states
 *   4. UFs from BDC profession history
 *   5. juditAllUfs / enrichmentAllUfs
 *
 * @param {object} caseData
 * @returns {string[]} Unique UFs (uppercase, 2-letter)
 */
const VALID_BRAZILIAN_UFS = new Set(['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']);

function isValidUf(uf) {
    return uf && uf.length === 2 && /^[A-Z]{2}$/i.test(uf) && VALID_BRAZILIAN_UFS.has(uf.toUpperCase());
}

function buildCandidateUfs(caseData) {
    const ufs = new Set();

    // 1. BDC fiscal region
    const fiscalRegion = caseData?.bigdatacorpFiscalRegion;
    if (fiscalRegion) {
        const regionUfs = FISCAL_REGION_TO_UFS[fiscalRegion.toUpperCase()];
        if (regionUfs) regionUfs.forEach((uf) => { if (VALID_BRAZILIAN_UFS.has(uf)) ufs.add(uf); });
        // Also handle single-UF fiscal regions (e.g. "SP", "RJ")
        if (isValidUf(fiscalRegion)) {
            ufs.add(fiscalRegion.toUpperCase());
        }
    }

    // 2. Hiring UF (from client form) — local de trabalho
    const hiringUf = caseData?.hiringUf;
    if (isValidUf(hiringUf)) {
        ufs.add(hiringUf.toUpperCase());
    }

    // 2.5. Candidate residence UF (from client form)
    const candidateResidenceUf = caseData?.candidateResidenceUf;
    if (isValidUf(candidateResidenceUf)) {
        ufs.add(candidateResidenceUf.toUpperCase());
    }

    // 3. UFs from BDC processes
    const bdcProcessos = caseData?.bigdatacorpProcessos;
    if (Array.isArray(bdcProcessos)) {
        bdcProcessos.forEach((p) => {
            const estado = p?.estado || p?.state || p?.uf;
            if (isValidUf(estado)) ufs.add(estado.toUpperCase());
        });
    }

    // 4. UFs from BDC profession history
    const bdcProfHistory = caseData?.bigdatacorpProfessionHistory;
    if (Array.isArray(bdcProfHistory)) {
        bdcProfHistory.forEach((p) => {
            const state = p?.state || p?.uf;
            if (isValidUf(state)) ufs.add(state.toUpperCase());
        });
    }

    // 5. Judit / FonteData UFs
    const juditUfs = caseData?.juditAllUfs;
    if (Array.isArray(juditUfs)) {
        juditUfs.forEach((uf) => { if (isValidUf(uf)) ufs.add(uf.toUpperCase()); });
    }
    const enrichmentUfs = caseData?.enrichmentAllUfs;
    if (Array.isArray(enrichmentUfs)) {
        enrichmentUfs.forEach((uf) => { if (isValidUf(uf)) ufs.add(uf.toUpperCase()); });
    }
    const juditPrimary = caseData?.juditPrimaryUf;
    if (isValidUf(juditPrimary)) ufs.add(juditPrimary.toUpperCase());
    const enrichmentPrimary = caseData?.enrichmentPrimaryUf;
    if (isValidUf(enrichmentPrimary)) ufs.add(enrichmentPrimary.toUpperCase());

    return [...ufs];
}

module.exports = {
    ESCAVADOR_TRIBUNAIS,
    JUDIT_TRIBUNAIS,
    getEscavadorTribunais,
    getJuditTribunais,
    DJEN_TRIBUNAL_TO_UFS,
    getDjenGeoMatch,
    FISCAL_REGION_TO_UFS,
    buildCandidateUfs,
};
