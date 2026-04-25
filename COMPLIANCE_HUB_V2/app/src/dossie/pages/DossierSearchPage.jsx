import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Shield, Globe, DollarSign, Gavel, Database, Briefcase,
  Info, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  MessageCircle, Plus, FileSpreadsheet, X, Check, Sparkles,
  Tag as TagIcon, SlidersHorizontal, FileText, Trash2,
} from 'lucide-react';
import DossierLayout from '../layouts/DossierLayout';
import { useDossierCreate } from '../hooks/useDossierCreate';
import { useToast } from '../../shared/hooks/useToast';

function cx(...parts) { return parts.filter(Boolean).join(' '); }

/* ── Validators / formatters ── */
function formatCpf(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function formatCnpj(v) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
function isValidCpf(v) {
  const d = v.replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = 11 - (sum % 11);
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = 11 - (sum % 11);
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(d[10]);
}
function isValidCnpj(v) {
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (size) => {
    const w = size === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let s = 0;
    for (let i = 0; i < size; i++) s += parseInt(d[i]) * w[i];
    const m = s % 11;
    return m < 2 ? 0 : 11 - m;
  };
  return calc(12) === parseInt(d[12]) && calc(13) === parseInt(d[13]);
}

const STEPS = [
  { key: 'perfil', label: 'Perfil de consulta', icon: Sparkles },
  { key: 'criterios', label: 'Critérios', icon: Search },
  { key: 'tag', label: 'Tag', icon: TagIcon },
  { key: 'parametros', label: 'Parâmetros', icon: SlidersHorizontal },
];

const PRESETS = [
  {
    key: 'compliance', title: 'Compliance', icon: Shield,
    accent: 'from-blue-500 to-indigo-600',
    description: 'Reunimos neste perfil as fontes essenciais para manter sua empresa segura contra riscos regulatórios e dentro das normas exigidas pelo setor.',
    sources: ['Reclame Aqui: Reclamações e Reputação', 'PROCON SP: Cadastro de Reclamações', 'Infosimples: Certidão Negativa da MPF', 'TST: Certidão Negativa de Débitos Trabalhistas', 'CEF: Certificado de Regularidade do FGTS', 'Processos Judiciais'],
    estTime: '2–4 min',
  },
  {
    key: 'internacional', title: 'Compliance Internacional', icon: Globe,
    accent: 'from-cyan-500 to-blue-600',
    description: 'Perfil voltado a checagens internacionais, listas restritivas, empresas offshore e fontes globais de reputação e integridade.',
    sources: ['Lista Europeia', 'Lista da ONU', 'ICIJ: Empresas Offshore', 'World Bank: Pessoas e Empresas Impedidas', 'Instant OFAC'],
    estTime: '1–2 min',
  },
  {
    key: 'financeiro', title: 'Financeiro', icon: DollarSign,
    accent: 'from-emerald-500 to-teal-600',
    description: 'Este perfil oferece um amplo conjunto de utilidades para checagem financeira, inadimplência, regularidade fiscal e histórico cadastral.',
    sources: ['IPTU São Paulo', 'SERPRO SNCR', 'PGM SP: Protesto SP', 'CNEP Empresas Punidas', 'Certidão TST'],
    estTime: '2–3 min',
  },
  {
    key: 'investigativo', title: 'Investigativo', icon: Search,
    accent: 'from-rose-500 to-pink-600',
    description: 'Perfil orientado à busca ampliada de vínculos, registros, cadastros e indícios relevantes para investigação e análise de contexto.',
    sources: ['Processos Judiciais', 'Antecedente Criminal PF', 'Consulta CPF', 'Consulta CNPJ', 'Mídia/Internet'],
    estTime: '3–4 min',
  },
  {
    key: 'juridico', title: 'Jurídico', icon: Gavel,
    accent: 'from-slate-600 to-neutral-700',
    description: 'Conjunto de fontes para análise jurídica, processos, certidões e consultas em bases judiciais e administrativas.',
    sources: ['Processos Judiciais', 'TSE: Situação Eleitoral', 'TST', 'Antecedente Criminal PF'],
    estTime: '2–3 min',
  },
  {
    key: 'pld', title: 'PLD', icon: Database,
    accent: 'from-violet-500 to-purple-600',
    description: 'Perfil voltado à prevenção à lavagem de dinheiro, identificação de riscos, listas restritivas e exposição política.',
    sources: ['Transparência PEP', 'Lista ONU', 'Instant OFAC', 'Bacen Inabilitados'],
    estTime: '1–2 min',
  },
  {
    key: 'rh', title: 'Recursos Humanos', icon: Briefcase,
    accent: 'from-amber-500 to-orange-600',
    description: 'Desenvolvemos este perfil para fortalecer o poder de recrutamento das empresas e assegurar uma seleção de talentos precisa e eficiente.',
    sources: ['TSE Eleitoral', 'QSA Sócios', 'CPF Receita Federal', 'Processos Judiciais', 'Antecedente Criminal PF', 'ONU', 'MTE Trabalho Escravo', 'Bacen', 'TST', 'IBAMA'],
    estTime: '3–5 min',
  },
];

/* ── Premium Stepper — gradient + numbered + connectors ── */
function PremiumStepper({ currentIndex, onJump }) {
  return (
    <nav aria-label="Passos" className="mb-8">
      <ol className="flex flex-wrap items-center gap-y-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < currentIndex;
          const active = i === currentIndex;
          const reachable = i <= currentIndex;
          return (
            <li key={s.key} className="flex items-center">
              <button
                type="button"
                onClick={() => reachable && onJump(i)}
                disabled={!reachable}
                className={cx(
                  'group flex items-center gap-2.5 rounded-full px-3 py-1.5 transition-all',
                  reachable ? 'cursor-pointer' : 'cursor-not-allowed',
                )}
              >
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all',
                    active && 'bg-gradient-to-br from-[#ff8417] to-[#5f147f] text-white shadow-md shadow-purple-200 ring-2 ring-white ring-offset-2 ring-offset-purple-50',
                    done && 'bg-emerald-500 text-white',
                    !active && !done && 'bg-neutral-200 text-neutral-500',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span
                  className={cx(
                    'text-[12px] font-semibold transition',
                    active ? 'text-[#5f147f]' : done ? 'text-neutral-700' : 'text-neutral-400',
                  )}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span
                  className={cx(
                    'mx-2 h-px w-6 sm:w-10 transition',
                    done ? 'bg-emerald-400' : 'bg-neutral-200',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ── Premium Profile Card — gradient bar + icon + meta ── */
function PresetCard({ preset, active, onSelect, onShowDetails }) {
  const Icon = preset.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      className={cx(
        'relative flex h-[180px] min-w-[220px] shrink-0 flex-col overflow-hidden rounded-xl border bg-white transition-all',
        active
          ? 'border-[#9e38e8] shadow-[0_0_0_1px_#9e38e8,0_8px_24px_rgba(132,39,207,0.12)]'
          : 'border-neutral-200 shadow-sm hover:border-neutral-300 hover:shadow-md',
      )}
    >
      {/* Gradient accent strip */}
      <div className={cx('h-1 bg-gradient-to-r', preset.accent)} />

      <button
        type="button"
        onClick={() => onSelect(preset.key)}
        aria-pressed={active}
        className="flex flex-1 flex-col items-center justify-center px-3 pb-2 pt-4 text-center focus:outline-none"
      >
        <div className={cx(
          'mb-2 flex h-11 w-11 items-center justify-center rounded-xl',
          active ? 'bg-gradient-to-br from-[#ff8417]/20 to-[#5f147f]/20 text-[#5f147f]' : 'bg-neutral-50 text-[#ff8500]',
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className={cx('text-[15px] font-bold leading-tight', active ? 'text-[#5f147f]' : 'text-neutral-900')}>
          {preset.title}
        </div>
        <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
          {preset.estTime} · {preset.sources.length} fontes
        </div>
        {active && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            <Check className="h-2.5 w-2.5" />
            Selecionado
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onShowDetails(preset)}
        className="flex items-center justify-center gap-1 border-t border-neutral-100 bg-neutral-50/50 py-2 text-[10px] font-bold text-[#8427cf] transition hover:bg-purple-50"
      >
        <Info className="h-3 w-3" />
        Ver Detalhes
      </button>
    </motion.div>
  );
}

/* ── Profile Side Panel ── */
function ProfileSidePanel({ profile, onClose }) {
  if (!profile) return null;
  const Icon = profile.icon;
  return (
    <motion.aside
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      className="fixed right-0 top-0 z-40 flex h-screen w-full flex-col border-l-4 border-[#ff8500] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] sm:w-[380px]"
    >
      <div className={cx('h-1 bg-gradient-to-r', profile.accent)} />
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-7 pb-5 pt-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br', profile.accent)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[16px] font-bold text-neutral-900">{profile.title}</div>
            <div className="text-[11px] text-neutral-500">{profile.estTime} · {profile.sources.length} fontes</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-5">
        <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Objetivo</div>
        <p className="mt-2 text-[13px] leading-7 text-neutral-700">{profile.description}</p>

        <div className="mt-6 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
          Fontes incluídas ({profile.sources.length})
        </div>
        <div className="mt-2">
          {profile.sources.map((source, idx) => (
            <motion.div
              key={`${source}-${idx}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.025 }}
              className="flex items-start gap-2 border-b border-neutral-100 py-2.5 text-[12px] text-neutral-600"
            >
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
              <span>{source}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}

/* ── Page ── */
export default function DossierSearchPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { create, loading: createLoading } = useDossierCreate();

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex].key;

  const [personType, setPersonType] = useState('pf');
  const [selectedPresetKey, setSelectedPresetKey] = useState('compliance');
  const [previewPreset, setPreviewPreset] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const [criteria, setCriteria] = useState([]); // [{document, fullName}]
  const [docInput, setDocInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  const [tag, setTag] = useState('');
  const [noTag, setNoTag] = useState(false);
  const [autoProcess, setAutoProcess] = useState(true);
  const [autoRelevant, setAutoRelevant] = useState(false);
  const [paramOpen, setParamOpen] = useState(true);

  const currentPreset = useMemo(() => PRESETS.find((p) => p.key === selectedPresetKey), [selectedPresetKey]);

  // Auto-show preview panel on first load
  useEffect(() => {
    if (panelOpen) setPreviewPreset(currentPreset);
    else setPreviewPreset(null);
  }, [currentPreset, panelOpen]);

  // ESC closes panel
  useEffect(() => {
    if (!previewPreset) return undefined;
    function onKey(e) { if (e.key === 'Escape') setPreviewPreset(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewPreset]);

  const docValid = useMemo(() => {
    return personType === 'pf' ? isValidCpf(docInput) : isValidCnpj(docInput);
  }, [docInput, personType]);

  const canAdvance = useMemo(() => {
    if (step === 'perfil') return !!selectedPresetKey;
    if (step === 'criterios') return criteria.length > 0;
    return true;
  }, [step, selectedPresetKey, criteria.length]);

  const isLast = stepIndex === STEPS.length - 1;

  function next() {
    if (!canAdvance) return;
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  }
  function back() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
    else navigate('/dossie');
  }
  function jumpTo(idx) {
    if (idx <= stepIndex) setStepIndex(idx);
  }

  function addCriterion() {
    if (!docValid) {
      toast.error(personType === 'pf' ? 'CPF inválido' : 'CNPJ inválido');
      return;
    }
    if (criteria.find((c) => c.document === docInput)) {
      toast.warning('Critério já adicionado');
      return;
    }
    setCriteria([...criteria, { document: docInput, fullName: nameInput.trim() }]);
    setDocInput('');
    setNameInput('');
  }
  function removeCriterion(doc) {
    setCriteria(criteria.filter((c) => c.document !== doc));
  }

  async function handleCreate() {
    if (criteria.length === 0) {
      toast.error('Adicione pelo menos um critério');
      return;
    }
    try {
      const first = criteria[0];
      const rawDoc = first.document.replace(/\D/g, '');
      const payload = {
        subjectKind: personType,
        dossierPresetKey: selectedPresetKey,
        productKey: personType === 'pf' ? 'dossier_pf_basic' : 'dossier_pj',
        tagIds: noTag ? [] : tag ? [tag] : [],
        parameters: {},
        autoMarkRelevant: autoRelevant,
        autoProcess,
        fullName: first.fullName || '',
        document: rawDoc,
        ...(personType === 'pf' ? { cpf: rawDoc } : { cnpj: rawDoc }),
        bulkCriteria: criteria.length > 1 ? criteria : undefined,
      };
      const result = await create(payload);
      toast.success('Dossiê criado com sucesso!');
      navigate(`/dossie/${result.id || result.caseId || ''}/processing`);
    } catch (err) {
      toast.error(err?.message || 'Erro ao criar dossiê.');
    }
  }

  function handleDocChange(v) {
    setDocInput(personType === 'pf' ? formatCpf(v) : formatCnpj(v));
  }

  return (
    <DossierLayout>
      <main className="relative flex min-h-screen flex-col bg-gradient-to-b from-white via-neutral-50/40 to-white">
        {/* Page header */}
        <div className={cx(
          'mx-auto w-full transition-all',
          panelOpen ? 'max-w-[1820px] pr-0 lg:pr-[380px]' : 'max-w-[1820px]',
        )}>
          <div className="px-4 pb-2 pt-7 sm:px-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-7 flex flex-wrap items-start justify-between gap-4"
            >
              <div>
                <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#8427cf]">
                  <Sparkles className="h-3 w-3" />
                  Nova análise
                </div>
                <h1 className="text-[28px] font-bold tracking-[-0.02em] text-neutral-900 sm:text-[32px]">
                  Criação de dossiês
                </h1>
                <p className="mt-1 text-[14px] text-neutral-500">
                  Configure perfil de consulta, critérios e parâmetros para iniciar a análise.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dossie')}
                className="inline-flex items-center gap-1 text-[13px] font-bold text-[#8427cf] transition hover:underline"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar para histórico
              </button>
            </motion.div>

            {/* Stepper */}
            <PremiumStepper currentIndex={stepIndex} onJump={jumpTo} />
          </div>

          {/* Step content */}
          <div className="px-4 pb-32 sm:px-10">
            <AnimatePresence mode="wait">
              {/* PERFIL */}
              {step === 'perfil' && (
                <motion.div
                  key="perfil"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.22 }}
                >
                  {/* PF/PJ premium toggle */}
                  <div className="mb-6 inline-flex rounded-full border border-neutral-300 bg-white p-1 shadow-sm">
                    {[
                      { key: 'pf', label: 'Pessoa Física' },
                      { key: 'pj', label: 'Pessoa Jurídica' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setPersonType(opt.key)}
                        className={cx(
                          'rounded-full px-6 py-2 text-[12px] font-bold transition-all',
                          personType === opt.key
                            ? 'bg-gradient-to-r from-[#ff8417] to-[#5f147f] text-white shadow-md'
                            : 'text-neutral-600 hover:bg-purple-50 hover:text-[#8427cf]',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom profiles */}
                  <section className="mb-8">
                    <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-neutral-600">
                      Perfis Personalizados
                      <Info className="h-3.5 w-3.5 text-neutral-400" />
                    </div>
                    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/40 px-6 py-8 text-center">
                      <p className="text-[13px] text-neutral-500">Nenhum perfil personalizado encontrado</p>
                      <button
                        type="button"
                        onClick={() => navigate('/dossie/custom-profile')}
                        className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-[#8427cf] hover:underline"
                      >
                        <Plus className="h-3 w-3" />
                        Criar perfil personalizado
                      </button>
                    </div>
                  </section>

                  {/* Standardized profiles */}
                  <section>
                    <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-neutral-600">
                      Perfis Padronizados
                      <Info className="h-3.5 w-3.5 text-neutral-400" />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                      {PRESETS.map((p) => (
                        <PresetCard
                          key={p.key}
                          preset={p}
                          active={selectedPresetKey === p.key}
                          onSelect={(key) => { setSelectedPresetKey(key); setPanelOpen(true); }}
                          onShowDetails={(preset) => { setPreviewPreset(preset); setPanelOpen(true); }}
                        />
                      ))}
                    </div>
                  </section>
                </motion.div>
              )}

              {/* CRITERIOS */}
              {step === 'criterios' && (
                <motion.div
                  key="criterios"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="mb-6">
                    <h2 className="text-[18px] font-bold text-neutral-900">Inicie Critérios</h2>
                    <p className="mt-1 text-[13px] text-neutral-500">
                      Adicione um ou mais {personType === 'pf' ? 'CPFs' : 'CNPJs'} para consultar.
                    </p>
                  </div>

                  {/* Input row */}
                  <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                          {personType === 'pf' ? 'CPF' : 'CNPJ'} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={docInput}
                            onChange={(e) => handleDocChange(e.target.value)}
                            placeholder={personType === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'}
                            className={cx(
                              'h-11 w-full rounded-lg border bg-white pl-10 pr-4 text-[14px] tabular-nums text-neutral-900 outline-none transition',
                              docInput && !docValid
                                ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                                : 'border-neutral-300 focus:border-[#8427cf] focus:ring-2 focus:ring-purple-100'
                            )}
                          />
                        </div>
                        {docInput && !docValid && (
                          <p className="mt-1.5 text-[11px] text-red-500">
                            {personType === 'pf' ? 'CPF inválido' : 'CNPJ inválido'}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                          {personType === 'pf' ? 'Nome completo' : 'Razão social'}
                          <span className="ml-1 normal-case text-neutral-400">(opcional)</span>
                        </label>
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && docValid) addCriterion(); }}
                          placeholder={personType === 'pf' ? 'Nome do consultado' : 'Razão social da empresa'}
                          className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-4 text-[14px] text-neutral-900 outline-none transition focus:border-[#8427cf] focus:ring-2 focus:ring-purple-100"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={addCriterion}
                          disabled={!docValid}
                          className={cx(
                            'inline-flex h-11 items-center gap-2 rounded-lg px-5 text-[13px] font-bold transition',
                            docValid
                              ? 'bg-gradient-to-r from-[#ff8417] to-[#5f147f] text-white shadow-md hover:opacity-90 active:scale-[0.97]'
                              : 'cursor-not-allowed bg-neutral-200 text-neutral-400',
                          )}
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar
                        </button>
                      </div>
                    </div>

                    {/* Helper actions */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-100 pt-3 text-[12px]">
                      <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-[#8427cf] hover:underline">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Modelo de Planilha
                      </button>
                      <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-[#8427cf] hover:underline">
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar Modelo
                      </button>
                      <span className="ml-auto text-[11px] text-neutral-400">
                        {criteria.length} {criteria.length === 1 ? 'critério' : 'critérios'} adicionados
                      </span>
                    </div>
                  </div>

                  {/* Criteria list */}
                  {criteria.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
                    >
                      <table className="w-full text-left text-[12px]">
                        <thead className="bg-neutral-50">
                          <tr className="border-b border-neutral-200">
                            <th className="px-4 py-3 font-bold text-neutral-700 w-12">#</th>
                            <th className="px-4 py-3 font-bold text-neutral-700">{personType === 'pf' ? 'CPF' : 'CNPJ'}</th>
                            <th className="px-4 py-3 font-bold text-neutral-700">{personType === 'pf' ? 'Nome' : 'Razão social'}</th>
                            <th className="px-4 py-3 font-bold text-neutral-700 w-20">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {criteria.map((c, idx) => (
                            <tr key={c.document} className="border-b border-neutral-100 last:border-b-0 transition hover:bg-purple-50/30">
                              <td className="px-4 py-3 tabular-nums text-neutral-500">{String(idx + 1).padStart(2, '0')}</td>
                              <td className="px-4 py-3 font-semibold tabular-nums text-neutral-800">{c.document}</td>
                              <td className="px-4 py-3 text-neutral-600">{c.fullName || <span className="text-neutral-400 italic">—</span>}</td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => removeCriterion(c.document)}
                                  className="inline-flex items-center gap-1 rounded-md p-1 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                                  aria-label="Remover"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* TAG */}
              {step === 'tag' && (
                <motion.div
                  key="tag"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="mb-6">
                    <h2 className="text-[18px] font-bold text-neutral-900">Descrição da Tag</h2>
                    <p className="mt-1 text-[13px] text-neutral-500">
                      Selecione uma tag existente para organizar este dossiê (opcional).
                    </p>
                  </div>

                  <div className="max-w-[480px] rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                    <label className="block">
                      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                        Tags Criadas
                      </div>
                      <div className="relative">
                        <TagIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                        <select
                          value={tag}
                          onChange={(e) => setTag(e.target.value)}
                          disabled={noTag}
                          className="h-11 w-full appearance-none rounded-lg border border-neutral-300 bg-white pl-10 pr-9 text-[14px] text-neutral-700 outline-none transition focus:border-[#8427cf] focus:ring-2 focus:ring-purple-100 disabled:bg-neutral-50 disabled:opacity-60"
                        >
                          <option value="">Selecione uma tag...</option>
                          <option value="urgente">Urgente</option>
                          <option value="rh-prioritario">RH Prioritário</option>
                          <option value="compliance">Compliance</option>
                          <option value="fornecedor">Fornecedor</option>
                          <option value="parceiro">Parceiro</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                      </div>
                    </label>

                    <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-lg p-2 text-[13px] text-[#8427cf] transition hover:bg-purple-50">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#8427cf] text-[#8427cf] focus:ring-purple-100"
                        checked={noTag}
                        onChange={(e) => setNoTag(e.target.checked)}
                      />
                      Não atribuir tag a esse dossiê
                    </label>
                  </div>
                </motion.div>
              )}

              {/* PARAMETROS */}
              {step === 'parametros' && (
                <motion.div
                  key="parametros"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="mb-6">
                    <h2 className="text-[18px] font-bold text-neutral-900">Parâmetros</h2>
                    <p className="mt-1 text-[13px] text-neutral-500">
                      Adicione parâmetros para enriquecer a busca e encontrar resultados mais precisos.
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setParamOpen((o) => !o)}
                      className="flex w-full items-center justify-between border-b border-[#b878f0] bg-gradient-to-r from-purple-50/60 to-white px-5 py-3.5 text-left transition hover:from-purple-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-[#8427cf]">
                          <Gavel className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[14px] font-bold text-neutral-900">Processos Judiciais</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Nova</span>
                      </div>
                      {paramOpen ? <ChevronUp className="h-4 w-4 text-[#8427cf]" /> : <ChevronDown className="h-4 w-4 text-[#8427cf]" />}
                    </button>
                    <AnimatePresence>
                      {paramOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 py-4">
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg p-2 transition hover:bg-purple-50">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 rounded border-[#8427cf] text-[#8427cf] focus:ring-purple-100"
                                checked={autoRelevant}
                                onChange={(e) => setAutoRelevant(e.target.checked)}
                              />
                              <div>
                                <span className="block text-[13px] font-semibold text-[#8427cf]">
                                  Marcar automaticamente como relevantes
                                </span>
                                <span className="block text-[11px] text-neutral-500">
                                  Todos os processos retornados serão pré-marcados como relevantes para análise.
                                </span>
                              </div>
                            </label>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Summary review card */}
                  <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50/40 p-5">
                    <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-neutral-600">
                      <FileText className="h-3.5 w-3.5" />
                      Resumo da Solicitação
                    </div>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                      <div className="flex justify-between border-b border-neutral-200 pb-2">
                        <span className="text-neutral-500">Perfil</span>
                        <strong className="text-neutral-800">{currentPreset?.title}</strong>
                      </div>
                      <div className="flex justify-between border-b border-neutral-200 pb-2">
                        <span className="text-neutral-500">Tipo</span>
                        <strong className="text-neutral-800">{personType === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}</strong>
                      </div>
                      <div className="flex justify-between border-b border-neutral-200 pb-2">
                        <span className="text-neutral-500">Critérios</span>
                        <strong className="tabular-nums text-neutral-800">{criteria.length}</strong>
                      </div>
                      <div className="flex justify-between border-b border-neutral-200 pb-2">
                        <span className="text-neutral-500">Tag</span>
                        <strong className="text-neutral-800">{noTag ? '—' : (tag || 'Nenhuma')}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Tempo estimado</span>
                        <strong className="text-neutral-800">{currentPreset?.estTime}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Fontes</span>
                        <strong className="tabular-nums text-neutral-800">{currentPreset?.sources.length}</strong>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sticky footer action bar */}
        <div className={cx(
          'fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white/95 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md transition-all',
          panelOpen ? 'lg:right-[380px]' : 'right-0',
        )}>
          <div className="mx-auto flex max-w-[1820px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-10">
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-[#9e38e8] px-5 py-2 text-[13px] font-bold text-[#8427cf] transition hover:bg-purple-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </button>

            <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
              {step === 'perfil' && (
                <span className="text-[12px] text-neutral-500">
                  Nenhum atende?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/dossie/custom-profile')}
                    className="font-bold text-[#8427cf] hover:underline"
                  >
                    Crie um novo
                  </button>
                </span>
              )}

              {step === 'parametros' && (
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#8427cf]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#8427cf] text-[#8427cf] focus:ring-purple-100"
                    checked={autoProcess}
                    onChange={(e) => setAutoProcess(e.target.checked)}
                  />
                  Processar automaticamente
                </label>
              )}

              <button
                type="button"
                onClick={isLast ? handleCreate : next}
                disabled={!canAdvance || createLoading}
                className={cx(
                  'inline-flex items-center gap-2 rounded-lg px-6 py-2 text-[13px] font-bold text-white transition',
                  canAdvance && !createLoading
                    ? 'bg-gradient-to-r from-[#ff8417] to-[#5f147f] shadow-md hover:opacity-90 active:scale-[0.98]'
                    : 'cursor-not-allowed bg-neutral-300',
                )}
              >
                {createLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Criando...
                  </>
                ) : isLast ? (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Criar dossiê
                  </>
                ) : (
                  <>
                    Próximo passo
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Side panel toggle (when closed) */}
        {!panelOpen && currentPreset && (
          <button
            type="button"
            onClick={() => { setPanelOpen(true); setPreviewPreset(currentPreset); }}
            className="fixed right-4 top-24 z-30 inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-[12px] font-bold text-[#8427cf] shadow-md transition hover:bg-purple-50"
          >
            <Info className="h-3.5 w-3.5" />
            Ver perfil
          </button>
        )}
      </main>

      {/* Side panel */}
      <AnimatePresence>
        {previewPreset && panelOpen && (
          <ProfileSidePanel profile={previewPreset} onClose={() => { setPanelOpen(false); setPreviewPreset(null); }} />
        )}
      </AnimatePresence>

      {/* Floating chat */}
      <button
        type="button"
        className="fixed bottom-24 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#ff8a00] text-white shadow-lg transition hover:scale-105"
        title="Suporte"
        aria-label="Suporte"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    </DossierLayout>
  );
}
