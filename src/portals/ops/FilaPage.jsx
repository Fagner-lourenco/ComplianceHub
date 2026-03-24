import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import KpiCard from '../../ui/components/KpiCard/KpiCard';
import { useCases } from '../../hooks/useCases';
import './FilaPage.css';

export default function FilaPage() {
    const navigate = useNavigate();
    const { cases } = useCases(null);   // null = all tenants (ops portal)
    const [filter, setFilter] = useState('ALL');
    const [assignment, setAssignment] = useState('ALL');

    const queue = useMemo(() => {
        let result = cases.filter(c => c.status !== 'DONE');
        if (filter !== 'ALL') result = result.filter(c => c.status === filter);
        if (assignment === 'UNASSIGNED') result = result.filter(c => !c.assigneeId);
        if (assignment === 'MINE') result = result.filter(c => c.assigneeId === 'analyst1');
        return result;
    }, [cases, filter, assignment]);

    const stats = {
        pending: cases.filter(c => c.status === 'PENDING').length,
        inProgress: cases.filter(c => c.status === 'IN_PROGRESS').length,
        waiting: cases.filter(c => c.status === 'WAITING_INFO').length,
    };

    return (
        <div className="fila-page">
            <div className="fila-page__kpis">
                <KpiCard label="Pendentes" value={stats.pending} color="yellow" onClick={() => setFilter('PENDING')} />
                <KpiCard label="Em Análise" value={stats.inProgress} color="blue" onClick={() => setFilter('IN_PROGRESS')} />
                <KpiCard label="Aguardando Info" value={stats.waiting} color="neutral" onClick={() => setFilter('WAITING_INFO')} />
            </div>

            <div className="fila-page__filters">
                <select className="fila-filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
                    <option value="ALL">Todos os status</option>
                    <option value="PENDING">Pendente</option>
                    <option value="IN_PROGRESS">Em Análise</option>
                    <option value="WAITING_INFO">Aguardando Info</option>
                </select>
                <select className="fila-filter-select" value={assignment} onChange={e => setAssignment(e.target.value)}>
                    <option value="ALL">Todos</option>
                    <option value="MINE">Meus casos</option>
                    <option value="UNASSIGNED">Sem responsável</option>
                </select>
            </div>

            <div className="fila-page__table-wrapper">
                <table className="fila-table">
                    <thead>
                        <tr>
                            <th>Candidato</th>
                            <th>Empresa</th>
                            <th>Cargo</th>
                            <th>Data</th>
                            <th>Prioridade</th>
                            <th>Status</th>
                            <th>Criminal</th>
                            <th>Risco</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {queue.map(c => (
                            <tr key={c.id} className={`fila-table__row ${c.priority === 'HIGH' ? 'fila-table__row--high' : ''}`}>
                                <td className="fila-table__td--name">{c.candidateName}</td>
                                <td className="fila-table__td--tenant" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.tenantName}</td>
                                <td>{c.candidatePosition}</td>
                                <td>{c.createdAt}</td>
                                <td>
                                    <span className={`fila-priority fila-priority--${c.priority.toLowerCase()}`}>
                                        {c.priority === 'HIGH' ? '🔴 Alta' : 'Normal'}
                                    </span>
                                </td>
                                <td><StatusBadge status={c.status} /></td>
                                <td><RiskChip value={c.criminalFlag} /></td>
                                <td><RiskChip value={c.riskLevel} /></td>
                                <td>
                                    <div className="fila-actions">
                                        {!c.assigneeId && (
                                            <button className="fila-btn fila-btn--assume" title="Assumir">
                                                ✋ Assumir
                                            </button>
                                        )}
                                        <button className="fila-btn fila-btn--open" onClick={() => navigate(`/ops/caso/${c.id}`)}>
                                            📝 Abrir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {queue.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '48px' }}>
                                    <span style={{ fontSize: '2rem' }}>🎉</span>
                                    <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>Nenhum caso pendente na fila!</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
