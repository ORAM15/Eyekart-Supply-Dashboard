import React from 'react';
import type { Branch } from '../../types/index.js';
import { AlertTriangle, XCircle, ArrowRight, ShieldCheck } from 'lucide-react';

interface LowStockAlertsBannerProps {
  branches: Branch[];
  onSelectCounter: (index: number) => void;
}

export const LowStockAlertsBanner: React.FC<LowStockAlertsBannerProps> = ({
  branches,
  onSelectCounter,
}) => {
  // Find all counters with stock below 50 frames
  const alertedCounters = branches
    .map((branch, index) => {
      const counterNumber = index + 1;
      const totalStock = branch.inventory.totalOnHand;
      const minRequired = branch.minThreshold || 50;
      const isShortage = totalStock < minRequired;
      const isOutOfStock = totalStock === 0;

      return {
        index,
        counterNumber,
        branch,
        totalStock,
        minRequired,
        isShortage,
        isOutOfStock,
        remaining: totalStock,
      };
    })
    .filter((item) => item.isShortage);

  if (alertedCounters.length === 0) {
    return (
      <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 shadow-sm">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs sm:text-sm font-bold text-emerald-800">
            All 35 counters meet the minimum stock requirement (50+ frames). Inventory is healthy.
          </p>
        </div>
      </div>
    );
  }

  // Count out of stock vs low stock
  const outOfStockCount = alertedCounters.filter((c) => c.isOutOfStock).length;
  const lowStockCount = alertedCounters.length - outOfStockCount;

  return (
    <section aria-label="Stock Alerts" className="mb-6">
      <div className="bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 border-2 border-red-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <h2 className="text-sm font-black uppercase tracking-wider text-red-950">
              Automatic Low-Stock Notifications ({alertedCounters.length} Counters Need Attention)
            </h2>
          </div>
          <p className="text-xs text-slate-600 font-semibold">
            {outOfStockCount > 0 && (
              <span className="text-red-700 font-bold mr-2">
                {outOfStockCount} Out of Stock
              </span>
            )}
            {lowStockCount > 0 && (
              <span className="text-amber-800 font-bold">
                {lowStockCount} Low Stock
              </span>
            )}
          </p>
        </div>

        {/* List of alert items */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {alertedCounters.map((item) => {
            const isZero = item.isOutOfStock;

            // Strict user formatting:
            // "Counter 4 — LOW STOCK: Only 32 frames remaining. Minimum required: 50."
            // "Counter 12 — OUT OF STOCK: No frames remaining. Minimum required: 50."
            const alertText = isZero
              ? `Counter ${item.counterNumber} (${item.branch.name}) — OUT OF STOCK: No frames remaining. Minimum required: ${item.minRequired}.`
              : `Counter ${item.counterNumber} (${item.branch.name}) — LOW STOCK: Only ${item.remaining} frames remaining. Minimum required: ${item.minRequired}.`;

            return (
              <button
                key={item.branch.id}
                onClick={() => onSelectCounter(item.index)}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all transform hover:-translate-y-0.5 shadow-sm cursor-pointer ${
                  isZero
                    ? 'bg-red-100/90 border-red-300 hover:bg-red-200 text-red-950'
                    : 'bg-amber-100/90 border-amber-300 hover:bg-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {isZero ? (
                    <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs sm:text-[13px] font-bold leading-snug">
                      {alertText}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/80 shadow-xs">
                  <span>Manage</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
