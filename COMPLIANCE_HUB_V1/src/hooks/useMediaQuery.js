import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => {
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            return window.matchMedia(query).matches;
        }
        return false;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(query);
        const handler = (event) => setMatches(event.matches);
        const syncTimer = window.setTimeout(() => setMatches(mediaQuery.matches), 0);

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handler);
            return () => {
                window.clearTimeout(syncTimer);
                mediaQuery.removeEventListener('change', handler);
            };
        }

        mediaQuery.addListener(handler);
        return () => {
            window.clearTimeout(syncTimer);
            mediaQuery.removeListener(handler);
        };
    }, [query]);

    return matches;
}
