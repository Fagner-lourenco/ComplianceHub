import { useEffect, useState } from 'react';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { extractErrorMessage } from '../../core/errorUtils';
import { callGetOpsCaseMetrics } from '../../core/firebase/firestoreService';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import './MetricasIAPage.css';

/* ── Constants ── */
const VERDICT_CFG = [
    { key: 'FIT', label: 'Apto', cls: 'green' },
    { key: 'ATTENTION', label: 'Atenção', cls: 'yellow' },
    { key: 'NOT_RECOMMENDED', label: 'Não recomendado', cls: 'red' },
    { key: 'INCONCLUSIVE', label: 'Inconclusivo', cls: 'blue' },
];

const PROVIDERS = [
    { key: 'judit', label: 'Judit', field: 'juditEnrichmentStatus' },
    { key: 'escavador', label: 'Escavador', field: 'escavadorEnrichmentStatus' },
    { key: 'fontedata', label: 'FonteData', field: 'enrichmentStatus' },
    { key: 'bigdatacorp', label: 'BigDataCorp', field: 'bigdatacorpEnrichmentStatus' },
    { key: 'djen', label: 'DJEN', field: 'djenEnrichmentStatus' },
];

const PERIOD_OPTIONS = [
    { value: 7, label: '7 dias' },
    { value: 30, label: '30 dias' },
    { value: 90, label: '90 dias' },
    { value: 365, label: '1 ano' },
    { value: 0, label: 'Tudo' },
];

function fmtBRL(v) { return `R$ ${v.toFixed(2)}`; }
function fmtUSD(v) { return `$ ${v.toFixed(4)}`; }
function pct(n, total) { return total > 0 ? Math.round((n / total) * 100) : 0; }

const EMPTY_METRICS = {
    total: 0,
    done: 0,
    running: 0,
    corrections: 0,
    verdicts: { FIT: 0, ATTENTION: 0, NOT_RECOMMENDED: 0, INCONCLUSIVE: 0 },
    prov: PROVIDERS.reduce((acc, provider) => ({ ...acc, [provider.key]: { calls: 0, done: 0, partial: 0, failed: 0, running: 0, costBRL: 0 } }), {}),
    fdPhaseCosts: [],
    fdTotalBRL: 0,
    ai: { total: 0, structOk: 0, structFail: 0, errors: 0, cached: 0, costUSD: 0, tokIn: 0, tokOut: 0, decisions: { ACCEPTED: 0, ADJUSTED: 0, IGNORED: 0, none: 0 } },
    avgDays: null,
    completionRate: 0,
    structuredRate: 0,
    cacheRate: 0,
    reviewRate: 0,
    byTenant: [],
    meta: null,
};

