import React, { useState, useEffect } from 'react';
import type { Branch } from '../../types/index.js';
import { api } from '../../services/api.js';
import {
  FileText,
  Download,
  X,
  Calendar,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Package,
  Layers,
  CheckCircle2,
} from 'lucide-react';

interface SimpleMonthlyReportModalProps {
  branches: Branch[];
  onClose: () => void;
}

export const SimpleMonthlyReportModal: React.FC<SimpleMonthlyReportModalProps> = ({
  branches,
  onClose,
}) => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getMonthlyReport(selectedMonth, selectedYear);
        if (isMounted) {
          setReportData(res.report);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch monthly report');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchReport();
    return () => {
      isMounted = false;
    };
  }, [selectedMonth, selectedYear]);

  // Export CSV Handler
  const handleExportCsv = () => {
    if (!reportData || !reportData.records) return;

    const headers = [
      'Counter Number',
      'Branch Name',
      'Opening Stock',
      'Stock Added',
      'Stock Removed',
      'Closing Stock',
      'Status',
    ];

    const rows = reportData.records.map((rec: any, index: number) => {
      // Find branch index to get Counter number
      const bIndex = branches.findIndex((b) => b.id === rec.branchId);
      const counterNum = bIndex !== -1 ? bIndex + 1 : index + 1;

      const opening = rec.openingStock?.total ?? 0;
      const added = (rec.receivedStock?.total ?? 0) + Math.max(0, rec.adjustments?.total ?? 0);
      const removed = (rec.dispatchedStock?.total ?? 0) + Math.abs(Math.min(0, rec.adjustments?.total ?? 0));
      const closing = rec.closingStock?.total ?? 0;
      const status = closing === 0 ? 'OUT OF STOCK' : closing < 50 ? 'LOW STOCK' : 'GOOD';

      return [
        `Counter ${counterNum}`,
        `"${rec.branchName.replace(/"/g, '""')}"`,
        opening,
        added,
        removed,
        closing,
        status,
      ].join(',');
    });

    // Add totals row
    const totals = reportData.totals;
    const totalsRow = [
      'TOTAL ALL COUNTERS',
      '35 Branches',
      totals?.totalOpening ?? 0,
      totals?.totalReceived ?? 0,
      totals?.totalDispatched ?? 0,
      totals?.totalClosing ?? 0,
      totals?.lowStockIncidentsCount > 0 ? `${totals.lowStockIncidentsCount} Below Min` : 'Healthy',
    ].join(',');

    const csvContent = [headers.join(','), ...rows, totalsRow].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Eyekart-Monthly-Stock-Report-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Monthly Stock Report
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                Eyekart Healthcare Limited • Eyewear Inventory Reconciliation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handleExportCsv}
              disabled={loading || !reportData}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Report</span>
            </button>

            <button
              onClick={onClose}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white rounded-xl transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Month Selector Filter Bar */}
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Select Month & Year:</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
            </select>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Generating monthly report figures...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center text-red-800 text-sm">
              {error}
            </div>
          ) : reportData ? (
            <>
              {/* TOP 5 METRIC CARDS REQUIRED BY USER:
                  1. Opening Stock
                  2. Stock Added
                  3. Stock Removed or Dispatched
                  4. Closing Stock
                  5. Counters below minimum stock level
              */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* 1. Opening Stock */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Opening Stock
                  </p>
                  <p className="text-2xl font-black text-slate-900">
                    {reportData.totals?.totalOpening ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Start of period</p>
                </div>

                {/* 2. Stock Added */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                    Stock Added
                  </p>
                  <p className="text-2xl font-black text-emerald-700">
                    +{(reportData.totals?.totalReceived ?? 0) + Math.max(0, reportData.totals?.totalAdjustments ?? 0)}
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-1">Deliveries & adjustments</p>
                </div>

                {/* 3. Stock Removed */}
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                  <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                    Stock Removed
                  </p>
                  <p className="text-2xl font-black text-rose-700">
                    -{(reportData.totals?.totalDispatched ?? 0) + Math.abs(Math.min(0, reportData.totals?.totalAdjustments ?? 0))}
                  </p>
                  <p className="text-[11px] text-rose-600 mt-1">Dispatches & reductions</p>
                </div>

                {/* 4. Closing Stock */}
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl">
                  <p className="text-[11px] font-bold text-teal-800 uppercase tracking-wider mb-1">
                    Closing Stock
                  </p>
                  <p className="text-2xl font-black text-teal-800">
                    {reportData.totals?.totalClosing ?? 0}
                  </p>
                  <p className="text-[11px] text-teal-600 mt-1">End of period balance</p>
                </div>

                {/* 5. Below Minimum Stock */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl col-span-2 sm:col-span-1">
                  <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                    Below Minimum
                  </p>
                  <p className="text-2xl font-black text-amber-700">
                    {reportData.totals?.lowStockIncidentsCount ?? 0}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1">Counters below 50 frames</p>
                </div>
              </div>

              {/* SUMMARY TABLE FOR EVERY COUNTER */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                    Counter Summary (All 35 Branches)
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Period: {reportData.periodLabel}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Counter #</th>
                          <th className="py-3 px-4">Branch Name</th>
                          <th className="py-3 px-4 text-right">Opening</th>
                          <th className="py-3 px-4 text-right text-emerald-700">Added</th>
                          <th className="py-3 px-4 text-right text-rose-700">Removed</th>
                          <th className="py-3 px-4 text-right font-black">Closing</th>
                          <th className="py-3 px-4 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {reportData.records?.map((rec: any, idx: number) => {
                          const bIndex = branches.findIndex((b) => b.id === rec.branchId);
                          const counterNum = bIndex !== -1 ? bIndex + 1 : idx + 1;

                          const opening = rec.openingStock?.total ?? 0;
                          const added = (rec.receivedStock?.total ?? 0) + Math.max(0, rec.adjustments?.total ?? 0);
                          const removed = (rec.dispatchedStock?.total ?? 0) + Math.abs(Math.min(0, rec.adjustments?.total ?? 0));
                          const closing = rec.closingStock?.total ?? 0;

                          const isZero = closing === 0;
                          const isLow = closing > 0 && closing < 50;

                          return (
                            <tr key={rec.branchId} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-black text-slate-900">
                                Counter {counterNum}
                              </td>
                              <td className="py-2.5 px-4 font-semibold text-slate-800">
                                {rec.branchName}
                              </td>
                              <td className="py-2.5 px-4 text-right font-medium text-slate-600">
                                {opening}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-emerald-600">
                                {added > 0 ? `+${added}` : '0'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-bold text-rose-600">
                                {removed > 0 ? `-${removed}` : '0'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-black text-slate-900 text-sm">
                                {closing}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                {isZero ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                                    OUT OF STOCK
                                  </span>
                                ) : isLow ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    LOW STOCK
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    GOOD
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-medium">
            35 Counters Total • Minimum required stock threshold: 50 frames
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 rounded-xl text-xs font-bold transition-colors"
          >
            Close Report
          </button>
        </div>

      </div>
    </div>
  );
};
