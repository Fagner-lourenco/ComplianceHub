import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Search, Check, User, Building2, Save,
  FolderOpen, Layers
} from 'lucide-react';
import DossierLayout from '../layouts/DossierLayout';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
import { useSources } from '../hooks/useSources';
import { useProfiles } from '../hooks/useProfiles';
import { useToast } from '../../shared/hooks/useToast';

const STEPS = [
  { label: 'Perfil', done: true },
  { label: 'Fontes', done: false, active: true },
  { label: 'Parâmetros', done: false },
];

function Stepper() {
  return (
    <nav aria-label="Passos" className="mb-6">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, i) => (
          <li key={step.label} className="flex flex-1 items-center">
            <div
              className={`flex flex-1 items-center gap-3 rounded-lg border px-4 py-3 transition ${
                step.active
                  ? 'border-brand-500 bg-purple-50'
                  : step.done
                  ? 'border-gray-200 bg-white'
                  : 'border-gray-100 bg-gray-50/60'
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  step.active
                    ? 'bg-brand-500 text-white'
                    : step.done
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={`text-[12px] font-semibold ${
                  step.active ? 'text-brand-500' : step.done ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="mx-2 h-px w-4 bg-gray-200" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function CustomProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [personType, setPersonType] = useState('pf');
  const [sourceQuery, setSourceQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [profileDescription, setProfileDescription] = useState('');

  const { sources, loading: sourcesLoading, error: sourcesError, refetch: refetchSources } = useSources();
  const { create: createProfile, loading: saveLoading } = useProfiles();

  const sourceGroups = useMemo(() => {
    if (!sources) return [];
    const groups = {};
    const seen = new Set();
    sources.forEach((source) => {
      const key = source.key || source.name;
      if (seen.has(key)) return;
      seen.add(key);
      const category = source.category || 'Outros';
      if (!groups[category]) {
        groups[category] = { key: category, title: category, sources: [] };
      }
      groups[category].sources.push(source.name || source.key);
    });
    return Object.values(groups);
  }, [sources]);

  const filteredGroups = useMemo(() => {
    const query = sourceQuery.trim().toLowerCase();
    if (!query) return sourceGroups;
    return sourceGroups
      .map((group) => ({
        ...group,
        sources: group.sources.filter((source) => source.toLowerCase().includes(query)),
      }))
      .filter((group) => group.sources.length > 0);
  }, [sourceGroups, sourceQuery]);

  function toggleSource(source) {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }

  async function handleSave() {
    const name = profileName.trim();
    if (name.length < 3) {
      toast.error('Nome do perfil precisa ter pelo menos 3 caracteres.');
      return;
    }
    if (selectedSources.length === 0) {
      toast.error('Selecione pelo menos uma fonte.');
      return;
    }
    try {
      await createProfile({
        name,
        description: profileDescription.trim(),
        personType,
        sources: selectedSources,
      });
      toast.success('Perfil personalizado salvo!');
      navigate('/dossie/create');
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar perfil.');
    }
  }

  if (sourcesLoading) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-gray-50/50">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10">
            <LoadingState rows={4} columns={2} />
          </div>
        </main>
      </DossierLayout>
    );
  }

  if (sourcesError) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-gray-50/50">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10">
            <ErrorState
              title="Erro ao carregar fontes"
              message={sourcesError.message}
              onRetry={refetchSources}
            />
          </div>
        </main>
      </DossierLayout>
    );
  }

  return (
    <DossierLayout>
      <main className="min-h-screen bg-gray-50/50">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dossie/create')}
              className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 shadow-sm transition hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div>
              <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                Configuração
              </span>
              <h1 className="text-xl font-bold text-gray-900">Perfil personalizado</h1>
            </div>
          </div>

          <Stepper />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Main form */}
            <div className="lg:col-span-2 flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Nome do perfil <span className="text-red-500">*</span>
                  </span>
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Ex: Compliance RH Premium"
                    minLength={3}
                    className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"
                  />
                  {profileName && profileName.trim().length > 0 && profileName.trim().length < 3 && (
                    <span className="text-[11px] text-red-500">Mínimo 3 caracteres.</span>
                  )}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-700">Descrição</span>
                  <textarea
                    value={profileDescription}
                    onChange={(e) => setProfileDescription(e.target.value)}
                    placeholder="Descreva o objetivo deste perfil..."
                    rows={3}
                    className="rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] text-gray-800 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"
                  />
                </label>
              </div>

              {/* PF/PJ toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50/60 p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setPersonType('pf')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12px] font-bold transition ${
                    personType === 'pf'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Pessoa física
                </button>
                <button
                  type="button"
                  onClick={() => setPersonType('pj')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12px] font-bold transition ${
                    personType === 'pj'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Pessoa jurídica
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={sourceQuery}
                  onChange={(e) => setSourceQuery(e.target.value)}
                  placeholder="Pesquisar fonte..."
                  className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-[13px] text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"
                />
              </div>

              {/* Source groups */}
              <div className="flex flex-col gap-4">
                {filteredGroups.map((group) => (
                  <section key={group.key} className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-gray-400" />
                      <strong className="text-[13px] font-bold text-gray-800">{group.title}</strong>
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                        {group.sources.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {group.sources.map((source) => {
                        const checked = selectedSources.includes(source);
                        return (
                          <button
                            key={source}
                            type="button"
                            onClick={() => toggleSource(source)}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                              checked
                                ? 'border-brand-500 bg-purple-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                checked
                                  ? 'border-brand-500 bg-brand-500 text-white'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {checked && <Check className="h-3 w-3" />}
                            </div>
                            <span className="text-[12px] font-medium text-gray-700 truncate">
                              {source}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
                {filteredGroups.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-12">
                    <Search className="mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-[13px] text-gray-500">Nenhuma fonte encontrada</p>
                  </div>
                )}
              </div>
            </div>

            {/* Side panel */}
            <aside className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm h-fit lg:sticky lg:top-6">
              <div>
                <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                  Resumo do perfil
                </span>
                <h2 className="mt-1 text-lg font-bold text-gray-900">
                  {profileName || 'Novo perfil'}
                </h2>
              </div>

              <div className="flex items-center gap-4 rounded-xl bg-purple-50 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                  <FolderOpen className="h-6 w-6 text-brand-500" />
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-gray-900">{selectedSources.length}</div>
                  <div className="text-[12px] font-medium text-gray-500">fontes selecionadas</div>
                </div>
              </div>

              {selectedSources.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Selecionadas
                  </span>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50 p-2">
                    {selectedSources.map((source) => (
                      <div
                        key={source}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-gray-700"
                      >
                        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                        <span className="truncate">{source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saveLoading || profileName.trim().length < 3 || selectedSources.length === 0}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 active:scale-[0.97] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
              >
                <Save className="h-4 w-4" />
                {saveLoading ? 'Salvando...' : 'Salvar perfil personalizado'}
              </button>
            </aside>
          </div>
        </div>
      </main>
    </DossierLayout>
  );
}
