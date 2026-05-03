import { useEffect, useMemo, useState, useCallback } from 'react';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import { useAuth } from '../../core/auth/useAuth';
import { extractErrorMessage } from '../../core/errorUtils';
import { fetchClientPublicReports, revokeClientPublicReport } from '../../core/firebase/firestoreService';
import { getMockPublicReports } from '../../data/mockData';
import './RelatoriosClientePage.css';

function formatTs(value) {
    if (!value) return '--';
    const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getReportStatus(report) {
    if (!report) return { label: 'Indisponível', tone: 'inactive' };
    if (report.status === 'REVOKED' || report.active === false) {
        return { label: 'Revogado', tone: 'inactive' };
    }
    if (report.status === 'EXPIRED') {
        return { label: 'Expirado', tone: 'inactive' };
    }
    return { label: 'Ativo', tone: 'active' };
}

function isReportAvailable(report) {
    return getReportStatus(report).tone === 'active';
}

function buildPublicReportUrl(token, isDemoMode, caseId) {
    if (!token) return '#';
    if (isDemoMode && caseId) return `${window.location.origin}/demo/r/${caseId}`;
    return `${window.location.origin}/r/${token}`;
}

export default function RelatoriosClientePage() {
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';
    const tenantId = userProfile?.tenantId || null;

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [busyToken, setBusyToken] = useState(null);
    const [feedback, setFeedback] = useState('');

    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);

    const [confirmRevoke, setConfirmRevoke] = useState(null);

    const load = useCallback(async (cursor = null, append = false) => {
        if (!append) {
            setLoading(true);
            setError(null);
            setFeedback('');
        } else {
            setLoadingMore(true);
        }
        try {
            const data = isDemoMode
                ? { reports: getMockPublicReports(tenantId), hasMore: false, nextCursor: null }
                : await fetchClientPublicReports(cursor, 50);
            if (!append) {
                setReports(data.reports);
            } else {
                setReports((prev) => [...prev, ...data.reports]);
            }
            setHasMore(data.hasMore);
            setNextCursor(data.nextCursor);
        } catch (currentError) {
            if (!append) {
                setError(extractErrorMessage(currentError, 'Não foi possível carregar os relatórios públicos.'));
            } else {
                setFeedback(extractErrorMessage(currentError, 'Não foi possível carregar mais relatórios.'));
            }
        } finally {
            if (!append) setLoading(false);
            else setLoadingMore(false);
        }
    }, [isDemoMode, tenantId]);

    useEffect(() => {
        load();
    }, [load]);

    const filteredReports = useMemo(() => {
        return reports.filter((report) => {
            const matchesSearch = !searchTerm || (
                (report.candidateName || '').toLowerCase().includes(searchTerm.toLowerCase())
                || (report.token || report.id || '').toLowerCase().includes(searchTerm.toLowerCase())
                || (report.caseId || '').toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (!matchesSearch) return false;
            if (statusFilter === 'ALL') return true;
            return getReportStatus(report).label.toUpperCase() === statusFilter;
        });
    }, [reports, searchTerm, statusFilter]);

    const summary = useMemo(() => {
        return reports.reduce((accumulator, report) => {
            const status = getReportStatus(report).label.toUpperCase();
            accumulator.total += 1;
            if (status === 'ATIVO') accumulator.active += 1;
            if (status === 'REVOGADO') accumulator.revoked += 1;
            if (status === 'EXPIRADO') accumulator.expired += 1;
            return accumulator;
        }, { total: 0, active: 0, revoked: 0, expired: 0 });
    }, [reports]);

    const handleOpen = (token, caseId) => {
        const url = buildPublicReportUrl(token, isDemoMode, caseId);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleCopy = async (token, caseId) => {
        try {
            await navigator.clipboard.writeText(buildPublicReportUrl(token, isDemoMode, caseId));
            setFeedback('Link público copiado com sucesso.');
        } catch {
            setFeedback('Não foi possível copiar o link agora.');
        }
    };

    const handleRevoke = async (report) => {
        if (!report?.token) return;
        setConfirmRevoke(report);
    };

    const confirmRevokeAction = async () => {
        const report = confirmRevoke;
        if (!report?.token) return;
        setBusyToken(report.token);
        setFeedback('');
        try {
            if (!isDemoMode) {
                await revokeClientPublicReport(report.token);
            }
            setReports((currentReports) => currentReports.map((currentReport) => (
                currentReport.token === report.token
                    ? { ...currentReport, active: false, status: 'REVOKED' }
                    : currentReport
            )));
            setFeedback('Relatório público revogado com sucesso.');
        } catch (currentError) {
            setFeedback(extractErrorMessage(currentError, 'Não foi possível revogar o relatório.'));
        } finally {
            setBusyToken(null);
            setConfirmRevoke(null);
        }
    };

    return (
        <PageShell size="default" className="client-public-reports">
            <PageHeader
                eyebrow="Compartilhamento"
                title="Links de relatório"
                description="Gerencie os links criados para compartilhar resultados com segurança."
                metric={{ value: summary.total, label: 'relatório(s)' }}
            />

            <section className="client-public-reports__stats" aria-label="Resumo dos relatórios públicos">
                <article className="client-public-reports__stat-card">
                    <strong>{summary.total}</strong>
                    <span>Total</span>
                </article>
                <article className="client-public-reports__stat-card client-public-reports__stat-card--active">
                    <strong>{summary.active}</strong>
                    <span>Ativos</span>
                </article>
                <article className="client-public-reports__stat-card client-public-reports__stat-card--warning">
                    <strong>{summary.expired}</strong>
                    <span>Expirados</span>
                </article>
                <article className="client-public-reports__stat-card client-public-reports__stat-card--inactive">
                    <strong>{summary.revoked}</strong>
                    <span>Revogados</span>
                </article>
            </section>

            <section className="client-public-reports__toolbar">
                <div className="filter-bar__search">
                    <span className="filter-bar__search-icon" aria-hidden="true">RL</span>
                    <input
                        type="text"
                        className="filter-bar__search-input"
                        placeholder="Buscar por candidato, solicitação ou link..."
                        aria-label="Buscar relatórios públicos"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>
                <select
                    className="filter-bar__select"
                    value={statusFilter}
                    aria-label="Filtrar por status"
                    onChange={(event) => setStatusFilter(event.target.value)}
                >
                    <option value="ALL">Todos os status</option>
                    <option value="ATIVO">Ativos</option>
                    <option value="EXPIRADO">Expirados</option>
                    <option value="REVOGADO">Revogados</option>
                </select>
            </section>

            {feedback && (
                <div className="client-public-reports__feedback" role="status">
                    {feedback}
                </div>
            )}

            <section className="client-public-reports__content" aria-label="Lista de relatórios públicos">
                <div className="client-public-reports__mobile-list">
                    {!loading && !error && filteredReports.map((report) => {
                        const status = getReportStatus(report);
                        const available = isReportAvailable(report);
                        return (
                            <article key={report.token || report.id} className="client-public-reports__card">
                                <div className="client-public-reports__card-head">
                                    <div>
                                        <h3>{report.candidateName || 'Relatório sem candidato'}</h3>
                                        <p>{report.caseId ? `Solicitação ${report.caseId}` : `Token …${(report.token || '').slice(-8)}`}</p>
                                    </div>
                                    <span className={`client-public-reports__status client-public-reports__status--${status.tone}`}>
                                        {status.label}
                                    </span>
                                </div>
                                <dl className="client-public-reports__meta">
                                    <div>
                                        <dt>Criado em</dt>
                                        <dd>{formatTs(report.createdAt)}</dd>
                                    </div>
                                    <div>
                                        <dt>Expira em</dt>
                                        <dd>{formatTs(report.expiresAt)}</dd>
                                    </div>
                                    <div>
                                        <dt>Token</dt>
                                        <dd>…{(report.token || '').slice(-8)}</dd>
                                    </div>
                                </dl>
                                <div className="client-public-reports__actions">
                                    <button type="button" className="client-public-reports__btn" disabled={!available} onClick={() => handleOpen(report.token, report.caseId)}>
                                        Visualizar
                                    </button>
                                    <button type="button" className="client-public-reports__btn" disabled={!available} onClick={() => handleCopy(report.token, report.caseId)}>
                                        Copiar link
                                    </button>
                                    <button
                                        type="button"
                                        className="client-public-reports__btn client-public-reports__btn--danger"
                                        disabled={!available || busyToken === report.token}
                                        onClick={() => handleRevoke(report)}
                                    >
                                        {busyToken === report.token ? 'Revogando…' : 'Revogar'}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>

                <div className="client-public-reports__table-wrapper">
                    <table className="data-table" aria-label="Relatórios públicos da empresa">
                        <thead>
                            <tr>
                                <th className="data-table__th" scope="col">Token</th>
                                <th className="data-table__th" scope="col">Candidato</th>
                                <th className="data-table__th" scope="col">Caso</th>
                                <th className="data-table__th" scope="col">Criado em</th>
                                <th className="data-table__th" scope="col">Expira em</th>
                                <th className="data-table__th" scope="col">Status</th>
                                <th className="data-table__th" scope="col">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && Array.from({ length: 4 }, (_, i) => (
                                <tr key={`sk-${i}`} aria-hidden="true">
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: `${50 + (i % 3) * 15}%` }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 80 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 64 }} /></td>
                                    <td className="data-table__td"><div className="skeleton" style={{ width: 56, height: 20, borderRadius: 10 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 60 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 50 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 40 }} /></td>
                                </tr>
                            ))}
                            {!loading && error && (
                                <tr>
                                    <td className="data-table__empty" colSpan={7} style={{ color: 'var(--red-700)' }}>{error}</td>
                                </tr>
                            )}
                            {!loading && !error && filteredReports.map((report) => {
                                const status = getReportStatus(report);
                                const available = isReportAvailable(report);
                                return (
                                    <tr key={report.token || report.id} className="data-table__row">
                                        <td className="data-table__td data-table__td--mono">…{(report.token || '').slice(-8)}</td>
                                        <td className="data-table__td">{report.candidateName || '--'}</td>
                                        <td className="data-table__td">{report.caseId || '--'}</td>
                                        <td className="data-table__td">{formatTs(report.createdAt)}</td>
                                        <td className="data-table__td">{formatTs(report.expiresAt)}</td>
                                        <td className="data-table__td">
                                            <span className={`client-public-reports__status client-public-reports__status--${status.tone}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="data-table__td">
                                            <div className="client-public-reports__table-actions">
                                                <button type="button" className="client-public-reports__btn client-public-reports__btn--inline" disabled={!available} onClick={() => handleOpen(report.token, report.caseId)}>
                                                    Visualizar
                                                </button>
                                                <button type="button" className="client-public-reports__btn client-public-reports__btn--inline" disabled={!available} onClick={() => handleCopy(report.token, report.caseId)}>
                                                    Copiar
                                                </button>
                                                <button
                                                    type="button"
                                                    className="client-public-reports__btn client-public-reports__btn--inline client-public-reports__btn--danger"
                                                    disabled={!available || busyToken === report.token}
                                                    onClick={() => handleRevoke(report)}
                                                >
                                                    {busyToken === report.token ? 'Revogando…' : 'Revogar'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && !error && filteredReports.length === 0 && (
                                <tr>
                                    <td className="data-table__empty" colSpan={7}>Nenhum relatório público encontrado para a sua empresa.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && !error && hasMore && (
                    <div className="client-public-reports__load-more">
                        <button
                            type="button"
                            className="client-public-reports__btn"
                            disabled={loadingMore}
                            onClick={() => load(nextCursor, true)}
                        >
                            {loadingMore ? 'Carregando…' : 'Carregar mais relatórios'}
                        </button>
                    </div>
                )}

                {!loading && !error && reports.length > 0 && (
                    <p className="client-public-reports__recorte" aria-live="polite">
                        {hasMore
                            ? `Mostrando ${reports.length} relatórios mais recentes.`
                            : `${reports.length} relatório(s) carregado(s).`}
                    </p>
                )}
            </section>

            {confirmRevoke && (
                <div
                    className="client-public-reports__modal-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="revoke-modal-title"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setConfirmRevoke(null);
                    }}
                >
                    <div className="client-public-reports__modal">
                        <h3 id="revoke-modal-title" className="client-public-reports__modal-title">
                            Revogar relatório público?
                        </h3>
                        <div className="client-public-reports__modal-body">
                            <p><strong>Candidato:</strong> {confirmRevoke.candidateName || 'Não informado'}</p>
                            <p><strong>Caso:</strong> {confirmRevoke.caseId || '--'}</p>
                            <p><strong>Link:</strong> …{(confirmRevoke.token || '').slice(-8)}</p>
                            <p className="client-public-reports__modal-risk">
                                Após a revogação, qualquer pessoa com este link perderá acesso ao relatório.
                                Esta ação será registrada na auditoria e não poderá ser desfeita.
                            </p>
                        </div>
                        <div className="client-public-reports__modal-actions">
                            <button
                                type="button"
                                className="client-public-reports__btn"
                                onClick={() => setConfirmRevoke(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="client-public-reports__btn client-public-reports__btn--danger"
                                disabled={busyToken === confirmRevoke.token}
                                onClick={confirmRevokeAction}
                            >
                                {busyToken === confirmRevoke.token ? 'Revogando…' : 'Revogar relatório'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
    );
}
