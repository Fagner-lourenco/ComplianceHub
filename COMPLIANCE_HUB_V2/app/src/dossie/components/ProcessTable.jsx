// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

function StatusBadge({ status, color }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colors[color] || colors.orange}`}>
      {status}
    </span>
  );
}

export default function ProcessTable({ processes }) {
  if (!processes || processes.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-2.5 font-bold uppercase tracking-wide text-gray-400">Nº do Processo</th>
            <th className="px-3 py-2.5 font-bold uppercase tracking-wide text-gray-400">Classe</th>
            <th className="px-3 py-2.5 font-bold uppercase tracking-wide text-gray-400">Tribunal</th>
            <th className="px-3 py-2.5 font-bold uppercase tracking-wide text-gray-400">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {processes.map((proc, i) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="hover:bg-gray-50/50"
            >
              <td className="px-3 py-2.5 font-mono text-[11px] text-gray-700">{proc.number}</td>
              <td className="px-3 py-2.5 text-gray-700">{proc.class}</td>
              <td className="px-3 py-2.5 text-gray-700">{proc.tribunal}</td>
              <td className="px-3 py-2.5">
                <StatusBadge status={proc.status} color={proc.statusColor} />
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
