import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import type { MovementType } from '../types/index.js';
import {
  ClipboardList,
  Search,
  Filter,
  ArrowRight,
  Clock,
  ShieldCheck,
  Building2,
  User,
  Calendar,
} from 'lucide-react';

export const ActivityLogView: React.FC = () => {
  const { movements, branches } = useApp();

  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  const filtered = movements.filter((m) => {
    if (selectedBranch !== 'ALL' && m.branchId !== selectedBranch) return false;
    if (selectedType !== 'ALL' && m.movementType !== selectedType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchBranch = m.branchName.toLowerCase().includes(q);
      const matchActor = m.actor.toLowerCase().includes(q);
      const matchReason = m.reason.toLowerCase().includes(q);
      const matchOrder = m.orderNumber?.toLowerCase().includes(q) || false;
      if (!matchBranch && !matchActor && !matchReason && !matchOrder) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Audit & Movement History
        </h2>
        <p className="text-xs text-slate-500">
          Permanent append-only ledger tracking all physical stock alterations, imports, and order events
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by branch, actor, reason, order #..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        {/* Branch Filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-500 font-semibold uppercase text-[10px]">Branch:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 max-w-[180px]"
          >
            <option value="ALL">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Type Filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-500 font-semibold uppercase text-[10px]">Action:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
          >
            <option value="ALL">All Action Types</option>
            <option value="INITIAL_IMPORT">Initial Import</option>
            <option value="RECEIPT_AT_BRANCH">Receipt at Branch</option>
            <option value="DISPATCH_FROM_WAREHOUSE">Dispatch from Warehouse</option>
            <option value="ORDER_ALLOCATION">Order Created</option>
            <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
          </select>
        </div>
      </div>

      {/* Movements Timeline Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-4">Timestamp (EAT)</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-3">Event Type</th>
                <th className="py-3 px-3 text-right">Prev Count</th>
                <th className="py-3 px-3 text-center">Change</th>
                <th className="py-3 px-3 text-right">New Count</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No activity entries found matching filters.
                  </td>
                </tr>
              ) : (
                filtered.map((mvt) => (
                  <tr key={mvt.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(mvt.timestamp).toLocaleString('en-GB', {
                        timeZone: 'Africa/Nairobi',
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {mvt.branchName}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {mvt.movementType}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 font-mono">
                      {mvt.previousOnHand}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      {mvt.quantityChanged > 0 ? (
                        <span className="text-emerald-700 font-mono">+{mvt.quantityChanged}</span>
                      ) : mvt.quantityChanged < 0 ? (
                        <span className="text-rose-700 font-mono">{mvt.quantityChanged}</span>
                      ) : (
                        <span className="text-slate-400 font-mono">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-slate-900 font-mono">
                      {mvt.resultingOnHand}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={mvt.reason}>
                      {mvt.reason}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      <span className="inline-block bg-slate-50 px-2 py-0.5 rounded text-[11px]">
                        {mvt.actor}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
