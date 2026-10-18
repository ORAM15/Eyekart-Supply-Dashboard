import React from 'react';
import { AppProvider, useApp } from './context/AppContext.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { Header } from './components/layout/Header.js';
import { ToastContainer } from './components/common/ToastContainer.js';
import { OrderModal } from './components/orders/OrderModal.js';
import { DashboardView } from './views/DashboardView.js';
import { BranchesView } from './views/BranchesView.js';
import { OrdersView } from './views/OrdersView.js';
import { InventoryView } from './views/InventoryView.js';
import { AlertsView } from './views/AlertsView.js';
import { ActivityLogView } from './views/ActivityLogView.js';
import { ReportsView } from './views/ReportsView.js';
import { ValidationView } from './views/ValidationView.js';
import { SettingsView } from './views/SettingsView.js';
import { AlertCircle, RotateCcw } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeTab, loading, error, refreshData } = useApp();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-800 antialiased selection:bg-teal-500/20 selection:text-teal-900">
      {/* Persistent Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#F8FAFC]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Syncing Eyekart Branch Inventories...
              </p>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl max-w-lg mx-auto my-12 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
              <h3 className="font-bold text-slate-900 text-sm">Connection Synchronization Error</h3>
              <p className="text-xs text-rose-800">{error}</p>
              <button
                onClick={() => refreshData()}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto pb-12">
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'branches' && <BranchesView />}
              {activeTab === 'orders' && <OrdersView />}
              {activeTab === 'inventory' && <InventoryView />}
              {activeTab === 'alerts' && <AlertsView />}
              {activeTab === 'activity' && <ActivityLogView />}
              {activeTab === 'reports' && <ReportsView />}
              {activeTab === 'validation' && <ValidationView />}
              {activeTab === 'settings' && <SettingsView />}
            </div>
          )}
        </main>
      </div>

      {/* Main Receptionist Order Entry Drawer */}
      <OrderModal />

      {/* Toast Notification Layer */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
