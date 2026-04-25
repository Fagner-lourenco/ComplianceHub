import AppSidebar from '../../shared/layouts/AppSidebar';
import TopProductHeader from '../components/TopProductHeader';

export default function DossierLayout({ children }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopProductHeader />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
