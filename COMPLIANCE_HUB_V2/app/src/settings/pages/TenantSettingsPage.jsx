import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import DossierLayout from '../../dossie/layouts/DossierLayout';
import { useTenantSettings } from '../hooks/useTenantSettings';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
import { useToast } from '../../shared/hooks/useToast';

export default function TenantSettingsPage() {
  const { settings, loading, error, saving, refetch, saveSettings } = useTenantSettings();
  const { toast } = useToast();
  const [form, setForm] = useState({
    tenantName: '',
    dailyLimit: '',
    monthlyLimit: '',
    allowDailyExceedance: false,
    allowMonthlyExceedance: false,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        tenantName: settings.tenantName || '',
        dailyLimit: settings.dailyLimit ?? '',
        monthlyLimit: settings.monthlyLimit ?? '',
        allowDailyExceedance: settings.allowDailyExceedance ?? false,
        allowMonthlyExceedance: settings.allowMonthlyExceedance ?? false,
      });
    }
  }, [settings]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await saveSettings({
        tenantName: form.tenantName,
        dailyLimit: form.dailyLimit ? Number(form.dailyLimit) : null,
        monthlyLimit: form.monthlyLimit ? Number(form.monthlyLimit) : null,
        allowDailyExceedance: form.allowDailyExceedance,
        allowMonthlyExceedance: form.allowMonthlyExceedance,
      });
      toast.success('Configurações salvas com sucesso!');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar configurações');
    }
  }

  if (loading) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-gray-50/50">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <LoadingState rows={4} columns={2} />
          </div>
        </main>
      </DossierLayout>
    );
  }

  if (error) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-gray-50/50">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <ErrorState title="Erro ao carregar configurações" message={error.message} onRetry={refetch} />
          </div>
        </main>
      </DossierLayout>
    );
  }

  return (
    <DossierLayout>
      <main className="min-h-screen bg-gray-50/50">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">Configurações</span>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Configurações do Tenant</h1>
            <p className="mt-1 text-[14px] text-gray-500">Gerencie limites, nome do tenant e parâmetros operacionais da plataforma.</p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-gray-700">Nome do tenant</span>
                <input
                  type="text"
                  value={form.tenantName}
                  onChange={(e) => setForm({ ...form, tenantName: e.target.value })}
                  placeholder="Nome da empresa ou departamento"
                  className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-700">Limite diário de análises</span>
                  <input
                    type="number"
                    min={0}
                    value={form.dailyLimit}
                    onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })}
                    placeholder="Sem limite"
                    className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-700">Limite mensal de análises</span>
                  <input
                    type="number"
                    min={0}
                    value={form.monthlyLimit}
                    onChange={(e) => setForm({ ...form, monthlyLimit: e.target.value })}
                    placeholder="Sem limite"
                    className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.allowDailyExceedance}
                    onChange={(e) => setForm({ ...form, allowDailyExceedance: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-purple-100"
                  />
                  <span className="text-[13px] text-gray-700">Permitir excedente diário (com alerta)</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.allowMonthlyExceedance}
                    onChange={(e) => setForm({ ...form, allowMonthlyExceedance: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-purple-100"
                  />
                  <span className="text-[13px] text-gray-700">Permitir excedente mensal (com alerta)</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 active:scale-[0.97] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar configurações'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </DossierLayout>
  );
}
