import { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

function FilterGroup({ title, options, selected, onToggle, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-neutral-200 py-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-[12px] font-bold text-neutral-700"
      >
        {title}
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-neutral-400" />
          : <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
        }
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-col gap-1.5">
              {options.map((opt) => (
                <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[12px] text-[#8427cf] transition hover:bg-purple-50">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => onToggle(opt.value)}
                    className="h-3.5 w-3.5 rounded border-[#8427cf] text-[#8427cf] focus:ring-purple-100"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function JudicialFilters({ filters, onChange }) {
  const toggle = (key, value) => {
    const current = filters[key] || [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  const tribunalOptions = [
    { value: 'stf', label: 'Tribunais Superiores e Conselhos' },
    { value: 'trf', label: 'Tribunais Regionais Federais' },
    { value: 'tj', label: 'Tribunais de Justiça' },
    { value: 'tre', label: 'Tribunais Regionais Eleitorais' },
    { value: 'trt', label: 'Tribunais Regionais do Trabalho' },
    { value: 'tjm', label: 'Tribunais de Justiça Militar' },
    { value: 'tjf', label: 'Tribunais de Justiça Federal' },
  ];

  const statusOptions = [
    { value: 'em_tramitacao', label: 'Em tramitação' },
    { value: 'em_grau_recurso', label: 'Em grau de recurso' },
    { value: 'suspenso', label: 'Suspenso' },
    { value: 'arquivamento_definitivo', label: 'Arquivamento definitivo' },
    { value: 'arquivamento_provisorio', label: 'Arquivamento provisório' },
    { value: 'arquivado_administrativamente', label: 'Arquivado administrativamente' },
    { value: 'arquivamento', label: 'Arquivamento' },
    { value: 'julgado', label: 'Julgado' },
    { value: 'extinto', label: 'Extinto' },
  ];

  const participationOptions = [
    { value: 'autor', label: 'Autor' },
    { value: 'reu', label: 'Réu' },
    { value: 'envolvido', label: 'Envolvido' },
    { value: 'sem_polo', label: 'Sem Polo' },
  ];

  return (
    <aside className="space-y-3">
      <div className="flex items-center gap-2 text-[14px] font-bold text-neutral-800">
        <Filter className="h-4 w-4 text-[#8427cf]" />
        Filtros
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ tribunal: [], status: [], participation: [], uf: '' })}
          className="rounded border border-[#8427cf] px-4 py-1.5 text-[12px] font-semibold text-[#8427cf] transition hover:bg-purple-50"
        >
          Limpar filtros
        </button>
        <button
          type="button"
          className="rounded bg-[#8427cf] px-4 py-1.5 text-[12px] font-bold text-white transition hover:bg-[#6e1fb0]"
        >
          Filtrar
        </button>
      </div>

      <FilterGroup
        title="Tribunais"
        options={tribunalOptions}
        selected={filters.tribunal || []}
        onToggle={(v) => toggle('tribunal', v)}
      />
      <FilterGroup
        title="Status de processos"
        options={statusOptions}
        selected={filters.status || []}
        onToggle={(v) => toggle('status', v)}
      />
      <FilterGroup
        title="Participação no processos"
        options={participationOptions}
        selected={filters.participation || []}
        onToggle={(v) => toggle('participation', v)}
      />

      <div className="border-b border-neutral-200 py-3">
        <h4 className="mb-2 text-[12px] font-bold text-neutral-700">UF dos processos</h4>
        <select
          value={filters.uf || ''}
          onChange={(e) => onChange({ ...filters, uf: e.target.value })}
          className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-[11px] text-neutral-700 outline-none focus:border-[#8427cf]"
        >
          <option value="">Selecione a UF</option>
          {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => (
            <option key={uf} value={uf}>{uf}</option>
          ))}
        </select>
      </div>
    </aside>
  );
}
