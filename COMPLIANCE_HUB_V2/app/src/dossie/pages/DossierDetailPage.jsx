import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gavel, Globe, DollarSign, Database, Shield, Home, Briefcase, Users, TreePine,
  ChevronLeft, ChevronDown, ChevronUp, CheckCircle2, XCircle, MessageSquare,
  FileText, BarChart3, List, Loader2, FileCheck, ArrowUpRight, Send,
} from 'lucide-react';
import DossierLayout from '../layouts/DossierLayout';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
import { useDossier } from '../hooks/useDossier';
import { useDossierMutations } from '../hooks/useDossierMutations';
import { useComments } from '../hooks/useComments';
import { useToast } from '../../shared/hooks/useToast';
import { patchDossier, retrySource } from '../api/dossierApi';
import DossierHeader from '../components/DossierHeader';
import SourcePanel from '../components/SourcePanel';
import SourceDetail from '../components/SourceDetail';
import JudicialFilters from '../components/JudicialFilters';
import { StatusBarChart, TribunalPieChart, SubjectsPieChart, GenericStats } from '../components/AnalyticsCharts';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const MACRO_ICONS = {
  Gavel, Globe, DollarSign, Database, Shield, Home, Briefcase, Users, TreePine,
};

/* ------------------------------------------------------------------ */
/*  Transform backend data → upMiner-style macro areas                */
/* ------------------------------------------------------------------ */
function buildMacroAreas(dossier) {
  if (!dossier) return [];

  // If dossier already has macroAreas with sources, use directly
  if (dossier.macroAreas?.[0]?.sources) {
    return dossier.macroAreas;
  }

  const macroTabs = dossier.macroAreas || [];
  const sections = dossier.sourceSections || [];
  const details = dossier.detailGroups || [];

  return macroTabs.map((tab) => {
    const section = sections.find((s) => s.id === tab.key);
    const detail = details.find((d) => d.id === `det-${tab.key}`);
    const rows = section?.rows || [];
    const entries = detail?.entries || [];

    const sources = rows.map((row) => {
      const entry = entries.find((e) =>
        e.id?.includes(row.source) || e.title?.toLowerCase() === (row.label || row.fonte)?.toLowerCase()
      );

      const hasResult = row.status === 'ok' || row.status === 'Com resultado';
      const isUnavailable = row.status === 'error' || row.status === 'Indisponível';

      let data = null;
      if (entry?.paragraph) {
        data = { type: 'paragraph', paragraph: entry.paragraph };
      }
      if (entry?.table && entry.table.length > 0) {
        data = {
          type: 'table',
          headers: Object.keys(entry.table[0] || {}),
          rows: entry.table.map((r) => Object.values(r)),
        };
      }

      // Try to infer process list from table
      if (entry?.table && entry.table[0]?.['Nº do Processo']) {
        data = {
          type: 'process_list',
          processes: entry.table.map((r) => ({
            number: r['Nº do Processo'] || r.number,
            class: r.Classe || r.class,
            tribunal: r.Tribunal || r.tribunal,
            status: r.Status || r.status || '—',
            statusColor: 'orange',
          })),
        };
      }

      return {
        sourceKey: row.source,
        title: row.label || row.fonte || row.source,
        status: hasResult ? 'has_result' : isUnavailable ? 'unavailable' : 'no_result',
        consultedAt: dossier.createdAt,
        criteria: dossier.document,
        data,
        comments: [],
      };
    });

    // Build analytics — prefer backend analytics when available
    const backendAnalytics = dossier.analytics;
    let analytics;

    if (tab.key === 'judicial' && backendAnalytics) {
      // Map backend Portuguese analytics to frontend format
      const graficos = backendAnalytics.graficos || {};
      analytics = {
        sourceCount: sources.length,
        processCount: backendAnalytics.total_processos || 0,
        asAuthor: backendAnalytics.processos_autor || 0,
        asDefendant: backendAnalytics.processos_reu || 0,
        asInvolved: backendAnalytics.processos_envolvido || 0,
        withoutPole: backendAnalytics.processos_segredo || 0,
        statusChart: graficos.status_processos || {},
        tribunalChart: (graficos.por_tribunal || []).map((t) => ({ label: t.nome, value: t.quantidade })),
        subjects: (graficos.por_assunto || []).map((a) => ({ label: a.nome, count: a.quantidade })),
        varaChart: (graficos.por_vara || []).map((v) => ({ label: v.nome, count: v.quantidade })),
        classeChart: (graficos.por_classe || []).map((c) => ({ label: c.nome, count: c.quantidade })),
      };
    } else {
      // Fallback: compute from local sources
      const moduleRuns = dossier.moduleRuns || [];
      const areaRuns = moduleRuns.filter((r) => {
        const key = r.moduleKey?.toLowerCase() || '';
        if (tab.key === 'judicial') return key.includes('process') || key.includes('lawsuit') || key.includes('judicial');
        if (tab.key === 'cadastro') return key.includes('basic') || key.includes('identity') || key.includes('entity');
        if (tab.key === 'financeiro') return key.includes('financ') || key.includes('debt') || key.includes('certid');
        if (tab.key === 'reguladores') return key.includes('kyc') || key.includes('regul');
        if (tab.key === 'listas_restritivas') return key.includes('ofac') || key.includes('sanction') || key.includes('interpol');
        if (tab.key === 'profissional') return key.includes('occupation') || key.includes('prof');
        if (tab.key === 'socioambiental') return key.includes('esg') || key.includes('ambient');
        return false;
      });

      analytics = {
        sourceCount: sources.length,
        processCount: areaRuns.length,
        asAuthor: 0,
        asDefendant: 0,
        asInvolved: 0,
        withoutPole: 0,
        statusChart: {},
        tribunalChart: [],
        subjects: [],
        varaChart: [],
        classeChart: [],
      };

      const processSources = sources.filter((s) => s.data?.type === 'process_list');
      if (processSources.length > 0) {
        const allProcesses = processSources.flatMap((s) => s.data.processes || []);
        analytics.processCount = allProcesses.length;
        analytics.statusChart = allProcesses.reduce((acc, p) => {
          const key = p.status?.toLowerCase().includes('arquiv') ? 'arquivamento' : 'emTramitacao';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
      }
    }

    return {
      ...tab,
      title: tab.label || tab.title,
      sourceCount: sources.length,
      sourcesWithResults: sources.filter((s) => s.status === 'has_result').length,
      sources,
      analytics,
    };
  }).filter((m) => m.sourceCount > 0 || m.sources?.length > 0);
}

/* ------------------------------------------------------------------ */
/*  Analytics section for a macro area — Lexi img 096                  */
/* ------------------------------------------------------------------ */
function MetricCard({ icon: Icon, label, value }) {
  return (
    <div className="border border-neutral-300 bg-white p-3">
      {Icon && <Icon className="ml-auto h-4 w-4 text-[#8427cf]" />}
      <div className="text-[22px] font-bold text-[#8427cf] tabular-nums leading-none">{value ?? 0}</div>
      <div className="mt-1 text-[11px] text-neutral-500 leading-tight">{label}</div>
    </div>
  );
}

function SourceRow({ source }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 last:border-b-0">
      <span className="text-[12px] text-neutral-700">{source.title}</span>
      <div className="flex items-center gap-2">
        {source.status === 'has_result' ? (
          <span className="rounded bg-[#0d9f52] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Com resultado</span>
        ) : source.status === 'unavailable' ? (
          <span className="rounded bg-[#d94141] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Indisponível</span>
        ) : (
          <span className="rounded bg-[#d98208] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Nenhum resultado</span>
        )}
        {source.status === 'has_result' && (
          <button type="button" className="text-[11px] font-bold text-[#8427cf] hover:underline" title="Ver detalhes">
            Ver detalhes ↗
          </button>
        )}
      </div>
    </div>
  );
}

function AnalyticsSection({ area }) {
  const analytics = area.analytics || {};
  const isJudicial = area.key === 'judicial';

  return (
    <div className="space-y-5">
      {/* Download row */}
      <div className="flex justify-end text-[12px] text-[#8427cf]">
        <button type="button" className="inline-flex items-center gap-1 hover:underline">
          ↧ Download
        </button>
      </div>

      {/* Metrics row — 5 cards (judicial) or 4 cards (others) */}
      {isJudicial ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard icon={null} label="Total de processos" value={analytics.processCount} />
          <MetricCard icon={null} label="Processos como autor" value={analytics.asAuthor} />
          <MetricCard icon={null} label="Processos como réu" value={analytics.asDefendant} />
          <MetricCard icon={null} label="Processos como envolvido" value={analytics.asInvolved} />
          <MetricCard icon={null} label="Processos com segredo" value={analytics.withoutPole} />
        </div>
      ) : (
        <GenericStats area={area} />
      )}

      {/* Charts row — bar + 3 donuts */}
      {isJudicial && analytics.processCount > 0 && (
        <>
          <StatusBarChart data={analytics.statusChart} />
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <TribunalPieChart data={analytics.tribunalChart} />
            <SubjectsPieChart data={analytics.subjects} />
            {analytics.varaChart?.length > 0 && (
              <div className="border border-neutral-300 bg-white">
                <div className="bg-[#eee] px-3 py-2 text-[14px] font-medium">Vara dos Processos</div>
                <div className="p-4">
                  <ul className="space-y-1.5 text-[11px] text-neutral-700">
                    {analytics.varaChart.slice(0, 5).map((v, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="truncate">{v.label}</span>
                        <span className="font-bold tabular-nums text-[#8427cf]">{v.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {analytics.classeChart?.length > 0 && (
              <div className="border border-neutral-300 bg-white">
                <div className="bg-[#eee] px-3 py-2 text-[14px] font-medium">Classe de processos</div>
                <div className="p-4">
                  <ul className="space-y-1.5 text-[11px] text-neutral-700">
                    {analytics.classeChart.slice(0, 5).map((c, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="truncate">{c.label}</span>
                        <span className="font-bold tabular-nums text-[#8427cf]">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Source list */}
      {(area.sources || []).length > 0 && (
        <div className="overflow-hidden border border-neutral-200 bg-white">
          {(area.sources || []).map((source, idx) => (
            <SourceRow key={idx} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function DossierDetailPage() {
  const { dossierId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState('analitico');
  const [activeMacro, setActiveMacro] = useState('all');
  const [openSections, setOpenSections] = useState({});
  const [openSources, setOpenSources] = useState({});
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [judicialFilters, setJudicialFilters] = useState({ tribunal: [], status: [], participation: [], uf: '' });
  const [conclusionText, setConclusionText] = useState('');
  const [savingConclusion, setSavingConclusion] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');

  const { data: dossier, loading, error, refetch } = useDossier(dossierId);
  const { approve, reject, loading: mutationLoading } = useDossierMutations(dossierId);
  const { comments, addComment } = useComments({ caseId: dossierId });

  // Build unified macro areas from backend data
  const macroAreas = useMemo(() => {
    if (!dossier) return [];
    return buildMacroAreas(dossier);
  }, [dossier]);

  // Compute source lists for side panel
  const allSources = useMemo(() => macroAreas.flatMap((a) => a.sources || []), [macroAreas]);
  const sourcesWithResults = useMemo(() => allSources.filter((s) => s.status === 'has_result'), [allSources]);
  const sourcesWithoutResults = useMemo(() => allSources.filter((s) => s.status !== 'has_result'), [allSources]);

  // Filter visible macro areas
  const visibleMacroAreas = useMemo(() => {
    if (activeMacro === 'all') return macroAreas;
    return macroAreas.filter((m) => m.key === activeMacro);
  }, [macroAreas, activeMacro]);

  // Filter judicial processes if filters active
  const filteredMacroAreas = useMemo(() => {
    if (activeMacro !== 'judicial' && activeMacro !== 'all') return visibleMacroAreas;
    const hasFilters = Object.values(judicialFilters).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
    if (!hasFilters) return visibleMacroAreas;

    return visibleMacroAreas.map((area) => {
      if (area.key !== 'judicial') return area;
      const filteredSources = area.sources.map((source) => {
        if (source.data?.type !== 'process_list') return source;
        const filteredProcesses = (source.data.processes || []).filter((proc) => {
          if (judicialFilters.tribunal?.length > 0) {
            // Map tribunal abbreviations
            const tribMap = { stf: 'STF', trf: 'TRF', tj: 'TJ', tre: 'TRE', trt: 'TRT', tjm: 'TJM', tjf: 'TJF' };
            const expected = judicialFilters.tribunal.map((t) => tribMap[t]).filter(Boolean);
            if (!expected.some((e) => proc.tribunal?.includes(e))) return false;
          }
          if (judicialFilters.status?.length > 0) {
            const statusMap = {
              em_tramitacao: 'Em tramitação',
              em_grau_recurso: 'Em grau de recurso',
              suspenso: 'Suspenso',
              arquivamento_definitivo: 'Arquivamento definitivo',
              arquivamento_provisorio: 'Arquivamento provisório',
              arquivado_administrativamente: 'Arquivado administrativamente',
              arquivamento: 'Arquivamento',
              julgado: 'Julgado',
              extinto: 'Extinto',
            };
            const expected = judicialFilters.status.map((s) => statusMap[s]).filter(Boolean);
            if (!expected.some((e) => proc.status?.toLowerCase().includes(e.toLowerCase()))) return false;
          }
          if (judicialFilters.uf && !proc.tribunal?.includes(`-${judicialFilters.uf}`)) {
            return false;
          }
          return true;
        });
        return {
          ...source,
          data: { ...source.data, processes: filteredProcesses },
        };
      });
      return { ...area, sources: filteredSources };
    });
  }, [visibleMacroAreas, judicialFilters, activeMacro]);

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function toggleSource(key) {
    setOpenSources((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleApprove() {
    try {
      await approve();
      toast.success('Análise aprovada com sucesso!');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Erro ao aprovar análise');
    }
  }
  async function handleReject() {
    const reason = window.prompt('Razão da reprovação:', 'Reprovado pelo analista');
    if (!reason) return;
    try {
      await reject(reason);
      toast.success('Análise reprovada.');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Erro ao reprovar análise');
    }
  }
  async function handleSaveConclusion() {
    try {
      setSavingConclusion(true);
      await patchDossier(dossierId, { analysis: { conclusive: conclusionText } });
      toast.success('Conclusão salva.');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar conclusão');
    } finally {
      setSavingConclusion(false);
    }
  }

  async function handleRetrySource(sourceKey) {
    try {
      await retrySource(dossierId, sourceKey);
      toast.success('Reprocessamento solicitado. Aguarde atualização.');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Erro ao reprocessar fonte');
    }
  }

  // Sync conclusion text with backend data
  useEffect(() => {
    if (dossier?.analysis?.conclusive) {
      setConclusionText(dossier.analysis.conclusive);
    }
  }, [dossier?.analysis?.conclusive]);

  async function handleSendComment() {
    const text = commentDraft.trim();
    if (!text) return;
    try {
      await addComment(text);
      setCommentDraft('');
    } catch (err) {
      toast.error(err.message || 'Erro ao enviar comentário');
    }
  }

  if (loading && !dossier) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-white">
          <div className="mx-auto max-w-[1820px] px-4 py-6 sm:px-6 lg:px-10">
            <LoadingState rows={6} columns={3} />
          </div>
        </main>
      </DossierLayout>
    );
  }

  if (error) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-white">
          <div className="mx-auto max-w-[1820px] px-4 py-6 sm:px-6 lg:px-10">
            <ErrorState title="Erro ao carregar análise" message={error.message} onRetry={refetch} />
          </div>
        </main>
      </DossierLayout>
    );
  }

  if (!dossier) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-white">
          <div className="mx-auto max-w-[1820px] px-4 py-6 sm:px-6 lg:px-10">
            <ErrorState title="Análise não encontrada" message="O ID informado não corresponde a nenhuma análise." />
          </div>
        </main>
      </DossierLayout>
    );
  }

  const showJudicialFilters = activeMacro === 'judicial' || activeMacro === 'all';

  return (
    <DossierLayout>
      <main className="min-h-screen bg-white pb-0">
        <div className="mx-auto max-w-[1820px] px-4 pt-5 sm:px-10">
          {/* Header — Lexi style: arrow + title + pill toggle | shortcut nav right */}
          <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <button
                type="button"
                onClick={() => navigate('/dossie')}
                className="text-neutral-500 transition hover:text-neutral-900"
                aria-label="Voltar para lista"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h1 className="text-[18px] font-bold tracking-[-0.02em] text-neutral-900">
                Dossiê {dossier.dossierNumber || dossierId}
              </h1>
              <div className="inline-flex rounded-full border border-[#8f31e6] bg-white p-[2px] text-[12px] font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode('analitico')}
                  className={cx(
                    'rounded-full px-5 py-1.5 sm:px-7 transition-all',
                    viewMode === 'analitico' ? 'bg-[#8f31e6] text-white' : 'text-neutral-700 hover:bg-purple-50'
                  )}
                >
                  Analítico
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('detalhado')}
                  className={cx(
                    'rounded-full px-5 py-1.5 sm:px-7 transition-all',
                    viewMode === 'detalhado' ? 'bg-[#8f31e6] text-white' : 'text-neutral-700 hover:bg-purple-50'
                  )}
                >
                  Detalhado
                </button>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-x-9 gap-y-3 text-[13px] font-bold text-[#8427cf]">
              <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-1 hover:underline">
                ↑ Início
              </button>
              <button type="button" onClick={() => setSidePanelOpen(true)} className="inline-flex items-center gap-2 hover:underline">
                <FileCheck className="h-4 w-4" />
                Fontes
              </button>
              <button type="button" className="inline-flex items-center gap-2 hover:underline">
                <MessageSquare className="h-4 w-4" />
                Análise e comentários
              </button>
              <button type="button" className="inline-flex items-center gap-2 hover:underline">
                <BarChart3 className="h-4 w-4" />
                Histórico
              </button>
              <button type="button" className="inline-flex items-center gap-2 hover:underline">
                <FileText className="h-4 w-4" />
                Exportar
              </button>
            </nav>
          </header>

          {/* Macro tab strip — horizontal underline */}
          <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 border-b-2 border-neutral-300 px-2 pb-3 text-[13px] sm:gap-x-12 sm:px-4">
            <button
              type="button"
              onClick={() => setActiveMacro('all')}
              className={cx(
                'inline-flex items-center gap-2 transition hover:text-[#8427cf]',
                activeMacro === 'all' ? 'font-bold text-[#8427cf]' : 'text-neutral-600'
              )}
            >
              Todos
            </button>
            {macroAreas.map((tab) => {
              const Icon = MACRO_ICONS[tab.icon];
              const isActive = activeMacro === tab.key;
              const muted = (tab.sourcesWithResults || 0) === 0 && (!tab.sources || tab.sources.length === 0);
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveMacro(tab.key)}
                  className={cx(
                    'inline-flex items-center gap-2 transition hover:text-[#8427cf]',
                    isActive ? 'font-bold text-[#8427cf]' : muted ? 'text-neutral-400' : 'text-neutral-600'
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {tab.title || tab.label}
                  {tab.sourcesWithResults > 0 && (
                    <span className="ml-1 rounded-full bg-[#8427cf] px-1.5 text-[10px] font-bold text-white">
                      {tab.sourcesWithResults}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Overview card */}
        <div className="mx-auto max-w-[1820px]">
          <DossierHeader dossier={dossier} />
        </div>

        <div className="mx-auto max-w-[1820px] px-4 sm:px-10">
          {/* Main content with optional judicial filters */}
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-4">
            {showJudicialFilters && viewMode === 'analitico' && (
              <div className="lg:col-span-1">
                <JudicialFilters filters={judicialFilters} onChange={setJudicialFilters} />
              </div>
            )}

            <div className={showJudicialFilters && viewMode === 'analitico' ? 'lg:col-span-3' : 'lg:col-span-4'}>
              <div className="space-y-5">
                {viewMode === 'analitico' ? (
                  filteredMacroAreas.map((area) => {
                    const isOpen = openSections[area.key] !== false;
                    const Icon = MACRO_ICONS[area.icon];
                    return (
                      <section key={area.key} className="rounded border border-neutral-300 bg-white">
                        <button
                          type="button"
                          onClick={() => toggleSection(area.key)}
                          className="flex w-full items-center justify-between border-b border-[#b878f0] bg-[#f3f3f3] px-4 py-2.5 text-[#8427cf] transition hover:bg-[#ede5f4]"
                        >
                          <div className="flex items-center gap-2 text-[14px] font-semibold">
                            {Icon && <Icon className="h-4 w-4" />}
                            {area.title || area.label}
                          </div>
                          <div className="flex items-center gap-3 text-neutral-500">
                            {area.sourcesWithResults > 0 && (
                              <span className="text-[11px] font-semibold text-emerald-700">
                                {area.sourcesWithResults} fontes com resultados
                              </span>
                            )}
                            {isOpen ? <ChevronUp className="h-4 w-4 text-[#8427cf]" /> : <ChevronDown className="h-4 w-4 text-[#8427cf]" />}
                          </div>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: 'easeOut' }}
                              className="overflow-hidden"
                            >
                              <div className="grid grid-cols-[90px_1fr] gap-4 p-5 sm:grid-cols-[110px_1fr] sm:gap-6 sm:p-7">
                                <div className="text-center text-[46px] font-bold text-neutral-500 sm:text-[54px] tabular-nums">
                                  {area.sources?.length || 0}
                                </div>
                                <AnalyticsSection area={area} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </section>
                    );
                  })
                ) : (
                  filteredMacroAreas.map((area) => (
                    <section key={area.key} className="rounded border border-neutral-300 bg-white">
                      <header className="flex items-center justify-between border-b border-[#b878f0] bg-[#f3f3f3] px-4 py-2.5 text-[#8427cf]">
                        <div className="flex items-center gap-2 text-[14px] font-semibold">
                          {area.icon && MACRO_ICONS[area.icon] && (() => {
                            const Icon = MACRO_ICONS[area.icon];
                            return <Icon className="h-4 w-4" />;
                          })()}
                          {area.title || area.label}
                        </div>
                        {area.sourcesWithResults > 0 && (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            {area.sourcesWithResults} fontes com resultados
                          </span>
                        )}
                      </header>
                      <div className="space-y-5 p-3">
                        {(area.sources || []).map((source) => (
                          <SourceDetail
                            key={source.sourceKey}
                            source={source}
                            open={!!openSources[source.sourceKey]}
                            onToggle={() => toggleSource(source.sourceKey)}
                            onRetry={handleRetrySource}
                          />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer analysis section — Lexi style: gray bg with conclusion + comments */}
        <div className="mt-7 bg-[#eeeeee] py-7">
          <div className="mx-auto max-w-[1820px] space-y-5 px-4 sm:px-10">
            {/* Conclusion */}
            <section className="border border-neutral-300 bg-white">
              <header className="flex items-center justify-between bg-[#f4f4f4] px-4 py-2 text-[12px] font-semibold">
                <span className="inline-flex items-center gap-2 text-neutral-700">
                  <FileText className="h-4 w-4 text-neutral-500" />
                  Análise conclusiva do dossiê
                </span>
              </header>
              <div className="p-4">
                <div className="mb-1 text-[11px] text-neutral-500">Análise</div>
                <textarea
                  value={conclusionText}
                  onChange={(e) => setConclusionText(e.target.value)}
                  placeholder="Escreva sua análise aqui..."
                  rows={4}
                  className="w-full resize-y rounded border border-neutral-300 bg-white px-3 py-3 text-[13px] text-neutral-700 outline-none transition focus:border-[#8427cf] focus:ring-2 focus:ring-purple-100"
                />
                <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleSaveConclusion}
                    disabled={savingConclusion}
                    className="inline-flex items-center gap-2 rounded border border-neutral-300 bg-white px-4 py-2 text-[12px] font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {savingConclusion && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Salvar conclusão
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={mutationLoading}
                    className="inline-flex items-center gap-2 rounded bg-[#0d9f52] px-5 py-2 text-[12px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={mutationLoading}
                    className="inline-flex items-center gap-2 rounded bg-[#d94141] px-5 py-2 text-[12px] font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reprovar
                  </button>
                </div>
              </div>
            </section>

            {/* Comments */}
            <section className="border border-neutral-300 bg-white">
              <header className="flex items-center justify-between bg-[#f4f4f4] px-4 py-2 text-[12px] font-semibold">
                <span className="inline-flex items-center gap-2 text-neutral-700">
                  <MessageSquare className="h-4 w-4 text-neutral-500" />
                  Comentários finais
                </span>
              </header>
              <div className="p-4">
                {comments.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-[11px] font-bold text-neutral-700">{c.authorName || 'Analista'}</span>
                          <span className="text-[10px] text-neutral-400">{c.createdAt}</span>
                        </div>
                        <p className="text-[12px] text-neutral-600">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mb-1 text-[11px] text-neutral-500">Escreva um comentário</div>
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Digite aqui..."
                  rows={3}
                  className="w-full resize-y rounded border border-neutral-300 bg-white px-3 py-3 text-[13px] text-neutral-700 outline-none transition focus:border-[#8427cf] focus:ring-2 focus:ring-purple-100"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendComment();
                    }
                  }}
                />
                <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleSendComment}
                    disabled={!commentDraft.trim()}
                    className="inline-flex items-center gap-2 rounded bg-[#8427cf] px-5 py-2 text-[12px] font-bold text-white transition hover:bg-[#6e1fb0] active:scale-[0.97] disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer brand bar gradient */}
        <footer className="flex h-16 items-center justify-center bg-gradient-to-r from-[#ff8417] via-[#a44167] to-[#5f147f] text-[14px] font-bold text-white">
          ⌘ ComplianceHub®
        </footer>
      </main>

      {/* Side panel */}
      <SourcePanel
        open={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        withResults={sourcesWithResults}
        withoutResults={sourcesWithoutResults}
      />
    </DossierLayout>
  );
}
