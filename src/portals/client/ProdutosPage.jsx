import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { callGetClientProductCatalog } from '../../core/firebase/firestoreService';
import { extractErrorMessage } from '../../core/errorUtils';
import { buildClientPortalPath } from '../../core/portalPaths';
import './ProdutosPage.css';

const SECTION_COPY = {
    contracted: {
        title: 'Meus produtos',
        description: 'Produtos contratados pelo seu tenant. Abra uma nova solicitacao diretamente.',
    },
    available: {
        title: 'Disponiveis no seu plano',
        description: 'Produtos que seu plano permite ativar. Entre em contato se quiser comecar a usar.',
    },
    upsell: {
        title: 'Upgrade de plano',
        description: 'Produtos premium nao incluidos no plano atual. Solicite uma proposta comercial.',
    },
};

function ProductCard({ product, action, onAction }) {
    return (
        <article className="produtos-card" data-testid={`product-card-${product.productKey}`}>
            <header className="produtos-card__header">
                <h3 className="produtos-card__title">{product.commercialName}</h3>
                <span className={`produtos-card__tier produtos-card__tier--${product.minTier}`}>{product.minTier}</span>
            </header>
            <p className="produtos-card__desc">{product.shortDescription}</p>
            <ul className="produtos-card__meta">
                <li><strong>Sujeito:</strong> {product.subjectType === 'pj' ? 'PJ' : product.subjectType === 'mixed' ? 'PF ou PJ' : 'PF'}</li>
                <li><strong>Cobranca:</strong> {product.pricingHint}</li>
            </ul>
            <button
                type="button"
                className={`produtos-card__cta produtos-card__cta--${action.kind}`}
                data-testid={`product-cta-${product.productKey}`}
                onClick={() => onAction(product, action)}
            >
                {action.label}
            </button>
        </article>
    );
}

function ProductSection({ bucket, products, onAction }) {
    const copy = SECTION_COPY[bucket];
    const actionKind = bucket === 'contracted' ? 'primary' : bucket === 'available' ? 'secondary' : 'upsell';
    const actionLabel = bucket === 'contracted' ? 'Abrir solicitacao' : bucket === 'available' ? 'Ativar produto' : 'Solicitar proposta';

    return (
        <section className="produtos-section" data-testid={`produtos-section-${bucket}`}>
            <header className="produtos-section__header">
                <h2 className="produtos-section__title">{copy.title}</h2>
                <p className="produtos-section__desc">{copy.description}</p>
            </header>
            {products.length === 0 ? (
                <p className="produtos-section__empty" data-testid={`produtos-empty-${bucket}`}>Nenhum produto nesta secao.</p>
            ) : (
                <div className="produtos-section__grid">
                    {products.map((product) => (
                        <ProductCard
                            key={product.productKey}
                            product={product}
                            action={{ kind: actionKind, label: actionLabel, bucket }}
                            onAction={onAction}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

export default function ProdutosPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [catalog, setCatalog] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        callGetClientProductCatalog()
            .then((data) => {
                setCatalog(data);
                setError(null);
            })
            .catch((err) => {
                setError(extractErrorMessage(err, 'Nao foi possivel carregar o catalogo.'));
                setCatalog(null);
            })
            .finally(() => setLoading(false));
    }, []);

    const totalAvailable = useMemo(
        () => (catalog ? catalog.contracted.length + catalog.available.length : 0),
        [catalog],
    );

    function handleAction(product, action) {
        const basePath = buildClientPortalPath(location.pathname, 'nova-solicitacao');
        if (action.bucket === 'contracted' || action.bucket === 'available') {
            navigate(`${basePath}?productKey=${encodeURIComponent(product.productKey)}`);
            return;
        }
        navigate(`${basePath}?quoteProductKey=${encodeURIComponent(product.productKey)}`);
    }

    if (loading) {
        return (
            <div className="produtos-page" data-testid="produtos-loading">
                <p className="produtos-page__loading">Carregando catalogo...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="produtos-page" data-testid="produtos-error" role="alert">
                <p className="produtos-page__error">{error}</p>
            </div>
        );
    }

    if (!catalog) return null;

    return (
        <div className="produtos-page">
            <header className="produtos-page__header">
                <h1 className="produtos-page__title">Produtos de Compliance</h1>
                <p className="produtos-page__subtitle">
                    Tier atual: <strong data-testid="produtos-tier">{catalog.tenantTier || 'basic'}</strong>
                    {' '}· Produtos ativos: <strong data-testid="produtos-active-count">{totalAvailable}</strong>
                </p>
                {catalog.fallbackUsed && (
                    <p className="produtos-page__hint" data-testid="produtos-fallback-hint">
                        Tenant sem contrato V2 completo — mostrando catalogo comercial. Fale com o time para ativar.
                    </p>
                )}
            </header>

            <ProductSection bucket="contracted" products={catalog.contracted} onAction={handleAction} />
            <ProductSection bucket="available" products={catalog.available} onAction={handleAction} />
            <ProductSection bucket="upsell" products={catalog.upsell} onAction={handleAction} />
        </div>
    );
}
