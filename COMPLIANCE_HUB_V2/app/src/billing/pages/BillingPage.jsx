import { CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
import DossierLayout from '../../dossie/layouts/DossierLayout';
import { useBilling } from '../hooks/useBilling';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
import EmptyState from '../../shared/components/EmptyState';

export default function BillingPage() {
  const { overview, loading, error, refetch } = useBilling();

  if (loading) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-gray-50/50">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
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
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <ErrorState title="Erro ao carregar billing" message={error.message} onRetry={refetch} />
          </div>
        </main>
      </DossierLayout>
    );
  }

  const summary = overview?.summary || {};
  const metrics = [
    { label: 'Créditos disponíveis', value: summary.remainingCredits ?? '—', icon: CreditCard, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Consumido no período', value: summary.consumedCredits ?? '—', icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
    { label: 'Limite diário', value: summary.dailyLimit ?? '—', icon: AlertCircle, color: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <DossierLayout>
      <main className="min-h-screen bg-gray-50/50">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">Financeiro</span>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Billing &amp; Consumo</h1>
            <p className="mt-1 text-[14px] text-gray-500">Visualize créditos, consumo e limites do tenant.</p>
          </div>

          {!overview ? (
            <EmptyState
              icon="folder"
              title="Nenhum dado de billing"
              description="Os dados de consumo aparecerão aqui quando houver movimentação."
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {metrics.map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${m.color}`}>
                        <Icon size={18} aria-hidden="true" />
                      </div>
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-400">{m.label}</p>
                      <p className="mt-1 text-2xl font-extrabold text-gray-900">{m.value}</p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-[15px] font-bold text-gray-900">Resumo do período</h2>
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Tenant', value: overview.tenantName || '—' },
                    { label: 'Período', value: overview.period || '—' },
                    { label: 'Total de análises', value: summary.totalCases ?? '—' },
                    { label: 'Custo estimado', value: summary.estimatedCost ? `R$ ${summary.estimatedCost}` : '—' },
                    { label: 'Status', value: summary.exceeded ? 'Limite excedido' : 'Dentro do limite', isStatus: true, danger: summary.exceeded },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-gray-400">{row.label}</span>
                      {row.isStatus ? (
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${row.danger ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {row.value}
                        </span>
                      ) : (
                        <span className="text-[13px] font-bold text-gray-800">{row.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </DossierLayout>
  );
}
