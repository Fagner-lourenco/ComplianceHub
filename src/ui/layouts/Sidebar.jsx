import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { hasPermission, PERMISSIONS } from '../../core/rbac/permissions';
import './Sidebar.css';

const clientNav = [
    { to: '/client/solicitacoes', icon: '📊', label: 'Solicitações' },
    { to: '/client/nova-solicitacao', icon: '➕', label: 'Nova Solicitação' },
    { to: '/client/candidatos', icon: '👤', label: 'Candidatos' },
    { to: '/client/exportacoes', icon: '📥', label: 'Exportações' },
];

const opsNav = [
    { to: '/ops/fila', icon: '📋', label: 'Fila de Trabalho' },
    { to: '/ops/casos', icon: '📁', label: 'Todos os Casos' },
    { to: '/ops/candidatos', icon: '👤', label: 'Candidatos' },
    { to: '/ops/auditoria', icon: '🔍', label: 'Auditoria' },
];

export default function Sidebar() {
    const { userProfile, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Detect portal from URL path — ensures demo mode works correctly
    const isOpsPortal = location.pathname.startsWith('/ops');
    const navItems = isOpsPortal ? opsNav : clientNav;

    // Display info for demo mode
    const displayName = userProfile?.displayName || (isOpsPortal ? 'Analista' : 'Cliente');
    const displayRole = userProfile?.role || (isOpsPortal ? 'analyst' : 'client_manager');

    const handleLogout = async () => {
        try { await logout(); } catch (e) { /* demo mode */ }
        navigate('/login');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar__brand">
                <div className="sidebar__logo">CH</div>
                <span className="sidebar__title">ComplianceHub</span>
            </div>

            <nav className="sidebar__nav">
                {navItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                    >
                        <span className="sidebar__icon">{item.icon}</span>
                        <span className="sidebar__label">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar__footer">
                <div className="sidebar__user">
                    <div className="sidebar__avatar">{displayName[0]}</div>
                    <div className="sidebar__user-info">
                        <div className="sidebar__user-name">{displayName}</div>
                        <div className="sidebar__user-role">{displayRole.replace('_', ' ')}</div>
                    </div>
                </div>
                <button className="sidebar__logout" onClick={handleLogout} title="Sair">
                    🚪
                </button>
            </div>
        </aside>
    );
}
