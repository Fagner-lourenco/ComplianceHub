import { useEffect, useRef } from 'react';

/**
 * Hook para auto-resize de textareas baseado em conteúdo.
 * Redimensiona suavemente sem flicker ou salto de cursor.
 * @param {number} maxHeight - Altura máxima em pixels (default: 480)
 * @returns {React.RefObject} ref para anexar ao textarea
 */
export default function useAutoResize(maxHeight = 480) {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const resize = () => {
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
        };

        el.addEventListener('input', resize);
        resize(); // inicial

        return () => el.removeEventListener('input', resize);
    }, [maxHeight]);

    return ref;
}
