import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'CH_THEME_PREFERENCE';
const VALID = new Set(['system', 'light', 'dark']);

/* ── Tiny external store so every consumer stays in sync ── */
let listeners = new Set();
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function emit() { listeners.forEach((cb) => cb()); }

function readPreference() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return VALID.has(raw) ? raw : 'light';
}

function resolveTheme(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
}

function applyTheme(resolved) {
    document.documentElement.setAttribute('data-theme', resolved);
}

/* Apply immediately on module load (imported by main.jsx before React renders) */
applyTheme(resolveTheme(readPreference()));

export default function useTheme() {
    const preference = useSyncExternalStore(subscribe, readPreference);
    const resolved = resolveTheme(preference);

    /* Keep DOM in sync whenever resolved theme changes */
    useEffect(() => { applyTheme(resolved); }, [resolved]);

    /* Listen for OS preference changes when in "system" mode */
    useEffect(() => {
        if (preference !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => { applyTheme(resolveTheme('system')); emit(); };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [preference]);

    const setTheme = useCallback((value) => {
        if (!VALID.has(value)) return;
        localStorage.setItem(STORAGE_KEY, value);
        applyTheme(resolveTheme(value));
        emit();
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(resolved === 'dark' ? 'light' : 'dark');
    }, [resolved, setTheme]);

    return { preference, resolved, setTheme, toggleTheme };
}
