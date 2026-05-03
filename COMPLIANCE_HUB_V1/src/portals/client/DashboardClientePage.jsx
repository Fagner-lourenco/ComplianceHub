import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import KpiCard from '../../ui/components/KpiCard/KpiCard';
import { QuotaSummaryCard } from '../../ui/components/QuotaBar/QuotaBar';
import { useCases } from '../../hooks/useCases';
import { useAuth } from '../../core/auth/useAuth';
import { formatDate } from '../../core/formatDate';
import { getClientDashboardMetrics } from '../../core/clientPortal';
import { callGetClientQuotaStatus } from '../../core/firebase/firestoreService';
import { extractErrorMessage } from '../../core/errorUtils';
import { VERDICT_LABELS } from '../../core/copy';
import './DashboardClientePage.css';

const VERDICT_DISPLAY = {
    FIT: { label: VERDICT_LABELS.CLIENT.FIT.label, color: 'var(--green-600)', bg: 'var(--green-50)' },
    ATTENTION: { label: VERDICT_LABELS.CLIENT.ATTENTION.label, color: 'var(--yellow-700)', bg: 'var(--yellow-50)' },
    NOT_RECOMMENDED: { label: VERDICT_LABELS.CLIENT.NOT_RECOMMENDED.label, color: 'var(--red-600)', bg: 'var(--red-50)' },
};

