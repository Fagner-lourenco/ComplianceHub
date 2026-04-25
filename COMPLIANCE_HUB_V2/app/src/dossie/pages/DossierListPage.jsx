import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Calendar, X, Search, Sliders, HelpCircle, Settings, Download,
  ChevronDown, MessageCircle, FileText, RefreshCw, Loader2, Check,
} from 'lucide-react';
import DossierLayout from '../layouts/DossierLayout';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
import { useDossierList } from '../hooks/useDossierList';

const STATUS_OPTIONS = [
  { value: '', label: 'Selecione o status' },
  { value: 'READY', label: 'Concluído' },
  { value: 'PUBLISHED', label: 'Publicado' },
  { value: 'PROCESSING', label: 'Processando' },
  { value: 'QUEUED', label: 'Na fila' },
  { value: 'ERROR', label: 'Com exceções' },
  { value: 'FAILED', label: 'Falhou' },
];

/* Lexi-style status pills — solid color background + white text */
function StatusPill({ status }) {
  if (!status || status === 'CREATED') {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-neutral-700">
        Iniciar
        <span className="text-[#8427cf]">▷</span>
      </span>
    );
  }
  if (status === 'QUEUED') {
    return (
      <span className="inline-flex items-center rounded bg-neutral-200 px-3 py-0.5 text-[11px] font-bold text-neutral-700">
        Na fila
      </span>
    );
  }
  if (status === 'PROCESSING') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-[#ff8417] px-3 py-0.5 text-[11px] font-bold text-white">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processando
      </span>
    );
  }
  if (status === 'READY' || status === 'PUBLISHED') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-[#0d9f52] px-3 py-0.5 text-[11px] font-bold text-white">
        <Check className="h-3 w-3" />
        Concluído
      </span>
    );
  }
  if (status === 'ERROR' || status === 'FAILED') {
    return (
      <span className="inline-flex items-center rounded bg-[#d98208] px-3 py-0.5 text-[11px] font-bold text-white">
        Com exceções
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-neutral-200 px-3 py-0.5 text-[11px] font-bold text-neutral-700">
      {status}
    </span>
  );
}

function ProgressIndicator({ value }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[12px] font-semibold text-neutral-700 tabular-nums">{pct}%</span>
      <HelpCircle className="h-3 w-3 text-neutral-300" />
    </div>
  );
}

function ToggleOff({ on }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-400">
      <span className={`inline-block h-3.5 w-7 rounded-full p-0.5 transition ${on ? 'bg-[#0d9f52]' : 'bg-neutral-300'}`}>
        <span className={`block h-2.5 w-2.5 rounded-full bg-white transition ${on ? 'translate-x-3' : 'translate-x-0'}`} />
      </span>
      {on ? 'on' : 'off'}
    </span>
  );
}

