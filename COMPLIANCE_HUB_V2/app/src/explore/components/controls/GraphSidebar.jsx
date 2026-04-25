import { memo } from 'react';
import {
  Share2,
  Plus,
  Search,
  UserPlus,
  MousePointerClick,
  RotateCcw,
  Save,
  Map,
  Download,
  Info,
  HelpCircle,
} from 'lucide-react';

const ITEMS = [
  { id: 'logo', icon: Share2, label: 'LinkMap', accent: true },
  { id: 'new', icon: Plus, label: 'Novo Mapa' },
  { id: 'find', icon: Search, label: 'Localizar' },
  { id: 'add', icon: UserPlus, label: 'Adicionar' },
  { id: 'highlight', icon: MousePointerClick, label: 'Destacar' },
  { id: 'restore', icon: RotateCcw, label: 'Restaurar' },
  { id: 'save', icon: Save, label: 'Salvar' },
  { id: 'maps', icon: Map, label: 'Mapas' },
  { id: 'download', icon: Download, label: 'Download' },
  { id: 'legend', icon: Info, label: 'Legendas' },
  { id: 'faq', icon: HelpCircle, label: 'FAQ' },
];

function GraphSidebar({ onAction }) {
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1 rounded-r-xl border border-l-0 border-slate-200 bg-white py-3 shadow-lg">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isLogo = item.id === 'logo';
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onAction?.(item.id)}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition ${
              isLogo
                ? 'mb-2 text-orange-500'
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
            }`}
            title={item.label}
          >
            <Icon size={isLogo ? 22 : 18} strokeWidth={isLogo ? 2.2 : 1.8} />
            {!isLogo && (
              <span className="absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover:block">
                {item.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default memo(GraphSidebar);
