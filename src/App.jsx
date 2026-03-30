import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './core/auth/AuthContext';
import { useAuth } from './core/auth/useAuth';
import { TenantProvider } from './core/contexts/TenantContext';
import { DemoProviders } from './demo/DemoProviders';
import {
    getPortal,
    hasPermission,
    PERMISSIONS,
} from './core/rbac/permissions';
import LoginPage from './pages/LoginPage';
import CandidatosPage from './portals/client/CandidatosPage';
import ExportacoesPage from './portals/client/ExportacoesPage';
import NovaSolicitacaoPage from './portals/client/NovaSolicitacaoPage';
import SolicitacoesPage from './portals/client/SolicitacoesPage';
import AuditoriaPage from './portals/ops/AuditoriaPage';
import CasoPage from './portals/ops/CasoPage';
import CasosPage from './portals/ops/CasosPage';
import ClientesPage from './portals/ops/ClientesPage';
import FilaPage from './portals/ops/FilaPage';
import AppLayout from './ui/layouts/AppLayout';
import PublicReportPage from './pages/PublicReportPage';

function SplashScreen() {
    return (
        <div role="status" aria-live="polite" aria-label="Carregando ComplianceHub" style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
        }}>
            <div style={{
                width: '80px',
                height: '80px',
                background: '#3b82f6',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                fontWeight: 'bold',
                boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)',
                marginBottom: '20px',
                animation: 'pulse 1.5s infinite',
            }}>CH</div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>ComplianceHub</h2>
            <p style={{ opacity: 0.6 }}>Iniciando sistema seguro...</p>
            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