export default function DossierListPage() {
  const navigate = useNavigate();
  const [filterPeriodStart, setFilterPeriodStart] = useState('');
  const [filterPeriodEnd, setFilterPeriodEnd] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const { rows, loading, error, refetch } = useDossierList();

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    return rows.filter((row) => {
      if (filterResponsible && !(row.analystName || '').toLowerCase().includes(filterResponsible.toLowerCase()))
        return false;
      if (filterStatus && row.status !== filterStatus) return false;
      if (filterPeriodStart || filterPeriodEnd) {
        const created = row.createdAtIso || row.createdAt;
        const ts = created ? new Date(created).getTime() : NaN;
        if (Number.isNaN(ts)) return false;
        if (filterPeriodStart && ts < new Date(filterPeriodStart).getTime()) return false;
        if (filterPeriodEnd && ts > new Date(filterPeriodEnd).getTime() + 86_399_000) return false;
      }
      return true;
    });
  }, [rows, filterResponsible, filterStatus, filterPeriodStart, filterPeriodEnd]);

  const hasFilters = filterPeriodStart || filterPeriodEnd || filterResponsible || filterStatus;
  const allSelected = filteredRows.length > 0 && selectedRows.size === filteredRows.length;

  const clearFilters = () => {
    setFilterPeriodStart('');
    setFilterPeriodEnd('');
    setFilterResponsible('');
    setFilterStatus('');
  };

  const toggleRow = (id) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelectedRows(new Set());
    else setSelectedRows(new Set(filteredRows.map((r) => r.id)));
  };

  return (
    <DossierLayout>
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1820px] px-6 py-8 sm:px-10">
          {/* Header */}
          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[29px] font-bold tracking-[-0.02em] text-neutral-900">Dossiês</h1>
              <p className="mt-1 text-[13px] text-neutral-500">
                {filteredRows.length} {filteredRows.length === 1 ? 'análise' : 'análises'}
                {hasFilters ? ` (filtrando ${rows?.length || 0})` : ''}
              </p>
            </div>

            <div className="flex flex-col items-end gap-4">
              <div className="flex items-center gap-4 text-[13px] text-neutral-600">
                <button type="button" className="inline-flex items-center gap-1 hover:text-neutral-900">
                  Perguntas frequentes
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
                <button type="button" className="text-[12px] font-semibold uppercase text-neutral-500 hover:text-neutral-900">csv</button>
                <button type="button" className="rounded p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Configurações">
                  <Settings className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => refetch()} className="rounded p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Atualizar" title="Atualizar">
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button type="button" className="rounded p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Exportar">
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dossie/create')}
                  className="inline-flex items-center gap-2 rounded-md border-2 border-[#9e38e8] px-6 py-2.5 text-[14px] font-bold text-[#8427cf] transition hover:bg-purple-50"
                >
                  <Plus className="h-4 w-4" />
                  Criar novo dossiê
                </button>
              </div>
            </div>
          </div>

          {/* Filters - INLINE NO CARD */}
          <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-neutral-500">Período</label>
              <div className="flex items-center gap-1 rounded border border-neutral-300 bg-white px-3 py-2 shadow-sm">
                <input
                  type="date"
                  value={filterPeriodStart}
                  onChange={(e) => setFilterPeriodStart(e.target.value)}
                  className="w-[120px] bg-transparent text-[13px] text-neutral-700 outline-none"
                />
                <span className="text-neutral-400">até</span>
                <input
                  type="date"
                  value={filterPeriodEnd}
                  onChange={(e) => setFilterPeriodEnd(e.target.value)}
                  className="w-[120px] bg-transparent text-[13px] text-neutral-700 outline-none"
                />
                <Calendar className="ml-1 h-4 w-4 text-neutral-400" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-neutral-500">Responsável</label>
              <div className="flex items-center gap-1 rounded border border-neutral-300 bg-white px-3 py-2 shadow-sm">
                <input
                  type="text"
                  value={filterResponsible}
                  onChange={(e) => setFilterResponsible(e.target.value)}
                  placeholder="FAGNER LOUREN..."
                  className="w-[180px] bg-transparent text-[13px] text-neutral-700 placeholder:text-neutral-400 outline-none"
                />
                {filterResponsible && (
                  <button
                    type="button"
                    onClick={() => setFilterResponsible('')}
                    className="text-neutral-400 hover:text-neutral-600"
                    aria-label="Limpar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <ChevronDown className="ml-1 h-4 w-4 text-neutral-400" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-neutral-500">Status</label>
              <div className="relative flex items-center rounded border border-neutral-300 bg-white shadow-sm">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-[200px] appearance-none bg-transparent px-3 py-2 pr-9 text-[13px] text-neutral-700 outline-none"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-neutral-400" />
              </div>
            </div>

            <button
              type="button"
              className="mb-1 inline-flex items-center gap-1 text-[14px] font-bold text-[#8427cf] hover:underline"
              title="Filtros avançados"
            >
              <Sliders className="h-3.5 w-3.5" />
              + Filtros
            </button>

            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="inline-flex items-center rounded-md border-2 border-[#9e38e8] px-6 py-2 text-[13px] font-bold text-[#8427cf] transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center rounded-md bg-[#8427cf] px-6 py-2 text-[13px] font-bold text-white transition hover:bg-[#6e1fb0] active:scale-[0.98]"
              >
                Buscar
              </button>
            </div>
          </div>

          {/* Content */}
          {loading && <LoadingState rows={5} columns={11} />}

          {error && (
            <ErrorState
              title="Erro ao carregar análises"
              message={error.message || 'Não foi possível carregar a listagem.'}
              onRetry={refetch}
            />
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded border border-dashed border-neutral-200 bg-white py-20">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-300">
                <FileText className="h-8 w-8" />
              </div>
              <p className="text-[15px] font-semibold text-neutral-700">Você ainda não possui nenhum dossiê criado</p>
              <p className="mt-1 text-[13px] text-neutral-500">Comece criando sua primeira análise.</p>
              <button
                type="button"
                onClick={() => navigate('/dossie/create')}
                className="mt-4 inline-flex items-center gap-2 rounded-md border-2 border-[#9e38e8] px-5 py-2.5 text-[13px] font-bold text-[#8427cf] transition hover:bg-purple-50"
              >
                <Plus className="h-4 w-4" />
                Criar novo dossiê
              </button>
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <section className="overflow-hidden border border-neutral-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-[#efefef] text-[12px] font-bold text-neutral-700">
                      <th className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          className="h-3.5 w-3.5 rounded border-neutral-400"
                        />
                      </th>
                      <th className="px-3 py-3 whitespace-nowrap">Nº dossiê</th>
                      <th className="px-3 py-3 whitespace-nowrap">Criação</th>
                      <th className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          Tag
                          <ChevronDown className="h-3 w-3" />
                        </span>
                      </th>
                      <th className="px-3 py-3 whitespace-nowrap">Critério</th>
                      <th className="px-3 py-3 w-8"><ChevronDown className="h-3 w-3 text-[#8427cf]" /></th>
                      <th className="px-3 py-3 whitespace-nowrap">Progresso</th>
                      <th className="px-3 py-3 whitespace-nowrap">Status</th>
                      <th className="px-3 py-3 whitespace-nowrap">Monitoria</th>
                      <th className="px-3 py-3 whitespace-nowrap">Workflow</th>
                      <th className="px-3 py-3 whitespace-nowrap">Score</th>
                      <th className="px-3 py-3 whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const isSelected = selectedRows.has(row.id);
                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-neutral-100 transition cursor-pointer ${isSelected ? 'bg-purple-50/40' : 'hover:bg-purple-50/20'}`}
                          onClick={() => navigate(`/dossie/${row.id}`)}
                        >
                          <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRow(row.id)}
                              className="h-3.5 w-3.5 rounded border-neutral-400"
                            />
                          </td>
                          <td className="px-3 py-3.5 text-neutral-800 tabular-nums">{row.id}</td>
                          <td className="px-3 py-3.5 text-neutral-700">{row.createdAt}</td>
                          <td className="px-3 py-3.5 text-neutral-500">{row.tag || '—'}</td>
                          <td className="px-3 py-3.5">
                            <span className="inline-flex items-center gap-2.5 text-neutral-800">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-bold text-neutral-500">
                                {(row.subjectName || '?').charAt(0).toUpperCase()}
                              </span>
                              <span className="font-medium">{row.criterion || row.subjectName || '—'}</span>
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-[#8427cf]">
                            <ChevronDown className="h-3 w-3" />
                          </td>
                          <td className="px-3 py-3.5">
                            <ProgressIndicator value={row.progress ?? 0} />
                          </td>
                          <td className="px-3 py-3.5">
                            <StatusPill status={row.status} />
                          </td>
                          <td className="px-3 py-3.5">
                            <ToggleOff on={row.monitoringEnabled} />
                          </td>
                          <td className="px-3 py-3.5 text-neutral-400">{row.workflow || '—'}</td>
                          <td className="px-3 py-3.5 text-[#8427cf] font-bold tabular-nums">{row.score || '—'}</td>
                          <td className="px-3 py-3.5">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); navigate(`/dossie/${row.id}`); }}
                              className="text-[12px] font-semibold text-[#8427cf] hover:underline"
                            >
                              Abrir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredRows.length === 0 && hasFilters && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Search className="mb-2 h-8 w-8 text-neutral-300" />
                  <p className="text-[13px] font-medium text-neutral-500">Nenhum resultado com os filtros atuais</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-2 text-[12px] font-semibold text-[#8427cf] hover:underline"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}

              {filteredRows.length > 0 && (
                <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-white px-4 py-3 text-[12px]">
                  <span className="text-neutral-500">Página</span>
                  <span className="rounded bg-[#8427cf] px-2.5 py-0.5 font-bold text-white">01</span>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {/* Floating chat button */}
      <button
        type="button"
        className="fixed bottom-8 right-8 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#ff8a00] text-white shadow-lg transition hover:scale-105 hover:bg-[#ff7a00]"
        title="Suporte"
        aria-label="Suporte"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </DossierLayout>
  );
}
