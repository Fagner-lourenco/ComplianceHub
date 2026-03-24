import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import ScoreBar from '../../ui/components/ScoreBar/ScoreBar';
import KpiCard from '../../ui/components/KpiCard/KpiCard';
import Drawer from '../../ui/components/Drawer/Drawer';
import SocialLinks from '../../ui/components/SocialLinks/SocialLinks';
import { useCases } from '../../hooks/useCases';
import { MOCK_CASE_DETAILS, getCaseStats } from '../../data/mockData';
import './SolicitacoesPage.css';

export default function SolicitacoesPage() {
    const navigate = useNavigate();
    const { cases } = useCases();   // auto-detects tenantId from auth
    const [selectedCase, setSelectedCase] = useState(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [verdictFilter, setVerdictFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [heatmapMode, setHeatmapMode] = useState(false);
    const [sortField, setSortField] = useState('createdAt');
    const [sortDir, setSortDir] = useState('desc');

    const stats = useMemo(() => getCaseStats(cases), [cases]);

    const filteredCases = useMemo(() => {
        let result = [...cases];
        if (statusFilter !== 'ALL') result = result.filter(c => c.status === statusFilter);
        if (verdictFilter !== 'ALL') result = result.filter(c => c.finalVerdict === verdictFilter);
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.candidateName.toLowerCase().includes(term) ||
                c.cpfMasked.includes(term) ||
                c.id.toLowerCase().includes(term)
            );
        }
        result.sort((a, b) => {
            let va = a[sortField], vb = b[sortField];
            if (sortField === 'riskScore') { va = va || 0; vb = vb || 0; }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [cases, statusFilter, verdictFilter, searchTerm, sortField, sortDir]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const activeFilters = [];
    if (statusFilter !== 'ALL') activeFilters.push({ key: 'status', label: `Status: ${statusFilter}`, clear: () => setStatusFilter('ALL') });
    if (verdictFilter !== 'ALL') activeFilters.push({ key: 'verdict', label: `Veredito: ${verdictFilter}`, clear: () => setVerdictFilter('ALL') });

    const detail = selectedCase ? MOCK_CASE_DETAILS[selectedCase.id] : null;

    const drawerTabs = selectedCase ? [
        {
            label: 'Resumo',
            content: (
                <div className="case-detail">
                    <div className="case-detail__risk-grid">
                        {[
                            { label: 'Criminal', value: selectedCase.criminalFlag },
                            { label: 'OSINT', value: selectedCase.osintLevel },
                            { label: 'Social', value: selectedCase.socialStatus },
                            { label: 'Digital', value: selectedCase.digitalFlag },
                            { label: 'Conflito', value: selectedCase.conflictInterest },
                            { label: 'Score', value: null, score: selectedCase.riskScore },
                        ].map((item, i) => (
                            <div key={i} className="case-detail__risk-card">
                                <div className="case-detail__risk-label">{item.label}</div>
                                {item.score !== undefined && item.value === null
                                    ? <ScoreBar score={item.score} />
                                    : <RiskChip value={item.value} size="md" />}
                            </div>
                        ))}
                    </div>
                    {detail?.executiveSummary && (
                        <div className="case-detail__section">
                            <h4>Resumo Executivo</h4>
                            <p>{detail.executiveSummary}</p>
                        </div>
                    )}
                </div>
            ),
        },
        {
            label: 'Detalhes',
            content: (
                <div className="case-detail">
                    {detail ? (
                        <>
                            {detail.criminalNotes && (
                                <div className="case-detail__section">
                                    <h4>🔴 Criminal</h4>
                                    <p>{detail.criminalNotes}</p>
                                    {detail.criminalFindings && <p className="case-detail__finding"><strong>Achado:</strong> {detail.criminalFindings}</p>}
                                    {detail.criminalSource && <p className="case-detail__finding"><strong>Fonte:</strong> {detail.criminalSource}</p>}
                                    {detail.criminalImpact && <p className="case-detail__finding"><strong>Impacto:</strong> {detail.criminalImpact}</p>}
                                </div>
                            )}
                            {detail.osintNotes && (
                                <div className="case-detail__section">
                                    <h4>🔍 OSINT</h4>
                                    <p>{detail.osintNotes}</p>
                                </div>
                            )}
                            {detail.socialNotes && (
                                <div className="case-detail__section">
                                    <h4>👥 Social</h4>
                                    <p>{detail.socialNotes}</p>
                                </div>
                            )}
                            {detail.digitalNotes && (
                                <div className="case-detail__section">
                                    <h4>💻 Perfil Digital</h4>
                                    <p>{detail.digitalNotes}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="case-detail__empty">Análise ainda não realizada.</p>
                    )}
                </div>
            ),
        },
        {
            label: 'Redes Sociais',
            content: (
                <div className="case-detail">
                    <h4>Perfis fornecidos</h4>
                    <SocialLinks profiles={selectedCase.socialProfiles || {}} size="md" showEmpty />
                    {detail?.digitalNotes && (
                        <div className="case-detail__section" style={{ marginTop: 16 }}>
                            <h4>Resultado da Análise Digital</h4>
                            <RiskChip value={selectedCase.digitalFlag} size="md" />
                            <p style={{ marginTop: 8 }}>{detail.digitalNotes}</p>
                        </div>
                    )}
                </div>
            ),
        },
        {
            label: 'Timeline',
            content: (
                <div className="case-detail">
                    <div className="timeline">
                        <div className="timeline__item">
                            <div className="timeline__dot timeline__dot--green" />
                            <div className="timeline__content">
                                <strong>Solicitação criada</strong>
                                <span className="timeline__date">{selectedCase.createdAt}</span>
                            </div>
                        </div>
                        {selectedCase.status !== 'PENDING' && (
                            <div className="timeline__item">
                                <div className="timeline__dot timeline__dot--blue" />
                                <div className="timeline__content">
                                    <strong>Análise iniciada</strong>
                                    <span className="timeline__date">—</span>
                                </div>
                            </div>
                        )}
                        {selectedCase.status === 'DONE' && (
                            <div className="timeline__item">
                                <div className="timeline__dot timeline__dot--green" />
                                <div className="timeline__content">
                                    <strong>Concluído</strong>
                                    <span className="timeline__date">—</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ),
        },
    ] : [];

    return (
        <div className="solicitacoes-page">
            {/* Header with CTA */}
            <div className="solicitacoes-page__header">
                <h2 className="solicitacoes-page__title">Minhas Solicitações</h2>
                <button className="solicitacoes-page__cta" onClick={() => navigate('/client/nova-solicitacao')}>
                    ➕ Nova Solicitação
                </button>
            </div>

            {/* KPI Dashboard */}
            <div className="solicitacoes-page__kpis">
                <KpiCard label="Total do mês" value={stats.total} color="neutral" onClick={() => { setStatusFilter('ALL'); setVerdictFilter('ALL'); }} />
                <KpiCard label="Concluídos" value={stats.done} color="green" onClick={() => setStatusFilter('DONE')} />
                <KpiCard label="Pendentes" value={stats.pending} color="yellow" onClick={() => setStatusFilter('PENDING')} />
                <KpiCard label="Alertas 🔴" value={stats.red} color="red" onClick={() => setVerdictFilter('NOT_RECOMMENDED')} />
            </div>

            {/* Filters */}
            <div className="solicitacoes-page__filters">
                <div className="filter-bar">
                    <div className="filter-bar__search">
                        <span className="filter-bar__search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar por nome, CPF ou ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="filter-bar__search-input"
                        />
                    </div>
                    <select className="filter-bar__select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="ALL">Todos os status</option>
                        <option value="PENDING">Pendente</option>
                        <option value="IN_PROGRESS">Em Análise</option>
                        <option value="WAITING_INFO">Aguardando Info</option>
                        <option value="DONE">Concluído</option>
                    </select>
                    <select className="filter-bar__select" value={verdictFilter} onChange={e => setVerdictFilter(e.target.value)}>
                        <option value="ALL">Todos os vereditos</option>
                        <option value="FIT">Apto</option>
                        <option value="ATTENTION">Atenção</option>
                        <option value="NOT_RECOMMENDED">Não Recomendado</option>
                        <option value="PENDING">Pendente</option>
                    </select>
                    <button
                        className={`filter-bar__toggle ${heatmapMode ? 'filter-bar__toggle--active' : ''}`}
                        onClick={() => setHeatmapMode(!heatmapMode)}
                        title="Modo Heatmap"
                    >
                        🟦 Heatmap
                    </button>
                </div>

                {activeFilters.length > 0 && (
                    <div className="filter-chips">
                        {activeFilters.map(f => (
                            <span key={f.key} className="filter-chip">
                                {f.label}
                                <button className="filter-chip__remove" onClick={f.clear}>✕</button>
                            </span>
                        ))}
                        <button className="filter-chips__clear" onClick={() => { setStatusFilter('ALL'); setVerdictFilter('ALL'); setSearchTerm(''); }}>
                            Limpar filtros
                        </button>
                    </div>
                )}
            </div>

            {/* DataTable */}
            <div className="solicitacoes-page__table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th className="data-table__th data-table__th--sortable" onClick={() => handleSort('candidateName')}>
                                Nome {sortField === 'candidateName' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="data-table__th">CPF</th>
                            <th className="data-table__th">Cargo</th>
                            <th className="data-table__th data-table__th--sortable" onClick={() => handleSort('createdAt')}>
                                Data {sortField === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="data-table__th">Status</th>
                            <th className="data-table__th">Criminal</th>
                            <th className="data-table__th">OSINT</th>
                            <th className="data-table__th">Social</th>
                            <th className="data-table__th">Digital</th>
                            <th className="data-table__th data-table__th--sortable" onClick={() => handleSort('riskScore')}>
                                Score {sortField === 'riskScore' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="data-table__th">Veredito</th>
                            <th className="data-table__th">📎</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCases.map(c => (
                            <tr
                                key={c.id}
                                className={`data-table__row ${heatmapMode ? `data-table__row--heat-${c.riskLevel || 'none'}` : ''} ${selectedCase?.id === c.id ? 'data-table__row--selected' : ''}`}
                                onClick={() => setSelectedCase(c)}
                            >
                                <td className="data-table__td data-table__td--name">{c.candidateName}</td>
                                <td className="data-table__td data-table__td--mono">{c.cpfMasked}</td>
                                <td className="data-table__td">{c.candidatePosition}</td>
                                <td className="data-table__td">{c.createdAt}</td>
                                <td className="data-table__td"><StatusBadge status={c.status} /></td>
                                <td className="data-table__td"><RiskChip value={c.criminalFlag} /></td>
                                <td className="data-table__td"><RiskChip value={c.osintLevel} /></td>
                                <td className="data-table__td"><RiskChip value={c.socialStatus} /></td>
                                <td className="data-table__td"><RiskChip value={c.digitalFlag} /></td>
                                <td className="data-table__td"><ScoreBar score={c.riskScore} /></td>
                                <td className="data-table__td"><RiskChip value={c.finalVerdict} bold size="md" /></td>
                                <td className="data-table__td">
                                    {c.hasNotes && '📝'}
                                    {c.hasEvidence && '📎'}
                                </td>
                            </tr>
                        ))}
                        {filteredCases.length === 0 && (
                            <tr>
                                <td colSpan={12} className="data-table__empty">
                                    <div className="empty-state">
                                        <span className="empty-state__icon">📭</span>
                                        <p>Nenhuma solicitação encontrada.</p>
                                        <button className="empty-state__btn" onClick={() => { setStatusFilter('ALL'); setVerdictFilter('ALL'); setSearchTerm(''); }}>
                                            Limpar filtros
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="solicitacoes-page__pagination">
                Mostrando {filteredCases.length} de {cases.length} registros
            </div>

            {/* Drawer */}
            <Drawer
                open={!!selectedCase}
                onClose={() => setSelectedCase(null)}
                title={selectedCase?.candidateName}
                subtitle={`${selectedCase?.candidatePosition || ''} · ${selectedCase?.cpfMasked || ''}`}
                headerExtra={selectedCase && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <RiskChip value={selectedCase.finalVerdict} bold size="lg" />
                    </div>
                )}
                tabs={drawerTabs}
            />
        </div>
    );
}
