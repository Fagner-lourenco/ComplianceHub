import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './AppLayout.css';

export default function AppLayout({ title = 'ComplianceHub' }) {
    return (
        <div className="app-layout">
            <Sidebar />
            <div className="app-layout__main">
                <Topbar title={title} />
                <main className="app-layout__content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
