import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const metricasMocks = vi.hoisted(() => ({
    selectedTenantId: 'tenant-alpha',
    useCases: vi.fn(),
    callGetOpsV2Metrics: vi.fn(),
}));

vi.mock('../../core/contexts/useTenant', () => ({
    useTenant: () => ({ selectedTenantId: metricasMocks.selectedTenantId }),
}));

vi.mock('../../hooks/useCases', () => ({
    useCases: (...args) => metricasMocks.useCases(...args),
}));

vi.mock('../../core/firebase/firestoreService', () => ({
    callGetOpsV2Metrics: (...args) => metricasMocks.callGetOpsV2Metrics(...args),
}));

const { default: MetricasIAPage } = await import('./MetricasIAPage');

describe('MetricasIAPage V2 metrics', () => {
    beforeEach(() => {
        metricasMocks.selectedTenantId = 'tenant-alpha';
        metricasMocks.useCases.mockReset();
        metricasMocks.callGetOpsV2Metrics.mockReset();
        metricasMocks.useCases.mockReturnValue({
            cases: [
                { id: 'case-1', createdAt: '2026-04-20', status: 'DONE', finalVerdict: 'FIT' },
                { id: 'case-2', createdAt: '2026-04-21', status: 'IN_PROGRESS' },
            ],
            loading: false,
            error: null,
        });
        metricasMocks.callGetOpsV2Metrics.mockResolvedValue({
            source: 'v2Collections',
            counts: {
                usageMeters: 4,
                moduleRuns: 7,
                openProviderDivergences: 1,
                seniorPending: 2,
            },
            usage: {
                totalInternalCostBrl: 3.4,
            },
        });
    });

    it('renderiza painel operacional V2 a partir do callable backend', async () => {
        render(<MetricasIAPage />);

        await waitFor(() => {
            expect(screen.getByTestId('v2-metrics-panel')).toBeInTheDocument();
        });

        expect(screen.getByTestId('v2-usage-meters')).toHaveTextContent('4');
        expect(screen.getByTestId('v2-module-runs')).toHaveTextContent('7');
        expect(screen.getByTestId('v2-open-divergences')).toHaveTextContent('1');
        expect(screen.getByTestId('v2-senior-pending')).toHaveTextContent('2');
        expect(metricasMocks.callGetOpsV2Metrics).toHaveBeenCalledWith({
            tenantId: 'tenant-alpha',
            monthKey: expect.stringMatching(/^\d{4}-\d{2}$/),
        });
    });
});
