import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import ScoreBar from '../../ui/components/ScoreBar/ScoreBar';
import SocialLinks from '../../ui/components/SocialLinks/SocialLinks';
import { useAuth } from '../../core/auth/useAuth';
import {
    DEFAULT_ANALYSIS_CONFIG,
    getCase as getCaseFromFirestore,
    getEnabledPhases,
    getTenantSettings,
    logAuditEvent,
    updateCase,
} from '../../core/firebase/firestoreService';
import { deleteField } from 'firebase/firestore';
import { MOCK_CASE_DETAILS, MOCK_CASES } from '../../data/mockData';
import { buildCaseReportHtml } from '../../core/reportBuilder';
import { savePublicReport } from '../../core/firebase/firestoreService';
import './CasoPage.css';

const LEGACY_PHASES = Object.keys(DEFAULT_ANALYSIS_CONFIG);

const CRIMINAL_OPTIONS = ['NEGATIVE', 'POSITIVE', 'INCONCLUSIVE', 'NOT_FOUND'];
const LABOR_OPTIONS = ['NEGATIVE', 'POSITIVE', 'INCONCLUSIVE', 'NOT_FOUND'];
const WARRANT_OPTIONS = ['NEGATIVE', 'POSITIVE', 'NOT_FOUND'];
const SEVERITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'];
const OSINT_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'];
const SOCIAL_OPTIONS = ['APPROVED', 'NEUTRAL', 'CONCERN', 'CONTRAINDICATED'];
const DIGITAL_OPTIONS = ['CLEAN', 'ALERT', 'CRITICAL', 'NOT_CHECKED'];
const CONFLICT_OPTIONS = ['YES', 'NO', 'UNKNOWN'];
const VERDICT_OPTIONS = ['FIT', 'ATTENTION', 'NOT_RECOMMENDED'];

const CORRECTION_REASONS = [
    'CPF incorreto',
    'Nome divergente',
    'Redes sociais invalidas',
    'Dados incompletos',
    'Outro',
];

function createInitialForm(caseData) {
    return {
        criminalFlag: caseData?.criminalFlag || '',
        criminalSeverity: caseData?.criminalSeverity || '',
        criminalNotes: caseData?.criminalNotes || '',
        laborFlag: caseData?.laborFlag || '',
        laborSeverity: caseData?.laborSeverity || '',
        laborNotes: caseData?.laborNotes || '',
        warrantFlag: caseData?.warrantFlag || '',
        warrantNotes: caseData?.warrantNotes || '',
        osintLevel: caseData?.osintLevel || '',
        osintVectors: caseData?.osintVectors || [],
        osintNotes: caseData?.osintNotes || '',
        socialStatus: caseData?.socialStatus || '',
        socialReasons: caseData?.socialReasons || [],
        socialNotes: caseData?.socialNotes || '',
        digitalFlag: caseData?.digitalFlag || '',
        digitalVectors: caseData?.digitalVectors || [],
        digitalNotes: caseData?.digitalNotes || '',
        conflictInterest: caseData?.conflictInterest || '',
        conflictNotes: caseData?.conflictNotes || '',
        finalVerdict: caseData?.finalVerdict && caseData.finalVerdict !== 'PENDING' ? caseData.finalVerdict : '',
        analystComment: caseData?.analystComment || '',
    };
}

