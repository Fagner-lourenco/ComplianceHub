import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import ScoreBar from '../../ui/components/ScoreBar/ScoreBar';
import KpiCard from '../../ui/components/KpiCard/KpiCard';
import { MOCK_CASES, getCaseStats } from '../../data/mockData';
import './CasosPage.css';

export default function CasosPage() {
    const navigate = useNavigate();
    const [cases] = useState(MOCK_CASES);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [tenantFilter, setTenantFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const stats = useMemo(() => getCaseStats(cases), [cases]);

    const tenants = useMemo(() => {
        const set = new Set(cases.map(c => c.tenantName));
        return [...set];
    }, [cases]);

    const filtered = useMemo(() => {
        let result = [...cases];
        if (statusFilter !== 'ALL') result = result.filter(c => c.status === statusFilter);
        if (tenantFilter !== 'ALL') result = result.filter(c => c.tenantName === tenantFilter);
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.candidateName.toLowerCase().includes(term) ||
                c.cpfMasked.includes(term) ||
                c.id.toLowerCase().includes(term)
            );
        }
        return result;
    }, [cases, statusFilter, tenantFilter, searchTerm]);

    return (
        <div className="casos-page">
            <div className="casos-page__kpis">
                <KpiCard label="Total" value={stats.total} color="neutral" onClick={() => setStatusFilter('ALL')} />
                <KpiCard label="Concluídos" value={stats.done} color="green" onClick={() => setStatusFilter('DONE')} />
                <KpiCard label="Pendentes" value={stats.pending} color="yellow" onClick={() => setStatusFilter('PENDING')} />
                <KpiCard label="Alertas 🔴" value={stats.red} color="red" />
            </div>

            <div className="casos-page__filters">
                <div className="filter-bar__search" style={{ flex: 1, minWidth: 200 }}>
                    <span className="filter-bar__search-icon">🔍</span>
                    <input
                        type="text"
                        className="filter-bar__search-input"
                        placeholder="Buscar por nome, CPF ou ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <select className="filter-bar__select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="ALL">Todos os status</option>
                    <option value="PENDING">Pendente</option>
                    <option value="IN_PROGRESS">Em Análise</option>
                    <option value="WAITING_INFO">Aguardando Info</option>
                    <option value="DONE">Concluído</option>
                </select>
                <select className="filter-bar__select" value={tenantFilter} onChange={e => setTenantFilter(e.target.value)}>
                    <option value="ALL">Todas as empresas</option>
                    {tenants.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            <div className="casos-page__table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th className="data-table__th">ID</th>
                            <th className="data-table__th">Empresa</th>
                            <th className="data-table__th">Candidato</th>
                            <th className="data-table__th">Cargo</th>
                            <th className="data-table__th">Data</th>
                            <th className="data-table__th">Status</th>
                            <th className="data-table__th">Criminal</th>
                            <th className="data-table__th">Score</th>
                            <th className="data-table__th">Veredito</th>
                            <th className="data-table__th">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(c => (
                            <tr key={c.id} className="data-table__row">
                                <td className="data-table__td data-table__td--mono">{c.id}</td>
                                <td className="data-table__td" style={{ fontSize: '.75rem' }}>🏢 {c.tenantName}</td>
                                <td className="data-table__td data-table__td--name">{c.candidateName}</td>
                                <td className="data-table__td">{c.candidatePosition}</td>
                                <td className="data-table__td">{c.createdAt}</td>
                                <td className="data-table__td"><StatusBadge status={c.status} /></td>
                                <td className="data-table__td"><RiskChip value={c.criminalFlag} /></td>
                                <td className="data-table__td"><ScoreBar score={c.riskScore} /></td>
                                <td className="data-table__td"><RiskChip value={c.finalVerdict} bold /></td>
                                <td className="data-table__td">
                                    <button
                                        className="fila-btn fila-btn--open"
                                        onClick={() => navigate(`/ops/caso/${c.id}`)}
                                    >
                                        📝 Abrir
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={10} className="data-table__empty" style={{ textAlign: 'center', padding: 48 }}>
                                    Nenhum caso encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ textAlign: 'right', fontSize: '.8125rem', color: 'var(--text-secondary)' }}>
                Mostrando {filtered.length} de {cases.length} casos
            </div>
        </div>
    );
}
