import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Building2 } from 'lucide-react';

function CompanyNode({ data, selected }) {
  return (
    <div
      className={`w-[220px] overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
        selected ? 'border-orange-400 shadow-lg ring-2 ring-orange-100' : 'border-slate-200 hover:shadow-md'
      }`}
    >
      {/* Top stripe — UPlink: PJ = orange */}
      <div className="h-1.5 bg-gradient-to-r from-orange-500 to-amber-400" />

      <div className="px-3.5 py-3">
        {/* Type label */}
        <div className="mb-1 flex items-center gap-1.5">
          <Building2 size={12} className="text-orange-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">
            Pessoa Jurídica
          </span>
        </div>

        {/* Name */}
        <div className="truncate text-[14px] font-bold leading-tight text-slate-800">
          {data.name || '—'}
        </div>

        {/* Document */}
        <div className="mt-1 text-[12px] tabular-nums text-slate-500">
          {data.document || '—'}
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}

export default memo(CompanyNode);
