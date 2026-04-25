import { useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-50">
        <FileQuestion className="h-8 w-8 text-brand-500" />
      </div>
      <h1 className="mb-2 text-5xl font-extrabold text-gray-900">404</h1>
      <p className="mb-8 text-[15px] text-gray-500">Página não encontrada.</p>
      <button
        type="button"
        onClick={() => navigate('/dossie')}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 active:scale-[0.97] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:opacity-90"
      >
        Voltar para Análises
      </button>
    </div>
  );
}
