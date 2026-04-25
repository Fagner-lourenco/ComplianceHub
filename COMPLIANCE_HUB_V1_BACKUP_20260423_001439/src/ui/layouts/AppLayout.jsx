import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './AppLayout.css';

export default function AppLayout({ title = 'ComplianceHub' }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const topbarRef = useRef(null);
    const closeSidebarOnRouteChange = useEffectEvent(() => {
        setIsSidebarOpen(false);
    });

    useEffect(() => {
        closeSidebarOnRouteChange();
    }, [location.pathname]);

    useEffect(() => {
        if (!isSidebarOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isSidebarOpen]);

    useEffect(() => {
        const topbarElement = topbarRef.current;
        const mainElement = topbarElement?.closest('.app-layout__main');
        if (!topbarElement || !mainElement) return undefined;

        const applyTopbarHeight = () => {
            const nextHeight = `${Math.ceil(topbarElement.getBoundingClientRect().height)}px`;
            mainElement.style.setProperty('--app-topbar-current-height', nextHeight);
            mainElement.style.setProperty('--drawer-top-offset', nextHeight);
        };

        applyTopbarHeight();

        const resizeObserver = new ResizeObserver(() => {
            applyTopbarHeight();
        });
        resizeObserver.observe(topbarElement);
        window.addEventListener('resize', applyTopbarHeight);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', applyTopbarHeight);
        };
    }, []);

    return (
        <div className={`app-layout ${isSidebarOpen ? 'app-layout--sidebar-open' : ''}`}>
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            
            {/* Overlay for mobile when sidebar is open */}
            {isSidebarOpen && (
                <div 
                    className="sidebar-overlay" 
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            <div className="app-layout__main">
                <Topbar topbarRef={topbarRef} title={title} onMenuClick={() => setIsSidebarOpen(true)} />
                <main className="app-layout__content" aria-label="Conteudo principal">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
