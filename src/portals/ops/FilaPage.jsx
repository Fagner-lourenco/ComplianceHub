import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import ScoreBar from '../../ui/components/ScoreBar/ScoreBar';
import KpiCard from '../../ui/components/KpiCard/KpiCard';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { useCases } from '../../hooks/useCases';
import { logAuditEvent, updateCase } from '../../core/firebase/firestoreService';
import { formatDate } from '../../core/formatDate';
import './FilaPage.css';

export default function FilaPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
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

    useEffect(() => {
        return () => { clearTimeout(assumeErrorTimerRef.current); };
    }, []);

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

        if (dateFrom) result = result.filter((c) => (c.createdAt || '') >= dateFrom);
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
            await updateCase(currentCase.id, { assigneeId: user.uid, status: 'IN_PROGRESS' });
            await logAuditEvent({
                tenantId: currentCase.tenantId || null,
                userId: user.uid,
                userEmail: user.email,
                action: 'CASE_ASSIGNED',
                target: currentCase.id,
                detail: `Caso assumido: ${currentCase.candidateName}`,
            });
        } catch (err) {
            console.error('Error assuming case:', err);
            setAssumeError('Falha ao assumir o caso. Tente novamente.');
            clearTimeout(assumeErrorTimerRef.current);
            assumeErrorTimerRef.current = setTimeout(() => setAssumeError(null), 6000);
        } finally {
            setAssumingCaseId(null);
        }
    };

    return (
        <div className="fila-page">
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
                <input type="date" className="fila-filter-select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Data inicial" />
                <input type="date" className="fila-filter-select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Data final" />
            </div>

            <div className="fila-page__table-wrapper">
                <table className="fila-table" aria-label="Fila de trabalho">
                    <thead>
                        <tr>
                            <th scope="col">Candidato</th>
                            <th scope="col">Empresa</th>
                            <th scope="col">Cargo</th>
                            <th scope="col">Data</th>
                            <th scope="col">Prioridade</th>
                            <th scope="col">Status</th>
                            <th scope="col">Criminal</th>
                            <th scope="col">Score</th>
                            <th scope="col">Risco</th>
                            <th scope="col">Acoes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                                    Carregando fila...
                                </td>
                            </tr>
                        )}
                        {!loading && error && (
                            <tr>
                                <td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: 'var(--red-700)' }}>
                                    Nao foi possivel carregar a fila de trabalho agora.
                                </td>
                            </tr>
                        )}
                        {!loading && !error && queue.map((currentCase) => (
                            <tr
                                key={currentCase.id}
                                className={`fila-table__row ${currentCase.priority === 'HIGH' ? 'fila-table__row--high' : ''}`}
                            >
                                <td className="fila-table__td--name">{currentCase.candidateName}</td>
                                <td className="fila-table__td--tenant" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {currentCase.tenantName}
                                </td>
                                <td>{currentCase.candidatePosition}</td>
                                <td>{formatDate(currentCase.createdAt)}</td>
                                <td>
                                    <span className={`fila-priority fila-priority--${currentCase.priority.toLowerCase()}`}>
                                        {currentCase.priority === 'HIGH' ? 'Alta' : 'Normal'}
                                    </span>
                                </td>
                                <td><StatusBadge status={currentCase.status} /></td>
                                <td><RiskChip value={currentCase.criminalFlag} /></td>
                                <td><ScoreBar score={currentCase.riskScore} /></td>
                                <td><RiskChip value={currentCase.riskLevel} /></td>
                                <td>
                                    <div className="fila-actions">
                                        {!currentCase.assigneeId && (
                                            <button
                                                className="fila-btn fila-btn--assume"
                                                title="Assumir"
                                                disabled={assumingCaseId === currentCase.id}
                                                onClick={() => handleAssume(currentCase)}
                                            >
                                                {assumingCaseId === currentCase.id ? 'Assumindo...' : 'Assumir'}
                                            </button>
                                        )}
                                        <button className="fila-btn fila-btn--open" onClick={() => navigate(`/ops/caso/${currentCase.id}`)}>
                                            Abrir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && !error && queue.length === 0 && (
                            <tr>
                                <td colSpan={10} style={{ textAlign: 'center', padding: '48px' }}>
                                    <span style={{ fontSize: '2rem' }}>OK</span>
                                    <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>Nenhum caso pendente na fila.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
