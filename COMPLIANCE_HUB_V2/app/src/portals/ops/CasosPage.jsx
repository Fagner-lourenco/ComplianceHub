import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import ScoreBar from '../../ui/components/ScoreBar/ScoreBar';
import KpiCard from '../../ui/components/KpiCard/KpiCard';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import FilterPanelMobile from '../../ui/components/FilterPanelMobile/FilterPanelMobile';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { formatDate } from '../../core/formatDate';
import { useCases } from '../../hooks/useCases';
import { getCaseStats } from '../../core/caseUtils';
import { getOverallEnrichmentStatus } from '../../core/enrichmentStatus';
import { extractErrorMessage } from '../../core/errorUtils';
import './CasosPage.css';

function formatFullCpf(cpf) {
    const d = String(cpf || '').replace(/\D/g, '');
    if (d.length !== 11) return cpf || '';
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function EnrichmentIcon({ status }) {
    if (!status || status === 'PENDING') return null;
    const config = {
        RUNNING: { cls: 'enrichment-icon--running', title: 'Enriquecimento em andamento', label: '' },
        DONE: { cls: 'enrichment-icon--done', title: 'Enriquecimento concluido', label: '✓' },
        PARTIAL: { cls: 'enrichment-icon--partial', title: 'Enriquecimento parcial', label: '!' },
        FAILED: { cls: 'enrichment-icon--failed', title: 'Enriquecimento falhou', label: '✕' },
        BLOCKED: { cls: 'enrichment-icon--blocked', title: 'CPF bloqueado no gate de identidade', label: '⊘' },
    };
    const c = config[status];
    if (!c) return null;
    return <span className={`enrichment-icon ${c.cls}`} title={c.title}>{c.label}</span>;
}

export default function CasosPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const isDemoPortal = location.pathname.startsWith('/demo/');
    const routePrefix = isDemoPortal ? '/demo' : '';
    const { selectedTenantId } = useTenant();
    const {
        cases,
        error,
        loading,
    } = useCases(selectedTenantId === ALL_TENANTS_ID ? null : selectedTenantId);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [riskFilter, setRiskFilter] = useState('ALL');
    const [enrichmentFilter, setEnrichmentFilter] = useState('ALL');
    const [verdictFilter, setVerdictFilter] = useState('ALL');

    const stats = useMemo(() => getCaseStats(cases), [cases]);

    const filtered = useMemo(() => {
        let result = [...cases];

        if (statusFilter !== 'ALL') {
            result = result.filter((currentCase) => currentCase.status === statusFilter);
        }

        if (riskFilter !== 'ALL') {
            result = result.filter((c) => c.riskLevel === riskFilter);
        }

        if (verdictFilter !== 'ALL') {
            result = result.filter((c) => c.finalVerdict === verdictFilter);
        }

        if (enrichmentFilter !== 'ALL') {
            result = result.filter((c) => getOverallEnrichmentStatus(c) === enrichmentFilter);
        }

        if (dateFrom) result = result.filter((c) => (c.createdAt || '').slice(0, 10) >= dateFrom);
        if (dateTo) result = result.filter((c) => (c.createdAt || '').slice(0, 10) <= dateTo);

        if (searchTerm) {
            const normalizedTerm = searchTerm.toLowerCase().replace(/\D/g, '') || searchTerm.toLowerCase();
            const rawTerm = searchTerm.toLowerCase();
            result = result.filter((currentCase) => (
                currentCase.candidateName.toLowerCase().includes(rawTerm)
                || (currentCase.cpf && currentCase.cpf.includes(normalizedTerm))
                || currentCase.cpfMasked.replace(/\D/g, '').includes(normalizedTerm)
                || currentCase.cpfMasked.includes(rawTerm)
                || currentCase.id.toLowerCase().includes(rawTerm)
            ));
        }

        return result;
    }, [cases, dateFrom, dateTo, enrichmentFilter, riskFilter, searchTerm, statusFilter, verdictFilter]);

    return (
        <div className="casos-page">
            <div className="casos-page__kpis">
                <KpiCard label="Total" value={stats.total} color="neutral" onClick={() => setStatusFilter('ALL')} />
                <KpiCard label="Concluidos" value={stats.done} color="green" onClick={() => setStatusFilter('DONE')} />
                <KpiCard label="Pendentes" value={stats.pending} color="yellow" onClick={() => setStatusFilter('PENDING')} />
                <KpiCard label="Alertas" value={stats.red} color="red" />
            </div>

            <FilterPanelMobile
                activeFilterCount={[statusFilter !== 'ALL' ? 1 : 0, riskFilter !== 'ALL' ? 1 : 0, verdictFilter !== 'ALL' ? 1 : 0, enrichmentFilter !== 'ALL' ? 1 : 0, dateFrom ? 1 : 0, dateTo ? 1 : 0].reduce((a, b) => a + b, 0)}
                searchElement={
                    <div className="filter-bar__search" style={{ flex: 1, minWidth: 0 }}>
                        <span className="filter-bar__search-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </span>
                        <input
                            type="text"
                            className="filter-bar__search-input"
                            placeholder="Buscar por nome, CPF ou ID..."
                            aria-label="Buscar casos"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                }
            >
                <div className="casos-page__filters">
                    <div className="filter-bar__search" style={{ flex: 1, minWidth: 200 }}>
                        <span className="filter-bar__search-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </span>
                        <input
                            type="text"
                            className="filter-bar__search-input"
                            placeholder="Buscar por nome, CPF ou ID..."
                            aria-label="Buscar casos"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                    <select className="filter-bar__select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="ALL">Todos os status</option>
                        <option value="PENDING">Pendente</option>
                        <option value="IN_PROGRESS">Em Analise</option>
                        <option value="WAITING_INFO">Aguardando Info</option>
                        <option value="DONE">Concluido</option>
                        <option value="CORRECTION_NEEDED">Correcao Pendente</option>
                    </select>
                    <select className="filter-bar__select" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
                        <option value="ALL">Todos os riscos</option>
                        <option value="HIGH">Alto</option>
                        <option value="MEDIUM">Médio</option>
                        <option value="LOW">Baixo</option>
                    </select>
                    <select className="filter-bar__select" value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value)}>
                        <option value="ALL">Todos os vereditos</option>
                        <option value="FIT">FIT</option>
                        <option value="ATTENTION">ATTENTION</option>
                        <option value="NOT_RECOMMENDED">NOT RECOMMENDED</option>
                    </select>
                    <select className="filter-bar__select" value={enrichmentFilter} onChange={(e) => setEnrichmentFilter(e.target.value)}>
                        <option value="ALL">Enriquecimento</option>
                        <option value="DONE">Concluído</option>
                        <option value="RUNNING">Em andamento</option>
                        <option value="PARTIAL">Parcial</option>
                        <option value="FAILED">Falhou</option>
                        <option value="BLOCKED">Bloqueado</option>
                    </select>
                    <input type="date" className="filter-bar__select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Data inicial" />
                    <input type="date" className="filter-bar__select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Data final" />
                </div>
            </FilterPanelMobile>

            <MobileDataCardList
                items={filtered}
                loading={loading}
                emptyMessage="Nenhum caso encontrado."
                renderCard={(currentCase) => (
                    <>
                        <div className="mobile-card__header">
                            <div>
                                <div className="mobile-card__title">{currentCase.candidateName}</div>
                                <div className="mobile-card__subtitle">{currentCase.tenantName}</div>
                            </div>
                            <StatusBadge status={currentCase.status} />
                        </div>
                        <div className="mobile-card__meta">
                            {currentCase.candidatePosition && (
                                <span className="mobile-card__meta-item">{currentCase.candidatePosition}</span>
                            )}
                            <span className="mobile-card__meta-item">{formatDate(currentCase.createdAt)}</span>
                        </div>
                        <div className="mobile-card__badges">
                            <RiskChip value={currentCase.riskLevel} />
                            <RiskChip value={currentCase.finalVerdict} bold />
                            <ScoreBar score={currentCase.riskScore} />
                            <EnrichmentIcon status={getOverallEnrichmentStatus(currentCase)} />
                        </div>
                        <div className="mobile-card__divider" />
                        <div className="mobile-card__actions">
                            <button
                                className="btn-secondary"
                                onClick={() => navigate(`${routePrefix}/ops/caso/${currentCase.id}`)}
                            >
                                Abrir
                            </button>
                        </div>
                    </>
                )}
            >
                {/* Desktop table — unchanged */}
                <div className="casos-page__table-wrapper">
                    <table className="data-table" aria-label="Lista de casos">
                        <thead>
                            <tr>
                                <th className="data-table__th" scope="col">ID</th>
                                <th className="data-table__th" scope="col">Empresa</th>
                                <th className="data-table__th" scope="col">Candidato</th>
                                <th className="data-table__th" scope="col">CPF</th>
                                <th className="data-table__th" scope="col">Cargo</th>
                                <th className="data-table__th" scope="col">Data</th>
                                <th className="data-table__th" scope="col">Status</th>
                                <th className="data-table__th" scope="col" style={{ width: 40 }} title="Enriquecimento">⚡</th>
                                <th className="data-table__th" scope="col">Criminal</th>
                                <th className="data-table__th" scope="col">Score</th>
                                <th className="data-table__th" scope="col">Veredito</th>
                                <th className="data-table__th" scope="col">Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={12} className="data-table__empty" style={{ textAlign: 'center', padding: 48 }}>
                                        Carregando casos...
                                    </td>
                                </tr>
                            )}
                            {!loading && error && (
                                <tr>
                                    <td colSpan={12} className="data-table__empty" style={{ textAlign: 'center', padding: 48, color: 'var(--red-700)' }}>
                                        {extractErrorMessage(error, 'Nao foi possivel carregar os casos agora.')}
                                    </td>
                                </tr>
                            )}
                            {!loading && !error && filtered.map((currentCase) => (
                                <tr key={currentCase.id} className="data-table__row">
                                    <td className="data-table__td data-table__td--mono">{currentCase.id}</td>
                                    <td className="data-table__td" style={{ fontSize: '.75rem' }}>{currentCase.tenantName}</td>
                                    <td className="data-table__td data-table__td--name">{currentCase.candidateName}</td>
                                    <td className="data-table__td data-table__td--mono">{formatFullCpf(currentCase.cpf) || currentCase.cpfMasked}</td>
                                    <td className="data-table__td">{currentCase.candidatePosition}</td>
                                    <td className="data-table__td">{formatDate(currentCase.createdAt)}</td>
                                    <td className="data-table__td"><StatusBadge status={currentCase.status} /></td>
                                    <td className="data-table__td" style={{ textAlign: 'center' }}><EnrichmentIcon status={getOverallEnrichmentStatus(currentCase)} /></td>
                                    <td className="data-table__td"><RiskChip value={currentCase.criminalFlag} /></td>
                                    <td className="data-table__td"><ScoreBar score={currentCase.riskScore} /></td>
                                    <td className="data-table__td"><RiskChip value={currentCase.finalVerdict} bold /></td>
                                    <td className="data-table__td">
                                        <button
                                            className="fila-btn fila-btn--open"
                                            onClick={() => navigate(`${routePrefix}/ops/caso/${currentCase.id}`)}
                                        >
                                            Abrir
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!loading && !error && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="data-table__empty" style={{ textAlign: 'center', padding: 48 }}>
                                        Nenhum caso encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </MobileDataCardList>

            <div style={{ textAlign: 'right', fontSize: '.8125rem', color: 'var(--text-secondary)' }}>
                Mostrando {filtered.length} de {cases.length} casos
            </div>
        </div>
    );
}
