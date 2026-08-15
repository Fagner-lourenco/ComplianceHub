/**
 * Incidente 2026-08-14: 100 timeouts de listClientCases em 5 segundos.
 * O campo de busca nao tinha debounce e cada tecla disparava uma chamada nova;
 * cada chamada varre ate 10.000 docs no servidor e a chamada abandonada nao e
 * cancelada. O debounce e o que impede a rajada.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
    callListClientCases: vi.fn(),
}));

vi.mock('../core/firebase/firestoreService', () => ({
    callListClientCases: firestoreMocks.callListClientCases,
}));

vi.mock('../data/mockData', () => ({ MOCK_CASES: [] }));

const { useClientCasesQuery } = await import('./useClientCasesQuery');

const EMPTY_RESULT = {
    cases: [],
    total: 0,
    totalPages: 1,
    stats: { total: 0, done: 0, pending: 0, inProgress: 0, waiting: 0, corrections: 0, notRecommended: 0 },
    meta: { source: 'server' },
};

function renderQuery(initialFilters) {
    return renderHook(
        ({ filters }) => useClientCasesQuery({
            tenantId: 'TEN-001',
            isDemoMode: false,
            page: 1,
            pageSize: 50,
            filters,
            sortField: 'createdAt',
            sortDir: 'desc',
        }),
        { initialProps: { filters: initialFilters } },
    );
}

describe('useClientCasesQuery', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        firestoreMocks.callListClientCases.mockReset();
        firestoreMocks.callListClientCases.mockResolvedValue(EMPTY_RESULT);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('nao dispara uma chamada por tecla digitada', async () => {
        const { rerender } = renderQuery({ status: 'ALL', verdict: 'ALL', searchTerm: '' });
        await waitFor(() => expect(firestoreMocks.callListClientCases).toHaveBeenCalledTimes(1));

        for (const term of ['j', 'jo', 'joa', 'joao']) {
            rerender({ filters: { status: 'ALL', verdict: 'ALL', searchTerm: term } });
        }
        act(() => { vi.advanceTimersByTime(100); });
        expect(firestoreMocks.callListClientCases).toHaveBeenCalledTimes(1);

        act(() => { vi.advanceTimersByTime(500); });
        await waitFor(() => expect(firestoreMocks.callListClientCases).toHaveBeenCalledTimes(2));
        expect(firestoreMocks.callListClientCases).toHaveBeenLastCalledWith(
            expect.objectContaining({ filters: expect.objectContaining({ searchTerm: 'joao' }) }),
        );
    });

    it('mudanca de pagina nao espera o debounce', async () => {
        const { rerender } = renderHook(
            ({ page }) => useClientCasesQuery({
                tenantId: 'TEN-001',
                isDemoMode: false,
                page,
                pageSize: 50,
                filters: { status: 'ALL', verdict: 'ALL', searchTerm: '' },
                sortField: 'createdAt',
                sortDir: 'desc',
            }),
            { initialProps: { page: 1 } },
        );
        await waitFor(() => expect(firestoreMocks.callListClientCases).toHaveBeenCalledTimes(1));

        rerender({ page: 2 });

        await waitFor(() => expect(firestoreMocks.callListClientCases).toHaveBeenCalledTimes(2));
        expect(firestoreMocks.callListClientCases).toHaveBeenLastCalledWith(
            expect.objectContaining({ page: 2 }),
        );
    });

    it('primeira carga nao espera o debounce', async () => {
        renderQuery({ status: 'ALL', verdict: 'ALL', searchTerm: '' });

        await waitFor(() => expect(firestoreMocks.callListClientCases).toHaveBeenCalledTimes(1));
    });
});
