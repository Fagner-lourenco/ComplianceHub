import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import AppRoutes from './AppRoutes';
import { useAuth } from './core/auth/useAuth';
import { useTheme } from './core/contexts/useTheme';
import { useTenant } from './core/contexts/useTenant';

vi.mock('./core/auth/useAuth');
vi.mock('./core/contexts/useTheme');
vi.mock('./core/contexts/useTenant');

describe('App routing', () => {
  beforeEach(() => {
    useTheme.mockReturnValue({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() });
    useTenant.mockReturnValue({ selectedTenantId: null, selectedTenantLabel: 'Todos' });
  });

  it('renders login page at /login', () => {
    useAuth.mockReturnValue({ user: null, loading: false, hasResolvedProfile: true });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /compliancehub/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar na conta/i })).toBeInTheDocument();
  });

  it('redirects to login when accessing protected route unauthenticated', () => {
    useAuth.mockReturnValue({ user: null, loading: false, hasResolvedProfile: true });
    render(
      <MemoryRouter initialEntries={['/dossie']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /compliancehub/i })).toBeInTheDocument();
  });

  it('redirects root to /dossie when authenticated', () => {
    useAuth.mockReturnValue({ user: { uid: '123' }, loading: false, hasResolvedProfile: true });
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
  });
});
