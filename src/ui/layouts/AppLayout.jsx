import { useEffect, useEffectEvent, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './AppLayout.css';

export default function AppLayout({ title = 'ComplianceHub' }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const closeSidebarOnRouteChange = useEffectEvent(() => {
        setIsSidebarOpen(false);
    });

    useEffect(() => {
        closeSidebarOnRouteChange();
    }, [location.pathname]);

    return (
        <div className="app-layout">
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
                <Topbar title={title} onMenuClick={() => setIsSidebarOpen(true)} />
                <main className="app-layout__content" aria-label="Conteudo principal">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
