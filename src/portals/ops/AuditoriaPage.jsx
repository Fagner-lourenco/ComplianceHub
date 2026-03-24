import { useState, useMemo } from 'react';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import './AuditoriaPage.css';

const ACTION_LABELS = {
    CASE_CONCLUDED: { label: 'Caso Concluído', color: 'var(--green-600)', bg: 'var(--green-50)' },
    CASE_UPDATED: { label: 'Caso Atualizado', color: 'var(--blue-600)', bg: 'var(--blue-50)' },
    CASE_ASSIGNED: { label: 'Caso Atribuído', color: 'var(--brand-600)', bg: 'var(--brand-50)' },
    EXPORT_CREATED: { label: 'Exportação', color: 'var(--gray-600)', bg: 'var(--gray-100)' },
    SOLICITATION_CREATED: { label: 'Nova Solicitação', color: 'var(--yellow-600)', bg: 'var(--yellow-50)' },
    USER_CREATED: { label: 'Usuário Criado', color: 'var(--brand-600)', bg: 'var(--brand-50)' },
};

export default function AuditoriaPage() {
    const { logs } = useAuditLogs(null);   // null = all tenants (ops)
    const [actionFilter, setActionFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const filtered = useMemo(() => {
        let result = [...logs];
        if (actionFilter !== 'ALL') result = result.filter(l => l.action === actionFilter);
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(l =>
                l.user.toLowerCase().includes(term) ||
                l.target.toLowerCase().includes(term) ||
                l.detail.toLowerCase().includes(term)
            );
        }
        return result;
    }, [logs, actionFilter, searchTerm]);

    return (
        <div className="auditoria-page">
            <h2>Auditoria & Logs</h2>

            <div className="auditoria-filters">
                <div className="filter-bar__search" style={{ flex: 1, minWidth: 200 }}>
                    <span className="filter-bar__search-icon">🔍</span>
                    <input
                        type="text"
                        className="filter-bar__search-input"
                        placeholder="Buscar por usuário, alvo ou detalhe..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <select className="filter-bar__select" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
                    <option value="ALL">Todas as ações</option>
                    <option value="CASE_CONCLUDED">Caso Concluído</option>
                    <option value="CASE_UPDATED">Caso Atualizado</option>
                    <option value="CASE_ASSIGNED">Caso Atribuído</option>
                    <option value="EXPORT_CREATED">Exportação</option>
                    <option value="SOLICITATION_CREATED">Nova Solicitação</option>
                    <option value="USER_CREATED">Usuário Criado</option>
                </select>
            </div>

            <div className="auditoria-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th className="data-table__th">Data/Hora</th>
                            <th className="data-table__th">Usuário</th>
                            <th className="data-table__th">Ação</th>
                            <th className="data-table__th">Alvo</th>
                            <th className="data-table__th">Detalhe</th>
                            <th className="data-table__th">IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(log => {
                            const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'var(--text-secondary)', bg: 'var(--gray-50)' };
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
                                    <td className="data-table__td" style={{ fontSize: '.8125rem', maxWidth: 300 }}>{log.detail}</td>
                                    <td className="data-table__td data-table__td--mono" style={{ fontSize: '.75rem', color: 'var(--text-tertiary)' }}>{log.ip}</td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
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
