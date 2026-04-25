import { useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const TONES = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
};

export default function Toast({ id, message, type = 'info', duration = 5000, onClose }) {
  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onClose?.(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const Icon = ICONS[type] || Info;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.97 }}
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${TONES[type] || TONES.info}`}
      role="alert"
    >
      <Icon size={18} className="shrink-0" />
      <span className="text-[13px] font-medium">{message}</span>
      <button
        type="button"
        onClick={() => onClose?.(id)}
        className="ml-2 rounded p-1 transition hover:bg-black/5"
        aria-label="Fechar"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
