import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { hasPermission } from '../rbac/permissions';
import LoadingState from '../../shared/components/LoadingState';

export default function RequirePermission({ permission, children, fallback = null }) {
  const { user, userProfile, loading, hasResolvedProfile } = useAuth();

  if (loading || !hasResolvedProfile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gray-50/50">
        <LoadingState rows={3} columns={2} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = userProfile?.role;
  const allowed = role && hasPermission(role, permission);

  if (!allowed) {
    return fallback || (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-gray-50/50 text-center px-4">
        <h1 className="mb-4 text-2xl font-bold text-brand-600">Acesso negado</h1>
        <p className="mb-6 text-text-secondary">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  return children;
}
