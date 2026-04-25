import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import {
  Loader2, ChevronLeft, RefreshCw, Check, ExternalLink, MessageCircle,
} from 'lucide-react';
import DossierLayout from '../layouts/DossierLayout';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
import { useDossier } from '../hooks/useDossier';
import { useToast } from '../../shared/hooks/useToast';

const TERMINAL_STATUSES = new Set(['READY', 'PUBLISHED', 'ERROR', 'FAILED']);
const ERROR_STATUSES = new Set(['ERROR', 'FAILED']);

function SourceStatusBadge({ status }) {
  if (status === 'completed' || status === 'ok') {
    return (
      <span className="inline-flex items-center rounded bg-[#0d9f52] px-2 py-0.5 text-[10px] font-bold text-white">
        Concluído
      </span>
    );
  }
  if (status === 'pending' || status === 'processing') {
    return (
      <span className="inline-flex items-center rounded bg-[#ff8417] px-2 py-0.5 text-[10px] font-bold text-white">
        Processando
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center rounded bg-[#d94141] px-2 py-0.5 text-[10px] font-bold text-white">
        Indisponível
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-neutral-300 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
      Aguardando
    </span>
  );
}

export default function DossierProcessingPage() {
  const { dossierId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: dossier, loading, error, refetch } = useDossier(dossierId, { poll: false });
  const errorToastedRef = useRef(false);
  const status = dossier?.status;
  const isTerminal = TERMINAL_STATUSES.has(status);

  useEffect(() => {
    if (isTerminal) return undefined;
    const interval = setInterval(() => { refetch({ silent: true }); }, 5000);
    return () => clearInterval(interval);
  }, [refetch, isTerminal]);

  useEffect(() => {
    if (status === 'READY' || status === 'PUBLISHED') {
      toast.success('Análise concluída!');
      navigate(`/dossie/${dossierId}`);
      return;
    }
    if (ERROR_STATUSES.has(status) && !errorToastedRef.current) {
      errorToastedRef.current = true;
      toast.error('Análise falhou. Verifique os detalhes.');
    }
  }, [status, dossierId, navigate, toast]);

  const moduleRuns = useMemo(() => {
    if (dossier?.moduleRuns) return dossier.moduleRuns;
    const sourceSectionsData = dossier?.sourceSections || [];
    return sourceSectionsData.flatMap((s) =>
      (s.rows || []).map((r) => ({
        id: r.source,
        moduleKey: r.source,
        label: r.label || r.source,
        status: r.status === 'ok' ? 'completed' : r.status === 'pending' ? 'pending' : 'error',
        progress: r.status === 'ok' ? 100 : r.status === 'pending' ? 0 : 50,
        errorMessage: r.error || null,
      }))
    );
  }, [dossier?.moduleRuns, dossier?.sourceSections]);

  if (loading && !dossier) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-white">
          <div className="mx-auto max-w-[1400px] px-10 py-8">
            <LoadingState rows={6} columns={2} />
          </div>
        </main>
      </DossierLayout>
    );
  }

  if (error) {
    return (
      <DossierLayout>
        <main className="min-h-screen bg-white">
          <div className="mx-auto max-w-[1400px] px-10 py-8">
            <ErrorState title="Erro ao carregar status" message={error.message} onRetry={refetch} />
          </div>
        </main>
      </DossierLayout>
    );
  }

  const completed = moduleRuns.filter((r) => r.status === 'completed').length;
  const errors = moduleRuns.filter((r) => r.status === 'error').length;
  const pending = moduleRuns.filter((r) => r.status === 'pending' || r.status === 'processing').length;
  const total = moduleRuns.length;
  const overallPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isError = ERROR_STATUSES.has(status);

  const subjectName = dossier?.subjectName || dossier?.fullName || '—';
  const subjectDoc = dossier?.cpfMasked || dossier?.cpf || dossier?.cnpjMasked || dossier?.cnpj || '—';
  const createdAt = dossier?.createdAt || '—';

  return (
    <DossierLayout>
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1400px] px-10 py-8">
          {/* Header */}
          <div className="mb-7 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(isError ? '/dossie' : '/dossie')}
                className="rounded border border-neutral-300 bg-white p-2 text-neutral-600 transition hover:bg-neutral-50"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div>
                <span className="text-[12px] font-semibold uppercase tracking-wider text-neutral-400">Processamento</span>
                <h1 className="text-[22px] font-bold tracking-[-0.02em] text-neutral-900">Dossiê {dossier?.dossierNumber || dossierId}</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded border-2 border-[#9e38e8] px-5 py-2 text-[13px] font-bold text-[#8427cf] transition hover:bg-purple-50"
            >
              <RefreshCw className="h-4 w-4" />
              Reprocessar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
            {/* Main - Subject + Progress */}
            <section>
              {/* Subject card */}
              <div className="border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div>
                    <div className="text-[14px] font-semibold text-neutral-700">{subjectDoc}</div>
                    <div className="mt-1 text-[12px] text-neutral-500">{subjectName}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Nº dossiê</div>
                    <div className="mt-1 text-[13px] font-semibold text-neutral-700 tabular-nums">{dossier?.dossierNumber || dossierId}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Criado em</div>
                    <div className="mt-1 text-[13px] font-semibold text-neutral-700">{createdAt}</div>
                  </div>
                </div>
              </div>

              {/* Overall progress */}
              <div className="mt-6 border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-[14px] font-bold text-neutral-700">Progresso geral</h2>
                    <p className="mt-0.5 text-[12px] text-neutral-500">
                      {completed} de {total} fontes concluídas
                    </p>
                  </div>
                  <div className="text-[36px] font-extrabold text-[#8427cf] tabular-nums leading-none">{overallPct}%</div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${overallPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-[#ff8417] via-[#a44167] to-[#5f147f]"
                    role="progressbar"
                    aria-valuenow={overallPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>

                {/* Counters */}
                {total > 0 && (
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                      <p className="text-[20px] font-bold text-emerald-700 tabular-nums">{completed}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Concluídas</p>
                    </div>
                    <div className="border border-orange-200 bg-orange-50/50 p-3 text-center">
                      <p className="text-[20px] font-bold text-orange-700 tabular-nums">{pending}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600">Em andamento</p>
                    </div>
                    <div className="border border-red-200 bg-red-50/50 p-3 text-center">
                      <p className="text-[20px] font-bold text-red-700 tabular-nums">{errors}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-red-600">Com exceções</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action when done */}
              {isTerminal && !isError && (
                <button
                  type="button"
                  onClick={() => navigate(`/dossie/${dossierId}`)}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded bg-[#8427cf] px-7 py-3 text-[15px] font-bold text-white transition hover:bg-[#6e1fb0] active:scale-[0.98]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver dossiê completo
                </button>
              )}
            </section>

            {/* Side panel - Source list (Lexi style) */}
            <aside className="border-l-4 border-[#ff8500] bg-white shadow-[-2px_0_8px_rgba(0,0,0,0.04)]">
              <div className="border-b border-neutral-200 px-5 py-4">
                <h3 className="text-[14px] font-bold text-neutral-900">Progresso por fonte</h3>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {moduleRuns.length} {moduleRuns.length === 1 ? 'fonte' : 'fontes'}
                </p>
              </div>

              <div className="max-h-[600px] overflow-y-auto px-3 py-2">
                {moduleRuns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="mb-2 h-8 w-8 animate-spin text-neutral-300" />
                    <p className="text-[12px] font-medium text-neutral-500">Aguardando início...</p>
                  </div>
                ) : (
                  moduleRuns.map((run) => (
                    <motion.div
                      key={run.id}
                      layout
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between gap-3 border-b border-neutral-100 px-2 py-2.5 text-[12px]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {run.status === 'completed' ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        ) : run.status === 'error' ? (
                          <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-red-500" />
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-orange-500" />
                        )}
                        <span className="truncate text-neutral-700">{run.label || run.moduleKey?.replace(/_/g, ' ')}</span>
                      </div>
                      <SourceStatusBadge status={run.status} />
                    </motion.div>
                  ))
                )}
              </div>

              <div className="border-t border-neutral-200 bg-neutral-50/40 px-5 py-3">
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Caso necessário, reprocesse até <strong className="text-neutral-700">5 vezes</strong> as fontes que estiverem com erro.{' '}
                  <a href="#" className="font-semibold text-[#8427cf] hover:underline">saiba em condições</a>
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Floating chat */}
      <button
        type="button"
        className="fixed bottom-8 right-8 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#ff8a00] text-white shadow-lg transition hover:scale-105"
        title="Suporte"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </DossierLayout>
  );
}
