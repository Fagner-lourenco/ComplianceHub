import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

const produtosMocks = vi.hoisted(() => ({
    callGetClientProductCatalog: vi.fn(),
    navigate: vi.fn(),
}));

vi.mock('../../core/firebase/firestoreService', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        callGetClientProductCatalog: (...args) => produtosMocks.callGetClientProductCatalog(...args),
    };
});

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => produtosMocks.navigate,
        useLocation: () => ({ pathname: '/client/produtos', search: '' }),
    };
});

const { default: ProdutosPage } = await import('./ProdutosPage');

function sampleCatalog(overrides = {}) {
    return {
        tenantId: 'tenant-alpha',
        source: 'tenantEntitlements',
        tenantTier: 'professional',
        fallbackUsed: false,
        contracted: [
            { productKey: 'dossier_pf_basic', commercialName: 'Dossie PF Essencial', subjectType: 'pf', shortDescription: 'Basico PF.', pricingHint: 'Consumo.', minTier: 'basic' },
        ],
        available: [
            { productKey: 'dossier_pj', commercialName: 'Dossie PJ', subjectType: 'pj', shortDescription: 'Empresa.', pricingHint: 'Pacote.', minTier: 'professional' },
        ],
        upsell: [
            { productKey: 'ongoing_monitoring', commercialName: 'Monitoramento Continuo', subjectType: 'mixed', shortDescription: 'Reconsulta.', pricingHint: 'Mensal.', minTier: 'premium' },
        ],
        ...overrides,
    };
}

describe('ProdutosPage', () => {
    beforeEach(() => {
        produtosMocks.callGetClientProductCatalog.mockReset();
        produtosMocks.navigate.mockReset();
    });

    it('renderiza 3 secoes com dados do backend', async () => {
        produtosMocks.callGetClientProductCatalog.mockResolvedValue(sampleCatalog());
        render(<ProdutosPage />);

        await waitFor(() => {
            expect(screen.getByTestId('produtos-section-contracted')).toBeInTheDocument();
        });
        expect(screen.getByTestId('produtos-section-available')).toBeInTheDocument();
        expect(screen.getByTestId('produtos-section-upsell')).toBeInTheDocument();

        expect(screen.getByTestId('product-card-dossier_pf_basic')).toBeInTheDocument();
        expect(screen.getByTestId('product-card-dossier_pj')).toBeInTheDocument();
        expect(screen.getByTestId('product-card-ongoing_monitoring')).toBeInTheDocument();

        expect(screen.getByTestId('produtos-tier')).toHaveTextContent('professional');
    });

    it('CTA contratado navega para nova-solicitacao com productKey', async () => {
        produtosMocks.callGetClientProductCatalog.mockResolvedValue(sampleCatalog());
        render(<ProdutosPage />);

        await waitFor(() => {
            expect(screen.getByTestId('product-cta-dossier_pf_basic')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('product-cta-dossier_pf_basic'));
        expect(produtosMocks.navigate).toHaveBeenCalledWith(
            expect.stringMatching(/nova-solicitacao\?productKey=dossier_pf_basic/),
        );
    });

    it('CTA upsell navega com quoteProductKey', async () => {
        produtosMocks.callGetClientProductCatalog.mockResolvedValue(sampleCatalog());
        render(<ProdutosPage />);

        await waitFor(() => {
            expect(screen.getByTestId('product-cta-ongoing_monitoring')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('product-cta-ongoing_monitoring'));
        expect(produtosMocks.navigate).toHaveBeenCalledWith(
            expect.stringMatching(/quoteProductKey=ongoing_monitoring/),
        );
    });

    it('exibe fallback hint quando tenant sem contrato V2', async () => {
        produtosMocks.callGetClientProductCatalog.mockResolvedValue(sampleCatalog({
            fallbackUsed: true,
            contracted: [],
            available: [],
            upsell: [
                { productKey: 'dossier_pf_basic', commercialName: 'Dossie PF Essencial', subjectType: 'pf', shortDescription: 'Basico PF.', pricingHint: 'Consumo.', minTier: 'basic' },
            ],
        }));
        render(<ProdutosPage />);

        await waitFor(() => {
            expect(screen.getByTestId('produtos-fallback-hint')).toBeInTheDocument();
        });
    });

    it('exibe erro quando callable falha', async () => {
        produtosMocks.callGetClientProductCatalog.mockRejectedValue(new Error('permission_denied'));
        render(<ProdutosPage />);

        await waitFor(() => {
            expect(screen.getByTestId('produtos-error')).toBeInTheDocument();
        });
    });
});
