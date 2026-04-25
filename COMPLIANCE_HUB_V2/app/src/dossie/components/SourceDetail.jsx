import { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, MessageSquare, Bookmark, Download, RefreshCw,
  Loader2, Info, FileText,
} from 'lucide-react';
import ProcessTable from './ProcessTable';

function cx(...parts) { return parts.filter(Boolean).join(' '); }

/* Solid status badges (Lexi style) */
function SourceStatusBadge({ status }) {
  if (status === 'has_result') {
    return <span className="inline-flex items-center rounded bg-[#0d9f52] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Com resultado</span>;
  }
  if (status === 'unavailable') {
    return <span className="inline-flex items-center rounded bg-[#d94141] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Indisponível</span>;
  }
  if (status === 'processing') {
    return <span className="inline-flex items-center rounded bg-[#5868f2] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Processando</span>;
  }
  return <span className="inline-flex items-center rounded bg-[#d98208] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Nenhum resultado</span>;
}

/* Lexi-style data table */
function DataTable({ headers, rows }) {
  if (!headers || !rows || rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <thead className="bg-[#eeeeee]">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 font-bold text-neutral-700 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-neutral-100">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cx(
                    'px-3 py-2 whitespace-nowrap',
                    cell === 'REGULAR' ? 'font-bold text-emerald-600' :
                    String(cell).includes('PDF') ? 'font-bold text-[#8427cf] cursor-pointer hover:underline' :
                    'text-neutral-700'
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Robust empty data table — shows headers with placeholder rows when no data yet */
function EmptyDataPlaceholder({ status, sourceTitle }) {
  if (status === 'unavailable') {
    return (
      <div className="border border-red-100 bg-red-50/40 px-4 py-3">
        <p className="text-[12px] text-red-700">
          <strong>Fonte temporariamente indisponível.</strong> A consulta a <em>{sourceTitle}</em> não pôde ser realizada.
          Você pode tentar reprocessar essa fonte mais tarde.
        </p>
      </div>
    );
  }
  if (status === 'processing') {
    return (
      <div className="flex items-center gap-2 border border-violet-100 bg-violet-50/40 px-4 py-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
        <p className="text-[12px] text-violet-700">Processando consulta...</p>
      </div>
    );
  }
  return (
    <div className="border border-neutral-200 bg-neutral-50/40 px-4 py-3">
      <p className="text-[12px] text-neutral-600">
        Nenhum resultado encontrado para esta fonte. Critério consultado não retornou registros.
      </p>
    </div>
  );
}

function downloadSourceData(source) {
  const payload = {
    fonte: source.title,
    sourceKey: source.sourceKey,
    status: source.status,
    consultaRealizadaEm: source.consultedAt,
    criterio: source.criteria,
    dados: source.data || null,
    exportadoEm: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fonte-${source.sourceKey || 'dados'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SourceDetail({ source, open, onToggle, onRetry }) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const data = source.data;

  async function handleRetry(e) {
    e.stopPropagation();
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry(source.sourceKey);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <article className="border border-neutral-200 bg-white">
      {/* Header — purple bottom border (Lexi) */}
      <div className="flex items-start justify-between gap-3 border-b border-[#b878f0] px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 text-[#8427cf] mt-0.5" />
            <div className="min-w-0">
              <span className="block text-[12px] font-semibold text-neutral-800">{source.title}</span>
              {source.consultedAt && (
                <span className="block text-[10px] text-neutral-500 mt-0.5">
                  Consulta realizada em {source.consultedAt}
                  {source.criteria && <> com o critério {source.criteria}</>}
                </span>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <SourceStatusBadge status={source.status} />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); downloadSourceData(source); }}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            title="Download JSON"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
            className={cx('rounded p-1 hover:bg-neutral-100', showComments ? 'text-[#8427cf]' : 'text-neutral-500 hover:text-neutral-700')}
            title="Comentários"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setBookmarked((v) => !v); }}
            className={cx('rounded p-1 hover:bg-neutral-100', bookmarked ? 'text-[#ff8500]' : 'text-neutral-500 hover:text-neutral-700')}
            title={bookmarked ? 'Remover marcador' : 'Marcar como relevante'}
          >
            <Bookmark className={cx('h-3.5 w-3.5', bookmarked && 'fill-current')} />
          </button>
          {onRetry && (source.status === 'unavailable' || source.status === 'no_result') && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
              title="Reprocessar"
            >
              {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="rounded p-1 text-[#8427cf] hover:bg-neutral-100"
            aria-label={open ? `Recolher ${source.title}` : `Expandir ${source.title}`}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {/* Section label "Informações" */}
            {(data?.type === 'table' || data?.type === 'process_list') && (
              <div className="border-b border-neutral-100 bg-neutral-50/60 px-3 py-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">Informações</span>
              </div>
            )}

            {/* Data table */}
            {data?.type === 'table' && (
              <>
                <DataTable headers={data.headers} rows={data.rows} />
                {data.extraTables?.map((et, i) => (
                  <DataTable key={i} headers={et.headers} rows={et.rows} />
                ))}
              </>
            )}

            {/* Process list */}
            {data?.type === 'process_list' && (
              <div className="p-3">
                <ProcessTable processes={data.processes} />
              </div>
            )}

            {/* Paragraph (consulta certificate) */}
            {data?.paragraph && (
              <div className="border-t border-neutral-100 px-4 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">Consulta</span>
                </div>
                <p className="text-[12px] leading-relaxed text-neutral-700">{data.paragraph}</p>
              </div>
            )}

            {/* Empty placeholders */}
            {!data && (
              <EmptyDataPlaceholder status={source.status} sourceTitle={source.title} />
            )}

            {/* Comments — always present, collapsed by default */}
            <div className="border-t border-neutral-100 bg-neutral-50/30 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-600">Comentários finais</span>
                <button
                  type="button"
                  onClick={() => setShowComments(!showComments)}
                  className="text-[11px] font-bold text-[#8427cf] hover:underline"
                >
                  {showComments ? 'Fechar' : 'Adicionar +'}
                </button>
              </div>
              {!showComments && (!source.comments || source.comments.length === 0) && (
                <p className="mt-2 text-[11px] text-neutral-400">Sem comentários até o momento.</p>
              )}
              {source.comments?.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {source.comments.map((c, i) => (
                    <div key={i} className="rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] text-neutral-600">
                      {c.text}
                    </div>
                  ))}
                </div>
              )}
              <AnimatePresence>
                {showComments && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Digite seu comentário..."
                      rows={2}
                      className="mt-2 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-[12px] text-neutral-700 outline-none focus:border-[#8427cf] focus:ring-2 focus:ring-purple-100"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => { setNewComment(''); setShowComments(false); }}
                        className="rounded border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNewComment(''); setShowComments(false); }}
                        disabled={!newComment.trim()}
                        className="rounded bg-[#8427cf] px-3 py-1 text-[11px] font-bold text-white transition hover:bg-[#6e1fb0] disabled:opacity-40"
                      >
                        Enviar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
