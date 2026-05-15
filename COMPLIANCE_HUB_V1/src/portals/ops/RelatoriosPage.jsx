import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { fetchOpsPublicReports, revokePublicReport } from '../../core/firebase/firestoreService';
import { getMockPublicReports } from '../../data/mockData';
import { extractErrorMessage } from '../../core/errorUtils';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import PaginationControls from '../../ui/components/PaginationControls/PaginationControls';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import './RelatoriosPage.css';

const PAGE_SIZE = 50;

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

function getReportCandidateName(report) {
    return report?.candidateName || report?.meta?.candidateName || '—';
}

function getReportStatus(report) {
    const active = report?.active !== false;
    const expired = isExpired(report?.expiresAt);
    if (!active) return 'REVOKED';
    if (expired) return 'EXPIRED';
    return 'ACTIVE';
}

function buildPublicReportUrl(token, isDemoMode, caseId) {
    if (!token) return '#';
    if (isDemoMode && caseId) return `${window.location.origin}/demo/r/${caseId}`;
    return `${window.location.origin}/r/${token}`;
}

function RevokeModal({ report, onConfirm, onCancel, loading }) {
    if (!report) return null;
    const name = getReportCandidateName(report);
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="revoke-title">
            <div className="modal-content" style={{ maxWidth: 480 }}>
                <h3 id="revoke-title" className="modal-title">Revogar relatório público</h3>
                <p className="modal-body">
                    O link público de <strong>{name}</strong> será desativado permanentemente.
                    O link <code>…{report.id.slice(-8)}</code> não será mais acessível externamente.
                </p>
                <p className="modal-body" style={{ color: 'var(--red-600)', fontSize: '.875rem' }}>
                    Esta ação será auditada e não pode ser desfeita.
                </p>
                <div className="modal-actions">
                    <button type="button" className="caso-btn caso-btn--ghost" onClick={onCancel} disabled={loading}>
                        Cancelar
                    </button>
                    <button type="button" className="caso-btn caso-btn--danger" onClick={onConfirm} disabled={loading}>
                        {loading ? 'Desativando…' : 'Confirmar revogação'}
                    </button>
                </div>
            </div>
        </div>
    );
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
    const [revokeTarget, setRevokeTarget] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
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
        fetchOpsPublicReports(tenantId)
            .then((data) => setReports(data))
            .catch((err) => setError(extractErrorMessage(err, 'Não foi possível carregar os relatórios.')))
            .finally(() => setLoading(false));
    }, [tenantId, isDemoMode]);

    const filtered = useMemo(() => reports.filter((r) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const name = getReportCandidateName(r).toLowerCase();
        return name.includes(term) || r.id.toLowerCase().includes(term);
    }), [reports, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedReports = useMemo(() => {
        const start = (safeCurrentPage - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, safeCurrentPage]);

    const handleRevokeClick = (report) => {
        setRevokeTarget(report);
        setFeedback('');
    };

    const handleRevokeConfirm = async () => {
        if (!revokeTarget) return;
        setRevoking(revokeTarget.id);
        try {
            await revokePublicReport(revokeTarget.id);
            setReports((prev) => prev.map((r) => (r.id === revokeTarget.id ? { ...r, active: false } : r)));
            setFeedback('Relatório público desativado com sucesso.');
        } catch (err) {
            setFeedback(extractErrorMessage(err, 'Erro ao revogar relatório.'));
        } finally {
            setRevoking(null);
            setRevokeTarget(null);
        }
    };

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

    const reportCounts = useMemo(() => reports.reduce((acc, report) => {
        const status = getReportStatus(report);
        if (status === 'ACTIVE') acc.active += 1;
        if (status === 'EXPIRED') acc.expired += 1;
        if (status === 'REVOKED') acc.revoked += 1;
        return acc;
    }, { active: 0, expired: 0, revoked: 0 }), [reports]);

    return (
        <PageShell size="default" className="relatorios-page">
            <PageHeader
                eyebrow="Compartilhamento"
                title="Relatórios compartilhados"
                description="Gerencie links de acesso gerados para relatórios concluídos."
            />

            <div className="relatorios-toolbar">
                <div className="filter-bar__search">
                    <span className="filter-bar__search-icon" aria-hidden="true">🔍</span>
                    <input
                        type="text"
                        className="filter-bar__search-input"
                        placeholder="Buscar por candidato ou link..."
                        aria-label="Buscar relatórios"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <span className="relatorios-header__count" title="Ativos">{reportCounts.active} ativo(s)</span>
                <span className="relatorios-header__count" title="Expirados" style={{ opacity: 0.7 }}>{reportCounts.expired} exp.</span>
                <span className="relatorios-header__count" title="Revogados" style={{ opacity: 0.5 }}>{reportCounts.revoked} rev.</span>
            </div>

            {feedback && (
                <div className="relatorios-feedback" role="status">
                    {feedback}
                </div>
            )}

            <MobileDataCardList
                items={paginatedReports}
                loading={loading}
                emptyMessage={error || 'Nenhum relatório encontrado.'}
                renderCard={(report) => {
                    const status = getReportStatus(report);
                    const expired = status === 'EXPIRED';
                    const active = status === 'ACTIVE';
                    const name = getReportCandidateName(report);
                    return (
                        <>
                            <div className="mobile-card__header">
                                <div className="mobile-card__title">{name}</div>
                                {active
                                    ? <span className="relatorios-status relatorios-status--active">Ativo</span>
                                    : <span className="relatorios-status relatorios-status--inactive">{expired ? 'Expirado' : 'Revogado'}</span>
                                }
                            </div>
                            <div className="mobile-card__meta">
                                <span className="mobile-card__meta-item" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '.75rem' }}>
                                    <a href={isDemoMode && report.caseId ? `/demo/r/${report.caseId}` : `/r/${report.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-600)', textDecoration: 'none' }}>…{report.id.slice(-8)}</a>
                                </span>
                                <span className="mobile-card__meta-item">Empresa: {report.tenantId || '—'}</span>
                                <span className="mobile-card__meta-item">Criado: {formatTs(report.createdAt)}</span>
                                <span className="mobile-card__meta-item" style={{ color: expired ? 'var(--red-600)' : 'inherit', fontWeight: expired ? 600 : 400 }}>
                                    Expira: {formatTs(report.expiresAt)}{expired && ' EXPIRADO'}
                                </span>
                            </div>
                            {active && (
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
                                        onClick={() => handleRevokeClick(report)}
                                    >
                                        {revoking === report.id ? 'Desativando…' : 'Desativar'}
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
                                <th className="data-table__th" scope="col">Link</th>
                                <th className="data-table__th" scope="col">Candidato</th>
                                <th className="data-table__th" scope="col">Tenant</th>
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
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 70 }} /></td>
                                    <td className="data-table__td"><div className="skeleton" style={{ width: 60, height: 20, borderRadius: 10 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 60 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 56 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 40 }} /></td>
                                </tr>
                            ))}
                            {!loading && error && (
                                <tr>
                                    <td colSpan={7} className="data-table__empty" style={{ color: 'var(--red-700)' }}>{error}</td>
                                </tr>
                            )}
                            {!loading && !error && paginatedReports.map((report) => {
                                const status = getReportStatus(report);
                                const expired = status === 'EXPIRED';
                                const active = status === 'ACTIVE';
                                const name = getReportCandidateName(report);
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
                                        <td className="data-table__td">{name}</td>
                                        <td className="data-table__td" style={{ fontSize: '.8125rem' }}>{report.tenantId || '—'}</td>
                                        <td className="data-table__td" style={{ fontSize: '.8125rem' }}>{formatTs(report.createdAt)}</td>
                                        <td className="data-table__td" style={{ fontSize: '.8125rem', color: expired ? 'var(--red-600)' : 'inherit', fontWeight: expired ? 600 : 400 }}>
                                            {formatTs(report.expiresAt)}
                                            {expired && <span style={{ marginLeft: 4, fontSize: '.72rem' }}>EXPIRADO</span>}
                                        </td>
                                        <td className="data-table__td">
                                            {active
                                                ? <span className="relatorios-status relatorios-status--active">Ativo</span>
                                                : <span className="relatorios-status relatorios-status--inactive">{expired ? 'Expirado' : 'Revogado'}</span>
                                            }
                                        </td>
                                        <td className="data-table__td">
                                            {active && (
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
                                                        onClick={() => handleRevokeClick(report)}
                                                    >
                                                        {revoking === report.id ? 'Desativando…' : 'Desativar'}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!loading && !error && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="data-table__empty">Nenhum relatório encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </MobileDataCardList>

            <PaginationControls
                page={safeCurrentPage}
                pageSize={PAGE_SIZE}
                totalItems={filtered.length}
                itemLabel="relatórios"
                onPageChange={setCurrentPage}
            />

            {revokeTarget && (
                <RevokeModal
                    report={revokeTarget}
                    onConfirm={handleRevokeConfirm}
                    onCancel={() => setRevokeTarget(null)}
                    loading={Boolean(revoking)}
                />
            )}
        </PageShell>
    );
}
