import { useState, useMemo } from 'react';

import { useNavigate } from 'react-router-dom';

// eslint-disable-next-line no-unused-vars

import { motion, AnimatePresence } from 'framer-motion';

import {

  FileSearch, ShieldCheck, Briefcase, Globe, UserCheck,

  Building2, Monitor, FileText, ChevronRight, Clock,

  CheckCircle2, X

} from 'lucide-react';

import { useTenant } from '../../core/contexts/useTenant';

import DossierLayout from '../../dossie/layouts/DossierLayout';

import PRODUCT_PIPELINES from '../../core/productPipelines';



const FAMILY_META = {

  dossie: { label: 'Dossiê', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: FileSearch },

  compliance: { label: 'Compliance', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ShieldCheck },

  third_party: { label: 'Terceiros', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Briefcase },

  risk: { label: 'Risco', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: Globe },

  monitoring: { label: 'Monitoramento', color: 'bg-violet-50 text-violet-700 border-violet-200', icon: Monitor },

  output: { label: 'Relatório', color: 'bg-slate-50 text-slate-700 border-slate-200', icon: FileText },

};



const PRODUCT_ICON = {

  dossier_pf_basic: UserCheck,

  dossier_pf_full: UserCheck,

  dossier_pj: Building2,

  kyc_individual: ShieldCheck,

  kyb_business: Building2,

  kye_employee: UserCheck,

  kys_supplier: Building2,

  tpr_third_party: Briefcase,

  reputational_risk: Globe,

  ongoing_monitoring: Monitor,

  report_secure: FileText,

};



function ProductCard({ productKey, config }) {

  const navigate = useNavigate();

  const familyMeta = FAMILY_META[config.family] || FAMILY_META.dossie;

  const Icon = PRODUCT_ICON[productKey] || familyMeta.icon;

  const [showDetail, setShowDetail] = useState(false);



  return (

    <motion.div

      layout

      initial={{ opacity: 0, y: 12 }}

      animate={{ opacity: 1, y: 0 }}

      transition={{ duration: 0.22 }}

      className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-gray-300"

    >

      <div className="mb-3 flex items-start justify-between">

        <div

          className="flex h-10 w-10 items-center justify-center rounded-lg"

          style={{ background: config.color || '#2563eb' }}

        >

          <Icon className="h-5 w-5 text-white" />

        </div>

        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${familyMeta.color}`}>

          {familyMeta.label}

        </span>

      </div>



      <h3 className="mb-1 text-[15px] font-bold text-gray-900">

        {config.intro?.title || productKey}

      </h3>

      <p className="mb-4 line-clamp-2 text-[13px] leading-relaxed text-gray-500">

        {config.intro?.description || ''}

      </p>



      {config.intro?.features && (

        <ul className="mb-4 flex flex-col gap-1.5">

          {config.intro.features.slice(0, 3).map((f, i) => (

            <li key={i} className="flex items-center gap-2 text-[12px] text-gray-600">

              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />

              <span className="truncate">{f.label}</span>

            </li>

          ))}

        </ul>

      )}



      <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4">

        <div className="flex items-center gap-1.5 text-[12px] text-gray-400">

          <Clock className="h-3.5 w-3.5" />

          <span>{config.intro?.estimatedTime || '—'}</span>

        </div>

        <div className="flex items-center gap-2">

          <button

            type="button"

            onClick={() => setShowDetail(true)}

            className="text-[12px] font-medium text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"

          >

            Ver detalhes

          </button>

          <button

            type="button"

            onClick={() => navigate(`/analyse/${productKey}`)}

            className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3.5 py-2 text-[12px] font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.97]"

          >

            Iniciar

            <ChevronRight className="h-3.5 w-3.5" />

          </button>

        </div>

      </div>



      <AnimatePresence>

        {showDetail && (

          <motion.div

            initial={{ opacity: 0 }}

            animate={{ opacity: 1 }}

            exit={{ opacity: 0 }}

            className="absolute inset-0 z-10 flex flex-col rounded-xl bg-white/95 p-5 backdrop-blur-sm"

          >

            <div className="mb-3 flex items-center justify-between">

              <h4 className="text-sm font-bold text-gray-900">{config.intro?.title}</h4>

              <button

                type="button"

                onClick={() => setShowDetail(false)}

                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"

              >

                <X className="h-4 w-4" />

              </button>

            </div>

            <p className="mb-3 text-[12px] leading-relaxed text-gray-600">

              {config.intro?.description}

            </p>

            {config.modules && (

              <div className="mb-3">

                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">

                  Módulos incluídos

                </span>

                <div className="flex flex-wrap gap-1.5">

                  {config.modules.map((m) => (

                    <span

                      key={m}

                      className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700"

                    >

                      {m}

                    </span>

                  ))}

                </div>

              </div>

            )}

            <div className="mt-auto">

              <button

                type="button"

                onClick={() => navigate(`/analyse/${productKey}`)}

                className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.97]"

              >

                Iniciar análise

              </button>

            </div>

          </motion.div>

        )}

      </AnimatePresence>

    </motion.div>

  );

}



export default function ProductHubPage() {

  const { tenant } = useTenant();

  const [filterFamily, setFilterFamily] = useState('');

  const [search, setSearch] = useState('');



  const families = useMemo(() => {

    const set = new Set(Object.values(PRODUCT_PIPELINES).map((p) => p.family));

    return ['', ...Array.from(set)];

  }, []);



  const products = useMemo(() => {

    const entries = Object.entries(PRODUCT_PIPELINES);

    return entries.filter(([key, config]) => {

      if (filterFamily && config.family !== filterFamily) return false;

      if (search) {

        const q = search.toLowerCase();

        const title = (config.intro?.title || key).toLowerCase();

        const desc = (config.intro?.description || '').toLowerCase();

        return title.includes(q) || desc.includes(q);

      }

      return true;

    });

  }, [filterFamily, search]);



  return (

    <DossierLayout>

      <main className="min-h-screen bg-gray-50/50">

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          {/* Header */}

          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-400">

                Cliente

              </span>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">Centro de Produtos</h1>

              <p className="mt-1 text-[14px] text-gray-500">
                Selecione uma análise para iniciar · {tenant?.name || 'Cliente'}
              </p>

            </div>

          </div>



          {/* Filters */}

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">

            <div className="relative flex-1">

              <input

                type="text"

                value={search}

                onChange={(e) => setSearch(e.target.value)}

                placeholder="Pesquisar produto..."

                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-[13px] text-gray-700 shadow-sm outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-purple-100"

              />

              <FileSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">

              {families.map((f) => {

                const active = filterFamily === f;

                const meta = f ? FAMILY_META[f] : null;

                return (

                  <button

                    key={f || 'all'}

                    type="button"

                    onClick={() => setFilterFamily(f)}

                    className={`whitespace-nowrap rounded-lg border px-3.5 py-2 text-[12px] font-semibold transition ${
                      active
                        ? 'border-transparent bg-brand-500 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}

                  >

                    {f ? meta?.label || f : 'Todos'}

                  </button>

                );

              })}

            </div>

          </div>



          {/* Grid */}

          {products.length === 0 ? (

            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20">

              <FileSearch className="mb-3 h-10 w-10 text-gray-300" />

              <p className="text-[14px] font-medium text-gray-500">Nenhum produto encontrado</p>

              <p className="text-[12px] text-gray-400">Tente ajustar os filtros de busca</p>

            </div>

          ) : (

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

              {products.map(([key, config]) => (

                <ProductCard key={key} productKey={key} config={config} />

              ))}

            </div>

          )}

        </div>

      </main>

    </DossierLayout>

  );

}

