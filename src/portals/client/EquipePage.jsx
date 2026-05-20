import { useCallback, useEffect, useState } from 'react';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import { useAuth } from '../../core/auth/useAuth';
import { callListTenantUsers, callCreateTenantUser, callUpdateTenantUser } from '../../core/firebase/firestoreService';
import { extractErrorMessage, getUserFriendlyMessage } from '../../core/errorUtils';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import Modal from '../../ui/components/Modal/Modal';
import './EquipePage.css';

const ROLE_LABELS = { client_viewer: 'Visualizador', client_operator: 'Operador', client_manager: 'Gestor' };
const MANAGEABLE_ROLES = ['client_viewer', 'client_operator', 'client_manager'];
const ROLE_DESCRIPTIONS = {
  client_viewer: 'Consulta solicitações, relatórios e exportações autorizadas, sem criar casos ou alterar usuários.',
  client_operator: 'Cria solicitações e acompanha análises da empresa, sem permissões de gestão de equipe.',
  client_manager: 'Gerencia solicitações, usuários, configurações, histórico da empresa e permissões da equipe.',
};
const STATUS_CONFIG = {
  active: { label: 'Ativo', className: 'equipe-badge--active', countsAsActive: true },
  inactive: { label: 'Inativo', className: 'equipe-badge--inactive', countsAsActive: false },
  pending: { label: 'Pendente', className: 'equipe-badge--pending', countsAsActive: false },
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

export default function EquipePage() {
  const { user, userProfile } = useAuth();
  const isDemoMode = !user || userProfile?.source === 'demo';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ displayName: '', email: '', role: 'client_viewer' });
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
        { uid: 'demo-1', displayName: 'Maria Silva', email: 'maria@empresa.com', role: 'client_manager', status: 'active', createdAt: '2025-03-01T12:00:00Z' },
        { uid: 'demo-2', displayName: 'Pedro Santos', email: 'pedro@empresa.com', role: 'client_operator', status: 'active', createdAt: '2025-03-10T09:00:00Z' },
        { uid: 'demo-3', displayName: 'Ana Costa', email: 'ana@empresa.com', role: 'client_viewer', status: 'active', createdAt: '2025-03-12T11:00:00Z' },
        { uid: 'demo-4', displayName: 'Carlos Mendes', email: 'carlos@empresa.com', role: 'client_viewer', status: 'inactive', createdAt: '2025-03-15T14:00:00Z' },
      ]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await callListTenantUsers();
      setUsers(res?.users ?? []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Nao foi possivel carregar a equipe.'));
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Clear success message after 12s
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 12000);
    return () => clearTimeout(t);
  }, [successMsg]);

  /* ---- Create user ---- */
  const handleOpenModal = () => {
    setForm({ displayName: '', email: '', role: 'client_viewer' });
    setTempPassword(generatePassword());
    setPasswordVisible(false);
    setPasswordCopied(false);
    setFormError(null);
    setModalOpen(true);
  };

  const createFormDirty = Boolean(form.displayName.trim() || form.email.trim() || form.role !== 'client_viewer');

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
      setFormError('Email inválido.');
      return;
    }
    if (isDemoMode) {
      setModalOpen(false);
      setTempPassword('');
      setSuccessMsg(`(Demo) Usuário criado.\nEmail: ${form.email}\nCompartilhe a senha provisória somente por canal seguro.`);
      return;
    }
    try {
      setFormSaving(true);
      setFormError(null);
      await Promise.race([
        callCreateTenantUser({ email: form.email.trim(), password: tempPassword, displayName: form.displayName.trim(), role: form.role }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: Firebase não respondeu em 15 segundos.')), 15000)),
      ]);
      setModalOpen(false);
      setTempPassword('');
      setSuccessMsg(`Usuário criado com sucesso.\nEmail: ${form.email}\nCompartilhe a senha provisória somente por canal seguro.`);
      fetchUsers();
    } catch (err) {
      setFormError(getUserFriendlyMessage(err, 'criar usuário'));
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
      await callUpdateTenantUser({ targetUid, ...payload });
      await fetchUsers();
    } catch (err) {
      setError(getUserFriendlyMessage(err, 'atualizar usuário'));
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
          eyebrow="Usuários"
          title="Equipe da empresa"
          description="Gerencie quem pode acessar o portal da sua empresa."
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
        eyebrow="Usuários"
        title="Equipe da empresa"
        description="Gerencie quem pode acessar o portal da sua empresa."
        actions={
          <button className="btn-primary" onClick={handleOpenModal}>Adicionar usuário</button>
        }
      />

      {/* Stats */}
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
            <div className="equipe-stat-card__label">Atenção</div>
          </div>
        )}
      </div>

      {/* Alerts */}
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

      {/* Table card */}
      <div className="equipe-card">
        <div className="equipe-card__header">
          <span className="equipe-card__title">Membros da equipe</span>
          <span className="equipe-card__count">{users.length} {users.length === 1 ? 'usuário' : 'usuários'}</span>
        </div>

        {users.length === 0 ? (
          <div className="equipe-empty">
            <div className="equipe-empty__icon">👥</div>
            <div className="equipe-empty__title">Nenhum usuário cadastrado</div>
            <div className="equipe-empty__desc">Adicione membros da sua equipe para que eles possam acessar o portal do cliente.</div>
            <button className="equipe-btn equipe-btn--primary" onClick={handleOpenModal}>Adicionar primeiro usuário</button>
          </div>
        ) : (
          <MobileDataCardList
            items={users}
            emptyMessage="Nenhum usuário encontrado."
            renderCard={(u) => {
              const statusInfo = getStatusConfig(u.status);
              const isActive = statusInfo.countsAsActive;
              const busy = updatingUid === u.uid;
              const self = isSelf(u.uid);
              return (
                <>
                  <div className="mobile-card__header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className={`equipe-avatar ${isActive ? 'equipe-avatar--active' : 'equipe-avatar--inactive'}`} style={{ width: 32, height: 32, fontSize: '.75rem' }}>
                        {getInitials(u.displayName)}
                      </div>
                      <span style={{ fontWeight: 700 }}>{u.displayName || '—'}</span>
                      {self && <span className="equipe-badge equipe-badge--you">você</span>}
                    </div>
                    <span className={`equipe-badge ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="mobile-card__meta">
                    <span className="mobile-card__meta-item">{u.email}</span>
                  </div>
                  <div className="mobile-card__actions">
                    <select
                      className="equipe-role-select"
                      value={u.role}
                      disabled={busy || self}
                      onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                      title={ROLE_DESCRIPTIONS[u.role] || 'Perfil sem descrição cadastrada.'}
                      style={{ minHeight: 44 }}
                    >
                      {MANAGEABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                      ))}
                    </select>
                    {!self && (
                      <button
                        className={`equipe-btn equipe-btn--sm ${isActive ? 'equipe-btn--danger-ghost' : 'equipe-btn--success-ghost'}`}
                        disabled={busy || !['active', 'inactive'].includes(u.status)}
                        onClick={() => handleToggleStatus(u.uid, u.status)}
                        style={{ minHeight: 44 }}
                      >
                        {busy ? '...' : isActive ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                  </div>
                </>
              );
            }}
          >
            <div className="equipe-table-wrap">
              <table className="equipe-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Perfil</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const statusInfo = getStatusConfig(u.status);
                    const isActive = statusInfo.countsAsActive;
                    const busy = updatingUid === u.uid;
                    const self = isSelf(u.uid);
                    return (
                      <tr key={u.uid}>
                        <td>
                          <div className="equipe-user-cell">
                            <div className={`equipe-avatar ${isActive ? 'equipe-avatar--active' : 'equipe-avatar--inactive'}`}>
                              {getInitials(u.displayName)}
                            </div>
                            <div className="equipe-user-info">
                              <div className="equipe-user-name">
                                {u.displayName || '—'}
                                {self && <span className="equipe-badge equipe-badge--you">você</span>}
                              </div>
                              <div className="equipe-user-email">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <select
                            className="equipe-role-select"
                            value={u.role}
                            disabled={busy || self}
                            onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                            title={ROLE_DESCRIPTIONS[u.role] || 'Perfil sem descrição cadastrada.'}
                          >
                            {MANAGEABLE_ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span className={`equipe-badge ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td>
                          <div className="equipe-row-actions">
                            {!self && (
                              <button
                                className={`equipe-btn equipe-btn--sm ${isActive ? 'equipe-btn--danger-ghost' : 'equipe-btn--success-ghost'}`}
                                disabled={busy || !['active', 'inactive'].includes(u.status)}
                                onClick={() => handleToggleStatus(u.uid, u.status)}
                              >
                                {busy ? '...' : isActive ? 'Desativar' : 'Ativar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </MobileDataCardList>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="equipe-modal-overlay"
          role="presentation"
          onClick={requestCloseModal}
          onKeyDown={(e) => e.key === 'Escape' && requestCloseModal()}
        >
          <div className="equipe-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="equipe-modal__header">
              <h3>Adicionar usuário</h3>
              <button className="equipe-modal__close" onClick={requestCloseModal}>X</button>
            </div>

            <div className="equipe-modal__body">
              {formError && <div className="equipe-alert equipe-alert--error" style={{ marginBottom: 16 }}><span>⚠</span> {formError}</div>}

              <div className="equipe-field">
                <label>Nome completo *</label>
                <input
                  placeholder="Ex: Maria da Silva"
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  disabled={formSaving}
                  autoFocus
                />
              </div>
              <div className="equipe-field">
                <label>Email *</label>
                <input
                  type="email"
                  placeholder="email@empresa.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={formSaving}
                />
              </div>
              <div className="equipe-field">
                <label>Perfil de acesso</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} disabled={formSaving}>
                  {MANAGEABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                  ))}
                </select>
              </div>
              <div className="equipe-role-matrix" aria-label="Resumo de permissões por perfil">
                {MANAGEABLE_ROLES.map((role) => (
                  <div key={role} className={`equipe-role-matrix__item ${form.role === role ? 'equipe-role-matrix__item--active' : ''}`}>
                    <strong>{ROLE_LABELS[role]}</strong>
                    <span>{ROLE_DESCRIPTIONS[role]}</span>
                  </div>
                ))}
              </div>
              <div className="equipe-field">
                <label>Senha provisória</label>
                <div className="equipe-password-row">
                  <input readOnly value={passwordVisible ? tempPassword : '••••••••••••'} aria-label="Senha provisória" />
                  <button className="equipe-btn equipe-btn--secondary equipe-btn--sm" type="button" onClick={() => setPasswordVisible((current) => !current)} disabled={formSaving}>{passwordVisible ? 'Ocultar' : 'Ver'}</button>
                  <button className="equipe-btn equipe-btn--secondary equipe-btn--sm" type="button" onClick={copyTempPassword} disabled={formSaving}>{passwordCopied ? 'Copiada' : 'Copiar'}</button>
                  <button className="equipe-btn equipe-btn--secondary equipe-btn--sm" type="button" onClick={() => setTempPassword(generatePassword())} disabled={formSaving}>Gerar</button>
                </div>
                <p className="equipe-field__hint">Copie e compartilhe por canal seguro. A senha não será exibida em alertas e será apagada ao fechar este modal.</p>
              </div>
            </div>

            <div className="equipe-modal__footer">
              <button className="equipe-btn equipe-btn--secondary" onClick={requestCloseModal} disabled={formSaving}>Cancelar</button>
              <button className="equipe-btn equipe-btn--primary" onClick={handleCreate} disabled={formSaving}>{formSaving ? 'Criando...' : 'Criar usuário'}</button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(roleChange)}
        onClose={() => setRoleChange(null)}
        title="Alterar perfil de acesso?"
        footer={(
          <>
            <button type="button" className="equipe-btn equipe-btn--secondary" onClick={() => setRoleChange(null)}>Cancelar</button>
            <button type="button" className="equipe-btn equipe-btn--primary" onClick={confirmRoleChange}>Confirmar alteração</button>
          </>
        )}
      >
        {roleChange && (
          <div className="equipe-critical-modal">
            <p>Esta alteração modifica permissões efetivas no portal do cliente e será registrada na auditoria.</p>
            <dl>
              <div><dt>Usuário</dt><dd>{roleChange.user.displayName || roleChange.user.email}</dd></div>
              <div><dt>E-mail</dt><dd>{roleChange.user.email}</dd></div>
              <div><dt>De</dt><dd>{ROLE_LABELS[roleChange.user.role] || roleChange.user.role}</dd></div>
              <div><dt>Para</dt><dd>{ROLE_LABELS[roleChange.newRole] || roleChange.newRole}</dd></div>
              <div><dt>Impacto</dt><dd>{ROLE_DESCRIPTIONS[roleChange.newRole]}</dd></div>
            </dl>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(statusChange)}
        onClose={() => setStatusChange(null)}
        title={statusChange?.nextStatus === 'inactive' ? 'Desativar usuário?' : 'Ativar usuário?'}
        footer={(
          <>
            <button type="button" className="equipe-btn equipe-btn--secondary" onClick={() => setStatusChange(null)}>Cancelar</button>
            <button type="button" className={`equipe-btn ${statusChange?.nextStatus === 'inactive' ? 'equipe-btn--danger' : 'equipe-btn--primary'}`} onClick={confirmStatusChange}>
              {statusChange?.nextStatus === 'inactive' ? 'Desativar usuário' : 'Ativar usuário'}
            </button>
          </>
        )}
      >
        {statusChange && (
          <div className="equipe-critical-modal">
            <p>
              {statusChange.nextStatus === 'inactive'
                ? 'O acesso deste usuário será bloqueado no sistema.'
                : 'O acesso deste usuário será reativado no sistema.'}
            </p>
            <dl>
              <div><dt>Usuário</dt><dd>{statusChange.user.displayName || statusChange.user.email}</dd></div>
              <div><dt>E-mail</dt><dd>{statusChange.user.email}</dd></div>
              <div><dt>Status atual</dt><dd>{getStatusConfig(statusChange.user.status).label}</dd></div>
              <div><dt>Novo status</dt><dd>{getStatusConfig(statusChange.nextStatus).label}</dd></div>
            </dl>
            <p>Esta ação será registrada no histórico da empresa.</p>
          </div>
        )}
      </Modal>

      <Modal
        open={dirtyCloseOpen}
        onClose={() => setDirtyCloseOpen(false)}
        title="Descartar usuário em criação?"
        footer={(
          <>
            <button type="button" className="equipe-btn equipe-btn--secondary" onClick={() => setDirtyCloseOpen(false)}>Continuar editando</button>
            <button type="button" className="equipe-btn equipe-btn--danger" onClick={confirmCloseModal}>Descartar dados</button>
          </>
        )}
      >
        <div className="equipe-critical-modal">
          <p>Há dados preenchidos no formulário de novo usuário. Ao fechar, nome, e-mail, perfil e senha provisória serão descartados.</p>
        </div>
      </Modal>
    </PageShell>
  );
}
