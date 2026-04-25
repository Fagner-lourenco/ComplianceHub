import { memo, useState } from 'react';
import {
  Expand,
  Eye,
  ExternalLink,
  Flag,
  MessageSquarePlus,
  EyeOff,
  FileText,
  FileBadge,
  Trash2,
  X,
  ChevronRight,
  Building2,
  DollarSign,
  Car,
} from 'lucide-react';

const MENU_ITEMS = [
  {
    id: 'expand',
    label: 'Expandir nó',
    icon: Expand,
    submenu: [
      { label: 'QSA (0 de 4)', icon: Building2 },
      { label: 'Filiais (0 de 0)', icon: Building2 },
      { label: 'Entidades Relacionadas (0 de 49)', icon: Building2 },
    ],
  },
  {
    id: 'view',
    label: 'Visualizar dados',
    icon: Eye,
    submenu: [
      { label: 'Consulta ao CNPJ', icon: Building2 },
      { label: 'Visualizar no Google Maps', icon: ExternalLink },
      { label: 'Protestos – SPC', icon: DollarSign },
      { label: 'Veículos – Frota Atual', icon: Car },
      { label: 'Cheques sem fundo – CCF', icon: DollarSign },
    ],
  },
  { id: 'consult', label: 'Consultar em outro App', icon: ExternalLink },
  { id: 'flag', label: 'upFlag', icon: Flag },
  { id: 'comment', label: 'Adicionar comentário', icon: MessageSquarePlus },
  { id: 'hide', label: 'Ocultar nó', icon: EyeOff },
  { id: 'doc', label: 'Exibir documento', icon: FileText },
  { id: 'dossie', label: 'Gerar Dossiê', icon: FileBadge },
  { id: 'delete', label: 'Excluir nó', icon: Trash2 },
];

function NodeContextMenu({
  nodeId,
  data,
  x,
  y,
  onClose,
  onExpand,
  onViewDetails,
  onHide,
  onDelete,
  onConsultApp,
  onFlag,
  onComment,
  onShowDoc,
  onGenerateDossie,
}) {
  const [openSubmenu, setOpenSubmenu] = useState(null);
  if (!nodeId) return null;

  // Clamp position so menu never renders off-screen
  const menuW = 260;
  const menuH = 420;
  const posX = Math.min(x, window.innerWidth - menuW - 8);
  const posY = Math.min(y, window.innerHeight - menuH - 8);

  function handleAction(itemId) {
    const actions = {
      expand: () => onExpand?.(nodeId, data),
      view: () => onViewDetails?.(nodeId, data),
      hide: () => onHide?.(nodeId),
      delete: () => onDelete?.(nodeId),
      consult: () => onConsultApp?.(nodeId, data),
      flag: () => onFlag?.(nodeId, data),
      comment: () => onComment?.(nodeId, data),
      doc: () => onShowDoc?.(nodeId, data),
      dossie: () => onGenerateDossie?.(nodeId, data),
    };
    actions[itemId]?.();
    onClose();
  }

  return (
    <div
      className="fixed z-[60] min-w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      style={{ left: posX, top: posY }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Ações</span>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
          <X size={12} />
        </button>
      </div>

      <div className="py-1">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const hasSubmenu = item.submenu && item.submenu.length > 0;
          const isOpen = openSubmenu === item.id;

          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (hasSubmenu) {
                    setOpenSubmenu(isOpen ? null : item.id);
                  } else {
                    handleAction(item.id);
                  }
                }}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] transition ${
                  item.id === 'expand' || item.id === 'view' ? 'font-medium text-slate-800 hover:bg-slate-50' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={15} className={item.id === 'expand' || item.id === 'view' ? 'text-orange-500' : 'text-slate-400'} />
                <span className="flex-1">{item.label}</span>
                {hasSubmenu && <ChevronRight size={14} className={`text-slate-400 transition ${isOpen ? 'rotate-90' : ''}`} />}
              </button>

              {hasSubmenu && isOpen && (
                <div className="border-l-2 border-orange-100 bg-slate-50/50 py-1">
                  {item.submenu.map((sub, idx) => {
                    const SubIcon = sub.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (item.id === 'expand') onExpand?.(nodeId, data);
                          if (item.id === 'view') onViewDetails?.(nodeId, data);
                          onClose();
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2 pl-10 text-left text-[12px] text-slate-600 transition hover:bg-slate-100"
                      >
                        <SubIcon size={13} className="text-orange-400" />
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(NodeContextMenu);
