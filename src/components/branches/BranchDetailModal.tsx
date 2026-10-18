import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.js';
import type { Branch, StockCategory } from '../../types/index.js';
import {
  X,
  Building2,
  Boxes,
  AlertTriangle,
  History,
  ShoppingCart,
  Sliders,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Truck,
  RotateCcw,
} from 'lucide-react';

interface Props {
  branchId: string;
  onClose: () => void;
}

export const BranchDetailModal: React.FC<Props> = ({ branchId, onClose }) => {
  const {
    branches,
    orders,
    movements,
    alerts,
    currentUser,
    openOrderDrawer,
    updateBranchThreshold,
    adjustStock,
    verifyBranchName,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'inventory' | 'orders' | 'history' | 'admin'>('inventory');

  // Admin stock adjustment form state
  const [adjustCategory, setAdjustCategory] = useState<StockCategory>('male');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState(false);

  // Threshold form state
  const [newThreshold, setNewThreshold] = useState<number>(50);
  const [updatingThreshold, setUpdatingThreshold] = useState(false);

  const branch = branches.find((b) => b.id === branchId);
  if (!branch) return null;

  const branchOrders = orders.filter((o) => o.branchId === branch.id);
  const branchMovements = movements.filter((m) => m.branchId === branch.id);
  const branchAlert = alerts.find((a) => a.branchId === branch.id && !a.resolvedAt);

  const handleExecuteAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustReason.trim()) {
      alert('Audit reason is mandatory for manual stock adjustments.');
      return;
    }
    setAdjusting(true);
    try {
      await adjustStock(branch.id, adjustCategory, adjustQty, adjustReason);
      setAdjustReason('');
    } finally {
      setAdjusting(false);
    }
  };

  const handleUpdateThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingThreshold(true);
    try {
      await updateBranchThreshold(branch.id, newThreshold);
    } finally {
      setUpdatingThreshold(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  SRN #{branch.srn} • ID: {branch.id}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    branch.status === 'HEALTHY'
                      ? 'bg-emerald-100 text-emerald-800'
                      : branch.status === 'LOW_STOCK'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {branch.status}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span>{branch.name}</span>
                {branch.hasNameAnomaly && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded-full">
                    Formula Anomaly
                  </span>
                )}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Anomaly Resolution Banner */}
        {branch.hasNameAnomaly && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Accidental cell range formula detected in spreadsheet:{' '}
                <span className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">
                  {branch.originalName}
                </span>
              </span>
            </div>
            <button
              onClick={() => verifyBranchName(branch.id, 'Bliss Busia')}
              className="text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
            >
              Verify as 'Bliss Busia'
            </button>
          </div>
        )}

        {/* Active Alert Warning Banner */}
        {branchAlert && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <span className="font-bold">Active Stock Alert: </span>
                {branchAlert.recommendedAction}
              </div>
            </div>
            <button
              onClick={() => openOrderDrawer(branch.id)}
              className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg transition-colors shadow-2xs shrink-0 ml-3"
            >
              Order Restock
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white text-xs font-semibold">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-3 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'inventory'
                ? 'border-teal-600 text-teal-800 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Category Balances</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'orders'
                ? 'border-teal-600 text-teal-800 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Branch Orders ({branchOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'history'
                ? 'border-teal-600 text-teal-800 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Movement Audit ({branchMovements.length})</span>
          </button>

          {currentUser.role === 'ADMIN' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`py-3 px-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
                activeTab === 'admin'
                  ? 'border-teal-600 text-teal-800 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Admin Controls</span>
            </button>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: Category Balances */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              {/* Summary Metrics */}
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Male Frames</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {branch.inventory.male.onHand}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Female Frames</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {branch.inventory.female.onHand}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Kids' Frames</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {branch.inventory.kids.onHand}
                  </div>
                </div>
                <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
                  <div className="text-[10px] text-teal-700 uppercase font-semibold">Total On-Hand</div>
                  <div className="text-xl font-black text-teal-900 mt-1">
                    {branch.inventory.totalOnHand}
                  </div>
                </div>
              </div>

              {/* Comprehensive Inventory Pipeline Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Detailed Category Stock Breakdown
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] text-slate-500 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-semibold">Inventory Metric</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Male</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Female</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Kids</th>
                      <th className="py-2.5 px-3 font-bold text-right text-slate-800">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        1. Physical On-Hand Stock
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium">{branch.inventory.male.onHand}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{branch.inventory.female.onHand}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{branch.inventory.kids.onHand}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-teal-700">
                        {branch.inventory.totalOnHand}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        2. Pending Requisitions
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-700">
                        {branch.inventory.male.pendingRequested}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-700">
                        {branch.inventory.female.pendingRequested}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-700">
                        {branch.inventory.kids.pendingRequested}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                        {branch.inventory.totalPendingRequested}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        3. Approved for Supply
                      </td>
                      <td className="py-2.5 px-3 text-right text-sky-700">
                        {branch.inventory.male.approved}
                      </td>
                      <td className="py-2.5 px-3 text-right text-sky-700">
                        {branch.inventory.female.approved}
                      </td>
                      <td className="py-2.5 px-3 text-right text-sky-700">
                        {branch.inventory.kids.approved}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-sky-700">
                        {branch.inventory.male.approved +
                          branch.inventory.female.approved +
                          branch.inventory.kids.approved}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        4. Dispatched (In-Transit)
                      </td>
                      <td className="py-2.5 px-3 text-right text-indigo-700">
                        {branch.inventory.male.dispatched}
                      </td>
                      <td className="py-2.5 px-3 text-right text-indigo-700">
                        {branch.inventory.female.dispatched}
                      </td>
                      <td className="py-2.5 px-3 text-right text-indigo-700">
                        {branch.inventory.kids.dispatched}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                        {branch.inventory.totalDispatched}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 bg-slate-50 font-bold">
                      <td className="py-2.5 px-3 text-slate-900">5. Available for Dispensing</td>
                      <td className="py-2.5 px-3 text-right">{branch.inventory.male.available}</td>
                      <td className="py-2.5 px-3 text-right">{branch.inventory.female.available}</td>
                      <td className="py-2.5 px-3 text-right">{branch.inventory.kids.available}</td>
                      <td className="py-2.5 px-3 text-right text-teal-800">
                        {branch.inventory.totalAvailable}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Remarks and metadata */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Material / Remarks in Source:</span>
                  <span className="font-semibold text-slate-800">{branch.remarks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Alert Minimum Threshold:</span>
                  <span className="font-semibold text-slate-800">
                    {branch.minThreshold} frames
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Stock Movement:</span>
                  <span className="font-semibold text-slate-800">
                    {branch.lastStockMovementAt ? new Date(branch.lastStockMovementAt).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' }) : 'None'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Orders */}
          {activeTab === 'orders' && (
            <div className="space-y-3">
              {branchOrders.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <ShoppingCart className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-semibold">No orders recorded for this branch yet.</p>
                  <button
                    onClick={() => openOrderDrawer(branch.id)}
                    className="mt-3 text-xs font-bold text-teal-700 bg-teal-100 hover:bg-teal-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Create First Order
                  </button>
                </div>
              ) : (
                branchOrders.map((ord) => (
                  <div key={ord.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{ord.orderNumber}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                        {ord.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 text-[11px]">
                      <span>Requested by: {ord.requestedBy}</span>
                      <span className="font-bold text-teal-700">
                        Total: {ord.requestedItems.total} frames (M:{ord.requestedItems.male}, F:{ord.requestedItems.female}, K:{ord.requestedItems.kids})
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: History Audit */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {branchMovements.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">No movements recorded.</p>
              ) : (
                branchMovements.map((mvt) => (
                  <div key={mvt.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{mvt.movementType}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(mvt.timestamp).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' })}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{mvt.reason}</p>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">By: {mvt.actor}</span>
                      <span className="font-mono font-bold text-slate-800">
                        Prev: {mvt.previousOnHand} → Net: {mvt.quantityChanged >= 0 ? `+${mvt.quantityChanged}` : mvt.quantityChanged} → Result: {mvt.resultingOnHand}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: Admin Controls */}
          {activeTab === 'admin' && currentUser.role === 'ADMIN' && (
            <div className="space-y-6">
              {/* Threshold Editor */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Minimum Stock Alert Threshold
                </h4>
                <form onSubmit={handleUpdateThreshold} className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="1"
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(parseInt(e.target.value, 10) || 50)}
                    className="w-24 px-3 py-1.5 text-xs font-bold text-slate-900 border border-slate-300 rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={updatingThreshold}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg"
                  >
                    {updatingThreshold ? 'Saving...' : 'Update Threshold'}
                  </button>
                </form>
              </div>

              {/* Manual Stock Adjustment Form */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Direct Stock Adjustment (Audit Recorded)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Perform stock correction for breakages, recounts, or physical stocktake audits.
                </p>

                <form onSubmit={handleExecuteAdjust} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Category</label>
                      <select
                        value={adjustCategory}
                        onChange={(e) => setAdjustCategory(e.target.value as StockCategory)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2"
                      >
                        <option value="male">Male Frames</option>
                        <option value="female">Female Frames</option>
                        <option value="kids">Kids' Frames</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">New Total Count</label>
                      <input
                        type="number"
                        min="0"
                        value={adjustQty}
                        onChange={(e) => setAdjustQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Mandatory Audit Reason <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. Q4 Physical stocktake reconciliation / Damaged frames write-off"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={adjusting || !adjustReason.trim()}
                    className="w-full py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg transition-colors disabled:opacity-40"
                  >
                    {adjusting ? 'Applying Adjustment...' : 'Apply & Record Stock Adjustment'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              openOrderDrawer(branch.id);
            }}
            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs"
          >
            Create Order for {branch.name}
          </button>
        </div>
      </div>
    </div>
  );
};
