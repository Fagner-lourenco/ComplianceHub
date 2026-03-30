import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import ScoreBar from '../../ui/components/ScoreBar/ScoreBar';
import KpiCard from '../../ui/components/KpiCard/KpiCard';
import Drawer from '../../ui/components/Drawer/Drawer';
import SocialLinks from '../../ui/components/SocialLinks/SocialLinks';
import { useAuth } from '../../core/auth/useAuth';
import { getEnabledPhases, getTenantSettings, logAuditEvent, updateCase } from '../../core/firebase/firestoreService';
import { useCases } from '../../hooks/useCases';
import { getCaseStats } from '../../data/mockData';
import { formatDate } from '../../core/formatDate';
import { buildCaseReportHtml } from '../../core/reportBuilder';
import { savePublicReport } from '../../core/firebase/firestoreService';
import './SolicitacoesPage.css';

export default function SolicitacoesPage() {
    const navigate = useNavigate();
    const {
        cases,
        error,
        loading,
    } = useCases();   // auto-detects tenantId from auth
    const [selectedCase, setSelectedCase] = useState(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [verdictFilter, setVerdictFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [heatmapMode, setHeatmapMode] = useState(false);
    const [sortField, setSortField] = useState('createdAt');
    const [sortDir, setSortDir] = useState('desc');

    const { user, userProfile } = useAuth();
    const [tenantPhases, setTenantPhases] = useState([]);
    const [tenantLimits, setTenantLimits] = useState({ dailyLimit: null, monthlyLimit: null });
    const [correctionForm, setCorrectionForm] = useState(null);
    const [correctionSaving, setCorrectionSaving] = useState(false);
    const [correctionError, setCorrectionError] = useState(null);

    useEffect(() => {
        const tid = userProfile?.tenantId;
        if (!tid) return;
        getTenantSettings(tid).then((s) => {
            setTenantPhases(getEnabledPhases(s.analysisConfig));
            setTenantLimits({ dailyLimit: s.dailyLimit ?? null, monthlyLimit: s.monthlyLimit ?? null });
        }).catch(() => {});
    }, [userProfile?.tenantId]);

    // Derive visible columns from the union of all cases' enabledPhases, falling back to tenant config
    const visiblePhases = useMemo(() => {
        const union = new Set();
        for (const c of cases) {
            if (Array.isArray(c.enabledPhases)) {
                c.enabledPhases.forEach((p) => union.add(p));
            }
        }
        return union.size > 0 ? [...union] : tenantPhases;
    }, [cases, tenantPhases]);

    const stats = useMemo(() => {
        const base = getCaseStats(cases);
        base.corrections = cases.filter(c => c.status === 'CORRECTION_NEEDED').length;
        return base;
    }, [cases]);

    const usage = useMemo(() => {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const monthStr = now.toISOString().slice(0, 7);
        let daily = 0;
        let monthly = 0;
        for (const c of cases) {
            const d = c.createdAt?.slice?.(0, 10) || '';
            if (d === todayStr) daily++;
            if (d.slice(0, 7) === monthStr) monthly++;
        }
        return { daily, monthly };
    }, [cases]);
    const has = (phase) => visiblePhases.includes(phase);
    const analysisColumnCount = ['criminal', 'labor', 'warrant', 'osint', 'social', 'digital'].filter(has).length;
    const columnCount = 6 + analysisColumnCount + 1;

    const filteredCases = useMemo(() => {
        let result = [...cases];
        if (statusFilter !== 'ALL') result = result.filter(c => c.status === statusFilter);
        if (verdictFilter !== 'ALL') result = result.filter(c => c.finalVerdict === verdictFilter);
        if (dateFrom) result = result.filter(c => (c.createdAt || '') >= dateFrom);
        if (dateTo) result = result.filter(c => (c.createdAt || '').slice(0, 10) <= dateTo);
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const digitsOnly = searchTerm.replace(/\D/g, '');
            result = result.filter(c =>
                c.candidateName.toLowerCase().includes(term) ||
                c.cpfMasked.includes(term) ||
                (digitsOnly && c.cpfMasked.replace(/\D/g, '').includes(digitsOnly)) ||
                c.id.toLowerCase().includes(term)
            );
        }
        result.sort((a, b) => {
            const raw_a = a[sortField];
            const raw_b = b[sortField];
            const isNum = typeof raw_a === 'number' || typeof raw_b === 'number';
            const va = isNum ? (raw_a ?? 0) : (raw_a ?? '');
            const vb = isNum ? (raw_b ?? 0) : (raw_b ?? '');
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [cases, statusFilter, verdictFilter, dateFrom, dateTo, searchTerm, sortField, sortDir]);

    // Clear selectedCase if it's no longer in filtered results  
    if (selectedCase && !filteredCases.some(c => c.id === selectedCase.id)) {
        setSelectedCase(null);
    }

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
    if (dateFrom) activeFilters.push({ key: 'dateFrom', label: `De: ${dateFrom}`, clear: () => setDateFrom('') });
    if (dateTo) activeFilters.push({ key: 'dateTo', label: `Ate: ${dateTo}`, clear: () => setDateTo('') });

    const isDone = selectedCase?.status === 'DONE';

    const handleStartCorrection = () => {
        if (!selectedCase) return;
        setCorrectionForm({
            candidateName: selectedCase.candidateName,
            cpf: selectedCase.cpf || '',
            instagram: selectedCase.socialProfiles?.instagram || '',
            facebook: selectedCase.socialProfiles?.facebook || '',
            linkedin: selectedCase.socialProfiles?.linkedin || '',
            tiktok: selectedCase.socialProfiles?.tiktok || '',
            twitter: selectedCase.socialProfiles?.twitter || '',
            youtube: selectedCase.socialProfiles?.youtube || '',
        });
        setCorrectionError(null);
    };

    const handleResubmit = async () => {
        if (!selectedCase || !correctionForm || !user) return;
        setCorrectionSaving(true);
        setCorrectionError(null);
        try {
            const cpfClean = correctionForm.cpf.replace(/\D/g, '');
            const cpfMasked = cpfClean.length >= 11 ? `***.***.***-${cpfClean.slice(9)}` : selectedCase.cpfMasked;
            await updateCase(selectedCase.id, {
                status: 'PENDING',
                candidateName: correctionForm.candidateName,
                cpf: cpfClean,
                cpfMasked,
                socialProfiles: {
                    instagram: correctionForm.instagram,
                    facebook: correctionForm.facebook,
                    linkedin: correctionForm.linkedin,
                    tiktok: correctionForm.tiktok,
                    twitter: correctionForm.twitter,
                    youtube: correctionForm.youtube,
                },
                correctedAt: new Date().toISOString(),
                correctedBy: user.email,
            });
            await logAuditEvent({
                tenantId: selectedCase.tenantId || userProfile?.tenantId || null,
                userId: user.uid,
                userEmail: user.email,
                action: 'CASE_CORRECTED',
                target: selectedCase.id,
                detail: `Caso corrigido e reenviado: ${correctionForm.candidateName}`,
            });
            setCorrectionForm(null);
            setSelectedCase(null);
        } catch (err) {
            console.error('Error resubmitting case:', err);
            setCorrectionError('Nao foi possivel reenviar. Tente novamente.');
        } finally {
            setCorrectionSaving(false);
        }
    };

    const drawerTabs = selectedCase ? [
        {
            label: 'Resumo',
            content: (
                <div className="case-detail">
                    <div className="case-detail__risk-grid">
                        {[
                            has('criminal') && { label: 'Criminal', value: selectedCase.criminalFlag },
                            has('labor') && { label: 'Trabalhista', value: selectedCase.laborFlag },
                            has('warrant') && { label: 'Mandado', value: selectedCase.warrantFlag },
                            has('osint') && { label: 'OSINT', value: selectedCase.osintLevel },
                            has('social') && { label: 'Social', value: selectedCase.socialStatus },
                            has('digital') && { label: 'Digital', value: selectedCase.digitalFlag },
                            has('conflictInterest') && { label: 'Conflito', value: selectedCase.conflictInterest },
                            { label: 'Score', value: null, score: selectedCase.riskScore },
                        ].filter(Boolean).map((item, i) => (
                            <div key={i} className="case-detail__risk-card">
                                <div className="case-detail__risk-label">{item.label}</div>
                                {item.score !== undefined && item.value === null
                                    ? <ScoreBar score={item.score} />
                                    : <RiskChip value={item.value} size="md" />}
                            </div>
                        ))}
                    </div>
                    {selectedCase.analystComment && (
                        <div className="case-detail__section">
                            <h4>Parecer do Analista</h4>
                            <p>{selectedCase.analystComment}</p>
                        </div>
                    )}
                    {isDone && selectedCase.finalVerdict && (
                        <div className="case-detail__section">
                            <h4>Veredito Final</h4>
                            <RiskChip value={selectedCase.finalVerdict} size="md" bold />
                        </div>
                    )}
                    {isDone && (
                        <div className="case-detail__section">
                            <button
                                className="btn-primary"
                                style={{ fontSize: '.8125rem' }}
                                onClick={async () => {
                                    const html = buildCaseReportHtml(selectedCase);
                                    try {
                                        const token = await savePublicReport(html, { type: 'single', candidateName: selectedCase.candidateName || '', tenantId: selectedCase.tenantId || '' });
                                        window.open(`/r/${token}`, '_blank');
                                    } catch { alert('Erro ao gerar link do relatório.'); }
                                }}
                            >
                                🖨️ Gerar Relatório
                            </button>
                        </div>
                    )}
                    {selectedCase.status === 'CORRECTION_NEEDED' && (
                        <div className="case-detail__section" style={{ background: 'var(--red-50)', border: '1px solid var(--red-200)', borderRadius: 8, padding: 16 }}>
                            <h4 style={{ color: 'var(--red-700)', margin: '0 0 8px' }}>Correcao solicitada</h4>
                            {selectedCase.correctionReason && <p style={{ margin: '0 0 4px' }}><strong>Motivo:</strong> {selectedCase.correctionReason}</p>}
                            {selectedCase.correctionNotes && <p style={{ margin: '0 0 4px' }}><strong>Observacao:</strong> {selectedCase.correctionNotes}</p>}
                            {selectedCase.correctionRequestedBy && <p style={{ margin: '0 0 12px', fontSize: '.8125rem', color: 'var(--text-secondary)' }}>Solicitado por: {selectedCase.correctionRequestedBy}</p>}
                            {!correctionForm ? (
                                <button className="btn-primary" style={{ fontSize: '.8125rem' }} onClick={handleStartCorrection}>Corrigir e reenviar</button>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                                    {correctionError && <p style={{ color: 'var(--red-600)', fontSize: '.8125rem' }}>{correctionError}</p>}
                                    <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>Nome</label>
                                    <input className="form-input" value={correctionForm.candidateName} onChange={(e) => setCorrectionForm(f => ({ ...f, candidateName: e.target.value }))} />
                                    <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>CPF</label>
                                    <input className="form-input" value={correctionForm.cpf} onChange={(e) => setCorrectionForm(f => ({ ...f, cpf: e.target.value }))} />
                                    <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>Instagram</label>
                                    <input className="form-input" value={correctionForm.instagram} onChange={(e) => setCorrectionForm(f => ({ ...f, instagram: e.target.value }))} />
                                    <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>Facebook</label>
                                    <input className="form-input" value={correctionForm.facebook} onChange={(e) => setCorrectionForm(f => ({ ...f, facebook: e.target.value }))} />
                                    <label style={{ fontSize: '.8125rem', fontWeight: 600 }}>LinkedIn</label>
                                    <input className="form-input" value={correctionForm.linkedin} onChange={(e) => setCorrectionForm(f => ({ ...f, linkedin: e.target.value }))} />
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        <button type="button" className="btn-secondary" onClick={() => setCorrectionForm(null)}>Cancelar</button>
                                        <button type="button" className="btn-primary" disabled={correctionSaving} onClick={handleResubmit}>
                                            {correctionSaving ? 'Reenviando...' : 'Reenviar'}
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
            label: 'Detalhes',
            content: (
                <div className="case-detail">
                    {isDone ? (
                        <>
                            {has('criminal') && selectedCase.criminalFlag && (
                                <div className="case-detail__section">
                                    <h4>🔴 Criminal</h4>
                                    <p><strong>Resultado:</strong> <RiskChip value={selectedCase.criminalFlag} /></p>
                                    {selectedCase.criminalSeverity && <p className="case-detail__finding"><strong>Severidade:</strong> {selectedCase.criminalSeverity}</p>}
                                    {selectedCase.criminalNotes && <p>{selectedCase.criminalNotes}</p>}
                                </div>
                            )}
                            {has('labor') && selectedCase.laborFlag && (
                                <div className="case-detail__section">
                                    <h4>⚖️ Trabalhista</h4>
                                    <p><strong>Resultado:</strong> <RiskChip value={selectedCase.laborFlag} /></p>
                                    {selectedCase.laborSeverity && <p className="case-detail__finding"><strong>Severidade:</strong> {selectedCase.laborSeverity}</p>}
                                    {selectedCase.laborNotes && <p>{selectedCase.laborNotes}</p>}
                                </div>
                            )}
                            {has('warrant') && selectedCase.warrantFlag && (
                                <div className="case-detail__section">
                                    <h4>🔒 Mandado de Prisão</h4>
                                    <p><strong>Resultado:</strong> <RiskChip value={selectedCase.warrantFlag} /></p>
                                    {selectedCase.warrantNotes && <p>{selectedCase.warrantNotes}</p>}
                                </div>
                            )}
                            {has('osint') && selectedCase.osintLevel && (
                                <div className="case-detail__section">
                                    <h4>🔍 OSINT</h4>
                                    <p><strong>Nível:</strong> <RiskChip value={selectedCase.osintLevel} /></p>
                                    {selectedCase.osintVectors?.length > 0 && <p className="case-detail__finding"><strong>Vetores:</strong> {selectedCase.osintVectors.join(', ')}</p>}
                                    {selectedCase.osintNotes && <p>{selectedCase.osintNotes}</p>}
                                </div>
                            )}
                            {has('social') && selectedCase.socialStatus && (
                                <div className="case-detail__section">
                                    <h4>👥 Social</h4>
                                    <p><strong>Status:</strong> <RiskChip value={selectedCase.socialStatus} /></p>
                                    {selectedCase.socialReasons?.length > 0 && <p className="case-detail__finding"><strong>Motivos:</strong> {selectedCase.socialReasons.join(', ')}</p>}
                                    {selectedCase.socialNotes && <p>{selectedCase.socialNotes}</p>}
                                </div>
                            )}
                            {has('digital') && selectedCase.digitalFlag && (
                                <div className="case-detail__section">
                                    <h4>💻 Perfil Digital</h4>
                                    <p><strong>Resultado:</strong> <RiskChip value={selectedCase.digitalFlag} /></p>
                                    {selectedCase.digitalVectors?.length > 0 && <p className="case-detail__finding"><strong>Vetores:</strong> {selectedCase.digitalVectors.join(', ')}</p>}
                                    {selectedCase.digitalNotes && <p>{selectedCase.digitalNotes}</p>}
                                </div>
                            )}
                            {has('conflictInterest') && selectedCase.conflictInterest && (
                                <div className="case-detail__section">
                                    <h4>⚠️ Conflito de Interesse</h4>
                                    <p><strong>Resultado:</strong> <RiskChip value={selectedCase.conflictInterest} /></p>
                                    {selectedCase.conflictNotes && <p>{selectedCase.conflictNotes}</p>}
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
                    {selectedCase.digitalNotes && (
                        <div className="case-detail__section" style={{ marginTop: 16 }}>
                            <h4>Resultado da Análise Digital</h4>
                            <RiskChip value={selectedCase.digitalFlag} size="md" />
                            <p style={{ marginTop: 8 }}>{selectedCase.digitalNotes}</p>
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
                        {(selectedCase.status === 'CORRECTION_NEEDED' || selectedCase.correctedAt) && (
                            <div className="timeline__item">
                                <div className="timeline__dot" style={{ background: 'var(--red-500)' }} />
                                <div className="timeline__content">
                                    <strong>Correção solicitada</strong>
                                    <span className="timeline__date">{selectedCase.correctionRequestedAt || '—'}</span>
                                </div>
                            </div>
                        )}
                        {selectedCase.correctedAt && (
                            <div className="timeline__item">
                                <div className="timeline__dot timeline__dot--green" />
                                <div className="timeline__content">
                                    <strong>Corrigido e reenviado</strong>
                                    <span className="timeline__date">{selectedCase.correctedAt}</span>
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
                {stats.corrections > 0 && (
                    <KpiCard label="Correções pendentes" value={stats.corrections} color="red" onClick={() => setStatusFilter('CORRECTION_NEEDED')} />
                )}
                <KpiCard label="Alertas 🔴" value={stats.red} color="red" onClick={() => setVerdictFilter('NOT_RECOMMENDED')} />
            </div>

            {/* Usage badges */}
            {(tenantLimits.dailyLimit || tenantLimits.monthlyLimit) && (
                <div style={{ display: 'flex', gap: 16, fontSize: '.8125rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                    {tenantLimits.dailyLimit && (
                        <span style={{ background: usage.daily >= tenantLimits.dailyLimit ? 'var(--red-50)' : 'var(--bg-card)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-light)', color: usage.daily >= tenantLimits.dailyLimit ? 'var(--red-700)' : undefined }}>
                            Hoje: {usage.daily}/{tenantLimits.dailyLimit}
                        </span>
                    )}
                    {tenantLimits.monthlyLimit && (
                        <span style={{ background: usage.monthly >= tenantLimits.monthlyLimit ? 'var(--red-50)' : 'var(--bg-card)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-light)', color: usage.monthly >= tenantLimits.monthlyLimit ? 'var(--red-700)' : undefined }}>
                            Mês: {usage.monthly}/{tenantLimits.monthlyLimit}
                        </span>
                    )}
                </div>
            )}

            {/* Filters */}
            <div className="solicitacoes-page__filters">
                <div className="filter-bar">
                    <div className="filter-bar__search">
                        <span className="filter-bar__search-icon" aria-hidden="true">🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar por nome, CPF ou ID..."
                            aria-label="Buscar solicitacoes"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="filter-bar__search-input"
                        />
                    </div>
                    <select className="filter-bar__select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="ALL">Todos os status</option>
                        <option value="PENDING">Pendente</option>
                        <option value="IN_PROGRESS">Em Análise</option>
                        <option value="WAITING_INFO">Aguardando Info</option>                        <option value="CORRECTION_NEEDED">Corre\xe7\xe3o Necess\xe1ria</option>                        <option value="DONE">Concluído</option>
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
                    <input type="date" className="filter-bar__select" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Data inicial" />
                    <input type="date" className="filter-bar__select" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Data final" />
                </div>

                {activeFilters.length > 0 && (
                    <div className="filter-chips">
                        {activeFilters.map(f => (
                            <span key={f.key} className="filter-chip">
                                {f.label}
                                <button className="filter-chip__remove" onClick={f.clear}>✕</button>
                            </span>
                        ))}
                        <button className="filter-chips__clear" onClick={() => { setStatusFilter('ALL'); setVerdictFilter('ALL'); setSearchTerm(''); setDateFrom(''); setDateTo(''); }}>
                            Limpar filtros
                        </button>
                    </div>
                )}
            </div>

            {/* DataTable */}
            <div className="solicitacoes-page__table-wrapper">
                <table className="data-table" aria-label="Solicitacoes de due diligence">
                    <thead>
                        <tr>
                            <th className="data-table__th data-table__th--sortable" scope="col" onClick={() => handleSort('candidateName')}>
                                Nome {sortField === 'candidateName' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="data-table__th" scope="col">CPF</th>
                            <th className="data-table__th" scope="col">Cargo</th>
                            <th className="data-table__th data-table__th--sortable" scope="col" onClick={() => handleSort('createdAt')}>
                                Data {sortField === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="data-table__th" scope="col">Status</th>
                            {has('criminal') && <th className="data-table__th" scope="col">Criminal</th>}
                            {has('labor') && <th className="data-table__th" scope="col">Trabalhista</th>}
                            {has('warrant') && <th className="data-table__th" scope="col">Mandado</th>}
                            {has('osint') && <th className="data-table__th" scope="col">OSINT</th>}
                            {has('social') && <th className="data-table__th" scope="col">Social</th>}
                            {has('digital') && <th className="data-table__th" scope="col">Digital</th>}
                            <th className="data-table__th data-table__th--sortable" scope="col" onClick={() => handleSort('riskScore')}>
                                Score {sortField === 'riskScore' && (sortDir === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="data-table__th" scope="col">Veredito</th>
                            <th className="data-table__th" scope="col">📎</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={columnCount} className="data-table__empty">
                                    Carregando solicitacoes...
                                </td>
                            </tr>
                        )}
                        {!loading && error && (
                            <tr>
                                <td colSpan={columnCount} className="data-table__empty" style={{ color: 'var(--red-700)' }}>
                                    Nao foi possivel carregar suas solicitacoes agora.
                                </td>
                            </tr>
                        )}
                        {!loading && !error && filteredCases.map(c => (
                            <tr
                                key={c.id}
                                className={`data-table__row ${heatmapMode ? `data-table__row--heat-${c.riskLevel || 'none'}` : ''} ${selectedCase?.id === c.id ? 'data-table__row--selected' : ''}`}
                                onClick={() => setSelectedCase(c)}
                            >
                                <td className="data-table__td data-table__td--name">{c.candidateName}</td>
                                <td className="data-table__td data-table__td--mono">{c.cpfMasked}</td>
                                <td className="data-table__td">{c.candidatePosition}</td>
                                <td className="data-table__td">{formatDate(c.createdAt)}</td>
                                <td className="data-table__td"><StatusBadge status={c.status} /></td>
                                {has('criminal') && <td className="data-table__td"><RiskChip value={c.criminalFlag} /></td>}
                                {has('labor') && <td className="data-table__td"><RiskChip value={c.laborFlag} /></td>}
                                {has('warrant') && <td className="data-table__td"><RiskChip value={c.warrantFlag} /></td>}
                                {has('osint') && <td className="data-table__td"><RiskChip value={c.osintLevel} /></td>}
                                {has('social') && <td className="data-table__td"><RiskChip value={c.socialStatus} /></td>}
                                {has('digital') && <td className="data-table__td"><RiskChip value={c.digitalFlag} /></td>}
                                <td className="data-table__td"><ScoreBar score={c.riskScore} /></td>
                                <td className="data-table__td"><RiskChip value={c.finalVerdict} bold size="md" /></td>
                                <td className="data-table__td">
                                    {c.hasNotes && '📝'}
                                    {c.hasEvidence && '📎'}
                                </td>
                            </tr>
                        ))}
                        {!loading && !error && filteredCases.length === 0 && (
                            <tr>
                                <td colSpan={columnCount} className="data-table__empty">
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