function calculateRisk(form, enabledPhases) {
    const scores = {
        NEGATIVE: 0,
        NOT_FOUND: 5,
        INCONCLUSIVE: 40,
        POSITIVE: 90,
        LOW: 0,
        UNKNOWN: 20,
        MEDIUM: 50,
        HIGH: 90,
        APPROVED: 0,
        NEUTRAL: 10,
        CONCERN: 50,
        CONTRAINDICATED: 90,
        CLEAN: 0,
        NOT_CHECKED: 10,
        ALERT: 45,
        CRITICAL: 85,
        NO: 0,
        YES: 60,
    };

    const ep = enabledPhases || LEGACY_PHASES;
    const phaseScores = [];
    if (ep.includes('criminal')) phaseScores.push(scores[form.criminalFlag] || 0);
    if (ep.includes('labor')) phaseScores.push(scores[form.laborFlag] || 0);
    if (ep.includes('warrant')) phaseScores.push(scores[form.warrantFlag] || 0);
    if (ep.includes('osint')) phaseScores.push(scores[form.osintLevel] || 0);
    if (ep.includes('social')) phaseScores.push(scores[form.socialStatus] || 0);
    if (ep.includes('digital')) phaseScores.push(scores[form.digitalFlag] || 0);
    if (ep.includes('conflictInterest')) phaseScores.push(scores[form.conflictInterest] || 0);
    let riskScore = Math.max(...phaseScores, 0);

    const yellowSignals = [
        ep.includes('criminal') && form.criminalFlag === 'INCONCLUSIVE',
        ep.includes('labor') && form.laborFlag === 'INCONCLUSIVE',
        ep.includes('warrant') && form.warrantFlag === 'INCONCLUSIVE',
        ep.includes('osint') && form.osintLevel === 'MEDIUM',
        ep.includes('social') && form.socialStatus === 'CONCERN',
        ep.includes('digital') && form.digitalFlag === 'ALERT',
    ].filter(Boolean).length;

    if (yellowSignals >= 2) {
        riskScore = Math.min(100, riskScore + 15);
    }

    let riskLevel = 'GREEN';
    if (phaseScores.some((s) => s >= 80)) {
        riskLevel = 'RED';
    } else if (riskScore >= 30) {
        riskLevel = 'YELLOW';
    }

    let suggestedVerdict = 'FIT';
    if (riskScore >= 70) {
        suggestedVerdict = 'NOT_RECOMMENDED';
    } else if (riskScore >= 30) {
        suggestedVerdict = 'ATTENTION';
    }

    return { riskLevel, riskScore, suggestedVerdict };
}

