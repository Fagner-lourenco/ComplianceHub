import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const tenantSettingsPageMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    getTenantSettings: vi.fn(),
    getTenantUsage: vi.fn(),
    callUpdateTenantSettingsByAnalyst: vi.fn(),
    callGetTenantEntitlementsByAnalyst: vi.fn(),
    callUpdateTenantEntitlementsByAnalyst: vi.fn(),
    callGetTenantBillingOverview: vi.fn(),
    callCloseTenantBillingPeriod: vi.fn(),
    callGetTenantBillingSettlement: vi.fn(),
}));

vi.mock('../../core/firebase/firestoreService', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getTenantSettings: (...args) => tenantSettingsPageMocks.getTenantSettings(...args),
        getTenantUsage: (...args) => tenantSettingsPageMocks.getTenantUsage(...args),
        callUpdateTenantSettingsByAnalyst: (...args) => tenantSettingsPageMocks.callUpdateTenantSettingsByAnalyst(...args),
        callGetTenantEntitlementsByAnalyst: (...args) => tenantSettingsPageMocks.callGetTenantEntitlementsByAnalyst(...args),
        callUpdateTenantEntitlementsByAnalyst: (...args) => tenantSettingsPageMocks.callUpdateTenantEntitlementsByAnalyst(...args),
        callGetTenantBillingOverview: (...args) => tenantSettingsPageMocks.callGetTenantBillingOverview(...args),
        callCloseTenantBillingPeriod: (...args) => tenantSettingsPageMocks.callCloseTenantBillingPeriod(...args),
        callGetTenantBillingSettlement: (...args) => tenantSettingsPageMocks.callGetTenantBillingSettlement(...args),
    };
});

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => tenantSettingsPageMocks.navigate,
        useParams: () => ({ tenantId: 'tenant-alpha' }),
    };
});

const { default: TenantSettingsPage } = await import('./TenantSettingsPage');

function mockSettings(ok = true) {
    if (!ok) return Promise.reject(new Error('Falha ao carregar settings'));
    tenantSettingsPageMocks.getTenantSettings.mockResolvedValue({
        tenantName: 'Alpha Ltda',
        analysisConfig: { criminal: { enabled: true }, labor: { enabled: false } },
        dailyLimit: 50,
        monthlyLimit: 1000,
        allowDailyExceedance: true,
        allowMonthlyExceedance: false,
        enrichmentConfig: { enabled: false },
    });
    tenantSettingsPageMocks.getTenantUsage.mockResolvedValue({ dayKey: '2026-04-21', dailyCount: 3, monthKey: '2026-04', monthlyCount: 42 });
    tenantSettingsPageMocks.callGetTenantBillingOverview.mockResolvedValue({
        tenantId: 'tenant-alpha',
        monthKey: '2026-04',
        source: 'usageMeters',
        fallbackUsed: false,
        usageMeterCount: 3,
        overview: {
            totalQuantity: 3,
            commercialBillableQuantity: 2,
            totalInternalCostBrl: 1.2,
        },
    });
    tenantSettingsPageMocks.callGetTenantBillingSettlement.mockResolvedValue({
        tenantId: 'tenant-alpha',
        monthKey: '2026-04',
        settlement: null,
    });
}

function mockEntitlements(source = 'tenantEntitlements', extra = {}) {
    tenantSettingsPageMocks.callGetTenantEntitlementsByAnalyst.mockResolvedValue({
        tenantId: 'tenant-alpha',
        source,
        entitlements: {
            tier: 'professional',
            status: 'active',
            contractId: 'CTR-2026-001',
            billingModel: 'per_case',
            maxCasesPerMonth: 200,
            enabledModules: { criminal: true, labor: true },
            enabledProducts: ['due_diligence'],
            featureOverrides: { evidence_items: true, billing_dashboard: true },
            ...extra,
        },
        resolvedEntitlements: {
            tier: 'professional',
            entitlementId: 'tenantEntitlements/tenant-alpha',
            enabledModules: { criminal: true, labor: true },
            enabledProducts: ['due_diligence'],
            featureOverrides: { evidence_items: true, billing_dashboard: true },
            billingModel: 'per_case',
            maxCasesPerMonth: 200,
            resolverVersion: 'v2-entitlement-resolver-2026-04-21',
        },
        legacySettingsFallbackAvailable: source === 'legacyTenantSettingsFallback',
    });
}

