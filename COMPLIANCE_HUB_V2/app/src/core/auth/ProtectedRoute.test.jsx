import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from './useAuth';

vi.mock('./useAuth');

function MockPage() {
  return <div data-testid="protected-page">Protected Content</div>;
}

describe('ProtectedRoute', () => {
  it('shows loading state while auth is resolving', () => {
    useAuth.mockReturnValue({ user: null, loading: true, hasResolvedProfile: false });
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <MockPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', () => {
    useAuth.mockReturnValue({ user: null, loading: false, hasResolvedProfile: true });
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <MockPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    useAuth.mockReturnValue({ user: { uid: '123' }, loading: false, hasResolvedProfile: true });
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <MockPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('protected-page')).toBeInTheDocument();
  });
});
