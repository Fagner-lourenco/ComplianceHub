import { useEffect, useMemo, useState } from 'react';
import { callListOpsCases } from '../core/firebase/firestoreService';
import { getOverallEnrichmentStatus } from '../core/enrichmentStatus';
import { getSlaStatus } from '../core/caseSla';
import { MOCK_CASES } from '../data/mockData';

const EMPTY_CASES = [];
const EMPTY_STATS = { total: 0, done: 0, pending: 0, inProgress: 0, waiting: 0, corrections: 0, red: 0, fit: 0, attention: 0, notRecommended: 0 };
// Mesmo valor do portal cliente (useClientCasesQuery): a busca so vai ao
// servidor depois que o analista para de digitar.
const FILTERS_DEBOUNCE_MS = 400;

function matchesDemoCase(caseData, filters = {}, { queueOnly = false, assigneeUid = null } = {}) {
    if (queueOnly && caseData.status === 'DONE') return false;
    if (filters.status && filters.status !== 'ALL' && caseData.status !== filters.status) return false;
    if (filters.risk && filters.risk !== 'ALL' && caseData.riskLevel !== filters.risk) return false;
    if (filters.verdict && filters.verdict !== 'ALL' && caseData.finalVerdict !== filters.verdict) return false;
    if (filters.enrichment && filters.enrichment !== 'ALL' && getOverallEnrichmentStatus(caseData) !== filters.enrichment) return false;
    if (filters.sla && filters.sla !== 'ALL') {
        const { state } = getSlaStatus(caseData);
        if (filters.sla === 'ON_TIME' && state !== 'on_time') return false;
        if (filters.sla === 'WARNING' && state !== 'warning') return false;
        if (filters.sla === 'OVERDUE' && state !== 'overdue') return false;
    }
    if (filters.assignment === 'UNASSIGNED' && caseData.assigneeId) return false;
    if (filters.assignment === 'MINE' && caseData.assigneeId !== assigneeUid) return false;
    if (filters.dateFrom && String(caseData.createdAt || '').slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && String(caseData.createdAt || '').slice(0, 10) > filters.dateTo) return false;
    if (filters.searchTerm) {
        const rawTerm = String(filters.searchTerm).toLowerCase();
        const digits = rawTerm.replace(/\D/g, '');
        const cpf = String(caseData.cpf || caseData.cpfMasked || '').replace(/\D/g, '');
        const name = String(caseData.candidateName || '').toLowerCase();
        const id = String(caseData.id || '').toLowerCase();
        if (!name.includes(rawTerm) && !id.includes(rawTerm) && !(digits.length >= 3 && cpf.includes(digits))) return false;
    }
    return true;
}

export function computeDemoUrgencyRank(caseData, now) {
    const slaStatus = getSlaStatus(caseData, now);
    if (slaStatus.state === 'no_sla') return Number.MAX_SAFE_INTEGER;
    const highBoost = caseData.priority === 'HIGH' ? -1800000 : 0;
    return slaStatus.remainingMs + highBoost;
}

const URGENCY_BLOCKED_STATUSES = new Set(['CORRECTION_NEEDED', 'WAITING_INFO']);

export function compareDemoOpsCases(left, right, sortField, sortDir, now = new Date()) {
    if (sortField === 'urgency') {
        const leftBlocked = URGENCY_BLOCKED_STATUSES.has(left.status);
        const rightBlocked = URGENCY_BLOCKED_STATUSES.has(right.status);
        if (leftBlocked !== rightBlocked) return leftBlocked ? 1 : -1;
        const diff = computeDemoUrgencyRank(left, now) - computeDemoUrgencyRank(right, now);
        if (diff !== 0) return diff;
        return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
    }
    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
}

function buildStats(cases) {
    return cases.reduce((acc, caseData) => {
        acc.total += 1;
        if (caseData.status === 'DONE') acc.done += 1;
        if (caseData.status === 'PENDING') acc.pending += 1;
        if (caseData.status === 'IN_PROGRESS') acc.inProgress += 1;
        if (caseData.status === 'WAITING_INFO') acc.waiting += 1;
        if (caseData.status === 'CORRECTION_NEEDED') acc.corrections += 1;
        if (caseData.riskLevel === 'RED' || caseData.riskLevel === 'HIGH') acc.red += 1;
        if (caseData.finalVerdict === 'FIT') acc.fit += 1;
        if (caseData.finalVerdict === 'ATTENTION') acc.attention += 1;
        if (caseData.finalVerdict === 'NOT_RECOMMENDED') acc.notRecommended += 1;
        return acc;
    }, { ...EMPTY_STATS });
}

