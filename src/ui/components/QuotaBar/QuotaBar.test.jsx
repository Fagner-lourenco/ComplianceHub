import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import QuotaBar, { QuotaSummaryCard } from './QuotaBar';

// ── getZone (testado indiretamente via CSS classes) ──────────────────────────

describe('QuotaBar', () => {
    it('retorna null quando limit eh null/undefined/0', () => {
        const { container } = render(<QuotaBar label="Teste" count={5} limit={null} />);
        expect(container.innerHTML).toBe('');

        const { container: c2 } = render(<QuotaBar label="Teste" count={5} limit={0} />);
        expect(c2.innerHTML).toBe('');

        const { container: c3 } = render(<QuotaBar label="Teste" count={5} />);
        expect(c3.innerHTML).toBe('');
    });

    it('renderiza progressbar com atributos aria corretos', () => {
        render(<QuotaBar label="Hoje" count={5} limit={10} />);

        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuenow', '5');
        expect(bar).toHaveAttribute('aria-valuemin', '0');
        expect(bar).toHaveAttribute('aria-valuemax', '10');
        expect(bar).toHaveAttribute('aria-label', 'Hoje: 5 de 10');
    });

    it('mostra contagem como count/limit', () => {
        render(<QuotaBar label="Hoje" count={3} limit={10} />);
        expect(screen.getByText('3/10')).toBeInTheDocument();
    });

    it('zona ok — ratio < 0.8', () => {
        const { container } = render(<QuotaBar label="Hoje" count={7} limit={10} />);
        expect(container.querySelector('.quota-bar__count--ok')).toBeInTheDocument();
    });

    it('zona warning — ratio >= 0.8 e < 1', () => {
        const { container } = render(<QuotaBar label="Hoje" count={8} limit={10} />);
        expect(container.querySelector('.quota-bar__count--warning')).toBeInTheDocument();
    });

    it('zona exceeded — ratio >= 1', () => {
        const { container } = render(<QuotaBar label="Hoje" count={10} limit={10} />);
        expect(container.querySelector('.quota-bar__count--exceeded')).toBeInTheDocument();
    });

    it('nao mostra excess label quando count <= limit', () => {
        render(<QuotaBar label="Hoje" count={10} limit={10} />);
        expect(screen.queryByText(/excedente/i)).not.toBeInTheDocument();
        expect(screen.queryByText('Limite atingido')).not.toBeInTheDocument();
    });

    it('mostra "Limite atingido" quando count > limit e !allowExceedance', () => {
        render(<QuotaBar label="Hoje" count={12} limit={10} allowExceedance={false} />);
        expect(screen.getByText('Limite atingido')).toBeInTheDocument();
    });

    it('mostra contagem excedente quando count > limit e allowExceedance', () => {
        render(<QuotaBar label="Hoje" count={13} limit={10} allowExceedance={true} />);
        expect(screen.getByText('+3 excedentes')).toBeInTheDocument();
    });

    it('excedente singular (+1 excedente)', () => {
        render(<QuotaBar label="Hoje" count={11} limit={10} allowExceedance={true} />);
        expect(screen.getByText('+1 excedente')).toBeInTheDocument();
    });

    it('aplica classe compact quando prop eh true', () => {
        const { container } = render(<QuotaBar label="Hoje" count={1} limit={10} compact />);
        expect(container.querySelector('.quota-bar--compact')).toBeInTheDocument();
    });

    it('fill width eh limitado a 100%', () => {
        const { container } = render(<QuotaBar label="Hoje" count={20} limit={10} />);
        const fill = container.querySelector('.quota-bar__fill');
        expect(fill.style.width).toBe('100%');
    });
});

describe('QuotaSummaryCard', () => {
    it('retorna null quando quota eh null', () => {
        const { container } = render(<QuotaSummaryCard quota={null} />);
        expect(container.innerHTML).toBe('');
    });

    it('retorna null quando quota.hasLimits eh false', () => {
        const { container } = render(<QuotaSummaryCard quota={{ hasLimits: false }} />);
        expect(container.innerHTML).toBe('');
    });

    it('renderiza titulo e duas barras (Hoje + Mes) com quota completa', () => {
        render(
            <QuotaSummaryCard
                quota={{
                    hasLimits: true,
                    dailyCount: 5,
                    dailyLimit: 10,
                    monthlyCount: 25,
                    monthlyLimit: 100,
                    allowDailyExceedance: true,
                    allowMonthlyExceedance: false,
                }}
            />,
        );

        expect(screen.getByText('Consumo de Consultas')).toBeInTheDocument();
        expect(screen.getByText('5/10')).toBeInTheDocument();    // diario
        expect(screen.getByText('25/100')).toBeInTheDocument();  // mensal

        const bars = screen.getAllByRole('progressbar');
        expect(bars).toHaveLength(2);
    });

    it('nao renderiza barra quando limit individual eh null', () => {
        render(
            <QuotaSummaryCard
                quota={{
                    hasLimits: true,
                    dailyCount: 5,
                    dailyLimit: 10,
                    monthlyCount: 0,
                    monthlyLimit: null,
                    allowDailyExceedance: false,
                    allowMonthlyExceedance: false,
                }}
            />,
        );

        // Apenas barra diaria aparece (mensal tem limit null → QuotaBar retorna null)
        const bars = screen.getAllByRole('progressbar');
        expect(bars).toHaveLength(1);
    });
});
