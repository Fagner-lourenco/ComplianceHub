import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedField } from './useDebouncedField';

describe('useDebouncedField', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('retorna valor inicial', () => {
        const { result } = renderHook(() => useDebouncedField('initial', vi.fn()));
        expect(result.current[0]).toBe('initial');
    });

    it('atualiza valor local imediatamente', () => {
        const { result } = renderHook(() => useDebouncedField('', vi.fn()));
        act(() => {
            result.current[1]('new value');
        });
        expect(result.current[0]).toBe('new value');
    });

    it('chama onCommit após debounce', () => {
        const onCommit = vi.fn();
        const { result } = renderHook(() => useDebouncedField('', onCommit, 400));

        act(() => {
            result.current[1]('test');
        });

        expect(onCommit).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(400);
        });

        expect(onCommit).toHaveBeenCalledWith('test');
    });

    it('reseta timer em mudanças rápidas', () => {
        const onCommit = vi.fn();
        const { result } = renderHook(() => useDebouncedField('', onCommit, 400));

        act(() => {
            result.current[1]('a');
        });

        act(() => {
            vi.advanceTimersByTime(200);
            result.current[1]('b');
        });

        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(onCommit).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(onCommit).toHaveBeenCalledWith('b');
    });

    it('sincroniza com valor externo quando muda', async () => {
        const onCommit = vi.fn();
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedField(value, onCommit, 400),
            { initialProps: { value: 'initial' } }
        );

        expect(result.current[0]).toBe('initial');

        act(() => {
            rerender({ value: 'external' });
        });

        // Allow queueMicrotask to execute in fake timers environment
        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current[0]).toBe('external');
    });

    it('nao sobrescreve valor local quando usuario esta editando', () => {
        const onCommit = vi.fn();
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedField(value, onCommit, 400),
            { initialProps: { value: 'initial' } }
        );

        act(() => {
            result.current[1]('local edit');
        });

        expect(result.current[0]).toBe('local edit');

        act(() => {
            rerender({ value: 'external update' });
        });

        // Deve preservar a edição local
        expect(result.current[0]).toBe('local edit');
    });

    it('sincroniza com valor externo apos commit do usuario', async () => {
        const onCommit = vi.fn();
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedField(value, onCommit, 400),
            { initialProps: { value: 'initial' } }
        );

        act(() => {
            result.current[1]('local edit');
        });

        act(() => {
            vi.advanceTimersByTime(400);
        });

        expect(onCommit).toHaveBeenCalledWith('local edit');

        act(() => {
            rerender({ value: 'external update' });
        });

        // Allow queueMicrotask to execute in fake timers environment
        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current[0]).toBe('external update');
    });

    it('chama onDirty imediatamente ao iniciar edicao', () => {
        const onCommit = vi.fn();
        const onDirty = vi.fn();
        const { result } = renderHook(() => useDebouncedField('', onCommit, 400, onDirty));

        act(() => {
            result.current[1]('local edit');
        });

        expect(onDirty).toHaveBeenCalledTimes(1);
        expect(onCommit).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(400);
        });

        expect(onCommit).toHaveBeenCalledWith('local edit');
    });

    it('flush forca commit imediato do valor atual', () => {
        const onCommit = vi.fn();
        const { result } = renderHook(() => useDebouncedField('', onCommit, 400));

        act(() => {
            result.current[1]('local edit');
        });

        expect(onCommit).not.toHaveBeenCalled();

        act(() => {
            result.current[2]();
        });

        expect(onCommit).toHaveBeenCalledWith('local edit');

        // Timer nao deve mais disparar
        act(() => {
            vi.advanceTimersByTime(400);
        });

        expect(onCommit).toHaveBeenCalledTimes(1);
    });
});
