import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../ui/components/Modal/Modal';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import KpiCard from '../../ui/components/KpiCard/KpiCard';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import FilterPanelMobile from '../../ui/components/FilterPanelMobile/FilterPanelMobile';
import PaginationControls from '../../ui/components/PaginationControls/PaginationControls';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { useCases } from '../../hooks/useCases';
import {
    callAssignCaseToCurrentAnalyst,
    callAssignCaseToAnalyst,
    callListOpsUsers,
} from '../../core/firebase/firestoreService';
import { getOverallEnrichmentStatus } from '../../core/enrichmentStatus';
import { formatDate } from '../../core/formatDate';
import { extractErrorMessage } from '../../core/errorUtils';
import SlaBadge from '../../ui/components/SlaBadge/SlaBadge';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import './FilaPage.css';

const PAGE_SIZE = 50;

function EnrichmentIcon({ status }) {
    if (!status || status === 'PENDING') return null;
    const config = {
        RUNNING: { cls: 'enrichment-icon--running', title: 'Consulta em andamento', label: '' },
        DONE: { cls: 'enrichment-icon--done', title: 'Consulta concluída', label: '✓' },
        PARTIAL: { cls: 'enrichment-icon--partial', title: 'Consulta parcial', label: '!' },
        FAILED: { cls: 'enrichment-icon--failed', title: 'Consulta falhou', label: '✕' },
        BLOCKED: { cls: 'enrichment-icon--blocked', title: 'CPF bloqueado no gate de identidade', label: '⊘' },
    };
    const c = config[status];
    if (!c) return null;
    return <span className={`enrichment-icon ${c.cls}`} title={c.title}>{c.label}</span>;
}

