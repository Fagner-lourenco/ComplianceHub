import { useMemo, useState } from 'react';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import { useAuth } from '../../core/auth/useAuth';
import { useTenantAuditLogs } from '../../hooks/useTenantAuditLogs';
import { extractErrorMessage } from '../../core/errorUtils';
import {
    getActionLabel,
    getActionBadgeStyle,
    getCategoryFilterOptions,
    getCategoryLabel,
    getCategoryColor,
} from '../../core/audit/auditCatalog';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import './AuditoriaClientePage.css';

const categoryOptions = getCategoryFilterOptions();
const LOADED_LOG_LIMIT = 200;

function getActorLabel(actor, fallbackUser) {
    return actor?.displayName || actor?.email || fallbackUser || 'Sistema';
}

function getActorDetail(actor) {
    if (!actor?.email || actor.email === actor.displayName) return null;
    return actor.email;
}

function getEntityLabel(entity, fallbackTarget) {
    return entity?.label || entity?.id || fallbackTarget || 'Sem alvo informado';
}

function getEntityDetail(entity) {
    const parts = [entity?.type, entity?.id].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
}

function getEventId(log) {
    return log.eventId || log.id;
}

function getErrorMessage(error) {
    const message = extractErrorMessage(error, 'Não foi possível carregar o histórico.');
    if (/permission|permiss/i.test(message)) {
        return 'Você não tem permissão para visualizar o histórico desta empresa.';
    }
    return message;
}

