import { useCallback, useMemo, useState } from 'react';
import PageShell from '../ui/layouts/PageShell';
import PageHeader from '../ui/components/PageHeader/PageHeader';
import { useAuth } from '../core/auth/useAuth';
import { callUpdateOwnProfile } from '../core/firebase/firestoreService';
import { formatRoleLabel, getPortal } from '../core/rbac/permissions';
import { extractErrorMessage, getUserFriendlyMessage } from '../core/errorUtils';
import {
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
} from 'firebase/auth';
import './PerfilPage.css';

export default function PerfilPage() {
    const { user, userProfile, refreshProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';

    const displayName = userProfile?.displayName || 'Usuário';
    const displayEmail = userProfile?.email || user?.email || '';
    const displayRole = formatRoleLabel(userProfile?.role);
    const displayTenant = userProfile?.tenantName || '—';
    const initials = (displayName[0] || 'U').toUpperCase();
    const portal = getPortal(userProfile?.role);
    const portalLabel = portal === 'ops' ? 'Painel operacional' : 'Portal do cliente';

    const hasPasswordProvider = useMemo(() => {
        if (!user?.providerData) return false;
        return user.providerData.some((p) => p.providerId === 'password');
    }, [user]);

    /* ── Name editing ── */
    const [editingName, setEditingName] = useState(false);
    const [newName, setNewName] = useState('');
    const [nameSaving, setNameSaving] = useState(false);
    const [nameMsg, setNameMsg] = useState(null);

    const handleEditName = () => {
        setNewName(displayName);
        setNameMsg(null);
        setEditingName(true);
    };

    const handleSaveName = useCallback(async () => {
        const trimmed = newName.trim();
        if (trimmed.length < 2) {
            setNameMsg({ type: 'error', text: 'Nome precisa ter ao menos 2 caracteres.' });
            return;
        }
        if (trimmed.length > 80) {
            setNameMsg({ type: 'error', text: 'Nome pode ter no máximo 80 caracteres.' });
            return;
        }
        if (isDemoMode) {
            setNameMsg({ type: 'success', text: '(Demo) Nome atualizado.' });
            setEditingName(false);
            return;
        }
        try {
            setNameSaving(true);
            setNameMsg(null);
            await callUpdateOwnProfile({ displayName: trimmed, portal });
            await refreshProfile();
            setNameMsg({ type: 'success', text: 'Nome atualizado com sucesso.' });
            setEditingName(false);
        } catch (err) {
            setNameMsg({ type: 'error', text: getUserFriendlyMessage(err, 'atualizar nome') });
        } finally {
            setNameSaving(false);
        }
    }, [newName, isDemoMode, refreshProfile, portal]);

    /* ── Password reset ── */
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMsg, setPwMsg] = useState(null);

    const handleResetPassword = useCallback(async (e) => {
        e.preventDefault();
        if (!currentPw || !newPw || !confirmPw) {
            setPwMsg({ type: 'error', text: 'Preencha todos os campos.' });
            return;
        }
        if (newPw.length < 8) {
            setPwMsg({ type: 'error', text: 'Nova senha precisa ter ao menos 8 caracteres.' });
            return;
        }
        if (newPw !== confirmPw) {
            setPwMsg({ type: 'error', text: 'As senhas não coincidem.' });
            return;
        }
        if (isDemoMode) {
            setPwMsg({ type: 'success', text: '(Demo) Senha redefinida.' });
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
            return;
        }
        try {
            setPwSaving(true);
            setPwMsg(null);
            const credential = EmailAuthProvider.credential(user.email, currentPw);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPw);
            setPwMsg({ type: 'success', text: 'Senha redefinida com sucesso.' });
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
        } catch (err) {
            const code = err?.code || '';
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                setPwMsg({ type: 'error', text: 'Senha atual incorreta.' });
            } else if (code === 'auth/weak-password') {
                setPwMsg({ type: 'error', text: 'Senha muito fraca. Use ao menos 8 caracteres.' });
            } else {
                setPwMsg({ type: 'error', text: extractErrorMessage(err, 'Nao foi possivel redefinir a senha.') });
            }
        } finally {
            setPwSaving(false);
        }
    }, [currentPw, newPw, confirmPw, isDemoMode, user]);

    /* ── Account info ── */
    const createdAt = user?.metadata?.creationTime
        ? new Date(user.metadata.creationTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';
    const lastLogin = user?.metadata?.lastSignInTime
        ? new Date(user.metadata.lastSignInTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';

    const providerLabel = useMemo(() => {
        if (!user?.providerData?.length) return '—';
        const ids = user.providerData.map((p) => p.providerId);
        if (ids.includes('password') && ids.includes('google.com')) return 'Senha + Google';
        if (ids.includes('password')) return 'Email e senha';
        if (ids.includes('google.com')) return 'Google';
        return ids.join(', ');
    }, [user]);

    return (
        <PageShell size="form" className="perfil-page">
            <PageHeader
                eyebrow="Minha conta"
                title="Perfil"
                description="Consulte seus dados de acesso e preferências."
            />
            <div className="perfil-identity">
                <div className="perfil-hero__avatar">{initials}</div>
                <div className="perfil-hero__info">
                    <h2 className="perfil-hero__name">{displayName}</h2>
                    <p className="perfil-hero__email">{displayEmail}</p>
                    <div className="perfil-hero__badges">
                        <span className="perfil-badge perfil-badge--role">{displayRole}</span>
                        <span className="perfil-badge perfil-badge--tenant">{displayTenant}</span>
                        <span className="perfil-badge perfil-badge--portal">{portalLabel}</span>
                    </div>
                </div>
            </div>

            <div className="perfil-grid">
                {/* Card: Dados pessoais */}
                <div className="perfil-card">
                    <div className="perfil-card__header">
                        <span className="perfil-card__icon">👤</span>
                        <span className="perfil-card__title">Dados pessoais</span>
                    </div>
                    <div className="perfil-card__body">
                        {nameMsg && <div className={`perfil-alert perfil-alert--${nameMsg.type}`}>{nameMsg.text}</div>}

                        {editingName ? (
                            <form onSubmit={(e) => { e.preventDefault(); handleSaveName(); }}>
                                <div className="perfil-field">
                                    <label htmlFor="perfil-name">Nome completo</label>
                                    <input
                                        id="perfil-name"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        disabled={nameSaving}
                                        autoFocus
                                        maxLength={80}
                                        aria-describedby="perfil-name-hint"
                                    />
                                    <span id="perfil-name-hint" className="perfil-field__hint">{newName.length}/80 caracteres</span>
                                </div>
                                <div className="perfil-form-actions">
                                    <button type="submit" className="perfil-btn perfil-btn--primary" disabled={nameSaving}>
                                        {nameSaving ? 'Salvando...' : 'Salvar'}
                                    </button>
                                    <button type="button" className="perfil-btn perfil-btn--secondary" onClick={() => setEditingName(false)} disabled={nameSaving}>
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <div className="perfil-field">
                                    <label htmlFor="perfil-name-readonly">Nome completo</label>
                                    <input id="perfil-name-readonly" readOnly value={displayName} />
                                </div>
                                <div className="perfil-field">
                                    <label htmlFor="perfil-email-readonly">Email</label>
                                    <input id="perfil-email-readonly" readOnly value={displayEmail} />
                                </div>
                                <button type="button" className="perfil-btn perfil-btn--secondary" onClick={handleEditName} style={{ marginTop: 4 }}>
                                    Editar nome
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Card: Segurança */}
                <div className="perfil-card">
                    <div className="perfil-card__header">
                        <span className="perfil-card__icon">🔒</span>
                        <span className="perfil-card__title">Segurança</span>
                    </div>
                    <div className="perfil-card__body">
                        {pwMsg && <div className={`perfil-alert perfil-alert--${pwMsg.type}`}>{pwMsg.text}</div>}

                        {!hasPasswordProvider ? (
                            <div className="perfil-info-row">
                                <span className="perfil-info-row__label">Método de autenticação</span>
                                <span className="perfil-info-row__value">{providerLabel}</span>
                            </div>
                        ) : (
                            <form onSubmit={handleResetPassword}>
                                <div className="perfil-field">
                                    <label htmlFor="perfil-current-pw">Senha atual</label>
                                    <input id="perfil-current-pw" type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} disabled={pwSaving} placeholder="••••••••" />
                                </div>
                                <div className="perfil-field">
                                    <label htmlFor="perfil-new-pw">Nova senha</label>
                                    <input id="perfil-new-pw" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} disabled={pwSaving} placeholder="Minimo 8 caracteres" />
                                </div>
                                <div className="perfil-field">
                                    <label htmlFor="perfil-confirm-pw">Confirmar nova senha</label>
                                    <input id="perfil-confirm-pw" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} disabled={pwSaving} placeholder="Repita a nova senha" />
                                </div>
                                <button type="submit" className="perfil-btn perfil-btn--primary" disabled={pwSaving} style={{ marginTop: 4 }}>
                                    {pwSaving ? 'Redefinindo...' : 'Redefinir senha'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Card: Info da conta */}
                <div className="perfil-card">
                    <div className="perfil-card__header">
                        <span className="perfil-card__icon">ℹ️</span>
                        <span className="perfil-card__title">Informações da conta</span>
                    </div>
                    <div className="perfil-card__body">
                        <div className="perfil-info-row">
                            <span className="perfil-info-row__label">Perfil de acesso</span>
                            <span className="perfil-info-row__value">{displayRole}</span>
                        </div>
                        <div className="perfil-info-row">
                            <span className="perfil-info-row__label">Franquia</span>
                            <span className="perfil-info-row__value">{displayTenant}</span>
                        </div>
                        <div className="perfil-info-row">
                            <span className="perfil-info-row__label">Conta criada em</span>
                            <span className="perfil-info-row__value">{createdAt}</span>
                        </div>
                        <div className="perfil-info-row">
                            <span className="perfil-info-row__label">Método de login</span>
                            <span className="perfil-info-row__value">{providerLabel}</span>
                        </div>
                        <div className="perfil-info-row">
                            <span className="perfil-info-row__label">Ultimo login</span>
                            <span className="perfil-info-row__value">{lastLogin}</span>
                        </div>
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
