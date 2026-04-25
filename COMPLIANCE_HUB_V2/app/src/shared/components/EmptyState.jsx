import { FileSearch, FolderOpen, Inbox } from 'lucide-react';

const ICONS = {
  search: FileSearch,
  folder: FolderOpen,
  inbox: Inbox,
};

export default function EmptyState({
  icon = 'inbox',
  title = 'Nenhum resultado encontrado',
  description = 'Tente ajustar os filtros ou criar um novo item.',
  actionLabel,
  onAction,
}) {
  const Icon = ICONS[icon] || Inbox;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16 px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
        <Icon className="h-7 w-7 text-gray-300" size={28} strokeWidth={1.5} />
      </div>
      <strong className="mb-1 text-[15px] font-bold text-gray-800">{title}</strong>
      <p className="mb-4 max-w-sm text-[13px] text-gray-500">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-600 active:scale-[0.97] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:opacity-90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
