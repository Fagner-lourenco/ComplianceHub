import { useEffect, useMemo, useState } from 'react';
import {
    subscribeToWatchlistsByTenant,
    callPauseWatchlist,
    callResumeWatchlist,
    callDeleteWatchlist,
    callRunWatchlistNow,
} from '../../core/firebase/firestoreService';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { extractErrorMessage } from '../../core/errorUtils';
import './WatchlistsPage.css';

const FILTERS = [
    { key: 'active', label: 'Ativas' },
    { key: 'paused', label: 'Pausadas' },
    { key: 'all', label: 'Todas' },
];

function formatDate(value) {
    if (!value) return '-';
    try {
        if (typeof value.toDate === 'function') return value.toDate().toLocaleString('pt-BR');
        return new Date(value).toLocaleString('pt-BR');
    } catch {
        return '-';
    }
}

function statusLabel(w) {
    if (w.active === false) return w.autoPausedAt ? 'Auto-pausada' : 'Pausada';
    if (w.lastStatus === 'error') return 'Erro recente';
    if (w.lastStatus === 'subject_missing') return 'Sujeito ausente';
    return 'Ativa';
}

function statusClass(w) {
    if (w.active === false) return w.autoPausedAt ? 'wl-status--autopaused' : 'wl-status--paused';
    if (w.lastStatus === 'error') return 'wl-status--error';
    return 'wl-status--active';
}

export default function WatchlistsPage() {
    const { selectedTenantId } = useTenant();
    const tenantOverride = selectedTenantId === ALL_TENANTS_ID ? null : selectedTenantId;
    const [watchlists, setWatchlists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('active');
    const [actingId, setActingId] = useState(null);

    useEffect(() => {
        if (!tenantOverride) {
            setWatchlists([]);
            setLoading(false);
            return undefined;
        }
        setLoading(true);
        const unsub = subscribeToWatchlistsByTenant(tenantOverride, (data, err) => {
            if (err) {
                setError(extractErrorMessage(err, 'Nao foi possivel carregar watchlists.'));
                setWatchlists([]);
            } else {
                setWatchlists(data);
                setError(null);
            }
            setLoading(false);
        });
        return unsub;
    }, [tenantOverride]);

    const filtered = useMemo(() => {
        if (filter === 'all') return watchlists;
        if (filter === 'active') return watchlists.filter((w) => w.active !== false);
        if (filter === 'paused') return watchlists.filter((w) => w.active === false);
        return watchlists;
    }, [watchlists, filter]);

    const activeCount = useMemo(() => watchlists.filter((w) => w.active !== false).length, [watchlists]);
    const alertsCount = useMemo(() => watchlists.filter((w) => w.lastAlertAt).length, [watchlists]);

    async function handleAction(watchlist, action) {
        setActingId(watchlist.id);
        try {
            if (action === 'pause') await callPauseWatchlist({ watchlistId: watchlist.id });
            else if (action === 'resume') await callResumeWatchlist({ watchlistId: watchlist.id });
            else if (action === 'run') await callRunWatchlistNow({ watchlistId: watchlist.id });
            else if (action === 'delete') {
                if (!window.confirm(`Remover watchlist ${watchlist.id}?`)) return;
                await callDeleteWatchlist({ watchlistId: watchlist.id });
            }
        } catch (err) {
            setError(extractErrorMessage(err, 'Nao foi possivel executar a acao.'));
        } finally {
            setActingId(null);
        }
    }

    if (!tenantOverride) {
        return (
            <div className="watchlists-page">
                <header className="watchlists-page__header">
                    <h1 className="watchlists-page__title">Watchlists</h1>
                    <p className="watchlists-page__subtitle">Selecione um tenant para visualizar watchlists.</p>
                </header>
            </div>
        );
    }

    return (
        <div className="watchlists-page">
            <header className="watchlists-page__header">
                <h1 className="watchlists-page__title">Watchlists de Monitoramento</h1>
                <p className="watchlists-page__subtitle">
                    <strong data-testid="watchlists-active-count">{activeCount}</strong> ativa(s) · <strong>{alertsCount}</strong> com alertas · <strong>{watchlists.length}</strong> total
                </p>
            </header>

            <div className="watchlists-filters">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        type="button"
                        data-testid={`watchlists-filter-${f.key}`}
                        className={`watchlists-filter ${filter === f.key ? 'watchlists-filter--active' : ''}`}
                        onClick={() => setFilter(f.key)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {error && <div className="watchlists-page__error" role="alert">{error}</div>}

            {loading ? (
                <p className="watchlists-page__empty">Carregando watchlists...</p>
            ) : filtered.length === 0 ? (
                <p className="watchlists-page__empty" data-testid="watchlists-empty">Nenhuma watchlist nesta secao.</p>
            ) : (
                <ul className="watchlists-list">
                    {filtered.map((w) => (
                        <li key={w.id} className="watchlists-item" data-testid={`watchlist-${w.id}`}>
                            <div className="watchlists-item__head">
                                <span className={`watchlists-status ${statusClass(w)}`}>{statusLabel(w)}</span>
                                <strong className="watchlists-item__subject">{w.subjectId}</strong>
                                <span className="watchlists-item__modules">
                                    Modulos: {(w.modules || []).join(', ') || '—'}
                                </span>
                                <span className="watchlists-item__interval">Intervalo: {w.intervalDays || 30}d</span>
                            </div>
                            <div className="watchlists-item__meta">
                                <span>Ultima execucao: {formatDate(w.lastRunAt)}</span>
                                <span>Proxima: {formatDate(w.nextRunAt)}</span>
                                <span>Execucoes: {w.runCount || 0}</span>
                                {w.lastAlertAt && <span>Ultimo alerta: {formatDate(w.lastAlertAt)}</span>}
                                {w.consecutiveFailures > 0 && (
                                    <span className="watchlists-item__failures">Falhas consecutivas: {w.consecutiveFailures}</span>
                                )}
                            </div>
                            {w.lastError && (
                                <p className="watchlists-item__error">Ultimo erro: {w.lastError}</p>
                            )}
                            <div className="watchlists-item__actions">
                                <button
                                    type="button"
                                    data-testid={`watchlist-run-${w.id}`}
                                    className="watchlists-btn--ghost"
                                    disabled={actingId === w.id}
                                    onClick={() => handleAction(w, 'run')}
                                >
                                    Executar agora
                                </button>
                                {w.active === false ? (
                                    <button
                                        type="button"
                                        data-testid={`watchlist-resume-${w.id}`}
                                        disabled={actingId === w.id}
                                        onClick={() => handleAction(w, 'resume')}
                                    >
                                        Reativar
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        data-testid={`watchlist-pause-${w.id}`}
                                        className="watchlists-btn--ghost"
                                        disabled={actingId === w.id}
                                        onClick={() => handleAction(w, 'pause')}
                                    >
                                        Pausar
                                    </button>
                                )}
                                <button
                                    type="button"
                                    data-testid={`watchlist-delete-${w.id}`}
                                    className="watchlists-btn--danger"
                                    disabled={actingId === w.id}
                                    onClick={() => handleAction(w, 'delete')}
                                >
                                    Remover
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