export default function FilaPage() {
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();
    const isDemoMode = !user;
    const routePrefix = isDemoMode ? '/demo' : '';
    const { selectedTenantId } = useTenant();
    const {
        cases,
        error,
        loading,
    } = useCases(selectedTenantId === ALL_TENANTS_ID ? null : selectedTenantId);
    const [filter, setFilter] = useState('ALL');
    const [assignment, setAssignment] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [assumingCaseId, setAssumingCaseId] = useState(null);
    const [assumeError, setAssumeError] = useState(null);
    const assumeErrorTimerRef = useRef(null);
    const [selected, setSelected] = useState(new Set());
    const [bulkRunning, setBulkRunning] = useState(false);

    // Assignment modal state
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignModalCase, setAssignModalCase] = useState(null);
    const [opsUsers, setOpsUsers] = useState([]);
    const [assigning, setAssigning] = useState(false);
    const [assignError, setAssignError] = useState(null);

    useEffect(() => {
        return () => { clearTimeout(assumeErrorTimerRef.current); };
    }, []);

    const canAssignOthers = ['supervisor', 'admin', 'owner'].includes(userProfile?.role);
    const isAssignable = (c) => c.status === 'PENDING' && !c.assigneeId;

    const queue = useMemo(() => {
        let result = cases.filter((currentCase) => currentCase.status !== 'DONE');

        if (filter !== 'ALL') {
            result = result.filter((currentCase) => currentCase.status === filter);
        }

        if (assignment === 'UNASSIGNED') {
            result = result.filter((currentCase) => !currentCase.assigneeId);
        }

        if (assignment === 'MINE') {
            result = result.filter((currentCase) => currentCase.assigneeId === user?.uid);
        }

        if (dateFrom) result = result.filter((c) => (c.createdAt || '').slice(0, 10) >= dateFrom);
        if (dateTo) result = result.filter((c) => (c.createdAt || '').slice(0, 10) <= dateTo);

        return result;
    }, [assignment, cases, dateFrom, dateTo, filter, user?.uid]);

    const stats = useMemo(() => cases.reduce((acc, currentCase) => {
        if (currentCase.status === 'PENDING') acc.pending += 1;
        if (currentCase.status === 'IN_PROGRESS') acc.inProgress += 1;
        if (currentCase.status === 'WAITING_INFO') acc.waiting += 1;
        if (currentCase.status === 'CORRECTION_NEEDED') acc.corrections += 1;
        return acc;
    }, { pending: 0, inProgress: 0, waiting: 0, corrections: 0 }), [cases]);

    const totalPages = Math.max(1, Math.ceil(queue.length / PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedQueue = useMemo(() => {
        const start = (safeCurrentPage - 1) * PAGE_SIZE;
        return queue.slice(start, start + PAGE_SIZE);
    }, [queue, safeCurrentPage]);

    const handleAssume = useCallback(async (currentCase) => {
        if (assumingCaseId || !user) return;
        setAssumingCaseId(currentCase.id);
        setAssumeError(null);
        try {
            await callAssignCaseToCurrentAnalyst({ caseId: currentCase.id });
        } catch (err) {
            console.error('Error assuming case:', err);
            setAssumeError(extractErrorMessage(err, 'Falha ao assumir o caso. Tente novamente.'));
            clearTimeout(assumeErrorTimerRef.current);
            assumeErrorTimerRef.current = setTimeout(() => setAssumeError(null), 6000);
        } finally {
            setAssumingCaseId(null);
        }
    }, [assumingCaseId, user]);

    const handleClickPending = useCallback(() => setFilter('PENDING'), []);
    const handleClickInProgress = useCallback(() => setFilter('IN_PROGRESS'), []);
    const handleClickWaiting = useCallback(() => setFilter('WAITING_INFO'), []);
    const handleClickCorrections = useCallback(() => setFilter('CORRECTION_NEEDED'), []);

    const openAssignModal = useCallback(async (currentCase) => {
        if (!canAssignOthers || isDemoMode) return;
        setAssignModalCase(currentCase);
        setAssignError(null);
        setAssignModalOpen(true);
        try {
            const res = await callListOpsUsers();
            setOpsUsers((res?.users || []).filter((u) => u.status === 'active' && u.uid !== currentCase.assigneeId));
        } catch (err) {
            setAssignError(extractErrorMessage(err, 'Erro ao carregar analistas.'));
        }
    }, [canAssignOthers, isDemoMode]);

    const renderCard = useCallback((currentCase) => (
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
                <span className={`fila-priority fila-priority--${(currentCase.priority || 'normal').toLowerCase()}`}>
                    {currentCase.priority === 'HIGH' ? 'Alta' : 'Normal'}
                </span>
            </div>
            <div className="mobile-card__badges">
                <SlaBadge caseData={currentCase} />
                <RiskChip value={currentCase.riskLevel} />
                <RiskChip value={currentCase.criminalFlag} />
                <EnrichmentIcon status={getOverallEnrichmentStatus(currentCase)} />
            </div>
            <div className="mobile-card__divider" />
            <div className="mobile-card__actions">
                {!currentCase.assigneeId && (
                    <button
                        className="btn-primary"
                        disabled={assumingCaseId === currentCase.id || isDemoMode}
                        onClick={() => handleAssume(currentCase)}
                    >
                        Assumir
                    </button>
                )}
                {currentCase.assigneeId && !currentCase.assigneeName && (
                    <span className="mobile-card__assignee">Atribuído (oculto)</span>
                )}
                {currentCase.assigneeName && (
                    <span className="mobile-card__assignee">{currentCase.assigneeName}</span>
                )}
                {canAssignOthers && (
                    <button
                        className="btn-secondary"
                        disabled={isDemoMode}
                        onClick={() => openAssignModal(currentCase)}
                    >
                        Atribuir
                    </button>
                )}
            </div>
        </>
    ), [assumingCaseId, isDemoMode, canAssignOthers, handleAssume, openAssignModal]);

    const toggleSelect = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        const visibleAssignableIds = paginatedQueue.filter(isAssignable).map((c) => c.id);
        const allVisibleSelected = visibleAssignableIds.length > 0 && visibleAssignableIds.every((id) => selected.has(id));
        setSelected((prev) => {
            const next = new Set(prev);
            visibleAssignableIds.forEach((id) => {
                if (allVisibleSelected) next.delete(id);
                else next.add(id);
            });
            return next;
        });
    };

    const bulkAssign = async () => {
        if (bulkRunning || selected.size === 0 || !user) return;
        setBulkRunning(true);
        setAssumeError(null);
        const ids = [...selected];
        const failedIds = [];
        for (const id of ids) {
            try {
                await callAssignCaseToCurrentAnalyst({ caseId: id });
            } catch {
                failedIds.push(id);
            }
        }
        setBulkRunning(false);
        setSelected(new Set());
        if (failedIds.length > 0) {
            setAssumeError(`${failedIds.length} de ${ids.length} caso(s) falharam ao ser atribuídos.`);
            clearTimeout(assumeErrorTimerRef.current);
            assumeErrorTimerRef.current = setTimeout(() => setAssumeError(null), 6000);
        }
    };

    const handleAssignToUser = async (targetUid) => {
        if (!assignModalCase || assigning) return;
        setAssigning(true);
        setAssignError(null);
        try {
            await callAssignCaseToAnalyst({ caseId: assignModalCase.id, targetUid });
            setAssignModalOpen(false);
            setAssignModalCase(null);
        } catch (err) {
            setAssignError(extractErrorMessage(err, 'Falha ao atribuir caso.'));
        } finally {
            setAssigning(false);
        }
    };

    return (
        <PageShell size="default" className="fila-page">
            <PageHeader
                eyebrow="Operacional"
                title="Fila de análise"
                description="Priorize solicitações pendentes, casos próximos do prazo e análises aguardando responsável."
            />
            <div className="fila-page__kpis">
                <KpiCard label="Pendentes" value={stats.pending} color="yellow" onClick={handleClickPending} />
                <KpiCard label="Em Analise" value={stats.inProgress} color="blue" onClick={handleClickInProgress} />
                <KpiCard label="Aguardando Info" value={stats.waiting} color="neutral" onClick={handleClickWaiting} />
                {stats.corrections > 0 && <KpiCard label="Correcao Pendente" value={stats.corrections} color="red" onClick={handleClickCorrections} />}
            </div>

            {assumeError && (
                <div role="alert" style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--red-50)', color: 'var(--red-700)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
                    {assumeError}
                </div>
            )}

            <FilterPanelMobile
                activeFilterCount={[filter !== 'ALL' ? 1 : 0, assignment !== 'ALL' ? 1 : 0, dateFrom ? 1 : 0, dateTo ? 1 : 0].reduce((a, b) => a + b, 0)}
                searchElement={
                    <select className="fila-filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}>
                        <option value="ALL">Todos os status</option>
                        <option value="PENDING">Pendente</option>
                        <option value="IN_PROGRESS">Em Analise</option>
                        <option value="WAITING_INFO">Aguardando Info</option>
                        <option value="CORRECTION_NEEDED">Correcao Pendente</option>
                    </select>
                }
            >
                <div className="fila-page__filters">
                    <select className="fila-filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}>
                        <option value="ALL">Todos os status</option>
                        <option value="PENDING">Pendente</option>
                        <option value="IN_PROGRESS">Em Analise</option>
                        <option value="WAITING_INFO">Aguardando Info</option>
                        <option value="CORRECTION_NEEDED">Correcao Pendente</option>
                    </select>
                    <select className="fila-filter-select" value={assignment} onChange={(event) => setAssignment(event.target.value)}>
                        <option value="ALL">Todos</option>
                        <option value="MINE">Meus casos</option>
                        <option value="UNASSIGNED">Sem responsavel</option>
                    </select>
                    <input type="date" className="fila-filter-select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Data inicial" aria-label="Filtrar de" />
                    <input type="date" className="fila-filter-select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Data final" aria-label="Filtrar ate" />
                </div>
            </FilterPanelMobile>

            {selected.size > 0 && (
                <div className="fila-bulk-bar">
                    <span className="fila-bulk-bar__count">{selected.size} selecionado(s)</span>
                    <button type="button" className="btn-primary" disabled={bulkRunning || isDemoMode} onClick={bulkAssign}>
                        {bulkRunning ? 'Atribuindo…' : 'Assumir selecionados'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setSelected(new Set())}>Limpar</button>
                </div>
            )}

            <MobileDataCardList
                items={paginatedQueue}
                loading={loading}
                emptyMessage={filter !== 'ALL' || assignment !== 'ALL' || dateFrom || dateTo ? 'Nenhum caso corresponde aos filtros selecionados.' : 'Nenhum caso pendente na fila.'}
                renderCard={renderCard}
            >
                {/* Desktop table */}
                <div className="fila-page__table-wrapper">
                    <table className="fila-table" aria-label="Fila de trabalho">
                        <thead>
                            <tr>
                                <th scope="col" style={{ width: 36 }}>
                                    <input type="checkbox" checked={paginatedQueue.some(isAssignable) && paginatedQueue.filter(isAssignable).every((currentCase) => selected.has(currentCase.id))} onChange={toggleAll} disabled={bulkRunning} aria-label="Selecionar todos" />
                                </th>
                                <th scope="col">Candidato</th>
                                <th scope="col">Empresa</th>
                                <th scope="col">Cargo</th>
                                <th scope="col">Data</th>
                                <th scope="col">Prioridade</th>
                                <th scope="col">Status</th>
                                <th scope="col">Prazo</th>
                                <th scope="col" style={{ width: 40 }} title="Consulta automática">⚡</th>
                                <th scope="col">Criminal</th>
                                <th scope="col">Risco</th>
                                <th scope="col">Responsavel</th>
                                <th scope="col">Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && Array.from({ length: 6 }, (_, i) => (
                                <tr key={`sk-${i}`} aria-hidden="true">
                                    <td><div className="skeleton" style={{ width: 16, height: 16, borderRadius: 3 }} /></td>
                                    <td><div className="skeleton skeleton--text" style={{ width: `${60 + (i % 3) * 15}%` }} /></td>
                                    <td><div className="skeleton skeleton--text" style={{ width: '70%' }} /></td>
                                    <td><div className="skeleton skeleton--text" style={{ width: '80%' }} /></td>
                                    <td><div className="skeleton skeleton--text" style={{ width: 72 }} /></td>
                                    <td><div className="skeleton skeleton--text" style={{ width: 50 }} /></td>
                                    <td><div className="skeleton" style={{ width: 72, height: 22, borderRadius: 99 }} /></td>
                                    <td><div className="skeleton" style={{ width: 72, height: 22, borderRadius: 99 }} /></td>
                                    <td />
                                    <td><div className="skeleton" style={{ width: 72, height: 22, borderRadius: 99 }} /></td>
                                    <td><div className="skeleton" style={{ width: 56, height: 22, borderRadius: 99 }} /></td>
                                    <td />
                                </tr>
                            ))}
                            {!loading && error && (
                                <tr>
                                    <td colSpan={13} style={{ textAlign: 'center', padding: '48px', color: 'var(--red-700)' }}>
                                        {extractErrorMessage(error, 'Nao foi possivel carregar a fila de trabalho agora.')}
                                    </td>
                                </tr>
                            )}
                            {!loading && !error && paginatedQueue.map((currentCase) => (
                                <tr
                                    key={currentCase.id}
                                    className={`fila-table__row ${currentCase.priority === 'HIGH' ? 'fila-table__row--high' : ''} ${selected.has(currentCase.id) ? 'fila-table__row--selected' : ''}`}
                                >
                                    <td><input type="checkbox" checked={selected.has(currentCase.id)} onChange={() => toggleSelect(currentCase.id)} disabled={bulkRunning} aria-label={`Selecionar ${currentCase.candidateName}`} /></td>
                                    <td className="fila-table__td--name">{currentCase.candidateName}</td>
                                    <td className="fila-table__td--tenant" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {currentCase.tenantName}
                                    </td>
                                    <td>{currentCase.candidatePosition}</td>
                                    <td>{formatDate(currentCase.createdAt)}</td>
                                    <td>
                                        <span className={`fila-priority fila-priority--${(currentCase.priority || 'normal').toLowerCase()}`}>
                                            {currentCase.priority === 'HIGH' ? 'Alta' : 'Normal'}
                                        </span>
                                    </td>
                                    <td><StatusBadge status={currentCase.status} /></td>
                                    <td><SlaBadge caseData={currentCase} audience="ops" /></td>
                                    <td style={{ textAlign: 'center' }}><EnrichmentIcon status={getOverallEnrichmentStatus(currentCase)} /></td>
                                    <td><RiskChip value={currentCase.criminalFlag} /></td>
                                    <td><RiskChip value={currentCase.riskLevel} /></td>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: 120 }}>
                                        {currentCase.assigneeName || currentCase.assigneeEmail || (currentCase.assigneeId ? 'Atribuido' : '—')}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {!currentCase.assigneeId && (
                                                <button
                                                    className="btn-primary"
                                                    title="Assumir"
                                                    disabled={assumingCaseId === currentCase.id || isDemoMode}
                                                    onClick={() => handleAssume(currentCase)}
                                                >
                                                    {assumingCaseId === currentCase.id ? 'Assumindo...' : 'Assumir'}
                                                </button>
                                            )}
                                            {canAssignOthers && currentCase.assigneeId && (
                                                <button
                                                    className="btn-secondary"
                                                    title="Trocar responsavel"
                                                    disabled={isDemoMode}
                                                    onClick={() => openAssignModal(currentCase)}
                                                >
                                                    Trocar
                                                </button>
                                            )}
                                            {canAssignOthers && !currentCase.assigneeId && (
                                                <button
                                                    className="btn-secondary"
                                                    title="Atribuir"
                                                    disabled={isDemoMode}
                                                    onClick={() => openAssignModal(currentCase)}
                                                >
                                                    Atribuir
                                                </button>
                                            )}
                                            <button className="btn-secondary" onClick={() => navigate(`${routePrefix}/ops/caso/${currentCase.id}`)}>
                                                Abrir
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && !error && queue.length === 0 && (
                                <tr>
                                    <td colSpan={14} style={{ textAlign: 'center', padding: '48px' }}>
                                        <span style={{ fontSize: '2rem' }}>OK</span>
                                        <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
                                            {filter !== 'ALL' || assignment !== 'ALL' || dateFrom || dateTo
                                                ? 'Nenhum caso corresponde aos filtros selecionados.'
                                                : 'Nenhum caso pendente na fila.'}
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </MobileDataCardList>

            <PaginationControls
                page={safeCurrentPage}
                pageSize={PAGE_SIZE}
                totalItems={queue.length}
                itemLabel="casos"
                onPageChange={setCurrentPage}
            />

            {/* Assignment modal */}
            <Modal
                open={assignModalOpen}
                onClose={() => { setAssignModalOpen(false); setAssignModalCase(null); }}
                title={assignModalCase?.assigneeId ? 'Trocar responsavel' : 'Atribuir caso'}
            >
                <div style={{ minWidth: 280 }}>
                    <p style={{ marginBottom: 16, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Caso: <strong style={{ color: 'var(--text-primary)' }}>{assignModalCase?.candidateName}</strong>
                    </p>
                    {assignError && (
                        <div role="alert" style={{ padding: 'var(--space-3)', background: 'var(--red-50)', color: 'var(--red-700)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', fontSize: '0.875rem' }}>
                            {assignError}
                        </div>
                    )}
                    {opsUsers.length === 0 && !assignError ? (
                        <p style={{ color: 'var(--text-secondary)', padding: 'var(--space-4) 0', textAlign: 'center' }}>Nenhum analista disponivel.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                            {opsUsers.map((u) => (
                                <button
                                    key={u.uid}
                                    type="button"
                                    className="btn-secondary"
                                    style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '12px 16px' }}
                                    disabled={assigning}
                                    onClick={() => handleAssignToUser(u.uid)}
                                >
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.displayName || u.email}</span>
                                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </PageShell>
    );
}
