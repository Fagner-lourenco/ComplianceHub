import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../core/auth/useAuth';
import { callGetSystemHealth } from '../../core/firebase/firestoreService';
import { extractErrorMessage } from '../../core/errorUtils';
import './SaudePage.css';

function formatTs(value) {
    if (!value) return '—';
    const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getStatus(provider) {
    if (!provider) return 'healthy';
    const now = Date.now();
    const disabledUntil = provider.disabledUntil?.seconds
        ? provider.disabledUntil.seconds * 1000
        : provider.disabledUntil || 0;
    if (disabledUntil > now) return 'down';
    if ((provider.failCount || 0) > 0) return 'degraded';
    return 'healthy';
}

const STATUS_LABELS = { healthy: 'Saudável', degraded: 'Degradado', down: 'Indisponível' };

const KNOWN_PROVIDERS = ['judit', 'escavador', 'fontedata', 'bigdatacorp', 'openai'];

const MOCK_PROVIDERS = {
    judit: { failCount: 0, lastSuccess: { seconds: Math.floor(Date.now() / 1000) - 120 } },
    escavador: { failCount: 0, lastSuccess: { seconds: Math.floor(Date.now() / 1000) - 300 } },
    fontedata: { failCount: 0, lastSuccess: { seconds: Math.floor(Date.now() / 1000) - 60 } },
    bigdatacorp: { failCount: 1, lastSuccess: { seconds: Math.floor(Date.now() / 1000) - 900 } },
    openai: { failCount: 0, lastSuccess: { seconds: Math.floor(Date.now() / 1000) - 45 } },
};

export default function SaudePage() {
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';
    const [providers, setProviders] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (isDemoMode) {
                setProviders(MOCK_PROVIDERS);
            } else {
                const data = await callGetSystemHealth();
                setProviders(data?.providers || {});
            }
        } catch (err) {
            setError(extractErrorMessage(err, 'Não foi possível carregar a saúde dos provedores.'));
        } finally {
            setLoading(false);
        }
    }, [isDemoMode]);

    useEffect(() => { load(); }, [load]);

    const allProviders = KNOWN_PROVIDERS.map((id) => ({
        id,
        ...(providers[id] || {}),
    }));

    return (
        <div className="saude-page">
            <div className="saude-header">
                <div>
                    <h2 className="saude-header__title">Saúde dos Provedores</h2>
                    <p className="saude-header__subtitle">Circuit breaker e status em tempo real</p>
                </div>
                <div className="saude-header__actions">
                    <button
                        type="button"
                        className="saude-header__refresh"
                        onClick={load}
                        disabled={loading}
                    >
                        {loading ? 'Carregando…' : '↻ Atualizar'}
                    </button>
                </div>
            </div>

            {error && <div className="saude-error">{error}</div>}

            {!error && !loading && allProviders.length === 0 && (
                <div className="saude-empty">Nenhum dado de saúde registrado ainda.</div>
            )}

            <div className="saude-grid">
                {allProviders.map((p) => {
                    const status = getStatus(p);
                    return (
                        <div key={p.id} className={`saude-card saude-card--${status}`}>
                            <div className="saude-card__header">
                                <span className="saude-card__name">{p.id}</span>
                                <span className={`saude-card__badge saude-card__badge--${status}`}>
                                    {STATUS_LABELS[status]}
                                </span>
                            </div>
                            <div className="saude-card__stats">
                                <div>
                                    <div className="saude-card__stat-label">Falhas</div>
                                    <div className="saude-card__stat-value">{p.failCount ?? 0}</div>
                                </div>
                                <div>
                                    <div className="saude-card__stat-label">Último Sucesso</div>
                                    <div className="saude-card__stat-value">{formatTs(p.lastSuccess)}</div>
                                </div>
                                <div>
                                    <div className="saude-card__stat-label">Última Falha</div>
                                    <div className="saude-card__stat-value">{formatTs(p.lastFailure)}</div>
                                </div>
                                <div>
                                    <div className="saude-card__stat-label">Bloqueado até</div>
                                    <div className="saude-card__stat-value">{formatTs(p.disabledUntil)}</div>
                                </div>
                            </div>
                            {p.lastError && (
                                <div className="saude-card__error">
                                    Último erro: {p.lastError}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
