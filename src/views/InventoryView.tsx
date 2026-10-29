import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import type { StockCategory } from '../types/index.js';
import {
  Boxes,
  Building2,
  Sliders,
  AlertTriangle,
  History,
  TrendingDown,
  Warehouse,
  ShieldAlert,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const isSnapshotMode = !import.meta.env.VITE_API_BASE_URL;
  const { branches, warehouse, currentUser, adjustStock } = useApp();

  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || '');
  const [category, setCategory] = useState<StockCategory>('male');
  const [newQty, setNewQty] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState(false);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Audit reason is required for manual stock adjustments.');
      return;
    }
    if (!selectedBranch) return;

    setAdjusting(true);
    try {
      await adjustStock(selectedBranch.id, category, newQty, reason);
      setReason('');
    } finally {
      setAdjusting(false);
    }
  };

  const totalBranchStock = branches.reduce((acc, b) => acc + b.inventory.totalOnHand, 0);
  const totalMale = branches.reduce((acc, b) => acc + b.inventory.male.onHand, 0);
  const totalFemale = branches.reduce((acc, b) => acc + b.inventory.female.onHand, 0);
  const totalKids = branches.reduce((acc, b) => acc + b.inventory.kids.onHand, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Inventory & Warehouse Management
        </h2>
        <p className="text-xs text-slate-500">
          Separate tracking of Central Optical Warehouse (Nairobi HQ) and 35 Branch Outlets
        </p>
      </div>

      {/* Central Warehouse vs Branch Network Dual Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Central Warehouse Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Warehouse className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-sm tracking-wide uppercase">
                HQ Central Optical Warehouse (Nairobi)
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Bulk Reserve
            </span>
          </div>

          <div className="text-3xl font-black text-teal-400 mb-1">
            {warehouse ? warehouse.totalOnHand.toLocaleString() : 'Not verified'}
            <span className="text-xs font-normal text-slate-300">
              {warehouse ? 'frames available' : 'warehouse stock not verified'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Central supplier stock from which approved retail counter orders are dispatched.
          </p>

          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Male</span>
              <div className="text-base font-bold text-white mt-1">
                {warehouse ? warehouse.maleOnHand.toLocaleString() : '—'}
              </div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Female</span>
              <div className="text-base font-bold text-white mt-1">
                {warehouse ? warehouse.femaleOnHand.toLocaleString() : '—'}
              </div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Kids</span>
              <div className="text-base font-bold text-white mt-1">
                {warehouse ? warehouse.kidsOnHand.toLocaleString() : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Aggregate Branch Network Card */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-teal-600" />
              <h3 className="font-bold text-slate-900 text-sm tracking-wide uppercase">
                Total Retail Branch Inventories
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
              35 Counter Outlets
            </span>
          </div>

          <div className="text-3xl font-black text-slate-900 mb-1">
            {totalBranchStock.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-500">frames across branches</span>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Dispensing inventory on hand at retail counter counters across Kenya.
          </p>

          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Male Frames</span>
              <div className="text-base font-bold text-slate-900 mt-1">{totalMale.toLocaleString()}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Female Frames</span>
              <div className="text-base font-bold text-slate-900 mt-1">{totalFemale.toLocaleString()}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Kids' Frames</span>
              <div className="text-base font-bold text-slate-900 mt-1">{totalKids.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Manual Adjustment Module */}
      {currentUser.role === 'ADMIN' && !isSnapshotMode && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-slate-700" />
            <h3 className="font-bold text-slate-900 text-sm">
              Authorized Stock Correction & Physical Count Audit
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Stock adjustments immediately create immutable append-only audit entries with before/after counts.
          </p>

          <form onSubmit={handleAdjustSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Select Branch
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  const b = branches.find((item) => item.id === e.target.value);
                  if (b) setNewQty(b.inventory[category].onHand);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-900"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (Total: {b.inventory.totalOnHand})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Frame Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const cat = e.target.value as StockCategory;
                  setCategory(cat);
                  if (selectedBranch) setNewQty(selectedBranch.inventory[cat].onHand);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-900"
              >
                <option value="male">Male Frames</option>
                <option value="female">Female Frames</option>
                <option value="kids">Kids' Frames</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                New Total Quantity (Current: {selectedBranch?.inventory[category].onHand || 0})
              </label>
              <input
                type="number"
                min="0"
                value={newQty}
                onChange={(e) => setNewQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mandatory Reason for Stock Adjustment <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Broken display frames / Physical audit variance reconciliation"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={adjusting || !reason.trim()}
                className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg transition-colors disabled:opacity-40"
              >
                {adjusting ? 'Updating...' : 'Apply Correction'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
