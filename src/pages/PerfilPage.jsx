import { useCallback, useState } from 'react';
import { useAuth } from '../core/auth/useAuth';
import { callUpdateOwnProfile } from '../core/firebase/firestoreService';
import { formatRoleLabel } from '../core/rbac/permissions';
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

    const displayName = userProfile?.displayName || 'Usuario';
    const displayEmail = userProfile?.email || user?.email || '';
    const displayRole = formatRoleLabel(userProfile?.role);
    const displayTenant = userProfile?.tenantName || '—';
    const initials = (displayName[0] || 'U').toUpperCase();

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
        if (isDemoMode) {
            setNameMsg({ type: 'success', text: '(Demo) Nome atualizado.' });
            setEditingName(false);
            return;
        }
        try {
            setNameSaving(true);
            setNameMsg(null);
            await callUpdateOwnProfile({ displayName: trimmed });
            await refreshProfile();
            setNameMsg({ type: 'success', text: 'Nome atualizado com sucesso.' });
            setEditingName(false);
        } catch (err) {
            setNameMsg({ type: 'error', text: getUserFriendlyMessage(err, 'atualizar nome') });
        } finally {
            setNameSaving(false);
        }
    }, [newName, isDemoMode, refreshProfile]);

    /* ── Password reset ── */
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMsg, setPwMsg] = useState(null);

    const handleResetPassword = useCallback(async () => {
        if (!currentPw || !newPw || !confirmPw) {
            setPwMsg({ type: 'error', text: 'Preencha todos os campos.' });
            return;
        }
        if (newPw.length < 8) {
            setPwMsg({ type: 'error', text: 'Nova senha precisa ter ao menos 8 caracteres.' });
            return;
        }
        if (newPw !== confirmPw) {
            setPwMsg({ type: 'error', text: 'As senhas nao coincidem.' });
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

    return (
        <div className="perfil-page">
            {/* Hero */}
            <div className="perfil-hero">
                <div className="perfil-hero__avatar">{initials}</div>
                <div className="perfil-hero__info">
                    <h2 className="perfil-hero__name">{displayName}</h2>
                    <p className="perfil-hero__email">{displayEmail}</p>
                    <div className="perfil-hero__badges">
                        <span className="perfil-badge perfil-badge--role">{displayRole}</span>
                        <span className="perfil-badge perfil-badge--tenant">{displayTenant}</span>
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
                            <>
                                <div className="perfil-field">
                                    <label>Nome completo</label>
                                    <input
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        disabled={nameSaving}
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    <button className="perfil-btn perfil-btn--primary" onClick={handleSaveName} disabled={nameSaving}>
                                        {nameSaving ? 'Salvando...' : 'Salvar'}
                                    </button>
                                    <button className="perfil-btn perfil-btn--secondary" onClick={() => setEditingName(false)} disabled={nameSaving}>
                                        Cancelar
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="perfil-field">
                                    <label>Nome completo</label>
                                    <input readOnly value={displayName} />
                                </div>
                                <div className="perfil-field">
                                    <label>Email</label>
                                    <input readOnly value={displayEmail} />
                                </div>
                                <button className="perfil-btn perfil-btn--secondary" onClick={handleEditName} style={{ marginTop: 4 }}>
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
                        <span className="perfil-card__title">Seguranca</span>
                    </div>
                    <div className="perfil-card__body">
                        {pwMsg && <div className={`perfil-alert perfil-alert--${pwMsg.type}`}>{pwMsg.text}</div>}

                        <div className="perfil-field">
                            <label>Senha atual</label>
                            <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} disabled={pwSaving} placeholder="••••••••" />
                        </div>
                        <div className="perfil-field">
                            <label>Nova senha</label>
                            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} disabled={pwSaving} placeholder="Minimo 8 caracteres" />
                        </div>
                        <div className="perfil-field">
                            <label>Confirmar nova senha</label>
                            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} disabled={pwSaving} placeholder="Repita a nova senha" />
                        </div>
                        <button className="perfil-btn perfil-btn--primary" onClick={handleResetPassword} disabled={pwSaving} style={{ marginTop: 4 }}>
                            {pwSaving ? 'Redefinindo...' : 'Redefinir senha'}
                        </button>
                    </div>
                </div>

                {/* Card: Info da conta */}
                <div className="perfil-card">
                    <div className="perfil-card__header">
                        <span className="perfil-card__icon">ℹ️</span>
                        <span className="perfil-card__title">Informacoes da conta</span>
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
                            <span className="perfil-info-row__label">Ultimo acesso</span>
                            <span className="perfil-info-row__value">{lastLogin}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
