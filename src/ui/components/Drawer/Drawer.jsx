import { useState } from 'react';
import './Drawer.css';

export default function Drawer({ open, onClose, title, subtitle, headerExtra, tabs, children }) {
    const [activeTab, setActiveTab] = useState(0);

    if (!open) return null;

    const tabContent = tabs ? tabs[activeTab]?.content : children;

    return (
        <>
            <div className="drawer-overlay" onClick={onClose} />
            <aside className="drawer">
                <div className="drawer__header">
                    <div className="drawer__header-text">
                        <h2 className="drawer__title">{title}</h2>
                        {subtitle && <p className="drawer__subtitle">{subtitle}</p>}
                    </div>
                    {headerExtra && <div className="drawer__header-extra">{headerExtra}</div>}
                    <button className="drawer__close" onClick={onClose}>✕</button>
                </div>

                {tabs && tabs.length > 0 && (
                    <div className="drawer__tabs">
                        {tabs.map((tab, i) => (
                            <button
                                key={i}
                                className={`drawer__tab ${i === activeTab ? 'drawer__tab--active' : ''}`}
                                onClick={() => setActiveTab(i)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="drawer__body">
                    {tabContent}
                </div>
            </aside>
        </>
    );
}
