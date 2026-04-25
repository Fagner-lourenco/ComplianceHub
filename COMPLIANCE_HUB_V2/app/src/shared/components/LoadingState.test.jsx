import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LoadingState from './LoadingState';

describe('LoadingState', () => {
  it('renders with default rows and columns', () => {
    render(<LoadingState />);
    expect(screen.getByRole('status', { name: /carregando/i })).toBeInTheDocument();
  });

  it('renders custom rows and columns', () => {
    const { container } = render(<LoadingState rows={3} columns={2} />);
    const rows = container.querySelectorAll('[class*="flex items-center gap-3"]');
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
