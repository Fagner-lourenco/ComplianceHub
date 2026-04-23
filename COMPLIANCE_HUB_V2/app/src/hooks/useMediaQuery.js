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
            setMatches(false);
            return undefined;
        }

        const mediaQuery = window.matchMedia(query);
        const handler = (event) => setMatches(event.matches);

        setMatches(mediaQuery.matches);
        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        }

        mediaQuery.addListener(handler);
        return () => mediaQuery.removeListener(handler);
    }, [query]);

    return matches;
}
