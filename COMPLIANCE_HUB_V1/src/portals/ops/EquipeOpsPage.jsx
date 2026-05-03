import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import {
    callListOpsUsers,
    callCreateOpsUser,
    callUpdateOpsUser,
} from '../../core/firebase/firestoreService';
import { extractErrorMessage, getUserFriendlyMessage } from '../../core/errorUtils';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import Modal from '../../ui/components/Modal/Modal';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import '../client/EquipePage.css';

const ROLE_LABELS = { analyst: 'Analista', supervisor: 'Supervisor', admin: 'Administrador' };
const MANAGEABLE_ROLES = ['analyst', 'supervisor', 'admin'];
const ROLE_DESCRIPTIONS = {
    analyst: 'Analisa casos, salva rascunhos e conclui verificacoes.',
    supervisor: 'Gerencia analistas, atribui casos e acompanha metricas.',
    admin: 'Acesso total: gestao de tenants, equipe, configuracoes e auditoria.',
};
const STATUS_CONFIG = {
    active: { label: 'Ativo', className: 'equipe-badge--active', countsAsActive: true },
    inactive: { label: 'Inativo', className: 'equipe-badge--inactive', countsAsActive: false },
    suspended: { label: 'Suspenso', className: 'equipe-badge--suspended', countsAsActive: false },
    unknown: { label: 'Status desconhecido', className: 'equipe-badge--unknown', countsAsActive: false },
};

function getStatusConfig(status) {
    return STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
}

function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const array = new Uint32Array(12);
    crypto.getRandomValues(array);
    return Array.from(array, (v) => chars.charAt(v % chars.length)).join('');
}

