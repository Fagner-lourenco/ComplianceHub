import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../core/auth/useAuth';
import { callListTenantUsers, callCreateTenantUser, callUpdateTenantUser } from '../../core/firebase/firestoreService';
import { extractErrorMessage, getUserFriendlyMessage } from '../../core/errorUtils';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import './EquipePage.css';

const ROLE_LABELS = { client_viewer: 'Visualizador', client_operator: 'Operador', client_manager: 'Gestor' };
const MANAGEABLE_ROLES = ['client_viewer', 'client_operator', 'client_manager'];

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
  const [formError, setFormError] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  // Inline update state
  const [updatingUid, setUpdatingUid] = useState(null);

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
    setFormError(null);
    setModalOpen(true);
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
      setSuccessMsg(`(Demo) Usuario criado.\nEmail: ${form.email}\nSenha provisoria: ${tempPassword}`);
      return;
    }
    try {
      setFormSaving(true);
      setFormError(null);
      await Promise.race([
        callCreateTenantUser({ email: form.email.trim(), password: tempPassword, displayName: form.displayName.trim(), role: form.role }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: Firebase nao respondeu em 15 segundos.')), 15000)),
      ]);
      setModalOpen(false);
      setSuccessMsg(`Usuario criado com sucesso.\nEmail: ${form.email}\nSenha provisoria: ${tempPassword}`);
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
      await callUpdateTenantUser({ targetUid, ...payload });
      await fetchUsers();
    } catch (err) {
      setError(getUserFriendlyMessage(err, 'atualizar usuario'));
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleRoleChange = (uid, newRole) => handleUpdate(uid, { role: newRole });
  const handleToggleStatus = (uid, currentStatus) => handleUpdate(uid, { status: currentStatus === 'active' ? 'inactive' : 'active' });

  const isSelf = (uid) => uid === user?.uid || (isDemoMode && uid === 'demo-1');

  const activeCount = users.filter((u) => u.status !== 'inactive').length;
  const inactiveCount = users.length - activeCount;
  const getInitials = (name) => (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  /* ---- Render ---- */
  if (loading) {
    return (
      <div className="equipe-page">
        <div className="equipe-hero">
          <div className="equipe-hero__info">
            <h2>Equipe</h2>
            <p className="equipe-hero__sub">Gerencie os usuarios da sua franquia</p>
          </div>
        </div>
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
      </div>
    );
  }

  return (
    <div className="equipe-page">
      {/* Hero */}
      <div className="equipe-hero">
        <div className="equipe-hero__info">
          <h2>Equipe</h2>
          <p className="equipe-hero__sub">Gerencie os usuarios da sua franquia</p>
        </div>
        <div className="equipe-hero__actions">
          <button className="equipe-btn equipe-btn--primary" onClick={handleOpenModal}>+ Adicionar usuario</button>
        </div>
      </div>

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
          <span className="equipe-card__count">{users.length} {users.length === 1 ? 'usuario' : 'usuarios'}</span>
        </div>

        {users.length === 0 ? (
          <div className="equipe-empty">
            <div className="equipe-empty__icon">👥</div>
            <div className="equipe-empty__title">Nenhum usuario cadastrado</div>
            <div className="equipe-empty__desc">Adicione membros da sua equipe para que eles possam acessar o portal do cliente.</div>
            <button className="equipe-btn equipe-btn--primary" onClick={handleOpenModal}>+ Adicionar primeiro usuario</button>
          </div>
        ) : (
          <MobileDataCardList
            items={users}
            emptyMessage="Nenhum usuario encontrado."
            renderCard={(u) => {
              const isActive = u.status !== 'inactive';
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
                      {self && <span className="equipe-badge equipe-badge--you">voce</span>}
                    </div>
                    <span className={`equipe-badge ${isActive ? 'equipe-badge--active' : 'equipe-badge--inactive'}`}>
                      {isActive ? 'Ativo' : 'Inativo'}
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
                      style={{ minHeight: 44 }}
                    >
                      {MANAGEABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                      ))}
                    </select>
                    {!self && (
                      <button
                        className={`equipe-btn equipe-btn--sm ${isActive ? 'equipe-btn--danger-ghost' : 'equipe-btn--success-ghost'}`}
                        disabled={busy}
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
                    <th>Usuario</th>
                    <th>Perfil</th>
                    <th>Status</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isActive = u.status !== 'inactive';
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
                                {self && <span className="equipe-badge equipe-badge--you">voce</span>}
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
                          >
                            {MANAGEABLE_ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span className={`equipe-badge ${isActive ? 'equipe-badge--active' : 'equipe-badge--inactive'}`}>
                            {isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td>
                          <div className="equipe-row-actions">
                            {!self && (
                              <button
                                className={`equipe-btn equipe-btn--sm ${isActive ? 'equipe-btn--danger-ghost' : 'equipe-btn--success-ghost'}`}
                                disabled={busy}
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
          onClick={() => !formSaving && setModalOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && !formSaving && setModalOpen(false)}
        >
          <div className="equipe-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="equipe-modal__header">
              <h3>Adicionar usuario</h3>
              <button className="equipe-modal__close" onClick={() => !formSaving && setModalOpen(false)}>×</button>
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
              <div className="equipe-field">
                <label>Senha provisoria</label>
                <div className="equipe-password-row">
                  <input readOnly value={tempPassword} />
                  <button className="equipe-btn equipe-btn--secondary equipe-btn--sm" type="button" onClick={() => setTempPassword(generatePassword())} disabled={formSaving}>Gerar</button>
                </div>
              </div>
            </div>

            <div className="equipe-modal__footer">
              <button className="equipe-btn equipe-btn--secondary" onClick={() => setModalOpen(false)} disabled={formSaving}>Cancelar</button>
              <button className="equipe-btn equipe-btn--primary" onClick={handleCreate} disabled={formSaving}>{formSaving ? 'Criando...' : 'Criar usuario'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
