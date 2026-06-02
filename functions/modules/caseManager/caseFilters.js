/**
 * caseFilters.js — Funções de filtro e busca de casos
 * Extraído do monolito index.js durante refatoração Phase C
 */

/**
 * Serializa um documento de caso do cliente
 * Suporta tanto DocumentSnapshot quanto objetos planos
 * @param {DocumentSnapshot|Object} docSnap
 * @returns {Object}
 */
function serializeClientCaseDocument(docSnap) {
    const data = docSnap.data ? (docSnap.data() || {}) : (docSnap || {});
    return {
        id: docSnap.id || data.caseId || null,
        ...data,
        createdAt: data.createdAt?.toDate?.() ?? data.createdAt ?? null,
        updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt ?? null,
        submittedAt: data.submittedAt?.toDate?.() ?? data.submittedAt ?? null,
        concludedAt: data.concludedAt?.toDate?.() ?? data.concludedAt ?? null,
    };
}

/**
 * Verifica se um caso do cliente corresponde ao termo de busca
 * @param {Object} caseData
 * @param {string} rawTerm
 * @returns {boolean}
 */
function matchesClientCaseSearch(caseData, rawTerm) {
    if (!rawTerm || typeof rawTerm !== 'string') return true;
    const term = rawTerm.toLowerCase().trim();
    if (!term) return true;

    const searchable = [
        caseData.candidateName,
        caseData.candidateCpf,
        caseData.cpf,
        caseData.cpfMasked,
        caseData.candidateRole,
        caseData.candidatePosition,
        caseData.id,
        caseData.caseId,
        caseData.status,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return searchable.includes(term);
}

/**
 * Verifica se um caso do cliente corresponde aos filtros
 * @param {Object} caseData
 * @param {Object} filters
 * @returns {boolean}
 */
function matchesClientCaseFilters(caseData, filters) {
    if (!filters || typeof filters !== 'object') return true;

    const status = filters.status && filters.status !== 'ALL' ? filters.status : null;
    const riskLevel = filters.riskLevel && filters.riskLevel !== 'ALL' ? filters.riskLevel : null;
    const finalVerdict = (filters.finalVerdict || filters.verdict) && (filters.finalVerdict || filters.verdict) !== 'ALL'
        ? (filters.finalVerdict || filters.verdict)
        : null;
    const priority = filters.priority && filters.priority !== 'ALL' ? filters.priority : null;

    if (status && caseData.status !== status) return false;
    if (riskLevel && caseData.riskLevel !== riskLevel) return false;
    if (finalVerdict && caseData.finalVerdict !== finalVerdict) return false;
    if (priority && caseData.priority !== priority) return false;
    if (!matchesClientCaseSearch(caseData, filters.searchTerm)) return false;

    if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        const caseDate = caseData.createdAt?.toDate
            ? caseData.createdAt.toDate()
            : new Date(caseData.createdAt);
        if (caseDate < from) return false;
    }

    if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        const caseDate = caseData.createdAt?.toDate
            ? caseData.createdAt.toDate()
            : new Date(caseData.createdAt);
        if (caseDate > to) return false;
    }

    return true;
}

/**
 * Verifica se um caso do ops corresponde ao termo de busca
 * @param {Object} caseData
 * @param {string} rawTerm
 * @returns {boolean}
 */
function matchesOpsCaseSearch(caseData, rawTerm) {
    if (!rawTerm || typeof rawTerm !== 'string') return true;
    const term = rawTerm.toLowerCase().trim();
    if (!term) return true;

    const searchable = [
        caseData.candidateName,
        caseData.candidateCpf,
        caseData.candidateRole,
        caseData.requesterName,
        caseData.id,
        caseData.status,
        caseData.assignedToName,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return searchable.includes(term);
}

/**
 * Verifica se um caso do ops corresponde aos filtros
 * @param {Object} caseData
 * @param {Object} filters
 * @param {Object} options
 * @returns {boolean}
 */
function matchesOpsCaseFilters(caseData, filters = {}, options = {}) {
    if (!filters || typeof filters !== 'object') return true;

    const { showAllTenants = false, currentTenantId = null } = options;

    if (!showAllTenants && currentTenantId && caseData.tenantId !== currentTenantId) {
        return false;
    }

    if (filters.status && caseData.status !== filters.status) return false;
    if (filters.riskLevel && caseData.riskLevel !== filters.riskLevel) return false;
    if (filters.finalVerdict && caseData.finalVerdict !== filters.finalVerdict) return false;
    if (filters.priority && caseData.priority !== filters.priority) return false;
    if (filters.assignedTo && caseData.assignedTo !== filters.assignedTo) return false;
    if (filters.tenantId && caseData.tenantId !== filters.tenantId) return false;

    if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        const caseDate = caseData.createdAt?.toDate
            ? caseData.createdAt.toDate()
            : new Date(caseData.createdAt);
        if (caseDate < from) return false;
    }

    if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        const caseDate = caseData.createdAt?.toDate
            ? caseData.createdAt.toDate()
            : new Date(caseData.createdAt);
        if (caseDate > to) return false;
    }

    return true;
}

/**
 * Constrói estatísticas de casos do ops
 * @param {Array} cases
 * @returns {Object}
 */
function buildOpsCaseStats(cases) {
    const stats = {
        total: cases.length,
        pending: 0,
        inProgress: 0,
        waiting: 0,
        corrections: 0,
        done: 0,
        byRisk: { GREEN: 0, YELLOW: 0, RED: 0 },
        byVerdict: { FIT: 0, ATTENTION: 0, NOT_RECOMMENDED: 0 },
    };

    cases.forEach((c) => {
        if (c.status === 'PENDING') stats.pending++;
        if (c.status === 'IN_PROGRESS') stats.inProgress++;
        if (c.status === 'WAITING_INFO') stats.waiting++;
        if (c.status === 'CORRECTION_NEEDED') stats.corrections++;
        if (c.status === 'DONE') stats.done++;

        if (c.riskLevel) stats.byRisk[c.riskLevel] = (stats.byRisk[c.riskLevel] || 0) + 1;
        if (c.finalVerdict) stats.byVerdict[c.finalVerdict] = (stats.byVerdict[c.finalVerdict] || 0) + 1;
    });

    return stats;
}

module.exports = {
    serializeClientCaseDocument,
    matchesClientCaseSearch,
    matchesClientCaseFilters,
    matchesOpsCaseSearch,
    matchesOpsCaseFilters,
    buildOpsCaseStats,
};