export default function EquipeOpsPage() {
    const { user, userProfile } = useAuth();
    const { selectedTenantId, tenants } = useTenant();
    const isDemoMode = !user || userProfile?.source === 'demo';
    const isGlobalAdmin = userProfile?.role === 'admin' && !userProfile?.tenantId;
    const isOwner = userProfile?.role === 'owner';
    const canSelectTenant = (isGlobalAdmin || isOwner) && selectedTenantId === ALL_TENANTS_ID;

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Tenant filter for the list (separate from modal form)
    const [listTenantId, setListTenantId] = useState(
        selectedTenantId !== ALL_TENANTS_ID ? selectedTenantId : (tenants.find((t) => t.id !== ALL_TENANTS_ID)?.id || ''),
    );

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ displayName: '', email: '', role: 'analyst', tenantId: '' });
    const [tempPassword, setTempPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [passwordCopied, setPasswordCopied] = useState(false);
    const [formError, setFormError] = useState(null);
    const [formSaving, setFormSaving] = useState(false);
    const [dirtyCloseOpen, setDirtyCloseOpen] = useState(false);

    // Inline update state
    const [updatingUid, setUpdatingUid] = useState(null);
    const [roleChange, setRoleChange] = useState(null);
    const [statusChange, setStatusChange] = useState(null);

    const fetchUsers = useCallback(async () => {
        if (isDemoMode) {
            setUsers([
                { uid: 'demo-1', displayName: 'Joao Analyst', email: 'joao@compliancehub.com', role: 'analyst', tenantId: 'demo-tenant', tenantName: 'Demo Corp', status: 'active', createdAt: '2025-03-01T12:00:00Z' },
                { uid: 'demo-2', displayName: 'Maria Supervisor', email: 'maria@compliancehub.com', role: 'supervisor', tenantId: 'demo-tenant', tenantName: 'Demo Corp', status: 'active', createdAt: '2025-03-10T09:00:00Z' },
                { uid: 'demo-3', displayName: 'Carlos Admin', email: 'carlos@compliancehub.com', role: 'admin', tenantId: 'demo-tenant', tenantName: 'Demo Corp', status: 'active', createdAt: '2025-03-12T11:00:00Z' },
                { uid: 'demo-4', displayName: 'Ana Inativa', email: 'ana@compliancehub.com', role: 'analyst', tenantId: 'demo-tenant', tenantName: 'Demo Corp', status: 'inactive', createdAt: '2025-03-15T14:00:00Z' },
            ]);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const payload = {};
            if (canSelectTenant && listTenantId) payload.tenantId = listTenantId;
            const res = await callListOpsUsers(payload);
            setUsers(res?.users ?? []);
        } catch (err) {
            setError(extractErrorMessage(err, 'Nao foi possivel carregar a equipe operacional.'));
        } finally {
            setLoading(false);
        }
    }, [isDemoMode, canSelectTenant, listTenantId]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    useEffect(() => {
        if (!successMsg) return;
        const t = setTimeout(() => setSuccessMsg(null), 12000);
        return () => clearTimeout(t);
    }, [successMsg]);

    /* ---- Create user ---- */
    const handleOpenModal = () => {
        const defaultTenantId = selectedTenantId !== ALL_TENANTS_ID
            ? selectedTenantId
            : (tenants.find((t) => t.id !== ALL_TENANTS_ID)?.id || '');
        setForm({ displayName: '', email: '', role: 'analyst', tenantId: defaultTenantId });
        setTempPassword(generatePassword());
        setPasswordVisible(false);
        setPasswordCopied(false);
        setFormError(null);
        setModalOpen(true);
    };

    const createFormDirty = Boolean(form.displayName.trim() || form.email.trim() || form.role !== 'analyst');

    const requestCloseModal = () => {
        if (formSaving) return;
        if (createFormDirty) {
            setDirtyCloseOpen(true);
            return;
        }
        setModalOpen(false);
        setTempPassword('');
    };

    const confirmCloseModal = () => {
        setDirtyCloseOpen(false);
        setModalOpen(false);
        setTempPassword('');
        setPasswordVisible(false);
        setPasswordCopied(false);
        setFormError(null);
    };

    const copyTempPassword = async () => {
        try {
            await navigator.clipboard?.writeText(tempPassword);
            setPasswordCopied(true);
            window.setTimeout(() => setPasswordCopied(false), 1800);
        } catch {
            setPasswordCopied(false);
        }
    };

    const handleCreate = async () => {
        if (!form.displayName.trim() || !form.email.trim()) {
            setFormError('Preencha nome e email.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            setFormError('Email invalido.');
            return;
        }
        if (canSelectTenant && !form.tenantId) {
            setFormError('Selecione uma empresa.');
            return;
        }
        if (isDemoMode) {
            setModalOpen(false);
            setTempPassword('');
            setSuccessMsg(`(Demo) Usuario criado.\nEmail: ${form.email}\nCompartilhe a senha provisoria somente por canal seguro.`);
            return;
        }
        try {
            setFormSaving(true);
            setFormError(null);
            const payload = {
                email: form.email.trim(),
                password: tempPassword,
                displayName: form.displayName.trim(),
                role: form.role,
            };
            if (canSelectTenant && form.tenantId) payload.tenantId = form.tenantId;
            await Promise.race([
                callCreateOpsUser(payload),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: Firebase nao respondeu em 15 segundos.')), 15000)),
            ]);
            setModalOpen(false);
            setTempPassword('');
            setSuccessMsg(`Usuario criado com sucesso.\nEmail: ${form.email}\nCompartilhe a senha provisoria somente por canal seguro.`);
            fetchUsers();
        } catch (err) {
            setFormError(getUserFriendlyMessage(err, 'criar usuario'));
        } finally {
            setFormSaving(false);
        }
    };

    /* ---- Update role / status ---- */
    const handleUpdate = async (targetUid, payload) => {
        if (isDemoMode) {
            setUsers((prev) => prev.map((u) => (u.uid === targetUid ? { ...u, ...payload } : u)));
            return;
        }
        try {
            setUpdatingUid(targetUid);
            setError(null);
            await callUpdateOpsUser({ targetUid, ...payload });
            await fetchUsers();
        } catch (err) {
            setError(getUserFriendlyMessage(err, 'atualizar usuario'));
        } finally {
            setUpdatingUid(null);
        }
    };

    const findUser = (uid) => users.find((candidate) => candidate.uid === uid);
    const handleRoleChange = (uid, newRole) => {
        const target = findUser(uid);
        if (!target || target.role === newRole) return;
        setRoleChange({ user: target, newRole });
    };
    const handleToggleStatus = (uid, currentStatus) => {
        const target = findUser(uid);
        if (!target) return;
        const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
        setStatusChange({ user: target, nextStatus });
    };

    const confirmRoleChange = async () => {
        if (!roleChange) return;
        const { user: target, newRole } = roleChange;
        setRoleChange(null);
        await handleUpdate(target.uid, { role: newRole });
    };

    const confirmStatusChange = async () => {
        if (!statusChange) return;
        const { user: target, nextStatus } = statusChange;
        setStatusChange(null);
        await handleUpdate(target.uid, { status: nextStatus });
    };

    const isSelf = (uid) => uid === user?.uid || (isDemoMode && uid === 'demo-1');

    const activeCount = users.filter((u) => getStatusConfig(u.status).countsAsActive).length;
    const inactiveCount = users.filter((u) => u.status === 'inactive').length;
    const attentionCount = users.length - activeCount - inactiveCount;
    const getInitials = (name) => (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

    /* ---- Render ---- */
    if (loading) {
        return (
            <PageShell size="default" className="equipe-page">
                <PageHeader
                    eyebrow="Equipe operacional"
                    title="Usuários internos"
                    description="Gerencie analistas, supervisores e administradores da operação."
                />
                <div className="equipe-card">
                    <div className="equipe-card__header">
                        <span className="equipe-card__title">Membros</span>
                    </div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="equipe-skeleton-row">
                            <span className="equipe-skeleton-pill" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                            <span className="equipe-skeleton-pill" style={{ width: '30%' }} />
                            <span className="equipe-skeleton-pill" style={{ width: '20%' }} />
                            <span className="equipe-skeleton-pill" style={{ width: 60 }} />
                        </div>
                    ))}
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell size="default" className="equipe-page">
            <PageHeader
                eyebrow="Equipe operacional"
                title="Usuários internos"
                description="Gerencie analistas, supervisores e administradores da operação."
                actions={
                    <button className="equipe-btn equipe-btn--primary" onClick={handleOpenModal}>Adicionar usuario</button>
                }
            />

            <div className="equipe-stats">
                <div className="equipe-stat-card">
                    <div className="equipe-stat-card__value">{users.length}</div>
                    <div className="equipe-stat-card__label">Total de membros</div>
                </div>
                <div className="equipe-stat-card">
                    <div className="equipe-stat-card__value" style={{ color: 'var(--green-600)' }}>{activeCount}</div>
                    <div className="equipe-stat-card__label">Ativos</div>
                </div>
                <div className="equipe-stat-card">
                    <div className="equipe-stat-card__value" style={{ color: inactiveCount > 0 ? 'var(--red-600)' : undefined }}>{inactiveCount}</div>
                    <div className="equipe-stat-card__label">Inativos</div>
                </div>
                {attentionCount > 0 && (
                    <div className="equipe-stat-card">
                        <div className="equipe-stat-card__value" style={{ color: 'var(--yellow-700)' }}>{attentionCount}</div>
                        <div className="equipe-stat-card__label">Atencao</div>
                    </div>
                )}
            </div>

            {error && (
                <div className="equipe-alert equipe-alert--error">
                    <span>⚠</span> {error}
                    <button className="equipe-alert__close" onClick={() => setError(null)}>×</button>
                </div>
            )}
            {successMsg && (
                <div className="equipe-alert equipe-alert--success">
                    <span>✓</span> {successMsg}
                    <button className="equipe-alert__close" onClick={() => setSuccessMsg(null)}>×</button>
                </div>
            )}

            {canSelectTenant && (
                <div className="equipe-card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '0.875rem' }}>
                        <span>Filtrar por empresa:</span>
                        <select
                            className="equipe-select"
                            value={listTenantId}
                            onChange={(e) => setListTenantId(e.target.value)}
                        >
                            <option value="">Todas as empresas</option>
                            {tenants.filter((t) => t.id !== ALL_TENANTS_ID).map((t) => (
                                <option key={t.id} value={t.id}>{t.name || t.id}</option>
                            ))}
                        </select>
                    </label>
                </div>
            )}

            <div className="equipe-card">
                <div className="equipe-card__header">
                    <span className="equipe-card__title">Membros da equipe</span>
                    <span className="equipe-card__count">{users.length} {users.length === 1 ? 'usuario' : 'usuarios'}</span>
                </div>

                <MobileDataCardList
                    items={users}
                    loading={loading}
                    emptyMessage="Nenhum usuario operacional encontrado."
                    renderCard={(u) => (
                        <>
                            <div className="mobile-card__header">
                                <div className="equipe-avatar">{getInitials(u.displayName)}</div>
                                <div>
                                    <div className="mobile-card__title">{u.displayName || u.email}</div>
                                    <div className="mobile-card__subtitle">{u.email}</div>
                                </div>
                                <span className={`equipe-badge ${getStatusConfig(u.status).className}`}>{getStatusConfig(u.status).label}</span>
                            </div>
                            <div className="mobile-card__meta">
                                <span className="mobile-card__meta-item">{ROLE_LABELS[u.role] || u.role}</span>
                                <span className="mobile-card__meta-item">{u.tenantName || u.tenantId || '—'}</span>
                            </div>
                            <div className="mobile-card__actions">
                                <select
                                    className="equipe-select"
                                    value={u.role}
                                    disabled={updatingUid === u.uid || isSelf(u.uid)}
                                    onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                                >
                                    {MANAGEABLE_ROLES.map((r) => (
                                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                    ))}
                                </select>
                                <button
                                    className={`equipe-btn ${u.status === 'active' ? 'equipe-btn--danger' : 'equipe-btn--primary'}`}
                                    disabled={updatingUid === u.uid || isSelf(u.uid)}
                                    onClick={() => handleToggleStatus(u.uid, u.status)}
                                >
                                    {u.status === 'active' ? 'Desativar' : 'Ativar'}
                                </button>
                            </div>
                        </>
                    )}
                >
                    <div className="equipe-table-wrapper">
                        <table className="equipe-table" aria-label="Equipe operacional">
                            <thead>
                                <tr>
                                    <th scope="col">Usuario</th>
                                    <th scope="col">Papel</th>
                                    <th scope="col">Empresa</th>
                                    <th scope="col">Status</th>
                                    <th scope="col">Acoes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.uid}>
                                        <td>
                                            <div className="equipe-user-cell">
                                                <div className="equipe-avatar">{getInitials(u.displayName)}</div>
                                                <div>
                                                    <div className="equipe-user-name">{u.displayName || u.email}</div>
                                                    <div className="equipe-user-email">{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <select
                                                className="equipe-select"
                                                value={u.role}
                                                disabled={updatingUid === u.uid || isSelf(u.uid)}
                                                onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                                                aria-label={`Alterar papel de ${u.displayName || u.email}`}
                                            >
                                                {MANAGEABLE_ROLES.map((r) => (
                                                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="equipe-table__tenant">{u.tenantName || u.tenantId || '—'}</td>
                                        <td>
                                            <span className={`equipe-badge ${getStatusConfig(u.status).className}`}>
                                                {getStatusConfig(u.status).label}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className={`equipe-btn ${u.status === 'active' ? 'equipe-btn--danger' : 'equipe-btn--primary'}`}
                                                disabled={updatingUid === u.uid || isSelf(u.uid)}
                                                onClick={() => handleToggleStatus(u.uid, u.status)}
                                            >
                                                {u.status === 'active' ? 'Desativar' : 'Ativar'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                                            Nenhum usuario operacional encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </MobileDataCardList>
            </div>

            {/* Create user modal */}
            <Modal
                open={modalOpen}
                onClose={requestCloseModal}
                title="Adicionar usuario operacional"
                footer={(
                    <>
                        <button type="button" className="btn-secondary" onClick={requestCloseModal} disabled={formSaving}>Cancelar</button>
                        <button type="button" className="btn-primary" onClick={handleCreate} disabled={formSaving}>
                            {formSaving ? 'Criando...' : 'Criar usuario'}
                        </button>
                    </>
                )}
            >
                <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
                    <div className="form-group">
                        <label htmlFor="ops-display-name">Nome completo</label>
                        <input
                            id="ops-display-name"
                            className="form-input"
                            type="text"
                            value={form.displayName}
                            onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                            placeholder="Nome do usuario"
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ops-email">Email</label>
                        <input
                            id="ops-email"
                            className="form-input"
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                            placeholder="email@empresa.com"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="ops-role">Papel</label>
                        <select
                            id="ops-role"
                            className="form-input"
                            value={form.role}
                            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                        >
                            {MANAGEABLE_ROLES.map((r) => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                        </select>
                        <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: 6 }}>
                            {ROLE_DESCRIPTIONS[form.role]}
                        </small>
                    </div>
                    {canSelectTenant && (
                        <div className="form-group">
                            <label htmlFor="ops-tenant">Empresa</label>
                            <select
                                id="ops-tenant"
                                className="form-input"
                                value={form.tenantId}
                                onChange={(e) => setForm((prev) => ({ ...prev, tenantId: e.target.value }))}
                            >
                                <option value="">Selecione...</option>
                                {tenants.filter((t) => t.id !== ALL_TENANTS_ID).map((t) => (
                                    <option key={t.id} value={t.id}>{t.name || t.id}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="form-group">
                        <label htmlFor="ops-temp-password">Senha provisoria</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                id="ops-temp-password"
                                className="form-input pwd"
                                type={passwordVisible ? 'text' : 'password'}
                                value={tempPassword}
                                readOnly
                                style={{ flex: 1, fontFamily: "'Fira Code', 'Cascadia Code', monospace", letterSpacing: '.04em' }}
                            />
                            <button type="button" className="btn-secondary" onClick={() => setPasswordVisible((v) => !v)}>
                                {passwordVisible ? 'Ocultar' : 'Mostrar'}
                            </button>
                            <button type="button" className="btn-secondary" onClick={copyTempPassword}>
                                {passwordCopied ? 'Copiado!' : 'Copiar'}
                            </button>
                        </div>
                        <small style={{ color: 'var(--text-tertiary)', display: 'block', marginTop: 4 }}>
                            Compartilhe a senha provisoria somente por canal seguro.
                        </small>
                    </div>
                    {formError && (
                        <div role="alert" style={{ color: 'var(--red-600)', background: 'var(--red-50)', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
                            {formError}
                        </div>
                    )}
                </form>
            </Modal>

            {/* Dirty close confirmation */}
            <Modal
                open={dirtyCloseOpen}
                onClose={() => setDirtyCloseOpen(false)}
                title="Descartar alteracoes?"
                footer={(
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setDirtyCloseOpen(false)}>Voltar</button>
                        <button type="button" className="equipe-btn equipe-btn--danger" onClick={confirmCloseModal}>Descartar</button>
                    </>
                )}
            >
                <div className="equipe-critical-modal">
                    <p>Os dados preenchidos serao perdidos.</p>
                </div>
            </Modal>

            {/* Role change confirmation */}
            <Modal
                open={Boolean(roleChange)}
                onClose={() => setRoleChange(null)}
                title="Confirmar alteracao de papel"
                footer={roleChange ? (
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setRoleChange(null)}>Cancelar</button>
                        <button type="button" className="btn-primary" onClick={confirmRoleChange}>Confirmar</button>
                    </>
                ) : null}
            >
                {roleChange && (
                    <div className="equipe-critical-modal">
                        <p>
                            Alterar <strong>{roleChange.user.displayName || roleChange.user.email}</strong> de{' '}
                            <strong>{ROLE_LABELS[roleChange.user.role]}</strong> para{' '}
                            <strong>{ROLE_LABELS[roleChange.newRole]}</strong>?
                        </p>
                        <dl>
                            <div><dt>Papel atual</dt><dd>{ROLE_LABELS[roleChange.user.role]}</dd></div>
                            <div><dt>Novo papel</dt><dd>{ROLE_LABELS[roleChange.newRole]}</dd></div>
                            <div><dt>Descricao</dt><dd>{ROLE_DESCRIPTIONS[roleChange.newRole]}</dd></div>
                        </dl>
                    </div>
                )}
            </Modal>

            {/* Status change confirmation */}
            <Modal
                open={Boolean(statusChange)}
                onClose={() => setStatusChange(null)}
                title={statusChange?.nextStatus === 'active' ? 'Reativar usuario?' : 'Desativar usuario?'}
                footer={statusChange ? (
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setStatusChange(null)}>Cancelar</button>
                        <button
                            type="button"
                            className={statusChange.nextStatus === 'active' ? 'btn-primary' : 'equipe-btn equipe-btn--danger'}
                            onClick={confirmStatusChange}
                        >
                            Confirmar
                        </button>
                    </>
                ) : null}
            >
                {statusChange && (
                    <div className="equipe-critical-modal">
                        <p>
                            {statusChange.nextStatus === 'active'
                                ? `Reativar ${statusChange.user.displayName || statusChange.user.email}?`
                                : `Desativar ${statusChange.user.displayName || statusChange.user.email}? O usuario nao podera mais acessar o sistema.`}
                        </p>
                        <dl>
                            <div><dt>Usuario</dt><dd>{statusChange.user.displayName || statusChange.user.email}</dd></div>
                            <div><dt>Status atual</dt><dd>{getStatusConfig(statusChange.user.status).label}</dd></div>
                            <div><dt>Novo status</dt><dd>{getStatusConfig(statusChange.nextStatus).label}</dd></div>
                        </dl>
                    </div>
                )}
            </Modal>
        </PageShell>
    );
}
