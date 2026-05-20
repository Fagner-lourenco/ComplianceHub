import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

describe('Modal', () => {
    it('renderiza via portal e fica acessivel por role dialog', () => {
        render(<Modal open title="Confirmacao">Conteudo do modal</Modal>);

        expect(screen.getByRole('dialog', { name: 'Confirmacao' })).toBeInTheDocument();
        expect(screen.getByText('Conteudo do modal')).toBeInTheDocument();
    });

    it('fecha com Escape e clique no overlay', () => {
        const onClose = vi.fn();
        render(<Modal open title="Confirmacao" onClose={onClose}>Conteudo</Modal>);

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Confirmacao' }).parentElement);
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
