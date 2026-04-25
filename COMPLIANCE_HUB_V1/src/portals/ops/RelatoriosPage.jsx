import { useEffect, useState } from 'react';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { fetchPublicReports, revokePublicReport } from '../../core/firebase/firestoreService';
import { getMockPublicReports } from '../../data/mockData';
import { extractErrorMessage } from '../../core/errorUtils';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import './RelatoriosPage.css';

function formatTs(value) {
    if (!value) return '—';
    const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isExpired(value) {
    if (!value) return false;
    const d = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
    return d < new Date();
}

function buildPublicReportUrl(token, isDemoMode, caseId) {
    if (!token) return '#';
    if (isDemoMode && caseId) return `${window.location.origin}/demo/r/${caseId}`;
    return `${window.location.origin}/r/${token}`;
}

export default function RelatoriosPage() {
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';
    const { selectedTenantId } = useTenant();
    const tenantId = selectedTenantId === ALL_TENANTS_ID ? null : selectedTenantId;

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [revoking, setRevoking] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        setFeedback('');
        if (isDemoMode) {
            setReports(getMockPublicReports(tenantId));
            setLoading(false);
            return;
        }
        fetchPublicReports(tenantId)
            .then((data) => setReports(data))
            .catch((err) => setError(extractErrorMessage(err, 'Nao foi possivel carregar os relatorios.')))
            .finally(() => setLoading(false));
    }, [tenantId, isDemoMode]);

    const filtered = reports.filter((r) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (r.candidateName || '').toLowerCase().includes(term) ||
            r.id.toLowerCase().includes(term)
        );
    });

    const handleRevoke = async (token) => {
        if (!window.confirm('Revogar este relatório tornará o link inativo. Confirmar?')) return;
        setRevoking(token);
        setFeedback('');
        try {
            await revokePublicReport(token);
            setReports((prev) => prev.map((r) => r.id === token ? { ...r, active: false } : r));
            setFeedback('Relatorio publico desativado com sucesso.');
        } catch (err) {
            alert(extractErrorMessage(err, 'Erro ao revogar relatório.'));
        } finally {
            setRevoking(null);
        }
    };

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

    return (
        <div className="relatorios-page">
            <div className="relatorios-header">
                <div>
                    <h2 className="relatorios-header__title">Relatórios Públicos</h2>
                    <p className="relatorios-header__subtitle">Links compartilháveis gerados pelo sistema</p>
                </div>
                <span className="relatorios-header__count">{reports.length} relatório(s)</span>
            </div>

            <div className="relatorios-toolbar">
                <div className="filter-bar__search">
                    <span className="filter-bar__search-icon" aria-hidden="true">🔍</span>
                    <input
                        type="text"
                        className="filter-bar__search-input"
                        placeholder="Buscar por candidato ou token..."
                        aria-label="Buscar relatórios"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {feedback && (
                <div className="relatorios-feedback" role="status">
                    {feedback}
                </div>
            )}

            <MobileDataCardList
                items={filtered}
                loading={loading}
                emptyMessage={error || 'Nenhum relatório encontrado.'}
                renderCard={(report) => {
                    const expired = isExpired(report.expiresAt);
                    const active = report.active !== false;
                    return (
                        <>
                            <div className="mobile-card__header">
                                <div className="mobile-card__title">{report.candidateName || '—'}</div>
                                {active && !expired
                                    ? <span className="relatorios-status relatorios-status--active">Ativo</span>
                                    : <span className="relatorios-status relatorios-status--inactive">{expired ? 'Expirado' : 'Revogado'}</span>
                                }
                            </div>
                            <div className="mobile-card__meta">
                                <span className="mobile-card__meta-item" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '.75rem' }}>
                                    <a href={isDemoMode && report.caseId ? `/demo/r/${report.caseId}` : `/r/${report.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-600)', textDecoration: 'none' }}>…{report.id.slice(-8)}</a>
                                </span>
                                <span className="mobile-card__meta-item">Criado: {formatTs(report.createdAt)}</span>
                                <span className="mobile-card__meta-item" style={{ color: expired ? 'var(--red-600)' : 'inherit', fontWeight: expired ? 600 : 400 }}>
                                    Expira: {formatTs(report.expiresAt)}{expired && ' EXPIRADO'}
                                </span>
                            </div>
                            {active && !expired && (
                                <div className="mobile-card__actions">
                                    <button
                                        className="caso-btn caso-btn--ghost relatorios-action-btn"
                                        disabled={revoking === report.id}
                                        onClick={() => handleOpen(report.id, report.caseId)}
                                    >
                                        Visualizar
                                    </button>
                                    <button
                                        className="caso-btn caso-btn--ghost relatorios-action-btn"
                                        disabled={revoking === report.id}
                                        onClick={() => handleCopy(report.id, report.caseId)}
                                    >
                                        Copiar
                                    </button>
                                    <button
                                        className="caso-btn caso-btn--ghost relatorios-action-btn relatorios-action-btn--danger"
                                        disabled={revoking === report.id}
                                        onClick={() => handleRevoke(report.id)}
                                    >
                                        {revoking === report.id ? 'Desativando...' : 'Desativar'}
                                    </button>
                                </div>
                            )}
                        </>
                    );
                }}
            >
                <div className="relatorios-table-wrapper">
                    <table className="data-table" aria-label="Relatórios públicos">
                        <thead>
                            <tr>
                                <th className="data-table__th" scope="col">Token</th>
                                <th className="data-table__th" scope="col">Candidato</th>
                                <th className="data-table__th" scope="col">Criado em</th>
                                <th className="data-table__th" scope="col">Expira em</th>
                                <th className="data-table__th" scope="col">Status</th>
                                <th className="data-table__th" scope="col">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={6} className="data-table__empty">Carregando...</td>
                                </tr>
                            )}
                            {!loading && error && (
                                <tr>
                                    <td colSpan={6} className="data-table__empty" style={{ color: 'var(--red-700)' }}>{error}</td>
                                </tr>
                            )}
                            {!loading && !error && filtered.map((report) => {
                                const expired = isExpired(report.expiresAt);
                                const active = report.active !== false;
                                return (
                                    <tr key={report.id} className="data-table__row">
                                        <td className="data-table__td data-table__td--mono" style={{ fontSize: '.75rem', letterSpacing: '.03em' }}>
                                            <a
                                                href={isDemoMode && report.caseId ? `/demo/r/${report.caseId}` : `/r/${report.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: 'var(--brand-600)', textDecoration: 'none' }}
                                            >
                                                …{report.id.slice(-8)}
                                            </a>
                                        </td>
                                        <td className="data-table__td">{report.candidateName || '—'}</td>
                                        <td className="data-table__td" style={{ fontSize: '.8125rem' }}>{formatTs(report.createdAt)}</td>
                                        <td className="data-table__td" style={{ fontSize: '.8125rem', color: expired ? 'var(--red-600)' : 'inherit', fontWeight: expired ? 600 : 400 }}>
                                            {formatTs(report.expiresAt)}
                                            {expired && <span style={{ marginLeft: 4, fontSize: '.72rem' }}>EXPIRADO</span>}
                                        </td>
                                        <td className="data-table__td">
                                            {active && !expired
                                                ? <span className="relatorios-status relatorios-status--active">Ativo</span>
                                                : <span className="relatorios-status relatorios-status--inactive">{expired ? 'Expirado' : 'Revogado'}</span>
                                            }
                                        </td>
                                        <td className="data-table__td">
                                            {active && !expired && (
                                                <div className="relatorios-actions">
                                                    <button
                                                        className="caso-btn caso-btn--ghost relatorios-action-btn relatorios-action-btn--inline"
                                                        disabled={revoking === report.id}
                                                        onClick={() => handleOpen(report.id, report.caseId)}
                                                    >
                                                        Visualizar
                                                    </button>
                                                    <button
                                                        className="caso-btn caso-btn--ghost relatorios-action-btn relatorios-action-btn--inline"
                                                        disabled={revoking === report.id}
                                                        onClick={() => handleCopy(report.id, report.caseId)}
                                                    >
                                                        Copiar
                                                    </button>
                                                    <button
                                                        className="caso-btn caso-btn--ghost relatorios-action-btn relatorios-action-btn--inline relatorios-action-btn--danger"
                                                        disabled={revoking === report.id}
                                                        onClick={() => handleRevoke(report.id)}
                                                    >
                                                        {revoking === report.id ? 'Desativando...' : 'Desativar'}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && !error && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="data-table__empty">Nenhum relatório encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </MobileDataCardList>
        </div>
    );
}
