import { useEffect, useMemo, useState } from 'react';
import { callListClientCases } from '../core/firebase/firestoreService';
import { MOCK_CASES } from '../data/mockData';

const EMPTY_CASES = [];
// Cada chamada varre ate 10.000 docs no servidor e a chamada abandonada continua
// rodando la (o cleanup so ignora a resposta). Sem debounce, digitar no campo de
// busca dispara uma varredura por tecla — foi o que estourou o timeout da
// listClientCases em 2026-08-14.
const FILTERS_DEBOUNCE_MS = 400;

function normalizeDemoCases(cases, filters, sortField, sortDir) {
    let result = [...cases];
    if (filters.status && filters.status !== 'ALL') result = result.filter((caseData) => caseData.status === filters.status);
    if (filters.verdict && filters.verdict !== 'ALL') result = result.filter((caseData) => caseData.finalVerdict === filters.verdict);
    if (filters.searchTerm) {
        const term = String(filters.searchTerm).toLowerCase();
        const digits = term.replace(/\D/g, '');
        result = result.filter((caseData) => {
            const name = String(caseData.candidateName || '').toLowerCase();
            const cpf = String(caseData.cpf || caseData.cpfMasked || '').replace(/\D/g, '');
            return name.includes(term) || (digits.length >= 3 && cpf.includes(digits));
        });
    }
    result.sort((left, right) => {
        const direction = sortDir === 'asc' ? 1 : -1;
        const leftValue = left[sortField] || '';
        const rightValue = right[sortField] || '';
        if (leftValue < rightValue) return -1 * direction;
        if (leftValue > rightValue) return 1 * direction;
        return 0;
    });
    return result;
}

export function useClientCasesQuery({ tenantId, isDemoMode, page, pageSize, filters, sortField, sortDir }) {
    const [state, setState] = useState({
        cases: EMPTY_CASES,
        loading: !isDemoMode,
        error: null,
        total: 0,
        totalPages: 1,
        stats: { total: 0, done: 0, pending: 0, inProgress: 0, waiting: 0, corrections: 0, notRecommended: 0 },
        meta: null,
    });

    const filtersKey = useMemo(() => JSON.stringify(filters || {}), [filters]);
    const demoState = useMemo(() => {
        const tenantCases = tenantId ? MOCK_CASES.filter((caseData) => caseData.tenantId === tenantId) : MOCK_CASES;
        const allMatches = normalizeDemoCases(tenantCases, filters || {}, sortField, sortDir);
        const start = (page - 1) * pageSize;
        return {
            cases: allMatches.slice(start, start + pageSize),
            loading: false,
            error: null,
            total: allMatches.length,
            totalPages: Math.max(1, Math.ceil(allMatches.length / pageSize)),
            stats: allMatches.reduce((acc, caseData) => {
                acc.total += 1;
                if (caseData.status === 'DONE') acc.done += 1;
                if (caseData.status === 'PENDING') acc.pending += 1;
                if (caseData.status === 'IN_PROGRESS') acc.inProgress += 1;
                if (caseData.status === 'WAITING_INFO') acc.waiting += 1;
                if (caseData.status === 'CORRECTION_NEEDED') acc.corrections += 1;
                if (caseData.finalVerdict === 'NOT_RECOMMENDED') acc.notRecommended += 1;
                return acc;
            }, { total: 0, done: 0, pending: 0, inProgress: 0, waiting: 0, corrections: 0, notRecommended: 0 }),
            meta: { source: 'demo' },
        };
    }, [filters, page, pageSize, sortDir, sortField, tenantId]);

    // Paginacao e ordenacao continuam instantaneas: so a troca de filtros espera.
    // O estado ja nasce com a chave inicial, entao a primeira carga nao espera o
    // debounce — o timer de mount reassenta o mesmo valor e o React descarta.
    const [debouncedFiltersKey, setDebouncedFiltersKey] = useState(filtersKey);

    useEffect(() => {
        const timeoutId = setTimeout(() => setDebouncedFiltersKey(filtersKey), FILTERS_DEBOUNCE_MS);
        return () => clearTimeout(timeoutId);
    }, [filtersKey]);

    useEffect(() => {
        if (isDemoMode) return undefined;

        // Depender de `filters` por identidade reexecutava o efeito a cada render
        // quando o chamador passava um literal: o filtro efetivo vem da chave.
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
        callListClientCases({ page, pageSize, filters: appliedFilters, sortField, sortDir })
            .then((result) => {
                if (cancelled) return;
                setState({
                    cases: result?.cases || EMPTY_CASES,
                    loading: false,
                    error: null,
                    total: result?.total || 0,
                    totalPages: result?.totalPages || 1,
                    stats: result?.stats || { total: 0, done: 0, pending: 0, inProgress: 0, waiting: 0, corrections: 0, notRecommended: 0 },
                    meta: result?.meta || null,
                });
            })
            .catch((error) => {
                if (!cancelled) setState({ cases: EMPTY_CASES, loading: false, error, total: 0, totalPages: 1, stats: { total: 0, done: 0, pending: 0, inProgress: 0, waiting: 0, corrections: 0, notRecommended: 0 }, meta: null });
            });
        return () => { cancelled = true; };
    }, [debouncedFiltersKey, isDemoMode, page, pageSize, sortDir, sortField, tenantId]);

    return isDemoMode ? demoState : state;
}