describe('TenantSettingsPage - BLOCO-U: Entitlements V2', () => {
    beforeEach(() => {
        tenantSettingsPageMocks.navigate.mockReset();
        tenantSettingsPageMocks.getTenantSettings.mockReset();
        tenantSettingsPageMocks.getTenantUsage.mockReset();
        tenantSettingsPageMocks.callUpdateTenantSettingsByAnalyst.mockReset();
        tenantSettingsPageMocks.callGetTenantEntitlementsByAnalyst.mockReset();
        tenantSettingsPageMocks.callUpdateTenantEntitlementsByAnalyst.mockReset();
        tenantSettingsPageMocks.callGetTenantBillingOverview.mockReset();
        tenantSettingsPageMocks.callCloseTenantBillingPeriod.mockReset();
        tenantSettingsPageMocks.callGetTenantBillingSettlement.mockReset();
    });

    it('renderiza secao de contrato com dados de entitlements quando disponiveis', async () => {
        mockSettings();
        mockEntitlements('tenantEntitlements');
        render(<TenantSettingsPage />);

        await waitFor(() => {
            expect(screen.getByTestId('entitlement-tier')).toHaveTextContent('Profissional');
        });
        expect(screen.getByTestId('entitlement-max-cases')).toHaveTextContent('200');
        expect(screen.getByTestId('entitlement-source')).toHaveTextContent('Contrato V2');
        expect(screen.getByTestId('entitlement-modules')).toBeInTheDocument();
        expect(screen.getByTestId('entitlement-products')).toHaveTextContent('due_diligence');
    });

    it('renderiza overview de consumo V2 baseado em usageMeters', async () => {
        mockSettings();
        mockEntitlements('tenantEntitlements');
        render(<TenantSettingsPage />);

        await waitFor(() => {
            expect(screen.getByTestId('billing-source')).toHaveTextContent('usageMeters');
        });
        expect(screen.getByTestId('billing-total-quantity')).toHaveTextContent('3');
        expect(screen.getByTestId('billing-billable-quantity')).toHaveTextContent('2');
        expect(screen.getByTestId('billing-internal-cost')).toHaveTextContent('R$ 1.20');
        expect(tenantSettingsPageMocks.callGetTenantBillingOverview).toHaveBeenCalledWith({
            tenantId: 'tenant-alpha',
            monthKey: expect.stringMatching(/^\d{4}-\d{2}$/),
        });
    });

    it('exibe fonte como fallback quando tenant nao possui documento V2', async () => {
        mockSettings();
        mockEntitlements('legacyTenantSettingsFallback');
        render(<TenantSettingsPage />);

        await waitFor(() => {
            expect(screen.getByTestId('entitlement-source')).toHaveTextContent('Configuracao operacional (fallback)');
        });
    });

    it('renderiza flags de funcionalidades com overrides explicitos', async () => {
        mockSettings();
        mockEntitlements('tenantEntitlements');
        render(<TenantSettingsPage />);

        await waitFor(() => {
            const flagsSection = screen.getByTestId('entitlement-flags');
            expect(flagsSection).toBeInTheDocument();
            expect(flagsSection).toHaveTextContent('evidence_items: sim');
            expect(flagsSection).toHaveTextContent('billing_dashboard: sim');
        });
    });

    it('formulario de edicao envia apenas campos contratuais (sem misturar tenantSettings)', async () => {
        mockSettings();
        mockEntitlements('tenantEntitlements');
        mockEntitlements('tenantEntitlements', { tier: 'premium' });
        tenantSettingsPageMocks.callUpdateTenantEntitlementsByAnalyst.mockResolvedValue({ success: true });
        render(<TenantSettingsPage />);

        await waitFor(() => {
            expect(screen.getByTestId('edit-tier')).toBeInTheDocument();
        });

        // Change tier to premium
        const tierSelect = screen.getByTestId('edit-tier');
        fireEvent.change(tierSelect, { target: { value: 'premium' } });

        // Submit
        const saveBtn = screen.getByTestId('save-entitlements');
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(tenantSettingsPageMocks.callUpdateTenantEntitlementsByAnalyst).toHaveBeenCalledWith({
                tenantId: 'tenant-alpha',
                entitlements: expect.objectContaining({
                    tier: 'premium',
                    enabledModules: expect.any(Object),
                    enabledProducts: expect.any(Object),
                    enabledCapabilities: expect.any(Object),
                    policyOverrides: expect.any(Object),
                }),
            });
            // Verify no operational fields leaked
            const callArg = tenantSettingsPageMocks.callUpdateTenantEntitlementsByAnalyst.mock.calls[0][0];
            expect(callArg.entitlements).not.toHaveProperty('analysisConfig');
            expect(callArg.entitlements).not.toHaveProperty('enrichmentConfig');
            expect(callArg.entitlements).not.toHaveProperty('dailyLimit');
            expect(callArg.entitlements).not.toHaveProperty('monthlyLimit');
        });
    });

    it('exibe erro ao falhar carregamento de entitlements mas mantem settings', async () => {
        mockSettings();
        tenantSettingsPageMocks.callGetTenantEntitlementsByAnalyst.mockRejectedValue(new Error('permission_denied'));
        render(<TenantSettingsPage />);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Nao foi possivel carregar dados contratuais');
        });
        // Settings section should still render
        expect(screen.getByText('Fases de Analise')).toBeInTheDocument();
    });

    it('exibe formulario padrao quando tenant nao tem documento V2 completo', async () => {
        mockSettings();
        tenantSettingsPageMocks.callGetTenantEntitlementsByAnalyst.mockResolvedValue({
            tenantId: 'tenant-alpha',
            source: 'defaults',
            entitlements: null,
            resolvedEntitlements: null,
            legacySettingsFallbackAvailable: false,
        });
        render(<TenantSettingsPage />);

        await waitFor(() => {
            expect(screen.getByTestId('edit-tier')).toBeInTheDocument();
            expect(screen.getByTestId('save-entitlements')).toBeInTheDocument();
        });
    });

    it('permite fechar periodo de billing V2 por usageMeters', async () => {
        mockSettings();
        mockEntitlements('tenantEntitlements');
        tenantSettingsPageMocks.callCloseTenantBillingPeriod.mockResolvedValue({
            success: true,
            settlementId: 'billing_tenant-alpha_2026-04',
            monthKey: '2026-04',
            status: 'PENDING_REVIEW',
            itemCount: 3,
            summary: { totalQuantity: 3, totalInternalCostBrl: 1.2 },
        });
        render(<TenantSettingsPage />);

        await waitFor(() => {
            expect(screen.getByTestId('close-billing-period')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByTestId('close-billing-period'));

        await waitFor(() => {
            expect(tenantSettingsPageMocks.callCloseTenantBillingPeriod).toHaveBeenCalledWith({
                tenantId: 'tenant-alpha',
                monthKey: expect.stringMatching(/^\d{4}-\d{2}$/),
            });
            expect(screen.getByTestId('billing-settlement-status')).toHaveTextContent('PENDING_REVIEW');
        });
    });
});
