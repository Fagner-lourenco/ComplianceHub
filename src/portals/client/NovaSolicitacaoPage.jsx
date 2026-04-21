import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/useAuth';
import { callCreateClientSolicitation, callGetClientQuotaStatus } from '../../core/firebase/firestoreService';
import { extractErrorMessage, getUserFriendlyMessage } from '../../core/errorUtils';
import { buildClientPortalPath } from '../../core/portalPaths';
import { validateCpf, validateUrl } from '../../core/validators';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { QuotaSummaryCard } from '../../ui/components/QuotaBar/QuotaBar';
import './NovaSolicitacaoPage.css';

const STEP_LABELS = ['Dados do Candidato', 'Redes Sociais', 'Observações', 'Revisão'];

const INITIAL_FORM = {
    fullName: '',
    cpf: '',
    dateOfBirth: '',
    position: '',
    department: '',
    hiringUf: '',
    email: '',
    phone: '',
    instagram: '',
    facebook: '',
    linkedin: '',
    tiktok: '',
    twitter: '',
    youtube: '',
    otherSocialUrls: [],
    digitalProfileNotes: '',
    priority: 'NORMAL',
};

const BRAZIL_UF_OPTIONS = [
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
    'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

function formatCpf(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskCpf(cpf) {
    const digits = cpf.replace(/\D/g, '');
    return `***.***.***-${digits.slice(9)}`;
}

export default function NovaSolicitacaoPage() {
    const [form, setForm] = useState(INITIAL_FORM);
    const [errors, setErrors] = useState({});
    const [showOther, setShowOther] = useState(false);
    const [otherLabel, setOtherLabel] = useState('');
    const [otherUrl, setOtherUrl] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [quota, setQuota] = useState(null);
    const [showExceedModal, setShowExceedModal] = useState(false);
    const redirectTimerRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, userProfile } = useAuth();
    const tenantId = userProfile?.tenantId || null;
    const tenantLabel = userProfile?.tenantName || userProfile?.tenantId || 'Franquia em sincronizacao';
    const hasConfirmedTenant = Boolean(tenantId);
    const isDemoProfile = userProfile?.source === 'demo';
    const isMobile = useMediaQuery('(max-width: 768px)');
    const [step, setStep] = useState(0);
    const totalSteps = STEP_LABELS.length;

    useEffect(() => {
        if (!user || isDemoProfile) return;
        callGetClientQuotaStatus()
            .then((data) => setQuota(data))
            .catch(() => {});
    }, [user, isDemoProfile]);

    const update = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        if (errors[field]) {
            setErrors((previous) => ({ ...previous, [field]: null }));
        }
    };

    const validate = () => {
        const nextErrors = {};

        if (!form.fullName.trim()) nextErrors.fullName = 'Nome obrigatorio';
        if (!form.cpf.trim()) nextErrors.cpf = 'CPF obrigatorio';
        else if (!validateCpf(form.cpf)) nextErrors.cpf = 'CPF invalido';

        ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube'].forEach((field) => {
            if (form[field] && !validateUrl(form[field])) {
                nextErrors[field] = 'URL ou @handle invalido';
            }
        });

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!validate()) {
            return;
        }

        if (!userProfile) {
            setErrors({ general: 'Sua sessao ainda esta sendo sincronizada. Tente novamente em instantes.' });
            return;
        }

        if (!tenantId) {
            setErrors({ general: 'Nao foi possivel confirmar a franquia desta solicitacao. Aguarde a sincronizacao do perfil e tente novamente.' });
            return;
        }

        // Check if submitting would exceed limits — show confirmation modal
        if (quota?.hasLimits && !showExceedModal) {
            const willExceedDaily = quota.dailyLimit && quota.dailyCount >= quota.dailyLimit;
            const willExceedMonthly = quota.monthlyLimit && quota.monthlyCount >= quota.monthlyLimit;
            if (willExceedDaily || willExceedMonthly) {
                setShowExceedModal(true);
                return;
            }
        }

        setShowExceedModal(false);
        setSubmitting(true);

        try {
            if (!user && isDemoProfile) {
                setSubmitted(true);
                redirectTimerRef.current = window.setTimeout(() => navigate(buildClientPortalPath(location.pathname, 'solicitacoes')), 1500);
                return;
            }

            if (!user) {
                setErrors({ general: 'Sua sessao ainda esta sendo sincronizada. Tente novamente em instantes.' });
                return;
            }

            await callCreateClientSolicitation({
                fullName: form.fullName,
                cpf: form.cpf,
                dateOfBirth: form.dateOfBirth || '',
                position: form.position || '',
                department: form.department || '',
                hiringUf: form.hiringUf || '',
                email: form.email || '',
                phone: form.phone || '',
                priority: form.priority,
                digitalProfileNotes: form.digitalProfileNotes || '',
                socialProfiles: {
                    instagram: form.instagram || '',
                    facebook: form.facebook || '',
                    linkedin: form.linkedin || '',
                    tiktok: form.tiktok || '',
                    twitter: form.twitter || '',
                    youtube: form.youtube || '',
                },
                otherSocialUrls: form.otherSocialUrls,
            });

            setSubmitted(true);
            redirectTimerRef.current = window.setTimeout(() => navigate(buildClientPortalPath(location.pathname, 'solicitacoes')), 1500);
        } catch (error) {
            console.error('Error creating solicitation:', error);
            setErrors({ general: getUserFriendlyMessage(error, 'criar a solicitacao') });
        } finally {
            setSubmitting(false);
        }
    };

    const addOtherSocial = () => {
        if (!otherUrl.trim()) {
            return;
        }

        setForm((previous) => ({
            ...previous,
            otherSocialUrls: [...previous.otherSocialUrls, { label: otherLabel || 'Outro', url: otherUrl }],
        }));
        setOtherLabel('');
        setOtherUrl('');
        setShowOther(false);
    };

    const removeOtherSocial = (index) => {
        setForm((previous) => ({
            ...previous,
            otherSocialUrls: previous.otherSocialUrls.filter((_, currentIndex) => currentIndex !== index),
        }));
    };

    useEffect(() => {
        return () => {
            if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
        };
    }, []);

    if (submitted) {
        return (
            <div className="ns-page">
                <div className="ns-success animate-scaleIn">
                    <span className="ns-success__icon">OK</span>
                    <h2>Solicitacao enviada</h2>
                    <p>O caso foi criado com sucesso e esta aguardando analise.</p>
                </div>
            </div>
        );
    }

    const isValid = form.fullName.trim() && form.cpf.trim() && validateCpf(form.cpf);
    const quotaBlocked = quota?.hasLimits && (
        (quota.dailyLimit && quota.dailyCount >= quota.dailyLimit && !quota.allowDailyExceedance) ||
        (quota.monthlyLimit && quota.monthlyCount >= quota.monthlyLimit && !quota.allowMonthlyExceedance)
    );
    const canSubmit = Boolean(isValid && !submitting && hasConfirmedTenant && !quotaBlocked);

    return (
        <div className="ns-page">
            <div className="ns-page__header">
                <h2>Nova Solicitacao de Due Diligence</h2>
                <p>Preencha os dados do candidato para iniciar a analise.</p>
                <p style={{ marginTop: 8, fontSize: '.875rem', color: 'var(--text-secondary)' }}>
                    Esta solicitacao sera vinculada a <strong>{tenantLabel}</strong>.
                </p>
                {!hasConfirmedTenant && (
                    <p style={{ marginTop: 8, fontSize: '.875rem', color: 'var(--red-700)' }}>
                        A franquia do seu perfil ainda nao foi confirmada. O envio fica bloqueado ate a sincronizacao terminar.
                    </p>
                )}
            </div>

            {quota?.hasLimits && (() => {
                const dailyExceeded = quota.dailyLimit && quota.dailyCount >= quota.dailyLimit;
                const monthlyExceeded = quota.monthlyLimit && quota.monthlyCount >= quota.monthlyLimit;
                const blocked = (dailyExceeded && !quota.allowDailyExceedance) || (monthlyExceeded && !quota.allowMonthlyExceedance);
                if (blocked) {
                    return (
                        <>
                            <QuotaSummaryCard quota={quota} />
                            <div className="ns-quota-banner ns-quota-banner--blocked">
                                <strong>Limite atingido</strong> — {dailyExceeded && !quota.allowDailyExceedance
                                    ? `Limite diario de ${quota.dailyLimit} consultas atingido. Tente novamente amanha.`
                                    : `Limite mensal de ${quota.monthlyLimit} consultas atingido. Entre em contato com o administrador.`}
                            </div>
                        </>
                    );
                }
                if (dailyExceeded || monthlyExceeded) {
                    return (
                        <>
                            <QuotaSummaryCard quota={quota} />
                            <div className="ns-quota-banner ns-quota-banner--warning">
                                <strong>Atencao</strong> — {dailyExceeded
                                    ? `Voce ja utilizou ${quota.dailyCount}/${quota.dailyLimit} consultas hoje. A proxima sera registrada como excedente do dia.`
                                    : `Voce ja utilizou ${quota.monthlyCount}/${quota.monthlyLimit} consultas no mes. A proxima sera faturavel no proximo ciclo.`}
                            </div>
                        </>
                    );
                }
                return <QuotaSummaryCard quota={quota} />;
            })()}

            <form className="ns-form" onSubmit={handleSubmit}>
                {errors.general && (
                    <div className="login-form__error" style={{ marginBottom: 16 }}>
                        {errors.general}
                    </div>
                )}

                {isMobile && (
                    <div className="ns-stepper">
                        <div className="ns-stepper__bar">
                            {STEP_LABELS.map((label, i) => (
                                <div key={label} className={`ns-stepper__dot${i <= step ? ' ns-stepper__dot--active' : ''}${i < step ? ' ns-stepper__dot--done' : ''}`}>
                                    <span className="ns-stepper__num">{i < step ? '✓' : i + 1}</span>
                                </div>
                            ))}
                            <div className="ns-stepper__track">
                                <div className="ns-stepper__fill" style={{ width: `${(step / (totalSteps - 1)) * 100}%` }} />
                            </div>
                        </div>
                        <span className="ns-stepper__label">{STEP_LABELS[step]}</span>
                    </div>
                )}

                <div className="ns-section" style={isMobile && step !== 0 ? { display: 'none' } : undefined}>
                    <div className="ns-section__header">
                        <span className="ns-section__icon">CD</span>
                        <h3>Dados do Candidato</h3>
                    </div>

                    <div className="ns-grid ns-grid--2">
                        <div className="ns-field">
                            <label className="ns-label">Nome completo <span className="ns-required">*</span></label>
                            <input
                                type="text"
                                className={`ns-input ${errors.fullName ? 'ns-input--error' : ''}`}
                                value={form.fullName}
                                onChange={(event) => update('fullName', event.target.value)}
                                placeholder="Nome completo do candidato"
                                aria-required="true"
                            />
                            {errors.fullName && <span className="ns-error">{errors.fullName}</span>}
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">CPF <span className="ns-required">*</span></label>
                            <input
                                type="text"
                                className={`ns-input ${errors.cpf ? 'ns-input--error' : ''}`}
                                value={form.cpf}
                                onChange={(event) => update('cpf', formatCpf(event.target.value))}
                                placeholder="000.000.000-00"
                                maxLength={14}
                                aria-required="true"
                            />
                            {errors.cpf && <span className="ns-error">{errors.cpf}</span>}
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">Data de nascimento</label>
                            <input
                                type="date"
                                className="ns-input"
                                value={form.dateOfBirth}
                                onChange={(event) => update('dateOfBirth', event.target.value)}
                            />
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">Cargo pretendido</label>
                            <input
                                type="text"
                                className="ns-input"
                                value={form.position}
                                onChange={(event) => update('position', event.target.value)}
                                placeholder="Ex.: Analista Financeiro"
                            />
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">Departamento / Setor</label>
                            <input
                                type="text"
                                className="ns-input"
                                value={form.department}
                                onChange={(event) => update('department', event.target.value)}
                                placeholder="Ex.: Financeiro"
                            />
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">Estado (UF) de contratacao</label>
                            <select
                                className="ns-input"
                                value={form.hiringUf}
                                onChange={(event) => update('hiringUf', event.target.value)}
                            >
                                <option value="">Selecione o estado...</option>
                                {BRAZIL_UF_OPTIONS.map((uf) => (
                                    <option key={uf} value={uf}>{uf}</option>
                                ))}
                            </select>
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">Email</label>
                            <input
                                type="email"
                                className="ns-input"
                                value={form.email}
                                onChange={(event) => update('email', event.target.value)}
                                placeholder="candidato@email.com"
                            />
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">Telefone</label>
                            <input
                                type="text"
                                className="ns-input"
                                value={form.phone}
                                onChange={(event) => update('phone', event.target.value)}
                                placeholder="(11) 99999-9999"
                            />
                        </div>
                    </div>
                </div>

                <div className="ns-section" style={isMobile && step !== 1 ? { display: 'none' } : undefined}>
                    <div className="ns-section__header">
                        <span className="ns-section__icon">RS</span>
                        <h3>Redes Sociais</h3>
                        <span className="ns-section__hint">Informe os perfis do candidato para analise digital</span>
                    </div>

                    <div className="ns-grid ns-grid--2">
                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">IG</span> Instagram</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.instagram ? 'ns-input--error' : ''}`}
                                value={form.instagram}
                                onChange={(event) => update('instagram', event.target.value)}
                                placeholder="@usuario ou https://instagram.com/..."
                            />
                            {errors.instagram && <span className="ns-error">{errors.instagram}</span>}
                        </div>

                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">FB</span> Facebook</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.facebook ? 'ns-input--error' : ''}`}
                                value={form.facebook}
                                onChange={(event) => update('facebook', event.target.value)}
                                placeholder="https://facebook.com/..."
                            />
                            {errors.facebook && <span className="ns-error">{errors.facebook}</span>}
                        </div>

                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">IN</span> LinkedIn</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.linkedin ? 'ns-input--error' : ''}`}
                                value={form.linkedin}
                                onChange={(event) => update('linkedin', event.target.value)}
                                placeholder="https://linkedin.com/in/..."
                            />
                            {errors.linkedin && <span className="ns-error">{errors.linkedin}</span>}
                        </div>

                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">TT</span> TikTok</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.tiktok ? 'ns-input--error' : ''}`}
                                value={form.tiktok}
                                onChange={(event) => update('tiktok', event.target.value)}
                                placeholder="@usuario ou https://tiktok.com/..."
                            />
                            {errors.tiktok && <span className="ns-error">{errors.tiktok}</span>}
                        </div>

                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">X</span> Twitter / X</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.twitter ? 'ns-input--error' : ''}`}
                                value={form.twitter}
                                onChange={(event) => update('twitter', event.target.value)}
                                placeholder="@usuario ou https://x.com/..."
                            />
                            {errors.twitter && <span className="ns-error">{errors.twitter}</span>}
                        </div>

                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">YT</span> YouTube</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.youtube ? 'ns-input--error' : ''}`}
                                value={form.youtube}
                                onChange={(event) => update('youtube', event.target.value)}
                                placeholder="https://youtube.com/..."
                            />
                            {errors.youtube && <span className="ns-error">{errors.youtube}</span>}
                        </div>
                    </div>

                    {form.otherSocialUrls.length > 0 && (
                        <div className="ns-other-socials">
                            {form.otherSocialUrls.map((item, index) => (
                                <div key={`${item.label}-${index}`} className="ns-other-social">
                                    <span>Link {item.label}: {item.url}</span>
                                    <button
                                        type="button"
                                        className="ns-other-social__remove"
                                        onClick={() => removeOtherSocial(index)}
                                    >
                                        X
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {showOther ? (
                        <div className="ns-add-other">
                            <input
                                type="text"
                                className="ns-input ns-input--sm"
                                value={otherLabel}
                                onChange={(event) => setOtherLabel(event.target.value)}
                                placeholder="Nome da rede"
                            />
                            <input
                                type="text"
                                className="ns-input ns-input--sm"
                                value={otherUrl}
                                onChange={(event) => setOtherUrl(event.target.value)}
                                placeholder="URL ou @handle"
                            />
                            <button type="button" className="ns-btn ns-btn--sm ns-btn--primary" onClick={addOtherSocial}>
                                Adicionar
                            </button>
                            <button type="button" className="ns-btn ns-btn--sm ns-btn--ghost" onClick={() => setShowOther(false)}>
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <button type="button" className="ns-btn ns-btn--ghost ns-btn--add" onClick={() => setShowOther(true)}>
                            Adicionar outra rede social
                        </button>
                    )}
                </div>

                <div className="ns-section" style={isMobile && step !== 2 ? { display: 'none' } : undefined}>
                    <div className="ns-section__header">
                        <span className="ns-section__icon">NT</span>
                        <h3>Observacoes</h3>
                    </div>

                    <div className="ns-field">
                        <label className="ns-label">Notas sobre perfil digital</label>
                        <textarea
                            className="ns-textarea"
                            value={form.digitalProfileNotes}
                            onChange={(event) => update('digitalProfileNotes', event.target.value)}
                            placeholder="Informacoes adicionais para o analista (opcional)..."
                            maxLength={500}
                            rows={3}
                        />
                        <span className="ns-char-count">{form.digitalProfileNotes.length}/500</span>
                    </div>

                    <div className="ns-field">
                        <label className="ns-label">Prioridade</label>
                        <div className="ns-priority-selector">
                            <button
                                type="button"
                                className={`ns-priority-btn ${form.priority === 'NORMAL' ? 'ns-priority-btn--active' : ''}`}
                                onClick={() => update('priority', 'NORMAL')}
                            >
                                Normal
                            </button>
                            <button
                                type="button"
                                className={`ns-priority-btn ns-priority-btn--high ${form.priority === 'HIGH' ? 'ns-priority-btn--active' : ''}`}
                                onClick={() => update('priority', 'HIGH')}
                            >
                                Alta
                            </button>
                        </div>
                    </div>
                </div>

                {isMobile && step === 3 && (
                    <div className="ns-section ns-review">
                        <div className="ns-section__header">
                            <span className="ns-section__icon">RV</span>
                            <h3>Revisão</h3>
                        </div>
                        <div className="ns-review__group">
                            <div className="ns-review__heading">Dados do Candidato <button type="button" className="ns-review__edit" onClick={() => setStep(0)}>Editar</button></div>
                            <div className="ns-review__item"><span>Nome:</span> {form.fullName || '—'}</div>
                            <div className="ns-review__item"><span>CPF:</span> {form.cpf ? maskCpf(form.cpf) : '—'}</div>
                            {form.dateOfBirth && <div className="ns-review__item"><span>Nascimento:</span> {form.dateOfBirth}</div>}
                            {form.position && <div className="ns-review__item"><span>Cargo:</span> {form.position}</div>}
                            {form.department && <div className="ns-review__item"><span>Departamento:</span> {form.department}</div>}
                            {form.hiringUf && <div className="ns-review__item"><span>UF:</span> {form.hiringUf}</div>}
                            {form.email && <div className="ns-review__item"><span>Email:</span> {form.email}</div>}
                            {form.phone && <div className="ns-review__item"><span>Telefone:</span> {form.phone}</div>}
                        </div>
                        <div className="ns-review__group">
                            <div className="ns-review__heading">Redes Sociais <button type="button" className="ns-review__edit" onClick={() => setStep(1)}>Editar</button></div>
                            {['instagram','facebook','linkedin','tiktok','twitter','youtube'].filter(k => form[k]).map(k => (
                                <div key={k} className="ns-review__item"><span>{k}:</span> {form[k]}</div>
                            ))}
                            {form.otherSocialUrls.map((s, i) => (
                                <div key={i} className="ns-review__item"><span>{s.label}:</span> {s.url}</div>
                            ))}
                            {!['instagram','facebook','linkedin','tiktok','twitter','youtube'].some(k => form[k]) && form.otherSocialUrls.length === 0 && (
                                <div className="ns-review__item ns-review__item--empty">Nenhuma rede informada</div>
                            )}
                        </div>
                        <div className="ns-review__group">
                            <div className="ns-review__heading">Observações <button type="button" className="ns-review__edit" onClick={() => setStep(2)}>Editar</button></div>
                            <div className="ns-review__item"><span>Notas:</span> {form.digitalProfileNotes || '—'}</div>
                            <div className="ns-review__item"><span>Prioridade:</span> {form.priority === 'HIGH' ? 'Alta' : 'Normal'}</div>
                        </div>
                    </div>
                )}

                {isMobile ? (
                    <div className="ns-actions ns-actions--wizard">
                        {step > 0 ? (
                            <button type="button" className="ns-btn ns-btn--ghost" onClick={() => setStep(step - 1)}>Anterior</button>
                        ) : (
                            <button type="button" className="ns-btn ns-btn--ghost" onClick={() => navigate(buildClientPortalPath(location.pathname, 'solicitacoes'))}>Cancelar</button>
                        )}
                        {step < totalSteps - 1 ? (
                            <button type="button" className="ns-btn ns-btn--primary" onClick={() => { if (step === 0 && !validate()) return; setStep(step + 1); }}>Próximo</button>
                        ) : (
                            <button type="submit" className="ns-btn ns-btn--primary" disabled={!canSubmit}>{submitting ? 'Enviando...' : 'Enviar Solicitação'}</button>
                        )}
                    </div>
                ) : (
                    <div className="ns-actions">
                        <button type="button" className="ns-btn ns-btn--ghost" onClick={() => navigate(buildClientPortalPath(location.pathname, 'solicitacoes'))}>
                            Cancelar
                        </button>
                        <button type="submit" className="ns-btn ns-btn--primary" disabled={!canSubmit}>
                            {submitting ? 'Enviando...' : 'Enviar Solicitacao'}
                        </button>
                    </div>
                )}
            </form>

            {showExceedModal && (
                <div className="ns-modal-overlay" onClick={() => setShowExceedModal(false)}>
                    <div className="ns-modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="ns-modal__title">Confirmar envio excedente</h3>
                        <p className="ns-modal__text">
                            {quota?.dailyLimit && quota.dailyCount >= quota.dailyLimit
                                ? `Voce ja utilizou ${quota.dailyCount}/${quota.dailyLimit} consultas hoje. Esta solicitacao sera registrada como excedente do dia.`
                                : `Voce ja utilizou ${quota.monthlyCount}/${quota.monthlyLimit} consultas no mes. Esta solicitacao sera faturavel no proximo ciclo.`}
                        </p>
                        <div className="ns-modal__actions">
                            <button type="button" className="ns-btn ns-btn--ghost" onClick={() => setShowExceedModal(false)}>Cancelar</button>
                            <button type="button" className="ns-btn ns-btn--primary" disabled={submitting} onClick={(e) => handleSubmit(e)}>
                                {submitting ? 'Enviando...' : 'Confirmar envio'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
