import { useEffect, useId, useRef, useState } from 'react';
import './Drawer.css';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container) {
    if (!container) return [];
    return [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
        .filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));
}

export default function Drawer({ open, onClose, title, subtitle, headerExtra, tabs, children }) {
    const [activeTab, setActiveTab] = useState(0);
    const closeRef = useRef(null);
    const drawerRef = useRef(null);
    const previouslyFocusedRef = useRef(null);
    const titleId = useId();
    const panelIdBase = useId();

    useEffect(() => {
        if (open) {
            const syncTimer = window.setTimeout(() => setActiveTab(0), 0);
            return () => window.clearTimeout(syncTimer);
        }
        return undefined;
    }, [open]);

    useEffect(() => {
        if (open) {
            previouslyFocusedRef.current = document.activeElement;
            const timer = window.setTimeout(() => {
                const focusable = getFocusableElements(drawerRef.current);
                (focusable[0] || closeRef.current)?.focus();
            }, 0);
            return () => window.clearTimeout(timer);
        }

        if (previouslyFocusedRef.current?.focus) {
            previouslyFocusedRef.current.focus();
        }
        return undefined;
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
                return;
            }

            if (event.key !== 'Tab') return;
            const focusable = getFocusableElements(drawerRef.current);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const activeElement = document.activeElement;

            if (event.shiftKey) {
                if (activeElement === first || !drawerRef.current?.contains(activeElement)) {
                    event.preventDefault();
                    last.focus();
                }
                return;
            }

            if (activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [open]);

    if (!open) return null;

    const tabContent = tabs ? tabs[activeTab]?.content : children;

    return (
        <>
            <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
            <aside
                ref={drawerRef}
                className="drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={subtitle ? `${titleId}-subtitle` : undefined}
            >
                <div className="drawer__header">
                    <div className="drawer__header-text">
                        <h2 id={titleId} className="drawer__title">{title}</h2>
                        {subtitle ? <p id={`${titleId}-subtitle`} className="drawer__subtitle">{subtitle}</p> : null}
                    </div>
                    {headerExtra ? <div className="drawer__header-extra">{headerExtra}</div> : null}
                    <button ref={closeRef} className="drawer__close" onClick={onClose} aria-label="Fechar painel">×</button>
                </div>

                {tabs && tabs.length > 0 ? (
                    <div className="drawer__tabs" role="tablist">
                        {tabs.map((tab, index) => (
                            <button
                                key={tab.label || index}
                                role="tab"
                                id={`${panelIdBase}-tab-${index}`}
                                aria-controls={`${panelIdBase}-panel-${index}`}
                                aria-selected={index === activeTab}
                                className={`drawer__tab ${index === activeTab ? 'drawer__tab--active' : ''}`}
                                onClick={() => setActiveTab(index)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                ) : null}

                <div
                    className="drawer__body"
                    role="tabpanel"
                    id={`${panelIdBase}-panel-${activeTab}`}
                    aria-labelledby={tabs?.length ? `${panelIdBase}-tab-${activeTab}` : undefined}
                >
                    {tabContent}
                </div>
            </aside>
        </>
    );
}
