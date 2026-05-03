import { useLocation } from 'react-router-dom';
import useTheme from '../../hooks/useTheme';
import NotificationBell from '../components/NotificationBell/NotificationBell';
import './Topbar.css';

export default function Topbar({ onMenuClick, topbarRef }) {
    const location = useLocation();
    const isOpsPortal = location.pathname.startsWith('/ops') || location.pathname.startsWith('/demo/ops');
    const { resolved: resolvedTheme, toggleTheme } = useTheme();

    return (
        <header ref={topbarRef} className="topbar">
            <div className="topbar__left">
                <button
                    className="topbar__menu-btn"
                    onClick={onMenuClick}
                    aria-label="Abrir menu de navegação"
                >
                    ☰
                </button>
                <div className="topbar__title-group">
                    <span className="topbar__subtitle">
                        {isOpsPortal ? 'Painel operacional' : 'Portal do cliente'}
                    </span>
                </div>

                <div className="topbar__right">
                    <NotificationBell />
                    <button
                        className="topbar__theme-toggle"
                        onClick={toggleTheme}
                        title={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                        aria-label="Alternar tema"
                    >
                        {resolvedTheme === 'dark' ? '☀️' : '🌙'}
                    </button>
                </div>
            </div>
        </header>
    );
}
