import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ChecklistModal from './ChecklistModal';

describe('ChecklistModal', () => {
    it('renderiza itens e permite marcar uma fase revisada', () => {
        const onToggleItem = vi.fn();
        render(
            <ChecklistModal
                open
                onClose={() => {}}
                items={[
                    { key: 'criminal', label: 'Criminal', checked: false },
                    { key: 'labor', label: 'Trabalhista', checked: true },
                ]}
                completedCount={1}
                totalCount={2}
                onToggleItem={onToggleItem}
            />,
        );

        expect(screen.getByText('Checklist operacional')).toBeInTheDocument();
        expect(screen.getByText('1 de 2 fases revisadas')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Marcar Criminal como revisada'));
        expect(onToggleItem).toHaveBeenCalledWith('criminal', true);
    });
});
