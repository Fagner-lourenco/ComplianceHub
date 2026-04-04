import { useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { formatRoleLabel } from '../../core/rbac/permissions';
import './Topbar.css';

export default function Topbar({ title, onMenuClick, topbarRef }) {
    const location = useLocation();
    const { profileStatus, userProfile } = useAuth();
    const {
        canSelectTenant,
        selectedTenantId,
        selectedTenantLabel,
        setSelectedTenantId,
        tenantStatus,
        tenants,
    } = useTenant();

    const isOpsPortal = location.pathname.startsWith('/ops') || location.pathname.startsWith('/demo/ops');
    const displayName = userProfile?.displayName || 'Usuario';
    const displayEmail = userProfile?.email || '';
    const displayRole = userProfile?.role ? formatRoleLabel(userProfile.role) : 'Permissoes em sincronizacao';
    const initials = (displayName[0] || 'U').toUpperCase();

    const SYNC_STATUS_LABELS = {
        ready: 'Perfil confirmado',
        cached: 'Perfil em cache local',
        error: 'Sincronizacao pendente',
        missing: 'Perfil nao localizado',
        delayed: 'Sincronizacao lenta',
    };
    const SYNC_STATUS_TONES = {
        ready: 'ready',
        cached: 'cached',
        error: 'alert',
        missing: 'alert',
        delayed: 'loading',
    };
    const syncStatusLabel = SYNC_STATUS_LABELS[profileStatus] || 'Sincronizando perfil';
    const syncStatusTone = SYNC_STATUS_TONES[profileStatus] || 'loading';
    const contextMeta = tenantStatus === 'loading'
        ? 'Validando franquias e contexto'
        : tenantStatus === 'error'
            ? 'Contexto local mantido ate nova sincronizacao'
            : 'Dados do painel respeitam esse contexto';

    return (
        <header ref={topbarRef} className="topbar">
            <div className="topbar__left">
                <button
                    className="topbar__menu-btn"
                    onClick={onMenuClick}
                    aria-label="Abrir menu"
                >
                    =
                </button>
                <div className="topbar__title-group">
                    <h1 className="topbar__title">{title}</h1>
                    <span className="topbar__subtitle">
                        {isOpsPortal ? 'Painel operacional com contexto ativo' : 'Portal do cliente com identidade confirmada'}
                    </span>
                </div>
            </div>

            <div className="topbar__center">
                <div className="topbar__context">
                    <span className="topbar__context-label">
                        {isOpsPortal ? 'Franquia em contexto' : 'Franquia atual'}
                    </span>

                    {isOpsPortal && canSelectTenant ? (
                        <select
                            value={selectedTenantId || ALL_TENANTS_ID}
                            onChange={(event) => setSelectedTenantId(event.target.value)}
                            className="topbar__tenant-select"
                            aria-label="Selecionar franquia"
                        >
                            <option value={ALL_TENANTS_ID}>Todas as franquias</option>
                            {tenants.map((tenant) => (
                                <option key={tenant.id} value={tenant.id}>
                                    {tenant.name}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div className="topbar__context-value" title={selectedTenantLabel}>
                            {selectedTenantLabel}
                        </div>
                    )}

                    <span className="topbar__context-meta">{contextMeta}</span>
                </div>
            </div>

            <div className="topbar__right">
                <div className={`topbar__status topbar__status--${syncStatusTone}`} title={syncStatusLabel}>
                    <span className="topbar__status-dot" aria-hidden="true" />
                    <span className="topbar__status-text">{syncStatusLabel}</span>
                </div>

                <div className="topbar__user-chip" title={`${displayName} - ${displayRole}`}>
                    <div className="topbar__user-avatar">{initials}</div>
                    <div className="topbar__user-meta">
                        <span className="topbar__user-name">{displayName}</span>
                        <span className="topbar__user-email">{displayEmail || 'Email nao informado'}</span>
                        <span className="topbar__user-role">{displayRole}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
