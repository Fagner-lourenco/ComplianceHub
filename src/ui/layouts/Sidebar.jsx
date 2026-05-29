import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { formatRoleLabel, hasPermission } from '../../core/rbac/permissions';
import { CLIENT_NAV, OPS_NAV, ICONS, CONTEXT_LABELS } from '../../core/copy/navigation.jsx';
import './Sidebar.css';

export default function Sidebar({ isOpen, onClose }) {
    const { logout, userProfile } = useAuth();
    const {
        canSelectTenant,
        selectedTenantId,
        selectedTenantLabel,
        setSelectedTenantId,
        tenantStatus,
        tenants,
    } = useTenant();
    const location = useLocation();
    const navigate = useNavigate();

    const isDemoPortal = location.pathname.startsWith('/demo/');
    const isOpsPortal = location.pathname.startsWith('/ops') || location.pathname.startsWith('/demo/ops');
    const routePrefix = isDemoPortal ? '/demo' : '';
    const currentRole = userProfile?.role || null;
    const demoHiddenOps = ['/ops/clientes', '/ops/metricas-ia', '/ops/equipe'];
    const navigationSource = isOpsPortal
        ? OPS_NAV.filter((item) => !(isDemoPortal && demoHiddenOps.includes(item.to)))
        : CLIENT_NAV;
    const navItems = navigationSource.filter((item) => hasPermission(currentRole, item.permission));

    const displayName = userProfile?.displayName || 'Usuário';
    const displayEmail = userProfile?.email || 'E-mail não informado';
    const displayRole = currentRole ? formatRoleLabel(currentRole) : 'Permissões em sincronização';
    const ctx = isOpsPortal ? CONTEXT_LABELS.OPS : CONTEXT_LABELS.CLIENT;
    const contextLabel = ctx.sidebarContextLabel;
    const displayTenantLabel = isOpsPortal ? selectedTenantLabel : (userProfile?.tenantName || 'Não vinculada');

    const contextMeta = tenantStatus === 'loading'
        ? ctx.loadingStatus
        : tenantStatus === 'error'
            ? ctx.syncStatus
            : ctx.dataContextHint;

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
                        <span className="sidebar__icon">{ICONS[item.icon] || item.icon}</span>
                        <span className="sidebar__label">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar__footer">
                <div className="sidebar__context">
                    <div className="sidebar__context-label">{contextLabel}</div>
                    {isOpsPortal && canSelectTenant ? (
                        <select
                            value={selectedTenantId || ALL_TENANTS_ID}
                            onChange={(event) => setSelectedTenantId(event.target.value)}
                            className="sidebar__tenant-select"
                            aria-label="Selecionar empresa"
                        >
                            <option value={ALL_TENANTS_ID}>{ctx.allTenantsOption}</option>
                            {tenants.map((tenant) => (
                                <option key={tenant.id} value={tenant.id}>
                                    {tenant.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="sidebar__context-value" title={displayTenantLabel}>
                            {displayTenantLabel}
                        </div>
                    )}
                    <div className="sidebar__context-meta">{contextMeta}</div>
                </div>

                <div className="sidebar__user">
                    <Link to={`${routePrefix}${isOpsPortal ? '/ops' : '/client'}/perfil`} className="sidebar__user-link" title="Meu perfil">
                        <div className="sidebar__avatar">{(displayName[0] || 'U').toUpperCase()}</div>
                        <div className="sidebar__user-info">
                            <div className="sidebar__user-name" title={displayName}>{displayName}</div>
                            <div className="sidebar__user-email" title={displayEmail}>{displayEmail}</div>
                            <div className="sidebar__user-role">{displayRole}</div>
                        </div>
                    </Link>
                    <button className="sidebar__logout" onClick={handleLogout} title="Sair do sistema">
                        Sair
                    </button>
                </div>
            </div>
        </aside>
    );
}
