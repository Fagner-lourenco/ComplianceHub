import { useMemo, useState } from 'react';
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
import FilterPanelMobile from '../../ui/components/FilterPanelMobile/FilterPanelMobile';
import './AuditoriaClientePage.css';

const categoryOptions = getCategoryFilterOptions();

export default function AuditoriaClientePage() {
    const { userProfile } = useAuth();
    const tenantId = userProfile?.tenantId;
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
        return logs.filter((log) => (
            (log.searchText || '').toLowerCase().includes(term)
            || (log.clientSummary || '').toLowerCase().includes(term)
            || (log.detail || '').toLowerCase().includes(term)
        ));
    }, [logs, searchTerm]);

    return (
        <div className="auditoria-cliente-page">
            <div className="auditoria-cliente-header">
                <div>
                    <h2 className="auditoria-cliente-header__title">Histórico de Atividades</h2>
                    <p className="auditoria-cliente-header__subtitle">Registro de ações realizadas na sua conta</p>
                </div>
                <div className="auditoria-cliente-header__badge">
                    <span className="auditoria-cliente-header__badge-label">Registros</span>
                    <strong>{filtered.length}</strong>
                </div>
            </div>

            <FilterPanelMobile
                searchElement={
                    <div className="filter-bar__search" style={{ flex: 1, minWidth: 200 }}>
                        <span className="filter-bar__search-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </span>
                        <input
                            type="text"
                            className="filter-bar__search-input"
                            placeholder="Buscar nos registros..."
                            aria-label="Buscar no historico de atividades"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                }
                activeFilterCount={categoryFilter !== 'ALL' ? 1 : 0}
            >
                <div className="auditoria-cliente-filters">
                    <select className="filter-bar__select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filtrar por categoria">
                        <option value="ALL">Todas as categorias</option>
                        {categoryOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </FilterPanelMobile>

            <MobileDataCardList
                items={filtered}
                loading={loading}
                emptyMessage={error ? extractErrorMessage(error, 'Nao foi possivel carregar o historico.') : 'Nenhum registro encontrado.'}
                renderCard={(log) => {
                    const badge = getActionBadgeStyle(log.action);
                    const catStyle = log.category ? getCategoryColor(log.category) : null;
                    return (
                        <>
                            <div className="mobile-card__header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span className="audit-action-badge" style={{ color: badge.color, background: badge.bg }}>
                                        {getActionLabel(log.action)}
                                    </span>
                                    {catStyle && (
                                        <span className="audit-action-badge" style={{ color: catStyle.color, background: catStyle.bg, fontSize: '.625rem' }}>
                                            {getCategoryLabel(log.category)}
                                        </span>
                                    )}
                                    <span style={{ fontSize: '.75rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono, monospace)' }}>{log.timestamp}</span>
                                </div>
                            </div>
                            {log.clientSummary && (
                                <div className="mobile-card__subtitle">{log.clientSummary}</div>
                            )}
                        </>
                    );
                }}
            >
                <div className="auditoria-cliente-table-wrapper">
                    <table className="data-table" aria-label="Historico de atividades">
                        <thead>
                            <tr>
                                <th className="data-table__th" scope="col">Data/Hora</th>
                                <th className="data-table__th" scope="col">Acao</th>
                                <th className="data-table__th" scope="col">Categoria</th>
                                <th className="data-table__th" scope="col">Descricao</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={4} className="data-table__empty" style={{ textAlign: 'center', padding: 48 }}>
                                        Carregando historico...
                                    </td>
                                </tr>
                            )}
                            {!loading && error && (
                                <tr>
                                    <td colSpan={4} className="data-table__empty" style={{ textAlign: 'center', padding: 48, color: 'var(--red-700)' }}>
                                        {extractErrorMessage(error, 'Nao foi possivel carregar o historico.')}
                                    </td>
                                </tr>
                            )}
                            {!loading && !error && filtered.map((log) => {
                                const badge = getActionBadgeStyle(log.action);
                                const catStyle = log.category ? getCategoryColor(log.category) : null;
                                return (
                                    <tr key={log.id} className="data-table__row">
                                        <td className="data-table__td data-table__td--mono" style={{ fontSize: '.75rem' }}>{log.timestamp}</td>
                                        <td className="data-table__td">
                                            <span className="audit-action-badge" style={{ color: badge.color, background: badge.bg }}>
                                                {getActionLabel(log.action)}
                                            </span>
                                        </td>
                                        <td className="data-table__td">
                                            {catStyle && (
                                                <span className="audit-action-badge" style={{ color: catStyle.color, background: catStyle.bg, fontSize: '.625rem' }}>
                                                    {getCategoryLabel(log.category)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="data-table__td" style={{ fontSize: '.8125rem' }}>{log.clientSummary || log.detail}</td>
                                    </tr>
                                );
                            })}
                            {!loading && !error && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="data-table__empty" style={{ textAlign: 'center', padding: 48 }}>
                                        Nenhum registro encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </MobileDataCardList>

            <div style={{ textAlign: 'right', fontSize: '.8125rem', color: 'var(--text-secondary)' }}>
                {filtered.length} registros
            </div>
        </div>
    );
}