export default function DashboardClientePage() {
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';
    const clientTenantId = isDemoMode ? undefined : (userProfile?.tenantId ?? undefined);
    const { cases, loading, error } = useCases(clientTenantId);
    const [quota, setQuota] = useState(null);
    const [quotaLoading, setQuotaLoading] = useState(true);
    const [quotaError, setQuotaError] = useState(null);

    const metrics = useMemo(() => getClientDashboardMetrics(cases), [cases]);
    const maxMonthCount = metrics.maxMonthCount || 1;

    useEffect(() => {
        if (!user || isDemoMode) return undefined;
        let cancelled = false;
        callGetClientQuotaStatus()
            .then((data) => {
                if (cancelled) return;
                setQuota(data);
                setQuotaError(null);
            })
            .catch((err) => {
                if (cancelled) return;
                setQuotaError(extractErrorMessage(err, 'Nao foi possivel carregar a quota.'));
            })
            .finally(() => {
                if (!cancelled) setQuotaLoading(false);
            });
        return () => { cancelled = true; };
    }, [user, isDemoMode]);

    const navigateToCases = (filter) => {
        if (isDemoMode) return;
        const params = filter ? `?filter=${filter}` : '';
        navigate(`/client/solicitacoes${params}`);
    };

    if (loading) {
        return (
            <PageShell size="default" className="dashboard-cliente" role="status" aria-live="polite" aria-label="Carregando painel">
                <div className="dashboard-cliente__hero" aria-hidden="true">
                    <div>
                        <div className="skeleton" style={{ width: 220, height: 28, marginBottom: 8 }} />
                        <div className="skeleton skeleton--text" style={{ width: 380, marginTop: 4 }} />
                    </div>
                </div>
                <div className="dashboard-cliente__kpis" aria-hidden="true">
                    {Array.from({ length: 4 }, (_, i) => (
                        <div key={i} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div className="skeleton skeleton--text" style={{ width: '50%' }} />
                            <div className="skeleton" style={{ width: 64, height: 32, borderRadius: 6 }} />
                        </div>
                    ))}
                </div>
            </PageShell>
        );
    }

    if (error) {
        return (
            <PageShell size="default" className="dashboard-cliente" role="alert">
                <h2 className="dashboard-cliente__title">Acompanhamento das solicitações</h2>
                <p className="dashboard-cliente__error">{extractErrorMessage(error, 'Não foi possível carregar os dados agora.')}</p>
            </PageShell>
        );
    }

    const actionItems = [
        ...(metrics.corrections > 0 ? [{
            label: 'Aguardando correção',
            count: metrics.corrections,
            tone: 'danger',
            cta: 'Ver solicitações',
            filter: 'correction',
        }] : []),
        ...(metrics.waitingInfo > 0 ? [{
            label: 'Aguardando informações',
            count: metrics.waitingInfo,
            tone: 'warning',
            cta: 'Ver solicitações',
            filter: 'waiting',
        }] : []),
    ];

    return (
        <PageShell size="default" className="dashboard-cliente">
            <PageHeader
                eyebrow="Portal cliente"
                title="Início"
                description="Acompanhe suas solicitações, pendências e análises concluídas."
                metric={{ value: metrics.done, label: 'Concluídos' }}
            />

            {/* Acoes necessarias */}
            {actionItems.length > 0 && (
                <div className="dashboard-cliente__actions">
                    <h3 className="dashboard-cliente__actions-title">Ações necessárias</h3>
                    <div className="dashboard-cliente__actions-list">
                        {actionItems.map((item) => (
                            <div key={item.label} className={`dashboard-cliente__action-item dashboard-cliente__action-item--${item.tone}`}>
                                <div className="dashboard-cliente__action-info">
                                    <span className="dashboard-cliente__action-label">{item.label}</span>
                                    <span className="dashboard-cliente__action-count">{item.count} solicitação{item.count !== 1 ? 'es' : ''}</span>
                                </div>
                                <button
                                    type="button"
                                    className="dashboard-cliente__action-cta"
                                    onClick={() => navigateToCases(item.filter)}
                                >
                                    {item.cta}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="dashboard-cliente__kpis">
                <KpiCard label="Solicitações enviadas" value={metrics.total} color="neutral" />
                <KpiCard label="Concluídas" value={metrics.done} color="green" />
                <KpiCard label="Em análise" value={metrics.inProgress} color="yellow" />
                <KpiCard label="Aguardando início" value={metrics.pending} color="neutral" />

                {metrics.corrections > 0 && (
                    <KpiCard label="Aguardando correção" value={metrics.corrections} color="red" />
                )}
            </div>

            <QuotaSummaryCard quota={quota} loading={quotaLoading} error={quotaError} />

            {metrics.done > 0 && (
                <div className="dashboard-cliente__section">
                    <h3>Resultado das análises</h3>
                    <div className="dashboard-cliente__verdicts">
                        {Object.entries(VERDICT_DISPLAY).map(([key, cfg]) => (
                            <div key={key} className="dashboard-cliente__verdict-chip" style={{ background: cfg.bg, color: cfg.color }}>
                                <span className="dashboard-cliente__verdict-count">{metrics.verdicts[key] || 0}</span>
                                <span className="dashboard-cliente__verdict-label">{cfg.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="dashboard-cliente__section">
                <h3>Evolucao Mensal</h3>
                <div className="dashboard-cliente__chart">
                    {metrics.months.map((month) => (
                        <div key={month.key} className="dashboard-cliente__chart-col">
                            <div className="dashboard-cliente__chart-bars">
                                <div
                                    className="dashboard-cliente__chart-bar dashboard-cliente__chart-bar--total"
                                    style={{ height: `${(month.count / maxMonthCount) * 100}%` }}
                                    title={`${month.count} solicitações enviadas`}
                                />
                                <div
                                    className="dashboard-cliente__chart-bar dashboard-cliente__chart-bar--done"
                                    style={{ height: `${(month.doneCount / maxMonthCount) * 100}%` }}
                                    title={`${month.doneCount} solicitações concluídas`}
                                />
                            </div>
                            <span className="dashboard-cliente__chart-label">{month.label}</span>
                            <span className="dashboard-cliente__chart-value">{month.count}</span>
                        </div>
                    ))}
                </div>
                <div className="dashboard-cliente__chart-legend">
                    <span className="dashboard-cliente__legend-item">
                        <span className="dashboard-cliente__legend-dot dashboard-cliente__legend-dot--total" /> Enviadas
                    </span>
                    <span className="dashboard-cliente__legend-item">
                        <span className="dashboard-cliente__legend-dot dashboard-cliente__legend-dot--done" /> Concluídas
                    </span>
                </div>
            </div>

            {metrics.topFlags.length > 0 && (
                <div className="dashboard-cliente__section">
                    <h3>Principais motivos de atenção</h3>
                    <div className="dashboard-cliente__flags">
                        {metrics.topFlags.map((item) => (
                            <div key={item.label} className="dashboard-cliente__flag-row">
                                <span className="dashboard-cliente__flag-label">{item.label}</span>
                                <span className="dashboard-cliente__flag-count">{item.count} solicitação{item.count !== 1 ? 'es' : ''}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {metrics.recentCompletedCases.length > 0 && (
                <div className="dashboard-cliente__section">
                    <h3>Solicitações concluídas recentemente</h3>
                    <div className="dashboard-cliente__flags">
                        {metrics.recentCompletedCases.map((caseData) => (
                            <div key={caseData.id} className="dashboard-cliente__flag-row">
                                <span className="dashboard-cliente__flag-label">
                                    {caseData.candidateName} · {caseData.candidatePosition}
                                </span>
                                <span className="dashboard-cliente__flag-count">
                                    {formatDate(caseData.concludedAt || caseData.updatedAt)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <p className="dashboard-cliente__recorte" aria-live="polite">
                {cases.length} solicitação(ões) carregada(s). Os indicadores refletem apenas os registros disponíveis no painel.
            </p>
        </PageShell>
    );
}
