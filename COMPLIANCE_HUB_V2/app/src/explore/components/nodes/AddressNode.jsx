import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MapPin } from 'lucide-react';

function AddressNode({ data, selected }) {
  return (
    <div
      className={`w-[200px] overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
        selected ? 'border-amber-400 shadow-lg ring-2 ring-amber-100' : 'border-slate-200 hover:shadow-md'
      }`}
    >
      <div className="h-1.5 bg-gradient-to-r from-amber-500 to-yellow-400" />

      <div className="px-3.5 py-3">
        <div className="mb-1 flex items-center gap-1.5">
          <MapPin size={12} className="text-amber-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
            Endereço
          </span>
        </div>
        <div className="truncate text-[14px] font-bold leading-tight text-slate-800">
          {data.label || 'Endereço'}
        </div>
        <div className="mt-1 text-[12px] tabular-nums text-slate-500">
          {data.cep || '—'}
        </div>
        {data.street && (
          <div className="mt-0.5 truncate text-[11px] text-slate-400">
            {data.street}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Left} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}

export default memo(AddressNode);
