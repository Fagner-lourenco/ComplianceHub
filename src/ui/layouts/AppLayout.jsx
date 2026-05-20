import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import NotificationToast from '../components/NotificationToast/NotificationToast';
import './AppLayout.css';

export default function AppLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const topbarRef = useRef(null);
    useEffect(() => {
        const syncTimer = window.setTimeout(() => setIsSidebarOpen(false), 0);
        return () => window.clearTimeout(syncTimer);
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
                <Topbar topbarRef={topbarRef} onMenuClick={() => setIsSidebarOpen(true)} />
                <main className="app-layout__content" aria-label="Conteudo principal">
                    <Outlet />
                </main>
                <NotificationToast />
            </div>
        </div>
    );
}
