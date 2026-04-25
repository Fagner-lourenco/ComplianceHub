import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function ThrowError() {
    throw new Error('Test error');
}

describe('ErrorBoundary', () => {
    it('renderiza children quando nao ha erro', () => {
        render(
            <ErrorBoundary>
                <div data-testid="child">Filho OK</div>
            </ErrorBoundary>,
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renderiza fallback de erro quando child lanca excecao', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>,
        );
        expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
        expect(screen.getByText(/Ocorreu um erro inesperado/i)).toBeInTheDocument();
        expect(screen.getByText('Recarregar pagina')).toBeInTheDocument();
        consoleError.mockRestore();
    });

    it('captura erro e exibe mensagem amigavel', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>,
        );
        expect(screen.getByRole('heading', { name: /algo deu errado/i })).toBeInTheDocument();
        consoleError.mockRestore();
    });

    it('renderiza multiplos children corretamente', () => {
        render(
            <ErrorBoundary>
                <div data-testid="child1">Child 1</div>
                <div data-testid="child2">Child 2</div>
            </ErrorBoundary>,
        );
        expect(screen.getByTestId('child1')).toBeInTheDocument();
        expect(screen.getByTestId('child2')).toBeInTheDocument();
    });
});
