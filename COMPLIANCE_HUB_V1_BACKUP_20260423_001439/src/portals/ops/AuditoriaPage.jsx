import { useMemo, useState } from 'react';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import { extractErrorMessage } from '../../core/errorUtils';
import './AuditoriaPage.css';

const ACTION_LABELS = {
    CASE_CONCLUDED: { label: 'Caso concluido', color: 'var(--green-600)', bg: 'var(--green-50)' },
    CASE_UPDATED: { label: 'Caso atualizado', color: 'var(--blue-600)', bg: 'var(--blue-50)' },
    CASE_ASSIGNED: { label: 'Caso atribuido', color: 'var(--brand-600)', bg: 'var(--brand-50)' },
    CASE_RETURNED: { label: 'Caso devolvido', color: 'var(--red-600)', bg: 'var(--red-50)' },
    CASE_CORRECTED: { label: 'Caso corrigido', color: 'var(--green-600)', bg: 'var(--green-50)' },
    EXPORT_CREATED: { label: 'Exportacao', color: 'var(--gray-600)', bg: 'var(--gray-100)' },
    SOLICITATION_CREATED: { label: 'Nova solicitacao', color: 'var(--yellow-600)', bg: 'var(--yellow-50)' },
    USER_CREATED: { label: 'Usuario criado', color: 'var(--brand-600)', bg: 'var(--brand-50)' },
    TENANT_CONFIG_UPDATED: { label: 'Config atualizada', color: 'var(--brand-600)', bg: 'var(--brand-50)' },
};

export default function AuditoriaPage() {
    const { selectedTenantId } = useTenant();
    const tenantOverride = selectedTenantId === ALL_TENANTS_ID ? null : selectedTenantId;
    const {
        error,
        loading,
        logs,
    } = useAuditLogs(tenantOverride);
    const [actionFilter, setActionFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = useMemo(() => {
        let result = [...logs];

        if (actionFilter !== 'ALL') {
            result = result.filter((log) => log.action === actionFilter);
        }

        if (searchTerm) {
            const normalizedTerm = searchTerm.toLowerCase();
            result = result.filter((log) => (
                (log.user || '').toLowerCase().includes(normalizedTerm)
                || (log.target || '').toLowerCase().includes(normalizedTerm)
                || (log.detail || '').toLowerCase().includes(normalizedTerm)
            ));
        }

        return result;
    }, [actionFilter, logs, searchTerm]);

    return (
        <div className="auditoria-page">
            <div className="auditoria-header">
                <div>
                    <h2 className="auditoria-header__title">Auditoria e Logs</h2>
                    <p className="auditoria-header__subtitle">Registros completos de ações e eventos do sistema</p>
                </div>
                <div className="auditoria-header__badge">
                    <span className="auditoria-header__badge-label">Registros</span>
                    <strong>{filtered.length}</strong>
                </div>
            </div>

            <div className="auditoria-filters">
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
                <select className="filter-bar__select" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} aria-label="Filtrar por acao">
                    <option value="ALL">Todas as acoes</option>
                    <option value="CASE_CONCLUDED">Caso concluido</option>
                    <option value="CASE_UPDATED">Caso atualizado</option>
                    <option value="CASE_ASSIGNED">Caso atribuido</option>
                    <option value="CASE_RETURNED">Caso devolvido</option>
                    <option value="CASE_CORRECTED">Caso corrigido</option>
                    <option value="EXPORT_CREATED">Exportacao</option>
                    <option value="SOLICITATION_CREATED">Nova solicitacao</option>
                    <option value="USER_CREATED">Usuario criado</option>
                    <option value="TENANT_CONFIG_UPDATED">Config atualizada</option>
                </select>
            </div>

            <div className="auditoria-table-wrapper">
                <table className="data-table" aria-label="Logs de auditoria">
                    <thead>
                        <tr>
                            <th className="data-table__th" scope="col">Data/Hora</th>
                            <th className="data-table__th" scope="col">Usuario</th>
                            <th className="data-table__th" scope="col">Acao</th>
                            <th className="data-table__th" scope="col">Alvo</th>
                            <th className="data-table__th" scope="col">Detalhe</th>
                            <th className="data-table__th" scope="col">IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={6} className="data-table__empty" style={{ textAlign: 'center', padding: 48 }}>
                                    Carregando logs...
                                </td>
                            </tr>
                        )}
                        {!loading && error && (
                            <tr>
                                <td colSpan={6} className="data-table__empty" style={{ textAlign: 'center', padding: 48, color: 'var(--red-700)' }}>
                                    {extractErrorMessage(error, 'Nao foi possivel carregar os logs agora.')}
                                </td>
                            </tr>
                        )}
                        {!loading && !error && filtered.map((log) => {
                            const actionInfo = ACTION_LABELS[log.action] || {
                                label: log.action,
                                color: 'var(--text-secondary)',
                                bg: 'var(--gray-50)',
                            };

                            return (
                                <tr key={log.id} className="data-table__row">
                                    <td className="data-table__td data-table__td--mono" style={{ fontSize: '.75rem' }}>{log.timestamp}</td>
                                    <td className="data-table__td" style={{ fontSize: '.8125rem' }}>{log.user}</td>
                                    <td className="data-table__td">
                                        <span className="audit-action-badge" style={{ color: actionInfo.color, background: actionInfo.bg }}>
                                            {actionInfo.label}
                                        </span>
                                    </td>
                                    <td className="data-table__td data-table__td--mono">{log.target}</td>
                                    <td className="data-table__td data-table__td--truncate" style={{ fontSize: '.8125rem' }} title={log.detail}>{log.detail}</td>
                                    <td className="data-table__td data-table__td--mono" style={{ fontSize: '.75rem', color: 'var(--text-tertiary)' }}>{log.ip}</td>
                                </tr>
                            );
                        })}
                        {!loading && !error && filtered.length === 0 && (
                            <tr>
                                <td colSpan={6} className="data-table__empty" style={{ textAlign: 'center', padding: 48 }}>
                                    Nenhum log encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ textAlign: 'right', fontSize: '.8125rem', color: 'var(--text-secondary)' }}>
                {filtered.length} registros
            </div>
        </div>
    );
}
