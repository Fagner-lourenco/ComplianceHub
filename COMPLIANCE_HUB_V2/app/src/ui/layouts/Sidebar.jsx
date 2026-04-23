import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { formatRoleLabel, hasPermission, PERMISSIONS } from '../../core/rbac/permissions';
import './Sidebar.css';

const clientNav = [
    {
        section: 'Acompanhamento',
        items: [
            { to: '/client/dashboard', icon: 'DB', label: 'Painel', permission: PERMISSIONS.CASE_READ },
            { to: '/client/solicitacoes', icon: 'SL', label: 'Solicitacoes', permission: PERMISSIONS.CASE_READ },
            { to: '/client/alertas', icon: 'AL', label: 'Alertas', permission: PERMISSIONS.CASE_READ },
        ],
    },
    {
        section: 'Produto',
        items: [
            { to: '/client/analise', icon: 'AN', label: 'Analise rapida', permission: PERMISSIONS.CASE_CREATE_REQUEST },
            { to: '/client/produtos', icon: 'PR', label: 'Catalogo de produtos', permission: PERMISSIONS.CASE_READ },
            { to: '/client/nova-solicitacao', icon: 'NV', label: 'Nova solicitacao', permission: PERMISSIONS.CASE_CREATE_REQUEST },
        ],
    },
    {
        section: 'Relatorios',
        items: [
            { to: '/client/relatorios', icon: 'RL', label: 'Relatorios', permission: PERMISSIONS.CASE_EXPORT },
            { to: '/client/exportacoes', icon: 'EX', label: 'Exportacoes', permission: PERMISSIONS.CASE_EXPORT },
        ],
    },
    {
        section: 'Franquia',
        items: [
            { to: '/client/equipe', icon: 'EQ', label: 'Equipe', permission: PERMISSIONS.USERS_MANAGE },
            { to: '/client/auditoria', icon: 'LG', label: 'Auditoria', permission: PERMISSIONS.TENANT_AUDIT_VIEW },
        ],
    },
];

const opsNav = [
    {
        section: 'Operacao',
        items: [
            { to: '/ops/fila', icon: 'FL', label: 'Fila de trabalho', permission: PERMISSIONS.CASE_READ },
            { to: '/ops/casos', icon: 'CS', label: 'Todos os casos', permission: PERMISSIONS.CASE_READ },
            { to: '/ops/watchlists', icon: 'WT', label: 'Watchlists', permission: PERMISSIONS.CASE_READ },
        ],
    },
    {
        section: 'Comercial',
        items: [
            { to: '/ops/clientes', icon: 'CL', label: 'Clientes', permission: PERMISSIONS.USERS_MANAGE },
            { to: '/ops/cotacoes', icon: 'CT', label: 'Cotacoes', permission: PERMISSIONS.USERS_MANAGE },
        ],
    },
    {
        section: 'Governanca',
        items: [
            { to: '/ops/auditoria', icon: 'AU', label: 'Auditoria', permission: PERMISSIONS.AUDIT_VIEW },
            { to: '/ops/relatorios', icon: 'RP', label: 'Relatorios', permission: PERMISSIONS.AUDIT_VIEW },
            { to: '/ops/metricas-ia', icon: 'AI', label: 'Observabilidade IA', permission: PERMISSIONS.AUDIT_VIEW },
        ],
    },
    {
        section: 'Sistema',
        items: [
            { to: '/ops/saude', icon: 'HL', label: 'Saude de providers', permission: PERMISSIONS.AUDIT_VIEW },
        ],
    },
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
    const demoHiddenOps = new Set(['/ops/clientes', '/ops/metricas-ia']);
    const navigationSource = isOpsPortal ? opsNav : clientNav;
    const navSections = navigationSource
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => {
                if (isDemoPortal && isOpsPortal && demoHiddenOps.has(item.to)) return false;
                return hasPermission(currentRole, item.permission);
            }),
        }))
        .filter((group) => group.items.length > 0);

    const displayName = userProfile?.displayName || 'Usuario';
    const displayEmail = userProfile?.email || 'Email nao informado';
    const displayRole = currentRole ? formatRoleLabel(currentRole) : 'Permissoes em sincronizacao';
    const contextLabel = isOpsPortal ? 'Contexto do painel' : 'Franquia vinculada';
    const displayTenantLabel = isOpsPortal ? selectedTenantLabel : (userProfile?.tenantName || 'Nao vinculada');

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
                {navSections.map((group) => (
                    <div key={group.section} className="sidebar__section">
                        <span className="sidebar__section-label">{group.section}</span>
                        {group.items.map((item) => (
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
                    </div>
                ))}
            </nav>

            <div className="sidebar__footer">
                <div className="sidebar__context">
                    <div className="sidebar__context-label">{contextLabel}</div>
                    <div className="sidebar__context-value" title={displayTenantLabel}>
                        {displayTenantLabel}
                    </div>
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
                        SAIR
                    </button>
                </div>
            </div>
        </aside>
    );
}
