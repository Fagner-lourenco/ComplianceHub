import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorState({
  title = 'Algo deu errado',
  message = 'Não foi possível carregar os dados. Tente novamente.',
  onRetry,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-red-100 bg-red-50/30 py-16 px-6 text-center" role="alert">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-7 w-7 text-red-400" size={28} strokeWidth={1.5} />
      </div>
      <strong className="mb-1 text-[15px] font-bold text-gray-800">{title}</strong>
      <p className="mb-4 max-w-sm text-[13px] text-gray-500">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          <RotateCcw size={16} />
          Tentar novamente
        </button>
      )}
    </div>
  );
}
