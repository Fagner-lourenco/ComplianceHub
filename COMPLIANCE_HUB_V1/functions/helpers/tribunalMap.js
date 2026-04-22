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

module.exports = {
    ESCAVADOR_TRIBUNAIS,
    JUDIT_TRIBUNAIS,
    getEscavadorTribunais,
    getJuditTribunais,
};
