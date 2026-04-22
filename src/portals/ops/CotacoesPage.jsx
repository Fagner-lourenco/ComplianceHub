import { useEffect, useMemo, useState } from 'react';
import {
    subscribeToQuoteRequestsByTenant,
    subscribeToQuoteRequestsForAllTenants,
    callResolveQuoteRequest,
} from '../../core/firebase/firestoreService';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { extractErrorMessage } from '../../core/errorUtils';
import './CotacoesPage.css';

const STATUS_LABELS = {
    pending: { label: 'Pendente', cls: 'quote-status--pending' },
    approved: { label: 'Aprovado', cls: 'quote-status--approved' },
    rejected: { label: 'Rejeitado', cls: 'quote-status--rejected' },
};

function formatDate(iso) {
    if (!iso) return '-';
    try {
        return new Date(iso).toLocaleString('pt-BR');
    } catch {
        return iso;
    }
}

export default function CotacoesPage() {
    const { selectedTenantId } = useTenant();
    const tenantOverride = selectedTenantId === ALL_TENANTS_ID ? null : selectedTenantId;
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('pending');
    const [actingId, setActingId] = useState(null);
    const [responseNotes, setResponseNotes] = useState({});
    const [addProductFlags, setAddProductFlags] = useState({});

    useEffect(() => {
        setLoading(true);
        const subscribe = tenantOverride
            ? (cb) => subscribeToQuoteRequestsByTenant(tenantOverride, cb)
            : (cb) => subscribeToQuoteRequestsForAllTenants(cb);
        const unsub = subscribe((data, err) => {
            if (err) {
                setError(extractErrorMessage(err, 'Nao foi possivel carregar cotacoes.'));
                setQuotes([]);
            } else {
                setQuotes(data);
                setError(null);
            }
            setLoading(false);
        });
        return unsub;
    }, [tenantOverride]);

    const filtered = useMemo(() => {
        if (filter === 'all') return quotes;
        return quotes.filter((q) => q.status === filter);
    }, [quotes, filter]);

    const pendingCount = useMemo(() => quotes.filter((q) => q.status === 'pending').length, [quotes]);

    async function handleResolve(quote, decision) {
        setActingId(quote.id);
        try {
            await callResolveQuoteRequest({
                quoteId: quote.id,
                decision,
                responseNotes: responseNotes[quote.id] || '',
                addProduct: decision === 'approved' && Boolean(addProductFlags[quote.id]),
            });
        } catch (err) {
            setError(extractErrorMessage(err, 'Nao foi possivel resolver cotacao.'));
        } finally {
            setActingId(null);
        }
    }

    return (
        <div className="cotacoes-page">
            <header className="cotacoes-page__header">
                <h1 className="cotacoes-page__title">Cotacoes de Produtos</h1>
                <p className="cotacoes-page__subtitle">
                    <strong data-testid="cotacoes-pending-count">{pendingCount}</strong> pendente(s) · <strong>{quotes.length}</strong> total
                </p>
            </header>

            <div className="cotacoes-filters">
                {['pending', 'approved', 'rejected', 'all'].map((key) => (
                    <button
                        key={key}
                        type="button"
                        data-testid={`cotacoes-filter-${key}`}
                        className={`cotacoes-filter ${filter === key ? 'cotacoes-filter--active' : ''}`}
                        onClick={() => setFilter(key)}
                    >
                        {key === 'all' ? 'Todas' : STATUS_LABELS[key]?.label || key}
                    </button>
                ))}
            </div>

            {error && <div className="cotacoes-page__error" role="alert">{error}</div>}

            {loading ? (
                <p className="cotacoes-page__empty">Carregando cotacoes...</p>
            ) : filtered.length === 0 ? (
                <p className="cotacoes-page__empty" data-testid="cotacoes-empty">Nenhuma cotacao nesta secao.</p>
            ) : (
                <ul className="cotacoes-list">
                    {filtered.map((quote) => {
                        const statusMeta = STATUS_LABELS[quote.status] || STATUS_LABELS.pending;
                        return (
                            <li key={quote.id} className="cotacoes-item" data-testid={`cotacao-${quote.id}`}>
                                <div className="cotacoes-item__head">
                                    <span className={`cotacoes-status ${statusMeta.cls}`}>{statusMeta.label}</span>
                                    <strong className="cotacoes-item__product">{quote.productKey}</strong>
                                    <span className="cotacoes-item__tenant">Tenant: {quote.tenantId}</span>
                                    <span className="cotacoes-item__date">{formatDate(quote.requestedAt)}</span>
                                </div>
                                <p className="cotacoes-item__requester">Solicitado por: {quote.requestedByEmail || quote.requestedBy || '—'}</p>
                                {quote.notes && <p className="cotacoes-item__notes">Observacoes: {quote.notes}</p>}
                                {quote.responseNotes && (
                                    <p className="cotacoes-item__response">Resposta: {quote.responseNotes}</p>
                                )}

                                {quote.status === 'pending' && (
                                    <div className="cotacoes-item__review">
                                        <textarea
                                            data-testid={`cotacao-notes-${quote.id}`}
                                            className="cotacoes-textarea"
                                            placeholder="Notas de resposta (opcional)"
                                            value={responseNotes[quote.id] || ''}
                                            onChange={(e) => setResponseNotes((prev) => ({ ...prev, [quote.id]: e.target.value }))}
                                        />
                                        <label className="cotacoes-item__check">
                                            <input
                                                type="checkbox"
                                                data-testid={`cotacao-add-product-${quote.id}`}
                                                checked={Boolean(addProductFlags[quote.id])}
                                                onChange={(e) => setAddProductFlags((prev) => ({ ...prev, [quote.id]: e.target.checked }))}
                                            />
                                            Ao aprovar, adicionar <code>{quote.productKey}</code> em <code>enabledProducts</code>
                                        </label>
                                        <div className="cotacoes-item__actions">
                                            <button
                                                type="button"
                                                data-testid={`cotacao-approve-${quote.id}`}
                                                disabled={actingId === quote.id}
                                                onClick={() => handleResolve(quote, 'approved')}
                                            >
                                                Aprovar
                                            </button>
                                            <button
                                                type="button"
                                                data-testid={`cotacao-reject-${quote.id}`}
                                                className="cotacoes-btn--ghost"
                                                disabled={actingId === quote.id}
                                                onClick={() => handleResolve(quote, 'rejected')}
                                            >
                                                Rejeitar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
