import { useState } from 'react';
import { Pause, Play, Trash2, Plus } from 'lucide-react';
import DossierLayout from '../../dossie/layouts/DossierLayout';
import { useWatchlists } from '../hooks/useWatchlists';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
import EmptyState from '../../shared/components/EmptyState';
import { useToast } from '../../shared/hooks/useToast';

export default function WatchlistPage() {
  const { watchlists, loading, error, createWatchlistItem, pause, resume, remove } = useWatchlists();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', subjectId: '' });
  const [pendingRemove, setPendingRemove] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await createWatchlistItem(form);
      toast.success('Watchlist criada!');
      setShowForm(false);
      setForm({ name: '', subjectId: '' });
    } catch (err) {
      toast.error(err.message || 'Erro ao criar watchlist');
    }
  }

  async function handleRemoveConfirm(id) {
    try {
      await remove(id);
      toast.success('Watchlist removida.');
      setPendingRemove(null);
    } catch (err) {
      toast.error(err.message || 'Erro ao remover');
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
            <ErrorState title="Erro ao carregar watchlists" message={error.message} />
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
              <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">Monitoramento</span>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">Watchlists</h1>
              <p className="mt-1 text-[14px] text-gray-500">Monitore entidades em tempo real e receba alertas quando novos eventos forem detectados.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 active:scale-[0.97] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:opacity-90"
            >
              <Plus size={16} />
              Nova watchlist
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-[15px] font-bold text-gray-900">Nova watchlist</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-700">Nome</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Clientes VIP"
                    required
                    className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-700">CPF/CNPJ alvo</span>
                  <input
                    type="text"
                    value={form.subjectId}
                    onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                    placeholder="000.000.000-00"
                    required
                    className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"
                  />
                </label>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 active:scale-[0.97] px-4 py-2 text-[12px] font-bold text-white shadow-sm transition hover:opacity-90"
                >
                  Criar
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

          {watchlists.length === 0 ? (
            <EmptyState
              icon="search"
              title="Nenhuma watchlist"
              description="Crie a primeira watchlist para começar o monitoramento."
              actionLabel="Nova watchlist"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Nome</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Alvo</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Ãšltima execução</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {watchlists.map((wl) => (
                      <tr key={wl.id} className="transition hover:bg-gray-50/60">
                        <td className="px-4 py-3.5 text-[13px] font-semibold text-gray-900">{wl.name}</td>
                        <td className="px-4 py-3.5 text-[13px] text-gray-500">{wl.subjectId}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${wl.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            {wl.status === 'active' ? 'Ativa' : 'Pausada'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-gray-500">{wl.lastRunAt ? new Date(wl.lastRunAt).toLocaleString('pt-BR') : '—'}</td>
                        <td className="px-4 py-3.5">
                          {pendingRemove === wl.id ? (
                            <div className="flex items-center gap-2">
                              <button type="button" className="text-[12px] font-semibold text-red-600 hover:underline" onClick={() => handleRemoveConfirm(wl.id)}>Confirmar</button>
                              <button type="button" className="text-[12px] font-semibold text-gray-500 hover:underline" onClick={() => setPendingRemove(null)}>Cancelar</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              {wl.status === 'active' ? (
                                <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-600 hover:text-gray-900" onClick={() => pause(wl.id)}>
                                  <Pause size={14} /> Pausar
                                </button>
                              ) : (
                                <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 hover:text-emerald-800" onClick={() => resume(wl.id)}>
                                  <Play size={14} /> Retomar
                                </button>
                              )}
                              <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold text-red-600 hover:text-red-800" onClick={() => setPendingRemove(wl.id)}>
                                <Trash2 size={14} /> Remover
                              </button>
                            </div>
                          )}
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
