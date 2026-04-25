import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User } from 'lucide-react';

function PersonNode({ data, selected }) {
  return (
    <div
      className={`w-[220px] overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
        selected ? 'border-purple-400 shadow-lg ring-2 ring-purple-100' : 'border-slate-200 hover:shadow-md'
      }`}
    >
      {/* Top stripe — UPlink: PF = purple */}
      <div className="h-1.5 bg-gradient-to-r from-purple-600 to-purple-400" />

      <div className="px-3.5 py-3">
        {/* Type label */}
        <div className="mb-1 flex items-center gap-1.5">
          <User size={12} className="text-purple-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-600">
            Pessoa Física
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

      {/* Invisible handles — UPlink lines connect directly to card edges */}
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}

export default memo(PersonNode);
