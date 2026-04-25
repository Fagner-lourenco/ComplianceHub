import { useState } from 'react';
import { Plus, Mail, Shield } from 'lucide-react';
import DossierLayout from '../../dossie/layouts/DossierLayout';
import { useTenantUsers } from '../hooks/useTenantUsers';
import { ROLES, formatRoleLabel } from '../../core/rbac/permissions';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
import EmptyState from '../../shared/components/EmptyState';
import { useToast } from '../../shared/hooks/useToast';

export default function UserManagementPage() {
  const { users, loading, error, refetch, createUser, updateUser } = useTenantUsers();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: ROLES.ANALYST });

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await createUser(form);
      toast.success('Usuário convidado com sucesso!');
      setShowForm(false);
      setForm({ email: '', name: '', role: ROLES.ANALYST });
    } catch (err) {
      toast.error(err.message || 'Erro ao criar usuário');
    }
  }

  async function handleToggleStatus(user) {
    try {
      await updateUser({ uid: user.uid, status: user.status === 'active' ? 'inactive' : 'active' });
      toast.success('Status atualizado.');
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar usuário');
    }
  }

  if (loading) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-gray-50/50">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <LoadingState rows={4} columns={3} />
          </div>
        </main>
      </DossierLayout>
    );
  }

  if (error) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-gray-50/50">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <ErrorState title="Erro ao carregar usuários" message={error.message} onRetry={refetch} />
          </div>
        </main>
      </DossierLayout>
    );
  }

  return (
    <DossierLayout>
      <main className="min-h-screen bg-gray-50/50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">Usuários</span>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">Gestão de Usuários</h1>
              <p className="mt-1 text-[14px] text-gray-500">Convide membros da equipe, configure permissões e acompanhe a atividade.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 active:scale-[0.97] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:opacity-90"
            >
              <Plus size={16} />
              Convidar usuário
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-[15px] font-bold text-gray-900">Novo usuário</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-700">Nome</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nome completo"
                    required
                    className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-700">E-mail</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@empresa.com"
                    required
                    className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-700">Função</span>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"
                  >
                    {Object.values(ROLES).map((role) => (
                      <option key={role} value={role}>
                        {formatRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 active:scale-[0.97] px-4 py-2 text-[12px] font-bold text-white shadow-sm transition hover:opacity-90"
                >
                  Enviar convite
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {users.length === 0 ? (
            <EmptyState
              icon="search"
              title="Nenhum usuário encontrado"
              description="Convide o primeiro membro da equipe para começar."
              actionLabel="Convidar usuário"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Nome</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">E-mail</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Função</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map((user) => (
                      <tr key={user.uid} className="transition hover:bg-gray-50/60">
                        <td className="px-4 py-3.5 text-[13px] font-semibold text-gray-900">{user.name || '—'}</td>
                        <td className="px-4 py-3.5 text-[13px] text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Mail size={14} className="text-gray-400" aria-hidden="true" />
                            {user.email}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Shield size={14} className="text-gray-400" aria-hidden="true" />
                            {formatRoleLabel(user.role)}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            {user.status === 'active' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            className="text-[12px] font-semibold text-brand-500 hover:underline"
                            onClick={() => handleToggleStatus(user)}
                          >
                            {user.status === 'active' ? 'Desativar' : 'Ativar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </DossierLayout>
  );
}
