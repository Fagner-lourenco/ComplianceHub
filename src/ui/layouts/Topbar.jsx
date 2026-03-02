import { useAuth } from '../../core/auth/AuthContext';
import './Topbar.css';

export default function Topbar({ title }) {
    const { userProfile } = useAuth();

    return (
        <header className="topbar">
            <div className="topbar__left">
                <h1 className="topbar__title">{title}</h1>
            </div>
            <div className="topbar__right">
                <div className="topbar__search">
                    <span className="topbar__search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome, CPF ou ID..."
                        className="topbar__search-input"
                    />
                </div>
                <button className="topbar__notification" title="Notificações">
                    🔔
                    <span className="topbar__badge">3</span>
                </button>
            </div>
        </header>
    );
}
