import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../ui/components/Modal/Modal';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import ScoreBar from '../../ui/components/ScoreBar/ScoreBar';
import KpiCard from '../../ui/components/KpiCard/KpiCard';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import FilterPanelMobile from '../../ui/components/FilterPanelMobile/FilterPanelMobile';
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

    const stats = {
        pending: cases.filter((currentCase) => currentCase.status === 'PENDING').length,
        inProgress: cases.filter((currentCase) => currentCase.status === 'IN_PROGRESS').length,
        waiting: cases.filter((currentCase) => currentCase.status === 'WAITING_INFO').length,
        corrections: cases.filter((currentCase) => currentCase.status === 'CORRECTION_NEEDED').length,
    };

    const handleAssume = async (currentCase) => {
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
    };

    const toggleSelect = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === queue.length) {
            setSelected(new Set());
        } else {
            // FILA-002: só seleciona casos assumíveis (PENDING sem responsável)
            setSelected(new Set(queue.filter(isAssignable).map((c) => c.id)));
        }
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

    const openAssignModal = async (currentCase) => {
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
                <KpiCard label="Pendentes" value={stats.pending} color="yellow" onClick={() => setFilter('PENDING')} />
                <KpiCard label="Em Analise" value={stats.inProgress} color="blue" onClick={() => setFilter('IN_PROGRESS')} />
                <KpiCard label="Aguardando Info" value={stats.waiting} color="neutral" onClick={() => setFilter('WAITING_INFO')} />
                {stats.corrections > 0 && <KpiCard label="Correcao Pendente" value={stats.corrections} color="red" onClick={() => setFilter('CORRECTION_NEEDED')} />}
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
                items={queue}
                loading={loading}
                emptyMessage={filter !== 'ALL' || assignment !== 'ALL' || dateFrom || dateTo ? 'Nenhum caso corresponde aos filtros selecionados.' : 'Nenhum caso pendente na fila.'}
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
                            <span className={`fila-priority fila-priority--${(currentCase.priority || 'normal').toLowerCase()}`}>
                                {currentCase.priority === 'HIGH' ? 'Alta' : 'Normal'}
                            </span>
                        </div>
                        <div className="mobile-card__badges">
                            <SlaBadge caseData={currentCase} />
                            <RiskChip value={currentCase.riskLevel} />
                            <RiskChip value={currentCase.criminalFlag} />
                            <ScoreBar score={currentCase.riskScore ?? null} />
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
                                    {assumingCaseId === currentCase.id ? 'Assumindo...' : 'Assumir'}
                                </button>
                            )}
                            <button className="btn-secondary" onClick={() => navigate(`${routePrefix}/ops/caso/${currentCase.id}`)}>
                                Abrir
                            </button>
                        </div>
                        {currentCase.assigneeName && (
                            <div className="mobile-card__meta">
                                <span className="mobile-card__meta-item" style={{ color: 'var(--text-secondary)' }}>
                                    Responsavel: {currentCase.assigneeName}
                                </span>
                            </div>
                        )}
                    </>
                )}
            >
                {/* Desktop table */}
                <div className="fila-page__table-wrapper">
                    <table className="fila-table" aria-label="Fila de trabalho">
                        <thead>
                            <tr>
                                <th scope="col" style={{ width: 36 }}>
                                    <input type="checkbox" checked={queue.length > 0 && selected.size === queue.length} onChange={toggleAll} disabled={bulkRunning} aria-label="Selecionar todos" />
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
                                <th scope="col">Score</th>
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
                                    <td><div className="skeleton skeleton--text" style={{ width: 48 }} /></td>
                                    <td><div className="skeleton" style={{ width: 56, height: 22, borderRadius: 99 }} /></td>
                                    <td />
                                </tr>
                            ))}
                            {!loading && error && (
                                <tr>
                                    <td colSpan={14} style={{ textAlign: 'center', padding: '48px', color: 'var(--red-700)' }}>
                                        {extractErrorMessage(error, 'Nao foi possivel carregar a fila de trabalho agora.')}
                                    </td>
                                </tr>
                            )}
                            {!loading && !error && queue.map((currentCase) => (
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
                                    <td><SlaBadge caseData={currentCase} /></td>
                                    <td style={{ textAlign: 'center' }}><EnrichmentIcon status={getOverallEnrichmentStatus(currentCase)} /></td>
                                    <td><RiskChip value={currentCase.criminalFlag} /></td>
                                    <td><ScoreBar score={currentCase.riskScore} /></td>
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
