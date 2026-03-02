import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import ScoreBar from '../../ui/components/ScoreBar/ScoreBar';
import SocialLinks from '../../ui/components/SocialLinks/SocialLinks';
import { MOCK_CASES } from '../../data/mockData';
import './CasoPage.css';

const STEPS = [
    { key: 'identification', label: '1. Identificação' },
    { key: 'criminal', label: '2. Criminal' },
    { key: 'osint_social', label: '3. OSINT & Social' },
    { key: 'digital', label: '4. Perfil Digital' },
    { key: 'review', label: '5. Revisão' },
];

const CRIMINAL_OPTIONS = ['NEGATIVE', 'POSITIVE', 'INCONCLUSIVE', 'NOT_FOUND'];
const SEVERITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'];
const OSINT_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'];
const SOCIAL_OPTIONS = ['APPROVED', 'NEUTRAL', 'CONCERN', 'CONTRAINDICATED'];
const DIGITAL_OPTIONS = ['CLEAN', 'ALERT', 'CRITICAL', 'NOT_CHECKED'];
const CONFLICT_OPTIONS = ['YES', 'NO', 'UNKNOWN'];
const VERDICT_OPTIONS = ['FIT', 'ATTENTION', 'NOT_RECOMMENDED'];

function calculateRisk(form) {
    const scores = {
        NEGATIVE: 0, NOT_FOUND: 5, INCONCLUSIVE: 40, POSITIVE: 90,
        LOW: 0, UNKNOWN: 20, MEDIUM: 50, HIGH: 90,
        APPROVED: 0, NEUTRAL: 10, CONCERN: 50, CONTRAINDICATED: 90,
        CLEAN: 0, NOT_CHECKED: 10, ALERT: 45, CRITICAL: 85,
        NO: 0, YES: 60,
    };
    const crimScore = scores[form.criminalFlag] || 0;
    const osintScore = scores[form.osintLevel] || 0;
    const socialScore = scores[form.socialStatus] || 0;
    const digitalScore = scores[form.digitalFlag] || 0;
    const conflictScore = scores[form.conflictInterest] || 0;
    let riskScore = Math.max(crimScore, osintScore, socialScore, digitalScore, conflictScore);
    // Bonus for multiple yellow
    const yellows = [form.criminalFlag === 'INCONCLUSIVE', form.osintLevel === 'MEDIUM', form.socialStatus === 'CONCERN', form.digitalFlag === 'ALERT']
        .filter(Boolean).length;
    if (yellows >= 2) riskScore = Math.min(100, riskScore + 15);

    let riskLevel = 'GREEN';
    if (crimScore >= 80 || socialScore >= 80 || osintScore >= 80 || digitalScore >= 80) riskLevel = 'RED';
    else if (riskScore >= 30) riskLevel = 'YELLOW';

    let suggestedVerdict = 'FIT';
    if (riskScore >= 70) suggestedVerdict = 'NOT_RECOMMENDED';
    else if (riskScore >= 30) suggestedVerdict = 'ATTENTION';

    return { riskScore, riskLevel, suggestedVerdict };
}

