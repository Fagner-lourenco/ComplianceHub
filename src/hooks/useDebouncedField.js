import { useState, useCallback, useRef, useLayoutEffect } from 'react';

/**
 * Hook para debounce de campos de formulário.
 * Sincroniza automaticamente quando o valor externo muda, mas preserva
 * edições locais do usuário até que sejam commitadas.
 * @param {string} externalValue - Valor controlado externamente
 * @param {Function} onCommit - Função a ser chamada após o debounce
 * @param {number} delay - Tempo de debounce em ms (default: 400)
 * @param {Function} onDirty - Função opcional chamada imediatamente ao iniciar edição
 * @returns {[string, Function]} - [valor local, handler de change]
 */
export function useDebouncedField(externalValue, onCommit, delay = 400, onDirty = null) {
    const [localValue, setLocalValue] = useState(externalValue);
    const debounceRef = useRef(null);
    const lastExternalValue = useRef(externalValue);
    const hasLocalChanges = useRef(false);
    const currentValueRef = useRef(externalValue);

    useLayoutEffect(() => {
        if (externalValue !== lastExternalValue.current && !hasLocalChanges.current) {
            lastExternalValue.current = externalValue;
            currentValueRef.current = externalValue;
            // Defer setState to avoid synchronous setState in effect lint error
            queueMicrotask(() => setLocalValue(externalValue));
        }
    }, [externalValue]);

    const handleChange = useCallback((value) => {
        hasLocalChanges.current = true;
        currentValueRef.current = value;
        setLocalValue(value);
        if (onDirty) onDirty();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            hasLocalChanges.current = false;
            lastExternalValue.current = value;
            onCommit(value);
        }, delay);
    }, [onCommit, delay, onDirty]);

    const flush = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (hasLocalChanges.current) {
            hasLocalChanges.current = false;
            lastExternalValue.current = currentValueRef.current;
            onCommit(currentValueRef.current);
        }
    }, [onCommit]);

    return [localValue, handleChange, flush];
}
