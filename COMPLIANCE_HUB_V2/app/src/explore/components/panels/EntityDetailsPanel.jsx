import { memo, useState, useEffect } from 'react';
import { X, User, Building2, Gavel, MapPin, Printer, Download } from 'lucide-react';

const TYPE_META = {
  person: { icon: User, label: 'Pessoa Física', color: 'text-purple-600', bg: 'bg-purple-50', stripe: 'from-purple-600 to-purple-400' },
  company: { icon: Building2, label: 'Pessoa Jurídica', color: 'text-orange-600', bg: 'bg-orange-50', stripe: 'from-orange-500 to-amber-400' },
  process: { icon: Gavel, label: 'Processo Judicial', color: 'text-red-600', bg: 'bg-red-50', stripe: 'from-red-500 to-rose-400' },
  address: { icon: MapPin, label: 'Endereço', color: 'text-amber-600', bg: 'bg-amber-50', stripe: 'from-amber-500 to-yellow-400' },
};

const TABS_CONFIG = {
  person: [
    { key: 'register', label: 'Dados Cadastrais' },
    { key: 'relations', label: 'Vínculos' },
  ],
  company: [
    { key: 'register', label: 'Dados Cadastrais' },
    { key: 'partners', label: 'Sócios / Administradores' },
  ],
  process: [
    { key: 'register', label: 'Dados do Processo' },
    { key: 'movements', label: 'Movimentações' },
  ],
  address: [
    { key: 'register', label: 'Dados do Endereço' },
  ],
};

function EntityDetailsPanel({ node, onClose }) {
  const data = node?.data || {};
  const type = data.type || 'person';
  const tabs = TABS_CONFIG[type] || TABS_CONFIG.person;
  const [tab, setTab] = useState(tabs[0]?.key || 'register');

  // Reset to first tab when node type changes (avoids invalid tab state)
  useEffect(() => {
    setTab(tabs[0]?.key || 'register');
  }, [type, tabs]);

  if (!node) return null;

  const meta = TYPE_META[type] || TYPE_META.person;
  const Icon = meta.icon;

  return (
    <div className="flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.06)]">
      {/* Header stripe */}
      <div className={`h-1 bg-gradient-to-r ${meta.stripe}`} />

      {/* Close button */}
      <div className="flex items-center justify-end px-4 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={18} />
        </button>
      </div>

      {/* Node preview card */}
      <div className="mx-4 mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className={`mb-1.5 flex items-center gap-1.5`}>
          <Icon size={14} className={meta.color} />
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${meta.color}`}>
            {meta.label}
          </span>
        </div>
        <div className="truncate text-[15px] font-bold text-slate-900">{data.name || '—'}</div>
        <div className="mt-0.5 text-[12px] tabular-nums text-slate-500">{data.document || '—'}</div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2.5 text-[12px] font-semibold transition ${
              tab === t.key
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-4 py-3">
        <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-[12px] font-semibold text-purple-700 shadow-sm transition hover:bg-purple-50">
          <Printer size={14} /> Imprimir
        </button>
        <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-[12px] font-semibold text-purple-700 shadow-sm transition hover:bg-purple-50">
          <Download size={14} /> Baixar
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {tab === 'register' && (
          <div className="space-y-3">
            {data.fields && Object.keys(data.fields).length > 0 ? (
              Object.entries(data.fields).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-2 border-b border-slate-50 pb-2">
                  <span className="text-[11px] font-medium text-slate-400">{key}</span>
                  <span className="text-right text-[12px] font-semibold text-slate-800">{value}</span>
                </div>
              ))
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 border-b border-slate-50 pb-2">
                  <span className="text-[11px] font-medium text-slate-400">Documento</span>
                  <span className="text-right text-[12px] font-semibold text-slate-800">{data.document || '—'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 border-b border-slate-50 pb-2">
                  <span className="text-[11px] font-medium text-slate-400">Nome</span>
                  <span className="text-right text-[12px] font-semibold text-slate-800">{data.name || '—'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 border-b border-slate-50 pb-2">
                  <span className="text-[11px] font-medium text-slate-400">Tipo</span>
                  <span className="text-right text-[12px] font-semibold text-slate-800">{meta.label}</span>
                </div>
              </>
            )}
          </div>
        )}
        {(tab === 'partners' || tab === 'relations') && (
          <div className="space-y-2">
            {data.relations && data.relations.length > 0 ? (
              data.relations.map((rel, i) => (
                <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                  <div className="text-[12px] font-semibold text-slate-800">{rel.targetName}</div>
                  <div className="text-[11px] text-slate-500">{rel.type}</div>
                </div>
              ))
            ) : (
              <p className="text-[12px] text-slate-400">Nenhum vínculo cadastrado.</p>
            )}
          </div>
        )}
        {tab === 'movements' && (
          <div className="space-y-2">
            <p className="text-[12px] text-slate-400">Movimentações do processo serão exibidas aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(EntityDetailsPanel);
