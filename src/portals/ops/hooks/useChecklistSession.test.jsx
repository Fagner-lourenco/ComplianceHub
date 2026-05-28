import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useChecklistSession } from './useChecklistSession';

function Harness({ caseId = 'case-1', items }) {
    const checklist = useChecklistSession(caseId, items);
    return (
        <div>
            <span data-testid="progress">{checklist.completedCount}/{checklist.totalCount}</span>
            <span data-testid="complete">{checklist.isComplete ? 'yes' : 'no'}</span>
            <button type="button" onClick={() => checklist.setItemChecked('criminal', true)}>check-criminal</button>
            <button type="button" onClick={() => checklist.setItemChecked('criminal', false)}>uncheck-criminal</button>
        </div>
    );
}

describe('useChecklistSession', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
    });

    it('persiste checklist por caso no sessionStorage', () => {
        const items = [
            { key: 'criminal', label: 'Criminal' },
            { key: 'labor', label: 'Trabalhista' },
        ];
        const { rerender } = render(<Harness caseId="abc" items={items} />);

        expect(screen.getByTestId('progress').textContent).toBe('0/2');
        act(() => screen.getByText('check-criminal').click());
        expect(screen.getByTestId('progress').textContent).toBe('1/2');

        rerender(<Harness caseId="abc" items={items} />);
        expect(screen.getByTestId('progress').textContent).toBe('1/2');
        expect(window.sessionStorage.getItem('compliancehub:case-checklist:abc')).toContain('criminal');
    });

    it('nao compartilha estado entre casos', () => {
        const items = [{ key: 'criminal', label: 'Criminal' }];
        const { rerender } = render(<Harness caseId="abc" items={items} />);

        act(() => screen.getByText('check-criminal').click());
        expect(screen.getByTestId('complete').textContent).toBe('yes');

        rerender(<Harness caseId="xyz" items={items} />);
        expect(screen.getByTestId('progress').textContent).toBe('0/1');
        expect(screen.getByTestId('complete').textContent).toBe('no');
    });
});
