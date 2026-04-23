import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../core/auth/useAuth';
import { subscribeToAlertsByTenant, callMarkAlertAs } from '../../core/firebase/firestoreService';
import { extractErrorMessage } from '../../core/errorUtils';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import EmptyState from '../../ui/components/EmptyState/EmptyState';
import { getModuleLabel } from '../../core/productLabels';
import './AlertasClientePage.css';

const KIND_LABELS = {
    watchlist_finding: 'Novo achado',
    watchlist_escalation: 'Severidade elevada',
    sanctions_hit: 'Sancao',
    media_negative: 'Midia adversa',
};

function formatKind(alert) {
    const base = KIND_LABELS[alert.kind] || alert.kind || 'Alerta';
    const module = alert.moduleKey ? ` · ${getModuleLabel(alert.moduleKey)}` : '';
    return `${base}${module}`;
}

const SEVERITY_LABELS = {
    critical: { label: 'Critico', cls: 'severity--critical' },
    high: { label: 'Alto', cls: 'severity--high' },
    medium: { label: 'Medio', cls: 'severity--medium' },
    low: { label: 'Baixo', cls: 'severity--low' },
    info: { label: 'Info', cls: 'severity--info' },
};

const STATE_LABELS = {
    unread: 'Nao lido',
    read: 'Lido',
    actioned: 'Acionado',
    dismissed: 'Descartado',
};

function formatDate(iso) {
    if (!iso) return '-';
    try {
        return new Date(iso).toLocaleString('pt-BR');
    } catch {
        return iso;
    }
}

export default function AlertasClientePage() {
    const { userProfile } = useAuth();
    const tenantId = userProfile?.tenantId || null;
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterState, setFilterState] = useState('all');
    const [actingId, setActingId] = useState(null);

    useEffect(() => {
        if (!tenantId) return;
        setLoading(true);
        const unsub = subscribeToAlertsByTenant(tenantId, (data, err) => {
            if (err) {
                setError(extractErrorMessage(err, 'Nao foi possivel carregar alertas.'));
                setAlerts([]);
            } else {
                setAlerts(data);
                setError(null);
            }
            setLoading(false);
        });
        return unsub;
    }, [tenantId]);

    const filteredAlerts = useMemo(() => {
        if (filterState === 'all') return alerts;
        if (filterState === 'active') return alerts.filter((a) => a.state === 'unread' || a.state === 'read');
        return alerts.filter((a) => a.state === filterState);
    }, [alerts, filterState]);

    const unreadCount = useMemo(() => alerts.filter((a) => a.state === 'unread').length, [alerts]);

    async function handleAction(alertId, newState) {
        setActingId(alertId);
        try {
            await callMarkAlertAs({ alertId, state: newState });
        } catch (err) {
            setError(extractErrorMessage(err, 'Nao foi possivel atualizar o alerta.'));
        } finally {
            setActingId(null);
        }
    }

    if (!tenantId) {
        return (
            <div className="alertas-page">
                <PageHeader title="Alertas" />
                <EmptyState title="Tenant nao identificado" message="Seu perfil ainda esta sem franquia associada." />
            </div>
        );
    }

    return (
        <div className="alertas-page">
            <PageHeader
                eyebrow="Monitoramento Continuo"
                title="Alertas"
                subtitle="Novos achados e escaladas de severidade gerados pelas watchlists ativas do seu tenant."
                metrics={[
                    { label: 'Nao lidos', value: unreadCount, testId: 'alertas-unread-count' },
                    { label: 'Total', value: alerts.length },
                ]}
            />

            <div className="alertas-filters" role="tablist">
                {['all', 'active', 'unread', 'actioned', 'dismissed'].map((key) => (
                    <button
                        key={key}
                        type="button"
                        data-testid={`alertas-filter-${key}`}
                        role="tab"
                        aria-selected={filterState === key}
                        className={`alertas-filter ${filterState === key ? 'alertas-filter--active' : ''}`}
                        onClick={() => setFilterState(key)}
                    >
                        {key === 'all' ? 'Todos' : key === 'active' ? 'Ativos' : STATE_LABELS[key]}
                    </button>
                ))}
            </div>

            {error && (
                <EmptyState variant="error" title="Falha ao carregar alertas" message={error} />
            )}

            {loading ? (
                <EmptyState variant="loading" testId="alertas-loading" title="Carregando alertas" message="Sincronizando com o monitor continuo..." />
            ) : filteredAlerts.length === 0 ? (
                <EmptyState testId="alertas-empty" title="Nenhum alerta neste filtro" message="Alertas aparecem aqui quando uma watchlist ativa detecta algo novo ou escalado." />
            ) : (
                <ul className="alertas-list">
                    {filteredAlerts.map((alert) => {
                        const sev = SEVERITY_LABELS[alert.severity] || SEVERITY_LABELS.info;
                        return (
                            <li
                                key={alert.id}
                                className={`alertas-item alertas-item--${alert.state}`}
                                data-testid={`alerta-${alert.id}`}
                            >
                                <div className="alertas-item__head">
                                    <span className={`alertas-severity ${sev.cls}`}>{sev.label}</span>
                                    <span className="alertas-item__kind">{formatKind(alert)}</span>
                                    <span className="alertas-item__state" data-testid={`alerta-state-${alert.id}`}>
                                        {STATE_LABELS[alert.state] || alert.state}
                                    </span>
                                    <span className="alertas-item__date">{formatDate(alert.createdAt)}</span>
                                </div>
                                <p className="alertas-item__message">{alert.message || '(sem mensagem)'}</p>
                                {alert.caseId && (
                                    <p className="alertas-item__meta">Caso: <code>{alert.caseId}</code></p>
                                )}
                                <div className="alertas-item__actions">
                                    {alert.state === 'unread' && (
                                        <button
                                            type="button"
                                            data-testid={`alerta-mark-read-${alert.id}`}
                                            disabled={actingId === alert.id}
                                            onClick={() => handleAction(alert.id, 'read')}
                                        >
                                            Marcar como lido
                                        </button>
                                    )}
                                    {alert.state !== 'actioned' && alert.state !== 'dismissed' && (
                                        <button
                                            type="button"
                                            data-testid={`alerta-action-${alert.id}`}
                                            disabled={actingId === alert.id}
                                            onClick={() => handleAction(alert.id, 'actioned')}
                                        >
                                            Marcar acionado
                                        </button>
                                    )}
                                    {alert.state !== 'dismissed' && alert.state !== 'actioned' && (
                                        <button
                                            type="button"
                                            className="alertas-btn--ghost"
                                            data-testid={`alerta-dismiss-${alert.id}`}
                                            disabled={actingId === alert.id}
                                            onClick={() => handleAction(alert.id, 'dismissed')}
                                        >
                                            Descartar
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
