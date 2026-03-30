import { useEffect, useRef, useState } from 'react';
import './Drawer.css';

export default function Drawer({ open, onClose, title, subtitle, headerExtra, tabs, children }) {
    const [activeTab, setActiveTab] = useState(0);
    const [prevOpen, setPrevOpen] = useState(open);
    const closeRef = useRef(null);

    // Reset tab when drawer opens (React-recommended pattern for prop-derived state)
    if (open && !prevOpen) {
        setActiveTab(0);
    }
    if (open !== prevOpen) {
        setPrevOpen(open);
    }

    // Focus close button on open
    useEffect(() => {
        if (open) {
            closeRef.current?.focus();
        }
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    // Lock body scroll while open
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    if (!open) return null;

    const tabContent = tabs ? tabs[activeTab]?.content : children;

    return (
        <>
            <div className="drawer-overlay" onClick={onClose} />
            <aside className="drawer" role="dialog" aria-modal="true" aria-label={title || 'Painel de detalhes'}>
                <div className="drawer__header">
                    <div className="drawer__header-text">
                        <h2 className="drawer__title">{title}</h2>
                        {subtitle && <p className="drawer__subtitle">{subtitle}</p>}
                    </div>
                    {headerExtra && <div className="drawer__header-extra">{headerExtra}</div>}
                    <button ref={closeRef} className="drawer__close" onClick={onClose} aria-label="Fechar painel">✕</button>
                </div>

                {tabs && tabs.length > 0 && (
                    <div className="drawer__tabs" role="tablist">
                        {tabs.map((tab, i) => (
                            <button
                                key={tab.label || i}
                                role="tab"
                                aria-selected={i === activeTab}
                                className={`drawer__tab ${i === activeTab ? 'drawer__tab--active' : ''}`}
                                onClick={() => setActiveTab(i)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="drawer__body" role="tabpanel">
                    {tabContent}
                </div>
            </aside>
        </>
    );
}
