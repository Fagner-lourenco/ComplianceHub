import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import LoadingState from '../../shared/components/LoadingState';

export default function ProtectedRoute({ children }) {
  const { user, loading, hasResolvedProfile } = useAuth();
  const location = useLocation();

  if (loading || !hasResolvedProfile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gray-50/50">
        <LoadingState rows={3} columns={2} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
