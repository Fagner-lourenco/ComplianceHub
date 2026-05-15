import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Drawer from './Drawer';

describe('Drawer', () => {
    it('renderiza via portal e fica acessivel por role dialog', () => {
        render(<Drawer open title="Detalhes">Conteudo do drawer</Drawer>);

        expect(screen.getByRole('dialog', { name: 'Detalhes' })).toBeInTheDocument();
        expect(screen.getByText('Conteudo do drawer')).toBeInTheDocument();
    });

    it('fecha com Escape e clique no overlay', () => {
        const onClose = vi.fn();
        render(<Drawer open title="Detalhes" onClose={onClose}>Conteudo</Drawer>);

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(document.querySelector('.drawer-overlay'));
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
