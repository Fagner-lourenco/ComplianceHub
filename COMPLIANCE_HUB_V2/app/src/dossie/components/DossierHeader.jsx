import { ArrowUpRight } from 'lucide-react';

function InfoCell({ label, value, link }) {
  return (
    <div>
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-neutral-700 tabular-nums">
        {value}
        {link && <ArrowUpRight className="h-3 w-3 text-[#8427cf]" />}
      </div>
    </div>
  );
}

function CapTile({ text, active }) {
  return (
    <div
      className={`flex min-h-[68px] items-center justify-center rounded px-3 text-center text-[11px] leading-tight ${
        active ? 'bg-[#8427cf] text-white' : 'bg-[#f1f1f1] text-neutral-600'
      }`}
    >
      {text}
    </div>
  );
}

/**
 * Lexi-style overview card:
 *   - Outer light gray section padding
 *   - Inner white card with 3 columns: subject | metadata grid | capability tiles
 */
export default function DossierHeader({ dossier }) {
  if (!dossier) return null;

  const subjectName = dossier.subjectName || dossier.fullName || dossier.candidateName || '—';
  const subjectDoc = dossier.cpfMasked || dossier.cpf || dossier.cnpjMasked || dossier.cnpj || dossier.document || '—';
  const age = dossier.age;
  const number = dossier.dossierNumber || dossier.id || '—';
  const createdAt = dossier.createdAt || '—';
  const lastRun = dossier.lastRunAt || dossier.lastProcessedAt || createdAt;
  const preset = dossier.presetTitle || dossier.presetKey || 'Compliance';
  const analyst = dossier.analystName || dossier.createdByName || '—';
  const homonyms = dossier.homonyms || 'Único';
  const withResults = dossier.sourcesWithResults ?? dossier.progressDetail?.withFindings ?? 0;
  const withoutResults = dossier.sourcesWithoutResults ?? (
    dossier.progressDetail
      ? Math.max(0, (dossier.progressDetail.totalSources || 0) - (dossier.progressDetail.withFindings || 0))
      : 0
  );

  const capabilities = [
    { text: 'upFlag não habilitado', active: !!dossier.flags?.upFlag },
    { text: 'Workflow não habilitado', active: !!dossier.workflow && dossier.workflow !== 'Manual' },
    { text: 'Score não habilitado', active: dossier.riskScore != null || dossier.score != null },
  ];

  return (
    <section className="bg-[#f1f1f1] px-4 py-4 sm:px-6">
      <div className="rounded-sm border border-neutral-300 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_3.6fr_1.5fr] xl:gap-8">
          {/* Subject */}
          <div>
            <div className="text-[14px] font-semibold text-neutral-700 tabular-nums">{subjectDoc}</div>
            <div className="mt-1 text-[11px] text-neutral-600">{subjectName}</div>
            {age != null && <div className="text-[11px] text-neutral-600">{age} anos</div>}
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-4 text-[11px] md:grid-cols-4">
            <InfoCell label="Número do Dossiê" value={number} />
            <InfoCell label="Data de Criação" value={createdAt} />
            <InfoCell label="Usuário" value={analyst} />
            <InfoCell label="Fontes com Resultados" value={withResults} link />
            <InfoCell label="Perfil de Consulta" value={preset} />
            <InfoCell label="Último processamento" value={lastRun} />
            <InfoCell label="Homônimos" value={homonyms} />
            <InfoCell label="Fontes sem Resultados" value={withoutResults} link />
          </div>

          {/* Capability tiles */}
          <div className="grid grid-cols-3 gap-3">
            {capabilities.map((c) => (
              <CapTile key={c.text} text={c.text} active={c.active} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
