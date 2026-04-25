import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppShell } from './shared/layouts/AppShell';
import AuthLayout from './shared/layouts/AuthLayout';
import LoadingState from './shared/components/LoadingState';
import ProtectedRoute from './core/auth/ProtectedRoute';
import RequirePermission from './core/auth/RequirePermission';
import { PERMISSIONS } from './core/rbac/permissions';

// Eagerly loaded core pages
import DossierListPage from './dossie/pages/DossierListPage';
import DossierSearchPage from './dossie/pages/DossierSearchPage';
import DossierDetailPage from './dossie/pages/DossierDetailPage';
import DossierProcessingPage from './dossie/pages/DossierProcessingPage';

// Lazy-loaded secondary pages
const LazyEntityGraphPage = lazy(() => import('./explore/pages/EntityGraphPage'));
const LazyCustomProfilePage = lazy(() => import('./dossie/pages/CustomProfilePage'));
const LazyProductHubPage = lazy(() => import('./client/pages/ProductHubPage'));
const LazyProductPipelinePage = lazy(() => import('./client/pages/ProductPipelinePage'));
const LazyTenantSettingsPage = lazy(() => import('./settings/pages/TenantSettingsPage'));
const LazyUserManagementPage = lazy(() => import('./settings/pages/UserManagementPage'));
const LazyBillingPage = lazy(() => import('./billing/pages/BillingPage'));
const LazyWatchlistPage = lazy(() => import('./monitoring/pages/WatchlistPage'));

const LazyReportsPage = lazy(() => import('./reports/pages/ReportsPage'));
const LazyNotFoundPage = lazy(() => import('./shared/pages/NotFoundPage'));

function LegacyPipelineRedirect() {
  const { productKey } = useParams();
  return <Navigate to={`/analyse/${productKey}`} replace />;
}

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/50">
      <LoadingState rows={4} columns={2} />
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function withSuspense(LazyComponent) {
  return function SuspenseWrapper(props) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

const EntityGraphPage = withSuspense(LazyEntityGraphPage);
const CustomProfilePage = withSuspense(LazyCustomProfilePage);
const ProductHubPage = withSuspense(LazyProductHubPage);
const ProductPipelinePage = withSuspense(LazyProductPipelinePage);
const TenantSettingsPage = withSuspense(LazyTenantSettingsPage);
const UserManagementPage = withSuspense(LazyUserManagementPage);
const BillingPage = withSuspense(LazyBillingPage);
const WatchlistPage = withSuspense(LazyWatchlistPage);

const ReportsPage = withSuspense(LazyReportsPage);
const NotFoundPage = withSuspense(LazyNotFoundPage);

/* ================================================================
   APP ROUTES
   ================================================================
   Organização:
   1. Auth     → /login
   2. Root     → redirect /dossie
   3. Análises → /dossie/*, /hub, /analyse/*
   4. Exploração → /explore
   5. Monitoramento → /watchlists
   6. Revisão  → /senior-review, /reports
   7. Admin    → /settings/*, /billing
   8. Legacy redirects → /client/* (mantidos para compatibilidade)
   9. 404      → /*
   ================================================================ */

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthLayout />} />

      <Route element={<AppShell />}>
        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dossie" replace />} />

        {/* ── ANÁLISES ── */}
        <Route path="/dossie" element={<ProtectedRoute><DossierListPage /></ProtectedRoute>} />
        <Route path="/dossie/create" element={<ProtectedRoute><DossierSearchPage /></ProtectedRoute>} />
        <Route path="/dossie/custom-profile" element={<ProtectedRoute><CustomProfilePage /></ProtectedRoute>} />
        <Route path="/dossie/:dossierId" element={<ProtectedRoute><DossierDetailPage /></ProtectedRoute>} />
        <Route path="/dossie/:dossierId/processing" element={<ProtectedRoute><DossierProcessingPage /></ProtectedRoute>} />

        {/* Hub de produtos */}
        <Route path="/hub" element={<ProtectedRoute><ProductHubPage /></ProtectedRoute>} />
        <Route path="/analyse/:productKey" element={<ProtectedRoute><ProductPipelinePage /></ProtectedRoute>} />

        {/* ── EXPLORAÇÃO ── */}
        <Route path="/explore/:entityId?" element={<ProtectedRoute><EntityGraphPage /></ProtectedRoute>} />

        {/* ── MONITORAMENTO ── */}
        <Route path="/watchlists" element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />

        {/* ── RELATÓRIOS ── */}
        <Route path="/reports" element={<RequirePermission permission={PERMISSIONS.REPORT_PUBLISH}><ReportsPage /></RequirePermission>} />

        {/* ── ADMINISTRAÇÃO ── */}
        <Route path="/settings" element={<Navigate to="/settings/tenant" replace />} />
        <Route path="/settings/tenant" element={<RequirePermission permission={PERMISSIONS.SETTINGS_MANAGE}><TenantSettingsPage /></RequirePermission>} />
        <Route path="/settings/users" element={<RequirePermission permission={PERMISSIONS.USERS_MANAGE}><UserManagementPage /></RequirePermission>} />
        <Route path="/billing" element={<RequirePermission permission={PERMISSIONS.BILLING_VIEW_INTERNAL_COST}><BillingPage /></RequirePermission>} />

        {/* ── LEGACY REDIRECTS (backward compatibility) ── */}
        <Route path="/client/hub" element={<Navigate to="/hub" replace />} />
        <Route path="/client/pipeline/:productKey" element={<LegacyPipelineRedirect />} />

        {/* 404 */}
        <Route path="*" element={<ProtectedRoute><NotFoundPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}