export default function CasoPage() {
    const { caseId } = useParams();
    const navigate = useNavigate();
    const caseData = MOCK_CASES.find(c => c.id === caseId) || MOCK_CASES[0];

    const [activeStep, setActiveStep] = useState(0);
    const [form, setForm] = useState({
        criminalFlag: caseData.criminalFlag || '',
        criminalSeverity: caseData.criminalSeverity || '',
        criminalNotes: '',
        osintLevel: caseData.osintLevel || '',
        osintVectors: [],
        osintNotes: '',
        socialStatus: caseData.socialStatus || '',
        socialReasons: [],
        socialNotes: '',
        digitalFlag: caseData.digitalFlag || '',
        digitalVectors: [],
        digitalNotes: '',
        conflictInterest: caseData.conflictInterest || '',
        conflictNotes: '',
        finalVerdict: '',
        analystComment: '',
    });
    const [concluded, setConcluded] = useState(false);

    const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
    const toggleVector = (field, value) => {
        setForm(prev => ({
            ...prev,
            [field]: prev[field].includes(value)
                ? prev[field].filter(v => v !== value)
                : [...prev[field], value],
        }));
    };

    const risk = useMemo(() => calculateRisk(form), [form]);

    const checklist = [
        { label: 'Criminal definido', ok: !!form.criminalFlag },
        { label: 'OSINT definido', ok: !!form.osintLevel },
        { label: 'Social definido', ok: !!form.socialStatus },
        { label: 'Perfil Digital definido', ok: !!form.digitalFlag },
        { label: 'Conflito de interesse', ok: !!form.conflictInterest },
        { label: 'Veredito definido', ok: !!form.finalVerdict },
    ];
    const allOk = checklist.every(c => c.ok);

    const handleConclude = () => {
        if (!allOk) return;
        setConcluded(true);
    };

    if (concluded) {
        return (
            <div className="caso-page">
                <div className="caso-success animate-scaleIn">
                    <span style={{ fontSize: '3rem' }}>✅</span>
                    <h2>Caso concluído com sucesso!</h2>
                    <p>O resultado já está disponível no portal do cliente.</p>
                    <button className="caso-btn caso-btn--primary" onClick={() => navigate('/ops/fila')}>
                        Voltar para a fila
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="caso-page">
            {/* Header */}
            <div className="caso-header">
                <div className="caso-header__info">
                    <h2>{caseData.candidateName}</h2>
                    <div className="caso-header__meta">
                        <StatusBadge status={caseData.status} />
                        <span className="caso-header__id">{caseData.id}</span>
                        <span className="caso-header__cpf">{caseData.cpfMasked}</span>
                        <span className="caso-header__tenant" style={{ fontSize: '.75rem', padding: '2px 6px', background: 'var(--gray-200)', borderRadius: '4px', fontWeight: 600 }}>🏢 {caseData.tenantName}</span>
                    </div>
                </div>
                <div className="caso-header__actions">
                    <button className="caso-btn caso-btn--ghost" onClick={() => navigate('/ops/fila')}>← Voltar</button>
                    <button className="caso-btn caso-btn--primary" disabled={!allOk} onClick={handleConclude}>
                        ✅ Concluir
                    </button>
                </div>
            </div>

            {/* Stepper */}
            <div className="stepper">
                {STEPS.map((step, i) => (
                    <button
                        key={step.key}
                        className={`stepper__step ${i === activeStep ? 'stepper__step--active' : ''} ${i < activeStep ? 'stepper__step--done' : ''}`}
                        onClick={() => setActiveStep(i)}
                    >
                        <span className="stepper__number">{i < activeStep ? '✓' : i + 1}</span>
                        <span className="stepper__label">{step.label}</span>
                    </button>
                ))}
            </div>

            {/* Step Content */}
            <div className="caso-step-content animate-fadeInUp">
                {/* Step 1: Identification */}
                {activeStep === 0 && (
                    <div className="caso-section">
                        <h3>👤 Identificação do Candidato</h3>
                        <div className="caso-grid">
                            <div className="caso-field">
                                <label>Nome</label>
                                <input className="caso-input caso-input--readonly" value={caseData.candidateName} readOnly />
                            </div>
                            <div className="caso-field">
                                <label>CPF</label>
                                <input className="caso-input caso-input--readonly" value={caseData.cpfMasked} readOnly />
                            </div>
                            <div className="caso-field">
                                <label>Cargo</label>
                                <input className="caso-input caso-input--readonly" value={caseData.candidatePosition} readOnly />
                            </div>
                            <div className="caso-field">
                                <label>Data da solicitação</label>
                                <input className="caso-input caso-input--readonly" value={caseData.createdAt} readOnly />
                            </div>
                        </div>

                        <h4 style={{ marginTop: 20 }}>🌐 Redes Sociais do Candidato</h4>
                        <SocialLinks profiles={caseData.socialProfiles || {}} size="md" showEmpty />

                        <div className="caso-step-nav">
                            <div />
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(1)}>Próximo →</button>
                        </div>
                    </div>
                )}

                {/* Step 2: Criminal */}
                {activeStep === 1 && (
                    <div className="caso-section">
                        <h3>🔴 Análise Criminal</h3>
                        <div className="caso-grid">
                            <div className="caso-field">
                                <label>Resultado <span className="caso-req">*</span></label>
                                <div className="caso-select-group">
                                    {CRIMINAL_OPTIONS.map(opt => (
                                        <button key={opt} type="button"
                                            className={`caso-select-btn ${form.criminalFlag === opt ? 'caso-select-btn--active' : ''}`}
                                            onClick={() => update('criminalFlag', opt)}
                                        >
                                            <RiskChip value={opt} size="sm" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {form.criminalFlag === 'POSITIVE' && (
                                <div className="caso-field">
                                    <label>Gravidade</label>
                                    <div className="caso-select-group">
                                        {SEVERITY_OPTIONS.map(opt => (
                                            <button key={opt} type="button"
                                                className={`caso-select-btn ${form.criminalSeverity === opt ? 'caso-select-btn--active' : ''}`}
                                                onClick={() => update('criminalSeverity', opt)}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Resumo / Notas</label>
                            <textarea
                                className="caso-textarea"
                                value={form.criminalNotes}
                                onChange={e => update('criminalNotes', e.target.value)}
                                placeholder="O que foi encontrado, onde, quando, impacto..."
                                rows={4}
                            />
                        </div>

                        {form.criminalFlag === 'POSITIVE' && (
                            <div className="caso-alert caso-alert--warning">
                                ⚠️ Resultado POSITIVO requer evidência anexada para concluir.
                            </div>
                        )}

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(0)}>← Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(2)}>Próximo →</button>
                        </div>
                    </div>
                )}

                {/* Step 3: OSINT & Social */}
                {activeStep === 2 && (
                    <div className="caso-section">
                        <h3>🔍 OSINT</h3>
                        <div className="caso-field">
                            <label>Nível <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {OSINT_OPTIONS.map(opt => (
                                    <button key={opt} type="button"
                                        className={`caso-select-btn ${form.osintLevel === opt ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('osintLevel', opt)}
                                    >
                                        <RiskChip value={opt} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Vetores encontrados</label>
                            <div className="caso-checkbox-group">
                                {['Vazamento de dados', 'Exposição pública alta', 'Menções em fóruns sensíveis', 'Inconsistência de identidade'].map(v => (
                                    <label key={v} className="caso-checkbox">
                                        <input type="checkbox" checked={form.osintVectors.includes(v)} onChange={() => toggleVector('osintVectors', v)} />
                                        {v}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Resumo OSINT</label>
                            <textarea className="caso-textarea" value={form.osintNotes} onChange={e => update('osintNotes', e.target.value)} placeholder="Resumo..." rows={3} />
                        </div>

                        <hr className="caso-divider" />

                        <h3>👥 Análise Social</h3>
                        <div className="caso-field">
                            <label>Status <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {SOCIAL_OPTIONS.map(opt => (
                                    <button key={opt} type="button"
                                        className={`caso-select-btn ${form.socialStatus === opt ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('socialStatus', opt)}
                                    >
                                        <RiskChip value={opt} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Motivos</label>
                            <div className="caso-checkbox-group">
                                {['Postura incompatível', 'Discurso de ódio/violência', 'Exposição indevida', 'Conteúdo ilegal', 'Inconsistência de identidade'].map(v => (
                                    <label key={v} className="caso-checkbox">
                                        <input type="checkbox" checked={form.socialReasons.includes(v)} onChange={() => toggleVector('socialReasons', v)} />
                                        {v}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Resumo Social</label>
                            <textarea className="caso-textarea" value={form.socialNotes} onChange={e => update('socialNotes', e.target.value)} placeholder="Resumo..." rows={3} />
                        </div>

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(1)}>← Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(3)}>Próximo →</button>
                        </div>
                    </div>
                )}

                {/* Step 4: Digital Profile */}
                {activeStep === 3 && (
                    <div className="caso-section">
                        <h3>💻 Análise de Perfil Digital</h3>
                        <div className="caso-field">
                            <label>Perfis fornecidos pelo solicitante</label>
                            <SocialLinks profiles={caseData.socialProfiles || {}} size="md" showEmpty />
                        </div>

                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Resultado <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {DIGITAL_OPTIONS.map(opt => (
                                    <button key={opt} type="button"
                                        className={`caso-select-btn ${form.digitalFlag === opt ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('digitalFlag', opt)}
                                    >
                                        <RiskChip value={opt} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Vetores encontrados</label>
                            <div className="caso-checkbox-group">
                                {['Inconsistência de identidade', 'Conteúdo impróprio', 'Perfil falso', 'Exposição indevida'].map(v => (
                                    <label key={v} className="caso-checkbox">
                                        <input type="checkbox" checked={form.digitalVectors.includes(v)} onChange={() => toggleVector('digitalVectors', v)} />
                                        {v}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Resumo da análise digital</label>
                            <textarea className="caso-textarea" value={form.digitalNotes} onChange={e => update('digitalNotes', e.target.value)} placeholder="Análise dos perfis de redes sociais..." rows={4} />
                        </div>

                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Conflito de Interesse</label>
                            <div className="caso-select-group">
                                {CONFLICT_OPTIONS.map(opt => (
                                    <button key={opt} type="button"
                                        className={`caso-select-btn ${form.conflictInterest === opt ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('conflictInterest', opt)}
                                    >
                                        <RiskChip value={opt} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(2)}>← Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(4)}>Próximo →</button>
                        </div>
                    </div>
                )}

                {/* Step 5: Review & Conclusion */}
                {activeStep === 4 && (
                    <div className="caso-section">
                        <h3>📋 Revisão & Conclusão</h3>

                        {/* Calculated risk */}
                        <div className="caso-risk-summary">
                            <div className="caso-risk-item">
                                <span className="caso-risk-label">Nível de Risco</span>
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

                        {/* Checklist */}
                        <div className="caso-checklist">
                            <h4>Checklist de conclusão</h4>
                            {checklist.map((item, i) => (
                                <div key={i} className={`caso-checklist__item ${item.ok ? 'caso-checklist__item--ok' : 'caso-checklist__item--missing'}`}>
                                    <span>{item.ok ? '✅' : '❌'}</span>
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Verdict */}
                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Veredito Final <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {VERDICT_OPTIONS.map(opt => (
                                    <button key={opt} type="button"
                                        className={`caso-select-btn caso-select-btn--lg ${form.finalVerdict === opt ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('finalVerdict', opt)}
                                    >
                                        <RiskChip value={opt} size="md" bold />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Comentário final</label>
                            <textarea className="caso-textarea" value={form.analystComment} onChange={e => update('analystComment', e.target.value)} placeholder="Observações finais..." rows={3} />
                        </div>

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(3)}>← Anterior</button>
                            <button className="caso-btn caso-btn--primary caso-btn--conclude" disabled={!allOk} onClick={handleConclude}>
                                ✅ Concluir Caso
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
