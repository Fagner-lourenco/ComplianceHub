import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Gavel } from 'lucide-react';

function ProcessNode({ data, selected }) {
  return (
    <div
      className={`w-[220px] overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
        selected ? 'border-red-400 shadow-lg ring-2 ring-red-100' : 'border-slate-200 hover:shadow-md'
      }`}
    >
      <div className="h-1.5 bg-gradient-to-r from-red-500 to-rose-400" />

      <div className="px-3.5 py-3">
        <div className="mb-1 flex items-center gap-1.5">
          <Gavel size={12} className="text-red-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600">
            Processo Judicial
          </span>
        </div>
        <div className="truncate text-[14px] font-bold leading-tight text-slate-800">
          {data.name || '—'}
        </div>
        <div className="mt-1 text-[12px] tabular-nums text-slate-500">
          {data.number || data.document || '—'}
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}

export default memo(ProcessNode);
