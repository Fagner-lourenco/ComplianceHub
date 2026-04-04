import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/useAuth';
import { createCandidate, createCase, getEnabledPhases, getTenantSettings, logAuditEvent } from '../../core/firebase/firestoreService';
import { buildClientPortalPath } from '../../core/portalPaths';
import { useCases } from '../../hooks/useCases';
import './NovaSolicitacaoPage.css';

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

function validateCpf(cpf) {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;
    for (let t = 9; t < 11; t++) {
        let sum = 0;
        for (let i = 0; i < t; i++) sum += Number(digits[i]) * (t + 1 - i);
        const remainder = (sum * 10) % 11;
        if ((remainder === 10 ? 0 : remainder) !== Number(digits[t])) return false;
    }
    return true;
}

function validateUrl(url) {
    if (!url) return true;
    if (url.startsWith('@')) return true;

    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
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
    const redirectTimerRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, userProfile } = useAuth();
    const { cases: existingCases } = useCases();
    const tenantId = userProfile?.tenantId || null;
    const tenantLabel = userProfile?.tenantName || userProfile?.tenantId || 'Franquia em sincronizacao';
    const hasConfirmedTenant = Boolean(tenantId);
    const isDemoProfile = userProfile?.source === 'demo';

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

            const tenantName = userProfile.tenantName || userProfile.tenantId;
            const cpfMasked = maskCpf(form.cpf);
            const cpfClean = form.cpf.replace(/\D/g, '');
            const requestedByName = userProfile.displayName || user.displayName || null;
            const requestedByEmail = userProfile.email || user.email || null;
            const requestedByLabel = requestedByEmail || requestedByName || user.uid;

            const tenantSettings = await getTenantSettings(tenantId);
            const enabledPhases = getEnabledPhases(tenantSettings.analysisConfig);

            // Check query limits
            const now = new Date();
            const todayStr = now.toISOString().slice(0, 10);
            const monthStr = now.toISOString().slice(0, 7);
            if (tenantSettings.dailyLimit) {
                const todayCount = existingCases.filter(c => c.createdAt?.slice?.(0, 10) === todayStr).length;
                if (todayCount >= tenantSettings.dailyLimit) {
                    setErrors({ general: `Limite diario de ${tenantSettings.dailyLimit} consultas atingido. Tente novamente amanha.` });
                    setSubmitting(false);
                    return;
                }
            }
            if (tenantSettings.monthlyLimit) {
                const monthCount = existingCases.filter(c => c.createdAt?.slice?.(0, 7) === monthStr).length;
                if (monthCount >= tenantSettings.monthlyLimit) {
                    setErrors({ general: `Limite mensal de ${tenantSettings.monthlyLimit} consultas atingido. Entre em contato com o administrador.` });
                    setSubmitting(false);
                    return;
                }
            }

            const candidateId = await createCandidate({
                tenantId,
                candidateName: form.fullName,
                cpf: cpfClean,
                cpfMasked,
                candidatePosition: form.position,
                department: form.department,
                email: form.email,
                phone: form.phone,
                instagram: form.instagram,
                facebook: form.facebook,
                linkedin: form.linkedin,
                tiktok: form.tiktok,
                twitter: form.twitter,
                youtube: form.youtube,
                otherSocialUrls: form.otherSocialUrls,
            });

            const caseId = await createCase({
                tenantId,
                tenantName,
                candidateId,
                candidateName: form.fullName,
                candidatePosition: form.position || '',
                cpf: cpfClean,
                cpfMasked,
                hiringUf: form.hiringUf || '',
                priority: form.priority,
                requestedBy: requestedByLabel,
                requestedByName,
                requestedByEmail,
                enabledPhases,
                socialProfiles: {
                    instagram: form.instagram,
                    facebook: form.facebook,
                    linkedin: form.linkedin,
                    tiktok: form.tiktok,
                    twitter: form.twitter,
                    youtube: form.youtube,
                },
            });

            await logAuditEvent({
                tenantId,
                userId: user.uid,
                userEmail: user.email,
                action: 'SOLICITATION_CREATED',
                target: caseId,
                detail: `Nova solicitacao criada para ${form.fullName}`,
            });

            setSubmitted(true);
            redirectTimerRef.current = window.setTimeout(() => navigate(buildClientPortalPath(location.pathname, 'solicitacoes')), 1500);
        } catch (error) {
            console.error('Error creating solicitation:', error);
            setErrors({ general: 'Erro ao criar solicitacao. Tente novamente.' });
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
    const canSubmit = Boolean(isValid && !submitting && hasConfirmedTenant);

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

            <form className="ns-form" onSubmit={handleSubmit}>
                {errors.general && (
                    <div className="login-form__error" style={{ marginBottom: 16 }}>
                        {errors.general}
                    </div>
                )}

                <div className="ns-section">
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

                <div className="ns-section">
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

                <div className="ns-section">
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

                <div className="ns-actions">
                    <button type="button" className="ns-btn ns-btn--ghost" onClick={() => navigate(buildClientPortalPath(location.pathname, 'solicitacoes'))}>
                        Cancelar
                    </button>
                    <button type="submit" className="ns-btn ns-btn--primary" disabled={!canSubmit}>
                        {submitting ? 'Enviando...' : 'Enviar Solicitacao'}
                    </button>
                </div>
            </form>
        </div>
    );
}