export default function AuditoriaClientePage() {
    const { userProfile } = useAuth();
    const tenantId = userProfile?.tenantId;
    const tenantName = userProfile?.tenantName || 'Empresa atual';
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const {
        logs,
        loading,
        error,
    } = useTenantAuditLogs(tenantId, categoryFilter !== 'ALL' ? categoryFilter : null);

    const filtered = useMemo(() => {
        if (!searchTerm) return logs;
        const term = searchTerm.toLowerCase();
        return logs.filter((log) => {
            const actorLabel = getActorLabel(log.actor, log.user);
            const entityLabel = getEntityLabel(log.entity, log.target);
            const eventId = getEventId(log);
            return (
                (log.searchText || '').toLowerCase().includes(term)
                || (log.clientSummary || '').toLowerCase().includes(term)
                || (log.summary || '').toLowerCase().includes(term)
                || actorLabel.toLowerCase().includes(term)
                || entityLabel.toLowerCase().includes(term)
                || String(eventId || '').toLowerCase().includes(term)
            );
        });
    }, [logs, searchTerm]);

    const hasFilters = categoryFilter !== 'ALL' || Boolean(searchTerm);
    const visibleCountLabel = hasFilters ? `${filtered.length} de ${logs.length}` : String(filtered.length);

    return (
        <PageShell size="default" className="auditoria-cliente-page">
            <PageHeader
                eyebrow="Histórico"
                title="Atividades da empresa"
                description={`Acompanhe os principais registros de acesso e ações realizadas por ${tenantName}.`}
                metric={{ value: visibleCountLabel, label: 'Registros carregados' }}
            />

            <div className="auditoria-cliente-filters" aria-label="Filtros da auditoria">
                <div className="filter-bar__search auditoria-cliente-search">
                    <span className="filter-bar__search-icon" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    </span>
                    <input
                        id="auditoria-cliente-search"
                        type="text"
                        className="filter-bar__search-input"
                        placeholder="Buscar nos registros carregados..."
                        aria-label="Buscar nos registros de auditoria carregados"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <label className="auditoria-cliente-filter">
                    <span>Categoria</span>
                    <select className="filter-bar__select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                        <option value="ALL">Todas as categorias</option>
                        {categoryOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="auditoria-cliente-scope" role="note">
                A busca e os filtros atuam sobre os {LOADED_LOG_LIMIT} eventos mais recentes carregados para esta empresa.
                Detalhes internos não são exibidos nesta visão.
            </div>

            <MobileDataCardList
                items={filtered}
                loading={loading}
                emptyMessage={error ? getErrorMessage(error) : 'Nenhum registro encontrado nos eventos carregados.'}
                renderCard={(log) => {
                    const badge = getActionBadgeStyle(log.action);
                    const catStyle = log.category ? getCategoryColor(log.category) : null;
                    const actor = getActorLabel(log.actor, log.user);
                    const entity = getEntityLabel(log.entity, log.target);
                    return (
                        <article className="auditoria-ledger-card">
                            <div className="auditoria-ledger-card__top">
                                <span className="audit-action-badge" style={{ color: badge.color, background: badge.bg }}>
                                    {getActionLabel(log.action)}
                                </span>
                                {catStyle && (
                                    <span className="audit-action-badge" style={{ color: catStyle.color, background: catStyle.bg }}>
                                        {getCategoryLabel(log.category)}
                                    </span>
                                )}
                                <span className="auditoria-ledger-card__time">{log.timestamp}</span>
                            </div>
                            <dl className="auditoria-ledger-card__grid">
                                <div><dt>Responsável</dt><dd>{actor}</dd></div>
                                <div><dt>Alvo</dt><dd>{entity}</dd></div>
                                <div><dt>Detalhe</dt><dd>{log.clientSummary || log.summary || 'Evento registrado.'}</dd></div>
                                <div><dt>ID do evento</dt><dd className="auditoria-event-id">{getEventId(log)}</dd></div>
                            </dl>
                        </article>
                    );
                }}
            >
                <div className="auditoria-cliente-table-wrapper">
                    <table className="data-table auditoria-ledger-table" aria-label="Histórico de atividades da empresa">
                        <thead>
                            <tr>
                                <th className="data-table__th" scope="col">Data/Hora</th>
                                <th className="data-table__th" scope="col">Responsável</th>
                                <th className="data-table__th" scope="col">Ação</th>
                                <th className="data-table__th" scope="col">Alvo</th>
                                <th className="data-table__th" scope="col">Detalhe</th>
                                <th className="data-table__th" scope="col">ID do evento</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && Array.from({ length: 4 }, (_, i) => (
                                <tr key={`sk-${i}`} aria-hidden="true">
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 72 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: `${50 + (i % 3) * 15}%` }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 80 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 64 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 60 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 90 }} /></td>
                                </tr>
                            ))}
                            {!loading && error && (
                                <tr>
                                    <td colSpan={6} className="data-table__empty auditoria-cliente-error">
                                        {getErrorMessage(error)}
                                    </td>
                                </tr>
                            )}
                            {!loading && !error && filtered.map((log) => {
                                const badge = getActionBadgeStyle(log.action);
                                const catStyle = log.category ? getCategoryColor(log.category) : null;
                                const actor = getActorLabel(log.actor, log.user);
                                const actorDetail = getActorDetail(log.actor);
                                const entity = getEntityLabel(log.entity, log.target);
                                const entityDetail = getEntityDetail(log.entity);
                                return (
                                    <tr key={log.id} className="data-table__row">
                                        <td className="data-table__td data-table__td--mono">{log.timestamp}</td>
                                        <td className="data-table__td">
                                            <div className="auditoria-person">
                                                <strong>{actor}</strong>
                                                {actorDetail && <span>{actorDetail}</span>}
                                            </div>
                                        </td>
                                        <td className="data-table__td">
                                            <div className="auditoria-action-stack">
                                                <span className="audit-action-badge" style={{ color: badge.color, background: badge.bg }}>
                                                    {getActionLabel(log.action)}
                                                </span>
                                                {catStyle && (
                                                    <span className="audit-action-badge auditoria-category-badge" style={{ color: catStyle.color, background: catStyle.bg }}>
                                                        {getCategoryLabel(log.category)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="data-table__td">
                                            <div className="auditoria-target">
                                                <strong>{entity}</strong>
                                                {entityDetail && <span>{entityDetail}</span>}
                                            </div>
                                        </td>
                                        <td className="data-table__td auditoria-detail">{log.clientSummary || log.summary || 'Evento registrado.'}</td>
                                        <td className="data-table__td data-table__td--mono auditoria-event-id">{getEventId(log)}</td>
                                    </tr>
                                );
                            })}
                            {!loading && !error && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="data-table__empty">
                                        {hasFilters ? 'Nenhum evento encontrado nos registros carregados.' : 'Nenhum registro de auditoria disponível.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </MobileDataCardList>

            <div className="auditoria-cliente-footer">
                Mostrando registros carregados. Eventos sensíveis permanecem restritos à auditoria operacional.
            </div>
        </PageShell>
    );
}
