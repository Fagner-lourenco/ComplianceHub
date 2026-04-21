import { useEffect, useMemo, useState } from 'react';
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
    if (!report) return { label: 'Indisponivel', tone: 'inactive' };
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

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            setFeedback('');
            try {
                const data = isDemoMode
                    ? getMockPublicReports(tenantId)
                    : await fetchClientPublicReports();
                if (!cancelled) {
                    setReports(data);
                }
            } catch (currentError) {
                if (!cancelled) {
                    setError(extractErrorMessage(currentError, 'Nao foi possivel carregar os relatorios publicos.'));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [isDemoMode, tenantId]);

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
            setFeedback('Link publico copiado com sucesso.');
        } catch {
            setFeedback('Nao foi possivel copiar o link agora.');
        }
    };

    const handleRevoke = async (report) => {
        if (!report?.token) return;
        if (!window.confirm('Desativar este relatorio tornara o link publico indisponivel. Confirmar?')) {
            return;
        }

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
            setFeedback('Relatorio publico desativado com sucesso.');
        } catch (currentError) {
            setFeedback(extractErrorMessage(currentError, 'Nao foi possivel desativar o relatorio.'));
        } finally {
            setBusyToken(null);
        }
    };

    return (
        <div className="client-public-reports">
            <section className="client-public-reports__hero">
                <div className="client-public-reports__hero-copy">
                    <h2>Relatorios Publicos</h2>
                    <p>
                        Gerencie os links publicos gerados para a sua franquia com isolamento por tenant,
                        acompanhamento de status e controle de compartilhamento.
                    </p>
                </div>
                <div className="client-public-reports__hero-count">
                    <strong>{summary.total}</strong>
                    <span>relatorio(s)</span>
                </div>
            </section>

            <section className="client-public-reports__stats" aria-label="Resumo dos relatorios publicos">
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
                        placeholder="Buscar por candidato, caso ou token..."
                        aria-label="Buscar relatorios publicos"
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

            <section className="client-public-reports__content" aria-label="Lista de relatorios publicos">
                <div className="client-public-reports__mobile-list">
                    {!loading && !error && filteredReports.map((report) => {
                        const status = getReportStatus(report);
                        const available = isReportAvailable(report);
                        return (
                            <article key={report.token || report.id} className="client-public-reports__card">
                                <div className="client-public-reports__card-head">
                                    <div>
                                        <h3>{report.candidateName || 'Relatorio sem candidato'}</h3>
                                        <p>{report.caseId ? `Caso ${report.caseId}` : `Token ...${(report.token || '').slice(-8)}`}</p>
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
                                        <dd>...{(report.token || '').slice(-8)}</dd>
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
                                        {busyToken === report.token ? 'Desativando...' : 'Desativar'}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>

                <div className="client-public-reports__table-wrapper">
                    <table className="data-table" aria-label="Relatorios publicos da franquia">
                        <thead>
                            <tr>
                                <th className="data-table__th" scope="col">Token</th>
                                <th className="data-table__th" scope="col">Candidato</th>
                                <th className="data-table__th" scope="col">Caso</th>
                                <th className="data-table__th" scope="col">Criado em</th>
                                <th className="data-table__th" scope="col">Expira em</th>
                                <th className="data-table__th" scope="col">Status</th>
                                <th className="data-table__th" scope="col">Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td className="data-table__empty" colSpan={7}>Carregando relatorios...</td>
                                </tr>
                            )}
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
                                        <td className="data-table__td data-table__td--mono">...{(report.token || '').slice(-8)}</td>
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
                                                    {busyToken === report.token ? 'Desativando...' : 'Desativar'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && !error && filteredReports.length === 0 && (
                                <tr>
                                    <td className="data-table__empty" colSpan={7}>Nenhum relatorio publico encontrado para a sua franquia.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
