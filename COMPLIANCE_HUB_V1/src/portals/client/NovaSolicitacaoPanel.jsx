import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/useAuth';
import { callCreateClientSolicitation, callGetClientQuotaStatus } from '../../core/firebase/firestoreService';
import { getUserFriendlyMessage } from '../../core/errorUtils';
import { validateCpf, validateUrl } from '../../core/validators';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { QuotaSummaryCard } from '../../ui/components/QuotaBar/QuotaBar';
import Modal from '../../ui/components/Modal/Modal';
import './NovaSolicitacaoPage.css';

const STEP_LABELS = ['Identidade', 'Redes sociais', 'Contexto', 'Revisão'];

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

/**
 * Off-canvas panel for creating a new due diligence solicitation.
 * Props:
 *   open      — controls visibility
 *   onClose   — called when panel should close (cancel, backdrop click, after success)
 *   onSuccess — optional callback fired before close on successful submission
 */
export default function NovaSolicitacaoPanel({ open, onClose, onSuccess }) {
    const [form, setForm] = useState(INITIAL_FORM);
    const [errors, setErrors] = useState({});
    const [showOther, setShowOther] = useState(false);
    const [otherLabel, setOtherLabel] = useState('');
    const [otherUrl, setOtherUrl] = useState('');
    const [otherUrlError, setOtherUrlError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [quota, setQuota] = useState(null);
    const [quotaLoading, setQuotaLoading] = useState(false);
    const [quotaError, setQuotaError] = useState(null);
    const [showExceedModal, setShowExceedModal] = useState(false);
    const [discardModalOpen, setDiscardModalOpen] = useState(false);
    const [pendingNavigationPath, setPendingNavigationPath] = useState(null);
    const redirectTimerRef = useRef(null);
    const panelBodyRef = useRef(null);

    const navigate = useNavigate();
    const location = useLocation();
    const { user, userProfile } = useAuth();
    const tenantId = userProfile?.tenantId || null;
    const tenantLabel = userProfile?.tenantName || userProfile?.tenantId || 'Franquia em sincronização';
    const hasConfirmedTenant = Boolean(tenantId);
    const isDemoProfile = userProfile?.source === 'demo';
    const isMobile = useMediaQuery('(max-width: 768px)');
    const [step, setStep] = useState(0);
    const totalSteps = STEP_LABELS.length;
    const [openSections, setOpenSections] = useState({ social: false, context: false });

    // Reset state each time the panel opens
    useEffect(() => {
        if (open) {
            setForm(INITIAL_FORM);
            setErrors({});
            setStep(0);
            setSubmitted(false);
            setSubmitting(false);
            setShowOther(false);
            setOtherLabel('');
            setOtherUrl('');
            setOtherUrlError('');
            setShowExceedModal(false);
            setDiscardModalOpen(false);
            setPendingNavigationPath(null);
            panelBodyRef.current?.scrollTo?.(0, 0);
            setOpenSections({ social: false, context: false });
        }
    }, [open]);

    // Lock body scroll while panel is open
    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    // Load quota when panel opens
    useEffect(() => {
        if (!open || !user || isDemoProfile) return undefined;
        let cancelled = false;
        setQuotaLoading(true);
        setQuotaError(null);
        callGetClientQuotaStatus()
            .then((data) => { if (!cancelled) setQuota(data); })
            .catch((err) => { if (!cancelled) { setQuota(null); setQuotaError(err); } })
            .finally(() => { if (!cancelled) setQuotaLoading(false); });
        return () => { cancelled = true; };
    }, [open, user, isDemoProfile]);

    const isDirty = useMemo(() => {
        if (submitted) return false;
        return Object.entries(INITIAL_FORM).some(([key, initialValue]) => {
            if (Array.isArray(initialValue)) return form[key].length > 0;
            return form[key] !== initialValue;
        });
    }, [form, submitted]);

    const handleClose = useCallback(() => {
        if (isDirty && !submitting) {
            setPendingNavigationPath(null);
            setDiscardModalOpen(true);
            return;
        }
        onClose?.();
    }, [isDirty, submitting, onClose]);

    const confirmDiscard = () => {
        const path = pendingNavigationPath;
        setDiscardModalOpen(false);
        setPendingNavigationPath(null);
        onClose?.();
        if (path) navigate(path);
    };

    // Protect against browser navigation (back button / tab close) when dirty
    useEffect(() => {
        if (!isDirty || !open) return undefined;
        const handler = (event) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty, open]);

    // Intercept sidebar / anchor link clicks while form is dirty
    useEffect(() => {
        if (!isDirty || !open) return undefined;
        const handleDocumentClick = (event) => {
            const anchor = event.target.closest?.('a[href]');
            if (!anchor) return;
            if (anchor.target && anchor.target !== '_self') return;
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
            const nextUrl = new URL(href, window.location.origin);
            if (nextUrl.origin !== window.location.origin || nextUrl.pathname === location.pathname) return;
            event.preventDefault();
            setPendingNavigationPath(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
            setDiscardModalOpen(true);
        };
        document.addEventListener('click', handleDocumentClick, true);
        return () => document.removeEventListener('click', handleDocumentClick, true);
    }, [isDirty, open, location.pathname]);

    useEffect(() => {
        return () => { if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current); };
    }, []);

    const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

    const SOCIAL_FIELDS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube'];
    const filledSocials = SOCIAL_FIELDS.filter((k) => form[k]).length + form.otherSocialUrls.length;
    const socialSummary = filledSocials > 0
        ? `${filledSocials} rede${filledSocials !== 1 ? 's' : ''} informada${filledSocials !== 1 ? 's' : ''}`
        : 'Opcional — enriquece a análise OSINT';
    const contextSummary = `Prioridade ${form.priority === 'HIGH' ? 'Alta' : 'Normal'}${form.digitalProfileNotes ? ' · com observações' : ''}`;

    const update = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    };

    const validate = () => {
        const next = {};
        if (!form.fullName.trim()) next.fullName = 'Nome obrigatório — é o identificador principal do caso.';
        if (!form.cpf.trim()) next.cpf = 'CPF obrigatório para busca nas bases de dados.';
        else if (!validateCpf(form.cpf)) next.cpf = 'CPF inválido — verifique os dígitos.';
        ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube'].forEach((field) => {
            if (form[field] && !validateUrl(form[field])) {
                next[field] = 'Informe uma URL válida (https://...) ou um @usuário.';
            }
        });
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (!validate()) return;

        if (!userProfile) {
            setErrors({ general: 'Sua sessão ainda está sincronizando. Aguarde alguns segundos e tente novamente.' });
            return;
        }
        if (!tenantId) {
            setErrors({ general: 'A franquia do seu perfil ainda não foi confirmada. Aguarde a sincronização e tente novamente.' });
            return;
        }

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
                redirectTimerRef.current = window.setTimeout(() => { onSuccess?.(); onClose?.(); }, 1800);
                return;
            }
            if (!user) {
                setErrors({ general: 'Sua sessão expirou. Recarregue a página e tente novamente.' });
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
            redirectTimerRef.current = window.setTimeout(() => { onSuccess?.(); onClose?.(); }, 1800);
        } catch (error) {
            console.error('Error creating solicitation:', error);
            setErrors({ general: getUserFriendlyMessage(error, 'criar a solicitação') });
        } finally {
            setSubmitting(false);
        }
    };

    const addOtherSocial = () => {
        if (!otherUrl.trim()) return;
        if (!validateUrl(otherUrl)) { setOtherUrlError('Informe uma URL válida ou um @usuário.'); return; }
        setForm((prev) => ({ ...prev, otherSocialUrls: [...prev.otherSocialUrls, { label: otherLabel || 'Outro', url: otherUrl }] }));
        setOtherUrlError('');
        setOtherLabel('');
        setOtherUrl('');
        setShowOther(false);
    };

    const removeOtherSocial = (index) => {
        setForm((prev) => ({ ...prev, otherSocialUrls: prev.otherSocialUrls.filter((_, i) => i !== index) }));
    };

    const isValid = form.fullName.trim() && form.cpf.trim() && validateCpf(form.cpf);
    const quotaBlocked = quota?.hasLimits && (
        (quota.dailyLimit && quota.dailyCount >= quota.dailyLimit && !quota.allowDailyExceedance) ||
        (quota.monthlyLimit && quota.monthlyCount >= quota.monthlyLimit && !quota.allowMonthlyExceedance)
    );
    const canSubmit = Boolean(isValid && !submitting && hasConfirmedTenant && !quotaBlocked);

    const formId = 'ns-panel-form';

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className={`ns-panel-backdrop${open ? ' ns-panel-backdrop--visible' : ''}`}
                onClick={handleClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={`ns-panel${open ? ' ns-panel--open' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label="Nova solicitação de due diligence"
            >
                {/* Header */}
                <div className="ns-panel__header">
                    <div className="ns-panel__header-content">
                        <div className="ns-panel__header-meta">
                            <span className="ns-panel__step-badge">Due Diligence</span>
                            {tenantLabel && (
                                <span className="ns-panel__tenant-badge">{tenantLabel}</span>
                            )}
                        </div>
                        <h2 className="ns-panel__header-title">Nova solicitação de análise</h2>
                        <p className="ns-panel__header-sub">
                            Preencha os dados do candidato para abrir o dossiê. Campos com <span style={{ color: 'var(--red-500)' }}>*</span> são obrigatórios para iniciar a análise.
                        </p>
                        {!hasConfirmedTenant && (
                            <p className="ns-panel__tenant-warning">
                                Franquia não confirmada — o envio ficará bloqueado até a sincronização do perfil terminar.
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        className="ns-panel__close"
                        onClick={handleClose}
                        aria-label="Fechar painel"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="ns-panel__body" ref={panelBodyRef}>
                    {submitted ? (
                        <div className="ns-success animate-scaleIn">
                            <div className="ns-success__icon-wrap">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                            <h2>Solicitação enviada com sucesso!</h2>
                            <p>O caso foi criado e já está na fila de análise. Você pode acompanhar o andamento na lista de solicitações. O painel fechará automaticamente.</p>
                        </div>
                    ) : (
                        <form id={formId} className="ns-form" onSubmit={handleSubmit} noValidate>
                            <QuotaSummaryCard quota={quota} loading={quotaLoading} error={quotaError} />

                            {quota?.hasLimits && (() => {
                                const dailyExceeded = quota.dailyLimit && quota.dailyCount >= quota.dailyLimit;
                                const monthlyExceeded = quota.monthlyLimit && quota.monthlyCount >= quota.monthlyLimit;
                                const blocked = (dailyExceeded && !quota.allowDailyExceedance) || (monthlyExceeded && !quota.allowMonthlyExceedance);
                                if (blocked) {
                                    return (
                                        <div className="ns-quota-banner ns-quota-banner--blocked" role="alert">
                                            <strong>Limite atingido —</strong>{' '}
                                            {dailyExceeded && !quota.allowDailyExceedance
                                                ? `Você atingiu o limite diário de ${quota.dailyLimit} consultas. Novas solicitações poderão ser feitas a partir de amanhã.`
                                                : `Você atingiu o limite mensal de ${quota.monthlyLimit} consultas. Entre em contato com o administrador para ampliar a cota.`}
                                        </div>
                                    );
                                }
                                if (dailyExceeded || monthlyExceeded) {
                                    return (
                                        <div className="ns-quota-banner ns-quota-banner--warning" role="status">
                                            <strong>Atenção —</strong>{' '}
                                            {dailyExceeded
                                                ? `Você já usou ${quota.dailyCount} de ${quota.dailyLimit} consultas hoje. A próxima será contabilizada como excedente diário.`
                                                : `Você já usou ${quota.monthlyCount} de ${quota.monthlyLimit} consultas no mês. A próxima poderá ser faturada no próximo ciclo.`}
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {errors.general && (
                                <div className="login-form__error" role="alert">{errors.general}</div>
                            )}

                            {/* Mobile stepper */}
                            {isMobile && (
                                <div className="ns-stepper">
                                    <div className="ns-stepper__bar">
                                        {STEP_LABELS.map((label, i) => (
                                            <div
                                                key={label}
                                                className={`ns-stepper__dot${i <= step ? ' ns-stepper__dot--active' : ''}${i < step ? ' ns-stepper__dot--done' : ''}`}
                                            >
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

                            {/* Step 1 — Identidade */}
                            <div className="ns-section" style={isMobile && step !== 0 ? { display: 'none' } : undefined}>
                                <div className="ns-section__header">
                                    <span className="ns-section__icon">01</span>
                                    <div>
                                        <h3>Identidade do candidato</h3>
                                        <p className="ns-section__desc">Nome e CPF são obrigatórios. Os demais dados enriquecem a análise e ajudam a identificar registros em bases estaduais.</p>
                                    </div>
                                </div>

                                <div className="ns-grid ns-grid--2">
                                    <div className="ns-field">
                                        <label className="ns-label">
                                            Nome completo <span className="ns-required" aria-label="obrigatório">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className={`ns-input${errors.fullName ? ' ns-input--error' : ''}`}
                                            value={form.fullName}
                                            onChange={(e) => update('fullName', e.target.value)}
                                            placeholder="Conforme consta no documento de identidade"
                                            aria-required="true"
                                            aria-describedby={errors.fullName ? 'err-fullName' : undefined}
                                        />
                                        {errors.fullName && <span id="err-fullName" className="ns-error" role="alert">{errors.fullName}</span>}
                                    </div>

                                    <div className="ns-field">
                                        <label className="ns-label">
                                            CPF <span className="ns-required" aria-label="obrigatório">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className={`ns-input${errors.cpf ? ' ns-input--error' : ''}`}
                                            value={form.cpf}
                                            onChange={(e) => update('cpf', formatCpf(e.target.value))}
                                            placeholder="000.000.000-00"
                                            maxLength={14}
                                            aria-required="true"
                                            inputMode="numeric"
                                            aria-describedby="help-cpf"
                                        />
                                        <span id="help-cpf" className="ns-help">Identificador principal do caso — será mascarado no painel após o envio.</span>
                                        {errors.cpf && <span className="ns-error" role="alert">{errors.cpf}</span>}
                                    </div>

                                    <div className="ns-field">
                                        <label className="ns-label">Data de nascimento</label>
                                        <input
                                            type="date"
                                            className="ns-input"
                                            value={form.dateOfBirth}
                                            onChange={(e) => update('dateOfBirth', e.target.value)}
                                        />
                                        <span className="ns-help">Auxilia na confirmação de identidade em bases públicas.</span>
                                    </div>

                                    <div className="ns-field">
                                        <label className="ns-label">Cargo pretendido</label>
                                        <input
                                            type="text"
                                            className="ns-input"
                                            value={form.position}
                                            onChange={(e) => update('position', e.target.value)}
                                            placeholder="Ex.: Analista Financeiro Sênior"
                                        />
                                    </div>

                                    <div className="ns-field">
                                        <label className="ns-label">Departamento / Setor</label>
                                        <input
                                            type="text"
                                            className="ns-input"
                                            value={form.department}
                                            onChange={(e) => update('department', e.target.value)}
                                            placeholder="Ex.: Financeiro, RH, Operações"
                                        />
                                    </div>

                                    <div className="ns-field">
                                        <label className="ns-label">Estado (UF) de contratação</label>
                                        <select
                                            className="ns-input"
                                            value={form.hiringUf}
                                            onChange={(e) => update('hiringUf', e.target.value)}
                                        >
                                            <option value="">Selecione a UF...</option>
                                            {BRAZIL_UF_OPTIONS.map((uf) => (
                                                <option key={uf} value={uf}>{uf}</option>
                                            ))}
                                        </select>
                                        <span className="ns-help">Usado para direcionar a busca de processos judiciais no tribunal local.</span>
                                    </div>

                                    <div className="ns-field">
                                        <label className="ns-label">E-mail do candidato</label>
                                        <input
                                            type="email"
                                            className="ns-input"
                                            value={form.email}
                                            onChange={(e) => update('email', e.target.value)}
                                            placeholder="candidato@empresa.com"
                                        />
                                    </div>

                                    <div className="ns-field">
                                        <label className="ns-label">Telefone</label>
                                        <input
                                            type="text"
                                            className="ns-input"
                                            value={form.phone}
                                            onChange={(e) => update('phone', e.target.value)}
                                            placeholder="(11) 99999-9999"
                                            inputMode="tel"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2 — Fontes digitais */}
                            <div
                                className={`ns-section${!isMobile ? ' ns-section--accordion' : ''}${(!isMobile && openSections.social) ? ' ns-section--expanded' : ''}`}
                                style={isMobile && step !== 1 ? { display: 'none' } : undefined}
                            >
                                <div
                                    className="ns-section__header"
                                    onClick={!isMobile ? () => toggleSection('social') : undefined}
                                    role={!isMobile ? 'button' : undefined}
                                    tabIndex={!isMobile ? 0 : undefined}
                                    onKeyDown={!isMobile ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection('social'); } } : undefined}
                                    aria-expanded={!isMobile ? openSections.social : undefined}
                                >
                                    <span className="ns-section__icon">02</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3>Perfis nas redes sociais</h3>
                                        {(!isMobile && !openSections.social) ? (
                                            <p className="ns-section__summary">{socialSummary}</p>
                                        ) : (
                                            <p className="ns-section__desc">Informe ao menos uma rede para alimentar a análise de imagem pública e OSINT. Use a URL completa do perfil ou @usuário.</p>
                                        )}
                                    </div>
                                    {!isMobile && (
                                        <span className="ns-section__chevron" aria-hidden="true">
                                            {openSections.social ? '−' : '+'}
                                        </span>
                                    )}
                                </div>

                                {(isMobile || openSections.social) && (
                                <div className="ns-section__accordion-body">
                                <div className="ns-grid ns-grid--2">
                                    {[
                                        { key: 'instagram', icon: 'IG', label: 'Instagram', placeholder: '@usuario ou https://instagram.com/usuario' },
                                        { key: 'facebook', icon: 'FB', label: 'Facebook', placeholder: 'https://facebook.com/usuario' },
                                        { key: 'linkedin', icon: 'IN', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/usuario', help: 'Prefira a URL completa do perfil público para maior precisão na busca.' },
                                        { key: 'tiktok', icon: 'TT', label: 'TikTok', placeholder: '@usuario ou https://tiktok.com/@usuario' },
                                        { key: 'twitter', icon: 'X', label: 'Twitter / X', placeholder: '@usuario ou https://x.com/usuario' },
                                        { key: 'youtube', icon: 'YT', label: 'YouTube', placeholder: 'https://youtube.com/@canal' },
                                    ].map(({ key, icon, label, placeholder, help }) => (
                                        <div key={key} className="ns-field ns-field--social">
                                            <label className="ns-label">
                                                <span className="ns-social-icon">{icon}</span> {label}
                                            </label>
                                            <input
                                                type="text"
                                                className={`ns-input${errors[key] ? ' ns-input--error' : ''}`}
                                                value={form[key]}
                                                onChange={(e) => update(key, e.target.value)}
                                                placeholder={placeholder}
                                            />
                                            {help && <span className="ns-help">{help}</span>}
                                            {errors[key] && <span className="ns-error" role="alert">{errors[key]}</span>}
                                        </div>
                                    ))}
                                </div>

                                {form.otherSocialUrls.length > 0 && (
                                    <div className="ns-other-socials">
                                        {form.otherSocialUrls.map((item, index) => (
                                            <div key={`${item.label}-${index}`} className="ns-other-social">
                                                <span>{item.label}: {item.url}</span>
                                                <button
                                                    type="button"
                                                    className="ns-other-social__remove"
                                                    onClick={() => removeOtherSocial(index)}
                                                    aria-label={`Remover ${item.label}`}
                                                >
                                                    Remover
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
                                            onChange={(e) => setOtherLabel(e.target.value)}
                                            placeholder="Nome da rede (ex.: Kwai)"
                                        />
                                        <input
                                            type="text"
                                            className="ns-input ns-input--sm"
                                            value={otherUrl}
                                            onChange={(e) => { setOtherUrl(e.target.value); if (otherUrlError) setOtherUrlError(''); }}
                                            placeholder="URL completa ou @handle"
                                        />
                                        {otherUrlError && <span className="ns-error ns-error--inline" role="alert">{otherUrlError}</span>}
                                        <button type="button" className="ns-btn ns-btn--sm ns-btn--primary" onClick={addOtherSocial}>Adicionar</button>
                                        <button type="button" className="ns-btn ns-btn--sm ns-btn--ghost" onClick={() => setShowOther(false)}>Cancelar</button>
                                    </div>
                                ) : (
                                    <button type="button" className="ns-btn ns-btn--ghost ns-btn--add" onClick={() => setShowOther(true)}>
                                        + Adicionar outra rede social
                                    </button>
                                )}
                                </div>
                                )}
                            </div>

                            {/* Step 3 — Contexto */}
                            <div
                                className={`ns-section${!isMobile ? ' ns-section--accordion' : ''}${(!isMobile && openSections.context) ? ' ns-section--expanded' : ''}`}
                                style={isMobile && step !== 2 ? { display: 'none' } : undefined}
                            >
                                <div
                                    className="ns-section__header"
                                    onClick={!isMobile ? () => toggleSection('context') : undefined}
                                    role={!isMobile ? 'button' : undefined}
                                    tabIndex={!isMobile ? 0 : undefined}
                                    onKeyDown={!isMobile ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection('context'); } } : undefined}
                                    aria-expanded={!isMobile ? openSections.context : undefined}
                                >
                                    <span className="ns-section__icon">03</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3>Contexto da solicitação</h3>
                                        {(!isMobile && !openSections.context) ? (
                                            <p className="ns-section__summary">{contextSummary}</p>
                                        ) : (
                                            <p className="ns-section__desc">Informações adicionais que ajudam o analista a focar nos pontos mais relevantes da investigação.</p>
                                        )}
                                    </div>
                                    {!isMobile && (
                                        <span className="ns-section__chevron" aria-hidden="true">
                                            {openSections.context ? '−' : '+'}
                                        </span>
                                    )}
                                </div>

                                {(isMobile || openSections.context) && (
                                <div className="ns-section__accordion-body">

                                <div className="ns-field">
                                    <label className="ns-label">Observações para o analista</label>
                                    <textarea
                                        className="ns-textarea"
                                        value={form.digitalProfileNotes}
                                        onChange={(e) => update('digitalProfileNotes', e.target.value)}
                                        placeholder="Informe aqui contextos úteis: apelidos conhecidos, outros nomes, contas alternativas, histórico relevante ou pontos de atenção específicos..."
                                        maxLength={500}
                                        rows={4}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="ns-help">Visível apenas para a equipe interna de análise — não aparece no dossiê público.</span>
                                        <span className="ns-char-count">{form.digitalProfileNotes.length}/500</span>
                                    </div>
                                </div>

                                <div className="ns-field" style={{ marginTop: 'var(--space-3)' }}>
                                    <label className="ns-label">Prioridade da análise</label>
                                    <div className="ns-priority-selector">
                                        <div className="ns-priority-option">
                                            <button
                                                type="button"
                                                className={`ns-priority-btn${form.priority === 'NORMAL' ? ' ns-priority-btn--active' : ''}`}
                                                onClick={() => update('priority', 'NORMAL')}
                                            >
                                                Normal
                                            </button>
                                            <span className="ns-priority-hint">Prazo padrão do contrato</span>
                                        </div>
                                        <div className="ns-priority-option">
                                            <button
                                                type="button"
                                                className={`ns-priority-btn ns-priority-btn--high${form.priority === 'HIGH' ? ' ns-priority-btn--active' : ''}`}
                                                onClick={() => update('priority', 'HIGH')}
                                            >
                                                Alta
                                            </button>
                                            <span className="ns-priority-hint">Retorno em até 24 h úteis</span>
                                        </div>
                                    </div>
                                </div>
                                </div>
                                )}
                            </div>

                            {/* Step 4 — Revisão (mobile only) */}
                            {isMobile && step === 3 && (
                                <div className="ns-section ns-review">
                                    <div className="ns-section__header">
                                        <span className="ns-section__icon">04</span>
                                        <div>
                                            <h3>Revisão antes de enviar</h3>
                                            <p className="ns-section__desc">Confirme os dados abaixo. Depois do envio não é possível editar o caso — apenas solicitar correção via analista.</p>
                                        </div>
                                    </div>
                                    <div className="ns-review__group">
                                        <div className="ns-review__heading">
                                            Dados do candidato
                                            <button type="button" className="ns-review__edit" onClick={() => setStep(0)}>Editar</button>
                                        </div>
                                        <div className="ns-review__item"><span>Nome:</span> {form.fullName || '—'}</div>
                                        <div className="ns-review__item"><span>CPF:</span> {form.cpf ? maskCpf(form.cpf) : '—'}</div>
                                        {form.dateOfBirth && <div className="ns-review__item"><span>Nascimento:</span> {form.dateOfBirth}</div>}
                                        {form.position && <div className="ns-review__item"><span>Cargo:</span> {form.position}</div>}
                                        {form.department && <div className="ns-review__item"><span>Departamento:</span> {form.department}</div>}
                                        {form.hiringUf && <div className="ns-review__item"><span>UF:</span> {form.hiringUf}</div>}
                                        {form.email && <div className="ns-review__item"><span>E-mail:</span> {form.email}</div>}
                                        {form.phone && <div className="ns-review__item"><span>Telefone:</span> {form.phone}</div>}
                                    </div>
                                    <div className="ns-review__group">
                                        <div className="ns-review__heading">
                                            Redes sociais
                                            <button type="button" className="ns-review__edit" onClick={() => setStep(1)}>Editar</button>
                                        </div>
                                        {['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube'].filter((k) => form[k]).map((k) => (
                                            <div key={k} className="ns-review__item"><span>{k}:</span> {form[k]}</div>
                                        ))}
                                        {form.otherSocialUrls.map((s, i) => (
                                            <div key={i} className="ns-review__item"><span>{s.label}:</span> {s.url}</div>
                                        ))}
                                        {!['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube'].some((k) => form[k]) && form.otherSocialUrls.length === 0 && (
                                            <div className="ns-review__item ns-review__item--empty">Nenhuma rede informada — a análise OSINT ficará limitada.</div>
                                        )}
                                    </div>
                                    <div className="ns-review__group">
                                        <div className="ns-review__heading">
                                            Contexto
                                            <button type="button" className="ns-review__edit" onClick={() => setStep(2)}>Editar</button>
                                        </div>
                                        <div className="ns-review__item"><span>Observações:</span> {form.digitalProfileNotes || '(nenhuma)'}</div>
                                        <div className="ns-review__item"><span>Prioridade:</span> {form.priority === 'HIGH' ? 'Alta — retorno em até 24 h úteis' : 'Normal — prazo padrão do contrato'}</div>
                                    </div>
                                </div>
                            )}

                            {/* Mobile wizard footer */}
                            {isMobile && (
                                <div className="ns-actions ns-actions--wizard">
                                    {step > 0 ? (
                                        <button type="button" className="ns-btn ns-btn--ghost" onClick={() => setStep(step - 1)}>Anterior</button>
                                    ) : (
                                        <button type="button" className="ns-btn ns-btn--ghost" onClick={handleClose}>Cancelar</button>
                                    )}
                                    {step < totalSteps - 1 ? (
                                        <button type="button" className="ns-btn ns-btn--primary" onClick={() => { if (step === 0 && !validate()) return; setStep(step + 1); }}>Próximo</button>
                                    ) : (
                                        <button type="submit" className="ns-btn ns-btn--primary" disabled={!canSubmit}>
                                            {submitting ? 'Enviando...' : 'Enviar solicitação'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </form>
                    )}
                </div>

                {/* Desktop footer */}
                {!submitted && !isMobile && (
                    <div className="ns-panel__footer">
                        <button type="button" className="ns-btn ns-btn--ghost" onClick={handleClose}>
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form={formId}
                            className="ns-btn ns-btn--primary"
                            disabled={!canSubmit}
                        >
                            {submitting ? 'Enviando...' : 'Enviar solicitação'}
                        </button>
                    </div>
                )}
            </div>

            {/* Quota exceedance confirmation */}
            <Modal
                open={showExceedModal}
                onClose={() => setShowExceedModal(false)}
                title="Confirmar envio excedente?"
                footer={(
                    <>
                        <button type="button" className="ns-btn ns-btn--ghost" onClick={() => setShowExceedModal(false)}>Cancelar</button>
                        <button type="button" className="ns-btn ns-btn--primary" disabled={submitting} onClick={handleSubmit}>
                            {submitting ? 'Enviando...' : 'Confirmar envio excedente'}
                        </button>
                    </>
                )}
            >
                <div className="ns-critical-modal">
                    <p>
                        {quota?.dailyLimit && quota.dailyCount >= quota.dailyLimit
                            ? `Você já usou ${quota.dailyCount} de ${quota.dailyLimit} consultas hoje. Esta solicitação será registrada como excedente diário e poderá gerar custo adicional.`
                            : `Você já usou ${quota?.monthlyCount} de ${quota?.monthlyLimit} consultas neste mês. Esta solicitação poderá ser faturada no próximo ciclo.`}
                    </p>
                    <dl>
                        <div><dt>Franquia</dt><dd>{tenantLabel}</dd></div>
                        <div><dt>Candidato</dt><dd>{form.fullName || '(nome não informado)'}</dd></div>
                        <div><dt>CPF</dt><dd>{form.cpf ? maskCpf(form.cpf) : '(CPF não informado)'}</dd></div>
                    </dl>
                    <p>A tentativa será registrada na auditoria independentemente do resultado.</p>
                </div>
            </Modal>

            {/* Discard confirmation */}
            <Modal
                open={discardModalOpen}
                onClose={() => setDiscardModalOpen(false)}
                title="Descartar preenchimento?"
                footer={(
                    <>
                        <button type="button" className="ns-btn ns-btn--ghost" onClick={() => setDiscardModalOpen(false)}>
                            Continuar preenchendo
                        </button>
                        <button type="button" className="ns-btn ns-btn--primary ns-btn--danger" onClick={confirmDiscard}>
                            Descartar e sair
                        </button>
                    </>
                )}
            >
                <div className="ns-critical-modal">
                    <p>Existem dados preenchidos que ainda não foram enviados. Ao fechar, o rascunho será perdido e você precisará preencher novamente.</p>
                    <dl>
                        <div><dt>Franquia</dt><dd>{tenantLabel}</dd></div>
                        <div><dt>Candidato</dt><dd>{form.fullName || '(nome não preenchido ainda)'}</dd></div>
                        <div><dt>CPF</dt><dd>{form.cpf ? maskCpf(form.cpf) : '(CPF não preenchido ainda)'}</dd></div>
                    </dl>
                </div>
            </Modal>
        </>,
        document.body,
    );
}
