import { useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import DossierLayout from '../../dossie/layouts/DossierLayout';
import { useReports } from '../hooks/useReports';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
import EmptyState from '../../shared/components/EmptyState';
import { useToast } from '../../shared/hooks/useToast';

export default function ReportsPage() {
  const { reports, loading, error, refetch, revoke } = useReports();
  const { toast } = useToast();
  const [pendingRevoke, setPendingRevoke] = useState(null);

  async function handleRevokeConfirm(reportId) {
    try {
      await revoke(reportId);
      toast.success('Relatório revogado.');
      setPendingRevoke(null);
    } catch (err) {
      toast.error(err.message || 'Erro ao revogar');
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
            <ErrorState title="Erro ao carregar relatórios" message={error.message} onRetry={refetch} />
          </div>
        </main>
      </DossierLayout>
    );
  }

  return (
    <DossierLayout>
      <main className="min-h-screen bg-gray-50/50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">Relatórios</span>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Relatórios Públicos</h1>
            <p className="mt-1 text-[14px] text-gray-500">Gere e gerencie relatórios públicos de compliance e due diligence.</p>
          </div>

          {reports.length === 0 ? (
            <EmptyState
              icon="folder"
              title="Nenhum relatório"
              description="Os relatórios publicados aparecerão aqui."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Título</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Análise</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Criado em</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {reports.map((r) => (
                      <tr key={r.id} className="transition hover:bg-gray-50/60">
                        <td className="px-4 py-3.5 text-[13px] font-semibold text-gray-900">{r.title || 'Relatório sem título'}</td>
                        <td className="px-4 py-3.5 text-[13px] text-gray-500">{r.caseId || '—'}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${r.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            {r.status === 'published' ? 'Publicado' : 'Rascunho'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-gray-500">{r.createdAt ? new Date(r.createdAt).toLocaleString('pt-BR') : '—'}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            {r.publicUrl && (
                              <a href={r.publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-500 hover:underline">
                                <ExternalLink size={14} /> Abrir
                              </a>
                            )}
                            {pendingRevoke === r.id ? (
                              <>
                                <button type="button" className="text-[12px] font-semibold text-red-600 hover:underline" onClick={() => handleRevokeConfirm(r.id)}>
                                  Confirmar
                                </button>
                                <button type="button" className="text-[12px] font-semibold text-gray-500 hover:underline" onClick={() => setPendingRevoke(null)}>
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button type="button" className="inline-flex items-center gap-1 text-[12px] font-semibold text-red-600 hover:underline" onClick={() => setPendingRevoke(r.id)}>
                                <Trash2 size={14} /> Revogar
                              </button>
                            )}
                          </div>
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