function AccessState({ title, message, allowRetry = true, allowLogout = true }) {
    const { logout, user, userProfile } = useAuth();
    const identityName = userProfile?.displayName || user?.displayName || user?.email || 'Usuario autenticado';
    const identityEmail = userProfile?.email || user?.email || '';

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f0f2f5',
            padding: '24px',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '560px',
                background: 'white',
                borderRadius: '20px',
                padding: '32px',
                boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
                border: '1px solid #e5e7eb',
            }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                }}>
                    Sessao autenticada
                </div>
                <h2 style={{ marginBottom: '12px', fontSize: '1.5rem' }}>{title}</h2>
                <p style={{ marginBottom: '20px', color: '#4b5563', lineHeight: 1.6 }}>{message}</p>

                <div style={{
                    marginBottom: '24px',
                    padding: '16px',
                    borderRadius: '14px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                }}>
                    <div style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '6px',
                    }}>
                        Identidade confirmada no Firebase Auth
                    </div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{identityName}</div>
                    {identityEmail && (
                        <div style={{ color: '#475569', marginTop: '4px' }}>{identityEmail}</div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {allowRetry && (
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '12px 18px',
                                borderRadius: '12px',
                                background: '#0f172a',
                                color: 'white',
                                fontWeight: 600,
                            }}
                        >
                            Recarregar
                        </button>
                    )}
                    {allowLogout && (
                        <button
                            type="button"
                            onClick={() => void logout()}
                            style={{
                                padding: '12px 18px',
                                borderRadius: '12px',
                                background: '#e2e8f0',
                                color: '#0f172a',
                                fontWeight: 600,
                            }}
                        >
                            Sair
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function ProfileResolutionState() {
    const { profileStatus } = useAuth();

    if (profileStatus === 'missing') {
        return (
            <AccessState
                title="Perfil operacional nao localizado"
                message="O Firebase Auth confirmou o login, mas o documento correspondente em userProfiles ainda nao foi encontrado. Sem esse perfil, o sistema nao libera portal, papel ou franquias."
            />
        );
    }

    if (profileStatus === 'error') {
        return (
            <AccessState
                title="Falha ao sincronizar o perfil"
                message="Sua sessao foi restaurada, mas o Firestore nao entregou o perfil do usuario. Se houver uma copia local valida, a navegacao sera corrigida automaticamente assim que a sincronizacao voltar."
            />
        );
    }

    if (profileStatus === 'delayed') {
        return (
            <AccessState
                title="Confirmando permissoes e contexto"
                message="A rede ou o Firestore estao mais lentos do que o esperado. Mantivemos sua sessao ativa e estamos aguardando o perfil confirmado para liberar o painel correto sem exibir dados do tenant errado."
            />
        );
    }

    return (
        <AccessState
            title="Carregando perfil e franquias disponiveis"
            message="Os dados basicos do login ja foram recuperados pelo Firebase Auth. Agora estamos sincronizando papel, tenant e permissoes reais antes de abrir o painel."
            allowRetry={false}
        />
    );
}

function RequireAuth({ children }) {
    const { loading, user } = useAuth();

    if (loading) {
        return <SplashScreen />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

function PortalHomeRedirect() {
    const { userProfile } = useAuth();
    const portal = getPortal(userProfile?.role);

    if (!portal) {
        return <ProfileResolutionState />;
    }

    return <Navigate to={portal === 'ops' ? '/ops/fila' : '/client/solicitacoes'} replace />;
}

function RequirePortal({ portal, children }) {
    const { userProfile } = useAuth();
    const resolvedPortal = getPortal(userProfile?.role);

    if (!resolvedPortal) {
        return <ProfileResolutionState />;
    }

    if (resolvedPortal !== portal) {
        return <Navigate to={resolvedPortal === 'ops' ? '/ops/fila' : '/client/solicitacoes'} replace />;
    }

    return children;
}

function RequirePermission({ permission, children }) {
    const { userProfile } = useAuth();

    if (!hasPermission(userProfile?.role, permission)) {
        return (
            <AccessState
                title="Acesso restrito"
                message="Seu perfil atual nao possui permissao confirmada para acessar esta area do sistema."
                allowRetry={false}
                allowLogout={false}
            />
        );
    }

    return children;
}

function AppRoutes() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />

                <Route
                    path="/"
                    element={(
                        <RequireAuth>
                            <PortalHomeRedirect />
                        </RequireAuth>
                    )}
                />

                <Route
                    path="/client"
                    element={(
                        <RequireAuth>
                            <RequirePortal portal="client">
                                <AppLayout title="Portal Cliente" />
                            </RequirePortal>
                        </RequireAuth>
                    )}
                >
                    <Route index element={<Navigate to="solicitacoes" replace />} />
                    <Route
                        path="solicitacoes"
                        element={(
                            <RequirePermission permission={PERMISSIONS.CASE_READ}>
                                <SolicitacoesPage />
                            </RequirePermission>
                        )}
                    />
                    <Route
                        path="nova-solicitacao"
                        element={(
                            <RequirePermission permission={PERMISSIONS.CASE_CREATE_REQUEST}>
                                <NovaSolicitacaoPage />
                            </RequirePermission>
                        )}
                    />
                    <Route
                        path="candidatos"
                        element={(
                            <RequirePermission permission={PERMISSIONS.CASE_READ}>
                                <CandidatosPage />
                            </RequirePermission>
                        )}
                    />
                    <Route
                        path="exportacoes"
                        element={(
                            <RequirePermission permission={PERMISSIONS.CASE_EXPORT}>
                                <ExportacoesPage />
                            </RequirePermission>
                        )}
                    />
                </Route>

                <Route
                    path="/ops"
                    element={(
                        <RequireAuth>
                            <RequirePortal portal="ops">
                                <AppLayout title="Portal Operacional" />
                            </RequirePortal>
                        </RequireAuth>
                    )}
                >
                    <Route index element={<Navigate to="fila" replace />} />
                    <Route
                        path="fila"
                        element={(
                            <RequirePermission permission={PERMISSIONS.CASE_READ}>
                                <FilaPage />
                            </RequirePermission>
                        )}
                    />
                    <Route
                        path="caso/:caseId"
                        element={(
                            <RequirePermission permission={PERMISSIONS.CASE_WRITE}>
                                <CasoPage />
                            </RequirePermission>
                        )}
                    />
                    <Route
                        path="casos"
                        element={(
                            <RequirePermission permission={PERMISSIONS.CASE_READ}>
                                <CasosPage />
                            </RequirePermission>
                        )}
                    />
                    <Route
                        path="candidatos"
                        element={(
                            <RequirePermission permission={PERMISSIONS.CASE_READ}>
                                <CandidatosPage />
                            </RequirePermission>
                        )}
                    />
                    <Route
                        path="clientes"
                        element={(
                            <RequirePermission permission={PERMISSIONS.USERS_MANAGE}>
                                <ClientesPage />
                            </RequirePermission>
                        )}
                    />
                    <Route
                        path="auditoria"
                        element={(
                            <RequirePermission permission={PERMISSIONS.AUDIT_VIEW}>
                                <AuditoriaPage />
                            </RequirePermission>
                        )}
                    />
                </Route>

                <Route
                    path="/demo/client"
                    element={(
                        <DemoProviders mode="client">
                            <AppLayout title="Portal Cliente Demo" />
                        </DemoProviders>
                    )}
                >
                    <Route index element={<Navigate to="solicitacoes" replace />} />
                    <Route path="solicitacoes" element={<SolicitacoesPage />} />
                    <Route path="nova-solicitacao" element={<NovaSolicitacaoPage />} />
                    <Route path="candidatos" element={<CandidatosPage />} />
                    <Route path="exportacoes" element={<ExportacoesPage />} />
                </Route>

                <Route
                    path="/demo/ops"
                    element={(
                        <DemoProviders mode="ops">
                            <AppLayout title="Portal Operacional Demo" />
                        </DemoProviders>
                    )}
                >
                    <Route index element={<Navigate to="fila" replace />} />
                    <Route path="fila" element={<FilaPage />} />
                    <Route path="caso/:caseId" element={<CasoPage />} />
                    <Route path="casos" element={<CasosPage />} />
                    <Route path="candidatos" element={<CandidatosPage />} />
                    <Route path="auditoria" element={<AuditoriaPage />} />
                </Route>

                <Route path="/r/:token" element={<PublicReportPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

function App() {
    return (
        <AuthProvider>
            <TenantProvider>
                <AppRoutes />
            </TenantProvider>
        </AuthProvider>
    );
}

export default App;