/* ── Component ── */
export default function MetricasIAPage() {
    const { selectedTenantId } = useTenant();
    const tenantOverride = selectedTenantId === ALL_TENANTS_ID ? null : selectedTenantId;
    const [periodDays, setPeriodDays] = useState(30);
    const [state, setState] = useState({ metrics: EMPTY_METRICS, loading: true, error: null });
    const showAllTenants = selectedTenantId === ALL_TENANTS_ID;

    useEffect(() => {
        let cancelled = false;
        Promise.resolve().then(() => {
            if (!cancelled) setState((current) => ({ ...current, loading: true, error: null }));
        });
        callGetOpsCaseMetrics({ tenantId: tenantOverride, periodDays })
            .then((metrics) => {
                if (!cancelled) setState({ metrics: { ...EMPTY_METRICS, ...metrics }, loading: false, error: null });
            })
            .catch((currentError) => {
                if (!cancelled) setState({ metrics: EMPTY_METRICS, loading: false, error: currentError });
            });
        return () => { cancelled = true; };
    }, [tenantOverride, periodDays]);

    const { metrics: m, loading, error } = state;

    if (loading) return (
        <PageShell size="default" className="ops-dash" role="status" aria-live="polite" aria-label="Carregando metricas de IA">
            <p className="ops-dash__loading" aria-busy="true">Carregando dados...</p>
        </PageShell>
    );

    if (error) return (
        <PageShell size="default" className="ops-dash" role="alert">
            <p style={{ color: 'var(--red-600)', padding: '24px 0' }}>{extractErrorMessage(error, 'Nao foi possivel carregar os dados agora.')}</p>
        </PageShell>
    );

    return (
        <PageShell size="default" className="ops-dash">
            <PageHeader
                eyebrow="Qualidade da análise"
                title="Métricas da análise automática"
                description="Acompanhe desempenho, divergências e pontos de atenção da análise automática."
                actions={
                    <div className="ops-dash__period-tabs">
                        {PERIOD_OPTIONS.map(o => (
                            <button key={o.value}
                                className={`ops-dash__period-btn${periodDays === o.value ? ' ops-dash__period-btn--active' : ''}`}
                                onClick={() => setPeriodDays(o.value)}>{o.label}</button>
                        ))}
                    </div>
                }
            />

            {/* ── Row 1: Volume KPIs ── */}
            <div className="ops-dash__kpi-row">
                <Kpi label="Casos" value={m.total} sub="no período" />
                <Kpi label="Concluídos" value={m.done} color="green" sub={`${m.completionRate}%`} />
                <Kpi label="Em andamento" value={m.running} color="yellow" />
                <Kpi label="Correções" value={m.corrections} color={m.corrections > 0 ? 'red' : undefined} />
                <Kpi label="Tempo médio" value={m.avgDays ?? '—'} sub="dias" />
            </div>

            {/* ── Row 2: Verdict chips ── */}
            <Section title="Classificação Final" icon="⚖">
                <div className="ops-dash__chips">
                    {VERDICT_CFG.map(v => (
                        <div key={v.key} className={`ops-dash__chip ops-dash__chip--${v.cls}`}>
                            <span className="ops-dash__chip-n">{m.verdicts[v.key]}</span>
                            <span className="ops-dash__chip-l">{v.label}</span>
                        </div>
                    ))}
                </div>
            </Section>

            {/* ── Row 3: Providers 3-col ── */}
            <h3 className="ops-dash__group-title">Fontes de Dados</h3>
            <div className="ops-dash__grid-3">
                {PROVIDERS.map(p => {
                    const s = m.prov[p.key];
                    const successRate = pct(s.done + s.partial, s.calls);
                    return (
                        <div key={p.key} className="ops-dash__card">
                            <div className="ops-dash__card-head">
                                <span className="ops-dash__card-icon">{p.label[0]}</span>
                                <span className="ops-dash__card-title">{p.label}</span>
                            </div>
                            <div className="ops-dash__card-big">{s.calls}<span className="ops-dash__card-unit">chamadas</span></div>
                            <div className="ops-dash__mini-bar">
                                <div className="ops-dash__mini-fill ops-dash__mini-fill--green" style={{ width: `${pct(s.done, s.calls)}%` }} title={`Done ${s.done}`} />
                                <div className="ops-dash__mini-fill ops-dash__mini-fill--yellow" style={{ width: `${pct(s.partial, s.calls)}%` }} title={`Partial ${s.partial}`} />
                                <div className="ops-dash__mini-fill ops-dash__mini-fill--red" style={{ width: `${pct(s.failed, s.calls)}%` }} title={`Failed ${s.failed}`} />
                            </div>
                            <div className="ops-dash__card-stats">
                                <span className="ops-dash__tag ops-dash__tag--green">✓ {s.done}</span>
                                {s.partial > 0 && <span className="ops-dash__tag ops-dash__tag--yellow">~ {s.partial}</span>}
                                {s.failed > 0 && <span className="ops-dash__tag ops-dash__tag--red">✗ {s.failed}</span>}
                                {s.running > 0 && <span className="ops-dash__tag ops-dash__tag--blue">⟳ {s.running}</span>}
                            </div>
                            <div className="ops-dash__card-foot">{successRate}% sucesso</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Row 4: Custo APIs (FonteData breakdown + AI) ── */}
            <h3 className="ops-dash__group-title">Consumo & Custos</h3>
            {m.meta?.source === 'server' && (
                <p className="ops-dash__empty">Métricas calculadas no servidor sobre {m.meta.scannedRecords} registro(s).</p>
            )}
            <div className="ops-dash__grid-2">
                <Section title="FonteData — Custo por Fase" icon="R$">
                    <div className="ops-dash__cost-total">{fmtBRL(m.fdTotalBRL)}</div>
                    <div className="ops-dash__cost-list">
                        {m.fdPhaseCosts.map(([phase, cost]) => (
                            <div key={phase} className="ops-dash__cost-row">
                                <span className="ops-dash__cost-phase">{phase}</span>
                                <div className="ops-dash__cost-bar-wrap">
                                    <div className="ops-dash__cost-bar" style={{ width: `${m.fdTotalBRL > 0 ? (cost / m.fdTotalBRL) * 100 : 0}%` }} />
                                </div>
                                <span className="ops-dash__cost-val">{fmtBRL(cost)}</span>
                            </div>
                        ))}
                        {m.fdPhaseCosts.length === 0 && <p className="ops-dash__empty">Sem dados de custo FonteData.</p>}
                    </div>
                </Section>

                <Section title="Análise Automática — Tokens & Custo" icon="🤖">
                    <div className="ops-dash__cost-total">{fmtUSD(m.ai.costUSD)}</div>
                    <div className="ops-dash__token-grid">
                        <TokenStat label="Input" value={m.ai.tokIn} />
                        <TokenStat label="Output" value={m.ai.tokOut} />
                        <TokenStat label="Total" value={m.ai.tokIn + m.ai.tokOut} bold />
                        <TokenStat label="Chamadas" value={m.ai.total} />
                        <TokenStat label="Cache hits" value={m.ai.cached} sub={`${m.cacheRate}%`} />
                        <TokenStat label="Erros" value={m.ai.errors} red={m.ai.errors > 0} />
                    </div>
                </Section>
            </div>

            {/* ── Row 5: AI Quality bars ── */}
            <Section title="Qualidade da Análise Automática" icon="📊">
                <div className="ops-dash__bars">
                    <QualityBar label="JSON Estruturado" value={m.ai.structOk} total={m.ai.total} color="green" />
                    <QualityBar label="Texto (fallback)" value={m.ai.structFail} total={m.ai.total} color="yellow" />
                    <QualityBar label="Cache hit rate" value={m.ai.cached} total={m.ai.total} color="green" />
                    <QualityBar label="Revisão manual" value={m.ai.decisions.ADJUSTED + m.ai.decisions.IGNORED} total={m.ai.total} color="red" />
                </div>
            </Section>

            {/* ── Row 6: AI Decisions ── */}
            <Section title="Decisões do Analista" icon="👤">
                <div className="ops-dash__chips">
                    <div className="ops-dash__chip ops-dash__chip--green">
                        <span className="ops-dash__chip-n">{m.ai.decisions.ACCEPTED}</span>
                        <span className="ops-dash__chip-l">Aceitas</span>
                    </div>
                    <div className="ops-dash__chip ops-dash__chip--yellow">
                        <span className="ops-dash__chip-n">{m.ai.decisions.ADJUSTED}</span>
                        <span className="ops-dash__chip-l">Ajustadas</span>
                    </div>
                    <div className="ops-dash__chip ops-dash__chip--red">
                        <span className="ops-dash__chip-n">{m.ai.decisions.IGNORED}</span>
                        <span className="ops-dash__chip-l">Ignoradas</span>
                    </div>
                    <div className="ops-dash__chip ops-dash__chip--gray">
                        <span className="ops-dash__chip-n">{m.ai.decisions.none}</span>
                        <span className="ops-dash__chip-l">Sem decisão</span>
                    </div>
                </div>
            </Section>

            {/* ── Row 7: Per-Tenant Table ── */}
            {showAllTenants && m.byTenant.length > 0 && (
                <Section title="Resumo por Empresa" icon="🏢">
                    <div className="ops-dash__table-wrap">
                        <table className="ops-dash__table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Casos</th>
                                    <th>Concluídos</th>
                                    <th>Custo FD (BRL)</th>
                                    <th>Custo IA (USD)</th>
                                    <th>Custos Consolidados</th>
                                </tr>
                            </thead>
                            <tbody>
                                {m.byTenant.map(([name, d]) => (
                                    <tr key={name}>
                                        <td className="ops-dash__td-name">{name}</td>
                                        <td>{d.total}</td>
                                        <td>{d.done}</td>
                                        <td>{fmtBRL(d.fdCost)}</td>
                                        <td>{fmtUSD(d.aiCost)}</td>
                                        <td className="ops-dash__td-total">{`${fmtBRL(d.fdCost)} + ${fmtUSD(d.aiCost)}`}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
            )}
        </PageShell>
    );
}

/* ── Sub-components ── */
function Kpi({ label, value, color, sub }) {
    return (
        <div className={`ops-dash__kpi${color ? ` ops-dash__kpi--${color}` : ''}`}>
            <div className="ops-dash__kpi-val">{value}</div>
            <div className="ops-dash__kpi-label">{label}</div>
            {sub && <div className="ops-dash__kpi-sub">{sub}</div>}
        </div>
    );
}

function Section({ title, icon, children }) {
    return (
        <div className="ops-dash__section">
            <h3 className="ops-dash__section-title">{icon && <span className="ops-dash__section-icon">{icon}</span>}{title}</h3>
            {children}
        </div>
    );
}

function TokenStat({ label, value, bold, sub, red }) {
    return (
        <div className="ops-dash__tok">
            <span className="ops-dash__tok-label">{label}</span>
            <span className={`ops-dash__tok-val${bold ? ' ops-dash__tok-val--bold' : ''}${red ? ' ops-dash__tok-val--red' : ''}`}>
                {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
            </span>
            {sub && <span className="ops-dash__tok-sub">{sub}</span>}
        </div>
    );
}

function QualityBar({ label, value, total, color }) {
    const p = pct(value, total);
    return (
        <div className="ops-dash__qbar">
            <span className="ops-dash__qbar-label">{label}</span>
            <div className="ops-dash__qbar-track">
                <div className={`ops-dash__qbar-fill ops-dash__qbar-fill--${color}`} style={{ width: `${p}%` }} />
            </div>
            <span className="ops-dash__qbar-val">{value} <small>({p}%)</small></span>
        </div>
    );
}
