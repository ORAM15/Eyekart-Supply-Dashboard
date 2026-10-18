import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  BellRing,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShoppingCart,
  Check,
  ShieldAlert,
  Filter,
} from 'lucide-react';

export const AlertsView: React.FC = () => {
  const { alerts, branches, openOrderDrawer, acknowledgeAlert, currentUser } = useApp();
  const [filter, setFilter] = useState<'ACTIVE' | 'RESOLVED' | 'ALL'>('ACTIVE');

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'ACTIVE') return !a.resolvedAt;
    if (filter === 'RESOLVED') return Boolean(a.resolvedAt);
    return true;
  });

  const activeCount = alerts.filter((a) => !a.resolvedAt).length;
  const zeroStockCount = alerts.filter((a) => !a.resolvedAt && a.currentStock === 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Stock Alert & Shortage Monitoring
          </h2>
          <p className="text-xs text-slate-500">
            Real-time threshold evaluation (Policy Minimum: 50 frames per branch). Exactly 50 is Healthy.
          </p>
        </div>

        {/* Filter Switcher */}
        <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
              filter === 'ACTIVE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Active Shortages ({activeCount})
          </button>
          <button
            onClick={() => setFilter('RESOLVED')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filter === 'RESOLVED'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Resolved History ({alerts.filter((a) => a.resolvedAt).length})
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filter === 'ALL'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Alerts ({alerts.length})
          </button>
        </div>
      </div>

      {/* Overview Metric Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-950">
          <div className="flex items-center space-x-2 text-rose-700 font-bold text-xs uppercase tracking-wider mb-1">
            <AlertCircle className="w-4 h-4" />
            <span>Out of Stock (Zero Frames)</span>
          </div>
          <div className="text-2xl font-black">{zeroStockCount} Outlets</div>
          <p className="text-[11px] text-rose-800 mt-1">
            Critical emergency. Counter unable to dispense any frames.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-950">
          <div className="flex items-center space-x-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Low Stock (1–49 Frames)</span>
          </div>
          <div className="text-2xl font-black">{activeCount - zeroStockCount} Outlets</div>
          <p className="text-[11px] text-amber-800 mt-1">
            Below safe 50-frames operating threshold. Needs replenishment.
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-950">
          <div className="flex items-center space-x-2 text-emerald-700 font-bold text-xs uppercase tracking-wider mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Healthy Branches</span>
          </div>
          <div className="text-2xl font-black">
            {branches.filter((b) => b.inventory.totalOnHand >= b.minThreshold).length} Outlets
          </div>
          <p className="text-[11px] text-emerald-800 mt-1">
            Stock satisfies or exceeds mandatory 50-frame requirement.
          </p>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h4 className="font-bold text-slate-800 text-sm">No Active Alerts</h4>
            <p className="text-xs text-slate-500 mt-1">
              All retail branch inventories are compliant with operating stock thresholds.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCritical = alert.currentStock === 0;
            return (
              <div
                key={alert.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isCritical
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : alert.resolvedAt
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-amber-50/70 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <span className="font-extrabold text-base text-slate-900">
                        {alert.branchName}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isCritical
                            ? 'bg-rose-200 text-rose-900'
                            : alert.resolvedAt
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        {alert.resolvedAt
                          ? 'Resolved'
                          : isCritical
                          ? 'Critical: Zero Stock'
                          : `Low Stock: ${alert.currentStock} Frames`}
                      </span>
                      {alert.acknowledged && !alert.resolvedAt && (
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                          Acknowledged by {alert.acknowledgedBy}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      {alert.recommendedAction}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
                      <span>
                        Current Stock:{' '}
                        <strong className="text-slate-900">{alert.currentStock}</strong> frames
                      </span>
                      <span>•</span>
                      <span>
                        Min Threshold:{' '}
                        <strong className="text-slate-900">{alert.minThreshold}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Shortage:{' '}
                        <strong className="text-rose-700 font-bold">{alert.shortageAmount}</strong>{' '}
                        frames
                      </span>
                      <span>•</span>
                      <span>
                        Category Breakdown: Male: {alert.maleBalance} | Female: {alert.femaleBalance} | Kids: {alert.kidsBalance}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 mt-2 flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Detected:{' '}
                        {new Date(alert.detectedAt).toLocaleString('en-GB', {
                          timeZone: 'Africa/Nairobi',
                        })}
                      </span>
                      {alert.resolvedAt && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold">
                            Resolved:{' '}
                            {new Date(alert.resolvedAt).toLocaleString('en-GB', {
                              timeZone: 'Africa/Nairobi',
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  {!alert.resolvedAt && (
                    <div className="flex items-center space-x-2 shrink-0">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors"
                        >
                          <Check className="w-3.5 h-3.5 text-slate-500" />
                          <span>Acknowledge</span>
                        </button>
                      )}

                      <button
                        onClick={() => openOrderDrawer(alert.branchId)}
                        className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Order Restock</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-600 space-y-1">
        <div className="font-bold text-slate-800">Operational Alert Policy:</div>
        <p>
          1. Alerts are triggered immediately when on-hand stock falls below 50 frames.
        </p>
        <p>
          2. Acknowledging an alert records staff review, but does NOT remove or hide the shortage warning until stock is physically confirmed delivered.
        </p>
        <p>
          3. When delivery is received, the system verifies total stock &gt;= 50 frames and resolves the active alert automatically while preserving complete history.
        </p>
      </div>
    </div>
  );
};