export function useOpsCasesQuery({ tenantId, isDemoMode, page, pageSize, filters, queueOnly = false, assigneeUid = null, sortField = 'createdAt', sortDir = 'desc', refreshKey = 0 }) {
    const [state, setState] = useState({
        cases: EMPTY_CASES,
        loading: !isDemoMode,
        error: null,
        total: 0,
        totalPages: 1,
        stats: EMPTY_STATS,
        meta: null,
    });

    const filtersKey = useMemo(() => JSON.stringify(filters || {}), [filters]);
    const demoState = useMemo(() => {
        const tenantCases = tenantId ? MOCK_CASES.filter((caseData) => caseData.tenantId === tenantId) : MOCK_CASES;
        const statsBase = queueOnly ? tenantCases.filter((caseData) => caseData.status !== 'DONE') : tenantCases;
        const allMatches = tenantCases.filter((caseData) => matchesDemoCase(caseData, filters || {}, { queueOnly, assigneeUid }));
        const now = new Date();
        allMatches.sort((left, right) => compareDemoOpsCases(left, right, sortField, sortDir, now));
        const start = (page - 1) * pageSize;
        return {
            cases: allMatches.slice(start, start + pageSize),
            loading: false,
            error: null,
            total: allMatches.length,
            totalPages: Math.max(1, Math.ceil(allMatches.length / pageSize)),
            stats: buildStats(statsBase),
            meta: { source: 'demo' },
        };
        // sortDir estava fora das deps: em modo demo, inverter a ordenacao nao
        // reordenava a lista, porque o memo devolvia o resultado anterior.
    }, [assigneeUid, filters, page, pageSize, queueOnly, sortDir, sortField, tenantId]);

    // Mesma contencao do portal cliente: listOpsCases varre ate 10.000 docs de
    // `cases` por chamada, e o campo de busca do CasosPage disparava uma
    // varredura por tecla. Paginacao e ordenacao seguem instantaneas.
    const [debouncedFiltersKey, setDebouncedFiltersKey] = useState(filtersKey);

    useEffect(() => {
        const timeoutId = setTimeout(() => setDebouncedFiltersKey(filtersKey), FILTERS_DEBOUNCE_MS);
        return () => clearTimeout(timeoutId);
    }, [filtersKey]);

    useEffect(() => {
        if (isDemoMode) return undefined;

        // Depender de `filters` por identidade reexecutava o efeito a cada render
        // quando o chamador passava um literal — loop de requisicoes sem fim.
        let appliedFilters = {};
        try {
            appliedFilters = JSON.parse(debouncedFiltersKey) || {};
        } catch {
            appliedFilters = {};
        }

        let cancelled = false;
        Promise.resolve().then(() => {
            if (!cancelled) setState((current) => ({ ...current, loading: true, error: null }));
        });
        callListOpsCases({ tenantId: tenantId || null, page, pageSize, filters: appliedFilters, queueOnly, assigneeUid, sortField, sortDir })
            .then((result) => {
                if (cancelled) return;
                setState({
                    cases: result?.cases || EMPTY_CASES,
                    loading: false,
                    error: null,
                    total: result?.total || 0,
                    totalPages: result?.totalPages || 1,
                    stats: result?.stats || EMPTY_STATS,
                    meta: result?.meta || null,
                });
            })
            .catch((error) => {
                if (!cancelled) setState({ cases: EMPTY_CASES, loading: false, error, total: 0, totalPages: 1, stats: EMPTY_STATS, meta: null });
            });
        return () => { cancelled = true; };
    }, [assigneeUid, debouncedFiltersKey, isDemoMode, page, pageSize, queueOnly, refreshKey, sortDir, sortField, tenantId]);

    return isDemoMode ? demoState : state;
}
