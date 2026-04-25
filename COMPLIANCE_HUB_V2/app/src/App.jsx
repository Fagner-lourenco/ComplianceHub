import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { ThemeProvider } from './core/contexts/ThemeContext';
import { AuthProvider } from './core/auth/AuthContext';
import { TenantProvider } from './core/contexts/TenantContext';
import { ToastProvider } from './shared/contexts/ToastContext';

function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TenantProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </TenantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
