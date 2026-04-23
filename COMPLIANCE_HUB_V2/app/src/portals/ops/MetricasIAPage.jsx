import { useEffect, useMemo, useState } from 'react';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { useCases } from '../../hooks/useCases';
import { extractErrorMessage } from '../../core/errorUtils';
import { callGetOpsV2Metrics } from '../../core/firebase/firestoreService';
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

function avgDays(doneCases) {
    const d = doneCases
        .map(c => {
            const s = c.createdAt ? new Date(c.createdAt) : null;
            const e = c.concludedAt ? new Date(c.concludedAt) : (c.updatedAt ? new Date(c.updatedAt) : null);
            return s && e && !isNaN(s) && !isNaN(e) ? (e - s) / 86400000 : null;
        }).filter(v => v !== null && v >= 0);
    return d.length ? (d.reduce((a, b) => a + b, 0) / d.length).toFixed(1) : null;
}

function fmtBRL(v) { return `R$ ${v.toFixed(2)}`; }
function fmtUSD(v) { return `$ ${v.toFixed(4)}`; }
function pct(n, total) { return total > 0 ? Math.round((n / total) * 100) : 0; }

/* ── Component ── */
export default function MetricasIAPage() {
    const { selectedTenantId } = useTenant();
    const tenantOverride = selectedTenantId === ALL_TENANTS_ID ? null : selectedTenantId;
    const { cases, loading, error } = useCases(tenantOverride);
    const [periodDays, setPeriodDays] = useState(30);
    const [v2Metrics, setV2Metrics] = useState(null);
    const [v2MetricsError, setV2MetricsError] = useState(null);
    const showAllTenants = selectedTenantId === ALL_TENANTS_ID;
    const currentMonthKey = new Date().toISOString().slice(0, 7);

    useEffect(() => {
        setV2MetricsError(null);
        callGetOpsV2Metrics({ tenantId: tenantOverride, monthKey: currentMonthKey })
            .then(setV2Metrics)
            .catch((err) => {
                setV2Metrics(null);
                setV2MetricsError(extractErrorMessage(err, 'Nao foi possivel carregar metricas V2.'));
            });
    }, [tenantOverride, currentMonthKey]);

    const m = useMemo(() => {
        const now = Date.now();
        const cutoff = periodDays > 0
            ? new Date(now - periodDays * 86400000).toISOString().slice(0, 10)
            : '0000';
        const pc = cases.filter(c => (c.createdAt || '') >= cutoff);

        /* Volume */
        const done = pc.filter(c => c.status === 'DONE');
        const running = pc.filter(c => c.status !== 'DONE' && c.status !== 'CORRECTION_NEEDED');
        const corrections = pc.filter(c => c.status === 'CORRECTION_NEEDED');

        /* Verdicts */
        const verdicts = { FIT: 0, ATTENTION: 0, NOT_RECOMMENDED: 0, INCONCLUSIVE: 0 };
        for (const c of done) verdicts[c.finalVerdict || 'INCONCLUSIVE']++;

        /* Provider stats */
        const prov = {};
        for (const p of PROVIDERS) {
            const stats = { calls: 0, done: 0, partial: 0, failed: 0, running: 0, costBRL: 0 };
            for (const c of pc) {
                const st = c[p.field];
                if (!st || st === 'SKIPPED') continue;
                stats.calls++;
                if (st === 'DONE') stats.done++;
                else if (st === 'PARTIAL') stats.partial++;
                else if (st === 'FAILED') stats.failed++;
                else if (st === 'RUNNING') stats.running++;
            }
            prov[p.key] = stats;
        }

        /* FonteData cost breakdown (enrichmentSources) */
        let fdTotalBRL = 0;
        const fdPhaseCosts = {};
        for (const c of pc) {
            const src = c.enrichmentSources;
            if (!src) continue;
            for (const [phase, info] of Object.entries(src)) {
                const cost = parseFloat(info?.cost) || 0;
                fdTotalBRL += cost;
                fdPhaseCosts[phase] = (fdPhaseCosts[phase] || 0) + cost;
            }
        }
        prov.fontedata.costBRL = fdTotalBRL;

        /* AI metrics */
        const aiCases = pc.filter(c => c.aiRawResponse || c.aiStructured);
        const structOk = aiCases.filter(c => c.aiStructuredOk === true).length;
        const structFail = aiCases.filter(c => c.aiStructuredOk === false).length;
        const aiErrors = pc.filter(c => c.aiError && !c.aiRawResponse).length;
        const cached = aiCases.filter(c => c.aiFromCache).length;
        const aiCostUSD = aiCases.reduce((s, c) => s + (c.aiCostUsd || 0) + (c.aiHomonymCostUsd || 0), 0);
        const tokIn = aiCases.reduce((s, c) => s + (c.aiTokens?.input || 0), 0);
        const tokOut = aiCases.reduce((s, c) => s + (c.aiTokens?.output || 0), 0);

        /* AI decisions */
        const decisions = { ACCEPTED: 0, ADJUSTED: 0, IGNORED: 0, none: 0 };
        for (const c of aiCases) decisions[c.aiDecision || 'none']++;

        /* Per-tenant */
        const byTenant = {};
        if (showAllTenants) {
            for (const c of pc) {
                const t = c.tenantName || c.tenantId || '?';
                if (!byTenant[t]) byTenant[t] = { total: 0, done: 0, fdCost: 0, aiCost: 0 };
                byTenant[t].total++;
                if (c.status === 'DONE') byTenant[t].done++;
                byTenant[t].aiCost += (c.aiCostUsd || 0) + (c.aiHomonymCostUsd || 0);
                const src = c.enrichmentSources;
                if (src) for (const info of Object.values(src)) byTenant[t].fdCost += parseFloat(info?.cost) || 0;
            }
        }

        return {
            total: pc.length, done: done.length, running: running.length,
            corrections: corrections.length, verdicts, prov,
            fdPhaseCosts: Object.entries(fdPhaseCosts).sort((a, b) => b[1] - a[1]),
            fdTotalBRL,
            ai: { total: aiCases.length, structOk, structFail, errors: aiErrors, cached, costUSD: aiCostUSD, tokIn, tokOut, decisions },
            avgDays: avgDays(done),
            completionRate: pct(done.length, pc.length),
            structuredRate: pct(structOk, aiCases.length),
            cacheRate: pct(cached, aiCases.length),
            reviewRate: pct(decisions.ADJUSTED + decisions.IGNORED, aiCases.length),
            byTenant: Object.entries(byTenant).sort((a, b) => (b[1].fdCost + b[1].aiCost) - (a[1].fdCost + a[1].aiCost)),
        };
    }, [cases, periodDays, showAllTenants]);

    if (loading) return (
        <div className="ops-dash"><h2 className="ops-dash__title">Dashboard Operacional</h2>
            <p className="ops-dash__loading">Carregando dados...</p></div>
    );

    if (error) return (
        <div className="ops-dash"><h2 className="ops-dash__title">Dashboard Operacional</h2>
            <p style={{ color: 'var(--red-600)', padding: '24px 0' }}>{extractErrorMessage(error, 'Nao foi possivel carregar os dados agora.')}</p></div>
    );

    return (
        <div className="ops-dash">
            {/* ── Header ── */}
            <div className="ops-dash__header">
                <h2 className="ops-dash__title">Dashboard Operacional</h2>
                <div className="ops-dash__period-tabs">
                    {PERIOD_OPTIONS.map(o => (
                        <button key={o.value}
                            className={`ops-dash__period-btn${periodDays === o.value ? ' ops-dash__period-btn--active' : ''}`}
                            onClick={() => setPeriodDays(o.value)}>{o.label}</button>
                    ))}
                </div>
            </div>

            {/* ── Row 1: Volume KPIs ── */}
            <div className="ops-dash__kpi-row">
                <Kpi label="Casos" value={m.total} sub="no período" />
                <Kpi label="Concluídos" value={m.done} color="green" sub={`${m.completionRate}%`} />
                <Kpi label="Em andamento" value={m.running} color="yellow" />
                <Kpi label="Correções" value={m.corrections} color={m.corrections > 0 ? 'red' : undefined} />
                <Kpi label="Tempo médio" value={m.avgDays ?? '—'} sub="dias" />
            </div>

            {/* ── Row 2: Verdict chips ── */}
            <Section title="Operacao V2" icon="V2">
                {v2MetricsError && <p className="ops-dash__empty" role="alert">{v2MetricsError}</p>}
                {v2Metrics ? (
                    <div className="ops-dash__chips" data-testid="v2-metrics-panel">
                        <div className="ops-dash__chip ops-dash__chip--blue">
                            <span className="ops-dash__chip-n" data-testid="v2-usage-meters">{v2Metrics.counts?.usageMeters ?? 0}</span>
                            <span className="ops-dash__chip-l">usageMeters</span>
                        </div>
                        <div className="ops-dash__chip ops-dash__chip--green">
                            <span className="ops-dash__chip-n" data-testid="v2-module-runs">{v2Metrics.counts?.moduleRuns ?? 0}</span>
                            <span className="ops-dash__chip-l">moduleRuns</span>
                        </div>
                        <div className="ops-dash__chip ops-dash__chip--red">
                            <span className="ops-dash__chip-n" data-testid="v2-open-divergences">{v2Metrics.counts?.openProviderDivergences ?? 0}</span>
                            <span className="ops-dash__chip-l">divergencias abertas</span>
                        </div>
                        <div className="ops-dash__chip ops-dash__chip--yellow">
                            <span className="ops-dash__chip-n" data-testid="v2-senior-pending">{v2Metrics.counts?.seniorPending ?? 0}</span>
                            <span className="ops-dash__chip-l">senior review</span>
                        </div>
                        <div className="ops-dash__chip ops-dash__chip--gray">
                            <span className="ops-dash__chip-n">{fmtBRL(v2Metrics.usage?.totalInternalCostBrl ?? 0)}</span>
                            <span className="ops-dash__chip-l">custo usageMeters</span>
                        </div>
                    </div>
                ) : (
                    !v2MetricsError && <p className="ops-dash__empty">Carregando metricas V2...</p>
                )}
            </Section>

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
            <h3 className="ops-dash__group-title">Provedores de Dados</h3>
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

                <Section title="IA — Tokens & Custo" icon="🤖">
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
            <Section title="Qualidade da IA" icon="📊">
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
                <Section title="Resumo por Franquia" icon="🏢">
                    <div className="ops-dash__table-wrap">
                        <table className="ops-dash__table">
                            <thead>
                                <tr>
                                    <th>Franquia</th>
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
        </div>
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
