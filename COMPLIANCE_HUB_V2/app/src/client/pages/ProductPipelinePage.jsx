import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useToast } from '../../shared/hooks/useToast';
import {
  ChevronLeft, Building2, ShieldCheck, Briefcase, Globe,
  Monitor, FileText, AlertCircle, CheckCircle2, Clock,
  User, Fingerprint, Search, ArrowRight, Loader2,
} from 'lucide-react';
import DossierLayout from '../../dossie/layouts/DossierLayout';
import PRODUCT_PIPELINES from '../../core/productPipelines';

/* ── formatters ── */
function fmtCpf(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function fmtCnpj(v) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
function valCpf(c) {
  const d = c.replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/(\d)\1{10}/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = 11 - (s % 11);
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = 11 - (s % 11);
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(d[10]);
}
function valCnpj(c) {
  const d = c.replace(/\D/g, '');
  if (d.length !== 14) return false;
  if (/(\d)\1{13}/.test(d)) return false;
  const w = (x) => {
    const W = x === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let s = 0;
    for (let i = 0; i < x; i++) s += parseInt(d[i]) * W[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return w(12) === parseInt(d[12]) && w(13) === parseInt(d[13]);
}

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const PRODUCT_ICON = {
  dossier_pf_basic: User,
  dossier_pf_full: User,
  dossier_pj: Building2,
  kyc_individual: ShieldCheck,
  kyb_business: Building2,
  kye_employee: User,
  kys_supplier: Building2,
  tpr_third_party: Briefcase,
  reputational_risk: Globe,
  ongoing_monitoring: Monitor,
  report_secure: FileText,
};

const MODULE_LABELS = {
  identity_pf: 'Identidade PF',
  identity_pj: 'Identidade PJ',
  criminal: 'Antecedentes Criminais',
  labor: 'Histórico Trabalhista',
  warrants: 'Mandados de Prisão',
  kyc: 'KYC / Listas Restritivas',
  osint: 'OSINT / Mídia',
  social: 'Redes Sociais',
  digital: 'Perfil Digital',
  judicial: 'Processos Judiciais',
  relationship: 'Vínculos e Relacionamentos',
  ongoing_monitoring: 'Monitoramento Contínuo',
  decision: 'Decisão e Parecer',
  report_secure: 'Relatório Seguro',
};

export default function ProductPipelinePage() {
  const { productKey } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const config = PRODUCT_PIPELINES[productKey] || PRODUCT_PIPELINES.dossier_pf_basic;
  const Icon = PRODUCT_ICON[productKey] || User;

  const [form, setForm] = useState(() => {
    const init = {};
    (config.subjectFields || []).forEach((f) => { init[f.name] = ''; });
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const fields = config.subjectFields || [];
  const requiredFields = fields.filter((f) => f.required !== false);
  const optionalFields = fields.filter((f) => f.required === false);
  const modules = config.modules || [];

  const canSubmit = useMemo(() => {
    return requiredFields.every((f) => {
      const v = form[f.name] || '';
      if (!v.trim()) return false;
      if (f.type === 'cpf') return valCpf(v);
      if (f.type === 'cnpj') return valCnpj(v);
      return true;
    });
  }, [form, requiredFields]);

  const handleChange = (name, value, type) => {
    let formatted = value;
    if (type === 'cpf') formatted = fmtCpf(value);
    if (type === 'cnpj') formatted = fmtCnpj(value);
    setForm((prev) => ({ ...prev, [name]: formatted }));
  };

  const docValid = (field) => {
    const v = form[field.name] || '';
    if (field.type === 'cpf') return valCpf(v);
    if (field.type === 'cnpj') return valCnpj(v);
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const functions = getFunctions();
      const createSolicitation = httpsCallable(functions, 'createClientSolicitation');
      const payload = { productKey, requestedModuleKeys: modules, ...form };
      const result = await createSolicitation(payload);
      const caseId = result.data?.caseId;
      if (!caseId) {
        const msg = 'Solicitação criada mas sem ID retornado. Verifique no histórico.';
        setError(msg);
        toast.warning(msg);
        navigate('/dossie');
        return;
      }
      toast.success('Consulta iniciada! Buscando nas fontes selecionadas...');
      navigate(`/dossie/${caseId}/processing`);
    } catch (err) {
      const msg = err.message || 'Erro ao criar solicitação.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DossierLayout>
      <main className="min-h-screen bg-surface-muted">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <button
              type="button"
              onClick={() => navigate('/hub')}
              className="mb-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-500 hover:text-brand-700 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Voltar para Hub de Produtos
            </button>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg">
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">{config.intro?.title || productKey}</h1>
                <p className="mt-0.5 text-[13px] text-text-secondary">{config.intro?.description || ''}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Subject data card */}
            <div className="rounded-2xl border border-border-default bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-[14px] font-bold uppercase tracking-wide text-text-secondary">
                <Fingerprint className="h-4 w-4" />
                Dados do Consultado
              </h2>

              {/* Required fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {requiredFields.map((field) => {
                  const invalid = form[field.name] && !docValid(field);
                  return (
                    <label key={field.name} className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-bold text-text-secondary">
                        {field.label}
                        <span className="text-red-500"> *</span>
                      </span>
                      <div className="relative">
                        <input
                          type={field.type === 'date' ? 'date' : 'text'}
                          inputMode={field.type === 'cpf' || field.type === 'cnpj' ? 'numeric' : undefined}
                          value={form[field.name] || ''}
                          onChange={(e) => handleChange(field.name, e.target.value, field.type)}
                          placeholder={field.placeholder || field.label}
                          className={cx(
                            'h-12 w-full rounded-xl border bg-white px-4 text-[14px] text-text-primary shadow-sm outline-none transition',
                            invalid
                              ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                              : 'border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-purple-100'
                          )}
                        />
                        {form[field.name] && docValid(field) && (field.type === 'cpf' || field.type === 'cnpj') && (
                          <CheckCircle2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500" />
                        )}
                      </div>
                      {invalid && (
                        <span className="text-[11px] text-red-500">
                          {field.type === 'cpf' ? 'CPF inválido.' : field.type === 'cnpj' ? 'CNPJ inválido.' : 'Campo obrigatório.'}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>

              {/* Optional fields */}
              {optionalFields.length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {optionalFields.map((field) => (
                    <label key={field.name} className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-bold text-text-secondary">
                        {field.label}
                        <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 normal-case">opcional</span>
                      </span>
                      <input
                        type={field.type === 'date' ? 'date' : 'text'}
                        inputMode={field.type === 'cpf' || field.type === 'cnpj' ? 'numeric' : undefined}
                        value={form[field.name] || ''}
                        onChange={(e) => handleChange(field.name, e.target.value, field.type)}
                        placeholder={field.placeholder || field.label}
                        className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-[14px] text-text-primary shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-purple-100"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Modules card */}
            {modules.length > 0 && (
              <div className="rounded-2xl border border-border-default bg-white p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-[14px] font-bold uppercase tracking-wide text-text-secondary">
                  <Search className="h-4 w-4" />
                  Módulos Consultados
                  <span className="ml-1 text-[11px] font-normal normal-case text-gray-400">({modules.length} fontes)</span>
                </h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {modules.map((m) => (
                    <div key={m} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[13px] text-text-secondary">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-500" />
                      {MODULE_LABELS[m] || m}
                    </div>
                  ))}
                </div>
                {config.intro?.estimatedTime && (
                  <div className="mt-4 flex items-center gap-2 text-[12px] text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    Tempo estimado: <strong className="text-text-primary">{config.intro.estimatedTime}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <strong>Erro:</strong> {error}
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={cx(
                'flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white shadow-lg transition',
                canSubmit && !submitting
                  ? 'bg-brand-500 hover:bg-brand-600 active:scale-[0.98] shadow-purple-200'
                  : 'cursor-not-allowed bg-gray-300'
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Iniciando consulta...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  Consultar em {modules.length} fontes
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </DossierLayout>
  );
}
