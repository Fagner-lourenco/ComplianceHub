import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Bell,
  ChevronLeft,
  HelpCircle,
  LogOut,
  Settings,
  Upload,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../core/auth/useAuth';

/* ================================================================
   PAGE CONTEXT BAR — replaces the old mega-menu header
   Shows: breadcrumb / page title / contextual actions / profile
   ================================================================ */

const HEADER_ACTIONS = [
  { icon: HelpCircle, label: 'Ajuda', enabled: false, tooltip: 'Em breve — central de ajuda' },
  { icon: Upload, label: 'Importar em Lote', enabled: false, tooltip: 'Em breve — importação via CSV/Excel' },
  { icon: Bell, label: 'Notificações', enabled: false, tooltip: 'Em breve — central de notificações' },
];

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function PageTitle() {
  const location = useLocation();
  const path = location.pathname;

  const titles = [
    { match: '/dossie/create', title: 'Nova Consulta', subtitle: 'Crie uma análise rápida por CPF ou CNPJ' },
    { match: '/dossie/custom-profile', title: 'Perfis Customizados', subtitle: 'Configure layouts personalizados de dossiê' },
    { match: '/hub', title: 'Hub de Produtos', subtitle: 'Catálogo completo de produtos de análise' },
    { match: '/explore', title: 'LinkMap', subtitle: 'Grafo de vínculos e relações' },
    { match: '/watchlists', title: 'Watchlists', subtitle: 'Monitoramento contínuo e alertas' },

    { match: '/reports', title: 'Relatórios', subtitle: 'Publicação de relatórios auditáveis' },
    { match: '/billing', title: 'Billing', subtitle: 'Consumo e créditos do tenant' },
    { match: '/settings/users', title: 'Usuários', subtitle: 'Gestão de equipe e permissões' },
    { match: '/settings/tenant', title: 'Configurações', subtitle: 'Configurações do tenant' },
  ];

  const exact = titles.find((t) => path === t.match);
  if (exact) return exact;

  const prefix = titles.find((t) => path.startsWith(t.match) && t.match !== '/dossie');
  if (prefix) return prefix;

  if (path.startsWith('/dossie/') && path.includes('/processing')) {
    return { title: 'Processamento', subtitle: 'Acompanhamento da análise' };
  }
  if (path.startsWith('/dossie/')) {
    return { title: 'Dossiê', subtitle: 'Visualização detalhada da análise' };
  }
  if (path.startsWith('/analyse/')) {
    return { title: 'Nova Solicitação', subtitle: 'Preencha os dados para iniciar a análise' };
  }

  return { title: 'ComplianceHub', subtitle: '' };
}

export default function TopProductHeader() {
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, logout } = useAuth();

  const page = PageTitle();
  const isDossieList = location.pathname === '/dossie';

  return (
    <header className="relative z-30 border-b border-gray-200 bg-white">
      {/* Lexi-style gradient brand strip — slim 4px accent bar */}
      <div className="h-[3px] bg-gradient-to-r from-[#ff8417] via-[#a44167] to-[#5f147f]" />

      <div className="flex h-[56px] items-center justify-between px-5">
        {/* Left: breadcrumb / title */}
        <div className="flex items-center gap-3 min-w-0">
          {!isDossieList && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              title="Voltar"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold text-gray-900">{page.title}</h1>
            {page.subtitle && (
              <p className="hidden truncate text-[11px] text-gray-400 sm:block">{page.subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: actions + profile */}
        <div className="flex items-center gap-1">
          {HEADER_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              aria-label={action.label}
              title={action.tooltip}
              disabled={!action.enabled}
              className="relative rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <action.icon size={16} />
            </button>
          ))}

          <div className="mx-1.5 h-5 w-px bg-gray-200" />

          <button
            type="button"
            aria-label="Perfil"
            className={cx('flex items-center gap-2 rounded-lg px-2 py-1.5 transition', profileOpen ? 'bg-gray-100' : 'hover:bg-gray-100')}
            onClick={() => setProfileOpen((v) => !v)}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-brand-500">
              {(userProfile?.displayName || userProfile?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <span className="hidden max-w-[120px] truncate text-[12px] font-semibold text-gray-700 lg:block">
              {userProfile?.displayName || userProfile?.name || 'Usuário'}
            </span>
          </button>
        </div>
      </div>

      {/* Profile dropdown */}
      <AnimatePresence>
        {profileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute right-4 top-[60px] z-40 w-[280px] rounded-xl border border-neutral-200 bg-white p-4 shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-bold text-gray-700">{userProfile?.companyName || 'Minha Conta'}</span>
              <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-50" onClick={() => setProfileOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="space-y-0.5 text-[13px]">
              <MenuItem icon={Users} label="Gestão de Usuários" onClick={() => { setProfileOpen(false); navigate('/settings/users'); }} />
              <MenuItem icon={Settings} label="Configurações do Tenant" onClick={() => { setProfileOpen(false); navigate('/settings/tenant'); }} />
              <div className="border-t border-gray-100 pt-1 mt-1">
                <MenuItem icon={LogOut} label="Sair da conta" onClick={() => { logout(); setProfileOpen(false); }} danger />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay */}
      {profileOpen && (
        <button type="button" className="fixed inset-0 z-20 bg-transparent" aria-label="Fechar menu" onClick={() => setProfileOpen(false)} />
      )}
    </header>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      className={cx(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[12px] transition',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
      )}
      onClick={onClick}
    >
      <Icon size={15} />
      <span className="font-semibold">{label}</span>
    </button>
  );
}
