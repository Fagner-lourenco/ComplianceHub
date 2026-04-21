import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import ScoreBar from '../../ui/components/ScoreBar/ScoreBar';
import KpiCard from '../../ui/components/KpiCard/KpiCard';
import Drawer from '../../ui/components/Drawer/Drawer';
import SocialLinks from '../../ui/components/SocialLinks/SocialLinks';
import { QuotaSummaryCard } from '../../ui/components/QuotaBar/QuotaBar';
import { useAuth } from '../../core/auth/useAuth';
import { ANALYSIS_PHASE_LABELS, callSubmitClientCorrection, callGetClientQuotaStatus, getCasePublicResult, getClientProjection, getEnabledPhases, getTenantSettings, saveClientPublicReport } from '../../core/firebase/firestoreService';
import { buildCaseReportPath, getReportAvailability, resolveClientCaseView } from '../../core/clientPortal';
import { buildClientPortalPath } from '../../core/portalPaths';
import { useCases } from '../../hooks/useCases';
import { getCaseStats } from '../../core/caseUtils';
import { formatDate } from '../../core/formatDate';
import { extractErrorMessage, getUserFriendlyMessage } from '../../core/errorUtils';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import FilterPanelMobile from '../../ui/components/FilterPanelMobile/FilterPanelMobile';
import './SolicitacoesPage.css';

function getMacroProgress(caseData) {
    if (caseData.status === 'DONE') return { label: 'Concluido', step: 3, color: 'var(--green-600)' };
    if (caseData.status === 'CORRECTION_NEEDED') return { label: 'Correcao solicitada', step: 1, color: 'var(--red-600)' };
    if (caseData.status === 'WAITING_INFO') return { label: 'Aguardando informacoes', step: 2, color: 'var(--yellow-700)' };
    if (caseData.status === 'IN_PROGRESS') return { label: 'Em analise', step: 2, color: 'var(--brand-600)' };
    return { label: 'Aguardando analise', step: 1, color: 'var(--text-tertiary)' };
}