export default function CasoPage() {
    const { caseId } = useParams();
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';
    const [caseData, setCaseData] = useState(null);
    const [caseError, setCaseError] = useState(null);
    const [loadingCase, setLoadingCase] = useState(true);
    const [activeStep, setActiveStep] = useState(0);
    const [form, setForm] = useState(createInitialForm(null));
    const [concluded, setConcluded] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [enabledPhases, setEnabledPhases] = useState(LEGACY_PHASES);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnReason, setReturnReason] = useState('');
    const [returnNotes, setReturnNotes] = useState('');
    const [returning, setReturning] = useState(false);
    const [returnError, setReturnError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function loadCase() {
            setLoadingCase(true);
            setCaseError(null);
            setConcluded(false);
            setSaveError(null);

            if (isDemoMode) {
                const demoCase = MOCK_CASES.find((currentCase) => currentCase.id === caseId) || null;

                if (!cancelled) {
                    setCaseData(demoCase);
                    setLoadingCase(false);
                    if (!demoCase) {
                        setCaseError('Caso demo nao encontrado.');
                    }
                }

                return;
            }

            try {
                const nextCase = await getCaseFromFirestore(caseId);

                if (cancelled) {
                    return;
                }

                if (!nextCase) {
                    setCaseData(null);
                    setCaseError('Caso nao encontrado no ambiente real.');
                } else {
                    setCaseData(nextCase);
                }
            } catch (error) {
                if (cancelled) {
                    return;
                }

                console.error('Error loading case:', error);
                setCaseData(null);
                setCaseError('Nao foi possivel carregar este caso agora.');
            } finally {
                if (!cancelled) {
                    setLoadingCase(false);
                }
            }
        }

        void loadCase();

        return () => {
            cancelled = true;
        };
    }, [caseId, isDemoMode]);

    useEffect(() => {
        setForm(createInitialForm(caseData));
        setActiveStep(0);
        if (caseData?.enabledPhases) {
            setEnabledPhases(caseData.enabledPhases);
        } else if (caseData?.tenantId) {
            getTenantSettings(caseData.tenantId).then((settings) => {
                setEnabledPhases(getEnabledPhases(settings.analysisConfig));
            }).catch(() => {});
        } else {
            setEnabledPhases(LEGACY_PHASES);
        }
    }, [caseData]);

    const steps = useMemo(() => {
        const result = [{ key: 'identification', label: 'Identificacao' }];
        if (enabledPhases.includes('criminal')) result.push({ key: 'criminal', label: 'Criminal' });
        if (enabledPhases.includes('labor')) result.push({ key: 'labor', label: 'Trabalhista' });
        if (enabledPhases.includes('warrant')) result.push({ key: 'warrant', label: 'Mandado de Prisao' });
        const hasOsint = enabledPhases.includes('osint');
        const hasSocial = enabledPhases.includes('social');
        if (hasOsint || hasSocial) {
            result.push({ key: 'osint_social', label: hasOsint && hasSocial ? 'OSINT e Social' : hasOsint ? 'OSINT' : 'Social' });
        }
        const hasDigital = enabledPhases.includes('digital');
        const hasConflict = enabledPhases.includes('conflictInterest');
        if (hasDigital || hasConflict) {
            result.push({ key: 'digital', label: hasDigital ? 'Perfil Digital' : 'Conflito de Interesse' });
        }
        result.push({ key: 'review', label: 'Revisao' });
        return result;
    }, [enabledPhases]);

    const currentStepKey = steps[activeStep]?.key;

    const update = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
    };

    const toggleVector = (field, value) => {
        setForm((previous) => {
            const current = Array.isArray(previous[field]) ? previous[field] : [];
            return {
                ...previous,
                [field]: current.includes(value)
                    ? current.filter((currentValue) => currentValue !== value)
                    : [...current, value],
            };
        });
    };

    const risk = useMemo(() => calculateRisk(form, enabledPhases), [form, enabledPhases]);

    const checklist = [
        enabledPhases.includes('criminal') && { label: 'Criminal definido', ok: Boolean(form.criminalFlag) },
        enabledPhases.includes('labor') && { label: 'Trabalhista definido', ok: Boolean(form.laborFlag) },
        enabledPhases.includes('warrant') && { label: 'Mandado de prisao definido', ok: Boolean(form.warrantFlag) },
        enabledPhases.includes('osint') && { label: 'OSINT definido', ok: Boolean(form.osintLevel) },
        enabledPhases.includes('social') && { label: 'Social definido', ok: Boolean(form.socialStatus) },
        enabledPhases.includes('digital') && { label: 'Perfil digital definido', ok: Boolean(form.digitalFlag) },
        enabledPhases.includes('conflictInterest') && { label: 'Conflito de interesse definido', ok: Boolean(form.conflictInterest) },
        { label: 'Veredito final definido', ok: Boolean(form.finalVerdict) },
    ].filter(Boolean);
    const allOk = checklist.every((item) => item.ok);
    const detail = isDemoMode && caseData ? MOCK_CASE_DETAILS[caseData.id] : null;

    const handleReturn = async () => {
        if (!caseData || !returnReason || returning) return;
        setReturnError(null);

        if (isDemoMode) {
            setShowReturnModal(false);
            return;
        }

        if (!user) {
            setReturnError('Sessao indisponivel.');
            return;
        }

        setReturning(true);
        try {
            const correction = {
                reason: returnReason,
                notes: returnNotes,
                requestedAt: new Date().toISOString(),
                requestedBy: user.email,
            };
            await updateCase(caseData.id, {
                status: 'CORRECTION_NEEDED',
                correctionReason: returnReason,
                correctionNotes: returnNotes,
                correctionRequestedAt: correction.requestedAt,
                correctionRequestedBy: user.email,
            });
            await logAuditEvent({
                tenantId: caseData.tenantId || null,
                userId: user.uid,
                userEmail: user.email,
                action: 'CASE_RETURNED',
                target: caseData.id,
                detail: `Caso devolvido: ${returnReason}`,
            });
            setCaseData((prev) => ({ ...prev, status: 'CORRECTION_NEEDED', correctionReason: returnReason, correctionNotes: returnNotes }));
            setShowReturnModal(false);
            setReturnReason('');
            setReturnNotes('');
        } catch (err) {
            console.error('Error returning case:', err);
            setReturnError('Nao foi possivel devolver o caso agora.');
        } finally {
            setReturning(false);
        }
    };

    const isCorrectionNeeded = caseData?.status === 'CORRECTION_NEEDED';

    const handleConclude = async () => {
        if (!caseData || !allOk || saving) {
            return;
        }

        setSaveError(null);

        if (isDemoMode) {
            setConcluded(true);
            return;
        }

        if (!user) {
            setSaveError('Sua sessao nao esta disponivel para concluir o caso.');
            return;
        }

        setSaving(true);

        try {
            await updateCase(caseData.id, {
                status: 'DONE',
                assigneeId: caseData.assigneeId || user.uid,
                criminalFlag: form.criminalFlag,
                criminalSeverity: form.criminalSeverity || null,
                criminalNotes: form.criminalNotes,
                laborFlag: form.laborFlag || null,
                laborSeverity: form.laborSeverity || null,
                laborNotes: form.laborNotes,
                warrantFlag: form.warrantFlag || null,
                warrantNotes: form.warrantNotes,
                osintLevel: form.osintLevel,
                osintVectors: form.osintVectors,
                osintNotes: form.osintNotes,
                socialStatus: form.socialStatus,
                socialReasons: form.socialReasons,
                socialNotes: form.socialNotes,
                digitalFlag: form.digitalFlag,
                digitalVectors: form.digitalVectors,
                digitalNotes: form.digitalNotes,
                conflictInterest: form.conflictInterest,
                conflictNotes: form.conflictNotes,
                finalVerdict: form.finalVerdict,
                analystComment: form.analystComment,
                riskLevel: risk.riskLevel,
                riskScore: risk.riskScore,
                enabledPhases: caseData.enabledPhases || enabledPhases,
                correctionReason: deleteField(),
                correctionNotes: deleteField(),
                correctionRequestedAt: deleteField(),
                correctionRequestedBy: deleteField(),
                hasNotes: Boolean(
                    form.criminalNotes
                    || form.laborNotes
                    || form.warrantNotes
                    || form.osintNotes
                    || form.socialNotes
                    || form.digitalNotes
                    || form.conflictNotes
                    || form.analystComment
                ),
            });

            await logAuditEvent({
                tenantId: caseData.tenantId || null,
                userId: user.uid,
                userEmail: user.email,
                action: 'CASE_CONCLUDED',
                target: caseData.id,
                detail: `Caso concluido para ${caseData.candidateName}`,
            });

            setCaseData((currentCase) => ({
                ...currentCase,
                ...form,
                status: 'DONE',
                assigneeId: currentCase.assigneeId || user.uid,
                riskLevel: risk.riskLevel,
                riskScore: risk.riskScore,
                hasNotes: true,
            }));
            setConcluded(true);
        } catch (error) {
            console.error('Error concluding case:', error);
            setSaveError('Nao foi possivel concluir o caso agora.');
        } finally {
            setSaving(false);
        }
    };

    if (loadingCase) {
        return (
            <div className="caso-page">
                <div className="caso-section">
                    <h3>Carregando caso</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Estamos sincronizando os dados reais deste caso.</p>
                </div>
            </div>
        );
    }

    if (caseError || !caseData) {
        return (
            <div className="caso-page">
                <div className="caso-section">
                    <h3>Caso indisponivel</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>{caseError || 'Nao foi possivel localizar este caso.'}</p>
                    <div className="caso-step-nav">
                        <div />
                        <button className="caso-btn caso-btn--primary" onClick={() => navigate('/ops/casos')}>
                            Voltar para casos
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (concluded) {
        return (
            <div className="caso-page">
                <div className="caso-success animate-scaleIn">
                    <span style={{ fontSize: '3rem' }}>OK</span>
                    <h2>Caso concluido com sucesso</h2>
                    <p>O resultado foi salvo e ja pode ser consultado no portal correspondente.</p>
                    <button className="caso-btn caso-btn--primary" onClick={() => navigate('/ops/fila')}>
                        Voltar para a fila
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="caso-page">
            <div className="caso-header">
                <div className="caso-header__info">
                    <h2>{caseData.candidateName}</h2>
                    <div className="caso-header__meta">
                        <StatusBadge status={caseData.status} />
                        <span className="caso-header__id">{caseData.id}</span>
                        <span className="caso-header__cpf">{caseData.cpf || caseData.cpfMasked}</span>
                        <span className="caso-header__tenant" style={{ fontSize: '.75rem', padding: '2px 6px', background: 'var(--gray-200)', borderRadius: '4px', fontWeight: 600 }}>
                            {caseData.tenantName}
                        </span>
                    </div>
                </div>
                <div className="caso-header__actions">
                    <button className="caso-btn caso-btn--ghost" onClick={() => navigate('/ops/fila')}>Voltar</button>
                    {!isCorrectionNeeded && caseData.status !== 'DONE' && (
                        <button className="caso-btn caso-btn--warning" onClick={() => setShowReturnModal(true)}>Devolver ao cliente</button>
                    )}
                    {caseData.status === 'DONE' && (
                        <button className="caso-btn caso-btn--ghost" onClick={async () => {
                            const html = buildCaseReportHtml(caseData);
                            try {
                                const token = await savePublicReport(html, { type: 'single', candidateName: caseData.candidateName || '', tenantId: caseData.tenantId || '' });
                                window.open(`/r/${token}`, '_blank');
                            } catch { alert('Erro ao gerar link do relatório.'); }
                        }}>🖨️ Relatório</button>
                    )}
                    <button className="caso-btn caso-btn--primary" disabled={!allOk || saving || isCorrectionNeeded} onClick={handleConclude}>
                        {saving ? 'Salvando...' : 'Concluir'}
                    </button>
                </div>
            </div>

            <div className="stepper">
                {steps.map((step, index) => (
                    <button
                        key={step.key}
                        className={`stepper__step ${index === activeStep ? 'stepper__step--active' : ''} ${index < activeStep ? 'stepper__step--done' : ''}`}
                        onClick={() => setActiveStep(index)}
                    >
                        <span className="stepper__number">{index < activeStep ? 'OK' : index + 1}</span>
                        <span className="stepper__label">{step.label}</span>
                    </button>
                ))}
            </div>

            {saveError && (
                <div className="caso-alert caso-alert--warning" style={{ marginBottom: '16px' }}>
                    {saveError}
                </div>
            )}

            {isCorrectionNeeded && (
                <div className="caso-alert" style={{ marginBottom: '16px', background: 'var(--red-50)', border: '1px solid var(--red-200)', color: 'var(--red-700)' }}>
                    <strong>Caso devolvido ao cliente para correcao.</strong>
                    {caseData.correctionReason && <span> Motivo: {caseData.correctionReason}.</span>}
                    {caseData.correctionNotes && <span> Obs: {caseData.correctionNotes}</span>}
                </div>
            )}

            <div className="caso-step-content animate-fadeInUp">
                {currentStepKey === 'identification' && (
                    <div className="caso-section">
                        <h3>Identificacao do candidato</h3>
                        <div className="caso-grid">
                            <div className="caso-field">
                                <label>Nome</label>
                                <input className="caso-input caso-input--readonly" value={caseData.candidateName} readOnly />
                            </div>
                            <div className="caso-field">
                                <label>CPF</label>
                                <input className="caso-input caso-input--readonly" value={caseData.cpf || caseData.cpfMasked} readOnly />
                            </div>
                            <div className="caso-field">
                                <label>Cargo</label>
                                <input className="caso-input caso-input--readonly" value={caseData.candidatePosition} readOnly />
                            </div>
                            <div className="caso-field">
                                <label>Data da solicitacao</label>
                                <input className="caso-input caso-input--readonly" value={caseData.createdAt} readOnly />
                            </div>
                        </div>

                        <h4 style={{ marginTop: 20 }}>Redes sociais fornecidas</h4>
                        <SocialLinks profiles={caseData.socialProfiles || {}} size="md" showEmpty />

                        <div className="caso-step-nav">
                            <div />
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {showReturnModal && (
                    <div className="modal-overlay">
                        <div className="modal-content" style={{ maxWidth: 480 }}>
                            <div className="modal-header">
                                <h3>Devolver ao cliente</h3>
                                <button className="modal-close" onClick={() => setShowReturnModal(false)} aria-label="Fechar">X</button>
                            </div>
                            <div className="modal-body">
                                <p style={{ fontSize: '.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                                    O caso sera devolvido ao cliente para correcao dos dados. As analises ja preenchidas serao mantidas.
                                </p>
                                {returnError && (
                                    <div role="alert" style={{ color: 'var(--red-600)', background: 'var(--red-50)', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                                        {returnError}
                                    </div>
                                )}
                                <div className="form-group">
                                    <label style={{ fontWeight: 600, fontSize: '.875rem' }}>Motivo *</label>
                                    <select className="form-input" value={returnReason} onChange={(e) => setReturnReason(e.target.value)}>
                                        <option value="">Selecione o motivo...</option>
                                        {CORRECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginTop: 12 }}>
                                    <label style={{ fontWeight: 600, fontSize: '.875rem' }}>Observacao</label>
                                    <textarea
                                        className="caso-textarea"
                                        value={returnNotes}
                                        onChange={(e) => setReturnNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Descreva o que precisa ser corrigido..."
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowReturnModal(false)}>Cancelar</button>
                                <button type="button" className="btn-primary" disabled={!returnReason || returning} onClick={handleReturn}>
                                    {returning ? 'Devolvendo...' : 'Devolver caso'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {currentStepKey === 'criminal' && (
                    <div className="caso-section">
                        <h3>Analise criminal</h3>
                        <div className="caso-grid">
                            <div className="caso-field">
                                <label>Resultado <span className="caso-req">*</span></label>
                                <div className="caso-select-group">
                                    {CRIMINAL_OPTIONS.map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            className={`caso-select-btn ${form.criminalFlag === option ? 'caso-select-btn--active' : ''}`}
                                            onClick={() => update('criminalFlag', option)}
                                        >
                                            <RiskChip value={option} size="sm" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {form.criminalFlag === 'POSITIVE' && (
                                <div className="caso-field">
                                    <label>Gravidade</label>
                                    <div className="caso-select-group">
                                        {SEVERITY_OPTIONS.map((option) => (
                                            <button
                                                key={option}
                                                type="button"
                                                className={`caso-select-btn ${form.criminalSeverity === option ? 'caso-select-btn--active' : ''}`}
                                                onClick={() => update('criminalSeverity', option)}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Resumo / notas</label>
                            <textarea
                                className="caso-textarea"
                                value={form.criminalNotes}
                                onChange={(event) => update('criminalNotes', event.target.value)}
                                rows={4}
                                placeholder="Descreva os achados desta etapa."
                            />
                        </div>

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {currentStepKey === 'labor' && (
                    <div className="caso-section">
                        <h3>Analise trabalhista</h3>
                        <div className="caso-grid">
                            <div className="caso-field">
                                <label>Resultado <span className="caso-req">*</span></label>
                                <div className="caso-select-group">
                                    {LABOR_OPTIONS.map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            className={`caso-select-btn ${form.laborFlag === option ? 'caso-select-btn--active' : ''}`}
                                            onClick={() => update('laborFlag', option)}
                                        >
                                            <RiskChip value={option} size="sm" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {form.laborFlag === 'POSITIVE' && (
                                <div className="caso-field">
                                    <label>Gravidade</label>
                                    <div className="caso-select-group">
                                        {SEVERITY_OPTIONS.map((option) => (
                                            <button
                                                key={option}
                                                type="button"
                                                className={`caso-select-btn ${form.laborSeverity === option ? 'caso-select-btn--active' : ''}`}
                                                onClick={() => update('laborSeverity', option)}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Resumo / notas</label>
                            <textarea
                                className="caso-textarea"
                                value={form.laborNotes}
                                onChange={(event) => update('laborNotes', event.target.value)}
                                rows={4}
                                placeholder="Descreva os achados trabalhistas."
                            />
                        </div>

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {currentStepKey === 'warrant' && (
                    <div className="caso-section">
                        <h3>Mandado de prisao</h3>
                        <div className="caso-field">
                            <label>Resultado <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {WARRANT_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn ${form.warrantFlag === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('warrantFlag', option)}
                                    >
                                        <RiskChip value={option} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Resumo / notas</label>
                            <textarea
                                className="caso-textarea"
                                value={form.warrantNotes}
                                onChange={(event) => update('warrantNotes', event.target.value)}
                                rows={4}
                                placeholder="Informacoes sobre mandado de prisao."
                            />
                        </div>

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {currentStepKey === 'osint_social' && (
                    <div className="caso-section">
                        {enabledPhases.includes('osint') && (<>
                        <h3>OSINT</h3>
                        <div className="caso-field">
                            <label>Nivel <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {OSINT_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn ${form.osintLevel === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('osintLevel', option)}
                                    >
                                        <RiskChip value={option} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Vetores encontrados</label>
                            <div className="caso-checkbox-group">
                                {['Vazamento de dados', 'Exposicao publica alta', 'Mencoes sensiveis', 'Inconsistencia de identidade'].map((value) => (
                                    <label key={value} className="caso-checkbox">
                                        <input type="checkbox" checked={form.osintVectors.includes(value)} onChange={() => toggleVector('osintVectors', value)} />
                                        {value}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Resumo OSINT</label>
                            <textarea className="caso-textarea" value={form.osintNotes} onChange={(event) => update('osintNotes', event.target.value)} rows={3} />
                        </div>
                        </>)}

                        {enabledPhases.includes('osint') && enabledPhases.includes('social') && (
                            <hr className="caso-divider" />
                        )}

                        {enabledPhases.includes('social') && (<>
                        <h3>Analise social</h3>
                        <div className="caso-field">
                            <label>Status <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {SOCIAL_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn ${form.socialStatus === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('socialStatus', option)}
                                    >
                                        <RiskChip value={option} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Motivos</label>
                            <div className="caso-checkbox-group">
                                {['Postura incompatvel', 'Discurso agressivo', 'Exposicao indevida', 'Conteudo sensivel', 'Inconsistencia de identidade'].map((value) => (
                                    <label key={value} className="caso-checkbox">
                                        <input type="checkbox" checked={form.socialReasons.includes(value)} onChange={() => toggleVector('socialReasons', value)} />
                                        {value}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Resumo social</label>
                            <textarea className="caso-textarea" value={form.socialNotes} onChange={(event) => update('socialNotes', event.target.value)} rows={3} />
                        </div>
                        </>)}

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {currentStepKey === 'digital' && (
                    <div className="caso-section">
                        {enabledPhases.includes('digital') && (<>
                        <h3>Perfil digital</h3>
                        <div className="caso-field">
                            <label>Perfis informados</label>
                            <SocialLinks profiles={caseData.socialProfiles || {}} size="md" showEmpty />
                        </div>

                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Resultado <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {DIGITAL_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn ${form.digitalFlag === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('digitalFlag', option)}
                                    >
                                        <RiskChip value={option} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Vetores encontrados</label>
                            <div className="caso-checkbox-group">
                                {['Inconsistencia de identidade', 'Conteudo improprio', 'Perfil falso', 'Exposicao indevida'].map((value) => (
                                    <label key={value} className="caso-checkbox">
                                        <input type="checkbox" checked={form.digitalVectors.includes(value)} onChange={() => toggleVector('digitalVectors', value)} />
                                        {value}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Resumo da analise digital</label>
                            <textarea className="caso-textarea" value={form.digitalNotes} onChange={(event) => update('digitalNotes', event.target.value)} rows={4} />
                        </div>
                        </>)}

                        {enabledPhases.includes('conflictInterest') && (<>
                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Conflito de interesse <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {CONFLICT_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn ${form.conflictInterest === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('conflictInterest', option)}
                                    >
                                        <RiskChip value={option} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Notas de conflito</label>
                            <textarea className="caso-textarea" value={form.conflictNotes} onChange={(event) => update('conflictNotes', event.target.value)} rows={3} />
                        </div>
                        </>)}

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {currentStepKey === 'review' && (
                    <div className="caso-section">
                        <h3>Revisao e conclusao</h3>

                        <div className="caso-risk-summary">
                            <div className="caso-risk-item">
                                <span className="caso-risk-label">Nivel de risco</span>
                                <RiskChip value={risk.riskLevel} size="lg" bold />
                            </div>
                            <div className="caso-risk-item">
                                <span className="caso-risk-label">Score</span>
                                <ScoreBar score={risk.riskScore} />
                            </div>
                            <div className="caso-risk-item">
                                <span className="caso-risk-label">Veredito sugerido</span>
                                <RiskChip value={risk.suggestedVerdict} size="lg" bold />
                            </div>
                        </div>

                        {detail?.executiveSummary && (
                            <div className="caso-alert" style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', color: 'var(--text-secondary)' }}>
                                {detail.executiveSummary}
                            </div>
                        )}

                        <div className="caso-checklist">
                            <h4>Checklist de conclusao</h4>
                            {checklist.map((item) => (
                                <div
                                    key={item.label}
                                    className={`caso-checklist__item ${item.ok ? 'caso-checklist__item--ok' : 'caso-checklist__item--missing'}`}
                                >
                                    <span>{item.ok ? 'OK' : 'X'}</span>
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </div>

                        <div className="caso-field">
                            <label>Veredito final <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {VERDICT_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn caso-select-btn--lg ${form.finalVerdict === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('finalVerdict', option)}
                                    >
                                        <RiskChip value={option} size="md" bold />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Comentario final</label>
                            <textarea
                                className="caso-textarea"
                                value={form.analystComment}
                                onChange={(event) => update('analystComment', event.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary caso-btn--conclude" disabled={!allOk || saving || isCorrectionNeeded} onClick={handleConclude}>
                                {saving ? 'Salvando...' : 'Concluir caso'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
