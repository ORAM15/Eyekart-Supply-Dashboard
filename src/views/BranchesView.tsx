import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  Building2,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  Boxes,
  ShoppingCart,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { BranchDetailModal } from '../components/branches/BranchDetailModal.js';
import { AddBranchModal } from '../components/branches/AddBranchModal.js';

type BranchFilterType =
  | 'ALL'
  | 'HEALTHY'
  | 'BELOW_50'
  | 'ZERO_STOCK'
  | 'PENDING_ORDERS'
  | 'NEED_VERIFY';

export const BranchesView: React.FC = () => {
  const {
    branches,
    selectedBranchId,
    setSelectedBranchId,
    openOrderDrawer,
    searchQuery,
    setSearchQuery,
    currentUser,
  } = useApp();

  const [filterType, setFilterType] = useState<BranchFilterType>('ALL');
  const [sortField, setSortField] = useState<'srn' | 'name' | 'total' | 'status'>('srn');
  const [sortAsc, setSortAsc] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Filter logic
  let filtered = branches.filter((b) => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = b.name.toLowerCase().includes(q);
      const matchSrn = b.srn.toString().includes(q);
      const matchRemarks = b.remarks.toLowerCase().includes(q);
      if (!matchName && !matchSrn && !matchRemarks) return false;
    }

    // Type filter
    if (filterType === 'HEALTHY') return b.status === 'HEALTHY';
    if (filterType === 'BELOW_50') return b.inventory.totalOnHand < b.minThreshold;
    if (filterType === 'ZERO_STOCK') return b.inventory.totalOnHand === 0;
    if (filterType === 'PENDING_ORDERS') return b.inventory.totalPendingRequested > 0;
    if (filterType === 'NEED_VERIFY') return b.hasNameAnomaly || !b.isVerified;

    return true;
  });

  // Sort logic
  filtered.sort((a, b) => {
    let comparison = 0;
    if (sortField === 'srn') comparison = a.srn - b.srn;
    if (sortField === 'name') comparison = a.name.localeCompare(b.name);
    if (sortField === 'total') comparison = a.inventory.totalOnHand - b.inventory.totalOnHand;
    if (sortField === 'status') comparison = a.status.localeCompare(b.status);
    return sortAsc ? comparison : -comparison;
  });

  const healthyCount = branches.filter((b) => b.status === 'HEALTHY').length;
  const below50Count = branches.filter((b) => b.inventory.totalOnHand < b.minThreshold).length;
  const zeroCount = branches.filter((b) => b.inventory.totalOnHand === 0).length;
  const pendingOrdersCount = branches.filter((b) => b.inventory.totalPendingRequested > 0).length;
  const needVerifyCount = branches.filter((b) => b.hasNameAnomaly || !b.isVerified).length;

  const handleSort = (field: 'srn' | 'name' | 'total' | 'status') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Branch Network & Inventory Register
          </h2>
          <p className="text-xs text-slate-500">
            All 35 retail outlets, counter clinics, and optical dispensary locations
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {currentUser.role === 'ADMIN' && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Branch</span>
            </button>
          )}

          <button
            onClick={() => openOrderDrawer()}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Create Order</span>
          </button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
            filterType === 'ALL'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Branches ({branches.length})
        </button>

        <button
          onClick={() => setFilterType('HEALTHY')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
            filterType === 'HEALTHY'
              ? 'bg-emerald-700 text-white'
              : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          Healthy Stock ({healthyCount})
        </button>

        <button
          onClick={() => setFilterType('BELOW_50')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
            filterType === 'BELOW_50'
              ? 'bg-amber-600 text-white'
              : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
          }`}
        >
          Below 50 Frames ({below50Count})
        </button>

        <button
          onClick={() => setFilterType('ZERO_STOCK')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
            filterType === 'ZERO_STOCK'
              ? 'bg-rose-700 text-white'
              : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
          }`}
        >
          Zero Stock ({zeroCount})
        </button>

        <button
          onClick={() => setFilterType('PENDING_ORDERS')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
            filterType === 'PENDING_ORDERS'
              ? 'bg-sky-700 text-white'
              : 'bg-white text-sky-800 border border-sky-200 hover:bg-sky-50'
          }`}
        >
          Pending Orders ({pendingOrdersCount})
        </button>

        <button
          onClick={() => setFilterType('NEED_VERIFY')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
            filterType === 'NEED_VERIFY'
              ? 'bg-indigo-700 text-white'
              : 'bg-white text-indigo-800 border border-indigo-200 hover:bg-indigo-50'
          }`}
        >
          Verification Flags ({needVerifyCount})
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th
                  onClick={() => handleSort('srn')}
                  className="py-3 px-4 font-bold cursor-pointer hover:text-slate-800 select-none"
                >
                  <div className="flex items-center space-x-1">
                    <span>SRN</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 font-bold cursor-pointer hover:text-slate-800 select-none"
                >
                  <div className="flex items-center space-x-1">
                    <span>Branch Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 font-semibold text-right">Male</th>
                <th className="py-3 px-3 font-semibold text-right">Female</th>
                <th className="py-3 px-3 font-semibold text-right">Kids</th>
                <th
                  onClick={() => handleSort('total')}
                  className="py-3 px-4 font-bold text-right cursor-pointer hover:text-slate-800 select-none"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Total Stock</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 font-semibold text-right text-slate-500">Min Threshold</th>
                <th className="py-3 px-3 font-semibold text-right text-slate-500">Pending Order</th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-4 font-bold text-center cursor-pointer hover:text-slate-800 select-none"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No branches match your current search or filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-teal-50/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedBranchId(b.id)}
                  >
                    <td className="py-3.5 px-4 font-mono text-slate-400">#{b.srn}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center space-x-2">
                        <span>{b.name}</span>
                        {b.hasNameAnomaly && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded-full">
                            Formula Flag
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                        {b.remarks}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-700">
                      {b.inventory.male.onHand}
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-700">
                      {b.inventory.female.onHand}
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-700">
                      {b.inventory.kids.onHand}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                      {b.inventory.totalOnHand}
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-500">
                      {b.minThreshold}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      {b.inventory.totalPendingRequested > 0 ? (
                        <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full text-[11px]">
                          +{b.inventory.totalPendingRequested}
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          b.status === 'HEALTHY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'LOW_STOCK'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td
                      className="py-3.5 px-4 text-right space-x-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openOrderDrawer(b.id)}
                        className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs transition-colors"
                      >
                        Order
                      </button>
                      <button
                        onClick={() => setSelectedBranchId(b.id)}
                        className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold text-xs transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Branch Detail Modal */}
      {selectedBranchId && (
        <BranchDetailModal
          branchId={selectedBranchId}
          onClose={() => setSelectedBranchId(null)}
        />
      )}

      {/* Add Branch Modal */}
      <AddBranchModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
    </div>
  );
};
