import { useEffect, useMemo, useState } from 'react';
import KpiCard from '../../ui/components/KpiCard/KpiCard';
import { QuotaSummaryCard } from '../../ui/components/QuotaBar/QuotaBar';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import EmptyState from '../../ui/components/EmptyState/EmptyState';
import { useCases } from '../../hooks/useCases';
import { useAuth } from '../../core/auth/useAuth';
import { formatDate } from '../../core/formatDate';
import { getClientDashboardMetrics } from '../../core/clientPortal';
import { callGetClientQuotaStatus, callGetClientProductCatalog } from '../../core/firebase/firestoreService';
import { extractErrorMessage } from '../../core/errorUtils';
import './DashboardClientePage.css';

const VERDICT_DISPLAY = {
    FIT: { label: 'Apto', color: 'var(--green-600)', bg: 'var(--green-50)' },
    ATTENTION: { label: 'Atencao', color: 'var(--yellow-700)', bg: 'var(--yellow-50)' },
    NOT_RECOMMENDED: { label: 'Nao recomendado', color: 'var(--red-600)', bg: 'var(--red-50)' },
};

function formatTurnaround(hours) {
    if (hours == null) return '—';
    if (hours < 24) return `${hours.toFixed(1)} h`;
    return `${(hours / 24).toFixed(1)} dias`;
}

export default function DashboardClientePage() {
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';
    const clientTenantId = isDemoMode ? undefined : (userProfile?.tenantId ?? undefined);
    const { cases, loading, error } = useCases(clientTenantId);
    const [quota, setQuota] = useState(null);
    const [catalog, setCatalog] = useState(null);

    const metrics = useMemo(() => getClientDashboardMetrics(cases), [cases]);
    const maxMonthCount = metrics.maxMonthCount || 1;

    useEffect(() => {
        if (!user || isDemoMode) return;
        callGetClientQuotaStatus()
            .then((data) => setQuota(data))
            .catch(() => {});
        callGetClientProductCatalog()
            .then((data) => setCatalog(data))
            .catch(() => {});
    }, [user, isDemoMode]);

    if (loading) {
        return (
            <div className="dashboard-cliente">
                <PageHeader eyebrow="Painel" title="Painel de Acompanhamento" />
                <EmptyState variant="loading" title="Carregando dados" message="Consultando casos da sua franquia..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-cliente">
                <PageHeader eyebrow="Painel" title="Painel de Acompanhamento" />
                <EmptyState
                    variant="error"
                    title="Nao foi possivel carregar os dados"
                    message={extractErrorMessage(error, 'Nao foi possivel carregar os dados agora.')}
                />
            </div>
        );
    }

    return (
        <div className="dashboard-cliente">
            <PageHeader
                eyebrow="Painel"
                title="Painel de Acompanhamento"
                subtitle="Visao executiva do pipeline de due diligence com andamento, classificacoes e principais pontos de atencao."
                metrics={[
                    { label: 'Concluidos', value: metrics.done },
                    { label: 'Em andamento', value: metrics.inProgress },
                    { label: 'Relatorios', value: metrics.reportsAvailable },
                ]}
            />

            {catalog && (
                <div className="dashboard-cliente__plan">
                    <div className="dashboard-cliente__plan-head">
                        <span className="dashboard-cliente__plan-eyebrow">Plano contratado</span>
                        <h3 className="dashboard-cliente__plan-title">
                            Tier <strong>{catalog.tenantTier || 'basic'}</strong> · {(catalog.contracted || []).length} produto(s) ativo(s)
                        </h3>
                    </div>
                    {(catalog.contracted || []).length === 0 ? (
                        <p className="dashboard-cliente__plan-empty">
                            Nenhum produto ativo ainda — veja o catalogo comercial para contratar.
                        </p>
                    ) : (
                        <ul className="dashboard-cliente__plan-list">
                            {catalog.contracted.map((product) => (
                                <li key={product.productKey} className="dashboard-cliente__plan-chip">
                                    <strong>{product.commercialName}</strong>
                                    <span>{product.subjectType === 'pj' ? 'PJ' : product.subjectType === 'mixed' ? 'PF/PJ' : 'PF'}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <div className="dashboard-cliente__kpis">
                <KpiCard label="Casos enviados" value={metrics.total} color="neutral" />
                <KpiCard label="Concluidos" value={metrics.done} color="green" />
                <KpiCard label="Em andamento" value={metrics.inProgress} color="yellow" />
                <KpiCard label="Pendentes" value={metrics.pending} color="neutral" />
                <KpiCard label="Relatorios disponiveis" value={metrics.reportsAvailable} color="green" />
                <KpiCard label="Tempo medio" value={formatTurnaround(metrics.avgTurnaroundHours)} color="neutral" />
                {metrics.corrections > 0 && (
                    <KpiCard label="Correcao solicitada" value={metrics.corrections} color="red" />
                )}
            </div>

            <QuotaSummaryCard quota={quota} />

            {metrics.done > 0 && (
                <div className="dashboard-cliente__section">
                    <h3>Resultado das Analises</h3>
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
                                    title={`${month.count} casos enviados`}
                                />
                                <div
                                    className="dashboard-cliente__chart-bar dashboard-cliente__chart-bar--done"
                                    style={{ height: `${(month.doneCount / maxMonthCount) * 100}%` }}
                                    title={`${month.doneCount} casos concluidos`}
                                />
                            </div>
                            <span className="dashboard-cliente__chart-label">{month.label}</span>
                            <span className="dashboard-cliente__chart-value">{month.count}</span>
                        </div>
                    ))}
                </div>
                <div className="dashboard-cliente__chart-legend">
                    <span className="dashboard-cliente__legend-item">
                        <span className="dashboard-cliente__legend-dot dashboard-cliente__legend-dot--total" /> Enviados
                    </span>
                    <span className="dashboard-cliente__legend-item">
                        <span className="dashboard-cliente__legend-dot dashboard-cliente__legend-dot--done" /> Concluidos
                    </span>
                </div>
            </div>

            {metrics.topFlags.length > 0 && (
                <div className="dashboard-cliente__section">
                    <h3>Principais Motivos de Atencao</h3>
                    <div className="dashboard-cliente__flags">
                        {metrics.topFlags.map((item) => (
                            <div key={item.label} className="dashboard-cliente__flag-row">
                                <span className="dashboard-cliente__flag-label">{item.label}</span>
                                <span className="dashboard-cliente__flag-count">{item.count} caso{item.count !== 1 ? 's' : ''}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {metrics.recentCompletedCases.length > 0 && (
                <div className="dashboard-cliente__section">
                    <h3>Casos Concluidos Recentemente</h3>
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
        </div>
    );
}
