/**
 * Rota gemea da que quebrou em 2026-08-14 no portal do cliente.
 *
 * listOpsCases varre ate CASE_QUERY_MAX_DOCS (10.000) docs de `cases` por
 * chamada e o campo de busca do CasosPage nao tinha debounce: uma consulta
 * completa por tecla digitada. Mesmo mecanismo, mesma consequencia.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
    callListOpsCases: vi.fn(),
}));

vi.mock('../core/firebase/firestoreService', () => ({
    callListOpsCases: firestoreMocks.callListOpsCases,
}));

vi.mock('../data/mockData', () => ({ MOCK_CASES: [] }));

const { useOpsCasesQuery } = await import('./useOpsCasesQuery');

const EMPTY_RESULT = {
    cases: [],
    total: 0,
    totalPages: 1,
    stats: { total: 0, done: 0, pending: 0, inProgress: 0, waiting: 0, corrections: 0, red: 0, fit: 0, attention: 0, notRecommended: 0 },
    meta: { source: 'server' },
};

function baseArgs(overrides = {}) {
    return {
        tenantId: 'TEN-001',
        isDemoMode: false,
        page: 1,
        pageSize: 50,
        queueOnly: false,
        assigneeUid: 'ops-1',
        sortField: 'createdAt',
        sortDir: 'desc',
        ...overrides,
    };
}

describe('useOpsCasesQuery', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        firestoreMocks.callListOpsCases.mockReset();
        firestoreMocks.callListOpsCases.mockResolvedValue(EMPTY_RESULT);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('nao dispara uma varredura por tecla digitada', async () => {
        const { rerender } = renderHook(
            ({ filters }) => useOpsCasesQuery(baseArgs({ filters })),
            { initialProps: { filters: { status: 'ALL', searchTerm: '' } } },
        );
        await waitFor(() => expect(firestoreMocks.callListOpsCases).toHaveBeenCalledTimes(1));

        for (const term of ['m', 'ma', 'mar', 'mari']) {
            rerender({ filters: { status: 'ALL', searchTerm: term } });
        }
        act(() => { vi.advanceTimersByTime(100); });
        expect(firestoreMocks.callListOpsCases).toHaveBeenCalledTimes(1);

        act(() => { vi.advanceTimersByTime(500); });
        await waitFor(() => expect(firestoreMocks.callListOpsCases).toHaveBeenCalledTimes(2));
        expect(firestoreMocks.callListOpsCases).toHaveBeenLastCalledWith(
            expect.objectContaining({ filters: expect.objectContaining({ searchTerm: 'mari' }) }),
        );
    });

    it('paginacao continua instantanea', async () => {
        const { rerender } = renderHook(
            ({ page }) => useOpsCasesQuery(baseArgs({ page, filters: { status: 'ALL', searchTerm: '' } })),
            { initialProps: { page: 1 } },
        );
        await waitFor(() => expect(firestoreMocks.callListOpsCases).toHaveBeenCalledTimes(1));

        rerender({ page: 2 });

        await waitFor(() => expect(firestoreMocks.callListOpsCases).toHaveBeenCalledTimes(2));
        expect(firestoreMocks.callListOpsCases).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    });

    it('objeto de filtros literal nao gera loop de requisicoes', async () => {
        // O efeito dependia de `filters` por identidade: com literal a cada
        // render, cada resposta disparava a proxima chamada, sem fim.
        const { rerender } = renderHook(
            () => useOpsCasesQuery(baseArgs({ filters: { status: 'ALL', searchTerm: '' } })),
        );
        await waitFor(() => expect(firestoreMocks.callListOpsCases).toHaveBeenCalledTimes(1));

        rerender();
        act(() => { vi.advanceTimersByTime(1000); });

        expect(firestoreMocks.callListOpsCases.mock.calls.length).toBeLessThanOrEqual(2);
    });
});
