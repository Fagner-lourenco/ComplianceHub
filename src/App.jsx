import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './core/auth/AuthContext';
import AppLayout from './ui/layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import SolicitacoesPage from './portals/client/SolicitacoesPage';
import NovaSolicitacaoPage from './portals/client/NovaSolicitacaoPage';
import CandidatosPage from './portals/client/CandidatosPage';
import ExportacoesPage from './portals/client/ExportacoesPage';
import FilaPage from './portals/ops/FilaPage';
import CasoPage from './portals/ops/CasoPage';
import CasosPage from './portals/ops/CasosPage';
import AuditoriaPage from './portals/ops/AuditoriaPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Client Portal */}
          <Route path="/client" element={<AppLayout title="Portal Cliente" />}>
            <Route index element={<Navigate to="solicitacoes" replace />} />
            <Route path="solicitacoes" element={<SolicitacoesPage />} />
            <Route path="nova-solicitacao" element={<NovaSolicitacaoPage />} />
            <Route path="candidatos" element={<CandidatosPage />} />
            <Route path="exportacoes" element={<ExportacoesPage />} />
          </Route>

          {/* Operations Portal */}
          <Route path="/ops" element={<AppLayout title="Portal Operacional" />}>
            <Route index element={<Navigate to="fila" replace />} />
            <Route path="fila" element={<FilaPage />} />
            <Route path="caso/:caseId" element={<CasoPage />} />
            <Route path="casos" element={<CasosPage />} />
            <Route path="candidatos" element={<CandidatosPage />} />
            <Route path="auditoria" element={<AuditoriaPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
