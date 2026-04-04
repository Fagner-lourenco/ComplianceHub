import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { formatRoleLabel, hasPermission, PERMISSIONS } from '../../core/rbac/permissions';
import './Sidebar.css';

const clientNav = [
    { to: '/client/dashboard', icon: 'DB', label: 'Dashboard', permission: PERMISSIONS.CASE_READ },
    { to: '/client/solicitacoes', icon: '[]', label: 'Solicitacoes', permission: PERMISSIONS.CASE_READ },
    { to: '/client/nova-solicitacao', icon: '+', label: 'Nova solicitacao', permission: PERMISSIONS.CASE_CREATE_REQUEST },
    { to: '/client/candidatos', icon: 'ID', label: 'Candidatos', permission: PERMISSIONS.CASE_READ },
    { to: '/client/exportacoes', icon: 'EX', label: 'Exportacoes', permission: PERMISSIONS.CASE_EXPORT },
];

const opsNav = [
    { to: '/ops/fila', icon: 'WK', label: 'Fila de trabalho', permission: PERMISSIONS.CASE_READ },
    { to: '/ops/casos', icon: 'CS', label: 'Todos os casos', permission: PERMISSIONS.CASE_READ },
    { to: '/ops/candidatos', icon: 'CD', label: 'Candidatos', permission: PERMISSIONS.CASE_READ },
    { to: '/ops/clientes', icon: 'CL', label: 'Gestao de clientes', permission: PERMISSIONS.USERS_MANAGE },
    { to: '/ops/auditoria', icon: 'LG', label: 'Auditoria', permission: PERMISSIONS.AUDIT_VIEW },
    { to: '/ops/metricas-ia', icon: 'AI', label: 'Métricas IA', permission: PERMISSIONS.AUDIT_VIEW },
];

export default function Sidebar({ isOpen, onClose }) {
    const { logout, userProfile } = useAuth();
    const { selectedTenantLabel } = useTenant();
    const location = useLocation();
    const navigate = useNavigate();

    const isDemoPortal = location.pathname.startsWith('/demo/');
    const isOpsPortal = location.pathname.startsWith('/ops') || location.pathname.startsWith('/demo/ops');
    const routePrefix = isDemoPortal ? '/demo' : '';
    const currentRole = userProfile?.role || null;
    const demoHiddenOps = ['/ops/clientes', '/ops/metricas-ia'];
    const navigationSource = isOpsPortal
        ? opsNav.filter((item) => !(isDemoPortal && demoHiddenOps.includes(item.to)))
        : clientNav;
    const navItems = navigationSource.filter((item) => hasPermission(currentRole, item.permission));

    const displayName = userProfile?.displayName || 'Usuario';
    const displayEmail = userProfile?.email || 'Email nao informado';
    const displayRole = currentRole ? formatRoleLabel(currentRole) : 'Permissoes em sincronizacao';
    const contextLabel = isOpsPortal ? 'Contexto do painel' : 'Franquia vinculada';

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        }

        navigate('/login', { replace: true });
    };

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
            <div className="sidebar__brand">
                <div className="sidebar__logo">CH</div>
                <span className="sidebar__title">ComplianceHub</span>
            </div>

            <nav className="sidebar__nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={`${routePrefix}${item.to}`}
                        onClick={onClose}
                        className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                    >
                        <span className="sidebar__icon">{item.icon}</span>
                        <span className="sidebar__label">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar__footer">
                <div className="sidebar__context">
                    <div className="sidebar__context-label">{contextLabel}</div>
                    <div className="sidebar__context-value" title={selectedTenantLabel}>
                        {selectedTenantLabel}
                    </div>
                </div>

                <div className="sidebar__user">
                    <div className="sidebar__avatar">{(displayName[0] || 'U').toUpperCase()}</div>
                    <div className="sidebar__user-info">
                        <div className="sidebar__user-name" title={displayName}>{displayName}</div>
                        <div className="sidebar__user-email" title={displayEmail}>{displayEmail}</div>
                        <div className="sidebar__user-role">{displayRole}</div>
                    </div>
                    <button className="sidebar__logout" onClick={handleLogout} title="Sair do sistema">
                        SAIR
                    </button>
                </div>
            </div>
        </aside>
    );
}