export default function SolicitacoesPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';
    // Pass tenantId explicitly to ensure query is scoped to this client's tenant only
    const clientTenantId = isDemoMode ? undefined : (userProfile?.tenantId ?? undefined);
    const { cases, error, loading } = useCases(clientTenantId);
    const [selectedCase, setSelectedCase] = useState(null);
    const [publicResult, setPublicResult] = useState(null);
    const [publicResultLoading, setPublicResultLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [verdictFilter, setVerdictFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState('createdAt');
    const [sortDir, setSortDir] = useState('desc');
    const [heatmapMode, setHeatmapMode] = useState(false);
    const [tenantPhases, setTenantPhases] = useState([]);
    const [quota, setQuota] = useState(null);
    const [reportStatus, setReportStatus] = useState({ state: 'idle', message: '' });
    const [correctionForm, setCorrectionForm] = useState(null);
    const [correctionError, setCorrectionError] = useState(null);
    const [correctionSaving, setCorrectionSaving] = useState(false);

    useEffect(() => {
        if (!userProfile?.tenantId || isDemoMode) return;
        getTenantSettings(userProfile.tenantId).then((settings) => {
            setTenantPhases(getEnabledPhases(settings.analysisConfig));
        }).catch(() => {});
    }, [userProfile?.tenantId, isDemoMode]);

    useEffect(() => {
        if (!user || isDemoMode) return;
        callGetClientQuotaStatus()
            .then((data) => setQuota(data))
            .catch(() => {});
    }, [user, isDemoMode]);

    useEffect(() => {
        if (!selectedCase || selectedCase.status !== 'DONE') {
            setPublicResult(null);
            setPublicResultLoading(false);
            return;
        }
        if (isDemoMode) {
            setPublicResult(selectedCase.publicResultMock || null);
            return;
        }
        let cancelled = false;
        setPublicResultLoading(true);
        getClientProjection(selectedCase.id)
            .then(async (projection) => projection || getCasePublicResult(selectedCase.id))
            .then((data) => { if (!cancelled) setPublicResult(data || selectedCase.publicResultMock || null); })
            .catch(() => { if (!cancelled) setPublicResult(selectedCase.publicResultMock || null); })
            .finally(() => { if (!cancelled) setPublicResultLoading(false); });
        return () => { cancelled = true; };
    }, [isDemoMode, selectedCase]);

    useEffect(() => {
        setReportStatus({ state: 'idle', message: '' });
        setCorrectionForm(null);
        setCorrectionError(null);
    }, [selectedCase?.id]);

    const visiblePhases = useMemo(() => {
        const union = new Set();
        cases.forEach((caseData) => (caseData.enabledPhases || []).forEach((phase) => union.add(phase)));
        return union.size > 0 ? [...union] : tenantPhases;
    }, [cases, tenantPhases]);
    const has = (phase) => visiblePhases.includes(phase);
    const stats = useMemo(() => getCaseStats(cases), [cases]);
    const selectedCaseView = useMemo(() => (selectedCase ? resolveClientCaseView(selectedCase, publicResult) : null), [publicResult, selectedCase]);
    const reportAvailability = useMemo(() => getReportAvailability(selectedCase, publicResult), [publicResult, selectedCase]);

    const filteredCases = useMemo(() => {
        let result = [...cases];
        if (statusFilter !== 'ALL') result = result.filter((caseData) => caseData.status === statusFilter);
        if (verdictFilter !== 'ALL') result = result.filter((caseData) => caseData.finalVerdict === verdictFilter);
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter((caseData) => caseData.candidateName.toLowerCase().includes(term) || caseData.cpfMasked.includes(term) || caseData.id.toLowerCase().includes(term));
        }
        result.sort((left, right) => {
            let leftValue = left[sortField] ?? '';
            let rightValue = right[sortField] ?? '';
            if (sortField === 'createdAt') {
                leftValue = leftValue?.seconds ? leftValue.seconds : (leftValue ? new Date(leftValue).getTime() || 0 : 0);
                rightValue = rightValue?.seconds ? rightValue.seconds : (rightValue ? new Date(rightValue).getTime() || 0 : 0);
            }
            if (leftValue < rightValue) return sortDir === 'asc' ? -1 : 1;
            if (leftValue > rightValue) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [cases, searchTerm, sortDir, sortField, statusFilter, verdictFilter]);

    const handleSort = (field) => {
        if (sortField === field) setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
        else { setSortField(field); setSortDir('desc'); }
    };

    const handleOpenReport = async () => {
        if (!selectedCaseView || !reportAvailability.available) {
            setReportStatus({ state: 'unavailable', message: reportAvailability.message });
            return;
        }
        setReportStatus({ state: 'loading', message: 'Preparando relatorio...' });
        try {
            if (isDemoMode) {
                window.open(buildCaseReportPath(selectedCaseView, true), '_blank', 'noopener,noreferrer');
            } else {
                const token = reportAvailability.publicReportToken || await saveClientPublicReport(selectedCase.id);
                window.open(`/r/${token}`, '_blank', 'noopener,noreferrer');
            }
            setReportStatus({ state: 'success', message: 'Relatorio aberto com sucesso.' });
        } catch (currentError) {
            console.error('Error generating report:', currentError);
            setReportStatus({ state: 'error', message: extractErrorMessage(currentError, 'Nao foi possivel preparar o relatorio agora.') });
        }
    };

    const handleResubmit = async () => {
        if (!selectedCase || !correctionForm || !user) return;
        const name = (correctionForm.candidateName || '').trim();
        if (name.length < 3) {
            setCorrectionError('Nome precisa ter pelo menos 3 caracteres.');
            return;
        }
        const cpfDigits = (correctionForm.cpf || '').replace(/\D/g, '');
        if (cpfDigits.length !== 11) {
            setCorrectionError('CPF precisa ter 11 dígitos.');
            return;
        }
        setCorrectionSaving(true);
        setCorrectionError(null);
        try {
            await callSubmitClientCorrection({
                caseId: selectedCase.id,
                candidateName: correctionForm.candidateName,
                cpf: correctionForm.cpf,
                linkedin: correctionForm.linkedin,
                instagram: correctionForm.instagram,
            });
            setSelectedCase(null);
        } catch (currentError) {
            console.error(currentError);
            setCorrectionError(getUserFriendlyMessage(currentError, 'reenviar o caso'));
        } finally {
            setCorrectionSaving(false);
        }
    };

    const drawerTabs = selectedCase ? [
        {
            label: 'Resumo',
            content: (
                <div className="case-detail">
                    {publicResultLoading && <p style={{ color: 'var(--text-secondary)', fontSize: '.8125rem' }}>Carregando resultado...</p>}
                    {!publicResultLoading && selectedCase.status === 'DONE' && !selectedCaseView && (
                        <div className="case-detail__section" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem' }}>
                                ⏳ Resultado em processamento — disponível em breve.
                            </p>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '.75rem', marginTop: 6 }}>
                                Entre em contato com seu gestor caso demore mais do esperado.
                            </p>
                        </div>
                    )}
                    {selectedCaseView && (
                        <>
                            <div className="case-detail__risk-grid">
                                {[has('criminal') && { label: 'Criminal', value: selectedCaseView.criminalFlag }, has('labor') && { label: 'Trabalhista', value: selectedCaseView.laborFlag }, has('warrant') && { label: 'Mandado', value: selectedCaseView.warrantFlag }, has('osint') && { label: 'OSINT', value: selectedCaseView.osintLevel }, has('social') && { label: 'Social', value: selectedCaseView.socialStatus }, has('digital') && { label: 'Digital', value: selectedCaseView.digitalFlag }, { label: 'Score', value: null, score: selectedCaseView.riskScore || 0 }].filter(Boolean).map((item) => <div key={item.label} className="case-detail__risk-card"><div className="case-detail__risk-label">{item.label}</div>{item.score !== undefined && item.value === null ? <ScoreBar score={item.score} /> : <RiskChip value={item.value} size="md" />}</div>)}
                            </div>
                            {selectedCaseView.executiveSummary && <div className="case-detail__section"><h4>Resumo Executivo</h4><p>{selectedCaseView.executiveSummary}</p></div>}
                            {selectedCaseView.keyFindings?.length > 0 && <div className="case-detail__section"><h4>Principais Apontamentos</h4>{selectedCaseView.keyFindings.map((item) => <p key={item} className="case-detail__finding">• {item}</p>)}</div>}
                            {selectedCase.status !== 'DONE' && <div className="case-detail__section"><h4>Andamento</h4><p style={{ color: getMacroProgress(selectedCase).color }}>{getMacroProgress(selectedCase).label}</p></div>}
                        </>
                    )}
                </div>
            ),
        },
        {
            label: 'Detalhes',
            content: (
                <div className="case-detail">
                    <div className="case-detail__section">
                        <h4>Dados do Caso</h4>
                        <p><strong>Candidato:</strong> {selectedCase.candidateName}</p>
                        <p><strong>Cargo:</strong> {selectedCase.candidatePosition || '(não informado)'}</p>
                        <p><strong>CPF:</strong> {selectedCase.cpfMasked}</p>
                        <p><strong>Data da solicitacao:</strong> {formatDate(selectedCase.createdAt)}</p>
                        <p><strong>Situacao:</strong> {selectedCaseView?.statusSummary || getMacroProgress(selectedCase).label}</p>
                        {selectedCaseView?.sourceSummary && <p><strong>Origem dos dados:</strong> {selectedCaseView.sourceSummary}</p>}
                    </div>
                    {selectedCase.enabledPhases?.length > 0 && (
                        <div className="case-detail__section">
                            <h4>Fases da análise</h4>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                                {selectedCase.enabledPhases.map((phase) => {
                                    const isDone = selectedCase.status === 'DONE';
                                    const label = ANALYSIS_PHASE_LABELS[phase] || phase;
                                    return (
                                        <span
                                            key={phase}
                                            style={{
                                                fontSize: '.75rem',
                                                padding: '3px 9px',
                                                borderRadius: 12,
                                                background: isDone ? 'var(--green-50,#f0fdf4)' : 'var(--gray-100,#f3f4f6)',
                                                color: isDone ? 'var(--green-700,#15803d)' : 'var(--text-secondary)',
                                                border: `1px solid ${isDone ? 'var(--green-200,#bbf7d0)' : 'var(--border-light,#e5e7eb)'}`,
                                                fontWeight: 500,
                                            }}
                                        >
                                            {isDone ? '✓' : '○'} {label}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {(selectedCaseView?.processHighlights || []).map((group) => (
                        <div key={group.title || group.area} className="case-detail__section">
                            <h4>{group.title || group.area}</h4>
                            {group.summary && <p>{group.summary}</p>}
                            {(group.items || []).map((item) => (
                                <p key={item.processNumber || item.reference || item.classification} className="case-detail__finding">
                                    <strong>{item.processNumber || item.reference || item.classification}:</strong>{' '}
                                    {[item.court, item.classification, item.stage, item.status].filter(Boolean).join(' · ')}
                                </p>
                            ))}
                        </div>
                    ))}
                    {selectedCase.status === 'CORRECTION_NEEDED' && (
                        <div className="case-detail__section case-detail__section--alert">
                            <h4>Correção Solicitada</h4>
                            <p style={{ color: 'var(--red-700)', marginBottom: 12 }}>
                                <strong>Motivo:</strong> {selectedCase.correctionReason || 'Revisar dados cadastrais e perfis digitais.'}
                            </p>
                            {selectedCase.correctionNotes && (
                                <p style={{ marginTop: 6, marginBottom: 12, color: 'var(--text-secondary)', fontSize: '.875rem' }}>
                                    <strong>Detalhes:</strong> {selectedCase.correctionNotes}
                                </p>
                            )}
                            {!correctionForm ? (
                                <button
                                    className="btn-primary"
                                    style={{ fontSize: '.8125rem' }}
                                    onClick={() => setCorrectionForm({ candidateName: selectedCase.candidateName, cpf: selectedCase.cpf || '', linkedin: selectedCase.socialProfiles?.linkedin || '', instagram: selectedCase.socialProfiles?.instagram || '' })}
                                >
                                    Corrigir e reenviar
                                </button>
                            ) : (
                                <div className="correction-form">
                                    {correctionError && (
                                        <div className="correction-form__error">{correctionError}</div>
                                    )}
                                    <div className="correction-form__grid">
                                        <div className="correction-form__field">
                                            <label>Nome Completo</label>
                                            <input className="correction-form__input" value={correctionForm.candidateName} onChange={(event) => setCorrectionForm((current) => ({ ...current, candidateName: event.target.value }))} placeholder="Ex: João da Silva" />
                                        </div>
                                        <div className="correction-form__field">
                                            <label>CPF</label>
                                            <input className="correction-form__input" value={correctionForm.cpf} onChange={(event) => setCorrectionForm((current) => ({ ...current, cpf: event.target.value }))} placeholder="000.000.000-00" />
                                        </div>
                                        <div className="correction-form__field">
                                            <label>LinkedIn (URL ou @)</label>
                                            <input className="correction-form__input" value={correctionForm.linkedin} onChange={(event) => setCorrectionForm((current) => ({ ...current, linkedin: event.target.value }))} placeholder="https://linkedin.com/in/..." />
                                        </div>
                                        <div className="correction-form__field">
                                            <label>Instagram (URL ou @)</label>
                                            <input className="correction-form__input" value={correctionForm.instagram} onChange={(event) => setCorrectionForm((current) => ({ ...current, instagram: event.target.value }))} placeholder="https://instagram.com/..." />
                                        </div>
                                    </div>
                                    <div className="correction-form__actions">
                                        <button type="button" className="btn-secondary" onClick={() => setCorrectionForm(null)}>Cancelar</button>
                                        <button type="button" className="btn-primary" onClick={handleResubmit} disabled={correctionSaving || isDemoMode}>
                                            {correctionSaving ? 'Reenviando...' : isDemoMode ? 'Indisponivel no demo' : 'Reenviar para o Analista'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ),
        },
        {
            label: 'Redes Sociais',
            content: (
                <div className="case-detail">
                    <div className="case-detail__section"><h4>Perfis fornecidos</h4><SocialLinks profiles={selectedCase.socialProfiles || {}} size="md" showEmpty /></div>
                    {(selectedCaseView?.socialNotes || selectedCaseView?.digitalNotes) && <div className="case-detail__section"><h4>Leitura Executiva</h4>{selectedCaseView?.socialStatus && <p><strong>Status social:</strong> <RiskChip value={selectedCaseView.socialStatus} /></p>}{selectedCaseView?.socialReasons?.length > 0 && <p><strong>Motivos:</strong> {selectedCaseView.socialReasons.join(', ')}</p>}{selectedCaseView?.socialNotes && <p>{selectedCaseView.socialNotes}</p>}{selectedCaseView?.digitalFlag && <p><strong>Perfil digital:</strong> <RiskChip value={selectedCaseView.digitalFlag} /></p>}{selectedCaseView?.digitalNotes && <p>{selectedCaseView.digitalNotes}</p>}</div>}
                </div>
            ),
        },
        {
            label: 'Timeline',
            content: (
                <div className="case-detail"><div className="timeline">{(selectedCaseView?.timelineEvents || []).map((event, index) => <div key={`${event.type}-${index}`} className="timeline__item"><div className={`timeline__dot ${event.status === 'risk' ? 'timeline__dot--yellow' : event.status === 'current' ? 'timeline__dot--blue' : 'timeline__dot--green'}`} /><div className="timeline__content"><strong>{event.title}</strong><span className="timeline__date">{formatDate(event.at)}</span>{event.description && <span className="timeline__date">{event.description}</span>}</div></div>)}</div></div>
            ),
        },
        {
            label: 'Relatorio',
            content: (
                <div className="case-detail"><div className="case-detail__section"><h4>Disponibilidade</h4><p>{reportAvailability.message}</p>{selectedCaseView?.reportSlug && <p><strong>Identificador:</strong> {selectedCaseView.reportSlug}</p>}</div>{reportStatus.message && <p role={reportStatus.state === 'error' ? 'alert' : 'status'} style={{ color: reportStatus.state === 'error' ? 'var(--red-600)' : reportStatus.state === 'success' ? 'var(--green-700)' : 'var(--text-secondary)' }}>{reportStatus.message}</p>}<div className="case-detail__section"><button className="btn-primary" style={{ fontSize: '.8125rem' }} onClick={handleOpenReport} disabled={reportStatus.state === 'loading' || !reportAvailability.available}>{reportStatus.state === 'loading' ? 'Preparando...' : 'Abrir relatorio'}</button></div></div>
            ),
        },
    ] : [];

    return (
        <div className="solicitacoes-page">
            <div className="solicitacoes-page__header"><h2 className="solicitacoes-page__title">Minhas Solicitacoes</h2><button className="solicitacoes-page__cta" onClick={() => navigate(buildClientPortalPath(location.pathname, 'nova-solicitacao'))}>Nova Solicitacao</button></div>
            <div className="solicitacoes-page__kpis"><KpiCard label="Casos enviados" value={stats.total} color="neutral" onClick={() => { setStatusFilter('ALL'); setVerdictFilter('ALL'); }} /><KpiCard label="Concluidos" value={stats.done} color="green" onClick={() => setStatusFilter('DONE')} /><KpiCard label="Pendentes" value={stats.pending} color="yellow" onClick={() => setStatusFilter('PENDING')} />{stats.corrections > 0 && <KpiCard label="Correcao solicitada" value={stats.corrections} color="red" onClick={() => setStatusFilter('CORRECTION_NEEDED')} />}<KpiCard label="Nao recomendados" value={stats.notRecommended} color="red" onClick={() => setVerdictFilter('NOT_RECOMMENDED')} /></div>
            <QuotaSummaryCard quota={quota} />
            <FilterPanelMobile
                searchElement={
                    <div className="filter-bar__search"><span className="filter-bar__search-icon" aria-hidden="true">🔍</span><input type="text" placeholder="Buscar por nome, CPF ou ID..." aria-label="Buscar solicitacoes" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="filter-bar__search-input" /></div>
                }
                activeFilterCount={(statusFilter !== 'ALL' ? 1 : 0) + (verdictFilter !== 'ALL' ? 1 : 0) + (heatmapMode ? 1 : 0)}
            >
                <div className="solicitacoes-page__filters"><div className="filter-bar"><select className="filter-bar__select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Todos os status</option><option value="PENDING">Pendente</option><option value="IN_PROGRESS">Em analise</option><option value="WAITING_INFO">Aguardando info</option><option value="CORRECTION_NEEDED">Correcao necessaria</option><option value="DONE">Concluido</option></select><select className="filter-bar__select" value={verdictFilter} onChange={(event) => setVerdictFilter(event.target.value)}><option value="ALL">Todos os vereditos</option><option value="FIT">Apto</option><option value="ATTENTION">Atencao</option><option value="NOT_RECOMMENDED">Nao recomendado</option><option value="PENDING">Pendente</option></select><button className={`filter-bar__toggle ${heatmapMode ? 'filter-bar__toggle--active' : ''}`} onClick={() => setHeatmapMode((current) => !current)}>Heatmap</button></div></div>
            </FilterPanelMobile>
            <MobileDataCardList
                items={filteredCases}
                loading={loading}
                emptyMessage={error ? extractErrorMessage(error, 'Nao foi possivel carregar suas solicitacoes agora.') : 'Nenhuma solicitacao encontrada.'}
                renderCard={(caseData) => (
                    <div onClick={() => setSelectedCase(caseData)} style={{ display: 'contents' }}>
                        <div className="mobile-card__header">
                            <div>
                                <div className="mobile-card__title">{caseData.candidateName}</div>
                            </div>
                            <StatusBadge status={caseData.status} />
                        </div>
                        <div className="mobile-card__meta">
                            <span className="mobile-card__meta-item" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '.75rem' }}>{caseData.cpfMasked}</span>
                            {caseData.candidatePosition && <span className="mobile-card__meta-item">{caseData.candidatePosition}</span>}
                            <span className="mobile-card__meta-item">{formatDate(caseData.createdAt)}</span>
                        </div>
                        {caseData.status === 'DONE' && (
                            <div className="mobile-card__badges">
                                <RiskChip value={caseData.finalVerdict} bold size="md" />
                                <ScoreBar score={caseData.riskScore || 0} />
                                {caseData.hasNotes && <span>📝</span>}
                                {caseData.hasEvidence && <span>📎</span>}
                            </div>
                        )}
                        {caseData.status !== 'DONE' && (
                            <div style={{ fontSize: '.75rem', color: getMacroProgress(caseData).color, fontStyle: 'italic', marginTop: 4 }}>{getMacroProgress(caseData).label}</div>
                        )}
                    </div>
                )}
            >
                <div className="solicitacoes-page__table-wrapper"><table className="data-table" aria-label="Solicitacoes de due diligence"><thead><tr><th className="data-table__th data-table__th--sortable" scope="col" onClick={() => handleSort('candidateName')}>Nome {sortField === 'candidateName' && (sortDir === 'asc' ? '↑' : '↓')}</th><th className="data-table__th" scope="col">CPF</th><th className="data-table__th" scope="col">Cargo</th><th className="data-table__th data-table__th--sortable" scope="col" onClick={() => handleSort('createdAt')}>Data {sortField === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}</th><th className="data-table__th" scope="col">Status</th>{has('criminal') && <th className="data-table__th" scope="col">Criminal</th>}{has('labor') && <th className="data-table__th" scope="col">Trabalhista</th>}{has('warrant') && <th className="data-table__th" scope="col">Mandado</th>}{has('osint') && <th className="data-table__th" scope="col">OSINT</th>}{has('social') && <th className="data-table__th" scope="col">Social</th>}{has('digital') && <th className="data-table__th" scope="col">Digital</th>}<th className="data-table__th data-table__th--sortable" scope="col" onClick={() => handleSort('riskScore')}>Score {sortField === 'riskScore' && (sortDir === 'asc' ? '↑' : '↓')}</th><th className="data-table__th" scope="col">Veredito</th><th className="data-table__th" scope="col">Indicadores</th></tr></thead><tbody>{loading && <tr><td colSpan={14} className="data-table__empty">Carregando solicitacoes...</td></tr>}{!loading && error && <tr><td colSpan={14} className="data-table__empty" style={{ color: 'var(--red-700)' }}>{extractErrorMessage(error, 'Nao foi possivel carregar suas solicitacoes agora.')}</td></tr>}{!loading && !error && filteredCases.map((caseData) => <tr key={caseData.id} className={`data-table__row ${heatmapMode ? `data-table__row--heat-${caseData.riskLevel || 'none'}` : ''} ${selectedCase?.id === caseData.id ? 'data-table__row--selected' : ''}`} onClick={() => setSelectedCase(caseData)}><td className="data-table__td data-table__td--name">{caseData.candidateName}</td><td className="data-table__td data-table__td--mono">{caseData.cpfMasked}</td><td className="data-table__td">{caseData.candidatePosition}</td><td className="data-table__td">{formatDate(caseData.createdAt)}</td><td className="data-table__td"><StatusBadge status={caseData.status} />{caseData.status !== 'DONE' && <span style={{ display: 'block', fontSize: '.6875rem', color: getMacroProgress(caseData).color, fontStyle: 'italic', marginTop: 2 }}>{getMacroProgress(caseData).label}</span>}</td>{has('criminal') && <td className="data-table__td">{caseData.status === 'DONE' ? <RiskChip value={caseData.criminalFlag} /> : <span className="data-table__hidden">—</span>}</td>}{has('labor') && <td className="data-table__td">{caseData.status === 'DONE' ? <RiskChip value={caseData.laborFlag} /> : <span className="data-table__hidden">—</span>}</td>}{has('warrant') && <td className="data-table__td">{caseData.status === 'DONE' ? <RiskChip value={caseData.warrantFlag} /> : <span className="data-table__hidden">—</span>}</td>}{has('osint') && <td className="data-table__td">{caseData.status === 'DONE' ? <RiskChip value={caseData.osintLevel} /> : <span className="data-table__hidden">—</span>}</td>}{has('social') && <td className="data-table__td">{caseData.status === 'DONE' ? <RiskChip value={caseData.socialStatus} /> : <span className="data-table__hidden">—</span>}</td>}{has('digital') && <td className="data-table__td">{caseData.status === 'DONE' ? <RiskChip value={caseData.digitalFlag} /> : <span className="data-table__hidden">—</span>}</td>}<td className="data-table__td">{caseData.status === 'DONE' ? <ScoreBar score={caseData.riskScore || 0} /> : <span className="data-table__hidden">—</span>}</td><td className="data-table__td">{caseData.status === 'DONE' ? <RiskChip value={caseData.finalVerdict} bold size="md" /> : <span className="data-table__hidden">—</span>}</td><td className="data-table__td">{caseData.hasNotes && '📝 '}{caseData.hasEvidence && '📎'}</td></tr>)}{!loading && !error && filteredCases.length === 0 && <tr><td colSpan={14} className="data-table__empty"><div className="empty-state"><span className="empty-state__icon">📭</span><p>Nenhuma solicitacao encontrada.</p><button className="empty-state__btn" onClick={() => { setStatusFilter('ALL'); setVerdictFilter('ALL'); setSearchTerm(''); }}>Limpar filtros</button></div></td></tr>}</tbody></table></div>
            </MobileDataCardList>
            <div className="solicitacoes-page__pagination">Mostrando {filteredCases.length} de {cases.length} registros</div>
            <Drawer open={Boolean(selectedCase)} onClose={() => setSelectedCase(null)} title={selectedCase?.candidateName} subtitle={`${selectedCase?.candidatePosition || ''} · ${selectedCase?.cpfMasked || ''}`} headerExtra={selectedCaseView?.finalVerdict ? <RiskChip value={selectedCaseView.finalVerdict} bold size="lg" /> : null} tabs={drawerTabs} />
        </div>
    );
}
