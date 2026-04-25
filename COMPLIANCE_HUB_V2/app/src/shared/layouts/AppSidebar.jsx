import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Globe,
  LayoutDashboard,
  Monitor,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../../core/auth/useAuth';

const NAV_SECTIONS = [
  {
    title: 'Análises',
    items: [
      { key: 'create', label: 'Nova Análise', path: '/dossie/create', icon: Sparkles, description: 'Inicie uma nova pesquisa' },
      { key: 'dossie', label: 'Meus Dossiês', path: '/dossie', icon: FolderOpen, description: 'Veja todas as análises' },
      { key: 'custom-profile', label: 'Perfis Customizados', path: '/dossie/custom-profile', icon: Briefcase, description: 'Configure layouts personalizados' },
    ],
  },
  {
    title: 'Exploração',
    items: [
      { key: 'explore', label: 'LinkMap', path: '/explore', icon: Globe, description: 'Grafo de vínculos e relações' },
      { key: 'hub2', label: 'Hub de Produtos', path: '/hub', icon: LayoutDashboard, description: 'Catálogo de produtos' },
    ],
  },
  {
    title: 'Monitoramento',
    items: [
      { key: 'watchlists', label: 'Watchlists', path: '/watchlists', icon: Monitor, description: 'Alertas e monitoramento contínuo' },
    ],
  },
  {
    title: 'Relatórios',
    items: [
      { key: 'reports', label: 'Relatórios', path: '/reports', icon: FileText, description: 'Relatórios publicados' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { key: 'users', label: 'Usuários', path: '/settings/users', icon: Users, description: 'Gestão de equipe' },
      { key: 'tenant', label: 'Configurações', path: '/settings/tenant', icon: Settings, description: 'Configurações do tenant' },
      { key: 'billing', label: 'Billing', path: '/billing', icon: BarChart3, description: 'Consumo e créditos' },
    ],
  },
];

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function NavItem({ item, collapsed, active }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      title={collapsed ? item.description : undefined}
      className={cx(
        'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition',
        active
          ? 'bg-purple-50 text-brand-500'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      )}
    >
      <Icon size={16} className={cx('shrink-0', active ? 'text-brand-500' : 'text-gray-400 group-hover:text-gray-600')} />
      {!collapsed && (
        <span className="truncate">
          {item.label}
        </span>
      )}
      {!collapsed && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />}
    </Link>
  );
}

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { userProfile } = useAuth();

  const isActive = (path) => {
    if (path === '/dossie') return location.pathname === '/dossie' || location.pathname.startsWith('/dossie/');
    if (path === '/hub') return location.pathname === '/hub' || location.pathname === '/client/hub';
    if (path === '/explore') return location.pathname.startsWith('/explore');
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={cx(
        'flex flex-col border-r border-gray-200 bg-white transition-[width] duration-300',
        collapsed ? 'w-[64px]' : 'w-[240px]'
      )}
    >
      {/* Logo area */}
      <div className="flex h-[56px] items-center border-b border-gray-100 px-4">
        <Link to="/dossie" className="flex items-center gap-2 overflow-hidden">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white text-[14px] font-bold">
            ⌘
          </span>
          {!collapsed && (
            <span className="truncate text-[13px] font-bold text-gray-800">
              ComplianceHub
            </span>
          )}
        </Link>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {/* Nova Análise — CTA destacado */}
        <div className="mb-4 px-1">
          <Link
            to="/dossie/create"
            className={cx(
              'flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.97]',
              collapsed && 'justify-center px-2'
            )}
          >
            <Sparkles size={15} />
            {!collapsed && 'Nova Análise'}
          </Link>
        </div>

        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <h3 className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {section.title}
              </h3>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem
                  key={item.key}
                  item={item}
                  collapsed={collapsed}
                  active={isActive(item.path)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-semibold text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /> Recolher menu</>}
        </button>

        {!collapsed && userProfile && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-brand-500">
              {(userProfile.displayName || userProfile.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold text-gray-700">{userProfile.displayName || userProfile.name || 'Usuário'}</p>
              <p className="truncate text-[10px] text-gray-400">{userProfile.email || ''}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
