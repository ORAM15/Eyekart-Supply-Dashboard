import React, { useState, useMemo } from 'react';
import { AppProvider, useApp } from './context/AppContext.js';
import { CounterCard } from './components/counters/CounterCard.js';
import { CounterStockModal } from './components/counters/CounterStockModal.js';
import { LowStockAlertsBanner } from './components/notifications/LowStockAlertsBanner.js';
import { SimpleMonthlyReportModal } from './components/reports/SimpleMonthlyReportModal.js';
import { ToastContainer } from './components/common/ToastContainer.js';
import {
  Search,
  FileText,
  RotateCcw,
  Glasses,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

const ReceptionistDashboard: React.FC = () => {
  const isSnapshotMode = !import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_EYEKART_LIVE_MODE !== 'true';
  const {
    branches,
    loading,
    error,
    refreshData,
    currentUser,
    switchUser,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'good' | 'low' | 'out'>('all');
  const [selectedCounterIndex, setSelectedCounterIndex] = useState<number | null>(null);
  const [monthlyReportOpen, setMonthlyReportOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual refresh with visual feedback
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  // Map branches to indexed counters
  const counters = useMemo(() => {
    return branches.map((branch, index) => {
      const counterNumber = index + 1;
      const total = branch.inventory.totalOnHand;
      const minRequired = branch.minThreshold || 50;
      const status: 'GOOD' | 'LOW_STOCK' | 'OUT_OF_STOCK' =
        total === 0 ? 'OUT_OF_STOCK' : total < minRequired ? 'LOW_STOCK' : 'GOOD';

      return {
        index,
        counterNumber,
        branch,
        total,
        minRequired,
        status,
      };
    });
  }, [branches]);

  // Counts for summary pills
  const totalStockAll = useMemo(() => {
    return branches.reduce((sum, b) => sum + b.inventory.totalOnHand, 0);
  }, [branches]);

  const goodCount = useMemo(() => {
    return counters.filter((c) => c.status === 'GOOD').length;
  }, [counters]);

  const lowStockCount = useMemo(() => {
    return counters.filter((c) => c.status === 'LOW_STOCK').length;
  }, [counters]);

  const outOfStockCount = useMemo(() => {
    return counters.filter((c) => c.status === 'OUT_OF_STOCK').length;
  }, [counters]);

  // Filter counters based on search query and active filter
  const filteredCounters = useMemo(() => {
    let result = counters;

    // Filter mode
    if (filterMode === 'good') {
      result = result.filter((c) => c.status === 'GOOD');
    } else if (filterMode === 'low') {
      result = result.filter((c) => c.status === 'LOW_STOCK');
    } else if (filterMode === 'out') {
      result = result.filter((c) => c.status === 'OUT_OF_STOCK');
    }

    // Search query: matches counter number ("12", "Counter 12") or branch name
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => {
        const counterName = `counter ${c.counterNumber}`;
        const counterNumberStr = String(c.counterNumber);
        const branchName = c.branch.name.toLowerCase();
        const originalName = c.branch.originalName?.toLowerCase() || '';

        return (
          counterName.includes(q) ||
          counterNumberStr === q ||
          branchName.includes(q) ||
          originalName.includes(q)
        );
      });
    }

    return result;
  }, [counters, filterMode, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 antialiased flex flex-col selection:bg-teal-500/20 selection:text-teal-900">
      
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            
            {/* Brand Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/30 shrink-0">
                <Glasses className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                    Eyekart Healthcare Limited
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider bg-teal-100 text-teal-800 uppercase">
                    Kenya
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Eyewear Stock & Counter Management Dashboard
                </p>
              </div>
            </div>

            {/* Actions: Search bar & Monthly Report button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              
              {/* Search Bar */}
              <div className="relative min-w-[260px] sm:min-w-[320px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search counter number or branch..."
                  className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-500/20 transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh stock counts from database"
                className="p-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl transition-colors shrink-0 flex items-center justify-center"
                aria-label="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
              </button>

              {/* 5. SINGLE CLEARLY LABELLED 'Monthly Report' BUTTON */}
              <button
                onClick={() => setMonthlyReportOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-teal-700/20 transition-all shrink-0 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Monthly Report</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isSnapshotMode && (
          <div role="status" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
            <div className="font-extrabold uppercase tracking-wide">Read-only snapshot mode</div>
            <p className="mt-1">
              Branch figures use the SSD Frame List baseline (3,740 frames). Warehouse stock and transaction history are not verified in this snapshot.
              Stock edits, orders, and admin actions are blocked until a secure, persistent backend is connected. The role switcher is a demo control, not authentication.
              Do not use this preview for live stock operations.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Loading All 35 Counters & Inventory...
            </p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl max-w-md mx-auto my-12 text-center space-y-3">
            <XCircle className="w-10 h-10 text-red-600 mx-auto" />
            <h3 className="font-bold text-slate-900 text-sm">Connection Error</h3>
            <p className="text-xs text-red-800">{error}</p>
            <button
              onClick={() => refreshData()}
              className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          <>
            {/* 3. AUTOMATIC LOW-STOCK NOTIFICATIONS BANNER */}
            <LowStockAlertsBanner
              branches={branches}
              onSelectCounter={(index) => setSelectedCounterIndex(index)}
            />

            {/* QUICK STATS & FILTER BAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              
              {/* Left: Summary text */}
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  Counters Stock Overview
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Showing {filteredCounters.length} of {branches.length} counters • Total stock in network: <strong className="text-slate-800 font-bold">{totalStockAll.toLocaleString()} frames</strong>
                </p>
              </div>

              {/* Right: Quick Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterMode === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  All ({counters.length})
                </button>

                <button
                  onClick={() => setFilterMode('good')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterMode === 'good'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Good ({goodCount})</span>
                </button>

                <button
                  onClick={() => setFilterMode('low')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterMode === 'low'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Low ({lowStockCount})</span>
                </button>

                <button
                  onClick={() => setFilterMode('out')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterMode === 'out'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-red-800 hover:bg-red-50'
                  }`}
                >
                  <XCircle className="w-3 h-3" />
                  <span>Out ({outOfStockCount})</span>
                </button>
              </div>

            </div>

            {/* 1. MAIN SCREEN — NEAT RESPONSIVE GRID OF ALL 35 COUNTERS */}
            {filteredCounters.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 my-6">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">No counters found</h4>
                <p className="text-xs text-slate-500 mt-1">
                  No counter matched "{searchQuery}". Try searching by counter number or branch name.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterMode('all');
                  }}
                  className="mt-3 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredCounters.map((item) => (
                  <CounterCard
                    key={item.branch.id}
                    counterNumber={item.counterNumber}
                    branch={item.branch}
                    onClick={() => { if (!isSnapshotMode) setSelectedCounterIndex(item.index); }}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </main>

      {/* 2. DETAIL MODAL: CLICK A COUNTER TO MANAGE ITS STOCK */}
      {selectedCounterIndex !== null && branches[selectedCounterIndex] && (
        <CounterStockModal
          counterNumber={selectedCounterIndex + 1}
          branch={branches[selectedCounterIndex]}
          onClose={() => setSelectedCounterIndex(null)}
        />
      )}

      {/* 5. SIMPLE MONTHLY REPORT MODAL */}
      {monthlyReportOpen && (
        <SimpleMonthlyReportModal
          branches={branches}
          onClose={() => setMonthlyReportOpen(false)}
        />
      )}

      {/* System Toast Feedback Layer */}
      <ToastContainer />

      {/* Bottom Footer */}
      <footer className="mt-auto bg-white border-t border-slate-200 py-3 text-center text-[11px] text-slate-400">
        Eyekart Healthcare Limited • Nairobi, Kenya • 35 Active Counters • Stock Threshold: 50 Frames
      </footer>

    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <ReceptionistDashboard />
    </AppProvider>
  );
}
