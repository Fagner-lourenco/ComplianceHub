import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { createCandidate, createCase, logAuditEvent } from '../../core/firebase/firestoreService';
import './NovaSolicitacaoPage.css';

const INITIAL_FORM = {
    fullName: '',
    cpf: '',
    dateOfBirth: '',
    position: '',
    department: '',
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

function formatCpf(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function validateCpf(cpf) {
    const digits = cpf.replace(/\D/g, '');
    return digits.length === 11;
}

function validateUrl(url) {
    if (!url) return true;
    if (url.startsWith('@')) return true;
    try { new URL(url); return true; } catch { return false; }
}

function maskCpf(cpf) {
    const digits = cpf.replace(/\D/g, '');
    return `***.***.***.${digits.slice(9)}`;
}

export default function NovaSolicitacaoPage() {
    const [form, setForm] = useState(INITIAL_FORM);
    const [errors, setErrors] = useState({});
    const [showOther, setShowOther] = useState(false);
    const [otherLabel, setOtherLabel] = useState('');
    const [otherUrl, setOtherUrl] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();

    const update = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const validate = () => {
        const e = {};
        if (!form.fullName.trim()) e.fullName = 'Nome é obrigatório';
        if (!form.cpf.trim()) e.cpf = 'CPF é obrigatório';
        else if (!validateCpf(form.cpf)) e.cpf = 'CPF inválido (11 dígitos)';

        ['instagram', 'facebook', 'linkedin', 'tiktok', 'twitter', 'youtube'].forEach(field => {
            if (form[field] && !validateUrl(form[field])) e[field] = 'URL ou @handle inválido';
        });

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        if (!validate()) return;
        setSubmitting(true);

        try {
            if (user && userProfile) {
                // Real mode — write to Firestore
                const tenantId = userProfile.tenantId || 'default';
                const tenantName = userProfile.tenantName || userProfile.displayName || 'Empresa';
                const cpfMasked = maskCpf(form.cpf);

                const candidateId = await createCandidate({
                    tenantId,
                    fullName: form.fullName,
                    cpfMasked,
                    position: form.position,
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
                    cpfMasked,
                    priority: form.priority,
                    requestedBy: user.uid,
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
                    detail: `Nova solicitação criada para ${form.fullName}`,
                });
            } else {
                // Demo mode — just log
                console.log('Demo mode — Submitting solicitation:', form);
            }

            setSubmitted(true);
            setTimeout(() => navigate('/client/solicitacoes'), 1500);
        } catch (err) {
            console.error('Error creating solicitation:', err);
            setErrors({ general: 'Erro ao criar solicitação. Tente novamente.' });
        } finally {
            setSubmitting(false);
        }
    };

    const addOtherSocial = () => {
        if (!otherUrl.trim()) return;
        setForm(prev => ({
            ...prev,
            otherSocialUrls: [...prev.otherSocialUrls, { label: otherLabel || 'Outro', url: otherUrl }],
        }));
        setOtherLabel('');
        setOtherUrl('');
        setShowOther(false);
    };

    const removeOtherSocial = (index) => {
        setForm(prev => ({
            ...prev,
            otherSocialUrls: prev.otherSocialUrls.filter((_, i) => i !== index),
        }));
    };

    if (submitted) {
        return (
            <div className="ns-page">
                <div className="ns-success animate-scaleIn">
                    <span className="ns-success__icon">✅</span>
                    <h2>Solicitação enviada!</h2>
                    <p>O caso foi criado com sucesso e está aguardando análise.</p>
                </div>
            </div>
        );
    }

    const isValid = form.fullName.trim() && form.cpf.trim() && validateCpf(form.cpf);

    return (
        <div className="ns-page">
            <div className="ns-page__header">
                <h2>Nova Solicitação de Due Diligence</h2>
                <p>Preencha os dados do candidato para iniciar a análise.</p>
            </div>

            <form className="ns-form" onSubmit={handleSubmit}>
                {/* Section 1: Candidate Data */}
                <div className="ns-section">
                    <div className="ns-section__header">
                        <span className="ns-section__icon">👤</span>
                        <h3>Dados do Candidato</h3>
                    </div>

                    <div className="ns-grid ns-grid--2">
                        <div className="ns-field">
                            <label className="ns-label">Nome completo <span className="ns-required">*</span></label>
                            <input
                                type="text"
                                className={`ns-input ${errors.fullName ? 'ns-input--error' : ''}`}
                                value={form.fullName}
                                onChange={e => update('fullName', e.target.value)}
                                placeholder="Nome completo do candidato"
                            />
                            {errors.fullName && <span className="ns-error">{errors.fullName}</span>}
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">CPF <span className="ns-required">*</span></label>
                            <input
                                type="text"
                                className={`ns-input ${errors.cpf ? 'ns-input--error' : ''}`}
                                value={form.cpf}
                                onChange={e => update('cpf', formatCpf(e.target.value))}
                                placeholder="000.000.000-00"
                                maxLength={14}
                            />
                            {errors.cpf && <span className="ns-error">{errors.cpf}</span>}
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">Data de nascimento</label>
                            <input type="date" className="ns-input" value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} />
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">Cargo pretendido</label>
                            <input type="text" className="ns-input" value={form.position} onChange={e => update('position', e.target.value)} placeholder="Ex.: Analista Financeiro" />
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">Departamento / Setor</label>
                            <input type="text" className="ns-input" value={form.department} onChange={e => update('department', e.target.value)} placeholder="Ex.: Financeiro" />
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">Email</label>
                            <input type="email" className="ns-input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="candidato@email.com" />
                        </div>

                        <div className="ns-field">
                            <label className="ns-label">Telefone</label>
                            <input type="text" className="ns-input" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(11) 99999-9999" />
                        </div>
                    </div>
                </div>

                {/* Section 2: Social Media */}
                <div className="ns-section">
                    <div className="ns-section__header">
                        <span className="ns-section__icon">🌐</span>
                        <h3>Redes Sociais</h3>
                        <span className="ns-section__hint">Informe os perfis do candidato para análise digital</span>
                    </div>

                    <div className="ns-grid ns-grid--2">
                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">📸</span> Instagram</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.instagram ? 'ns-input--error' : ''}`}
                                value={form.instagram}
                                onChange={e => update('instagram', e.target.value)}
                                placeholder="@usuario ou https://instagram.com/..."
                            />
                            {errors.instagram && <span className="ns-error">{errors.instagram}</span>}
                        </div>

                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">📘</span> Facebook</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.facebook ? 'ns-input--error' : ''}`}
                                value={form.facebook}
                                onChange={e => update('facebook', e.target.value)}
                                placeholder="https://facebook.com/..."
                            />
                            {errors.facebook && <span className="ns-error">{errors.facebook}</span>}
                        </div>

                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">💼</span> LinkedIn</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.linkedin ? 'ns-input--error' : ''}`}
                                value={form.linkedin}
                                onChange={e => update('linkedin', e.target.value)}
                                placeholder="https://linkedin.com/in/..."
                            />
                            {errors.linkedin && <span className="ns-error">{errors.linkedin}</span>}
                        </div>

                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">🎵</span> TikTok</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.tiktok ? 'ns-input--error' : ''}`}
                                value={form.tiktok}
                                onChange={e => update('tiktok', e.target.value)}
                                placeholder="@usuario ou https://tiktok.com/..."
                            />
                            {errors.tiktok && <span className="ns-error">{errors.tiktok}</span>}
                        </div>

                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">🐦</span> Twitter / X</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.twitter ? 'ns-input--error' : ''}`}
                                value={form.twitter}
                                onChange={e => update('twitter', e.target.value)}
                                placeholder="@usuario ou https://x.com/..."
                            />
                            {errors.twitter && <span className="ns-error">{errors.twitter}</span>}
                        </div>

                        <div className="ns-field ns-field--social">
                            <label className="ns-label"><span className="ns-social-icon">▶️</span> YouTube</label>
                            <input
                                type="text"
                                className={`ns-input ${errors.youtube ? 'ns-input--error' : ''}`}
                                value={form.youtube}
                                onChange={e => update('youtube', e.target.value)}
                                placeholder="https://youtube.com/..."
                            />
                            {errors.youtube && <span className="ns-error">{errors.youtube}</span>}
                        </div>
                    </div>

                    {/* Other social URLs */}
                    {form.otherSocialUrls.length > 0 && (
                        <div className="ns-other-socials">
                            {form.otherSocialUrls.map((item, i) => (
                                <div key={i} className="ns-other-social">
                                    <span>🔗 {item.label}: {item.url}</span>
                                    <button type="button" className="ns-other-social__remove" onClick={() => removeOtherSocial(i)}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {showOther ? (
                        <div className="ns-add-other">
                            <input type="text" className="ns-input ns-input--sm" value={otherLabel} onChange={e => setOtherLabel(e.target.value)} placeholder="Nome da rede (ex.: Kwai)" />
                            <input type="text" className="ns-input ns-input--sm" value={otherUrl} onChange={e => setOtherUrl(e.target.value)} placeholder="URL ou @handle" />
                            <button type="button" className="ns-btn ns-btn--sm ns-btn--primary" onClick={addOtherSocial}>Adicionar</button>
                            <button type="button" className="ns-btn ns-btn--sm ns-btn--ghost" onClick={() => setShowOther(false)}>Cancelar</button>
                        </div>
                    ) : (
                        <button type="button" className="ns-btn ns-btn--ghost ns-btn--add" onClick={() => setShowOther(true)}>
                            ➕ Adicionar outra rede social
                        </button>
                    )}
                </div>

                {/* Section 3: Notes */}
                <div className="ns-section">
                    <div className="ns-section__header">
                        <span className="ns-section__icon">📝</span>
                        <h3>Observações</h3>
                    </div>

                    <div className="ns-field">
                        <label className="ns-label">Notas sobre perfil digital</label>
                        <textarea
                            className="ns-textarea"
                            value={form.digitalProfileNotes}
                            onChange={e => update('digitalProfileNotes', e.target.value)}
                            placeholder="Informações adicionais para o analista (opcional)..."
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
                                🔴 Alta
                            </button>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="ns-actions">
                    <button type="button" className="ns-btn ns-btn--ghost" onClick={() => navigate('/client/solicitacoes')}>
                        Cancelar
                    </button>
                    <button type="submit" className="ns-btn ns-btn--primary" disabled={!isValid}>
                        Enviar Solicitação
                    </button>
                </div>
            </form>
        </div>
    );
}
