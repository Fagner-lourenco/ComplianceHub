import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('renders with known kind', () => {
    render(<StatusBadge kind="Concluído" />);
    expect(screen.getByText('Concluído')).toBeInTheDocument();
  });

  it('renders with unknown kind using fallback style', () => {
    render(<StatusBadge kind="Desconhecido" />);
    expect(screen.getByText('Desconhecido')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBadge kind="Processando" className="extra-class" />);
    expect(container.firstChild).toHaveClass('extra-class');
  });

  it('renders all known statuses', () => {
    const statuses = ['Com resultado', 'Concluído', 'Nenhum resultado', 'Indisponível', 'Aguardando revisão', 'Processando', 'Criado', 'Na fila', 'Iniciar'];
    render(
      <div>
        {statuses.map((s) => (
          <StatusBadge key={s} kind={s} />
        ))}
      </div>,
    );
    statuses.forEach((s) => {
      expect(screen.getByText(s)).toBeInTheDocument();
    });
  });
});
