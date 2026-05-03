import { useMemo, useState } from 'react';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import { extractErrorMessage } from '../../core/errorUtils';
import {
    getActionLabel,
    getActionBadgeStyle,
    getActionFilterOptions,
    getCategoryFilterOptions,
    getCategoryLabel,
    getCategoryColor,
} from '../../core/audit/auditCatalog';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import FilterPanelMobile from '../../ui/components/FilterPanelMobile/FilterPanelMobile';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import './AuditoriaPage.css';

const actionOptions = getActionFilterOptions();
const categoryOptions = getCategoryFilterOptions();

export default function AuditoriaPage() {
    const { selectedTenantId } = useTenant();
    const tenantOverride = selectedTenantId === ALL_TENANTS_ID ? null : selectedTenantId;
    const {
        error,
        loading,
        logs,
    } = useAuditLogs(tenantOverride);
    const [actionFilter, setActionFilter] = useState('ALL');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = useMemo(() => {
        let result = [...logs];

        if (actionFilter !== 'ALL') {
            result = result.filter((log) => log.action === actionFilter);
        }

        if (categoryFilter !== 'ALL') {
            result = result.filter((log) => log.category === categoryFilter);
        }

        if (searchTerm) {
            const normalizedTerm = searchTerm.toLowerCase();
            result = result.filter((log) => (
                (log.searchText || '').toLowerCase().includes(normalizedTerm)
                || (log.user || '').toLowerCase().includes(normalizedTerm)
                || (log.target || '').toLowerCase().includes(normalizedTerm)
                || (log.detail || '').toLowerCase().includes(normalizedTerm)
            ));
        }

        return result;
    }, [actionFilter, categoryFilter, logs, searchTerm]);

    return (
        <PageShell size="default" className="auditoria-page">
            <PageHeader
                eyebrow="Histórico"
                title="Auditoria operacional"
                description="Acompanhe ações relevantes executadas no sistema."
            />

            <FilterPanelMobile
                searchElement={
                    <div className="filter-bar__search" style={{ flex: 1, minWidth: 200 }}>
                        <span className="filter-bar__search-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </span>
                        <input
                            type="text"
                            className="filter-bar__search-input"
                            placeholder="Buscar por usuario, alvo ou detalhe..."
                            aria-label="Buscar nos logs de auditoria"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                }
                activeFilterCount={(actionFilter !== 'ALL' ? 1 : 0) + (categoryFilter !== 'ALL' ? 1 : 0)}
            >
                <div className="auditoria-filters">
                    <select className="filter-bar__select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar por categoria">
                        <option value="ALL">Todas as categorias</option>
                        {categoryOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <select className="filter-bar__select" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} aria-label="Filtrar por acao">
                        <option value="ALL">Todas as acoes</option>
                        {actionOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </FilterPanelMobile>

            <MobileDataCardList
                items={filtered}
                loading={loading}
                emptyMessage={error ? extractErrorMessage(error, 'Nao foi possivel carregar os logs agora.') : 'Nenhum log encontrado.'}
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
                            <div className="mobile-card__meta">
                                <span className="mobile-card__meta-item">👤 {log.user}</span>
                                <span className="mobile-card__meta-item" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '.75rem' }}>🎯 {log.target}</span>
                            </div>
                            {log.detail && (
                                <div className="mobile-card__subtitle">{log.detail}</div>
                            )}
                            {log.ip && (
                                <div style={{ fontSize: '.6875rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono, monospace)', marginTop: 4 }}>IP: {log.ip}</div>
                            )}
                        </>
                    );
                }}
            >
                <div className="auditoria-table-wrapper">
                    <table className="data-table" aria-label="Logs de auditoria">
                        <thead>
                            <tr>
                                <th className="data-table__th" scope="col">Data/Hora</th>
                                <th className="data-table__th" scope="col">Usuario</th>
                                <th className="data-table__th" scope="col">Acao</th>
                                <th className="data-table__th" scope="col">Categoria</th>
                                <th className="data-table__th" scope="col">Alvo</th>
                                <th className="data-table__th" scope="col">Detalhe</th>
                                <th className="data-table__th" scope="col">IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={7} className="data-table__empty" style={{ textAlign: 'center', padding: 48 }}>
                                        Carregando logs...
                                    </td>
                                </tr>
                            )}
                            {!loading && error && (
                                <tr>
                                    <td colSpan={7} className="data-table__empty" style={{ textAlign: 'center', padding: 48, color: 'var(--red-700)' }}>
                                        {extractErrorMessage(error, 'Nao foi possivel carregar os logs agora.')}
                                    </td>
                                </tr>
                            )}
                            {!loading && !error && filtered.map((log) => {
                                const badge = getActionBadgeStyle(log.action);
                                const catStyle = log.category ? getCategoryColor(log.category) : null;

                                return (
                                    <tr key={log.id} className="data-table__row">
                                        <td className="data-table__td data-table__td--mono" style={{ fontSize: '.75rem' }}>{log.timestamp}</td>
                                        <td className="data-table__td" style={{ fontSize: '.8125rem' }}>{log.user}</td>
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
                                        <td className="data-table__td data-table__td--mono">{log.target}</td>
                                        <td className="data-table__td data-table__td--truncate" style={{ fontSize: '.8125rem' }} title={log.detail}>{log.detail}</td>
                                        <td className="data-table__td data-table__td--mono" style={{ fontSize: '.75rem', color: 'var(--text-tertiary)' }}>{log.ip}</td>
                                    </tr>
                                );
                            })}
                            {!loading && !error && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="data-table__empty" style={{ textAlign: 'center', padding: 48 }}>
                                        Nenhum log encontrado.
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
        </PageShell>
    );
}
